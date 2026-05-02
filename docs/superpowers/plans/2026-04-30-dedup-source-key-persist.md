# Dedup do catálogo: sourceKey-based persistence + blacklist — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar as decisões do `/admin/duplicates` (manter ambos / remover) imunes ao cron das 4h, persistindo via `source_key` (estável) em vez de `id` (volátil), e adicionando uma blacklist mínima de sourceKeys que impede reimport silencioso.

**Architecture:** Duas tabelas — `dismissed_duplicates` (renomeada de id → source_key) e `removed_source_keys` (blacklist nova). Filtro NOT EXISTS espelhado nos dois modos (`pattern`/`title`) da query GET. DELETE inclui INSERT IGNORE em removed_source_keys. Cron e cover-import consultam blacklist antes de criar.

**Tech Stack:** Prisma + MySQL (migration formal, não mais raw SQL), Express + Zod (admin.routes), Vitest + supertest (testes integração), pnpm 9.15 + Turborepo monorepo.

**Spec:** [`docs/superpowers/specs/2026-04-30-dedup-source-key-persist-design.md`](../specs/2026-04-30-dedup-source-key-persist-design.md)

---

## Pre-flight (Fernando faz, fora do código)

Antes da Task 1, em produção (cPanel SSH ou phpMyAdmin):

```sql
SHOW CREATE TABLE dismissed_duplicates;
SELECT COUNT(*) FROM dismissed_duplicates;
```

**Por quê:** confirmar schema atual (foi criada manualmente, sem migration). Output esperado: tabela com colunas `gcd_id` + `rika_id` + PK composta. Se schema diferir, ajustar Task 2.

**Resultado:** colar o output em comentário aqui ou em mensagem antes de começar Task 2.

---

## File Structure

**Criados (novos):**
- `apps/api/prisma/migrations/<TIMESTAMP>_dedup_source_key_persistence/migration.sql` — migration que cria `removed_source_keys` e nova `dismissed_duplicates`.
- `apps/api/src/__tests__/admin/duplicates.test.ts` — testes integração para o painel admin/duplicates.
- `apps/api/src/__tests__/admin/` — diretório novo (não existe hoje).

**Modificados:**
- `apps/api/prisma/schema.prisma` — adiciona `model DismissedDuplicate` e `model RemovedSourceKey`.
- `packages/contracts/src/admin.ts` — adiciona `dismissDuplicateSchema` + tipo.
- `apps/api/src/modules/admin/admin.routes.ts:212-381` — handler `POST /dismiss` recebe sourceKeys, `GET /duplicates` filtra NOT EXISTS nos dois modos, `DELETE /:id` adiciona INSERT IGNORE.
- `apps/api/src/modules/cover-scan/cover-import.service.ts:42-43` — adiciona lookup blacklist antes de `create`.
- `apps/api/scripts/sync-catalog.ts` — adiciona lookup blacklist nos dois loops (Rika e Panini) antes de `prisma.catalogEntry.create`.
- `apps/web/src/app/[locale]/(admin)/admin/duplicates/page.tsx:291-294` — POST envia `sourceKeyA`/`sourceKeyB` em vez de `gcdId`/`rikaId`.

---

## Task 1: Schema Zod no contracts package

**Files:**
- Modify: `packages/contracts/src/admin.ts` (adicionar no fim do arquivo)

- [ ] **Step 1: Adicionar schema Zod**

Acrescentar no final de `packages/contracts/src/admin.ts`:

```ts
// === Admin Dismiss Duplicate Pair Schema ===

export const dismissDuplicateSchema = z.object({
  sourceKeyA: z.string().min(1).max(255),
  sourceKeyB: z.string().min(1).max(255),
});

export type DismissDuplicateInput = z.infer<typeof dismissDuplicateSchema>;
```

- [ ] **Step 2: Build contracts**

```bash
corepack pnpm --filter contracts build
```

Expected: zero erros TypeScript.

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/admin.ts packages/contracts/dist
git commit -m "feat(contracts): add dismissDuplicateSchema for admin duplicates dedup"
```

---

## Task 2: Models Prisma + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<TIMESTAMP>_dedup_source_key_persistence/migration.sql`

- [ ] **Step 1: Adicionar models ao schema**

Acrescentar no fim de `apps/api/prisma/schema.prisma`:

```prisma
model DismissedDuplicate {
  sourceKeyA String @map("source_key_a") @db.VarChar(255)
  sourceKeyB String @map("source_key_b") @db.VarChar(255)

  @@id([sourceKeyA, sourceKeyB])
  @@map("dismissed_duplicates")
}

model RemovedSourceKey {
  sourceKey String @id @map("source_key") @db.VarChar(255)

  @@map("removed_source_keys")
}
```

- [ ] **Step 2: Pre-flight em prod (Fernando faz manual)**

**ANTES de aplicar a migration em prod**, Fernando precisa preservar dados existentes:

```sql
RENAME TABLE dismissed_duplicates TO dismissed_duplicates_legacy;
```

Em dev local, a tabela provavelmente não existe (foi criada manual em prod) — pular essa step.

- [ ] **Step 3: Gerar migration Prisma (skeleton)**

```bash
corepack pnpm --filter api exec prisma migrate dev --name dedup_source_key_persistence --create-only
```

Expected: cria `apps/api/prisma/migrations/<TIMESTAMP>_dedup_source_key_persistence/migration.sql` com `CREATE TABLE` para as duas tabelas novas.

- [ ] **Step 4: Aplicar migration localmente**

```bash
corepack pnpm --filter api exec prisma migrate dev
```

