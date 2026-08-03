import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FieldErrors, UseFormStateReturn, FieldValues } from "react-hook-form";

export const ErrorMessage = ({ message }: { message?: string }) =>
  message ? (
    <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
      <AlertCircle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  ) : null;

export const SuccessIndicator = ({ show }: { show: boolean }) =>
  show ? (
    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
      <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
    </div>
  ) : null;

  export function getInputClassName<T extends FieldValues>(
  fieldName: keyof T,
  errors: FieldErrors<T>,
  touchedFields: Partial<UseFormStateReturn<T>["touchedFields"]>,
  watchedValues: Partial<T>
) {
  const baseClass = "mt-1 bg-white transition-all duration-200 relative";
  const hasError = errors[fieldName];
  const isTouched = !!touchedFields[fieldName as keyof typeof touchedFields];
  const hasValue = watchedValues[fieldName];

  if (hasError) {
    return `${baseClass} border-red-300 focus:border-red-500 focus:ring-red-200`;
  }
  if (isTouched && hasValue && !hasError) {
    return `${baseClass} border-green-300 focus:border-green-500 focus:ring-green-200`;
  }
  return `${baseClass} border-gray-300 focus:border-blue-500 focus:ring-blue-200`;
}
