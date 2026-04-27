# Busca de capa por foto — Fase 2 (Llama 3.2 Vision) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o motor da Fase 1 (Tesseract.js OCR no browser) por **Llama 3.2 Vision** rodando via Cloudflare Workers AI. O VLM lê a capa, extrai metadados estruturados (título, número, editora, autores, ocr_text), e alimenta a busca textual existente. Resolve capas estilizadas onde Tesseract falhava.

**Architecture:** Cliente comprime foto → base64 → `POST /api/v1/cover-scan/recognize`. API repassa pro Workers AI (`@cf/meta/llama-3.2-11b-vision-instruct`), recebe JSON estruturado, normaliza tokens, reusa `searchByText` da Fase 1 com input enriquecido. Tabela `cover_scan_logs`, rate limit, `/choose` endpoint, frontend (página + integração) — tudo da Fase 1 fica intacto. Endpoint `/search` da Fase 1 mantém-se como fallback caso Workers AI esteja indisponível.

**Tech Stack:**
- Backend: Express + Zod + Vitest + supertest
- Inferência: Cloudflare Workers AI (`@cf/meta/llama-3.2-11b-vision-instruct`, GA, ~$0,049/M input + $0,68/M output)
- Frontend: Next.js + Canvas API para compressão de imagem (sem Tesseract)
- HTTP: `fetch` nativo do Node 20+ (sem dependência nova)

**Spec:** [docs/superpowers/specs/2026-04-26-busca-capa-por-foto-design.md](../specs/2026-04-26-busca-capa-por-foto-design.md) (seção 3 — Fase 2)

**Branch ativa:** `feat/scan-capa-por-foto` (continua da Fase 1).

**Pré-requisitos confirmados:**
- ✅ Conta Cloudflare existe (Account ID `941ce9d10317d15235e55932d1e9d5f2`).
- ✅ API token criado com permissão `Workers AI: Read + Edit` (em `apps/api/.env` como `CLOUDFLARE_API_TOKEN`).
- ✅ Licença do Llama 3.2 Vision já foi aceita na conta do Fernando em 2026-04-27 (a primeira chamada de cada conta exige `{"prompt":"agree"}` — passo único).
- ✅ Chamada real testada e funcionando (validação com capa Spider-Man do Open Library).

---

## File Structure

### Backend (apps/api)

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `apps/api/src/shared/lib/cloudflare-ai.ts` | criar | Cliente fino do Workers AI: monta payload, faz fetch, parseia JSON da resposta |
| `apps/api/src/modules/cover-scan/cover-recognize.service.ts` | criar | Orquestra: chama Workers AI → parseia JSON → enriquece tokens → reutiliza `searchByText` |
| `apps/api/src/modules/cover-scan/cover-scan.routes.ts` | modificar | Adicionar rota `POST /recognize` |
| `apps/api/src/modules/cover-scan/cover-scan.service.ts` | modificar | Exportar `searchByText` para reuso pelo recognize-service (já é exportado, só verificar) |
| `apps/api/src/__tests__/cover-scan/cover-recognize.test.ts` | criar | Testes (com Workers AI mockado via `vi.mock`) |
| `apps/api/.env.example` | modificar | Documentar `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_AI_MODEL` |
| `packages/contracts/src/cover-scan.ts` | modificar | Adicionar `coverScanRecognizeSchema`, `CoverScanRecognizeInput`, `CoverScanRecognizeResponse` |

### Frontend (apps/web)

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `apps/web/src/lib/api/cover-scan.ts` | modificar | Adicionar função `recognize(imageBase64)` |
| `apps/web/src/lib/utils/compress-image.ts` | criar | Helper que comprime `File` → `data:image/jpeg;base64,...` via Canvas API |
| `apps/web/src/components/features/catalog/cover-photo-scanner.tsx` | modificar | Remover Tesseract, comprimir e chamar `/recognize`; UI de estágios (idle/compressing/recognizing/searching/results/error) |
| `apps/web/package.json` | modificar | Remover `tesseract.js` (via `pnpm remove`) |
| `apps/web/src/messages/pt-BR.json` | modificar | Pequenos ajustes nas chaves de status (`reading` → `analyzing`, etc.) |

---

## Pre-flight check

```bash
git branch --show-current
# expected: feat/scan-capa-por-foto

grep -E "^CLOUDFLARE_" apps/api/.env
# expected: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN both present (não vazios)
```

Se faltar alguma das duas vars, pare e peça pro Fernando configurar antes.

---

### Task 1: Contract Zod e cliente Workers AI

**Files:**
- Modify: `packages/contracts/src/cover-scan.ts`
- Create: `apps/api/src/shared/lib/cloudflare-ai.ts`
- Modify: `apps/api/.env.example`

**Contexto:** Esta task entrega o cliente do Workers AI isolado (testável) e os schemas Zod do novo endpoint. Sem rota e sem service ainda.

- [ ] **Step 1: Adicionar schemas e tipos no contract**

