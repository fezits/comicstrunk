import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import {
  listUsersSchema,
  updateUserRoleSchema,
  suspendUserSchema,
  type ListUsersInput,
} from '@comicstrunk/contracts';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
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

// GET /duplicates — find potential duplicates between GCD and Rika/Panini entries
router.get('/duplicates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Use derived tables to pre-extract issue number and base title,
    // filtering only entries with '#' before the JOIN to keep it fast.
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
        r.id as rika_id, r.title as rika_title, r.publisher as rika_publisher,
        r.source_key as rika_source_key, r.cover_image_url as rika_cover
      FROM (
        SELECT id, title, publisher, source_key, cover_image_url,
          CAST(SUBSTRING_INDEX(title, '#', -1) AS UNSIGNED) AS issue_num,
          LOWER(TRIM(REPLACE(REPLACE(SUBSTRING_INDEX(title, '#', 1), 'The ', ''), 'the ', ''))) AS base_title
        FROM catalog_entries
        WHERE source_key LIKE 'gcd:%' AND title LIKE '%#%'
        HAVING issue_num > 0
      ) g
      JOIN (
        SELECT id, title, publisher, source_key, cover_image_url,
          CAST(SUBSTRING_INDEX(title, '#', -1) AS UNSIGNED) AS issue_num,
          LOWER(TRIM(SUBSTRING_INDEX(title, '#', 1))) AS base_title
        FROM catalog_entries
        WHERE (source_key LIKE 'rika:%' OR source_key LIKE 'panini:%') AND title LIKE '%#%'
        HAVING issue_num > 0
      ) r ON g.issue_num = r.issue_num
        AND r.base_title LIKE CONCAT('%', g.base_title, '%')
      ORDER BY g.title ASC
      LIMIT ${limit} OFFSET ${skip}
    `;

    // Use SQL_CALC_FOUND_ROWS alternative: count with same optimized query
    const countResult = await prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) as total
      FROM (
        SELECT id,
          CAST(SUBSTRING_INDEX(title, '#', -1) AS UNSIGNED) AS issue_num,
          LOWER(TRIM(REPLACE(REPLACE(SUBSTRING_INDEX(title, '#', 1), 'The ', ''), 'the ', ''))) AS base_title
        FROM catalog_entries
        WHERE source_key LIKE 'gcd:%' AND title LIKE '%#%'
        HAVING issue_num > 0
      ) g
      JOIN (
        SELECT id,
          CAST(SUBSTRING_INDEX(title, '#', -1) AS UNSIGNED) AS issue_num,
          LOWER(TRIM(SUBSTRING_INDEX(title, '#', 1))) AS base_title
        FROM catalog_entries
        WHERE (source_key LIKE 'rika:%' OR source_key LIKE 'panini:%') AND title LIKE '%#%'
        HAVING issue_num > 0
      ) r ON g.issue_num = r.issue_num
        AND r.base_title LIKE CONCAT('%', g.base_title, '%')
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

// DELETE /duplicates/:id — remove a specific catalog entry (for duplicate resolution)
router.delete('/duplicates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // Delete junction table records first
    await prisma.catalogCategory.deleteMany({ where: { catalogEntryId: id } });
    await prisma.catalogTag.deleteMany({ where: { catalogEntryId: id } });
    await prisma.catalogCharacter.deleteMany({ where: { catalogEntryId: id } });
    await prisma.collectionItem.deleteMany({ where: { catalogEntryId: id } });

    await prisma.catalogEntry.delete({ where: { id } });

    sendSuccess(res, { deleted: id });
  } catch (err) {
    next(err);
  }
});

export const adminRoutes: Router = router;
