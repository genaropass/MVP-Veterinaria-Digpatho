-- AddColumn tipo_imagen
ALTER TABLE "Imagen"
ADD COLUMN "tipo_imagen" TEXT NOT NULL DEFAULT 'standard';