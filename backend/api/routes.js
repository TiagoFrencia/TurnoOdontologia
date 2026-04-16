import { Router } from "express";
import { requireAuth, resolveClinic } from "./auth.js";
import { invalidateServicesCache, invalidateClinicCache } from "../bot/prompts.js";
import { triggerRemindersNow } from "../bot/reminders.js";
import {
  getBlockedDays,
  getAppointmentsByDate,
  getUpcomingAppointments,
  createAppointment,
  cancelAppointment,
  getServices,
  createService,
  updateService,
  deleteService,
  blockDay,
  unblockDay,
  getClinicInfo,
  updateClinicInfo,
  searchAppointments,
  isSlugAvailable,
  getClinicByOwner,
  createClinic,
  updateClinic,
} from "../db/supabase.js";
import { supabaseAuth } from "../db/supabase.js";
import {
  getAllSlotsForWeekday,
  getAvailableSlots,
  isWorkday,
  getDayOfWeek,
} from "../utils/slots.js";

export function createRouter(bot) {
  const router = Router();

  // ═══════════════════════════════════════════════════════════════
  //  RUTAS PÚBLICAS — /api/c/:slug/... (sin auth, para booking page)
  // ═══════════════════════════════════════════════════════════════

  // ─── GET /api/c/:slug/clinic-public ── Bootstrap para el frontend
  router.get("/c/:slug/clinic-public", resolveClinic, async (req, res) => {
    const c = req.clinic;
    res.json({
      name: c.name,
      slug: c.slug,
      matricula: c.matricula,
      telefono: c.telefono,
      instagram: c.instagram,
      ubicacion: c.ubicacion,
    });
  });

  // ─── GET /api/c/:slug/month-availability?year=2026&month=4 ───
  router.get("/c/:slug/month-availability", resolveClinic, async (req, res) => {
    try {
      const clinicId = req.clinic.id;
      const year  = parseInt(req.query.year);
      const month = parseInt(req.query.month);

      const daysInMonth = new Date(year, month, 0).getDate();
      const today = new Date().toISOString().split("T")[0];
      const blockedDays = new Set(await getBlockedDays(clinicId));

      const result = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (dateStr < today)              { result[dateStr] = "past";    continue; }
        const dow = getDayOfWeek(dateStr);
        if (!isWorkday(dow, req.clinic.horarios))              { result[dateStr] = "closed";  continue; }
        if (blockedDays.has(dateStr))                          { result[dateStr] = "blocked"; continue; }
        const appointments = await getAppointmentsByDate(clinicId, dateStr);
        const available = getAvailableSlots(dow, appointments.map((a) => a.time), req.clinic.horarios, req.clinic.slot_duration_min);
        result[dateStr] = available.length > 0 ? "available" : "full";
      }
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/c/:slug/slots?date=2026-04-20 ──────────────────
  router.get("/c/:slug/slots", resolveClinic, async (req, res) => {
    try {
      const clinicId = req.clinic.id;
      const { date } = req.query;
      if (!date) return res.status(400).json({ error: "Falta el parámetro date" });

      const dow = getDayOfWeek(date);
      if (!isWorkday(dow, req.clinic.horarios)) return res.json({ slots: [], reason: "El consultorio no atiende este día" });

      const appointments = await getAppointmentsByDate(clinicId, date);
      const slots = getAvailableSlots(dow, appointments.map((a) => a.time), req.clinic.horarios, req.clinic.slot_duration_min);
      res.json({ slots });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/c/:slug/appointments ──────────────────────────
  router.post("/c/:slug/appointments", resolveClinic, async (req, res) => {
    try {
      const clinicId = req.clinic.id;
      const { patientName, serviceName, date, time, telegramUserId } = req.body;

      if (!patientName || !serviceName || !date || !time) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }

      const dow = getDayOfWeek(date);
      const existing = await getAppointmentsByDate(clinicId, date);
      const available = getAvailableSlots(dow, existing.map((a) => a.time), req.clinic.horarios, req.clinic.slot_duration_min);
      if (!available.includes(time)) {
        return res.status(409).json({ error: "Ese horario ya no está disponible. Por favor elegí otro." });
      }

      const appointment = await createAppointment(clinicId, {
        patientName, serviceName, date, time, telegramUserId,
      });

      if (bot && telegramUserId) {
        const fecha = new Date(`${date}T${time}`).toLocaleDateString("es-AR", {
          weekday: "long", day: "numeric", month: "long",
        });
        try {
          await bot.telegram.sendMessage(
            telegramUserId,
            `✅ Turno confirmado!\n\n` +
            `👤 Paciente: ${patientName}\n` +
            `🦷 Servicio: ${serviceName}\n` +
            `📅 Fecha: ${fecha}\n` +
            `🕐 Hora: ${time} hs\n\n` +
            `Si necesitás cancelar o reprogramar, escribinos al ${req.clinic.telefono || "3571-599970"}.`
          );
        } catch (telegramError) {
          console.error("No se pudo notificar por Telegram:", telegramError.message);
        }
      }

      res.json({ success: true, appointment });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════
  //  RUTAS DEL DASHBOARD — requieren JWT válido
  // ═══════════════════════════════════════════════════════════════

  // ─── GET /api/c/:slug/clinic-info ────────────────────────────
  router.get("/c/:slug/clinic-info", requireAuth, async (req, res) => {
    try { res.json(await getClinicInfo(req.clinic.id)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── PATCH /api/c/:slug/clinic-info ──────────────────────────
  router.patch("/c/:slug/clinic-info", requireAuth, async (req, res) => {
    try {
      const allowed = ["nombre", "matricula", "telefono", "instagram", "ubicacion", "horarios", "obras_sociales", "medios_pago"];
      const fields  = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
      const data = await updateClinicInfo(req.clinic.id, fields);
      invalidateClinicCache(req.clinic.id);
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/c/:slug/search?q=nombre ────────────────────────
  router.get("/c/:slug/search", requireAuth, async (req, res) => {
    try {
      const q = (req.query.q || "").trim();
      if (!q) return res.json([]);
      res.json(await searchAppointments(req.clinic.id, q));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/c/:slug/services ───────────────────────────────
  router.get("/c/:slug/services", requireAuth, async (req, res) => {
    try { res.json(await getServices(req.clinic.id)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/c/:slug/services ──────────────────────────────
  router.post("/c/:slug/services", requireAuth, async (req, res) => {
    try {
      const { name, price, duration } = req.body;
      if (!name || !price || !duration) return res.status(400).json({ error: "Faltan campos" });
      const service = await createService(req.clinic.id, { name, price, duration: parseInt(duration) });
      invalidateServicesCache(req.clinic.id);
      res.json(service);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── PATCH /api/c/:slug/services/:id ─────────────────────────
  router.patch("/c/:slug/services/:id", requireAuth, async (req, res) => {
    try {
      const { name, price, duration } = req.body;
      const fields = {};
      if (name     !== undefined) fields.name     = name;
      if (price    !== undefined) fields.price    = price;
      if (duration !== undefined) fields.duration = parseInt(duration);
      const service = await updateService(req.clinic.id, req.params.id, fields);
      invalidateServicesCache(req.clinic.id);
      res.json(service);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── DELETE /api/c/:slug/services/:id ────────────────────────
  router.delete("/c/:slug/services/:id", requireAuth, async (req, res) => {
    try {
      await deleteService(req.clinic.id, req.params.id);
      invalidateServicesCache(req.clinic.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/c/:slug/appointments/upcoming ──────────────────
  router.get("/c/:slug/appointments/upcoming", requireAuth, async (req, res) => {
    try { res.json(await getUpcomingAppointments(req.clinic.id, 100)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/c/:slug/appointments/today ─────────────────────
  router.get("/c/:slug/appointments/today", requireAuth, async (req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      res.json(await getAppointmentsByDate(req.clinic.id, today));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── PATCH /api/c/:slug/appointments/:id/cancel ──────────────
  router.patch("/c/:slug/appointments/:id/cancel", requireAuth, async (req, res) => {
    try {
      await cancelAppointment(req.clinic.id, req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/c/:slug/blocked-days ───────────────────────────
  router.get("/c/:slug/blocked-days", requireAuth, async (req, res) => {
    try { res.json(await getBlockedDays(req.clinic.id)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/c/:slug/blocked-days ──────────────────────────
  router.post("/c/:slug/blocked-days", requireAuth, async (req, res) => {
    try {
      const { date, reason } = req.body;
      if (!date) return res.status(400).json({ error: "Falta el campo date" });
      await blockDay(req.clinic.id, date, reason);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── DELETE /api/c/:slug/blocked-days/:date ──────────────────
  router.delete("/c/:slug/blocked-days/:date", requireAuth, async (req, res) => {
    try {
      await unblockDay(req.clinic.id, req.params.date);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/c/:slug/reminders/trigger ─────────────────────
  router.post("/c/:slug/reminders/trigger", requireAuth, async (req, res) => {
    try {
      await triggerRemindersNow(bot, req.clinic.id);
      res.json({ success: true, message: "Recordatorios enviados" });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════
  //  UTILIDADES PÚBLICAS (sin auth, sin slug)
  // ═══════════════════════════════════════════════════════════════

  // ─── GET /api/me ─────────────────────────────────────────────
  router.get("/me", async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "No autorizado" });
    const token = auth.slice(7);
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Sesión inválida" });
    try {
      const clinic = await getClinicByOwner(user.id);
      res.json({ clinic });
    } catch {
      res.status(404).json({ error: "Consultorio no encontrado" });
    }
  });

  // ─── GET /api/slug-available?slug=xxx ────────────────────────
  router.get("/slug-available", async (req, res) => {
    try {
      const slug = (req.query.slug || "").toLowerCase().trim();
      if (!/^[a-z0-9-]{3,40}$/.test(slug)) return res.json({ available: false, reason: "Formato inválido (3-40 caracteres, solo letras minúsculas, números y guiones)" });
      const available = await isSlugAvailable(slug);
      res.json({ available });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/register ── Crear cuenta + fila en clinics ────
  router.post("/register", async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "No autorizado" });
    const token = auth.slice(7);
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Sesión inválida" });

    // Si ya tiene clínica, devolver la existente (idempotente)
    try {
      const existing = await getClinicByOwner(user.id);
      return res.json({ clinic: existing });
    } catch { /* no existe aún */ }

    const { name, slug, matricula, telefono } = req.body;
    if (!name?.trim() || !slug?.trim()) return res.status(400).json({ error: "Nombre y slug son requeridos" });

    const cleanSlug = slug.toLowerCase().trim();
    if (!/^[a-z0-9-]{3,40}$/.test(cleanSlug)) return res.status(400).json({ error: "Slug inválido (3-40 caracteres, solo letras, números y guiones)" });
    if (!(await isSlugAvailable(cleanSlug))) return res.status(409).json({ error: "Ese identificador ya está en uso" });

    try {
      const clinic = await createClinic({
        owner_user_id: user.id,
        name: name.trim(),
        slug: cleanSlug,
        matricula: matricula?.trim() || null,
        telefono: telefono?.trim() || null,
        onboarding_completed: false,
      });
      res.json({ clinic });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── PATCH /api/me/clinic ── Actualizar clínica durante onboarding
  router.patch("/me/clinic", async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "No autorizado" });
    const token = auth.slice(7);
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Sesión inválida" });

    try {
      const clinic = await getClinicByOwner(user.id);
      const allowed = ["name", "matricula", "telefono", "instagram", "ubicacion", "horarios", "obras_sociales", "medios_pago", "slot_duration_min", "min_advance_hours", "max_per_day", "onboarding_completed"];
      const fields = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
      const updated = await updateClinic(clinic.id, fields);
      invalidateClinicCache(clinic.id);
      res.json({ clinic: updated });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/validate-telegram ── Valida token de bot ──────
  router.post("/validate-telegram", async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token requerido" });
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await r.json();
      if (!data.ok) return res.status(400).json({ error: "Token inválido" });
      res.json({ valid: true, bot: data.result });
    } catch (e) { res.status(500).json({ error: "No se pudo verificar el token" }); }
  });

  return router;
}
