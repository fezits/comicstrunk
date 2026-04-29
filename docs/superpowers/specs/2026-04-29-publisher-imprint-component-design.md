# Componente de Editoras e Selos — Design Spec

**Data:** 2026-04-29
**Branch:** `feat/publisher-imprint-component`
**Status:** Design aprovado, aguardando plano de implementação

---

## 1. Problema

Hoje `CatalogEntry.publisher` e `CatalogEntry.imprint` são strings livres. Em produção:

- **2587 valores distintos** em `publisher` — caos de variantes ("Marvel" vs "Marvel Comics" vs "marvel"), typos, abreviações, e lixo ("N/A", "do autor", "-").
- `imprint` quase nunca preenchido (1x — e errado, "DC Comics" como selo).
- Top 30 cobre ~95% dos gibis, mas a cauda longa polui buscas, filtros e qualquer agregação por editora.

A consequência: não dá pra oferecer filtro confiável por editora no catálogo público nem agrupar gibis pra páginas tipo `/publisher/marvel-comics`.

## 2. Objetivo

Substituir os campos string livre por seleção controlada (Publisher + Imprint como entidades estruturadas), mantendo compatibilidade com dados legados e permitindo que admin crie entries novos via UI sem dor.

**Sucesso:**
- Admin edita gibi e seleciona editora numa lista controlada (autocomplete).
- "Outro" inline cria editora nova com 1 click.
- CRUD admin permite mergir duplicatas e gerenciar lista.
- Logos de editoras conhecidas aparecem automaticamente (script roda no seed).
- Migração não quebra nada — gibis nunca editados continuam funcionando com a string legada.

## 3. Decisões de Design

| Item | Decisão |
|---|---|
| Hierarquia | Híbrido — `Imprint.publisherId` opcional |
| Cardinalidade | 1 publisher + 0-1 imprint por gibi |
| Atributos | name, slug, country, logoUrl, description, approvalStatus |
| País | Auto pelas top conhecidas no seed, editável manual |
| "Outro" inline | Só pede nome → cria `APPROVED` direto (admin é o único cadastrando) |
| Migração | Mantém `publisher: String?` legado + adiciona `publisherId?`. Match único + cleanup de lixo |
| Escopo | Componente seletor + CRUD admin básico + scraper de logos. Filtro público fica pra depois |
| Scraper | Script manual rodável (`pnpm scrape-publisher-logos`) — não worker em background |

## 4. Schema (Prisma)

### 4.1. Novas tabelas

```prisma
model Publisher {
  id              String         @id @default(cuid())
  name            String         @unique
  slug            String         @unique
  country         String?        // ISO-2: "BR", "US", "JP", "UK", "IT", "FR"
  logoUrl         String?        @map("logo_url")
  logoFileName    String?        @map("logo_file_name")
  description     String?        @db.Text
  approvalStatus  ApprovalStatus @default(APPROVED) @map("approval_status")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  imprints        Imprint[]
  catalogEntries  CatalogEntry[]

  @@map("publishers")
}

model Imprint {
  id              String         @id @default(cuid())
  name            String
  slug            String         @unique
  publisherId     String?        @map("publisher_id")
  logoUrl         String?        @map("logo_url")
  logoFileName    String?        @map("logo_file_name")
  description     String?        @db.Text
  approvalStatus  ApprovalStatus @default(APPROVED) @map("approval_status")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  publisher       Publisher?     @relation(fields: [publisherId], references: [id], onDelete: SetNull)
  catalogEntries  CatalogEntry[]

  @@unique([name, publisherId])
  @@index([publisherId])
  @@map("imprints")
}
```

### 4.2. Mudanças em CatalogEntry

```prisma
model CatalogEntry {
  // ... campos existentes mantidos ...
  publisher       String?        // legado — fallback até admin editar
  imprint         String?        // legado — fallback
  publisherId     String?        @map("publisher_id")
  imprintId       String?        @map("imprint_id")

  publisherRef    Publisher?     @relation(fields: [publisherId], references: [id], onDelete: SetNull)
  imprintRef      Imprint?       @relation(fields: [imprintId], references: [id], onDelete: SetNull)

  @@index([publisherId])
  @@index([imprintId])
}
```

### 4.3. Regra de leitura

API e frontend tratam editora como derivado: `publisherRef?.name ?? publisher`. Mesmo pra imprint. Frontend nunca precisa saber qual fonte está populada.

Service helper em `apps/api/src/shared/utils/publisher.ts`:

```ts
export function resolvePublisher(entry: CatalogEntryWithRefs) {
  return {
    name: entry.publisherRef?.name ?? entry.publisher ?? null,
    country: entry.publisherRef?.country ?? null,
    logoUrl: entry.publisherRef?.logoUrl ?? null,
    slug: entry.publisherRef?.slug ?? null,
    isStructured: !!entry.publisherRef,
  };
}
```

