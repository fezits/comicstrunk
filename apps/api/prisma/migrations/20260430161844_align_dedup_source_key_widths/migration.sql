-- AlterTable
ALTER TABLE `dismissed_duplicates`
    MODIFY `source_key_a` VARCHAR(191) NOT NULL,
    MODIFY `source_key_b` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `removed_source_keys`
    MODIFY `source_key` VARCHAR(191) NOT NULL;
