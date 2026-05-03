-- AlterTable
ALTER TABLE `users`
  ADD COLUMN `suspended` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `suspended_at` DATETIME(3) NULL,
  ADD COLUMN `suspension_reason` TEXT NULL;

-- CreateIndex
CREATE INDEX `users_suspended_idx` ON `users`(`suspended`);