## 5. Componente Seletor (frontend)

Padrão baseado no `CharacterMultiSelect` existente (`apps/web/src/components/features/admin/character-multi-select.tsx`).

### 5.1. PublisherCombobox

**Single-select.** Endpoint: `GET /admin/publishers?search=&limit=20`.

- Busca debounced 300ms.
- Resultado: logo (24x24) + nome + país (badge "BR"/"US").
- Ordenação: por count de uso DESC, depois alfabético.
- Sem logo → placeholder neutro (silhueta de prédio).
- Último item da lista (sempre): `+ Outro — criar nova editora`.

### 5.2. ImprintCombobox

**Single-select, opcional.** Só renderiza após `publisherId` selecionado. Endpoint: `GET /admin/imprints?search=&publisherId=&limit=20`.

- Resultados priorizados pelo `publisherId` informado, com fallback pra imprints órfãos relevantes.
- Mesmo padrão visual do PublisherCombobox.

### 5.3. Comportamento "Outro"

```
[ Selecionar editora                              ▼ ]
┌────────────────────────────────────────────────┐
│ 🏢 Marvel Comics       [US]                    │
│ 🏢 DC Comics           [US]                    │
│ 🏢 Panini              [BR]                    │
│ ...                                            │
│ ─────────────────────────────                  │
│ + Outro — criar nova editora                   │
└────────────────────────────────────────────────┘
```

Click em "Outro":

```
[ Digite o nome da nova editora… ]  [Criar]
```

Enter ou click em "Criar":
1. Frontend POST `/admin/publishers` com `{ name }`.
2. Backend valida: nome único (case-insensitive). Se já existe, retorna 409 com sugestão.
3. Sucesso: cria entry com `approvalStatus=APPROVED`, retorna a entidade. Componente fecha o input e seleciona o item recém-criado.

### 5.4. Limpar seleção

Botão X no chip selecionado. Limpar Publisher → limpa Imprint automaticamente.

### 5.5. Layout no form

`/admin/catalog/edit` e `/admin/catalog/new`:
- Desktop: Publisher e Imprint lado a lado.
- Mobile: empilhados.
- Ordem: Publisher primeiro, Imprint depois.

## 6. CRUD Admin

### 6.1. `/admin/publishers`

**Listagem:** paginada (20/página). Colunas: logo (32x32), nome, país, count de gibis, approvalStatus, ações.

**Filtros:**
- Busca por nome.
- Country (dropdown).
- ApprovalStatus.
- "Sem logo" (boolean).

**Ações em massa:**
- Aprovar/rejeitar selecionados.
- **Mergir duplicatas** (ver 6.3).

### 6.2. `/admin/publishers/[id]` — detalhe/edit

Form: nome, slug (com aviso de impacto se editar), país (dropdown ISO-2), description (textarea), upload manual de logo (R2).

Aba lateral "Gibis dessa editora": count + link `/admin/catalog?publisherId={id}`.

Botão "deletar":
- Se count = 0 → confirmação simples → DELETE.
- Se count > 0 → bloqueado, mostra botão alternativo "Transferir gibis pra outra editora" que abre o merge flow.

### 6.3. Merge de duplicatas

UI: na listagem, multi-select via checkbox → botão "Mergir selecionados" → modal pede pra escolher o canônico (radio) entre os selecionados → confirma.

Backend (transação):
1. Move todos `catalog_entries.publisherId` dos `mergedIds` pro `canonicalId`.
2. Move imprints dos `mergedIds` pro `canonicalId` (atualiza `imprints.publisherId`).
3. Deleta publishers nos `mergedIds`.

Modal de confirmação dupla: "Essa ação é irreversível. X gibis e Y selos serão movidos."

### 6.4. `/admin/imprints` — análogo

Mesma estrutura. Coluna extra: editora-pai (mostra nome ou "—" se órfão). Edit permite trocar a editora-pai (dropdown de Publishers).

### 6.5. Permissões

Ambas páginas exigem role `ADMIN` (mesmo middleware de `/admin/catalog`).

## 7. API Endpoints

Todos respeitam o response format do projeto (`sendSuccess`, `sendPaginated`, `sendError`).

### 7.1. Públicos

```
GET /api/v1/publishers?search=&country=&page=&limit=
GET /api/v1/publishers/:slug
GET /api/v1/imprints?publisherId=&search=&page=&limit=
GET /api/v1/imprints/:slug
```

Filtram automaticamente por `approvalStatus=APPROVED`.

### 7.2. Admin

