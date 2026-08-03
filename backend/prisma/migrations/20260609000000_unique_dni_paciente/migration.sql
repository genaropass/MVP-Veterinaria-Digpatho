-- AlterTable: Add unique constraint to Paciente.dni
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_dni_key" UNIQUE ("dni");
