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
      const metadata: Record<string, unknown> = { filename: file.originalname };
      const category = req.body?.category;
      if (typeof category === 'string' && category.trim().length > 0) {
        metadata.category = category.trim();
      }

      const { chunksIngested } = await ingestTextDocument({ content, metadata });
      res.status(201).json({ mensaje: 'Documento ingestado correctamente.', chunksIngested });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
