# scan-capa: edição de texto antes da busca — Design

**Status:** Draft (criado 2026-05-02)
**Owner:** Fernando
**Tracking:** evolução do `/scan-capa` para permitir refinar o que o VLM extrai antes de buscar candidatos.

---

## TL;DR

Hoje `/scan-capa` faz tudo numa chamada só (`POST /cover-scan/recognize`): VLM extrai + busca local + busca Metron + busca Rika. Quando o VLM erra (título, número, editora), o usuário não vê nada além de "Identifiquei como X" — e os candidatos retornados são baseados num input que ele não pode corrigir.

Mudança: separar em **3 etapas**.

1. **Extrair** (VLM) — só extração, sem busca.
2. **Editar** — usuário corrige os campos e adiciona termos extras.
3. **Buscar** (iterativa) — busca local + Metron + Rika com os campos editados. Não satisfeito? Edita e busca de novo (sem chamar VLM novamente).

---

## Contexto e motivação

**Hoje (2026-05-02):**
- Frontend `apps/web/src/components/features/catalog/cover-photo-scanner.tsx` (455 linhas) faz upload → comprime → chama `recognize` → mostra candidatos.
- `recognize` retorna `{ candidates, scanLogId, identified: { title, issueNumber, publisher, series, ocrText, dominantColors, confidence } }`.
- O bloco "Identifiquei como" (read-only) mostra `identified` para o usuário entender o que o sistema extraiu, mas ele não pode mudar nada.

**Problema:**
- VLM erra com frequência em títulos longos, números variantes ("#42 Variant B"), e editoras com nome semelhante (Marvel Comics vs Marvel Knights).
- Usuário fica preso: ou aceita um candidato fraco, ou tira foto de novo.
- Pior: ao tirar nova foto, gasta outro neuron Cloudflare.

**Objetivo:**
- Permitir refinamento iterativo da query sem re-chamar VLM.
- Aceitar contexto extra que VLM não extrai (autor, ano, "selo capa variante", etc.).

---

## Decisões consolidadas

| # | Tema | Decisão |
|---|---|---|
| 1 | Campos editáveis | Os 5 textuais (`title`, `issueNumber`, `publisher`, `series`, `ocrText`) + textarea livre (`extraTerms`). Cores read-only. |
| 2 | Modelo de busca | Iterativo. Re-busca **não** chama VLM. |
| 3 | Termos extras | Textarea único de texto livre. Backend tokeniza para boost. |
| 4 | Fontes externas | Cada busca re-pinga Metron + Rika. Caches de Metron (TTL 1h) e Rika absorvem repetição. |
| 5 | Endpoints | `/recognize` quebrado: passa a só extrair (sem candidates). `/search` ganha campos editados + extras. |
| 6 | scanLog | Um log por upload. Buscas iterativas atualizam `candidatesShown` no mesmo log + incrementam `searchAttempts`. |
| 7 | Rate limit | Conta 1 unidade só no `recognize` (que consome VLM tokens). `search` não conta. |

---

## Não-objetivos (fora de escopo)

1. **Editar fonte da busca** (filtrar Metron / Rika individualmente). Sempre busca em todas.
2. **Histórico visível de buscas dentro da sessão** ("tentativa 1, 2, 3"). Substituição simples — re-buscar substitui candidatos.
3. **Auto-search ao digitar** (debounce). Usuário clica "Buscar" explicitamente.
4. **Re-extração** se usuário trocar foto. Re-upload reseta tudo (volta ao stage `idle`).
5. **Editar via voz** ou "sugestões inteligentes". YAGNI.
6. **Re-confiança / re-cores** após edição. Cores ficam fixas da foto original. Confidence do VLM é mostrada se vier, mas não recalculada.
7. **Validação Zod estrita** dos campos editados (ex: número precisa ser inteiro). Conversão best-effort no backend; campos vazios viram `undefined`.

---

## Arquitetura

### 1. Backend — `POST /cover-scan/recognize` (mudança quebrante)