```
GET    /api/v1/admin/publishers?search=&country=&approvalStatus=&withoutLogo=&page=&limit=
POST   /api/v1/admin/publishers                    # cria (Outro inline ou CRUD)
GET    /api/v1/admin/publishers/:id
PATCH  /api/v1/admin/publishers/:id
POST   /api/v1/admin/publishers/:id/logo           # upload manual
DELETE /api/v1/admin/publishers/:id                # 409 se count > 0
POST   /api/v1/admin/publishers/merge              # { canonicalId, mergedIds[] }

# Espelhos pra imprints
GET    /api/v1/admin/imprints
POST   /api/v1/admin/imprints
GET    /api/v1/admin/imprints/:id
PATCH  /api/v1/admin/imprints/:id
POST   /api/v1/admin/imprints/:id/logo
DELETE /api/v1/admin/imprints/:id
POST   /api/v1/admin/imprints/merge
```

### 7.3. Validação (Zod)

`packages/contracts/src/publisher.ts` e `imprint.ts`:

```ts
export const publisherCreateSchema = z.object({
  name: z.string().min(1).max(100),
  country: z.string().length(2).toUpperCase().optional(),
  description: z.string().max(2000).optional(),
});

export const publisherUpdateSchema = publisherCreateSchema.partial().extend({
  slug: z.string().min(1).max(100).optional(),
});

export const publisherMergeSchema = z.object({
  canonicalId: z.string().cuid(),
  mergedIds: z.array(z.string().cuid()).min(1).max(50),
});

// Imprint análogo, com publisherId opcional.
```

## 8. Migração / Seed / Scraper

### 8.1. Migration Prisma

`apps/api/prisma/migrations/<ts>_add_publishers_imprints/migration.sql`:

1. Cria tabelas `publishers` e `imprints` com FK em `imprints.publisher_id`.
2. Adiciona colunas `publisher_id` e `imprint_id` em `catalog_entries` (nullable, FK SET NULL).
3. Adiciona índices em `catalog_entries.publisher_id` e `catalog_entries.imprint_id`.

Mantém `catalog_entries.publisher` e `catalog_entries.imprint` (não dropa).

### 8.2. Seed

`apps/api/prisma/seeds/publishers.json` — lista hardcoded:

**Publishers (BR):** Panini, Abril, Ebal, RGE, Mythos, JBC, Vecchi, Globo, O Globo, Conrad, La Selva, Devir, Mino, Pipoca & Nanquim, Escala, Record.

**Publishers (US):** Marvel Comics, DC Comics, Image Comics, Dark Horse Comics, IDW Publishing, Dynamite Entertainment, BOOM! Studios, Oni Press, Archie Comics, Fantagraphics, Aftershock, Valiant, Boom Box.

**Publishers (JP):** Shueisha, Shogakukan, Kodansha, VIZ Media, Yen Press, Seven Seas.

**Publishers (EU):** Bonelli (IT), Glénat (FR), Casterman (FR/BE), Dupuis (FR), Titan Comics (UK), Rebellion / 2000 AD (UK).

**Imprints:** Vertigo→DC, Black Label→DC, Wildstorm→DC, DC Zoom→DC, Marvel Knights→Marvel, MAX→Marvel, Ultimate→Marvel, Icon→Marvel, Marvel 2099→Marvel, Top Cow→Image, Skybound→Image, Shadowline→Image, Image Forge→Image, Berger Books→Dark Horse, IDW Black Crown→IDW.

Seed roda via `pnpm db:seed`. Idempotente (upsert por slug). País definido manualmente no JSON.

### 8.3. Match dos valores legados

`apps/api/scripts/match-publishers-legacy.ts`:

1. `SELECT DISTINCT publisher FROM catalog_entries WHERE publisher IS NOT NULL`.
2. Pra cada valor: normaliza (lowercase, sem acento via `unidecode`, remove sufixos `Comics?|Inc\.?|Ltd\.?|Editora|Publishing`).
3. Procura match em `publishers` (também normalizado). Hit → faz `UPDATE catalog_entries SET publisher_id = ? WHERE publisher = ?` em batch.
4. Cleanup de lixo: `UPDATE catalog_entries SET publisher = NULL WHERE publisher IN ('N/A', 'do autor', '-', '_', '?', 'Desconhecido', 'desconhecida')`.

Roda **uma vez**. Sem rollback automático — se algo der errado, a migration é reversível via Prisma.

### 8.4. Scraper de logos

`apps/api/scripts/scrape-publisher-logos.ts`:

1. `SELECT * FROM publishers WHERE logo_file_name IS NULL`.
2. Pra cada publisher:
   - Busca em Wikipedia API: `GET https://{lang}.wikipedia.org/w/api.php?action=query&titles={name}&prop=pageimages&piprop=original&format=json` (tenta `en` primeiro, depois `pt`).
   - Fallback Wikidata: `GET https://www.wikidata.org/w/api.php?action=wbsearchentities&search={name}&format=json` → pega entity → busca P154 (logo).
   - Se encontrou imagem: download, redimensiona pra 200x200 com sharp, sobe pro R2 em `publishers/{slug}.png`.
   - Atualiza `logoFileName=publishers/{slug}.png` e `logoUrl=https://covers.comicstrunk.com/publishers/{slug}.png`.
