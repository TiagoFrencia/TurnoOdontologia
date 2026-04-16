-- ══════════════════════════════════════════════════════════════
-- 001_multitenant.sql  —  Migración Single-tenant → Multi-tenant
-- Ejecutar en: Supabase SQL Editor (una sola vez, es idempotente)
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- 1. Tabla principal de consultorios (reemplaza clinic_info)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  owner_user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  matricula           TEXT,
  telefono            TEXT,
  instagram           TEXT,
  ubicacion           TEXT,
  horarios            JSONB DEFAULT '{}',
  obras_sociales      JSONB DEFAULT '[]',
  medios_pago         JSONB DEFAULT '[]',
  slot_duration_min   INT  DEFAULT 45,
  min_advance_hours   INT  DEFAULT 2,
  max_per_day         INT  DEFAULT 12,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 2. Canales de mensajería por consultorio
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_channels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('telegram', 'baileys', 'wa_cloud')),
  status       TEXT NOT NULL DEFAULT 'disconnected'
               CHECK (status IN ('disconnected', 'pending_qr', 'connected', 'banned')),
  credentials  JSONB DEFAULT '{}',
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, kind)
);

-- ──────────────────────────────────────────────────────────────
-- 3. Tabla de pacientes (resuelve canal → identidad)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  channel_kind    TEXT NOT NULL,
  channel_user_id TEXT NOT NULL,
  display_name    TEXT,
  phone           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, channel_kind, channel_user_id)
);