Expected: migration aplicada, banco local com as duas tabelas novas.

- [ ] **Step 5: Adicionar SQL de backfill ao final da migration (apenas para uso em prod)**

Acrescentar no fim de `apps/api/prisma/migrations/<TIMESTAMP>_dedup_source_key_persistence/migration.sql`:

```sql
-- Backfill: copia dados da tabela legacy se existir (apenas em prod, depois do RENAME manual)
-- Em dev local, dismissed_duplicates_legacy não existe e o INSERT vira no-op.
INSERT IGNORE INTO dismissed_duplicates (source_key_a, source_key_b)
SELECT
  LEAST(g.source_key, r.source_key) AS source_key_a,
  GREATEST(g.source_key, r.source_key) AS source_key_b
FROM dismissed_duplicates_legacy d
INNER JOIN catalog_entries g ON g.id = d.gcd_id
INNER JOIN catalog_entries r ON r.id = d.rika_id
WHERE g.source_key IS NOT NULL
  AND r.source_key IS NOT NULL;
```

Atenção: o INSERT acima vai **falhar** em dev se `dismissed_duplicates_legacy` não existir. Para evitar erro, envolver em bloco try-catch SQL ou usar variável condicional. Solução simples: comentar o backfill no commit (deixar como referência) e rodar **manualmente em prod** depois da migration aplicar.

Versão final do bloco no migration.sql:

```sql
-- Backfill em prod (rodar MANUALMENTE depois desta migration aplicar):
-- ----------------------------------------------------------------
-- INSERT IGNORE INTO dismissed_duplicates (source_key_a, source_key_b)
-- SELECT
--   LEAST(g.source_key, r.source_key),
--   GREATEST(g.source_key, r.source_key)
-- FROM dismissed_duplicates_legacy d
-- INNER JOIN catalog_entries g ON g.id = d.gcd_id
-- INNER JOIN catalog_entries r ON r.id = d.rika_id
-- WHERE g.source_key IS NOT NULL AND r.source_key IS NOT NULL;
--
-- DROP TABLE dismissed_duplicates_legacy;
-- ----------------------------------------------------------------
```

Comentado no SQL — Fernando roda manual em prod depois do deploy. Em dev não precisa.

- [ ] **Step 6: Smoke test local**

Criar arquivo temporário `apps/api/scripts/smoke-test-dedup-tables.ts`:

```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Insert + lookup em DismissedDuplicate
  await prisma.dismissedDuplicate.upsert({
    where: { sourceKeyA_sourceKeyB: { sourceKeyA: 'gcd:smoketest1', sourceKeyB: 'rika:smoketest2' } },
    create: { sourceKeyA: 'gcd:smoketest1', sourceKeyB: 'rika:smoketest2' },
    update: {},
  });
  const found = await prisma.dismissedDuplicate.findUnique({
    where: { sourceKeyA_sourceKeyB: { sourceKeyA: 'gcd:smoketest1', sourceKeyB: 'rika:smoketest2' } },
  });
  if (!found) throw new Error('DismissedDuplicate not found');

  // Insert + lookup em RemovedSourceKey
  await prisma.removedSourceKey.upsert({
    where: { sourceKey: 'rika:smoketest3' },
    create: { sourceKey: 'rika:smoketest3' },
    update: {},
  });
  const block = await prisma.removedSourceKey.findUnique({ where: { sourceKey: 'rika:smoketest3' } });
  if (!block) throw new Error('RemovedSourceKey not found');

  // Cleanup
  await prisma.dismissedDuplicate.delete({
    where: { sourceKeyA_sourceKeyB: { sourceKeyA: 'gcd:smoketest1', sourceKeyB: 'rika:smoketest2' } },
  });
  await prisma.removedSourceKey.delete({ where: { sourceKey: 'rika:smoketest3' } });

  console.log('Smoke test OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Rodar:
```bash
corepack pnpm --filter api exec tsx apps/api/scripts/smoke-test-dedup-tables.ts
```

Expected: `Smoke test OK`. Depois, deletar o arquivo (`rm apps/api/scripts/smoke-test-dedup-tables.ts`).

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add DismissedDuplicate and RemovedSourceKey models with migration"
```

---

## Task 3: TDD — POST /admin/duplicates/dismiss recebe sourceKeys

**Files:**
- Create: `apps/api/src/__tests__/admin/duplicates.test.ts`
- Modify: `apps/api/src/modules/admin/admin.routes.ts:368-381`

- [ ] **Step 1: Escrever teste falhando**

