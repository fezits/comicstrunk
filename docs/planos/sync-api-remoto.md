# Plano: Sync API Remoto — ComicsTrunk

## Objetivo
Criar endpoints protegidos na API do ComicsTrunk para receber dados de gibis e capas remotamente, permitindo que o OpenClaw (local) faça o scraping e envie para o servidor de produção via HTTP.

## Fluxo

```
┌─────────────────────────┐
│  OpenClaw (local)       │
│  sync-catalog-remote.ts │
│  1. Fetch Rika VTEX     │
│  2. Fetch Panini GQL    │
│  3. Login no servidor   │
│  4. POST gibis em lote  │
│  5. POST capas          │
└───────────┬─────────────┘
            │ HTTPS
            ▼
┌─────────────────────────┐
│  Servidor Produção      │
│  ComicsTrunk API        │
│  POST /sync/catalog     │
│  POST /sync/covers      │
│  GET  /sync/status      │
└─────────────────────────┘
```

## Decisões

| Item | Decisão |
|------|---------|
| Auth | JWT via login existente (`POST /auth/login`) |
| Usuário | Criar `sync@comicstrunk.com` com role ADMIN |
| Dedup | Pelo campo `sourceKey` (rika:123, panini:ABC) |
| Lotes | Enviar em batches de 50 gibis por request |
| Capas | Upload multipart individual (1 por request) |
| Rate limit | 500ms entre requests de capa |
| Idempotência | Upsert por sourceKey — pode rodar várias vezes sem duplicar |

## Endpoints

### 1. `POST /api/v1/sync/catalog` (ADMIN only)

Recebe array de gibis para upsert.

**Request:**
```json
{
  "items": [
    {
      "sourceKey": "rika:165074",
      "title": "John Constantine - Hellblazer",
      "publisher": "Vertigo",
      "coverPrice": 49.90,
      "categories": ["Super-herois", "Vertigo"]
    },
    {
      "sourceKey": "panini:AHANA009",
      "title": "Hanako-Kun Vol. 9",
      "publisher": "Panini",
      "coverPrice": 34.90,
      "categories": ["Planet Mangá"]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "received": 50,
    "created": 3,
    "updated": 12,
    "unchanged": 35,
    "errors": 0
  }
}
```

**Lógica:**
- Para cada item, busca por `sourceKey`
- Se não existe → cria (approvalStatus: APPROVED)
- Se existe e preço mudou → atualiza
- Se existe e nada mudou → skip
- Categories criadas automaticamente se não existirem

### 2. `POST /api/v1/sync/covers` (ADMIN only)

Upload de capa vinculada a um sourceKey.

**Request:** multipart/form-data
- `sourceKey`: string (ex: "panini:AHANA009")
- `cover`: file (JPG)

**Response:**
```json
{
  "success": true,
  "data": {
    "sourceKey": "panini:AHANA009",
    "coverFileName": "panini-AHANA009.jpg",
    "status": "created"  // ou "already_exists"
  }
}
```

**Lógica:**
- Busca entry por sourceKey
- Se entry não existe → 404
- Salva imagem em `uploads/covers/{source}-{id}.jpg`
- Atualiza `coverFileName` no banco
- Se arquivo já existe → skip (retorna "already_exists")

### 3. `GET /api/v1/sync/status` (ADMIN only)

Retorna estado atual do catálogo e último sync.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEntries": 24608,
    "withCover": 22331,
    "withoutCover": 2277,
    "bySource": {
      "rika": { "total": 17909, "withCover": 17908 },
      "panini": { "total": 6687, "withCover": 4423 }
    },
    "lastSync": "2026-04-01T01:11:02.998Z"
  }
}
```

## Subtarefas

### Backend (API)

| # | Tarefa | Estimativa |
|---|--------|------------|
| 1 | Criar módulo `sync/` (routes, service, contracts) | 30 min |
| 2 | Endpoint `POST /sync/catalog` com upsert por sourceKey | 45 min |
| 3 | Endpoint `POST /sync/covers` com upload multipart | 30 min |
| 4 | Endpoint `GET /sync/status` com contagens | 15 min |
| 5 | Validação Zod para input do sync | 15 min |
| 6 | Criar usuário de serviço no seed (`sync@comicstrunk.com`) | 10 min |
| 7 | Testes unitários | 30 min |

**Total backend: ~3h**

### Script Local (OpenClaw)

| # | Tarefa | Estimativa |
|---|--------|------------|
| 8 | Criar `sync-catalog-remote.ts` (fetch + envio via API) | 45 min |
| 9 | Login automático + refresh token | 15 min |
| 10 | Upload de capas em batch | 30 min |
| 11 | Relatório final (JSON + console) | 10 min |
| 12 | Atualizar cron do OpenClaw | 5 min |

**Total script: ~2h**

### Testes E2E

| # | Tarefa | Estimativa |
|---|--------|------------|
| 13 | Teste sync catalog (create + update) | 20 min |
| 14 | Teste sync covers (upload + dedup) | 20 min |
| 15 | Teste auth (non-admin rejeitado) | 10 min |

**Total testes: ~1h**

## Estimativa Total: ~6h

## Configuração em Produção

```env
# No OpenClaw (local) — variáveis para o script remoto
COMICSTRUNK_API_URL=https://comicstrunk.com.br/api/v1
COMICSTRUNK_SYNC_USER=sync@comicstrunk.com
COMICSTRUNK_SYNC_PASS=<senha-segura>
```

## Segurança

- Endpoints restritos a role ADMIN via middleware `authorize('ADMIN')`
- Rate limiting: max 100 req/min nos endpoints de sync
- Upload de capa limitado a 5MB
- sourceKey validado via regex (`^(rika|panini):[a-zA-Z0-9]+$`)
- HTTPS obrigatório em produção

## Migração

Nenhuma migration necessária — o campo `sourceKey` já existe (migration `20260331235900_add_source_key`).

O endpoint de sync precisa acessar `sourceKey` diretamente, então usará um PrismaClient sem o `$extends` que oculta o campo.