Em `packages/contracts/src/cover-scan.ts`, adicione no fim (antes do `export const COVER_SCAN_DAILY_LIMIT_DEFAULT`):

```typescript
// === Recognize endpoint (Fase 2) ===

// Limite de tamanho do data URI base64. Imagens comprimidas a 800px JPEG q=80
// ficam ~50–250 KB. Multiplicador 1.37 (base64 overhead) → ~340 KB string.
// Limite de 1 MB cobre folgado e protege contra abuso.
const MAX_IMAGE_BASE64_LENGTH = 1_400_000;

export const coverScanRecognizeSchema = z.object({
  imageBase64: z
    .string()
    .min(100, 'Imagem em base64 muito curta')
    .max(MAX_IMAGE_BASE64_LENGTH, 'Imagem em base64 muito grande (max ~1MB)')
    .refine(
      (s) => s.startsWith('data:image/'),
      'imageBase64 deve ser uma data URI no formato data:image/<fmt>;base64,<dados>',
    ),
  durationMs: z.number().int().nonnegative().max(600000).optional(),
});
export type CoverScanRecognizeInput = z.infer<typeof coverScanRecognizeSchema>;

// Response reaproveita o mesmo formato do /search (candidatos + scanLogId)
export type CoverScanRecognizeResponse = CoverScanSearchResponse;
```

- [ ] **Step 2: Build contracts**

```bash
corepack pnpm --filter contracts build
```

Esperado: `dist/` regenerado, sem erros.

- [ ] **Step 3: Documentar env vars**

Em `apps/api/.env.example`, adicione no fim:

```
# Cloudflare Workers AI (Fase 2 scan-capa)
# Conta com Workers AI habilitado. Token precisa de permissao Workers AI: Read + Edit.
# Account ID: visivel no dashboard CF, canto direito.
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.2-11b-vision-instruct
```

- [ ] **Step 4: Criar cliente Workers AI**

Crie `apps/api/src/shared/lib/cloudflare-ai.ts`:

```typescript
/**
 * Cliente fino do Cloudflare Workers AI.
 *
 * Foco: invocar modelos de visao (Llama 3.2 Vision) com imagem em data URI
 * e parsear o JSON estruturado que o modelo retorna como string.
 *
 * Depende de duas env vars:
 *   - CLOUDFLARE_ACCOUNT_ID
 *   - CLOUDFLARE_API_TOKEN  (com permissao Workers AI Read+Edit)
 *   - CLOUDFLARE_AI_MODEL   (default: @cf/meta/llama-3.2-11b-vision-instruct)
 *
 * IMPORTANTE: a primeira chamada de cada modelo Llama na conta exige aceitar
 * a licenca via {"prompt":"agree"}. A conta usada ja aceitou em 2026-04-27.
 */

import { InternalError } from '../utils/api-error';

const DEFAULT_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const API_BASE = 'https://api.cloudflare.com/client/v4';

export interface RecognizedCover {
  title: string | null;
  issue_number: number | null;
  publisher: string | null;
  authors: string[];
  series: string | null;
  language: string | null;
  confidence: 'alta' | 'media' | 'baixa';
  ocr_text: string;
  raw_response: string; // resposta crua do modelo (debug + log)
}

const SYSTEM_PROMPT = `Voce eh um especialista em quadrinhos brasileiros, americanos e japoneses.
Sua tarefa: identificar a capa de um gibi a partir de uma imagem.

Regras:
- Retorne APENAS um objeto JSON valido, sem markdown, sem explicacoes.
- Se nao tiver certeza de algum campo, use null para esse campo (exceto "ocr_text", que sempre tem string).
- "confidence" reflete o quanto voce esta certo do "title".
- "ocr_text" deve listar TODO texto que voce conseguir ler na capa, mesmo que parcial — separado por quebras de linha.
- Idiomas comuns: pt-BR, en, jp, es. Se incerto, use "outro".

