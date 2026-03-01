# Phase 08 — Disputas: Guia de Verificação

## Pré-requisitos
1. API rodando: `pnpm --filter api dev` (porta 3001)
2. Web rodando: `pnpm --filter web dev` (porta 3000)
3. Seed data: `pnpm --filter api db:seed`
4. Ter pelo menos um pedido com status SHIPPED ou DELIVERED no banco

## 1. Abertura de Disputa (Comprador)

### 1.1 Criar disputa com sucesso
- Faça login como comprador que tenha um pedido DELIVERED
- Acesse `/disputes/new?orderItemId=<ID_DO_ITEM>`
- Selecione o motivo (ex: "Não recebido")
- Escreva a descrição (mínimo 10 caracteres)
- Opcionalmente adicione fotos de evidência (máx 5)
- Clique em "Abrir Disputa"
- **Esperado**: Disputa criada com status ABERTA, redireciona para detalhe

### 1.2 Validação de janela de tempo
- Tente abrir disputa em pedido entregue há mais de 7 dias
- **Esperado**: Erro "Prazo para abertura de disputa expirado"

- Tente abrir disputa em pedido enviado (não entregue) há menos de 30 dias
- **Esperado**: Disputa criada com sucesso

### 1.3 Disputa duplicada
- Tente abrir segunda disputa no mesmo item que já tem disputa ABERTA
- **Esperado**: Erro "Já existe uma disputa aberta para este item"

### 1.4 Lista de disputas do comprador
- Acesse `/disputes`
- **Esperado**: Lista todas as disputas do comprador com filtros por status
- Filtre por "Abertas", "Em mediação", etc.
- **Esperado**: Lista filtrada corretamente

## 2. Resposta do Vendedor

### 2.1 Vendedor responde dentro de 48h
- Faça login como vendedor que recebeu disputa
- Acesse `/seller/disputes`
- **Esperado**: Disputa aparece com badge "Aguardando resposta"
- Clique na disputa, veja os detalhes
- Preencha a resposta (mínimo 10 caracteres)
- Clique em "Enviar Resposta"
- **Esperado**: Status muda para "Em mediação", mensagem aparece no thread

### 2.2 Vendedor adiciona evidência
- Na página de detalhe da disputa, clique em "Adicionar Evidência"
- Faça upload de uma imagem
- **Esperado**: Evidência aparece na galeria do vendedor

### 2.3 Alerta de urgência (>48h)
- Se disputa ABERTA tem mais de 48h:
- **Esperado**: Badge vermelho "Urgente" na lista, borda vermelha

### 2.4 Auto-escalação (cron)
- Disputas ABERTAS com mais de 48h sem resposta do vendedor são automaticamente escaladas para IN_MEDIATION pelo cron (6h da manhã)
- Admins recebem notificação da escalação

## 3. Mediação do Admin

### 3.1 Fila de disputas
- Faça login como admin
- Acesse `/admin/disputes`
- **Esperado**: Cards de estatísticas no topo (Abertas, Em mediação, Resolvidas, Tempo médio)
- **Esperado**: Lista de todas as disputas com filtros
- Disputas >48h sem resposta destacadas em vermelho

### 3.2 Detalhe da disputa (admin)
- Clique em uma disputa na fila
- **Esperado**:
  - Evidências do comprador (esquerda) vs vendedor (direita) lado a lado
  - Informações do pedido (item, preço, comissão)
  - Dados do comprador e vendedor
  - Thread de mensagens
  - Timeline de eventos
  - Formulário de resolução (se ABERTA ou EM MEDIAÇÃO)

### 3.3 Resolver com reembolso total
- No formulário de resolução, selecione "Reembolso total"
- Escreva justificativa (mínimo 10 caracteres)
- Clique em "Resolver disputa"
- Confirme no diálogo
- **Esperado**:
  - Status muda para "Reembolso total"
  - Item do pedido muda para REFUNDED
  - Reembolso processado no sistema de pagamentos
  - Notificações enviadas para comprador e vendedor

### 3.4 Resolver com reembolso parcial
- Selecione "Reembolso parcial"
- Informe o valor (deve ser menor que o preço do item)
- Escreva justificativa
- **Esperado**: Status muda, valor parcial reembolsado

### 3.5 Resolver sem reembolso
- Selecione "Sem reembolso"
- Escreva justificativa
- **Esperado**: Status muda, item volta ao status anterior (DELIVERED/SHIPPED)

### 3.6 Admin envia mensagem
- No detalhe da disputa, use o campo de mensagem
- **Esperado**: Mensagem aparece no thread com destaque de admin

## 4. Cancelamento pelo Comprador