**Input** (igual hoje):
```ts
{
  imageBase64: string,       // data URI
  durationMs?: number,
  forceVisualSearch?: boolean,
}
```

**Output alvo** (sem `candidates`):
```ts
{
  scanLogId: string,
  identified: {
    title: string | null,
    issueNumber: number | null,
    publisher: string | null,
    series: string | null,
    ocrText: string,
    dominantColors: string[],
    confidence: number | null,
  },
}
```

**Comportamento:**
- Chama VLM (Llama 3.2 Vision via Cloudflare Workers AI). Se `forceVisualSearch=true`, usa Google Vision Web Detection no lugar.
- Cria `cover_scan_logs` com `rawText = identified.ocrText` (ou JSON stringificado da resposta VLM completa, manter padrão atual), `candidatesShown = []`, `searchAttempts = 0`.
- Retorna `scanLogId` + `identified`.
- **Não busca em catálogo, Metron ou Rika.**

**Rate limit:** continua aplicando `COVER_SCAN_DAILY_LIMIT` (default 30) **só aqui**.

### 2. Backend — `POST /cover-scan/search` (mudança aditiva)

**Input atual:**
```ts
{
  rawText: string,
  ocrTokens: string[],
  candidateNumber?: number,
  durationMs?: number,
}
```

**Input alvo:**
```ts
{
  scanLogId: string,                // OBRIGATÓRIO — vincular ao log do recognize
  title?: string,
  issueNumber?: number,
  publisher?: string,
  series?: string,
  ocrText?: string,                 // texto bruto editado pelo usuário
  extraTerms?: string,              // textarea livre, max 500 chars
  durationMs?: number,
}
```

Compat: se cliente antigo enviar só `{ rawText, ocrTokens }`, ainda funciona — campos novos são opcionais. Cliente novo sempre envia novo formato.

**Output** (igual hoje):
```ts
{
  candidates: CoverScanCandidate[],
  scanLogId: string,
  identified: CoverScanIdentified,  // reflete os campos da requisição (echo)
}
```

**Comportamento:**
- Monta query a partir dos campos editados:
  - `must` tokens: termos do `title` + `series`.
  - `boost` tokens: termos do `publisher` + tokens do `extraTerms` (tokenização: split em whitespace + vírgula, lowercase, descarta tokens com <2 chars).
  - `editionNumber`: `issueNumber` (se nulo, fallback para regex em `title`).
  - `ocrTokens`: tokeniza `ocrText` se preenchido (mesma lógica usada hoje em `searchByText`).
- Busca local (catálogo) + chama Metron + Rika em paralelo (`Promise.allSettled`). Mesma lógica de federated search atual.
- Atualiza `cover_scan_logs`:
  - `candidatesShown = <novo array>` (substitui)
  - `searchAttempts += 1`
- **Sem rate limit** — busca não consome neurons.

### 3. Schema Prisma (migration aditiva)

```prisma
model CoverScanLog {
  // ...campos existentes
  searchAttempts Int @default(0) @map("search_attempts")
}
```

Migration: `ALTER TABLE cover_scan_logs ADD COLUMN search_attempts INT NOT NULL DEFAULT 0;`

Sem charset/PK issues (não é índice).

### 4. Contracts (`packages/contracts/src/cover-scan.ts`)

Schema novo de search:
```ts
export const coverScanSearchSchema = z.object({
  scanLogId: z.string().min(1),
  title: z.string().max(255).optional(),
  issueNumber: z.number().int().nonnegative().max(99999).optional(),
  publisher: z.string().max(100).optional(),
  series: z.string().max(255).optional(),
  ocrText: z.string().max(5000).optional(),
  extraTerms: z.string().max(500).optional(),
  durationMs: z.number().int().nonnegative().max(600000).optional(),
});
```

Schema de recognize não muda (input). Response sim — remove `candidates`.

### 5. Frontend — `cover-photo-scanner.tsx`

Stages atualizados:

