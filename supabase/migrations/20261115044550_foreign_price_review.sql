-- Immutable submissions and private evidence; only explicitly appointed reviewers may approve.
create table public.foreign_shop_references (
 country text not null, shop text not null, item_id integer not null check(item_id>0),
 item_name text not null, item_type text not null,
 buy_price bigint not null check(buy_price between 0 and 100000000000000),
 observed_on date not null, source text not null,
 revision integer not null default 0, updated_at timestamptz not null default now(),
 primary key(country,shop,item_id)
);
create table public.foreign_price_reviewers(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.foreign_shop_references enable row level security;
alter table public.foreign_price_reviewers enable row level security;
revoke all on public.foreign_shop_references,public.foreign_price_reviewers from public,anon,authenticated;
grant select on public.foreign_shop_references,public.foreign_price_reviewers to authenticated;
create policy references_read on public.foreign_shop_references for select to authenticated using(true);
create policy reviewer_self on public.foreign_price_reviewers for select to authenticated using(user_id=(select auth.uid()));
create function public.is_foreign_price_reviewer() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.foreign_price_reviewers where user_id=auth.uid());
$$;
revoke all on function public.is_foreign_price_reviewer() from public,anon;
grant execute on function public.is_foreign_price_reviewer() to authenticated;
create table public.foreign_price_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
 country text not null, shop text not null, item_id integer not null,
 proposed_price bigint not null check(proposed_price between 0 and 100000000000000),
 old_price bigint not null, base_revision integer not null,
 observed_on date not null, notes text not null default '' check(length(notes)<=1000),
 screenshot_path text not null unique,
 status text not null default 'draft' check(status in ('draft','pending','approved','rejected','withdrawn')),
 created_at timestamptz not null default now(), submitted_at timestamptz,
 reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete set null,
 review_note text not null default '' check(length(review_note)<=1000), applied_price bigint,
 foreign key(country,shop,item_id) references public.foreign_shop_references(country,shop,item_id)
);
create index foreign_price_requests_owner_created on public.foreign_price_requests(user_id,created_at desc);
create index foreign_price_requests_queue on public.foreign_price_requests(status,created_at);
alter table public.foreign_price_requests enable row level security;
revoke all on public.foreign_price_requests from public,anon,authenticated;
grant select on public.foreign_price_requests to authenticated;
create policy requests_read on public.foreign_price_requests for select to authenticated using(user_id=(select auth.uid()) or (select public.is_foreign_price_reviewer()));
insert into public.foreign_shop_references(country,shop,item_id,item_name,item_type,buy_price,observed_on,source) values
('Mexico','General Store',159,'Bolt Cutters','Tool',20,'2026-11-10','User screenshot'),
('Mexico','General Store',426,'Bottle of Tequila','Alcohol',80,'2026-11-10','User screenshot'),
('Mexico','General Store',1125,'Card Skimmer','Tool',180,'2026-11-10','User screenshot'),
('Mexico','General Store',432,'Crazy Straw','Other',20,'2026-11-10','User screenshot'),
('Mexico','General Store',260,'Dahlia','Flower',300,'2026-11-10','User screenshot'),
('Mexico','General Store',258,'Jaguar Plushie','Plushie',10000,'2026-11-10','User screenshot'),
('Mexico','General Store',259,'Mayan Statue','Other',500,'2026-11-10','User screenshot'),
('Mexico','General Store',107,'Trench Coat','Clothing',500000,'2026-11-10','User screenshot'),
('Mexico','General Store',409,'Yucca Plant','Other',20000,'2026-11-10','User screenshot'),
('Mexico','General Store',1429,'Zip Ties','Material',20,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',108,'9mm Uzi','Primary',1100000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',26,'AK-47','Primary',15000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',399,'ArmaLite M-15A4','Primary',20000000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',8,'Axe','Melee',4200,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',229,'Claymore Mine','Temporary',15000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',177,'Cobra Derringer','Secondary',70000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',20,'Desert Eagle','Secondary',45000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',178,'Flak Jacket','Defensive',7500,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',230,'Flare Gun','Secondary',300,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',231,'Heckler & Koch SL8','Primary',45000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',640,'Kevlar Gloves','Defensive',400000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',110,'Leather Bullwhip','Melee',1500,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',31,'M249 SAW','Primary',950000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',63,'Minigun','Primary',3000000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',111,'Ninja Claws','Melee',8000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',50,'Outer Tactical Vest','Defensive',1000000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',11,'Samurai Sword','Melee',75000,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',99,'Springfield 1911','Secondary',500,'2026-11-10','User screenshot'),
('Mexico','Arms Dealer',175,'Taser','Secondary',5500,'2026-11-10','User screenshot'),
('Mexico','Black Market',1499,'Obsidian Point','Artifact',141079,'2026-11-10','User screenshot'),
('Mexico','Black Market',200,'Opium','Drug',21731,'2026-11-10','User screenshot'),
('Mexico','Black Market',203,'Shrooms','Drug',1876,'2026-11-10','User screenshot'),
('Mexico','Black Market',204,'Speed','Drug',2447,'2026-11-10','User screenshot'),
('Mexico','Black Market',205,'Vicodin','Drug',1875,'2026-11-10','User screenshot'),
('Canada','General Store',1348,'Aluminum Plate','Material',1200,'2026-11-10','User screenshot'),
('Canada','General Store',263,'Crocus','Flower',600,'2026-11-10','User screenshot'),
('Canada','General Store',1361,'Dog Treats','Material',20,'2026-11-10','User screenshot'),
('Canada','General Store',410,'Fire Hydrant','Other',20000,'2026-11-10','User screenshot'),
('Canada','General Store',262,'Hockey Stick','Other',400,'2026-11-10','User screenshot'),
('Canada','General Store',413,'Mountie Hat','Clothing',30000,'2026-11-10','User screenshot'),
('Canada','General Store',328,'PVC Cards','Material',12500,'2026-11-10','User screenshot'),
('Canada','General Store',261,'Wolverine Plushie','Plushie',20,'2026-11-10','User screenshot'),
('Canada','Arms Dealer',402,'Ice Pick','Melee',20000,'2026-11-10','User screenshot'),
('Canada','Arms Dealer',252,'Ithaca 37','Primary',10000,'2026-11-10','User screenshot'),
('Canada','Arms Dealer',253,'Lorcin 380','Secondary',300,'2026-11-10','User screenshot'),
('Canada','Arms Dealer',645,'Safety Boots','Defensive',77000,'2026-11-10','User screenshot'),
('Canada','Black Market',1484,'Bear Gall','Other',30008,'2026-11-10','User screenshot'),
('Canada','Black Market',196,'Cannabis','Drug',6588,'2026-11-10','User screenshot'),
('Canada','Black Market',197,'Ecstasy','Drug',33143,'2026-11-10','User screenshot'),
('Canada','Black Market',1483,'Insulin','Other',2458,'2026-11-10','User screenshot'),
('Canada','Black Market',198,'Ketamine','Drug',59572,'2026-11-10','User screenshot'),
('Canada','Black Market',200,'Opium','Drug',25831,'2026-11-10','User screenshot'),
('Canada','Black Market',201,'PCP','Drug',2591,'2026-11-10','User screenshot'),
('Canada','Black Market',1504,'Quartz Point','Artifact',153463,'2026-11-10','User screenshot'),
('Canada','Black Market',206,'Xanax','Drug',778607,'2026-11-10','User screenshot'),
('Switzerland','General Store',273,'Chamois Plushie','Plushie',400,'2026-11-10','User screenshot'),
('Switzerland','General Store',435,'Dozen White Roses','Flower',950000000,'2026-11-10','User screenshot'),
('Switzerland','General Store',272,'Edelweiss','Flower',900,'2026-11-10','User screenshot'),
('Switzerland','General Store',361,'Neumune Tablet','Medical',900000,'2026-11-10','User screenshot'),
('Switzerland','General Store',436,'Snowboard','Other',6000,'2026-11-10','User screenshot'),
('Switzerland','Arms Dealer',222,'Flash Grenade','Temporary',12000,'2026-11-10','User screenshot'),
('Switzerland','Arms Dealer',223,'Jackhammer','Primary',5000000,'2026-11-10','User screenshot'),
('Switzerland','Arms Dealer',398,'SIG 552','Primary',7500000,'2026-11-10','User screenshot'),
('Switzerland','Arms Dealer',224,'Swiss Army Knife','Melee',2500,'2026-11-10','User screenshot'),
('Switzerland','Black Market',1489,'Ephedrine Powder','Other',13568,'2026-11-10','User screenshot'),
('Switzerland','Black Market',1491,'Ergotamine Ampoule','Other',4794,'2026-11-10','User screenshot'),
('Switzerland','Black Market',199,'LSD','Drug',23760,'2026-11-10','User screenshot'),
('Switzerland','Black Market',1490,'Safrole Oil','Other',4722,'2026-11-10','User screenshot'),
('Switzerland','Black Market',203,'Shrooms','Drug',2630,'2026-11-10','User screenshot'),
('South Africa','General Store',282,'African Violet','Flower',2000,'2026-11-11','User screenshot'),
('South Africa','General Store',406,'Afro Comb','Other',50000,'2026-11-11','User screenshot'),
('South Africa','General Store',280,'Elephant Statue','Other',500,'2026-11-11','User screenshot'),
('South Africa','General Store',281,'Lion Plushie','Plushie',400,'2026-11-11','User screenshot'),
('South Africa','Arms Dealer',653,'Combat Boots','Defensive',2400000,'2026-11-11','User screenshot'),
('South Africa','Arms Dealer',654,'Combat Gloves','Defensive',2100000,'2026-11-11','User screenshot'),
('South Africa','Arms Dealer',651,'Combat Helmet','Defensive',3100000,'2026-11-11','User screenshot'),
('South Africa','Arms Dealer',652,'Combat Pants','Defensive',2950000,'2026-11-11','User screenshot'),
('South Africa','Arms Dealer',332,'Combat Vest','Defensive',3500000,'2026-11-11','User screenshot'),
('South Africa','Arms Dealer',4,'Knuckle Dusters','Melee',800,'2026-11-11','User screenshot'),
('South Africa','Arms Dealer',225,'Mag 7','Primary',60000,'2026-11-11','User screenshot'),
('South Africa','Arms Dealer',226,'Smoke Grenade','Temporary',20000,'2026-11-11','User screenshot'),
('South Africa','Arms Dealer',227,'Spear','Melee',600,'2026-11-11','User screenshot'),
('South Africa','Arms Dealer',228,'Vektor CR-21','Primary',7500,'2026-11-11','User screenshot'),
('South Africa','Black Market',196,'Cannabis','Drug',1025,'2026-11-11','User screenshot'),
('South Africa','Black Market',198,'Ketamine','Drug',6390,'2026-11-11','User screenshot'),
('South Africa','Black Market',200,'Opium','Drug',26313,'2026-11-11','User screenshot'),
('South Africa','Black Market',1500,'Quartzite Point','Artifact',119955,'2026-11-11','User screenshot'),
('South Africa','Black Market',358,'Raw Ivory','Other',1909,'2026-11-11','User screenshot'),
('South Africa','Black Market',204,'Speed','Drug',5028,'2026-11-11','User screenshot'),
('South Africa','Black Market',1497,'Uncut Diamonds','Other',191343,'2026-11-11','User screenshot'),
('South Africa','Black Market',206,'Xanax','Drug',694270,'2026-11-11','User screenshot'),
('Argentina','General Store',271,'Ceibo Flower','Flower',500,'2026-11-11','User screenshot'),
('Argentina','General Store',407,'Compass','Other',2500,'2026-11-11','User screenshot'),
('Argentina','General Store',1466,'Lighter','Tool',20,'2026-11-11','User screenshot'),
('Argentina','General Store',269,'Monkey Plushie','Plushie',400,'2026-11-11','User screenshot'),
('Argentina','General Store',270,'Soccer Ball','Other',60,'2026-11-11','User screenshot'),
('Argentina','Arms Dealer',255,'Flamethrower','Secondary',3000000,'2026-11-11','User screenshot'),
('Argentina','Arms Dealer',333,'Liquid Body Armor','Defensive',7500000,'2026-11-11','User screenshot'),
('Argentina','Arms Dealer',391,'Macana','Melee',100000,'2026-11-11','User screenshot'),
('Argentina','Arms Dealer',256,'Tear Gas','Temporary',15000,'2026-11-11','User screenshot'),
('Argentina','Arms Dealer',257,'Throwing Knife','Temporary',35000,'2026-11-11','User screenshot'),
('Argentina','Black Market',196,'Cannabis','Drug',12153,'2026-11-11','User screenshot'),
('Argentina','Black Market',1503,'Chalcedony Point','Artifact',101537,'2026-11-11','User screenshot'),
('Argentina','Black Market',1488,'Meteorite Fragment','Artifact',468149,'2026-11-11','User screenshot'),
('Argentina','Black Market',1487,'Patagonian Fossil','Artifact',545527,'2026-11-11','User screenshot'),
('Argentina','Black Market',203,'Shrooms','Drug',5349,'2026-11-11','User screenshot'),
('Hawaii','General Store',430,'Coconut Bra','Clothing',750000,'2026-11-11','User screenshot'),
('Hawaii','General Store',421,'Large Suitcase','Enhancer',10000000,'2026-11-11','User screenshot'),
('Hawaii','General Store',420,'Medium Suitcase','Enhancer',4000000,'2026-11-11','User screenshot'),
('Hawaii','General Store',264,'Orchid','Flower',700,'2026-11-11','User screenshot'),
('Hawaii','General Store',265,'Pele Charm','Other',2000,'2026-11-11','User screenshot'),
('Hawaii','General Store',419,'Small Suitcase','Enhancer',2000000,'2026-11-11','User screenshot'),
('Hawaii','Arms Dealer',241,'Bushmaster Carbon 15','Primary',15000,'2026-11-11','User screenshot'),
('Hawaii','Arms Dealer',242,'HEG','Temporary',20000,'2026-11-11','User screenshot'),
('Hawaii','Arms Dealer',243,'Taurus PT92','Secondary',600,'2026-11-11','User screenshot'),
('Hawaii','Arms Dealer',240,'Type 98 Anti Tank','Secondary',25000000,'2026-11-11','User screenshot'),
('Hawaii','Black Market',1502,'Basalt Point','Artifact',107811,'2026-11-11','User screenshot'),
('Hawaii','Black Market',196,'Cannabis','Drug',9653,'2026-11-11','User screenshot'),
('Hawaii','Black Market',199,'LSD','Drug',22971,'2026-11-11','User screenshot'),
('Hawaii','Black Market',201,'PCP','Drug',8022,'2026-11-11','User screenshot'),
('Hawaii','Black Market',1485,'Shark Fin','Other',20348,'2026-11-11','User screenshot'),
('Hawaii','Black Market',204,'Speed','Drug',6184,'2026-11-11','User screenshot'),
('Hawaii','Black Market',1486,'Turtle Shell','Other',68705,'2026-11-11','User screenshot'),
('Cayman Islands','General Store',617,'Banana Orchid','Flower',4000,'2026-11-12','User screenshot'),
('Cayman Islands','General Store',624,'Bikini','Clothing',8000,'2026-11-12','User screenshot'),
('Cayman Islands','General Store',626,'Diving Gloves','Clothing',5000,'2026-11-12','User screenshot'),
('Cayman Islands','General Store',622,'Flippers','Clothing',10000,'2026-11-12','User screenshot'),
('Cayman Islands','General Store',620,'Nodding Turtle','Other',700,'2026-11-12','User screenshot'),
('Cayman Islands','General Store',621,'Snorkel','Clothing',20000,'2026-11-12','User screenshot'),
('Cayman Islands','General Store',623,'Speedo','Clothing',6000,'2026-11-12','User screenshot'),
('Cayman Islands','General Store',619,'Steel Drum','Other',1500,'2026-11-12','User screenshot'),
('Cayman Islands','General Store',618,'Stingray Plushie','Plushie',400,'2026-11-12','User screenshot'),
('Cayman Islands','General Store',625,'Wetsuit','Clothing',30000,'2026-11-12','User screenshot'),
('Cayman Islands','Arms Dealer',614,'Diamond Bladed Knife','Melee',950000,'2026-11-12','User screenshot'),
('Cayman Islands','Arms Dealer',613,'Harpoon','Secondary',300000,'2026-11-12','User screenshot'),
('Cayman Islands','Arms Dealer',615,'Naval Cutlass','Melee',50000000,'2026-11-12','User screenshot'),
('Cayman Islands','Arms Dealer',612,'Tavor TAR-21','Primary',495000,'2026-11-12','User screenshot'),
('Cayman Islands','Arms Dealer',616,'Trout','Temporary',20,'2026-11-12','User screenshot'),
('Cayman Islands','Black Market',1482,'Bearer Bond','Other',82877,'2026-11-12','User screenshot'),
('Cayman Islands','Black Market',196,'Cannabis','Drug',11552,'2026-11-12','User screenshot'),
('Cayman Islands','Black Market',204,'Speed','Drug',873,'2026-11-12','User screenshot'),
('China','General Store',275,'Jade Buddha','Other',12000,'2026-11-12','User screenshot'),
('China','General Store',1462,'Magnesium Shavings','Material',22000,'2026-11-12','User screenshot'),
('China','General Store',274,'Panda Plushie','Plushie',400,'2026-11-12','User screenshot'),
('China','General Store',276,'Peony','Flower',5000,'2026-11-12','User screenshot'),
('China','General Store',326,'Printing Paper','Material',75000,'2026-11-12','User screenshot'),
('China','General Store',335,'Stick of Dynamite','Material',50000,'2026-11-12','User screenshot'),
('China','Arms Dealer',244,'Blowgun','Secondary',2500,'2026-11-12','User screenshot'),
('China','Arms Dealer',245,'Bo Staff','Melee',500,'2026-11-12','User screenshot'),
('China','Arms Dealer',643,'Construction Helmet','Defensive',14000,'2026-11-12','User screenshot'),
('China','Arms Dealer',246,'Fireworks','Temporary',500,'2026-11-12','User screenshot'),
('China','Arms Dealer',400,'Guandao','Melee',200000,'2026-11-12','User screenshot'),
('China','Arms Dealer',247,'Katana','Melee',16000,'2026-11-12','User screenshot'),
('China','Arms Dealer',248,'Qsz-92','Secondary',90000,'2026-11-12','User screenshot'),
('China','Arms Dealer',249,'SKS Carbine','Primary',6500,'2026-11-12','User screenshot'),
('China','Arms Dealer',250,'Twin Tiger Hooks','Melee',50000,'2026-11-12','User screenshot'),
('China','Arms Dealer',251,'Wushu Double Axes','Melee',75000,'2026-11-12','User screenshot'),
('China','Black Market',327,'Blank Casino Chips','Material',20215,'2026-11-12','User screenshot'),
('China','Black Market',198,'Ketamine','Drug',11349,'2026-11-12','User screenshot'),
('China','Black Market',200,'Opium','Drug',12028,'2026-11-12','User screenshot'),
('China','Black Market',1494,'Pangolin Scales','Other',166532,'2026-11-12','User screenshot'),
('China','Black Market',204,'Speed','Drug',5433,'2026-11-12','User screenshot'),
('China','Black Market',1498,'Tiger Bone Powder','Other',30749,'2026-11-12','User screenshot'),
('UAE','General Store',384,'Camel Plushie','Plushie',14000,'2026-11-12','User screenshot'),
('UAE','General Store',381,'Gold Laptop','Tool',8000000000,'2026-11-12','User screenshot'),
('UAE','General Store',1264,'Potassium Nitrate','Material',3800,'2026-11-12','User screenshot'),
('UAE','General Store',414,'Proda Sunglasses','Clothing',100000,'2026-11-12','User screenshot'),
('UAE','General Store',412,'Sports Shades','Clothing',10000,'2026-11-12','User screenshot'),
('UAE','General Store',386,'Sports Sneakers','Enhancer',14000000000,'2026-11-12','User screenshot'),
('UAE','General Store',385,'Tribulus Omanense','Flower',6000,'2026-11-12','User screenshot'),
('UAE','Arms Dealer',382,'Gold Plated AK-47','Primary',25000000000,'2026-11-12','User screenshot'),
('UAE','Arms Dealer',387,'Handbag','Melee',16000000000,'2026-11-12','User screenshot'),
('UAE','Arms Dealer',388,'Pink Mac-10','Secondary',23000000000,'2026-11-12','User screenshot'),
('UAE','Black Market',1495,'Ambergris Lump','Other',358740,'2026-11-12','User screenshot'),
('UAE','Black Market',1496,'Natural Pearls','Other',94715,'2026-11-12','User screenshot'),
('UAE','Black Market',200,'Opium','Drug',27851,'2026-11-12','User screenshot'),
('UAE','Black Market',204,'Speed','Drug',569,'2026-11-12','User screenshot'),
('UAE','Black Market',205,'Vicodin','Drug',5550,'2026-11-12','User screenshot'),
('Japan','General Store',1333,'Bonded Latex','Material',220000,'2026-11-14','User screenshot'),
('Japan','General Store',294,'Bottle of Sake','Alcohol',40,'2026-11-14','User screenshot'),
('Japan','General Store',277,'Cherry Blossom','Flower',500,'2026-11-14','User screenshot'),
('Japan','General Store',429,'Chopsticks','Other',20,'2026-11-14','User screenshot'),
('Japan','General Store',437,'Glow Stick','Material',20,'2026-11-14','User screenshot'),
('Japan','General Store',1249,'Hydrochloric Acid','Material',24500,'2026-11-14','User screenshot'),
('Japan','General Store',278,'Kabuki Mask','Clothing',10000,'2026-11-14','User screenshot'),
('Japan','General Store',279,'Maneki Neko','Other',50000,'2026-11-14','User screenshot'),
('Japan','General Store',433,'Sensu','Other',500,'2026-11-14','User screenshot'),
('Japan','General Store',427,'Sumo Doll','Other',300,'2026-11-14','User screenshot'),
('Japan','General Store',434,'Yakitori Lantern','Other',4500,'2026-11-14','User screenshot'),
('Japan','Arms Dealer',233,'BT MP9','Secondary',55000,'2026-11-14','User screenshot'),
('Japan','Arms Dealer',234,'Chain Whip','Melee',2500,'2026-11-14','User screenshot'),
('Japan','Arms Dealer',334,'Flexible Body Armor','Defensive',15000000,'2026-11-14','User screenshot'),
('Japan','Arms Dealer',236,'Kama','Melee',50000,'2026-11-14','User screenshot'),
('Japan','Arms Dealer',237,'Kodachi','Melee',95000,'2026-11-14','User screenshot'),
('Japan','Arms Dealer',395,'Metal Nunchaku','Melee',400000,'2026-11-14','User screenshot'),
('Japan','Arms Dealer',239,'Ninja Star','Temporary',500,'2026-11-14','User screenshot'),
('Japan','Arms Dealer',238,'Sai','Melee',1000,'2026-11-14','User screenshot'),
('Japan','Arms Dealer',235,'Wooden Nunchaku','Melee',5000,'2026-11-14','User screenshot'),
('Japan','Black Market',196,'Cannabis','Drug',10332,'2026-11-14','User screenshot'),
('Japan','Black Market',1492,'Counterfeit Manga','Other',25536,'2026-11-14','User screenshot'),
('Japan','Black Market',197,'Ecstasy','Drug',39218,'2026-11-14','User screenshot'),
('Japan','Black Market',204,'Speed','Drug',6904,'2026-11-14','User screenshot'),
('Japan','Black Market',205,'Vicodin','Drug',6019,'2026-11-14','User screenshot'),
('Japan','Black Market',1493,'Whale Meat','Other',2120,'2026-11-14','User screenshot'),
('Japan','Black Market',206,'Xanax','Drug',648790,'2026-11-14','User screenshot'),
('United Kingdom','General Store',431,'Dart Board','Other',700,'2026-11-14','User screenshot'),
('United Kingdom','General Store',267,'Heather','Flower',5000,'2026-11-14','User screenshot'),
('United Kingdom','General Store',1246,'Inkwell','Material',380,'2026-11-14','User screenshot'),
('United Kingdom','General Store',411,'Model Space Ship','Other',17000,'2026-11-14','User screenshot'),
('United Kingdom','General Store',266,'Nessie Plushie','Plushie',200,'2026-11-14','User screenshot'),
('United Kingdom','General Store',416,'Paper Weight','Other',1500,'2026-11-14','User screenshot'),
('United Kingdom','General Store',268,'Red Fox Plushie','Plushie',1000,'2026-11-14','User screenshot'),
('United Kingdom','General Store',408,'Sextant','Other',25000,'2026-11-14','User screenshot'),
('United Kingdom','General Store',415,'Ship in a Bottle','Other',40000,'2026-11-14','User screenshot'),
('United Kingdom','General Store',418,'Tailor''s Dummy','Other',10000,'2026-11-14','User screenshot'),
('United Kingdom','Arms Dealer',217,'Claymore Sword','Melee',100000,'2026-11-14','User screenshot'),
('United Kingdom','Arms Dealer',438,'Cricket Bat','Melee',15000,'2026-11-14','User screenshot'),
('United Kingdom','Arms Dealer',218,'Crossbow','Secondary',900,'2026-11-14','User screenshot'),
('United Kingdom','Arms Dealer',219,'Enfield SA-80','Primary',250000,'2026-11-14','User screenshot'),
('United Kingdom','Arms Dealer',397,'Flail','Melee',8000000,'2026-11-14','User screenshot'),
('United Kingdom','Arms Dealer',439,'Frying Pan','Melee',400,'2026-11-14','User screenshot'),
('United Kingdom','Arms Dealer',220,'Grenade','Temporary',10000,'2026-11-14','User screenshot'),
('United Kingdom','Arms Dealer',221,'Stick Grenade','Temporary',8000,'2026-11-14','User screenshot'),
('United Kingdom','Arms Dealer',641,'WWII Helmet','Defensive',89500,'2026-11-14','User screenshot'),
('United Kingdom','Black Market',196,'Cannabis','Drug',10828,'2026-11-14','User screenshot'),
('United Kingdom','Black Market',1501,'Chert Point','Artifact',131215,'2026-11-14','User screenshot'),
('United Kingdom','Black Market',197,'Ecstasy','Drug',43766,'2026-11-14','User screenshot'),
('United Kingdom','Black Market',198,'Ketamine','Drug',54402,'2026-11-14','User screenshot'),
('United Kingdom','Black Market',200,'Opium','Drug',24020,'2026-11-14','User screenshot'),
('United Kingdom','Black Market',206,'Xanax','Drug',787008,'2026-11-14','User screenshot');

