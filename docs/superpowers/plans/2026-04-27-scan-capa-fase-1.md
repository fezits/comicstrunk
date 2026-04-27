# Busca de capa por foto — Fase 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o usuário logado fotografe a capa de um gibi, faça OCR no browser, e veja os candidatos do catálogo ranqueados para escolher e adicionar à coleção. Sem custo recorrente.

**Architecture:** OCR roda no cliente via Tesseract.js (lazy-loaded). Frontend envia o texto extraído ao endpoint `POST /api/v1/cover-scan/search`. API normaliza tokens, separa um possível número de edição via regex, e faz busca fuzzy no MySQL (mesmo padrão de splits AND/OR de `searchCatalog`). Cada chamada loga em `cover_scan_logs` para análise futura (input para fine-tuning na Fase 3) e para impor rate limit de 30/dia/usuário.

**Tech Stack:**
- Backend: Express + Zod + Prisma (MySQL) + Vitest + supertest
- Contracts: `@comicstrunk/contracts` (Zod schemas compartilhados)
- Frontend: Next.js 15 + React 19 + Tesseract.js + shadcn/ui + next-intl
- Auth: middleware `authenticate` (Bearer JWT)

**Spec:** [docs/superpowers/specs/2026-04-26-busca-capa-por-foto-design.md](../specs/2026-04-26-busca-capa-por-foto-design.md)

**Branch ativa:** `feat/scan-capa-por-foto`
**Tag de fallback:** `pre-scan-capa-2026-04-27` em `main`

**Decisão de naming:** O spec menciona `POST /api/v1/catalog/search-by-text`. Para isolar a feature em um módulo próprio (testes, manutenção, futura evolução para Fase 2 com endpoint `recognize`), o plano cria um módulo novo `cover-scan` montado em `/api/v1/cover-scan`. Endpoint final: `POST /api/v1/cover-scan/search`. Isso é uma simplificação do spec sem mudança de comportamento.

---

## File Structure

### Backend (apps/api)

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `apps/api/prisma/schema.prisma` | modificar | Adicionar `CoverScanLog` model |
| `apps/api/prisma/migrations/<timestamp>_add_cover_scan_logs/migration.sql` | criar (via Prisma CLI) | DDL |
| `packages/contracts/src/cover-scan.ts` | criar | Schemas Zod e tipos exportados |
| `packages/contracts/src/index.ts` | modificar | Re-exportar `cover-scan` |
| `apps/api/src/modules/cover-scan/cover-scan.service.ts` | criar | Lógica de busca textual + log + rate limit |
| `apps/api/src/modules/cover-scan/cover-scan.routes.ts` | criar | Router Express |
| `apps/api/src/create-app.ts` | modificar | Registrar `coverScanRoutes` |
| `apps/api/src/__tests__/cover-scan/cover-scan.test.ts` | criar | Testes de integração |

### Frontend (apps/web)

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `apps/web/package.json` | modificar | Adicionar `tesseract.js` |
| `apps/web/src/lib/api/cover-scan.ts` | criar | Cliente HTTP do endpoint |
| `apps/web/src/components/features/catalog/cover-photo-scanner.tsx` | criar | Componente reutilizável (input de foto, Tesseract, exibição de candidatos) |
| `apps/web/src/app/[locale]/(collector)/scan-capa/page.tsx` | criar | Página dedicada |
| `apps/web/src/components/layout/nav-config.ts` | modificar | Adicionar item "Buscar por foto" no menu collector |
| `apps/web/src/messages/pt-BR.json` | modificar | Adicionar chaves `scanCapa.*` |

---

## Pre-flight check

**Branch correta?** Confirme que está em `feat/scan-capa-por-foto` antes de iniciar:

```bash
git branch --show-current
# expected: feat/scan-capa-por-foto
```

Se estiver em outra branch, pare e troque para `feat/scan-capa-por-foto`.

---

### Task 0: Backup do banco de dados (manual, bloqueante)

**Files:**
- Nenhum (operação manual fora do repo)

**Contexto:** Fernando explicitamente solicitou backup do banco antes de iniciar a feature. Esta task **bloqueia** a Task 1 (que roda `prisma migrate dev`).

- [ ] **Step 1: Confirmar com o Fernando que existe backup recente**

Se ele já tem backup recente (≤ 24h), pode prosseguir.

Se não:

- [ ] **Step 2: Tirar backup local**

Banco local roda em Docker. Execute (ajustar credenciais conforme `apps/api/.env` se diferentes):

```bash
docker exec comicstrunk-mysql mysqldump -uroot -padmin comicstrunk_dev > docs/backups/backup-pre-scan-capa-$(date +%Y%m%d-%H%M).sql
```

Crie o diretório se não existir:

```bash
mkdir -p docs/backups
```

Esperado: arquivo `.sql` criado, verificar tamanho > 1MB com `ls -lh docs/backups/`.

- [ ] **Step 3: Tirar backup de produção (se a feature for ser testada em produção)**

Se a feature será testada apenas em local, pular este step.

Se vai pra produção:

```bash
ssh ferna5257@server34.integrator.com.br "mysqldump -uferna5257_ct -p<senha> ferna5257_comicstrunk > /home/ferna5257/backup-pre-scan-capa-$(date +%Y%m%d).sql"
```

E baixar:

```bash
scp ferna5257@server34.integrator.com.br:/home/ferna5257/backup-pre-scan-capa-*.sql docs/backups/
```

- [ ] **Step 4: Adicionar backups ao .gitignore se ainda não estão**

```bash
grep -q "docs/backups/" .gitignore || echo "docs/backups/" >> .gitignore
```

Backup é grande e não deve ir pro git.

- [ ] **Step 5: Confirmar com Fernando que pode prosseguir**

"Backup feito em `<caminho>`. Posso prosseguir com a migration da Task 1?"

Aguardar confirmação explícita antes da Task 1.

---

### Task 1: Adicionar model `CoverScanLog` ao schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (adicionar bloco no fim das models de catálogo)
- Create: `apps/api/prisma/migrations/<timestamp>_add_cover_scan_logs/migration.sql` (gerada pelo Prisma)

**Contexto:** Tabela armazena cada scan: usuário, texto OCR, tokens parseados, número de edição candidato, candidatos retornados, escolha final. Alimenta análise de adoção e (na Fase 3) fine-tuning.

- [ ] **Step 1: Localizar onde adicionar o model**

