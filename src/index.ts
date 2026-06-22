import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import documentRoutes from "./routes/documentRoutes";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

// Verificación de salud
app.get("/health", (_req: Request, res: Response) => {
  res.json({ estado: "ok" });
});

app.use("/api/documents", documentRoutes);

// Manejador de errores global
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});

export default app;
