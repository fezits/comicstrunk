INSERT INTO users (id, email, name, password_hash, role, accepted_terms_at, created_at, updated_at)
VALUES ('cmazseller00000test001seller00000', 'seller@test.com', 'Test Seller', '$2b$12$GF3rBl1VuR6oQBiBWnuRwOZQ3bnjUN26WJ46qNIK5nH8X32kVxE3K', 'USER', NOW(), NOW(), NOW())
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);

INSERT INTO bank_accounts (id, user_id, bank_name, branch_number, account_number, cpf, holder_name, account_type, is_primary, created_at, updated_at)
SELECT 'cmazsellerbank0000test001bank0000', id, 'Banco do Brasil', '0001', '12345-6', '12345678900', 'Test Seller', 'CHECKING', 1, NOW(), NOW()
FROM users WHERE email = 'seller@test.com'
ON DUPLICATE KEY UPDATE updated_at = NOW();

SELECT id, email, role FROM users WHERE email = 'seller@test.com';
