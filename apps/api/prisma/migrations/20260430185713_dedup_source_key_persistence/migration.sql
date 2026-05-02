-- CreateTable
CREATE TABLE `dismissed_duplicates` (
    `source_key_a` VARCHAR(255) NOT NULL,
    `source_key_b` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`source_key_a`, `source_key_b`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `removed_source_keys` (
    `source_key` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`source_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =================================================================
-- Backfill em prod (rodar MANUALMENTE depois desta migration aplicar):
-- Pre-flight em prod: RENAME TABLE dismissed_duplicates TO dismissed_duplicates_legacy;
-- =================================================================
-- INSERT IGNORE INTO dismissed_duplicates (source_key_a, source_key_b)
-- SELECT
--   LEAST(g.source_key, r.source_key),
--   GREATEST(g.source_key, r.source_key)
-- FROM dismissed_duplicates_legacy d
-- INNER JOIN catalog_entries g ON g.id = d.gcd_id
-- INNER JOIN catalog_entries r ON r.id = d.rika_id
-- WHERE g.source_key IS NOT NULL AND r.source_key IS NOT NULL;
--
-- DROP TABLE dismissed_duplicates_legacy;
-- =================================================================
