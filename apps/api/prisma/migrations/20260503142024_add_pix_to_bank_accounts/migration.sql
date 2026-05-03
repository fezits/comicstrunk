-- AlterTable
ALTER TABLE `bank_accounts`
  ADD COLUMN `pix_key` VARCHAR(80) NULL,
  ADD COLUMN `pix_key_type` ENUM('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM') NULL;
