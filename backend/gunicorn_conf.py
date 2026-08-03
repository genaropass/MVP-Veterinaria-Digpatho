import multiprocessing

# Un solo worker para que estado_tareas y procesamiento_queue sean compartidos
# (evita 404 en /result/{task_id} cuando upload y polling caen en workers distintos)
workers = 1  
worker_class = "uvicorn.workers.UvicornWorker"

# Evitar 524 de Cloudflare y 504 upstream
timeout = 180           # 3 min
graceful_timeout = 30   # tiempo para cerrar workers
keepalive = 10

# IMPORTANTE: Con 1 worker, estado_tareas está en memoria. Si max_requests > 0,
# Gunicorn reinicia el worker tras N requests y se pierden todos los task_id
# → /result/{task_id} devuelve 404 "Task ID no encontrado". Debe ser 0.
max_requests = 0

# backlog bajo para no acumular 100 requests simultáneos de imágenes
backlog = 20