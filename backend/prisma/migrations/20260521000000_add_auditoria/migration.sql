CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL,
    "tabla" TEXT NOT NULL,
    "operacion" TEXT NOT NULL,
    "registro_id" TEXT NOT NULL,
    "datos_previos" JSONB,
    "datos_posteriores" JSONB,
    "usuario_id" TEXT,
    "ip" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);
