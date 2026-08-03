from pathlib import Path
from typing import Optional

from fastapi import Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.api.admin import auth, crud
from app.api.admin.auth import is_valid_admin_panel_password, verificar_acceso_admin
from app.api.database import db

PANEL_HTML = Path(__file__).parent / "panel.html"


class AdminLoginRequest(BaseModel):
    password: str


def add_admin_routes(app):

    @app.get("/admin", tags=["Admin"], include_in_schema=False)
    @app.get("/admin/", tags=["Admin"], include_in_schema=False)
    async def admin_panel():
        return HTMLResponse(PANEL_HTML.read_text(encoding="utf-8"))

    @app.post("/admin/api/login", tags=["Admin"])
    async def admin_login(body: AdminLoginRequest):
        if not auth.get_admin_panel_password():
            raise HTTPException(
                status_code=503,
                detail="ADMIN_PANEL_PASSWORD no está configurada en el servidor.",
            )
        if not is_valid_admin_panel_password(body.password):
            raise HTTPException(status_code=403, detail="Contraseña incorrecta.")
        return {"ok": True}

    @app.get("/admin/api/me", tags=["Admin"])
    async def admin_me(_session: dict = Depends(verificar_acceso_admin)):
        return {"authenticated": True, "mode": "panel"}

    @app.get("/admin/api/tables", tags=["Admin"])
    async def admin_tables(_session: dict = Depends(verificar_acceso_admin)):
        return await crud.list_tables(db)

    @app.get("/admin/api/tables/{table}", tags=["Admin"])
    async def admin_table_rows(
        table: str,
        page: int = Query(1, ge=1),
        page_size: int = Query(crud.DEFAULT_PAGE_SIZE, ge=1, le=crud.MAX_PAGE_SIZE),
        q: Optional[str] = Query(None, max_length=200),
        _session: dict = Depends(verificar_acceso_admin),
    ):
        return await crud.get_table_rows(db, table, page=page, page_size=page_size, q=q)
