# Migração de Capas para Cloudflare R2

**Status:** Concluído
**Data:** 2026-04-21

## Motivação

- Servidor cPanel tem quota de ~10GB, com 6.3GB já em covers
- R2 tem 10GB grátis + zero custo de egress
- Permite escalar catálogo sem preocupação com espaço

## Custo Estimado

| Item | Volume atual | Custo |
|------|-------------|-------|
| Armazenamento | ~4.5GB (114k capas) | **$0** (free tier 10GB) |
| Operações | ~100k puts migração + reads | **$0** (10M reads grátis/mês) |
| Bandwidth | ilimitado | **$0** (R2 não cobra egress) |
| Meta 270k capas | ~10.8GB | ~$0.01/mês pelo excedente |

## Arquivos que precisam ser alterados

### 1. `apps/api/src/shared/lib/cloudinary.ts` — Ponto central
- `uploadImage()` → usar `@aws-sdk/client-s3` para upload ao R2
- `deleteImage()` → deletar objeto no R2 via SDK
- `localCoverUrl()` → retornar URL pública do R2 (ex: `https://covers.comicstrunk.com/{filename}`)
- Manter fallback local para dev

### 2. `apps/api/src/modules/catalog/catalog.service.ts`
- `resolveCover()` — ajustar lógica para reconhecer URLs do R2
- `uploadCoverBySourceKey()` — mudar de `fs.writeFileSync` para upload R2

### 3. `apps/api/src/create-app.ts`
- `express.static('/uploads')` pode ser removido após migração completa (ou mantido como fallback)

### 4. `apps/api/scripts/sync-catalog.ts`
- `downloadCover()` — após comprimir com sharp, enviar ao R2 em vez de salvar local

### 5. `.env` / `.env.example`
- Adicionar: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- Remover (eventualmente): `CLOUDINARY_*`

### 6. `apps/web/next.config.ts` (opcional)
- Adicionar `remotePatterns` para domínio R2 (se usar Next.js Image)

## O que NÃO muda
- Schema Prisma (mesmos campos `coverImageUrl` e `coverFileName`)
- Frontend (`<img src={entry.coverImageUrl}>`)
- Lógica de dedup e importação
- Cron jobs

## Dependência nova
- `@aws-sdk/client-s3`

## Etapas de migração
1. Criar bucket R2 no dashboard Cloudflare
2. Configurar domínio custom (ex: `covers.comicstrunk.com`)
3. Implementar alterações no código (cloudinary.ts, catalog.service.ts)
4. Script de migração: ler `uploads/covers/` local e enviar ao R2
5. Atualizar `coverImageUrl` no banco para URLs do R2
6. Testar em staging/dev
7. Deploy em produção
8. Verificar que todas as capas carregam
9. Remover capas do servidor (libera ~6.3GB de quota)

## Notas
- Capas do Open Library (URLs externas) não precisam de R2 — já são servidas de CDN externa
- Apenas capas locais (Rika, Panini, compactadas) precisam migrar
- Manter compressão (600px, JPEG 80%) antes de enviar ao R2
