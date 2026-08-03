import os
from fastapi import FastAPI, HTTPException, Query, Request
from typing import Optional
from jose import jwt
from app.api.database import db
from app.api.bots import crud, models, service


SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")


def _get_user_id(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    while token.startswith("Bearer "):
        token = token[7:]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido o ausente.")


def add_bot_routes(app: FastAPI):

    # ──────────────────────────────────────────────
    #  Phase 0: Health
    # ──────────────────────────────────────────────

    @app.get("/bot/health", tags=["Bot Health"])
    async def bot_health():
        return models.HealthResponse()

    # ──────────────────────────────────────────────
    #  Phase 1: Bot Científico — Interconsulta
    # ──────────────────────────────────────────────

    @app.post("/bot/cientifico/interconsulta", tags=["Bot Científico"])
    async def create_interconsulta(req: models.InterconsultaRequest):
        try:
            return await service.run_interconsulta(db, req)
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al procesar interconsulta.")

    @app.get("/bot/cientifico/interconsulta/task/{task_id}", tags=["Bot Científico"])
    async def get_interconsulta_task(task_id: str):
        try:
            service.valid_uuid(task_id)
            record = await crud.get_interconsulta_by_task_id(db, task_id)
            if record.status == "done":
                return {"status": record.status, "result": _interconsulta_dict(record)}
            return {"status": record.status, "result": None}
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener estado de tarea.")

    @app.get("/bot/cientifico/interconsulta/{id}", tags=["Bot Científico"])
    async def get_interconsulta(id: str):
        try:
            service.valid_uuid(id)
            record = await crud.get_interconsulta(db, id)
            return _interconsulta_dict(record)
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener interconsulta.")

    # ──────────────────────────────────────────────
    #  Phase 2: Bot Científico — Vigilancia
    # ──────────────────────────────────────────────

    @app.get("/bot/cientifico/vigilancia/temas", tags=["Bot Científico"])
    async def get_vigilancia_temas(request: Request):
        try:
            user_id = _get_user_id(request)
            topics = await crud.get_user_topics(db, user_id)
            return {"topics": topics}
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener temas.")

    @app.post("/bot/cientifico/vigilancia/temas", tags=["Bot Científico"])
    async def add_vigilancia_tema(req: models.TopicRequest, request: Request):
        try:
            user_id = _get_user_id(request)
            topics = await crud.add_user_topic(db, user_id, req.topic)
            return {"topics": topics}
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al agregar tema.")

    @app.get("/bot/cientifico/vigilancia/feed", tags=["Bot Científico"])
    async def get_vigilancia_feed(
        topic: Optional[str] = Query(None),
        limit: int = Query(20, ge=1, le=100),
    ):
        try:
            items = await crud.get_vigilancia_feed(db, topic, limit)
            return {
                "items": [
                    {
                        "id": item.id,
                        "topic": item.topic,
                        "title": item.title,
                        "source": item.source,
                        "url": item.url,
                        "publishedAt": item.publishedAt,
                        "impact": item.impact,
                        "summary": item.summary,
                    }
                    for item in items
                ]
            }
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener feed.")

    # ──────────────────────────────────────────────
    #  Phase 3: Bot Genial — Cápsulas (Desafíos)
    # ──────────────────────────────────────────────

    @app.get("/bot/genial/capsulas/actual", tags=["Bot Genial"])
    async def get_capsula_actual():
        try:
            capsula = await crud.get_current_capsula(db)
            if not capsula:
                raise HTTPException(status_code=404, detail="No hay cápsula activa.")
            return {
                "id": capsula.id,
                "title": capsula.title,
                "specialty": capsula.specialty,
                "question": capsula.question,
                "options": [
                    {"id": opt.id, "label": opt.label, "votes": opt.votes}
                    for opt in capsula.options
                ],
                "timeLimit": capsula.timeLimit,
                "imagenId": capsula.imagenId,
            }
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener cápsula.")

    @app.post("/bot/genial/capsulas/{id}/respuesta", tags=["Bot Genial"])
    async def submit_capsula_answer(id: str, req: models.CapsuleAnswerRequest):
        try:
            service.valid_uuid(id)
            await crud.register_vote(db, req.optionId)
            return {"ok": True}
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al enviar respuesta.")

    # ──────────────────────────────────────────────
    #  Phase 3: Bot Genial — Foros
    # ──────────────────────────────────────────────

    @app.get("/bot/genial/foros", tags=["Bot Genial"])
    async def get_foros():
        try:
            threads = await crud.list_threads(db)
            return {"threads": [_forum_dict(t) for t in threads]}
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al listar foros.")

    @app.post("/bot/genial/foros", tags=["Bot Genial"])
    async def create_foro(req: models.ForumCreateRequest, request: Request):
        try:
            user_id = _get_user_id(request)
            user = await db.usuario.find_unique(where={"id": user_id})
            author_name = user.nombre if user else "Usuario"
            thread = await crud.create_thread(db, {
                "title": req.title,
                "author": author_name,
                "specialty": req.specialty,
                "tags": req.tags,
                "interconsultaId": req.interconsultaId,
            })
            return _forum_dict(thread)
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al crear foro.")

    # ──────────────────────────────────────────────
    #  Phase 3: Bot Genial — Badges
    # ──────────────────────────────────────────────

    @app.get("/bot/genial/perfil/badges", tags=["Bot Genial"])
    async def get_badges(request: Request):
        try:
            user_id = _get_user_id(request)
            badges = await crud.get_user_badges(db, user_id)
            return {"badges": badges}
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener badges.")

    # ──────────────────────────────────────────────
    #  Phase 4: Bot Genial — Divulgación
    # ──────────────────────────────────────────────

    @app.get("/bot/genial/divulgacion/borradores", tags=["Bot Genial"])
    async def get_borradores():
        try:
            drafts = await crud.list_drafts(db)
            return {"drafts": [_draft_dict(d) for d in drafts]}
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al listar borradores.")

    @app.put("/bot/genial/divulgacion/borradores/{id}", tags=["Bot Genial"])
    async def update_borrador(id: str, req: models.DraftUpdateRequest):
        try:
            service.valid_uuid(id)
            update_data = {}
            if req.action == "approve":
                update_data["status"] = "approved"
            elif req.action == "edit" and req.body:
                update_data["body"] = req.body
            else:
                raise HTTPException(status_code=400, detail="Acción inválida.")

            draft = await crud.update_draft(db, id, update_data)
            return _draft_dict(draft)
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al actualizar borrador.")

    # ──────────────────────────────────────────────
    #  Phase 4: Bot Genial — Bienestar
    # ──────────────────────────────────────────────

    @app.get("/bot/genial/bienestar", tags=["Bot Genial"])
    async def get_bienestar():
        return {
            "show": False,
            "message": "Todo bien. Recordá tomar pausas activas cada 2 horas.",
            "sessionHours": 0.0,
        }


# ──────────────────────────────────────────────
#  Helpers de serialización (camelCase, contrato del front)
# ──────────────────────────────────────────────

def _interconsulta_dict(record) -> dict:
    return {
        "id": record.id,
        "status": record.status,
        "summary": record.summary,
        "confidence": record.confidence,
        "citations": record.citations or [],
        "similarCases": record.similarCases or [],
        "heatmapRegions": record.heatmapRegions or [],
        "disclaimer": record.disclaimer,
        "imagenId": record.imagenId,
    }


def _forum_dict(t) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "author": t.author,
        "replies": t.replies,
        "specialty": t.specialty,
        "lastActivity": t.lastActivity.isoformat(),
        "tags": t.tags if isinstance(t.tags, list) else [],
        "interconsultaId": t.interconsultaId,
        "casoId": t.casoId,
    }


def _draft_dict(d) -> dict:
    return {
        "id": d.id,
        "title": d.title,
        "body": d.body,
        "status": d.status,
        "createdAt": d.createdAt.isoformat(),
        "metricsSource": d.metricsSource,
    }
