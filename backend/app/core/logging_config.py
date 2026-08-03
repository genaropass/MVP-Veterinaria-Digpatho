import json
import logging
import os
from contextvars import ContextVar
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Per-request correlation context (set by middleware in main.py)
# ---------------------------------------------------------------------------

_request_id: ContextVar[str] = ContextVar("request_id", default="-")
_user_id: ContextVar[str] = ContextVar("user_id", default="-")


def get_request_id() -> str:
    return _request_id.get()


def set_request_id(value: str) -> None:
    _request_id.set(value)


def get_user_id() -> str:
    return _user_id.get()


def set_user_id(value: str) -> None:
    _user_id.set(value)


# ---------------------------------------------------------------------------
# Sensitive-data backstop filter
# Never call logger with passwords/tokens — this is a last-resort guard.
# ---------------------------------------------------------------------------

_SENSITIVE_KEYS = frozenset({
    "password", "hash_password", "token", "access_token",
    "refresh_token", "secret_key", "api_key",
})


class _SensitiveDataFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = str(record.getMessage()).lower()
        for key in _SENSITIVE_KEYS:
            if f'"{key}"' in msg or f"'{key}'" in msg or f"{key}=" in msg:
                record.msg = (
                    f"[REDACTED — log statement may contain sensitive key '{key}'. "
                    "Review the call site.]"
                )
                record.args = ()
                break
        return True


# ---------------------------------------------------------------------------
# JSON formatter (one line per record) — para archivo y sinks externos
# ---------------------------------------------------------------------------

class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "module": record.name,
            "func": record.funcName,
            "message": record.getMessage(),
            "request_id": _request_id.get(),
            "user_id": _user_id.get(),
        }
        if record.exc_info:
            entry["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Color console formatter — solo para salida humana en terminal
# ---------------------------------------------------------------------------

class _ColorConsoleFormatter(logging.Formatter):
    _COLORS = {
        "DEBUG":    "\033[2;37m",  # gris tenue
        "INFO":     "\033[32m",    # verde
        "WARNING":  "\033[33m",    # amarillo
        "ERROR":    "\033[31m",    # rojo
        "CRITICAL": "\033[1;31m",  # rojo negrita
    }
    _RESET = "\033[0m"
    _DIM   = "\033[2m"

    def format(self, record: logging.LogRecord) -> str:
        color = self._COLORS.get(record.levelname, "")
        ts    = datetime.fromtimestamp(record.created, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        req   = _request_id.get()
        req_s = f" {self._DIM}[{req[:8]}]{self._RESET}" if req != "-" else ""

        line = (
            f"{self._DIM}{ts}{self._RESET} "
            f"{color}{record.levelname:<8}{self._RESET}"
            f"{req_s} "
            f"{self._DIM}{record.name}:{record.funcName}{self._RESET} — "
            f"{record.getMessage()}"
        )

        if record.exc_info:
            line += "\n" + self.formatException(record.exc_info)
        if record.stack_info:
            line += "\n" + self.formatStack(record.stack_info)

        return line


# ---------------------------------------------------------------------------
# Public setup — call once at application startup
# ---------------------------------------------------------------------------

def setup_logging() -> None:
    """Configure application-wide logging. Must be called once before the app starts."""
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    root = logging.getLogger()
    root.setLevel(log_level)

    # Avoid duplicate handlers on hot-reload (uvicorn --reload)
    if root.handlers:
        return

    sensitive = _SensitiveDataFilter()

    # --- Console handler ---
    # LOG_JSON_CONSOLE=true  → JSON en stdout (GCP Cloud Run/GKE: Cloud Logging lo parsea)
    # LOG_JSON_CONSOLE=false → color legible para humanos (desarrollo local, default)
    json_console = os.getenv("LOG_JSON_CONSOLE", "false").lower() == "true"
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(_JsonFormatter() if json_console else _ColorConsoleFormatter())
    console_handler.addFilter(sensitive)
    root.addHandler(console_handler)

    # Silence noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    # Prisma en DEBUG loguea queries completas y respuestas con datos sensibles
    logging.getLogger("prisma").setLevel(logging.WARNING)

    # -----------------------------------------------------------------------
    # FUTURE: plug in an external log sink here (Loki, Datadog, Splunk, etc.)
    # Any standard logging.Handler subclass works without changing the rest of
    # the application.
    # -----------------------------------------------------------------------