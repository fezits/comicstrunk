-- Batman Noir Capa Dura: criar serie e mover os 6 gibis

INSERT INTO series (id, title, slug, total_editions, created_at, updated_at) VALUES
('cseries_batman_noir_cd', 'Batman Noir - Capa Dura (Panini)', 'batman-noir-capa-dura-panini', 6, NOW(), NOW());

UPDATE catalog_entries SET series_id = 'cseries_batman_noir_cd', updated_at = NOW()
WHERE title LIKE '%Batman Noir%Capa Dura%' AND approval_status = 'APPROVED';
