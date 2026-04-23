# Deploy Produção - Integrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o primeiro deploy completo do Comics Trunk (API + Web + banco de dados) no servidor Integrator, apontando para `api.comicstrunk.com` e `comicstrunk.com`.

**Architecture:** 1 servidor cPanel no Integrator com 2 apps Node.js via Passenger — API Express em `api.comicstrunk.com` e Web Next.js em `comicstrunk.com` — ambas conectadas ao MySQL local do servidor. Build acontece localmente (Windows) e os arquivos são copiados via SSH/SCP para o servidor.

**Tech Stack:** Node.js 20 LTS, Express 4, Next.js 15 standalone, Prisma 5, MySQL 8, cPanel Passenger, pnpm 9.15.0

**REGRA CRÍTICA:** Tocar APENAS nos diretórios do comicstrunk no servidor. NUNCA executar comandos destrutivos globais. O servidor tem outros projetos de outros clientes.

---

## Fase 1 — Preparação do servidor

### Task 1: Verificar pré-requisitos no servidor via SSH

**Arquivos:** nenhum

- [ ] **Step 1: Conectar via SSH ao servidor**

```bash
ssh ferna5257@server34.integrator.com.br
```

- [ ] **Step 2: Verificar versão do Node.js**

```bash
node --version
```
Esperado: `v20.x.x`. Se for 18.x também funciona. Se for abaixo de 18, parar e reportar.

- [ ] **Step 3: Verificar se pnpm está disponível**

```bash
pnpm --version
```
Se não estiver disponível:
```bash
npm install -g pnpm@9.15.0
```

- [ ] **Step 4: Verificar se npx/prisma consegue rodar**

```bash
npx --version
```

- [ ] **Step 5: Verificar se os diretórios de deploy existem ou precisam ser criados**

```bash
ls ~/api.comicstrunk.com 2>/dev/null && echo "existe" || echo "nao existe"
ls ~/comicstrunk.com 2>/dev/null && echo "existe" || echo "nao existe"
```

- [ ] **Step 6: Criar diretórios se não existirem**

```bash
mkdir -p ~/api.comicstrunk.com/tmp
mkdir -p ~/api.comicstrunk.com/prisma
mkdir -p ~/comicstrunk.com/tmp
```

---

### Task 2: Configurar banco de dados MySQL no cPanel

**Arquivos:** nenhum (configuração via cPanel UI ou UAPI)

- [ ] **Step 1: Criar banco de dados `comicstrunk` no cPanel**

Via UI: cPanel → MySQL Databases → Create Database → nome: `comicstrunk`

Ou via SSH com UAPI:
```bash
uapi --user=$USER Mysql create_database name=comicstrunk
```

- [ ] **Step 2: Criar usuário MySQL**

Via UI: cPanel → MySQL Databases → Create User → usuário: `comicstrunk_user`, senha forte

Ou via SSH:
```bash
uapi --user=$USER Mysql create_user name=comicstrunk_user password=SENHA_FORTE_AQUI
```

- [ ] **Step 3: Dar privilégios ao usuário no banco**

Via UI: cPanel → MySQL Databases → Add User to Database → ALL PRIVILEGES

Ou via SSH:
```bash
uapi --user=$USER Mysql set_privileges_on_database user=comicstrunk_user database=comicstrunk privileges=ALL
```

- [ ] **Step 4: Anotar a DATABASE_URL**

O formato será:
```
mysql://comicstrunk_user:SENHA_FORTE_AQUI@localhost:3306/comicstrunk
```
Guardar essa string — será usada nas variáveis de ambiente da API.

---

### Task 3: Criar as duas aplicações Node.js no cPanel

**Arquivos:** nenhum (configuração via cPanel)

- [ ] **Step 1: Criar app da API no cPanel**

Via UI: cPanel → Setup Node.js App → Create Application:
- Node.js version: `20.x`
- Application mode: `Production`
- Application root: `api.comicstrunk.com`
- Application URL: `api.comicstrunk.com`
- Application startup file: `dist/app.js`

- [ ] **Step 2: Configurar variáveis de ambiente da API no cPanel**