Abra `apps/api/prisma/schema.prisma`. Procure a seção `// CATALOG` ou um lugar lógico (próximo de `CatalogEntry`). O model deve ficar próximo dos models do módulo catálogo.

- [ ] **Step 2: Adicionar o model**

Cole este bloco no schema, próximo ao final da seção de catálogo:

```prisma
// ============================================================================
// COVER SCAN (busca de capa por foto — Fase 1 do plano scan-capa)
// ============================================================================

model CoverScanLog {
  id                 String   @id @default(cuid())
  userId             String   @map("user_id")
  rawText            String   @map("raw_text") @db.Text
  ocrTokens          String   @map("ocr_tokens") @db.Text  // tokens parseados, separados por espaço
  candidateNumber    Int?     @map("candidate_number")     // número de edição extraído via regex (se houver)
  candidatesShown    String   @map("candidates_shown") @db.Text // JSON com [{id, title, score}]
  chosenEntryId      String?  @map("chosen_entry_id")     // catalogEntryId escolhido (null = nenhum)
  durationMs         Int?     @map("duration_ms")          // tempo total de processamento (cliente reporta opcional)
  createdAt          DateTime @default(now()) @map("created_at")

  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  chosenEntry CatalogEntry?  @relation(fields: [chosenEntryId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@map("cover_scan_logs")
}
```

- [ ] **Step 3: Adicionar relações inversas em `User` e `CatalogEntry`**

Localize o model `User` (perto da linha 182) e adicione no bloco de relações:

```prisma
  coverScanLogs   CoverScanLog[]
```

Localize o model `CatalogEntry` (procure por `model CatalogEntry {`) e adicione no bloco de relações:

```prisma
  coverScanLogsChosen CoverScanLog[]
```

- [ ] **Step 4: Gerar migration**

```bash
corepack pnpm --filter api db:migrate
```

Quando perguntar nome da migration, digite: `add_cover_scan_logs`

Esperado: prisma cria diretório `apps/api/prisma/migrations/<timestamp>_add_cover_scan_logs/` com `migration.sql`. Output termina com "✔ Generated Prisma Client".

- [ ] **Step 5: Verificar migration aplicada**

```bash
docker exec comicstrunk-mysql mysql -uroot -padmin comicstrunk_dev -e "DESCRIBE cover_scan_logs;"
```

Esperado: lista de colunas com `id, user_id, raw_text, ocr_tokens, candidate_number, candidates_shown, chosen_entry_id, duration_ms, created_at`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add cover_scan_logs table for cover photo search

Tabela registra cada scan: usuário, texto OCR, candidatos
retornados, escolha final. Alimenta rate limit (30/dia) e
análise de adoção da Fase 1 da feature scan-capa.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Criar contract Zod para o endpoint

**Files:**
- Create: `packages/contracts/src/cover-scan.ts`
- Modify: `packages/contracts/src/index.ts`

**Contexto:** Schema compartilhado entre frontend e backend para garantir tipagem do request/response.

- [ ] **Step 1: Criar arquivo de contract**

Crie `packages/contracts/src/cover-scan.ts` com este conteúdo:

```typescript
import { z } from 'zod';

// === Request schema ===

export const coverScanSearchSchema = z.object({
  rawText: z.string().min(1, 'Texto OCR não pode ser vazio').max(5000),
  ocrTokens: z.array(z.string().min(1).max(50)).min(1).max(50),
  candidateNumber: z.number().int().positive().max(99999).optional(),
  durationMs: z.number().int().nonnegative().max(600000).optional(),
});
export type CoverScanSearchInput = z.infer<typeof coverScanSearchSchema>;

// === Response candidate schema ===

export const coverScanCandidateSchema = z.object({
  id: z.string(),
  slug: z.string().nullable(),
  title: z.string(),
  publisher: z.string().nullable(),
  editionNumber: z.number().int().nullable(),
  coverImageUrl: z.string().nullable(),
  score: z.number(),
});
export type CoverScanCandidate = z.infer<typeof coverScanCandidateSchema>;

export const coverScanSearchResponseSchema = z.object({
  candidates: z.array(coverScanCandidateSchema),
  scanLogId: z.string(),
});
export type CoverScanSearchResponse = z.infer<typeof coverScanSearchResponseSchema>;

// === Choose endpoint (informa qual candidato o usuário escolheu) ===

export const coverScanChooseSchema = z.object({
  scanLogId: z.string().min(1),
  chosenEntryId: z.string().nullable(),
});
export type CoverScanChooseInput = z.infer<typeof coverScanChooseSchema>;

// === Daily limit constant ===

export const COVER_SCAN_DAILY_LIMIT_DEFAULT = 30;
```

- [ ] **Step 2: Re-exportar do index**

Abra `packages/contracts/src/index.ts` e adicione no fim (ou na ordem alfabética com os outros exports):

```typescript
export * from './cover-scan';
```

- [ ] **Step 3: Build contracts**

```bash
corepack pnpm --filter contracts build
```

Esperado: `packages/contracts/dist/` atualizado, sem erros TypeScript.

- [ ] **Step 4: Verificar tipos no API e Web**

```bash
corepack pnpm --filter api type-check
corepack pnpm --filter web type-check
```

Esperado: ambos passam sem erros (eles ainda não usam os novos tipos, mas devem compilar).

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/cover-scan.ts packages/contracts/src/index.ts packages/contracts/dist/
git commit -m "feat(contracts): add cover-scan schemas

Schema do request/response do endpoint POST /cover-scan/search.
Inclui constante COVER_SCAN_DAILY_LIMIT_DEFAULT=30.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: TDD — teste falhando para o endpoint de busca (estrutura mínima)

**Files:**
- Create: `apps/api/src/__tests__/cover-scan/cover-scan.test.ts`

**Contexto:** Antes de implementar, criar teste que descreve o comportamento desejado e ver falhar.

- [ ] **Step 1: Criar diretório e arquivo de teste**

```bash
mkdir -p apps/api/src/__tests__/cover-scan
```

- [ ] **Step 2: Escrever o primeiro teste — endpoint requer auth**

