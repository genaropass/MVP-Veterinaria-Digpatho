from pydantic import BaseModel, field_validator, Field

class PacienteBase(BaseModel):
    nombre: str = Field(exclude=True, min_length=2, max_length=50)
    @field_validator('nombre', mode='after')
    @classmethod
    def es_invalido(cls, value: str) -> str:
        if not value or value[0].isdigit():
            raise ValueError('El nombre no puede iniciar con un numero.')
        return value
    dni: str
    sexo: str
    fecha_de_nacimiento: str 
    mail: str 

class PacienteCreate(PacienteBase):
    pass