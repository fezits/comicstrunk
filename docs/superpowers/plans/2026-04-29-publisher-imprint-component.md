# Publisher + Imprint Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os campos `publisher` e `imprint` (string livre) por entidades estruturadas com componente seletor, CRUD admin e migração orgânica.

**Architecture:** Tabelas `publishers` e `imprints` (Imprint.publisherId opcional). CatalogEntry ganha FKs `publisherId` e `imprintId` mantendo strings legadas como fallback. Componente combobox no admin form com "Outro" inline (cria APPROVED direto). CRUD admin completo com merge de duplicatas. Scraper de logos via Wikipedia/Wikidata.

**Tech Stack:** Prisma + MySQL, Zod, Express, React, shadcn/ui (Combobox/Popover), sharp, Cloudflare R2, Wikipedia API.

**Spec:** `docs/superpowers/specs/2026-04-29-publisher-imprint-component-design.md`

---

## File Structure

### Backend (Phase 1)

```
apps/api/prisma/schema.prisma                                    [modified]
apps/api/prisma/migrations/<ts>_add_publishers_imprints/          [new]
apps/api/prisma/seeds/publishers.json                             [new]
apps/api/prisma/seeds/imprints.json                               [new]
apps/api/src/modules/publishers/publishers.service.ts             [new]
apps/api/src/modules/publishers/publishers.routes.ts              [new]
apps/api/src/modules/publishers/publishers.admin.routes.ts        [new]
apps/api/src/modules/imprints/imprints.service.ts                 [new]
apps/api/src/modules/imprints/imprints.routes.ts                  [new]
apps/api/src/modules/imprints/imprints.admin.routes.ts            [new]
apps/api/src/modules/admin/admin.routes.ts                        [modified]
apps/api/src/modules/catalog/catalog.service.ts                   [modified]
apps/api/src/shared/utils/publisher.ts                            [new]
apps/api/src/create-app.ts                                        [modified]
apps/api/scripts/seed-publishers.ts                               [new]
apps/api/scripts/match-publishers-legacy.ts                       [new]
apps/api/scripts/scrape-publisher-logos.ts                        [new]
packages/contracts/src/publisher.ts                               [new]
packages/contracts/src/imprint.ts                                 [new]
packages/contracts/src/index.ts                                   [modified]
```

### Frontend (Phases 2-4)

```
apps/web/src/components/features/admin/publisher-combobox.tsx        [new]
apps/web/src/components/features/admin/imprint-combobox.tsx          [new]
apps/web/src/components/features/admin/publisher-list.tsx            [new]
apps/web/src/components/features/admin/publisher-edit-form.tsx       [new]
apps/web/src/components/features/admin/publisher-merge-modal.tsx     [new]
apps/web/src/components/features/admin/imprint-list.tsx              [new]
apps/web/src/components/features/admin/imprint-edit-form.tsx         [new]
apps/web/src/components/features/catalog/catalog-form.tsx            [modified]
apps/web/src/lib/services/publishers.ts                              [new]
apps/web/src/lib/services/imprints.ts                                [new]
apps/web/src/app/[locale]/(admin)/admin/publishers/page.tsx          [new]
apps/web/src/app/[locale]/(admin)/admin/publishers/[id]/page.tsx     [new]
apps/web/src/app/[locale]/(admin)/admin/imprints/page.tsx            [new]
apps/web/src/app/[locale]/(admin)/admin/imprints/[id]/page.tsx       [new]
apps/web/src/components/layout/nav-config.ts                         [modified]
apps/web/src/messages/pt-BR.json                                     [modified]
```

---

# PHASE 1 — Backend (schema + endpoints + scripts)

**Goal:** Tabelas criadas e populadas, endpoints respondendo, logos baixados, dados legados parcialmente mapeados. Sem nada no frontend.

**Done state:**
- `GET /api/v1/publishers?search=marvel` retorna lista com Marvel Comics + logo URL.
- `GET /api/v1/admin/publishers` com auth retorna lista paginada.
- `POST /api/v1/admin/publishers` cria.
- Banco de produção rodou seed + match + scraper.

## Task 1.1: Migration Prisma — schema das novas tabelas

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<ts>_add_publishers_imprints/migration.sql` (autogerado)

- [ ] **Step 1: Adicionar models Publisher e Imprint no schema**

Adicionar ao final da seção CATALOG (depois do model `Tag`):

```prisma
model Publisher {
  id              String         @id @default(cuid())
  name            String         @unique
  slug            String         @unique
  country         String?        @db.Char(2)
  logoUrl         String?        @map("logo_url")
  logoFileName    String?        @map("logo_file_name")
  description     String?        @db.Text
  approvalStatus  ApprovalStatus @default(APPROVED) @map("approval_status")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  imprints        Imprint[]
  catalogEntries  CatalogEntry[]

  @@map("publishers")
}

model Imprint {
  id              String         @id @default(cuid())
  name            String
  slug            String         @unique
  publisherId     String?        @map("publisher_id")
  logoUrl         String?        @map("logo_url")
  logoFileName    String?        @map("logo_file_name")
  description     String?        @db.Text
  approvalStatus  ApprovalStatus @default(APPROVED) @map("approval_status")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  publisher       Publisher?     @relation(fields: [publisherId], references: [id], onDelete: SetNull)
  catalogEntries  CatalogEntry[]

  @@unique([name, publisherId])
  @@index([publisherId])
  @@map("imprints")
}
```

- [ ] **Step 2: Adicionar campos em CatalogEntry**

Em `model CatalogEntry`, adicionar logo após `imprint`:

```prisma
  publisherId     String?        @map("publisher_id")
  imprintId       String?        @map("imprint_id")
```

E adicionar relations no fim das relations existentes:

```prisma
  publisherRef    Publisher?     @relation(fields: [publisherId], references: [id], onDelete: SetNull)
  imprintRef      Imprint?       @relation(fields: [imprintId], references: [id], onDelete: SetNull)
```

E indexes:

```prisma
  @@index([publisherId])
  @@index([imprintId])
```

- [ ] **Step 3: Gerar migration**

Run: `cd apps/api && corepack pnpm db:migrate --name add_publishers_imprints`
Expected: cria pasta de migration com SQL e aplica no DB local.

- [ ] **Step 4: Verificar SQL gerado**

Abrir `apps/api/prisma/migrations/<ts>_add_publishers_imprints/migration.sql` e confirmar:
- `CREATE TABLE publishers` com `name UNIQUE`, `slug UNIQUE`.
- `CREATE TABLE imprints` com `slug UNIQUE`, FK pra publishers `ON DELETE SET NULL`.
- `ALTER TABLE catalog_entries ADD COLUMN publisher_id`, `imprint_id`, FKs SET NULL, indexes.

- [ ] **Step 5: Regenerar Prisma client**

Run: `corepack pnpm --filter api db:generate`
Expected: client atualizado com `publisher`/`imprint` models.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(publishers): migration — adiciona tabelas publishers e imprints + FKs em catalog_entries"
```

## Task 1.2: Contracts Zod — publisher e imprint

**Files:**
- Create: `packages/contracts/src/publisher.ts`
- Create: `packages/contracts/src/imprint.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Criar `publisher.ts`**

```ts
import { z } from 'zod';

const COUNTRY_CODE = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'country deve ser ISO-2 maiúsculo (ex: BR, US)');

export const publisherCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  country: COUNTRY_CODE.optional(),
  description: z.string().max(2000).optional(),
});
export type PublisherCreateInput = z.infer<typeof publisherCreateSchema>;

export const publisherUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
  country: COUNTRY_CODE.nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  approvalStatus: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
});
export type PublisherUpdateInput = z.infer<typeof publisherUpdateSchema>;

export const publisherMergeSchema = z.object({
  canonicalId: z.string().cuid(),
  mergedIds: z.array(z.string().cuid()).min(1).max(50),
});
export type PublisherMergeInput = z.infer<typeof publisherMergeSchema>;

export const publisherListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  country: COUNTRY_CODE.optional(),
  approvalStatus: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
  withoutLogo: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type PublisherListQuery = z.infer<typeof publisherListQuerySchema>;

