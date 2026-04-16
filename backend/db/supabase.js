import { createClient } from "@supabase/supabase-js";

// ── Anon client: solo para verificar JWTs de auth (auth.getUser) ──
export const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ── Service role client: operaciones de DB del backend (bypasa RLS) ──
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY // fallback en dev
);

export default db;

// ═══════════════════════════════════════════════════════════════
//  CONSULTORIOS (clinics)
// ═══════════════════════════════════════════════════════════════

export async function getClinicBySlug(slug) {
  const { data, error } = await db
    .from("clinics")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data;
}

export async function getClinicById(clinicId) {
  const { data, error } = await db
    .from("clinics")
    .select("*")
    .eq("id", clinicId)
    .single();
  if (error) throw error;
  return data;
}

export async function getClinicByOwner(userId) {
  const { data, error } = await db
    .from("clinics")
    .select("*")
    .eq("owner_user_id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function createClinic(fields) {
  const { data, error } = await db
    .from("clinics")
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClinic(clinicId, fields) {
  const { data, error } = await db
    .from("clinics")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", clinicId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function isSlugAvailable(slug) {
  const { data } = await db.from("clinics").select("id").eq("slug", slug).maybeSingle();
  return !data;
}

// ═══════════════════════════════════════════════════════════════
//  CANALES (clinic_channels)
// ═══════════════════════════════════════════════════════════════

export async function getClinicChannels(clinicId) {
  const { data, error } = await db
    .from("clinic_channels")
    .select("*")
    .eq("clinic_id", clinicId);
  if (error) throw error;
  return data;
}

export async function upsertClinicChannel(clinicId, kind, status, credentials = {}) {
  const { data, error } = await db
    .from("clinic_channels")
    .upsert(
      { clinic_id: clinicId, kind, status, credentials, last_seen_at: new Date().toISOString() },
      { onConflict: "clinic_id,kind" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getConnectedClinics() {
  const { data, error } = await db
    .from("clinic_channels")
    .select("*, clinics(*)")
    .eq("status", "connected");
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════
//  PACIENTES
// ═══════════════════════════════════════════════════════════════

export async function getOrCreatePatient(clinicId, channelKind, channelUserId, displayName = "") {
  // Intentar obtener primero
  const { data: existing } = await db
    .from("patients")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("channel_kind", channelKind)
    .eq("channel_user_id", String(channelUserId))
    .maybeSingle();

  if (existing) return existing;

  // Crear si no existe
  const { data, error } = await db
    .from("patients")
    .insert({
      clinic_id: clinicId,
      channel_kind: channelKind,
      channel_user_id: String(channelUserId),
      display_name: displayName,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════
//  INFO DEL CONSULTORIO (compatibilidad con rutas del dashboard)
// ═══════════════════════════════════════════════════════════════

export async function getClinicInfo(clinicId) {
  return getClinicById(clinicId);
}

export async function updateClinicInfo(clinicId, fields) {
  const allowed = ["nombre", "matricula", "telefono", "instagram", "ubicacion", "horarios", "obras_sociales", "medios_pago"];
  // Mapear nombres legacy → nuevo schema de clinics
  const mapped = {};
  const fieldMap = { nombre: "name" };
  for (const [k, v] of Object.entries(fields)) {
    if (!allowed.includes(k)) continue;
    mapped[fieldMap[k] || k] = v;
  }
  return updateClinic(clinicId, mapped);
}

// ═══════════════════════════════════════════════════════════════
//  SERVICIOS
// ═══════════════════════════════════════════════════════════════

export async function getServices(clinicId) {
  const { data, error } = await db
    .from("services")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("id");
  if (error) throw error;
  return data;
}

export async function createService(clinicId, { name, price, duration }) {
  const { data, error } = await db
    .from("services")
    .insert({ clinic_id: clinicId, name, price, duration, active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateService(clinicId, id, fields) {
  const { data, error } = await db
    .from("services")
    .update(fields)
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteService(clinicId, id) {
  const { error } = await db
    .from("services")
    .update({ active: false })
    .eq("id", id)
    .eq("clinic_id", clinicId);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
//  DÍAS BLOQUEADOS
// ═══════════════════════════════════════════════════════════════

export async function getBlockedDays(clinicId) {
  const { data, error } = await db
    .from("blocked_days")
    .select("date")
    .eq("clinic_id", clinicId)
    .gte("date", new Date().toISOString().split("T")[0]);
  if (error) throw error;
  return data.map((r) => r.date);
}

export async function blockDay(clinicId, date, reason = "") {
  const { error } = await db
    .from("blocked_days")
    .insert({ clinic_id: clinicId, date, reason });
  if (error) throw error;
}

export async function unblockDay(clinicId, date) {
  const { error } = await db
    .from("blocked_days")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("date", date);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
//  TURNOS
// ═══════════════════════════════════════════════════════════════

export async function getAppointmentsByDate(clinicId, date) {
  const { data, error } = await db
    .from("appointments")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("date", date)
    .neq("status", "cancelled")
    .order("time");
  if (error) throw error;
  return data;
}

export async function getUpcomingAppointments(clinicId, limit = 50) {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await db
    .from("appointments")
    .select("*, services(name, duration)")
    .eq("clinic_id", clinicId)
    .gte("date", today)
    .eq("status", "confirmed")
    .order("date")
    .order("time")
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function createAppointment(clinicId, {
  patientName,
  patientPhone,
  serviceName,
  serviceId,
  date,
  time,
  telegramUserId,
  notes,
}) {
  const { data, error } = await db
    .from("appointments")
    .insert({
      clinic_id: clinicId,
      patient_name: patientName,
      patient_phone: patientPhone,
      service_name: serviceName,
      service_id: serviceId,
      date,
      time,
      telegram_user_id: telegramUserId,
      notes,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelAppointment(clinicId, id) {
  const { error } = await db
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("clinic_id", clinicId);
  if (error) throw error;
}

export async function searchAppointments(clinicId, query) {
  const { data, error } = await db
    .from("appointments")
    .select("*")
    .eq("clinic_id", clinicId)
    .ilike("patient_name", `%${query}%`)
    .order("date", { ascending: false })
    .order("time", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════
//  RECORDATORIOS
// ═══════════════════════════════════════════════════════════════

export async function getAppointmentsForReminder(clinicId, date) {
  const { data, error } = await db
    .from("appointments")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("date", date)
    .eq("status", "confirmed")
    .eq("reminder_sent", false)
    .not("telegram_user_id", "is", null);
  if (error) throw error;
  return data;
}

export async function markReminderSent(id) {
  const { error } = await db
    .from("appointments")
    .update({ reminder_sent: true })
    .eq("id", id);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
//  HISTORIAL DE CONVERSACIÓN (Phase 3: persistencia en DB)
//  Por ahora solo se exporta la firma — la lógica vive en gemini.js en memoria
// ═══════════════════════════════════════════════════════════════

export async function getConversationHistory(clinicId, patientId, limit = 20) {
  const { data, error } = await db
    .from("bot_conversations")
    .select("role, content")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function appendConversationMessage(clinicId, patientId, role, content) {
  const { error } = await db
    .from("bot_conversations")
    .insert({ clinic_id: clinicId, patient_id: patientId, role, content });
  if (error) throw error;
}
