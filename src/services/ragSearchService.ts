import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import type { SupabaseLibArgs } from '@langchain/community/vectorstores/supabase';
import { getEmbeddingModel } from '../ai/embeddingModel';
import { getSupabaseClient } from '../db/supabaseClient';
import type { QueryResult } from '../types/query';

const MATCH_COUNT = 4;

/** Busca documentos semánticamente similares a la consulta usando RAG. */
export async function searchRag(query: string): Promise<QueryResult> {
  const embeddings = getEmbeddingModel();
  const client = getSupabaseClient();

  // Cast bridges @supabase/supabase-js version seen differently by ts-jest vs tsc
  const vectorStore = new SupabaseVectorStore(embeddings, {
    client: client as unknown as SupabaseLibArgs['client'],
    tableName: 'documents',
    queryName: 'match_documents',
  });

  const docs = await vectorStore.similaritySearch(query, MATCH_COUNT);

  if (docs.length === 0) {
    return {
      answer: 'No se encontraron documentos relevantes para la consulta.',
      source: 'rag',
      metadata: { totalDocuments: 0 },
    };
  }

  const lines: string[] = [`Se encontraron ${docs.length} documento(s) relevante(s):\n`];

  docs.forEach((doc, i) => {
    lines.push(`[${i + 1}] ${doc.pageContent}`);
    const metaEntries = Object.entries(doc.metadata);
    if (metaEntries.length > 0) {
      const metaStr = metaEntries.map(([k, v]) => `${k}: ${v}`).join(', ');
      lines.push(`    Fuente: ${metaStr}`);
    }
  });

  return {
    answer: lines.join('\n'),
    source: 'rag',
    metadata: { totalDocuments: docs.length },
  };
}