Schema:
{
  "title": string ou null,
  "issue_number": number inteiro ou null,
  "publisher": string ou null,
  "authors": [string],
  "series": string ou null,
  "language": "pt-BR"|"en"|"jp"|"es"|"outro"|null,
  "confidence": "alta"|"media"|"baixa",
  "ocr_text": string
}`;

const USER_PROMPT = 'Identifique este gibi pela capa.';

interface WorkersAIResponse {
  result?: {
    response?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
}

/**
 * Invoca o Llama Vision com a imagem em data URI e retorna metadados estruturados.
 * Lanca InternalError se a chamada falhar ou se o JSON nao puder ser parseado.
 */
export async function recognizeCoverImage(
  imageDataUri: string,
): Promise<RecognizedCover> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CLOUDFLARE_AI_MODEL || DEFAULT_MODEL;

  if (!accountId || !apiToken) {
    throw new InternalError('Cloudflare Workers AI nao configurado (env vars faltando)');
  }

  const url = `${API_BASE}/accounts/${accountId}/ai/run/${model}`;
  const payload = {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `${SYSTEM_PROMPT}\n\n${USER_PROMPT}` },
          { type: 'image_url', image_url: { url: imageDataUri } },
        ],
      },
    ],
    max_tokens: 400,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new InternalError(`Erro de rede ao chamar Workers AI: ${(err as Error).message}`);
  }

  const json = (await res.json().catch(() => ({}))) as WorkersAIResponse;

  if (!res.ok || !json.success) {
    const errMsg = json.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new InternalError(`Workers AI falhou: ${errMsg}`);
  }

  const responseText = json.result?.response ?? '';
  if (!responseText) {
    throw new InternalError('Workers AI retornou response vazio');
  }

  // Llama as vezes envolve o JSON em ```json ... ``` ou texto extra.
  // Extrair o primeiro { ... } valido.
  const parsed = extractJson(responseText);
  if (!parsed) {
    throw new InternalError(`Workers AI retornou JSON invalido: ${responseText.slice(0, 200)}`);
  }

  return {
    title: typeof parsed.title === 'string' ? parsed.title : null,
    issue_number: typeof parsed.issue_number === 'number' ? Math.floor(parsed.issue_number) : null,
    publisher: typeof parsed.publisher === 'string' ? parsed.publisher : null,
    authors: Array.isArray(parsed.authors)
      ? parsed.authors.filter((a: unknown): a is string => typeof a === 'string').slice(0, 10)
      : [],
    series: typeof parsed.series === 'string' ? parsed.series : null,
    language: typeof parsed.language === 'string' ? parsed.language : null,
    confidence:
      parsed.confidence === 'alta' || parsed.confidence === 'media' || parsed.confidence === 'baixa'
        ? parsed.confidence
        : 'baixa',
    ocr_text: typeof parsed.ocr_text === 'string' ? parsed.ocr_text : '',
    raw_response: responseText,
  };
}

/**
 * Extrai o primeiro objeto JSON valido encontrado em um texto que pode ter
 * markdown ou texto extra antes/depois.
 */
function extractJson(text: string): Record<string, unknown> | null {
  // Tentativa 1: parse direto
  try {
    return JSON.parse(text);
  } catch {
    // continua
  }

  // Tentativa 2: strip de fence markdown ```json ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continua
    }
  }

  // Tentativa 3: pegar do primeiro { ate o ultimo }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // falhou tudo
    }
  }

  return null;
}
```

- [ ] **Step 5: Verificar tipos**

```bash
corepack pnpm --filter contracts build
corepack pnpm --filter api type-check
```

Esperado: ambos passam.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/cover-scan.ts packages/contracts/dist apps/api/src/shared/lib/cloudflare-ai.ts apps/api/.env.example
git commit -m "$(cat <<'EOF'
feat(cover-scan): contract recognize + cliente Workers AI

Contract Zod do POST /cover-scan/recognize (input: imageBase64
data URI ate ~1MB). Cliente fino para Cloudflare Workers AI
com parsing tolerante de JSON (Llama as vezes vem com
markdown/texto extra). Doc de env vars no .env.example.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: TDD service `recognizeFromImage`

**Files:**
- Create: `apps/api/src/modules/cover-scan/cover-recognize.service.ts`
- Create: `apps/api/src/__tests__/cover-scan/cover-recognize.test.ts`
- Modify: `apps/api/src/modules/cover-scan/cover-scan.service.ts` (verificar/garantir export de `searchByText`)

**Contexto:** Esta task implementa a logica de orquestracao: chama o Workers AI (mockado nos testes), enriquece tokens e reutiliza o `searchByText` ja existente da Fase 1 para devolver os candidatos.

- [ ] **Step 1: Verificar que `searchByText` é exportado**

```bash
grep -n "export.*searchByText" apps/api/src/modules/cover-scan/cover-scan.service.ts
```

Esperado: linha mostrando `export async function searchByText(...)`. Se não tiver `export`, adicione (provável que já tem).

- [ ] **Step 2: Escrever testes (falhando)**

Crie `apps/api/src/__tests__/cover-scan/cover-recognize.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_USER } from '../setup';

// Mock do cliente Workers AI ANTES de importar o service
vi.mock('../../shared/lib/cloudflare-ai', () => ({
  recognizeCoverImage: vi.fn(),
}));

import { recognizeCoverImage } from '../../shared/lib/cloudflare-ai';

const prisma = new PrismaClient();

let userToken: string;
let userId: string;
const createdLogIds: string[] = [];

const mockedRecognize = vi.mocked(recognizeCoverImage);

beforeAll(async () => {
  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;
  const u = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
  if (!u) throw new Error('TEST_USER nao encontrado');
  userId = u.id;
});

beforeEach(() => {
  mockedRecognize.mockReset();
});

afterAll(async () => {
  if (createdLogIds.length > 0) {
    await prisma.coverScanLog.deleteMany({ where: { id: { in: createdLogIds } } });
  }
  await prisma.$disconnect();
});

const TINY_DATA_URI =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8/wD9k=';

