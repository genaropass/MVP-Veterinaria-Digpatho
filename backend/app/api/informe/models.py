from typing import Optional
from pydantic import BaseModel


# -----------------------
# Modelo base del informe
# -----------------------
class InformeBase(BaseModel):
    paciente_id: str
    fecha_de_muestra: Optional[str] = None     # ahora opcional y permite ""
    tipo_estudio: Optional[str] = "pendiente"


# -----------------------
# Crear informe
# -----------------------
class InformeCreate(InformeBase):
    pass


# -----------------------
# Respuesta del backend
# -----------------------
class InformeResponse(InformeBase):
    id: str

    class Config:
        from_attributes = True


# -----------------------
# Actualizar promedio
# -----------------------
class InformeUpdatePromedio(BaseModel):
    id: str
    promedio_rta_img: str
