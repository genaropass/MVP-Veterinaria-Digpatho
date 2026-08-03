from fastapi import FastAPI, HTTPException
from app.api.mail_send.models import EmailSchema
from app.api.mail_send import crud

app = FastAPI()

def mail(app: FastAPI):
    @app.post("/send-email/", tags=["Mail"])
    async def send_email(email_data: EmailSchema):
        try:    
            crud.send_email(email_data.email, email_data.subject, email_data.body)
            
            return {"message": f"Correo enviado a {email_data.email}"}
        except HTTPException as http_exc:
            raise http_exc
        except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al enviar el correo: {e}")