Crie `apps/api/src/__tests__/cover-scan/cover-scan.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_USER } from '../setup';

const prisma = new PrismaClient();

let userToken: string;
let userId: string;
const createdLogIds: string[] = [];

beforeAll(async () => {
  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;
  userId = userLogin.userId;
});

afterAll(async () => {
  if (createdLogIds.length > 0) {
    await prisma.coverScanLog.deleteMany({ where: { id: { in: createdLogIds } } });
  }
  await prisma.$disconnect();
});

describe('POST /api/v1/cover-scan/search', () => {
  it('returns 401 without auth token', async () => {
    const res = await request
      .post('/api/v1/cover-scan/search')
      .send({ rawText: 'Batman 1', ocrTokens: ['Batman', '1'] });

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Rodar o teste para ver falhar**

```bash
corepack pnpm --filter api test -- cover-scan
```

Esperado: o teste falha com `expected 404 to be 401` (ou similar) — porque a rota ainda não existe.

- [ ] **Step 4: Criar estrutura mínima do módulo (rota + service vazios)**

Criar `apps/api/src/modules/cover-scan/cover-scan.service.ts`:

```typescript
import { prisma } from '../../shared/lib/prisma';
import type {
  CoverScanSearchInput,
  CoverScanSearchResponse,
} from '@comicstrunk/contracts';

export async function searchByText(
  _userId: string,
  _input: CoverScanSearchInput,
): Promise<CoverScanSearchResponse> {
  // Implementação completa virá nas Tasks 4 e 5
  return { candidates: [], scanLogId: '' };
}
```

Criar `apps/api/src/modules/cover-scan/cover-scan.routes.ts`:

```typescript
import { Router, type Request, type Response, type NextFunction } from 'express';
import { coverScanSearchSchema } from '@comicstrunk/contracts';
import type { CoverScanSearchInput } from '@comicstrunk/contracts';
import { authenticate } from '../../shared/middleware/authenticate';
import { validate } from '../../shared/middleware/validate';
import { sendSuccess } from '../../shared/utils/response';
import * as coverScanService from './cover-scan.service';

const router = Router();

