import NextAuth from "next-auth";
import Github from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

import { signInSchema } from "./schema";
import { APP_URL } from "@/utils/constants";
import {
  loginUser,
  userExists,
} from "@/services/usersService";

export const {
  auth,
  handlers: { GET, POST },
  signOut,
  signIn,
} = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 48 * 60 * 60,
    updateAge: 60 * 60,
  },
  providers: [
    Github({
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
        if (!credentials) {
          console.log("[AUTH] ERROR: credentials vacías");
          return null;
        }

        const raw = credentials as Record<string, unknown>;
        const emailRaw = raw.email ?? raw.mail;
        const passwordRaw = raw.password;
        const email =
          typeof emailRaw === "string" ? emailRaw.trim() : String(emailRaw ?? "");
        const password =
          typeof passwordRaw === "string"
            ? passwordRaw
            : String(passwordRaw ?? "");

        const validated = signInSchema.safeParse({ email, password });
        if (!validated.success) {
          console.log(
            "[AUTH] ERROR: validación sign-in:",
            validated.error.flatten()
          );
          return null;
        }

        const { email: validEmail, password: validPassword } = validated.data;

        console.log("[AUTH] 1. Iniciando login para:", validEmail);

        if (!validEmail || !validPassword) {
          console.log("[AUTH] ERROR: email o password vacíos tras validar");
          return null;
        }

        if (!process.env.API_TOKEN && !process.env.NEXT_PUBLIC_API_TOKEN) {
          console.warn(
            "[AUTH] AVISO: API_TOKEN vacío en servidor; el backend puede rechazar /users_login/"
          );
        }

        console.log("[AUTH] 2. Llamando a loginUser...");
        const loginData = await loginUser(validEmail, validPassword);

        console.log(
          "[AUTH] 3. Respuesta de loginUser:",
          JSON.stringify(loginData)
        );

        const accessToken = loginData?.access_token;
        console.log("[AUTH] 4. Access token existe?", !!accessToken);

        if (!accessToken) {
          console.log("[AUTH] ERROR: No hay access_token en la respuesta");
          return null;
        }

        console.log("[AUTH] 5. Decodificando JWT...");
        const parts = accessToken.split(".");
        console.log("[AUTH] 6. Partes del JWT:", parts.length);

        if (parts.length !== 3) {
          console.log("[AUTH] ERROR: JWT no tiene 3 partes");
          return null;
        }

        const payloadStr = Buffer.from(parts[1], "base64").toString("utf-8");
        const payload = JSON.parse(payloadStr);
        const userId = payload.sub;

        console.log("[AUTH] 7. User ID extracted:", userId);

        const userObj: any = {
          id: userId,
          email: validEmail,
          name: validEmail,
          _accessToken: accessToken,
        };

        console.log("[AUTH] 8. Retornando userObj:", JSON.stringify(userObj));
        return userObj;
        } catch (error) {
          console.log("[AUTH] ERROR en authorize:", error);
          return null;
        }
      },
    }),
  ],
  // Compat: algunos servidores siguen con NEXTAUTH_SECRET (v4) en .env
  secret: (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET) as string,
  pages: {
    signIn: "/auth/sign-in",
    signOut: "/auth/sign-in",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Si el login es por credenciales y llegó hasta aquí, es que authorize pasó.
      // Permitimos el paso directamente.
      if (account?.provider === "credentials") {
        return true; 
      }

      // Para Google/Github mantenemos la lógica de persistencia del token
      if (account && (account.provider === "github" || account.provider === "google")) {
        (user as any)._accessToken = account.access_token || "oauth_" + account.provider;
        
        try {
          const exists = await userExists(user.email || "");
          return exists;
        } catch {
          // Si falla el servidor en un login social, redirigir a signup
          throw new Error("REDIRECT_SIGNUP");
        }
      }
      
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.user = user;
        const accessToken = (user as any)._accessToken;
        if (accessToken) {
          token.accessToken = accessToken;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.user) {
        session.user = token.user as any;
      }
      (session as any).accessToken = token.accessToken;
      return session;
    },
  },
  jwt: {
    maxAge: 48 * 60 * 60,
  },
});
