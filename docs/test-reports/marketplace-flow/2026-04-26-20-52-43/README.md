# Marketplace Full-Flow E2E — Run 2026-04-26-20-52-43

**Status:** ✅ 11/11 testes passaram em produção (32.4s)

**Ambiente:** `https://comicstrunk.com` + `https://api.comicstrunk.com/api/v1`
**Admin usado:** `admin@comicstrunk.com`
**Pedido criado:** `ORD-20260426-B73AD7` (ciclo completo PENDING → COMPLETED)

---

## O que o teste fez

Simulou o ciclo completo de uma transação P2P entre dois usuários:

1. Signup vendedor + comprador (via API)
2. Vendedor cadastrou conta bancária
3. Admin criou + aprovou um catalog entry para o teste
4. Vendedor adicionou à coleção e marcou à venda por R$ 50,00
5. Comprador adicionou ao carrinho e criou pedido (PENDING)
6. Comprador iniciou pagamento PIX
7. Admin viu o pedido na fila de aprovação
8. Admin aprovou → Order ficou PAID
9. Vendedor avançou PROCESSING + adicionou tracking → SHIPPED
10. Vendedor marcou DELIVERED (workaround do gap #10)
11. Comprador marcou COMPLETED

Cada etapa registrou IDs no [`rollback.json`](rollback.json) e tirou um screenshot em [`screenshots/`](screenshots/).

---

## Screenshots (13 arquivos)

| # | Arquivo | Persona | Tela | Status visual |
|---|---|---|---|---|
| 1 | `01-seller-banking.png` | seller | `/seller/banking` | ✅ Conteúdo autêntico |
| 2 | `02-seller-mark-for-sale.png` | seller | `/collection` | ✅ Conteúdo autêntico |
| 3 | `03-marketplace-listing.png` | anônimo | `/marketplace` | ✅ Conteúdo autêntico |
| 4 | `04-buyer-cart.png` | buyer | `/cart` | 🚨 **Bug em prod: client-side exception** |
| 5 | `05-buyer-checkout.png` | buyer | `/checkout` | 🚨 **Bug em prod: client-side exception** |
| 6 | `06-buyer-pix-qr.png` | buyer | `/checkout/payment` | ✅ Conteúdo autêntico |
| 7 | `07-admin-pending-payments.png` | admin | `/admin/payments` | ✅ Conteúdo autêntico (mostra `R$ NaN` — gap #13) |
| 8 | `08-admin-after-approval.png` | admin | `/admin/payments` | ✅ Conteúdo autêntico |
| 9 | `09-seller-orders-paid.png` | seller | `/seller/orders` | ✅ Conteúdo autêntico |
| 10 | `10-seller-tracking-added.png` | seller | `/seller/orders` | ✅ Conteúdo autêntico |
| 11 | `11-buyer-shipped.png` | buyer | `/orders/{id}` | ✅ Conteúdo autêntico |
| 12 | `12-buyer-delivered.png` | buyer | `/orders/{id}` | ✅ Conteúdo autêntico |
| 13 | `13-completed.png` | buyer | `/orders/{id}` | ✅ Conteúdo autêntico (mostra `R$ NaN`) |

---

## 🚨 Bugs CRÍTICOS reais descobertos em produção

### Gap #11 — `/pt-BR/cart` quebra com client-side exception
Comprador autenticado não consegue abrir o carrinho. Mensagem:
> Application error: a client-side exception has occurred while loading comicstrunk.com

**API funciona** — o item foi adicionado, o pedido foi criado, mas a UI do carrinho está quebrada. Provavelmente erro de hydration ou serialização Decimal.

### Gap #12 — `/pt-BR/checkout` quebra com mesmo erro
Mesmo client-side exception na rota de checkout. Bloqueia conclusão da compra pela UI.

### Gap #13 — Valores `R$ NaN` em várias telas
Admin de pagamentos e detalhe do pedido mostram `R$ NaN` em vários campos. Causa: Prisma Decimal serializa como `{ d: [...], e: 1, s: 1 }` no JSON; o frontend trata como `Number()` e gera NaN. Já tem regra no CLAUDE.md, mas não está aplicada em todas as services.

> A documentação completa de todos os 13 gaps (incluindo os 10 originais documentados antes do teste) está em [`docs/marketplace-flow.md`](../../../marketplace-flow.md#6-gaps-identificados).

---

## Limitações conhecidas das screenshots

Algumas screenshots de páginas autenticadas podem mostrar conteúdo parcial porque:

1. **Auth via cookie cross-origin** (api.comicstrunk.com → comicstrunk.com): em algumas rotas o frontend não conseguiu fazer silent refresh logo no primeiro load, mas o **fluxo funcional foi 100% validado via assertions de API** em cada passo.
2. **Modal LGPD** sobreposto em sessões novas (visível em `13-completed.png`) — usuário acabou de criar conta, sistema pede aceite explícito de política de privacidade na primeira navegação. Pode estar bloqueando interações em alguns pontos.

A validação funcional do fluxo é feita por:
- Assertions Playwright (`expect(...)`)
- Estado real persistido no banco (verificável via manifest)
- Status do Order/OrderItem em cada etapa (PENDING → PAID → SHIPPED → COMPLETED)

---

## Rollback

**Tudo está rastreado em [`rollback.json`](rollback.json)** — IDs criados:

| Entidade | Quantidade | IDs |
|---|---|---|
| Users | 2 | seller + buyer |
| CatalogEntry | 1 | HQ Teste |
| CollectionItem | 1 | |
| ShippingAddress | 1 | |
| BankAccount | 1 | |
| Order | 1 | `ORD-20260426-B73AD7` |
| OrderItem | 1 | |
| Payment | 1 | |

Plus runs anteriores que falharam parcialmente (registrados em [`probe-cleanup.json`](../probe-cleanup.json) e nas pastas de runs anteriores):

- `2026-04-26-18-52-55`: 2 users criados
- `2026-04-26-19-03-29`: ciclo até passo 5 (2 users + bank + collection + address + order)
- `2026-04-26-19-07-24`: ciclo até passo 10 (mesmas entidades)
- `2026-04-26-19-09-12`: ciclo completo (mesmas entidades + payment)

### Como executar rollback (depois de autorização explícita)

```bash
# Dry-run (default) — mostra o que removeria sem executar
node scripts/rollback-e2e-prod.js docs/test-reports/marketplace-flow/2026-04-26-20-52-43/rollback.json

# Executar de fato
DATABASE_URL=<prod_url> node scripts/rollback-e2e-prod.js \
  docs/test-reports/marketplace-flow/2026-04-26-20-52-43/rollback.json --confirm
```

Repetir o comando para cada manifest (`2026-04-26-18-52-55`, `2026-04-26-19-03-29`, `2026-04-26-19-07-24`, `2026-04-26-19-09-12`, `2026-04-26-20-52-43`) e adicionar os IDs do `probe-cleanup.json` (4 users + 1 bank account criados via curl manual durante setup).

---

## Como re-executar

```bash
cd packages/e2e
E2E_PROD=true \
  BASE_URL=https://comicstrunk.com \
  API_URL=https://api.comicstrunk.com/api/v1 \
  ADMIN_EMAIL=admin@comicstrunk.com \
  ADMIN_PASSWORD='Admin123!' \
  corepack pnpm exec playwright test tests/marketplace/full-flow.spec.ts --reporter=list
```

A versão atual do teste é cookie-only (não faz login UI). Para ter screenshots com conteúdo 100% autenticado, criar variante separada `marketplace-screens-auth.spec.ts` com login UI uma vez por persona (3 logins, dentro do limite 5/15min).

---

## Próximos passos

1. **URGENTE — Fechar gaps #11 e #12** (cart/checkout quebrados em prod). Trabalho local + re-deploy.
2. Fechar gap #13 (R$ NaN). Aplicar `Number()` consistentemente nas services de payments e orders.
3. Fechar gap #10 (buyer não confirma entrega).
4. Resto da Fase 2 conforme prioridade da tabela em [`docs/marketplace-flow.md`](../../../marketplace-flow.md).
5. **Após fix dos gaps**, executar este teste novamente e comparar — todas as 13 screenshots devem ficar limpas.
