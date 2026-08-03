import os
import secrets

from fastapi import Header, HTTPException

ADMIN_PANEL_PASSWORD_ENV = "ADMIN_PANEL_PASSWORD"


def get_admin_panel_password() -> str | None:
    return os.getenv(ADMIN_PANEL_PASSWORD_ENV)


def is_valid_admin_panel_password(password: str | None) -> bool:
    expected = get_admin_panel_password()
    if not expected or not password:
        return False
    return secrets.compare_digest(password, expected)


async def verificar_acceso_admin(
    x_admin_password: str | None = Header(None, alias="X-Admin-Password"),
):
    if not get_admin_panel_password():
        raise HTTPException(
            status_code=503,
            detail="ADMIN_PANEL_PASSWORD no está configurada en el servidor.",
        )
    if not is_valid_admin_panel_password(x_admin_password):
        raise HTTPException(status_code=403, detail="Contraseña de admin incorrecta.")
    return {"authenticated": True}
