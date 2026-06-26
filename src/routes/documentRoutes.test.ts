import request from 'supertest';
import express, { NextFunction, Request, Response } from 'express';
import documentRoutes from './documentRoutes';
import { ingestTextDocument } from '../data/documentIngestionService';

jest.mock('../data/documentIngestionService');

const mockIngestTextDocument = ingestTextDocument as jest.MockedFunction<typeof ingestTextDocument>;

function buildApp() {
  const app = express();
  app.use('/api/documents', documentRoutes);
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'Error interno del servidor' });
  });
  return app;
}

const TXT = Buffer.from('Manual de ventas del call center con suficiente contenido.', 'utf-8');

describe('POST /api/documents/ingest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('solicitudes válidas', () => {
    it('retorna 201 cuando se ingesta un archivo .txt correctamente', async () => {
      mockIngestTextDocument.mockResolvedValue({ chunksIngested: 3 });
      const app = buildApp();

      const res = await request(app)
        .post('/api/documents/ingest')
        .attach('file', TXT, 'manual.txt');

      expect(res.status).toBe(201);
    });

    it('responde con mensaje en español y la cantidad de fragmentos', async () => {
      mockIngestTextDocument.mockResolvedValue({ chunksIngested: 5 });
      const app = buildApp();

      const res = await request(app)
        .post('/api/documents/ingest')
        .attach('file', TXT, 'guia.txt');

      expect(res.body).toHaveProperty('mensaje');
      expect(typeof res.body.mensaje).toBe('string');
      expect(res.body).toHaveProperty('chunksIngested', 5);
    });

    it('lee el contenido del archivo y lo pasa al servicio de ingesta', async () => {
      mockIngestTextDocument.mockResolvedValue({ chunksIngested: 1 });
      const app = buildApp();

      await request(app)
        .post('/api/documents/ingest')
        .attach('file', Buffer.from('Procedimientos internos.', 'utf-8'), 'proc.txt');

      expect(mockIngestTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Procedimientos internos.' })
      );
    });

    it('incluye el nombre del archivo en la metadata', async () => {
      mockIngestTextDocument.mockResolvedValue({ chunksIngested: 1 });
      const app = buildApp();

      await request(app)
        .post('/api/documents/ingest')
        .attach('file', TXT, 'politicas.txt');

      const arg = mockIngestTextDocument.mock.calls[0][0];
      expect(arg.filename).toBe('politicas.txt');
    });

    it('pasa el campo title al servicio cuando se proporciona', async () => {
      mockIngestTextDocument.mockResolvedValue({ chunksIngested: 2 });
      const app = buildApp();

      await request(app)
        .post('/api/documents/ingest')
        .field('title', 'Guion de llamada inicial')
        .attach('file', TXT, 'guion.txt');

      expect(mockIngestTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Guion de llamada inicial' })
      );
    });

    it('pasa el campo category al servicio cuando se proporciona', async () => {
      mockIngestTextDocument.mockResolvedValue({ chunksIngested: 2 });
      const app = buildApp();

      await request(app)
        .post('/api/documents/ingest')
        .field('category', 'Ventas')
        .attach('file', TXT, 'manual.txt');

      expect(mockIngestTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'Ventas' })
      );
    });

    it('pasa el campo tags separados por coma como array al servicio', async () => {
      mockIngestTextDocument.mockResolvedValue({ chunksIngested: 2 });
      const app = buildApp();

      await request(app)
        .post('/api/documents/ingest')
        .field('tags', 'guion,llamada,ventas')
        .attach('file', TXT, 'manual.txt');

      expect(mockIngestTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['guion', 'llamada', 'ventas'] })
      );
    });

    it('incluye document con title, category, filename y tags en la respuesta', async () => {
      mockIngestTextDocument.mockResolvedValue({ chunksIngested: 13 });
      const app = buildApp();

      const res = await request(app)
        .post('/api/documents/ingest')
        .field('title', 'Guion de llamada inicial')
        .field('category', 'Ventas')
        .field('tags', 'guion,llamada,ventas')
        .attach('file', TXT, 'guion.txt');

      expect(res.body.document).toEqual({
        title: 'Guion de llamada inicial',
        category: 'Ventas',
        filename: 'guion.txt',
        tags: ['guion', 'llamada', 'ventas'],
      });
      expect(res.body.chunksIngested).toBe(13);
    });
  });

  describe('validación de entrada', () => {
    it('retorna 400 cuando no se envía ningún archivo', async () => {
      const app = buildApp();

      const res = await request(app).post('/api/documents/ingest');

      expect(res.status).toBe(400);
    });

    it('retorna 400 cuando el archivo no es .txt', async () => {
      const app = buildApp();

      const res = await request(app)
        .post('/api/documents/ingest')
        .attach('file', TXT, 'documento.pdf');

      expect(res.status).toBe(400);
    });

    it('retorna 400 cuando el archivo está vacío', async () => {
      const app = buildApp();

      const res = await request(app)
        .post('/api/documents/ingest')
        .attach('file', Buffer.from('', 'utf-8'), 'vacio.txt');

      expect(res.status).toBe(400);
    });

    it('no llama al servicio cuando la validación falla', async () => {
      const app = buildApp();

      await request(app).post('/api/documents/ingest');

      expect(mockIngestTextDocument).not.toHaveBeenCalled();
    });
  });

  describe('manejo de errores del servicio', () => {
    it('retorna 500 cuando el servicio de ingesta lanza un error', async () => {
      mockIngestTextDocument.mockRejectedValue(new Error('Fallo de conexión'));
      const app = buildApp();

      const res = await request(app)
        .post('/api/documents/ingest')
        .attach('file', TXT, 'manual.txt');

      expect(res.status).toBe(500);
    });
  });
});
