import { isRedirectError } from "next/dist/client/components/redirect-error";

// Tipo de opciones para la función executeAction
type Options<T> = {
    actionFn: () => Promise<T>;
    successMessage?: string;
};

/**
 * Ejecuta una acción y maneja errores
 * @param {Object} options - Opciones para la ejecución de la acción
 * @returns {Promise<Object>} - Resultado de la ejecución de la acción
 */
const executeAction = async <T extends { success: boolean; message: string }>(
  { actionFn }: Options<T>
): Promise<T> => {
    try {
        // Ejecuta la función de la acción
        const result = await actionFn();
        return result;
    } catch (error) {
        // Maneja el error si es un error de redirección
        if (isRedirectError(error)) {
            throw error;
        }

        let errorMessage = "An error occurred while executing the action";
        if (error instanceof Error) {
            errorMessage = error.message || errorMessage;
        }

        return {
            success: false,
            message: errorMessage,
        } as T;
    }
};

export { executeAction };
