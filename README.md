# Sistema inteligente de consulta para call center de ventas

API REST con pipeline RAG (Retrieval-Augmented Generation) que permite a los agentes de un call center consultar información de campañas, productos y documentos de conocimiento mediante lenguaje natural.

---

## Requisitos previos

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Node.js | 20 LTS | Se recomienda usar `nvm` |
| npm | 10+ | Incluido con Node.js |
| Supabase | — | Proyecto con extensión `pgvector` habilitada |
| Ollama | 0.3+ | Con los modelos descargados (ver más abajo) |

### Modelos de Ollama requeridos

```bash
ollama pull gemma3
ollama pull nomic-embed-text
```

---

## Instalación

```bash
npm install
```

---

## Configuración de variables de entorno

Copiar el archivo de ejemplo y completar los valores reales:

```bash
cp .env.example .env
```

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto en el que escucha el servidor | `3000` |
| `SUPABASE_URL` | URL del proyecto Supabase | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio de Supabase (service role) | — |
| `OLLAMA_BASE_URL` | URL base de la instancia de Ollama | `http://localhost:11434` |
| `OLLAMA_CHAT_MODEL` | Modelo de chat de Ollama | `gemma3` |
| `OLLAMA_EMBEDDING_MODEL` | Modelo de embeddings de Ollama | `nomic-embed-text` |

---

## Inicialización de la base de datos

Ejecutar el script SQL en el editor de consultas de Supabase:

1. Abrir el proyecto en [supabase.com](https://supabase.com) → **SQL Editor**
2. Pegar el contenido de `database.sql` y ejecutarlo

El script habilita la extensión `vector`, crea todas las tablas relacionales, la tabla de embeddings de documentos y la función `match_documents` para búsqueda por similitud.

---

## Ejecutar el servidor

```bash
# Modo desarrollo (con recarga automática)
npm run dev

# Modo producción
npm run build && npm start
```

El servidor queda disponible en `http://localhost:3000`.

---

## Uso de la API

### `GET /health`

Verifica que el servidor esté en línea.

```bash
curl http://localhost:3000/health
```

**Respuesta:**
```json
{ "estado": "ok" }
```

---

### `POST /api/documents/ingest`

Ingesta un archivo de texto (`.txt`) en la base de conocimiento. El servidor lee el contenido del
archivo, lo divide en fragmentos (chunks) con solapamiento, genera los embeddings y los almacena en
Supabase mediante `SupabaseVectorStore`.

La solicitud usa `multipart/form-data` con el archivo en el campo `file`.

```bash
curl -X POST http://localhost:3000/api/documents/ingest \
  -F "file=@./docs/seguro_auto_premium.txt" \
  -F "category=seguros"
```

**Campos del formulario:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `file` | `archivo .txt` | Sí | Documento de texto plano a indexar |
| `category` | `string` | No | Categoría del documento (se guarda en la metadata) |

**Respuesta exitosa (201):**
```json
{ "mensaje": "Documento ingestado correctamente.", "chunksIngested": 5 }
```

---

### `POST /api/query`

Procesa una consulta en lenguaje natural. Clasifica la intención, busca información relevante y genera una respuesta en español.

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{ "question": "¿Cuáles son los productos disponibles en la campaña de seguros?" }'
```

**Cuerpo de la solicitud:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `question` | `string` | Sí | Pregunta en lenguaje natural |

**Respuesta exitosa (200):**
```json
{
  "answer": "Los productos disponibles en la campaña de seguros son...",
  "source": "database",
  "question": "¿Cuáles son los productos disponibles en la campaña de seguros?"
}
```

El campo `source` indica el origen de la respuesta:

| Valor | Descripción |
|---|---|
| `database` | Información obtenida de las tablas relacionales |
| `rag` | Información obtenida de los documentos indexados |
| `combined` | Información combinada de ambas fuentes |
| `unsupported` | Pregunta fuera del dominio del sistema |

---

## Arquitectura del sistema

```
sales-call-center-backend/
├── src/
│   ├── ai/                     Capa de inteligencia artificial
│   │   ├── prompts.ts          Plantillas de prompts para el LLM
│   │   ├── intentClassifier.ts Clasificador de intención (database/rag/combined/unsupported)
│   │   ├── answerChain.ts      Cadena LangChain para generación de respuestas
│   │   ├── chatModel.ts        Cliente del modelo de chat (Ollama)
│   │   └── embeddingModel.ts   Cliente del modelo de embeddings (Ollama)
│   │
│   ├── data/
│   │   └── documentIngestionService.ts  Ingesta y vectorización de documentos
│   │
│   ├── db/
│   │   └── supabaseClient.ts   Cliente Supabase (PostgreSQL + pgvector)
│   │
│   ├── routes/
│   │   ├── documentRoutes.ts   POST /api/documents/ingest
│   │   └── queryRoutes.ts      POST /api/query
│   │
│   ├── services/
│   │   ├── queryService.ts     Orquestador principal del pipeline RAG
│   │   ├── databaseSearchService.ts  Búsqueda en tablas relacionales
│   │   └── ragSearchService.ts       Búsqueda semántica por similitud vectorial
│   │
│   ├── types/
│   │   └── query.ts            Interfaces TypeScript compartidas
│   │
│   └── index.ts                Punto de entrada — servidor Express
│
├── database.sql                Script SQL de inicialización
├── .env.example                Plantilla de variables de entorno
├── tsconfig.json               Configuración de TypeScript (strict mode)
└── jest.config.js              Configuración de pruebas
```

### Flujo de una consulta

```
Cliente
  │
  ▼
POST /api/query  { question }
  │
  ▼
intentClassifier  ──► Ollama (gemma3)
  │
  ├─ "database"   ──► databaseSearchService  ──► Supabase (SQL)
  ├─ "rag"        ──► ragSearchService       ──► Supabase (pgvector)
  ├─ "combined"   ──► ambos servicios
  └─ "unsupported" ──► respuesta fija (sin LLM)
       │
       ▼
  answerChain  ──► Ollama (gemma3)  ──► respuesta en español
```

---

## Ejecución de pruebas

```bash
# Ejecutar todas las pruebas
npm test

# Modo observación (re-ejecuta al guardar cambios)
npm run test:watch

# Verificar tipos sin compilar
npx tsc --noEmit
```

Las pruebas usan Jest + ts-jest + supertest. Todas las llamadas a Supabase y Ollama están mockeadas; solo se prueba la lógica de negocio interna.
