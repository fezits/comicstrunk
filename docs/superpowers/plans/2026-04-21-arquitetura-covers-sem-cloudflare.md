# Arquitetura de Capas — Sem Cloudflare (Backup/Rollback)

**Data:** 2026-04-21
**Propósito:** Documentação da arquitetura original de armazenamento de capas, antes da migração para Cloudflare R2. Usar este documento para reverter caso necessário.

---

## Visão Geral

As capas são armazenadas **localmente no servidor cPanel** da Integrator e servidas via Express static middleware. Não há CDN nem serviço externo de storage.

```
Browser → api.comicstrunk.com/uploads/covers/{arquivo}.jpg → Express.static → Filesystem
```

## Servidor

- **Host:** server34.integrator.com.br (IP: 15.235.55.109)
- **Diretório de capas:** `/home/ferna5257/applications/api.comicstrunk.com/uploads/covers/`
- **DNS:** ns77.integrator.com.br / ns78.integrator.com.br
- **Quota disco:** ~10GB (capas ocupam ~6.3GB)

## Banco de Dados

Dois campos no `CatalogEntry` controlam as capas:

| Campo | Tipo | Uso |
|-------|------|-----|
| `coverImageUrl` | String? | URL completa (externa ou local). Ex: `https://api.comicstrunk.com/uploads/covers/rika-123.jpg` ou `https://covers.openlibrary.org/b/id/12345-L.jpg` |
| `coverFileName` | String? | Nome do arquivo local. Ex: `rika-123.jpg`. Usado quando a capa está em `/uploads/covers/` |

**Regra:** Se `coverFileName` existe, a URL é construída em runtime por `localCoverUrl()`. Se `coverImageUrl` existe com URL externa (Open Library, etc.), é usada diretamente.

## Arquivos-Chave

### 1. `apps/api/src/shared/lib/cloudinary.ts`

Apesar do nome, este arquivo gerencia storage local (Cloudinary é opcional e não está configurado em produção).

```typescript
// Constantes
export const UPLOADS_PATH = path.resolve(process.cwd(), 'uploads');
const apiBaseUrl = process.env.API_PUBLIC_URL || 'http://localhost:3001';
export const LOCAL_API_BASE_URL = apiBaseUrl;

// Constrói URL pública a partir do nome do arquivo local
export function localCoverUrl(filename: string, folder = 'comicstrunk/covers'): string {
  return `${apiBaseUrl}/uploads/${folder}/${filename}`;
}

// Upload: salva no filesystem local
export async function uploadImage(buffer: Buffer, folder: string) {
  // Detecta tipo da imagem (JPEG/PNG/GIF/WebP) pelos magic bytes
  // Gera UUID como nome do arquivo
  // Salva em: uploads/{folder}/{uuid}.ext
  // Retorna: { url: '{apiBaseUrl}/uploads/{folder}/{filename}', publicId: '{folder}/{filename}' }
}

// Delete: remove arquivo do filesystem
export async function deleteImage(publicId: string) {
  // Deleta: uploads/{publicId}
}
```

### 2. `apps/api/src/modules/catalog/catalog.service.ts`

```typescript
// Resolve URL efetiva da capa em runtime
function resolveCover(entry) {
  const url = entry.coverImageUrl;
  // Caso 1: URL com /uploads/ de host antigo → extrai filename, reconstrói URL
  if (url && !url.startsWith(LOCAL_API_BASE_URL) && url.includes('/uploads/')) {
    const filename = url.split('/').pop();
    return { ...entry, coverImageUrl: localCoverUrl(filename) };
  }
  // Caso 2: Sem URL mas tem coverFileName → constrói URL
  if (!url && entry.coverFileName) {
    return { ...entry, coverImageUrl: localCoverUrl(entry.coverFileName) };
  }
  // Caso 3: URL externa (Open Library, etc.) → retorna como está
  return entry;
}

// Upload de capa por sourceKey (usado na importação)
async function uploadCoverBySourceKey(sourceKey, buffer) {
  // Filename: rika-123.jpg (derivado do sourceKey)
  // Salva em: uploads/covers/{filename}
  // Atualiza DB: coverFileName = filename
}
```

