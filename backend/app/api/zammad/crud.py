import os
import httpx # <--- Usamos la librería asíncrona (Punto 1 del PDF)
from fastapi import HTTPException
from app.api.mail_send import crud

zammad_url = os.getenv("ZAMMAD_URL")
# ELIMINADO: token y customer globales (Punto 2 y 3 del PDF)

async def create_ticket(email: str, asunto: str, mensaje: str):
    # 1. Seguridad: Leemos el token DENTRO de la función
    token = os.getenv("TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="Configuración incompleta: falta TOKEN de Zammad.")
    
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
            "title": asunto,
            "customer": email, # <--- CORRECCIÓN: Usamos el email real del usuario (Punto 2)
            "group_id": 1,
            "article": {
                "subject": asunto,
                "body": mensaje,
                "type": "note",
                "internal": False
            }
        }
    try:
        # 2. Rendimiento: Usamos httpx asíncrono en vez de requests (Punto 1)
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{zammad_url}/tickets", headers=headers, json=payload)
            
            # Lanzar error si Zammad responde con 4xx o 5xx
            response.raise_for_status()
            
            data = response.json()
            
            subject = "Ticket creado con éxito"
            body = f"Hola,\n\nTu ticket con ID {data['id']} fue creado exitosamente.\n\n Podrás hacer el seguimiento del estado del ticket desde nuestra plataforma ingresando el ID del ticket. \n\n¡Gracias por contactarnos!"
            
            # Enviamos el mail (Asumimos que esta función ya funciona bien)
            crud.send_email(email, subject, body) 
            
            return {"status": "ok", "ticket_id": data["id"]}
    
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Error de Zammad: {exc.response.text}")
    except Exception as e:
            raise HTTPException(status_code=500, detail=f"No se pudo crear el ticket: {str(e)}")


async def get_tickets():
    token = os.getenv("TOKEN")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{zammad_url}/tickets", headers=headers)
            response.raise_for_status()
            return response.json()
            
    except Exception as e:
            raise HTTPException(status_code=500, detail=f"No se pudo obtener los tickets: {str(e)}")


async def get_ticket_id(ticket_id):
    token = os.getenv("TOKEN")
    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{zammad_url}/tickets/{ticket_id}", headers=headers)
            response.raise_for_status()
            return response.json()

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Ticket no encontrado")
        raise HTTPException(status_code=exc.response.status_code, detail="Error al buscar ticket")
    except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


async def get_respuestas_ticket_id(ticket_id):
    token = os.getenv("TOKEN")
    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient() as client:
            # Obtener artículos relacionados al ticket (respuestas, notas, etc.)
            response = await client.get(f"{zammad_url}/ticket_articles/by_ticket/{ticket_id}", headers=headers)
            response.raise_for_status()
            articles_data = response.json()

            return {
                "respuestas": articles_data
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo obtener el ticket y sus respuestas: {str(e)}")