Na mesma tela do app ou via SSH:
```bash
uapi --user=$USER NodeJS set_env_var application_root=/home/$USER/api.comicstrunk.com key=NODE_ENV value=production
uapi --user=$USER NodeJS set_env_var application_root=/home/$USER/api.comicstrunk.com key=DATABASE_URL value="mysql://comicstrunk_user:SENHA@localhost:3306/comicstrunk"
uapi --user=$USER NodeJS set_env_var application_root=/home/$USER/api.comicstrunk.com key=JWT_ACCESS_SECRET value="GERAR_64_BYTES_HEX_AQUI"
uapi --user=$USER NodeJS set_env_var application_root=/home/$USER/api.comicstrunk.com key=JWT_REFRESH_SECRET value="GERAR_64_BYTES_HEX_DIFERENTE_AQUI"
uapi --user=$USER NodeJS set_env_var application_root=/home/$USER/api.comicstrunk.com key=WEB_URL value="https://comicstrunk.com"
uapi --user=$USER NodeJS set_env_var application_root=/home/$USER/api.comicstrunk.com key=PORT value="PORTA_ATRIBUIDA_PELO_CPANEL"
```

Para gerar os secrets JWT (rodar localmente no Windows):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Rodar 2 vezes — um para ACCESS, outro para REFRESH. Devem ser diferentes.

- [ ] **Step 3: Criar app do Web (frontend) no cPanel**

Via UI: cPanel → Setup Node.js App → Create Application:
- Node.js version: `20.x`
- Application mode: `Production`
- Application root: `comicstrunk.com`
- Application URL: `comicstrunk.com`
- Application startup file: `server.js`

- [ ] **Step 4: Configurar variáveis de ambiente do Web no cPanel**

```bash
uapi --user=$USER NodeJS set_env_var application_root=/home/$USER/comicstrunk.com key=NODE_ENV value=production
uapi --user=$USER NodeJS set_env_var application_root=/home/$USER/comicstrunk.com key=NEXT_PUBLIC_API_URL value="https://api.comicstrunk.com"
uapi --user=$USER NodeJS set_env_var application_root=/home/$USER/comicstrunk.com key=HOSTNAME value="0.0.0.0"
uapi --user=$USER NodeJS set_env_var application_root=/home/$USER/comicstrunk.com key=PORT value="PORTA_ATRIBUIDA_PELO_CPANEL"
```

---

## Fase 2 — Build local e deploy da API

### Task 4: Build da API localmente (Windows)

**Arquivos modificados:** `apps/api/dist/` (gerado pelo build)

- [ ] **Step 1: Garantir que está na branch correta**

```bash
git status
git branch
```
Deve estar na branch com o código mais recente do projeto.

- [ ] **Step 2: Instalar dependências**

```bash
pnpm install
```

- [ ] **Step 3: Build completo**

```bash
pnpm --filter contracts build
pnpm --filter api build
```

Esperado: pasta `apps/api/dist/` gerada com `app.js` dentro.

- [ ] **Step 4: Verificar que o build foi gerado**

```bash
ls apps/api/dist/app.js
```

---

### Task 5: Enviar arquivos da API para o servidor via SCP

**Arquivos:** locais → servidor remoto (apenas diretório `~/api.comicstrunk.com/`)

- [ ] **Step 1: Copiar dist/ para o servidor**

```bash
scp -r apps/api/dist/ ferna5257@server34.integrator.com.br:~/api.comicstrunk.com/
```

- [ ] **Step 2: Copiar prisma/ para o servidor**

```bash
scp apps/api/prisma/schema.prisma ferna5257@server34.integrator.com.br:~/api.comicstrunk.com/prisma/
scp -r apps/api/prisma/migrations/ ferna5257@server34.integrator.com.br:~/api.comicstrunk.com/prisma/
```

- [ ] **Step 3: Copiar package.json**

```bash
scp apps/api/package.json ferna5257@server34.integrator.com.br:~/api.comicstrunk.com/
```

- [ ] **Step 4: Copiar .htaccess**

```bash
scp apps/api/.htaccess ferna5257@server34.integrator.com.br:~/api.comicstrunk.com/
```

- [ ] **Step 5: Instalar dependências no servidor (dentro do diretório da API)**

