import { chat, clearHistory } from "../bot/gemini.js";

// Detecta si Gemini quiere mandar el link de reserva
const BOOKING_REGEX = /\[BOOKING_READY\]\s*nombre:\s*(.+?)\s*\|\s*servicio:\s*(.+)/i;

// URL base de la mini web app de reserva
// En desarrollo: http://localhost:3001/booking.html
// En producción: reemplazar con la URL de Railway
const BOOKING_BASE_URL = process.env.BOOKING_URL || "http://localhost:3001/booking.html";

export function setupHandlers(bot) {
  // Comando /start
  bot.start(async (ctx) => {
    clearHistory(String(ctx.from.id));
    await ctx.reply(
      "👋 ¡Hola! Soy el asistente del consultorio del Od. Ignacio Rossetti.\n\n" +
      "Puedo ayudarte a sacar un turno, contarte sobre los servicios, precios y horarios. ¿En qué te puedo ayudar hoy?"
    );
  });

  // Comando /reset (reinicia la conversación)
  bot.command("reset", async (ctx) => {
    clearHistory(String(ctx.from.id));
    await ctx.reply("Conversación reiniciada. ¿En qué te puedo ayudar?");
  });

  // Mensajes de texto
  bot.on("text", async (ctx) => {
    const userId = String(ctx.from.id);
    const userMessage = ctx.message.text;

    // Mostrar "escribiendo..."
    await ctx.sendChatAction("typing");

    try {
      const response = await chat(userId, userMessage);

      // Verificar si Gemini indica que hay que mandar el link de reserva
      const bookingMatch = response.match(BOOKING_REGEX);

      if (bookingMatch) {
        const nombre = bookingMatch[1].trim();
        const servicio = bookingMatch[2].trim();

        // Construir el link con los datos del paciente
        const clinicSlug = process.env.CLINIC_SLUG || "rossetti";
        const params = new URLSearchParams({ slug: clinicSlug, nombre, servicio, uid: userId });
        const bookingUrl = `${BOOKING_BASE_URL}?${params.toString()}`;

        await ctx.reply(
          `Perfecto, ${nombre}! Te envío el link para que elijas la fecha y horario que mejor te quede:\n\n` +
          `📅 ${bookingUrl}\n\n` +
          `Una vez que confirmes el turno, te voy a avisar por acá.`
        );
      } else {
        await ctx.reply(response);
      }
    } catch (error) {
      console.error("Error al procesar mensaje:", error);
      await ctx.reply(
        "Tuve un problema para procesar tu mensaje. Por favor intentá de nuevo o contactanos directamente al 3571-599970."
      );
    }
  });

  // Cualquier otro tipo de mensaje (fotos, stickers, etc.)
  bot.on("message", async (ctx) => {
    await ctx.reply(
      "Por ahora solo puedo leer mensajes de texto. ¿En qué te puedo ayudar?"
    );
  });
}
