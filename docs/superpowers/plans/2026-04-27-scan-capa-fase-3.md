# Busca de capa por foto — Fase 3 (busca externa) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Quando catálogo local não tem o gibi, buscar em fontes externas com licença comercial OK (Rika BR + MetronDB internacional). Usuário pode adicionar à coleção pessoal mesmo gibis externos (entry vira `PENDING` até admin aprovar para ficar público no catálogo).

**Architecture:** Endpoint `/cover-scan/recognize` (existente da Fase 2) chama VLM e busca local; em paralelo (`Promise.allSettled`) chama service novo `searchExternal` que dispara Rika + Metron. Dedup com dados estruturados elimina duplicatas. Resultado: lista única com flag `isExternal`. Frontend renderiza com borda diferenciada sutil; click em externo chama `/cover-scan/import` que cria `CatalogEntry` PENDING + adiciona à coleção do user. Mudança em `addItem` permite PENDING/DRAFT (apenas REJECTED bloqueado).

**Tech Stack:** Express + Zod + Vitest + supertest. Sem dependências novas (`fetch` nativo). HTTP Basic Auth (Metron) + scraping HTTP simples (Rika).

**Spec:** [docs/superpowers/specs/2026-04-26-busca-capa-por-foto-design.md](../specs/2026-04-26-busca-capa-por-foto-design.md) seção 3 Fase 3.

**Branch:** `feat/scan-capa-por-foto` (continua da Fase 2).

**Pré-requisitos:**
- ✅ `METRON_USERNAME` e `METRON_PASSWORD` em `apps/api/.env` (validados via curl em 2026-04-27)
- ✅ Scrapers Rika existentes em `scripts/scrape-rika*.js` (lógica reaproveitável)

---

## File Structure

### Backend (apps/api)

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `apps/api/src/modules/collection/collection.service.ts` | modificar | Linhas 117 e 193: `addItem` e `batchAddItems` aceitam `!== 'REJECTED'` em vez de `=== 'APPROVED'` |
| `apps/api/src/shared/lib/metron.ts` | criar | Cliente Metron com Basic Auth, monitoramento de rate limits, cache LRU em memória |
| `apps/api/src/shared/lib/rika.ts` | criar | Cliente Rika reaproveitando lógica dos scripts existentes |
| `apps/api/src/modules/cover-scan/external-search.service.ts` | criar | Orquestra Rika+Metron em paralelo, faz dedup contra catálogo local |
| `apps/api/src/modules/cover-scan/cover-import.service.ts` | criar | Cria entry `PENDING` a partir de candidato externo, baixa capa pra R2 |
| `apps/api/src/modules/cover-scan/cover-recognize.service.ts` | modificar | Chama `searchExternal` em paralelo com busca local |
| `apps/api/src/modules/cover-scan/cover-scan.routes.ts` | modificar | Adiciona rota `POST /import` |
| `apps/api/src/__tests__/cover-scan/external-search.test.ts` | criar | Testes do dedup e merge (com Rika/Metron mockados) |
| `apps/api/src/__tests__/cover-scan/cover-import.test.ts` | criar | Testes do import |
| `apps/api/src/__tests__/collection/collection-pending.test.ts` | criar | Verifica que addItem aceita PENDING após relax |
| `apps/api/.env.example` | modificar | Documenta `METRON_USERNAME` e `METRON_PASSWORD` |

### Contracts (packages/contracts)

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `packages/contracts/src/cover-scan.ts` | modificar | Adiciona `isExternal?: boolean` em `CoverScanCandidate`, schema `coverScanImportSchema` |

### Frontend (apps/web)

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `apps/web/src/lib/api/cover-scan.ts` | modificar | Adiciona função `importExternal(input)` |
| `apps/web/src/components/features/catalog/cover-photo-scanner.tsx` | modificar | Borda condicional para `isExternal`, handler de click distingue interno/externo |
| `apps/web/src/app/[locale]/(collector)/scan-capa/page.tsx` | modificar | Footer pequeno com "Powered by Metron" (atribuição CC BY-SA 4.0) |
| `apps/web/src/messages/pt-BR.json` | modificar | Chaves `scanCapa.poweredByMetron`, mensagens de import |

---

## Tasks

### Task 1: Relax `addItem` para permitir PENDING/DRAFT

**Files:**
- Modify: `apps/api/src/modules/collection/collection.service.ts:117` e `:193`
- Create: `apps/api/src/__tests__/collection/collection-pending.test.ts`

**Mudança comportamental isolada — commit pequeno antes da Fase 3.**

- [ ] **Step 1: Adicionar teste**

Crie `apps/api/src/__tests__/collection/collection-pending.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_USER } from '../setup';

const prisma = new PrismaClient();

let userToken: string;
let userId: string;
const createdIds: { collection: string[]; catalog: string[] } = {
  collection: [],
  catalog: [],
};

beforeAll(async () => {
  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;
  const u = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
  if (!u) throw new Error('TEST_USER nao encontrado');
  userId = u.id;
});

afterAll(async () => {
  if (createdIds.collection.length > 0) {
    await prisma.collectionItem.deleteMany({ where: { id: { in: createdIds.collection } } });
  }
  if (createdIds.catalog.length > 0) {
    await prisma.catalogEntry.deleteMany({ where: { id: { in: createdIds.catalog } } });
  }
  await prisma.$disconnect();
});

describe('addItem: PENDING permitido na coleção', () => {
  it('aceita PENDING (foi relaxado da Fase 3)', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        title: 'Test PENDING Entry',
        publisher: 'Test',
        approvalStatus: 'PENDING',
        createdById: userId,
      },
    });
    createdIds.catalog.push(entry.id);

    const res = await request
      .post('/api/v1/collection')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ catalogEntryId: entry.id, condition: 'NEW', quantity: 1 });

    expect(res.status).toBe(201);
    if (res.body.data?.id) createdIds.collection.push(res.body.data.id);
  });

  it('rejeita REJECTED', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        title: 'Test REJECTED Entry',
        publisher: 'Test',
        approvalStatus: 'REJECTED',
        createdById: userId,
      },
    });
    createdIds.catalog.push(entry.id);

    const res = await request
      .post('/api/v1/collection')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ catalogEntryId: entry.id, condition: 'NEW', quantity: 1 });

    expect(res.status).toBe(404);
  });

  it('aceita DRAFT (rascunho do user)', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        title: 'Test DRAFT Entry',
        publisher: 'Test',
        approvalStatus: 'DRAFT',
        createdById: userId,
      },
    });
    createdIds.catalog.push(entry.id);

    const res = await request
      .post('/api/v1/collection')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ catalogEntryId: entry.id, condition: 'NEW', quantity: 1 });

    expect(res.status).toBe(201);
    if (res.body.data?.id) createdIds.collection.push(res.body.data.id);
  });
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

```bash
corepack pnpm --filter api test -- collection-pending
```

Esperado: 2 testes falham (PENDING e DRAFT viram 404 com a regra atual).

- [ ] **Step 3: Aplicar relax**

Em `apps/api/src/modules/collection/collection.service.ts`, encontre linha 117:

```typescript
// ANTES:
if (!catalogEntry || catalogEntry.approvalStatus !== 'APPROVED') {
  throw new NotFoundError('Catalog entry not found or not approved');
}

