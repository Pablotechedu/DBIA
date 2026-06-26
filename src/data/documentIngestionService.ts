import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import type { SupabaseLibArgs } from '@langchain/community/vectorstores/supabase';
import { getEmbeddingModel } from '../ai/embeddingModel';
import { getSupabaseClient } from '../db/supabaseClient';

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;

/** Parámetros de ingesta de un documento de texto. */
export interface IngestTextInput {
  content: string;
  metadata?: Record<string, unknown>;
}

/** Resultado de la ingesta: cantidad de fragmentos almacenados. */
export interface IngestResult {
  chunksIngested: number;
}

/**
 * Fragmenta `content` en chunks con solapamiento, los vectoriza con el modelo de embeddings y
 * los persiste en la tabla `documents` mediante `SupabaseVectorStore`.
 * `metadata` se almacena como JSONB en cada fragmento y es opcional.
 */
export async function ingestTextDocument(input: IngestTextInput): Promise<IngestResult> {
  const { content, metadata = {} } = input;

  if (!content || content.trim().length === 0) {
    throw new Error('El contenido del documento está vacío y no puede ingestarse.');
  }

  // 1. Documento de LangChain con su metadata.
  const document = new Document({ pageContent: content, metadata });

  // 2. Fragmentación en chunks con solapamiento.
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const chunks = await splitter.splitDocuments([document]);

  // 3. Vectorización y almacenamiento de cada fragmento en pgvector.
  const embeddings = getEmbeddingModel();
  const client = getSupabaseClient();

  await SupabaseVectorStore.fromDocuments(chunks, embeddings, {
    // Cast puente entre versiones de @supabase/supabase-js vistas por ts-jest y tsc.
    client: client as unknown as SupabaseLibArgs['client'],
    tableName: 'documents',
    queryName: 'match_documents',
  });

  return { chunksIngested: chunks.length };
}
