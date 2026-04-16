-- AlterTable: add slug column to catalog_entries
ALTER TABLE `catalog_entries` ADD COLUMN `slug` VARCHAR(255) NULL;

-- CreateIndex: unique constraint on slug
CREATE UNIQUE INDEX `catalog_entries_slug_key` ON `catalog_entries`(`slug`);

-- AlterTable: add slug column to series
ALTER TABLE `series` ADD COLUMN `slug` VARCHAR(255) NULL;

-- CreateIndex: unique constraint on slug
CREATE UNIQUE INDEX `series_slug_key` ON `series`(`slug`);
