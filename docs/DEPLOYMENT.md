# Deployment - Comics Trunk

## Visao Geral

**1 repositorio (monorepo) → 2 aplicacoes Node.js no cPanel**

```
┌─────────────────────────────────────────────────────────┐
│  Monorepo (GitHub)                                      │
│                                                         │
│  apps/api          apps/web       packages/contracts    │
│  (Express)         (Next.js 15)   (Zod schemas)        │
└────────┬──────────────┬──────────────────────────────────┘
         │              │
    deploy-api.sh  deploy-web.sh
         │              │
         ▼              ▼
┌────────────────┐ ┌────────────────┐ ┌──────────────────┐
│ cPanel App #1  │ │ cPanel App #2  │ │ MySQL            │
│ api.comics-    │ │ comicstrunk    │ │ localhost:3306   │
│ trunk.com      │ │ .com           │ │ db: comicstrunk  │
│                │ │                │ │                  │
│ Passenger      │ │ Passenger      │ │ Backup diario    │
│ dist/app.js    │ │ server.js      │ │ 3:00 AM          │
└────────────────┘ └────────────────┘ └──────────────────┘
        ▲                  ▲
        └──── Apache (SSL termination, HTTPS redirect) ───┘
```

## Pre-requisitos no Servidor

- Node.js 18+ (configurado no cPanel > Setup Node.js App)
- MySQL 8 com banco `comicstrunk` criado
- Duas aplicacoes Node.js criadas no cPanel:
  - **API**: dominio `api.comicstrunk.com`, startup file `dist/app.js`
  - **Web**: dominio `comicstrunk.com`, startup file `server.js`, env `HOSTNAME=0.0.0.0`

## Deploy da API

```bash
./scripts/deploy-api.sh [DEPLOY_PATH]
# Default: /home/username/api.comicstrunk.com
```

**O que o script faz:**
1. Build `packages/contracts` (dependencia)
2. Build API via `pnpm --filter api build` (TypeScript → `dist/`)
3. Gera Prisma client (`npx prisma generate`)
4. Copia para o cPanel: `dist/`, `prisma/schema.prisma`, `prisma/migrations/`, `package.json`, `.htaccess`
5. Reinicia Passenger (`touch tmp/restart.txt`)

**Pos-deploy (manual):**
```bash
cd /home/username/api.comicstrunk.com
npx prisma migrate deploy    # Aplica migrations pendentes
curl https://api.comicstrunk.com/health   # Verifica saude
```

**Variaveis de ambiente no cPanel (API):**
```
DATABASE_URL=mysql://user:password@localhost:3306/comicstrunk
JWT_ACCESS_SECRET=<64-byte hex>
JWT_REFRESH_SECRET=<64-byte hex, diferente do access>
WEB_URL=https://comicstrunk.com
PORT=<porta atribuida pelo cPanel>
NODE_ENV=production
```

## Deploy do Frontend (Web)

```bash
./scripts/deploy-web.sh [DEPLOY_PATH]
# Default: /home/username/comicstrunk.com
```

**O que o script faz:**
1. Build `packages/contracts` (dependencia)
2. Build Next.js em modo standalone: `CI=true pnpm --filter web build`
3. Verifica se `server.js` foi gerado em `.next/standalone/apps/web/`
4. Copia output standalone + `public/` + `.next/static/` para cPanel
5. Reinicia Passenger (`touch tmp/restart.txt`)

**IMPORTANTE:** NAO rodar `pnpm install` no diretorio standalone. O build standalone ja inclui todas as dependencias tracadas.

**Variaveis de ambiente no cPanel (Web):**
```
NEXT_PUBLIC_API_URL=https://api.comicstrunk.com
HOSTNAME=0.0.0.0
PORT=<porta atribuida pelo cPanel>
NODE_ENV=production
```

**Nota sobre Windows:** O modo standalone usa symlinks que exigem privilegios elevados no Windows. Por isso, o standalone so e ativado quando `CI=true` ou `STANDALONE=true`. No dev local (Windows) o Next.js roda normalmente sem standalone.

## Backup do Banco de Dados

```bash
./scripts/backup-db.sh
```

**Cron job no cPanel:**
```
0 3 * * * /home/username/comicstrunk/scripts/backup-db.sh
```

**Comportamento:**
- `mysqldump` comprimido com gzip → `~/backups/db/comicstrunk_YYYYMMDD_HHMMSS.sql.gz`
- Retencao: 7 dias (configuravel via `BACKUP_RETENTION_DAYS`)
- Verifica se o backup nao esta vazio
- Carrega credenciais de `~/.comicstrunk-backup-env` (para contexto do cron)

**Arquivo `~/.comicstrunk-backup-env`:**
```bash
DB_HOST=localhost
DB_PORT=3306
DB_NAME=comicstrunk
DB_USER=<user>
DB_PASSWORD=<password>
BACKUP_DIR=/home/username/backups/db
BACKUP_RETENTION_DAYS=7
```

## Apache (.htaccess)

A API usa `.htaccess` para:
- Forcar HTTPS redirect (301)
- Configurar Passenger para Node.js

```apache
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [R=301,L]
PassengerEnabled on
PassengerAppType node
PassengerStartupFile dist/app.js
```

## Ordem de Build (Turborepo)

```
packages/contracts  →  apps/api   →  (independentes)
                    →  apps/web   →
```

O Turborepo respeita a ordem de dependencia: `contracts` compila primeiro, depois API e Web podem buildar em paralelo.

```bash
# Build completo (todas as apps)
pnpm build

# Build individual
pnpm --filter contracts build   # Obrigatorio antes de API ou Web
pnpm --filter api build
CI=true pnpm --filter web build # Standalone
```

## Checklist de Primeiro Deploy

1. Criar banco MySQL `comicstrunk` no cPanel
2. Criar aplicacao Node.js para API (`api.comicstrunk.com`)
3. Criar aplicacao Node.js para Web (`comicstrunk.com`)
4. Configurar variaveis de ambiente em ambas as apps
5. Rodar `deploy-api.sh` → `prisma migrate deploy` → `prisma db seed`
6. Rodar `deploy-web.sh`
7. Configurar cron job de backup
8. Verificar: `curl https://api.comicstrunk.com/health`
9. Verificar: `curl https://comicstrunk.com`

## Checklist de Deploy Rotineiro

1. `git pull` no servidor (ou clonar monorepo)
2. `pnpm install`
3. `./scripts/deploy-api.sh` → `npx prisma migrate deploy` (se houver migrations novas)
4. `./scripts/deploy-web.sh`
5. Verificar health de ambas as apps