describe('POST /api/v1/cover-scan/recognize', () => {
  it('returns 401 without auth token', async () => {
    const res = await request
      .post('/api/v1/cover-scan/recognize')
      .send({ imageBase64: TINY_DATA_URI });

    expect(res.status).toBe(401);
  });

  it('returns 400 if imageBase64 is not a data URI', async () => {
    const res = await request
      .post('/api/v1/cover-scan/recognize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ imageBase64: 'not-a-data-uri' });

    expect(res.status).toBe(400);
  });

  it('uses VLM output to find catalog candidates', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        title: 'Transmetropolitan',
        publisher: 'Panini',
        editionNumber: 1,
        approvalStatus: 'APPROVED',
        createdById: userId,
      },
    });

    mockedRecognize.mockResolvedValue({
      title: 'Transmetropolitan',
      issue_number: 1,
      publisher: 'Panini',
      authors: ['Warren Ellis', 'Darick Robertson'],
      series: 'Transmetropolitan',
      language: 'pt-BR',
      confidence: 'alta',
      ocr_text: 'TRANSMETROPOLITAN\nPanini\nWarren Ellis',
      raw_response: '{}',
    });

    try {
      const res = await request
        .post('/api/v1/cover-scan/recognize')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ imageBase64: TINY_DATA_URI });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.candidates).toBeInstanceOf(Array);
      const found = res.body.data.candidates.find((c: { id: string }) => c.id === entry.id);
      expect(found).toBeDefined();
      expect(typeof res.body.data.scanLogId).toBe('string');
      createdLogIds.push(res.body.data.scanLogId);
      expect(mockedRecognize).toHaveBeenCalledTimes(1);
    } finally {
      await prisma.catalogEntry.delete({ where: { id: entry.id } });
    }
  });

  it('returns empty candidates if VLM fails to identify (low confidence + nothing)', async () => {
    mockedRecognize.mockResolvedValue({
      title: null,
      issue_number: null,
      publisher: null,
      authors: [],
      series: null,
      language: null,
      confidence: 'baixa',
      ocr_text: '',
      raw_response: '{}',
    });

    const res = await request
      .post('/api/v1/cover-scan/recognize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ imageBase64: TINY_DATA_URI });

    expect(res.status).toBe(200);
    expect(res.body.data.candidates).toEqual([]);
    if (res.body.data.scanLogId) createdLogIds.push(res.body.data.scanLogId);
  });

  it('persists VLM raw response in cover_scan_logs.raw_text', async () => {
    mockedRecognize.mockResolvedValue({
      title: 'Test Title',
      issue_number: null,
      publisher: 'Test Pub',
      authors: [],
      series: null,
      language: 'en',
      confidence: 'media',
      ocr_text: 'Test OCR text',
      raw_response: '{"title":"Test Title"}',
    });

    const res = await request
      .post('/api/v1/cover-scan/recognize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ imageBase64: TINY_DATA_URI });

    expect(res.status).toBe(200);
    const scanLogId = res.body.data.scanLogId;
    createdLogIds.push(scanLogId);

    const log = await prisma.coverScanLog.findUnique({ where: { id: scanLogId } });
    expect(log?.rawText).toContain('Test Title');
  });
});
```

- [ ] **Step 3: Rodar testes para ver falhar**

```bash
corepack pnpm --filter api test -- cover-recognize
```

Esperado: 5 testes falhando (rota não existe ainda).

- [ ] **Step 4: Implementar service**

Crie `apps/api/src/modules/cover-scan/cover-recognize.service.ts`:

```typescript
import { prisma } from '../../shared/lib/prisma';
import { recognizeCoverImage, type RecognizedCover } from '../../shared/lib/cloudflare-ai';
import { localCoverUrl, LOCAL_API_BASE_URL } from '../../shared/lib/cloudinary';
import { TooManyRequestsError } from '../../shared/utils/api-error';
import {
  COVER_SCAN_DAILY_LIMIT_DEFAULT,
  type CoverScanRecognizeInput,
  type CoverScanRecognizeResponse,
  type CoverScanCandidate,
} from '@comicstrunk/contracts';
import type { Prisma } from '@prisma/client';

const TOP_N = 8;

// === Reutilizar funcoes auxiliares (copiadas do cover-scan.service para nao
// criar dependencia circular; sao puras e pequenas) ===

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function pickSearchableTokens(tokens: string[]): string[] {
  return Array.from(
    new Set(
      tokens
        .map(normalizeToken)
        .filter((t) => t.length >= 3)
        .slice(0, 12),
    ),
  );
}

function resolveCoverUrl(
  coverImageUrl: string | null,
  coverFileName: string | null,
): string | null {
  if (coverFileName) return localCoverUrl(coverFileName);
  if (coverImageUrl?.includes('/uploads/')) {
    const filename = coverImageUrl.split('/').pop();
    if (filename) return localCoverUrl(filename);
  }
  return coverImageUrl;
}

