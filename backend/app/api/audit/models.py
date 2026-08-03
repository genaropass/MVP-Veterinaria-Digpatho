from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

class AuditoriaResponse(BaseModel):
    id: str
    tabla: str
    operacion: str
    registro_id: str
    datos_previos: Optional[Any] = None
    datos_posteriores: Optional[Any] = None
    usuario_id: Optional[str] = None
    ip: Optional[str] = None
    fecha: datetime