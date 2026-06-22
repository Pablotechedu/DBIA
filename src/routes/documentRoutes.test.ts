import request from 'supertest';
import express, { NextFunction, Request, Response } from 'express';
import documentRoutes from './documentRoutes';
import { ingestDocument } from '../data/documentIngestionService';

jest.mock('../data/documentIngestionService');

const mockIngestDocument = ingestDocument as jest.MockedFunction<typeof ingestDocument>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/documents', documentRoutes);
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'Error interno del servidor' });
  });
  return app;
}

describe('POST /api/documents/ingest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('solicitudes válidas', () => {
    it('retorna 201 cuando se ingesta un documento correctamente', async () => {
      mockIngestDocument.mockResolvedValue(undefined);
      const app = buildApp();

      const res = await request(app)
        .post('/api/documents/ingest')
        .send({ content: 'Manual de ventas.' });

      expect(res.status).toBe(201);
    });

    it('responde con mensaje de confirmación en español', async () => {
      mockIngestDocument.mockResolvedValue(undefined);
      const app = buildApp();

      const res = await request(app)
        .post('/api/documents/ingest')
        .send({ content: 'Guía de productos.' });

      expect(res.body).toHaveProperty('mensaje');
      expect(typeof res.body.mensaje).toBe('string');
    });

    it('pasa el content al servicio de ingesta', async () => {
      mockIngestDocument.mockResolvedValue(undefined);
      const app = buildApp();

      await request(app)
        .post('/api/documents/ingest')
        .send({ content: 'Procedimientos internos.' });

      expect(mockIngestDocument).toHaveBeenCalledWith(
        'Procedimientos internos.',
        undefined
      );
    });

    it('pasa metadata opcional al servicio cuando se proporciona', async () => {
      mockIngestDocument.mockResolvedValue(undefined);
      const app = buildApp();
      const meta = { tipo: 'manual', version: 2 };

      await request(app)
        .post('/api/documents/ingest')
        .send({ content: 'Texto con metadata.', metadata: meta });

      expect(mockIngestDocument).toHaveBeenCalledWith('Texto con metadata.', meta);
    });
  });

  describe('validación de entrada', () => {
    it('retorna 400 cuando falta el campo content', async () => {
      const app = buildApp();

      const res = await request(app)
        .post('/api/documents/ingest')
        .send({});

      expect(res.status).toBe(400);
    });

    it('retorna 400 cuando content es una cadena vacía', async () => {
      const app = buildApp();

      const res = await request(app)
        .post('/api/documents/ingest')
        .send({ content: '' });

      expect(res.status).toBe(400);
    });

    it('retorna 400 cuando content no es una cadena de texto', async () => {
      const app = buildApp();

      const res = await request(app)
        .post('/api/documents/ingest')
        .send({ content: 123 });

      expect(res.status).toBe(400);
    });

    it('no llama al servicio cuando la validación falla', async () => {
      const app = buildApp();

      await request(app).post('/api/documents/ingest').send({});

      expect(mockIngestDocument).not.toHaveBeenCalled();
    });
  });

  describe('manejo de errores del servicio', () => {
    it('retorna 500 cuando el servicio de ingesta lanza un error', async () => {
      mockIngestDocument.mockRejectedValue(new Error('Fallo de conexión'));
      const app = buildApp();

      const res = await request(app)
        .post('/api/documents/ingest')
        .send({ content: 'Documento válido.' });

      expect(res.status).toBe(500);
    });
  });
});
