-- Re-insert 10 seed catalog entries
INSERT INTO catalog_entries (id, title, author, publisher, imprint, barcode, isbn, description, cover_image_url, approval_status, average_rating, rating_count, created_by_id, series_id, volume_number, edition_number, cover_price, publish_year, publish_month, page_count, created_at, updated_at) VALUES
('seed-dragonball-v1', 'Dragon Ball Vol. 1 - O Inicio da Jornada', 'Akira Toriyama', 'Panini Comics', 'Panini Manga', '7891234500001', '978-85-7657-001-1', 'Goku, um garoto com rabo de macaco, encontra Bulma e juntos partem em busca das Esferas do Dragao.', NULL, 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', 'cmmxe4vi900wd9esi1sr9wdks', 1, 1, 29.90, 2001, 3, 192, NOW(), NOW()),
('seed-dragonball-v2', 'Dragon Ball Vol. 2 - O Torneio de Artes Marciais', 'Akira Toriyama', 'Panini Comics', 'Panini Manga', '7891234500002', '978-85-7657-001-2', 'Goku treina com o Mestre Kame e participa do primeiro Torneio de Artes Marciais.', NULL, 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', 'cmmxe4vi900wd9esi1sr9wdks', 2, 1, NULL, NULL, NULL, NULL, NOW(), NOW()),
('seed-onepiece-v1', 'One Piece Vol. 1 - Romance Dawn', 'Eiichiro Oda', 'Panini Comics', 'Panini Manga', '7891234500003', '978-85-7657-002-1', 'Luffy parte para o mar em busca do One Piece, o tesouro lendario do Rei dos Piratas.', NULL, 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', 'cmmxe4vj300we9esi5b2maef9', 1, 1, NULL, NULL, NULL, NULL, NOW(), NOW()),
('seed-batman-v1', 'Batman: O Cavaleiro das Trevas #1', 'Frank Miller', 'Panini Comics', 'DC Comics', '7891234500004', '978-85-7657-003-1', 'Bruce Wayne, aos 55 anos, volta a vestir o manto do Batman para enfrentar a criminalidade crescente de Gotham.', NULL, 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', 'cmmxe58rj01bt9esimmoxs3ro', 1, 1, NULL, NULL, NULL, NULL, NOW(), NOW()),
('seed-naruto-v1', 'Naruto Vol. 1 - Uzumaki Naruto', 'Masashi Kishimoto', 'Panini Comics', 'Panini Manga', '7891234500005', '978-85-7657-004-1', 'Naruto Uzumaki e um jovem ninja rejeitado por carregar a Raposa de Nove Caudas selada dentro de si.', NULL, 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', NULL, 1, 1, NULL, NULL, NULL, NULL, NOW(), NOW()),
('seed-berserk-v1', 'Berserk Vol. 1 - O Espadachim Negro', 'Kentaro Miura', 'Panini Comics', 'Panini Manga', '7891234500006', '978-85-7657-005-1', 'Guts, o Espadachim Negro, vaga por um mundo sombrio e medieval repleto de demonios e monstros.', NULL, 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', NULL, 1, 1, NULL, NULL, NULL, NULL, NOW(), NOW()),
('seed-onepiece-v2', 'One Piece Vol. 2 - Buggy, o Palhaco', 'Eiichiro Oda', 'Panini Comics', 'Panini Manga', '7891234500007', '978-85-7657-002-2', 'Luffy enfrenta o pirata Buggy e recruta Zoro para sua tripulacao.', NULL, 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', 'cmmxe4vj300we9esi5b2maef9', 2, 1, NULL, NULL, NULL, NULL, NOW(), NOW()),
('seed-spiderman-v1', 'Spider-Man: A Ultima Cacada de Kraven', 'J.M. DeMatteis', 'Panini Comics', 'Marvel', '7891234500008', '978-85-7657-006-1', 'Kraven, o Cacador, enterra Spider-Man vivo e assume sua identidade nesta historia classica e sombria.', NULL, 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', 'cmmxe58rj01bt9esimmoxs3ro', 1, 1, NULL, NULL, NULL, NULL, NOW(), NOW()),
('seed-demonslayer-v1', 'Demon Slayer Vol. 1 - Crueldade', 'Koyoharu Gotouge', 'Panini Comics', 'Panini Manga', '7891234500009', '978-85-7657-007-1', 'Tanjiro Kamado embarca em uma jornada para curar sua irma Nezuko, transformada em demonio.', NULL, 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', NULL, 1, 2, NULL, NULL, NULL, NULL, NOW(), NOW()),
('seed-monica-v1', 'Turma da Monica Jovem Vol. 1', 'Mauricio de Sousa', 'Panini Comics', 'MSP', '7891234500010', '978-85-7657-008-1', 'Monica e seus amigos agora sao adolescentes nesta releitura em estilo manga dos classicos personagens brasileiros.', NULL, 'APPROVED', 0, 0, 'cmmwujcy90000chw9c2vkwf7n', NULL, 1, 1, NULL, NULL, NULL, NULL, NOW(), NOW());

-- Junction: catalog_categories
INSERT INTO catalog_categories (catalog_entry_id, category_id) VALUES
('seed-dragonball-v1', 'cmmwujd1j0001chw97glqomna'), ('seed-dragonball-v1', 'cmmwujd2u0004chw9c1o7g22u'),
('seed-dragonball-v2', 'cmmwujd1j0001chw97glqomna'), ('seed-dragonball-v2', 'cmmwujd2u0004chw9c1o7g22u'),
('seed-onepiece-v1', 'cmmwujd1j0001chw97glqomna'), ('seed-onepiece-v1', 'cmmwujd2u0004chw9c1o7g22u'),
('seed-batman-v1', 'cmmwujd220002chw9rsvy8evj'),
('seed-naruto-v1', 'cmmwujd1j0001chw97glqomna'), ('seed-naruto-v1', 'cmmwujd2u0004chw9c1o7g22u'),
('seed-berserk-v1', 'cmmwujd1j0001chw97glqomna'), ('seed-berserk-v1', 'cmmwujd350005chw9wrw953bl'),
('seed-onepiece-v2', 'cmmwujd1j0001chw97glqomna'), ('seed-onepiece-v2', 'cmmwujd2u0004chw9c1o7g22u'),
('seed-spiderman-v1', 'cmmwujd220002chw9rsvy8evj'),
('seed-demonslayer-v1', 'cmmwujd1j0001chw97glqomna'), ('seed-demonslayer-v1', 'cmmwujd2u0004chw9c1o7g22u'),
('seed-monica-v1', 'cmmwujd1j0001chw97glqomna'), ('seed-monica-v1', 'cmmwujd2u0004chw9c1o7g22u');

-- Junction: catalog_tags
INSERT INTO catalog_tags (catalog_entry_id, tag_id) VALUES
('seed-dragonball-v1', 'cmmwujd3n0006chw9bvoej8el'), ('seed-dragonball-v1', 'cmmwujd4e0008chw9bn8mvopy'), ('seed-dragonball-v1', 'cmmwujd4o0009chw9pzxz7nwl'),
('seed-dragonball-v2', 'cmmwujd3n0006chw9bvoej8el'), ('seed-dragonball-v2', 'cmmwujd4e0008chw9bn8mvopy'),
('seed-onepiece-v1', 'cmmwujd3n0006chw9bvoej8el'), ('seed-onepiece-v1', 'cmmwujd4e0008chw9bn8mvopy'), ('seed-onepiece-v1', 'cmmwujd58000bchw9adg1vhtw'), ('seed-onepiece-v1', 'cmmwujd5s000dchw9p417ver6'),
('seed-batman-v1', 'cmmwujd4e0008chw9bn8mvopy'), ('seed-batman-v1', 'cmmwujd4o0009chw9pzxz7nwl'), ('seed-batman-v1', 'cmmwujd5i000cchw9urxt11nn'),
('seed-naruto-v1', 'cmmwujd3n0006chw9bvoej8el'), ('seed-naruto-v1', 'cmmwujd4e0008chw9bn8mvopy'), ('seed-naruto-v1', 'cmmwujd58000bchw9adg1vhtw'),
('seed-berserk-v1', 'cmmwujd430007chw9ka4pchgp'), ('seed-berserk-v1', 'cmmwujd4e0008chw9bn8mvopy'), ('seed-berserk-v1', 'cmmwujd58000bchw9adg1vhtw'), ('seed-berserk-v1', 'cmmwujd5i000cchw9urxt11nn'),
('seed-onepiece-v2', 'cmmwujd3n0006chw9bvoej8el'), ('seed-onepiece-v2', 'cmmwujd4e0008chw9bn8mvopy'), ('seed-onepiece-v2', 'cmmwujd5s000dchw9p417ver6'),
('seed-spiderman-v1', 'cmmwujd4e0008chw9bn8mvopy'), ('seed-spiderman-v1', 'cmmwujd4o0009chw9pzxz7nwl'), ('seed-spiderman-v1', 'cmmwujd5i000cchw9urxt11nn'),
('seed-demonslayer-v1', 'cmmwujd3n0006chw9bvoej8el'), ('seed-demonslayer-v1', 'cmmwujd4e0008chw9bn8mvopy'), ('seed-demonslayer-v1', 'cmmwujd63000echw9zakjgl0m'),
('seed-monica-v1', 'cmmwujd3n0006chw9bvoej8el'), ('seed-monica-v1', 'cmmwujd5s000dchw9p417ver6'), ('seed-monica-v1', 'cmmwujd6d000fchw9ybhrb8s3');

-- Junction: catalog_characters
INSERT INTO catalog_characters (catalog_entry_id, character_id) VALUES
('seed-dragonball-v1', 'cmmwujd6t000gchw9fuaadf21'),
('seed-dragonball-v2', 'cmmwujd6t000gchw9fuaadf21'),
('seed-onepiece-v1', 'cmmwujd7k000ichw9ozr6w21b'),
('seed-batman-v1', 'cmmwujd76000hchw9jqkh1kv9'),
('seed-naruto-v1', 'cmmwujd7w000jchw985rqfkw5'),
('seed-berserk-v1', 'cmmwujd8j000lchw9j2l99sxm'),
('seed-onepiece-v2', 'cmmwujd7k000ichw9ozr6w21b'),
('seed-spiderman-v1', 'cmmwujd87000kchw9orgloz6t'),
('seed-demonslayer-v1', 'cmmwujd8v000mchw9vik8n9p9'),
('seed-monica-v1', 'cmmwujd97000nchw9y9bp05sp');

SELECT COUNT(*) AS restored FROM catalog_entries WHERE barcode LIKE '789123450000%';
