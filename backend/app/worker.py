# file: app/worker.py

import asyncio
import logging
from .queue import processing_queue
from .processor import process_image  # tu lógica de IA

logger = logging.getLogger(__name__)


async def queue_worker():
    logger.info("Worker iniciado. Procesando imágenes secuencialmente...")

    while True:
        job = await processing_queue.get()
        file_path = job["file_path"]
        filename = job["filename"]
        callback = job["callback"]

        logger.info("Procesando: %s", filename)

        try:
            result = await process_image(file_path)
            await callback(result)
        except Exception as e:
            logger.exception("Error procesando %s: %s", filename, e)

        processing_queue.task_done()
        logger.info("Finalizado: %s", filename)
    
