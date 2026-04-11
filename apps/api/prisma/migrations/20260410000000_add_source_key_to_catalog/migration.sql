-- AlterTable
ALTER TABLE `catalog_entries` ADD COLUMN `source_key` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `catalog_entries_source_key_key` ON `catalog_entries`(`source_key`);