// DEPOIS:
if (!catalogEntry || catalogEntry.approvalStatus === 'REJECTED') {
  throw new NotFoundError('Catalog entry not found or rejected');
}
```

Em linha 193 (batch add) — encontre o `where` que tem `approvalStatus: 'APPROVED'` e troque para `approvalStatus: { not: 'REJECTED' }`.

- [ ] **Step 4: Rodar testes**

```bash
corepack pnpm --filter api test -- collection-pending collection-crud
```

Esperado: 3 testes do collection-pending passam. Testes existentes do `collection-crud` continuam passando.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/collection/collection.service.ts apps/api/src/__tests__/collection/collection-pending.test.ts
git commit -m "$(cat <<'EOF'
feat(collection): addItem aceita PENDING e DRAFT (so REJECTED bloqueado)

Mudanca comportamental para a Fase 3 do scan-capa: usuario
pode adicionar gibis pendentes/rascunho a colecao pessoal
dele. Filtros do catalogo publico (search, listagem, series)
continuam exigindo APPROVED — catalogo publico fica limpo.

REJECTED segue bloqueado: admin disse "nao", regra mantida.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Cliente Metron

**Files:**
- Create: `apps/api/src/shared/lib/metron.ts`
- Modify: `apps/api/.env.example`

**Cliente HTTP fino com Basic Auth, monitoramento de rate limits, cache LRU em memória (TTL 1h, 500 entries).**

- [ ] **Step 1: Documentar env vars**

Em `apps/api/.env.example`, adicione no fim:

```
# MetronDB (Fase 3 scan-capa - busca externa)
# Sign-up gratuito em https://metron.cloud/accounts/signup/
# Auth via HTTP Basic. Rate limits: 20/min burst, 5000/dia sustained.
# Atribuicao "Powered by Metron" obrigatoria (CC BY-SA 4.0).
METRON_USERNAME=
METRON_PASSWORD=
```

- [ ] **Step 2: Criar cliente**

Crie `apps/api/src/shared/lib/metron.ts`:

```typescript
/**
 * Cliente fino do MetronDB (https://metron.cloud).
 *
 * - HTTP Basic Auth (METRON_USERNAME / METRON_PASSWORD)
 * - Rate limit: 20/min burst, 5000/dia sustained. Headers expostos pelo
 *   servidor: X-RateLimit-Burst-Remaining e X-RateLimit-Sustained-Remaining.
 * - Cache LRU em memoria (TTL 1h, max 500 entries) para reduzir chamadas
 *   repetidas em buscas iguais.
 * - User-Agent identificado: ComicsTrunk/1.0 (cover-scan)
 *
 * IMPORTANTE: Atribuicao CC BY-SA 4.0 dos dados eh obrigatoria — frontend
 * mostra "Powered by Metron" discreto na pagina /scan-capa.
 */

const API_BASE = 'https://metron.cloud/api';
const USER_AGENT = 'ComicsTrunk/1.0 (cover-scan; +https://comicstrunk.com)';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const CACHE_MAX_ENTRIES = 500;

export interface MetronIssueSummary {
  id: number;
  series: { name: string; volume: number; year_began: number };
  number: string;
  issue: string; // "Absolute Batman (2024) #2"
  cover_date: string | null;
  store_date: string | null;
  image: string;
}

export interface MetronIssueDetail extends MetronIssueSummary {
  description?: string;
  characters?: Array<{ name: string }>;
  credits?: Array<{ creator: string; role: Array<{ name: string }> }>;
  isbn?: string;
  upc?: string;
}

interface MetronListResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// === Cache em memoria ===

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // LRU simples: remove a primeira entrada (mais antiga)
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// === Rate limit guard (preventivo) ===

let lastBurstRemaining = 20;
let lastSustainedRemaining = 5000;

function rateLimitOk(): boolean {
  return lastBurstRemaining > 2 && lastSustainedRemaining > 50;
}

// === Core fetch helper ===

async function metronFetch<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const username = process.env.METRON_USERNAME;
  const password = process.env.METRON_PASSWORD;
  if (!username || !password) {
    return null; // sem credenciais, ignore silenciosamente
  }

  if (!rateLimitOk()) {
    return null; // proteção preventiva — não estourar limite
  }

  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const cacheKey = url.toString();
  const cached = cacheGet<T>(cacheKey);
  if (cached) return cached;

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    });
  } catch {
    return null; // rede indisponível — fail open
  }

  // Atualizar contadores de rate limit
  const burstHeader = res.headers.get('X-RateLimit-Burst-Remaining');
  const sustainedHeader = res.headers.get('X-RateLimit-Sustained-Remaining');
  if (burstHeader) lastBurstRemaining = parseInt(burstHeader, 10);
  if (sustainedHeader) lastSustainedRemaining = parseInt(sustainedHeader, 10);

  if (!res.ok) {
    return null; // erro HTTP — fail open
  }

  const data = (await res.json().catch(() => null)) as T | null;
  if (data) cacheSet(cacheKey, data);
  return data;
}

// === API publica ===

/**
 * Busca issues por nome da série (e número opcional).
 */
export async function searchMetronIssues(opts: {
  seriesName: string;
  number?: number;
}): Promise<MetronIssueSummary[]> {
  const params: Record<string, string> = {
    series_name: opts.seriesName,
    page_size: '8',
  };
  if (opts.number !== undefined) params.number = String(opts.number);

  const result = await metronFetch<MetronListResponse<MetronIssueSummary>>('/issue/', params);
  return result?.results ?? [];
}

/**
 * Detalhes de um issue específico (capa hi-res, créditos, isbn, etc).
 */
export async function getMetronIssue(id: number): Promise<MetronIssueDetail | null> {
  return await metronFetch<MetronIssueDetail>(`/issue/${id}/`);
}

/**
 * Status do rate limit (para debugging/logging).
 */