Criar `apps/api/src/__tests__/admin/duplicates.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN } from '../setup';

const prisma = new PrismaClient();

let adminToken: string;
const TEST_KEYS = {
  a: '_test_dedup_gcd:dismiss_test_001',
  b: '_test_dedup_rika:dismiss_test_001',
};

beforeAll(async () => {
  const a = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = a.accessToken;
});

afterAll(async () => {
  await prisma.dismissedDuplicate.deleteMany({
    where: {
      OR: [
        { sourceKeyA: { startsWith: '_test_dedup_' } },
        { sourceKeyB: { startsWith: '_test_dedup_' } },
      ],
    },
  });
  await prisma.removedSourceKey.deleteMany({
    where: { sourceKey: { startsWith: '_test_dedup_' } },
  });
  await prisma.$disconnect();
});

describe('POST /api/v1/admin/duplicates/dismiss', () => {
  it('persiste o par ordenado lexicograficamente', async () => {
    const res = await request
      .post('/api/v1/admin/duplicates/dismiss')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceKeyA: TEST_KEYS.b, sourceKeyB: TEST_KEYS.a }) // ordem invertida intencionalmente
      .expect(200);

    expect(res.body.success).toBe(true);

    const [keyA, keyB] = [TEST_KEYS.a, TEST_KEYS.b].sort();
    const stored = await prisma.dismissedDuplicate.findUnique({
      where: { sourceKeyA_sourceKeyB: { sourceKeyA: keyA, sourceKeyB: keyB } },
    });
    expect(stored).not.toBeNull();
  });

  it('é idempotente — segundo dismiss do mesmo par não falha', async () => {
    await request
      .post('/api/v1/admin/duplicates/dismiss')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceKeyA: TEST_KEYS.a, sourceKeyB: TEST_KEYS.b })
      .expect(200);

    // Segundo POST: deve retornar 200 e não duplicar registro
    await request
      .post('/api/v1/admin/duplicates/dismiss')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceKeyA: TEST_KEYS.a, sourceKeyB: TEST_KEYS.b })
      .expect(200);

    const count = await prisma.dismissedDuplicate.count({
      where: {
        sourceKeyA: { in: [TEST_KEYS.a, TEST_KEYS.b] },
        sourceKeyB: { in: [TEST_KEYS.a, TEST_KEYS.b] },
      },
    });
    expect(count).toBe(1);
  });

  it('rejeita body sem sourceKeys', async () => {
    await request
      .post('/api/v1/admin/duplicates/dismiss')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gcdId: 'something', rikaId: 'else' }) // contrato antigo
      .expect(400);
  });
});
```

- [ ] **Step 2: Rodar teste para verificar que falha**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/admin/duplicates.test.ts
```

Expected: testes falham (handler ainda recebe `gcdId/rikaId`).

- [ ] **Step 3: Implementar handler novo**

Modificar `apps/api/src/modules/admin/admin.routes.ts`. Importar o schema:

```ts
import { listUsersSchema, suspendUserSchema, dismissDuplicateSchema } from '@comicstrunk/contracts';
```

Substituir o handler atual (linhas 368-381):

```ts
// POST /duplicates/dismiss — mark a pair as "keep both" so it won't appear again
router.post(
  '/duplicates/dismiss',
  validate(dismissDuplicateSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceKeyA, sourceKeyB } = req.body;
      // Sempre ordenar lexicograficamente (par é simétrico)
      const [a, b] = [sourceKeyA, sourceKeyB].sort();

      await prisma.dismissedDuplicate.upsert({
        where: { sourceKeyA_sourceKeyB: { sourceKeyA: a, sourceKeyB: b } },
        create: { sourceKeyA: a, sourceKeyB: b },
        update: {},
      });

      sendSuccess(res, { dismissed: true });
    } catch (err) {
      next(err);
    }
  },
);
```

- [ ] **Step 4: Rodar teste para confirmar que passa**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/admin/duplicates.test.ts
```

