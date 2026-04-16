import { getServices, getClinicInfo } from "../db/supabase.js";

// ─────────────────────────────────────────────
//  CACHE (5 minutos para servicios y clinic info)
// ─────────────────────────────────────────────
let _servicesCache  = null;
let _servicesCacheTs = 0;
let _clinicCache    = null;
let _clinicCacheTs  = 0;
const TTL = 5 * 60 * 1000;

const CLINIC_ID = process.env.CLINIC_ID;

async function getCachedServices() {
  if (!_servicesCache || Date.now() - _servicesCacheTs > TTL) {
    try {
      _servicesCache  = await getServices(CLINIC_ID);
      _servicesCacheTs = Date.now();
    } catch (e) {
      console.error("Error cargando servicios para el bot:", e.message);
      if (!_servicesCache) _servicesCache = [];
    }
  }
  return _servicesCache;
}

async function getCachedClinicInfo() {
  if (!_clinicCache || Date.now() - _clinicCacheTs > TTL) {
    try {
      _clinicCache    = await getClinicInfo(CLINIC_ID);
      _clinicCacheTs  = Date.now();
    } catch (e) {
      console.error("Error cargando info del consultorio para el bot:", e.message);
    }
  }
  return _clinicCache;
}

// Invalida ambos caches (llamado desde routes.js cuando el dashboard guarda cambios)
export function invalidateServicesCache() { _servicesCacheTs = 0; }
export function invalidateClinicCache()   { _clinicCacheTs   = 0; }

// ─────────────────────────────────────────────
//  SYSTEM PROMPT (async)
// ─────────────────────────────────────────────
export async function buildSystemPrompt() {
  const [services, clinic] = await Promise.all([
    getCachedServices(),
    getCachedClinicInfo(),
  ]);

  // Fallback si Supabase no responde
  const c = clinic || {
    name:          "Od. Ignacio Rossetti",
    matricula:     "M.P. 12572",
    telefono:      "3571-599970",
    instagram:     "@od.ignaciorossetti",
    ubicacion:     "Río Tercero, Córdoba, Argentina",
    horarios:      "Lunes a Viernes: 9:00 a 13:00 hs. Consultar horarios de tarde.",
    obras_sociales:"PAMI, APROSS, OSPE",
    medios_pago:   "Efectivo, Transferencia, Tarjeta",
  };

  const serviciosTexto = services.length
    ? services.map(s => `    - ${s.name}: ${s.price} (duración aprox.: ${s.duration} min)`).join("\n")
    : "    - (Sin servicios cargados — consultá directamente al odontólogo)";

  return `Sos el asistente virtual del consultorio odontológico de ${c.name}, matrícula ${c.matricula}, ubicado en ${c.ubicacion}.

Tu rol es ayudar a los pacientes a:
1. Obtener información sobre servicios, precios, horarios y ubicación del consultorio
2. Sacar un turno (cuando el paciente quiera reservar, le enviás el link de reserva)
3. Resolver dudas frecuentes sobre los tratamientos

INFORMACIÓN DEL CONSULTORIO:

Horarios de atención:
${c.horarios}

Servicios y precios:
${serviciosTexto}

Obras sociales aceptadas: ${c.obras_sociales}
Medios de pago: ${c.medios_pago}
Teléfono / WhatsApp: ${c.telefono}
Instagram: ${c.instagram}

CÓMO MANEJAR TURNOS:
Cuando el paciente quiera sacar un turno, preguntale:
1. Su nombre completo
2. El tratamiento que necesita

Luego indicale que le vas a enviar el link para elegir fecha y horario disponible.
Cuando tengas el nombre y el tratamiento, respondé EXACTAMENTE con este formato (sin nada más):
[BOOKING_READY] nombre: <nombre> | servicio: <servicio>

REGLAS:
- Respondé siempre en español, de forma amable y concisa
- Si no sabés algo, decí que va a ser mejor consultarlo directamente con el odontólogo por WhatsApp al ${c.telefono}
- No inventes información que no está en este prompt
- No uses markdown con asteriscos ni símbolos raros, escribí en texto plano natural
- Saludá con calidez en el primer mensaje
- Mantené un tono profesional pero cercano, como lo haría la recepción de un consultorio amigable
`;
}
