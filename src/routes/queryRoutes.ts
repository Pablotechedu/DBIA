import { Router, Request, Response, NextFunction } from 'express';
import { handleQuery } from '../services/queryService';

const router = Router();

interface QueryBody {
  question?: unknown;
}

router.post('/', async (req: Request<object, object, QueryBody>, res: Response, next: NextFunction) => {
  const { question } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    res.status(400).json({ error: 'El campo "question" es obligatorio y debe ser una cadena de texto no vacía.' });
    return;
  }

  try {
    const result = await handleQuery(question.trim());
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
