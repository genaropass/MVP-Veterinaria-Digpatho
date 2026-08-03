import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

/**
 * @remarks
 * Función para crear una instancia singleton de PrismaClient con la extensión Accelerate.
 * 
 * @returns {PrismaClient} - Instancia de PrismaClient.
 */
const prismaClientSingleton = () => new PrismaClient().$extends(withAccelerate());

/**
 * @remarks
 * Declaración global para almacenar la instancia de PrismaClient.
 * 
 * @type {Object}
 * @property {ReturnType<typeof prismaClientSingleton>?} prismaGlobal - Instancia global de PrismaClient.
 */
declare const globalThis: {
    prismaGlobal?: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

/**
 * @remarks
 * Inicializa la instancia de PrismaClient utilizando la instancia global si está disponible.
 * 
 * @type {PrismaClient} - Instancia de PrismaClient.
 */
const db = globalThis.prismaGlobal ?? prismaClientSingleton();

/**
 * @remarks
 * Si el entorno no es de producción, almacena la instancia de PrismaClient en la variable global.
 */
if (process.env.NODE_ENV !== "production") {
    globalThis.prismaGlobal = db;
}

export default db;