3. Print resumo: `X de Y publishers com logo agora`.

Idempotente. Pula publishers que já têm `logoFileName`. Pra forçar re-scrape, passa flag `--force`.

Mesmo script pra imprints (com flag `--target=imprints`).

## 9. Plano de Execução (faseado)

Pra evitar deploy gigante, divide em 4 fases. Cada fase é um deploy completo (commit, build, push prod, push develop+main).

### Fase 1 — Backend: schema + endpoints

- Migration Prisma.
- Service + routes pra publishers e imprints (público + admin).
- Validação Zod em `packages/contracts`.
- Seed dos top 50 + 15 imprints.
- Script de match legado.
- Script de scraper de logos.
- Roda seed + match em produção.
- Roda scraper em produção.
- Deploy API.

### Fase 2 — Frontend: componentes seletores

- `PublisherCombobox` e `ImprintCombobox` em `apps/web/src/components/features/admin/`.
- Integração no form de `/admin/catalog/edit` e `/admin/catalog/new`.
- Deploy Web.

### Fase 3 — CRUD admin

- `/admin/publishers` (listagem, filtros, merge).
- `/admin/publishers/[id]` (edit + upload de logo).
- `/admin/imprints` (análogo).
- Deploy Web.

### Fase 4 — Limpeza

- Atualiza nav do admin (link pra `/admin/publishers` e `/admin/imprints`).
- Tradução pt-BR.
- Documentação no `CLAUDE.md`.
- Deploy Web.

## 10. Edge Cases

- **Slug colisão:** `slugify(name)` colide → adiciona sufixo numérico (`marvel-comics-2`). Service helper já existe em `shared/utils/slug.ts`.
- **"Outro" duplicado case-insensitive:** se admin digita "panini" e já existe "Panini", backend retorna 409 com `existingId`. Componente sugere selecionar o existente.
- **Merge de Publisher com Imprints filhos:** imprints dos `mergedIds` são reapontados pro `canonicalId`. Se houver conflito de unique `(name, publisherId)`, loga e mantém o mais antigo.
- **Delete bloqueado:** se publisher tem CatalogEntries, retorna 409 com count. UI sugere transferir antes.
- **Cascade ao deletar Publisher:** Imprints com `publisherId` apontando viram órfãos (FK SET NULL). Decidido: ok manter órfãos, admin pode reapontar via edit.
- **Scraper falha:** logo não cadastrado, publisher fica sem logo. UI mostra placeholder. Admin pode subir manual via `/admin/publishers/[id]`.
- **Wikipedia rate limit:** scraper espera 500ms entre requests. Falha → log warn, continua próximo.
- **Performance:** queries do combobox usam índice em `name` (já é único). Limit 20 evita scan completo. Cache no frontend não é necessário pra MVP.

## 11. Não-Objetivos (YAGNI)

- Filtro público em `/catalog?publisher=...` (Fase futura).
- Página `/publisher/{slug}` listando todos os gibis (Fase futura).
- Many-to-many publishers (co-edições) — modelado como single-select pra simplicidade.
- ApprovalStatus PENDING/REJECTED workflow — admin cria APPROVED direto. Workflow vem quando user comum puder cadastrar gibi.
- Worker assíncrono pra scraper — script manual basta.
- Histórico de merges (audit trail) — operação é irreversível mas raros.

## 12. Riscos & Mitigações

| Risco | Mitigação |
|---|---|
| Migration travar tabela em produção | Migration apenas adiciona colunas (não dropa). Tempo curto. |
| Scraper baixar logo errado da Wikipedia | Admin pode substituir via UI. Fallback é null. |
| Match legado fundir editoras erradas | Match conservador (exact match pós-normalização). Em caso de dúvida, deixa intacto. |
| Componente não usar índice eficiente | Index em `(approval_status, name)` em `publishers`. Limit 20 sempre. |
| Merge perder dados | Transação atomic. Confirmação dupla na UI. |

---

## 13. Aprovação

Decisões tomadas via brainstorming em 2026-04-29:
- Hierarquia: Híbrido (resposta C)
- Cardinalidade: 1+0/1 (resposta A)
- Atributos: Pacote completo com scraper de logos (resposta C, com adições do usuário)
- UX "Outro": Inline minimalista (resposta B)
- Migração: Pragmática zero-pain (alinhada com "não quero dor de cabeça mas não quero erros demais")
- Escopo: Médio — componente + CRUD admin (resposta B)
- Scraper: Script manual (resposta A)

Implementação autorizada via mensagem "Faça tudo, commita, manda main, develop e faça deploy sem perguntar".