### 3. `apps/api/src/create-app.ts`

```typescript
// Serve arquivos estáticos de /uploads/
app.use('/uploads', express.static(UPLOADS_PATH));
```

### 4. `apps/api/scripts/sync-catalog.ts`

```typescript
// Download e compressão de capas na importação
async function downloadCover(url, filename) {
  // Baixa imagem da fonte externa
  // Comprime com sharp: 600px max width, JPEG quality 80
  // Salva em: uploads/covers/{filename}.jpg
}
```

### 5. Frontend — Exibição

```typescript
// apps/web/src/components/features/catalog/catalog-card.tsx
// Usa <img> direto (não Next.js Image)
{entry.coverImageUrl ? (
  <img src={entry.coverImageUrl} alt={entry.title} />
) : (
  <BookOpen /> // Placeholder
)}
```

### 6. `apps/web/next.config.ts`
- **Sem configuração de imagem** (sem remotePatterns, sem domains)
- Não usa Next.js Image component

## Variáveis de Ambiente (Produção)

```env
# Em start.json / app.yaml:
API_PUBLIC_URL=https://api.comicstrunk.com

# Cloudinary (OPCIONAL - não configurado em produção):
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=
```

## Fluxo de Upload de Capa

```
1. Admin envia imagem via POST /:id/cover
2. Multer recebe em memória (buffer)
3. uploadImage() salva em uploads/comicstrunk/covers/{uuid}.jpg
4. DB atualiza coverImageUrl = 'https://api.comicstrunk.com/uploads/comicstrunk/covers/{uuid}.jpg'
```

## Fluxo de Importação em Massa

```
1. Script baixa capa da fonte (Rika, Open Library, etc.)
2. Comprime com sharp/mogrify (600px, JPEG 80%)
3. Salva em uploads/covers/{slug}.jpg
4. DB atualiza coverFileName = '{slug}.jpg'
5. resolveCover() constrói URL em runtime
```

## Fluxo de Leitura

```
1. API busca entry no Prisma
2. resolveCover() mapeia coverFileName → coverImageUrl
3. Frontend recebe coverImageUrl
4. Browser faz GET para api.comicstrunk.com/uploads/covers/{arquivo}.jpg
5. Express.static serve o arquivo do disco
```

## Limitações desta Arquitetura

- **Quota de disco:** ~10GB total no cPanel, capas já ocupam 6.3GB
- **Sem CDN:** Imagens servidas do servidor único no Brasil/Canadá
- **Sem cache headers:** Express.static padrão, sem max-age
- **Banda limitada:** Todo tráfego de imagens passa pelo servidor
- **Sem redundância:** Se o servidor cai, capas ficam indisponíveis

## Como Reverter do Cloudflare R2

Caso queira voltar para esta arquitetura:

### 1. DNS
- Trocar nameservers de volta: `art.ns.cloudflare.com` / `eva.ns.cloudflare.com` → `ns77.integrator.com.br` / `ns78.integrator.com.br`
- Ou: no Cloudflare, remover o CNAME `covers` e desativar proxy nos registros A

### 2. Código (`cloudinary.ts`)
- Reverter `uploadImage()` para salvar no filesystem local
- Reverter `localCoverUrl()` para retornar `api.comicstrunk.com/uploads/...`
- Reverter `deleteImage()` para deletar do filesystem

### 3. Banco de Dados
- Atualizar `coverImageUrl` de volta para URLs locais:
```sql
UPDATE catalog_entries
SET cover_image_url = CONCAT('https://api.comicstrunk.com/uploads/covers/', cover_file_name)
WHERE cover_file_name IS NOT NULL;
```

### 4. Arquivos
- Re-upload das capas do R2/local para `/home/ferna5257/applications/api.comicstrunk.com/uploads/covers/`
- Ou: usar o backup local em `d:/Projetos/comicstrunk/apps/api/uploads/covers/` (26,946 arquivos, 6.4GB)

### 5. Express
- Garantir que `app.use('/uploads', express.static(UPLOADS_PATH))` está ativo em `create-app.ts`