export interface PublisherDto {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  logoUrl: string | null;
  description: string | null;
  approvalStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  catalogEntriesCount?: number;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Criar `imprint.ts`**

Mesma estrutura do publisher, com `publisherId: z.string().cuid().nullable().optional()` no create e update. Lista também aceita `publisherId` filter.

```ts
import { z } from 'zod';

export const imprintCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  publisherId: z.string().cuid().nullable().optional(),
  description: z.string().max(2000).optional(),
});
export type ImprintCreateInput = z.infer<typeof imprintCreateSchema>;

export const imprintUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
  publisherId: z.string().cuid().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  approvalStatus: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
});
export type ImprintUpdateInput = z.infer<typeof imprintUpdateSchema>;

export const imprintMergeSchema = z.object({
  canonicalId: z.string().cuid(),
  mergedIds: z.array(z.string().cuid()).min(1).max(50),
});
export type ImprintMergeInput = z.infer<typeof imprintMergeSchema>;

export const imprintListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  publisherId: z.string().cuid().optional(),
  approvalStatus: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ImprintListQuery = z.infer<typeof imprintListQuerySchema>;

export interface ImprintDto {
  id: string;
  name: string;
  slug: string;
  publisherId: string | null;
  publisher?: { id: string; name: string; slug: string } | null;
  logoUrl: string | null;
  description: string | null;
  approvalStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  catalogEntriesCount?: number;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 3: Exportar do index**

Adicionar em `packages/contracts/src/index.ts`:

```ts
export * from './publisher';
export * from './imprint';
```

- [ ] **Step 4: Build**

Run: `corepack pnpm --filter contracts build`
Expected: dist atualizado.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat(contracts): zod schemas para publishers e imprints"
```

## Task 1.3: Helper resolvePublisher

**Files:**
- Create: `apps/api/src/shared/utils/publisher.ts`

- [ ] **Step 1: Criar helper**

```ts
import type { Publisher, Imprint, CatalogEntry } from '@prisma/client';

type CatalogEntryWithRefs = CatalogEntry & {
  publisherRef?: Publisher | null;
  imprintRef?: (Imprint & { publisher?: Publisher | null }) | null;
};

export function resolvePublisher(entry: CatalogEntryWithRefs) {
  if (entry.publisherRef) {
    return {
      id: entry.publisherRef.id,
      name: entry.publisherRef.name,
      slug: entry.publisherRef.slug,
      country: entry.publisherRef.country,
      logoUrl: entry.publisherRef.logoUrl,
      isStructured: true as const,
    };
  }
  if (entry.publisher) {
    return {
      id: null,
      name: entry.publisher,
      slug: null,
      country: null,
      logoUrl: null,
      isStructured: false as const,
    };
  }
  return null;
}

export function resolveImprint(entry: CatalogEntryWithRefs) {
  if (entry.imprintRef) {
    return {
      id: entry.imprintRef.id,
      name: entry.imprintRef.name,
      slug: entry.imprintRef.slug,
      publisherId: entry.imprintRef.publisherId,
      logoUrl: entry.imprintRef.logoUrl,
      isStructured: true as const,
    };
  }
  if (entry.imprint) {
    return {
      id: null,
      name: entry.imprint,
      slug: null,
      publisherId: null,
      logoUrl: null,
      isStructured: false as const,
    };
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/shared/utils/publisher.ts
git commit -m "feat(publishers): helper resolvePublisher/resolveImprint (FK + fallback string legado)"
```

## Task 1.4: Service publishers

**Files:**
- Create: `apps/api/src/modules/publishers/publishers.service.ts`

- [ ] **Step 1: Criar service com métodos: list, getBySlug, getById, create, update, uploadLogo, deleteIfEmpty, merge**

Padrão: seguir `apps/api/src/modules/catalog/catalog.service.ts`.

Pontos críticos:
- `slug` gerado via `shared/utils/slug.ts` (já suporta `publisher` e `imprint`? Se não, adicionar — ver Task 1.4.1).
- `list`: agrega `_count.catalogEntries` se `withCount: true`.
- `create`: nome único case-insensitive (lowercase compare). Se duplicata → throw `ConflictError` com `{ existingId, existingName }`.
- `uploadLogo`: recebe Buffer, normaliza com sharp pra 200x200 PNG, sobe pro R2 em `publishers/{slug}.png`, atualiza `logoFileName` + `logoUrl`.
- `deleteIfEmpty`: se `_count.catalogEntries > 0` → throw `ConflictError`. Senão delete.
- `merge`: transação. Move `catalog_entries.publisher_id` e `imprints.publisher_id` dos `mergedIds` pro canonical, deleta os mergedIds.

Esqueleto:

```ts
import { prisma } from '../../shared/lib/prisma';
import { generateUniqueSlug } from '../../shared/utils/slug';
import { ConflictError, NotFoundError } from '../../shared/utils/api-error';
import { uploadImage, resolveCoverUrl } from '../../shared/lib/cloudinary';
import sharp from 'sharp';
import type { PublisherListQuery, PublisherCreateInput, PublisherUpdateInput, PublisherMergeInput } from '@comicstrunk/contracts';

const PUBLISHERS_LOGO_PATH = 'publishers';

export const publishersService = {
  async list(query: PublisherListQuery, opts: { adminMode?: boolean } = {}) {
    const where: any = {};
    if (!opts.adminMode) where.approvalStatus = 'APPROVED';
    if (query.approvalStatus) where.approvalStatus = query.approvalStatus;
    if (query.country) where.country = query.country;
    if (query.search) where.name = { contains: query.search };
    if (query.withoutLogo) where.logoFileName = null;

    const [items, total] = await Promise.all([
      prisma.publisher.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ catalogEntries: { _count: 'desc' } }, { name: 'asc' }],
        include: { _count: { select: { catalogEntries: true } } },
      }),
      prisma.publisher.count({ where }),
    ]);

    return {
      items: items.map(toDto),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  },

  async getBySlug(slug: string) {
    const p = await prisma.publisher.findUnique({
      where: { slug },
      include: { _count: { select: { catalogEntries: true } } },
    });
    if (!p) throw new NotFoundError('Publisher nao encontrada');
    return toDto(p);
  },

  async getById(id: string) {
    const p = await prisma.publisher.findUnique({
      where: { id },
      include: { _count: { select: { catalogEntries: true } } },
    });
    if (!p) throw new NotFoundError('Publisher nao encontrada');
    return toDto(p);
  },

  async create(input: PublisherCreateInput) {
    const existing = await prisma.publisher.findFirst({
      where: { name: { equals: input.name } },
    });
    if (existing) {
      throw new ConflictError('Editora ja existe', {
        existingId: existing.id,
        existingName: existing.name,
      });
    }
    const slug = await generateUniqueSlug(input.name, 'publisher');
    const created = await prisma.publisher.create({
      data: {
        name: input.name,
        slug,
        country: input.country ?? null,
        description: input.description ?? null,
        approvalStatus: 'APPROVED',
      },
      include: { _count: { select: { catalogEntries: true } } },
    });
    return toDto(created);
  },

  async update(id: string, input: PublisherUpdateInput) {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.country !== undefined) data.country = input.country;
    if (input.description !== undefined) data.description = input.description;
    if (input.approvalStatus !== undefined) data.approvalStatus = input.approvalStatus;

    const updated = await prisma.publisher.update({
      where: { id },
      data,
      include: { _count: { select: { catalogEntries: true } } },
    });
    return toDto(updated);
  },

  async uploadLogo(id: string, fileBuffer: Buffer) {
    const publisher = await prisma.publisher.findUnique({ where: { id } });
    if (!publisher) throw new NotFoundError('Publisher nao encontrada');

    const compressed = await sharp(fileBuffer)
      .resize(200, 200, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png({ quality: 90 })
      .toBuffer();

    const logoFileName = `${PUBLISHERS_LOGO_PATH}/${publisher.slug}.png`;
    await uploadImage(compressed, logoFileName, 'image/png');
    const logoUrl = resolveCoverUrl(logoFileName);

    return await prisma.publisher.update({
      where: { id },
      data: { logoFileName, logoUrl },
      include: { _count: { select: { catalogEntries: true } } },
    }).then(toDto);
  },

  async deleteIfEmpty(id: string) {
    const publisher = await prisma.publisher.findUnique({
      where: { id },
      include: { _count: { select: { catalogEntries: true } } },
    });
    if (!publisher) throw new NotFoundError('Publisher nao encontrada');
    if (publisher._count.catalogEntries > 0) {
      throw new ConflictError(
        `Publisher tem ${publisher._count.catalogEntries} gibis associados. Transfira antes de deletar.`,
        { catalogEntriesCount: publisher._count.catalogEntries },
      );
    }
    await prisma.publisher.delete({ where: { id } });
  },

  async merge(input: PublisherMergeInput) {
    if (input.mergedIds.includes(input.canonicalId)) {
      throw new ConflictError('canonicalId nao pode estar em mergedIds');
    }
    return await prisma.$transaction(async (tx) => {
      // Move CatalogEntries
      await tx.catalogEntry.updateMany({
        where: { publisherId: { in: input.mergedIds } },
        data: { publisherId: input.canonicalId },
      });
      // Move Imprints
      await tx.imprint.updateMany({
        where: { publisherId: { in: input.mergedIds } },
        data: { publisherId: input.canonicalId },
      });
      // Delete merged
      await tx.publisher.deleteMany({
        where: { id: { in: input.mergedIds } },
      });

      const canonical = await tx.publisher.findUnique({
        where: { id: input.canonicalId },
        include: { _count: { select: { catalogEntries: true } } },
      });
      return canonical ? toDto(canonical) : null;
    });
  },
};

function toDto(p: any) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    country: p.country,
    logoUrl: p.logoUrl,
    description: p.description,
    approvalStatus: p.approvalStatus,
    catalogEntriesCount: p._count?.catalogEntries,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/publishers/publishers.service.ts
git commit -m "feat(publishers): service com list/get/create/update/uploadLogo/delete/merge"
```

## Task 1.4.1: Adicionar 'publisher' e 'imprint' ao slug helper

**Files:**
- Modify: `apps/api/src/shared/utils/slug.ts`

- [ ] **Step 1: Verificar tipos suportados**

Run: `grep -n "type SlugTarget\|catalogEntry\|series" apps/api/src/shared/utils/slug.ts`
Confirmar quais entidades já estão suportadas.

- [ ] **Step 2: Adicionar 'publisher' e 'imprint' aos targets**

No tipo `SlugTarget` ou similar, adicionar `'publisher' | 'imprint'`. Adicionar caso no switch que faz `prisma.publisher.findUnique({ where: { slug } })` / `prisma.imprint.findUnique`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/shared/utils/slug.ts
git commit -m "feat(slug): suporte a publisher e imprint"
```

## Task 1.5: Routes públicas + admin de publishers

**Files:**
- Create: `apps/api/src/modules/publishers/publishers.routes.ts`
- Create: `apps/api/src/modules/publishers/publishers.admin.routes.ts`

- [ ] **Step 1: Criar `publishers.routes.ts` (público)**

```ts
import { Router } from 'express';
import { publishersService } from './publishers.service';
import { validate } from '../../shared/middleware/validate';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { publisherListQuerySchema } from '@comicstrunk/contracts';
import { z } from 'zod';

const router = Router();

router.get(
  '/',
  validate({ query: publisherListQuerySchema }),
  async (req, res) => {
    const result = await publishersService.list(req.query as any);
    sendPaginated(res, result.items, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  },
);

router.get('/:slug', async (req, res) => {
  const publisher = await publishersService.getBySlug(req.params.slug);
  sendSuccess(res, publisher);
});

export default router;
```

- [ ] **Step 2: Criar `publishers.admin.routes.ts`**

```ts
import { Router } from 'express';
import multer from 'multer';
import { publishersService } from './publishers.service';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import {
  publisherCreateSchema,
  publisherUpdateSchema,
  publisherMergeSchema,
  publisherListQuerySchema,
} from '@comicstrunk/contracts';
import { BadRequestError } from '../../shared/utils/api-error';

const router = Router();
router.use(authenticate, authorize(['ADMIN']));

const upload = multer({ limits: { fileSize: 2 * 1024 * 1024 } });

router.get('/', validate({ query: publisherListQuerySchema }), async (req, res) => {
  const result = await publishersService.list(req.query as any, { adminMode: true });
  sendPaginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
  });
});

