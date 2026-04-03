-- AlterTable
ALTER TABLE `catalog_entries` ADD COLUMN `cover_file_name` VARCHAR(191) NULL,
    ADD COLUMN `cover_price` DECIMAL(10, 2) NULL,
    ADD COLUMN `page_count` INTEGER NULL,
    ADD COLUMN `publish_month` INTEGER NULL,
    ADD COLUMN `publish_year` INTEGER NULL;

-- CreateIndex
CREATE INDEX `catalog_entries_publish_year_idx` ON `catalog_entries`(`publish_year`);
