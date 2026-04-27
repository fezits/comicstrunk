-- AlterTable: Make orderId optional on payments and add subscriptionId
ALTER TABLE `payments` MODIFY COLUMN `order_id` VARCHAR(191) NULL;
ALTER TABLE `payments` ADD COLUMN `subscription_id` VARCHAR(191) NULL;
CREATE INDEX `payments_subscription_id_idx` ON `payments`(`subscription_id`);

-- AlterTable: Add paymentMethod to subscriptions
ALTER TABLE `subscriptions` ADD COLUMN `payment_method` VARCHAR(20) NULL;
