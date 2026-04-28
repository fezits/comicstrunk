-- Fase 1 scan-capa: tabela de log de scans de capa por foto
-- Registra cada scan: usuário, texto OCR, candidatos, escolha final
-- Alimenta rate limit (30/dia) e análise de adoção

CREATE TABLE `cover_scan_logs` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `raw_text` TEXT NOT NULL,
  `ocr_tokens` TEXT NOT NULL,
  `candidate_number` INTEGER NULL,
  `candidates_shown` TEXT NOT NULL,
  `chosen_entry_id` VARCHAR(191) NULL,
  `duration_ms` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `cover_scan_logs_user_id_created_at_idx`(`user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `cover_scan_logs`
  ADD CONSTRAINT `cover_scan_logs_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `cover_scan_logs_chosen_entry_id_fkey`
  FOREIGN KEY (`chosen_entry_id`) REFERENCES `catalog_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
