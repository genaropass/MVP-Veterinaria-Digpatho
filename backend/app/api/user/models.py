from pydantic import BaseModel, Field, EmailStr, field_validator
import re
import uuid

class UsuarioBase(BaseModel):
    nombre: str
    mail: EmailStr
    password: str 

class UsuarioCreate(UsuarioBase):
    pass

class UsuarioUpdateMail(UsuarioBase):
    mail: EmailStr
    mail_nuevo: EmailStr


class UsuarioMail2FA(BaseModel):
    mail: EmailStr
    codigo: str = Field(..., pattern=r'^\d{6}$')

class UsuarioLogin(BaseModel):
    mail: EmailStr
    password: str
    
class UsuarioEmail(BaseModel):
    mail: EmailStr
    
class UsuarioToken(BaseModel):
    token: str
    password:str