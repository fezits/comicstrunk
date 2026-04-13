# Comics Trunk - Guia de Deploy em Producao

## Servidor

- **Host:** server34.integrator.com.br
- **SSH User:** ferna5257
- **MySQL:** 5.7.44 (usuario: ferna5257_comics, db: ferna5257_comicstrunk_db)
- **Node:** v20.1.0 em `/usr/nodejs/node-v20.1.0/bin/node`
- **pnpm:** `/home/ferna5257/.local/bin/pnpm`
- **API:** `/home/ferna5257/applications/api.comicstrunk.com` (porta 51729)
- **Web:** `/home/ferna5257/applications/comicstrunk.com` (porta 51730)
- **Document roots (Apache):** `/home/ferna5257/api.comicstrunk.com/` e `/home/ferna5257/comicstrunk.com/`
- **Uploads:** `/home/ferna5257/applications/api.comicstrunk.com/uploads/`

## Regra de ouro

**NUNCA rodar `pnpm install`, `npm install` ou `next build` no servidor.** O servidor tem 1GB de RAM compartilhado com outros sites. Todo build acontece na maquina local.

---

## 1. Deploy da API

### Comando rapido
```bash
cd /d/Projetos/comicstrunk
./scripts/deploy.sh api
```

### O que o script faz (passo a passo manual se precisar)

```bash
# 1. Build local
pnpm --filter contracts build
pnpm --filter api build

# 2. Empacotar contracts (resolve workspace:*)
cd packages/contracts && pnpm pack

# 3. Gerar package.json de deploy (troca workspace:* por file:./contracts.tgz)
node scripts/patch-package-deploy.js

# 4. Enviar artefatos
tar czf - -C apps/api/dist . | ssh ferna5257@server34.integrator.com.br "tar xzf - -C /home/ferna5257/applications/api.comicstrunk.com/dist/"
tar czf - -C apps/api/prisma . | ssh ferna5257@server34.integrator.com.br "tar xzf - -C /home/ferna5257/applications/api.comicstrunk.com/prisma/"
scp package-deploy.json ferna5257@server34.integrator.com.br:/home/ferna5257/applications/api.comicstrunk.com/package.json
scp contracts.tgz ferna5257@server34.integrator.com.br:/home/ferna5257/applications/api.comicstrunk.com/contracts.tgz

# 5. Instalar deps no servidor (so deps de prod - leve, ~2s)
ssh ferna5257@server34.integrator.com.br "export PATH=/usr/nodejs/node-v20.1.0/bin:\$PATH && cd /home/ferna5257/applications/api.comicstrunk.com && /home/ferna5257/.local/bin/pnpm install --prod --no-frozen-lockfile"

# 6. Gerar Prisma client no servidor
ssh ferna5257@server34.integrator.com.br "export PATH=/usr/nodejs/node-v20.1.0/bin:\$PATH && cd /home/ferna5257/applications/api.comicstrunk.com && /usr/nodejs/node-v20.1.0/bin/node ./node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js generate"

# 7. Garantir entry point
ssh ferna5257@server34.integrator.com.br "echo \"require('./dist/app.js');\" > /home/ferna5257/applications/api.comicstrunk.com/app.js"

# 8. Restart
ssh ferna5257@server34.integrator.com.br "kill \$(lsof -ti:51729) 2>/dev/null; sleep 2; touch /home/ferna5257/applications/api.comicstrunk.com/tmp/restart.txt"
```

### Se o restart via touch nao funcionar
Reiniciar pelo **cPanel > Node.js Apps > api.comicstrunk.com > Restart**.

---

## 2. Deploy do Frontend (Web)

### O problema do Windows
O Next.js standalone cria symlinks que o Windows nao permite mesmo com Modo Desenvolvedor. O build completa mas o standalone fica com `node_modules` vazio.

### Comando rapido (3 etapas)

