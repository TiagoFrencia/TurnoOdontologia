import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt } from "./prompts.js";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

const MODEL = "gemini-2.5-flash";

// Historial de conversación por usuario (en memoria)
// Clave: userId (string), Valor: array de mensajes
const conversations = new Map();

function getHistory(userId) {
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
  }
  return conversations.get(userId);
}

export function clearHistory(userId) {
  conversations.delete(userId);
}

export async function chat(userId, userMessage) {
  const history = getHistory(userId);

  // Agregar mensaje del usuario al historial
  history.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: history,
    config: {
      systemInstruction: await buildSystemPrompt(),
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  const assistantMessage = response.text;

  // Agregar respuesta del asistente al historial
  history.push({
    role: "model",
    parts: [{ text: assistantMessage }],
  });

  return assistantMessage;
}
