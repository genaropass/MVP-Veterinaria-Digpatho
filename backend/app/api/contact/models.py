from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class DemoRequestBase(BaseModel):
    name: str
    email: EmailStr
    message: Optional[str] = None


class DemoRequestCreate(DemoRequestBase):
    pass


class DemoRequestResponse(DemoRequestBase):
    id: str
    images: List[str]
    status: str
    createdAt: datetime

    class Config:
        from_attributes = True

