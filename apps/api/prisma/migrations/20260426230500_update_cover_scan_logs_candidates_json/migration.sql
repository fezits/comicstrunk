-- AlterTable: change candidates_shown from TEXT to JSON
ALTER TABLE `cover_scan_logs` MODIFY COLUMN `candidates_shown` JSON NOT NULL;
