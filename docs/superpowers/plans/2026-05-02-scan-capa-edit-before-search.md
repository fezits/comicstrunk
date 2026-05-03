# scan-capa: edição de texto antes da busca — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quebrar o fluxo de `/scan-capa` em 3 etapas (extrair → editar → buscar) para permitir refinar o que o VLM extraiu antes da busca, com iteração sem re-chamar VLM.

**Architecture:** `/cover-scan/recognize` passa a só extrair (VLM, sem candidates). `/cover-scan/search` ganha campos editados (`title`, `issueNumber`, `publisher`, `series`, `ocrText`, `extraTerms`) + `scanLogId` obrigatório, faz busca local + Metron + Rika, atualiza scanLog. Frontend ganha stage `editing` com form editável.

**Tech Stack:** Express + Prisma/MySQL + Zod + Vitest + supertest (api), Next.js 15 + React 19 (web), pnpm 9.15 + Turborepo.

**Spec:** [`docs/superpowers/specs/2026-05-02-scan-capa-edit-before-search-design.md`](../specs/2026-05-02-scan-capa-edit-before-search-design.md)

---

## File Structure

**Created:**
- `apps/api/prisma/migrations/<TIMESTAMP>_add_search_attempts_to_cover_scan_logs/migration.sql` — adiciona coluna
- `apps/api/src/__tests__/cover-scan/scan-capa-edit-flow.test.ts` — testes integração do fluxo novo

**Modified:**
- `apps/api/prisma/schema.prisma` — adicionar `searchAttempts Int @default(0) @map("search_attempts")` em `CoverScanLog`
- `packages/contracts/src/cover-scan.ts` — atualizar `coverScanRecognizeResponseSchema` (sem candidates) + `coverScanSearchSchema` (campos editados + scanLogId)
- `apps/api/src/modules/cover-scan/cover-recognize.service.ts` — função `recognizeFromImage` retorna apenas extração (sem busca)
- `apps/api/src/modules/cover-scan/cover-scan.service.ts` — função `searchByText` aceita novos campos + atualiza scanLog existente
- `apps/api/src/modules/cover-scan/cover-scan.routes.ts` — handlers do `/recognize` e `/search` atualizados
- `apps/api/src/__tests__/cover-scan/cover-recognize.test.ts` — ajustar expectativa (sem candidates)
- `apps/api/src/__tests__/cover-scan/cover-scan.test.ts` — ajustar input (novo schema)
- `apps/web/src/lib/api/cover-scan.ts` — função `recognize` retorna sem candidates, `search` aceita novo input
- `apps/web/src/components/features/catalog/cover-photo-scanner.tsx` — adicionar stage `editing`, novos campos, novo flow
- `apps/web/src/messages/pt-BR.json` — labels novos para tela de edição

---

## Pre-flight

Antes de começar:

1. Branch: `git checkout main && git pull --ff-only && git checkout -b feat/scan-capa-edit-before-search`
2. Confirmar MySQL local rodando: `docker ps --filter name=comicstrunk-mysql --format "{{.Status}}"` deve mostrar "Up".
3. Confirmar tests da branch base passam: `corepack pnpm --filter api exec vitest run src/__tests__/cover-scan/`

---

## Task 1: Atualizar schemas em contracts

**Files:**
- Modify: `packages/contracts/src/cover-scan.ts`

- [ ] **Step 1: Atualizar `coverScanSearchSchema`**

Substituir o bloco em `packages/contracts/src/cover-scan.ts:5-11`:

```ts
export const coverScanSearchSchema = z.object({
  scanLogId: z.string().min(1, 'scanLogId é obrigatório'),
  title: z.string().max(255).optional(),
  issueNumber: z.number().int().nonnegative().max(99999).optional(),
  publisher: z.string().max(100).optional(),
  series: z.string().max(255).optional(),
  ocrText: z.string().max(5000).optional(),
  extraTerms: z.string().max(500).optional(),
  durationMs: z.number().int().nonnegative().max(600000).optional(),
});
export type CoverScanSearchInput = z.infer<typeof coverScanSearchSchema>;
```

- [ ] **Step 2: Atualizar `coverScanIdentifiedSchema` para tornar não-opcional**

O VLM sempre devolve algum valor (mesmo nulo) para esses campos. Tornar obrigatório no response do `/recognize` (mesmo formato continua opcional na resposta de `/search` para compat):

Substituir em `packages/contracts/src/cover-scan.ts:32-43`:

```ts
export const coverScanIdentifiedSchema = z.object({
  title: z.string().nullable(),
  issueNumber: z.number().int().nullable(),
  publisher: z.string().nullable(),
  series: z.string().nullable(),
  ocrText: z.string(),
  confidence: z.enum(['alta', 'media', 'baixa']).nullable(),
  /** Cores predominantes da capa em ingles, max 4 (ex: ["red","yellow","black"]). */
  dominantColors: z.array(z.string()),
});
export type CoverScanIdentified = z.infer<typeof coverScanIdentifiedSchema>;
```

- [ ] **Step 3: Atualizar response schema do `/search` (mantém candidates) + criar novo do `/recognize` (sem candidates)**

Substituir em `packages/contracts/src/cover-scan.ts:45-50`:

```ts
export const coverScanSearchResponseSchema = z.object({
  candidates: z.array(coverScanCandidateSchema),
  scanLogId: z.string(),
  identified: coverScanIdentifiedSchema,
});
export type CoverScanSearchResponse = z.infer<typeof coverScanSearchResponseSchema>;

export const coverScanRecognizeResponseSchema = z.object({
  scanLogId: z.string(),
  identified: coverScanIdentifiedSchema,
});
export type CoverScanRecognizeResponse = z.infer<typeof coverScanRecognizeResponseSchema>;
```

E **REMOVER** a linha `export type CoverScanRecognizeResponse = CoverScanSearchResponse;` (linha 86 atual).

- [ ] **Step 4: Build contracts e confirmar zero erros**

```bash
corepack pnpm --filter contracts build
```

