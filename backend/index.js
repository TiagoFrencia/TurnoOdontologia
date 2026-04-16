import "dotenv/config";
import { Telegraf } from "telegraf";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { setupHandlers } from "./telegram/handlers.js";
import { createRouter } from "./api/routes.js";
import { startReminderCron } from "./bot/reminders.js";

// Validar variables de entorno requeridas
const required = ["TELEGRAM_BOT_TOKEN", "GOOGLE_AI_API_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY", "CLINIC_ID"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Falta la variable de entorno: ${key}`);
    process.exit(1);
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Bot de Telegram ─────────────────────────
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
setupHandlers(bot);
bot.catch((err, ctx) => console.error(`Error en update ${ctx.updateType}:`, err));
bot.launch({ dropPendingUpdates: true }).catch(err => {
  console.warn("⚠️  Bot no pudo arrancar (¿otra instancia corriendo?):", err.message);
});
startReminderCron(bot);
console.log("🤖 Bot de Telegram arrancado en modo polling...");

// ─── Servidor HTTP (API + booking page) ──────
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Servir la mini web app de reservas como archivos estáticos
app.use(express.static(join(__dirname, "public")));

// Rutas de la API — pasamos el bot para poder mandar notificaciones
app.use("/api", createRouter(bot));

app.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP corriendo en http://localhost:${PORT}`);
  console.log(`📅 Booking page: http://localhost:${PORT}/booking.html`);
});

// Apagado limpio
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
