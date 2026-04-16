// ─────────────────────────────────────────────
//  HORARIOS DEL CONSULTORIO
//  Reemplazar con datos reales de Ignacio
// ─────────────────────────────────────────────

// Día de semana → franjas horarias (0=Dom, 1=Lun, ..., 6=Sáb)
const SCHEDULE = {
  1: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }], // Lunes
  2: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }], // Martes
  3: [{ start: "09:00", end: "13:00" }],                                    // Miércoles
  4: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }], // Jueves
  5: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }], // Viernes
  // Sábado y Domingo: cerrado (no están en el objeto)
};

export const SLOT_DURATION = 45; // minutos

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
export function getAllSlotsForWeekday(dayOfWeek) {
  const ranges = SCHEDULE[dayOfWeek];
  if (!ranges) return [];

  const slots = [];
  for (const range of ranges) {
    let current = timeToMinutes(range.start);
    const end = timeToMinutes(range.end);
    while (current < end) {
      slots.push(minutesToTime(current));
      current += SLOT_DURATION;
    }
  }
  return slots;
}

// Dado un conjunto de turnos ya reservados, devuelve los slots libres
export function getAvailableSlots(dayOfWeek, bookedTimes) {
  const all = getAllSlotsForWeekday(dayOfWeek);
  const booked = new Set(bookedTimes.map((t) => t.slice(0, 5))); // normalizar HH:MM
  return all.filter((slot) => !booked.has(slot));
}

// Dice si el consultorio atiende ese día de semana
export function isWorkday(dayOfWeek) {
  return dayOfWeek in SCHEDULE;
}

// Devuelve el día de semana en Buenos Aires para una fecha dada (string YYYY-MM-DD)
export function getDayOfWeek(dateStr) {
  // Parsear como fecha local para evitar corrimiento de zona horaria
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}
