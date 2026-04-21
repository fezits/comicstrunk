-- AlterTable: add source_key column
ALTER TABLE `catalog_entries` ADD COLUMN `source_key` VARCHAR(191) NULL;

-- Migrate existing barcode data to source_key (rika-* and panini-* prefixed barcodes)
UPDATE `catalog_entries` SET `source_key` = CONCAT('rika:', SUBSTRING(barcode, 6)) WHERE barcode LIKE 'rika-%';
UPDATE `catalog_entries` SET `source_key` = CONCAT('panini:', SUBSTRING(barcode, 8)) WHERE barcode LIKE 'panini-%';

-- Clear barcode for imported items (they don't have real barcodes/ISBNs)
UPDATE `catalog_entries` SET `barcode` = NULL WHERE barcode LIKE 'rika-%' OR barcode LIKE 'panini-%';

-- CreateIndex: unique constraint on source_key
CREATE UNIQUE INDEX `catalog_entries_source_key_key` ON `catalog_entries`(`source_key`);
