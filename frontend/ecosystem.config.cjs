/**
 * PM2 ecosystem file. Uso: desde la raíz del proyecto (DigpathoWeb), ejecutar:
 *   pm2 start ecosystem.config.cjs
 *
 * "cwd" usa __dirname para que el proceso Next corra siempre desde la carpeta del proyecto
 * (donde está .next/). Si no, Next devuelve 404 para /_next/static/chunks/ aunque los archivos existan.
 */
const path = require("path");
module.exports = {
  apps: [
    {
      name: "digpatho-web",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: path.resolve(__dirname),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: { NODE_ENV: "production" },
    },
  ],
};
