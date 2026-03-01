import { z } from 'zod';

// ============================================================================
// Homepage Section Schemas
// ============================================================================

export const homepageSectionTypeSchema = z.enum([
  'BANNER_CAROUSEL',
  'CATALOG_HIGHLIGHTS',
  'DEALS_OF_DAY',
  'FEATURED_COUPONS',
]);

export type HomepageSectionType = z.infer<typeof homepageSectionTypeSchema>;

export const createHomepageSectionSchema = z.object({
  type: homepageSectionTypeSchema,
  title: z.string().max(200).optional(),
  sortOrder: z.coerce.number().int().min(0),
  isVisible: z.coerce.boolean().default(true),
  contentRefs: z
    .object({
      dealIds: z.array(z.string()).optional(),
      catalogIds: z.array(z.string()).optional(),
    })
    .optional(),
});

export type CreateHomepageSectionInput = z.infer<typeof createHomepageSectionSchema>;

export const updateHomepageSectionSchema = createHomepageSectionSchema.partial();

export type UpdateHomepageSectionInput = z.infer<typeof updateHomepageSectionSchema>;

export const reorderSectionsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>;
