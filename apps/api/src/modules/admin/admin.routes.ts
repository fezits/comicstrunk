import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import {
  listUsersSchema,
  updateUserRoleSchema,
  suspendUserSchema,
  dismissDuplicateSchema,
  type ListUsersInput,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { BadRequestError } from '../../shared/utils/api-error';
import * as adminService from './admin.service';
import { prisma } from '../../shared/lib/prisma';
import { resolveCoverUrl } from '../../shared/lib/cloudinary';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

// GET /dashboard — aggregate platform metrics
router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await adminService.getDashboardMetrics();
    sendSuccess(res, metrics);
  } catch (err) {
    next(err);
  }
});

// GET /users — paginated user list with search and role filter
router.get(
  '/users',
  validate(listUsersSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = req.query as unknown as ListUsersInput;
      const result = await adminService.listUsers(filters);
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /users/:id — full user detail
router.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await adminService.getUser(req.params.id as string);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
});

// PUT /users/:id/role — change user role
router.put(
  '/users/:id/role',
  validate(updateUserRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await adminService.updateUserRole(
        req.params.id as string,
        req.user!.userId,
        req.body,
      );
      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /users/:id/suspend — suspend user (force role to USER, cancel subscriptions)
router.post(
  '/users/:id/suspend',
  validate(suspendUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.suspendUser(
        req.params.id as string,
        req.user!.userId,
        req.body,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /users/:id/unsuspend — unsuspend user
router.post(
  '/users/:id/unsuspend',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.unsuspendUser(
        req.params.id as string,
        req.user!.userId,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// === Cover Review ===

// GET /covers/review — list covers for review (suspected placeholders)
router.get('/covers/review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const filter = (req.query.filter as string) || 'all'; // 'all' | 'rika' | 'panini' | 'openlibrary' | 'placeholder_rika'
    const skip = (page - 1) * limit;

    const sort = (req.query.sort as string) || 'title'; // 'title' | 'filename' | 'filesize'
    const titleSearch = req.query.title as string | undefined;
    const where: Record<string, unknown> = {
      coverFileName: { not: null },
    };

    if (titleSearch) {
      where.title = { contains: titleSearch };
    }

    if (filter === 'rika') where.coverFileName = { startsWith: 'rika-' };
    else if (filter === 'panini') where.coverFileName = { startsWith: 'panini-' };
    else if (filter === 'openlibrary') where.coverImageUrl = { contains: 'openlibrary' };
    else if (filter === 'placeholder_rika') {
      where.coverFileName = { startsWith: 'rika-' };
    }

    const orderBy = sort === 'filename'
      ? { coverFileName: 'asc' as const }
      : { title: 'asc' as const };

    const [entries, total] = await Promise.all([
      prisma.catalogEntry.findMany({
        where,
        select: { id: true, title: true, slug: true, coverImageUrl: true, coverFileName: true, publisher: true },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.catalogEntry.count({ where }),
    ]);

    // Resolve cover URLs and add file size info
    const coversDir = path.resolve(__dirname, '..', '..', '..', 'uploads', 'covers');
    const resolved = entries.map((entry) => {
      const withUrl = resolveCoverUrl(entry);
      let fileSize: number | null = null;
      if (entry.coverFileName) {
        try {
          const filePath = path.join(coversDir, entry.coverFileName.startsWith('rika-') || entry.coverFileName.startsWith('panini-')
            ? entry.coverFileName
            : entry.coverFileName);
          const stat = fs.statSync(filePath);
          fileSize = stat.size;
        } catch { /* file not found */ }
      }
      return { ...withUrl, fileSize };
    });

    // Sort by file size if requested (done in-memory since Prisma can't sort by external file size)
    if (sort === 'filesize') {
      resolved.sort((a, b) => (a.fileSize ?? Infinity) - (b.fileSize ?? Infinity));
    }

    sendPaginated(res, resolved, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

// POST /covers/remove — remove covers (set to NULL) for selected entry IDs
router.post('/covers/remove', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!ids?.length) {
      sendSuccess(res, { removed: 0 });
      return;
    }

    const result = await prisma.catalogEntry.updateMany({
      where: { id: { in: ids } },
      data: { coverImageUrl: null, coverFileName: null },
    });

    sendSuccess(res, { removed: result.count });
  } catch (err) {
    next(err);
  }
});

// === Duplicate Management ===

// GET /duplicates — find potential duplicates
// mode=pattern (default): GCD #issue match against Rika/Panini/Amazon/OpenLibrary
// mode=title: exact title match across any two different sources
router.get('/duplicates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const mode = (req.query.mode as string) === 'title' ? 'title' : 'pattern';

    if (mode === 'title') {
      // Optimized: first find titles with 2+ entries from different sources (uses title index),
      // then JOIN. Avoids massive cross product. Title comparison is case-insensitive
      // by default (utf8mb4_unicode_ci collation).
      const duplicates = await prisma.$queryRaw<Array<{
        gcd_id: string; gcd_title: string; gcd_publisher: string; gcd_source_key: string; gcd_cover: string | null;
        rika_id: string; rika_title: string; rika_publisher: string; rika_source_key: string; rika_cover: string | null;
      }>>`
        SELECT
          g.id as gcd_id, g.title as gcd_title, g.publisher as gcd_publisher,
          g.source_key as gcd_source_key, g.cover_image_url as gcd_cover,
          MIN(r.id) as rika_id, MIN(r.title) as rika_title, MIN(r.publisher) as rika_publisher,
          MIN(r.source_key) as rika_source_key, MIN(r.cover_image_url) as rika_cover
        FROM catalog_entries g
        JOIN catalog_entries r
          ON g.title = r.title
          AND g.id < r.id
          AND SUBSTRING_INDEX(g.source_key, ':', 1) != SUBSTRING_INDEX(r.source_key, ':', 1)
        WHERE g.title IN (
          SELECT title FROM catalog_entries
          WHERE source_key IS NOT NULL AND title IS NOT NULL AND CHAR_LENGTH(title) > 3
          GROUP BY title
          HAVING COUNT(DISTINCT SUBSTRING_INDEX(source_key, ':', 1)) > 1
        )
        AND g.source_key IS NOT NULL AND r.source_key IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM dismissed_duplicates d
          WHERE d.source_key_a = LEAST(g.source_key, r.source_key)
            AND d.source_key_b = GREATEST(g.source_key, r.source_key)
        )
        GROUP BY g.id, g.title, g.publisher, g.source_key, g.cover_image_url
        ORDER BY g.title ASC
        LIMIT ${limit} OFFSET ${skip}
      `;

      const countResult = await prisma.$queryRaw<[{ total: bigint }]>`
        SELECT COUNT(*) as total FROM (
          SELECT title FROM catalog_entries
          WHERE source_key IS NOT NULL AND title IS NOT NULL AND CHAR_LENGTH(title) > 3
          GROUP BY title
          HAVING COUNT(DISTINCT SUBSTRING_INDEX(source_key, ':', 1)) > 1
        ) AS dup_titles
      `;

      const total = Number(countResult[0].total);
      const pairs = duplicates.map((d) => ({
        gcd: resolveCoverUrl({ id: d.gcd_id, title: d.gcd_title, publisher: d.gcd_publisher, sourceKey: d.gcd_source_key, coverImageUrl: d.gcd_cover, coverFileName: null }),
        rika: resolveCoverUrl({ id: d.rika_id, title: d.rika_title, publisher: d.rika_publisher, sourceKey: d.rika_source_key, coverImageUrl: d.rika_cover, coverFileName: null }),
      }));
      sendPaginated(res, pairs, { page, limit, total });
      return;
    }

    const duplicates = await prisma.$queryRaw<Array<{
      gcd_id: string;
      gcd_title: string;
      gcd_publisher: string;
      gcd_source_key: string;
      gcd_cover: string | null;
      rika_id: string;
      rika_title: string;
      rika_publisher: string;
      rika_source_key: string;
      rika_cover: string | null;
    }>>`
      SELECT
        g.id as gcd_id, g.title as gcd_title, g.publisher as gcd_publisher,
        g.source_key as gcd_source_key, g.cover_image_url as gcd_cover,
        MIN(r.id) as rika_id, MIN(r.title) as rika_title, MIN(r.publisher) as rika_publisher,
        MIN(r.source_key) as rika_source_key, MIN(r.cover_image_url) as rika_cover
      FROM (
        SELECT id, title, publisher, source_key, cover_image_url, publish_year,
          CAST(SUBSTRING_INDEX(title, '#', -1) AS UNSIGNED) AS issue_num,
          LOWER(TRIM(REPLACE(REPLACE(SUBSTRING_INDEX(title, '#', 1), 'The ', ''), 'the ', ''))) AS base_title
        FROM catalog_entries
        WHERE source_key LIKE 'gcd:%' AND title LIKE '%#%'
        HAVING issue_num > 0
      ) g
      JOIN (
        SELECT id, title, publisher, source_key, cover_image_url, publish_year,
          CAST(SUBSTRING_INDEX(title, '#', -1) AS UNSIGNED) AS issue_num,
          LOWER(TRIM(REPLACE(REPLACE(SUBSTRING_INDEX(title, '#', 1), 'The ', ''), 'the ', ''))) AS base_title
        FROM catalog_entries
        WHERE (source_key LIKE 'rika:%' OR source_key LIKE 'panini:%' OR source_key LIKE 'amazon:%' OR source_key LIKE 'openlibrary:%')
          AND title LIKE '%#%'
        HAVING issue_num > 0
      ) r ON g.issue_num = r.issue_num
        AND (g.publish_year IS NULL OR r.publish_year IS NULL OR ABS(g.publish_year - r.publish_year) <= 1)
        AND (
          g.base_title = r.base_title
          OR (r.base_title LIKE CONCAT('%', g.base_title, '%') AND ABS(CHAR_LENGTH(g.base_title) - CHAR_LENGTH(r.base_title)) <= 3)
        )
      AND NOT EXISTS (
        SELECT 1 FROM dismissed_duplicates d
        WHERE d.source_key_a = LEAST(g.source_key, r.source_key)
          AND d.source_key_b = GREATEST(g.source_key, r.source_key)
      )
      GROUP BY g.id, g.title, g.publisher, g.source_key, g.cover_image_url
      ORDER BY g.title ASC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const countResult = await prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(DISTINCT g.id) as total
      FROM (
        SELECT id, publish_year, source_key,
          CAST(SUBSTRING_INDEX(title, '#', -1) AS UNSIGNED) AS issue_num,
          LOWER(TRIM(REPLACE(REPLACE(SUBSTRING_INDEX(title, '#', 1), 'The ', ''), 'the ', ''))) AS base_title
        FROM catalog_entries
        WHERE source_key LIKE 'gcd:%' AND title LIKE '%#%'
        HAVING issue_num > 0
      ) g
      JOIN (
        SELECT id, publish_year, source_key,
          CAST(SUBSTRING_INDEX(title, '#', -1) AS UNSIGNED) AS issue_num,
          LOWER(TRIM(REPLACE(REPLACE(SUBSTRING_INDEX(title, '#', 1), 'The ', ''), 'the ', ''))) AS base_title
        FROM catalog_entries
        WHERE (source_key LIKE 'rika:%' OR source_key LIKE 'panini:%' OR source_key LIKE 'amazon:%' OR source_key LIKE 'openlibrary:%')
          AND title LIKE '%#%'
        HAVING issue_num > 0
      ) r ON g.issue_num = r.issue_num
        AND (g.publish_year IS NULL OR r.publish_year IS NULL OR ABS(g.publish_year - r.publish_year) <= 1)
        AND (
          g.base_title = r.base_title
          OR (r.base_title LIKE CONCAT('%', g.base_title, '%') AND ABS(CHAR_LENGTH(g.base_title) - CHAR_LENGTH(r.base_title)) <= 3)
        )
      AND NOT EXISTS (
        SELECT 1 FROM dismissed_duplicates d
        WHERE d.source_key_a = LEAST(g.source_key, r.source_key)
          AND d.source_key_b = GREATEST(g.source_key, r.source_key)
      )
    `;

    const total = Number(countResult[0].total);

    // Resolve cover URLs
    const pairs = duplicates.map((d) => ({
      gcd: resolveCoverUrl({
        id: d.gcd_id,
        title: d.gcd_title,
        publisher: d.gcd_publisher,
        sourceKey: d.gcd_source_key,
        coverImageUrl: d.gcd_cover,
        coverFileName: null,
      }),
      rika: resolveCoverUrl({
        id: d.rika_id,
        title: d.rika_title,
        publisher: d.rika_publisher,
        sourceKey: d.rika_source_key,
        coverImageUrl: d.rika_cover,
        coverFileName: null,
      }),
    }));

    sendPaginated(res, pairs, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

// POST /duplicates/dismiss — mark a pair as "keep both" so it won't appear again
router.post(
  '/duplicates/dismiss',
  validate(dismissDuplicateSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceKeyA, sourceKeyB } = req.body;
      // Sempre ordenar lexicograficamente (par é simétrico)
      const [a, b] = [sourceKeyA, sourceKeyB].sort();

      await prisma.dismissedDuplicate.upsert({
        where: { sourceKeyA_sourceKeyB: { sourceKeyA: a, sourceKeyB: b } },
        create: { sourceKeyA: a, sourceKeyB: b },
        update: {},
      });

      sendSuccess(res, { dismissed: true });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /duplicates/:id — remove a specific catalog entry (for duplicate resolution)
router.delete('/duplicates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // Coleta IDs de collection items associados (precisa pra cascade em cart/order)
    const collectionItems = await prisma.collectionItem.findMany({
      where: { catalogEntryId: id },
      select: { id: true },
    });
    const collectionItemIds = collectionItems.map((c) => c.id);

    // Pre-check: se algum collectionItem está em order não-cancelada, bloqueia
    if (collectionItemIds.length > 0) {
      const liveOrderItems = await prisma.orderItem.count({
        where: {
          collectionItemId: { in: collectionItemIds },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
      });
      if (liveOrderItems > 0) {
        return next(
          new BadRequestError(
            `Não é possível remover: ${liveOrderItems} pedido(s) ativos referenciam este catálogo. Cancele os pedidos primeiro.`,
          ),
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Pega sourceKey ANTES de deletar
      const entry = await tx.catalogEntry.findUnique({
        where: { id },
        select: { sourceKey: true },
      });

      // 2. Limpa dependências em cascata (FKs que apontam pra catalog_entries OU pros collection_items)
      if (collectionItemIds.length > 0) {
        await tx.cartItem.deleteMany({ where: { collectionItemId: { in: collectionItemIds } } });
        await tx.orderItem.deleteMany({ where: { collectionItemId: { in: collectionItemIds } } });
      }
      await tx.catalogCategory.deleteMany({ where: { catalogEntryId: id } });
      await tx.catalogTag.deleteMany({ where: { catalogEntryId: id } });
      await tx.catalogCharacter.deleteMany({ where: { catalogEntryId: id } });
      await tx.favorite.deleteMany({ where: { catalogEntryId: id } });
      await tx.comment.deleteMany({ where: { catalogEntryId: id } });
      await tx.review.deleteMany({ where: { catalogEntryId: id } });
      await tx.collectionItem.deleteMany({ where: { catalogEntryId: id } });

      // 3. Hard delete
      await tx.catalogEntry.delete({ where: { id } });

      // 4. Blacklist — impede cron das 4h de reimportar a mesma entrada
      if (entry?.sourceKey) {
        await tx.removedSourceKey.upsert({
          where: { sourceKey: entry.sourceKey },
          create: { sourceKey: entry.sourceKey },
          update: {},
        });
      }
    });

    sendSuccess(res, { deleted: id, removedCollectionItems: collectionItemIds.length });
  } catch (err) {
    next(err);
  }
});

export const adminRoutes: Router = router;