function scoreCandidate(
  entry: { title: string; publisher: string | null; editionNumber: number | null },
  tokens: string[],
  candidateNumber: number | undefined,
): number {
  const titleNorm = normalizeToken(entry.title);
  const publisherNorm = entry.publisher ? normalizeToken(entry.publisher) : '';
  let score = 0;

  for (const token of tokens) {
    if (titleNorm.includes(token)) score += 1;
    if (publisherNorm.includes(token)) score += 0.5;
  }

  if (candidateNumber !== undefined && entry.editionNumber === candidateNumber) {
    score += 5;
  }

  return score;
}

// === Daily limit (mesmo padrao do cover-scan.service) ===

function getDailyLimit(): number {
  const raw = process.env.COVER_SCAN_DAILY_LIMIT;
  if (!raw) return COVER_SCAN_DAILY_LIMIT_DEFAULT;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : COVER_SCAN_DAILY_LIMIT_DEFAULT;
}

async function assertWithinDailyLimit(userId: string): Promise<void> {
  const limit = getDailyLimit();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.coverScanLog.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (count >= limit) {
    throw new TooManyRequestsError(
      `Limite de ${limit} scans por dia atingido. Tente novamente em 24h.`,
    );
  }
}

// === Build tokens enriquecidos a partir do output do VLM ===

function buildEnrichedTokens(rec: RecognizedCover): string[] {
  const sources: string[] = [];
  if (rec.title) sources.push(rec.title);
  if (rec.series && rec.series !== rec.title) sources.push(rec.series);
  for (const author of rec.authors) sources.push(author);
  if (rec.publisher) sources.push(rec.publisher);
  if (rec.ocr_text) sources.push(rec.ocr_text);

  // Split em palavras
  const tokens: string[] = [];
  for (const s of sources) {
    tokens.push(...s.split(/[\s\n\r\t.,!?;:()\[\]{}'"\/]+/));
  }
  return tokens;
}

// === Main service ===

export async function recognizeFromImage(
  userId: string,
  input: CoverScanRecognizeInput,
): Promise<CoverScanRecognizeResponse> {
  await assertWithinDailyLimit(userId);

  // 1. Chamar VLM
  const recognized = await recognizeCoverImage(input.imageBase64);

  // 2. Construir tokens enriquecidos para busca textual
  const rawTokens = buildEnrichedTokens(recognized);
  const tokens = pickSearchableTokens(rawTokens);

  // 3. Buscar candidatos (mesma logica de searchByText, mas inline para passar
  // candidateNumber vindo do VLM)
  let candidates: CoverScanCandidate[] = [];

  if (tokens.length > 0) {
    const where: Prisma.CatalogEntryWhereInput = {
      approvalStatus: 'APPROVED',
      AND: tokens.map((token) => ({
        OR: [
          { title: { contains: token } },
          { publisher: { contains: token } },
        ],
      })),
    };

    const entries = await prisma.catalogEntry.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        publisher: true,
        editionNumber: true,
        coverImageUrl: true,
        coverFileName: true,
      },
      take: 80,
    });

    const candidateNumber = recognized.issue_number ?? undefined;

    candidates = entries
      .map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        publisher: e.publisher,
        editionNumber: e.editionNumber,
        coverImageUrl: resolveCoverUrl(e.coverImageUrl, e.coverFileName),
        score: scoreCandidate(e, tokens, candidateNumber),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N);
  }

  // 4. Persistir log (rawText = resposta crua do VLM, ocrTokens = tokens enriquecidos)
  const log = await prisma.coverScanLog.create({
    data: {
      userId,
      rawText: recognized.raw_response.slice(0, 5000),
      ocrTokens: tokens.join(' ').slice(0, 5000),
      candidateNumber: recognized.issue_number ?? null,
      candidatesShown: candidates.map((c) => ({ id: c.id, title: c.title, score: c.score })),
      durationMs: input.durationMs ?? null,
    },
    select: { id: true },
  });

  return { candidates, scanLogId: log.id };
}
```

- [ ] **Step 5: Rodar testes**

Os testes ainda vão falhar porque a ROTA não existe. A Task 3 adiciona a rota. Pulei direto para o commit do service para manter tasks focadas.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/cover-scan/cover-recognize.service.ts apps/api/src/__tests__/cover-scan/cover-recognize.test.ts
git commit -m "$(cat <<'EOF'
feat(cover-scan): service recognizeFromImage usando Workers AI

Service orquestra: chama Llama Vision (cloudflare-ai client),
parseia metadados, enriquece tokens (title + series + authors
+ publisher + ocr_text), reusa logica de busca textual da
Fase 1 com candidateNumber vindo do VLM (issue_number).

Testes (5) cobrem: 401 sem auth, 400 com input invalido, fluxo
feliz com candidato no catalogo, output vazio quando VLM nao
identifica, persistencia do raw_response em cover_scan_logs.

Workers AI eh mockado via vi.mock no teste — chamada real
nunca acontece em CI.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Adicionar rota `POST /recognize`

**Files:**
- Modify: `apps/api/src/modules/cover-scan/cover-scan.routes.ts`

- [ ] **Step 1: Adicionar import e rota**

Em `apps/api/src/modules/cover-scan/cover-scan.routes.ts`, adicione no topo (junto aos imports existentes do `@comicstrunk/contracts`):

```typescript
import { coverScanRecognizeSchema } from '@comicstrunk/contracts';
import type { CoverScanRecognizeInput } from '@comicstrunk/contracts';
import * as coverRecognizeService from './cover-recognize.service';
```

Adicione a rota antes do `export const coverScanRoutes`:

```typescript
router.post(
  '/recognize',
  authenticate,
  validate(coverScanRecognizeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CoverScanRecognizeInput;
      const result = await coverRecognizeService.recognizeFromImage(req.user!.userId, input);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);
```

- [ ] **Step 2: Rodar testes**

```bash
corepack pnpm --filter api test -- cover-recognize
```

Esperado: **5 testes passam** (todos os da Task 2).

Também rodar os testes da Fase 1 pra garantir que não quebrou nada:

```bash
corepack pnpm --filter api test -- cover-scan
```

Esperado: 5+5 = 10 tests passing (5 da Fase 1, 5 desta task).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/cover-scan/cover-scan.routes.ts
git commit -m "$(cat <<'EOF'
feat(cover-scan): mount POST /recognize route

Reusa middleware authenticate + validate. Endpoint /search
da Fase 1 fica intacto como fallback caso Workers AI esteja
indisponivel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Frontend — helper de compressão de imagem

**Files:**
- Create: `apps/web/src/lib/utils/compress-image.ts`

**Contexto:** Comprime um `File` (foto do usuário) para JPEG max 800px de largura, qualidade 80, e devolve um data URI base64. Roda no browser via Canvas API. Sem dependência nova.

- [ ] **Step 1: Criar o helper**

Crie `apps/web/src/lib/utils/compress-image.ts`:

```typescript
const MAX_WIDTH = 800;
const JPEG_QUALITY = 0.8;

/**
 * Comprime um File de imagem para JPEG max 800px de largura, qualidade 80,
 * e retorna data URI base64. Mantem aspecto. Funciona em qualquer formato
 * de entrada que o browser saiba decodificar (jpg, png, webp, heic em iOS Safari).
 */
export async function compressImageToDataUri(file: File): Promise<string> {
  // Caminho rapido: se ja for jpeg < 800px e < 200KB, devolve direto
  // (evita re-compressao inutil)
  if (file.type === 'image/jpeg' && file.size < 200_000) {
    const meta = await readImageMeta(file);
    if (meta.width <= MAX_WIDTH) {
      return await fileToDataUri(file);
    }
  }

  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_WIDTH / bitmap.width);
  const targetW = Math.round(bitmap.width * ratio);
  const targetH = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob retornou null'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

  return await blobToDataUri(blob);
}

