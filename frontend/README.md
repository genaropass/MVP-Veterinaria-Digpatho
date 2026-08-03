This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Despliegue en GCP (front y back en la misma instancia)

- **Qué env usa el front:** En local: `.env` o `.env.local` (raíz del repo). En producción (servidor): `.env.production` o `.env.local` en la carpeta del proyecto. Next.js los carga solo; no hace falta “activar” nada.
- **Acceder al .env del front por SSH:** Conectarse a la VM de GCP y editar el archivo en la carpeta del front:
  ```bash
  ssh <USUARIO_SSH>@<IP_O_HOST_GCP>
  cd /opt/digpatho/DigpathoWeb
  nano .env.production
  # (o: nano .env.local)
  ```
  Tras guardar cambios en variables `NEXT_PUBLIC_*` hay que hacer **rebuild** para que se embeben: `npm run build` y luego `pm2 restart digpatho-web`. Los secrets del repo (`USER_SSH`, `HOST_FRONTEND`) son el usuario e IP/host para ese `ssh`. **Base de datos:** Prisma en este proyecto usa `POSTGRES_URL` y `DIRECT_URL` (schema.prisma); no usa `DATABASE_URL`. No hace falta poner `DATABASE_URL` en el env del front.

- **URL del backend (API):** El front debe llamar al backend por su dominio de API, no por el del app. El workflow de deploy (`deploy-frontend.yml`) define en el **build** `NEXT_PUBLIC_API_URL=https://api.digpatho.com/` y `NEXT_PUBLIC_APP_URL=https://app.digpatho.com` para que el bundle de producción apunte a prod. En el **servidor**, `.env.production` se restaura desde backup en cada deploy; ese archivo debe tener `NEXT_PUBLIC_API_URL=https://api.digpatho.com/` para que las Server Actions (registro, login, admin) usen la API de producción en runtime. Si la primera vez tenías api-preprod, editá una vez `.env.production` en el servidor con la URL de prod; en los siguientes deploys el backup ya tendrá ese valor. Verificar con `curl -s https://app.digpatho.com/api/debug/config`.
  Si `NEXT_PUBLIC_API_URL` apunta a `app.digpatho.com`, las llamadas (informe, upload, users, etc.) irán al front y fallarán.


- **Puerto 3000 en uso (EADDRINUSE) / PM2 en "errored":** Si al hacer `pm2 delete` y matar el PID del 3000 **sigue apareciendo otro proceso** al instante, es que solo estás matando el proceso **hijo** (next-server); el proceso **padre** (Node) sigue vivo y vuelve a crear un hijo. Hay que matar el **padre** (o todo el árbol). Pasos:
  1. **Parar en PM2:** `pm2 delete digpatho-web`
  2. **Ver el PID que usa el 3000:** `sudo ss -tulpn | grep 3000` → anotar el PID (ej. 23709).
  3. **Obtener el PID del padre:** `ps -o ppid= -p <PID_del_paso_2>` (ej. `ps -o ppid= -p 23709`). Sale un número: ese es el padre.
  4. **Matar el padre:** `sudo kill -9 <PID_del_padre>`
  5. **Matar también el hijo** (el PID del paso 2): `sudo kill -9 <PID_del_hijo>`. Al estar el padre muerto, no se creará otro.
  6. **Comprobar que el 3000 quedó libre:** `sudo ss -tulpn | grep 3000` → no debe devolver nada.
  7. **Arrancar de nuevo:** `cd /opt/digpatho/DigpathoWeb && pm2 start ecosystem.config.cjs` y `pm2 save`.
  **Si tras matar padre e hijo sigue apareciendo un proceso nuevo**, puede ser que la app esté corriendo con **PM2 de root** (otro daemon: `/root/.pm2`). Comprobar: `ps aux | grep pm2` y si ves `PM2 ... God Daemon (/root/.pm2)`, listar y borrar con **root**: `sudo pm2 list`, `sudo pm2 delete digpatho-web` (o el nombre que salga). Así deja de reiniciarse. Luego arrancar solo con tu usuario: `cd /opt/digpatho/DigpathoWeb && pm2 start ecosystem.config.cjs` y `pm2 save`.

- **404 en `/_next/static/chunks/...` con el archivo existiendo en disco:** Next sirve los chunks relativos al **directorio de trabajo (cwd)** del proceso. Si PM2 arrancó desde otro directorio, no encuentra `.next/static/`. Solución: usar `ecosystem.config.cjs` (define `cwd: "/opt/digpatho/DigpathoWeb"`) y arrancar con `pm2 start ecosystem.config.cjs` desde el servidor; o asegurarse de hacer siempre `cd /opt/digpatho/DigpathoWeb` antes de `pm2 start npm ...`. Luego `pm2 delete digpatho-web`, `cd /opt/digpatho/DigpathoWeb`, `pm2 start ecosystem.config.cjs`, `pm2 save`.