```ts
type Stage =
  | 'idle'           // botão de upload
  | 'compressing'    // comprimindo a imagem antes de enviar
  | 'extracting'     // VLM analisando (mesmo que 'analyzing' atual)
  | 'editing'        // NOVA: form com campos editáveis
  | 'searching'      // busca rodando
  | 'results'        // candidatos visíveis
  | 'error';
```

**Estado adicional:**
```ts
const [editFields, setEditFields] = useState<{
  title: string;
  issueNumber: string;       // mantém string no UI; converte na hora de enviar
  publisher: string;
  series: string;
  ocrText: string;
  extraTerms: string;
}>(...);
```

**Fluxo:**

1. `idle` → upload → `compressing` → chama `recognize` → recebe `identified` → preenche `editFields` com defaults do VLM → vai para `editing`.
2. `editing` → usuário edita → clica "Buscar" → `searching` → chama `search` → `results`.
3. `results` → botão "Editar e buscar de novo" → volta para `editing` (mantém `editFields` + mostra candidatos abaixo do form). Foto continua no topo, fixa.
4. `results` → usuário escolhe candidato → modal confirm → adiciona à coleção (igual hoje).
5. Em qualquer ponto: re-upload reseta tudo (volta para `idle`).

**Tela `editing` — layout:**

```
┌─────────────────────────────────────────┐
│ [foto small]  Cores: 🔴 🔵 ⚪            │
├─────────────────────────────────────────┤
│ Título *                                │
│ [_______________________________]       │
│                                         │
│ Número                                  │
│ [_____]                                 │
│                                         │
│ ▼ Mostrar mais campos                   │  ← collapsed em mobile
│                                         │
│ Editora                                 │
│ [_______________________________]       │
│                                         │
│ Série                                   │
│ [_______________________________]       │
│                                         │
│ Texto da capa                           │
│ [textarea, 3 linhas]                    │
│                                         │
│ Outros termos (opcional)                │
│ [textarea, 2 linhas]                    │
│ "Ex: Frank Miller, 1986, capa variante" │
│                                         │
│         [    Buscar    ]                │
└─────────────────────────────────────────┘
```

- Mobile (≤640px): "Mostrar mais campos" começa collapsed. Apenas `title` + `issueNumber` aparecem inicialmente.
- Desktop (≥640px): tudo expandido por padrão.
- Campo "Texto da capa": preenchido com `ocrText` do VLM (truncado a 500 chars no display, mas backend aceita até 5000).
- Botão "Resetar para original" pequeno e discreto ao lado de cada campo editado (compara com valor original do VLM, mostra só se foi alterado).

**`results` com botão "Editar de novo":**

Mantém candidatos na lista atual, mas adiciona acima dos candidatos:
```
┌─────────────────────────────────────────┐
│ Você buscou: "Spawn 79"                 │
│ Não é o que procura?                    │
│ [Editar e buscar de novo]               │
└─────────────────────────────────────────┘
```

### 6. API client (`apps/web/src/lib/api/cover-scan.ts`)

Adicionar nova função:
```ts
export async function searchWithFields(input: CoverScanSearchInput): Promise<CoverScanSearchResponse> {
  const { data } = await apiClient.post('/cover-scan/search', input);
  return data.data;
}
```

Função `recognize` existente: ajustar tipo do retorno (sem `candidates`).

---

## Migration plan (em ordem)

1. **Contracts**: atualiza schema de search + response de recognize. Build + commit.
2. **Prisma migration**: adiciona `search_attempts` em `cover_scan_logs`. Build + commit.
3. **Backend `cover-recognize.service.ts`**: separar logic. Função `extractIdentified()` (chama VLM, cria scanLog, retorna identified) usada pelo `/recognize`. Funções existentes de busca movidas para serem chamadas via `/search`.
4. **Backend `cover-scan.service.ts`** (`searchByText` ou função nova `searchWithFields`): aceita campos editados, monta tokens, faz busca + Metron + Rika. Atualiza scanLog.
5. **Backend routes**: ajusta `/recognize` (output sem candidates). `/search` ganha novo schema.
6. **Frontend**: adiciona stage `editing`, novos campos no state, novo layout. Atualiza chamadas API.
7. **Testes integração**: cobrindo fluxo completo (extract → edit → search; iteração; mudança de campo entre buscas).
8. **Smoke test em prod**: scan real, edita título, busca, confere candidatos diferentes.

