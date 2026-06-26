import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ingestTextDocument } from '../data/documentIngestionService';

const router = Router();

// Almacenamiento en memoria: el archivo llega como buffer, sin escribir a disco.
const upload = multer({ storage: multer.memoryStorage() });

/** Verifica que el archivo sea un .txt según extensión o mimetype. */
function esArchivoTxt(file: Express.Multer.File): boolean {
  const nombre = file.originalname.toLowerCase();
  return nombre.endsWith('.txt') || file.mimetype === 'text/plain';
}

router.post(
  '/ingest',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Debe adjuntar un archivo en el campo "file".' });
      return;
    }

    if (!esArchivoTxt(file)) {
      res.status(400).json({ error: 'Solo se admiten archivos de texto plano (.txt).' });
      return;
    }

    const content = file.buffer.toString('utf-8');

    if (content.trim().length === 0) {
      res.status(400).json({ error: 'El archivo está vacío.' });
      return;
    }

    try {
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : undefined;
      const category = typeof req.body?.category === 'string' ? req.body.category.trim() : undefined;
      const tagsRaw = typeof req.body?.tags === 'string' ? req.body.tags.trim() : undefined;
      const tags = tagsRaw ? tagsRaw.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined;

      const { chunksIngested } = await ingestTextDocument({
        content,
        title: title || undefined,
        category: category || undefined,
        tags,
        filename: file.originalname,
      });

      res.status(201).json({
        mensaje: 'Documento ingestado correctamente.',
        document: {
          title: title ?? null,
          category: category ?? null,
          filename: file.originalname,
          tags: tags ?? [],
        },
        chunksIngested,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
