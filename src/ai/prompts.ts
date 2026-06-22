import { SystemMessage, HumanMessage } from '@langchain/core/messages';

const SYSTEM_PROMPT = `Eres un clasificador de intención para un sistema de consulta de call center de ventas.
Analiza la consulta del usuario y determina la mejor fuente de datos para responderla.

Fuentes disponibles:
- "database": consultas sobre datos estructurados (productos, precios, inventario, pedidos, clientes).
- "rag": consultas sobre conocimiento general, políticas y procedimientos documentados.
- "combined": consultas que requieren información de ambas fuentes.

Responde con la fuente más apropiada, un nivel de confianza entre 0.0 y 1.0, y un razonamiento breve en español.`;

export function buildClassificationMessages(query: string): [SystemMessage, HumanMessage] {
  return [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(`Consulta del usuario: ${query}`),
  ];
}