```bash
cd /d/Projetos/comicstrunk

# Etapa 1: Build (erro de symlink no final - IGNORAR, o codigo ja compilou)
CI=true NEXT_PUBLIC_API_URL=https://api.comicstrunk.com/api/v1 pnpm --filter web build

# Etapa 2: Fix standalone (copia node_modules reais + gera server.js)
node scripts/fix-standalone.js

# Etapa 3: Copiar build files para dentro do standalone
STANDALONE=apps/web/.next/standalone/apps/web/.next
SRC=apps/web/.next
mkdir -p $STANDALONE
cp $SRC/required-server-files.json $STANDALONE/
cp $SRC/BUILD_ID $STANDALONE/
cp -r $SRC/server $STANDALONE/
cp $SRC/build-manifest.json $STANDALONE/ 2>/dev/null
cp $SRC/app-build-manifest.json $STANDALONE/ 2>/dev/null
cp $SRC/prerender-manifest.json $STANDALONE/ 2>/dev/null
cp $SRC/routes-manifest.json $STANDALONE/ 2>/dev/null
cp -r $SRC/static $STANDALONE/ 2>/dev/null
```

Depois, substituir o `apps/web/.next/standalone/apps/web/server.js` pelo server.js custom (ver secao 3).

### Enviar para o servidor

```bash
STANDALONE=apps/web/.next/standalone
PUBLIC=apps/web/public

# Enviar standalone
tar czf - -C $STANDALONE . | ssh ferna5257@server34.integrator.com.br "rm -rf /home/ferna5257/applications/comicstrunk.com/apps /home/ferna5257/applications/comicstrunk.com/node_modules /home/ferna5257/applications/comicstrunk.com/package.json && tar xzf - -C /home/ferna5257/applications/comicstrunk.com/"

# Enviar public
ssh ferna5257@server34.integrator.com.br "mkdir -p /home/ferna5257/applications/comicstrunk.com/apps/web/public"
tar czf - -C $PUBLIC . | ssh ferna5257@server34.integrator.com.br "tar xzf - -C /home/ferna5257/applications/comicstrunk.com/apps/web/public/"

# Symlink + restart
ssh ferna5257@server34.integrator.com.br "ln -sf /home/ferna5257/applications/comicstrunk.com/apps/web/server.js /home/ferna5257/applications/comicstrunk.com/server.js; kill \$(lsof -ti:51730) 2>/dev/null; sleep 2; touch /home/ferna5257/applications/comicstrunk.com/tmp/restart.txt"
```

### NEXT_PUBLIC_API_URL
**CRITICO:** A variavel `NEXT_PUBLIC_API_URL` e baked no build. Se buildar sem ela, o frontend vai chamar `localhost:3001`. O valor correto e:
```
NEXT_PUBLIC_API_URL=https://api.comicstrunk.com/api/v1
```

---

## 3. server.js custom do Web

O Next.js standalone nao serve arquivos estaticos (`/_next/static/`). O server.js custom resolve isso. Deve ser colocado em `apps/web/.next/standalone/apps/web/server.js` antes do envio.

```javascript
const path = require("path");
const { createServer } = require("http");
const { parse } = require("url");
const fs = require("fs");

const dir = path.join(__dirname);
const nextConfig = JSON.parse(
  fs.readFileSync(path.join(dir, ".next", "required-server-files.json"), "utf8")
);

process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig.config);

const NextServer = require("next/dist/server/next-server").default;
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const nextServer = new NextServer({
  hostname, port, dir, dev: false, customServer: false,
  conf: { ...nextConfig.config, distDir: ".next" },
});

const handler = nextServer.getRequestHandler();
const staticDir = path.join(dir, ".next", "static");
const publicDir = path.join(dir, "public");

const MIME = {
  ".js": "application/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".map": "application/json", ".webp": "image/webp",
};

function serveStatic(filePath, res) {
  if (!fs.existsSync(filePath)) return false;
  const ext = path.extname(filePath);
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  fs.createReadStream(filePath).pipe(res);
  return true;
}

createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url, true);
    const pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname.startsWith("/_next/static/")) {
      const rel = pathname.replace("/_next/static/", "");
      if (serveStatic(path.join(staticDir, rel), res)) return;
    }
    if (serveStatic(path.join(publicDir, pathname), res)) return;
    await handler(req, res, parsedUrl);
  } catch (err) {
    console.error("Error:", err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
}).listen(port, hostname, () => {
  console.log("> Ready on http://" + hostname + ":" + port);
});
```