router.post('/', validate({ body: publisherCreateSchema }), async (req, res) => {
  const created = await publishersService.create(req.body);
  sendSuccess(res, created, 201);
});

router.get('/:id', async (req, res) => {
  const publisher = await publishersService.getById(req.params.id);
  sendSuccess(res, publisher);
});

router.patch('/:id', validate({ body: publisherUpdateSchema }), async (req, res) => {
  const updated = await publishersService.update(req.params.id, req.body);
  sendSuccess(res, updated);
});

router.post('/:id/logo', upload.single('logo'), async (req, res) => {
  if (!req.file) throw new BadRequestError('Arquivo nao enviado (campo "logo")');
  const updated = await publishersService.uploadLogo(req.params.id, req.file.buffer);
  sendSuccess(res, updated);
});

router.delete('/:id', async (req, res) => {
  await publishersService.deleteIfEmpty(req.params.id);
  sendSuccess(res, { deleted: true });
});

router.post('/merge', validate({ body: publisherMergeSchema }), async (req, res) => {
  const result = await publishersService.merge(req.body);
  sendSuccess(res, result);
});

export default router;
```

- [ ] **Step 3: Registrar em `create-app.ts`**

Adicionar em `apps/api/src/create-app.ts`, junto com os outros routes:

```ts
import publishersRouter from './modules/publishers/publishers.routes';
import publishersAdminRouter from './modules/publishers/publishers.admin.routes';
// ...
app.use('/api/v1/publishers', publishersRouter);
app.use('/api/v1/admin/publishers', publishersAdminRouter);
```

- [ ] **Step 4: Build + smoke test local**

Run: `corepack pnpm --filter api build && corepack pnpm --filter api dev`
Em outra aba: `curl -s http://localhost:3001/api/v1/publishers | head -c 200`
Expected: `{ "success": true, "data": [], "pagination": ... }` (lista vazia, sem dados ainda).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/publishers/publishers.routes.ts apps/api/src/modules/publishers/publishers.admin.routes.ts apps/api/src/create-app.ts
git commit -m "feat(publishers): routes publicas + admin (CRUD + merge + upload de logo)"
```

## Task 1.6: Service + Routes de imprints

**Files:**
- Create: `apps/api/src/modules/imprints/imprints.service.ts`
- Create: `apps/api/src/modules/imprints/imprints.routes.ts`
- Create: `apps/api/src/modules/imprints/imprints.admin.routes.ts`
- Modify: `apps/api/src/create-app.ts`

- [ ] **Step 1: Espelhar publishers.service.ts pra imprints**

Mesma estrutura de `publishersService` da Task 1.4. Diferenças:
- `list` aceita `publisherId` filter.
- `getById` inclui `publisher: { select: { id, name, slug } }` no resultado.
- `create` valida unique constraint `(name, publisherId)` em vez de `name` global.
- `merge` move só `catalog_entries.imprintId` (não tem cascata de filhos).
- `toDto` inclui `publisher` opcional.

Path do logo: `imprints/{slug}.png`.

- [ ] **Step 2: Espelhar `imprints.routes.ts` e `imprints.admin.routes.ts`**

Análogos aos da Task 1.5, trocando `publishersService` por `imprintsService` e schemas Zod.

- [ ] **Step 3: Registrar em `create-app.ts`**

```ts
app.use('/api/v1/imprints', imprintsRouter);
app.use('/api/v1/admin/imprints', imprintsAdminRouter);
```

- [ ] **Step 4: Build + smoke test**

Run: `corepack pnpm --filter api build && curl -s http://localhost:3001/api/v1/imprints`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/imprints apps/api/src/create-app.ts
git commit -m "feat(imprints): service + routes (CRUD + merge + upload de logo)"
```

## Task 1.7: Atualizar catalog.service pra incluir publisherRef/imprintRef

**Files:**
- Modify: `apps/api/src/modules/catalog/catalog.service.ts`

- [ ] **Step 1: Adicionar include nas queries de busca/listagem**

Em todas as queries `findMany` e `findUnique` de `CatalogEntry`, adicionar:

```ts
include: {
  // ... existing includes
  publisherRef: true,
  imprintRef: { include: { publisher: true } },
}
```

- [ ] **Step 2: Atualizar mappers pra usar resolvePublisher/resolveImprint**

Onde o service mapeia entry pra response, substituir leitura direta de `entry.publisher` / `entry.imprint` por:

```ts
import { resolvePublisher, resolveImprint } from '../../shared/utils/publisher';