Expected: 3 testes passam.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admin/admin.routes.ts apps/api/src/__tests__/admin/duplicates.test.ts
git commit -m "feat(api): dismiss endpoint accepts sourceKeys (lex-ordered, idempotent)"
```

---

## Task 4: TDD — GET /admin/duplicates filtra NOT EXISTS espelhado nos dois modos

**Files:**
- Modify: `apps/api/src/__tests__/admin/duplicates.test.ts` (adicionar suite GET)
- Modify: `apps/api/src/modules/admin/admin.routes.ts:212-365`

- [ ] **Step 1: Adicionar testes para GET filter (apêndice ao arquivo de teste)**

Acrescentar dentro do mesmo `apps/api/src/__tests__/admin/duplicates.test.ts`, após a suite POST:

```ts
describe('GET /api/v1/admin/duplicates — filtro espelhado', () => {
  let gcdEntry: { id: string; sourceKey: string };
  let rikaEntry: { id: string; sourceKey: string };

  beforeAll(async () => {
    // Cria entradas casadas (GCD + Rika) com mesmo título e número
    const created = await prisma.catalogEntry.createMany({
      data: [
        {
          title: '_test_dedup_GCD Title #42',
          publisher: 'Marvel',
          sourceKey: '_test_dedup_gcd:title_test_42',
          slug: '_test_dedup_gcd-title-42',
          approvalStatus: 'APPROVED',
          publishYear: 2020,
        },
        {
          title: '_test_dedup_GCD Title #42', // mesmo título
          publisher: 'Marvel',
          sourceKey: '_test_dedup_rika:title_test_42',
          slug: '_test_dedup_rika-title-42',
          approvalStatus: 'APPROVED',
          publishYear: 2020,
        },
      ],
    });
    expect(created.count).toBe(2);

    const fetched = await prisma.catalogEntry.findMany({
      where: { sourceKey: { startsWith: '_test_dedup_' } },
      orderBy: { sourceKey: 'asc' },
    });
    [gcdEntry, rikaEntry] = fetched.map((e) => ({ id: e.id, sourceKey: e.sourceKey! }));
  });

  afterAll(async () => {
    await prisma.catalogEntry.deleteMany({
      where: { sourceKey: { startsWith: '_test_dedup_' } },
    });
  });

  it('modo title: par dispensado não aparece', async () => {
    // Dispensa par via POST
    await request
      .post('/api/v1/admin/duplicates/dismiss')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceKeyA: gcdEntry.sourceKey, sourceKeyB: rikaEntry.sourceKey })
      .expect(200);

    // GET no modo title
    const res = await request
      .get('/api/v1/admin/duplicates?mode=title&page=1&limit=200')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Garantir que esse par não aparece
    const pairs = res.body.data as Array<{ gcd: { sourceKey: string }; rika: { sourceKey: string } }>;
    const found = pairs.some(
      (p) =>
        (p.gcd.sourceKey === gcdEntry.sourceKey && p.rika.sourceKey === rikaEntry.sourceKey) ||
        (p.gcd.sourceKey === rikaEntry.sourceKey && p.rika.sourceKey === gcdEntry.sourceKey),
    );
    expect(found).toBe(false);
  });

  it('modo pattern: par dispensado não aparece', async () => {
    // (Par já dispensado no teste anterior — beforeAll persiste entre tests)
    const res = await request
      .get('/api/v1/admin/duplicates?mode=pattern&page=1&limit=200')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const pairs = res.body.data as Array<{ gcd: { sourceKey: string }; rika: { sourceKey: string } }>;
    const found = pairs.some(
      (p) =>
        (p.gcd.sourceKey === gcdEntry.sourceKey && p.rika.sourceKey === rikaEntry.sourceKey) ||
        (p.gcd.sourceKey === rikaEntry.sourceKey && p.rika.sourceKey === gcdEntry.sourceKey),
    );
    expect(found).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar testes para verificar que o modo `title` falha**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/admin/duplicates.test.ts
```

Expected: teste "modo title" FALHA (filtro não está aplicado lá hoje); teste "modo pattern" pode passar (já tinha filtro, só está em formato antigo — vai falhar também porque mudamos o filtro pra source_key).

- [ ] **Step 3: Adicionar filtro NOT EXISTS no modo `title`**

Em `apps/api/src/modules/admin/admin.routes.ts`, no bloco `if (mode === 'title')` (~linha 219-247), modificar a query SQL principal adicionando o filtro antes do `GROUP BY`:

```ts
const duplicates = await prisma.$queryRaw<Array<{
  gcd_id: string; gcd_title: string; gcd_publisher: string; gcd_source_key: string; gcd_cover: string | null;
  rika_id: string; rika_title: string; rika_publisher: string; rika_source_key: string; rika_cover: string | null;
}>>`
  SELECT
    g.id as gcd_id, g.title as gcd_title, g.publisher as gcd_publisher,
    g.source_key as gcd_source_key, g.cover_image_url as gcd_cover,
    MIN(r.id) as rika_id, MIN(r.title) as rika_title, MIN(r.publisher) as rika_publisher,
    MIN(r.source_key) as rika_source_key, MIN(r.cover_image_url) as rika_cover
  FROM catalog_entries g
  JOIN catalog_entries r
    ON g.title = r.title
    AND g.id < r.id
    AND SUBSTRING_INDEX(g.source_key, ':', 1) != SUBSTRING_INDEX(r.source_key, ':', 1)
  WHERE g.title IN (
    SELECT title FROM catalog_entries
    WHERE source_key IS NOT NULL AND title IS NOT NULL AND CHAR_LENGTH(title) > 3
    GROUP BY title
    HAVING COUNT(DISTINCT SUBSTRING_INDEX(source_key, ':', 1)) > 1
  )
  AND g.source_key IS NOT NULL AND r.source_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM dismissed_duplicates d
    WHERE d.source_key_a = LEAST(g.source_key, r.source_key)
      AND d.source_key_b = GREATEST(g.source_key, r.source_key)
  )
  GROUP BY g.id, g.title, g.publisher, g.source_key, g.cover_image_url
  ORDER BY g.title ASC
  LIMIT ${limit} OFFSET ${skip}
`;
```

E também na query de `countResult` do mesmo bloco — adicionar mesmo filtro `NOT EXISTS`.

- [ ] **Step 4: Substituir filtro do modo `pattern` (linhas 290 e 320) pelo novo formato source-key-based**

Em vez de `AND id NOT IN (SELECT gcd_id FROM dismissed_duplicates)`, substituir por nada (remover essa linha das duas queries internas pattern), e adicionar o filtro `NOT EXISTS` ao final do JOIN principal (mesmo padrão do modo title):

```sql
-- depois do bloco JOIN ... ON ...
AND NOT EXISTS (
  SELECT 1 FROM dismissed_duplicates d
  WHERE d.source_key_a = LEAST(g.source_key, r.source_key)
    AND d.source_key_b = GREATEST(g.source_key, r.source_key)
)
GROUP BY g.id, g.title, g.publisher, g.source_key, g.cover_image_url
ORDER BY g.title ASC
LIMIT ${limit} OFFSET ${skip}
```

Aplicar a mesma modificação na query de `countResult` do modo pattern.

- [ ] **Step 5: Rodar testes para confirmar que ambos os modos passam**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/admin/duplicates.test.ts
```

Expected: todos os 5 testes passam (3 da Task 3 + 2 da Task 4).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admin/admin.routes.ts apps/api/src/__tests__/admin/duplicates.test.ts
git commit -m "fix(api): mirror dismissed_duplicates filter in both pattern and title modes"
```

---

## Task 5: TDD — DELETE /admin/duplicates/:id adiciona sourceKey à blacklist

**Files:**
- Modify: `apps/api/src/__tests__/admin/duplicates.test.ts`
- Modify: `apps/api/src/modules/admin/admin.routes.ts:384-435`

- [ ] **Step 1: Adicionar suite de teste para DELETE**

Acrescentar em `apps/api/src/__tests__/admin/duplicates.test.ts`:

```ts
describe('DELETE /api/v1/admin/duplicates/:id', () => {
  it('hard-deleta entrada e adiciona sourceKey em removed_source_keys', async () => {
    // Cria entrada de teste
    const entry = await prisma.catalogEntry.create({
      data: {
        title: '_test_dedup_DeleteTest #1',
        publisher: 'Marvel',
        sourceKey: '_test_dedup_rika:delete_test_001',
        slug: '_test_dedup_delete-test-001',
        approvalStatus: 'APPROVED',
      },
    });

    await request
      .delete(`/api/v1/admin/duplicates/${entry.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Confirma hard delete
    const stillThere = await prisma.catalogEntry.findUnique({ where: { id: entry.id } });
    expect(stillThere).toBeNull();

    // Confirma blacklist
    const blocked = await prisma.removedSourceKey.findUnique({
      where: { sourceKey: '_test_dedup_rika:delete_test_001' },
    });
    expect(blocked).not.toBeNull();
  });
});
```

- [ ] **Step 2: Rodar para verificar que o teste falha**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/admin/duplicates.test.ts -t "hard-deleta entrada"
```

Expected: assertion falha — `removed_source_keys` não recebe entry.

- [ ] **Step 3: Modificar o handler DELETE em `admin.routes.ts`**

Em `apps/api/src/modules/admin/admin.routes.ts:384-435`, dentro da `prisma.$transaction`:

```ts
await prisma.$transaction(async (tx) => {
  // 1. Pega sourceKey ANTES de deletar (NOVO)
  const entry = await tx.catalogEntry.findUnique({
    where: { id },
    select: { sourceKey: true },
  });

  // 2. Limpa dependências em cascata (igual hoje)
  if (collectionItemIds.length > 0) {
    await tx.cartItem.deleteMany({ where: { collectionItemId: { in: collectionItemIds } } });
    await tx.orderItem.deleteMany({ where: { collectionItemId: { in: collectionItemIds } } });
  }
  await tx.catalogCategory.deleteMany({ where: { catalogEntryId: id } });
  await tx.catalogTag.deleteMany({ where: { catalogEntryId: id } });
  await tx.catalogCharacter.deleteMany({ where: { catalogEntryId: id } });
  await tx.favorite.deleteMany({ where: { catalogEntryId: id } });
  await tx.comment.deleteMany({ where: { catalogEntryId: id } });
  await tx.review.deleteMany({ where: { catalogEntryId: id } });
  await tx.collectionItem.deleteMany({ where: { catalogEntryId: id } });

  // 3. Hard delete (igual hoje)
  await tx.catalogEntry.delete({ where: { id } });

  // 4. Blacklist (NOVO)
  if (entry?.sourceKey) {
    await tx.removedSourceKey.upsert({
      where: { sourceKey: entry.sourceKey },
      create: { sourceKey: entry.sourceKey },
      update: {},
    });
  }
});
```

Atenção: a linha que removia entradas em `dismissed_duplicates` por id velho (`DELETE FROM dismissed_duplicates WHERE gcd_id = ${id} OR rika_id = ${id}`) **deve ser removida** — agora a tabela usa source_key, então essa linha é obsoleta. Limpar.

- [ ] **Step 4: Rodar teste para confirmar que passa**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/admin/duplicates.test.ts -t "hard-deleta entrada"
```

Expected: teste passa.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admin/admin.routes.ts apps/api/src/__tests__/admin/duplicates.test.ts
git commit -m "feat(api): DELETE /admin/duplicates/:id adds sourceKey to removed_source_keys"
```

---

## Task 6: TDD — sync-catalog respeita blacklist

**Files:**
- Modify: `apps/api/src/__tests__/admin/duplicates.test.ts` (adicionar suite isolada)
- Create: `apps/api/src/modules/sync/blacklist.ts` (extração para testabilidade)
- Modify: `apps/api/scripts/sync-catalog.ts` (chama nova função)

- [ ] **Step 1: Escrever teste para função `isSourceKeyBlocked`**

Acrescentar em `apps/api/src/__tests__/admin/duplicates.test.ts` (sub-suite separada):

```ts
import { isSourceKeyBlocked } from '../../modules/sync/blacklist';

describe('isSourceKeyBlocked (helper para sync-catalog e cover-import)', () => {
  it('retorna true quando sourceKey está em removed_source_keys', async () => {
    await prisma.removedSourceKey.upsert({
      where: { sourceKey: '_test_dedup_rika:blocked_001' },
      create: { sourceKey: '_test_dedup_rika:blocked_001' },
      update: {},
    });

    const blocked = await isSourceKeyBlocked('_test_dedup_rika:blocked_001');
    expect(blocked).toBe(true);
  });

  it('retorna false quando sourceKey não está blacklisted', async () => {
    const blocked = await isSourceKeyBlocked('_test_dedup_rika:notblocked_001');
    expect(blocked).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar para verificar que o teste falha**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/admin/duplicates.test.ts -t "isSourceKeyBlocked"
```

Expected: import falha — função não existe.

- [ ] **Step 3: Criar a função `isSourceKeyBlocked`**

Criar `apps/api/src/modules/sync/blacklist.ts`:

```ts
import { prisma } from '../../shared/lib/prisma';

/**
 * Retorna true se a sourceKey está em removed_source_keys.
 *
 * Usado por sync-catalog (cron das 4h) e cover-import (cover-scan)
 * antes de criar novas CatalogEntry. Garante que entradas removidas
 * via /admin/duplicates não são reimportadas silenciosamente.
 */
export async function isSourceKeyBlocked(sourceKey: string): Promise<boolean> {
  const found = await prisma.removedSourceKey.findUnique({
    where: { sourceKey },
    select: { sourceKey: true },
  });
  return found !== null;
}
```

- [ ] **Step 4: Rodar teste para confirmar que passa**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/admin/duplicates.test.ts -t "isSourceKeyBlocked"
```

Expected: 2 testes passam.

- [ ] **Step 5: Integrar `isSourceKeyBlocked` no sync-catalog.ts**

Em `apps/api/scripts/sync-catalog.ts`, adicionar import no topo:

```ts
import { isSourceKeyBlocked } from '../src/modules/sync/blacklist';
```

E **antes de cada `prisma.catalogEntry.create({...})` em ambos os loops** (Rika e Panini), adicionar o check:

```ts
// === Antes de criar entrada Rika ===
if (await isSourceKeyBlocked(sourceKey)) {
  stats.skipped = (stats.skipped ?? 0) + 1;
  continue;
}
// (depois) const entry = await prisma.catalogEntry.create(...)

// === Antes de criar entrada Panini ===
if (await isSourceKeyBlocked(sourceKey)) {
  stats.skipped = (stats.skipped ?? 0) + 1;
  continue;
}
```

Também no log final do script, incluir `stats.skipped` no relatório de cada fonte.

- [ ] **Step 6: Validar que sync-catalog ainda compila**

```bash
corepack pnpm --filter api type-check
```

Expected: zero erro TypeScript.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/sync/blacklist.ts apps/api/scripts/sync-catalog.ts apps/api/src/__tests__/admin/duplicates.test.ts
git commit -m "feat(api): sync-catalog respects removed_source_keys blacklist"
```

---

## Task 7: TDD — cover-import respeita blacklist

**Files:**
- Modify: `apps/api/src/__tests__/cover-scan/cover-import.test.ts` (adicionar caso)
- Modify: `apps/api/src/modules/cover-scan/cover-import.service.ts:39-43`

- [ ] **Step 1: Escrever teste falhando**

Acrescentar em `apps/api/src/__tests__/cover-scan/cover-import.test.ts` dentro do describe principal:

```ts
it('rejeita import quando sourceKey está em removed_source_keys', async () => {
  // Mark sourceKey as blacklisted
  await prisma.removedSourceKey.upsert({
    where: { sourceKey: 'metron:99999' },
    create: { sourceKey: 'metron:99999' },
    update: {},
  });

  mockedGetMetron.mockResolvedValue({
    id: 99999,
    series: { name: 'Blocked Test', volume: 1, year_began: 2024 },
    number: '1',
    issue: 'Blocked Test #1',
    cover_date: '2024-01-01',
    image: 'https://static.metron.cloud/blocked.jpg',
    description: 'Should be blocked',
  });

  const log = await prisma.coverScanLog.create({
    data: {
      userId,
      rawText: '{}',
      ocrTokens: 'blocked',
      candidatesShown: [],
    },
  });
  createdIds.logs.push(log.id);

  const res = await request
    .post('/api/v1/cover-scan/import')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      scanLogId: log.id,
      candidate: { source: 'metron', externalRef: '99999' },
    })
    .expect(400);

  expect(res.body.error.message).toMatch(/removida do catálogo/i);

  // Cleanup
  await prisma.removedSourceKey.delete({ where: { sourceKey: 'metron:99999' } });
});
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/cover-scan/cover-import.test.ts -t "rejeita import"
```

Expected: assertion falha (hoje a entrada é criada normalmente).

- [ ] **Step 3: Adicionar check no `ensureCatalogEntryFromExternal`**

Modificar `apps/api/src/modules/cover-scan/cover-import.service.ts:39-43`:

```ts
import { isSourceKeyBlocked } from '../sync/blacklist';

export async function ensureCatalogEntryFromExternal(
  userId: string,
  externalSource: 'metron' | 'rika' | 'amazon' | 'fandom' | 'ebay',
  externalRef: string,
  scanLogId: string,
): Promise<{ id: string; approvalStatus: string }> {
  const sourceKey = `${externalSource}:${externalRef}`;

  // Verifica se a entrada já existe (pode ter sido removida pelo admin)
  const existing = await prisma.catalogEntry.findFirst({
    where: { sourceKey },
    select: { id: true, approvalStatus: true },
  });
  if (existing) return existing;

  // BLACKLIST CHECK (NOVO): se sourceKey foi removida pelo admin via /admin/duplicates,
  // não recriar — usuário recebe erro claro
  if (await isSourceKeyBlocked(sourceKey)) {
    throw new BadRequestError('Esta entrada foi removida do catálogo pelo administrador.');
  }

  const data = await fetchExternalData(externalSource, externalRef);
  // ... resto igual
```

- [ ] **Step 4: Rodar teste para confirmar que passa**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/cover-scan/cover-import.test.ts -t "rejeita import"
```

Expected: teste passa.

- [ ] **Step 5: Rodar suite completa de cover-scan para garantir que não quebrei nada**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/cover-scan/
```

Expected: todos os testes existentes continuam passando.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/cover-scan/cover-import.service.ts apps/api/src/__tests__/cover-scan/cover-import.test.ts
git commit -m "feat(api): cover-scan import respects removed_source_keys blacklist"
```

---

## Task 8: Frontend — page admin/duplicates passa sourceKeys no POST

**Files:**
- Modify: `apps/web/src/app/[locale]/(admin)/admin/duplicates/page.tsx:11-22, 291-294`

- [ ] **Step 1: Adicionar `sourceKey` ao type `DuplicateEntry`**

O tipo já tem `sourceKey: string` (linha 15) — confirmado.

- [ ] **Step 2: Atualizar payload do POST**

Modificar `apps/web/src/app/[locale]/(admin)/admin/duplicates/page.tsx:291-294`:

```tsx
onClick={async () => {
  try {
    await apiClient.post('/admin/duplicates/dismiss', {
      sourceKeyA: pair.gcd.sourceKey,
      sourceKeyB: pair.rika.sourceKey,
    });
    setPairs((prev) => prev.filter((_, i) => i !== idx));
    setTotal((t) => t - 1);
  } catch {
    toast.error('Erro ao salvar');
  }
}}
```

- [ ] **Step 3: Type-check do web**

```bash
corepack pnpm --filter web type-check
```

Expected: zero erro TypeScript.

- [ ] **Step 4: Smoke test manual local**

```bash
corepack pnpm --filter web dev
```

Abrir `http://localhost:3000/pt-BR/admin/duplicates`, logar como admin, clicar em "Manter ambos" em qualquer par. Verificar:
1. Toast/erro: nenhum.
2. Par some da listagem.
3. Reload da página: par continua sumido.
4. Banco: `SELECT * FROM dismissed_duplicates ORDER BY source_key_a DESC LIMIT 1;` mostra o par com sourceKeys (não com cuids).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/(admin)/admin/duplicates/page.tsx
git commit -m "feat(web): admin/duplicates dismiss sends sourceKeys instead of ids"
```

---

## Task 9: TDD — Cenário E2E "Manter ambos sobrevive a delete+recreate"

Este é o **teste definitivo** — combina Task 3 (dismiss por sourceKey) + Task 4 (filtro espelhado) + simula o comportamento do cron das 4h (delete entry, criar de novo com novo cuid mas mesma sourceKey).

**Files:**
- Modify: `apps/api/src/__tests__/admin/duplicates.test.ts`

- [ ] **Step 1: Adicionar teste E2E**

Acrescentar em `apps/api/src/__tests__/admin/duplicates.test.ts`:

```ts
describe('E2E: "Manter ambos" sobrevive a delete+recreate (cron das 4h)', () => {
  it('par dispensado continua oculto após cron recriar entrada com novo cuid', async () => {
    // 1. Cria par
    const a = await prisma.catalogEntry.create({
      data: {
        title: '_test_dedup_E2E Title #1',
        publisher: 'Marvel',
        sourceKey: '_test_dedup_gcd:e2e_001',
        slug: '_test_dedup_e2e-001',
        approvalStatus: 'APPROVED',
        publishYear: 2020,
      },
    });

    const b1 = await prisma.catalogEntry.create({
      data: {
        title: '_test_dedup_E2E Title #1',
        publisher: 'Marvel',
        sourceKey: '_test_dedup_rika:e2e_001',
        slug: '_test_dedup_e2e-rika-001',
        approvalStatus: 'APPROVED',
        publishYear: 2020,
      },
    });

    // 2. Dispensa par
    await request
      .post('/api/v1/admin/duplicates/dismiss')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceKeyA: a.sourceKey, sourceKeyB: b1.sourceKey })
      .expect(200);

    // 3. Simula o cron das 4h: deleta entrada Rika, recria com NOVO cuid e MESMA sourceKey
    await prisma.catalogEntry.delete({ where: { id: b1.id } });
    const b2 = await prisma.catalogEntry.create({
      data: {
        title: '_test_dedup_E2E Title #1',
        publisher: 'Marvel',
        sourceKey: '_test_dedup_rika:e2e_001', // mesma sourceKey
        slug: '_test_dedup_e2e-rika-001-recreated',
        approvalStatus: 'APPROVED',
        publishYear: 2020,
      },
    });
    expect(b2.id).not.toBe(b1.id); // cuid mudou — confirma o cenário do bug

    // 4. GET no modo title — par NÃO deve aparecer
    const titleRes = await request
      .get('/api/v1/admin/duplicates?mode=title&page=1&limit=200')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const titlePairs = titleRes.body.data as Array<{ gcd: { sourceKey: string }; rika: { sourceKey: string } }>;
    const foundInTitle = titlePairs.some(
      (p) =>
        (p.gcd.sourceKey === '_test_dedup_gcd:e2e_001' && p.rika.sourceKey === '_test_dedup_rika:e2e_001') ||
        (p.gcd.sourceKey === '_test_dedup_rika:e2e_001' && p.rika.sourceKey === '_test_dedup_gcd:e2e_001'),
    );
    expect(foundInTitle).toBe(false);

    // 5. GET no modo pattern — par NÃO deve aparecer
    const patternRes = await request
      .get('/api/v1/admin/duplicates?mode=pattern&page=1&limit=200')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const patternPairs = patternRes.body.data as Array<{ gcd: { sourceKey: string }; rika: { sourceKey: string } }>;
    const foundInPattern = patternPairs.some(
      (p) =>
        (p.gcd.sourceKey === '_test_dedup_gcd:e2e_001' && p.rika.sourceKey === '_test_dedup_rika:e2e_001') ||
        (p.gcd.sourceKey === '_test_dedup_rika:e2e_001' && p.rika.sourceKey === '_test_dedup_gcd:e2e_001'),
    );
    expect(foundInPattern).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar teste E2E**

```bash
corepack pnpm --filter api exec vitest run src/__tests__/admin/duplicates.test.ts -t "Manter ambos sobrevive"
```

Expected: PASS. Esse teste prova que o sistema agora resiste ao bug do cron.

- [ ] **Step 3: Rodar suite inteira para confirmar zero regressão**

```bash
corepack pnpm --filter api exec vitest run
```

Expected: todos os testes do projeto continuam passando.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/__tests__/admin/duplicates.test.ts
git commit -m "test(api): E2E — dismiss persists across delete+recreate cycle (cron-safe)"
```

---

## Task 10 (final): Atualizar documentação

**Files:**
- Modify: `docs/MANUAL.md:145-153` (seção 3.6 Duplicatas no catálogo)

- [ ] **Step 1: Atualizar a documentação do MANUAL.md**

Substituir a seção 3.6 atual por:

```markdown
### 3.6 Duplicatas no catálogo
- `/pt-BR/admin/duplicates` lista pares (GCD vs Rika/Panini)
- 2 modos:
  - **Padrão GCD #issue**: detecta duplicatas pelo padrão GCD
  - **Mesmo título (qualquer fonte)**: agrupa por título normalizado
- Ações:
  - **Remover** um lado (com cascade FK: cart, order, collection, etc) — sourceKey vai para a lista `removed_source_keys` e o cron das 4h não recria mais
  - **Manter ambos** — par registrado em `dismissed_duplicates` por sourceKey (estável, sobrevive a delete+recreate do cron)
- Validação: se há pedidos ativos referenciando o item, bloqueia remoção com mensagem clara
- Reversão (via SQL): `DELETE FROM removed_source_keys WHERE source_key = '...'` ou `DELETE FROM dismissed_duplicates WHERE source_key_a = ... AND source_key_b = ...`
```

- [ ] **Step 2: Commit**

```bash
git add docs/MANUAL.md
git commit -m "docs: update admin duplicates section reflecting sourceKey-based dedup"
```

---

## Deploy plan (após todos os commits acima)

> Não confirmar deploy automaticamente — Fernando aprova explicitamente cada step.

### Em produção

1. **Backup do banco** (sempre antes de migrations destrutivas):
   ```bash
   ssh ferna5257@servidor "mysqldump --single-transaction --skip-lock-tables ferna5257_comicstrunk_db dismissed_duplicates > ~/backups/dismissed_duplicates-pre-migration-20260430.sql"
   ```

2. **Renomear tabela legacy** (preserva dados):
   ```sql
   RENAME TABLE dismissed_duplicates TO dismissed_duplicates_legacy;
   ```

3. **Build local + deploy API** (seguindo protocolo de DEPLOYMENT.md):
   ```bash
   corepack pnpm --filter contracts build
   corepack pnpm --filter api build
   # tar + ssh + restart PM2 (ver DEPLOYMENT.md)
   ```

4. **Aplicar migration em prod**:
   ```bash
   ssh ferna5257@servidor "cd /home/ferna5257/applications/api.comicstrunk.com && npx prisma migrate deploy"
   ```

5. **Backfill manual** (rodar no servidor, banco prod):
   ```sql
   INSERT IGNORE INTO dismissed_duplicates (source_key_a, source_key_b)
   SELECT
     LEAST(g.source_key, r.source_key),
     GREATEST(g.source_key, r.source_key)
   FROM dismissed_duplicates_legacy d
   INNER JOIN catalog_entries g ON g.id = d.gcd_id
   INNER JOIN catalog_entries r ON r.id = d.rika_id
   WHERE g.source_key IS NOT NULL AND r.source_key IS NOT NULL;
   ```

6. **Validar** (deve retornar count > 0 se havia dados antes):
   ```sql
   SELECT COUNT(*) FROM dismissed_duplicates;
   SELECT COUNT(*) FROM dismissed_duplicates_legacy;
   ```

7. **Drop tabela legacy** (após validar):
   ```sql
   DROP TABLE dismissed_duplicates_legacy;
   ```

8. **Build + deploy web** (frontend mudou).

9. **Test em prod**:
   - Login admin → /admin/duplicates → "Manter ambos" → reload → par continua sumido.
   - Login admin → /admin/duplicates → "Remover" → conferir `SELECT * FROM removed_source_keys ORDER BY source_key DESC LIMIT 1;` em prod.
   - Aguardar próxima madrugada (4h) → conferir log do cron: `stats.skipped` deve aparecer.

---

## Self-Review

**Spec coverage:**
- ✓ Decisão 1 (Persistência por source_key): Task 2 (schema/migration) + Task 3 (POST handler)
- ✓ Decisão 2 (Pares ordenados lex.): Task 3 step 3 (`[a, b].sort()`)
- ✓ Decisão 3 (Filtro espelhado): Task 4
- ✓ Decisão 4 (Hard delete): Task 5 — preserva `tx.catalogEntry.delete()`
- ✓ Decisão 5 (Lista negra mínima): Task 2 (model RemovedSourceKey, uma coluna)
- ✓ Decisão 6 (Cron consulta): Task 6 (sync-catalog) + Task 7 (cover-import)
- ✓ Decisão 7 (Sem nova UI): zero arquivos novos no `apps/web/`
- ✓ Decisão 8 (Migration formal): Task 2 (gerada via prisma migrate dev)
- ✓ Decisão 9 (Admin pode mostrar "rika"): zero refator visual em painéis

**Cenários TDD:**
- ✓ Cenário 1 (Manter ambos persiste após cron) — Task 9 E2E
- ✓ Cenário 2 (Cron respeita blacklist) — Task 6 (`isSourceKeyBlocked` test)
- ✓ Cenário 3 (Cover-scan respeita blacklist) — Task 7
- ✓ Cenário 4 (Reversão SQL) — documentado em deploy plan step 7 + MANUAL.md

**Placeholder scan:** zero TBD/TODO. Todos os steps têm código completo. Paths e nomes de função consistentes.

**Type consistency:** `isSourceKeyBlocked` usado em Task 6, 7 — assinatura idêntica. `dismissDuplicateSchema` definido em Task 1, importado em Task 3.
