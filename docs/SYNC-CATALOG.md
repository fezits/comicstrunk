# Sync de Catálogo — Rika + Panini → ComicsTrunk

## Visão Geral

Script que sincroniza o catálogo de gibis a partir de duas fontes externas:

- **Rika** (rika.com.br) — via VTEX Catalog API
- **Panini** (panini.com.br) — via Magento GraphQL API

O sync é **incremental**: busca por data de lançamento (mais recentes primeiro) e para automaticamente quando encontra itens que já existem no banco. Isso significa que execuções diárias levam segundos (só novidades), não minutos.

## Arquitetura

```
┌──────────────┐     ┌──────────────┐
│  Rika VTEX   │     │ Panini GQL   │
│  REST API    │     │  GraphQL     │
└──────┬───────┘     └──────┬───────┘
       │                    │
       ▼                    ▼
┌──────────────────────────────────┐
│     sync-catalog.ts              │
│  - Fetch incremental             │
│  - Compare by sourceKey          │
│  - Insert new / Update prices    │
│  - Download covers               │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│     MySQL (comicstrunk)          │
│  catalog_entries.source_key      │
│  uploads/covers/                 │
└──────────────────────────────────┘
```

## Campos Importantes

### `source_key` (coluna no banco)

Campo **interno** usado exclusivamente para deduplicação no sync. **Não aparece nas APIs** (oculto via Prisma `$extends`).

| Fonte  | Formato           | Exemplo              |
|--------|-------------------|----------------------|
| Rika   | `rika:{productId}`  | `rika:165074`        |
| Panini | `panini:{sku}`      | `panini:AHANA009`    |

### `barcode` e `isbn`

Campos **livres** para o usuário preencher com ISBN/EAN real do gibi. O sync **não usa** esses campos.

## Instalação

### Pré-requisitos

- Node.js 18+
- MySQL rodando com o banco `comicstrunk`
- Prisma migrations aplicadas (incluindo `20260331235900_add_source_key`)
- Pasta `uploads/covers/` com permissão de escrita

### Dependências

Não tem dependências extras — usa `@prisma/client` e `fetch` nativo do Node.

### Configuração

O script usa as variáveis de ambiente do `.env` do projeto (via Prisma):

```env
DATABASE_URL="mysql://root:admin@localhost:3306/comicstrunk"
```

## Uso

```bash
cd apps/api

# Sync completo (incremental — só novidades)
npx tsx scripts/sync-catalog.ts

# Dry run (simula, não altera nada)
npx tsx scripts/sync-catalog.ts --dry-run

# Só Rika
npx tsx scripts/sync-catalog.ts --rika-only

# Só Panini
npx tsx scripts/sync-catalog.ts --panini-only

# Full scan (ignora early-stop, re-verifica TUDO)
npx tsx scripts/sync-catalog.ts --full
```

## Flags

| Flag             | Descrição                                              |
|------------------|--------------------------------------------------------|
| `--dry-run`      | Simula sem escrever no banco nem baixar imagens         |
| `--rika-only`    | Sincroniza apenas Rika                                 |
| `--panini-only`  | Sincroniza apenas Panini                               |
| `--full`         | Desativa early-stop (varredura completa)               |

## Lógica Incremental

1. Busca produtos ordenados por **data de lançamento** (mais recentes primeiro)
2. Para cada produto, verifica se `sourceKey` já existe no banco
3. Se existe → compara preço. Se mudou, atualiza
4. Se não existe → insere + baixa capa
5. Após **100 itens consecutivos que já existem**, para de buscar naquela categoria (**early-stop**)

Isso garante que execuções diárias sejam rápidas (~1 min vs 30+ min do full scan).

## Fontes de Dados

### Rika (VTEX)

- **Base URL**: `https://www.rika.com.br/api/catalog_system/pub/products/search/`
- **Subcategorias**: Super-herois/Marvel, DC, Vertigo, Image, ETC
- **Paginação**: 50 itens por página, máx 2500 por subcategoria
- **Ordenação**: `OrderByReleaseDateDESC`
- **Rate limit**: 500ms entre páginas, 1s entre subcategorias

### Panini (Magento GraphQL)

- **URL**: `https://panini.com.br/graphql`
- **Header obrigatório**: `Store: default`
- **Categorias**: Marvel (23), DC (20), Panini Comics (5), Planet Mangá (41)
- **Paginação**: 20 itens por página
- **Rate limit**: 500ms entre páginas, 1s entre categorias
- **Retry**: 3 tentativas com 3s de delay em caso de timeout (60s)

## Capas

