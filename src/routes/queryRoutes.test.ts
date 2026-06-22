import request from 'supertest';
import express, { NextFunction, Request, Response } from 'express';
import queryRoutes from './queryRoutes';
import { handleQuery } from '../services/queryService';
import type { QueryResponse } from '../types/query';

jest.mock('../services/queryService');

const mockHandleQuery = handleQuery as jest.MockedFunction<typeof handleQuery>;

const MOCK_RESPONSE: QueryResponse = {
  question: '¿Cuántas campañas activas hay?',
  classification: { source: 'database', confidence: 0.95, reasoning: 'Consulta de campañas.' },
  answer: 'Hay 3 campañas activas en el sistema.',
  databaseResults: { total: 3 },
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/query', queryRoutes);
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'Error interno del servidor' });
  });
  return app;
}

describe('POST /api/query', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('solicitudes válidas', () => {
    it('retorna 200 con la respuesta del orquestador', async () => {
      mockHandleQuery.mockResolvedValue(MOCK_RESPONSE);
      const app = buildApp();

      const res = await request(app)
        .post('/api/query')
        .send({ question: '¿Cuántas campañas activas hay?' });

      expect(res.status).toBe(200);
    });

    it('devuelve el cuerpo con question, classification y answer', async () => {
      mockHandleQuery.mockResolvedValue(MOCK_RESPONSE);
      const app = buildApp();

      const res = await request(app)
        .post('/api/query')
        .send({ question: '¿Cuántas campañas activas hay?' });

      expect(res.body).toHaveProperty('question');
      expect(res.body).toHaveProperty('classification');
      expect(res.body).toHaveProperty('answer');
    });

    it('llama a handleQuery con la pregunta recortada', async () => {
      mockHandleQuery.mockResolvedValue(MOCK_RESPONSE);
      const app = buildApp();

      await request(app)
        .post('/api/query')
        .send({ question: '  ¿Cuántos agentes hay?  ' });

      expect(mockHandleQuery).toHaveBeenCalledWith('¿Cuántos agentes hay?');
    });

    it('responde con el contenido completo del QueryResponse', async () => {
      mockHandleQuery.mockResolvedValue(MOCK_RESPONSE);
      const app = buildApp();

      const res = await request(app)
        .post('/api/query')
        .send({ question: '¿Cuántas campañas activas hay?' });

      expect(res.body.answer).toBe('Hay 3 campañas activas en el sistema.');
      expect(res.body.classification.source).toBe('database');
    });
  });

  describe('validación de entrada', () => {
    it('retorna 400 cuando falta el campo question', async () => {
      const app = buildApp();

      const res = await request(app).post('/api/query').send({});

      expect(res.status).toBe(400);
    });

    it('retorna 400 cuando question es una cadena vacía', async () => {
      const app = buildApp();

      const res = await request(app).post('/api/query').send({ question: '' });

      expect(res.status).toBe(400);
    });

    it('retorna 400 cuando question contiene solo espacios', async () => {
      const app = buildApp();

      const res = await request(app).post('/api/query').send({ question: '   ' });

      expect(res.status).toBe(400);
    });

    it('retorna 400 cuando question no es una cadena de texto', async () => {
      const app = buildApp();

      const res = await request(app).post('/api/query').send({ question: 42 });

      expect(res.status).toBe(400);
    });

    it('no llama a handleQuery cuando la validación falla', async () => {
      const app = buildApp();

      await request(app).post('/api/query').send({});

      expect(mockHandleQuery).not.toHaveBeenCalled();
    });

    it('incluye mensaje de error en español en la respuesta 400', async () => {
      const app = buildApp();

      const res = await request(app).post('/api/query').send({});

      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });
  });

  describe('manejo de errores del servicio', () => {
    it('retorna 500 cuando handleQuery lanza un error', async () => {
      mockHandleQuery.mockRejectedValue(new Error('Fallo del orquestador'));
      const app = buildApp();

      const res = await request(app)
        .post('/api/query')
        .send({ question: '¿Cuántos leads hay?' });

      expect(res.status).toBe(500);
    });
  });
});
