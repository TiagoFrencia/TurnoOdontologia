import { supabaseAuth } from "../db/supabase.js";
import { getClinicBySlug } from "../db/supabase.js";

// ─────────────────────────────────────────────
//  Middleware: requiere JWT válido de Supabase
//  + que el usuario sea dueño del consultorio :slug
// ─────────────────────────────────────────────
export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado — token requerido" });
  }

  const token = auth.slice(7);
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Sesión inválida o expirada" });
  }

  // Verificar que el usuario es dueño del consultorio solicitado
  const slug = req.params.slug;
  if (!slug) {
    return res.status(400).json({ error: "Slug del consultorio requerido" });
  }

  let clinic;
  try {
    clinic = await getClinicBySlug(slug);
  } catch {
    return res.status(404).json({ error: "Consultorio no encontrado" });
  }

  if (!clinic.owner_user_id || clinic.owner_user_id !== user.id) {
    return res.status(403).json({ error: "Sin permiso para este consultorio" });
  }

  req.clinic = clinic;
  req.user   = user;
  next();
}

// ─────────────────────────────────────────────
//  Middleware: resuelve clínica por slug (sin auth)
//  Para endpoints públicos (booking page)
// ─────────────────────────────────────────────
export async function resolveClinic(req, res, next) {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ error: "Slug requerido" });

  try {
    req.clinic = await getClinicBySlug(slug);
    next();
  } catch {
    res.status(404).json({ error: "Consultorio no encontrado" });
  }
}
