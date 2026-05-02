# Dedup do catálogo: persistir decisões via sourceKey + bloquear reimport — Design

**Status:** Draft (criado 2026-04-30, escopo finalizado após brainstorming)
**Owner:** Fernando
**Problema reportado:** painel `/admin/duplicates` "está sempre voltando" — decisões de "manter ambos" se perdem, entradas deletadas reaparecem no dia seguinte. Admin refazendo o mesmo trabalho toda noite.

---

## TL;DR

Três bugs sobrepostos fazem o painel perder decisões:

1. **Modo "Mesmo título" ignora a tabela `dismissed_duplicates`.** A query SQL não tem o filtro `NOT IN dismissed_duplicates` — só o modo "Padrão GCD #issue" filtra.
2. **Decisões são guardadas em IDs internos (cuid).** Quando o cron das 4h deleta e recria uma entrada Rika, o cuid muda. A tabela `dismissed_duplicates` continua referenciando o cuid antigo (que não existe mais), o filtro não casa, o par reaparece.
3. **DELETE não impede o cron de reimportar.** `sync-catalog.ts` consulta a sourceKey, não acha (porque foi deletada), cria nova entrada com cuid novo e mesma sourceKey.

Solução: trocar a base das decisões de `id` (volátil) para `source_key` (estável), e adicionar uma lista mínima de sourceKeys removidas que o cron consulta antes de criar entrada nova.

---

## Decisões consolidadas (após brainstorming)

| # | Decisão | Detalhe |
|---|---|---|
| 1 | Persistência por `source_key` | `dismissed_duplicates` muda colunas: `gcd_id, rika_id` → `source_key_a, source_key_b` |
| 2 | Pares ordenados lexicograficamente | Sempre `LEAST` em A, `GREATEST` em B. Insert/lookup idempotentes. |
| 3 | Filtro NOT EXISTS espelhado | Ambos os modos (`pattern` e `title`) recebem o mesmo filtro |
| 4 | Hard delete continua | `tx.catalogEntry.delete()` mantido. Deletado é deletado. |
| 5 | Lista negra mínima | Tabela `removed_source_keys` com uma coluna só (`source_key VARCHAR PK`). Sem audit, sem reason, sem user, sem timestamp. |
| 6 | Cron consulta blacklist | `sync-catalog.ts` e `cover-import.service.ts` fazem `SELECT 1 FROM removed_source_keys` antes de criar |
| 7 | Sem nova UI | Reversão via SQL puro quando Fernando pedir |
| 8 | Migration formal | Tabelas registradas em `apps/api/prisma/migrations/` (a `dismissed_duplicates` original foi criada manualmente, sem migration) |
| 9 | Admin pode mostrar "rika"/"panini"/"gcd" | Painéis administrativos continuam expondo sourceKey como hoje |

---

## Não-objetivos (fora de escopo)

1. **Esconder prefixo "rika"/"panini"/"gcd" das URLs públicas de capas** (vazamento mais provável: filenames `rika-1234.jpg` no CDN). Fernando confirmou: deixar pra próximo ticket.
2. **Esconder prefixo no painel admin.** Admin pode ver — sem trabalho aqui.
3. **Repensar premissa do cron** (importação automática diária vs. manual). Próximo ticket.
4. **Soft delete via `approval_status`.** Decisão explícita: deletado é deletado.
5. **Página de gerenciamento da blacklist.** Reversão via SQL. Sem cerimônia.
6. **Audit trail** (quem dispensou/deletou, quando, por quê). Não pedido. Se um dia for necessário, é migration aditiva.

---

## Arquitetura

### 1. `dismissed_duplicates` (renomeação de colunas + backfill)

**Estado atual em prod:**
```sql
-- (A confirmar via SHOW CREATE TABLE antes da migration. Foi criada manualmente, sem migration.)
CREATE TABLE dismissed_duplicates (
  gcd_id  VARCHAR(...),
  rika_id VARCHAR(...),
  PRIMARY KEY (gcd_id, rika_id)
);
```

**Estado alvo:**
```sql
CREATE TABLE dismissed_duplicates (
  source_key_a VARCHAR(255) NOT NULL,
  source_key_b VARCHAR(255) NOT NULL,
  PRIMARY KEY (source_key_a, source_key_b)
);
```