async function readImageMeta(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const out = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return out;
}

function fileToDataUri(file: File): Promise<string> {
  return blobToDataUri(file);
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}
```

- [ ] **Step 2: Verificar tipos**

```bash
corepack pnpm --filter web type-check
```

Esperado: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/utils/compress-image.ts
git commit -m "$(cat <<'EOF'
feat(web): helper compressImageToDataUri (Canvas API)

Comprime File de imagem para JPEG max 800px, quality 80,
devolve data URI base64. Caminho rapido se ja for JPEG
pequeno. Sem dependencia nova — usa createImageBitmap +
Canvas + FileReader (suporte universal em browsers modernos).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Frontend — migrar `CoverPhotoScanner` para usar `/recognize`

**Files:**
- Modify: `apps/web/src/lib/api/cover-scan.ts`
- Modify: `apps/web/src/components/features/catalog/cover-photo-scanner.tsx`
- Modify: `apps/web/src/messages/pt-BR.json`
- Modify: `apps/web/package.json` (remover `tesseract.js` via pnpm)

- [ ] **Step 1: Adicionar função `recognize` no cliente**

Em `apps/web/src/lib/api/cover-scan.ts`, adicione:

```typescript
import type {
  CoverScanRecognizeInput,
  CoverScanRecognizeResponse,
} from '@comicstrunk/contracts';

export async function recognize(
  input: CoverScanRecognizeInput,
): Promise<CoverScanRecognizeResponse> {
  const { data } = await apiClient.post('/cover-scan/recognize', input);
  return data.data;
}
```

(Mantenha a função `searchByText` que existe — não delete; ela serve como fallback no componente.)

- [ ] **Step 2: Reescrever o componente**

Substitua o conteúdo de `apps/web/src/components/features/catalog/cover-photo-scanner.tsx` por:

```tsx
'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import { recognize, recordChoice } from '@/lib/api/cover-scan';
import { compressImageToDataUri } from '@/lib/utils/compress-image';
import type { CoverScanCandidate } from '@comicstrunk/contracts';

type Stage = 'idle' | 'compressing' | 'analyzing' | 'searching' | 'results' | 'error';

interface Props {
  onChoose?: (candidate: CoverScanCandidate) => void;
  onClose?: () => void;
}

