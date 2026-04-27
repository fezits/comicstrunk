-- Onda 3: Gap #7 (payout) + Gap #8 (shippingCost)
-- + notification types PAYOUT_*

-- 1. New ENUMs
-- (created via @db.Decimal/@@map; nada a fazer se for SQLite)

-- 2. Tabela seller_balances
CREATE TABLE `seller_balances` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `available` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `pending` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `total_earned` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `total_paid_out` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `seller_balances_user_id_key`(`user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `seller_balances`
  ADD CONSTRAINT `seller_balances_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Tabela payout_requests
CREATE TABLE `payout_requests` (
  `id` VARCHAR(191) NOT NULL,
  `seller_id` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('REQUESTED', 'APPROVED', 'PAID', 'REJECTED') NOT NULL DEFAULT 'REQUESTED',
  `bank_snapshot` JSON NOT NULL,
  `admin_notes` TEXT NULL,
  `external_receipt` TEXT NULL,
  `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `approved_at` DATETIME(3) NULL,
  `paid_at` DATETIME(3) NULL,
  `rejected_at` DATETIME(3) NULL,
  `processed_by_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `payout_requests_seller_id_idx`(`seller_id`),
  INDEX `payout_requests_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `payout_requests`
  ADD CONSTRAINT `payout_requests_seller_id_fkey`
  FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `payout_requests_processed_by_id_fkey`
  FOREIGN KEY (`processed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Tabela seller_balance_entries
CREATE TABLE `seller_balance_entries` (
  `id` VARCHAR(191) NOT NULL,
  `balance_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `kind` ENUM('SALE_CREDIT', 'PAYOUT_DEBIT', 'REFUND_DEBIT', 'ADJUSTMENT') NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `order_item_id` VARCHAR(191) NULL,
  `payout_id` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `seller_balance_entries_user_id_idx`(`user_id`),
  INDEX `seller_balance_entries_order_item_id_idx`(`order_item_id`),
  INDEX `seller_balance_entries_payout_id_idx`(`payout_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `seller_balance_entries`
  ADD CONSTRAINT `seller_balance_entries_balance_id_fkey`
  FOREIGN KEY (`balance_id`) REFERENCES `seller_balances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `seller_balance_entries_payout_id_fkey`
  FOREIGN KEY (`payout_id`) REFERENCES `payout_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Adiciona shippingCost no collection_items
ALTER TABLE `collection_items` ADD COLUMN `shipping_cost` DECIMAL(10, 2) NULL;

-- 6. Adiciona shippingTotal no orders
ALTER TABLE `orders` ADD COLUMN `shipping_total` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- 7. Atualiza enum NotificationType (notifications + notification_preferences)
ALTER TABLE `notifications` MODIFY COLUMN `type` ENUM(
  'WELCOME',
  'PAYMENT_CONFIRMED',
  'PAYMENT_REJECTED',
  'ORDER_SHIPPED',
  'ITEM_SOLD',
  'ORDER_DELIVERED',
  'ORDER_AUTO_COMPLETED',
  'DISPUTE_WINDOW_CLOSING',
  'PASSWORD_RESET',
  'DISPUTE_OPENED',
  'DISPUTE_RESPONDED',
  'DISPUTE_RESOLVED',
  'SUBSCRIPTION_PAYMENT_FAILED',
  'SUBSCRIPTION_EXPIRED',
  'PAYOUT_REQUESTED',
  'PAYOUT_APPROVED',
  'PAYOUT_PAID',
  'PAYOUT_REJECTED'
) NOT NULL;

ALTER TABLE `notification_preferences` MODIFY COLUMN `type` ENUM(
  'WELCOME',
  'PAYMENT_CONFIRMED',
  'PAYMENT_REJECTED',
  'ORDER_SHIPPED',
  'ITEM_SOLD',
  'ORDER_DELIVERED',
  'ORDER_AUTO_COMPLETED',
  'DISPUTE_WINDOW_CLOSING',
  'PASSWORD_RESET',
  'DISPUTE_OPENED',
  'DISPUTE_RESPONDED',
  'DISPUTE_RESOLVED',
  'SUBSCRIPTION_PAYMENT_FAILED',
  'SUBSCRIPTION_EXPIRED',
  'PAYOUT_REQUESTED',
  'PAYOUT_APPROVED',
  'PAYOUT_PAID',
  'PAYOUT_REJECTED'
) NOT NULL;
