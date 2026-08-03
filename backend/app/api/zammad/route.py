from fastapi import FastAPI, HTTPException
from app.api.zammad import crud
from app.api.zammad.models import EmailCreate


app = FastAPI()


def add_tickets_routes(app: FastAPI):
    @app.post("/tickets", tags=["Tickets"])
    async def create_ticket(emailCreate: EmailCreate):
        try:
            ticket_new= await crud.create_ticket(emailCreate.email, emailCreate.asunto, emailCreate.mensaje)
            return ticket_new
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"No se pudo crear el ticket: {str(e)}")
        

    @app.get("/tickets", tags=["Tickets"])
    async def get_tickets():
        try:
            tickets = await crud.get_tickets()
            return tickets
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"No se pudo obtener los tickets: {str(e)}")
        


    @app.get("/tickets/{ticket_id}", tags=["Tickets"])
    async def get_ticket_id(ticket_id):
        try:
            tickets = await crud.get_ticket_id(ticket_id)
            return tickets
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"No se pudo obtener el ticket: {str(e)}")
            

    @app.get("/rtas_tickets/{ticket_id}", tags=["Tickets"])
    async def get_respuestas_ticket_id(ticket_id):
        try:
            tickets = await crud.get_respuestas_ticket_id(ticket_id)
            return tickets
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"No se pudo obtener respeuestas para el ticket: {str(e)}")