---

## 4. Migrations do banco

```bash
# Aplicar migrations pendentes
ssh ferna5257@server34.integrator.com.br "export PATH=/usr/nodejs/node-v20.1.0/bin:\$PATH && export DATABASE_URL='mysql://ferna5257_comics:ComicsComics@123@localhost:3306/ferna5257_comicstrunk_db' && cd /home/ferna5257/applications/api.comicstrunk.com && /usr/nodejs/node-v20.1.0/bin/node ./node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js migrate deploy"
```

### Se uma migration falhar
```bash
# Marcar como aplicada sem executar
ssh ferna5257@server34.integrator.com.br "... node .../prisma/build/index.js migrate resolve --applied NOME_DA_MIGRATION"
```

### MySQL 5.7 vs MySQL 8.0
O servidor usa MySQL 5.7 (MyISAM padrao, limite de 1000 bytes para chaves). O Docker local usa MySQL 8.0 (InnoDB). Para tabelas com chaves longas, usar `ENGINE=InnoDB ROW_FORMAT=DYNAMIC`.

---

## 5. Importar dump SQL

```bash
# Enviar dump
scp arquivo.sql ferna5257@server34.integrator.com.br:/home/ferna5257/

# Se o dump tem warning do mysqldump na primeira linha, remover:
ssh ferna5257@server34.integrator.com.br "tail -n +2 /home/ferna5257/arquivo.sql > /home/ferna5257/clean.sql"

# Se o dump esta em UTF-16 (caracteres com espacos entre), converter local:
# powershell: Get-Content arquivo.sql -Encoding Unicode | Set-Content arquivo-utf8.sql -Encoding UTF8

# Importar
ssh ferna5257@server34.integrator.com.br "mysql -uferna5257_comics -pComicsComics@123 ferna5257_comicstrunk_db < /home/ferna5257/clean.sql"

# Corrigir URLs de imagens (trocar localhost/IP local por producao)
ssh ferna5257@server34.integrator.com.br 'mysql -uferna5257_comics -pComicsComics@123 ferna5257_comicstrunk_db -e "UPDATE catalog_entries SET cover_image_url = REPLACE(cover_image_url, \"http://192.168.1.9:3005\", \"https://api.comicstrunk.com\") WHERE cover_image_url LIKE \"http://192.168%\";"'
```

---

## 6. Enviar uploads (imagens)

```bash
# 2.1GB, ~20k arquivos - demora ~10min
tar czf - -C apps/api/uploads . | ssh ferna5257@server34.integrator.com.br "mkdir -p /home/ferna5257/applications/api.comicstrunk.com/uploads && tar xzf - -C /home/ferna5257/applications/api.comicstrunk.com/uploads/"

# Symlink de covers (imagens ficam em uploads/comicstrunk/covers/ mas URLs apontam para uploads/covers/)
ssh ferna5257@server34.integrator.com.br "ln -sf /home/ferna5257/applications/api.comicstrunk.com/uploads/comicstrunk/covers /home/ferna5257/applications/api.comicstrunk.com/uploads/covers"
```

---

## 7. Problemas conhecidos e solucoes

| Problema | Causa | Solucao |
|----------|-------|---------|
| **503 Service Unavailable** | Passenger/PM2 nao iniciou | cPanel > Node.js Apps > Restart |
| **EADDRINUSE** | Processo antigo na porta | `kill $(lsof -ti:PORTA)` |
| **Cannot find module 'next'** | Standalone com node_modules vazio | `node scripts/fix-standalone.js` |
| **EPERM symlink (Windows)** | Windows bloqueia symlinks | Build falha no final mas codigo compila. fix-standalone.js corrige |
| **coverImageUrl com localhost** | `API_BASE_URL` nao setada | Corrigido em `cloudinary.ts` derivando de `WEB_URL` |
| **Imagens 404** | Arquivos em `uploads/comicstrunk/covers/`, URLs em `uploads/covers/` | Symlink: `ln -sf .../comicstrunk/covers .../covers` |
| **CSP bloqueando imagens** | Helmet envia `img-src 'self'` | `contentSecurityPolicy: false` em create-app.ts |
| **Migration key too long** | MySQL 5.7 MyISAM limite 1000 bytes | Criar tabelas com `ENGINE=InnoDB ROW_FORMAT=DYNAMIC` |
| **Dump SQL falha silenciosamente** | Warning do mysqldump na linha 1 | `tail -n +2 dump.sql > clean.sql` |
| **Static files 404 (%5B%5D)** | URL encoding de `[locale]` | `decodeURIComponent()` no server.js custom |

