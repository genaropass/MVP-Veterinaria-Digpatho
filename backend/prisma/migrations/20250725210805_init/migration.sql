-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TRIAL', 'USER', 'ADMIN', 'SUPERADMIN');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "mail" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "Role" NOT NULL DEFAULT 'TRIAL',
    "doble_factor" VARCHAR(6) NOT NULL,
    "doble_factor_exp" TEXT NOT NULL,
    "creacion" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "sexo" TEXT NOT NULL,
    "fecha_de_nacimiento" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Informe" (
    "id" TEXT NOT NULL,
    "tipo_estudio" TEXT NOT NULL,
    "fecha_de_muestra" TIMESTAMP(3) NOT NULL,
    "promedio_rta_img" TEXT,
    "pacienteId" TEXT NOT NULL,

    CONSTRAINT "Informe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Imagen" (
    "id" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "informeId" TEXT NOT NULL,

    CONSTRAINT "Imagen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_mail_key" ON "Usuario"("mail");

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Informe" ADD CONSTRAINT "Informe_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Imagen" ADD CONSTRAINT "Imagen_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "Informe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
