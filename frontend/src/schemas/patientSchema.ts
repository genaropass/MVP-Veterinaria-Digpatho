// src/schemas/patientSchema.ts
import { z } from "zod";

export const patientBaseSchema = z.object({
  dni: z.string().min(6).max(8).regex(/^\d+$/),
  nombre: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/),
  sexo: z.enum(["M", "F"]),
  fecha_de_nacimiento: z
    .string()
    .min(1)
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const minDate = new Date();
      minDate.setFullYear(today.getFullYear() - 120);
      return birthDate <= today && birthDate >= minDate;
    }),
});

// Use this only for type inference
export type PatientFormData = z.infer<typeof patientBaseSchema>;



export const getPatientSchema = (t: (key: string) => string) => {
  return z.object({
    dni: z
      .string()
      .min(6, t("validations.patient-id-min"))
      .max(8, t("validations.patient-id-max"))
      .regex(/^\d+$/, t("validations.id-numbers-only")),
    nombre: z
      .string()
      .min(2, t("validations.patient-name-min"))
      .max(100, t("validations.patient-name-max"))
      .regex(/^[a-zA-ZÀ-ÿ\s]+$/, t("validations.patient-name-letters-only")),
    sexo: z.enum(["M", "F"], {
      errorMap: () => ({ message: t("validations.sex-selection-required") }),
    }),
    fecha_de_nacimiento: z
      .string()
      .min(1, t("validations.birthdate-required"))
      .refine(
        (date) => {
          const birthDate = new Date(date);
          const today = new Date();
          const minDate = new Date();
          minDate.setFullYear(today.getFullYear() - 120);
          return birthDate <= today && birthDate >= minDate;
        },
       
      ),
  });
};