const mapped = {
  // ... existing fields
  publisher: resolvePublisher(entry)?.name ?? null,
  imprint: resolveImprint(entry)?.name ?? null,
  publisherDetails: resolvePublisher(entry),
  imprintDetails: resolveImprint(entry),
};
```

`publisher` e `imprint` (campos planos) ficam como string pra retrocompatibilidade. `publisherDetails` é o objeto rico novo.

- [ ] **Step 3: Smoke test**

Run: `curl -s "http://localhost:3001/api/v1/catalog?limit=1" -H "User-Agent: Mozilla/5.0" | python -m json.tool`
Expected: response inclui `publisherDetails` (com `name`, `country`, `logoUrl` ou null).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/catalog/catalog.service.ts
git commit -m "feat(catalog): inclui publisherRef/imprintRef no response (publisherDetails objeto rico)"
```

## Task 1.8: Seed JSON dos publishers e imprints

**Files:**
- Create: `apps/api/prisma/seeds/publishers.json`
- Create: `apps/api/prisma/seeds/imprints.json`

- [ ] **Step 1: Criar `publishers.json`**

```json
[
  { "name": "Marvel Comics", "country": "US" },
  { "name": "DC Comics", "country": "US" },
  { "name": "Image Comics", "country": "US" },
  { "name": "Dark Horse Comics", "country": "US" },
  { "name": "IDW Publishing", "country": "US" },
  { "name": "Dynamite Entertainment", "country": "US" },
  { "name": "BOOM! Studios", "country": "US" },
  { "name": "Oni Press", "country": "US" },
  { "name": "Archie Comics", "country": "US" },
  { "name": "Fantagraphics", "country": "US" },
  { "name": "Aftershock", "country": "US" },
  { "name": "Valiant", "country": "US" },
  { "name": "Boom Box", "country": "US" },
  { "name": "Panini", "country": "BR" },
  { "name": "Abril", "country": "BR" },
  { "name": "Ebal", "country": "BR" },
  { "name": "RGE", "country": "BR" },
  { "name": "Mythos", "country": "BR" },
  { "name": "JBC", "country": "BR" },
  { "name": "Vecchi", "country": "BR" },
  { "name": "Globo", "country": "BR" },
  { "name": "O Globo", "country": "BR" },
  { "name": "Conrad", "country": "BR" },
  { "name": "La Selva", "country": "BR" },
  { "name": "Devir", "country": "BR" },
  { "name": "Mino", "country": "BR" },
  { "name": "Pipoca & Nanquim", "country": "BR" },
  { "name": "Escala", "country": "BR" },
  { "name": "Record", "country": "BR" },
  { "name": "Shueisha", "country": "JP" },
  { "name": "Shogakukan", "country": "JP" },
  { "name": "Kodansha", "country": "JP" },
  { "name": "VIZ Media", "country": "JP" },
  { "name": "Yen Press", "country": "JP" },
  { "name": "Seven Seas Entertainment", "country": "JP" },
  { "name": "Bonelli Editore", "country": "IT" },
  { "name": "Glénat", "country": "FR" },
  { "name": "Casterman", "country": "FR" },
  { "name": "Dupuis", "country": "FR" },
  { "name": "Titan Comics", "country": "UK" },
  { "name": "Rebellion", "country": "UK" }
]
```

- [ ] **Step 2: Criar `imprints.json`**

```json
[
  { "name": "Vertigo", "publisherName": "DC Comics" },
  { "name": "Black Label", "publisherName": "DC Comics" },
  { "name": "Wildstorm", "publisherName": "DC Comics" },
  { "name": "DC Zoom", "publisherName": "DC Comics" },
  { "name": "Marvel Knights", "publisherName": "Marvel Comics" },
  { "name": "MAX", "publisherName": "Marvel Comics" },
  { "name": "Ultimate", "publisherName": "Marvel Comics" },
  { "name": "Icon", "publisherName": "Marvel Comics" },
  { "name": "Marvel 2099", "publisherName": "Marvel Comics" },
  { "name": "Top Cow", "publisherName": "Image Comics" },
  { "name": "Skybound", "publisherName": "Image Comics" },
  { "name": "Shadowline", "publisherName": "Image Comics" },
  { "name": "Image Forge", "publisherName": "Image Comics" },
  { "name": "Berger Books", "publisherName": "Dark Horse Comics" },
  { "name": "IDW Black Crown", "publisherName": "IDW Publishing" }
]
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/seeds
git commit -m "feat(publishers): seed JSON de top 41 publishers + 15 imprints conhecidos"
```

## Task 1.9: Script seed-publishers.ts

**Files:**
- Create: `apps/api/scripts/seed-publishers.ts`

- [ ] **Step 1: Criar script idempotente que upserta publishers e imprints do JSON**

```ts
import { prisma } from '../src/shared/lib/prisma';
import { generateUniqueSlug } from '../src/shared/utils/slug';
import publishersJson from '../prisma/seeds/publishers.json';
import imprintsJson from '../prisma/seeds/imprints.json';

async function main() {
  console.log(`[seed-publishers] Upserting ${publishersJson.length} publishers...`);

  const publisherMap = new Map<string, string>();

  for (const pub of publishersJson) {
    const existing = await prisma.publisher.findFirst({
      where: { name: { equals: pub.name } },
    });

    if (existing) {
      publisherMap.set(pub.name, existing.id);
      // Update country if missing
      if (!existing.country && pub.country) {
        await prisma.publisher.update({
          where: { id: existing.id },
          data: { country: pub.country },
        });
        console.log(`  [updated country] ${pub.name} → ${pub.country}`);
      }
      continue;
    }

    const slug = await generateUniqueSlug(pub.name, 'publisher');
    const created = await prisma.publisher.create({
      data: {
        name: pub.name,
        slug,
        country: pub.country,
        approvalStatus: 'APPROVED',
      },
    });
    publisherMap.set(pub.name, created.id);
    console.log(`  [created] ${pub.name} (${slug})`);
  }

  console.log(`[seed-publishers] Upserting ${imprintsJson.length} imprints...`);

  for (const imp of imprintsJson) {
    const publisherId = publisherMap.get(imp.publisherName) ?? null;
    if (!publisherId) {
      console.warn(`  [skip] ${imp.name} — publisher "${imp.publisherName}" not found`);
      continue;
    }

    const existing = await prisma.imprint.findFirst({
      where: { name: imp.name, publisherId },
    });

    if (existing) {
      console.log(`  [exists] ${imp.name} → ${imp.publisherName}`);
      continue;
    }

    const slug = await generateUniqueSlug(imp.name, 'imprint');
    await prisma.imprint.create({
      data: {
        name: imp.name,
        slug,
        publisherId,
        approvalStatus: 'APPROVED',
      },
    });
    console.log(`  [created] ${imp.name} → ${imp.publisherName}`);
  }

  console.log('[seed-publishers] Done.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

- [ ] **Step 2: Adicionar script ao package.json**

Em `apps/api/package.json` adicionar em `scripts`:

```json
"seed:publishers": "tsx scripts/seed-publishers.ts"
```

- [ ] **Step 3: Rodar local pra testar**

Run: `corepack pnpm --filter api seed:publishers`
Expected: log de criação de 41 publishers + 15 imprints. `SELECT COUNT(*) FROM publishers` retorna 41.

- [ ] **Step 4: Commit**

```bash
git add apps/api/scripts/seed-publishers.ts apps/api/package.json
git commit -m "feat(publishers): script seed:publishers (idempotente)"
```

## Task 1.10: Script match-publishers-legacy

**Files:**
- Create: `apps/api/scripts/match-publishers-legacy.ts`

- [ ] **Step 1: Criar script de match**

```ts
import { prisma } from '../src/shared/lib/prisma';