router.post(
  '/search',
  authenticate,
  validate(coverScanSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CoverScanSearchInput;
      const result = await coverScanService.searchByText(req.user!.userId, input);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export const coverScanRoutes = router;
```

- [ ] **Step 5: Registrar rota no `create-app.ts`**

Abra `apps/api/src/create-app.ts`. Encontre o bloco de imports de routes (linhas ~16-40) e adicione:

```typescript
import { coverScanRoutes } from './modules/cover-scan/cover-scan.routes';
```

Depois encontre a seção `// API v1 routes` (linha ~283) e adicione (em ordem lógica, perto de `catalog`):

```typescript
app.use('/api/v1/cover-scan', coverScanRoutes);
```

- [ ] **Step 6: Rodar teste novamente para verificar que passa**

```bash
corepack pnpm --filter api test -- cover-scan
```

Esperado: 1 test passing (o teste de 401).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/cover-scan apps/api/src/create-app.ts apps/api/src/__tests__/cover-scan
git commit -m "feat(cover-scan): add empty module and auth-required test

Estrutura mínima do módulo. Rota POST /cover-scan/search exige
authenticate. Implementação da busca virá nas próximas tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: TDD — busca textual retorna candidatos ranqueados

**Files:**
- Modify: `apps/api/src/__tests__/cover-scan/cover-scan.test.ts`
- Modify: `apps/api/src/modules/cover-scan/cover-scan.service.ts`

**Contexto:** Implementar a lógica de busca: tokens viram filtros AND com OR entre title/publisher (mesmo padrão de `searchCatalog`), com boost se `editionNumber` bater. Retorna top 8.

- [ ] **Step 1: Adicionar teste — busca encontra entry existente**

Em `apps/api/src/__tests__/cover-scan/cover-scan.test.ts`, dentro do mesmo `describe`, adicione:

```typescript
  it('returns candidates ranked by token match', async () => {
    // Cria entry de teste
    const entry = await prisma.catalogEntry.create({
      data: {
        title: 'Batman: Ano Um',
        publisher: 'Panini',
        editionNumber: 1,
        approvalStatus: 'APPROVED',
      },
    });

    try {
      const res = await request
        .post('/api/v1/cover-scan/search')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rawText: 'BATMAN ANO UM PANINI 1',
          ocrTokens: ['Batman', 'Ano', 'Um', 'Panini'],
          candidateNumber: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.candidates).toBeInstanceOf(Array);
      expect(res.body.data.candidates.length).toBeGreaterThan(0);

      const found = res.body.data.candidates.find((c: { id: string }) => c.id === entry.id);
      expect(found).toBeDefined();
      expect(found.title).toBe('Batman: Ano Um');
      expect(found.score).toBeGreaterThan(0);

      expect(typeof res.body.data.scanLogId).toBe('string');
      expect(res.body.data.scanLogId.length).toBeGreaterThan(0);
      createdLogIds.push(res.body.data.scanLogId);
    } finally {
      await prisma.catalogEntry.delete({ where: { id: entry.id } });
    }
  });
```

- [ ] **Step 2: Rodar teste para ver falhar**

```bash
corepack pnpm --filter api test -- cover-scan
```

Esperado: novo teste falha com algo como `expected length 0 to be > 0` (service retorna candidates vazio).

- [ ] **Step 3: Implementar `searchByText`**

Substitua o conteúdo de `apps/api/src/modules/cover-scan/cover-scan.service.ts`:

```typescript
import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { localCoverUrl, LOCAL_API_BASE_URL } from '../../shared/lib/cloudinary';
import type {
  CoverScanSearchInput,
  CoverScanSearchResponse,
  CoverScanCandidate,
} from '@comicstrunk/contracts';

const TOP_N = 8;

// === Token normalization ===

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '') // strip punctuation
    .trim();
}

function pickSearchableTokens(tokens: string[]): string[] {
  return Array.from(
    new Set(
      tokens
        .map(normalizeToken)
        .filter((t) => t.length >= 3) // descartar tokens muito curtos
        .slice(0, 12), // limita explosão de queries
    ),
  );
}

// === Cover URL resolver (igual padrão de catalog.service) ===

function resolveCoverUrl(
  coverImageUrl: string | null,
  coverFileName: string | null,
): string | null {
  if (coverFileName) return localCoverUrl(coverFileName);
  if (coverImageUrl?.startsWith(LOCAL_API_BASE_URL) && coverImageUrl.includes('/uploads/')) {
    const filename = coverImageUrl.split('/').pop();
    if (filename) return localCoverUrl(filename);
  }
  if (coverImageUrl && !coverImageUrl.startsWith(LOCAL_API_BASE_URL) && coverImageUrl.includes('/uploads/')) {
    const filename = coverImageUrl.split('/').pop();
    if (filename) return localCoverUrl(filename);
  }
  return coverImageUrl;
}

// === Score: 1 ponto por hit em title; 0.5 por hit em publisher; +5 se editionNumber bate ===

function scoreCandidate(
  entry: { title: string; publisher: string | null; editionNumber: number | null },
  tokens: string[],
  candidateNumber: number | undefined,
): number {
  const titleLower = entry.title.toLowerCase();
  const publisherLower = entry.publisher?.toLowerCase() ?? '';
  let score = 0;

  for (const token of tokens) {
    if (titleLower.includes(token)) score += 1;
    if (publisherLower.includes(token)) score += 0.5;
  }

  if (candidateNumber !== undefined && entry.editionNumber === candidateNumber) {
    score += 5;
  }

  return score;
}

// === Main service ===

export async function searchByText(
  userId: string,
  input: CoverScanSearchInput,
): Promise<CoverScanSearchResponse> {
  const tokens = pickSearchableTokens(input.ocrTokens);

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
      take: 80, // pega bastante e ranqueia em memória
    });

    candidates = entries
      .map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        publisher: e.publisher,
        editionNumber: e.editionNumber,
        coverImageUrl: resolveCoverUrl(e.coverImageUrl, e.coverFileName),
        score: scoreCandidate(e, tokens, input.candidateNumber),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N);
  }

  // Persistir log
  const log = await prisma.coverScanLog.create({
    data: {
      userId,
      rawText: input.rawText,
      ocrTokens: input.ocrTokens.join(' '),
      candidateNumber: input.candidateNumber ?? null,
      candidatesShown: JSON.stringify(
        candidates.map((c) => ({ id: c.id, title: c.title, score: c.score })),
      ),
      durationMs: input.durationMs ?? null,
    },
    select: { id: true },
  });

  return { candidates, scanLogId: log.id };
}
```

- [ ] **Step 4: Rodar teste para verificar que passa**

```bash
corepack pnpm --filter api test -- cover-scan
```

Esperado: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/cover-scan/cover-scan.service.ts apps/api/src/__tests__/cover-scan/cover-scan.test.ts
git commit -m "feat(cover-scan): implement token-based search with scoring

Tokens normalizados (lowercase, sem acento, min 3 chars). AND
entre tokens, OR entre title/publisher. Score = hits + 5 se
editionNumber bate. Top 8 retornados. Log persistido.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: TDD — rate limit de 30 scans/dia/usuário

**Files:**
- Modify: `apps/api/src/__tests__/cover-scan/cover-scan.test.ts`
- Modify: `apps/api/src/modules/cover-scan/cover-scan.service.ts`
- Modify: `apps/api/src/modules/cover-scan/cover-scan.routes.ts`
- Modify: `apps/api/.env.example` (documentar nova env var)

**Contexto:** Decisão 8.3 da spec — limite de 30/dia por usuário, configurável via env. Conta entradas do usuário em `cover_scan_logs` nas últimas 24h. Usar `TooManyRequestsError`.

- [ ] **Step 1: Adicionar teste de rate limit**

Em `apps/api/src/__tests__/cover-scan/cover-scan.test.ts`, dentro do `describe`, adicione:

```typescript
  it('rejects with 429 when daily limit exceeded', async () => {
    // Set limit baixo via env temporariamente
    const originalLimit = process.env.COVER_SCAN_DAILY_LIMIT;
    process.env.COVER_SCAN_DAILY_LIMIT = '2';

    try {
      // Limpar logs do user pra começar zerado
      await prisma.coverScanLog.deleteMany({ where: { userId } });

      // 2 scans permitidos
      for (let i = 0; i < 2; i++) {
        const res = await request
          .post('/api/v1/cover-scan/search')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ rawText: 'X', ocrTokens: ['xxx'] });
        expect(res.status).toBe(200);
        if (res.body.data?.scanLogId) createdLogIds.push(res.body.data.scanLogId);
      }

      // 3º deve ser bloqueado
      const blocked = await request
        .post('/api/v1/cover-scan/search')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rawText: 'X', ocrTokens: ['xxx'] });
      expect(blocked.status).toBe(429);
      expect(blocked.body.error?.code).toBe('COVER_SCAN_LIMIT');
    } finally {
      if (originalLimit === undefined) {
        delete process.env.COVER_SCAN_DAILY_LIMIT;
      } else {
        process.env.COVER_SCAN_DAILY_LIMIT = originalLimit;
      }
    }
  });
```

- [ ] **Step 2: Rodar teste pra ver falhar**

```bash
corepack pnpm --filter api test -- cover-scan
```

Esperado: novo teste falha — o 3º request retorna 200 em vez de 429.

- [ ] **Step 3: Implementar verificação de rate limit**

Adicione no topo de `apps/api/src/modules/cover-scan/cover-scan.service.ts` (após os imports):

```typescript
import { TooManyRequestsError } from '../../shared/utils/api-error';
import { COVER_SCAN_DAILY_LIMIT_DEFAULT } from '@comicstrunk/contracts';

function getDailyLimit(): number {
  const raw = process.env.COVER_SCAN_DAILY_LIMIT;
  if (!raw) return COVER_SCAN_DAILY_LIMIT_DEFAULT;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : COVER_SCAN_DAILY_LIMIT_DEFAULT;
}

export async function assertWithinDailyLimit(userId: string): Promise<void> {
  const limit = getDailyLimit();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.coverScanLog.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (count >= limit) {
    throw new TooManyRequestsError(
      `Limite de ${limit} scans por dia atingido. Tente novamente em 24h.`,
      'COVER_SCAN_LIMIT',
    );
  }
}
```

E no início de `searchByText`, antes de qualquer outra coisa, chame:

```typescript
export async function searchByText(
  userId: string,
  input: CoverScanSearchInput,
): Promise<CoverScanSearchResponse> {
  await assertWithinDailyLimit(userId);
  // ... resto da implementação atual
```

- [ ] **Step 4: Verificar assinatura do TooManyRequestsError**

```bash
grep -n "class TooManyRequestsError" apps/api/src/shared/utils/api-error.ts
```

Verificar se o construtor aceita `(message, code)`. Se aceitar `(message, details)` apenas (sem code), ajustar para usar a forma compatível. Se necessário, ler o arquivo `apps/api/src/shared/utils/api-error.ts` completo.

Se o erro não aceita um `code` no construtor, use:

```typescript
throw new TooManyRequestsError(`Limite de ${limit} scans por dia atingido. Tente novamente em 24h.`);
```

E o teste deve verificar `blocked.body.error?.message` em vez de `code`.

- [ ] **Step 5: Documentar env var**

Abra `apps/api/.env.example` e adicione no fim (em uma seção apropriada):

```bash
# Cover scan (busca de capa por foto) — Fase 1
COVER_SCAN_DAILY_LIMIT=30
```

- [ ] **Step 6: Rodar testes**

```bash
corepack pnpm --filter api test -- cover-scan
```

Esperado: 3 tests passing.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/cover-scan/cover-scan.service.ts apps/api/src/__tests__/cover-scan/cover-scan.test.ts apps/api/.env.example
git commit -m "feat(cover-scan): rate limit 30 scans/day per user

Limite configurável via COVER_SCAN_DAILY_LIMIT (default 30).
Conta logs do user nas últimas 24h. Retorna 429 com
code=COVER_SCAN_LIMIT quando excede.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: TDD — endpoint para registrar escolha do usuário

**Files:**
- Modify: `apps/api/src/__tests__/cover-scan/cover-scan.test.ts`
- Modify: `apps/api/src/modules/cover-scan/cover-scan.service.ts`
- Modify: `apps/api/src/modules/cover-scan/cover-scan.routes.ts`

**Contexto:** Após o usuário ver candidatos e escolher um (ou nenhum), atualizar `cover_scan_logs.chosen_entry_id`. Endpoint `POST /api/v1/cover-scan/choose`. Permite medir taxa de acerto.

- [ ] **Step 1: Adicionar teste**

Em `apps/api/src/__tests__/cover-scan/cover-scan.test.ts`, adicione:

```typescript
  it('records user choice and updates chosen_entry_id', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        title: 'Test Choice Entry',
        publisher: 'Test',
        approvalStatus: 'APPROVED',
      },
    });

    try {
      // Faz scan inicial
      const search = await request
        .post('/api/v1/cover-scan/search')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rawText: 'Test', ocrTokens: ['Test'] });

      const scanLogId = search.body.data.scanLogId;
      createdLogIds.push(scanLogId);

      // Registra escolha
      const choose = await request
        .post('/api/v1/cover-scan/choose')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ scanLogId, chosenEntryId: entry.id });

      expect(choose.status).toBe(200);

      // Confirma persistência
      const log = await prisma.coverScanLog.findUnique({ where: { id: scanLogId } });
      expect(log?.chosenEntryId).toBe(entry.id);
    } finally {
      await prisma.catalogEntry.delete({ where: { id: entry.id } });
    }
  });

  it('rejects choose if scanLog belongs to another user', async () => {
    // Cria log direto para outro user (admin)
    const adminLogin = await loginAs('admin@comicstrunk.com', 'Admin123!');
    const log = await prisma.coverScanLog.create({
      data: {
        userId: adminLogin.userId,
        rawText: 'X',
        ocrTokens: 'x',
        candidatesShown: '[]',
      },
    });
    createdLogIds.push(log.id);

    try {
      const res = await request
        .post('/api/v1/cover-scan/choose')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ scanLogId: log.id, chosenEntryId: null });

      expect(res.status).toBe(404); // não revela existência alheia
    } finally {
      // cleanup feito no afterAll
    }
  });
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
corepack pnpm --filter api test -- cover-scan
```

Esperado: 2 testes novos falham (rota /choose não existe ainda → 404).

- [ ] **Step 3: Implementar service**

Em `apps/api/src/modules/cover-scan/cover-scan.service.ts`, adicione no fim:

```typescript
import { NotFoundError } from '../../shared/utils/api-error';
import type { CoverScanChooseInput } from '@comicstrunk/contracts';

export async function recordChoice(
  userId: string,
  input: CoverScanChooseInput,
): Promise<void> {
  const log = await prisma.coverScanLog.findUnique({
    where: { id: input.scanLogId },
    select: { id: true, userId: true },
  });

  if (!log || log.userId !== userId) {
    throw new NotFoundError('Scan log não encontrado');
  }

  if (input.chosenEntryId) {
    const entry = await prisma.catalogEntry.findUnique({
      where: { id: input.chosenEntryId },
      select: { id: true },
    });
    if (!entry) {
      throw new NotFoundError('Catalog entry não encontrado');
    }
  }

  await prisma.coverScanLog.update({
    where: { id: input.scanLogId },
    data: { chosenEntryId: input.chosenEntryId },
  });
}
```

E confira que o import `NotFoundError` foi consolidado com os imports do topo do arquivo (não duplicar).

- [ ] **Step 4: Adicionar rota**

Em `apps/api/src/modules/cover-scan/cover-scan.routes.ts`, adicione antes do `export`:

```typescript
import { coverScanChooseSchema } from '@comicstrunk/contracts';
import type { CoverScanChooseInput } from '@comicstrunk/contracts';

router.post(
  '/choose',
  authenticate,
  validate(coverScanChooseSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CoverScanChooseInput;
      await coverScanService.recordChoice(req.user!.userId, input);
      sendSuccess(res, { ok: true });
    } catch (err) {
      next(err);
    }
  },
);
```

(Ajustar imports duplicados — `coverScanChooseSchema` e `CoverScanChooseInput` devem ir junto com os outros imports do `@comicstrunk/contracts` no topo do arquivo.)

- [ ] **Step 5: Rodar testes**

```bash
corepack pnpm --filter api test -- cover-scan
```

Esperado: 5 tests passing.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/cover-scan apps/api/src/__tests__/cover-scan
git commit -m "feat(cover-scan): record user choice via POST /choose

Endpoint atualiza chosen_entry_id no log do scan. Verifica
ownership antes de atualizar. Permite medir taxa de acerto
da busca para análise futura.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Frontend — instalar Tesseract e criar API client

**Files:**
- Modify: `apps/web/package.json` (via pnpm add)
- Create: `apps/web/src/lib/api/cover-scan.ts`

- [ ] **Step 1: Adicionar dependência Tesseract.js**

```bash
corepack pnpm --filter web add tesseract.js
```

Esperado: `tesseract.js` adicionado em `dependencies` do `apps/web/package.json`. Versão 5.x.

- [ ] **Step 2: Criar cliente HTTP**

Crie `apps/web/src/lib/api/cover-scan.ts`:

```typescript
import apiClient from './client';
import type {
  CoverScanSearchInput,
  CoverScanSearchResponse,
  CoverScanChooseInput,
} from '@comicstrunk/contracts';

export async function searchByText(
  input: CoverScanSearchInput,
): Promise<CoverScanSearchResponse> {
  const { data } = await apiClient.post('/cover-scan/search', input);
  return data.data;
}

export async function recordChoice(input: CoverScanChooseInput): Promise<void> {
  await apiClient.post('/cover-scan/choose', input);
}
```

- [ ] **Step 3: Verificar tipos**

```bash
corepack pnpm --filter web type-check
```

Esperado: passa sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/api/cover-scan.ts
# também o pnpm-lock.yaml na raiz
git add pnpm-lock.yaml
git commit -m "feat(web): add tesseract.js dep and cover-scan API client

tesseract.js 5.x para OCR no browser. Cliente HTTP wrapper
sobre os endpoints /cover-scan/search e /choose.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Frontend — componente CoverPhotoScanner

**Files:**
- Create: `apps/web/src/components/features/catalog/cover-photo-scanner.tsx`

**Contexto:** Componente reutilizável com 3 estágios: (1) escolher foto / tirar foto, (2) extrair OCR + mostrar texto detectado, (3) listar candidatos e permitir escolha. Lazy-load do Tesseract.

- [ ] **Step 1: Criar o componente**

Crie `apps/web/src/components/features/catalog/cover-photo-scanner.tsx`:

```tsx
'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { searchByText, recordChoice } from '@/lib/api/cover-scan';
import type {
  CoverScanCandidate,
  CoverScanSearchInput,
} from '@comicstrunk/contracts';

type Stage = 'idle' | 'reading' | 'searching' | 'results' | 'error';

interface Props {
  onChoose?: (candidate: CoverScanCandidate) => void;
  onClose?: () => void;
}

function extractCandidateNumber(text: string): number | undefined {
  // procura "#12", "Nº 12", "12" no início ou após "edição/numero"
  const match = text.match(/(?:#|n[oº]\.?\s*|edi[çc][aã]o\s*)?(\d{1,4})\b/i);
  if (!match) return undefined;
  const n = parseInt(match[1], 10);
  return n > 0 && n < 10000 ? n : undefined;
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s\n\r\t.,!?;:()\[\]{}'"]+/)
    .filter((t) => t.length >= 3 && t.length <= 50)
    .slice(0, 50);
}

export function CoverPhotoScanner({ onChoose, onClose }: Props) {
  const t = useTranslations('scanCapa');
  const [stage, setStage] = useState<Stage>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [candidates, setCandidates] = useState<CoverScanCandidate[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [scanLogId, setScanLogId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startedAtRef = useRef<number>(0);

  async function handleFile(file: File) {
    setStage('reading');
    setPreviewUrl(URL.createObjectURL(file));
    startedAtRef.current = Date.now();

    try {
      // Lazy import — só baixa o Tesseract no clique do usuário
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(['por', 'eng'], 1, {
        logger: () => {}, // silencia console
      });

      const { data } = await worker.recognize(file);
      const rawText = data.text || '';
      await worker.terminate();

      setExtractedText(rawText);

      const tokens = tokenize(rawText);
      if (tokens.length === 0) {
        setErrorMsg(t('errorNoText'));
        setStage('error');
        return;
      }

      setStage('searching');
      const candidateNumber = extractCandidateNumber(rawText);
      const input: CoverScanSearchInput = {
        rawText: rawText.slice(0, 5000),
        ocrTokens: tokens,
        ...(candidateNumber !== undefined && { candidateNumber }),
        durationMs: Date.now() - startedAtRef.current,
      };

      const result = await searchByText(input);
      setCandidates(result.candidates);
      setScanLogId(result.scanLogId);
      setStage('results');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setErrorMsg(msg);
      setStage('error');
    }
  }

  async function handleChoose(candidate: CoverScanCandidate | null) {
    if (scanLogId) {
      try {
        await recordChoice({ scanLogId, chosenEntryId: candidate?.id ?? null });
      } catch {
        // não bloqueia o fluxo se falhar — choice é só telemetria
      }
    }
    if (candidate) {
      onChoose?.(candidate);
    }
  }

  function reset() {
    setStage('idle');
    setPreviewUrl(null);
    setExtractedText('');
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
          <Button onClick={() => fileInputRef.current?.click()}>
            {t('chooseFile')}
          </Button>
        </div>
      )}

      {(stage === 'reading' || stage === 'searching') && (
        <div className="flex flex-col items-center gap-3">
          {previewUrl && (
            <Image
              src={previewUrl}
              alt={t('preview')}
              width={200}
              height={300}
              className="rounded border object-contain"
              unoptimized
            />
          )}
          <p className="text-sm text-muted-foreground">
            {stage === 'reading' ? t('reading') : t('searching')}
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
                    {c.coverImageUrl && (
                      <Image
                        src={c.coverImageUrl}
                        alt={c.title}
                        width={150}
                        height={220}
                        className="aspect-[2/3] w-full rounded object-cover"
                        unoptimized
                      />
                    )}
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

      {onClose && stage !== 'reading' && stage !== 'searching' && (
        <Button variant="ghost" onClick={onClose} className="w-full">
          {t('close')}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
corepack pnpm --filter web type-check
```

Esperado: erros sobre chaves de tradução faltando (resolvidas na Task 9). Outros erros não devem aparecer.

Se aparecer erro de tipos não relacionado a `useTranslations`, corrigir antes de prosseguir.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/features/catalog/cover-photo-scanner.tsx
git commit -m "feat(web): CoverPhotoScanner component with Tesseract OCR

Componente em 4 estágios: idle (escolher foto), reading (OCR
no browser via Tesseract), searching (chama API), results
(grid de candidatos). Tesseract carregado via lazy import
(só baixa modelo no clique). Tokens normalizados e número de
edição extraído via regex.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Frontend — adicionar traduções pt-BR

**Files:**
- Modify: `apps/web/src/messages/pt-BR.json`

- [ ] **Step 1: Localizar onde inserir**

Abra `apps/web/src/messages/pt-BR.json`. As chaves estão em ordem alfabética nos níveis raiz. Adicione um novo bloco `scanCapa` (chaves ASCII, valores podem ter acentos — regra do projeto):

- [ ] **Step 2: Adicionar bloco**

Insira (em ordem alfabética entre as chaves raiz existentes):

```json
  "scanCapa": {
    "title": "Buscar gibi por foto da capa",
    "subtitle": "Tire uma foto ou envie uma imagem da capa. Vamos achar no catálogo.",
    "uploadHint": "Toque para tirar foto ou enviar imagem da capa",
    "chooseFile": "Escolher foto",
    "preview": "Pré-visualização",
    "reading": "Lendo a capa...",
    "searching": "Procurando no catálogo...",
    "foundCount": "{count, plural, =0 {Nenhum candidato} =1 {1 candidato encontrado} other {# candidatos encontrados}}",
    "noMatches": "Nenhum gibi do catálogo bateu com o texto detectado. Tente outra foto ou busque manualmente.",
    "noneMatch": "Nenhum dos resultados é o que procuro",
    "tryAgain": "Tentar de novo",
    "errorNoText": "Não consegui ler texto na imagem. Tente uma foto mais nítida ou com melhor iluminação.",
    "errorGeneric": "Algo deu errado ao processar a imagem.",
    "close": "Fechar",
    "menuLabel": "Buscar por foto",
    "rateLimitMessage": "Você atingiu o limite de scans diários. Tente novamente em 24h."
  },
```

- [ ] **Step 3: Verificar JSON valido e tipos**

```bash
corepack pnpm --filter web type-check
```

Esperado: passa sem erros (next-intl gera tipos automaticamente).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/messages/pt-BR.json
git commit -m "feat(web): add pt-BR translations for scanCapa

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Frontend — página `/scan-capa` e link no menu

**Files:**
- Create: `apps/web/src/app/[locale]/(collector)/scan-capa/page.tsx`
- Modify: `apps/web/src/components/layout/nav-config.ts`

**Contexto:** Decisão 8.1 da spec → ambos: página dedicada + reuso no botão "Adicionar à coleção". Esta task faz a página dedicada e link no menu. O reuso no fluxo de coleção fica na Task 11.

- [ ] **Step 1: Criar a página**

Crie `apps/web/src/app/[locale]/(collector)/scan-capa/page.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CoverPhotoScanner } from '@/components/features/catalog/cover-photo-scanner';
import type { CoverScanCandidate } from '@comicstrunk/contracts';

export default function ScanCapaPage() {
  const t = useTranslations('scanCapa');
  const router = useRouter();

  function handleChoose(candidate: CoverScanCandidate) {
    // Encaminha pra detalhe do catálogo (usuário decide adicionar à coleção lá)
    const target = candidate.slug
      ? `/catalog/${candidate.slug}`
      : `/catalog/${candidate.id}`;
    router.push(target);
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>

      <CoverPhotoScanner onChoose={handleChoose} />
    </div>
  );
}
```

- [ ] **Step 2: Adicionar link no menu collector**

Abra `apps/web/src/components/layout/nav-config.ts`. Examine o arquivo para entender a estrutura (provavelmente arrays de `{ href, labelKey, icon }`). Adicione um item para o menu do collector. Exemplo (ajuste sintaxe ao padrão existente):

Procure no arquivo o bloco do menu collector — deve haver itens tipo `/collection`, `/wishlist`, etc.

Adicione:

```typescript
  { href: '/scan-capa', labelKey: 'scanCapa.menuLabel', icon: 'Camera' },
```

(Ajuste o nome da chave `icon` ao padrão do arquivo — pode ser referência a um componente Lucide React ou string.)

- [ ] **Step 3: Iniciar o dev server e validar visualmente**

```bash
corepack pnpm dev
```

Em outro terminal, abra http://localhost:3000/pt-BR/scan-capa (logado).

Verificar:
- Página carrega sem erros no console.
- Botão "Escolher foto" funciona.
- Ao escolher uma foto, status muda para "Lendo a capa...".
- Após OCR, mostra "Procurando no catálogo..." e depois grid de candidatos (ou mensagem de "nenhum candidato").
- Link no menu collector aparece e leva pra /scan-capa.

Tirar screenshot ou descrever o resultado para o Fernando.

- [ ] **Step 4: Parar dev server e commit**

```bash
git add apps/web/src/app/[locale]/(collector)/scan-capa apps/web/src/components/layout/nav-config.ts
git commit -m "feat(web): /scan-capa page and collector menu link

Página dedicada para busca por foto. Encaminha o usuário pro
detalhe do gibi escolhido. Link no menu collector permite
acesso rápido.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Reuso do scanner no fluxo "Adicionar à coleção"

**Files:**
- Identify and modify: arquivo do modal/página de adicionar à coleção (provavelmente `apps/web/src/app/[locale]/(collector)/collection/add/...` ou similar)

- [ ] **Step 1: Localizar o ponto de entrada do "Adicionar à coleção"**

```bash
grep -rn "Adicionar.*Coleção\|addCollection\|add-to-collection" apps/web/src --include="*.tsx" -l
```

Identifique o componente onde hoje o usuário busca o gibi para adicionar (provavelmente um campo de busca textual).

- [ ] **Step 2: Adicionar botão "Buscar por foto" ao lado do campo de busca atual**

No componente identificado, importe e renderize o `CoverPhotoScanner` dentro de um Dialog (shadcn/ui) que abre ao clicar no botão. Quando o usuário escolhe um candidato, o handler preenche o item da coleção como se ele tivesse buscado e clicado manualmente.

Exemplo de patch (adapte ao componente real):

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Camera } from 'lucide-react';
import { CoverPhotoScanner } from '@/components/features/catalog/cover-photo-scanner';
import type { CoverScanCandidate } from '@comicstrunk/contracts';

// Dentro do componente:
const [scannerOpen, setScannerOpen] = useState(false);

function handleScannerChoose(candidate: CoverScanCandidate) {
  setScannerOpen(false);
  // Reaproveitar handler já existente que adiciona um catalogEntry à coleção
  // Pode ser: addToCollection({ catalogEntryId: candidate.id })
  // ou navegar para um wizard que pré-preenche o item
}

// No JSX:
<Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
  <DialogTrigger asChild>
    <Button variant="outline" size="icon" title={t('scanCapa.menuLabel')}>
      <Camera className="size-4" />
    </Button>
  </DialogTrigger>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>{t('scanCapa.title')}</DialogTitle>
    </DialogHeader>
    <CoverPhotoScanner
      onChoose={handleScannerChoose}
      onClose={() => setScannerOpen(false)}
    />
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Testar no dev server**

```bash
corepack pnpm dev
```

Abrir http://localhost:3000/pt-BR/collection (ou onde fica o "adicionar à coleção"), clicar no novo botão de câmera, verificar que abre o scanner em modal e que escolher um candidato adiciona à coleção.

- [ ] **Step 4: Commit**

```bash
git add <arquivo modificado>
git commit -m "feat(web): integrate cover scanner into 'add to collection' flow

Botão de câmera ao lado do campo de busca abre o scanner em
modal. Escolher um candidato adiciona à coleção via fluxo
existente.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Verificação final, build, lint

**Files:** nenhum.

- [ ] **Step 1: Rodar todos os testes do API**

```bash
corepack pnpm --filter api test
```

Esperado: todos os testes passam (incluindo os 5 do cover-scan).

- [ ] **Step 2: Rodar lint**

```bash
corepack pnpm lint
```

Esperado: sem erros.

- [ ] **Step 3: Rodar type-check global**

```bash
corepack pnpm type-check
```

Esperado: sem erros.

- [ ] **Step 4: Build completo**

```bash
corepack pnpm build
```

Esperado: builds completos (contracts → api → web), todos com sucesso.

- [ ] **Step 5: Smoke test manual**

Subir API + Web (`corepack pnpm dev`), logar como `vai_q_eh@yahoo.com.br` (senha `Ct@2026!Teste`), e:

1. Acessar `/pt-BR/scan-capa`.
2. Tirar/enviar uma foto de qualquer capa do catálogo (use foto de tela do detalhe de um gibi como teste).
3. Verificar que aparecem candidatos.
4. Clicar em um candidato → confirma redirect pro detalhe.
5. Voltar e tentar 31x para confirmar bloqueio (ou setar `COVER_SCAN_DAILY_LIMIT=2` no `.env` da API e fazer 3 scans).
6. Verificar `cover_scan_logs` na DB:
   ```bash
   docker exec comicstrunk-mysql mysql -uroot -padmin comicstrunk_dev \
     -e "SELECT id, raw_text, candidates_shown, chosen_entry_id, created_at FROM cover_scan_logs ORDER BY created_at DESC LIMIT 5;"
   ```

- [ ] **Step 6: Documentar resultado**

Reportar para o Fernando: "Fase 1 completa. X scans testados manualmente, taxa de match Y%. Próximo passo: dogfooding — usar a feature por uma semana e medir métricas no `cover_scan_logs` (taxa de escolha, taxa de 'nenhum candidato'). Se métricas baterem critério de promoção (≥ 30 scans/dia em 2 semanas OU > 40% sem candidato), iniciamos plano da Fase 2."

- [ ] **Step 7: Push da branch para PR**

```bash
git push -u origin feat/scan-capa-por-foto
```

Aguardar Fernando confirmar que pode abrir PR pra `develop`. Não abrir PR sem confirmação.

---

## Self-Review (executado durante a escrita do plano)

**Spec coverage:** revisei a spec seção a seção:
- ✅ Endpoint `POST /api/v1/cover-scan/search` (Task 3-5) — endpoint nomeado de forma diferente da spec (`/cover-scan/search` em vez de `/catalog/search-by-text`); justificado no header.
- ✅ Endpoint de escolha do candidato (Task 6) — não estava na spec mas é necessário pra logging.
- ✅ Tabela `cover_scan_logs` (Task 1) — campos cobrem o exigido + chosenEntryId.
- ✅ OCR no browser via Tesseract.js (Task 8) — lazy-loaded, captura via input file accept image/* capture.
- ✅ Página dedicada `/scan-capa` (Task 10).
- ✅ Reuso no "adicionar à coleção" (Task 11).
- ✅ Login obrigatório (Task 3 — `authenticate` middleware aplicado).
- ✅ Limite 30/dia configurável (Task 5 — `COVER_SCAN_DAILY_LIMIT`).
- ✅ Backup do banco antes de qualquer migration (Task 0 — bloqueante).
- ✅ Logging para alimentar Fase 3 (todas as Tasks 4-6 gravam em `cover_scan_logs`).
- ⚠️ Decisão 4 (foto opt-in) — Fase 1 NÃO armazena foto. Esse é o comportamento default decidido. Confirmado: Tasks 4 e 8 não enviam nem persistem o blob da foto.

**Placeholders:** sem TBD/TODO. Cada step tem código completo ou comando exato.

**Type consistency:** verifiquei nomes:
- `CoverScanLog.candidatesShown` (string) ↔ uso em service ↔ uso em test → OK.
- `searchByText(userId, input)` ↔ assinatura igual em service, route, test → OK.
- `recordChoice(userId, input)` ↔ assinatura igual → OK.
- `coverScanSearchSchema`, `coverScanChooseSchema`, `coverScanCandidateSchema`, `coverScanSearchResponseSchema` → exportados do contract, importados consistentemente.
- `COVER_SCAN_DAILY_LIMIT_DEFAULT` → exportado do contract (Task 2), usado no service (Task 5).

**Edge case identificada durante review:** Task 5 testa setando `process.env.COVER_SCAN_DAILY_LIMIT='2'` em runtime — isso funciona pra `getDailyLimit()` lê via `process.env` em cada chamada (não cacheia). Confirmado no código de Task 5 que usa `process.env.COVER_SCAN_DAILY_LIMIT` dentro da função, não no top-level.

**Edge case identificada:** o teste de "rejects choose if scanLog belongs to another user" (Task 6) usa `loginAs('admin@comicstrunk.com', 'Admin123!')` — credenciais hardcoded existem no projeto (memória `reference_admin_prod.md`).

---

## Execution Handoff

**Plan complete and saved to** [docs/superpowers/plans/2026-04-27-scan-capa-fase-1.md](docs/superpowers/plans/2026-04-27-scan-capa-fase-1.md).

Two execution options:

**1. Subagent-Driven (recommended)** — Eu despacho um subagent fresh por task, revisando entre tasks. Melhor pra qualidade, ritmo de iteração mais rápido em tasks isoladas.

**2. Inline Execution** — Executo as tasks nesta sessão usando executing-plans, em batches com checkpoints pra revisão.

Qual aprova?
