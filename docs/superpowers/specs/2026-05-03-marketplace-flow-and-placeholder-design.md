# Design: Filtro de capa em destaque + UI de payouts + E2E completo do fluxo de venda

**Data:** 2026-05-03
**Branch sugerida:** `feat/marketplace-flow-and-placeholder`
**Status:** aprovado pelo Fernando, pendente revisão escrita

## Contexto

Duas demandas relacionadas a marketplace e UI:

1. **"Catalogo em Destaque"** na home esta exibindo gibis sem capa ou com capa placeholder. Visualmente pobre — precisa filtrar.
2. **Fluxo completo de venda** precisa ser testado E2E, com 3 usuarios reais (admin, vendedor, comprador), screenshots de cada fase, ate liberacao do valor pro vendedor. Achado durante o brainstorming: a API de payouts esta completa em `apps/api/src/modules/payouts/`, mas **nao existe nenhuma UI** (nem para vendedor ver saldo / pedir saque, nem para admin aprovar / marcar pago). Sem essas UIs, o teste E2E nao pode cobrir a fase final.

Decisao: esse spec cobre as 4 partes (filtro + 2 UIs novas + E2E). Ordem de execucao: **Parte 1 → Parte 3 → Parte 4 → Parte 2** (E2E depende das UIs novas).

## Parte 1 — Filtrar capa vazia/placeholder em "Catalogo em Destaque"

### Regra unica
Em "Catalogo em Destaque" (`CATALOG_HIGHLIGHTS` na homepage), gibis com capa **vazia** OU **placeholder** (`https://covers.comicstrunk.com/cover-placeholder.jpg` ou similar) nao aparecem. Sem alteracoes em outras telas, sem placeholder novo, sem mudanca no frontend.

### Implementacao
Mudanca **unica** em `apps/api/src/modules/homepage/homepage.service.ts`, funcao `resolveCatalogHighlights`:

**Cenario A — fallback automatico** (sem `contentRefs.catalogIds`, linhas 222-229 atuais): a query SQL ja filtra `cover_image_url IS NOT NULL OR cover_file_name IS NOT NULL`. Adicionar exclusao do placeholder:

```sql
SELECT id FROM catalog_entries
WHERE approval_status = 'APPROVED'
  AND (
    (cover_file_name IS NOT NULL AND cover_file_name <> '')
    OR (
      cover_image_url IS NOT NULL
      AND cover_image_url <> ''
      AND cover_image_url NOT LIKE '%cover-placeholder%'
    )
  )
ORDER BY RAND()
LIMIT 8
```

**Cenario B — IDs escolhidos pelo admin** (com `contentRefs.catalogIds`, linha 215 atual): hoje aceita qualquer ID. Aplicar o mesmo filtro via Prisma:

```ts
entries = await prisma.catalogEntry.findMany({
  where: {
    id: { in: refs.catalogIds },
    approvalStatus: 'APPROVED',
    OR: [
      { coverFileName: { not: null } },
      {
        AND: [
          { coverImageUrl: { not: null } },
          { NOT: { coverImageUrl: { contains: 'cover-placeholder' } } },
        ],
      },
    ],
  },
  select: catalogSelect,
});
```