const TRASH_VALUES = new Set([
  'n/a', 'na', 'do autor', '-', '_', '?', 'desconhecido', 'desconhecida',
  '', ' ', 'sem editora', 'autor', 'autopublicado', 'self-published',
]);

const SUFFIX_RE = /\s+(comics|inc\.?|ltd\.?|publishing|editora|publications|comix)\s*$/gi;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(SUFFIX_RE, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('[match-publishers-legacy] Loading publishers...');
  const publishers = await prisma.publisher.findMany({
    where: { approvalStatus: 'APPROVED' },
  });

  const normalizedMap = new Map<string, string>();
  for (const p of publishers) {
    normalizedMap.set(normalize(p.name), p.id);
  }

  console.log(`[match-publishers-legacy] ${publishers.length} publishers indexed.`);

  const distinctValues = await prisma.$queryRaw<{ publisher: string }[]>`
    SELECT DISTINCT publisher FROM catalog_entries WHERE publisher IS NOT NULL AND publisher != '' AND publisher_id IS NULL
  `;

  console.log(`[match-publishers-legacy] ${distinctValues.length} valores legados distintos`);

  let matched = 0;
  let trashed = 0;
  let unmatched = 0;

  for (const { publisher } of distinctValues) {
    const norm = normalize(publisher);

    if (TRASH_VALUES.has(norm)) {
      const result = await prisma.catalogEntry.updateMany({
        where: { publisher },
        data: { publisher: null },
      });
      console.log(`  [trashed] "${publisher}" → null (${result.count} entries)`);
      trashed += result.count;
      continue;
    }

    const publisherId = normalizedMap.get(norm);
    if (publisherId) {
      const result = await prisma.catalogEntry.updateMany({
        where: { publisher },
        data: { publisherId, publisher: null },
      });
      console.log(`  [matched] "${publisher}" → ${publisherId} (${result.count} entries)`);
      matched += result.count;
    } else {
      unmatched++;
    }
  }

  console.log('\n[match-publishers-legacy] Done.');
  console.log(`  Matched: ${matched} entries (across ${distinctValues.length - unmatched - trashed} distinct values)`);
  console.log(`  Trashed (set to null): ${trashed}`);
  console.log(`  Unmatched: ${unmatched} distinct values (kept as string fallback)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

- [ ] **Step 2: Adicionar script ao package.json**

```json
"match:publishers": "tsx scripts/match-publishers-legacy.ts"
```

- [ ] **Step 3: Rodar local (dry-run mental — não há ainda dados em local provavelmente)**

Run: `corepack pnpm --filter api match:publishers`
Local pode ter pouco dado. Em produção rodaremos depois.

- [ ] **Step 4: Commit**

```bash
git add apps/api/scripts/match-publishers-legacy.ts apps/api/package.json
git commit -m "feat(publishers): script match-publishers-legacy (mapeia campo string pra FK)"
```

## Task 1.11: Script scrape-publisher-logos

**Files:**
- Create: `apps/api/scripts/scrape-publisher-logos.ts`

- [ ] **Step 1: Criar script Wikipedia/Wikidata**

```ts
import { prisma } from '../src/shared/lib/prisma';
import { uploadImage, resolveCoverUrl } from '../src/shared/lib/cloudinary';
import sharp from 'sharp';

const SLEEP_MS = 500;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface WikiImage {
  source: string;
  width: number;
  height: number;
}

async function fetchWikipediaImage(name: string, lang: 'en' | 'pt'): Promise<string | null> {
  try {
    const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
    url.searchParams.set('action', 'query');
    url.searchParams.set('titles', name);
    url.searchParams.set('prop', 'pageimages');
    url.searchParams.set('piprop', 'original');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const res = await fetch(url, {
      headers: { 'User-Agent': 'ComicsTrunk/1.0 (logos scraper)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const pages = data.query?.pages ?? {};
    const page: any = Object.values(pages)[0];
    const image: WikiImage | undefined = page?.original;
    return image?.source ?? null;
  } catch {
    return null;
  }
}

async function fetchWikidataLogo(name: string): Promise<string | null> {
  try {
    const searchUrl = new URL('https://www.wikidata.org/w/api.php');
    searchUrl.searchParams.set('action', 'wbsearchentities');
    searchUrl.searchParams.set('search', name);
    searchUrl.searchParams.set('language', 'en');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('origin', '*');

    const sRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'ComicsTrunk/1.0 (logos scraper)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!sRes.ok) return null;
    const sData: any = await sRes.json();
    const entityId = sData.search?.[0]?.id;
    if (!entityId) return null;

    const entityUrl = new URL('https://www.wikidata.org/w/api.php');
    entityUrl.searchParams.set('action', 'wbgetentities');
    entityUrl.searchParams.set('ids', entityId);
    entityUrl.searchParams.set('props', 'claims');
    entityUrl.searchParams.set('format', 'json');
    entityUrl.searchParams.set('origin', '*');

    const eRes = await fetch(entityUrl, {
      headers: { 'User-Agent': 'ComicsTrunk/1.0 (logos scraper)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!eRes.ok) return null;
    const eData: any = await eRes.json();
    const claim = eData.entities?.[entityId]?.claims?.P154?.[0];
    const filename = claim?.mainsnak?.datavalue?.value;
    if (!filename) return null;

    // Wikidata image filename → commons URL
    const md5 = require('crypto').createHash('md5').update(filename.replace(/ /g, '_')).digest('hex');
    return `https://upload.wikimedia.org/wikipedia/commons/${md5[0]}/${md5[0]}${md5[1]}/${encodeURIComponent(filename.replace(/ /g, '_'))}`;
  } catch {
    return null;
  }
}

async function downloadAndUpload(imageUrl: string, slug: string, target: 'publishers' | 'imprints') {
  const res = await fetch(imageUrl, {
    headers: { 'User-Agent': 'ComicsTrunk/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const compressed = await sharp(buf)
    .resize(200, 200, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png({ quality: 90 })
    .toBuffer();

  const fileName = `${target}/${slug}.png`;
  await uploadImage(compressed, fileName, 'image/png');
  return { logoFileName: fileName, logoUrl: resolveCoverUrl(fileName) };
}

async function main() {
  const target = process.argv.includes('--target=imprints') ? 'imprints' : 'publishers';
  const force = process.argv.includes('--force');

  const where: any = force ? {} : { logoFileName: null };
  const items = target === 'publishers'
    ? await prisma.publisher.findMany({ where })
    : await prisma.imprint.findMany({ where });

  console.log(`[scrape-logos] ${items.length} ${target} sem logo`);

  let ok = 0, fail = 0;
  for (const item of items) {
    console.log(`  [${target}] ${item.name}...`);
    let imageUrl =
      (await fetchWikipediaImage(item.name, 'en')) ??
      (await fetchWikipediaImage(item.name, 'pt')) ??
      (await fetchWikidataLogo(item.name));

    if (!imageUrl) {
      console.log(`    no image`);
      fail++;
      await sleep(SLEEP_MS);
      continue;
    }

    try {
      const { logoFileName, logoUrl } = await downloadAndUpload(imageUrl, item.slug, target);
      if (target === 'publishers') {
        await prisma.publisher.update({
          where: { id: item.id },
          data: { logoFileName, logoUrl },
        });
      } else {
        await prisma.imprint.update({
          where: { id: item.id },
          data: { logoFileName, logoUrl },
        });
      }
      console.log(`    ok → ${logoUrl}`);
      ok++;
    } catch (e) {
      console.log(`    fail: ${(e as Error).message}`);
      fail++;
    }

    await sleep(SLEEP_MS);
  }

  console.log(`\n[scrape-logos] ok=${ok} fail=${fail}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

- [ ] **Step 2: Adicionar ao package.json**

```json
"scrape:logos": "tsx scripts/scrape-publisher-logos.ts"
```

- [ ] **Step 3: Rodar local pra publishers**

Run: `corepack pnpm --filter api scrape:logos`
Expected: ~30 dos 41 publishers ganham logo. Log mostra ok/fail.

- [ ] **Step 4: Rodar local pra imprints**

Run: `corepack pnpm --filter api scrape:logos -- --target=imprints`

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/scrape-publisher-logos.ts apps/api/package.json
git commit -m "feat(publishers): script scrape-logos (Wikipedia + Wikidata, sharp 200x200, R2)"
```

## Task 1.12: Deploy Fase 1 — produção

- [ ] **Step 1: Build contracts + API local**

Run: `corepack pnpm --filter contracts build && corepack pnpm --filter api build`

- [ ] **Step 2: Tar + scp dist API + contracts pra prod**

```bash
tar czf - -C apps/api/dist . | ssh ferna5257@server34.integrator.com.br "tar xzf - -C /home/ferna5257/applications/api.comicstrunk.com/dist/"
tar czf - -C packages/contracts/dist . | ssh ferna5257@server34.integrator.com.br "tar xzf - -C /home/ferna5257/applications/api.comicstrunk.com/node_modules/@comicstrunk/contracts/dist/"
tar czf - -C apps/api/prisma . | ssh ferna5257@server34.integrator.com.br "tar xzf - -C /home/ferna5257/applications/api.comicstrunk.com/prisma/"
tar czf - -C apps/api/scripts . | ssh ferna5257@server34.integrator.com.br "tar xzf - -C /home/ferna5257/applications/api.comicstrunk.com/scripts/"
```

- [ ] **Step 3: Aplicar migration em produção**

```bash
ssh ferna5257@server34.integrator.com.br "export PATH=/usr/nodejs/node-v20.1.0/bin:\$PATH && export DATABASE_URL='mysql://ferna5257_comics:ComicsComics@123@localhost:3306/ferna5257_comicstrunk_db' && cd /home/ferna5257/applications/api.comicstrunk.com && /usr/nodejs/node-v20.1.0/bin/node ./node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js migrate deploy"
```

Expected: `Applying migration <ts>_add_publishers_imprints` → success.

- [ ] **Step 4: Restart API**

```bash
ssh ferna5257@server34.integrator.com.br "cd /home/ferna5257/applications/api.comicstrunk.com && /home/ferna5257/bin/pm2 restart api.comicstrunk.com"
```

- [ ] **Step 5: Smoke test**

```bash
curl -s "https://api.comicstrunk.com/api/v1/publishers" -H "User-Agent: Mozilla/5.0" | head -c 200
```

Expected: `{"success":true,"data":[],"pagination":{"page":1,"limit":20,"total":0,...}}`.

- [ ] **Step 6: Rodar seed em prod**

```bash
ssh ferna5257@server34.integrator.com.br "export PATH=/usr/nodejs/node-v20.1.0/bin:\$PATH && export DATABASE_URL='mysql://ferna5257_comics:ComicsComics@123@localhost:3306/ferna5257_comicstrunk_db' && export R2_ACCESS_KEY_ID=... && cd /home/ferna5257/applications/api.comicstrunk.com && /usr/nodejs/node-v20.1.0/bin/node ./node_modules/.pnpm/tsx/dist/cli.mjs scripts/seed-publishers.ts"
```

(env vars completas pegar de start-prod-api.json)

Expected: `[seed-publishers] Done.` com 41 publishers + 15 imprints.

- [ ] **Step 7: Rodar match-publishers-legacy em prod**

Mesmo formato com `scripts/match-publishers-legacy.ts`. Expected: log de matched/trashed/unmatched. Os top 30 publishers do banco (Panini, Marvel Comics, Abril, etc.) devem mapear todos.

- [ ] **Step 8: Rodar scrape-logos em prod**

Mesmo formato. Pode demorar ~5min (publishers + imprints, 500ms entre).

- [ ] **Step 9: Verificar prod**

```bash
curl -s "https://api.comicstrunk.com/api/v1/publishers?limit=5" -H "User-Agent: Mozilla/5.0" | python -m json.tool
```

Expected: 5 publishers com logoUrl preenchido.

- [ ] **Step 10: Push branch + merge develop + merge main**

```bash
git push -u origin feat/publisher-imprint-component
git checkout develop && git pull && git merge --no-ff feat/publisher-imprint-component && git push origin develop
git checkout main && git pull && git merge --no-ff develop -X theirs && git push origin main
git checkout feat/publisher-imprint-component
```

---

# PHASE 2 — Frontend: componentes seletores no admin form

**Goal:** Admin form de catalog/edit e catalog/new usa os novos componentes.

**Done state:**
- Selecionar publisher do dropdown salva `publisherId` no gibi.
- "Outro" inline cria publisher novo.
- ImprintCombobox aparece após Publisher selecionado.

## Task 2.1: Service `publishers.ts` no frontend

**Files:**
- Create: `apps/web/src/lib/services/publishers.ts`

- [ ] **Step 1: Criar service**

```ts
import { apiClient } from '@/lib/api-client';
import type { PublisherDto, PublisherCreateInput, PublisherUpdateInput, PublisherMergeInput } from '@comicstrunk/contracts';

export const publishersService = {
  async list(params: { search?: string; page?: number; limit?: number; admin?: boolean } = {}) {
    const { admin, ...query } = params;
    const path = admin ? '/admin/publishers' : '/publishers';
    const { data } = await apiClient.get(path, { params: query });
    return data;
  },

  async get(idOrSlug: string, opts: { admin?: boolean } = {}) {
    const path = opts.admin ? `/admin/publishers/${idOrSlug}` : `/publishers/${idOrSlug}`;
    const { data } = await apiClient.get(path);
    return data.data as PublisherDto;
  },

  async create(input: PublisherCreateInput) {
    const { data } = await apiClient.post('/admin/publishers', input);
    return data.data as PublisherDto;
  },

  async update(id: string, input: PublisherUpdateInput) {
    const { data } = await apiClient.patch(`/admin/publishers/${id}`, input);
    return data.data as PublisherDto;
  },

  async uploadLogo(id: string, file: File) {
    const formData = new FormData();
    formData.append('logo', file);
    const { data } = await apiClient.post(`/admin/publishers/${id}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data as PublisherDto;
  },

  async delete(id: string) {
    await apiClient.delete(`/admin/publishers/${id}`);
  },

  async merge(input: PublisherMergeInput) {
    const { data } = await apiClient.post('/admin/publishers/merge', input);
    return data.data as PublisherDto;
  },
};
```

- [ ] **Step 2: Espelhar pra `imprints.ts`**

Mesma estrutura, trocando `publishers` por `imprints` e tipos.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/services
git commit -m "feat(web): services publishers e imprints"
```

## Task 2.2: PublisherCombobox

**Files:**
- Create: `apps/web/src/components/features/admin/publisher-combobox.tsx`

- [ ] **Step 1: Criar componente baseado em Combobox shadcn (ou no padrão de CharacterMultiSelect)**

Estrutura:
- Props: `value: string | null` (publisherId), `onChange: (id: string | null, publisher: PublisherDto | null) => void`
- Estado interno: `searchTerm`, `results`, `loading`, `creatingNew`, `newName`
- Debounce 300ms na busca
- Item especial no fim: `+ Outro — criar nova editora`
- Click "Outro" → vira input inline com botão Criar
- Submit cria via `publishersService.create({ name })`. Se 409, sugere o existente.

Arquivo (~150 linhas):

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { publishersService } from '@/lib/services/publishers';
import type { PublisherDto } from '@comicstrunk/contracts';

interface Props {
  value: string | null;
  onChange: (id: string | null, publisher: PublisherDto | null) => void;
  placeholder?: string;
}

export function PublisherCombobox({ value, onChange, placeholder = 'Selecionar editora…' }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PublisherDto[]>([]);
  const [selected, setSelected] = useState<PublisherDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega o publisher atual quando value muda externamente
  useEffect(() => {
    if (value && (!selected || selected.id !== value)) {
      publishersService.get(value, { admin: true }).then(setSelected).catch(() => null);
    }
    if (!value) setSelected(null);
  }, [value]);

  // Busca debounced
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await publishersService.list({ search, limit: 20, admin: true });
        setResults(res.data ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, open]);

  const handleSelect = (p: PublisherDto) => {
    setSelected(p);
    onChange(p.id, p);
    setOpen(false);
    setSearch('');
    setCreating(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setError(null);
    try {
      const created = await publishersService.create({ name: newName.trim() });
      handleSelect(created);
      setNewName('');
    } catch (e: any) {
      const details = e?.response?.data?.error?.details;
      if (details?.existingId) {
        setError(`"${details.existingName}" ja existe — selecionando…`);
        const existing = await publishersService.get(details.existingId, { admin: true });
        handleSelect(existing);
      } else {
        setError(e?.response?.data?.error?.message ?? 'Erro ao criar editora');
      }
    }
  };

  const clear = () => {
    setSelected(null);
    onChange(null, null);
  };

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between">
            {selected ? (
              <div className="flex items-center gap-2">
                {selected.logoUrl && (
                  <img src={selected.logoUrl} alt="" className="h-5 w-5 rounded object-contain" />
                )}
                <span>{selected.name}</span>
                {selected.country && (
                  <span className="text-xs text-muted-foreground">[{selected.country}]</span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar editora…" value={search} onValueChange={setSearch} />
            <CommandList>
              {loading && <CommandEmpty>Buscando…</CommandEmpty>}
              {!loading && results.length === 0 && !creating && (
                <CommandEmpty>Nenhuma editora encontrada.</CommandEmpty>
              )}
              {results.map((p) => (
                <CommandItem key={p.id} value={p.id} onSelect={() => handleSelect(p)}>
                  <Check className={cn('mr-2 h-4 w-4', value === p.id ? 'opacity-100' : 'opacity-0')} />
                  {p.logoUrl && (
                    <img src={p.logoUrl} alt="" className="mr-2 h-5 w-5 rounded object-contain" />
                  )}
                  <span>{p.name}</span>
                  {p.country && (
                    <span className="ml-auto text-xs text-muted-foreground">{p.country}</span>
                  )}
                </CommandItem>
              ))}
              {!creating ? (
                <CommandItem
                  className="border-t mt-1 pt-2 text-blue-600"
                  onSelect={() => setCreating(true)}
                  value="__new__"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Outro — criar nova editora
                </CommandItem>
              ) : (
                <div className="border-t mt-1 p-2 space-y-2">
                  <Input
                    placeholder="Digite o nome da nova editora…"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreate();
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
                      Criar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                      Cancelar
                    </Button>
                  </div>
                  {error && <p className="text-sm text-amber-600">{error}</p>}
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && (
        <Button size="sm" variant="ghost" onClick={clear} className="text-xs h-6">
          <X className="h-3 w-3 mr-1" /> Limpar
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Smoke test no Storybook ou em uma página de teste**

Run: `corepack pnpm --filter web dev`
Renderizar componente solto numa página, conferir que abre, busca, lista, "Outro" funciona.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/features/admin/publisher-combobox.tsx
git commit -m "feat(web): PublisherCombobox com Outro inline"
```

## Task 2.3: ImprintCombobox

**Files:**
- Create: `apps/web/src/components/features/admin/imprint-combobox.tsx`

- [ ] **Step 1: Espelhar PublisherCombobox**

Mesma estrutura. Difs:
- Props extras: `publisherId: string | null` (filtra resultados).
- Quando `publisherId` muda, limpa selection (`onChange(null, null)`).
- `imprintsService.list({ publisherId, search })` no backend.
- "Outro" cria com `{ name, publisherId }`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/features/admin/imprint-combobox.tsx
git commit -m "feat(web): ImprintCombobox (filtra por publisherId)"
```

## Task 2.4: Integrar no catalog-form

**Files:**
- Modify: `apps/web/src/components/features/catalog/catalog-form.tsx`

- [ ] **Step 1: Substituir os Inputs de publisher e imprint pelos comboboxes**

Localizar os campos `publisher` e `imprint` (Input) no form e trocar por:

```tsx
<FormField
  control={form.control}
  name="publisherId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Editora</FormLabel>
      <PublisherCombobox
        value={field.value ?? null}
        onChange={(id) => {
          field.onChange(id);
          // limpa imprint quando publisher muda
          form.setValue('imprintId', null);
        }}
      />
      <FormMessage />
    </FormItem>
  )}
/>

<FormField
  control={form.control}
  name="imprintId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Selo</FormLabel>
      <ImprintCombobox
        publisherId={form.watch('publisherId') ?? null}
        value={field.value ?? null}
        onChange={(id) => field.onChange(id)}
      />
      <FormMessage />
    </FormItem>
  )}
/>
```

- [ ] **Step 2: Adicionar `publisherId` e `imprintId` ao schema do form (Zod) se ainda não estiverem**

- [ ] **Step 3: Garantir que os defaults vêm corretamente quando edita gibi existente**

Se o gibi tem `publisherDetails.id`, popular `defaultValues.publisherId`.

- [ ] **Step 4: Smoke test local**

Run: `corepack pnpm --filter web dev`
Acessar `/pt-BR/admin/catalog/c` (criar) e `/pt-BR/admin/catalog/<id>` (editar).
- Selecionar Marvel Comics no Publisher.
- Verificar que Imprint mostra Vertigo, Black Label, etc. (espera publisherId=DC?).
- Salvar e verificar no banco que `publisher_id` foi setado.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/features/catalog/catalog-form.tsx
git commit -m "feat(web): catalog-form usa PublisherCombobox e ImprintCombobox"
```

## Task 2.5: Atualizar admin route do catalog pra aceitar publisherId/imprintId

**Files:**
- Modify: `apps/api/src/modules/admin/admin.routes.ts` ou onde update de catalog vive

- [ ] **Step 1: Adicionar publisherId e imprintId no schema de update do catalog**

Se a rota usa um `catalogUpdateSchema` Zod, adicionar:

```ts
publisherId: z.string().cuid().nullable().optional(),
imprintId: z.string().cuid().nullable().optional(),
```

- [ ] **Step 2: No service de update, propagar pro Prisma**

```ts
data: {
  // ... existing
  publisherId: body.publisherId,
  imprintId: body.imprintId,
}
```

- [ ] **Step 3: Build + smoke test em produção** (depois do deploy)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules
git commit -m "feat(catalog): admin update aceita publisherId e imprintId"
```

## Task 2.6: Deploy Fase 2 — produção

- [ ] **Step 1: Build web local + fix-windows-paths**

```bash
CI=true NEXT_PUBLIC_API_URL=https://api.comicstrunk.com/api/v1 corepack pnpm --filter web build
node scripts/fix-standalone.js
node scripts/fix-windows-paths.js
```

- [ ] **Step 2: Substituir server.js + tar + scp**

(seguir docs/DEPLOYMENT.md seção Web)

- [ ] **Step 3: Restart PM2 web**

```bash
ssh ferna5257@server34.integrator.com.br "cd /home/ferna5257/applications/comicstrunk.com && /home/ferna5257/bin/pm2 restart comicstrunk.com"
```

- [ ] **Step 4: Build + deploy API (mudou catalog admin route)**

(seguir Task 1.12 steps 1-4)

- [ ] **Step 5: Purgar cache Cloudflare**

(via dashboard ou API)

- [ ] **Step 6: Smoke test em prod**

Acessar `/pt-BR/admin/catalog/c`, criar gibi com publisher Marvel + imprint Vertigo, salvar, verificar.

- [ ] **Step 7: Push develop + main**

```bash
git push origin feat/publisher-imprint-component
git checkout develop && git pull && git merge --no-ff feat/publisher-imprint-component && git push origin develop
git checkout main && git pull && git merge --no-ff develop -X theirs && git push origin main
git checkout feat/publisher-imprint-component
```

---

# PHASE 3 — CRUD admin (`/admin/publishers` + `/admin/imprints`)

**Goal:** Admin gerencia editoras e selos via UI: lista, edita, sobe logo, deleta, mergir duplicatas.

## Task 3.1: Página `/admin/publishers` (listagem)

**Files:**
- Create: `apps/web/src/app/[locale]/(admin)/admin/publishers/page.tsx`
- Create: `apps/web/src/components/features/admin/publisher-list.tsx`

- [ ] **Step 1: page.tsx — Server Component que renderiza o componente client**

```tsx
import { PublisherList } from '@/components/features/admin/publisher-list';

export default function PublishersPage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Editoras</h1>
      <PublisherList />
    </div>
  );
}
```

- [ ] **Step 2: PublisherList — client component com tabela, filtros, paginação, multi-select pra merge**

(detalhes: tabela shadcn, busca debounced, paginação, checkbox por linha pra ações em massa, botão "Mergir selecionados" → abre modal)

Detalhes UI:
- Colunas: checkbox, logo, nome (link pra edit), país (badge), count, status, ações (edit, delete)
- Filtros no topo: search input, country select, "sem logo" toggle
- Paginação (Prev/Next + indicador página/total)
- Ações em massa: aprovar selecionados, mergir selecionados (≥2)

- [ ] **Step 3: Smoke test**

Acessar `/pt-BR/admin/publishers`, ver lista paginada com 41 publishers, filtrar por BR.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/[locale]/(admin)/admin/publishers/page.tsx apps/web/src/components/features/admin/publisher-list.tsx
git commit -m "feat(web): pagina /admin/publishers (lista + filtros + paginacao)"
```

## Task 3.2: Página `/admin/publishers/[id]` (edit)

**Files:**
- Create: `apps/web/src/app/[locale]/(admin)/admin/publishers/[id]/page.tsx`
- Create: `apps/web/src/components/features/admin/publisher-edit-form.tsx`

- [ ] **Step 1: Form de edição com upload de logo + delete + transferência**

Campos: name, slug (com aviso), country dropdown, description textarea, logo (upload manual via input file → POST `/admin/publishers/:id/logo`).

Botão "Deletar": se count > 0, mostra "Transferir gibis pra outra" (opens modal pra escolher destino).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/[locale]/(admin)/admin/publishers/[id]/page.tsx apps/web/src/components/features/admin/publisher-edit-form.tsx
git commit -m "feat(web): pagina /admin/publishers/[id] (edit + upload logo + delete)"
```

## Task 3.3: Modal de merge

**Files:**
- Create: `apps/web/src/components/features/admin/publisher-merge-modal.tsx`
- Modify: `apps/web/src/components/features/admin/publisher-list.tsx`

- [ ] **Step 1: Modal que recebe lista de publishers selecionados, pede o canônico (radio), confirmação dupla, executa merge via service**

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/features/admin/publisher-merge-modal.tsx apps/web/src/components/features/admin/publisher-list.tsx
git commit -m "feat(web): modal de merge de publishers (transacao + confirmacao dupla)"
```

## Task 3.4: Páginas de imprints (espelho)

**Files:**
- Create: `apps/web/src/app/[locale]/(admin)/admin/imprints/page.tsx`
- Create: `apps/web/src/app/[locale]/(admin)/admin/imprints/[id]/page.tsx`
- Create: `apps/web/src/components/features/admin/imprint-list.tsx`
- Create: `apps/web/src/components/features/admin/imprint-edit-form.tsx`

- [ ] **Step 1: Espelhar Tasks 3.1–3.3 pra imprints**

Coluna extra: editora-pai (mostra nome ou "—"). Edit permite trocar editora-pai (PublisherCombobox embutido).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/[locale]/(admin)/admin/imprints apps/web/src/components/features/admin/imprint-list.tsx apps/web/src/components/features/admin/imprint-edit-form.tsx
git commit -m "feat(web): paginas /admin/imprints (lista + edit + merge)"
```

## Task 3.5: Deploy Fase 3

(análogo à Task 2.6 — só web, build + scp + restart + push develop+main)

---

# PHASE 4 — Limpeza (nav + i18n + docs)

## Task 4.1: Atualizar nav admin

**Files:**
- Modify: `apps/web/src/components/layout/nav-config.ts`

- [ ] **Step 1: Adicionar links "Editoras" e "Selos" em admin sidebar/menu**

Localizar o array do admin nav e adicionar:

```ts
{ label: 'admin.publishers', href: '/admin/publishers', icon: Building2 },
{ label: 'admin.imprints', href: '/admin/imprints', icon: BookmarkCheck },
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/nav-config.ts
git commit -m "feat(nav): links pra admin/publishers e admin/imprints"
```

## Task 4.2: Tradução pt-BR

**Files:**
- Modify: `apps/web/src/messages/pt-BR.json`

- [ ] **Step 1: Adicionar chaves `admin.publishers.*` e `admin.imprints.*`**

Manter ASCII nas chaves; valores com acento.

```json
{
  "admin": {
    "publishers": {
      "title": "Editoras",
      "newPublisher": "Nova editora",
      "name": "Nome",
      "country": "País",
      "logo": "Logo",
      "noLogo": "Sem logo",
      "description": "Descrição",
      "deleteConfirm": "Confirmar exclusão",
      "deleteBlocked": "Não é possível excluir: editora tem {count} gibis associados.",
      "merge": {
        "title": "Mergir editoras",
        "warning": "Esta ação é irreversível. {entries} gibis e {imprints} selos serão movidos para a editora canônica.",
        "selectCanonical": "Selecione a editora canônica",
        "confirm": "Confirmar merge"
      },
      "outro": "Outro — criar nova editora"
    },
    "imprints": {
      "title": "Selos",
      "newImprint": "Novo selo",
      "publisher": "Editora",
      "orphan": "Sem editora",
      "outro": "Outro — criar novo selo"
    }
  }
}
```

- [ ] **Step 2: Atualizar componentes pra usar `useTranslations`**

(refatoração mínima; aceitar strings hardcoded em PT é ok porque é admin only)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/messages/pt-BR.json
git commit -m "feat(i18n): traducoes pt-BR para admin/publishers e admin/imprints"
```

## Task 4.3: Atualizar CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Adicionar seção sobre Publisher/Imprint**

Bloco curto descrevendo:
- Tabelas `publishers` e `imprints`, FKs em `catalog_entries.publisher_id`/`imprint_id`.
- Strings legadas (`publisher`, `imprint`) ficam como fallback.
- Helper `resolvePublisher` em `shared/utils/publisher.ts`.
- Scripts: `seed:publishers`, `match:publishers`, `scrape:logos`.
- Scraper Wikipedia/Wikidata com fallback.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): adiciona secao sobre Publisher/Imprint"
```

## Task 4.4: Deploy Fase 4

Build web → scp → restart pm2 → smoke test → push develop + main.

---

# Self-review (após escrever todo o plano)

Pra revisar antes de executar:

1. **Spec coverage:** spec tem seções 1-13. Plan cobre:
   - Schema (4) → Task 1.1
   - Componente (5) → Tasks 2.2/2.3/2.4
   - CRUD admin (6) → Tasks 3.1-3.4
   - Endpoints (7) → Tasks 1.5/1.6
   - Migração/seed/scraper (8) → Tasks 1.8/1.9/1.10/1.11
   - Faseamento (9) → Phases 1-4
   - Edge cases (10) → cobertos no service (Task 1.4): ConflictError, slug colisão via generateUniqueSlug, delete bloqueado
   - YAGNI/Riscos → respeitados

2. **Type consistency:**
   - `publisherId` consistente em CatalogEntry, schemas Zod, API
   - `logoFileName` + `logoUrl` consistentes em Publisher e Imprint
   - DTO interface usado tanto na API quanto no frontend

3. **Placeholder scan:** alguns "espelhar Task X" (1.6, 2.3, 3.4) — aceitável porque a estrutura é claramente análoga e o plano referência o que copiar.

4. **Riscos:** Phase 3 é grande (4 tasks com componentes complexos). Se travar, posso pausar Fase 3 e entregar Fases 1+2 (já entrega valor — admin form usa novos componentes).

Plan completo. Pronto pra execução via subagent-driven-development.