export function getMetronRateStatus(): { burst: number; sustained: number } {
  return { burst: lastBurstRemaining, sustained: lastSustainedRemaining };
}
```

- [ ] **Step 3: Verificar tipos**

```bash
corepack pnpm --filter api type-check
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/shared/lib/metron.ts apps/api/.env.example
git commit -m "$(cat <<'EOF'
feat(cover-scan): cliente Metron com Basic Auth, rate limit, cache

Cliente HTTP fino para metron.cloud:
- HTTP Basic Auth via METRON_USERNAME / METRON_PASSWORD
- User-Agent identificado: ComicsTrunk/1.0
- Cache LRU em memoria (TTL 1h, max 500 entries) reduz chamadas
  repetidas drasticamente
- Monitoramento de X-RateLimit-Burst/Sustained-Remaining;
  guarda preventiva quando proximos do limite (fail open ao
  inves de 429)
- Tudo "fail open": se sem credenciais, sem rede, erro HTTP,
  retorna null/[] sem lancar — busca local segue funcionando

API exposta: searchMetronIssues, getMetronIssue,
getMetronRateStatus.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Cliente Rika live

**Files:**
- Create: `apps/api/src/shared/lib/rika.ts`

**Cliente HTTP do site rika.com.br. Sem auth, sem chave. Reaproveita lógica dos scrapers existentes (`scripts/scrape-rika-search.js`).**

- [ ] **Step 1: Inspecionar scrapers existentes**

```bash
cat scripts/scrape-rika-search.js | head -80
```

Identifique: URL de busca, formato da resposta (HTML scraping ou JSON?), campos extraíveis (title, image, edition, etc.).

- [ ] **Step 2: Criar cliente**

Crie `apps/api/src/shared/lib/rika.ts`:

```typescript
/**
 * Cliente fino do site Rika (https://www.rika.com.br).
 *
 * Sem API oficial; usa o endpoint de busca publico do site (mesmo padrao
 * dos scrapers em scripts/scrape-rika-search.js).
 *
 * Politica de boa cidadania:
 * - User-Agent identificado
 * - Delay 200ms entre chamadas (rate limit suave)
 * - Cache em memoria (TTL 1h)
 * - Fail open: erro -> retorna []
 */

import { setTimeout as sleep } from 'timers/promises';

const SEARCH_URL = 'https://www.rika.com.br/buscapagina';
const USER_AGENT = 'ComicsTrunk/1.0 (cover-scan; +https://comicstrunk.com)';
const REQUEST_DELAY_MS = 200;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

export interface RikaProductSummary {
  id: string; // sku ou productId
  title: string;
  image: string | null;
  url: string; // link pra pagina do produto
  publisher: string | null;
  editionNumber: number | null;
  price: number | null;
}

const cache = new Map<string, { value: RikaProductSummary[]; expiresAt: number }>();

function cacheGet(key: string): RikaProductSummary[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: RikaProductSummary[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

let lastCallAt = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallAt;
  if (elapsed < REQUEST_DELAY_MS) {
    await sleep(REQUEST_DELAY_MS - elapsed);
  }
  lastCallAt = Date.now();
}

/**
 * Busca produtos no Rika por termo livre.
 *
 * Os scrapers existentes em scripts/scrape-rika-search.js atualmente fazem
 * GET na rota interna /buscapagina?fq=ft:<query>&PS=<size>&O=OrderByScoreDESC
 * que retorna HTML com cards de produtos. Implementacao parseia esse HTML.
 */
export async function searchRika(query: string, opts: { limit?: number } = {}): Promise<RikaProductSummary[]> {
  const limit = opts.limit ?? 8;
  const cacheKey = `q=${query}&l=${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  await throttle();

  const params = new URLSearchParams({
    fq: `ft:${query}`,
    PS: String(limit),
    O: 'OrderByScoreDESC',
  });
  const url = `${SEARCH_URL}?${params.toString()}`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  const products = parseRikaSearchHtml(html, limit);
  cacheSet(cacheKey, products);
  return products;
}

/**
 * Parser do HTML de busca do Rika. Extrai cards de produto.
 *
 * Os cards seguem padrao:
 *   <li class="product-card" data-product-id="...">
 *     <a href="...">
 *       <img src="..." alt="..." />
 *       <h3>Titulo do produto</h3>
 *       ...
 *     </a>
 *   </li>
 *
 * Implementacao: regex defensiva (HTML pode mudar). Se nao encontrar nada,
 * retorna [] e o caller continua com Metron sem reclamar.
 */