-- Definer RPCs expose only narrowly scoped operations; no direct client writes.
create function public.begin_foreign_price_request(p_country text,p_shop text,p_item_id integer,p_price bigint,p_observed_on date,p_notes text,p_extension text)
returns public.foreign_price_requests language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); ref public.foreign_shop_references; result public.foreign_price_requests; rid uuid:=gen_random_uuid();
begin
 if uid is null then raise exception 'Sign in required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('foreign-price:'||uid::text,0));
 if (select count(*) from public.foreign_price_requests where user_id=uid and created_at>now()-interval '24 hours')>=5 then raise exception 'Limit: 5 price requests per 24 hours'; end if;
 if p_extension is null or p_extension not in ('jpg','png','webp') or p_notes is null or length(p_notes)>1000 or p_observed_on is null or p_observed_on>current_date or p_observed_on<current_date-30 then raise exception 'Provide a PNG, JPG or WebP screenshot observed within the last 30 days'; end if;
 select * into ref from public.foreign_shop_references where country=p_country and shop=p_shop and item_id=p_item_id;
 if not found then raise exception 'Unknown destination/shop/item'; end if;
 if p_price is null or p_price<0 or p_price>100000000000000 or p_price=ref.buy_price then raise exception 'Enter a different valid purchase price'; end if;
 insert into public.foreign_price_requests(id,user_id,country,shop,item_id,proposed_price,old_price,base_revision,observed_on,notes,screenshot_path)
 values(rid,uid,p_country,p_shop,p_item_id,p_price,ref.buy_price,ref.revision,p_observed_on,p_notes,uid::text||'/'||rid::text||'/evidence.'||p_extension) returning * into result;
 return result;
