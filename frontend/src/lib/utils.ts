import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * @remarks
 * Función para combinar clases utilizando `clsx` y `twMerge`.
 * 
 * @param {ClassValue[]} inputs - Lista de clases a combinar.
 * @returns {string} - Clases combinadas.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * @remarks
 * Función para hashear una contraseña utilizando SHA-256 y una sal aleatoria.
 * 
 * @param {string} password - La contraseña a hashear.
 * @returns {Promise<string>} - Una promesa que se resuelve con la contraseña hasheada.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(byte => byte.toString(16).padStart(2, '0')).join('');
  const combined = new Uint8Array([...encoder.encode(password), ...salt]);
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${saltHex}$${hashHex}`;
}

/**
 * @remarks
 * Función para verificar una contraseña comparando el hash almacenado con el hash de la contraseña proporcionada.
 * 
 * @param {string} password - La contraseña a verificar.
 * @param {string} hashedPassword - La contraseña hasheada almacenada.
 * @returns {Promise<boolean>} - Una promesa que se resuelve con un valor booleano indicando si la contraseña es válida.
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const [saltHex, storedHash] = hashedPassword.split('$');
  const encoder = new TextEncoder();
  const salt = new Uint8Array(saltHex!.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const combined = new Uint8Array([...encoder.encode(password), ...salt]);
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHash;
}
