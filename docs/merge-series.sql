-- Series merge - 2026-04-19T17:09:57.328Z
SET @now = NOW();

-- A Espada Selvagem De Conan (2024) (Panini) (3 gibis)
UPDATE series SET title = 'A Espada Selvagem De Conan (2024) (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe8d1z04oj9esidcvau20e';
UPDATE catalog_entries SET series_id = 'cmmxe8d1z04oj9esidcvau20e', updated_at = @now WHERE id IN ('cmmwv8a32043u120nyjivd718','cmmwv88uy040k120np7jnco40','cmmwv87sr03xw120ngbygglrq');
DELETE FROM series WHERE id IN ('cmmxe8cjs04nx9esid5yugnwk','cmmxe8c9704nh9esim4lpzya4');

-- A Queda De X Especial (Panini) (3 gibis)
UPDATE series SET title = 'A Queda De X Especial (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe7ikb03rc9esifbyap7r9';
UPDATE catalog_entries SET series_id = 'cmmxe7ikb03rc9esifbyap7r9', updated_at = @now WHERE id IN ('cmmwv4r7w0slhm3hwkk2b8u2w','cmmwv4qrm0sk7m3hw08qnx4uw','cmmwv4q1e0si7m3hwpyoe77bs');
DELETE FROM series WHERE id IN ('cmmxe7i8u03r19esiqy0987sa','cmmxe7huk03qk9esihry6t7lc');

-- A Saga Da Mulher-Maravilha (Panini) (7 gibis)
UPDATE series SET title = 'A Saga Da Mulher-Maravilha (Panini)', total_editions = 7, updated_at = @now WHERE id = 'cmmxe839704eu9esi8pa1lczb';
UPDATE catalog_entries SET series_id = 'cmmxe839704eu9esi8pa1lczb', updated_at = @now WHERE id IN ('cmmwv7mlt02rc120nidjucii1','cmmwv7mfe02qs120n2tayu2o4','cmmwv7fse02b0120nqpe1gdz7','cmmwv7f6z029c120ng2xbzuzj','cmmwv7edu027a120no23o012z','cmmwv7ltu02p0120n8pyrn5kv','cmmwv7lpf02oo120n6vfebq8i');
DELETE FROM series WHERE id IN ('cmmxe832c04eo9esigt6wngdw','cmmxe7yp304ab9esiuc9van80','cmmxe7ybc049u9esicarzpkhx','cmmxe7xvj049a9esi8tj0tz09','cmmxe82l504e69esi145oemj2','cmmxe82bu04e29esi312nd55k');

-- A Saga Do Flash (Panini) (19 gibis)
UPDATE series SET title = 'A Saga Do Flash (Panini)', total_editions = 19, updated_at = @now WHERE id = 'cmmxe85fe04gp9esi6rp1dxe9';
UPDATE catalog_entries SET series_id = 'cmmxe85fe04gp9esi6rp1dxe9', updated_at = @now WHERE id IN ('cmmwv7pph02xu120nrfy6dac9','cmmwv7oxq02vs120nvo1rxacg','cmmwv7o5t02ui120noyp37xjt','cmmwv7nnc02tq120nnf8nkzft','cmmwv7iy502ie120nlmdt07l5','cmmwv7mno02ri120nzlnxwtez','cmmwv7mfz02qu120ngeydqtse','cmmwv7g8602c6120n66r7su8b','cmmwv7fgr02a4120nka9yydy0','cmmwv7elb027q120ny9c2canv','cmmwv7doi025m120njbpcpuad','cmmwv7cmu023s120n0hje047e','cmmwv7bo80216120nx3aeikfc','cmmwv7lla02oc120na4clb7ok','cmmwv7aeq01xs120n3afeer18','cmmwv79m801ve120nply2vej0','cmmwv78e701s6120nr2x0yu4g','cmmwv77af01ox120nqvbrvzg1','cmmwv762q01mk120n44h61bph');
DELETE FROM series WHERE id IN ('cmmxe84w704g69esi82zlh4zw','cmmxe84er04ft9esiwcoll4u7','cmmxe842z04fn9esig43f1yi8','cmmxe7zyu04c99esi6e0qimdy','cmmxe83aq04ew9esi5p7fe750','cmmxe833j04ep9esin9ocvsgg','cmmxe7yxe04ao9esisqao1g5e','cmmxe7yj204a39esie5jsrmm3','cmmxe7xyv049e9esijjk4ckgn','cmmxe7xfg048p9esio8rx0zdw','cmmxe7x2r04869esiwxehk55j','cmmxe7w3r047d9esik8sj06d2','cmmxe824g04dy9esixi9llvoj','cmmxe7vd1046c9esinitxo4j4','cmmxe7uyl045k9esidvn0b8jb','cmmxe7tv4044e9esii0ry2esh','cmmxe7t2804399esit6bnmlxv','cmmxe7sbk042b9esimpyguyq7');

-- A Saga Do Homem-Aranha (Panini) (24 gibis)
UPDATE series SET title = 'A Saga Do Homem-Aranha (Panini)', total_editions = 24, updated_at = @now WHERE id = 'cmmxe7lr403vs9esiyrjprgcd';
UPDATE catalog_entries SET series_id = 'cmmxe7lr403vs9esiyrjprgcd', updated_at = @now WHERE id IN ('cmmwv6rg500m5120nhf57zwut','cmmwv6qyj00kt120nsuzpw2ve','cmmwv6qrj00k7120nqanypwfq','cmmwv6qhh00jh120nrcixkorm','cmmwv6q7h00in120n1cl7zbt0','cmmwv6q1700i5120n1blys2ri','cmmwv6pyg00hx120n7b94fkwm','cmmwv6poc00h9120nisi72xl3','cmmwv6pkg00gz120ncxlrvndg','cmmwv4tp30sqvm3hwxpzcgei1','cmmwv6p9x00g3120n77utc75p','cmmwv4so70sofm3hw83u0xljf','cmmwv6p4x00fn120n52zu1uwe','cmmwv4ru90sn3m3hwaky2roa5','cmmwv4r760slfm3hwwzd8v4re','cmmwv6oz000f3120nvqrao23y','cmmwv4qe60sj7m3hw6ps2mjfw','cmmwv4q010si3m3hwkso0qgmx','cmmwv6otl00en120npdd0f8kv','cmmwv4p9v0sg7m3hwruhk5d31','cmmwv6opv00ed120nwsxuetle','cmmwv6oo300e9120n4mezl3h1','cmmwv4nny0scbm3hwvlmmtkot','cmmwv4n6o0sb3m3hwhgwi5icw');
DELETE FROM series WHERE id IN ('cmmxe7lms03vm9esie7sbzn2s','cmmxe7lik03vg9esikol6n23h','cmmxe7le903va9esi3eegx2a5','cmmxe7l9m03v49esihpgc3pe0','cmmxe7l6r03v09esi3t9j80h9','cmmxe7l5803uy9esibhk7moqt','cmmxe7l3q03uw9esieh4olgue','cmmxe7l2603uu9esigzgsz7xj','cmmxe7jke03sl9esi5yyl5k05','cmmxe7ky303un9esi748924va','cmmxe7j7q03s59esiif4w2jxh','cmmxe7kx603ul9esiga71v1md','cmmxe7iym03rt9esi4jrbkwc1','cmmxe7ijd03rb9esi3zsi45ne','cmmxe7kub03uf9esimio99dm3','cmmxe7i0403qr9esiuf5gm6ce','cmmxe7hsy03qi9esi72tw4t7p','cmmxe7ksb03ub9esifswvl3qv','cmmxe7hkd03q79esip7lyzj93','cmmxe7kqu03u89esiqnwiph3e','cmmxe7kqd03u79esiaixa3fgs','cmmxe7h1k03ph9esiyw6lg9u1','cmmxe7gsr03p29esixg6quwux');

-- A Saga Do Hulk (Panini) (6 gibis)
UPDATE series SET title = 'A Saga Do Hulk (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe7h3n03pl9esikjjcpj3w';
UPDATE catalog_entries SET series_id = 'cmmxe7h3n03pl9esikjjcpj3w', updated_at = @now WHERE id IN ('cmmwv4nuy0scxm3hw1o69ogkh','cmmwv4n340satm3hwytwj6e7b','cmmwv4mij0s9bm3hwlzm1ttc6','cmmwv4lxo0s7tm3hwws4q34p8','cmmwv4kji0s51m3hw8vi5s53v','cmmwv4jjt0s2bm3hw47bpzivq');
DELETE FROM series WHERE id IN ('cmmxe7gmp03oy9esiuylmfoad','cmmxe7g0903oh9esil7tioe7e','cmmxe7f6n03o19esiu0nqoiyb','cmmxe7egz03n79esidu3afofv','cmmxe7dws03mi9esie95jkns4');

-- A Saga Do Lanterna Verde (Panini) (8 gibis)
UPDATE series SET title = 'A Saga Do Lanterna Verde (Panini)', total_editions = 8, updated_at = @now WHERE id = 'cmmxe82n104e89esihym5xe61';
UPDATE catalog_entries SET series_id = 'cmmxe82n104e89esihym5xe61', updated_at = @now WHERE id IN ('cmmwv7lwb02p8120nr7qay8hf','cmmwv7lt502oy120nut1bgf74','cmmwv7lo102ok120ncapsdktv','cmmwv7liz02o6120ng1oric2n','cmmwv79ur01w6120n5p1jfahu','cmmwv792l01u6120nyiqx58ho','cmmwv77rv01qa120ns4x6sj4q','cmmwv773501od120nwze7m1te');
DELETE FROM series WHERE id IN ('cmmxe82j204e59esirqao92r9','cmmxe82a604e19esis7h985oc','cmmxe81yz04dv9esi126oyfbu','cmmxe7v4n045v9esiq4vf00qj','cmmxe7uja04529esisj9kta7o','cmmxe7tbe043p9esid1f1bgkq','cmmxe7svt04309esifrvityg5');

-- A Saga Do Wolverine (Panini) (11 gibis)
UPDATE series SET title = 'A Saga Do Wolverine (Panini)', total_editions = 11, updated_at = @now WHERE id = 'cmmxe7eto03nr9esibljfmkam';
UPDATE catalog_entries SET series_id = 'cmmxe7eto03nr9esibljfmkam', updated_at = @now WHERE id IN ('cmmwv4ljl0s6zm3hwdi5ssq1n','cmmwv6ozl00f5120n71vpsseh','cmmwv4q0l0si5m3hwznga50x7','cmmwv6orh00eh120ncb7gowym','cmmwv6onc00e7120n7ypeoiyb','cmmwv6ohz00dt120nz83nf3qa','cmmwv6ob500d9120n050ca1wf','cmmwv4lz90s7xm3hwomopzs6m','cmmwv4kh80s4xm3hw48jn1bal','cmmwv4jj50s29m3hwhu7z131n','cmmwv4hyk0rxzm3hwqfhriocd');
DELETE FROM series WHERE id IN ('cmmxe7kus03ug9esi0dzpyqcv','cmmxe7htr03qj9esithokjwf6','cmmxe7kru03ua9esikt4vokc3','cmmxe7kpv03u69esi821xguzh','cmmxe7knu03u29esijryan70t','cmmxe7km703tz9esizjdia1dm','cmmxe7f8o03o39esip1tvzria','cmmxe7efm03n59esiyq42ib38','cmmxe7dvw03mh9esi97vsuh6d','cmmxe7cxi03lc9esic48trnuu');

-- A Saga Dos Novos Titãs (Panini) (10 gibis)
UPDATE series SET title = 'A Saga Dos Novos Titãs (Panini)', total_editions = 10, updated_at = @now WHERE id = 'cmmxe84np04g09esijcnia4j2';
UPDATE catalog_entries SET series_id = 'cmmxe84np04g09esijcnia4j2', updated_at = @now WHERE id IN ('cmmwv7okq02v6120nhcaz8619','cmmwv7k2w02ky120nsf9rex3f','cmmwv7jpm02js120nz7oz4mv8','cmmwv7io302hm120nbwbludjc','cmmwv7hz802fq120nj0g2xiwq','cmmwv7me602qo120nxhhotmvl','cmmwv7ftg02b2120n8dfi6jov','cmmwv7f6b029a120nanxvbf2t','cmmwv7lzd02pi120nfk49dds0','cmmwv7cqj0240120n5ogp2jbk');
DELETE FROM series WHERE id IN ('cmmxe80up04cw9esiulb98csv','cmmxe80g204ck9esibnj6dup9','cmmxe7zqv04c09esibaxxqzbb','cmmxe7zcj04bi9esiob1m2stg','cmmxe831h04en9esiqdmsbd3o','cmmxe7yq004ac9esie64a6e4d','cmmxe7yaj049t9esipglx8q3h','cmmxe82qy04ec9esiyub9o41g','cmmxe7x4d04889esi04ntvz2b');

-- A Saga Dos Vingadores (Panini) (8 gibis)
UPDATE series SET title = 'A Saga Dos Vingadores (Panini)', total_editions = 8, updated_at = @now WHERE id = 'cmmxe7la903v59esiuawovpe4';
UPDATE catalog_entries SET series_id = 'cmmxe7la903v59esiuawovpe4', updated_at = @now WHERE id IN ('cmmwv6q8w00ir120nxwnbun5v','cmmwv6mas007t120n3t1b0biq','cmmwv6lc9005r120n80qy8g3l','cmmwv6p0t00f9120n6rxsuf50','cmmwv4qba0sizm3hw3r93bgh9','cmmwv4pgx0sgpm3hw44d2fal1','cmmwv6oqp00ef120ne5ork5ol','cmmwv6ol200e1120np0ditort');
DELETE FROM series WHERE id IN ('cmmxe7k3203t99esiio9uw9rm','cmmxe7jre03su9esi8s8o8zw1','cmmxe7kvp03ui9esizw78en3b','cmmxe7hym03qp9esizbban1zz','cmmxe7hnp03qb9esiej9qlw1a','cmmxe7krc03u99esirurizn6d','cmmxe7kpc03u59esidx3v9jf7');

-- A Vingança Do Cavaleiro Da Lua (Panini) (2 gibis)
UPDATE series SET title = 'A Vingança Do Cavaleiro Da Lua (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7h9j03pw9esi2rckp6fx';
UPDATE catalog_entries SET series_id = 'cmmxe7h9j03pw9esi2rckp6fx', updated_at = @now WHERE id IN ('cmmwv4okr0sejm3hwwrzxlvuy','cmmwv4l9z0s6jm3hw9bqy6vs4');
DELETE FROM series WHERE id IN ('cmmxe7epk03nn9esi4cza9i4w');

-- Absolute Batman (Panini) (5 gibis)
UPDATE series SET title = 'Absolute Batman (Panini)', total_editions = 5, updated_at = @now WHERE id = 'cmmxe81t304dp9esiztlqcs2v';
UPDATE catalog_entries SET series_id = 'cmmxe81t304dp9esiztlqcs2v', updated_at = @now WHERE id IN ('cmmwv7leg02nu120n1ge70bvp','cmmwv79f701uw120nq3z6tvnc','cmmwv78am01rw120nj8d0k3h7','cmmwv779j01ov120numy85i7r','cmmwv75m801ll120ng0zvza50');
DELETE FROM series WHERE id IN ('cmmxe7utq045d9esikgwa1pmx','cmmxe7trc044a9esitkwbizzr','cmmxe7t1n04389esif35t8tv2','cmmxe7s1s04209esilra2o72n');

-- Absolute Caçador De Marte (Panini) (2 gibis)
UPDATE series SET title = 'Absolute Caçador De Marte (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7teo043v9esih50m5i56';
UPDATE catalog_entries SET series_id = 'cmmxe7teo043v9esih50m5i56', updated_at = @now WHERE id IN ('cmmwv77xl01qs120nszxo7o1y','cmmwv778201or120nkoxexemx');
DELETE FROM series WHERE id IN ('cmmxe7t0h04369esiv1tkjv5o');

-- Absolute Flash (Panini) (2 gibis)
UPDATE series SET title = 'Absolute Flash (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7t6u043h9esiwa1vb44z';
UPDATE catalog_entries SET series_id = 'cmmxe7t6u043h9esiwa1vb44z', updated_at = @now WHERE id IN ('cmmwv77li01pq120n1e2vt2y6','cmmwv75v001m6120n49iypian');
DELETE FROM series WHERE id IN ('cmmxe7s9104289esiktmnxh86');

-- Absolute Lanterna Verde (Panini) (2 gibis)
UPDATE series SET title = 'Absolute Lanterna Verde (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7t56043e9esia6r6aa2v';
UPDATE catalog_entries SET series_id = 'cmmxe7t56043e9esia6r6aa2v', updated_at = @now WHERE id IN ('cmmwv77iy01pi120npzue7x5p','cmmwv75u201m4120nhwo4c7t7');
DELETE FROM series WHERE id IN ('cmmxe7s8004279esikoqrl2he');

-- Absolute Mulher-Maravilha (Panini) (4 gibis)
UPDATE series SET title = 'Absolute Mulher-Maravilha (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe7v45045u9esi3o18s1mb';
UPDATE catalog_entries SET series_id = 'cmmxe7v45045u9esi3o18s1mb', updated_at = @now WHERE id IN ('cmmwv79u801w4120nqgy9hjt7','cmmwv789x01ru120nwipsf727','cmmwv777e01op120njcucvozd','cmmwv75ln01lj120nalzhlxe7');
DELETE FROM series WHERE id IN ('cmmxe7tqh04499esizwpkkb0j','cmmxe7szy04359esi36v3tcrh','cmmxe7s0x041z9esi4miqy4xf');

-- Absolute Superman (Panini) (4 gibis)
UPDATE series SET title = 'Absolute Superman (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe7v3k045t9esikz8xdih4';
UPDATE catalog_entries SET series_id = 'cmmxe7v3k045t9esikz8xdih4', updated_at = @now WHERE id IN ('cmmwv79to01w2120n05vqyiea','cmmwv78vl01tm120nw2vivm8a','cmmwv77o501py120npvsf907k','cmmwv76o601ng120niyteypi9');
DELETE FROM series WHERE id IN ('cmmxe7u9c044v9esiq9cq718a','cmmxe7t9e043l9esip8t54ytk','cmmxe7smh042o9esih1l2s7yk');

-- Adaptação Oficial do Filme - Homem-Aranha (Panini) (2 gibis)
UPDATE series SET title = 'Adaptação Oficial do Filme - Homem-Aranha (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6nmu02ro9esii4dqi1ds';
UPDATE catalog_entries SET series_id = 'cmmxe6nmu02ro9esii4dqi1ds', updated_at = @now WHERE id IN ('cmmwuzn3p0hc0m3hwf82jv22v','cmmwuzn1b0hbym3hwdri1bk86');
DELETE FROM series WHERE id IN ('cmmxe6nm002rn9esipvbi8fl7');

-- Agente Secreto X (Devir) (2 gibis)
UPDATE series SET title = 'Agente Secreto X (Devir)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6ig902md9esi4119yfj9';
UPDATE catalog_entries SET series_id = 'cmmxe6ig902md9esi4119yfj9', updated_at = @now WHERE id IN ('cmmwuxsxb0cz6m3hwaj0vfexs','cmmwuxsyl0cz8m3hwwjtntmwn');
DELETE FROM series WHERE id IN ('cmmxe6igs02me9esii9v49hqw');

-- Alias - 2ª Edição (Panini) (3 gibis)
UPDATE series SET title = 'Alias - 2ª Edição (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe6sbw02xl9esiu2vp6t9f';
UPDATE catalog_entries SET series_id = 'cmmxe6sbw02xl9esiu2vp6t9f', updated_at = @now WHERE id IN ('cmmwv093g0itam3hwwfquiv55','cmmwv092o0it8m3hwunq4x7zf','cmmwv091x0it6m3hwctmumeki');
DELETE FROM series WHERE id IN ('cmmxe6sbd02xk9esisgcdpk0x','cmmxe6sav02xj9esi687l9fx7');

-- Aniquilação (Panini) (2 gibis)
UPDATE series SET title = 'Aniquilação (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5pwo01w49esisi5x8j0r';
UPDATE catalog_entries SET series_id = 'cmmxe5pwo01w49esisi5x8j0r', updated_at = @now WHERE id IN ('cmmwuty5f04kbm3hwo4x65idm','cmmwv4k2q0s3tm3hw9qmkeods');
DELETE FROM series WHERE id IN ('cmmxe7e9e03mx9esi0z06uf10');

-- Armagedom Parte (Pixel) (3 gibis)
UPDATE series SET title = 'Armagedom Parte (Pixel)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe62d102949esiwx339jt8';
UPDATE catalog_entries SET series_id = 'cmmxe62d102949esiwx339jt8', updated_at = @now WHERE id IN ('cmmwuwx4j0avtm3hwjj50w758','cmmwuwx3r0avrm3hwi4wxbt10','cmmwuwx2z0avpm3hw8wwq6fad');
DELETE FROM series WHERE id IN ('cmmxe62c402939esij1pcrbwj','cmmxe62b802929esisxyjtgxk');

-- Arqueiro Verde (2024) (Panini) (4 gibis)
UPDATE series SET title = 'Arqueiro Verde (2024) (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe7zd804bj9esi14n87fkv';
UPDATE catalog_entries SET series_id = 'cmmxe7zd804bj9esi14n87fkv', updated_at = @now WHERE id IN ('cmmwv7hzx02fs120ny319filz','cmmwv7cns023u120nknbjmodx','cmmwv79wq01wc120n6cwf6y5q','cmmwv75zh01me120nmj4iqkgc');
DELETE FROM series WHERE id IN ('cmmxe7x3l04879esiroz06hcy','cmmxe7v5p045x9esi6ve6s5qo','cmmxe7saq042a9esi40141nlc');

-- As Maiores Sagas Dos X-Men: Amanhecer Violento Parte (Panini) (2 gibis)
UPDATE series SET title = 'As Maiores Sagas Dos X-Men: Amanhecer Violento Parte (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7dgp03m09esirhpird5w';
UPDATE catalog_entries SET series_id = 'cmmxe7dgp03m09esirhpird5w', updated_at = @now WHERE id IN ('cmmwv4ixi0s0dm3hwosw49akf','cmmwv4gh10ruxm3hwbynzy550');
DELETE FROM series WHERE id IN ('cmmxe7buz03ka9esim5so6m1y');

