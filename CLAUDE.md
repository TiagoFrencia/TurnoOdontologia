# Proyecto: Od. Ignacio Rossetti — Sistema de Turnos + Bot WhatsApp

## Qué es esto
Landing page + bot de WhatsApp con IA + dashboard de turnos para el odontólogo **Ignacio Rossetti** (Río Tercero, Córdoba, Argentina).

El `index.html` es la landing page ya terminada. El resto del sistema está en construcción.

---

## Estado actual
- [x] Landing page (`index.html`) — lista, diseño profesional, botones de WhatsApp funcionales
- [x] Backend Node.js con bot de Telegram funcionando (`backend/`)
- [x] Integración con Gemini 2.5 Flash — responde preguntas de servicios, precios, horarios
- [x] Historial de conversación por usuario (en memoria)
- [x] Detección de intención de turno → trigger para mandar link de booking
- [x] Supabase — proyecto `rossetti-turnos` creado, tablas `services`, `blocked_days`, `appointments`
- [ ] Mini web app de reserva de turnos (calendario interactivo)
- [ ] Dashboard del odontólogo
- [ ] Migración de Telegram → WhatsApp Business API (para producción)

---

## Stack definido

| Capa | Tecnología |
|------|-----------|
| Bot mensajería | Telegram (dev) → WhatsApp Business API (producción) |
| IA del bot | Google Gemini 2.5 Flash (`gemini-2.5-flash`) — model ID confirmado |
| Base de datos | Supabase (proyecto a crear) |
| Backend | Node.js — Railway (free tier durante desarrollo) |
| Booking UI | Mini web app con calendario (link enviado por el bot) |
| Dashboard | Web app simple (Vercel free tier) |

---

## Arquitectura del flujo

```
Paciente escribe por WhatsApp
        ↓
Meta Cloud API recibe el mensaje → webhook al backend (Railway)
        ↓
Backend procesa con Gemini 2.5 Flash
        ↓
Si quiere turno → bot manda link a mini web app (calendario)
        ↓
Paciente elige fecha/hora disponible → se guarda en Supabase
        ↓
Bot confirma por WhatsApp al paciente
        ↓
Dashboard del odontólogo muestra el turno nuevo
```

---

## Números / contacto

- **Número del odontólogo (producción):** +54 3571 599970 (WhatsApp de Ignacio Rossetti)
- **Número del desarrollador (testing):** +54 3584 299936
- **Número del bot (testing):** número de prueba gratuito de Meta (se configura en Meta Business)
- **Instagram odontólogo:** @od.ignaciorossetti
- **Matrícula:** M.P. 12572

> IMPORTANTE: El número +54 3571 599970 tiene WhatsApp común instalado, NO se puede usar directamente con la Cloud API sin migrar. Para desarrollo se usa el número de prueba de Meta. Para producción se necesita un número separado para el bot (SIM virtual o física sin WhatsApp instalado).

---

## APIs y credenciales necesarias

- `GOOGLE_AI_API_KEY` — Google AI Studio (el dev ya la tiene)
- `WHATSAPP_TOKEN` — Meta Business, token de acceso permanente
- `WHATSAPP_PHONE_NUMBER_ID` — ID del número de prueba de Meta
- `WHATSAPP_VERIFY_TOKEN` — string arbitrario para verificar el webhook
- `SUPABASE_URL` — `https://qerjqgybyjvcoxqnjybw.supabase.co`
- `SUPABASE_ANON_KEY` — ver `.env` (ya configurado)

---

## Datos ficticios del consultorio (reemplazar con datos reales de Ignacio)

Mientras el odontólogo completa el cuestionario, el bot usa estos datos:

**Dirección:** Rivadavia 450, Río Tercero, Córdoba

**Horarios:**
- Lunes, Martes, Jueves, Viernes: 9:00–13:00 y 16:00–20:00
- Miércoles: 9:00–13:00
- Sábado y Domingo: cerrado

**Slots de turno:** cada 45 minutos

**Servicios y precios (ficticios):**
| Servicio | Precio | Duración aprox. |
|---------|--------|-----------------|
| Consulta / revisación | $8.000 | 30 min |
| Limpieza dental | $15.000 | 45 min |
| Curación (caries) | $12.000–$18.000 | 45 min |
| Extracción simple | $20.000 | 45 min |
| Extracción muela del juicio | $45.000 | 60 min |
| Blanqueamiento | $60.000 | 60 min |
| Prótesis removible | $150.000 | múltiples sesiones |
| Prótesis fija (por pieza) | $80.000 | múltiples sesiones |
| Implante | $250.000 | múltiples sesiones |

**Obras sociales:** PAMI, APROSS, OSPE (ficticias — confirmar con Ignacio)

**Medios de pago:** Efectivo, transferencia bancaria, tarjeta de débito/crédito

**Anticipación mínima para turno:** 24 horas

**Máximo turnos por día:** 8

---

## Cuestionario pendiente para el odontólogo

Hay que pasarle a Ignacio estas preguntas y reemplazar los datos ficticios de arriba:

1. Dirección exacta del consultorio
2. Días y horarios de atención reales
3. ¿Tiene días fijos libres o variables?
4. Precios de cada servicio (o si prefiere no mostrarlos)
5. Duración aproximada de cada tratamiento
6. ¿Qué obras sociales/prepagas acepta?
7. Medios de pago aceptados
8. ¿Cada cuánto tiempo son los slots de turno?
9. ¿Cuántos días de anticipación mínimo?
10. ¿Cuántos turnos máximo por día?
11. ¿Quiere poder bloquear días desde el dashboard? (vacaciones, etc.)

---

## Próximos pasos (en orden)

### Paso 1 — ✅ Bot Telegram + Gemini funcionando
- Bot corriendo en modo polling local (`npm run dev` en `backend/`)
- Model ID confirmado: `gemini-2.5-flash`
- Para levantar el bot: `cd backend && npm run dev`

### Paso 2 — Crear proyecto Supabase
1. Crear proyecto en [supabase.com](https://supabase.com)
2. Crear tablas: `appointments`, `blocked_days`, `services`
3. Anotar: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### Paso 3 — Construir el backend (Node.js)
- Webhook para recibir mensajes de WhatsApp
- Lógica de conversación con Gemini
- Endpoints para: crear turno, listar turnos, bloquear días

### Paso 4 — Mini web app de reserva
- Calendario con días disponibles/bloqueados
- Selección de horario
- Confirmación y guardado en Supabase

### Paso 5 — Dashboard del odontólogo
- Login simple
- Vista de turnos próximos
- Bloqueo de días

### Paso 6 — Deploy
- Backend en Railway
- Web apps en Vercel o GitHub Pages
- Conectar webhook de Meta al backend deployado

---

## Estructura de carpetas prevista

```
rosseti/
├── index.html              ← landing page (ya existe)
├── CLAUDE.md               ← este archivo
├── backend/
│   ├── package.json
│   ├── index.js            ← servidor principal (webhook + API)
│   ├── bot/
│   │   ├── gemini.js       ← integración con Gemini
│   │   └── prompts.js      ← sistema de prompts del bot
│   ├── whatsapp/
│   │   └── client.js       ← envío/recepción de mensajes
│   └── db/
│       └── supabase.js     ← cliente y queries de Supabase
├── booking/
│   └── index.html          ← mini web app del calendario
└── dashboard/
    └── index.html          ← dashboard del odontólogo
```