-- ──────────────────────────────────────────────────────────────
-- 4. Historial de conversación por (clínica, paciente)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'model')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bot_conversations_lookup
  ON bot_conversations(clinic_id, patient_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- 5. Agregar clinic_id a tablas existentes
-- ──────────────────────────────────────────────────────────────

-- Semilla: crear registro de Ignacio Rossetti primero (usamos el id de clinic_info viejo como base)
INSERT INTO clinics (
  slug, name, matricula, telefono, instagram, ubicacion,
  horarios, obras_sociales, medios_pago,
  slot_duration_min, min_advance_hours, max_per_day, onboarding_completed
)
SELECT
  'rossetti',
  COALESCE(nombre, 'Od. Ignacio Rossetti'),
  COALESCE(matricula, 'M.P. 12572'),
  COALESCE(telefono, '3571-599970'),
  COALESCE(instagram, '@od.ignaciorossetti'),
  COALESCE(ubicacion, 'Río Tercero, Córdoba, Argentina'),
  to_jsonb(COALESCE(horarios, 'Lunes a Viernes: 9:00 a 13:00 hs. Consultar horarios de tarde.')),
  to_jsonb(COALESCE(obras_sociales, 'PAMI, APROSS, OSPE')),
  to_jsonb(COALESCE(medios_pago, 'Efectivo, Transferencia, Tarjeta')),
  45, 2, 12, TRUE
FROM clinic_info
WHERE id = 1
ON CONFLICT (slug) DO NOTHING;

-- Si clinic_info no tenía datos o no existe la tabla, insertar igual con defaults
INSERT INTO clinics (
  slug, name, matricula, telefono, instagram, ubicacion,
  onboarding_completed
)
VALUES (
  'rossetti', 'Od. Ignacio Rossetti', 'M.P. 12572',
  '3571-599970', '@od.ignaciorossetti', 'Río Tercero, Córdoba, Argentina',
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

-- Variable de conveniencia: ID de Ignacio
-- (Usaremos una función para obtenerlo en los pasos siguientes)

-- 5a. services — agregar clinic_id
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;

UPDATE services
SET clinic_id = (SELECT id FROM clinics WHERE slug = 'rossetti')
WHERE clinic_id IS NULL;

-- 5b. blocked_days — agregar clinic_id
ALTER TABLE blocked_days
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;

UPDATE blocked_days
SET clinic_id = (SELECT id FROM clinics WHERE slug = 'rossetti')
WHERE clinic_id IS NULL;

-- 5c. appointments — agregar clinic_id y patient_id
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS clinic_id  UUID REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE SET NULL;

UPDATE appointments
SET clinic_id = (SELECT id FROM clinics WHERE slug = 'rossetti')
WHERE clinic_id IS NULL;

-- Backfill patients desde appointments.telegram_user_id
INSERT INTO patients (clinic_id, channel_kind, channel_user_id, display_name)
SELECT DISTINCT
  (SELECT id FROM clinics WHERE slug = 'rossetti'),
  'telegram',
  telegram_user_id,
  patient_name
FROM appointments
WHERE telegram_user_id IS NOT NULL
  AND telegram_user_id != ''
ON CONFLICT (clinic_id, channel_kind, channel_user_id) DO NOTHING;

-- Linkear patient_id en appointments
UPDATE appointments a
SET patient_id = p.id
FROM patients p
WHERE a.telegram_user_id = p.channel_user_id
  AND p.clinic_id = (SELECT id FROM clinics WHERE slug = 'rossetti')
  AND a.patient_id IS NULL;

-- 5d. Registrar canal Telegram de Ignacio
-- El token se guarda encriptado en producción; acá dejamos placeholder
INSERT INTO clinic_channels (clinic_id, kind, status, credentials)
VALUES (
  (SELECT id FROM clinics WHERE slug = 'rossetti'),
  'telegram',
  'connected',
  '{"note": "Token configurado via TELEGRAM_BOT_TOKEN env var (Phase 1)"}'
)
ON CONFLICT (clinic_id, kind) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 6. Índices de performance
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS appointments_clinic_date
  ON appointments(clinic_id, date);
CREATE INDEX IF NOT EXISTS services_clinic
  ON services(clinic_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS blocked_days_clinic
  ON blocked_days(clinic_id, date);

-- ──────────────────────────────────────────────────────────────
-- 7. RLS (Row Level Security)
-- ──────────────────────────────────────────────────────────────

-- Habilitar RLS en tablas tenant-scoped
ALTER TABLE clinics          ENABLE ROW LEVEL SECURITY;
ALTER TABLE services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_days     ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_channels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_conversations ENABLE ROW LEVEL SECURITY;

-- ── Políticas para dentistas autenticados (dashboard) ──
-- Leen/escriben solo los recursos de SU consultorio

CREATE POLICY IF NOT EXISTS "owner can select own clinic"
  ON clinics FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "owner can update own clinic"
  ON clinics FOR UPDATE
  USING (owner_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "services: owner access"
  ON services FOR ALL
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_user_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "blocked_days: owner access"
  ON blocked_days FOR ALL
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_user_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "appointments: owner access"
  ON appointments FOR ALL
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_user_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "channels: owner access"
  ON clinic_channels FOR ALL
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_user_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "patients: owner access"
  ON patients FOR ALL
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_user_id = auth.uid())
  );

-- ── Política de service role (bypass RLS) ──
-- El backend usa SUPABASE_SERVICE_ROLE_KEY → bypass automático, no necesita políticas

-- ──────────────────────────────────────────────────────────────
-- 8. Trigger: actualizar updated_at automáticamente
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_clinics_updated_at ON clinics;
CREATE TRIGGER set_clinics_updated_at
  BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- NOTAS PARA EL DESARROLLADOR
-- ──────────────────────────────────────────────────────────────
-- 1. Agregar SUPABASE_SERVICE_ROLE_KEY al .env del backend
--    (se obtiene en Supabase → Project Settings → API → service_role key)
-- 2. Agregar CLINIC_SLUG=rossetti al .env para que el bot sepa qué clínica servir en Phase 1
-- 3. Después de que Ignacio cree su cuenta en /signup, correr:
--    UPDATE clinics SET owner_user_id = '<su-auth-uid>' WHERE slug = 'rossetti';
-- 4. La tabla clinic_info se puede borrar después de verificar que todo funciona bien
--    DROP TABLE IF EXISTS clinic_info;