-- Assassin''s Creed (Record) (2 gibis)
UPDATE series SET title = 'Assassin''s Creed (Record)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5kzi01qj9esiioqfrqwm';
UPDATE catalog_entries SET series_id = 'cmmxe5kzi01qj9esiioqfrqwm', updated_at = @now WHERE id IN ('cmmwut5jp02kfm3hw6ecdebe2','cmmwuxkjm0cftm3hw1cudlw4n');
DELETE FROM series WHERE id IN ('cmmxe6fqn02jg9esidxz3jmw8');

-- Astro City (Panini) (11 gibis)
UPDATE series SET title = 'Astro City (Panini)', total_editions = 11, updated_at = @now WHERE id = 'cmmxe5v1h021y9esiz0k334aq';
UPDATE catalog_entries SET series_id = 'cmmxe5v1h021y9esiz0k334aq', updated_at = @now WHERE id IN ('cmmwuvsc208npm3hw9051bzzo','cmmwuvscw08nrm3hw2bvucnnl','cmmwuwjwg0a0dm3hwpesvkco2','cmmwuvror08mpm3hwt5vokh4l','cmmwuvrp908mrm3hwnq1atesa','cmmwuwhtv09v3m3hw3nr9h4bv','cmmwuwht409v1m3hw9pldwv20','cmmwuwhsc09uzm3hwa9ejghsx','cmmwut20202bzm3hwfdphqj4z','cmmwuwhrn09uxm3hw6t7w9wpk','cmmwuwgcs09r7m3hwtkbfsp20');
DELETE FROM series WHERE id IN ('cmmxe5v2c021z9esid924mevq','cmmxe60ar027b9esirfghueir','cmmxe5uum021p9esillnp2fsg','cmmxe5uvg021q9esi6j152ssn','cmmxe5z7h02689esiwjojzbt6','cmmxe5z6q02679esi42229uny','cmmxe5z6002669esig2yg9j6o','cmmxe5jvk01p59esiw7qgq3yr','cmmxe5z5e02659esie6w9ma6b','cmmxe5yn8025m9esi4ber5622');

-- Aventuras de Luther Arkwright (Via Lettera) (2 gibis)
UPDATE series SET title = 'Aventuras de Luther Arkwright (Via Lettera)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe63yb02am9esic2czge5x';
UPDATE catalog_entries SET series_id = 'cmmxe63yb02am9esic2czge5x', updated_at = @now WHERE id IN ('cmmwux5v90bhbm3hwkbb969q8','cmmwux5uo0bh9m3hwyf94xh48');
DELETE FROM series WHERE id IN ('cmmxe63xr02al9esi2rfgz5om');

-- Aventuras Marvel (Panini) (8 gibis)
UPDATE series SET title = 'Aventuras Marvel (Panini)', total_editions = 8, updated_at = @now WHERE id = 'cmmxe7gs303p19esiszsbe1lc';
UPDATE catalog_entries SET series_id = 'cmmxe7gs303p19esiszsbe1lc', updated_at = @now WHERE id IN ('cmmwv4n610sb1m3hwwc71kezp','cmmwv4m0o0s81m3hw1ii6ga8t','cmmwv4klw0s55m3hwzzi1zyj6','cmmwv4jgy0s23m3hwjylnnqwr','cmmwv4j1t0s0rm3hwug4gagbg','cmmwv4ik50rzbm3hwp5kp5t9n','cmmwv4hih0rx9m3hwggydcm7q','cmmwv4g9q0rudm3hwq6fnx5xh');
DELETE FROM series WHERE id IN ('cmmxe7f9x03o49esiip788uzg','cmmxe7eho03n89esi7rtj211c','cmmxe7du703mf9esixwmjzw38','cmmxe7dk703m49esivbhkr1bp','cmmxe7d6j03lq9esiuugefafo','cmmxe7cqi03l29esi9kne6bwr','cmmxe7bjt03k39esitd6qb4cg');

-- B.P.D.P - Inferno na Terra (Mythos) (3 gibis)
UPDATE series SET title = 'B.P.D.P - Inferno na Terra (Mythos)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5izu01oe9esi1057gyby';
UPDATE catalog_entries SET series_id = 'cmmxe5izu01oe9esi1057gyby', updated_at = @now WHERE id IN ('cmmwusyvl024lm3hwohsfkyc7','cmmwust7901r9m3hwdwma9v8b','cmmwust6n01r7m3hwzk3yu9gm');
DELETE FROM series WHERE id IN ('cmmxe5h3501mc9esinzukeben','cmmxe5h2m01mb9esi9afqda7d');

-- B.P.D.P Omnibus (Mythos) (8 gibis)
UPDATE series SET title = 'B.P.D.P Omnibus (Mythos)', total_editions = 8, updated_at = @now WHERE id = 'cmmxe6a1m02fa9esigduthh2l';
UPDATE catalog_entries SET series_id = 'cmmxe6a1m02fa9esigduthh2l', updated_at = @now WHERE id IN ('cmmwuxfar0c2nm3hw2j1eqsqw','cmmwuxhxv0c99m3hwpd1ix06j','cmmwuxf9w0c2lm3hwn2hnglwv','cmmwusq4501jbm3hwnl5d5jrp','cmmwuxedt0c0tm3hwxo7j8f70','cmmwusq3601j9m3hweb2yxwmn','cmmwuxecw0c0rm3hw75n63xca','cmmwuxf8x0c2jm3hwjd8g5mg0');
DELETE FROM series WHERE id IN ('cmmxe6d9r02hr9esiqu8misos','cmmxe6a0t02f99esi7ry0cq6i','cmmxe5gfh01lc9esihbqdabzh','cmmxe69jj02es9esib8ret46n','cmmxe5gem01lb9esi4v6pydd2','cmmxe69hu02er9esie51r1fhg','cmmxe69yt02f89esikefqmyqh');

-- Batman - A Queda do Morcego (Panini) (4 gibis)
UPDATE series SET title = 'Batman - A Queda do Morcego (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe753h03br9esiznccu3f5';
UPDATE catalog_entries SET series_id = 'cmmxe753h03br9esiznccu3f5', updated_at = @now WHERE id IN ('cmmwv30o20okwm3hwdjmukt9y','cmmwv2mr60nrmm3hwt8m1g2yt','cmmwv2mqp0nrkm3hwxdo4ume0','cmmwv2mmf0nrim3hw6cwgxatl');
DELETE FROM series WHERE id IN ('cmmxe72uu039e9esiu59dymjz','cmmxe72ud039d9esi10q1x645','cmmxe72tx039c9esi8peq690e');

-- Batman - A Série Animada (Panini) (2 gibis)
UPDATE series SET title = 'Batman - A Série Animada (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe71uk037z9esi61g6k1u9';
UPDATE catalog_entries SET series_id = 'cmmxe71uk037z9esi61g6k1u9', updated_at = @now WHERE id IN ('cmmwv2ch80neim3hwr7lcrd2p','cmmwv2cgj0negm3hw47livh90');
DELETE FROM series WHERE id IN ('cmmxe71tm037y9esivpr4tcb5');

-- Batman - Caos em Arkham City (Panini) (4 gibis)
UPDATE series SET title = 'Batman - Caos em Arkham City (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe71is037m9esidy8bkbwh';
UPDATE catalog_entries SET series_id = 'cmmxe71is037m9esidy8bkbwh', updated_at = @now WHERE id IN ('cmmwv2b9e0nbim3hw9mis6zw2','cmmwuuril06mim3hwp604b05h','cmmwuup5806gkm3hwioxv8o19','cmmwuup4m06gim3hw75v2030b');
DELETE FROM series WHERE id IN ('cmmxe5seb01yt9esib69tqp30','cmmxe5s3p01yh9esi8zn8aojj','cmmxe5s2v01yg9esi5j0lgvl3');

-- Batman - Lendas do Cavaleiro das Trevas - Alan Davis (Panini) (2 gibis)
UPDATE series SET title = 'Batman - Lendas do Cavaleiro das Trevas - Alan Davis (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5rkr01xr9esi3sqamfov';
UPDATE catalog_entries SET series_id = 'cmmxe5rkr01xr9esi3sqamfov', updated_at = @now WHERE id IN ('cmmwuumrv06agm3hwklxow6m0','cmmwuumqj06aem3hw2attfgs4');
DELETE FROM series WHERE id IN ('cmmxe5rk601xq9esirthn1ny8');

-- Batman - Lendas do Cavaleiro das Trevas - Archie Goodwin (Panini) (2 gibis)
UPDATE series SET title = 'Batman - Lendas do Cavaleiro das Trevas - Archie Goodwin (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5gvo01ly9esijb8a4je8';
UPDATE catalog_entries SET series_id = 'cmmxe5gvo01ly9esijb8a4je8', updated_at = @now WHERE id IN ('cmmwusrpf01nbm3hw3cym1o7s','cmmwusros01n9m3hweb5dz32j');
DELETE FROM series WHERE id IN ('cmmxe5gv101lx9esirg4z87mp');

-- Batman - Lendas do Cavaleiro das Trevas - Gene Colan (Panini) (2 gibis)
UPDATE series SET title = 'Batman - Lendas do Cavaleiro das Trevas - Gene Colan (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe73g703a89esi6ytz580x';
UPDATE catalog_entries SET series_id = 'cmmxe73g703a89esi6ytz580x', updated_at = @now WHERE id IN ('cmmwv2twl0o42m3hwdhhuf3b6','cmmwv2tvy0o40m3hwx5o8r86i');
DELETE FROM series WHERE id IN ('cmmxe73ff03a79esigun1w1v6');

-- Batman - Lendas do Cavaleiro das Trevas - Jim Aparo (Panini) (10 gibis)
UPDATE series SET title = 'Batman - Lendas do Cavaleiro das Trevas - Jim Aparo (Panini)', total_editions = 10, updated_at = @now WHERE id = 'cmmxe5rmj01xu9esiivu4t3ir';
UPDATE catalog_entries SET series_id = 'cmmxe5rmj01xu9esiivu4t3ir', updated_at = @now WHERE id IN ('cmmwuumw206amm3hw4fkucwv9','cmmwuumuw06akm3hwi3crqyka','cmmwuup3z06ggm3hwafd4duaf','cmmwuumte06aim3hwkvf9mkvw','cmmwv2tv70o3ym3hwh0hldsd6','cmmwuulu4068om3hwie88ux2g','cmmwuult9068mm3hwndlvn6kf','cmmwv2rla0nymm3hwdp68zee6','cmmwv2rkk0nykm3hwtjj80vc9','cmmwv2rjt0nyim3hwb9x2sjf9');
DELETE FROM series WHERE id IN ('cmmxe5rm001xt9esiyn7i0umt','cmmxe5s2001yf9esi1nvmv1sh','cmmxe5rla01xs9esiyqdq2yzz','cmmxe73el03a69esiz9efun7b','cmmxe5rgc01xk9esi85opc363','cmmxe5rff01xj9esi75pl825j','cmmxe7384039y9esiqaki1xjt','cmmxe737a039x9esifonphl17','cmmxe736i039w9esiajfpcm6g');

-- Batman - Lendas do Cavaleiro das Trevas - Marshall Rogers (Panini) (3 gibis)
UPDATE series SET title = 'Batman - Lendas do Cavaleiro das Trevas - Marshall Rogers (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5s1701ye9esifcrl05rz';
UPDATE catalog_entries SET series_id = 'cmmxe5s1701ye9esifcrl05rz', updated_at = @now WHERE id IN ('cmmwuup3e06gem3hw7vf49en2','cmmwv2tui0o3wm3hwimywf734','cmmwv2ttt0o3um3hw2wg2569x');
DELETE FROM series WHERE id IN ('cmmxe73dq03a59esigk3gpgka','cmmxe73cx03a49esix2747d8n');

-- Batman - Lendas do Cavaleiro das Trevas - Neal Adams (Panini) (5 gibis)
UPDATE series SET title = 'Batman - Lendas do Cavaleiro das Trevas - Neal Adams (Panini)', total_editions = 5, updated_at = @now WHERE id = 'cmmxe73nm03ai9esicrpaihka';
UPDATE catalog_entries SET series_id = 'cmmxe73nm03ai9esicrpaihka', updated_at = @now WHERE id IN ('cmmwv2utz0o6mm3hwx9c4sl2z','cmmwv2uta0o6km3hwt5t6qmb7','cmmwv2usl0o6im3hw24kva5hp','cmmwv2urv0o6gm3hw09o9pp97','cmmwv2ur10o6em3hwnj3m6ga7');
DELETE FROM series WHERE id IN ('cmmxe73mu03ah9esif19jppxb','cmmxe73m703ag9esi9l7zw4xi','cmmxe73lk03af9esis2f8xuu2','cmmxe73ks03ae9esif13ufq9w');

-- Batman - O Último Cavaleiro da Terra - Livro (Panini) (3 gibis)
UPDATE series SET title = 'Batman - O Último Cavaleiro da Terra - Livro (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe72x5039j9esi4cd3dl85';
UPDATE catalog_entries SET series_id = 'cmmxe72x5039j9esi4cd3dl85', updated_at = @now WHERE id IN ('cmmwv2nkp0nrwm3hw6q2uy827','cmmwusway01yhm3hwoq0apndm','cmmwv2ng50nrum3hw3unwjmnj');
DELETE FROM series WHERE id IN ('cmmxe5ij201nq9esic8tb4ypf','cmmxe72wo039i9esimlfz553l');

-- Batman - Terra Um (Panini) (4 gibis)
UPDATE series SET title = 'Batman - Terra Um (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe5shs01yx9esi7ufktd7e';
UPDATE catalog_entries SET series_id = 'cmmxe5shs01yx9esi7ufktd7e', updated_at = @now WHERE id IN ('cmmwuuvq006vmm3hwk4l8mrsj','cmmwusah900fvm3hwx4vo3euz','cmmwuthk803evm3hwdf1yfelt','cmmwv2cbb0ne2m3hw897gs9n9');
DELETE FROM series WHERE id IN ('cmmxe5ak101e19esiojhr4pnx','cmmxe5n1t01t69esionc05num','cmmxe71of037s9esiwjnasvqw');

-- Batman (2017) (Panini) (13 gibis)
UPDATE series SET title = 'Batman (2017) (Panini)', total_editions = 13, updated_at = @now WHERE id = 'cmmxe8ah504mi9esi7nvnxnfe';
UPDATE catalog_entries SET series_id = 'cmmxe8ah504mi9esi7nvnxnfe', updated_at = @now WHERE id IN ('cmmwv85al03t4120n4eulg7v2','cmmwv859u03t2120ns1gtj1lm','cmmwv857503t0120nyfntij9y','cmmwv855603su120nfhjlcbxy','cmmwv855u03sw120n8tzf91d8','cmmwv856g03sy120nd7ma0mbb','cmmwv854a03ss120nilmmoeiw','cmmwv851803so120npitcrx06','cmmwv851u03sq120nrv39ox8b','cmmwv84zz03sk120nsyxmdxvp','cmmwv850l03sm120n0jn8gqd1','cmmwv84xf03si120nn4n0k0yt','cmmwv84ws03sg120nskqer4xg');
DELETE FROM series WHERE id IN ('cmmxe8aga04mh9esik7653au4','cmmxe8afh04mg9esivfhncjw2','cmmxe8acp04md9esizxb8dyzt','cmmxe8adk04me9esiaqsr4bbp','cmmxe8aej04mf9esi6ycpzgxp','cmmxe8ac804mc9esic6l5e25n','cmmxe8ab904ma9esio68xqnjz','cmmxe8abq04mb9esihc9xmoba','cmmxe8aa604m89esiluirt7fw','cmmxe8aaq04m99esiskl3vpx1','cmmxe8a9m04m79esib67rg419','cmmxe8a9504m69esixwyxyuat');

-- Batman (2025) (Panini) (8 gibis)
UPDATE series SET title = 'Batman (2025) (Panini)', total_editions = 8, updated_at = @now WHERE id = 'cmmxe81nn04dk9esiadht9egr';
UPDATE catalog_entries SET series_id = 'cmmxe81nn04dk9esiadht9egr', updated_at = @now WHERE id IN ('cmmwv7l9702ng120no7wptnw7','cmmwv79g101uy120nhrkp2k1h','cmmwv78sw01te120nhfu3p2rq','cmmwv789901rs120nae97n5sf','cmmwv77mt01pu120np85118am','cmmwv76sz01no120nol8h9ckd','cmmwv76p801ni120nfh4zzrr0','cmmwv75pl01lu120nvonx4c7h');
DELETE FROM series WHERE id IN ('cmmxe7uuj045e9esihsra6ngr','cmmxe7u6r044s9esiadtyldkz','cmmxe7tpm04489esirp49v7k5','cmmxe7t87043j9esiw076ilca','cmmxe7spo042s9esihbfh29pw','cmmxe7sne042p9esi0mpljvtk','cmmxe7s5904249esiev0txaz7');

-- Batman Vs. Robin (Panini) (5 gibis)
UPDATE series SET title = 'Batman Vs. Robin (Panini)', total_editions = 5, updated_at = @now WHERE id = 'cmmxe85gw04gr9esicfoaai4j';
UPDATE catalog_entries SET series_id = 'cmmxe85gw04gr9esicfoaai4j', updated_at = @now WHERE id IN ('cmmwv7pqw02xy120ns8q7f0m3','cmmwv7pcb02wu120nag6ud9vo','cmmwv7p1h02w2120nx0odqpc9','cmmwv7ogk02v0120nahbylqyd','cmmwv7o6k02uk120nit1f6we7');
DELETE FROM series WHERE id IN ('cmmxe857204gg9esi5o0rkv29','cmmxe852b04gb9esilvcapj7k','cmmxe84lu04fy9esisreab1a6','cmmxe84go04fu9esisav0o3f8');

-- Batman: A Hora Da Morte (Panini) (2 gibis)
UPDATE series SET title = 'Batman: A Hora Da Morte (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe85tx04h69esibuu89vom';
UPDATE catalog_entries SET series_id = 'cmmxe85tx04h69esibuu89vom', updated_at = @now WHERE id IN ('cmmwv7qax02zg120nuzhhjew9','cmmwv7pky02xi120nbk8xy8lu');
DELETE FROM series WHERE id IN ('cmmxe85bo04gl9esie7gvd7tj');

-- Batman: Além Do Ponto De Ignição (Panini) (4 gibis)
UPDATE series SET title = 'Batman: Além Do Ponto De Ignição (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe863n04hl9esiqzj60s3m';
UPDATE catalog_entries SET series_id = 'cmmxe863n04hl9esiqzj60s3m', updated_at = @now WHERE id IN ('cmmwv7qs7030s120ngbztr75b','cmmwv7q8s02za120nxpvmr0px','cmmwv7pmh02xm120nv1h2xd5x','cmmwv7oz602vw120n9aowj17y');
DELETE FROM series WHERE id IN ('cmmxe85sb04h49esi6gdcmvwg','cmmxe85dh04gn9esi2ewvdfs4','cmmxe84zb04g89esiod2bo7pj');

-- Batman: Gotham (Panini) (2 gibis)
UPDATE series SET title = 'Batman: Gotham (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7zhr04bp9esi440bcp4j';
UPDATE catalog_entries SET series_id = 'cmmxe7zhr04bp9esi440bcp4j', updated_at = @now WHERE id IN ('cmmwv7ibx02gq120npeolq91y','cmmwv7brm021g120ngxsf74af');
DELETE FROM series WHERE id IN ('cmmxe7w93047h9esi5637ly9v');

-- Batman: Gotham Knights - A Cidade Dourada (Panini) (2 gibis)
UPDATE series SET title = 'Batman: Gotham Knights - A Cidade Dourada (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe86e004hx9esiqk2ls6n2';
UPDATE catalog_entries SET series_id = 'cmmxe86e004hx9esiqk2ls6n2', updated_at = @now WHERE id IN ('cmmwv7rm0032o120n665zweet','cmmwv7qw10312120nuhahf17z');
DELETE FROM series WHERE id IN ('cmmxe864s04hn9esiyof2vr63');

-- Batman: Justiça Presente (Panini) (4 gibis)
UPDATE series SET title = 'Batman: Justiça Presente (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe812h04d49esihipmburb';
UPDATE catalog_entries SET series_id = 'cmmxe812h04d49esihipmburb', updated_at = @now WHERE id IN ('cmmwv7kaf02lg120nyjjz5i3h','cmmwv7j5l02iu120nvute0bph','cmmwv7inc02hk120nxoi3zsw9','cmmwv797a01ug120nw6foy0st');
DELETE FROM series WHERE id IN ('cmmxe801w04cc9esi27o3o47i','cmmxe7zpx04bz9esi77ebolvf','cmmxe7uo004569esi9h5b6nwh');

-- Batman: O Cavaleiro (Panini) (2 gibis)
UPDATE series SET title = 'Batman: O Cavaleiro (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe85yw04he9esirdfr593b';
UPDATE catalog_entries SET series_id = 'cmmxe85yw04he9esirdfr593b', updated_at = @now WHERE id IN ('cmmwv7qk00306120na6hrqowa','cmmwv7p0q02w0120nfb1hiys6');
DELETE FROM series WHERE id IN ('cmmxe851d04ga9esi102wt7qs');

-- Batman: O Último Dia Das Bruxas (Panini) (8 gibis)
UPDATE series SET title = 'Batman: O Último Dia Das Bruxas (Panini)', total_editions = 8, updated_at = @now WHERE id = 'cmmxe7uv7045f9esizg2y0hy7';
UPDATE catalog_entries SET series_id = 'cmmxe7uv7045f9esizg2y0hy7', updated_at = @now WHERE id IN ('cmmwv79ho01v2120n99iiir0p','cmmwv790b01u0120n9r3b7wev','cmmwv78sa01tc120nr04awo1u','cmmwv77t801qe120notuwaly9','cmmwv77gf01pb120nwcplzvff','cmmwv775w01ol120nraps4w4b','cmmwv76ju01na120nimey1j7a','cmmwv75kp01lg120n11aphghl');
DELETE FROM series WHERE id IN ('cmmxe7uhf04519esibkyuofl6','cmmxe7u5t044r9esit2ncbiwy','cmmxe7tce043r9esiar8nkf2x','cmmxe7t3g043b9esitec08eet','cmmxe7syk04339esisz1ahgvt','cmmxe7sku042m9esi4pseqrvv','cmmxe7s01041y9esifgcuefhf');

