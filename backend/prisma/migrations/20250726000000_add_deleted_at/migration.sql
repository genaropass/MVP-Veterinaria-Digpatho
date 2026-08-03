-- AlterTable: add deleted_at for soft delete (Usuario, Paciente, Informe, Imagen)
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "Informe" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "Imagen" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
