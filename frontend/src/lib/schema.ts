import { z } from "zod";

/**
 * @remarks
 * Validation schema for registration
 * - email: User email
 * - password: User password (minimum 1 character)
 */
const schema = z.object({
    name: z.string(),
    email: z.string().email({ message: "Invalid email" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

/** 
 * @typedef {z.infer<typeof schema>} Schema - Type inferred from validation schema
 */
type Schema = z.infer<typeof schema>

export { schema, type Schema }

/**
 * @remarks
 * Validation schema for sign in
 * - email: User email with custom error message
 * - password: User password (min 6 characters) with custom error message
 */
export const signInSchema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

/** 
 * @typedef {z.infer<typeof signInSchema>} SignInFormData - Type inferred from sign-in validation schema
 */
export type SignInFormData = z.infer<typeof signInSchema>;
