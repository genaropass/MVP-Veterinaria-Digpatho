import { auth } from "@/lib/auth";
import { cache } from "react"

/**
 * Recupera una sesión en caché utilizando la función de caché proporcionada.
 * 
 * @remarks
 * Esta función utiliza un mecanismo de caché asíncrono para almacenar y recuperar
 * los datos de la sesión. Se llama a la función `auth` para obtener la sesión,
 * que luego se almacena en caché para su uso futuro.
 * 
 * @returns {Promise<any>} Una promesa que se resuelve con los datos de la sesión.
 */
export const getCachedSession = cache(async () => {
    const session = await auth()
    return session
})
