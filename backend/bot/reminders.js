import cron from "node-cron";
import { getAppointmentsForReminder, markReminderSent, getClinicInfo } from "../db/supabase.js";

// Corre todos los días a las 09:00 hora Argentina (UTC-3 = 12:00 UTC)
// Cron: minuto hora día mes díaSemana
const CRON_SCHEDULE = "0 12 * * *";

function getTomorrowDateStr() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

function fmtFecha(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const fecha = new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
  });
  return `${fecha.charAt(0).toUpperCase() + fecha.slice(1)} a las ${timeStr.slice(0, 5)} hs`;
}

async function sendReminders(bot) {
  const tomorrow = getTomorrowDateStr();
  console.log(`🔔 Verificando recordatorios para el ${tomorrow}...`);

  try {
    const clinicId = process.env.CLINIC_ID;
    const appointments = await getAppointmentsForReminder(clinicId, tomorrow);
    if (!appointments.length) {
      console.log("   Sin recordatorios pendientes.");
      return;
    }

    const clinic = await getClinicInfo(clinicId);

    for (const appt of appointments) {
      try {
        const cuando = fmtFecha(appt.date, appt.time);
        await bot.telegram.sendMessage(
          appt.telegram_user_id,
          `⏰ Recordatorio de turno\n\n` +
          `Hola ${appt.patient_name}! Te recordamos que mañana tenés turno:\n\n` +
          `🦷 Servicio: ${appt.service_name}\n` +
          `📅 Cuándo: ${cuando}\n` +
          `📍 Dónde: ${clinic.ubicacion}\n\n` +
          `Si necesitás cancelar o reprogramar, escribinos al ${clinic.telefono}.`
        );
        await markReminderSent(appt.id);
        console.log(`   ✅ Recordatorio enviado a ${appt.patient_name} (${appt.telegram_user_id})`);
      } catch (err) {
        console.error(`   ❌ Error enviando a ${appt.patient_name}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Error en el proceso de recordatorios:", err.message);
  }
}

export function startReminderCron(bot) {
  cron.schedule(CRON_SCHEDULE, () => sendReminders(bot), {
    timezone: "America/Argentina/Buenos_Aires",
  });
  console.log("⏰ Cron de recordatorios activo (9:00 hs todos los días)");
}

// Función para testear manualmente sin esperar el cron
export async function triggerRemindersNow(bot) {
  await sendReminders(bot);
}
