from pydantic import BaseModel, EmailStr


class EmailBase(BaseModel):
    email: EmailStr
    subject: str
    body: str


class EmailSchema(EmailBase):
     pass