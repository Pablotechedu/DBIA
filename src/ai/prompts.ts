/**
 * Plantilla de sistema para la clasificación de intención.
 * La variable {formatInstructions} se rellena con las instrucciones de formato
 * generadas por el StructuredOutputParser, garantizando una salida con el formato correcto.
 */
export const CLASSIFICATION_SYSTEM_TEMPLATE = `Eres un clasificador de intención para un sistema de consulta de call center de ventas.
Analiza la consulta del usuario y determina la mejor fuente de datos para responderla.

Fuentes disponibles:
- "database": consultas sobre datos estructurados (campañas, prospectos, agentes, llamadas).
- "rag": consultas sobre conocimiento general, políticas y procedimientos documentados.
- "combined": consultas que requieren información de ambas fuentes.
- "unsupported": consultas que no están relacionadas con el call center de ventas.

Responde con la fuente más apropiada, un nivel de confianza entre 0.0 y 1.0, y un razonamiento breve en español.

{formatInstructions}`;

/** Plantilla de usuario para la clasificación de intención. */
export const CLASSIFICATION_HUMAN_TEMPLATE = `Consulta del usuario: {query}`;
