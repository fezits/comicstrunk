-- Import Guerra dos Tronos series + 4 volumes
-- Backup: backup-series-merge-20260419.sql

-- Create series
INSERT INTO series (id, title, slug, total_editions, created_at, updated_at) VALUES
('cseries_got_leya_001', 'Guerra dos Tronos (Leya)', 'guerra-dos-tronos-leya', 4, NOW(), NOW());

-- Import 4 volumes
INSERT INTO catalog_entries (id, title, slug, publisher, description, publish_year, publish_month, page_count, source_key, cover_image_url, approval_status, average_rating, rating_count, created_by_id, series_id, edition_number, created_at, updated_at) VALUES
('cgot_vol1_leya_2012_rika', 'Guerra dos Tronos - Volume 1', 'guerra-dos-tronos-volume-1', 'Leya', 'Guerra dos Tronos - Volume 1, Editora Leya, 240 paginas, publicacao: 12/2012', 2012, 12, 240, 'rika:119002925', 'https://rika.vtexassets.com/arquivos/ids/277603/guerra-tronos-vol-01.jpg', 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', 'cseries_got_leya_001', 1, NOW(), NOW()),
('cgot_vol2_leya_2013_rika', 'Guerra dos Tronos - Volume 2', 'guerra-dos-tronos-volume-2', 'Leya', 'Guerra dos Tronos - Volume 2, Editora Leya, 240 paginas, publicacao: 11/2013', 2013, 11, 240, 'rika:219002926', 'https://rika.vtexassets.com/arquivos/ids/277604/guerra-tronos-vol-02.jpg', 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', 'cseries_got_leya_001', 2, NOW(), NOW()),
('cgot_vol3_leya_2014_rika', 'Guerra dos Tronos - Volume 3', 'guerra-dos-tronos-volume-3', 'Leya', 'Guerra dos Tronos - Volume 3, Editora Leya, 224 paginas, publicacao: 5/2014', 2014, 5, 224, 'rika:319002927', NULL, 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', 'cseries_got_leya_001', 3, NOW(), NOW()),
('cgot_vol4_leya_2015_rika', 'Guerra dos Tronos - Volume 4', 'guerra-dos-tronos-volume-4', 'Leya', 'Guerra dos Tronos - Volume 4, Editora Leya, 224 paginas, publicacao: 6/2015', 2015, 6, 224, 'rika:419003355', 'https://rika.vtexassets.com/arquivos/ids/322428/Guerra-Dos-Tronos-Volume-4.jpg', 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', 'cseries_got_leya_001', 4, NOW(), NOW());
