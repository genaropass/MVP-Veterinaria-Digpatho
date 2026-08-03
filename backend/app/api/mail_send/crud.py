import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import HTTPException

MAIL=os.getenv("MAIL")
PASSWORD=os.getenv("PASSWORD")

def send_email(email, subject, body):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = MAIL
    msg["To"] = email
    part = MIMEText(body, "plain")  # "plain" o "html"
    msg.attach(part)

    try:
        with smtplib.SMTP("mail.digpatho.com", 587) as server:
            server.starttls() 
            try:
                server.login(MAIL, PASSWORD)
            except Exception:
                raise HTTPException(status_code=401, detail="Autenticación SMTP fallida. Verifica usuario y contraseña.")
            
            server.sendmail(MAIL, email, msg.as_string())
            return {"status": "ok"}
    except HTTPException as http_exc:
            raise http_exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo crear conexion con servidor SMTP: {str(e)}")
        