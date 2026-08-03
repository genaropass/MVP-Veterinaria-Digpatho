from datetime import date, datetime
from typing import Any, Optional

from fastapi import HTTPException
from prisma import Prisma
from prisma.errors import PrismaError

ADMIN_TABLES: dict[str, dict[str, Any]] = {
    "usuario": {
        "label": "Usuarios",
        "sensitive": ["password_hash", "doble_factor"],
        "order": {"mail": "asc"},
        "search_fields": ["mail", "nombre"],
    },
    "paciente": {
        "label": "Pacientes",
        "sensitive": [],
        "order": {"nombre": "asc"},
        "search_fields": ["nombre", "dni"],
    },
    "informe": {
        "label": "Informes",
        "sensitive": [],
        "order": {"fecha_de_muestra": "desc"},
        "search_fields": ["tipo_estudio"],
    },
    "imagen": {
        "label": "Imágenes",
        "sensitive": [],
        "order": {"id": "desc"},
        "search_fields": ["ubicacion", "tipo_imagen"],
    },
    "auditoria": {
        "label": "Auditoría",
        "sensitive": [],
        "order": {"fecha": "desc"},
        "search_fields": ["tabla", "operacion", "registro_id"],
    },
    "demorequest": {
        "label": "Demo requests",
        "sensitive": [],
        "order": {"createdAt": "desc"},
        "search_fields": ["name", "email"],
    },
}

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 50


def _serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def serialize_row(row: Any, sensitive_fields: list[str]) -> dict[str, Any]:
    data = row.model_dump() if hasattr(row, "model_dump") else dict(row)
    for field in sensitive_fields:
        if field in data and data[field] is not None:
            data[field] = "***"
    return {key: _serialize_value(val) for key, val in data.items()}


def _build_search_where(table: str, query: str) -> Optional[dict[str, Any]]:
    if not query:
        return None
    fields = ADMIN_TABLES[table]["search_fields"]
    return {
        "OR": [
            {field: {"contains": query, "mode": "insensitive"}}
            for field in fields
        ]
    }


async def list_tables(db: Prisma) -> list[dict[str, Any]]:
    tables = []
    for name, config in ADMIN_TABLES.items():
        try:
            model = getattr(db, name)
            count = await model.count()
            tables.append({"name": name, "label": config["label"], "count": count})
        except (PrismaError, AttributeError):
            continue
    return tables


async def get_table_rows(
    db: Prisma,
    table: str,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    q: Optional[str] = None,
) -> dict[str, Any]:
    if table not in ADMIN_TABLES:
        raise HTTPException(status_code=404, detail="Tabla no encontrada.")

    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
    skip = (page - 1) * page_size
    config = ADMIN_TABLES[table]
    where = _build_search_where(table, q.strip()) if q and q.strip() else None

    try:
        model = getattr(db, table)
        total = await model.count(where=where)
        rows = await model.find_many(
            where=where,
            skip=skip,
            take=page_size,
            order=config["order"],
        )
    except AttributeError:
        raise HTTPException(status_code=404, detail="Tabla no disponible.")
    except PrismaError:
        raise HTTPException(status_code=500, detail="Error al consultar la tabla.")

    return {
        "table": table,
        "label": config["label"],
        "page": page,
        "page_size": page_size,
        "total": total,
        "pages": max((total + page_size - 1) // page_size, 1),
        "rows": [serialize_row(row, config["sensitive"]) for row in rows],
    }
