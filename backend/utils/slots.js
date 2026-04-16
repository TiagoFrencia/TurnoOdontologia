// Horarios por defecto — se usan cuando la clínica no tiene horarios configurados
const DEFAULT_SCHEDULE = {
  1: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
  2: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
  3: [{ start: "09:00", end: "13:00" }],
  4: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
  5: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
};

export const DEFAULT_SLOT_DURATION = 45;

// Convierte el jsonb de clinic.horarios (claves string) al formato interno (claves numéricas)
function parseHorarios(horarios) {
  if (!horarios || typeof horarios !== "object") return DEFAULT_SCHEDULE;
  const result = {};
  for (const [k, v] of Object.entries(horarios)) {
    const day = parseInt(k);
    if (!isNaN(day) && Array.isArray(v) && v.length > 0) result[day] = v;
  }
  return Object.keys(result).length > 0 ? result : DEFAULT_SCHEDULE;
}

function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Devuelve todos los slots posibles para un día de semana dado
export function getAllSlotsForWeekday(dayOfWeek, horarios = null, slotDuration = null) {
  const schedule = parseHorarios(horarios);
  const duration = slotDuration || DEFAULT_SLOT_DURATION;
  const ranges = schedule[dayOfWeek];
  if (!ranges) return [];

  const slots = [];
  for (const range of ranges) {
    let current = timeToMinutes(range.start);
    const end = timeToMinutes(range.end);
    while (current < end) {
      slots.push(minutesToTime(current));
      current += duration;
    }
  }
  return slots;
}

// Dado un conjunto de turnos ya reservados, devuelve los slots libres
export function getAvailableSlots(dayOfWeek, bookedTimes, horarios = null, slotDuration = null) {
  const all = getAllSlotsForWeekday(dayOfWeek, horarios, slotDuration);
  const booked = new Set(bookedTimes.map((t) => t.slice(0, 5)));
  return all.filter((slot) => !booked.has(slot));
}

// Dice si el consultorio atiende ese día de semana
export function isWorkday(dayOfWeek, horarios = null) {
  const schedule = parseHorarios(horarios);
  return dayOfWeek in schedule;
}

// Devuelve el día de semana en Buenos Aires para una fecha dada (string YYYY-MM-DD)
export function getDayOfWeek(dateStr) {
  // Parsear como fecha local para evitar corrimiento de zona horaria
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}