-- Batman: Silêncio (Panini) (3 gibis)
UPDATE series SET title = 'Batman: Silêncio (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe888p04jj9esi6y5vh83i';
UPDATE catalog_entries SET series_id = 'cmmxe888p04jj9esi6y5vh83i', updated_at = @now WHERE id IN ('cmmwv7wle03dk120nqib91u9b','cmmwv77x001qq120nkawqqrkk','cmmwv77ka01pm120n7cla27e7');
DELETE FROM series WHERE id IN ('cmmxe7te4043u9esi2hl9e474','cmmxe7t5q043f9esiitr3akmj');

-- Batman/Superman: Os Melhores Do Mundo (2025) (Panini) (7 gibis)
UPDATE series SET title = 'Batman/Superman: Os Melhores Do Mundo (2025) (Panini)', total_editions = 7, updated_at = @now WHERE id = 'cmmxe7v0y045o9esib9saos85';
UPDATE catalog_entries SET series_id = 'cmmxe7v0y045o9esib9saos85', updated_at = @now WHERE id IN ('cmmwv79pb01vo120nvdhjpq5x','cmmwv78tj01tg120ny58ky9y7','cmmwv787x01ro120nusphusjn','cmmwv77m601ps120n8w8tlqyf','cmmwv776m01on120ndxcpnr05','cmmwv76qa01nk120nzpmtmatl','cmmwv75oq01ls120njtkhel3o');
DELETE FROM series WHERE id IN ('cmmxe7u7o044t9esiufpaacbt','cmmxe7tot04479esigs1ujr54','cmmxe7t7n043i9esi2ysf31m1','cmmxe7sz904349esifohxtnwl','cmmxe7soc042q9esiga8xc8iu','cmmxe7s4c04239esiv8tw6ku0');

-- Bela Casa do Lago (Panini) (2 gibis)
UPDATE series SET title = 'Bela Casa do Lago (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe76yz03ed9esiuytds4on';
UPDATE catalog_entries SET series_id = 'cmmxe76yz03ed9esiuytds4on', updated_at = @now WHERE id IN ('cmmwv3if00ptqm3hwxfmo387u','cmmwv3ie90ptom3hw5ee956kk');
DELETE FROM series WHERE id IN ('cmmxe76ya03ec9esibneu6agl');

-- Biblioteca Histórica Marvel - Homem-Aranha (Panini) (4 gibis)
UPDATE series SET title = 'Biblioteca Histórica Marvel - Homem-Aranha (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe6nl302rm9esi8jktnaag';
UPDATE catalog_entries SET series_id = 'cmmxe6nl302rm9esi8jktnaag', updated_at = @now WHERE id IN ('cmmwuzn0r0hbwm3hwh85p4ri5','cmmwuzn040hbum3hw3j86izoa','cmmwuzmzf0hbsm3hweexkcm5q','cmmwuz8ld0gjym3hwg33jpsh5');
DELETE FROM series WHERE id IN ('cmmxe6nk802rl9esiypnz55a4','cmmxe6njf02rk9esien0eithc','cmmxe6n6302r59esi2smiqb8i');

-- Biblioteca Histórica Marvel - Invencível Homem de Ferro (Panini) (2 gibis)
UPDATE series SET title = 'Biblioteca Histórica Marvel - Invencível Homem de Ferro (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6mct02pw9esi68gaws68';
UPDATE catalog_entries SET series_id = 'cmmxe6mct02pw9esi68gaws68', updated_at = @now WHERE id IN ('cmmwuyxr80fsqm3hwewkrknrr','cmmwuyxqj0fsom3hwaiu0mihw');
DELETE FROM series WHERE id IN ('cmmxe6mbx02pv9esiixa7g6mv');

-- Biblioteca Histórica Marvel - Surfista Prateado (Panini) (2 gibis)
UPDATE series SET title = 'Biblioteca Histórica Marvel - Surfista Prateado (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6tc702z59esi5vr5bqmt';
UPDATE catalog_entries SET series_id = 'cmmxe6tc702z59esi5vr5bqmt', updated_at = @now WHERE id IN ('cmmwv0n7k0jt2m3hw0hh5opze','cmmwv06pj0incm3hw5pqbp0tr');
DELETE FROM series WHERE id IN ('cmmxe6rnb02wv9esidryymkw5');

-- Biblioteca Histórica Marvel - Vingadores (Panini) (2 gibis)
UPDATE series SET title = 'Biblioteca Histórica Marvel - Vingadores (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6ve8031d9esix7wdzbbg';
UPDATE catalog_entries SET series_id = 'cmmxe6ve8031d9esix7wdzbbg', updated_at = @now WHERE id IN ('cmmwv0ytf0knim3hw3bt3qrb5','cmmwv0yss0kngm3hwjqeifnyg');
DELETE FROM series WHERE id IN ('cmmxe6vdb031c9esidoa5tdqv');

-- Biblioteca Histórica Marvel - X-Men (Panini) (3 gibis)
UPDATE series SET title = 'Biblioteca Histórica Marvel - X-Men (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe6yrx034v9esid0srjfm7';
UPDATE catalog_entries SET series_id = 'cmmxe6yrx034v9esid0srjfm7', updated_at = @now WHERE id IN ('cmmwv1qk80m66m3hwezjfnael','cmmwv1qi60m64m3hw8wsogrqu','cmmwv1qgh0m62m3hwpzr4hypb');
DELETE FROM series WHERE id IN ('cmmxe6yr1034u9esi7ccuggcm','cmmxe6yqb034t9esikb86ym1p');

-- Bloodshot Renascido (Jambô) (2 gibis)
UPDATE series SET title = 'Bloodshot Renascido (Jambô)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5h2101ma9esirxd3oht9';
UPDATE catalog_entries SET series_id = 'cmmxe5h2101ma9esirxd3oht9', updated_at = @now WHERE id IN ('cmmwust5w01r5m3hwgiqf05yi','cmmwuxhx20c97m3hwgaermhmm');
DELETE FROM series WHERE id IN ('cmmxe6d9002hq9esija9jahje');

-- Bone (Todavia) (3 gibis)
UPDATE series SET title = 'Bone (Todavia)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5j1e01oh9esi8m1jj85s';
UPDATE catalog_entries SET series_id = 'cmmxe5j1e01oh9esi8m1jj85s', updated_at = @now WHERE id IN ('cmmwusyyf024rm3hwsfkdio63','cmmwusyxi024pm3hwygcpnj7r','cmmwuxiwr0cbjm3hwpug9azs4');
DELETE FROM series WHERE id IN ('cmmxe5j0v01og9esih8hd6ab3','cmmxe6dvt02i99esi9j58k2ka');

-- Caçada Sangrenta - Tarja Vermelha (Panini) (3 gibis)
UPDATE series SET title = 'Caçada Sangrenta - Tarja Vermelha (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe7h4o03pn9esi2sw64cg1';
UPDATE catalog_entries SET series_id = 'cmmxe7h4o03pn9esi2sw64cg1', updated_at = @now WHERE id IN ('cmmwv4nxv0sd5m3hwpahabuad','cmmwv4nm30sc5m3hwt2t0kqxt','cmmwv6oit00dv120npboiddny');
DELETE FROM series WHERE id IN ('cmmxe7gzu03pe9esipl3wbbz8','cmmxe7koe03u39esixxp6ldrp');

-- Caçada Sangrenta (Panini) (3 gibis)
UPDATE series SET title = 'Caçada Sangrenta (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe7h5503po9esia1f8miyn';
UPDATE catalog_entries SET series_id = 'cmmxe7h5503po9esia1f8miyn', updated_at = @now WHERE id IN ('cmmwv4nyl0sd7m3hw6kr41wky','cmmwv4nnc0sc9m3hw7ewhakvo','cmmwv4n850sb7m3hwzj8ziobv');
DELETE FROM series WHERE id IN ('cmmxe7h1103pg9esikthfdl3v','cmmxe7gu003p49esicydyi6gy');

-- Capitão América: Steve Rogers (Panini) (2 gibis)
UPDATE series SET title = 'Capitão América: Steve Rogers (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7m7w03w49esicvwkgnhk';
UPDATE catalog_entries SET series_id = 'cmmxe7m7w03w49esicvwkgnhk', updated_at = @now WHERE id IN ('cmmwv6sct00o1120nhq54a8vp','cmmwv6mtf0095120neav00lv8');
DELETE FROM series WHERE id IN ('cmmxe7kak03tj9esigpg8o9ms');

-- Cinema Purgatório (Panini) (6 gibis)
UPDATE series SET title = 'Cinema Purgatório (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe5k7n01pf9esij7zut05k';
UPDATE catalog_entries SET series_id = 'cmmxe5k7n01pf9esij7zut05k', updated_at = @now WHERE id IN ('cmmwut3j702g7m3hwklfb89vk','cmmwut3i902g5m3hw6rjrjchj','cmmwusw2q01xvm3hwsmohb5ub','cmmwuxim50catm3hw0ree0go2','cmmwuxil90carm3hwbyn235jq','cmmwusw1t01xtm3hwtxeas3ij');
DELETE FROM series WHERE id IN ('cmmxe5k6s01pe9esif7xw2ips','cmmxe5ig201nn9esil203f3lj','cmmxe6dih02hy9esiaf838ccq','cmmxe6dhi02hx9esic5d3nno1','cmmxe5if601nm9esiktnyv5y7');

-- Círculo de Júpiter (Panini) (2 gibis)
UPDATE series SET title = 'Círculo de Júpiter (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5gui01lw9esi5nb0c4tx';
UPDATE catalog_entries SET series_id = 'cmmxe5gui01lw9esi5nb0c4tx', updated_at = @now WHERE id IN ('cmmwusrdh01mfm3hws63anyts','cmmwuxhj40c8dm3hwetgvcnvt');
DELETE FROM series WHERE id IN ('cmmxe6cqh02hc9esihq664h5d');

-- Conan - A Lenda (Mythos) (3 gibis)
UPDATE series SET title = 'Conan - A Lenda (Mythos)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5h1h01m99esi3r1tk6mz';
UPDATE catalog_entries SET series_id = 'cmmxe5h1h01m99esi3r1tk6mz', updated_at = @now WHERE id IN ('cmmwust5601r3m3hwusrgiawn','cmmwuxhw30c95m3hwxmznam3x','cmmwust4h01r1m3hw8e2qug7g');
DELETE FROM series WHERE id IN ('cmmxe6d7002hp9esikanqx5q5','cmmxe5h0y01m89esihs2umfpf');

-- Conan - As Tiras de Jornal (Panini) (2 gibis)
UPDATE series SET title = 'Conan - As Tiras de Jornal (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6kni02nu9esih5o22xwr';
UPDATE catalog_entries SET series_id = 'cmmxe6kni02nu9esih5o22xwr', updated_at = @now WHERE id IN ('cmmwuyn1i0f22m3hws6ddhcay','cmmwusg1400uom3hwjzx76f7j');
DELETE FROM series WHERE id IN ('cmmxe5bz301g69esieu6al2ad');

-- Conan - Edição Histórica (Mythos) (3 gibis)
UPDATE series SET title = 'Conan - Edição Histórica (Mythos)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe6fdi02j99esi48zlbvvk';
UPDATE catalog_entries SET series_id = 'cmmxe6fdi02j99esi48zlbvvk', updated_at = @now WHERE id IN ('cmmwuxke30cffm3hw7em80kmw','cmmwuxkdb0cfdm3hwu6iaeiud','cmmwuxkcc0cfbm3hw8f4yp52v');
DELETE FROM series WHERE id IN ('cmmxe6fbx02j89esi46jwqiw5','cmmxe6faz02j79esi63ndeofe');

-- Conan - O Bárbaro - A Espada Selvagem em Cores (Panini) (2 gibis)
UPDATE series SET title = 'Conan - O Bárbaro - A Espada Selvagem em Cores (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6kmb02ns9esih4jsty1q';
UPDATE catalog_entries SET series_id = 'cmmxe6kmb02ns9esih4jsty1q', updated_at = @now WHERE id IN ('cmmwuymn30f0ym3hwa6j7jy3i','cmmwuymma0f0wm3hwosrbf847');
DELETE FROM series WHERE id IN ('cmmxe6klp02nr9esi6ywcvjor');

-- Conan - O Bárbaro - Omnibus - A Era Marvel (Panini) (6 gibis)
UPDATE series SET title = 'Conan - O Bárbaro - Omnibus - A Era Marvel (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe6kq902nz9esin4vg9u4x';
UPDATE catalog_entries SET series_id = 'cmmxe6kq902nz9esin4vg9u4x', updated_at = @now WHERE id IN ('cmmwuyns80f3ym3hwk2x8ul5e','cmmwusvw401xhm3hw6x107rgc','cmmwuyn300f26m3hw396kd4m6','cmmwuyn250f24m3hwmhmq9fzx','cmmwusmrv01bfm3hw52lzlk2i','cmmwuymkx0f0sm3hwsnpeyxpp');
DELETE FROM series WHERE id IN ('cmmxe5idi01nk9esig8mx1256','cmmxe6koo02nw9esi64j5stpx','cmmxe6ko302nv9esi7pbtb9b6','cmmxe5ext01jb9esi92buhfs5','cmmxe6kkh02np9esi39n2mv2s');

-- Conan o Cimério - V. (Conrad) (2 gibis)
UPDATE series SET title = 'Conan o Cimério - V. (Conrad)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6ku202o69esibj9tg7sw';
UPDATE catalog_entries SET series_id = 'cmmxe6ku202o69esibj9tg7sw', updated_at = @now WHERE id IN ('cmmwuyqwd0fbsm3hwdf6zt6mu','cmmwuyqvp0fbqm3hwt7z2b4ay');
DELETE FROM series WHERE id IN ('cmmxe6ktj02o59esi2cd5pmk9');

-- Conan Omnibus (Mythos) (8 gibis)
UPDATE series SET title = 'Conan Omnibus (Mythos)', total_editions = 8, updated_at = @now WHERE id = 'cmmxe6d6702ho9esixgmklhcx';
UPDATE catalog_entries SET series_id = 'cmmxe6d6702ho9esixgmklhcx', updated_at = @now WHERE id IN ('cmmwuxhv50c93m3hwxmdt9d6v','cmmwuymji0f0om3hwdchkankl','cmmwuymim0f0mm3hwylmc665x','cmmwuymhu0f0km3hw6hzllmzv','cmmwuymh30f0im3hwwvj0yel7','cmmwuymgd0f0gm3hwbfhqmxhv','cmmwuymfm0f0em3hwr9cwecjn','cmmwuxebr0c0pm3hww86ccogv');
DELETE FROM series WHERE id IN ('cmmxe6kjw02no9esirt9x7gwk','cmmxe6kjb02nn9esidthrrp8x','cmmxe6kio02nm9esieowhcm2i','cmmxe6khs02nl9esi8z34jch0','cmmxe6kgv02nk9esi0wxv6v3a','cmmxe6kg102nj9esi6pd6hzvw','cmmxe69h102eq9esi121dkhj6');

-- Conan, O Bárbaro (2024) (Panini) (11 gibis)
UPDATE series SET title = 'Conan, O Bárbaro (2024) (Panini)', total_editions = 11, updated_at = @now WHERE id = 'cmmxe8e9u04qa9esi1qrilvt3';
UPDATE catalog_entries SET series_id = 'cmmxe8e9u04qa9esi1qrilvt3', updated_at = @now WHERE id IN ('cmmwv8ews04g2120nl6pchftm','cmmwv8evd04fy120nh2agnoo1','cmmwv8euo04fw120nacq62upd','cmmwv8b8h0476120nmojukvef','cmmwv8anr045i120np53xd32n','cmmwv8acm044m120nwuf6bl15','cmmwv89p8042q120nebbykvtr','cmmwv8en404fa120nxfl6zsi2','cmmwv88vo040m120nk31wqlch','cmmwv88k803zs120nn5qaiwl5','cmmwv87k003xi120nr9ad9675');
DELETE FROM series WHERE id IN ('cmmxe8e9c04q99esik4cbf45j','cmmxe8e8v04q89esicc822qlk','cmmxe8df104oz9esithx3lunv','cmmxe8d9f04os9esiqsskc6gk','cmmxe8d5f04on9esidwv4d96m','cmmxe8cv504ob9esijptquilu','cmmxe8e7r04q69esi094n01ky','cmmxe8ckd04ny9esitlq84m69','cmmxe8chd04nt9esil1arw6zx','cmmxe8c4y04nd9esi0uyuaknj');

-- Contos de Magic (Planeta DeAgostini) (40 gibis)
UPDATE series SET title = 'Contos de Magic (Planeta DeAgostini)', total_editions = 40, updated_at = @now WHERE id = 'cmmxe5gh501le9esiw8ychasg';
UPDATE catalog_entries SET series_id = 'cmmxe5gh501le9esiw8ychasg', updated_at = @now WHERE id IN ('cmmwusq6401jfm3hw8b5wbgi7','cmmwuxhfw0c85m3hwemu4hss4','cmmwuxhf50c83m3hwkcbnw3r8','cmmwuxhee0c81m3hw2gfksig6','cmmwuxhdl0c7zm3hwqevgnu4r','cmmwuxhcs0c7xm3hw96o3txj3','cmmwuxhc20c7vm3hw5zjvlwon','cmmwuxhb70c7tm3hwejr9o5yv','cmmwuxhad0c7rm3hw2icdsqqc','cmmwuxh9m0c7pm3hwyv35g2um','cmmwuxh8w0c7nm3hwnskh5hqn','cmmwuxh820c7lm3hwoqo9cc1z','cmmwuxh7d0c7jm3hwygzxntqy','cmmwuxh6n0c7hm3hwc8t9d6z6','cmmwuxh5v0c7fm3hwi2ptoh20','cmmwuxh540c7dm3hw7g3ln5ud','cmmwuxh4c0c7bm3hwyy80m89o','cmmwuxh3o0c79m3hw8avoxzyb','cmmwuxh310c77m3hwvjgt4pr0','cmmwuxh290c75m3hwntxmgrya','cmmwuxh1g0c73m3hwk4khff63','cmmwuxh0n0c71m3hwk9mk9ekd','cmmwuxgzw0c6zm3hwu0ccs2fm','cmmwuxgz30c6xm3hwzko3j2o3','cmmwuxgyb0c6vm3hwmmqwmf0h','cmmwuxgxl0c6tm3hwr8bkty2k','cmmwuxgww0c6rm3hw3fi57gmg','cmmwuxgw40c6pm3hwdt0dyuho','cmmwuxgvd0c6nm3hwy27zagoq','cmmwuxgum0c6lm3hwb4p9v4vn','cmmwuxgtu0c6jm3hw56nz0wx7','cmmwuxgt40c6hm3hw90f4rsgd','cmmwuxgse0c6fm3hw30cjplt2','cmmwuxgrk0c6dm3hw6js9uyou','cmmwuxgqu0c6bm3hwilkpnd2e','cmmwuxgq50c69m3hwjssl83aw','cmmwuxgpe0c67m3hwqj6okvbj','cmmwuxgom0c65m3hwkb4fr9io','cmmwuxgnx0c63m3hw22oujtbn','cmmwuxgn70c61m3hwqjhgrh5i');
DELETE FROM series WHERE id IN ('cmmxe6cnd02hb9esic0ps7xu9','cmmxe6clg02ha9esikq5hslwv','cmmxe6cil02h99esi8kp8c4ia','cmmxe6ce802h89esiq26iaok4','cmmxe6cbn02h79esinzm8mbq4','cmmxe6c8902h69esivf06si2d','cmmxe6c7d02h59esi7cv6wmt0','cmmxe6c5c02h49esi7vypovg4','cmmxe6c2z02h39esiv01z0gv2','cmmxe6c1m02h29esibcrgxo7e','cmmxe6c0402h19esi8qfth6wg','cmmxe6bxn02h09esi64i8ad26','cmmxe6bwc02gz9esiebbfc4ns','cmmxe6bvh02gy9esieqk3kmmy','cmmxe6bud02gx9esiqyhez08w','cmmxe6brx02gw9esimk3udexn','cmmxe6br302gv9esil9sppw66','cmmxe6bqg02gu9esitljkjkad','cmmxe6bom02gt9esiyc5a8kru','cmmxe6bo102gs9esidi6dblmz','cmmxe6bnc02gr9esiuioc1cdb','cmmxe6blk02gq9esiqembltp5','cmmxe6bkz02gp9esi0fgbpomd','cmmxe6bke02go9esiyxqq28cj','cmmxe6biq02gn9esiichxp0cc','cmmxe6bi602gm9esi6c8qeaue','cmmxe6bhl02gl9esicz0ydhy2','cmmxe6bh202gk9esi1ihlc6io','cmmxe6bfb02gj9esiz26p8st2','cmmxe6bes02gi9esijxtmgnqc','cmmxe6bd002gh9esizci6w2a8','cmmxe6bcj02gg9esirg72tkq0','cmmxe6bc002gf9esi2e5x2wlx','cmmxe6bbk02ge9esiaklfs1su','cmmxe6b9w02gd9esijt61nc4h','cmmxe6b9b02gc9esi1myrl3b7','cmmxe6b8m02gb9esi1ivu2z44','cmmxe6b6u02ga9esi9ydhxyd5','cmmxe6b6202g99esi1hv2rv7t');

-- Coração do Império (Pixel) (2 gibis)
UPDATE series SET title = 'Coração do Império (Pixel)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe63w102ak9esic4tppkeo';
UPDATE catalog_entries SET series_id = 'cmmxe63w102ak9esic4tppkeo', updated_at = @now WHERE id IN ('cmmwux5g10bg7m3hwuvqboz7b','cmmwux5fa0bg5m3hw2f9sfr7z');
DELETE FROM series WHERE id IN ('cmmxe63vj02aj9esi8n3el30z');

-- Coringa e Arlequina - Sanidade Criminosa (Panini) (3 gibis)
UPDATE series SET title = 'Coringa e Arlequina - Sanidade Criminosa (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe783d03fh9esipbm1a7il';
UPDATE catalog_entries SET series_id = 'cmmxe783d03fh9esipbm1a7il', updated_at = @now WHERE id IN ('cmmwv3l800q0um3hwuky46rfg','cmmwv3l610q0sm3hwixl8yt2t','cmmwusrby01mbm3hwovtvyh0h');
DELETE FROM series WHERE id IN ('cmmxe782n03fg9esiv4ciooys','cmmxe5gte01lu9esi1fbz2i29');