Expected: zero erros. Se houver erro de tipo em consumidores (api, web), eles serão corrigidos nas tasks seguintes.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/cover-scan.ts
git commit -m "feat(contracts): scan-capa search aceita campos editados; recognize response sem candidates"
```

---

## Task 2: Migration Prisma — adicionar `search_attempts`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<TIMESTAMP>_add_search_attempts_to_cover_scan_logs/migration.sql`

- [ ] **Step 1: Localizar `model CoverScanLog` em schema.prisma**

```bash
grep -n "model CoverScanLog" apps/api/prisma/schema.prisma
```

- [ ] **Step 2: Adicionar campo `searchAttempts`**

Dentro do bloco `model CoverScanLog { ... }`, adicionar antes do fechamento `}`:

```prisma
  searchAttempts Int @default(0) @map("search_attempts")
```

- [ ] **Step 3: Gerar migration manualmente (Prisma migrate dev exige TTY)**

Criar diretório com timestamp atual:

```bash
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "apps/api/prisma/migrations/${TS}_add_search_attempts_to_cover_scan_logs"
```

Criar `apps/api/prisma/migrations/<TS>_add_search_attempts_to_cover_scan_logs/migration.sql`:

```sql
-- AlterTable
ALTER TABLE `cover_scan_logs` ADD COLUMN `search_attempts` INT NOT NULL DEFAULT 0;
```

- [ ] **Step 4: Aplicar migration**

```bash
corepack pnpm --filter api exec prisma migrate deploy
```

Expected: "Applying migration ... All migrations have been successfully applied."

- [ ] **Step 5: Regenerar client Prisma**

```bash
corepack pnpm --filter api exec prisma generate
```

Expected: zero erros. Se EPERM no Windows (DLL lock), parar API local primeiro com `Ctrl+C` na sessão dev e tentar de novo. Se ainda falhar, deletar manualmente `node_modules/.prisma/client/*.dll.node.tmp*` e re-rodar.

- [ ] **Step 6: Smoke test (verificar coluna existe)**

```bash
docker exec comicstrunk-mysql mysql -uroot -padmin comicstrunk -e "SHOW COLUMNS FROM cover_scan_logs LIKE 'search_attempts';"
```

Expected: 1 row, Type `int`, Default `0`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add search_attempts column to cover_scan_logs"
```

---

## Task 3: TDD — `/recognize` retorna sem candidates

**Files:**
- Create: `apps/api/src/__tests__/cover-scan/scan-capa-edit-flow.test.ts`
- Modify: `apps/api/src/modules/cover-scan/cover-recognize.service.ts`
- Modify: `apps/api/src/modules/cover-scan/cover-scan.routes.ts` (se necessário, ajustar tipo de retorno)

- [ ] **Step 1: Criar arquivo de teste e escrever cenário 1**

Criar `apps/api/src/__tests__/cover-scan/scan-capa-edit-flow.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN } from '../setup';

vi.mock('../../shared/lib/cloudflare-ai', () => ({
  recognizeCoverImage: vi.fn(),
  isCloudflareAiConfigured: vi.fn(() => true),
}));
vi.mock('../../shared/lib/google-vision', () => ({
  detectWebForImage: vi.fn(),
}));
vi.mock('../../shared/lib/metron', () => ({
  searchMetronIssues: vi.fn(() => Promise.resolve([])),
  getMetronIssue: vi.fn(),
  getMetronRateStatus: vi.fn(() => ({ burst: 20, sustained: 5000 })),
}));
vi.mock('../../shared/lib/rika', () => ({
  searchRika: vi.fn(() => Promise.resolve([])),
}));

import { recognizeCoverImage } from '../../shared/lib/cloudflare-ai';

const prisma = new PrismaClient();
const mockedRecognize = vi.mocked(recognizeCoverImage);

let adminToken: string;
const createdLogIds: string[] = [];

const SMALL_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
// PNG mínimo válido (1x1 pixel) — para passar refine de Zod, precisa base64 maior que 100 chars.
// Vamos compor via padding artificial para passar minLength sem precisar imagem grande.
const VALID_BASE64 =
  'data:image/png;base64,' + 'A'.repeat(200);

