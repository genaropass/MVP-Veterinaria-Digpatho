"use client";

import { useFormContext } from "react-hook-form";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PatientFormData } from "@/schemas/patientSchema";
import { useTranslations } from "next-intl";
import { ErrorMessage, SuccessIndicator, getInputClassName } from "../../form-utils";

export default function PatientFormFields() {
  const t = useTranslations("PatientInfoCard");
  const {
    register,
    formState: { errors, touchedFields },
    setValue,
    watch,
  } = useFormContext<PatientFormData>();

  const watchedValues = watch();

  return (
    <>
        {/* Name Field */}
        <div>
            <Label 
                htmlFor="nombre"
                className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1"
            >
                {t("patient-name")}
                <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
                <Input
                    id="nombre"
                    {...register("nombre")}
                    className={
                        getInputClassName("nombre", errors, touchedFields, watchedValues) +
                        " dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                    }
                    placeholder={t("placeholder.patient-name")}
                />
                <SuccessIndicator 
                    show={
                        !!touchedFields.nombre && 
                        !errors.nombre && 
                        !!watchedValues.nombre
                    } 
                />
            </div>
            <ErrorMessage message={errors.nombre?.message} />
        </div>

        {/* Gender Field */}
        <div>
            <Label 
                htmlFor="sexo"
                className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1"
            >
                {t("patient-sex")}
                <span className="text-red-500">*</span>
            </Label>
            <Select
                value={watchedValues.sexo || ""}
                onValueChange={(value) => 
                    setValue("sexo", value as "M" | "F", {
                        shouldValidate: true,
                        shouldTouch: true,
                    })
                }
            >
                <SelectTrigger 
                    id="sexo"
                    className={
                        `mt-1 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${
                        errors.sexo
                            ? "border-red-300 dark:border-red-400"
                            : !!touchedFields.sexo && watchedValues.sexo
                            ? "border-green-300 dark:border-green-400"
                            : "border-gray-300 dark:border-gray-600"
                        }`
                    }
                >
                    <SelectValue placeholder={t("placeholder.patient-sex")} />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-900 dark:text-gray-100">
                    <SelectItem value="F">{t("sex-options.female")}</SelectItem>
                    <SelectItem value="M">{t("sex-options.male")}</SelectItem>
                </SelectContent>
            </Select>
            <ErrorMessage message={errors.sexo?.message} />
        </div>

        {/* Birth Date Field */}
        <div>
            <Label 
                htmlFor="fecha_de_nacimiento"
                className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1"
            >
                {t("patient-birthdate")}
                <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
                <Input
                    id="fecha_de_nacimiento"
                    type="date"
                    {...register("fecha_de_nacimiento")}
                    className={
                        getInputClassName("fecha_de_nacimiento", errors, touchedFields, watchedValues) +
                        " dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                    }
                    max={format(new Date(), "yyyy-MM-dd")}
                />
                <SuccessIndicator 
                    show={
                        !!touchedFields.fecha_de_nacimiento && 
                        !errors.fecha_de_nacimiento && 
                        !!watchedValues.fecha_de_nacimiento
                    }
                />
            </div>
            <ErrorMessage message={errors.fecha_de_nacimiento?.message} />
        </div>
    </>
  );
}
