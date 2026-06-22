import { Router, Request, Response, NextFunction } from 'express';
import { ingestDocument } from '../data/documentIngestionService';

const router = Router();

interface IngestBody {
  content?: unknown;
  metadata?: Record<string, unknown>;
}

router.post('/ingest', async (req: Request<object, object, IngestBody>, res: Response, next: NextFunction) => {
  const { content, metadata } = req.body;

  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'El campo "content" es obligatorio y debe ser una cadena de texto.' });
    return;
  }

  try {
    await ingestDocument(content, metadata);
    res.status(201).json({ mensaje: 'Documento ingestado correctamente.' });
  } catch (err) {
    next(err);
  }
});

export default router;