end $$;
create function public.submit_foreign_price_request(p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.foreign_price_requests;
begin
 select * into r from public.foreign_price_requests where id=p_request and user_id=auth.uid() for update;
 if not found or r.status not in ('draft','pending') then raise exception 'Draft not found'; end if;
 if r.status='pending' then return; end if;
 if not exists(select 1 from storage.objects where bucket_id='foreign-price-evidence' and name=r.screenshot_path and (metadata->>'size')::bigint between 1 and 5242880 and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')) then raise exception 'Upload a screenshot before submitting'; end if;
 update public.foreign_price_requests set status='pending',submitted_at=now() where id=r.id;
end $$;
create function public.withdraw_foreign_price_draft(p_request uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.foreign_price_requests set status='withdrawn' where id=p_request and user_id=auth.uid() and status='draft';
end $$;
create function public.review_foreign_price_request(p_request uuid,p_approve boolean,p_price bigint default null,p_note text default '') returns void language plpgsql security definer set search_path='' as $$
declare r public.foreign_price_requests; ref public.foreign_shop_references; price bigint;
begin
 if not ((session_user='postgres' and current_setting('role',true) in ('none','postgres')) or (auth.uid() is not null and exists(select 1 from public.foreign_price_reviewers where user_id=auth.uid()))) then raise exception 'Owner reviewer access required'; end if;
 if p_approve is null or p_note is null or length(p_note)>1000 then raise exception 'Invalid decision'; end if;
 select * into r from public.foreign_price_requests where id=p_request for update;
 if not found or r.status<>'pending' then raise exception 'Request is no longer pending'; end if;
 select * into ref from public.foreign_shop_references where country=r.country and shop=r.shop and item_id=r.item_id for update;
 if p_approve then
  if ref.revision<>r.base_revision then raise exception 'Another update was approved first. Reject this stale request and request fresh evidence.'; end if;
  price:=coalesce(p_price,r.proposed_price);
  if price<0 or price>100000000000000 or price=ref.buy_price then raise exception 'Enter a different valid price'; end if;
  update public.foreign_shop_references set buy_price=price,observed_on=r.observed_on,source='Owner-verified screenshot',revision=revision+1,updated_at=now() where country=r.country and shop=r.shop and item_id=r.item_id;
 end if;
 update public.foreign_price_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_at=now(),reviewed_by=auth.uid(),review_note=p_note,applied_price=case when p_approve then price end where id=r.id;
end $$;
revoke all on function public.begin_foreign_price_request(text,text,integer,bigint,date,text,text),public.submit_foreign_price_request(uuid),public.withdraw_foreign_price_draft(uuid),public.review_foreign_price_request(uuid,boolean,bigint,text) from public,anon;
grant execute on function public.begin_foreign_price_request(text,text,integer,bigint,date,text,text),public.submit_foreign_price_request(uuid),public.withdraw_foreign_price_draft(uuid),public.review_foreign_price_request(uuid,boolean,bigint,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('foreign-price-evidence','foreign-price-evidence',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy foreign_price_evidence_upload on storage.objects for insert to authenticated with check (
 bucket_id='foreign-price-evidence' and exists(select 1 from public.foreign_price_requests r where r.user_id=(select auth.uid()) and r.status='draft' and r.screenshot_path=name)
);
create policy foreign_price_evidence_read on storage.objects for select to authenticated using (
 bucket_id='foreign-price-evidence' and exists(select 1 from public.foreign_price_requests r where r.screenshot_path=name and (r.user_id=(select auth.uid()) or (select public.is_foreign_price_reviewer())))
);
-- Evidence is immutable once uploaded; no client update/delete permissions.
notify pgrst,'reload schema';