---

## 8. .htaccess nos document roots

Os document roots do Apache sao DIFERENTES dos diretorios das apps. Cada um precisa de um `.htaccess`:

**`/home/ferna5257/api.comicstrunk.com/.htaccess`**
```apache
PassengerNodejs /usr/nodejs/node-v20.1.0/bin/node
PassengerAppRoot /home/ferna5257/applications/api.comicstrunk.com
PassengerFriendlyErrorPages on
```

**`/home/ferna5257/comicstrunk.com/.htaccess`**
```apache
PassengerNodejs /usr/nodejs/node-v20.1.0/bin/node
PassengerAppRoot /home/ferna5257/applications/comicstrunk.com
PassengerFriendlyErrorPages on
```

---

## 9. Cron Job - Sync diario

Configurar no **cPanel > Cron Jobs**:

```
Comando: /home/ferna5257/applications/api.comicstrunk.com/scripts/cron-sync.sh
Horario: 0 4 * * * (4h da manha, todo dia)
```

O script executa em sequencia:
1. `sync-catalog.ts` — sync incremental Panini+Rika (novos gibis + precos)
2. `fetch-missing-covers.ts` — baixa capas faltantes
3. `fix-missing-cover-files.js` — corrige entries com URL mas sem arquivo
4. Resize capas > 500KB

Log em `/home/ferna5257/logs/sync-catalog.log` (rotacao automatica 5 dias).

Monitorar resultados em: **Admin > Catalogo > Adicoes Recentes** (`/admin/catalog/recent`)

---

## 10. Checklist pos-deploy

```bash
# API respondendo
curl -s https://api.comicstrunk.com/api/v1/catalog | head -c 100

# Web carregando
curl -s -o /dev/null -w "%{http_code}" https://comicstrunk.com/pt-BR

# CSS/JS servindo (pegar hash do HTML)
curl -s -o /dev/null -w "%{http_code}" "https://comicstrunk.com/_next/static/css/HASH.css"

# Imagens servindo
curl -s -o /dev/null -w "%{http_code}" https://api.comicstrunk.com/uploads/covers/QUALQUER.jpg

# Sem localhost nos responses
curl -s https://api.comicstrunk.com/api/v1/catalog?limit=1 | grep localhost
# (deve retornar vazio)
```

---

## 10. Estrutura no servidor

```
/home/ferna5257/
  api.comicstrunk.com/           # Document root Apache (so .htaccess)
  comicstrunk.com/               # Document root Apache (so .htaccess)
  applications/
    api.comicstrunk.com/         # App da API
      app.js                     # Entry point (require dist/app.js)
      app.yaml / start.json      # Config do Passenger/PM2
      dist/                      # Codigo compilado
      prisma/                    # Schema + migrations
      node_modules/              # Symlink para nodevenv
      uploads/                   # Imagens
        covers -> comicstrunk/covers  # Symlink
        comicstrunk/covers/      # Imagens reais
      package.json               # Com contracts.tgz e prisma em deps
      contracts.tgz              # Pacote contracts empacotado
      stdout.log                 # Logs da app
    comicstrunk.com/             # App do Web
      server.js                  # Symlink -> apps/web/server.js
      apps/web/
        server.js                # Server custom (serve static)
        .next/                   # Build do Next.js
          static/                # CSS, JS chunks
          server/                # Server-side pages
          required-server-files.json
          BUILD_ID
        public/                  # Assets publicos
        node_modules/            # Deps do standalone
      node_modules/              # Deps raiz do standalone
```