```bash
ssh ferna5257@server34.integrator.com.br "cd ~/api.comicstrunk.com && npm install --production"
```

**IMPORTANTE:** Usar `npm install` aqui (não pnpm), pois o servidor pode não ter pnpm. O `--production` instala apenas dependências de produção.

---

### Task 6: Rodar migrations e seed no banco

**Arquivos:** nenhum (operações no banco)

- [ ] **Step 1: Conectar via SSH**

```bash
ssh ferna5257@server34.integrator.com.br
```

- [ ] **Step 2: Navegar para o diretório da API**

```bash
cd ~/api.comicstrunk.com
```

- [ ] **Step 3: Criar arquivo .env temporário para o Prisma**

```bash
echo 'DATABASE_URL="mysql://comicstrunk_user:SENHA@localhost:3306/comicstrunk"' > .env
```

- [ ] **Step 4: Rodar migrations**

```bash
npx prisma migrate deploy
```

Esperado: todas as migrations aplicadas com sucesso.

- [ ] **Step 5: Rodar seed**

```bash
npx prisma db seed
```

Esperado: seed concluído — admin user, 5 categorias, 10 tags, 8 personagens, 5 séries, 10 entradas de catálogo criadas.

- [ ] **Step 6: Remover .env temporário (as variáveis estão no cPanel)**

```bash
rm .env
```

- [ ] **Step 7: Reiniciar Passenger da API**

```bash
touch ~/api.comicstrunk.com/tmp/restart.txt
```

---

### Task 7: Verificar que a API está respondendo

- [ ] **Step 1: Aguardar ~10 segundos para o Passenger inicializar**

- [ ] **Step 2: Testar o health endpoint**

```bash
curl https://api.comicstrunk.com/health
```

Esperado:
```json
{"success": true, "data": {"status": "ok"}}
```

- [ ] **Step 3: Testar o catálogo (confirmar que o seed rodou)**

```bash
curl https://api.comicstrunk.com/api/v1/catalog
```

Esperado: resposta com `"total": 10` (não pode ser `"total": 0` — se for, rodar o seed novamente).

---

## Fase 3 — Build e deploy do Frontend

### Task 8: Build do Web localmente (Windows)

**Arquivos:** `apps/web/.next/standalone/` (gerado pelo build)

- [ ] **Step 1: Build do frontend em modo standalone**

```bash
CI=true pnpm --filter web build
```

Esperado: pasta `apps/web/.next/standalone/apps/web/server.js` gerada.

- [ ] **Step 2: Verificar que o standalone foi gerado**

```bash
ls apps/web/.next/standalone/apps/web/server.js
```

---

### Task 9: Enviar arquivos do Web para o servidor via SCP

**Arquivos:** locais → servidor remoto (apenas diretório `~/comicstrunk.com/`)

- [ ] **Step 1: Copiar o output standalone**

```bash
scp -r apps/web/.next/standalone/ ferna5257@server34.integrator.com.br:~/comicstrunk.com/
```

Nota: isso copia tudo de `standalone/` para dentro de `~/comicstrunk.com/`. O `server.js` ficará em `~/comicstrunk.com/apps/web/server.js`.