-- Coringa: Operação Babá (Panini) (3 gibis)
UPDATE series SET title = 'Coringa: Operação Babá (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe80yg04d09esilxpb831z';
UPDATE catalog_entries SET series_id = 'cmmxe80yg04d09esilxpb831z', updated_at = @now WHERE id IN ('cmmwv7k6102l6120nmedvv6cj','cmmwv7j4w02is120nyfhwqufp','cmmwv7ike02hc120ng6tsfv41');
DELETE FROM series WHERE id IN ('cmmxe800m04cb9esiadm5u2mb','cmmxe7znf04bw9esilkw006ry');

-- Corporação Batman (Panini) (4 gibis)
UPDATE series SET title = 'Corporação Batman (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe71ar037h9esi9usfl9q5';
UPDATE catalog_entries SET series_id = 'cmmxe71ar037h9esi9usfl9q5', updated_at = @now WHERE id IN ('cmmwv2b3v0nb2m3hwdxm114k6','cmmwv2b350nb0m3hw64oveeug','cmmwv2b2e0naym3hwyk32aob0','cmmwuurdd06m2m3hwdig7yfpm');
DELETE FROM series WHERE id IN ('cmmxe719u037g9esix8jd61du','cmmxe718w037f9esiekx7ggmc','cmmxe5sbm01yq9esiftfr3hma');

-- Criminal (Panini) (2 gibis)
UPDATE series SET title = 'Criminal (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6p6x02tw9esimlt3nj6c';
UPDATE catalog_entries SET series_id = 'cmmxe6p6x02tw9esimlt3nj6c', updated_at = @now WHERE id IN ('cmmwv00190i5cm3hwgzar2yq4','cmmwv0n6b0jsym3hwskx36qb7');
DELETE FROM series WHERE id IN ('cmmxe6tan02z39esi7z1r6lzc');

-- Crise Sombria (Panini) (2 gibis)
UPDATE series SET title = 'Crise Sombria (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe85xp04hc9esinp8k6p4b';
UPDATE catalog_entries SET series_id = 'cmmxe85xp04hc9esinp8k6p4b', updated_at = @now WHERE id IN ('cmmwv7qij0302120nn4fykyot','cmmwv7q2a02yu120n141gzpfo');
DELETE FROM series WHERE id IN ('cmmxe85o704gz9esijulhgbec');

-- Crise Sombria Nas Infinitas Terras (Panini) (4 gibis)
UPDATE series SET title = 'Crise Sombria Nas Infinitas Terras (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe85cj04gm9esis7cpz7w3';
UPDATE catalog_entries SET series_id = 'cmmxe85cj04gm9esis7cpz7w3', updated_at = @now WHERE id IN ('cmmwv7plq02xk120nwich1mc7','cmmwv7paj02wq120nhj9iug1s','cmmwv7ozy02vy120nzdrln2oq','cmmwv7ocb02uu120ne1tb7rx8');
DELETE FROM series WHERE id IN ('cmmxe856504gf9esij6hpwaaa','cmmxe850904g99esiv0kvdans','cmmxe84jh04fw9esijhouen33');

-- Crônicas de Conan (Mythos) (4 gibis)
UPDATE series SET title = 'Crônicas de Conan (Mythos)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe6fmk02jd9esixe0oje68';
UPDATE catalog_entries SET series_id = 'cmmxe6fmk02jd9esixe0oje68', updated_at = @now WHERE id IN ('cmmwuxkha0cfnm3hw9nh4fgrf','cmmwuxkgh0cflm3hwtpks2c41','cmmwuxkfl0cfjm3hwb0u0ti01','cmmwuxkev0cfhm3hw35jtuedg');
DELETE FROM series WHERE id IN ('cmmxe6fjh02jc9esiu8v1ksml','cmmxe6fhb02jb9esisqiufadb','cmmxe6ffv02ja9esi60rq04f4');

-- Crônicas de Excalibur (Mythos) (2 gibis)
UPDATE series SET title = 'Crônicas de Excalibur (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5fvs01kp9esi3eydivkx';
UPDATE catalog_entries SET series_id = 'cmmxe5fvs01kp9esi3eydivkx', updated_at = @now WHERE id IN ('cmmwuspg601hrm3hw3rfl3mkd','cmmwuspyg01izm3hwdzzwtfsr');
DELETE FROM series WHERE id IN ('cmmxe5gac01l69esi8wb1esce');

-- Crossed (Panini) (4 gibis)
UPDATE series SET title = 'Crossed (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe6efe02im9esi2u1jqrps';
UPDATE catalog_entries SET series_id = 'cmmxe6efe02im9esi2u1jqrps', updated_at = @now WHERE id IN ('cmmwuxjty0cdxm3hwvf8l1l2h','cmmwuxjt50cdvm3hwmtf7y065','cmmwuxjsi0cdtm3hw4f8zoazk','cmmwuxhjw0c8fm3hwmsh6ze01');
DELETE FROM series WHERE id IN ('cmmxe6ed702il9esijrspvm6b','cmmxe6ebn02ik9esitwbutdcs','cmmxe6cri02hd9esiypsk6d50');

-- Danger Girl (Devir) (2 gibis)
UPDATE series SET title = 'Danger Girl (Devir)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe63uz02ai9esi6bs7uv52';
UPDATE catalog_entries SET series_id = 'cmmxe63uz02ai9esi6bs7uv52', updated_at = @now WHERE id IN ('cmmwux5ei0bg3m3hw0dek82n0','cmmwuxqry0ctvm3hwnc4i8t1t');
DELETE FROM series WHERE id IN ('cmmxe6hos02l29esicy66vijp');

-- DC Vs. Vampiros (Panini) (6 gibis)
UPDATE series SET title = 'DC Vs. Vampiros (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe5d1701gz9esihjnwwqtt';
UPDATE catalog_entries SET series_id = 'cmmxe5d1701gz9esihjnwwqtt', updated_at = @now WHERE id IN ('cmmwush6600xcm3hwjtq9j9fw','cmmwush5h00xam3hw1lot0p92','cmmwv3i870pt8m3hwlzeun226','cmmwv7qbo02zi120ng0oytqhu','cmmwv7kuq02mi120nxvcafelb','cmmwv7ixf02ic120ngzkrdjcq');
DELETE FROM series WHERE id IN ('cmmxe5d0c01gy9esifuait2yx','cmmxe76wu03e99esihdsfunrf','cmmxe85ul04h79esiqyl3aoz5','cmmxe81cj04de9esilzjjhjad','cmmxe7zxu04c89esiz07rxvce');

-- DC X Sonic (Panini) (3 gibis)
UPDATE series SET title = 'DC X Sonic (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe826m04dz9esie569hgs9';
UPDATE catalog_entries SET series_id = 'cmmxe826m04dz9esie569hgs9', updated_at = @now WHERE id IN ('cmmwv7lly02oe120nquhfe16d','cmmwv7apl01yk120nuktm6khp','cmmwv7ahs01y0120noczzdq7c');
DELETE FROM series WHERE id IN ('cmmxe7vfw046i9esix74fa8ol','cmmxe7vdz046e9esin4z79i0u');

-- Deadpool (2023) (Panini) (2 gibis)
UPDATE series SET title = 'Deadpool (2023) (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7l1d03ut9esibms2e946';
UPDATE catalog_entries SET series_id = 'cmmxe7l1d03ut9esibms2e946', updated_at = @now WHERE id IN ('cmmwv6pj600gv120n815qhj3h','cmmwv4rdq0slxm3hw5t1q8cur');
DELETE FROM series WHERE id IN ('cmmxe7iqq03ri9esimqfh54ek');

-- Deadpool (2025) (Panini) (10 gibis)
UPDATE series SET title = 'Deadpool (2025) (Panini)', total_editions = 10, updated_at = @now WHERE id = 'cmmxe7f5e03o09esiecyh8i7o';
UPDATE catalog_entries SET series_id = 'cmmxe7f5e03o09esiecyh8i7o', updated_at = @now WHERE id IN ('cmmwv4lw20s7pm3hwn4ou9ibx','cmmwv4lep0s6rm3hww1jectqx','cmmwv4kss0s5jm3hwj8y2xc67','cmmwv4jse0s2zm3hwm6sjgbov','cmmwv4jee0s1vm3hwfe19axkn','cmmwv4imb0rzhm3hwt6lmce55','cmmwv4i150ry3m3hwyw2slx7n','cmmwv4hhi0rx7m3hwcpdmjqdh','cmmwv4gqo0rvkm3hwyimjkkgn','cmmwv4g790ru6m3hw12cuo3st');
DELETE FROM series WHERE id IN ('cmmxe7ese03nq9esid0sv94wf','cmmxe7elk03nf9esil53b98hz','cmmxe7e2r03mp9esia4wqaw95','cmmxe7dta03me9esi24hi0wsb','cmmxe7d7g03lr9esi7u6o5zk3','cmmxe7cy203ld9esit6qghrz6','cmmxe7cps03l19esiov5qwyhj','cmmxe7c7v03ki9esinc6p7guz','cmmxe7bgn03k19esi0ky769hi');

-- Demolidor - Fim dos Dias (Panini) (3 gibis)
UPDATE series SET title = 'Demolidor - Fim dos Dias (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5pv201w29esiy56su8gb';
UPDATE catalog_entries SET series_id = 'cmmxe5pv201w29esiy56su8gb', updated_at = @now WHERE id IN ('cmmwutu6q049tm3hwp3khge5k','cmmwuyt2c0fh6m3hwjh07yxb0','cmmwus9cr00d3m3hwwz8y4q6b');
DELETE FROM series WHERE id IN ('cmmxe6ldd02ou9esi8bafmcwi','cmmxe5a6901dl9esi7xzft73f');

-- Demolidor por Frank Miller e Klaus Janson (Panini) (3 gibis)
UPDATE series SET title = 'Demolidor por Frank Miller e Klaus Janson (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe6lbl02os9esie1qprils';
UPDATE catalog_entries SET series_id = 'cmmxe6lbl02os9esie1qprils', updated_at = @now WHERE id IN ('cmmwuysoh0fgim3hwi5dtao59','cmmwuysn50fggm3hwg0ml40k6','cmmwuysm50fgem3hwg61tpcuc');
DELETE FROM series WHERE id IN ('cmmxe6lap02or9esid0f16xzx','cmmxe6l9t02oq9esihskidf0a');

-- Despertar - Parte (Panini) (2 gibis)
UPDATE series SET title = 'Despertar - Parte (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5vbw022d9esioin48v18';
UPDATE catalog_entries SET series_id = 'cmmxe5vbw022d9esioin48v18', updated_at = @now WHERE id IN ('cmmwuvtep08pbm3hw1l8ugohx','cmmwuwkni0a2dm3hw1nm954yb');
DELETE FROM series WHERE id IN ('cmmxe60mc027m9esi4hsgwtv2');

-- Doutor Estranho (2023) (Panini) (2 gibis)
UPDATE series SET title = 'Doutor Estranho (2023) (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7kc203tl9esiv8c8ah5a';
UPDATE catalog_entries SET series_id = 'cmmxe7kc203tl9esiv8c8ah5a', updated_at = @now WHERE id IN ('cmmwv6myy009j120nlpv0rlur','cmmwv6lbd005p120ne7k5e28z');
DELETE FROM series WHERE id IN ('cmmxe7jqk03st9esi1ovgfg52');

-- Doutor Estranho (2024) (Panini) (4 gibis)
UPDATE series SET title = 'Doutor Estranho (2024) (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe7jd403sc9esi3ay2b8x4';
UPDATE catalog_entries SET series_id = 'cmmxe7jd403sc9esi3ay2b8x4', updated_at = @now WHERE id IN ('cmmwv4tey0sq5m3hwo7ef31pi','cmmwv4qvx0skjm3hwi3dxvrzy','cmmwv4oqv0setm3hw17vjkvjc','cmmwv4n3w0savm3hwipmcj659');
DELETE FROM series WHERE id IN ('cmmxe7ib003r39esihqwfc79u','cmmxe7hab03px9esig7a66w8e','cmmxe7gpp03oz9esib94wi9jn');

-- Duende Vermelho (Panini) (2 gibis)
UPDATE series SET title = 'Duende Vermelho (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7jit03sj9esi92vt5zv3';
UPDATE catalog_entries SET series_id = 'cmmxe7jit03sj9esi92vt5zv3', updated_at = @now WHERE id IN ('cmmwv4tlz0sqpm3hwzh2toc0l','cmmwv4p6w0sfzm3hwo3vujvwx');
DELETE FROM series WHERE id IN ('cmmxe7hil03q59esidi7i3eji');

-- Elfos (Mythos) (2 gibis)
UPDATE series SET title = 'Elfos (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5kwh01qd9esiudvh2yza';
UPDATE catalog_entries SET series_id = 'cmmxe5kwh01qd9esiudvh2yza', updated_at = @now WHERE id IN ('cmmwut5eh02k3m3hw2pyhbnnw','cmmwut4ps02j1m3hwi92j1fbu');
DELETE FROM series WHERE id IN ('cmmxe5kmd01py9esi6nayvnff');

-- Elric (Mythos) (2 gibis)
UPDATE series SET title = 'Elric (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5kvz01qc9esi1g2je8p0';
UPDATE catalog_entries SET series_id = 'cmmxe5kvz01qc9esi1g2je8p0', updated_at = @now WHERE id IN ('cmmwut5dl02k1m3hwxme3nqrx','cmmwuxglx0c5xm3hwxxo61m7n');
DELETE FROM series WHERE id IN ('cmmxe6b4n02g79esicb9absid');

-- Escalpo - Livro (Panini) (3 gibis)
UPDATE series SET title = 'Escalpo - Livro (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe88r504k99esiivw3vzc0';
UPDATE catalog_entries SET series_id = 'cmmxe88r504k99esiivw3vzc0', updated_at = @now WHERE id IN ('cmmwv7yne03h8120nmrgdtmh8','cmmwv80ye03lg120nct2i42u3','cmmwv80xp03le120nydxkpfbh');
DELETE FROM series WHERE id IN ('cmmxe89hh04l89esi5jh6esn7','cmmxe89gq04l79esidgbm30xe');

-- Espetacular Homem-Aranha - Corredor Polonês (Panini) (2 gibis)
UPDATE series SET title = 'Espetacular Homem-Aranha - Corredor Polonês (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6mmz02qc9esiop7g4rb4';
UPDATE catalog_entries SET series_id = 'cmmxe6mmz02qc9esiop7g4rb4', updated_at = @now WHERE id IN ('cmmwuz4gw0g9ym3hwt7r6ny40','cmmwuz4fr0g9wm3hwxq6yvvw7');
DELETE FROM series WHERE id IN ('cmmxe6mmh02qb9esibki0li5m');

-- Espinho Rubro (Panini) (2 gibis)
UPDATE series SET title = 'Espinho Rubro (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5zfv026k9esi6kjap71i';
UPDATE catalog_entries SET series_id = 'cmmxe5zfv026k9esi6kjap71i', updated_at = @now WHERE id IN ('cmmwuwi9f09wbm3hwzki5q4j1','cmmwuwi8q09w9m3hwkojkvgz9');
DELETE FROM series WHERE id IN ('cmmxe5zef026j9esipxblo7mm');

-- Estranhas Aventuras (Panini) (2 gibis)
UPDATE series SET title = 'Estranhas Aventuras (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe77vp03f79esicd7k90xx';
UPDATE catalog_entries SET series_id = 'cmmxe77vp03f79esicd7k90xx', updated_at = @now WHERE id IN ('cmmwv3kk90pzim3hwm4ab4t9u','cmmwuspc001hfm3hwooeb6tq6');
DELETE FROM series WHERE id IN ('cmmxe5ft701km9esignxq605t');

-- Estranhos no Paraíso (Devir) (6 gibis)
UPDATE series SET title = 'Estranhos no Paraíso (Devir)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe5g8p01l49esit6pxpulg';
UPDATE catalog_entries SET series_id = 'cmmxe5g8p01l49esit6pxpulg', updated_at = @now WHERE id IN ('cmmwuspw501itm3hwz18ufl5q','cmmwuxgl90c5vm3hwdp97o3j4','cmmwuxgki0c5tm3hwki4hardy','cmmwuxgjs0c5rm3hw81u4z3q0','cmmwuxgj10c5pm3hw07c1ozb7','cmmwuxgic0c5nm3hwd4ho5nfe');
DELETE FROM series WHERE id IN ('cmmxe6b2r02g69esiuiecuevz','cmmxe6b1z02g59esionse1jhe','cmmxe6b1702g49esiic71i3dn','cmmxe6azc02g39esik64pfcsl','cmmxe6ayp02g29esivb51g9b7');

-- Excalibur - Uma Aventura no Tempo (Panini) (2 gibis)
UPDATE series SET title = 'Excalibur - Uma Aventura no Tempo (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6ycj03489esijnr5rjg7';
UPDATE catalog_entries SET series_id = 'cmmxe6ycj03489esijnr5rjg7', updated_at = @now WHERE id IN ('cmmwv1ip10lu4m3hwqyc0oue9','cmmwv1io90lu2m3hwm9wxt5s5');
DELETE FROM series WHERE id IN ('cmmxe6ybs03479esikf0w86w5');

-- Excepcionais X-Men (Panini) (7 gibis)
UPDATE series SET title = 'Excepcionais X-Men (Panini)', total_editions = 7, updated_at = @now WHERE id = 'cmmxe7eey03n49esi8htenuwd';
UPDATE catalog_entries SET series_id = 'cmmxe7eey03n49esi8htenuwd', updated_at = @now WHERE id IN ('cmmwv4kg40s4vm3hwb50a6m9b','cmmwv4jc80s1pm3hwf47xt69h','cmmwv4ir00rztm3hwkrerbsmc','cmmwv4i8m0ryjm3hw0eaks1k0','cmmwv4hek0rx1m3hwo2l8pjkl','cmmwv4god0rvem3hwatgj87u0','cmmwv4g5d0ru0m3hwkdhxeqgx');
DELETE FROM series WHERE id IN ('cmmxe7ds803md9esintg2qw4j','cmmxe7dc703lv9esi4wqno0t5','cmmxe7d0q03li9esilb25m3o3','cmmxe7coh03kz9esidb1nz797','cmmxe7c6h03kh9esic8brpf9r','cmmxe7bda03jz9esij8uskcii');

-- Faith (Jambô) (2 gibis)
UPDATE series SET title = 'Faith (Jambô)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5h0f01m79esixg9meygp';
UPDATE catalog_entries SET series_id = 'cmmxe5h0f01m79esixg9meygp', updated_at = @now WHERE id IN ('cmmwust3p01qzm3hwm8xxsyuj','cmmwuxht10c8zm3hwmppksh9f');
DELETE FROM series WHERE id IN ('cmmxe6d3g02hm9esixomtfnpv');

-- Fracasso de Público (Gal) (3 gibis)
UPDATE series SET title = 'Fracasso de Público (Gal)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe63hd02a79esiu7koevgm';
UPDATE catalog_entries SET series_id = 'cmmxe63hd02a79esiu7koevgm', updated_at = @now WHERE id IN ('cmmwux22v0b77m3hwiz04so95','cmmwuxsnt0cyom3hwiyvcoddn','cmmwuxn470ckvm3hwl38jx0ks');
DELETE FROM series WHERE id IN ('cmmxe6idk02m79esi399qw78v','cmmxe6grw02k99esilwmfwne3');

-- Frequência Global (Panini) (2 gibis)
UPDATE series SET title = 'Frequência Global (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe68h302e59esihwhi0mmw';
UPDATE catalog_entries SET series_id = 'cmmxe68h302e59esihwhi0mmw', updated_at = @now WHERE id IN ('cmmwuxdl00bz1m3hwewiqbhcj','cmmwuxdk70byzm3hwm99gi0xa');
DELETE FROM series WHERE id IN ('cmmxe68g802e49esialdutv67');

-- Fury por Garth Ennis (Panini) (2 gibis)
UPDATE series SET title = 'Fury por Garth Ennis (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5bbs01fg9esiqzzw9esm';
UPDATE catalog_entries SET series_id = 'cmmxe5bbs01fg9esiqzzw9esm', updated_at = @now WHERE id IN ('cmmwusexj00s4m3hwp5767jhg','cmmwv01zf0i9ym3hw2x4by84q');
DELETE FROM series WHERE id IN ('cmmxe6pm102ug9esi0gwm8ld3');

-- Grandes Encontros DC Comics/Dark Horse (Panini) (2 gibis)
UPDATE series SET title = 'Grandes Encontros DC Comics/Dark Horse (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5kbr01pk9esio740x3xy';
UPDATE catalog_entries SET series_id = 'cmmxe5kbr01pk9esio740x3xy', updated_at = @now WHERE id IN ('cmmwut42j02hfm3hwb9bovzff','cmmwv3qjo0qbkm3hwk6lhsxka');
DELETE FROM series WHERE id IN ('cmmxe78ls03g99esied7j3dcs');

-- Grandes Eventos DC: Lanterna Verde: O Dia Mais Claro (Panini) (2 gibis)
UPDATE series SET title = 'Grandes Eventos DC: Lanterna Verde: O Dia Mais Claro (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7tjl04419esistw6jgrv';
UPDATE catalog_entries SET series_id = 'cmmxe7tjl04419esistw6jgrv', updated_at = @now WHERE id IN ('cmmwv783e01ra120n6rguczox','cmmwv77b901oz120nyekr6woz');
DELETE FROM series WHERE id IN ('cmmxe7t2v043a9esit2xn5kd5');

-- Groo - Amigos e Inimigos (Mythos) (2 gibis)
UPDATE series SET title = 'Groo - Amigos e Inimigos (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6g8i02ju9esih0rd4o7e';
UPDATE catalog_entries SET series_id = 'cmmxe6g8i02ju9esih0rd4o7e', updated_at = @now WHERE id IN ('cmmwuxly50cixm3hwe5yvyk09','cmmwuxiuc0cbdm3hwwp8c5vrc');
DELETE FROM series WHERE id IN ('cmmxe6dsm02i69esi8jffgir8');

-- Guerra Pela Terra (Panini) (2 gibis)
UPDATE series SET title = 'Guerra Pela Terra (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5ecl01if9esieh7tkwme';
UPDATE catalog_entries SET series_id = 'cmmxe5ecl01if9esieh7tkwme', updated_at = @now WHERE id IN ('cmmwuskl3015sm3hwd4pv7pa1','cmmwv7r4g031q120nljwwbi1p');
DELETE FROM series WHERE id IN ('cmmxe869d04hs9esiajsdc6bu');