- **"ChunkLoadError" / 400 en `/_next/static/chunks/...`:** El navegador pide los JS de Next y recibe **400 Bad Request**.
  - **Nginx** (config correcta): en `sites-enabled/app.digpatho.com` debe estar `proxy_set_header Host $host;` y `X-Forwarded-Proto $scheme;`. Con eso Next recibe el host correcto.
  - Si incluso con `curl -I -H "Host: app.digpatho.com" "http://127.0.0.1:3000/_next/static/chunks/app/layout-XXX.js"` sigue **400**, el rechazo es interno de Next (no del proxy).
  - **Comprobar que el chunk existe:** el hash del nombre cambia en cada build. En el servidor: `ls /opt/digpatho/DigpathoWeb/.next/static/chunks/app/layout-*.js` y probar con ese nombre exacto. Si el archivo no existe (hash antiguo), puede haber 400 en vez de 404; en ese caso: limpiar caché del navegador/Cloudflare, hacer `rm -rf .next && npm run build` y reiniciar.
  - En el proyecto está `experimental.serverActions.allowedOrigins` en `next.config.ts`. Tras cambiar config: `npm run build` y `pm2 restart digpatho-web`.

- **Rutas de diagnóstico (registro/login):** Están en **Pages Router** (`pages/api/debug/`) porque en este proyecto las rutas API del App Router (`app/api/debug/*`) devuelven 404 HTML (posible interacción con next-intl u otra tubería del App Router).
  - **Ping:** `curl -s "http://127.0.0.1:3000/api/debug/ping"` → debe devolver `{"ok":true}`.
  - **DB (conexión a la base de datos):** `curl -s "https://app.digpatho.com/api/debug/db-ping"` → si la conexión (POSTGRES_URL/DIRECT_URL) funciona, devuelve `{"ok":true,"db":"ok"}`. Si falla, 500 con `{"db":"error","error":"..."}`. Así sabés si el front llega a la DB.
  - **Config (qué API usa el servidor):** `curl -s "https://app.digpatho.com/api/debug/config"` → devuelve `{"apiHost":"https://api.digpatho.com/"}`. Si sale `api-preprod.digpatho.com`, el servidor está usando preprod; corregir `NEXT_PUBLIC_API_URL` en `.env.production` en el servidor y reiniciar (`pm2 restart digpatho-web`). No hace falta rebuild para que el servidor use el nuevo valor (las rutas API leen `process.env` en runtime).
  - **Registro:** `curl -s -X POST "http://127.0.0.1:3000/api/debug/register" -H "Content-Type: application/json" -d '{"name":"Test","email":"test@ejemplo.com","password":"123456"}'`
  - **Login:** `curl -s -X POST "http://127.0.0.1:3000/api/debug/login" -H "Content-Type: application/json" -d '{"email":"test@ejemplo.com","password":"123456"}'`
  - Tras desplegar: `npm run build`, `pm2 restart digpatho-web`. Si siguen devolviendo 404, comprobar que existan `src/pages/api/debug/ping.ts`, `config.ts`, `register.ts`, `login.ts`.

- **Login devuelve 405 Method Not Allowed:** El front llama a `POST {NEXT_PUBLIC_API_URL}/users_login/` con body `{ "mail", "email", "password" }` y espera `{ "access_token": "...", "token_type": "bearer" }`. Si el backend (api.digpatho.com) responde **405**, ese endpoint no acepta POST o la ruta es otra. Hay que revisar en el **backend** la URL y método correctos del login (p. ej. que exista `POST /users_login/` y devuelva `access_token`). Si el backend usa otra ruta (ej. `POST /auth/token`), habría que cambiar `usersService.ts` (`loginUser`) y las rutas de debug para usar esa URL.

- **Sign-up / Network y respuestas del backend:** El registro se hace desde una **Server Action** (`signUpAction` → `registerUser` en `usersService.ts`). La llamada a **api.digpatho.com** la hace el **servidor** de Next.js, no el navegador. En DevTools → Network solo verás peticiones a **app.digpatho.com** (POST del formulario a la Server Action); no aparece una petición directa a api.digpatho.com. Para ver la llamada al backend hay que revisar logs del servidor o usar las rutas de debug (`/api/debug/register`). El front ya trata como éxito **200** y **403**: en `usersService.ts` primero se comprueba `response.ok` (200–299) y luego `response.status === 403`; en ambos casos se devuelve `success: true` y se redirige. Si el backend pasa de 403 a 200 con `{"message": "Usuario creado con exito"}`, no hace falta cambiar el front. El body se envía como `application/json` con `{ nombre, mail, password }`.