### 4.1 Cancelar disputa aberta
- Como comprador, acesse disputa com status ABERTA
- Clique em "Cancelar Disputa"
- Confirme no diálogo
- **Esperado**: Status muda para "Cancelada", item do pedido volta ao status anterior

### 4.2 Não pode cancelar disputa em mediação
- Tente cancelar disputa com status EM MEDIAÇÃO
- **Esperado**: Botão de cancelar não aparece

## 5. Notificações

### 5.1 Notificação ao vendedor
- Quando comprador abre disputa
- **Esperado**: Vendedor recebe notificação in-app "Disputa aberta"
- **Esperado**: E-mail enviado ao vendedor (se preferência ativa)

### 5.2 Notificação ao comprador
- Quando vendedor responde
- **Esperado**: Comprador recebe notificação "Vendedor respondeu"

### 5.3 Notificação de resolução
- Quando admin resolve disputa
- **Esperado**: Ambas as partes recebem notificação com resultado
- **Esperado**: E-mail de resolução enviado

## 6. Integração com Comissões

### 6.1 Payout retido durante disputa
- Com item em status DISPUTED
- **Esperado**: Dashboard de comissões do admin NÃO inclui o valor desse item
- **Esperado**: Transação marcada como "payoutHeld: true"

### 6.2 Payout liberado após resolução sem reembolso
- Após resolver SEM reembolso, item volta a status normal
- **Esperado**: Comissão volta a aparecer nos cálculos

## 7. API Endpoints (para testes via curl)

```bash
# Criar disputa
curl -X POST http://localhost:3001/api/v1/disputes \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"orderItemId":"<ID>","reason":"NOT_RECEIVED","description":"Não recebi o produto após 15 dias"}'

# Listar disputas (comprador)
curl http://localhost:3001/api/v1/disputes/my/buyer \
  -H "Authorization: Bearer <TOKEN>"

# Listar disputas (vendedor)
curl http://localhost:3001/api/v1/disputes/my/seller \
  -H "Authorization: Bearer <TOKEN>"

# Ver disputa
curl http://localhost:3001/api/v1/disputes/<ID> \
  -H "Authorization: Bearer <TOKEN>"

# Vendedor responde
curl -X POST http://localhost:3001/api/v1/disputes/<ID>/respond \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message":"O produto foi enviado corretamente, segue comprovante de envio"}'

# Enviar mensagem
curl -X POST http://localhost:3001/api/v1/disputes/<ID>/messages \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Aguardo resposta do vendedor"}'

# Admin: listar todas
curl http://localhost:3001/api/v1/disputes/admin/list \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Admin: estatísticas
curl http://localhost:3001/api/v1/disputes/admin/stats \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Admin: resolver disputa
curl -X POST http://localhost:3001/api/v1/disputes/<ID>/resolve \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"RESOLVED_REFUND","resolution":"Comprador comprovou que não recebeu o produto. Reembolso total aprovado."}'

# Cancelar disputa (comprador)
curl -X POST http://localhost:3001/api/v1/disputes/<ID>/cancel \
  -H "Authorization: Bearer <TOKEN>"
```

## Resumo dos Arquivos Criados

### Contracts
- `packages/contracts/src/disputes.ts` — Schemas Zod + tipos TypeScript

### API (Backend)
- `apps/api/src/modules/disputes/disputes.service.ts` — Lógica de negócio completa
- `apps/api/src/modules/disputes/disputes.routes.ts` — 11 endpoints
- `apps/api/src/shared/email-templates/dispute-opened.ts` — Template e-mail abertura
- `apps/api/src/shared/email-templates/dispute-resolved.ts` — Template e-mail resolução

### Web (Frontend)
- `apps/web/src/lib/api/disputes.ts` — Cliente API
- `apps/web/src/components/features/disputes/` — 14 componentes
  - dispute-status-badge, dispute-reason-badge, dispute-timeline
  - dispute-message-thread, evidence-gallery
  - create-dispute-form, dispute-response-form, dispute-detail-page
  - buyer-disputes-page, seller-disputes-page
  - admin-dispute-queue, admin-dispute-detail, admin-resolution-form, admin-dispute-stats
- 7 rotas de página (3 comprador, 2 vendedor, 2 admin)

### Modificados
- `packages/contracts/src/index.ts` — Export disputes
- `apps/api/src/create-app.ts` — Registro de rotas
- `apps/api/src/modules/notifications/email.service.ts` — Templates de disputa
- `apps/api/src/shared/cron/index.ts` — Auto-escalação 48h
- `apps/api/src/modules/commission/commission.service.ts` — Payout hold
- `apps/web/src/components/layout/nav-config.ts` — Link admin
- `apps/web/src/messages/pt-BR.json` — Tradução nav
