from fastapi import HTTPException
from prisma import Prisma


# ──────────────────────────────────────────────
#  Interconsulta
# ──────────────────────────────────────────────

async def create_interconsulta(db: Prisma, data: dict):
    try:
        return await db.interconsulta.create(data=data)
    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al crear la interconsulta.")


async def get_interconsulta(db: Prisma, interconsulta_id: str):
    try:
        record = await db.interconsulta.find_unique(where={"id": interconsulta_id})
        if not record:
            raise HTTPException(status_code=404, detail="Interconsulta no encontrada.")
        return record
    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener la interconsulta.")


async def get_interconsulta_by_task_id(db: Prisma, task_id: str):
    try:
        record = await db.interconsulta.find_unique(where={"taskId": task_id})
        if not record:
            raise HTTPException(status_code=404, detail="Tarea no encontrada.")
        return record
    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener la tarea de interconsulta.")


async def update_interconsulta_result(db: Prisma, interconsulta_id: str, data: dict):
    try:
        return await db.interconsulta.update(
            where={"id": interconsulta_id},
            data=data,
        )
    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al actualizar la interconsulta.")


# ──────────────────────────────────────────────
#  Vigilancia
# ──────────────────────────────────────────────

async def get_user_topics(db: Prisma, user_id: str) -> list[str]:
    try:
        records = await db.vigilanciatopic.find_many(where={"userId": user_id})
        return [r.topic for r in records]
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener temas de vigilancia.")


async def add_user_topic(db: Prisma, user_id: str, topic: str) -> list[str]:
    try:
        await db.vigilanciatopic.upsert(
            where={"userId_topic": {"userId": user_id, "topic": topic}},
            data={
                "create": {"userId": user_id, "topic": topic},
                "update": {},
            },
        )
        return await get_user_topics(db, user_id)
    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al agregar tema de vigilancia.")


async def get_vigilancia_feed(db: Prisma, topic: str | None = None, limit: int = 20):
    try:
        where = {"topic": topic} if topic else {}
        return await db.vigilanciaitem.find_many(
            where=where,
            order={"createdAt": "desc"},
            take=limit,
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener feed de vigilancia.")


async def create_vigilancia_item(db: Prisma, data: dict):
    try:
        return await db.vigilanciaitem.create(data=data)
    except Exception:
        raise HTTPException(status_code=500, detail="Error al crear item de vigilancia.")


# ──────────────────────────────────────────────
#  Cápsulas (Desafíos)
# ──────────────────────────────────────────────

async def get_current_capsula(db: Prisma):
    try:
        return await db.capsula.find_first(
            where={"active": True},
            include={"options": True},
            order={"createdAt": "desc"},
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener cápsula actual.")


async def register_vote(db: Prisma, option_id: str):
    try:
        option = await db.capsulanoption.find_unique(where={"id": option_id})
        if not option:
            raise HTTPException(status_code=404, detail="Opción no encontrada.")
        return await db.capsulanoption.update(
            where={"id": option_id},
            data={"votes": option.votes + 1},
        )
    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al registrar voto.")


# ──────────────────────────────────────────────
#  Foros
# ──────────────────────────────────────────────

async def list_threads(db: Prisma):
    try:
        return await db.forothread.find_many(
            order={"lastActivity": "desc"},
            take=50,
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Error al listar foros.")


async def create_thread(db: Prisma, data: dict):
    try:
        return await db.forothread.create(data=data)
    except Exception:
        raise HTTPException(status_code=500, detail="Error al crear hilo de foro.")


# ──────────────────────────────────────────────
#  Badges
# ──────────────────────────────────────────────

async def get_user_badges(db: Prisma, user_id: str):
    try:
        user_badges = await db.userbadge.find_many(
            where={"userId": user_id},
            include={"badge": True},
        )
        all_badges = await db.badgedefinition.find_many()

        earned_ids = {ub.badgeId for ub in user_badges}
        earned_map = {ub.badgeId: ub.earnedAt for ub in user_badges}

        result = []
        for b in all_badges:
            result.append({
                "id": b.id,
                "name": b.name,
                "description": b.description,
                "earnedAt": earned_map[b.id].isoformat() if b.id in earned_ids else None,
                "locked": b.id not in earned_ids,
            })
        return result
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener badges.")


# ──────────────────────────────────────────────
#  Divulgación
# ──────────────────────────────────────────────

async def list_drafts(db: Prisma):
    try:
        return await db.divulgacionborrador.find_many(
            order={"updatedAt": "desc"},
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Error al listar borradores.")


async def update_draft(db: Prisma, draft_id: str, data: dict):
    try:
        draft = await db.divulgacionborrador.find_unique(where={"id": draft_id})
        if not draft:
            raise HTTPException(status_code=404, detail="Borrador no encontrado.")
        return await db.divulgacionborrador.update(
            where={"id": draft_id},
            data=data,
        )
    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        raise HTTPException(status_code=500, detail="Error al actualizar borrador.")