### Resultado
O componente `homepage-catalog-highlights.tsx` ja chama `if (displayItems.length === 0) return null` ([linha 55](../../apps/web/src/components/features/homepage/homepage-catalog-highlights.tsx#L55)) — se zero items passarem o filtro, a secao some inteira. Sem mudanca no frontend.

### Edge cases
- **Admin escolhe 8 IDs e 3 sao filtrados:** secao mostra 5 cards (comportamento ok).
- **Admin escolhe 1 ID que e filtrado:** secao some inteira.
- **Banco vazio:** secao some inteira (ja era assim).

## Parte 2 — E2E test do fluxo completo de venda

### Arquivo
`packages/e2e/tests/marketplace-flow/full-purchase.spec.ts`

### Configuracao via env vars
| Var | Default |
|-----|---------|
| `ADMIN_EMAIL` | `admin@comicstrunk.com` |
| `ADMIN_PASSWORD` | `Admin123!` |
| `SELLER_EMAIL` | `vai_q_eh@yahoo.com.br` |
| `SELLER_PASSWORD` | `Ct@2026!Teste` |
| `BUYER_EMAIL` | `braidatto@gmail.com` |
| `BUYER_PASSWORD` | `Ct@2026!Teste` |
| `E2E_CLEANUP` | `false` (true para limpar dados ao final) |

### Setup (`beforeAll`)
1. Garantir que admin/seller/buyer existem no banco — signup via `POST /auth/signup` se faltar (idempotente, captura erro 409).
2. Criar e aprovar um `CatalogEntry` via `dataFactory.createAndApproveCatalogEntry`, titulo `[E2E-MARKET] Test Comic <timestamp>`.
3. Limpar carrinho do buyer (`DELETE /cart` em loop), ordens pendentes do buyer/seller relacionadas a esse titulo.
4. Garantir conta bancaria primaria do seller — criar via `POST /banking` se nao tiver (`bankName: 'Itau'`, `branchNumber: '0001'`, etc).
5. Garantir endereco do buyer — criar via `POST /shipping/addresses` se nao tiver.

### Helper de print
Wrapper em `packages/e2e/helpers/screenshot.ts`:

```ts
export async function takeScreenshot(page: Page, name: string) {
  await page.waitForLoadState('networkidle');
  // Aguarda spinners conhecidos sumirem
  await page.locator('.animate-spin').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});
  await page.screenshot({
    path: `docs/superpowers/specs/screenshots/2026-05-03-marketplace-flow/${name}`,
    fullPage: true,
  });
}
```

### Fases (uma `test()` longa, com `test.step()` por fase)

| # | Fase | Usuario | Acao | Print |
|---|------|---------|------|-------|
| 01 | Vendedor adiciona a colecao | seller | `/collection/add` → escolhe entry, condition `NEW`, salva | `01-seller-collection-add.png` |
| 02 | Vendedor coloca a venda | seller | `/collection/{id}` → `isForSale=true`, salePrice R$ 35, shippingCost R$ 10 | `02-seller-list-for-sale.png` |
| 03 | Item publico no marketplace | anon (incognito) | `/marketplace?query=<titulo>` | `03-marketplace-public-listing.png` |
| 04 | Detalhe do anuncio | anon | clica no card | `04-listing-detail.png` |
| 05 | Comprador adiciona ao carrinho | buyer | login + `/marketplace/{id}` + "Adicionar ao carrinho" | `05-cart-with-item.png` |
| 06 | Checkout — endereco + resumo | buyer | `/checkout` (R$ 45 total) | `06-checkout-summary.png` |
| 07 | Pedido criado (PENDING) | buyer | confirma → redireciona `/orders/{id}` | `07-order-pending.png` |
| 08 | Pagamento PIX (QR) | buyer | `/checkout/payment` | `08-pix-qr-code.png` |
| 09 | Admin lista pagamentos pendentes | admin | `/admin/payments` | `09-admin-payments-list.png` |
| 10 | Admin aprova pagamento | admin | clica "Aprovar" | `10-admin-payment-approved.png` |
| 11 | Vendedor ve pedido pago | seller | `/seller/orders/{id}` (PAID) | `11-seller-order-paid.png` |
| 12 | Vendedor marca em processamento | seller | botao → PROCESSING | `12-seller-processing.png` |
| 13 | Vendedor envia (com tracking) | seller | preenche codigo → SHIPPED | `13-seller-shipped.png` |
| 14 | Comprador ve enviado | buyer | `/orders/{id}` (SHIPPED + tracking) | `14-buyer-shipped.png` |
| 15 | Comprador confirma entrega | buyer | "Marcar entregue" → DELIVERED | `15-buyer-delivered.png` |
| 16 | Comprador finaliza pedido | buyer | "Finalizar pedido" → COMPLETED | `16-buyer-completed.png` |
| 17 | Vendedor ve saldo creditado | seller | `/seller/payouts` (UI Parte 3) | `17-seller-balance-credited.png` |
| 18 | Vendedor solicita saque | seller | "Solicitar saque" → R$ 31,50 | `18-seller-payout-requested.png` |
| 19 | Admin lista saques pendentes | admin | `/admin/payouts` (UI Parte 4) | `19-admin-payouts-list.png` |
| 20 | Admin aprova saque | admin | clica "Aprovar" | `20-admin-payout-approved.png` |
| 21 | Admin marca como pago | admin | preenche `externalReceipt` | `21-admin-payout-paid.png` |
| 22 | Vendedor ve saque pago | seller | `/seller/payouts` (PAID + recibo) | `22-seller-payout-paid.png` |

### Calculo do valor esperado
- salePrice R$ 35,00
- Plano FREE → comissao 10% → R$ 3,50
- `sellerNetSnapshot` = R$ 31,50
- Frete (R$ 10) nao entra na comissao mas tambem nao vai pro saldo — fica com o vendedor por fora.

### Comando para rodar
```bash
corepack pnpm --filter e2e exec playwright test marketplace-flow/full-purchase --headed
```

### Limpeza (`afterAll`)
Default desligado (`E2E_CLEANUP=false`) — deixa os dados pra inspecao manual. Quando `true`: cancela ordens criadas, remove item da colecao, deleta catalog entry de teste.

## Parte 3 — UI seller payout

### Pagina nova
`apps/web/src/app/[locale]/(seller)/seller/payouts/page.tsx`

### Layout

```
┌──────────────────────────────────────────────┐
│  Saques                                      │
├──────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐           │
│  │ Disponivel  │  │ Em processo │           │
│  │ R$ 31,50    │  │ R$ 0,00     │           │
│  └─────────────┘  └─────────────┘           │
│  ┌─────────────┐  ┌─────────────┐           │
│  │ Total ganho │  │ Total pago  │           │
│  │ R$ 31,50    │  │ R$ 0,00     │           │
│  └─────────────┘  └─────────────┘           │
│                                              │
│  [Solicitar saque]                          │
│                                              │
│  ─── Historico de movimentacoes ───         │
│  Data   Tipo            Valor    Notas      │
│  03/05  Credito venda   +R$31,50  ...       │
│                                              │
│  ─── Pedidos de saque ───                   │
│  Data    Valor   Status    Recibo           │
│  03/05  R$31,50  PAID      ABC123...        │
└──────────────────────────────────────────────┘
```

### Componentes
1. **4 cards de saldo** (Disponivel, Em processo, Total ganho, Total pago) — valores em BRL via `Intl.NumberFormat('pt-BR', { currency: 'BRL' })`. Icones Lucide: `Wallet`, `Clock`, `TrendingUp`, `CheckCircle2`.
2. **Botao "Solicitar saque"** — `Dialog` com:
   - Input numerico do valor (default = `available`, max = `available`, step 0.01)
   - Aviso: "Valor sera transferido para conta bancaria primaria cadastrada"
   - Se `bankAccounts.length === 0`: mostra alerta + link para `/seller/banking`, botao "Confirmar" desabilitado
   - Validacao: `> 0` e `<= available`
   - Botoes "Cancelar" / "Confirmar"
3. **Tabela de movimentacoes** (`SellerBalanceEntry` paginada, mais recente primeiro):
   - Colunas: data, tipo (`SALE_CREDIT` → "Credito de venda" / `PAYOUT_DEBIT` → "Saque pago"), valor (verde se positivo, vermelho se negativo), notas
   - 20 por pagina, navegacao prev/next
4. **Tabela de pedidos de saque** (`PayoutRequest` paginado):
   - Colunas: data solicitacao, valor, status badge, data pagamento (se PAID), recibo externo (truncado + tooltip), motivo de rejeicao (se REJECTED, mostra inline)
   - 20 por pagina

### API client novo
`apps/web/src/lib/api/payouts.ts`:

```ts
export interface SellerBalance {
  available: number;
  pending: number;
  totalEarned: number;
  totalPaidOut: number;
}

export interface BalanceEntry {
  id: string;
  kind: 'SALE_CREDIT' | 'PAYOUT_DEBIT';
  amount: number;
  notes: string | null;
  createdAt: string;
  orderItemId: string | null;
  payoutId: string | null;
}

export interface PayoutRequest {
  id: string;
  amount: number;
  status: 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED';
  requestedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
  externalReceipt: string | null;
  adminNotes: string | null;
}

export async function getMyBalance(): Promise<SellerBalance>;
export async function listMyBalanceEntries(page: number, limit: number): Promise<Paginated<BalanceEntry>>;
export async function requestPayout(amount: number): Promise<PayoutRequest>;
export async function listMyPayouts(page: number, limit: number): Promise<Paginated<PayoutRequest>>;
```

### Entrada no menu lateral
Adicionar item `Saques` no grupo "Seller" do `nav-config.ts` (junto de `seller/banking` e `seller/orders`). Icone `Wallet`. Posicao: depois de "Banking", antes de "Disputas".

### i18n
Namespace `payouts` em `apps/web/src/messages/pt-BR.json`:

| Chave | Valor |
|-------|-------|
| `title` | "Saques" |
| `available` | "Disponivel" |
| `pending` | "Em processo" |
| `totalEarned` | "Total ganho" |
| `totalPaidOut` | "Total pago" |
| `requestPayout` | "Solicitar saque" |
| `requestPayoutDialogTitle` | "Solicitar saque" |
| `amount` | "Valor" |
| `amountHint` | "Valor disponivel: {amount}" |
| `confirm` | "Confirmar" |
| `cancel` | "Cancelar" |
| `noBank` | "Voce precisa cadastrar uma conta bancaria antes de solicitar saque." |
| `goToBanking` | "Cadastrar conta bancaria" |
| `historyTitle` | "Historico de movimentacoes" |
| `payoutsTitle` | "Pedidos de saque" |
| `noEntries` | "Nenhuma movimentacao ainda." |
| `noPayouts` | "Nenhum pedido de saque ainda." |
| `kind.SALE_CREDIT` | "Credito de venda" |
| `kind.PAYOUT_DEBIT` | "Saque pago" |
| `status.REQUESTED` | "Solicitado" |
| `status.APPROVED` | "Aprovado" |
| `status.PAID` | "Pago" |
| `status.REJECTED` | "Rejeitado" |
| `externalReceipt` | "Recibo" |
| `rejectionReason` | "Motivo: {reason}" |
| `payoutRequested` | "Saque solicitado com sucesso" |

### Contracts
Criar `packages/contracts/src/payouts.ts` com schemas Zod e tipos inferidos:
- `SellerBalanceSchema`, `SellerBalanceOutput`
- `BalanceEntrySchema`, `BalanceEntryOutput`
- `PayoutRequestSchema`, `PayoutRequestOutput`
- `RequestPayoutInputSchema` (`{ amount: number > 0 }`)
- `AdminMarkPaidInputSchema` (`{ externalReceipt?: string }`)
- `AdminRejectPayoutInputSchema` (`{ reason: string min 3 }`)

Re-exportar em `packages/contracts/src/index.ts`.

## Parte 4 — UI admin payout

### Pagina nova
`apps/web/src/app/[locale]/(admin)/admin/payouts/page.tsx`

### Layout

```
┌──────────────────────────────────────────────────────┐
│  Saques de vendedores                                │
├──────────────────────────────────────────────────────┤
│  Filtros: [Todos] [REQUESTED] [APPROVED] [PAID]     │
│           [REJECTED]                                 │
│                                                      │
│  Vendedor    Valor    Status    Solicitado  Acoes   │
│  ────────────────────────────────────────────────   │
│  Joao S.    R$31,50  REQUESTED  03/05      [Ver]    │
│  Maria L.   R$120,00 APPROVED   01/05      [Ver]    │
│                                                      │
│  [< Anterior]  Pagina 1 de 3  [Proxima >]          │
└──────────────────────────────────────────────────────┘
```

### Modal de detalhes ao clicar "Ver"

```
┌──────────────────────────────────────────────┐
│  Saque de Joao Silva               [X]       │
├──────────────────────────────────────────────┤
│  Status: REQUESTED                           │
│  Valor: R$ 31,50                             │
│  Solicitado em: 03/05/2026 14:32             │
│                                              │
│  ── Dados bancarios ──                       │
│  Banco: Itau (341)                           │
│  Agencia: 0001  Conta: 12345-6 (corrente)    │
│  CPF: ***.***.***-XX                         │
│  Titular: Joao Silva                         │
│                                              │
│  ── Acoes ──                                 │
│  [Aprovar]  [Marcar como pago]  [Rejeitar]  │
└──────────────────────────────────────────────┘
```

### Fluxos de acao
1. **Aprovar** — `confirm()` simples → `POST /payouts/admin/{id}/approve` → atualiza lista
2. **Marcar como pago** — sub-modal com input opcional `externalReceipt` (ex: "PIX-XYZ123") → `POST /payouts/admin/{id}/paid`
3. **Rejeitar** — sub-modal com `Textarea reason` (obrigatorio, min 3 chars) → `POST /payouts/admin/{id}/reject`

### Botoes condicionais por status
| Status | Botoes mostrados |
|--------|------------------|
| `REQUESTED` | Aprovar, Marcar como pago, Rejeitar |
| `APPROVED` | Marcar como pago, Rejeitar |
| `PAID` | (somente leitura) |
| `REJECTED` | (somente leitura) |

### Snapshot bancario
Vem do campo `bankSnapshot` (JSON salvo no momento da solicitacao). Mascarar CPF parcialmente (`***.***.***-XX`) — extrair primeiros 3 e ultimos 2 digitos.

### API client novo
`apps/web/src/lib/api/admin-payouts.ts`:

```ts
export interface AdminPayoutListItem extends PayoutRequest {
  seller: {
    id: string;
    name: string;
    email: string;
  };
  bankSnapshot: {
    bankName: string;
    branchNumber: string;
    accountNumber: string;
    cpf: string;
    holderName: string;
    accountType: string;
  };
}

export async function adminListPayouts(filters: {
  status?: 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED';
  page?: number;
  limit?: number;
}): Promise<Paginated<AdminPayoutListItem>>;

export async function adminApprovePayout(id: string): Promise<PayoutRequest>;
export async function adminMarkPayoutPaid(id: string, externalReceipt?: string): Promise<PayoutRequest>;
export async function adminRejectPayout(id: string, reason: string): Promise<PayoutRequest>;
```

### Entrada no menu admin
Adicionar `Saques` no grupo admin do sidebar. Icone `Banknote` (Lucide). Posicao: depois de "Pagamentos", antes de "Disputas".

### i18n
Namespace `adminPayouts`:

| Chave | Valor |
|-------|-------|
| `title` | "Saques de vendedores" |
| `filters.all` | "Todos" |
| `filters.requested` | "Solicitados" |
| `filters.approved` | "Aprovados" |
| `filters.paid` | "Pagos" |
| `filters.rejected` | "Rejeitados" |
| `seller` | "Vendedor" |
| `amount` | "Valor" |
| `status` | "Status" |
| `requestedAt` | "Solicitado em" |
| `view` | "Ver" |
| `approve` | "Aprovar" |
| `markAsPaid` | "Marcar como pago" |
| `reject` | "Rejeitar" |
| `bankInfo` | "Dados bancarios" |
| `bank` | "Banco" |
| `branch` | "Agencia" |
| `account` | "Conta" |
| `cpf` | "CPF" |
| `holderName` | "Titular" |
| `accountType.CHECKING` | "Corrente" |
| `accountType.SAVINGS` | "Poupanca" |
| `externalReceipt` | "Recibo externo (opcional)" |
| `externalReceiptHint` | "Identificador do PIX, TED ou DOC pago" |
| `rejectionReason` | "Motivo da rejeicao" |
| `rejectionReasonRequired` | "Informe o motivo (minimo 3 caracteres)" |
| `confirmApprove` | "Tem certeza que deseja aprovar este saque?" |
| `noPayouts` | "Nenhum saque encontrado." |
| `payoutApproved` | "Saque aprovado" |
| `payoutMarkedPaid` | "Saque marcado como pago" |
| `payoutRejected` | "Saque rejeitado" |

### Reuso entre Partes 3 e 4
Componente compartilhado: `apps/web/src/components/features/payouts/payout-status-badge.tsx`:

```tsx
export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  // mapping de cores: REQUESTED→amber, APPROVED→blue, PAID→green, REJECTED→red
}
```

Reusado em:
- `/seller/payouts` (tabela de pedidos de saque)
- `/admin/payouts` (lista + modal de detalhes)

## Decisoes-chave registradas

1. **Marketplace continua "bloqueado" como link de navegacao** — nao mexer em `comingSoonForUsers && !isAdmin`. O E2E navega direto pelas URLs (que ja funcionam para usuario comum).
2. **Ambiente do E2E:** local (MySQL Docker, sem riscos em prod).
3. **Dados de teste:** os 3 usuarios reais (admin, `vai_q_eh@yahoo.com.br`, `braidatto@gmail.com`).
4. **Screenshots:** versionados em `docs/superpowers/specs/screenshots/2026-05-03-marketplace-flow/`.
5. **Commits atomicos:** uma tarefa = um commit, alinhado com `feedback_git_workflow.md`.

## Riscos e mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Pre-test cleanup pode deletar dados reais se rodar contra prod | Hardcode de assercao `BASE_URL.includes('localhost')` no `beforeAll` |
| Test demorando demais (22 fases) | Aumentar `timeout: 300_000` no spec; `test.step()` para granularidade no reporter |
| Browser fecha sessao durante login multiplos | Usar `browser.newContext({ storageState })` por usuario, padrao do `packages/e2e/fixtures/auth.fixture` |
| Spinner do PIX QR demora pra renderizar | Helper `takeScreenshot` ja aguarda `.animate-spin` sumir |
| Mudanca de UI quebra seletor antigo | Page objects ja existem (`MarketplacePage`, `CartPage`, `CheckoutPage`, `OrdersPage`) — extender, nao recriar |
| Saldo nao credita por bug de estado | Nas fases 17/18, validar via `GET /payouts/balance` antes do screenshot, falha rapido se inconsistente |

## Out-of-scope

- Construir UI de extrato detalhado por OrderItem (so a tabela de movimentacoes simples).
- Mudar a politica de comissao (fixa em 10% para FREE pelo backend).
- Adicionar pagamentos via Mercado Pago — fica PIX estatico + admin manual.
- Notificacoes por email para mudancas de status de saque (ja existem no backend, sem mudanca de UI).
- Testar fluxo de disputa — ja tem specs separados em `packages/e2e/tests/disputes/`.