- Formato: `rika-{productId}.jpg` / `panini-{sku}.jpg`
- Diretório: `apps/api/uploads/covers/`
- Imagens placeholder da Panini (`panini-placeholder.png`) são ignoradas
- Imagens já existentes no disco não são re-baixadas

## Output

### Console

```
=== ComicsTrunk Catalog Sync ===
Mode: LIVE | INCREMENTAL
Time: 2026-04-01T01:11:02.998Z

=== Syncing Rika (incremental) ===
  Fetching Super-herois/Marvel...
    Early stop after 100 consecutive existing items
    → 0 new
  ...

📦 Rika:
  Fetched:   705
  New:       1
  Updated:   0
  Covers:    1

📦 Panini:
  Fetched:   6685
  New:       3075
  Updated:   3252
  Covers:    811

✅ Total: 3076 novos, 3252 atualizados
```

### JSON (`scripts/last-sync.json`)

```json
{
  "timestamp": "2026-04-01T01:11:02.998Z",
  "dryRun": false,
  "fullScan": false,
  "rika": { "fetched": 705, "new": 1, "updated": 0, "errors": 0, "covers": 1 },
  "panini": { "fetched": 6685, "new": 3075, "updated": 3252, "errors": 0, "covers": 811 }
}
```

## Cron (Produção)

### Usando crontab (Linux/cPanel)

```bash
# Rodar diariamente às 6h (horário de Brasília)
0 6 * * * cd /home/user/comicstrunk/apps/api && /usr/local/bin/npx tsx scripts/sync-catalog.ts >> /home/user/logs/catalog-sync.log 2>&1
```

### Usando PM2

```bash
# Instalar PM2
npm install -g pm2

# Criar ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'catalog-sync',
    script: 'npx',
    args: 'tsx scripts/sync-catalog.ts',
    cwd: '/home/user/comicstrunk/apps/api',
    cron_restart: '0 6 * * *',
    autorestart: false,
    watch: false,
  }]
};
EOF

pm2 start ecosystem.config.js
pm2 save
```

### Usando Node.js cron (dentro da API)

Se preferir rodar o sync como parte do servidor, o agendamento já existe em `src/shared/cron/`:

```typescript
// Adicionar ao scheduleJobs():
import { execSync } from 'child_process';

cron.schedule('0 6 * * *', () => {
  console.log('[CRON] Starting catalog sync...');
  execSync('npx tsx scripts/sync-catalog.ts', { 
    cwd: __dirname + '/../../..', 
    stdio: 'inherit' 
  });
}, { timezone: 'America/Sao_Paulo' });
```

## Migration

A migration `20260331235900_add_source_key` faz:

1. Adiciona coluna `source_key` (VARCHAR 191, UNIQUE, nullable)
2. Migra dados: `barcode: 'rika-123'` → `sourceKey: 'rika:123'`
3. Limpa `barcode` dos itens importados (deixa livre pra ISBN/EAN)

**Aplicar em produção:**

```bash
npx prisma migrate deploy
```

## Prisma $extends (Ocultar sourceKey)

Em `src/shared/lib/prisma.ts`, o campo `sourceKey` é ocultado de todas as queries:

```typescript
basePrisma.$extends({
  result: {
    catalogEntry: {
      sourceKey: {
        needs: {},
        compute() { return undefined; },
      },
    },
  },
});
```

O script de sync usa seu **próprio** `PrismaClient` (sem o $extends) e consegue ler/escrever `sourceKey` normalmente.

## Números Atuais (2026-03-31)

| Métrica              | Valor    |
|----------------------|----------|
| Total de gibis       | 24.608   |
| Com capa vinculada   | 22.331 (91%) |
| Sem capa             | 2.277    |
| Rika com capa        | 17.908/17.909 (100%) |
| Panini com capa      | 4.423/6.687 (66%) |
| Imagens no disco     | 20.272   |
| Fontes Rika          | 6 subcategorias |
| Fontes Panini        | 4 categorias |

## Troubleshooting

**Sync demora muito**: Use `--rika-only` ou `--panini-only` pra isolar. O primeiro sync após adicionar muitos itens será lento (baixando capas). Os seguintes serão rápidos.

**Muitos erros de cover**: A Panini tem ~2.200 itens com imagem placeholder — esses não baixam capa. É esperado.

**Timeout na Panini GraphQL**: O script já tem retry (3x com 3s delay). Se persistir, aumente o timeout em `AbortSignal.timeout(60000)`.

**sourceKey aparece na API**: Verifique se o `$extends` está ativo em `src/shared/lib/prisma.ts`. O script de sync usa PrismaClient direto (sem extends), por isso consegue ler o campo.

**Full scan necessário**: Se suspeitar que dados ficaram dessincronizados, rode com `--full` uma vez. Demora ~30 min mas re-verifica tudo.
