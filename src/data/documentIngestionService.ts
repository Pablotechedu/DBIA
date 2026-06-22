import { getEmbeddingModel } from '../ai/embeddingModel';
import { getSupabaseClient } from '../db/supabaseClient';

/**
 * Vectoriza `content` con el modelo de embeddings y lo persiste en la tabla `documents`.
 * `metadata` se almacena como JSONB y es opcional.
 */
export async function ingestDocument(
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const model = getEmbeddingModel();
  const [embedding] = await model.embedDocuments([content]);

  const client = getSupabaseClient();
  const { error } = await client.from('documents').insert({ content, metadata, embedding });

  if (error) throw new Error(`Error al ingestar documento: ${error.message}`);
}