Cada item = 1 commit. Branch `feat/scan-capa-edit-before-search` a partir de `main`. Merge → develop → main no final.

---

## Testes (TDD)

**Cenário 1 — Recognize sem busca:**
- Mock VLM retornando `{ title: 'Test', ... }`.
- POST `/cover-scan/recognize` com base64 válido.
- Espera response `{ scanLogId, identified }`. **Não** deve ter `candidates`.
- DB: `cover_scan_logs` tem 1 row com `searchAttempts = 0`, `candidatesShown = []`.

**Cenário 2 — Search com campos editados:**
- Cria scanLog (via mock ou direto no DB).
- POST `/cover-scan/search` com `{ scanLogId, title: 'Spawn', issueNumber: 79, extraTerms: 'image comics' }`.
- Espera candidates não vazio se houver match no catálogo.
- DB: scanLog atualizado com `searchAttempts = 1`, `candidatesShown` populado.

**Cenário 3 — Search iterativo:**
- Cria scanLog com `searchAttempts = 1`.
- POST `/cover-scan/search` com `{ scanLogId, title: 'Spawn', issueNumber: 80 }`.
- Espera candidates atualizados.
- DB: scanLog tem `searchAttempts = 2`, `candidatesShown` substituído.

**Cenário 4 — Search sem campos relevantes:**
- POST `/cover-scan/search` com `{ scanLogId }` apenas (todos campos vazios).
- Espera 400 (ou candidates vazio com warning). Decisão: **400 com mensagem "Forneça pelo menos um termo de busca"**.

**Cenário 5 — Search com scanLog inexistente:**
- POST com `scanLogId` aleatório.
- Espera 404.

**Cenário 6 — Rate limit:**
- 30 chamadas a `/recognize` no dia → 31ª retorna 429.
- 30+ chamadas a `/search` no dia → todas passam (não conta).

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Usuário esquece de clicar "Buscar" depois de editar e tem expectativa de auto-search | Botão grande, primário, "Buscar" sempre visível. Sem placeholder ambíguo. |
| Iteração faz Metron / Rika serem chamados N vezes — possível quota | Caches existentes (TTL 1h em Metron, in-memory em Rika) absorvem. Em prod, monitor de Rate. |
| Build breaks em outros consumidores de `/recognize` | Apenas 1 consumidor: `cover-photo-scanner.tsx`. Atualização em sync com backend evita falhas. |
| `searchAttempts` cresce indefinido (usuário pode buscar 100x) | Não é prejudicial (apenas contador). Se virar problema, cap em 50 com toast "máximo de tentativas atingido". |
| Mobile UX pesada com 6 campos visíveis | Accordion collapse default em mobile (apenas `title` + `issueNumber` visíveis). |
| Cliente antigo (versão velha em cache) chama `/recognize` esperando `candidates` | Como ambos os endpoints estão sob auth + rate limit, o blast radius é controlado. Após deploy, qualquer chamada antiga resulta em UI quebrada — força refresh. Cloudflare cache purge pós-deploy minimiza. |

---

## Reversão

Se o feature der problema em prod e precisar voltar atrás:

1. Frontend: reverter `cover-photo-scanner.tsx` para versão anterior (1 commit).
2. Backend: reverter `cover-recognize.service.ts` + `cover-scan.routes.ts` (separar 2 commits — um por arquivo).
3. Migration `searchAttempts`: drop column é seguro (não há dados perdidos relevantes).

---

## Próximos passos imediatos

1. **Fernando aprova ou ajusta este spec.**
2. **Gerar plano de implementação** via skill `writing-plans` (cada task com TDD strict).
3. **Implementação em branch nova** `feat/scan-capa-edit-before-search` a partir de `main`.
4. **Após merge:** smoke test em prod (scan real, edita, refina).