-- Hellboy - Contos Bizarros (Mythos) (3 gibis)
UPDATE series SET title = 'Hellboy - Contos Bizarros (Mythos)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe670102cu9esidp2ddlfl';
UPDATE catalog_entries SET series_id = 'cmmxe670102cu9esidp2ddlfl', updated_at = @now WHERE id IN ('cmmwuxavx0bt7m3hw7446mgkv','cmmwuxav80bt5m3hwcc1s8hqi','cmmwuxdwn0bzrm3hwzh4gjd8r');
DELETE FROM series WHERE id IN ('cmmxe66z902ct9esipowiab9f','cmmxe68sa02ec9esiiwtqs8b1');

-- Hellboy - Edição Histórica (Mythos) (10 gibis)
UPDATE series SET title = 'Hellboy - Edição Histórica (Mythos)', total_editions = 10, updated_at = @now WHERE id = 'cmmxe63gy02a69esiu4h1nidw';
UPDATE catalog_entries SET series_id = 'cmmxe63gy02a69esiu4h1nidw', updated_at = @now WHERE id IN ('cmmwux2290b75m3hw0bqzizvy','cmmwuxirs0cb7m3hwfavw6a4k','cmmwuxslk0cyim3hw3903n191','cmmwuxaug0bt3m3hwlu8bpixz','cmmwuxskv0cygm3hwifa5a71u','cmmwuxsk60cyem3hwjf7sp3nk','cmmwuxk7f0cexm3hw9oyvet6i','cmmwuxk6m0cevm3hwsb78ogyj','cmmwuxk5z0cetm3hwuusope4k','cmmwuxk5a0cerm3hwsagjme9j');
DELETE FROM series WHERE id IN ('cmmxe6dpt02i49esimnz6nnzu','cmmxe6ic202m49esix5cucufm','cmmxe66x902cs9esifs1i04ws','cmmxe6ibn02m39esisgyfd0zk','cmmxe6ib602m29esii67xoaqu','cmmxe6f2402j09esi7gzjyxkd','cmmxe6ezu02iz9esioripela7','cmmxe6eyw02iy9esijtami1kh','cmmxe6ey202ix9esid64u958d');

-- Hellboy - No Inferno (Mythos) (2 gibis)
UPDATE series SET title = 'Hellboy - No Inferno (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5iz901od9esikkbsg810';
UPDATE catalog_entries SET series_id = 'cmmxe5iz901od9esikkbsg810', updated_at = @now WHERE id IN ('cmmwusyuo024jm3hwz8bhamtu','cmmwusytq024hm3hwxpgeu1xn');
DELETE FROM series WHERE id IN ('cmmxe5iyq01oc9esi65cw121o');

-- Hellboy Apresenta - Abe Sapien - Sombrio e Terrível (Mythos) (2 gibis)
UPDATE series SET title = 'Hellboy Apresenta - Abe Sapien - Sombrio e Terrível (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe69y202f79esisiabc0dt';
UPDATE catalog_entries SET series_id = 'cmmxe69y202f79esisiabc0dt', updated_at = @now WHERE id IN ('cmmwuxf7y0c2hm3hw7ef9vsyl','cmmwuxf6v0c2fm3hw9smrcbii');
DELETE FROM series WHERE id IN ('cmmxe69x802f69esiws8g1jyp');

-- Hellboy Apresenta - B.P.D.P. - Bureau de Pesquisas e Defesa Paranormal (Mythos) (2 gibis)
UPDATE series SET title = 'Hellboy Apresenta - B.P.D.P. - Bureau de Pesquisas e Defesa Paranormal (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe66rl02cn9esirusvmbzf';
UPDATE catalog_entries SET series_id = 'cmmxe66rl02cn9esirusvmbzf', updated_at = @now WHERE id IN ('cmmwuxaqb0bstm3hwhjwuxwzt','cmmwux21o0b73m3hw1jk7cxvf');
DELETE FROM series WHERE id IN ('cmmxe63gk02a59esidllvgdjy');

-- Hellboy e o B.P.D.P (Mythos) (3 gibis)
UPDATE series SET title = 'Hellboy e o B.P.D.P (Mythos)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5kn001pz9esi4a4te2g1';
UPDATE catalog_entries SET series_id = 'cmmxe5kn001pz9esi4a4te2g1', updated_at = @now WHERE id IN ('cmmwut4rl02j5m3hwhlmlfm1t','cmmwuxjxp0ce5m3hwxi4veo0q','cmmwuxjww0ce3m3hwz9jskkar');
DELETE FROM series WHERE id IN ('cmmxe6ekq02iq9esic5svwo1d','cmmxe6ejq02ip9esinqh0ypor');

-- Hellboy Omnibus (Mythos) (5 gibis)
UPDATE series SET title = 'Hellboy Omnibus (Mythos)', total_editions = 5, updated_at = @now WHERE id = 'cmmxe5imw01nu9esiqrmjfo9z';
UPDATE catalog_entries SET series_id = 'cmmxe5imw01nu9esiqrmjfo9z', updated_at = @now WHERE id IN ('cmmwusy71023hm3hw8s20buc1','cmmwuxggo0c5jm3hwqfu8auh1','cmmwuxe990c0jm3hwj9mez6qz','cmmwusysu024fm3hwzyiok7w4','cmmwusyrv024dm3hwggkgxici');
DELETE FROM series WHERE id IN ('cmmxe6aw002g09esimr5g42qo','cmmxe69co02en9esivm1s1k54','cmmxe5iy701ob9esi4ssau047','cmmxe5ixp01oa9esixje32rk7');

-- Hera Venenosa (Panini) (5 gibis)
UPDATE series SET title = 'Hera Venenosa (Panini)', total_editions = 5, updated_at = @now WHERE id = 'cmmxe84s004g39esim8bqdrwc';
UPDATE catalog_entries SET series_id = 'cmmxe84s004g39esim8bqdrwc', updated_at = @now WHERE id IN ('cmmwv7or002vg120n6oyuhz5t','cmmwv7mxf02sc120ni5dnm2dg','cmmwv7hw502fi120nm2x51n0v','cmmwv7erq0286120niscwzshb','cmmwv787701rm120nwg8gx432');
DELETE FROM series WHERE id IN ('cmmxe83ji04f79esizfsx7619','cmmxe7za904bf9esi9f8siz9y','cmmxe7y20049i9esi9n4ek8w1','cmmxe7tny04469esil9wymn76');

-- Heroes (Panini) (2 gibis)
UPDATE series SET title = 'Heroes (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe76g403de9esifwcf76u4';
UPDATE catalog_entries SET series_id = 'cmmxe76g403de9esifwcf76u4', updated_at = @now WHERE id IN ('cmmwv3flb0pmum3hwhz3lvgga','cmmwv3fkn0pmsm3hwz4hs632m');
DELETE FROM series WHERE id IN ('cmmxe76f903dd9esifbjcxrzs');

-- Homem de Ferro (Panini) (2 gibis)
UPDATE series SET title = 'Homem de Ferro (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5i7l01nd9esi25v7jb16';
UPDATE catalog_entries SET series_id = 'cmmxe5i7l01nd9esi25v7jb16', updated_at = @now WHERE id IN ('cmmwusvg901wbm3hwej96vhtq','cmmwuywph0fpwm3hw8myanjao');
DELETE FROM series WHERE id IN ('cmmxe6ly602pe9esiph2fccsh');

-- Homem-Aranha (Panini) (2 gibis)
UPDATE series SET title = 'Homem-Aranha (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6ng402rg9esipddffmhs';
UPDATE catalog_entries SET series_id = 'cmmxe6ng402rg9esipddffmhs', updated_at = @now WHERE id IN ('cmmwuzmrg0hbem3hwbneuzxng','cmmwuz55o0gbem3hwmq6wh24c');
DELETE FROM series WHERE id IN ('cmmxe6moo02qf9esia66z45o3');

-- Homem-Aranha: Potestade (Panini) (2 gibis)
UPDATE series SET title = 'Homem-Aranha: Potestade (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7gky03ow9esimaawrwzw';
UPDATE catalog_entries SET series_id = 'cmmxe7gky03ow9esimaawrwzw', updated_at = @now WHERE id IN ('cmmwv4n0x0sanm3hwf7tdizme','cmmwv4mqj0s9xm3hwa0k4s1ut');
DELETE FROM series WHERE id IN ('cmmxe7gd603on9esinfxwdaq0');

-- Inescrito - Apocalipse (Panini) (2 gibis)
UPDATE series SET title = 'Inescrito - Apocalipse (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5v06021w9esi1f0yqbpc';
UPDATE catalog_entries SET series_id = 'cmmxe5v06021w9esi1f0yqbpc', updated_at = @now WHERE id IN ('cmmwuvs8i08nlm3hwdbl9w52l','cmmwuwjr70a01m3hwx595p040');
DELETE FROM series WHERE id IN ('cmmxe609602799esir0v0sick');

-- Injustiça - Deuses Entre Nós (Panini) (13 gibis)
UPDATE series SET title = 'Injustiça - Deuses Entre Nós (Panini)', total_editions = 13, updated_at = @now WHERE id = 'cmmxe5s4l01yi9esie2ln6oc5';
UPDATE catalog_entries SET series_id = 'cmmxe5s4l01yi9esie2ln6oc5', updated_at = @now WHERE id IN ('cmmwuupfh06ham3hw4qt9fmcq','cmmwuuo5306dkm3hw6f854wkt','cmmwuuo4f06dim3hw7gbmc9sp','cmmwuuo3p06dgm3hwlm1m24w2','cmmwuul1p066qm3hwwlvmcno0','cmmwuul10066om3hw4urm1377','cmmwv3v950qk4m3hw3z7to549','cmmwv3v890qk2m3hwt7ih1zgi','cmmwutgnz03chm3hwlr93gf9t','cmmwv3sgv0qfem3hw5fd9hwmj','cmmwv3sfr0qfcm3hw4lir1dn9','cmmwv3set0qfam3hwd64ckcib','cmmwv3nd40q58m3hw15araqyf');
DELETE FROM series WHERE id IN ('cmmxe5rr101y29esi4p4l889g','cmmxe5rqe01y19esikcl7wgc7','cmmxe5rpw01y09esidv0rwfdx','cmmxe5r4401x79esi0rdj09mt','cmmxe5r3601x69esiqokto9q1','cmmxe78sq03go9esif0r6vw0v','cmmxe78sb03gn9esixj8n6vj4','cmmxe5mdj01sm9esi4sed5wup','cmmxe78nu03gd9esi7qo6nmvr','cmmxe78nd03gc9esidjh01w1p','cmmxe78mu03gb9esinlailpwj','cmmxe78d303fu9esiyuh09auj');

-- Injustiça (Panini) (6 gibis)
UPDATE series SET title = 'Injustiça (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe78ce03ft9esi3oswx1jz';
UPDATE catalog_entries SET series_id = 'cmmxe78ce03ft9esi3oswx1jz', updated_at = @now WHERE id IN ('cmmwv3ncf0q56m3hw1ozy76nn','cmmwv3nbr0q54m3hwsy507348','cmmwv3nb50q52m3hw97w8qd5n','cmmwv3nam0q50m3hwyxt4hxj2','cmmwv3ivv0pv0m3hwci0nxqvq','cmmwv3iv40puym3hwkgun2qzm');
DELETE FROM series WHERE id IN ('cmmxe78bk03fs9esig12jjz2p','cmmxe78ap03fr9esid3hb3bky','cmmxe78a203fq9esir42wf4iq','cmmxe773s03ej9esie7hpt575','cmmxe772y03ei9esike8rry9f');

-- Invencível (HQM) (4 gibis)
UPDATE series SET title = 'Invencível (HQM)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe61kc028i9esizc1fbjzm';
UPDATE catalog_entries SET series_id = 'cmmxe61kc028i9esizc1fbjzm', updated_at = @now WHERE id IN ('cmmwuwvdl0arnm3hwog8oyglo','cmmwuwvcs0arlm3hw7czt0ikx','cmmwuwvbx0arjm3hw2uza99mk','cmmwutlf803ojm3hwn5brmhod');
DELETE FROM series WHERE id IN ('cmmxe61jh028h9esijr5hpb4i','cmmxe61io028g9esiwauo9542','cmmxe5ojr01ub9esijt4f2s8f');

-- iZombie (Panini) (4 gibis)
UPDATE series SET title = 'iZombie (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe5va7022a9esiuwe5s93x';
UPDATE catalog_entries SET series_id = 'cmmxe5va7022a9esiuwe5s93x', updated_at = @now WHERE id IN ('cmmwuvt8c08p3m3hwj78fm8md','cmmwuvs4008nfm3hwj112o8c9','cmmwuvs7s08njm3hwyqb7xhj0','cmmwuvs7008nhm3hwuzn5kmu8');
DELETE FROM series WHERE id IN ('cmmxe5uya021t9esihps9d81u','cmmxe5uzo021v9esixrr5u98a','cmmxe5uz2021u9esi3uakmsx9');

-- Joe Golem (Mythos) (4 gibis)
UPDATE series SET title = 'Joe Golem (Mythos)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe6av902fz9esiamxyy9x7';
UPDATE catalog_entries SET series_id = 'cmmxe6av902fz9esiamxyy9x7', updated_at = @now WHERE id IN ('cmmwuxgdw0c5bm3hwjpeya0q2','cmmwuspsl01ilm3hwjoxhn9n2','cmmwuxetv0c1pm3hwvzijp9dk','cmmwuxesv0c1nm3hwypvpdnjz');
DELETE FROM series WHERE id IN ('cmmxe5g7101l29esitf3r77d6','cmmxe69qf02ez9esisphh2o1f','cmmxe69of02ey9esiqanih7p9');

-- Jogos de Poder (Devir) (2 gibis)
UPDATE series SET title = 'Jogos de Poder (Devir)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe66im02ci9esijpkpy6oe';
UPDATE catalog_entries SET series_id = 'cmmxe66im02ci9esijpkpy6oe', updated_at = @now WHERE id IN ('cmmwuxamq0bsjm3hwi9fmrfal','cmmwuxaly0bshm3hwbo8qx2ag');
DELETE FROM series WHERE id IN ('cmmxe66hu02ch9esi27e7hov7');

-- John Constantine - Hellblazer - Amaldiçoado (Panini) (5 gibis)
UPDATE series SET title = 'John Constantine - Hellblazer - Amaldiçoado (Panini)', total_editions = 5, updated_at = @now WHERE id = 'cmmxe5l7k01r19esiqq685z9h';
UPDATE catalog_entries SET series_id = 'cmmxe5l7k01r19esiqq685z9h', updated_at = @now WHERE id IN ('cmmwut7av02pxm3hwc8us6avn','cmmwuwi5u09w1m3hw6z5ser17','cmmwuwi2x09vtm3hwpj6cywjq','cmmwuwhaw09tpm3hwulojkdgz','cmmwuwha209tnm3hwygjaknlh');
DELETE FROM series WHERE id IN ('cmmxe5zdw026i9esigd7t6d97','cmmxe5zba026f9esikf66rpos','cmmxe5z4102639esiq4myt1ju','cmmxe5z3802629esifrtn7ur8');

-- John Constantine - Hellblazer - Condenado (Panini) (7 gibis)
UPDATE series SET title = 'John Constantine - Hellblazer - Condenado (Panini)', total_editions = 7, updated_at = @now WHERE id = 'cmmxe5i6p01nc9esikyq797o3';
UPDATE catalog_entries SET series_id = 'cmmxe5i6p01nc9esikyq797o3', updated_at = @now WHERE id IN ('cmmwusvex01w7m3hwsxweetwq','cmmwuwh9709tlm3hw3c5o1f46','cmmwuwh8809tjm3hw0jmtxjvg','cmmwuwh7g09thm3hwnq9vqpmi','cmmwuwh6o09tfm3hwkkmwnwrn','cmmwuwh5x09tdm3hwlm046nk1','cmmwuwh5609tbm3hwulxrckps');
DELETE FROM series WHERE id IN ('cmmxe5z2g02619esiemtq0kj7','cmmxe5z1g02609esimo6y5102','cmmxe5z0y025z9esibidrzoec','cmmxe5z0a025y9esip9mqiy3o','cmmxe5yzg025x9esi9tp8lwlr','cmmxe5yym025w9esidrrifvaf');

-- Jonah Hex Showcase (Mythos) (2 gibis)
UPDATE series SET title = 'Jonah Hex Showcase (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe76pn03du9esicgfqq6dz';
UPDATE catalog_entries SET series_id = 'cmmxe76pn03du9esicgfqq6dz', updated_at = @now WHERE id IN ('cmmwv3hhd0prkm3hwmwx0oxw5','cmmwv3hgf0prim3hwc2y0kn2c');
DELETE FROM series WHERE id IN ('cmmxe76p503dt9esigqrids3g');

-- Jovens Titãs - Terra Um (Panini) (2 gibis)
UPDATE series SET title = 'Jovens Titãs - Terra Um (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5i5001na9esi725kspyp';
UPDATE catalog_entries SET series_id = 'cmmxe5i5001na9esi725kspyp', updated_at = @now WHERE id IN ('cmmwusvc301vzm3hwfk88ky3p','cmmwv4e0y0ro8m3hw89v6or47');
DELETE FROM series WHERE id IN ('cmmxe7ayk03jr9esiizlb4azl');

-- Jovens Titãs Em Ação (Panini) (11 gibis)
UPDATE series SET title = 'Jovens Titãs Em Ação (Panini)', total_editions = 11, updated_at = @now WHERE id = 'cmmxe837604es9esi2bhv7hc1';
UPDATE catalog_entries SET series_id = 'cmmxe837604es9esi2bhv7hc1', updated_at = @now WHERE id IN ('cmmwv7mix02r4120nirssxhyg','cmmwv7gje02d2120nkkkbkg8m','cmmwv7fpz02au120ncdm4jiey','cmmwv7eyf028o120nkvhrg2bq','cmmwv7e2o026g120nyxhzblfu','cmmwv7c0o0228120nqdmtmgpq','cmmwv7azh01za120nyvufh36d','cmmwv7am201yc120nrned1pqd','cmmwv79xz01wg120nixw86ui7','cmmwv793i01u8120nhhgehcuv','cmmwv75hg01l6120n77xia5as');
DELETE FROM series WHERE id IN ('cmmxe7z1304av9esivo2wqbld','cmmxe7yo804aa9esiq9qk47ek','cmmxe7y5s049n9esiifhphl08','cmmxe7xo504909esiiwuocn78','cmmxe7wnh047s9esiu78ihxbt','cmmxe7vm0046r9esivx4j6vho','cmmxe7vfh046h9esiffohzgpj','cmmxe7v66045y9esiticrzbfb','cmmxe7ula04539esirjkdyiz3','cmmxe7rx7041v9esi2kq9xe77');

-- Juiz Dredd - Dia do Caos (Mythos) (2 gibis)
UPDATE series SET title = 'Juiz Dredd - Dia do Caos (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6eqr02it9esimnirjwj2';
UPDATE catalog_entries SET series_id = 'cmmxe6eqr02it9esimnirjwj2', updated_at = @now WHERE id IN ('cmmwuxjzv0cebm3hwo9jw8rio','cmmwuxjz50ce9m3hwld3oyyfl');
DELETE FROM series WHERE id IN ('cmmxe6epm02is9esi26vaiq0b');

-- Juiz Dredd - Mega-City Zero (Novo Século) (2 gibis)
UPDATE series SET title = 'Juiz Dredd - Mega-City Zero (Novo Século)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5g5d01l09esi0535dm0o';
UPDATE catalog_entries SET series_id = 'cmmxe5g5d01l09esi0535dm0o', updated_at = @now WHERE id IN ('cmmwuspqw01ihm3hwi5z14cpx','cmmwuspq701ifm3hwm5b1x5oq');
DELETE FROM series WHERE id IN ('cmmxe5g4i01kz9esib1kedtdx');

-- Juiz Dredd - Os Casos Completos (Mythos) (5 gibis)
UPDATE series SET title = 'Juiz Dredd - Os Casos Completos (Mythos)', total_editions = 5, updated_at = @now WHERE id = 'cmmxe69ua02f49esi2sny9w4o';
UPDATE catalog_entries SET series_id = 'cmmxe69ua02f49esi2sny9w4o', updated_at = @now WHERE id IN ('cmmwuxf520c2bm3hw234x161n','cmmwuxf4a0c29m3hw7del7ap6','cmmwusdna00odm3hw5252g1gq','cmmwus2qz004mm3hwfoxg6hon','cmmwuxdxm0bztm3hwtl5conel');
DELETE FROM series WHERE id IN ('cmmxe69tu02f39esiq7yw9tpz','cmmxe5avw01ek9esi4avrpzqs','cmmxe594i01cc9esib8jamubu','cmmxe68u602ed9esigj1cis5u');

-- Juiz Dredd Essencial (Mythos) (7 gibis)
UPDATE series SET title = 'Juiz Dredd Essencial (Mythos)', total_editions = 7, updated_at = @now WHERE id = 'cmmxe6aud02fy9esidf620524';
UPDATE catalog_entries SET series_id = 'cmmxe6aud02fy9esidf620524', updated_at = @now WHERE id IN ('cmmwuxgd80c59m3hwmxmome0t','cmmwuxgck0c57m3hwa36etx3l','cmmwusp2301gnm3hw82s7x8e3','cmmwuxfxm0c41m3hwb4yvoceq','cmmwuxert0c1lm3hwwv5nq6qx','cmmwuxeqq0c1jm3hw5a3q7p4h','cmmwuxepk0c1hm3hwtgd86d6m');
DELETE FROM series WHERE id IN ('cmmxe6asm02fx9esib1nt41dk','cmmxe5fn401kf9esixur0xycn','cmmxe6ac602fj9esi6g6rz9y0','cmmxe69nu02ex9esitmevelf0','cmmxe69nb02ew9esiae0xfh1a','cmmxe69mp02ev9esi1kv5d7t6');

-- Juiz Dredd Megazine - Especial de Natal (Mythos) (2 gibis)
UPDATE series SET title = 'Juiz Dredd Megazine - Especial de Natal (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5g2q01kx9esi3m7gxruw';
UPDATE catalog_entries SET series_id = 'cmmxe5g2q01kx9esi3m7gxruw', updated_at = @now WHERE id IN ('cmmwuspok01ibm3hwsmykmhf6','cmmwuxpmv0cr1m3hwl3aqf51j');
DELETE FROM series WHERE id IN ('cmmxe6hc202ks9esinnpk7h2k');