- [ ] **Step 2: Copiar pasta public/**

```bash
scp -r apps/web/public/ ferna5257@server34.integrator.com.br:~/comicstrunk.com/apps/web/public/
```

- [ ] **Step 3: Copiar assets estáticos .next/static/**

```bash
ssh ferna5257@server34.integrator.com.br "mkdir -p ~/comicstrunk.com/apps/web/.next/static"
scp -r apps/web/.next/static/ ferna5257@server34.integrator.com.br:~/comicstrunk.com/apps/web/.next/
```

- [ ] **Step 4: Verificar que o startup file está no lugar certo**

```bash
ssh ferna5257@server34.integrator.com.br "ls ~/comicstrunk.com/apps/web/server.js && echo OK"
```

**IMPORTANTE:** O cPanel espera o startup file em `server.js` na raiz do application root (`~/comicstrunk.com/`). Se o Passenger não encontrar, pode ser necessário criar um symlink:

```bash
ssh ferna5257@server34.integrator.com.br "ln -sf ~/comicstrunk.com/apps/web/server.js ~/comicstrunk.com/server.js"
```

- [ ] **Step 5: Reiniciar Passenger do Web**

```bash
ssh ferna5257@server34.integrator.com.br "touch ~/comicstrunk.com/tmp/restart.txt"
```

---

### Task 10: Verificar que o frontend está respondendo

- [ ] **Step 1: Aguardar ~15 segundos para o Passenger inicializar o Next.js**

- [ ] **Step 2: Testar o frontend**

```bash
curl -I https://comicstrunk.com
```

Esperado: `HTTP/2 200` ou `HTTP/1.1 200 OK`.

- [ ] **Step 3: Verificar no browser**

Abrir `https://comicstrunk.com` no browser e confirmar que a home carrega corretamente.

- [ ] **Step 4: Testar login**

Acessar `https://comicstrunk.com/pt-BR/login` e fazer login com o admin criado pelo seed:
- Email: `admin@comicstrunk.com` (verificar no seed se o email for diferente)
- Senha: definida no seed

---

## Fase 4 — Configurar Git SSH do Integrator (deploys futuros)

### Task 11: Configurar remote Git para o Integrator

**Arquivos:** `.git/config` (local)

Esta task configura o repositório local para poder fazer push diretamente para o servidor do Integrator em deploys futuros.

- [ ] **Step 1: Verificar se o servidor tem git instalado**

```bash
ssh ferna5257@server34.integrator.com.br "git --version"
```

- [ ] **Step 2: Inicializar repositório git no servidor (se não existir)**

```bash
ssh ferna5257@server34.integrator.com.br "
  mkdir -p ~/repos/comicstrunk.git &&
  cd ~/repos/comicstrunk.git &&
  git init --bare
"
```

- [ ] **Step 3: Adicionar remote `integrator` no repositório local**

```bash
git remote add integrator ferna5257@server34.integrator.com.br:~/repos/comicstrunk.git
```

- [ ] **Step 4: Fazer push do código para o Integrator**

```bash
git push integrator feature/api-performance-optimization:main
```

Ou da branch main quando o merge estiver feito:
```bash
git push integrator main
```

- [ ] **Step 5: Verificar que o push foi bem-sucedido**

```bash
ssh ferna5257@server34.integrator.com.br "cd ~/repos/comicstrunk.git && git log --oneline -5"
```

**Nota sobre deploys futuros com Git:** O bare repo no servidor guarda o código, mas o deploy em si (build + copy dos arquivos) ainda precisa ser feito manualmente com os scripts `deploy-api.sh` e `deploy-web.sh`, ou via um git hook `post-receive` no servidor. Para adicionar o hook:

```bash
ssh ferna5257@server34.integrator.com.br "cat > ~/repos/comicstrunk.git/hooks/post-receive << 'EOF'
#!/bin/bash
# ATENÇÃO: Este hook roda no servidor do Integrator
# Apenas faz checkout do código — o build ainda roda localmente
GIT_WORK_TREE=~/comicstrunk-src GIT_DIR=~/repos/comicstrunk.git git checkout -f main
EOF
chmod +x ~/repos/comicstrunk.git/hooks/post-receive"
```

---

## Checklist Final

- [ ] `curl https://api.comicstrunk.com/health` → 200 OK
- [ ] `curl https://api.comicstrunk.com/api/v1/catalog` → total: 10 (não zero)
- [ ] `https://comicstrunk.com` abre no browser sem erros
- [ ] Login funciona em `https://comicstrunk.com/pt-BR/login`
- [ ] Console do browser sem erros de CORS
- [ ] Seed data visível no catálogo

---

## Variáveis a preencher antes de executar

| Variável | Valor |
|----------|-------|
| `SEU_USUARIO` | `ferna5257` |
| `SENHA` | senha do MySQL `comicstrunk_user` |
| `JWT_ACCESS_SECRET` | gerar com `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | gerar com o mesmo comando (valor diferente) |
| `PORT` (API) | porta atribuída pelo cPanel ao app da API |
| `PORT` (Web) | porta atribuída pelo cPanel ao app do Web |