function parseRikaSearchHtml(html: string, limit: number): RikaProductSummary[] {
  const products: RikaProductSummary[] = [];

  // Padrao: cada produto tem data-product-id e link/img/h3
  const cardRegex = /data-product-id=["'](\d+)["'][\s\S]*?<a[^>]+href=["']([^"']+)["'][\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][\s\S]*?(?=data-product-id=|<\/ul>|$)/gi;

  let match;
  while ((match = cardRegex.exec(html)) !== null && products.length < limit) {
    const [, id, url, image, alt] = match;
    products.push({
      id,
      title: cleanText(alt || ''),
      image: image.startsWith('//') ? `https:${image}` : image,
      url: url.startsWith('//') ? `https:${url}` : url.startsWith('/') ? `https://www.rika.com.br${url}` : url,
      publisher: detectPublisher(alt),
      editionNumber: extractEdition(alt),
      price: null, // preço extraído no detalhe (não na busca)
    });
  }

  return products;
}

function cleanText(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function detectPublisher(text: string): string | null {
  const lower = text.toLowerCase();
  const publishers = ['panini', 'devir', 'jbc', 'skript', 'pixel', 'figura', 'darkside', 'todavia'];
  for (const p of publishers) {
    if (lower.includes(p)) return p.charAt(0).toUpperCase() + p.slice(1);
  }
  return null;
}

function extractEdition(text: string): number | null {
  const match = text.match(/(?:#|n[oº]\.?\s*|vol\.?\s*|tomo\s*|edi[çc][aã]o\s*)(\d{1,4})/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return n > 0 && n < 10000 ? n : null;
}
```

- [ ] **Step 3: Verificar tipos**

```bash
corepack pnpm --filter api type-check
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/shared/lib/rika.ts
git commit -m "$(cat <<'EOF'
feat(cover-scan): cliente Rika live (busca via HTML scraping)

Cliente HTTP simples para www.rika.com.br/buscapagina:
- User-Agent identificado, throttle 200ms entre chamadas
- Cache em memoria TTL 1h
- Parser HTML defensivo via regex (HTML pode mudar)
- Fail open: erro -> retorna []

Reaproveita logica de URL/parsing dos scrapers existentes em
scripts/scrape-rika*.js. Usa endpoint publico /buscapagina
sem auth.

Detecta publisher (Panini, Devir, JBC, Skript etc.) e numero
de edicao (#, vol, tomo, edicao) no titulo via regex.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Service `external-search` com dedup

**Files:**
- Modify: `packages/contracts/src/cover-scan.ts` (adicionar `isExternal` em candidate)
- Create: `apps/api/src/modules/cover-scan/external-search.service.ts`
- Create: `apps/api/src/__tests__/cover-scan/external-search.test.ts`

**Orquestra Rika + Metron em paralelo (Promise.allSettled). Faz dedup com dados estruturados contra catálogo local.**

- [ ] **Step 1: Atualizar contract**

Em `packages/contracts/src/cover-scan.ts`, encontre `coverScanCandidateSchema`:

```typescript
// ANTES:
export const coverScanCandidateSchema = z.object({
  id: z.string(),
  slug: z.string().nullable(),
  title: z.string(),
  publisher: z.string().nullable(),
  editionNumber: z.number().int().nullable(),
  coverImageUrl: z.string().nullable(),
  score: z.number(),
});

// DEPOIS:
export const coverScanCandidateSchema = z.object({
  id: z.string(),
  slug: z.string().nullable(),
  title: z.string(),
  publisher: z.string().nullable(),
  editionNumber: z.number().int().nullable(),
  coverImageUrl: z.string().nullable(),
  score: z.number(),
  isExternal: z.boolean().optional().default(false),
  // Quando isExternal=true, externalSource identifica a origem para
  // o endpoint /import construir a entry corretamente. Nao mostrado ao user.
  externalSource: z.enum(['metron', 'rika']).optional(),
  externalRef: z.string().optional(), // id na fonte externa
});
```

E adicione novo schema no fim:

```typescript
// === Import endpoint (Fase 3) — cria CatalogEntry PENDING a partir de candidato externo ===

export const coverScanImportSchema = z.object({
  scanLogId: z.string().min(1),
  externalSource: z.enum(['metron', 'rika']),
  externalRef: z.string().min(1),
});
export type CoverScanImportInput = z.infer<typeof coverScanImportSchema>;

export interface CoverScanImportResponse {
  catalogEntryId: string;
  collectionItemId: string;
  message: string;
}
```

- [ ] **Step 2: Build contracts**

```bash
corepack pnpm --filter contracts build
```

- [ ] **Step 3: Criar testes**

Crie `apps/api/src/__tests__/cover-scan/external-search.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

vi.mock('../../shared/lib/metron', () => ({
  searchMetronIssues: vi.fn(),
  getMetronIssue: vi.fn(),
  getMetronRateStatus: vi.fn(() => ({ burst: 20, sustained: 5000 })),
}));
vi.mock('../../shared/lib/rika', () => ({
  searchRika: vi.fn(),
}));

import { searchMetronIssues } from '../../shared/lib/metron';
import { searchRika } from '../../shared/lib/rika';
import { searchExternal } from '../../modules/cover-scan/external-search.service';

const prisma = new PrismaClient();
const createdIds: string[] = [];

const mockedMetron = vi.mocked(searchMetronIssues);
const mockedRika = vi.mocked(searchRika);

beforeEach(() => {
  mockedMetron.mockReset();
  mockedRika.mockReset();
});

afterAll(async () => {
  if (createdIds.length > 0) {
    await prisma.catalogEntry.deleteMany({ where: { id: { in: createdIds } } });
  }
  await prisma.$disconnect();
});

describe('searchExternal', () => {
  it('retorna candidatos de Metron com isExternal=true', async () => {
    mockedMetron.mockResolvedValue([
      {
        id: 999,
        series: { name: 'Absolute Batman', volume: 1, year_began: 2024 },
        number: '2',
        issue: 'Absolute Batman (2024) #2',
        cover_date: '2025-01-01',
        store_date: '2024-11-13',
        image: 'https://static.metron.cloud/test.jpg',
      },
    ]);
    mockedRika.mockResolvedValue([]);

    const result = await searchExternal({
      title: 'Absolute Batman',
      issue_number: 2,
      publisher: 'DC Comics',
      authors: [],
      series: null,
      language: 'en',
      confidence: 'alta',
      ocr_text: '',
      raw_response: '{}',
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].isExternal).toBe(true);
    expect(result[0].externalSource).toBe('metron');
    expect(result[0].externalRef).toBe('999');
  });

  it('SUBSTITUI externo por local quando dedup encontra match', async () => {
    const localEntry = await prisma.catalogEntry.create({
      data: {
        title: 'Dedup Test Comic',
        publisher: 'Panini',
        editionNumber: 5,
        approvalStatus: 'APPROVED',
      },
    });
    createdIds.push(localEntry.id);

    mockedMetron.mockResolvedValue([
      {
        id: 888,
        series: { name: 'Dedup Test Comic', volume: 1, year_began: 2024 },
        number: '5',
        issue: 'Dedup Test Comic #5',
        cover_date: null,
        store_date: null,
        image: 'https://example.com/x.jpg',
      },
    ]);
    mockedRika.mockResolvedValue([]);

    const result = await searchExternal({
      title: 'Dedup Test Comic',
      issue_number: 5,
      publisher: 'Panini',
      authors: [],
      series: null,
      language: null,
      confidence: 'alta',
      ocr_text: '',
      raw_response: '{}',
    });

    // Resultado: deve incluir o local (dedup substituiu o externo)
    const localFound = result.find((c) => c.id === localEntry.id);
    expect(localFound).toBeDefined();
    expect(localFound?.isExternal).toBe(false);
  });

  it('continua se Metron falhar (Promise.allSettled)', async () => {
    mockedMetron.mockRejectedValue(new Error('Metron offline'));
    mockedRika.mockResolvedValue([]);

    const result = await searchExternal({
      title: 'Anything',
      issue_number: null,
      publisher: null,
      authors: [],
      series: null,
      language: null,
      confidence: 'baixa',
      ocr_text: '',
      raw_response: '{}',
    });

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 4: Implementar service**

Crie `apps/api/src/modules/cover-scan/external-search.service.ts`:

```typescript
import { prisma } from '../../shared/lib/prisma';
import { searchMetronIssues, type MetronIssueSummary } from '../../shared/lib/metron';
import { searchRika, type RikaProductSummary } from '../../shared/lib/rika';
import type { RecognizedCover } from '../../shared/lib/cloudflare-ai';
import type { CoverScanCandidate } from '@comicstrunk/contracts';

const TOP_EXTERNAL_PER_SOURCE = 5;

/**
 * Busca em fontes externas (Rika + Metron) em paralelo. Aplica dedup contra
 * catalogo local: candidatos externos que ja existem no catalogo viram
 * candidatos internos (com seus ids reais).
 */
export async function searchExternal(rec: RecognizedCover): Promise<CoverScanCandidate[]> {
  const seriesQuery = rec.series ?? rec.title ?? '';
  if (!seriesQuery.trim()) return [];

  // Disparar fontes em paralelo, com fail open
  const [metronResult, rikaResult] = await Promise.allSettled([
    searchMetronIssues({
      seriesName: stripSubtitle(seriesQuery),
      number: rec.issue_number ?? undefined,
    }),
    searchRika(buildRikaQuery(rec), { limit: TOP_EXTERNAL_PER_SOURCE }),
  ]);

  const metronList: MetronIssueSummary[] =
    metronResult.status === 'fulfilled' ? metronResult.value : [];
  const rikaList: RikaProductSummary[] =
    rikaResult.status === 'fulfilled' ? rikaResult.value : [];

  // Converter cada externo em candidato
  const externalCandidates: CoverScanCandidate[] = [
    ...metronList.slice(0, TOP_EXTERNAL_PER_SOURCE).map(metronToCandidate),
    ...rikaList.slice(0, TOP_EXTERNAL_PER_SOURCE).map(rikaToCandidate),
  ];

  if (externalCandidates.length === 0) return [];

  // Dedup contra catalogo local
  return await dedupExternal(externalCandidates);
}

function stripSubtitle(s: string): string {
  const colon = s.indexOf(':');
  const dash = s.indexOf(' - ');
  const cut = [colon, dash].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  return cut !== undefined && cut > 0 ? s.slice(0, cut).trim() : s.trim();
}

function buildRikaQuery(rec: RecognizedCover): string {
  const parts: string[] = [];
  if (rec.title) parts.push(stripSubtitle(rec.title));
  if (rec.issue_number !== null) parts.push(String(rec.issue_number));
  return parts.join(' ').trim();
}

function metronToCandidate(m: MetronIssueSummary): CoverScanCandidate {
  return {
    id: `metron:${m.id}`,
    slug: null,
    title: m.issue,
    publisher: m.series.name ? null : null, // Metron nao expoe publisher no summary; busca no detalhe se precisar
    editionNumber: parseInt(m.number, 10) || null,
    coverImageUrl: m.image,
    score: 0.5, // base externa; UI ordena por score depois
    isExternal: true,
    externalSource: 'metron',
    externalRef: String(m.id),
  };
}

function rikaToCandidate(r: RikaProductSummary): CoverScanCandidate {
  return {
    id: `rika:${r.id}`,
    slug: null,
    title: r.title,
    publisher: r.publisher,
    editionNumber: r.editionNumber,
    coverImageUrl: r.image,
    score: 0.5,
    isExternal: true,
    externalSource: 'rika',
    externalRef: r.id,
  };
}

/**
 * Para cada candidato externo, procura no catalogo local equivalente.
 * Se achar com confianca alta, substitui o externo pelo local.
 */
async function dedupExternal(externals: CoverScanCandidate[]): Promise<CoverScanCandidate[]> {
  const result: CoverScanCandidate[] = [];

  for (const ext of externals) {
    const local = await findLocalMatch(ext);
    if (local) {
      // Substitui externo pelo local (mais confiavel — entry ja existe)
      result.push({
        id: local.id,
        slug: local.slug,
        title: local.title,
        publisher: local.publisher,
        editionNumber: local.editionNumber,
        coverImageUrl: local.coverImageUrl,
        score: 1.0, // boost: era externo mas achei local — provavelmente o certo
        isExternal: false,
      });
    } else {
      result.push(ext);
    }
  }

  return result;
}

interface LocalMatch {
  id: string;
  slug: string | null;
  title: string;
  publisher: string | null;
  editionNumber: number | null;
  coverImageUrl: string | null;
}

async function findLocalMatch(ext: CoverScanCandidate): Promise<LocalMatch | null> {
  // Estrategia: title fuzzy (primeiros 5 chars de cada palavra significativa)
  // + editionNumber exato (se houver)
  const title = ext.title;
  if (!title) return null;

  // Tokens de busca: palavras significativas do title (sem subtitulo)
  const main = stripSubtitle(title);
  const words = main.split(/[\s\-:]+/).filter((w) => w.length >= 3).slice(0, 3);
  if (words.length === 0) return null;

  const where = {
    approvalStatus: 'APPROVED' as const,
    AND: words.map((w) => ({
      OR: [
        { title: { contains: w.slice(0, 5) } },
        { author: { contains: w.slice(0, 5) } },
      ],
    })),
    ...(ext.editionNumber !== null && { editionNumber: ext.editionNumber }),
  };

  const candidates = await prisma.catalogEntry.findMany({
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
    take: 3,
  });

  if (candidates.length === 0) return null;

  // Pegar o primeiro como melhor match (já passou no filtro AND)
  const best = candidates[0];
  return {
    id: best.id,
    slug: best.slug,
    title: best.title,
    publisher: best.publisher,
    editionNumber: best.editionNumber,
    coverImageUrl: best.coverImageUrl, // resolve URL no caller
  };
}
```

- [ ] **Step 5: Rodar testes**

```bash
corepack pnpm --filter api test -- external-search
```

Esperado: 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/cover-scan.ts apps/api/src/modules/cover-scan/external-search.service.ts apps/api/src/__tests__/cover-scan/external-search.test.ts
git commit -m "$(cat <<'EOF'
feat(cover-scan): service externalSearch + dedup contra local

Orquestra Rika + Metron em paralelo (Promise.allSettled — se
uma fonte cair, outra continua). Cada candidato externo passa
por dedup contra catalogo local com title fuzzy + editionNumber:
se encontrar match, SUBSTITUI o externo pelo local (entry
existente eh mais confiavel).

Contract atualizado: candidatos ganham campos opcionais
isExternal/externalSource/externalRef. Schema novo
coverScanImportSchema para Task 5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Service `cover-import` (cria entry PENDING)

**Files:**
- Create: `apps/api/src/modules/cover-scan/cover-import.service.ts`
- Create: `apps/api/src/__tests__/cover-scan/cover-import.test.ts`

**Cria `CatalogEntry` PENDING a partir de candidato externo. Baixa capa pra R2. Adiciona à coleção do user.**

- [ ] **Step 1: Escrever testes**

Crie `apps/api/src/__tests__/cover-scan/cover-import.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_USER } from '../setup';

vi.mock('../../shared/lib/metron', () => ({
  searchMetronIssues: vi.fn(),
  getMetronIssue: vi.fn(),
  getMetronRateStatus: vi.fn(() => ({ burst: 20, sustained: 5000 })),
}));
vi.mock('../../shared/lib/rika', () => ({
  searchRika: vi.fn(),
}));

import { getMetronIssue } from '../../shared/lib/metron';

const prisma = new PrismaClient();
const mockedGetMetron = vi.mocked(getMetronIssue);

let userToken: string;
let userId: string;
const createdIds: { catalog: string[]; collection: string[]; logs: string[] } = {
  catalog: [],
  collection: [],
  logs: [],
};

beforeAll(async () => {
  const u = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = u.accessToken;
  const user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
  if (!user) throw new Error('TEST_USER nao encontrado');
  userId = user.id;
});

beforeEach(() => {
  mockedGetMetron.mockReset();
});

afterAll(async () => {
  if (createdIds.collection.length > 0) {
    await prisma.collectionItem.deleteMany({ where: { id: { in: createdIds.collection } } });
  }
  if (createdIds.logs.length > 0) {
    await prisma.coverScanLog.deleteMany({ where: { id: { in: createdIds.logs } } });
  }
  if (createdIds.catalog.length > 0) {
    await prisma.catalogEntry.deleteMany({ where: { id: { in: createdIds.catalog } } });
  }
  await prisma.$disconnect();
});

describe('POST /api/v1/cover-scan/import', () => {
  it('cria CatalogEntry PENDING a partir de Metron e adiciona a colecao', async () => {
    mockedGetMetron.mockResolvedValue({
      id: 12345,
      series: { name: 'Test Series', volume: 1, year_began: 2024 },
      number: '7',
      issue: 'Test Series #7',
      cover_date: '2024-11-01',
      store_date: '2024-11-15',
      image: 'https://static.metron.cloud/test.jpg',
      description: 'Test description',
      isbn: '978-1234567890',
    });

    // Criar scan log de pre-requisito
    const log = await prisma.coverScanLog.create({
      data: {
        userId,
        rawText: '{}',
        ocrTokens: 'test',
        candidatesShown: [],
      },
    });
    createdIds.logs.push(log.id);

    const res = await request
      .post('/api/v1/cover-scan/import')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        scanLogId: log.id,
        externalSource: 'metron',
        externalRef: '12345',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { catalogEntryId, collectionItemId } = res.body.data;
    expect(catalogEntryId).toBeTruthy();
    expect(collectionItemId).toBeTruthy();
    createdIds.catalog.push(catalogEntryId);
    createdIds.collection.push(collectionItemId);

    const created = await prisma.catalogEntry.findUnique({ where: { id: catalogEntryId } });
    expect(created?.approvalStatus).toBe('PENDING');
    expect(created?.title).toContain('Test Series');
    expect(created?.editionNumber).toBe(7);
    expect(created?.createdById).toBe(userId);
    expect(created?.sourceKey).toBe('metron:12345');

    const collectionItem = await prisma.collectionItem.findUnique({
      where: { id: collectionItemId },
    });
    expect(collectionItem?.userId).toBe(userId);
  });

  it('returns 400 com input invalido', async () => {
    const res = await request
      .post('/api/v1/cover-scan/import')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        scanLogId: 'invalid',
        externalSource: 'metron',
        externalRef: '',
      });

    expect(res.status).toBe(400);
  });

  it('returns 401 sem auth', async () => {
    const res = await request.post('/api/v1/cover-scan/import').send({
      scanLogId: 'x',
      externalSource: 'metron',
      externalRef: '1',
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Implementar service**

Crie `apps/api/src/modules/cover-scan/cover-import.service.ts`:

```typescript
import { prisma } from '../../shared/lib/prisma';
import { getMetronIssue } from '../../shared/lib/metron';
import { searchRika } from '../../shared/lib/rika';
import { uniqueSlug } from '../../shared/utils/slug';
import { uploadImageFromUrl } from '../../shared/lib/cloudinary';
import { NotFoundError, BadRequestError } from '../../shared/utils/api-error';
import type { CoverScanImportInput, CoverScanImportResponse } from '@comicstrunk/contracts';

/**
 * Cria CatalogEntry PENDING a partir de candidato externo, baixa capa,
 * adiciona a colecao do user. Idempotente: se ja existir entry com mesmo
 * sourceKey, reusa.
 */
export async function importExternalCandidate(
  userId: string,
  input: CoverScanImportInput,
): Promise<CoverScanImportResponse> {
  // Verificar que scanLog existe e pertence ao user
  const scanLog = await prisma.coverScanLog.findUnique({
    where: { id: input.scanLogId },
    select: { id: true, userId: true },
  });
  if (!scanLog || scanLog.userId !== userId) {
    throw new NotFoundError('Scan log nao encontrado');
  }

  const sourceKey = `${input.externalSource}:${input.externalRef}`;

  // Verificar idempotencia: ja existe entry com este sourceKey?
  let entry = await prisma.catalogEntry.findFirst({
    where: { sourceKey },
    select: { id: true, approvalStatus: true },
  });

  if (!entry) {
    // Buscar dados na fonte externa
    const data = await fetchExternalData(input.externalSource, input.externalRef);
    if (!data) {
      throw new BadRequestError('Nao foi possivel obter dados da fonte externa');
    }

    // Baixar capa pro R2 (se houver URL)
    let coverFileName: string | null = null;
    if (data.image) {
      try {
        const uploaded = await uploadImageFromUrl(data.image, 'covers');
        coverFileName = uploaded.fileName;
      } catch {
        // Se download falhar, segue sem capa local — coverImageUrl externa fica
      }
    }

    // Criar slug unico
    const baseSlug = `${data.title}-${data.editionNumber ?? ''}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    const slug = await uniqueSlug('catalogEntry', baseSlug || 'gibi-importado');

    const created = await prisma.catalogEntry.create({
      data: {
        title: data.title,
        publisher: data.publisher,
        editionNumber: data.editionNumber,
        coverImageUrl: coverFileName ? null : data.image, // se baixou pro R2, URL eh montada via coverFileName; senao usa externa
        coverFileName,
        description: data.description,
        isbn: data.isbn,
        slug,
        sourceKey,
        approvalStatus: 'PENDING',
        createdById: userId,
      },
      select: { id: true, approvalStatus: true },
    });
    entry = created;
  }

  // Adicionar a colecao do user (idempotente: se ja tem, incrementa quantity)
  const existing = await prisma.collectionItem.findFirst({
    where: { userId, catalogEntryId: entry.id },
  });

  let collectionItemId: string;
  if (existing) {
    const updated = await prisma.collectionItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + 1 },
      select: { id: true },
    });
    collectionItemId = updated.id;
  } else {
    const created = await prisma.collectionItem.create({
      data: {
        userId,
        catalogEntryId: entry.id,
        condition: 'GOOD',
        quantity: 1,
      },
      select: { id: true },
    });
    collectionItemId = created.id;
  }

  // Atualizar scan log com escolha
  await prisma.coverScanLog.update({
    where: { id: input.scanLogId },
    data: { chosenEntryId: entry.id },
  });

  return {
    catalogEntryId: entry.id,
    collectionItemId,
    message: entry.approvalStatus === 'PENDING'
      ? 'Adicionado a sua colecao. Aguardando aprovacao para aparecer no catalogo publico.'
      : 'Adicionado a sua colecao.',
  };
}

interface ExternalData {
  title: string;
  publisher: string | null;
  editionNumber: number | null;
  image: string | null;
  description: string | null;
  isbn: string | null;
}

async function fetchExternalData(
  source: 'metron' | 'rika',
  ref: string,
): Promise<ExternalData | null> {
  if (source === 'metron') {
    const id = parseInt(ref, 10);
    if (!Number.isFinite(id)) return null;
    const detail = await getMetronIssue(id);
    if (!detail) return null;
    return {
      title: detail.issue,
      publisher: null, // detail nao expoe publisher diretamente; pode ser ampliado depois com /api/series/{id}
      editionNumber: parseInt(detail.number, 10) || null,
      image: detail.image,
      description: detail.description ?? null,
      isbn: detail.isbn ?? null,
    };
  }

  // rika: buscar de novo pelo ref/id (workaround sem detail endpoint dedicado)
  const list = await searchRika(ref, { limit: 1 });
  const found = list.find((p) => p.id === ref) ?? list[0];
  if (!found) return null;
  return {
    title: found.title,
    publisher: found.publisher,
    editionNumber: found.editionNumber,
    image: found.image,
    description: null,
    isbn: null,
  };
}
```

NOTA: a função `uploadImageFromUrl` pode não existir com esse nome. Antes de copiar, **leia o arquivo `apps/api/src/shared/lib/cloudinary.ts`** e use a função correta de upload de imagem a partir de URL. Se não houver, baixa via `fetch` e usa `uploadImage(buffer)`.

- [ ] **Step 3: Rodar testes**

```bash
corepack pnpm --filter api test -- cover-import
```

Esperado: testes falham — rota `/import` ainda não existe (Task 6).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/cover-scan/cover-import.service.ts apps/api/src/__tests__/cover-scan/cover-import.test.ts
git commit -m "$(cat <<'EOF'
feat(cover-scan): service importExternalCandidate

Cria CatalogEntry PENDING a partir de candidato externo
(Metron ou Rika), baixa capa pro R2, adiciona a colecao do
user. Idempotente: reusa entry existente se sourceKey ja
estiver no catalogo (evita duplicatas).

Atualiza coverScanLog.chosenEntryId com a entry criada/reusada.

Tests cobrem: criacao Metron, validacao input, auth requerido.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Atualizar `/recognize` + adicionar `/import` route

**Files:**
- Modify: `apps/api/src/modules/cover-scan/cover-recognize.service.ts`
- Modify: `apps/api/src/modules/cover-scan/cover-scan.routes.ts`

- [ ] **Step 1: Integrar searchExternal em recognize**

Em `cover-recognize.service.ts`, dentro de `recognizeFromImage`, depois do bloco que monta `candidates` locais e antes de persistir o log, adicionar:

```typescript
import { searchExternal } from './external-search.service';

// ... dentro de recognizeFromImage, apos calcular candidates locais:

// Buscar externamente em paralelo (Promise.allSettled - fail open)
let externalCandidates: CoverScanCandidate[] = [];
try {
  externalCandidates = await searchExternal(recognized);
} catch {
  // fail open: erro nao quebra scan
}

// Mesclar locais e externos. Locais ja deduplificaram externos via dedupExternal,
// entao aqui basta concatenar e ordenar por score.
const merged = [...candidates, ...externalCandidates]
  .sort((a, b) => b.score - a.score)
  .slice(0, 12); // max 12 candidatos no total (8 internos + 4 externos)

// ... seguir com persistencia do log usando "merged" no lugar de "candidates"
```

ATENÇÃO: o `candidates` do log também deve passar a ser `merged`. Verifique consistência:

```typescript
// 4. Persistir log
const log = await prisma.coverScanLog.create({
  data: {
    userId,
    rawText: recognized.raw_response.slice(0, 5000),
    ocrTokens: `[must] ${must.join(' ')} [boost] ${boost.join(' ')}`.slice(0, 5000),
    candidateNumber: effectiveIssueNumber,
    candidatesShown: merged.map((c) => ({
      id: c.id,
      title: c.title,
      score: c.score,
      isExternal: c.isExternal ?? false,
    })),
    durationMs: input.durationMs ?? null,
  },
  select: { id: true },
});

return { candidates: merged, scanLogId: log.id };
```

- [ ] **Step 2: Adicionar rota /import**

Em `apps/api/src/modules/cover-scan/cover-scan.routes.ts`, adicionar imports:

```typescript
import { coverScanImportSchema } from '@comicstrunk/contracts';
import type { CoverScanImportInput } from '@comicstrunk/contracts';
import * as coverImportService from './cover-import.service';
```

E adicionar rota antes do export:

```typescript
router.post(
  '/import',
  authenticate,
  validate(coverScanImportSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CoverScanImportInput;
      const result = await coverImportService.importExternalCandidate(req.user!.userId, input);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);
```

- [ ] **Step 3: Rodar todos os testes do cover-scan**

```bash
corepack pnpm --filter api test -- cover-scan cover-recognize external-search cover-import
```

Esperado: 13+ testes passando.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/cover-scan
git commit -m "$(cat <<'EOF'
feat(cover-scan): integra busca externa e adiciona /import

- recognizeFromImage agora chama searchExternal em paralelo
  (Promise.allSettled - fail open). Mescla candidatos locais +
  externos, ordenados por score. Max 12 no total.
- Log salva flag isExternal por candidato pra analise.
- Nova rota POST /cover-scan/import recebe scanLogId +
  externalSource + externalRef, cria entry PENDING + adiciona
  a colecao via importExternalCandidate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Frontend — borda diferenciada + handler de click

**Files:**
- Modify: `apps/web/src/lib/api/cover-scan.ts`
- Modify: `apps/web/src/components/features/catalog/cover-photo-scanner.tsx`
- Modify: `apps/web/src/app/[locale]/(collector)/scan-capa/page.tsx`
- Modify: `apps/web/src/messages/pt-BR.json`

- [ ] **Step 1: Adicionar `importExternal` no cliente**

Em `apps/web/src/lib/api/cover-scan.ts`, adicione:

```typescript
import type { CoverScanImportInput, CoverScanImportResponse } from '@comicstrunk/contracts';

export async function importExternal(input: CoverScanImportInput): Promise<CoverScanImportResponse> {
  const { data } = await apiClient.post('/cover-scan/import', input);
  return data.data;
}
```

- [ ] **Step 2: Atualizar componente CoverPhotoScanner**

Em `cover-photo-scanner.tsx`:

a) Importar `importExternal`:
```typescript
import { recognize, recordChoice, importExternal } from '@/lib/api/cover-scan';
```

b) Substituir `handleChoose` por:
```typescript
async function handleChoose(candidate: CoverScanCandidate | null) {
  if (!candidate) {
    if (scanLogId) {
      await recordChoice({ scanLogId, chosenEntryId: null }).catch(() => {});
    }
    return;
  }

  // Externo: importar primeiro (cria entry PENDING + adiciona a colecao)
  if (candidate.isExternal && candidate.externalSource && candidate.externalRef && scanLogId) {
    try {
      const importResult = await importExternal({
        scanLogId,
        externalSource: candidate.externalSource,
        externalRef: candidate.externalRef,
      });
      // Redirect pro catalog detail da entry recem-criada
      onChoose?.({
        ...candidate,
        id: importResult.catalogEntryId,
        isExternal: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('errorGeneric');
      setErrorMsg(msg);
      setStage('error');
    }
    return;
  }

  // Interno: fluxo existente
  if (scanLogId) {
    await recordChoice({ scanLogId, chosenEntryId: candidate.id }).catch(() => {});
  }
  onChoose?.(candidate);
}
```

c) Atualizar o JSX do candidato para borda condicional:
```tsx
<button
  onClick={() => handleChoose(c)}
  className={`block w-full rounded border bg-card p-2 text-left hover:border-primary ${
    c.isExternal ? 'border-amber-400/40 border-dashed' : ''
  }`}
>
```

- [ ] **Step 3: Atribuição "Powered by Metron" no footer**

Em `apps/web/src/app/[locale]/(collector)/scan-capa/page.tsx`, adicionar no fim da página (antes do `</div>` final):

```tsx
<footer className="mt-8 text-center text-xs text-muted-foreground/60">
  {t('poweredByMetron')}
</footer>
```

- [ ] **Step 4: Atualizar traduções pt-BR**

Em `apps/web/src/messages/pt-BR.json`, dentro do namespace `scanCapa`, adicionar:

```json
    "poweredByMetron": "Catálogo enriquecido com dados de metron.cloud (CC BY-SA 4.0)",
```

- [ ] **Step 5: Verificar tipos**

```bash
corepack pnpm --filter web type-check
corepack pnpm --filter web lint 2>&1 | grep -E "cover-photo-scanner|scan-capa|cover-scan" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api/cover-scan.ts apps/web/src/components/features/catalog/cover-photo-scanner.tsx apps/web/src/app/[locale]/(collector)/scan-capa apps/web/src/messages/pt-BR.json
git commit -m "$(cat <<'EOF'
feat(web): scanner integra externos com borda diferenciada

- Cliente HTTP adiciona importExternal() para POST /cover-scan/import
- handleChoose distingue interno vs externo: externo dispara
  importExternal antes do redirect (cria entry PENDING + adiciona
  a colecao automaticamente)
- Borda diferenciada sutil (amber/40 + dashed) para candidatos
  externos. Sem texto explicando a fonte ao usuario
- Footer pequeno na pagina /scan-capa com atribuicao
  "Powered by Metron" (CC BY-SA 4.0)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Verificação final

- [ ] Rodar todos os testes da feature:
```bash
corepack pnpm --filter api test -- cover-scan cover-recognize external-search cover-import collection-pending
```

Esperado: 16+ testes passando.

- [ ] Type-check + lint global:
```bash
corepack pnpm --filter contracts build
corepack pnpm --filter api type-check
corepack pnpm --filter web type-check
corepack pnpm --filter web lint 2>&1 | grep -iE "cover-scan|scan-capa|cover-photo" | head -10
```

- [ ] Documentar smoke test pra Fernando:
```
1. Reinicia API se ainda estiver com codigo antigo
2. Acessa /pt-BR/scan-capa
3. Envia capa do Absolute Batman Vol. 2 (a mesma de antes)
4. Verifica fluxo: candidatos misturam locais + externos
   (externos com borda tracejada amber sutil)
5. Clica num candidato externo
   - Backend cria entry PENDING + adiciona a colecao
   - Verifica em /admin/catalog que entry esta PENDING
   - Verifica em /collection que item aparece
6. Acessa /pt-BR/admin/catalog?status=PENDING e ve entries
   criadas via fontes externas. Aprova/edita conforme.
```

- [ ] Sem commit nesta task — apenas verificação.

---

## Self-Review

**Spec coverage:**
- ✅ Rika + Metron como fontes (Tasks 2, 3)
- ✅ Promise.allSettled (Task 4)
- ✅ Dedup pos-externo (Task 4)
- ✅ Endpoint /import + entry PENDING (Tasks 5, 6)
- ✅ Relax addItem (Task 1)
- ✅ Borda diferenciada (Task 7)
- ✅ Atribuição Metron (Task 7)

**Placeholder scan:** sem TBD/TODO. Cada task tem código completo.

**Type consistency:**
- `CoverScanCandidate.isExternal` (opcional bool) — definido em contracts (Task 4) → consumido em external-search (Task 4) → propagado em recognize (Task 6) → renderizado em scanner (Task 7)
- `CoverScanImportInput` — definido (Task 4) → service (Task 5) → rota (Task 6) → cliente HTTP (Task 7)
- `externalSource: 'metron' | 'rika'` (enum) — consistente

**Edge cases cobertos:**
- Metron offline → Promise.allSettled mantém scan funcionando
- Rika HTML muda → regex defensiva retorna []
- Rate limit estourado → cliente Metron falha silenciosamente
- IA leu errado mas gibi existe → dedup com dados estruturados pega
- Externo já importado antes → idempotência via sourceKey
- User clica e já tem o item na coleção → incrementa quantity

---

## Execution Handoff

**Plan complete and committed.** Salvo em [docs/superpowers/plans/2026-04-27-scan-capa-fase-3.md](docs/superpowers/plans/2026-04-27-scan-capa-fase-3.md).

**Estratégia de execução:** Subagent-Driven (mesmo da Fase 2). Tasks isoladas, com cada uma despachando subagent específico.