-- Justiceiro por Garth Ennis (Panini) (3 gibis)
UPDATE series SET title = 'Justiceiro por Garth Ennis (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe6oe102sl9esioti7sl87';
UPDATE catalog_entries SET series_id = 'cmmxe6oe102sl9esioti7sl87', updated_at = @now WHERE id IN ('cmmwuzsji0hmam3hwmh0gdltq','cmmwuzsin0hm8m3hwr67mzfl6','cmmwuzsho0hm6m3hwda9x7dw1');
DELETE FROM series WHERE id IN ('cmmxe6odf02sk9esizodegyzx','cmmxe6ocs02sj9esiuk0c0hf5');

-- Kingdom Hearts II: Edição Definitiva (Panini) (5 gibis)
UPDATE series SET title = 'Kingdom Hearts II: Edição Definitiva (Panini)', total_editions = 5, updated_at = @now WHERE id = 'cmmxe8ei104qp9esiwepu65jp';
UPDATE catalog_entries SET series_id = 'cmmxe8ei104qp9esiwepu65jp', updated_at = @now WHERE id IN ('cmmwv8ffa04hk120n8js08zix','cmmwv8dtk04cy120nduv10o0q','cmmwv8dsl04cw120nq0b6w934','cmmwv8drj04cu120nw38iirwz','cmmwv8dp204cq120n5v1sm9w8');
DELETE FROM series WHERE id IN ('cmmxe8e7804q59esi2ld5p5jh','cmmxe8e6t04q49esiw6i7nmoc','cmmxe8e6b04q39esi0s8bgqx0','cmmxe8e5v04q29esikh37yac5');

-- Lanterna Verde - Setor Final (Panini) (2 gibis)
UPDATE series SET title = 'Lanterna Verde - Setor Final (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe75oj03cf9esihfxqa0wy';
UPDATE catalog_entries SET series_id = 'cmmxe75oj03cf9esihfxqa0wy', updated_at = @now WHERE id IN ('cmmwv3ao20pagm3hw402e8aae','cmmwusr0101lfm3hw282fom8d');
DELETE FROM series WHERE id IN ('cmmxe5gqf01lq9esiz4nkdla1');

-- Lanterna Verde - Terra Um (Panini) (2 gibis)
UPDATE series SET title = 'Lanterna Verde - Terra Um (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe75s603cj9esif5l4e63h';
UPDATE catalog_entries SET series_id = 'cmmxe75s603cj9esif5l4e63h', updated_at = @now WHERE id IN ('cmmwv3auh0paqm3hwghwq80mz','cmmwv3atf0paom3hwjbuwja9r');
DELETE FROM series WHERE id IN ('cmmxe75rc03ci9esib7pw5cp1');

-- Lanterna Verde (2024) (Panini) (19 gibis)
UPDATE series SET title = 'Lanterna Verde (2024) (Panini)', total_editions = 19, updated_at = @now WHERE id = 'cmmxe7zg604bn9esict8i90ta';
UPDATE catalog_entries SET series_id = 'cmmxe7zg604bn9esict8i90ta', updated_at = @now WHERE id IN ('cmmwv7i7u02ge120nxh2uxjwd','cmmwv7hva02fg120nxkje8t4y','cmmwv7heq02em120nldljtc6y','cmmwv7gn702da120n0iodkzxu','cmmwv7g2i02bq120ndg9nyqel','cmmwv7m9n02qa120nmyhrsl6d','cmmwv7fjz02ae120nqx5afmu5','cmmwv7f2z0290120nkbb2pcvc','cmmwv7er20284120nq4equiai','cmmwv7e51026m120nv2f6w18a','cmmwv7dgm0258120nh5n2hweo','cmmwv7ct00246120n197vmt1w','cmmwv7ccn0236120nraotv0ac','cmmwv7by50220120nf1cwcfpx','cmmwv7blu0210120nc84wh7fc','cmmwv7bap0206120nsl627z5k','cmmwv7lkj02oa120nnugcpkjo','cmmwv7aqi01ym120nj3fvklku','cmmwv7ac201xm120nt2xejwvq');
DELETE FROM series WHERE id IN ('cmmxe7z9q04be9esievofjiwj','cmmxe7z6q04b79esij841j70z','cmmxe7z2104ax9esis8b6iay1','cmmxe7yvb04ak9esi4n32rw62','cmmxe82xq04ej9esi9x5es67q','cmmxe7yko04a59esirxvuzkq1','cmmxe7y83049q9esida589jw8','cmmxe7y16049h9esi7p4nwrlb','cmmxe7xqe04939esibtxarj39','cmmxe7xba048j9esixd6qhu0s','cmmxe7x5z048a9esif5x567w8','cmmxe7wvx047y9esixzi1av6g','cmmxe7wis047p9esi0afxqypm','cmmxe7w11047a9esi72iyz38y','cmmxe7vtv04719esizlq2vqkh','cmmxe822604dx9esindha2y1h','cmmxe7vgb046j9esino8inxog','cmmxe7vc1046a9esivae66aep');

-- Lanterna Verde (2025) (Panini) (9 gibis)
UPDATE series SET title = 'Lanterna Verde (2025) (Panini)', total_editions = 9, updated_at = @now WHERE id = 'cmmxe7v8704629esi594latgy';
UPDATE catalog_entries SET series_id = 'cmmxe7v8704629esi594latgy', updated_at = @now WHERE id IN ('cmmwv7a1q01ws120nhwza6iqt','cmmwv79t301w0120nuxxx5r3k','cmmwv79ee01uu120nsceyme0j','cmmwv78qx01t8120n82j116mg','cmmwv785x01ri120nspd7kctv','cmmwv77ox01q0120ntmgkgqje','cmmwv778q01ot120nsb3bxfdw','cmmwv76hh01n6120nb51g1hwp','cmmwv75nz01lq120nu3jstfvc');
DELETE FROM series WHERE id IN ('cmmxe7v33045s9esiqp4j7r9d','cmmxe7usy045c9esivt8makz7','cmmxe7u4d044p9esiai85gz2t','cmmxe7tm904449esiua5fpwwv','cmmxe7t9v043m9esivhzcs4o7','cmmxe7t1204379esibm2cyb1x','cmmxe7sj4042k9esixhhd9ucc','cmmxe7s3j04229esi4oalk9tf');

-- Legado de Júpiter (Panini) (2 gibis)
UPDATE series SET title = 'Legado de Júpiter (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5l7501r09esivlnuxhor';
UPDATE catalog_entries SET series_id = 'cmmxe5l7501r09esivlnuxhor', updated_at = @now WHERE id IN ('cmmwut77f02ppm3hwr68tidxm','cmmwut76p02pnm3hwe2wlfllg');
DELETE FROM series WHERE id IN ('cmmxe5l6o01qz9esilzdxujyt');

-- Lendas Marvel (Panini) (9 gibis)
UPDATE series SET title = 'Lendas Marvel (Panini)', total_editions = 9, updated_at = @now WHERE id = 'cmmxe6kxl02oc9esi4pbktksi';
UPDATE catalog_entries SET series_id = 'cmmxe6kxl02oc9esi4pbktksi', updated_at = @now WHERE id IN ('cmmwuyrm50fdum3hwulfxy6uw','cmmwusfhr00tgm3hwiug9q1ar','cmmwv01xd0i9sm3hwbh9juu1r','cmmwus81700b9m3hw9ow8ucol','cmmwus80c00b7m3hw8kqn3vx2','cmmwus7zj00b5m3hwoqwliwyh','cmmwus7yn00b3m3hwyt41edei','cmmwus7xp00b1m3hwzuo89bob','cmmwv00fx0i5ym3hwrgtn6qja');
DELETE FROM series WHERE id IN ('cmmxe5bo201fs9esivqfoyhi0','cmmxe6pkc02ue9esim0nk7820','cmmxe59zk01dd9esik87o5vqu','cmmxe59yn01dc9esizxrluudw','cmmxe59wx01db9esicmndea9p','cmmxe59uv01da9esija5wfni3','cmmxe59sp01d99esi67mxsw4g','cmmxe6pbd02u29esimwcdk190');

-- Lex Luthor - O Anel Negro (Panini) (2 gibis)
UPDATE series SET title = 'Lex Luthor - O Anel Negro (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7a1v03ic9esirby8a3a5';
UPDATE catalog_entries SET series_id = 'cmmxe7a1v03ic9esirby8a3a5', updated_at = @now WHERE id IN ('cmmwv45oh0r4em3hww2q13d0b','cmmwv4d920rmqm3hwsdzbn500');
DELETE FROM series WHERE id IN ('cmmxe7atl03jl9esig9xiykg3');

-- Liga da Justiça - Odisséia (Panini) (4 gibis)
UPDATE series SET title = 'Liga da Justiça - Odisséia (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe5jfw01ow9esiwlydfusb';
UPDATE catalog_entries SET series_id = 'cmmxe5jfw01ow9esiwlydfusb', updated_at = @now WHERE id IN ('cmmwut0gz028lm3hw424whyad','cmmwv1uk10maem3hw94538fs0','cmmwusv9h01vrm3hwi8no4yns','cmmwusbyy00jym3hwscdmhmt3');
DELETE FROM series WHERE id IN ('cmmxe6z4803599esikcrtm3d9','cmmxe5i2a01n79esibvak27i7','cmmxe5aoj01e99esivzig36bu');

-- Liga da Justiça Dark (Panini) (4 gibis)
UPDATE series SET title = 'Liga da Justiça Dark (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe6z6y035c9esijho1emsy';
UPDATE catalog_entries SET series_id = 'cmmxe6z6y035c9esijho1emsy', updated_at = @now WHERE id IN ('cmmwv1v7g0mb6m3hwyk2m7mhv','cmmwv1unq0maim3hwkq56pfxg','cmmwv1um00magm3hwnpcjvhbl','cmmwusby900jwm3hwrzqzg688');
DELETE FROM series WHERE id IN ('cmmxe6z61035b9esigijeqqee','cmmxe6z54035a9esi4632rm31','cmmxe5ao101e89esiwhybdsco');

-- Liga Da Justiça Sem Limites (2025) (Panini) (9 gibis)
UPDATE series SET title = 'Liga Da Justiça Sem Limites (2025) (Panini)', total_editions = 9, updated_at = @now WHERE id = 'cmmxe81rv04do9esi1vex5u1d';
UPDATE catalog_entries SET series_id = 'cmmxe81rv04do9esi1vex5u1d', updated_at = @now WHERE id IN ('cmmwv7lds02ns120ndixgxt5j','cmmwv7l9x02ni120n14ykq9sf','cmmwv79cn01uq120nilw9cpdp','cmmwv78rl01ta120nbz0spr9v','cmmwv786j01rk120n8dskngdl','cmmwv77nk01pw120ncg0l9q5e','cmmwv774j01oh120njjt25eu6','cmmwv76il01n8120nesfns7mc','cmmwv75s401m0120nfj2fy03j');
DELETE FROM series WHERE id IN ('cmmxe81ok04dl9esibi5uht1q','cmmxe7uro045a9esi0xt5wsi8','cmmxe7u51044q9esi3e3te7da','cmmxe7tn304459esi2li2cb1g','cmmxe7t8t043k9esio3p2f9n6','cmmxe7swp04319esiq8wp6e03','cmmxe7sjy042l9esixqkdh9u2','cmmxe7s7304269esi9eg0djgl');

-- Liga Extraordinária - Século (Devir) (2 gibis)
UPDATE series SET title = 'Liga Extraordinária - Século (Devir)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6i9t02lz9esir1ul0lyp';
UPDATE catalog_entries SET series_id = 'cmmxe6i9t02lz9esir1ul0lyp', updated_at = @now WHERE id IN ('cmmwuxsi10cy8m3hw5x4zhrk5','cmmwuxadw0brxm3hwcwog3lgm');
DELETE FROM series WHERE id IN ('cmmxe66db02cd9esikujvsx1a');

-- Liga Extraordinária (Devir) (2 gibis)
UPDATE series SET title = 'Liga Extraordinária (Devir)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe63su02ah9esi0v6tfesv';
UPDATE catalog_entries SET series_id = 'cmmxe63su02ah9esi0v6tfesv', updated_at = @now WHERE id IN ('cmmwux4ip0bdpm3hwg23wvtq9','cmmwux4hy0bdnm3hwzxf9kjad');
DELETE FROM series WHERE id IN ('cmmxe63on02ag9esi1ovpf8z0');

-- Marvel Edição Especial Limitada - Capitão América (Salvat) (3 gibis)
UPDATE series SET title = 'Marvel Edição Especial Limitada - Capitão América (Salvat)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe6jf102n09esiziqcua7a';
UPDATE catalog_entries SET series_id = 'cmmxe6jf102n09esiziqcua7a', updated_at = @now WHERE id IN ('cmmwuxzog0dg6m3hwbxnqt584','cmmwuxznt0dg4m3hwz834uknf','cmmwuxzmw0dg2m3hwv65mxpqt');
DELETE FROM series WHERE id IN ('cmmxe6jdf02mz9esi0airceak','cmmxe6jap02my9esiks0012g6');

-- Marvel Edição Especial Limitada - Os Vingadores (Salvat) (3 gibis)
UPDATE series SET title = 'Marvel Edição Especial Limitada - Os Vingadores (Salvat)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe6uzc030v9esid5dq3ier';
UPDATE catalog_entries SET series_id = 'cmmxe6uzc030v9esid5dq3ier', updated_at = @now WHERE id IN ('cmmwv0ulc0kcom3hw0etg8qgv','cmmwv0ukq0kcmm3hwq1ni4mps','cmmwv0ujy0kckm3hwp5ycjxsi');
DELETE FROM series WHERE id IN ('cmmxe6uyc030u9esiiakwt5q5','cmmxe6uxj030t9esi8zui40ar');

-- Marvel Edição Especial Limitada - Thor (Salvat) (3 gibis)
UPDATE series SET title = 'Marvel Edição Especial Limitada - Thor (Salvat)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5gxt01m29esiepv7ui4d';
UPDATE catalog_entries SET series_id = 'cmmxe5gxt01m29esiepv7ui4d', updated_at = @now WHERE id IN ('cmmwussrj01q3m3hwaomrsl6e','cmmwv05k40ik8m3hwbynezkse','cmmwv05jf0ik6m3hw5gzl2g0r');
DELETE FROM series WHERE id IN ('cmmxe6r6h02w99esic2q85tw5','cmmxe6r5p02w89esik9eg5pde');

-- Marvels - Retratos (Panini) (2 gibis)
UPDATE series SET title = 'Marvels - Retratos (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6qw402vv9esibria4q34';
UPDATE catalog_entries SET series_id = 'cmmxe6qw402vv9esibria4q34', updated_at = @now WHERE id IN ('cmmwv04yf0iigm3hwk8m9ri4f','cmmwusp7m01h3m3hwl5jde8p0');
DELETE FROM series WHERE id IN ('cmmxe5fny01kg9esizgngb8n0');

-- Miles Morales (Panini) (2 gibis)
UPDATE series SET title = 'Miles Morales (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6mvh02qr9esim4nt2dsl';
UPDATE catalog_entries SET series_id = 'cmmxe6mvh02qr9esim4nt2dsl', updated_at = @now WHERE id IN ('cmmwuz6wx0gg8m3hw6ips7cdv','cmmwuz5z40gdmm3hwh3r81p79');
DELETE FROM series WHERE id IN ('cmmxe6mpu02qh9esi7fmz7p5s');

-- Miles Morales: Homem-Aranha (2025) (Panini) (6 gibis)
UPDATE series SET title = 'Miles Morales: Homem-Aranha (2025) (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe7el203ne9esiozyqkzyx';
UPDATE catalog_entries SET series_id = 'cmmxe7el203ne9esiozyqkzyx', updated_at = @now WHERE id IN ('cmmwv4kro0s5hm3hw7d5elw4j','cmmwv4kd30s4nm3hwt4eofsii','cmmwv4i720ryfm3hwsy6v93u7','cmmwv4hdl0rwzm3hwo7c4xjs6','cmmwv4gs30rvom3hwkoqn70y9','cmmwv4g410rtwm3hw7oz88tte');
DELETE FROM series WHERE id IN ('cmmxe7ee503n39esi0d0g6pxv','cmmxe7czo03lg9esi01r730sn','cmmxe7cnu03ky9esihyz9w986','cmmxe7cay03kk9esilfvgd4rd','cmmxe7b9s03jx9esisv5iijsw');

-- Monstro do Pântano por Alan Moore - Edição Absoluta (Panini) (3 gibis)
UPDATE series SET title = 'Monstro do Pântano por Alan Moore - Edição Absoluta (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5yvz025t9esiht3t56jd';
UPDATE catalog_entries SET series_id = 'cmmxe5yvz025t9esiht3t56jd', updated_at = @now WHERE id IN ('cmmwuwgtm09shm3hwplcp8pbq','cmmwuwgsv09sfm3hwz9fvmz0f','cmmwuwggd09rhm3hw3ep3giu1');
DELETE FROM series WHERE id IN ('cmmxe5yv5025s9esipmqso8lh','cmmxe5ypn025o9esizwe0s7lx');

-- Mulher-Gato (2023) (Panini) (6 gibis)
UPDATE series SET title = 'Mulher-Gato (2023) (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe809e04cf9esi4szxrl4a';
UPDATE catalog_entries SET series_id = 'cmmxe809e04cf9esi4szxrl4a', updated_at = @now WHERE id IN ('cmmwv7je002ja120n2evtm9gi','cmmwv7iil02h8120n6wwkp9zn','cmmwv7h9m02ee120nil523jrd','cmmwv7e3j026i120nwqm3td51','cmmwv7caz0232120ncwzmlvix','cmmwv77h701pd120nwcf76upn');
DELETE FROM series WHERE id IN ('cmmxe7zlp04bu9esipt88wd9x','cmmxe7z5u04b59esiga0f6luu','cmmxe7xou04919esittht9nqg','cmmxe7wte047w9esid8jaw5a9','cmmxe7t41043c9esioctz15tk');

-- Mulher-Maravilha - Terra Um (Panini) (3 gibis)
UPDATE series SET title = 'Mulher-Maravilha - Terra Um (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5maf01si9esi47c87yvs';
UPDATE catalog_entries SET series_id = 'cmmxe5maf01si9esi47c87yvs', updated_at = @now WHERE id IN ('cmmwutge503btm3hwmfl4xatf','cmmwv3mvk0q4am3hwba8yedt6','cmmwv3jnf0pwym3hw1098sn43');
DELETE FROM series WHERE id IN ('cmmxe788t03fo9esiq5if061l','cmmxe776m03el9esiu6ycqpig');

-- Mulher-Maravilha/Flash (2025) (Panini) (9 gibis)
UPDATE series SET title = 'Mulher-Maravilha/Flash (2025) (Panini)', total_editions = 9, updated_at = @now WHERE id = 'cmmxe7v7r04619esicd50mkk7';
UPDATE catalog_entries SET series_id = 'cmmxe7v7r04619esicd50mkk7', updated_at = @now WHERE id IN ('cmmwv7a1501wq120ndr3trsgo','cmmwv79sh01vy120na09nxviv','cmmwv79di01us120nb4855b4g','cmmwv78he01sg120nojnns8di','cmmwv785a01rg120np8kmweu8','cmmwv77pj01q2120n8jc4lyqe','cmmwv772e01ob120nr8y3tx1b','cmmwv76gb01n4120nnsw76v8f','cmmwv75mx01ln120nyuseptjl');
DELETE FROM series WHERE id IN ('cmmxe7v2l045r9esijuwao08k','cmmxe7usc045b9esiklcl1bjo','cmmxe7tyi044i9esinpdadvaf','cmmxe7tle04439esiudtajxqt','cmmxe7tac043n9esiowewjtba','cmmxe7suy042z9esi8hul4hkw','cmmxe7sib042j9esivfscppva','cmmxe7s2p04219esik0p685wl');

-- Mulher-Maravilha/Flash (Panini) (16 gibis)
UPDATE series SET title = 'Mulher-Maravilha/Flash (Panini)', total_editions = 16, updated_at = @now WHERE id = 'cmmxe7z6a04b69esi4sit2dkd';
UPDATE catalog_entries SET series_id = 'cmmxe7z6a04b69esi4sit2dkd', updated_at = @now WHERE id IN ('cmmwv7hca02ei120nwo15eez6','cmmwv7gl502d6120nhg9li85t','cmmwv7fuy02b6120n0ruwxsuw','cmmwv7fik02aa120nfxk6g0iu','cmmwv7f1k028w120nfj1g3920','cmmwv7eq90282120nv0fcgiew','cmmwv7e4c026k120nieb7phkd','cmmwv7ddw0254120nb2j1381j','cmmwv7cs20244120n1h02ar9n','cmmwv7cbw0234120nt7f86d5f','cmmwv7bwv021w120nngd1b52c','cmmwv7bnj0214120n89bg5iqu','cmmwv7b7801zw120nx8fbnf5s','cmmwv7aua01yw120ndcw6y3oa','cmmwv7alc01ya120nibpd76y6','cmmwv7agc01xw120n3423xk9b');
DELETE FROM series WHERE id IN ('cmmxe7z1j04aw9esi9zijgk59','cmmxe7yre04ae9esinbvz13eu','cmmxe7yjw04a49esikijb30cq','cmmxe7y7d049p9esi1vbi75vv','cmmxe7y0e049g9esis5cxc0g5','cmmxe7xpm04929esit2ygikvp','cmmxe7xa6048h9esi99ifml49','cmmxe7x5504899esibr2sf6d4','cmmxe7wut047x9esisttqisaw','cmmxe7wgu047o9esitlt98j75','cmmxe7w2n047c9esidlb8kngo','cmmxe7vs3046z9esiykkl90qn','cmmxe7vii046m9esiloki81st','cmmxe7vey046g9esi8vkgoe6o','cmmxe7vdi046d9esiy4ety6s2');

-- O Espetacular Homem-Aranha (2025) (Panini) (5 gibis)
UPDATE series SET title = 'O Espetacular Homem-Aranha (2025) (Panini)', total_editions = 5, updated_at = @now WHERE id = 'cmmxe7em403ng9esis191je0t';
UPDATE catalog_entries SET series_id = 'cmmxe7em403ng9esis191je0t', updated_at = @now WHERE id IN ('cmmwv4ktp0s5lm3hwfpndaniy','cmmwv4iac0rynm3hwe3w8xw3p','cmmwv4hfl0rx3m3hw7tcq6c14','cmmwv4gst0rvqm3hw7r4n7jjs','cmmwv4g6m0ru4m3hwx8uft70k');
DELETE FROM series WHERE id IN ('cmmxe7d1q03lk9esig662cvbp','cmmxe7cp503l09esiuw1rlvwx','cmmxe7ccf03kl9esimodoi270','cmmxe7bfc03k09esiwuxynnr8');