**Migration (Prisma):**
1. `ALTER TABLE` adiciona `source_key_a` e `source_key_b` (nullable temporariamente).
2. `UPDATE` faz JOIN com `catalog_entries` para popular sourceKeys via `gcd_id` e `rika_id`. Linhas órfãs (id que não existe mais) recebem null.
3. `DELETE` linhas onde algum sourceKey ficou null (descarta órfãos — info perdida).
4. `ALTER TABLE` torna `source_key_a` e `source_key_b` NOT NULL.
5. `ALTER TABLE` muda PK para `(source_key_a, source_key_b)`.
6. `ALTER TABLE` dropa `gcd_id` e `rika_id`.

Migration registrada em `apps/api/prisma/migrations/20260430xxxxxx_dedup_source_key_persistence/`.

### 2. `removed_source_keys` (nova tabela)

```sql
CREATE TABLE removed_source_keys (
  source_key VARCHAR(255) NOT NULL PRIMARY KEY
);
```

Uma coluna só. Sem timestamp, sem usuário, sem motivo. Memória mínima do que foi deletado pelo admin para o cron consultar.

### 3. Modelos Prisma (adicionados)

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

Usar `prisma` typed client em vez de `$executeRaw` quando possível (menos bug, mais legível).

### 4. `POST /admin/duplicates/dismiss`

**Hoje:**
```ts
const { gcdId, rikaId } = req.body;
INSERT IGNORE INTO dismissed_duplicates (gcd_id, rika_id) VALUES (?, ?)
```

**Alvo:**
```ts
// Validação Zod no body
const { sourceKeyA, sourceKeyB } = req.body;

// Sempre ordena lex. (par é simétrico)
const [a, b] = [sourceKeyA, sourceKeyB].sort();

await prisma.dismissedDuplicate.upsert({
  where: { sourceKeyA_sourceKeyB: { sourceKeyA: a, sourceKeyB: b } },
  create: { sourceKeyA: a, sourceKeyB: b },
  update: {}, // idempotente
});
```

### 5. `GET /admin/duplicates` — filtro espelhado nos dois modos

**Adicionar em ambos os modos** (`pattern` na linha 290+320 e `title` na linha 246):

```sql
AND NOT EXISTS (
  SELECT 1 FROM dismissed_duplicates d
  WHERE d.source_key_a = LEAST(g.source_key, r.source_key)
    AND d.source_key_b = GREATEST(g.source_key, r.source_key)
)
```

Antes do `LIMIT/OFFSET`. Mesmo SQL nos dois modos — copia-cola, impossível esquecer um lado.

### 6. `DELETE /admin/duplicates/:id`

**Mudança mínima — uma linha a mais dentro da transaction existente:**

```ts
// 1. Pega sourceKey antes de deletar (NOVO)
const entry = await tx.catalogEntry.findUnique({
  where: { id },
  select: { sourceKey: true },
});

// 2. Cleanup cascading (igual hoje)
// - cartItem.deleteMany
// - orderItem.deleteMany
// - catalogCategory/Tag/Character/Favorite/Comment/Review/CollectionItem.deleteMany
// - dismissed_duplicates onde gcd_id ou rika_id eram esse id (legado)

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
```

### 7. `sync-catalog.ts` (cron das 4h)

**Adicionar antes de cada `prisma.catalogEntry.create({...})`:**

```ts
const blocked = await prisma.removedSourceKey.findUnique({
  where: { sourceKey },
});
if (blocked) {
  stats.skipped++;
  // log agrupado no fim — não polui linha a linha
  continue;
}
```

Aplica nos dois loops (Rika e Panini). Adicional: stats.skipped reportado no log final do cron.

### 8. `cover-import.service.ts`

Mesmo lookup. Quando usuário tenta importar via cover-scan uma sourceKey já removida pelo admin, retorna erro explícito:

```ts
const blocked = await prisma.removedSourceKey.findUnique({ where: { sourceKey } });
if (blocked) {
  throw new BadRequestError('Esta entrada foi removida do catálogo pelo administrador.');
}
```

### 9. Frontend `apps/web/src/app/[locale]/(admin)/admin/duplicates/page.tsx`

Mudança mínima na linha 291-294:

```ts
// Antes
await apiClient.post('/admin/duplicates/dismiss', {
  gcdId: pair.gcd.id,
  rikaId: pair.rika.id,
});

// Depois
await apiClient.post('/admin/duplicates/dismiss', {
  sourceKeyA: pair.gcd.sourceKey,
  sourceKeyB: pair.rika.sourceKey,
});
```