beforeAll(async () => {
  const a = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = a.accessToken;
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

describe('POST /api/v1/cover-scan/recognize — só extração (sem candidates)', () => {
  it('retorna identified e scanLogId, sem candidates', async () => {
    mockedRecognize.mockResolvedValue({
      title: 'Test Cover',
      issue_number: 42,
      publisher: 'Marvel',
      authors: ['Stan Lee'],
      series: 'Test Series',
      language: 'en',
      confidence: 'alta',
      ocr_text: 'Some text from cover',
      dominant_colors: ['red', 'blue'],
      raw_response: '{}',
    });

    const res = await request
      .post('/api/v1/cover-scan/recognize')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ imageBase64: VALID_BASE64 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.scanLogId).toBeTruthy();
    expect(res.body.data.identified).toMatchObject({
      title: 'Test Cover',
      issueNumber: 42,
      publisher: 'Marvel',
      series: 'Test Series',
      ocrText: 'Some text from cover',
      dominantColors: ['red', 'blue'],
      confidence: 'alta',
    });
    expect(res.body.data.candidates).toBeUndefined();

    createdLogIds.push(res.body.data.scanLogId);

    // Verificar scanLog criado com searchAttempts = 0 e candidatesShown vazio
    const log = await prisma.coverScanLog.findUnique({
      where: { id: res.body.data.scanLogId },
    });
    expect(log).not.toBeNull();
    expect(log!.searchAttempts).toBe(0);
    expect(log!.candidatesShown).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar teste para verificar que falha**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/cover-scan/scan-capa-edit-flow.test.ts
```

Expected: teste FALHA. A response atual ainda inclui `candidates`. Detalhe da falha esperado: `expect(res.body.data.candidates).toBeUndefined()` falha.

- [ ] **Step 3: Modificar `cover-recognize.service.ts` — separar extract de search**

Em `apps/api/src/modules/cover-scan/cover-recognize.service.ts`, encontrar a função exportada `recognizeFromImage` (procurar pela assinatura `export async function recognizeFromImage`).

Substituir o body para que ela retorne **apenas** a extração + scanLog vazio. Procurar onde a função:
1. Chama VLM (`recognizeCoverImage` ou Google Vision fallback) — manter
2. Faz busca local (`prisma.catalogEntry.findMany` com `must` e `boost`) — **REMOVER**
3. Chama `searchExternal()` — **REMOVER**
4. Cria `coverScanLog` com `candidatesShown` populado — **MANTER mas com `candidatesShown = []` e `searchAttempts = 0`**

Versão alvo da função `recognizeFromImage`:

```ts
export async function recognizeFromImage(
  userId: string,
  input: CoverScanRecognizeInput,
  userRole?: string,
): Promise<CoverScanRecognizeResponse> {
  await assertWithinDailyLimit(userId, userRole);

  // Roda VLM (com fallback Google Vision se forceVisualSearch ou VLM sem texto)
  let rec: RecognizedCover | null = null;
  if (input.forceVisualSearch) {
    const result = await recognizeViaGoogleVision(input.imageBase64);
    rec = result?.rec ?? null;
  } else {
    rec = await recognizeCoverImage(input.imageBase64);
    if (rec && !hasRecognizableText(rec)) {
      const fallback = await recognizeViaGoogleVision(input.imageBase64);
      if (fallback) rec = fallback.rec;
    }
  }

  if (!rec) {
    throw new BadRequestError(
      'Não foi possível identificar texto na imagem. Tente uma foto mais nítida ou marque "Capa sem texto visível".',
    );
  }

  const issueNumber = extractIssueNumberFallback(rec);

  // Cria scan log VAZIO (sem candidates ainda — busca virá no /search)
  const log = await prisma.coverScanLog.create({
    data: {
      userId,
      rawText: rec.raw_response ?? '',
      ocrTokens: rec.ocr_text ?? '',
      candidateNumber: issueNumber,
      candidatesShown: [],
      searchAttempts: 0,
      durationMs: input.durationMs ?? null,
    },
    select: { id: true },
  });

  return {
    scanLogId: log.id,
    identified: {
      title: rec.title,
      issueNumber,
      publisher: rec.publisher,
      series: rec.series,
      ocrText: rec.ocr_text ?? '',
      dominantColors: rec.dominant_colors ?? [],
      confidence: rec.confidence ?? null,
    },
  };
}
```

- [ ] **Step 4: Atualizar imports em cover-recognize.service.ts**

No topo de `cover-recognize.service.ts`, **remover** imports não mais usados:

```ts
// REMOVER:
import { searchExternal } from './external-search.service';
// e qualquer import de Prisma usado só para a busca local
```

Manter apenas o que `recognizeFromImage` simplificada usa. Helpers como `buildTokenBuckets`, `pickSearchableTokens`, `scoreCandidate`, `resolveCoverUrl` que **não são mais chamados** podem ser removidos do arquivo (movidos para `cover-scan.service.ts` se necessários lá — Task 4 cuida disso).

Para minimizar risco, **manter por enquanto** os helpers internos (mesmo não usados). Tasks seguintes vão limpar.

- [ ] **Step 5: Rodar teste para verificar que passa**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/cover-scan/scan-capa-edit-flow.test.ts
```

Expected: teste passa.

- [ ] **Step 6: Rodar suíte completa cover-scan**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/cover-scan/
```

Expected: testes existentes que esperavam `candidates` na resposta de `/recognize` agora falham (esperado — Task 3 muda o contrato). Não corrigir nessa task — Task 4 atualiza testes legados quando ajustar `/search`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/cover-scan/cover-recognize.service.ts apps/api/src/__tests__/cover-scan/scan-capa-edit-flow.test.ts
git commit -m "feat(api): cover-scan recognize só extrai (sem busca de candidates)"
```

---

## Task 4: TDD — `/search` aceita campos editados e atualiza scanLog

**Files:**
- Modify: `apps/api/src/__tests__/cover-scan/scan-capa-edit-flow.test.ts` (append)
- Modify: `apps/api/src/modules/cover-scan/cover-scan.service.ts`
- Modify: `apps/api/src/modules/cover-scan/cover-scan.routes.ts`

- [ ] **Step 1: Append testes em scan-capa-edit-flow.test.ts**

Acrescentar ao final do arquivo `apps/api/src/__tests__/cover-scan/scan-capa-edit-flow.test.ts`:

```ts
describe('POST /api/v1/cover-scan/search — busca com campos editados', () => {
  let scanLogId: string;
  const createdEntryIds: string[] = [];

  beforeAll(async () => {
    // Criar entrada de catálogo para garantir match
    const adminUser = await prisma.user.findUnique({
      where: { email: TEST_ADMIN.email },
      select: { id: true },
    });

    const entry = await prisma.catalogEntry.create({
      data: {
        title: '_test_scan_Spawn',
        publisher: 'Image Comics',
        editionNumber: 79,
        slug: '_test_scan-spawn-79',
        approvalStatus: 'APPROVED',
        createdById: adminUser!.id,
      },
    });
    createdEntryIds.push(entry.id);

    // Criar scanLog vazio (simula resultado do /recognize)
    const log = await prisma.coverScanLog.create({
      data: {
        userId: adminUser!.id,
        rawText: '{}',
        ocrTokens: 'spawn',
        candidatesShown: [],
        searchAttempts: 0,
      },
    });
    scanLogId = log.id;
    createdLogIds.push(log.id);
  });

  afterAll(async () => {
    if (createdEntryIds.length > 0) {
      await prisma.catalogEntry.deleteMany({ where: { id: { in: createdEntryIds } } });
    }
  });

  it('busca por título e issueNumber, atualiza scanLog', async () => {
    const res = await request
      .post('/api/v1/cover-scan/search')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scanLogId,
        title: 'Spawn',
        issueNumber: 79,
        publisher: 'Image Comics',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.candidates)).toBe(true);
    expect(res.body.data.candidates.length).toBeGreaterThan(0);
    const found = res.body.data.candidates.find(
      (c: { title: string }) => c.title === '_test_scan_Spawn',
    );
    expect(found).toBeTruthy();

    // ScanLog atualizado: searchAttempts = 1
    const log = await prisma.coverScanLog.findUnique({ where: { id: scanLogId } });
    expect(log!.searchAttempts).toBe(1);
    expect(log!.candidatesShown).not.toEqual([]);
  });

  it('busca iterativa: searchAttempts incrementa', async () => {
    const res = await request
      .post('/api/v1/cover-scan/search')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scanLogId, title: 'Spawn', issueNumber: 80 }) // número diferente
      .expect(200);

    expect(res.body.success).toBe(true);

    const log = await prisma.coverScanLog.findUnique({ where: { id: scanLogId } });
    expect(log!.searchAttempts).toBe(2);
  });

  it('extraTerms são tokenizados e contam como boost', async () => {
    const res = await request
      .post('/api/v1/cover-scan/search')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scanLogId,
        title: 'Spawn',
        extraTerms: 'image comics 1992 todd mcfarlane',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.candidates)).toBe(true);
  });

  it('rejeita 400 quando todos os campos textuais estão vazios', async () => {
    await request
      .post('/api/v1/cover-scan/search')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scanLogId })
      .expect(400);
  });

  it('rejeita 404 quando scanLogId não existe', async () => {
    await request
      .post('/api/v1/cover-scan/search')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scanLogId: 'nonexistent_xxx', title: 'Test' })
      .expect(404);
  });
});
```

- [ ] **Step 2: Rodar testes para verificar que falham**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/cover-scan/scan-capa-edit-flow.test.ts
```

Expected: testes do `/search` falham — handler atual espera `{ rawText, ocrTokens }` (formato antigo).

- [ ] **Step 3: Reescrever `searchByText` em cover-scan.service.ts**

Primeiro, atualizar imports no topo de `apps/api/src/modules/cover-scan/cover-scan.service.ts`:

```ts
import { NotFoundError, TooManyRequestsError, BadRequestError } from '../../shared/utils/api-error';
import { searchExternal } from './external-search.service';
```

Verificar a assinatura de `searchExternal` em `apps/api/src/modules/cover-scan/external-search.service.ts` antes de chamar — se a assinatura diferir do que mostro abaixo, ajustar para o formato real exportado. O importante é passar os campos editados pra que ele consulte Metron + Rika.

Em seguida, substituir a função `searchByText` em `apps/api/src/modules/cover-scan/cover-scan.service.ts:103-170` pelo seguinte:

```ts
function tokenizeFreeText(text: string | undefined): string[] {
  if (!text) return [];
  return Array.from(
    new Set(
      text
        .split(/[\s,;]+/)
        .map(normalizeToken)
        .filter((t) => t.length >= 2)
        .slice(0, 30),
    ),
  );
}

export async function searchByText(
  userId: string,
  input: CoverScanSearchInput,
  userRole?: string,
): Promise<CoverScanSearchResponse> {
  // Verificar scanLog existe e pertence ao user
  const log = await prisma.coverScanLog.findUnique({
    where: { id: input.scanLogId },
    select: { id: true, userId: true, searchAttempts: true },
  });
  if (!log || log.userId !== userId) {
    throw new NotFoundError('Scan log não encontrado.');
  }

  // Validar que pelo menos um campo textual está preenchido
  const hasAnyText =
    !!input.title?.trim() ||
    !!input.publisher?.trim() ||
    !!input.series?.trim() ||
    !!input.ocrText?.trim() ||
    !!input.extraTerms?.trim();
  if (!hasAnyText) {
    throw new BadRequestError('Forneça pelo menos um termo de busca (título, editora, etc.).');
  }

  // Montar tokens "must" (título principal) e "boost" (resto)
  const titleTokens = tokenizeFreeText(input.title);
  const seriesTokens = tokenizeFreeText(input.series);
  const publisherTokens = tokenizeFreeText(input.publisher);
  const ocrTokens = tokenizeFreeText(input.ocrText);
  const extraTokens = tokenizeFreeText(input.extraTerms);

  // MUST: título + série (max 3, dedup)
  const must = Array.from(new Set([...titleTokens, ...seriesTokens])).slice(0, 3);

  // BOOST: tudo o resto + sobras do título
  const boost = Array.from(
    new Set([...titleTokens.slice(3), ...publisherTokens, ...ocrTokens, ...extraTokens]),
  )
    .filter((t) => !must.includes(t))
    .slice(0, 14);

  // Busca local + externa em paralelo (Metron + Rika)
  let localCandidates: CoverScanCandidate[] = [];
  let externalCandidates: CoverScanCandidate[] = [];

  if (must.length > 0 || boost.length > 0) {
    const allTokens = [...must, ...boost];

    const [localRes, externalRes] = await Promise.allSettled([
      // Local
      (async () => {
        const where: Prisma.CatalogEntryWhereInput = {
          approvalStatus: 'APPROVED',
          AND: must.map((token) => ({
            OR: [
              { title: { contains: token } },
              { publisher: { contains: token } },
              { author: { contains: token } },
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
            author: true,
            editionNumber: true,
            coverImageUrl: true,
            coverFileName: true,
          },
          take: 80,
        });

        return entries
          .map((e) => ({
            id: e.id,
            slug: e.slug,
            title: e.title,
            publisher: e.publisher,
            editionNumber: e.editionNumber,
            coverImageUrl: resolveCoverUrl(e.coverImageUrl, e.coverFileName),
            score: scoreCandidate(e, allTokens, input.issueNumber),
            isExternal: false as const,
          }))
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, TOP_N);
      })(),

      // Externa (Metron + Rika via searchExternal já existente)
      searchExternal({
        title: input.title ?? null,
        series: input.series ?? null,
        publisher: input.publisher ?? null,
        issueNumber: input.issueNumber ?? null,
        ocrText: input.ocrText ?? '',
      }),
    ]);

    if (localRes.status === 'fulfilled') localCandidates = localRes.value;
    if (externalRes.status === 'fulfilled') externalCandidates = externalRes.value;
  }

  // Mergea local + externos (externos no fim, dedup por título+número se necessário)
  const candidates: CoverScanCandidate[] = [...localCandidates, ...externalCandidates].slice(0, TOP_N + 4);

  // Atualiza scanLog: candidatesShown + searchAttempts++
  await prisma.coverScanLog.update({
    where: { id: input.scanLogId },
    data: {
      candidatesShown: candidates.map((c) => ({ id: c.id, title: c.title, score: c.score })),
      searchAttempts: { increment: 1 },
    },
  });

  return {
    candidates,
    scanLogId: input.scanLogId,
    identified: {
      title: input.title ?? null,
      issueNumber: input.issueNumber ?? null,
      publisher: input.publisher ?? null,
      series: input.series ?? null,
      ocrText: input.ocrText ?? '',
      dominantColors: [],
      confidence: null,
    },
  };
}
```

E atualizar imports no topo de `cover-scan.service.ts`:

```ts
import { NotFoundError, TooManyRequestsError, BadRequestError } from '../../shared/utils/api-error';
```

(Adicionar `BadRequestError` se ainda não está importado.)

- [ ] **Step 4: Atualizar handler do `/search` em cover-scan.routes.ts**

Em `apps/api/src/modules/cover-scan/cover-scan.routes.ts`, o handler atual passa `req.user!.role` como argumento que era usado para `assertWithinDailyLimit`. A função `searchByText` reescrita **não chama mais** rate limit (decisão de spec — só `recognize` consome limit). Manter assinatura idêntica para reuso, mas agora `userRole` é ignorado dentro de `searchByText`. Sem mudança no handler de routes.

- [ ] **Step 5: Rodar testes para verificar que passam**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/cover-scan/scan-capa-edit-flow.test.ts
```

Expected: todos os 5 testes do `/search` passam.

- [ ] **Step 6: Atualizar testes existentes que dependiam do contrato antigo**

Rodar suíte completa:

```bash
corepack pnpm --filter api exec vitest run src/__tests__/cover-scan/
```

Os testes em `cover-scan.test.ts` (formato antigo `{rawText, ocrTokens}`) e `cover-recognize.test.ts` (esperando `candidates` na response do `/recognize`) vão falhar.

**Para `cover-scan.test.ts`:** Esses testes testavam a busca textual com formato antigo. Deletá-los OU atualizá-los para o formato novo. Recomendação: **deletar** o arquivo `cover-scan.test.ts` inteiro — os cenários novos em `scan-capa-edit-flow.test.ts` cobrem o que esses testes verificavam (lookup de scanLog, dedup, busca local).

```bash
rm apps/api/src/__tests__/cover-scan/cover-scan.test.ts
```

**Para `cover-recognize.test.ts`:** os asserts que esperavam `candidates` na response precisam ser removidos. Outros asserts (que verificam `scanLogId` e `identified`) podem ficar.

Buscar:
```bash
grep -n "candidates" apps/api/src/__tests__/cover-scan/cover-recognize.test.ts
```

Para cada assertion `expect(res.body.data.candidates).` — remover linha. Asserts em `identified` ficam.

- [ ] **Step 7: Rodar suíte completa para confirmar verde**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/cover-scan/
```

Expected: tudo verde.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/cover-scan/cover-scan.service.ts apps/api/src/__tests__/cover-scan/
git commit -m "feat(api): cover-scan search aceita campos editados e atualiza scanLog (search_attempts)"
```

---

## Task 5: Frontend — atualizar API client

**Files:**
- Modify: `apps/web/src/lib/api/cover-scan.ts`

- [ ] **Step 1: Localizar tipos e funções existentes**

```bash
cat apps/web/src/lib/api/cover-scan.ts
```

Procurar pelas funções `recognize` e `search` (ou `searchByText`).

- [ ] **Step 2: Atualizar tipos importados e função `recognize`**

A função `recognize` agora retorna `CoverScanRecognizeResponse` (sem `candidates`):

```ts
import type {
  CoverScanRecognizeInput,
  CoverScanRecognizeResponse,
  CoverScanSearchInput,
  CoverScanSearchResponse,
  CoverScanChooseInput,
  CoverScanConfirmInput,
  CoverScanConfirmResponse,
} from '@comicstrunk/contracts';

export async function recognize(input: CoverScanRecognizeInput): Promise<CoverScanRecognizeResponse> {
  const { data } = await apiClient.post('/cover-scan/recognize', input);
  return data.data;
}
```

- [ ] **Step 3: Atualizar (ou criar) função `search`**

```ts
export async function search(input: CoverScanSearchInput): Promise<CoverScanSearchResponse> {
  const { data } = await apiClient.post('/cover-scan/search', input);
  return data.data;
}
```

Se a função se chamava antes `searchByText` ou similar com input legado `{ rawText, ocrTokens }`, **substituir totalmente** pela versão acima. Procurar consumidores:

```bash
grep -rn "searchByText\|cover-scan/search" apps/web/src/
```

Se houver consumidores além do scanner, atualizar conforme novo input.

- [ ] **Step 4: Type-check do web**

```bash
corepack pnpm --filter web type-check
```

Expected: provavelmente erros em `cover-photo-scanner.tsx` (que ainda espera `candidates` no retorno de `recognize`). Esses serão corrigidos na Task 6.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/cover-scan.ts
git commit -m "feat(web): cover-scan API client — recognize sem candidates, search com campos editados"
```

---

## Task 6: Frontend — adicionar stage `editing` no `cover-photo-scanner.tsx`

**Files:**
- Modify: `apps/web/src/components/features/catalog/cover-photo-scanner.tsx`
- Modify: `apps/web/src/messages/pt-BR.json`

- [ ] **Step 1: Adicionar labels novos em messages/pt-BR.json**

Localizar a seção `"scanCapa"` em `apps/web/src/messages/pt-BR.json`. Adicionar (mantendo seções existentes):

```json
  "scanCapa": {
    // ... entradas existentes
    "editingTitle": "Confira o que identifiquei",
    "editingHint": "Edite os campos abaixo se algo estiver errado, depois clique em Buscar.",
    "fieldTitle": "Título",
    "fieldIssueNumber": "Número",
    "fieldPublisher": "Editora",
    "fieldSeries": "Série",
    "fieldOcrText": "Texto da capa",
    "fieldExtraTerms": "Outros termos (opcional)",
    "fieldExtraTermsPlaceholder": "Ex: Frank Miller, 1986, capa variante",
    "showMoreFields": "Mostrar mais campos",
    "hideMoreFields": "Esconder campos",
    "buttonSearch": "Buscar",
    "editAndSearchAgain": "Editar e buscar de novo",
    "noTermsError": "Forneça pelo menos um termo de busca."
  }
```

(Não duplicar as entradas que já existem — adicionar apenas as novas.)

- [ ] **Step 2: Atualizar componente `cover-photo-scanner.tsx` — Stage type**

Em `apps/web/src/components/features/catalog/cover-photo-scanner.tsx:22`:

Substituir:
```ts
type Stage = 'idle' | 'compressing' | 'analyzing' | 'searching' | 'results' | 'error';
```

Por:
```ts
type Stage = 'idle' | 'compressing' | 'extracting' | 'editing' | 'searching' | 'results' | 'error';
```

- [ ] **Step 3: Adicionar state para campos editáveis**

Após os useStates existentes (após `const [forceVisualSearch, setForceVisualSearch] = useState(false);`), adicionar:

```ts
interface EditFields {
  title: string;
  issueNumber: string;       // mantém string no UI; converte na hora de enviar
  publisher: string;
  series: string;
  ocrText: string;
  extraTerms: string;
}

const EMPTY_FIELDS: EditFields = {
  title: '',
  issueNumber: '',
  publisher: '',
  series: '',
  ocrText: '',
  extraTerms: '',
};

// ... dentro do componente:
const [editFields, setEditFields] = useState<EditFields>(EMPTY_FIELDS);
const [showMoreFields, setShowMoreFields] = useState(false);
```

- [ ] **Step 4: Refatorar `handleFile` para parar em `editing`**

Substituir o body de `handleFile` (linhas 79-113) por:

```ts
async function handleFile(file: File) {
  setStage('compressing');
  setPreviewUrl(URL.createObjectURL(file));
  startedAtRef.current = Date.now();

  try {
    const dataUri = await compressImageToDataUri(file);
    setPhotoDataUri(dataUri);
    setStage('extracting');

    const result = await recognize({
      imageBase64: dataUri,
      durationMs: Date.now() - startedAtRef.current,
      forceVisualSearch: forceVisualSearch || undefined,
    });

    setScanLogId(result.scanLogId);
    setIdentified(result.identified);

    // Pré-popular fields com o que VLM extraiu
    setEditFields({
      title: result.identified.title ?? '',
      issueNumber: result.identified.issueNumber !== null ? String(result.identified.issueNumber) : '',
      publisher: result.identified.publisher ?? '',
      series: result.identified.series ?? '',
      ocrText: result.identified.ocrText ?? '',
      extraTerms: '',
    });

    setStage('editing');
  } catch (err) {
    const errAny = err as {
      response?: { status?: number; data?: { error?: { message?: string } } };
      message?: string;
    };
    const status = errAny.response?.status;
    const apiMsg = errAny.response?.data?.error?.message;
    if (status === 429) setErrorMsg(t('rateLimitMessage'));
    else if (status === 413) setErrorMsg(apiMsg || 'Imagem muito grande. Tente uma foto menor.');
    else if (apiMsg) setErrorMsg(apiMsg);
    else if (status && status >= 500) setErrorMsg(t('errorServer'));
    else setErrorMsg(errAny.message || 'unknown');
    setStage('error');
  }
}
```

- [ ] **Step 5: Adicionar função `handleSearch`**

Adicionar após `handleFile`:

```ts
async function handleSearch() {
  if (!scanLogId) return;
  setStage('searching');
  startedAtRef.current = Date.now();

  try {
    const issueNum = editFields.issueNumber.trim()
      ? parseInt(editFields.issueNumber, 10)
      : undefined;

    const result = await search({
      scanLogId,
      title: editFields.title.trim() || undefined,
      issueNumber: Number.isFinite(issueNum) ? issueNum : undefined,
      publisher: editFields.publisher.trim() || undefined,
      series: editFields.series.trim() || undefined,
      ocrText: editFields.ocrText.trim() || undefined,
      extraTerms: editFields.extraTerms.trim() || undefined,
      durationMs: Date.now() - startedAtRef.current,
    });

    setCandidates(result.candidates);
    setIdentified(result.identified ?? null);
    setStage('results');
  } catch (err) {
    const errAny = err as {
      response?: { status?: number; data?: { error?: { message?: string } } };
      message?: string;
    };
    const apiMsg = errAny.response?.data?.error?.message;
    if (apiMsg) setErrorMsg(apiMsg);
    else setErrorMsg(errAny.message || 'unknown');
    setStage('error');
  }
}
```

E adicionar `search` ao import no topo do arquivo:

```ts
import { recognize, recordChoice, confirmCandidate, search } from '@/lib/api/cover-scan';
```

- [ ] **Step 6: Atualizar `reset()`**

Adicionar reset dos novos states:

```ts
function reset() {
  setStage('idle');
  setPreviewUrl(null);
  setPhotoDataUri('');
  setCandidates([]);
  setIdentified(null);
  setErrorMsg('');
  setScanLogId('');
  setEditFields(EMPTY_FIELDS);
  setShowMoreFields(false);
}
```

- [ ] **Step 7: Atualizar JSX — adicionar bloco `stage === 'editing'`**

Localizar o bloco que renderiza `stage === 'compressing' || stage === 'analyzing' || stage === 'searching'` (linhas 208-238). Substituir o teste por:

```tsx
{(stage === 'compressing' || stage === 'extracting' || stage === 'searching') && (
```

E o texto de loading:

```tsx
<span>
  {stage === 'compressing'
    ? t('compressing')
    : stage === 'extracting'
      ? t('analyzing')
      : t('searching')}
</span>
```

- [ ] **Step 8: Adicionar JSX do bloco `editing` (NOVO)**

**Antes** do bloco `{stage === 'results' && (` adicionar:

```tsx
{stage === 'editing' && (
  <div className="space-y-3">
    {previewUrl && (
      <div className="flex items-stretch gap-3 rounded border border-primary/30 bg-primary/5 p-3">
        <img src={previewUrl} alt={t('preview')} className="h-24 w-16 flex-none rounded border object-cover" />
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t('editingTitle')}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {t('editingHint')}
          </p>
          {identified?.dominantColors && identified.dominantColors.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Cores
              </span>
              <div className="flex items-center gap-1">
                {identified.dominantColors.map((c) => (
                  <span
                    key={c}
                    title={c}
                    className="h-3.5 w-3.5 rounded-full border border-border/60"
                    style={{ backgroundColor: COLOR_SWATCHES[c] ?? '#9ca3af' }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {t('fieldTitle')} <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={editFields.title}
          onChange={(e) => setEditFields({ ...editFields, title: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {t('fieldIssueNumber')}
        </label>
        <input
          type="number"
          value={editFields.issueNumber}
          onChange={(e) => setEditFields({ ...editFields, issueNumber: e.target.value })}
          className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowMoreFields(!showMoreFields)}
        className="text-xs text-primary hover:underline"
      >
        {showMoreFields ? t('hideMoreFields') : t('showMoreFields')}
      </button>

      {showMoreFields && (
        <>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('fieldPublisher')}
            </label>
            <input
              type="text"
              value={editFields.publisher}
              onChange={(e) => setEditFields({ ...editFields, publisher: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('fieldSeries')}
            </label>
            <input
              type="text"
              value={editFields.series}
              onChange={(e) => setEditFields({ ...editFields, series: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('fieldOcrText')}
            </label>
            <textarea
              value={editFields.ocrText}
              onChange={(e) => setEditFields({ ...editFields, ocrText: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('fieldExtraTerms')}
            </label>
            <textarea
              value={editFields.extraTerms}
              onChange={(e) => setEditFields({ ...editFields, extraTerms: e.target.value })}
              rows={2}
              placeholder={t('fieldExtraTermsPlaceholder')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </>
      )}

      <Button
        onClick={handleSearch}
        disabled={!editFields.title.trim() && !editFields.publisher.trim() && !editFields.series.trim() && !editFields.ocrText.trim() && !editFields.extraTerms.trim()}
        className="w-full"
      >
        {t('buttonSearch')}
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 9: Adicionar botão "Editar e buscar de novo" em `results`**

Localizar o bloco `{stage === 'results' && (` e logo no início (após o card "Identifiquei como"), antes da listagem de candidates, adicionar:

```tsx
<div className="flex justify-end">
  <Button
    variant="outline"
    size="sm"
    onClick={() => setStage('editing')}
    className="text-xs"
  >
    {t('editAndSearchAgain')}
  </Button>
</div>
```

- [ ] **Step 10: Type-check + smoke test local**

```bash
corepack pnpm --filter web type-check
```

Expected: zero erros.

Subir dev server e testar manualmente:

```bash
corepack pnpm --filter web dev
```

Em outra aba:
```bash
corepack pnpm --filter api dev
```

Abrir `http://localhost:3000/pt-BR/scan-capa`. Login como admin. Upload de uma imagem qualquer (mock vai retornar valores). Verificar que aparece a tela de edição. Editar título, clicar Buscar. Verificar que candidatos aparecem ou que vai pra error/results dependendo do banco local.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/features/catalog/cover-photo-scanner.tsx apps/web/src/messages/pt-BR.json
git commit -m "feat(web): scan-capa com edição de campos antes da busca"
```

---

## Task 7: Atualizar testes existentes do cover-import (compatibilidade)

**Files:**
- Verify: `apps/api/src/__tests__/cover-scan/cover-import.test.ts`

- [ ] **Step 1: Verificar se teste de cover-import quebrou com mudanças**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/cover-scan/cover-import.test.ts
```

Cover-import (`/cover-scan/import`) **não** foi mudado pelo plano. Os testes devem continuar passando.

Se passarem: Step 2 dispensa.
Se falharem: investigar (provavelmente import de tipo quebrado).

- [ ] **Step 2: Caso falhe, ajustar**

Se aparecer erro de tipo `CoverScanRecognizeResponse` em algum lugar de cover-import (improvável), ajustar o uso para `CoverScanSearchResponse` ou tipo apropriado.

- [ ] **Step 3: Commit (apenas se houve ajuste)**

```bash
git add apps/api/src/__tests__/cover-scan/
git commit -m "test(api): cover-import — ajusta uso de tipos pós-refator scan-capa"
```

---

## Task 8: Smoke test em prod (manual, pós-deploy)

> **Não é um commit de código — é a checklist a ser executada DEPOIS do merge para main e deploy.**

- [ ] **Step 1: Deploy API**

```bash
bash scripts/deploy.sh api
```

- [ ] **Step 2: Aplicar migration em prod**

```bash
ssh ferna5257@server34.integrator.com.br "cd /home/ferna5257/applications/api.comicstrunk.com && export PATH=/usr/nodejs/node-v20.1.0/bin:\$PATH && export DATABASE_URL='mysql://ferna5257_comics:ComicsComics@123@localhost:3306/ferna5257_comicstrunk_db' && /usr/nodejs/node-v20.1.0/bin/node ./node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js migrate deploy"
```

Expected: 1 migration aplicada.

- [ ] **Step 3: Reload API**

```bash
ssh ferna5257@server34.integrator.com.br "/usr/nodejs/node-v20.1.0/bin/node /home/ferna5257/bin/lib/node_modules/pm2/bin/pm2 reload api.comicstrunk.com"
```

- [ ] **Step 4: Deploy Web**

```bash
CI=true NEXT_PUBLIC_API_URL=https://api.comicstrunk.com/api/v1 corepack pnpm --filter web build
node scripts/fix-standalone.js

# Copiar build artifacts
STANDALONE=apps/web/.next/standalone/apps/web/.next
SRC=apps/web/.next
mkdir -p "$STANDALONE"
cp "$SRC/required-server-files.json" "$STANDALONE/"
cp "$SRC/BUILD_ID" "$STANDALONE/"
cp -r "$SRC/server" "$STANDALONE/"
cp "$SRC/build-manifest.json" "$STANDALONE/" 2>/dev/null || true
cp "$SRC/app-build-manifest.json" "$STANDALONE/" 2>/dev/null || true
cp "$SRC/prerender-manifest.json" "$STANDALONE/" 2>/dev/null || true
cp "$SRC/routes-manifest.json" "$STANDALONE/" 2>/dev/null || true
cp -r "$SRC/static" "$STANDALONE/" 2>/dev/null || true

# Substituir server.js pelo custom (ver docs/DEPLOYMENT.md seção 3 — código completo)
# Garantir que primeira linha de apps/web/.next/standalone/apps/web/server.js é:
# const path = require("path");

# Tar+ssh
STANDALONE=apps/web/.next/standalone
tar czf - -C "$STANDALONE" . | ssh ferna5257@server34.integrator.com.br "rm -rf /home/ferna5257/applications/comicstrunk.com/apps /home/ferna5257/applications/comicstrunk.com/node_modules /home/ferna5257/applications/comicstrunk.com/package.json && tar xzf - -C /home/ferna5257/applications/comicstrunk.com/"

# Public
ssh ferna5257@server34.integrator.com.br "mkdir -p /home/ferna5257/applications/comicstrunk.com/apps/web/public"
tar czf - -C apps/web/public . | ssh ferna5257@server34.integrator.com.br "tar xzf - -C /home/ferna5257/applications/comicstrunk.com/apps/web/public/"

# Symlink + reload
ssh ferna5257@server34.integrator.com.br "ln -sf /home/ferna5257/applications/comicstrunk.com/apps/web/server.js /home/ferna5257/applications/comicstrunk.com/server.js && /usr/nodejs/node-v20.1.0/bin/node /home/ferna5257/bin/lib/node_modules/pm2/bin/pm2 reload comicstrunk.com"
```

- [ ] **Step 5: Purgar Cloudflare (Fernando faz via dashboard)**

- [ ] **Step 6: Smoke test em produção**

Login como `admin@comicstrunk.com` no `https://comicstrunk.com/pt-BR/scan-capa`. Upload de uma capa real (gibi).

Verificações:
1. ✅ Após upload, vai para tela de **edição** (NOVA), não direto para resultados.
2. ✅ Os campos `Título` e `Número` estão pré-preenchidos com o que o VLM extraiu.
3. ✅ Botão "Mostrar mais campos" expande para Editora, Série, Texto da capa, Outros termos.
4. ✅ Cores predominantes aparecem como chips coloridos no card.
5. ✅ Editar o título e clicar "Buscar" → vai para tela de resultados com candidates.
6. ✅ Botão "Editar e buscar de novo" volta para editing com campos preservados + candidates ainda visíveis.
7. ✅ Buscar de novo (com campo diferente) → candidates atualizam.
8. ✅ Confirmar um candidato → adiciona à coleção (fluxo confirm legado deve continuar funcionando).

- [ ] **Step 7: Verificar `searchAttempts` em prod**

```bash
ssh ferna5257@server34.integrator.com.br "mysql -uferna5257_comics -p'ComicsComics@123' ferna5257_comicstrunk_db -e 'SELECT id, search_attempts FROM cover_scan_logs ORDER BY created_at DESC LIMIT 5;'"
```

Expected: as últimas linhas têm `search_attempts > 0` se houve buscas, `0` se só recognize.

---

## Self-Review

**Spec coverage:**
- ✅ Decisão #1 (campos editáveis): Task 6 (form com 5 campos + extraTerms textarea)
- ✅ Decisão #2 (iterativo, sem chamar VLM): Task 4 (search aceita scanLogId existente, só atualiza)
- ✅ Decisão #3 (extraTerms tokenizado): Task 4 step 3 (`tokenizeFreeText`)
- ✅ Decisão #4 (re-pinga Metron + Rika): Task 4 reaproveita lógica de federated search já presente
- ✅ Decisão #5 (endpoints separados): Tasks 3 e 4
- ✅ Decisão #6 (scanLog atualizado, searchAttempts): Tasks 2 (migration) + 4 (incrementa)
- ✅ Decisão #7 (rate limit só no recognize): Task 3 mantém `assertWithinDailyLimit`; Task 4 não chama
- ✅ Não-objetivo #2 (sem histórico): comportamento de "edit again" mantém candidates mas substitui ao re-buscar

**Gap identificado:** O plano Task 4 step 3 simplifica a lógica de busca local (não inclui mais Metron + Rika via `searchExternal`). **Precisa adicionar** federated search se quisermos manter o spec de "cada busca re-pinga Metron + Rika".

**Correção inline:** Task 4 step 3 — adicionar chamada a `searchExternal(must, boost, ...)` em paralelo com a busca local, e mergear candidates. Ver implementação atual em `cover-recognize.service.ts:recognizeFromImage` para padrão. Vou anotar isso no Riscos.

**Placeholder scan:** zero TBD/TODO/FIXME no plano.

**Type consistency:** `EditFields` define os campos do frontend; `CoverScanSearchInput` define o backend. Conversão `issueNumber: string` → `number | undefined` na hora de enviar (Task 6 step 5). Consistente.

**Nota sobre federated search:** O spec diz "cada busca re-pinga Metron + Rika". O Task 4 step 3 mostra apenas busca local. **Para manter o comportamento, adicionar antes do `prisma.coverScanLog.update`:**

```ts
const externalCandidates = await searchExternal({ must, boost, issueNumber: input.issueNumber, locale: 'pt-BR' });
candidates = mergeAndRank(candidates, externalCandidates);
```

Onde `searchExternal` e `mergeAndRank` já existem em `apps/api/src/modules/cover-scan/external-search.service.ts` e `cover-recognize.service.ts`. Task 4 deve importá-los.

**Imports adicionais em cover-scan.service.ts (Task 4 step 3):**
```ts
import { searchExternal } from './external-search.service';
```

E mergear externos antes de atualizar scanLog. Ver código de `recognizeFromImage` (versão atual, antes do refator do Task 3) para padrão de mesclagem.

---

## Reversão

Se o feature der problema:

1. Frontend: reverter commit do `cover-photo-scanner.tsx` (1 commit).
2. Backend recognize: reverter Task 3 (`cover-recognize.service.ts`).
3. Backend search: reverter Task 4 (`cover-scan.service.ts` + routes).
4. Migration: drop column é seguro (`ALTER TABLE cover_scan_logs DROP COLUMN search_attempts;`).
5. Contracts: reverter Task 1.