-- Ordem Mágica (Panini) (3 gibis)
UPDATE series SET title = 'Ordem Mágica (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5fqd01kj9esih6j5c52r';
UPDATE catalog_entries SET series_id = 'cmmxe5fqd01kj9esih6j5c52r', updated_at = @now WHERE id IN ('cmmwusp9n01h9m3hwfcdi8af3','cmmwuso7p01enm3hwqsxftuz8','cmmwusgaj00v8m3hwlz7s54n5');
DELETE FROM series WHERE id IN ('cmmxe5f6k01jr9esi551hhcfz','cmmxe5c8z01gc9esiwk6r7mao');

-- Os Fabulosos X-Men (2025) (Panini) (10 gibis)
UPDATE series SET title = 'Os Fabulosos X-Men (2025) (Panini)', total_editions = 10, updated_at = @now WHERE id = 'cmmxe7f0s03ny9esiygvlizhr';
UPDATE catalog_entries SET series_id = 'cmmxe7f0s03ny9esiygvlizhr', updated_at = @now WHERE id IN ('cmmwv4lui0s7lm3hwj07m087u','cmmwv4l450s67m3hwnvzdicxr','cmmwv4kuu0s5nm3hwqzfyke4k','cmmwv4jt30s31m3hw24g54wya','cmmwv4jbl0s1nm3hwxh3wei2g','cmmwv4it90rzzm3hwgnkqntz1','cmmwv4i9c0rylm3hwkcrdkuqe','cmmwv4hco0rwxm3hw1f3jszeq','cmmwv4gly0rv9m3hwdrb68g1b','cmmwv4g4o0rtym3hwe0032wuq');
DELETE FROM series WHERE id IN ('cmmxe7eo603nk9esip3ecexk6','cmmxe7eml03nh9esin2wvaylr','cmmxe7e3k03mq9esi8inwnzld','cmmxe7drb03mc9esitspu8tvq','cmmxe7dd403lw9esi2l52je6d','cmmxe7d1703lj9esinhjsb4a2','cmmxe7cn803kx9esisht20570','cmmxe7c5j03kg9esiv145dz6s','cmmxe7bbg03jy9esis0mvbq6y');

-- Os Mistérios De Batman E Scooby-Doo (Panini) (6 gibis)
UPDATE series SET title = 'Os Mistérios De Batman E Scooby-Doo (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe7x1204849esib1iw2le9';
UPDATE catalog_entries SET series_id = 'cmmxe7x1204849esib1iw2le9', updated_at = @now WHERE id IN ('cmmwv7cjy023m120n5stpqh8o','cmmwv7bjy020w120nr6g406ug','cmmwv79ng01vi120ngu9nhy3s','cmmwv796f01ue120ni3wjv708','cmmwv78fd01sa120nlc7ot0d0','cmmwv75w301m8120nw1c1l5yi');
DELETE FROM series WHERE id IN ('cmmxe7w0a04799esiu4dwpacb','cmmxe7uzu045m9esih585s7g1','cmmxe7un004559esix20mthde','cmmxe7tvx044f9esi4r0p5hef','cmmxe7s9v04299esie1q1sh21');

-- Pantera Negra - Uma Nação Sob Nossos Pés - Livro (Panini) (3 gibis)
UPDATE series SET title = 'Pantera Negra - Uma Nação Sob Nossos Pés - Livro (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5m8x01sg9esioca4ua4u';
UPDATE catalog_entries SET series_id = 'cmmxe5m8x01sg9esioca4ua4u', updated_at = @now WHERE id IN ('cmmwutgcm03bpm3hwncyeb8dq','cmmwutgbn03bnm3hwz18sskep','cmmwutgal03blm3hw8m23m9zx');
DELETE FROM series WHERE id IN ('cmmxe5m8601sf9esi94zndik3','cmmxe5m7c01se9esivgmlk070');

-- Pantera Negra - Vingadores do Novo Mundo (Panini) (2 gibis)
UPDATE series SET title = 'Pantera Negra - Vingadores do Novo Mundo (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6s3q02x89esiwciipbz3';
UPDATE catalog_entries SET series_id = 'cmmxe6s3q02x89esiwciipbz3', updated_at = @now WHERE id IN ('cmmwv08io0irkm3hw1rxbyhm5','cmmwv08i10irim3hw9xiutej0');
DELETE FROM series WHERE id IN ('cmmxe6s2q02x79esigr3qw2xg');

-- Pequenos Heróis Marvel (Panini) (12 gibis)
UPDATE series SET title = 'Pequenos Heróis Marvel (Panini)', total_editions = 12, updated_at = @now WHERE id = 'cmmxe7h5k03pp9esi6qin5scs';
UPDATE catalog_entries SET series_id = 'cmmxe7h5k03pp9esi6qin5scs', updated_at = @now WHERE id IN ('cmmwv4o1m0sdfm3hw09x0bsae','cmmwv4ngk0sbrm3hw72avpedc','cmmwv4mx10sadm3hwg45u11gt','cmmwv4lpu0s7bm3hw2jtctzml','cmmwv4l7u0s6fm3hw00ypbc2t','cmmwv4kn00s57m3hwdffz6dqv','cmmwv4k3h0s3vm3hwe7s8qfsy','cmmwv4jm00s2hm3hwamlc9kxt','cmmwv4j010s0lm3hwf0l382sd','cmmwv4gz00rw5m3hwbzfxhjm0','cmmwv4gk30rv5m3hwscxpm3he','cmmwv4g1e0rtom3hwx87ehkgi');
DELETE FROM series WHERE id IN ('cmmxe7gwh03p89esi0zmnax91','cmmxe7gjl03ou9esi5eagi2lr','cmmxe7ews03nu9esi0iy1ih6w','cmmxe7eon03nl9esiy57dx581','cmmxe7eic03n99esio1f5ch2u','cmmxe7ea603my9esivp5u8d94','cmmxe7dzc03ml9esiekq6egwb','cmmxe7djc03m39esi03qf9sqa','cmmxe7cfp03ko9esidu4as017','cmmxe7c2v03ke9esikflq8h4a','cmmxe7b2c03ju9esiq37pp3j6');

-- Pixel Preview (Pixel) (2 gibis)
UPDATE series SET title = 'Pixel Preview (Pixel)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5wih023u9esiaufkt1rd';
UPDATE catalog_entries SET series_id = 'cmmxe5wih023u9esiaufkt1rd', updated_at = @now WHERE id IN ('cmmwuwcj709hzm3hwwblzyujq','cmmwuwnbk0a8nm3hwa1nqk8uw');
DELETE FROM series WHERE id IN ('cmmxe60zh027y9esi8f5wvwkj');

-- Poder Absoluto (Panini) (4 gibis)
UPDATE series SET title = 'Poder Absoluto (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe7vrg046y9esi005ip7d4';
UPDATE catalog_entries SET series_id = 'cmmxe7vrg046y9esi005ip7d4', updated_at = @now WHERE id IN ('cmmwv7b6i01zu120n93kviomw','cmmwv7ljq02o8120nlvx7hupl','cmmwv7lh702o2120nza50f8vf','cmmwv7lfq02ny120nhbtc3fre');
DELETE FROM series WHERE id IN ('cmmxe820004dw9esiy4rwwovk','cmmxe81ws04dt9esie52iuz5m','cmmxe81uv04dr9esin0fmchyq');

-- Preacher (Panini) (13 gibis)
UPDATE series SET title = 'Preacher (Panini)', total_editions = 13, updated_at = @now WHERE id = 'cmmxe60h5027h9esippndrn38';
UPDATE catalog_entries SET series_id = 'cmmxe60h5027h9esippndrn38', updated_at = @now WHERE id IN ('cmmwuwk940a1bm3hw89e6hy8r','cmmwuskwo016pm3hwlybgafnb','cmmwuwesr09o9m3hwo0s3dagi','cmmwuskw2016nm3hwk1qs9hkw','cmmwutoj803wnm3hw2ter2lhq','cmmwuskvc016lm3hwxm5n6xop','cmmwuwk8c0a19m3hwug8u7mak','cmmwuwk7m0a17m3hw1ige38nx','cmmwuwk6u0a15m3hwoke424or','cmmwuwo9d0ab9m3hwlvquafax','cmmwuwo8o0ab7m3hwslhxcedz','cmmwuwo800ab5m3hwoqqjhr5m','cmmwuwgnn09s1m3hw9tw6173m');
DELETE FROM series WHERE id IN ('cmmxe5eib01in9esi2j65214c','cmmxe5xob02539esix9248iq7','cmmxe5ehr01im9esieammtwa2','cmmxe5p1n01ux9esifseeln0b','cmmxe5eh901il9esi222z14z4','cmmxe60ge027g9esildjdi8ps','cmmxe60fo027f9esi49rk6fzp','cmmxe60e2027e9esizll38lte','cmmxe61a202889esi0zu293w7','cmmxe619i02879esi1qcf57mv','cmmxe618z02869esiw7eo4vjt','cmmxe5yrw025q9esig9vilxvq');

-- Quarteto Fantástico por John Byrne - Omnibus (Panini) (2 gibis)
UPDATE series SET title = 'Quarteto Fantástico por John Byrne - Omnibus (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6tov02zd9esikoceojbc';
UPDATE catalog_entries SET series_id = 'cmmxe6tov02zd9esikoceojbc', updated_at = @now WHERE id IN ('cmmwv0nwc0jv0m3hw2tt11q6c','cmmwv0nvo0juym3hwo1knr9me');
DELETE FROM series WHERE id IN ('cmmxe6tmb02zc9esi92r3o1iu');

-- Ragnarök (Mythos) (2 gibis)
UPDATE series SET title = 'Ragnarök (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5ivh01o69esifzkyedu7';
UPDATE catalog_entries SET series_id = 'cmmxe5ivh01o69esifzkyedu7', updated_at = @now WHERE id IN ('cmmwusymu0245m3hwqi8f2aaw','cmmwusylb0243m3hwdafkqmwg');
DELETE FROM series WHERE id IN ('cmmxe5iuy01o59esi863abetw');

-- Rat Queens (Jambô) (3 gibis)
UPDATE series SET title = 'Rat Queens (Jambô)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5nh301tn9esi3jsmfe4h';
UPDATE catalog_entries SET series_id = 'cmmxe5nh301tn9esi3jsmfe4h', updated_at = @now WHERE id IN ('cmmwutkrx03mpm3hwmasa3d2i','cmmwutkr403mnm3hwpzvw05mn','cmmwuspks01i3m3hws9nq53x6');
DELETE FROM series WHERE id IN ('cmmxe5nfw01tm9esicab8dvww','cmmxe5fza01kt9esiszfo71cq');

-- Rei Conan Omnibus (Mythos) (2 gibis)
UPDATE series SET title = 'Rei Conan Omnibus (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe698a02el9esi7b38sywz';
UPDATE catalog_entries SET series_id = 'cmmxe698a02el9esi7b38sywz', updated_at = @now WHERE id IN ('cmmwuxe7t0c0fm3hwxvqvj4hb','cmmwuxdtt0bzlm3hw4tz85rn2');
DELETE FROM series WHERE id IN ('cmmxe68qc02ea9esi0htjo1yx');

-- Rei Spawn (Panini) (2 gibis)
UPDATE series SET title = 'Rei Spawn (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe58wv01c09esiek8wdj9i';
UPDATE catalog_entries SET series_id = 'cmmxe58wv01c09esiek8wdj9i', updated_at = @now WHERE id IN ('cmmwurzjg001rm3hwviy5853j','cmmwurzhc001pm3hwwym0yatm');
DELETE FROM series WHERE id IN ('cmmxe58w601bz9esillfc2opf');

-- Rex Mundi (Devir) (6 gibis)
UPDATE series SET title = 'Rex Mundi (Devir)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe65y402c09esii9f8f10n';
UPDATE catalog_entries SET series_id = 'cmmxe65y402c09esii9f8f10n', updated_at = @now WHERE id IN ('cmmwuxa2w0br7m3hwvp1bmf2c','cmmwuxa210br5m3hw891l90ew','cmmwuxa170br3m3hwgtw8xxsx','cmmwut5vb02l9m3hwhet29byc','cmmwuxkp20cg7m3hw1xyrvito','cmmwut5ul02l7m3hw84ik3yhv');
DELETE FROM series WHERE id IN ('cmmxe65vx02bz9esipfus09fq','cmmxe65v002by9esi85nz58n7','cmmxe5l3801qr9esikmeb58kj','cmmxe6fx702jk9esis0pjnsfi','cmmxe5l2s01qq9esi4q2t1ct7');

-- Rick and Morty Vs. Dungeons and Dragons (Panini) (2 gibis)
UPDATE series SET title = 'Rick and Morty Vs. Dungeons and Dragons (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6cyr02hi9esiy6a2p9bp';
UPDATE catalog_entries SET series_id = 'cmmxe6cyr02hi9esiy6a2p9bp', updated_at = @now WHERE id IN ('cmmwuxhob0c8pm3hwt6n28nf9','cmmwuxhnc0c8nm3hwxos82tna');
DELETE FROM series WHERE id IN ('cmmxe6cxs02hh9esi8jg962us');

-- Saga do Monstro do Pântano - Livro (Panini) (6 gibis)
UPDATE series SET title = 'Saga do Monstro do Pântano - Livro (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe5v7v02269esi6pqdvnc3';
UPDATE catalog_entries SET series_id = 'cmmxe5v7v02269esi6pqdvnc3', updated_at = @now WHERE id IN ('cmmwuvsuf08ojm3hworxx2g52','cmmwuvstp08ohm3hw9e9d7vxp','cmmwuvshn08nzm3hwqmtkybm1','cmmwuvsr308ofm3hwl4hmvypv','cmmwuwjp509zvm3hwwj7di4e5','cmmwuwjoe09ztm3hwd79l8fc7');
DELETE FROM series WHERE id IN ('cmmxe5v7602259esirladm7cb','cmmxe5v3602209esidih7i7z8','cmmxe5v6j02249esi0pwhqkq0','cmmxe606r02779esitpgnwuku','cmmxe605s02769esiykbul71w');

-- Samurai (Devir) (2 gibis)
UPDATE series SET title = 'Samurai (Devir)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe65ta02bx9esiclfqgw8r';
UPDATE catalog_entries SET series_id = 'cmmxe65ta02bx9esiclfqgw8r', updated_at = @now WHERE id IN ('cmmwuxa090br1m3hw8h3pauaj','cmmwux9zb0bqzm3hwtv7n82ku');
DELETE FROM series WHERE id IN ('cmmxe65so02bw9esizpkn1nxz');

-- Scott Pilgrim Contra o Mundo (Cia das Letras) (3 gibis)
UPDATE series SET title = 'Scott Pilgrim Contra o Mundo (Cia das Letras)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe6i5h02lq9esij5404sxv';
UPDATE catalog_entries SET series_id = 'cmmxe6i5h02lq9esij5404sxv', updated_at = @now WHERE id IN ('cmmwuxs9x0cxom3hwlf7y3m8q','cmmwuxs940cxmm3hwdaxci59x','cmmwuxs7v0cxjm3hwqtjyqs0l');
DELETE FROM series WHERE id IN ('cmmxe6i5002lp9esi3utj7b1w','cmmxe6i4i02lo9esiyuryqz38');

-- Silenciadora (Panini) (2 gibis)
UPDATE series SET title = 'Silenciadora (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5j9801os9esiytgbx2u0';
UPDATE catalog_entries SET series_id = 'cmmxe5j9801os9esiytgbx2u0', updated_at = @now WHERE id IN ('cmmwut05i027rm3hw5e6kmqg4','cmmwv7y0a03g6120n310fxku3');
DELETE FROM series WHERE id IN ('cmmxe88o004k59esix41e7odi');

-- Sin City - Inferno (Pandora) (2 gibis)
UPDATE series SET title = 'Sin City - Inferno (Pandora)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe65m802bp9esi6m7921b0';
UPDATE catalog_entries SET series_id = 'cmmxe65m802bp9esi6m7921b0', updated_at = @now WHERE id IN ('cmmwux9sa0bqhm3hwvw4p8kkz','cmmwux9rl0bqfm3hwi69iwaek');
DELETE FROM series WHERE id IN ('cmmxe65lo02bo9esiansh61lk');

-- Sombra (Mythos) (2 gibis)
UPDATE series SET title = 'Sombra (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6ham02kq9esibh2u6t9i';
UPDATE catalog_entries SET series_id = 'cmmxe6ham02kq9esibh2u6t9i', updated_at = @now WHERE id IN ('cmmwuxpa60cq9m3hwkxrpp91a','cmmwuxou70cp5m3hw2vphv53j');
DELETE FROM series WHERE id IN ('cmmxe6h1h02ki9esiay9ilfgi');

-- Spawn - Origem (Pixel) (2 gibis)
UPDATE series SET title = 'Spawn - Origem (Pixel)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe61u4028p9esi7rj3s5cz';
UPDATE catalog_entries SET series_id = 'cmmxe61u4028p9esi7rj3s5cz', updated_at = @now WHERE id IN ('cmmwuwwod0auvm3hwzq8gs0b9','cmmwuwwnd0autm3hw68bak0dd');
DELETE FROM series WHERE id IN ('cmmxe61rt028o9esi398j5lsp');

-- Spawn - Origens (Panini) (9 gibis)
UPDATE series SET title = 'Spawn - Origens (Panini)', total_editions = 9, updated_at = @now WHERE id = 'cmmxe59fh01cv9esih32ovwq6';
UPDATE catalog_entries SET series_id = 'cmmxe59fh01cv9esih32ovwq6', updated_at = @now WHERE id IN ('cmmwus6v00083m3hwozm5ol8t','cmmwuwxlh0awzm3hwmbq332jl','cmmwuwxkn0awxm3hwzgon5120','cmmwuwxjv0awvm3hwtzaq2mw3','cmmwuwxj40awtm3hwje3gtucb','cmmwus6u90081m3hwzqmtj1uc','cmmwuwxib0awrm3hw5ocrqq9q','cmmwuwxhh0awpm3hwcl42mjsm','cmmwuwxgo0awnm3hwdsjccqa4');
DELETE FROM series WHERE id IN ('cmmxe62mg029b9esi2s8yi0k6','cmmxe62kl029a9esiqf4kp41w','cmmxe62jp02999esidgpxdpa2','cmmxe62it02989esikytf31ta','cmmxe59et01cu9esipywg9ww8','cmmxe62gr02979esicobtgre1','cmmxe62fz02969esi6nvzwq1x','cmmxe62f102959esiu9r0k39s');

-- Spirit (L&PM) (5 gibis)
UPDATE series SET title = 'Spirit (L&PM)', total_editions = 5, updated_at = @now WHERE id = 'cmmxe6ho202l19esie1c51hrq';
UPDATE catalog_entries SET series_id = 'cmmxe6ho202l19esie1c51hrq', updated_at = @now WHERE id IN ('cmmwuxqhm0ct5m3hwu8bgfsir','cmmwux3k70bazm3hw5n7ca1iz','cmmwux3je0baxm3hwbx9ho7b2','cmmwuxqgt0ct3m3hw2766qhjv','cmmwuxqg00ct1m3hwsb0vm6ft');
DELETE FROM series WHERE id IN ('cmmxe63mr02ae9esioeswwg0v','cmmxe63md02ad9esiwjzn4yre','cmmxe6hne02l09esifmpwqxtc','cmmxe6hld02kz9esigpe7vgvu');

-- Star Wars - Caçadores de Recompensas (Panini) (2 gibis)
UPDATE series SET title = 'Star Wars - Caçadores de Recompensas (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6qes02v69esi0dx1fn6d';
UPDATE catalog_entries SET series_id = 'cmmxe6qes02v69esi0dx1fn6d', updated_at = @now WHERE id IN ('cmmwv03eh0idsm3hwtu2fjv2o','cmmwv03dl0idom3hw33p51agr');
DELETE FROM series WHERE id IN ('cmmxe6qdv02v59esipz8je085');

-- Star Wars - Darth Vader (Panini) (5 gibis)
UPDATE series SET title = 'Star Wars - Darth Vader (Panini)', total_editions = 5, updated_at = @now WHERE id = 'cmmxe6qcy02v49esilokumjzw';
UPDATE catalog_entries SET series_id = 'cmmxe6qcy02v49esilokumjzw', updated_at = @now WHERE id IN ('cmmwv03ak0idgm3hww7fe0yhf','cmmwv039t0idem3hwzkbyof84','cmmwv03930idcm3hw0krcbku0','cmmwv033u0icym3hw8a1hbafc','cmmwusfx700uem3hwoylhroch');
DELETE FROM series WHERE id IN ('cmmxe6qc302v39esixywk9t25','cmmxe6qb702v29esiy2mm79cw','cmmxe6q4k02uw9esiht4r0yez','cmmxe5bvv01g29esidhu8ekiv');

-- Star Wars - Doutora Aphra (Panini) (3 gibis)
UPDATE series SET title = 'Star Wars - Doutora Aphra (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe6e0a02id9esi1bqmrq4p';
UPDATE catalog_entries SET series_id = 'cmmxe6e0a02id9esi1bqmrq4p', updated_at = @now WHERE id IN ('cmmwuxjk70cd7m3hwcvivlqr9','cmmwuxi750c9vm3hw5kj8pt6g','cmmwuxi600c9tm3hwiqonc1ep');
DELETE FROM series WHERE id IN ('cmmxe6ddk02hu9esiqkqzmue2','cmmxe6dcl02ht9esiw1xbxbz4');

-- Star Wars - Han Solo e Chewbacca (Panini) (2 gibis)
UPDATE series SET title = 'Star Wars - Han Solo e Chewbacca (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5bv401g19esiapxrn0ya';
UPDATE catalog_entries SET series_id = 'cmmxe5bv401g19esiapxrn0ya', updated_at = @now WHERE id IN ('cmmwusfwe00ucm3hwe3afq5ng','cmmwv030e0icom3hwqrnz9v1s');
DELETE FROM series WHERE id IN ('cmmxe6q1p02uu9esizu8x5378');