export function CoverPhotoScanner({ onChoose, onClose }: Props) {
  const t = useTranslations('scanCapa');
  const [stage, setStage] = useState<Stage>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CoverScanCandidate[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [scanLogId, setScanLogId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startedAtRef = useRef<number>(0);

  async function handleFile(file: File) {
    setStage('compressing');
    setPreviewUrl(URL.createObjectURL(file));
    startedAtRef.current = Date.now();

    try {
      const dataUri = await compressImageToDataUri(file);
      setStage('analyzing');

      const result = await recognize({
        imageBase64: dataUri,
        durationMs: Date.now() - startedAtRef.current,
      });

      setCandidates(result.candidates);
      setScanLogId(result.scanLogId);
      setStage('results');
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        setErrorMsg(t('rateLimitMessage'));
      } else if (status && status >= 500) {
        setErrorMsg(t('errorServer'));
      } else {
        const msg = err instanceof Error ? err.message : 'unknown';
        setErrorMsg(msg);
      }
      setStage('error');
    }
  }

  async function handleChoose(candidate: CoverScanCandidate | null) {
    if (scanLogId) {
      try {
        await recordChoice({ scanLogId, chosenEntryId: candidate?.id ?? null });
      } catch {
        // telemetria — falha silenciosa
      }
    }
    if (candidate) onChoose?.(candidate);
  }

  function reset() {
    setStage('idle');
    setPreviewUrl(null);
    setCandidates([]);
    setErrorMsg('');
    setScanLogId('');
  }

  return (
    <div className="space-y-4">
      {stage === 'idle' && (
        <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8">
          <p className="text-sm text-muted-foreground">{t('uploadHint')}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()}>{t('chooseFile')}</Button>
        </div>
      )}

      {(stage === 'compressing' || stage === 'analyzing' || stage === 'searching') && (
        <div className="flex flex-col items-center gap-3">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={t('preview')}
              width={200}
              height={300}
              className="rounded border object-contain"
            />
          )}
          <p className="text-sm text-muted-foreground">
            {stage === 'compressing'
              ? t('compressing')
              : stage === 'analyzing'
                ? t('analyzing')
                : t('searching')}
          </p>
        </div>
      )}

      {stage === 'results' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('foundCount', { count: candidates.length })}
            </p>
            <Button variant="ghost" size="sm" onClick={reset}>
              {t('tryAgain')}
            </Button>
          </div>

          {candidates.length === 0 ? (
            <p className="rounded border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
              {t('noMatches')}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => handleChoose(c)}
                    className="block w-full rounded border bg-card p-2 text-left hover:border-primary"
                  >
                    <div className="aspect-[2/3] w-full overflow-hidden rounded">
                      <CoverImage
                        src={c.coverImageUrl}
                        alt={c.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs font-medium">{c.title}</p>
                    {c.publisher && (
                      <p className="text-xs text-muted-foreground">{c.publisher}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button variant="outline" onClick={() => handleChoose(null)} className="w-full">
            {t('noneMatch')}
          </Button>
        </div>
      )}

      {stage === 'error' && (
        <div className="space-y-3">
          <p className="rounded border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {errorMsg || t('errorGeneric')}
          </p>
          <Button onClick={reset} className="w-full">
            {t('tryAgain')}
          </Button>
        </div>
      )}

      {onClose &&
        stage !== 'compressing' &&
        stage !== 'analyzing' &&
        stage !== 'searching' && (
          <Button variant="ghost" onClick={onClose} className="w-full">
            {t('close')}
          </Button>
        )}
    </div>
  );
}
```

- [ ] **Step 3: Atualizar traduções**

Em `apps/web/src/messages/pt-BR.json`, no namespace `scanCapa`, **substitua** as chaves `reading` e `searching` por:

```json
    "compressing": "Preparando imagem...",
    "analyzing": "Analisando capa com IA...",
    "searching": "Procurando no catálogo...",
    "errorServer": "Servidor de IA temporariamente indisponível. Tente novamente em alguns segundos.",
