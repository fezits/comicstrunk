-- Gap #6: Webhook MP retry — adicionar attempts, lastError, lastAttemptAt
-- + index em processedAt pra cron buscar pendentes rapidamente.

ALTER TABLE `webhook_events`
  ADD COLUMN `attempts` INT NOT NULL DEFAULT 0,
  ADD COLUMN `last_error` TEXT NULL,
  ADD COLUMN `last_attempt_at` DATETIME(3) NULL;

CREATE INDEX `webhook_events_processedAt_idx` ON `webhook_events`(`processed_at`);