-- Star Wars - Poe Dameron (Panini) (2 gibis)
UPDATE series SET title = 'Star Wars - Poe Dameron (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5hoq01mv9esi3a0o8cvo';
UPDATE catalog_entries SET series_id = 'cmmxe5hoq01mv9esi3a0o8cvo', updated_at = @now WHERE id IN ('cmmwusuqf01udm3hwjp1ca6ce','cmmwut04s027pm3hw7p67p88z');
DELETE FROM series WHERE id IN ('cmmxe5j8b01or9esirl12ja29');

-- Star Wars - The Mandalorian (Panini) (2 gibis)
UPDATE series SET title = 'Star Wars - The Mandalorian (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6pzw02us9esicuj78z2d';
UPDATE catalog_entries SET series_id = 'cmmxe6pzw02us9esicuj78z2d', updated_at = @now WHERE id IN ('cmmwv02uw0icam3hwtnwk907h','cmmwv02u20ic8m3hw74i0cu03');
DELETE FROM series WHERE id IN ('cmmxe6py502ur9esi7sv9bwx4');

-- Star Wars (Panini) (6 gibis)
UPDATE series SET title = 'Star Wars (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe6qi402va9esio4kp6c7p';
UPDATE catalog_entries SET series_id = 'cmmxe6qi402va9esio4kp6c7p', updated_at = @now WHERE id IN ('cmmwv03hs0ie0m3hwwap0tyl2','cmmwv03gw0idym3hwo1dijxnf','cmmwv03g30idwm3hweojqr3x8','cmmwv03fd0idum3hwm9pu6gbx','cmmwv02tb0ic6m3hwkl6ogu6c','cmmwv02sl0ic4m3hw1fpo6603');
DELETE FROM series WHERE id IN ('cmmxe6qh702v99esivg4unbi3','cmmxe6qgf02v89esimfyx4he4','cmmxe6qfi02v79esi9et24pq5','cmmxe6pw802uq9esi4cvl7qki','cmmxe6pur02up9esidcx04ye9');

-- Stormwatch (Panini) (4 gibis)
UPDATE series SET title = 'Stormwatch (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe5rnm01xw9esi52my8qeq';
UPDATE catalog_entries SET series_id = 'cmmxe5rnm01xw9esi52my8qeq', updated_at = @now WHERE id IN ('cmmwuung106bmm3hwqq5e63am','cmmwv3xmj0qogm3hwzq590cvb','cmmwv3xls0qoem3hwcqvqwpb9','cmmwv3xl00qocm3hwlhkiikv6');
DELETE FROM series WHERE id IN ('cmmxe799z03ha9esindrn37lf','cmmxe799903h99esiqz9jsudi','cmmxe798k03h89esi2x2fbzzp');

-- Superalmanaque Batman (Mythos) (2 gibis)
UPDATE series SET title = 'Superalmanaque Batman (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe73st03ap9esicvgh9edd';
UPDATE catalog_entries SET series_id = 'cmmxe73st03ap9esicvgh9edd', updated_at = @now WHERE id IN ('cmmwv2wos0obgm3hwa5ixp6vf','cmmwv28fk0n48m3hwtqv167hz');
DELETE FROM series WHERE id IN ('cmmxe70bf036b9esiubvow3vk');

-- Superchoque (Panini) (4 gibis)
UPDATE series SET title = 'Superchoque (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe861x04hi9esimk8g1vdv';
UPDATE catalog_entries SET series_id = 'cmmxe861x04hi9esimk8g1vdv', updated_at = @now WHERE id IN ('cmmwv7qoh030i120nc71z3o3c','cmmwv7q7c02z6120nuwreh638','cmmwv7pka02xg120nhwn26xha','cmmwv7oq102ve120nu6sa58ls');
DELETE FROM series WHERE id IN ('cmmxe85ro04h39esipfqg1mxj','cmmxe85as04gk9esi7uprmn9b','cmmxe84q304g29esi7cmp6a0m');

-- Superman - Ano Um (Panini) (4 gibis)
UPDATE series SET title = 'Superman - Ano Um (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe7ai803j09esi3l2mzn0u';
UPDATE catalog_entries SET series_id = 'cmmxe7ai803j09esi3l2mzn0u', updated_at = @now WHERE id IN ('cmmwv48bg0raam3hw5i990jdp','cmmwv48aq0ra8m3hwqjjn9nmc','cmmwusuvf01urm3hw6vfcajot','cmmwv46ul0r6wm3hwpjpbaaq5');
DELETE FROM series WHERE id IN ('cmmxe7ahn03iz9esirhuyb28s','cmmxe5hre01mw9esiygiuodit','cmmxe7a5h03ii9esi2cwap5rc');

-- Superman - Lendas do Homem de Aço - José Luis García-López (Panini) (2 gibis)
UPDATE series SET title = 'Superman - Lendas do Homem de Aço - José Luis García-López (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7anc03j99esiiib90m0n';
UPDATE catalog_entries SET series_id = 'cmmxe7anc03j99esiiib90m0n', updated_at = @now WHERE id IN ('cmmwv49ya0re8m3hwa6q5gw2l','cmmwv49xj0re6m3hwtbee1r6u');
DELETE FROM series WHERE id IN ('cmmxe7ams03j89esiybcts5f8');

-- Superman - Terra Um (Panini) (5 gibis)
UPDATE series SET title = 'Superman - Terra Um (Panini)', total_editions = 5, updated_at = @now WHERE id = 'cmmxe5sg601yv9esi5hh1qrf8';
UPDATE catalog_entries SET series_id = 'cmmxe5sg601yv9esi5hh1qrf8', updated_at = @now WHERE id IN ('cmmwuuv9406uwm3hwjrbd1qv9','cmmwv47oh0r8km3hwslpr8ac3','cmmwuun7t06b2m3hwj4rl76bx','cmmwv47nq0r8im3hw2okc0rxk','cmmwut06x027vm3hw4lew8k3c');
DELETE FROM series WHERE id IN ('cmmxe7ae703it9esiyg9klp9d','cmmxe5rn201xv9esisebfk671','cmmxe7adj03is9esidv2wnghv','cmmxe5jab01ot9esi5yfrd4kh');

-- Superman (2025) (Panini) (9 gibis)
UPDATE series SET title = 'Superman (2025) (Panini)', total_editions = 9, updated_at = @now WHERE id = 'cmmxe7v6q045z9esiqtmkltvu';
UPDATE catalog_entries SET series_id = 'cmmxe7v6q045z9esiqtmkltvu', updated_at = @now WHERE id IN ('cmmwv79zy01wm120nibydwnhy','cmmwv79q201vq120nc72h2hxw','cmmwv79ah01um120n9z1px9df','cmmwv78i101si120nbspxq40s','cmmwv784n01re120nq658xwvk','cmmwv77q401q4120n517bueot','cmmwv76re01nm120nyvtmam7h','cmmwv76et01n2120nnll2v5ji','cmmwv75qs01lx120nyxwe0lfq');
DELETE FROM series WHERE id IN ('cmmxe7v1k045p9esiaoptysbv','cmmxe7uqr04599esimu80czu9','cmmxe7tze044j9esi6gy991xm','cmmxe7tkk04429esi7syuu0d6','cmmxe7tav043o9esibt462fp7','cmmxe7sp1042r9esie60xt64m','cmmxe7shh042i9esikumhvm80','cmmxe7s6504259esi183dfe58');

-- Superman Vs Comida - As Refeições Do Homem De Aço (Panini) (3 gibis)
UPDATE series SET title = 'Superman Vs Comida - As Refeições Do Homem De Aço (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe80vp04cx9esi5jw9k215';
UPDATE catalog_entries SET series_id = 'cmmxe80vp04cx9esi5jw9k215', updated_at = @now WHERE id IN ('cmmwv7k3o02l0120n7rj5s3ci','cmmwv7j4302iq120ns0cqpbfb','cmmwv7ig702h2120nbqcxm3vm');
DELETE FROM series WHERE id IN ('cmmxe7zzq04ca9esi6w6ojyft','cmmxe7zkx04bt9esind8r3p9m');

-- Sweet Tooth - Depois do Apocalipse (Panini) (6 gibis)
UPDATE series SET title = 'Sweet Tooth - Depois do Apocalipse (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe5xna02529esizjoue64p';
UPDATE catalog_entries SET series_id = 'cmmxe5xna02529esizjoue64p', updated_at = @now WHERE id IN ('cmmwuwept09o3m3hww0lnougg','cmmwuweor09o1m3hw4thwqoje','cmmwuwens09nzm3hwsx7ow7m7','cmmwuvtsq08ppm3hwt7z4kfxz','cmmwuwk660a13m3hwkbi7kojk','cmmwuwk5g0a11m3hwuuhl9dli');
DELETE FROM series WHERE id IN ('cmmxe5xmg02519esikydlyl5g','cmmxe5xlo02509esin82dl3u4','cmmxe5vdb022f9esin7g5skoc','cmmxe60da027d9esipitl3exg','cmmxe60cf027c9esi772hrdxv');

-- Tartarugas Ninja - Coleção Clássica (Pipoca e Nanquim) (6 gibis)
UPDATE series SET title = 'Tartarugas Ninja - Coleção Clássica (Pipoca e Nanquim)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe5gyw01m49esisyrt31q5';
UPDATE catalog_entries SET series_id = 'cmmxe5gyw01m49esisyrt31q5', updated_at = @now WHERE id IN ('cmmwusstc01q7m3hwekevl8yj','cmmwuxhme0c8lm3hwxsumbjyt','cmmwussse01q5m3hw2nqpnfgw','cmmwusq5301jdm3hwqa1aonqi','cmmwuxe700c0dm3hw8c6dfr1h','cmmwuxe670c0bm3hw98oarax0');
DELETE FROM series WHERE id IN ('cmmxe6cv602hg9esino15m4qr','cmmxe5gyc01m39esig9fsy7my','cmmxe5ggc01ld9esizqcwfs8i','cmmxe697702ek9esia3p34uz7','cmmxe694y02ej9esin9a5v7di');

-- Titãs (2024) (Panini) (3 gibis)
UPDATE series SET title = 'Titãs (2024) (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe7xwe049b9esia97wyn26';
UPDATE catalog_entries SET series_id = 'cmmxe7xwe049b9esia97wyn26', updated_at = @now WHERE id IN ('cmmwv7egh027g120nwtov3suj','cmmwv7b0601zc120n2xoe2nii','cmmwv780t01r2120nf4z255h4');
DELETE FROM series WHERE id IN ('cmmxe7vmv046s9esi5cza9cmc','cmmxe7tiv04409esi7okq7xpt');

-- Tom Strong (Devir) (2 gibis)
UPDATE series SET title = 'Tom Strong (Devir)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe650g02ba9esiyrtflba1';
UPDATE catalog_entries SET series_id = 'cmmxe650g02ba9esiyrtflba1', updated_at = @now WHERE id IN ('cmmwux9fc0bpjm3hwiwqzmrbv','cmmwux9eh0bphm3hw04htwer8');
DELETE FROM series WHERE id IN ('cmmxe64x702b99esixvn5n270');

-- Top (Devir) (2 gibis)
UPDATE series SET title = 'Top (Devir)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe63di02a19esihoo4max2';
UPDATE catalog_entries SET series_id = 'cmmxe63di02a19esihoo4max2', updated_at = @now WHERE id IN ('cmmwux1yn0b6tm3hwqez2mqr9','cmmwux9cx0bpdm3hwwmfu2pqi');
DELETE FROM series WHERE id IN ('cmmxe64rp02b79esi5914c5pz');

-- Ultra - Sete Dias (Pixel) (2 gibis)
UPDATE series SET title = 'Ultra - Sete Dias (Pixel)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe62sm029h9esi0k0s7tht';
UPDATE catalog_entries SET series_id = 'cmmxe62sm029h9esi0k0s7tht', updated_at = @now WHERE id IN ('cmmwuwyww0azzm3hw82qe0g9h','cmmwuwyu60aztm3hwfk9xj8s3');
DELETE FROM series WHERE id IN ('cmmxe62rs029g9esideby3a64');

-- Venom (2025) (Panini) (9 gibis)
UPDATE series SET title = 'Venom (2025) (Panini)', total_editions = 9, updated_at = @now WHERE id = 'cmmxe7eiw03na9esigdyhcipz';
UPDATE catalog_entries SET series_id = 'cmmxe7eiw03na9esigdyhcipz', updated_at = @now WHERE id IN ('cmmwv4knx0s59m3hw14dn1dtb','cmmwv4k7m0s47m3hwthem8mbb','cmmwv4jv90s37m3hwm5hsky2x','cmmwv4j8d0s1dm3hworoq4b2f','cmmwv4iok0rznm3hwj1v2l824','cmmwv4i6a0rydm3hwgg6vofkv','cmmwv4h9k0rwrm3hwn4mkozoe','cmmwv4ghm0ruzm3hwtaeozjid','cmmwv4g0t0rtmm3hwry8osy4s');
DELETE FROM series WHERE id IN ('cmmxe7eaw03mz9esi6w92wf8z','cmmxe7e4f03mr9esiipn5l37r','cmmxe7dnt03m89esis7lmk2g0','cmmxe7d9o03lt9esiedsokntb','cmmxe7cz303lf9esiamydcu3t','cmmxe7cl903ku9esicdigw3s7','cmmxe7byj03kb9esigwxd7fmj','cmmxe7b1703jt9esifdv28w81');

-- Vingadores - Tempo Esgotado (Panini) (4 gibis)
UPDATE series SET title = 'Vingadores - Tempo Esgotado (Panini)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe6v4303119esikqyce3t3';
UPDATE catalog_entries SET series_id = 'cmmxe6v4303119esikqyce3t3', updated_at = @now WHERE id IN ('cmmwv0uy80kdmm3hwgrhk8vnu','cmmwv0uxg0kdkm3hwyq2jetsh','cmmwv0uwn0kdim3hwzi6fy0se','cmmwut8o502szm3hw69my3hgw');
DELETE FROM series WHERE id IN ('cmmxe6v3c03109esimxsjkg7b','cmmxe6v2m030z9esi0tgbvlqt','cmmxe5lde01ra9esiziq46mt9');

-- Vingadores e X-Men - Eixo - Livro (Panini) (3 gibis)
UPDATE series SET title = 'Vingadores e X-Men - Eixo - Livro (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe5otm01un9esiqf5fj1qr';
UPDATE catalog_entries SET series_id = 'cmmxe5otm01un9esiqf5fj1qr', updated_at = @now WHERE id IN ('cmmwutnnh03u7m3hw8xo498qh','cmmwv0ge90jbgm3hw7d43g3rf','cmmwv0gdi0jbem3hwhlyucsxt');
DELETE FROM series WHERE id IN ('cmmxe6sjl02y19esiomwysl9s','cmmxe6sj302y09esiq6tljwao');

-- VXE: Juízo Final (Panini) (3 gibis)
UPDATE series SET title = 'VXE: Juízo Final (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe7lld03vk9esig2i52nq3';
UPDATE catalog_entries SET series_id = 'cmmxe7lld03vk9esig2i52nq3', updated_at = @now WHERE id IN ('cmmwv6qw000kl120nwuzoqrxk','cmmwv6qa800iv120nosbpj1r1','cmmwv6moc008r120nr0c1pkpy');
DELETE FROM series WHERE id IN ('cmmxe7lb603v69esi23mx8462','cmmxe7k8e03tg9esi42e7g81g');

-- Wolverine (2025) (Panini) (11 gibis)
UPDATE series SET title = 'Wolverine (2025) (Panini)', total_editions = 11, updated_at = @now WHERE id = 'cmmxe7ezp03nx9esiwkxyw9yj';
UPDATE catalog_entries SET series_id = 'cmmxe7ezp03nx9esiwkxyw9yj', updated_at = @now WHERE id IN ('cmmwv4lsy0s7hm3hwu00ipho4','cmmwv4l380s65m3hwo4qhrdx9','cmmwv4koy0s5bm3hwx1b5q7au','cmmwv4k8a0s49m3hwqx9gycfe','cmmwv4jqb0s2tm3hwle1wz9uy','cmmwv4j8z0s1fm3hw26mw3k4q','cmmwv4in20rzjm3hwst8calyu','cmmwv4i5e0rybm3hwul63gvta','cmmwv4h7i0rwnm3hw0qdhbzey','cmmwv4gj20rv3m3hwuxg9m7ba','cmmwv4fzt0rtjm3hwelnwg86i');
DELETE FROM series WHERE id IN ('cmmxe7enm03nj9esih3iugxct','cmmxe7ejf03nb9esi7l8rua2b','cmmxe7ebm03n09esi4mzdyrdm','cmmxe7e1x03mo9esi5wcpamer','cmmxe7doo03m99esisz40si1m','cmmxe7d8b03ls9esi1iv3dd2i','cmmxe7cyk03le9esiv66yx4bf','cmmxe7cjg03ks9esiprhok9re','cmmxe7c1l03kd9esi2mop575n','cmmxe7azv03js9esidyjfnent');

-- X-Men - A Era do Apocalipse (Panini) (6 gibis)
UPDATE series SET title = 'X-Men - A Era do Apocalipse (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe5qzy01x39esikkefpxro';
UPDATE catalog_entries SET series_id = 'cmmxe5qzy01x39esikkefpxro', updated_at = @now WHERE id IN ('cmmwuu9in05d0m3hwr51utccc','cmmwv1bk80lhqm3hwh5rcqqrk','cmmwv1bhw0lhom3hwgnkfo6cv','cmmwv1odt0m3wm3hwm10m7px1','cmmwv1oc90m3um3hw4g4btcl1','cmmwv1obf0m3sm3hwd1f4ea1c');
DELETE FROM series WHERE id IN ('cmmxe6wh8032x9esihys4ngmo','cmmxe6wgn032w9esilfji6ll2','cmmxe6yit034g9esi5cnv2zhi','cmmxe6yi2034f9esicw5au8t1','cmmxe6yha034e9esi10s33uyx');

-- X-Men - Grand Design (Panini) (3 gibis)
UPDATE series SET title = 'X-Men - Grand Design (Panini)', total_editions = 3, updated_at = @now WHERE id = 'cmmxe6xb3033h9esil7572ygf';
UPDATE catalog_entries SET series_id = 'cmmxe6xb3033h9esil7572ygf', updated_at = @now WHERE id IN ('cmmwv1fxy0lpqm3hwx9x9hdga','cmmwv1fxc0lpom3hw3sycl2qi','cmmwv1fwp0lpmm3hw43u6fz2p');
DELETE FROM series WHERE id IN ('cmmxe6x71033g9esihn61sgno','cmmxe6x3j033f9esifrkpajrh');

-- X-Men - Inferno (Panini) (6 gibis)
UPDATE series SET title = 'X-Men - Inferno (Panini)', total_editions = 6, updated_at = @now WHERE id = 'cmmxe6xzi033v9esingtwfqve';
UPDATE catalog_entries SET series_id = 'cmmxe6xzi033v9esingtwfqve', updated_at = @now WHERE id IN ('cmmwv1h7e0lrym3hw0l1s1i15','cmmwv1h4u0lrwm3hw9j8x38ke','cmmwv1h460lrum3hwzutstpdx','cmmwv1h3h0lrsm3hw6kvuggef','cmmwv1h2v0lrqm3hwo4vcwpar','cmmwv1h040lrom3hw610ibclo');
DELETE FROM series WHERE id IN ('cmmxe6xyp033u9esioaysdppm','cmmxe6xxu033t9esimyt8il7z','cmmxe6xvg033s9esihdpb1zjl','cmmxe6xts033r9esiuudmcgx1','cmmxe6xs3033q9esimygyz2tc');

-- X-Men Widescreen (Panini) (2 gibis)
UPDATE series SET title = 'X-Men Widescreen (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe6ykr034j9esib5lpyuty';
UPDATE catalog_entries SET series_id = 'cmmxe6ykr034j9esib5lpyuty', updated_at = @now WHERE id IN ('cmmwv1pq30m5am3hwraermx6n','cmmwv1po80m58m3hwf1u5ihbj');
DELETE FROM series WHERE id IN ('cmmxe6yk4034i9esi5wkdju97');

-- X-Men: Carrascos (Panini) (2 gibis)
UPDATE series SET title = 'X-Men: Carrascos (Panini)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe7jye03t39esips5aqhim';
UPDATE catalog_entries SET series_id = 'cmmxe7jye03t39esips5aqhim', updated_at = @now WHERE id IN ('cmmwv6lwl0073120n3d3hf3hk','cmmwv4trj0sr1m3hwnchk2omk');
DELETE FROM series WHERE id IN ('cmmxe7jl703sm9esi9vew85ok');

-- X-O Manowar (HQM) (2 gibis)
UPDATE series SET title = 'X-O Manowar (HQM)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5nbf01th9esimx5jz87t';
UPDATE catalog_entries SET series_id = 'cmmxe5nbf01th9esimx5jz87t', updated_at = @now WHERE id IN ('cmmwutigx03hlm3hwk03xek44','cmmwuxm8p0cjdm3hwo0ztg1fv');
DELETE FROM series WHERE id IN ('cmmxe6gid02k19esi8c3cuyrt');

-- Zenith (Mythos) (2 gibis)
UPDATE series SET title = 'Zenith (Mythos)', total_editions = 2, updated_at = @now WHERE id = 'cmmxe5ksl01q69esiozd4ceny';
UPDATE catalog_entries SET series_id = 'cmmxe5ksl01q69esiozd4ceny', updated_at = @now WHERE id IN ('cmmwut50k02jjm3hwy0br9cas','cmmwut4z702jhm3hwx2s7yofk');
DELETE FROM series WHERE id IN ('cmmxe5krz01q59esi6e0zwqvj');

-- Zenith Fase (Pandora) (4 gibis)
UPDATE series SET title = 'Zenith Fase (Pandora)', total_editions = 4, updated_at = @now WHERE id = 'cmmxe6hei02ku9esicmcap1i3';
UPDATE catalog_entries SET series_id = 'cmmxe6hei02ku9esicmcap1i3', updated_at = @now WHERE id IN ('cmmwuxq5f0csbm3hwrev7rfg7','cmmwux31o0b9pm3hwjgjfoq9x','cmmwux30r0b9nm3hwci7c0ci5','cmmwuxq4l0cs9m3hw2r3filrn');
DELETE FROM series WHERE id IN ('cmmxe63lv02ac9esi0h61mj7w','cmmxe63k402ab9esipyi90xx2','cmmxe6hcn02kt9esihvxtbhp8');