```

(Mantém todas as outras chaves intactas. Adicione `errorServer` no fim, antes da `}` que fecha o namespace `scanCapa`. **NÃO REMOVA** `reading` se outro componente ainda usar; a busca abaixo confirma.)

```bash
grep -rn "scanCapa.reading\|t('reading')" apps/web/src --include="*.tsx" --include="*.ts"
```

Se nada for retornado, pode remover `"reading"` do JSON. Senão, mantenha.

- [ ] **Step 4: Remover dependência do tesseract.js**

```bash
corepack pnpm --filter web remove tesseract.js
```

- [ ] **Step 5: Verificar tipos e lint**

```bash
corepack pnpm --filter web type-check
corepack pnpm --filter web lint 2>&1 | grep -E "cover-photo-scanner|compress-image|cover-scan" | head -20
```

Esperado: type-check passa; lint dos arquivos novos limpo.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api/cover-scan.ts apps/web/src/components/features/catalog/cover-photo-scanner.tsx apps/web/src/messages/pt-BR.json apps/web/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(web): scanner agora usa /recognize (Llama Vision)

CoverPhotoScanner deixa de rodar Tesseract.js no browser e
passa a comprimir a imagem (Canvas API) e enviar pro endpoint
/cover-scan/recognize, que usa Llama 3.2 Vision via Cloudflare
Workers AI. UX igual; estagios renomeados (compressing,
analyzing, searching). Tesseract.js removido das dependencias.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Verificação final + smoke test

**Files:** nenhum.

- [ ] **Step 1: Tests do API completos**

```bash
corepack pnpm --filter api test -- cover-scan cover-recognize
```

Esperado: 10 tests passing (5 da Fase 1 + 5 da Fase 2).

- [ ] **Step 2: Type-check global**

```bash
corepack pnpm --filter contracts build
corepack pnpm --filter api type-check
corepack pnpm --filter web type-check
```

Esperado: tudo passa.

- [ ] **Step 3: Lint dos arquivos novos**

```bash
corepack pnpm --filter web lint 2>&1 | grep -iE "cover-photo|compress-image|cover-scan"
```

Esperado: vazio (sem warnings/errors).

- [ ] **Step 4: Smoke test manual (Fernando roda em browser)**

Documente um bloco para o Fernando seguir:

```
1. Garanta que apps/api/.env tem CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN setados.
2. Suba API: corepack pnpm --filter api dev
3. Suba Web: corepack pnpm --filter web dev (em outro terminal)
4. Login em http://localhost:3000/pt-BR como vai_q_eh@yahoo.com.br / Ct@2026!Teste
5. Acessar /pt-BR/scan-capa
6. Enviar a foto do Transmetropolitan (ou qualquer capa) que falhou na Fase 1
7. Confirmar fluxo: "Preparando imagem..." -> "Analisando capa com IA..." -> "Procurando no catalogo..." -> grid de candidatos
8. Confirmar que candidatos sao relevantes (nao mais "tudo com SIN")
9. Verificar logs:
   docker exec comicstrunk-mysql mysql -uroot -padmin comicstrunk \
     -e "SELECT id, raw_text, ocr_tokens, candidate_number, JSON_LENGTH(candidates_shown), created_at FROM cover_scan_logs ORDER BY created_at DESC LIMIT 3 \\G"
   raw_text deve conter o JSON do Llama Vision (com title, publisher etc).
10. Testar integracao: /pt-BR/collection/add → icone de camera → mesmo fluxo.
11. (Opcional) Testar erro: matar a API, tentar scan, verificar mensagem de erro amigavel.
```

- [ ] **Step 5: Sem commit nesta task** (se descobrir bug pequeno, comente como concern e passa pro Fernando decidir).

---

## Self-Review

**Spec coverage (seção 3.2 da spec atualizada):**
- ✅ Cliente Workers AI (Task 1) — `cloudflare-ai.ts`
- ✅ Endpoint `POST /recognize` (Task 3) — em `cover-scan.routes.ts`
- ✅ Compressão e base64 no cliente (Task 4) — `compress-image.ts`
- ✅ Reuso da busca textual e logging em `cover_scan_logs` (Task 2) — `recognizeFromImage`
- ✅ Endpoint `/search` da Fase 1 mantido como fallback (intacto, não alterado)
- ✅ Rate limit reaproveitado (Task 2 — `assertWithinDailyLimit`)
- ✅ Frontend leve, sem Tesseract (Task 5)
- ✅ Variáveis env documentadas (Task 1, step 3)

**Placeholder scan:** sem TBD/TODO. Cada step tem código completo.

**Type consistency:**
- `CoverScanRecognizeInput` definido em contracts (Task 1) → usado em `recognizeFromImage` (Task 2) → usado na rota (Task 3) → usado no cliente HTTP (Task 5).
- `RecognizedCover` interface em `cloudflare-ai.ts` (Task 1) → consumida em `recognizeFromImage` (Task 2). Campos batem.
- `CoverScanRecognizeResponse = CoverScanSearchResponse` (alias) — back compat com cliente HTTP que já espera `{ candidates, scanLogId }`.

**Edge cases cobertos:**
- VLM retorna JSON com markdown (` ```json ... ``` `) → `extractJson` (Task 1).
- VLM retorna texto extra antes/depois do JSON → fallback `firstBrace..lastBrace`.
- VLM falha (rede, 5xx, model unavailable) → `InternalError` (Task 1) → 500 pro cliente → mensagem amigável `errorServer` (Task 5).
- Imagem inválida no cliente → erro do `compressImageToDataUri` → mensagem genérica `errorGeneric`.
- Rate limit excedido → 429 → mensagem `rateLimitMessage` (já existia da Fase 1).

---

## Execution Handoff

**Plan complete.** Salvo em [docs/superpowers/plans/2026-04-27-scan-capa-fase-2.md](docs/superpowers/plans/2026-04-27-scan-capa-fase-2.md).

Duas opções de execução:

**1. Subagent-Driven (recomendado)** — Despacho um subagent fresco por task, com review entre tasks.

**2. Inline Execution** — Executo aqui no mesmo session com checkpoints.

Qual prefere? (Sugestão: continuar com Subagent-Driven que estávamos usando na Fase 1.)
