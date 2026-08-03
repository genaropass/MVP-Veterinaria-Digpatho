"use server";
import { executeAction } from "./executeAction";
import { schema } from "./schema";
import { ZodError } from "zod";
import { registerUser } from "@/services/usersService";

/**
 * Action to register a new user
 * @param {Object} state - Current registration state
 * @param {unknown} formData - Registration form data
 * @returns {Promise<Object>} - Registration action result
 */
export const signUpAction = async (
  state: { success: boolean; message: string; email?: string; accountExists?: boolean },
  formData: unknown,
): Promise<{ success: boolean; message: string; email?: string; accountExists?: boolean }> => {
  // Check if formData is a FormData instance
  if (!(formData instanceof FormData)) {
    return {
      ...state,
      success: false,
      message: "Invalid form data",
    };
  }

  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    // Validate form data with schema
    const validatedData = schema.parse({ name, email, password });

    return executeAction({
      actionFn: async () => {
        try {
          const result = await registerUser(
            validatedData.name,
            validatedData.email,
            validatedData.password
          );
          return {
            ...state,
            ...result,
          };
        } catch (error: any) {
          return {
            ...state,
            success: false,
            message: error.message || "Error creating user",
          };
        }
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ...state,
        success: false,
        message: err.errors[0]?.message ?? "Validation error",
      };
    }

    return {
      ...state,
      success: false,
      message: "An error occurred while creating the user",
    };
  }  
};