(`sourceKey` já vem nos pares do GET — verificado.)

UI permanece igual.

---

## Plano de implementação (commits atômicos)

1. **Schema + migration**: cria `removed_source_keys`, altera `dismissed_duplicates`, registra modelos Prisma.
2. **Backend `admin.routes.ts`**: novos contratos (`POST /dismiss` recebe sourceKeys, `GET /duplicates` filtra NOT EXISTS espelhado, `DELETE` adiciona insert na blacklist).
3. **Backend `sync-catalog.ts`**: lookup blacklist antes de create.
4. **Backend `cover-import.service.ts`**: lookup blacklist antes de create.
5. **Frontend `/admin/duplicates/page.tsx`**: passa sourceKeys.
6. **Testes integração**: cobrindo os 3 cenários abaixo.

Cada item = 1 commit. Reverter um não desmonta os outros.

---

## Testes (TDD obrigatório)

**Cenário 1 — "Manter ambos" persiste após cron recriar entrada:**
1. Cria par (GCD-X, Rika-Y). Dispensa via POST.
2. Hard delete da entrada Rika-Y (simulando outro fluxo qualquer).
3. Recria entrada Rika com **novo cuid** e **mesma sourceKey** `rika:Y`.
4. GET `/admin/duplicates` no modo `pattern` E no modo `title`: par não aparece.

**Cenário 2 — Cron respeita blacklist:**
1. Cria entrada Rika com sourceKey `rika:1234`.
2. DELETE via `/admin/duplicates/:id`.
3. Roda `sync-catalog.ts` em modo dry-run mockando a fonte para retornar `rika:1234`.
4. Verifica: `stats.skipped++` e nenhuma entrada criada.

**Cenário 3 — Cover-scan respeita blacklist:**
1. Cria entrada com sourceKey `rika:5678`. Deleta via admin.
2. Usuário tenta importar via cover-scan a mesma sourceKey.
3. Verifica: erro 400 com mensagem clara.

**Cenário 4 — Reversão via SQL volta a importar:**
1. SourceKey blacklisted.
2. `DELETE FROM removed_source_keys WHERE source_key = 'rika:1234'`.
3. Cron volta a criar a entrada normalmente.

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| `dismissed_duplicates` em prod tem schema diferente que quebra `ALTER TABLE` | Antes de aplicar migration: rodar `SHOW CREATE TABLE dismissed_duplicates` em prod. Ajustar SQL ao schema real. |
| Backfill perde linhas órfãs (gcd_id ou rika_id de entradas já deletadas) | Aceitar a perda — info se perdeu mesmo. Logar count de órfãos descartados antes do DELETE. |
| Cover-scan import bloqueado frustra usuário comum | Mensagem clara com sugestão: "procure por edição equivalente no catálogo". |
| Cron loga muito quando há milhares de blacklisted | `stats.skipped` agrupado no log final. Sem print individual. |
| Em prod, a tabela `dismissed_duplicates` pode nem existir (lembrança falsa) | Migration cobre criação se não existir (`CREATE TABLE IF NOT EXISTS` na primeira step, depois ALTER). |

---

## Reversão (zero cerimônia)

**Reverter um par dispensado:**
```sql
DELETE FROM dismissed_duplicates
 WHERE source_key_a = LEAST('gcd:X', 'rika:Y')
   AND source_key_b = GREATEST('gcd:X', 'rika:Y');
```

**Reverter uma sourceKey blacklistada (volta a ser importada pelo cron):**
```sql
DELETE FROM removed_source_keys WHERE source_key = 'rika:1234';
```

**Listar tudo:**
```sql
SELECT * FROM dismissed_duplicates;
SELECT * FROM removed_source_keys;
```

---

## Próximos tickets (fora deste escopo, registrados em NEXT-STEPS.md)

1. **Esconder prefixo "rika"/"panini"/"gcd" das URLs públicas de capas.** Renomear filenames de `rika-{id}.jpg` para hash/cuid neutro. Migrar 9k+ arquivos no R2. Atualizar `coverFileName` no banco. Trabalho de 1 dia + cuidado com cache.
2. **Repensar premissa do cron das 4h.** Hoje importa automaticamente novidades de Rika + Panini. Avaliar se faz mais sentido import manual com curadoria do admin.
3. **Audit trail no dedup** (quando crescer e Fernando precisar saber "quem deletou X em Y data"). Migration aditiva quando demandado.
