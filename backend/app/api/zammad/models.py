from pydantic import BaseModel, EmailStr


class EmailBase(BaseModel):
    email: EmailStr
    asunto: str
    mensaje: str

class EmailCreate(EmailBase):
    pass