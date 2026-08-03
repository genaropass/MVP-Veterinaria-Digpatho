import os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from app.api.database import db
from app.api.audit import crud
from app.api.user.token.decodificar_token import verificar_admin
from typing import Optional

def add_audit_routes(app):

    @app.get("/auditoria/", tags=["Auditoría"])
    async def list_auditorias(tabla: Optional[str] = None, operacion: Optional[str] = None, _admin: dict = Depends(verificar_admin)):
        """Obtener todos los registros de auditoría. Filtrables por tabla y operación."""
        try:
            return await crud.get_all_auditorias(db, tabla, operacion)
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener auditorías.")

    @app.get("/auditoria/{tabla}/{registro_id}", tags=["Auditoría"])
    async def get_historial_registro(tabla: str, registro_id: str, _admin: dict = Depends(verificar_admin)):
        """Obtener el historial completo de un registro específico."""
        try:
            return await crud.get_auditoria_by_registro(db, tabla, registro_id)
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener historial.")

    @app.delete("/auditoria/purge", tags=["Auditoría"])
    async def purgar_auditoria(_admin: dict = Depends(verificar_admin)):
        """Elimina manualmente registros de auditoría anteriores al período de retención (AUDITORIA_RETENCION_AÑOS, default 6)."""
        try:
            eliminados = await crud.purgar_auditoria_antigua(db)
            return {"eliminados": eliminados}
        except Exception:
            raise HTTPException(status_code=500, detail="Error al purgar auditorías.")