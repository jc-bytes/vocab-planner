-- Learning results v1: foundation and legacy isolation. No hosted rollout is enabled here.
-- All trusted functions are private. Application RPCs are added only after full validator acceptance.
begin;
create schema if not exists private;

create table private.learning_results_settings (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 grade integer not null check(grade between 1 and 12), content_set_id text not null, activity_type text not null,
 revision bigint not null default 0 check(revision>=0), shared_target_milliseconds integer not null check(shared_target_milliseconds between 1000 and 86400000),
 appearances integer not null default 5 check(appearances between 1 and 20), source_digest text, settings jsonb not null default '{}', published_task_id uuid, enabled boolean not null default false,
 unique(school_id,grade,content_set_id,activity_type)
);
create table private.learning_result_target_overrides (
 user_id uuid not null references auth.users(id) on delete cascade, assignment_id uuid references public.class_assignments(id) on delete cascade, context_key text not null,
 activity_type text not null, target integer check(target between 1 and 100), actor_id uuid not null references auth.users(id), revision bigint not null default 0,
 primary key(user_id,context_key,activity_type)
);
create table private.learning_result_tasks (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 grade integer not null check(grade between 1 and 12), content_set_id text not null, activity_type text not null,
 canonical_digest text not null check(canonical_digest ~ '^[0-9a-f]{64}$'), task jsonb not null,
 creator_id uuid not null references auth.users(id), published_at timestamptz not null default now(),
 unique(school_id,grade,content_set_id,activity_type,canonical_digest)
);
alter table private.learning_results_settings add foreign key(published_task_id) references private.learning_result_tasks(id);
create table private.learning_result_preparations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null references private.learning_result_tasks(id) on delete cascade,
 assignment_id uuid references public.class_assignments(id) on delete cascade, context_key text not null, unit_key text not null,
 vocabulary_id text references public.vocabularies(id), spark_id text references public.weekly_sparks(id),
 check(num_nonnulls(vocabulary_id,spark_id)=1), check(context_key=unit_key),
 check(assignment_id is null or context_key='assignment:'||assignment_id::text),
 target integer not null check(target between 1 and 100), target_source jsonb not null, manifest_hash text not null,
 start_context jsonb not null, package jsonb not null default '{}', prepared_at timestamptz not null default now()
);
create table private.learning_result_writing_revisions (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 assignment_id uuid references public.class_assignments(id) on delete cascade, context_key text not null, spark_id text not null references public.weekly_sparks(id), content_version text not null,
 predecessor_id uuid references private.learning_result_writing_revisions(id), responses jsonb not null, created_at timestamptz not null default now()
);
create table private.learning_result_writing_heads (
 user_id uuid not null references auth.users(id) on delete cascade, context_key text not null, content_version text not null,
 writing_revision_id uuid not null references private.learning_result_writing_revisions(id), legacy_revision integer,
 primary key(user_id,context_key,content_version)
);
create table private.learning_result_attempts (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 preparation_id uuid not null references private.learning_result_preparations(id) on delete cascade,
 task_id uuid not null references private.learning_result_tasks(id) on delete cascade,
 assignment_id uuid references public.class_assignments(id) on delete cascade, context_key text not null, unit_key text not null,
 vocabulary_id text references public.vocabularies(id), spark_id text references public.weekly_sparks(id),
 check(num_nonnulls(vocabulary_id,spark_id)=1), check(context_key=unit_key),
 check(assignment_id is null or context_key='assignment:'||assignment_id::text), activity_type text not null,
 compatibility_attempt_id uuid not null unique check(compatibility_attempt_id=id), kind text not null check(kind in ('ranked_full','practice')),
 target integer not null check(target between 1 and 100), schedule jsonb not null, seed bigint not null check(seed between 1 and 4294967295), variant_id uuid, start_context jsonb not null,
 predecessor_id uuid references private.learning_result_attempts(id) deferrable initially deferred,
 accepted_revision bigint not null default 0 check(accepted_revision>=0), accepted_sequence integer not null default 0 check(accepted_sequence between 0 and 50000),
 prefix_hash text not null check(prefix_hash ~ '^[0-9a-f]{64}$'), evidence_bytes integer not null default 0 check(evidence_bytes between 0 and 8388608),
 accepted_validation jsonb, state jsonb, state_hash text not null check(state_hash ~ '^[0-9a-f]{64}$'), recorded_milliseconds bigint not null default 0 check(recorded_milliseconds>=0),
 bridge_revision bigint not null default 0 check(bridge_revision>=0), completion_applied_at timestamptz, originals_applied_at timestamptz,
 created_at timestamptz not null default now()
);
alter table private.student_activity_attempts alter column vocabulary_id drop not null;
alter table private.student_activity_attempts add column spark_id text references public.weekly_sparks(id),
 add column record_protocol text not null default 'legacy' check(record_protocol in ('legacy','learning-results-v1')),
 add column learning_attempt_id uuid unique,
 add constraint learning_protocol_reference check((record_protocol='legacy' and learning_attempt_id is null) or (record_protocol='learning-results-v1' and learning_attempt_id=id)),
 add constraint learning_attempt_source check(
  (record_protocol='legacy' and vocabulary_id is not null and spark_id is null) or
  (record_protocol='learning-results-v1' and activity_type='reading-check' and vocabulary_id is null and spark_id is not null) or
  (record_protocol='learning-results-v1' and activity_type<>'reading-check' and vocabulary_id is not null and spark_id is null)),
 add foreign key(learning_attempt_id) references private.learning_result_attempts(id) on delete cascade deferrable initially deferred;
alter table private.learning_result_attempts add foreign key(compatibility_attempt_id) references private.student_activity_attempts(id) on delete cascade deferrable initially deferred;
alter table public.student_activity_progress add column completion_semantics text not null default 'legacy' check(completion_semantics in ('legacy','explicit'));
create table private.learning_result_evidence (
 attempt_id uuid not null references private.learning_result_attempts(id) on delete cascade, sequence integer not null check(sequence between 1 and 50000),
 event_id uuid not null unique, event_type text not null, opportunity_id text, event jsonb not null, canonical_bytes bytea not null check(octet_length(canonical_bytes)<=16384),
 prefix_hash text not null check(prefix_hash ~ '^[0-9a-f]{64}$'), primary key(attempt_id,sequence)
);
create unique index learning_original_outcome_once on private.learning_result_evidence(attempt_id,opportunity_id) where event_type='original';
create table private.learning_result_results (
 attempt_id uuid primary key references private.learning_result_attempts(id) on delete cascade,
 weighted_numerator numeric not null check(weighted_numerator>=0), weighted_denominator numeric not null check(weighted_denominator>0 and weighted_numerator<=weighted_denominator),
 speed_numerator numeric not null check(speed_numerator>=0), speed_denominator numeric not null check(speed_denominator>0),
 recorded_milliseconds bigint not null check(recorded_milliseconds>=0), points integer not null check(points between 0 and 1000), stars integer not null check(stars between 0 and 5),
 longest_combo integer not null check(longest_combo>=0), passed boolean not null, locked_at timestamptz not null default now(), full_task_finished_at timestamptz,
 validation_status text not null, eligibility_reason text not null
);
create table private.learning_result_support_events (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, assignment_id uuid references public.class_assignments(id) on delete cascade, context_key text not null,
 activity_type text not null, attempt_id uuid not null references private.learning_result_attempts(id) on delete cascade,
 outcome_type text not null check(outcome_type in ('pass','failure','classification')), cycle_id uuid, relation jsonb not null, created_at timestamptz not null default now(),
 unique(attempt_id,outcome_type,cycle_id)
);
create table private.learning_result_support (
 user_id uuid not null references auth.users(id) on delete cascade, assignment_id uuid references public.class_assignments(id) on delete cascade, context_key text not null,
 activity_type text not null, pass_event_id uuid references private.learning_result_support_events(id), failures jsonb not null default '[]',
 help boolean not null default false, earned_completion boolean not null default false, revision bigint not null default 0,
 primary key(user_id,context_key,activity_type)
);
create table private.learning_result_board_entries (
 task_id uuid not null references private.learning_result_tasks(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
 attempt_id uuid not null references private.learning_result_results(attempt_id) on delete cascade, points integer not null check(points between 0 and 1000),
 recorded_milliseconds bigint not null check(recorded_milliseconds>=0), primary key(task_id,user_id)
);
create table private.learning_result_board_versions (task_id uuid primary key references private.learning_result_tasks(id) on delete cascade, revision bigint not null default 0 check(revision>=0));
create table private.learning_result_receipts (
 user_id uuid not null references auth.users(id) on delete cascade, operation_id uuid not null, kind text not null,
 request_hash text not null, accepted_revision bigint not null check(accepted_revision>=0), response jsonb not null,
 committed_at timestamptz not null default now(), primary key(user_id,operation_id)
);
create index learning_preparation_owner_scope on private.learning_result_preparations(user_id,context_key,task_id);
create index learning_attempt_owner_scope on private.learning_result_attempts(user_id,context_key,activity_type,created_at desc);
create index learning_board_rank on private.learning_result_board_entries(task_id,points desc,recorded_milliseconds,user_id);
create index learning_support_scope on private.learning_result_support_events(user_id,context_key,activity_type);
create index learning_writing_owner on private.learning_result_writing_revisions(user_id,context_key,content_version);

do $security$ declare name text; begin
 for name in select tablename from pg_catalog.pg_tables where schemaname='private' and (tablename like 'learning_result_%' or tablename='learning_results_settings') loop
  execute format('alter table private.%I enable row level security',name);
  execute format('revoke all on table private.%I from public, anon, authenticated',name);
 end loop;
end $security$;

create function private.learning_json_canonical_v1(value json) returns text language plpgsql stable set search_path='' as $f$
declare kind text:=json_typeof(value); result text; number_text text;
begin
 if kind='null' then return 'null'; elsif kind='boolean' then return value::text;
 elsif kind='number' then
  number_text:=value::text;
  if number_text !~ '^-?(0|[1-9][0-9]*)$' or abs(number_text::numeric)>9007199254740991 then raise exception 'INVALID_INTEGER'; end if;
  return case when number_text='-0' then '0' else number_text end;
 elsif kind='string' then
  result:=value#>>'{}';
  if strpos(result,chr(34))=0 and strpos(result,chr(92))=0 and result !~ '[[:cntrl:]]' then return chr(34)||result||chr(34);end if;
  -- Escape text in bulk. A large p_payload is itself a JSON string in the envelope;
  -- visiting every character in PL/pgSQL makes request hashing unnecessarily slow.
  result:=replace(replace(result,chr(92),chr(92)||chr(92)),chr(34),chr(92)||chr(34));
  if result !~ '[[:cntrl:]]' then return chr(34)||result||chr(34);end if;
  for code in 1..31 loop
   if strpos(result,chr(code))>0 then result:=replace(result,chr(code),chr(92)||'u'||lpad(to_hex(code),4,'0'));end if;
  end loop;
  return chr(34)||result||chr(34);
 elsif kind='array' then
  select '['||coalesce(string_agg(private.learning_json_canonical_v1(e.value),',' order by e.ordinality),'')||']' into result from json_array_elements(value) with ordinality e;
  return result;
 elsif kind='object' then
  if exists(select 1 from json_each(value) group by key collate "C" having count(*)>1) then raise exception 'DUPLICATE_KEY'; end if;
  select '{'||coalesce(string_agg(private.learning_json_canonical_v1(to_json(e.key))||':'||private.learning_json_canonical_v1(e.value),',' order by e.key collate "C"),'')||'}' into result from json_each(value) e;
  return result;
 end if;
 raise exception 'INVALID_JSON';
end $f$;
create function private.learning_sha256_v1(value bytea) returns text language sql immutable set search_path='' as $f$ select encode(sha256(value),'hex') $f$;
create function private.learning_extend_hash_v1(previous_hash text, event json) returns text language plpgsql stable set search_path='' as $f$
declare data bytea:=convert_to(private.learning_json_canonical_v1(event),'UTF8');
begin
 if previous_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_HASH'; end if;
 if octet_length(data)>16384 then raise exception 'EVIDENCE_LIMIT'; end if;
 return private.learning_sha256_v1(decode(previous_hash,'hex')||int4send(octet_length(data))||data);
end $f$;
create function private.learning_gcd_v1(a numeric,b numeric) returns numeric language plpgsql immutable set search_path='' as $f$
declare r numeric;
begin if a<>trunc(a) or b<>trunc(b) or a<0 or b<0 then raise exception 'INVALID_FRACTION'; end if;
 while b<>0 loop r:=mod(a,b);a:=b;b:=r;end loop; return a; end $f$;
create function private.learning_score_v1(n numeric,d numeric,recorded_ms bigint,target_ms integer,passing_target integer,finished boolean)
returns jsonb language plpgsql stable set search_path='' as $f$
declare sn numeric:=0; sd numeric:=1; tn numeric; td numeric; points integer; g numeric;
begin
 if n is null or d is null or recorded_ms is null or target_ms is null or passing_target is null or finished is null or n<>trunc(n) or d<>trunc(d) or n<0 or d<=0 or n>d or recorded_ms<0 or target_ms not between 1000 and 86400000 or passing_target not between 1 and 100 then raise exception 'INVALID_SCORE_INPUT'; end if;
 if finished and 5*n>=4*d then sn:=50*greatest(0,least(target_ms,2::numeric*target_ms-recorded_ms));sd:=target_ms;g:=private.learning_gcd_v1(sn,sd);sn:=div(sn,g);sd:=div(sd,g);end if;
 tn:=950*n*sd+sn*d;td:=d*sd;points:=div(tn,td)::integer;
 return jsonb_build_object('points',points,'stars',case when points=1000 then 5 else points/200 end,'passed',100*n>=passing_target*d,'speed',jsonb_build_object('numerator',sn::text,'denominator',sd::text));
end $f$;

create table private.learning_unicode_lowercase_v1 (source integer primary key, target integer not null);
alter table private.learning_unicode_lowercase_v1 enable row level security;
revoke all on table private.learning_unicode_lowercase_v1 from public,anon,authenticated;
insert into private.learning_unicode_lowercase_v1 values
(65,97),
(66,98),
(67,99),
(68,100),
(69,101),
(70,102),
(71,103),
(72,104),
(73,105),
(74,106),
(75,107),
(76,108),
(77,109),
(78,110),
(79,111),
(80,112),
(81,113),
(82,114),
(83,115),
(84,116),
(85,117),
(86,118),
(87,119),
(88,120),
(89,121),
(90,122),
(192,224),
(193,225),
(194,226),
(195,227),
(196,228),
(197,229),
(198,230),
(199,231),
(200,232),
(201,233),
(202,234),
(203,235),
(204,236),
(205,237),
(206,238),
(207,239),
(208,240),
(209,241),
(210,242),
(211,243),
(212,244),
(213,245),
(214,246),
(216,248),
(217,249),
(218,250),
(219,251),
(220,252),
(221,253),
(222,254),
(256,257),
(258,259),
(260,261),
(262,263),
(264,265),
(266,267),
(268,269),
(270,271),
(272,273),
(274,275),
(276,277),
(278,279),
(280,281),
(282,283),
(284,285),
(286,287),
(288,289),
(290,291),
(292,293),
(294,295),
(296,297),
(298,299),
(300,301),
(302,303),
(304,105),
(306,307),
(308,309),
(310,311),
(313,314),
(315,316),
(317,318),
(319,320),
(321,322),
(323,324),
(325,326),
(327,328),
(330,331),
(332,333),
(334,335),
(336,337),
(338,339),
(340,341),
(342,343),
(344,345),
(346,347),
(348,349),
(350,351),
(352,353),
(354,355),
(356,357),
(358,359),
(360,361),
(362,363),
(364,365),
(366,367),
(368,369),
(370,371),
(372,373),
(374,375),
(376,255),
(377,378),
(379,380),
(381,382),
(385,595),
(386,387),
(388,389),
(390,596),
(391,392),
(393,598),
(394,599),
(395,396),
(398,477),
(399,601),
(400,603),
(401,402),
(403,608),
(404,611),
(406,617),
(407,616),
(408,409),
(412,623),
(413,626),
(415,629),
(416,417),
(418,419),
(420,421),
(422,640),
(423,424),
(425,643),
(428,429),
(430,648),
(431,432),
(433,650),
(434,651),
(435,436),
(437,438),
(439,658),
(440,441),
(444,445),
(452,454),
(453,454),
(455,457),
(456,457),
(458,460),
(459,460),
(461,462),
(463,464),
(465,466),
(467,468),
(469,470),
(471,472),
(473,474),
(475,476),
(478,479),
(480,481),
(482,483),
(484,485),
(486,487),
(488,489),
(490,491),
(492,493),
(494,495),
(497,499),
(498,499),
(500,501),
(502,405),
(503,447),
(504,505),
(506,507),
(508,509),
(510,511),
(512,513),
(514,515),
(516,517),
(518,519),
(520,521),
(522,523),
(524,525),
(526,527),
(528,529),
(530,531),
(532,533),
(534,535),
(536,537),
(538,539),
(540,541),
(542,543),
(544,414),
(546,547),
(548,549),
(550,551),
(552,553),
(554,555),
(556,557),
(558,559),
(560,561),
(562,563),
(570,11365),
(571,572),
(573,410),
(574,11366),
(577,578),
(579,384),
(580,649),
(581,652),
(582,583),
(584,585),
(586,587),
(588,589),
(590,591),
(880,881),
(882,883),
(886,887),
(895,1011),
(902,940),
(904,941),
(905,942),
(906,943),
(908,972),
(910,973),
(911,974),
(913,945),
(914,946),
(915,947),
(916,948),
(917,949),
(918,950),
(919,951),
(920,952),
(921,953),
(922,954),
(923,955),
(924,956),
(925,957),
(926,958),
(927,959),
(928,960),
(929,961),
(931,963),
(932,964),
(933,965),
(934,966),
(935,967),
(936,968),
(937,969),
(938,970),
(939,971),
(975,983),
(984,985),
(986,987),
(988,989),
(990,991),
(992,993),
(994,995),
(996,997),
(998,999),
(1000,1001),
(1002,1003),
(1004,1005),
(1006,1007),
(1012,952),
(1015,1016),
(1017,1010),
(1018,1019),
(1021,891),
(1022,892),
(1023,893),
(1024,1104),
(1025,1105),
(1026,1106),
(1027,1107),
(1028,1108),
(1029,1109),
(1030,1110),
(1031,1111),
(1032,1112),
(1033,1113),
(1034,1114),
(1035,1115),
(1036,1116),
(1037,1117),
(1038,1118),
(1039,1119),
(1040,1072),
(1041,1073),
(1042,1074),
(1043,1075),
(1044,1076),
(1045,1077),
(1046,1078),
(1047,1079),
(1048,1080),
(1049,1081),
(1050,1082),
(1051,1083),
(1052,1084),
(1053,1085),
(1054,1086),
(1055,1087),
(1056,1088),
(1057,1089),
(1058,1090),
(1059,1091),
(1060,1092),
(1061,1093),
(1062,1094),
(1063,1095),
(1064,1096),
(1065,1097),
(1066,1098),
(1067,1099),
(1068,1100),
(1069,1101),
(1070,1102),
(1071,1103),
(1120,1121),
(1122,1123),
(1124,1125),
(1126,1127),
(1128,1129),
(1130,1131),
(1132,1133),
(1134,1135),
(1136,1137),
(1138,1139),
(1140,1141),
(1142,1143),
(1144,1145),
(1146,1147),
(1148,1149),
(1150,1151),
(1152,1153),
(1162,1163),
(1164,1165),
(1166,1167),
(1168,1169),
(1170,1171),
(1172,1173),
(1174,1175),
(1176,1177),
(1178,1179),
(1180,1181),
(1182,1183),
(1184,1185),
(1186,1187),
(1188,1189),
(1190,1191),
(1192,1193),
(1194,1195),
(1196,1197),
(1198,1199),
(1200,1201),
(1202,1203),
(1204,1205),
(1206,1207),
(1208,1209),
(1210,1211),
(1212,1213),
(1214,1215),
(1216,1231),
(1217,1218),
(1219,1220),
(1221,1222),
(1223,1224),
(1225,1226),
(1227,1228),
(1229,1230),
(1232,1233),
(1234,1235),
(1236,1237),
(1238,1239),
(1240,1241),
(1242,1243),
(1244,1245),
(1246,1247),
(1248,1249),
(1250,1251),
(1252,1253),
(1254,1255),
(1256,1257),
(1258,1259),
(1260,1261),
(1262,1263),
(1264,1265),
(1266,1267),
(1268,1269),
(1270,1271),
(1272,1273),
(1274,1275),
(1276,1277),
(1278,1279),
(1280,1281),
(1282,1283),
(1284,1285),
(1286,1287),
(1288,1289),
(1290,1291),
(1292,1293),
(1294,1295),
(1296,1297),
(1298,1299),
(1300,1301),
(1302,1303),
(1304,1305),
(1306,1307),
(1308,1309),
(1310,1311),
(1312,1313),
(1314,1315),
(1316,1317),
(1318,1319),
(1320,1321),
(1322,1323),
(1324,1325),
(1326,1327),
(1329,1377),
(1330,1378),
(1331,1379),
(1332,1380),
(1333,1381),
(1334,1382),
(1335,1383),
(1336,1384),
(1337,1385),
(1338,1386),
(1339,1387),
(1340,1388),
(1341,1389),
(1342,1390),
(1343,1391),
(1344,1392),
(1345,1393),
(1346,1394),
(1347,1395),
(1348,1396),
(1349,1397),
(1350,1398),
(1351,1399),
(1352,1400),
(1353,1401),
(1354,1402),
(1355,1403),
(1356,1404),
(1357,1405),
(1358,1406),
(1359,1407),
(1360,1408),
(1361,1409),
(1362,1410),
(1363,1411),
(1364,1412),
(1365,1413),
(1366,1414),
(4256,11520),
(4257,11521),
(4258,11522),
(4259,11523),
(4260,11524),
(4261,11525),
(4262,11526),
(4263,11527),
(4264,11528),
(4265,11529),
(4266,11530),
(4267,11531),
(4268,11532),
(4269,11533),
(4270,11534),
(4271,11535),
(4272,11536),
(4273,11537),
(4274,11538),
(4275,11539),
(4276,11540),
(4277,11541),
(4278,11542),
(4279,11543),
(4280,11544),
(4281,11545),
(4282,11546),
(4283,11547),
(4284,11548),
(4285,11549),
(4286,11550),
(4287,11551),
(4288,11552),
(4289,11553),
(4290,11554),
(4291,11555),
(4292,11556),
(4293,11557),
(4295,11559),
(4301,11565),
(5024,43888),
(5025,43889),
(5026,43890),
(5027,43891),
(5028,43892),
(5029,43893),
(5030,43894),
(5031,43895),
(5032,43896),
(5033,43897),
(5034,43898),
(5035,43899),
(5036,43900),
(5037,43901),
(5038,43902),
(5039,43903),
(5040,43904),
(5041,43905),
(5042,43906),
(5043,43907),
(5044,43908),
(5045,43909),
(5046,43910),
(5047,43911),
(5048,43912),
(5049,43913),
(5050,43914),
(5051,43915),
(5052,43916),
(5053,43917),
(5054,43918),
(5055,43919),
(5056,43920),
(5057,43921),
(5058,43922),
(5059,43923),
(5060,43924),
(5061,43925),
(5062,43926),
(5063,43927),
(5064,43928),
(5065,43929),
(5066,43930),
(5067,43931),
(5068,43932),
(5069,43933),
(5070,43934),
(5071,43935),
(5072,43936),
(5073,43937),
(5074,43938),
(5075,43939),
(5076,43940),
(5077,43941),
(5078,43942),
(5079,43943),
(5080,43944),
(5081,43945),
(5082,43946),
(5083,43947),
(5084,43948),
(5085,43949),
(5086,43950),
(5087,43951),
(5088,43952),
(5089,43953),
(5090,43954),
(5091,43955),
(5092,43956),
(5093,43957),
(5094,43958),
(5095,43959),
(5096,43960),
(5097,43961),
(5098,43962),
(5099,43963),
(5100,43964),
(5101,43965),
(5102,43966),
(5103,43967),
(5104,5112),
(5105,5113),
(5106,5114),
(5107,5115),
(5108,5116),
(5109,5117),
(7312,4304),
(7313,4305),
(7314,4306),
(7315,4307),
(7316,4308),
(7317,4309),
(7318,4310),
(7319,4311),
(7320,4312),
(7321,4313),
(7322,4314),
(7323,4315),
(7324,4316),
(7325,4317),
(7326,4318),
(7327,4319),
(7328,4320),
(7329,4321),
(7330,4322),
(7331,4323),
(7332,4324),
(7333,4325),
(7334,4326),
(7335,4327),
(7336,4328),
(7337,4329),
(7338,4330),
(7339,4331),
(7340,4332),
(7341,4333),
(7342,4334),
(7343,4335),
(7344,4336),
(7345,4337),
(7346,4338),
(7347,4339),
(7348,4340),
(7349,4341),
(7350,4342),
(7351,4343),
(7352,4344),
(7353,4345),
(7354,4346),
(7357,4349),
(7358,4350),
(7359,4351),
(7680,7681),
(7682,7683),
(7684,7685),
(7686,7687),
(7688,7689),
(7690,7691),
(7692,7693),
(7694,7695),
(7696,7697),
(7698,7699),
(7700,7701),
(7702,7703),
(7704,7705),
(7706,7707),
(7708,7709),
(7710,7711),
(7712,7713),
(7714,7715),
(7716,7717),
(7718,7719),
(7720,7721),
(7722,7723),
(7724,7725),
(7726,7727),
(7728,7729),
(7730,7731),
(7732,7733),
(7734,7735),
(7736,7737),
(7738,7739),
(7740,7741),
(7742,7743),
(7744,7745),
(7746,7747),
(7748,7749),
(7750,7751),
(7752,7753),
(7754,7755),
(7756,7757),
(7758,7759),
(7760,7761),
(7762,7763),
(7764,7765),
(7766,7767),
(7768,7769),
(7770,7771),
(7772,7773),
(7774,7775),
(7776,7777),
(7778,7779),
(7780,7781),
(7782,7783),
(7784,7785),
(7786,7787),
(7788,7789),
(7790,7791),
(7792,7793),
(7794,7795),
(7796,7797),
(7798,7799),
(7800,7801),
(7802,7803),
(7804,7805),
(7806,7807),
(7808,7809),
(7810,7811),
(7812,7813),
(7814,7815),
(7816,7817),
(7818,7819),
(7820,7821),
(7822,7823),
(7824,7825),
(7826,7827),
(7828,7829),
(7838,223),
(7840,7841),
(7842,7843),
(7844,7845),
(7846,7847),
(7848,7849),
(7850,7851),
(7852,7853),
(7854,7855),
(7856,7857),
(7858,7859),
(7860,7861),
(7862,7863),
(7864,7865),
(7866,7867),
(7868,7869),
(7870,7871),
(7872,7873),
(7874,7875),
(7876,7877),
(7878,7879),
(7880,7881),
(7882,7883),
(7884,7885),
(7886,7887),
(7888,7889),
(7890,7891),
(7892,7893),
(7894,7895),
(7896,7897),
(7898,7899),
(7900,7901),
(7902,7903),
(7904,7905),
(7906,7907),
(7908,7909),
(7910,7911),
(7912,7913),
(7914,7915),
(7916,7917),
(7918,7919),
(7920,7921),
(7922,7923),
(7924,7925),
(7926,7927),
(7928,7929),
(7930,7931),
(7932,7933),
(7934,7935),
(7944,7936),
(7945,7937),
(7946,7938),
(7947,7939),
(7948,7940),
(7949,7941),
(7950,7942),
(7951,7943),
(7960,7952),
(7961,7953),
(7962,7954),
(7963,7955),
(7964,7956),
(7965,7957),
(7976,7968),
(7977,7969),
(7978,7970),
(7979,7971),
(7980,7972),
(7981,7973),
(7982,7974),
(7983,7975),
(7992,7984),
(7993,7985),
(7994,7986),
(7995,7987),
(7996,7988),
(7997,7989),
(7998,7990),
(7999,7991),
(8008,8000),
(8009,8001),
(8010,8002),
(8011,8003),
(8012,8004),
(8013,8005),
(8025,8017),
(8027,8019),
(8029,8021),
(8031,8023),
(8040,8032),
(8041,8033),
(8042,8034),
(8043,8035),
(8044,8036),
(8045,8037),
(8046,8038),
(8047,8039),
(8072,8064),
(8073,8065),
(8074,8066),
(8075,8067),
(8076,8068),
(8077,8069),
(8078,8070),
(8079,8071),
(8088,8080),
(8089,8081),
(8090,8082),
(8091,8083),
(8092,8084),
(8093,8085),
(8094,8086),
(8095,8087),
(8104,8096),
(8105,8097),
(8106,8098),
(8107,8099),
(8108,8100),
(8109,8101),
(8110,8102),
(8111,8103),
(8120,8112),
(8121,8113),
(8122,8048),
(8123,8049),
(8124,8115),
(8136,8050),
(8137,8051),
(8138,8052),
(8139,8053),
(8140,8131),
(8152,8144),
(8153,8145),
(8154,8054),
(8155,8055),
(8168,8160),
(8169,8161),
(8170,8058),
(8171,8059),
(8172,8165),
(8184,8056),
(8185,8057),
(8186,8060),
(8187,8061),
(8188,8179),
(8486,969),
(8490,107),
(8491,229),
(8498,8526),
(8544,8560),
(8545,8561),
(8546,8562),
(8547,8563),
(8548,8564),
(8549,8565),
(8550,8566),
(8551,8567),
(8552,8568),
(8553,8569),
(8554,8570),
(8555,8571),
(8556,8572),
(8557,8573),
(8558,8574),
(8559,8575),
(8579,8580),
(9398,9424),
(9399,9425),
(9400,9426),
(9401,9427),
(9402,9428),
(9403,9429),
(9404,9430),
(9405,9431),
(9406,9432),
(9407,9433),
(9408,9434),
(9409,9435),
(9410,9436),
(9411,9437),
(9412,9438),
(9413,9439),
(9414,9440),
(9415,9441),
(9416,9442),
(9417,9443),
(9418,9444),
(9419,9445),
(9420,9446),
(9421,9447),
(9422,9448),
(9423,9449),
(11264,11312),
(11265,11313),
(11266,11314),
(11267,11315),
(11268,11316),
(11269,11317),
(11270,11318),
(11271,11319),
(11272,11320),
(11273,11321),
(11274,11322),
(11275,11323),
(11276,11324),
(11277,11325),
(11278,11326),
(11279,11327),
(11280,11328),
(11281,11329),
(11282,11330),
(11283,11331),
(11284,11332),
(11285,11333),
(11286,11334),
(11287,11335),
(11288,11336),
(11289,11337),
(11290,11338),
(11291,11339),
(11292,11340),
(11293,11341),
(11294,11342),
(11295,11343),
(11296,11344),
(11297,11345),
(11298,11346),
(11299,11347),
(11300,11348),
(11301,11349),
(11302,11350),
(11303,11351),
(11304,11352),
(11305,11353),
(11306,11354),
(11307,11355),
(11308,11356),
(11309,11357),
(11310,11358),
(11311,11359),
(11360,11361),
(11362,619),
(11363,7549),
(11364,637),
(11367,11368),
(11369,11370),
(11371,11372),
(11373,593),
(11374,625),
(11375,592),
(11376,594),
(11378,11379),
(11381,11382),
(11390,575),
(11391,576),
(11392,11393),
(11394,11395),
(11396,11397),
(11398,11399),
(11400,11401),
(11402,11403),
(11404,11405),
(11406,11407),
(11408,11409),
(11410,11411),
(11412,11413),
(11414,11415),
(11416,11417),
(11418,11419),
(11420,11421),
(11422,11423),
(11424,11425),
(11426,11427),
(11428,11429),
(11430,11431),
(11432,11433),
(11434,11435),
(11436,11437),
(11438,11439),
(11440,11441),
(11442,11443),
(11444,11445),
(11446,11447),
(11448,11449),
(11450,11451),
(11452,11453),
(11454,11455),
(11456,11457),
(11458,11459),
(11460,11461),
(11462,11463),
(11464,11465),
(11466,11467),
(11468,11469),
(11470,11471),
(11472,11473),
(11474,11475),
(11476,11477),
(11478,11479),
(11480,11481),
(11482,11483),
(11484,11485),
(11486,11487),
(11488,11489),
(11490,11491),
(11499,11500),
(11501,11502),
(11506,11507),
(42560,42561),
(42562,42563),
(42564,42565),
(42566,42567),
(42568,42569),
(42570,42571),
(42572,42573),
(42574,42575),
(42576,42577),
(42578,42579),
(42580,42581),
(42582,42583),
(42584,42585),
(42586,42587),
(42588,42589),
(42590,42591),
(42592,42593),
(42594,42595),
(42596,42597),
(42598,42599),
(42600,42601),
(42602,42603),
(42604,42605),
(42624,42625),
(42626,42627),
(42628,42629),
(42630,42631),
(42632,42633),
(42634,42635),
(42636,42637),
(42638,42639),
(42640,42641),
(42642,42643),
(42644,42645),
(42646,42647),
(42648,42649),
(42650,42651),
(42786,42787),
(42788,42789),
(42790,42791),
(42792,42793),
(42794,42795),
(42796,42797),
(42798,42799),
(42802,42803),
(42804,42805),
(42806,42807),
(42808,42809),
(42810,42811),
(42812,42813),
(42814,42815),
(42816,42817),
(42818,42819),
(42820,42821),
(42822,42823),
(42824,42825),
(42826,42827),
(42828,42829),
(42830,42831),
(42832,42833),
(42834,42835),
(42836,42837),
(42838,42839),
(42840,42841),
(42842,42843),
(42844,42845),
(42846,42847),
(42848,42849),
(42850,42851),
(42852,42853),
(42854,42855),
(42856,42857),
(42858,42859),
(42860,42861),
(42862,42863),
(42873,42874),
(42875,42876),
(42877,7545),
(42878,42879),
(42880,42881),
(42882,42883),
(42884,42885),
(42886,42887),
(42891,42892),
(42893,613),
(42896,42897),
(42898,42899),
(42902,42903),
(42904,42905),
(42906,42907),
(42908,42909),
(42910,42911),
(42912,42913),
(42914,42915),
(42916,42917),
(42918,42919),
(42920,42921),
(42922,614),
(42923,604),
(42924,609),
(42925,620),
(42926,618),
(42928,670),
(42929,647),
(42930,669),
(42931,43859),
(42932,42933),
(42934,42935),
(42936,42937),
(42938,42939),
(42940,42941),
(42942,42943),
(42944,42945),
(42946,42947),
(42948,42900),
(42949,642),
(42950,7566),
(42951,42952),
(42953,42954),
(42960,42961),
(42966,42967),
(42968,42969),
(42997,42998),
(65313,65345),
(65314,65346),
(65315,65347),
(65316,65348),
(65317,65349),
(65318,65350),
(65319,65351),
(65320,65352),
(65321,65353),
(65322,65354),
(65323,65355),
(65324,65356),
(65325,65357),
(65326,65358),
(65327,65359),
(65328,65360),
(65329,65361),
(65330,65362),
(65331,65363),
(65332,65364),
(65333,65365),
(65334,65366),
(65335,65367),
(65336,65368),
(65337,65369),
(65338,65370),
(66560,66600),
(66561,66601),
(66562,66602),
(66563,66603),
(66564,66604),
(66565,66605),
(66566,66606),
(66567,66607),
(66568,66608),
(66569,66609),
(66570,66610),
(66571,66611),
(66572,66612),
(66573,66613),
(66574,66614),
(66575,66615),
(66576,66616),
(66577,66617),
(66578,66618),
(66579,66619),
(66580,66620),
(66581,66621),
(66582,66622),
(66583,66623),
(66584,66624),
(66585,66625),
(66586,66626),
(66587,66627),
(66588,66628),
(66589,66629),
(66590,66630),
(66591,66631),
(66592,66632),
(66593,66633),
(66594,66634),
(66595,66635),
(66596,66636),
(66597,66637),
(66598,66638),
(66599,66639),
(66736,66776),
(66737,66777),
(66738,66778),
(66739,66779),
(66740,66780),
(66741,66781),
(66742,66782),
(66743,66783),
(66744,66784),
(66745,66785),
(66746,66786),
(66747,66787),
(66748,66788),
(66749,66789),
(66750,66790),
(66751,66791),
(66752,66792),
(66753,66793),
(66754,66794),
(66755,66795),
(66756,66796),
(66757,66797),
(66758,66798),
(66759,66799),
(66760,66800),
(66761,66801),
(66762,66802),
(66763,66803),
(66764,66804),
(66765,66805),
(66766,66806),
(66767,66807),
(66768,66808),
(66769,66809),
(66770,66810),
(66771,66811),
(66928,66967),
(66929,66968),
(66930,66969),
(66931,66970),
(66932,66971),
(66933,66972),
(66934,66973),
(66935,66974),
(66936,66975),
(66937,66976),
(66938,66977),
(66940,66979),
(66941,66980),
(66942,66981),
(66943,66982),
(66944,66983),
(66945,66984),
(66946,66985),
(66947,66986),
(66948,66987),
(66949,66988),
(66950,66989),
(66951,66990),
(66952,66991),
(66953,66992),
(66954,66993),
(66956,66995),
(66957,66996),
(66958,66997),
(66959,66998),
(66960,66999),
(66961,67000),
(66962,67001),
(66964,67003),
(66965,67004),
(68736,68800),
(68737,68801),
(68738,68802),
(68739,68803),
(68740,68804),
(68741,68805),
(68742,68806),
(68743,68807),
(68744,68808),
(68745,68809),
(68746,68810),
(68747,68811),
(68748,68812),
(68749,68813),
(68750,68814),
(68751,68815),
(68752,68816),
(68753,68817),
(68754,68818),
(68755,68819),
(68756,68820),
(68757,68821),
(68758,68822),
(68759,68823),
(68760,68824),
(68761,68825),
(68762,68826),
(68763,68827),
(68764,68828),
(68765,68829),
(68766,68830),
(68767,68831),
(68768,68832),
(68769,68833),
(68770,68834),
(68771,68835),
(68772,68836),
(68773,68837),
(68774,68838),
(68775,68839),
(68776,68840),
(68777,68841),
(68778,68842),
(68779,68843),
(68780,68844),
(68781,68845),
(68782,68846),
(68783,68847),
(68784,68848),
(68785,68849),
(68786,68850),
(71840,71872),
(71841,71873),
(71842,71874),
(71843,71875),
(71844,71876),
(71845,71877),
(71846,71878),
(71847,71879),
(71848,71880),
(71849,71881),
(71850,71882),
(71851,71883),
(71852,71884),
(71853,71885),
(71854,71886),
(71855,71887),
(71856,71888),
(71857,71889),
(71858,71890),
(71859,71891),
(71860,71892),
(71861,71893),
(71862,71894),
(71863,71895),
(71864,71896),
(71865,71897),
(71866,71898),
(71867,71899),
(71868,71900),
(71869,71901),
(71870,71902),
(71871,71903),
(93760,93792),
(93761,93793),
(93762,93794),
(93763,93795),
(93764,93796),
(93765,93797),
(93766,93798),
(93767,93799),
(93768,93800),
(93769,93801),
(93770,93802),
(93771,93803),
(93772,93804),
(93773,93805),
(93774,93806),
(93775,93807),
(93776,93808),
(93777,93809),
(93778,93810),
(93779,93811),
(93780,93812),
(93781,93813),
(93782,93814),
(93783,93815),
(93784,93816),
(93785,93817),
(93786,93818),
(93787,93819),
(93788,93820),
(93789,93821),
(93790,93822),
(93791,93823),
(125184,125218),
(125185,125219),
(125186,125220),
(125187,125221),
(125188,125222),
(125189,125223),
(125190,125224),
(125191,125225),
(125192,125226),
(125193,125227),
(125194,125228),
(125195,125229),
(125196,125230),
(125197,125231),
(125198,125232),
(125199,125233),
(125200,125234),
(125201,125235),
(125202,125236),
(125203,125237),
(125204,125238),
(125205,125239),
(125206,125240),
(125207,125241),
(125208,125242),
(125209,125243),
(125210,125244),
(125211,125245),
(125212,125246),
(125213,125247),
(125214,125248),
(125215,125249),
(125216,125250),
(125217,125251);
revoke all on table private.learning_unicode_lowercase_v1 from public,anon,authenticated;
alter table private.learning_unicode_lowercase_v1 enable row level security;

create function private.learning_normalize_spelling_v1(value text) returns text language plpgsql stable set search_path='' as $f$
declare c text; code integer; mapped integer; result text:='';
begin
 if value is null or length(value)>1024 then raise exception 'INVALID_ANSWER';end if;
 for c in select regexp_split_to_table(normalize(value,NFC),'') loop
  if c='' then continue;end if;
  code:=ascii(c);
  if code between 9 and 13 or code in (32,133,160,5760,8232,8233,8239,8287,12288,45,8208,8209) or code between 8192 and 8202 then continue;end if;
  select target into mapped from private.learning_unicode_lowercase_v1 where source=code;
  result:=result||chr(coalesce(mapped,code));
 end loop;return result;
end $f$;
create function private.learning_spelling_credit_v1(expected text,answer text,assisted boolean) returns jsonb language plpgsql stable set search_path='' as $f$
declare a text:=private.learning_normalize_spelling_v1(expected);b text:=private.learning_normalize_spelling_v1(answer);n numeric:=0;d numeric;g numeric;
begin
 if length(a)=0 then raise exception 'INVALID_TASK';end if;
 for i in 1..length(a) loop if substr(a,i,1)=substr(b,i,1) then n:=n+1;end if;end loop;
 d:=greatest(length(a),length(b))*case when assisted then 2 else 1 end;g:=private.learning_gcd_v1(n,d);
 return jsonb_build_object('numerator',div(n,g)::text,'denominator',div(d,g)::text);
end $f$;

create function private.learning_immutable_row_v1() returns trigger language plpgsql set search_path='' as $f$
begin raise exception 'IMMUTABLE_LEARNING_RECORD';end $f$;
create trigger learning_preparation_immutable before update on private.learning_result_preparations for each row execute function private.learning_immutable_row_v1();
create trigger learning_task_immutable before update on private.learning_result_tasks for each row execute function private.learning_immutable_row_v1();
create trigger learning_evidence_immutable before update on private.learning_result_evidence for each row execute function private.learning_immutable_row_v1();
create trigger learning_writing_immutable before update on private.learning_result_writing_revisions for each row execute function private.learning_immutable_row_v1();
create function private.learning_result_immutable_v1() returns trigger language plpgsql set search_path='' as $f$
begin
 if (to_jsonb(new)-'full_task_finished_at'-'validation_status'-'eligibility_reason') is distinct from (to_jsonb(old)-'full_task_finished_at'-'validation_status'-'eligibility_reason') then raise exception 'ORIGINAL_RESULT_LOCKED';end if;
 if old.full_task_finished_at is not null and new.full_task_finished_at is distinct from old.full_task_finished_at then raise exception 'ORIGINAL_RESULT_LOCKED';end if;
 return new;
end $f$;
create trigger learning_result_immutable before update on private.learning_result_results for each row execute function private.learning_result_immutable_v1();

create function private.learning_attempt_identity_immutable_v1() returns trigger language plpgsql set search_path='' as $f$
begin
 -- Compare identity directly; mutable validation state can contain a large saved prefix.
 if row(new.id,new.user_id,new.preparation_id,new.task_id,new.assignment_id,new.context_key,new.unit_key,new.vocabulary_id,new.spark_id,new.activity_type,new.compatibility_attempt_id,new.kind,new.target,new.schedule,new.seed,new.variant_id,new.start_context,new.predecessor_id,new.created_at)
 is distinct from row(old.id,old.user_id,old.preparation_id,old.task_id,old.assignment_id,old.context_key,old.unit_key,old.vocabulary_id,old.spark_id,old.activity_type,old.compatibility_attempt_id,old.kind,old.target,old.schedule,old.seed,old.variant_id,old.start_context,old.predecessor_id,old.created_at) then raise exception 'IMMUTABLE_ATTEMPT_IDENTITY';end if;
 return new;
end $f$;
create trigger learning_attempt_identity_immutable before update on private.learning_result_attempts for each row execute function private.learning_attempt_identity_immutable_v1();

-- R1: typed immutable protocol; JSON details can never opt into this protocol.
create function private.learning_attempt_protocol_immutable_v1() returns trigger language plpgsql set search_path='' as $f$
begin
 if new.record_protocol is distinct from old.record_protocol or new.learning_attempt_id is distinct from old.learning_attempt_id
 or (old.record_protocol='learning-results-v1' and (new.id is distinct from old.id or new.user_id is distinct from old.user_id
 or new.unit_key is distinct from old.unit_key or new.assignment_id is distinct from old.assignment_id
 or new.activity_type is distinct from old.activity_type or new.vocabulary_id is distinct from old.vocabulary_id
 or new.spark_id is distinct from old.spark_id)) then raise exception 'IMMUTABLE_ATTEMPT_PROTOCOL';end if;
 return new;
end $f$;
create trigger learning_protocol_immutable before update on private.student_activity_attempts for each row execute function private.learning_attempt_protocol_immutable_v1();
create function private.learning_pair_integrity_v1() returns trigger language plpgsql security definer set search_path='' as $f$
declare learning private.learning_result_attempts; legacy private.student_activity_attempts; preparation private.learning_result_preparations; attempt_id uuid:=new.id;
begin
 select * into learning from private.learning_result_attempts where id=attempt_id;
 select * into legacy from private.student_activity_attempts where id=attempt_id;
 if learning.id is null and (legacy.id is null or legacy.record_protocol='legacy') then return null;end if;
 if learning.id is null or legacy.id is null or legacy.record_protocol<>'learning-results-v1'
 or learning.user_id is distinct from legacy.user_id or learning.unit_key is distinct from legacy.unit_key
 or learning.activity_type is distinct from legacy.activity_type or learning.assignment_id is distinct from legacy.assignment_id
 or learning.vocabulary_id is distinct from legacy.vocabulary_id or learning.spark_id is distinct from legacy.spark_id
 or (learning.activity_type='reading-check') is distinct from (learning.spark_id is not null) then raise exception 'LEARNING_PAIR_MISMATCH';end if;
 select * into preparation from private.learning_result_preparations where id=learning.preparation_id;
 if preparation.user_id is distinct from learning.user_id or preparation.task_id is distinct from learning.task_id
 or preparation.assignment_id is distinct from learning.assignment_id or preparation.context_key is distinct from learning.context_key
 or preparation.vocabulary_id is distinct from learning.vocabulary_id or preparation.spark_id is distinct from learning.spark_id
 or preparation.target is distinct from learning.target then raise exception 'LEARNING_PREPARATION_MISMATCH';end if;
 return null;
end $f$;
-- Pair identity is checked at insertion and frozen by the two identity guards.
-- Mutable timer, validation and reward updates cannot change this relationship.
create constraint trigger learning_pair_check after insert on private.learning_result_attempts deferrable initially deferred for each row execute function private.learning_pair_integrity_v1();
create constraint trigger learning_compatibility_check after insert on private.student_activity_attempts deferrable initially deferred for each row execute function private.learning_pair_integrity_v1();
create function private.assert_legacy_activity_attempt_v1(attempt_id text) returns void language plpgsql security definer set search_path='' as $f$
declare attempt private.student_activity_attempts;
begin
 if auth.uid() is null then raise exception 'This activity attempt is invalid.' using errcode='42501';end if;
 if coalesce(attempt_id,'') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'This activity attempt is invalid.';end if;
 select * into attempt from private.student_activity_attempts where id=attempt_id::uuid and user_id=auth.uid();
 if attempt.id is null then raise exception 'This activity attempt is invalid.';end if;
 if attempt.record_protocol<>'legacy' then raise exception 'LEARNING_RESULT_WRITE_REQUIRED';end if;
end $f$;
-- Update the current definitions, not a historical copy. Fail rather than silently miss an owning function.
do $guards$
declare routine record; definition text; modified text; guarded integer:=0;
begin
 for routine in select p.oid,p.proname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname in ('submit_student_activity_progress_v2','submit_student_activity_progress_v3','submit_student_activity_progress_v3_strict_legacy','report_student_activity_time_v1') loop
  definition:=pg_get_functiondef(routine.oid);
  modified:=regexp_replace(definition,'(?in)^begin$',E'begin\n    perform private.assert_legacy_activity_attempt_v1(p_attempt_id::text);');
  if modified=definition then raise exception 'Cannot guard %',routine.proname;end if;
  if routine.proname in ('submit_student_activity_progress_v2','submit_student_activity_progress_v3_strict_legacy') then
   definition:=modified;
   modified:=regexp_replace(definition,'(?i)select \* into attempt_row',E'perform private.ensure_student_progress_summary_v3(auth.uid());\n    select * into attempt_row');
   if modified=definition then raise exception 'Cannot reorder legacy lock in %',routine.proname;end if;
   modified:=replace(modified,'old_activity.is_complete or old_activity.score >= 100', $replacement$old_activity.is_complete or (old_activity.completion_semantics='legacy' and old_activity.score >= 100)$replacement$);
  end if;
  execute modified; guarded:=guarded+1;
 end loop;
 if guarded<>4 then raise exception 'Expected four current legacy mutation definitions, found %',guarded;end if;
 select pg_get_functiondef(p.oid) into definition from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='start_student_activity_attempt';
 if definition is null then raise exception 'Missing legacy startup';end if;
 modified:=replace(definition,'where user_id = current_user_id', $replacement$where record_protocol = 'legacy' and user_id = current_user_id$replacement$);
 if modified=definition then raise exception 'Cannot guard legacy startup';end if;execute modified;
 select pg_get_functiondef(p.oid) into definition from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='award_uncapped_student_activity_xp';
 if definition is null then raise exception 'Missing completion XP trigger';end if;
 modified:=regexp_replace(definition,'(?in)^begin$',E'begin\n    if new.record_protocol = ''learning-results-v1'' then return new; end if;');
 if modified=definition then raise exception 'Cannot isolate completion XP trigger';end if;execute modified;
end $guards$;
create function private.learning_keys_v1(value jsonb,required text[],optional text[] default '{}') returns void
language plpgsql immutable set search_path='' as $f$
declare key text;
begin
 if jsonb_typeof(value) is distinct from 'object' then raise exception 'INVALID_OBJECT';end if;
 foreach key in array required loop if not value ? key then raise exception 'MISSING_FIELD: %',key;end if;end loop;
 for key in select jsonb_object_keys(value) loop if not key=any(required||optional) then raise exception 'UNKNOWN_FIELD: %',key;end if;end loop;
end $f$;

-- Independently derive credit from answers. Never accept a client credit, score or correct flag.
create function private.learning_response_credit_v1(task jsonb, opportunity jsonb, response jsonb, assisted boolean, word_lookup jsonb default null)
returns jsonb language plpgsql stable set search_path='' as $f$
declare word jsonb; activity text:=task->>'activity'; expected text; answer text; item text;
 guesses jsonb; letters jsonb; found text[]:='{}'::text[]; wrong integer:=0; solved boolean:=false; correct boolean:=false;
 n numeric:=0;d numeric:=1;g numeric;credit jsonb;layout jsonb;path jsonb;point jsonb;
 row_no integer;col_no integer;last_row integer;last_col integer;dr integer;dc integer;step_row integer;step_col integer;spelled text:='';i integer:=0;
begin
 if jsonb_typeof(response) is distinct from 'object' or assisted is null then raise exception 'INVALID_RESPONSE';end if;
 if word_lookup is null then select value into word from jsonb_array_elements(task->'words') where value->>'id'=opportunity->>'wordId';else word:=word_lookup->(opportunity->>'wordId');end if;
 if word is null then raise exception 'INVALID_OPPORTUNITY';end if;
 perform private.learning_keys_v1(response,case activity when 'wordle' then array['guesses'] when 'hangman' then array['letters'] when 'matching' then array['selectedDefinitionId'] when 'speed-match' then array['selectedWordId','missed'] when 'word-search' then array['variantId','path'] when 'flashcards' then array['optionId'] when 'quiz' then array['optionId'] when 'synonym-antonym' then array['optionId'] when 'reading-check' then array['optionId'] else array['answer'] end);
 if activity in ('crossword','fill-in-blank','scramble','wordle','hangman','word-search') then expected:=private.learning_normalize_spelling_v1(word->>'word');end if;
 case activity
 when 'crossword','fill-in-blank' then
  if jsonb_typeof(response->'answer') is distinct from 'string' then raise exception 'INVALID_ANSWER';end if;
  credit:=private.learning_spelling_credit_v1(word->>'word',response->>'answer',assisted);
  correct:=expected=private.learning_normalize_spelling_v1(response->>'answer');
 when 'scramble' then
  if jsonb_typeof(response->'answer') is distinct from 'string' then raise exception 'INVALID_ANSWER';end if;
  correct:=expected=private.learning_normalize_spelling_v1(response->>'answer');
 when 'wordle' then
  guesses:=response->'guesses';
  if jsonb_typeof(guesses) is distinct from 'array' or jsonb_array_length(guesses) not between 1 and 6 then raise exception 'INVALID_GUESSES';end if;
  for answer in select jsonb_array_elements_text(guesses) loop
   if answer is null or answer !~ '^[a-z]+$' or length(answer)<>length(expected) or solved then raise exception 'INVALID_GUESSES';end if;
   solved:=answer=expected;
  end loop;
  if not solved and jsonb_array_length(guesses)<>6 then raise exception 'OUTCOME_NOT_READY';end if;
  correct:=solved;
 when 'hangman' then
  letters:=response->'letters';
  if jsonb_typeof(letters) is distinct from 'array' then raise exception 'INVALID_GUESSES';end if;
  for item in select jsonb_array_elements_text(letters) loop
   if item is null or item !~ '^[a-z]$' or item=any(found) or wrong=6 or solved then raise exception 'INVALID_GUESSES';end if;
   found:=array_append(found,item);if position(item in expected)=0 then wrong:=wrong+1;end if;
   select bool_and(c=any(found)) into solved from regexp_split_to_table(expected,'') c;
  end loop;
  if not solved and wrong<6 then raise exception 'OUTCOME_NOT_READY';end if;
  correct:=solved;
 when 'flashcards','quiz','synonym-antonym','reading-check' then
  if jsonb_typeof(response->'optionId') is distinct from 'string' then raise exception 'INVALID_OPTION';end if;
  if not exists(select 1 from jsonb_array_elements(word->'options') o where o->>'id'=response->>'optionId') then raise exception 'INVALID_OPTION';end if;
  correct:=response->>'optionId'=word->>'correctOptionId';
 when 'matching' then
  if (word_lookup is not null and not coalesce(word_lookup ? (response->>'selectedDefinitionId'),false)) or (word_lookup is null and not exists(select 1 from jsonb_array_elements(task->'words') w where w->>'id'=response->>'selectedDefinitionId')) then raise exception 'INVALID_SELECTION';end if;
  correct:=response->>'selectedDefinitionId'=word->>'id';
 when 'speed-match' then
  if jsonb_typeof(response->'missed') is distinct from 'boolean' then raise exception 'INVALID_SELECTION';end if;
  if (response->>'missed')::boolean then
   if response->'selectedWordId' is distinct from 'null'::jsonb then raise exception 'INVALID_SELECTION';end if;
  elsif (word_lookup is not null and not coalesce(word_lookup ? (response->>'selectedWordId'),false)) or (word_lookup is null and not exists(select 1 from jsonb_array_elements(task->'words') w where w->>'id'=response->>'selectedWordId')) then raise exception 'INVALID_SELECTION';end if;
  correct:=not (response->>'missed')::boolean and response->>'selectedWordId'=word->>'id';
 when 'word-search' then
  select value into layout from jsonb_array_elements(task->'variants') where value->>'variantId'=response->>'variantId';
  path:=response->'path';
  if layout is null or jsonb_typeof(path) is distinct from 'array' or jsonb_array_length(path)<>length(expected) then raise exception 'INVALID_PATH';end if;
  for point in select jsonb_array_elements(path) loop
   if jsonb_typeof(point) is distinct from 'array' or jsonb_array_length(point)<>2
    or jsonb_typeof(point->0) is distinct from 'number' or jsonb_typeof(point->1) is distinct from 'number'
    or (point->>0) !~ '^[0-9]+$' or (point->>1) !~ '^[0-9]+$' then raise exception 'INVALID_PATH';end if;
   row_no:=(point->>0)::integer;col_no:=(point->>1)::integer;
   if row_no>=jsonb_array_length(layout->'gridRows') or col_no>=length(layout->'gridRows'->>row_no) then raise exception 'INVALID_PATH';end if;
   if i>0 then
    step_row:=row_no-last_row;step_col:=col_no-last_col;
    if (step_row=0 and step_col=0) or abs(step_row)>1 or abs(step_col)>1
      or (i>1 and (step_row<>dr or step_col<>dc)) then raise exception 'INVALID_PATH';end if;
    dr:=step_row;dc:=step_col;
   end if;
   spelled:=spelled||substr(layout->'gridRows'->>row_no,col_no+1,1);last_row:=row_no;last_col:=col_no;i:=i+1;
  end loop;
  correct:=private.learning_normalize_spelling_v1(spelled)=expected;
  if not correct then raise exception 'INVALID_PATH';end if;
 else raise exception 'INVALID_ACTIVITY';
 end case;
 if credit is null then n:=case when correct then 1 else 0 end;d:=case when assisted then 2 else 1 end;g:=private.learning_gcd_v1(n,d);
  credit:=jsonb_build_object('numerator',div(n,g)::text,'denominator',div(d,g)::text);
 end if;
 return jsonb_build_object('correct',correct,'credit',credit);
end $f$;

-- Canonical task order and shuffle are independently reproduced in PostgreSQL.
create function private.learning_schedule_v1(task jsonb, seed bigint) returns jsonb
language plpgsql stable set search_path='' as $f$
declare ids text[]; shuffled text[];count_rounds integer:=1;j integer;swap text;state bigint:=seed;result jsonb[]:=array[]::jsonb[];word_id text;
begin
 if seed is null or seed not between 1 and 4294967295 then raise exception 'INVALID_SEED';end if;
 select array_agg(w->>'id' order by (w->>'id') collate "C") into ids from jsonb_array_elements(task->'words') w;
 if cardinality(ids) not between 1 and 200 then raise exception 'INVALID_TASK';end if;
 if task->>'activity' in ('matching','speed-match') then count_rounds:=coalesce((task->>'appearances')::integer,5);end if;
 if count_rounds not between 1 and 20 then raise exception 'INVALID_TASK';end if;
 for round_no in 0..count_rounds-1 loop
  shuffled:=ids;
  for i in reverse cardinality(ids)..2 loop
   state:=(state # (state << 13)) & 4294967295;state:=(state # (state >> 17)) & 4294967295;state:=(state # (state << 5)) & 4294967295;
   j:=mod(state,i)::integer+1;swap:=shuffled[i];shuffled[i]:=shuffled[j];shuffled[j]:=swap;
  end loop;
  foreach word_id in array shuffled loop result:=array_append(result,jsonb_build_object('id',word_id||':'||round_no::text,'wordId',word_id,'appearance',round_no));end loop;
 end loop;
 return to_jsonb(result);
end $f$;
create function private.learning_request_v1(expected_user uuid, operation_id uuid, payload_text text, operation_kind text) returns jsonb
language plpgsql set search_path='' as $f$
declare payload json;canonical text;envelope jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from expected_user then raise exception 'OWNER_CHANGED' using errcode='42501';end if;
 if operation_id is null or payload_text is null then raise exception 'INVALID_REQUEST';end if;
 if octet_length(payload_text)>262144 then raise exception 'EVIDENCE_LIMIT';end if;
 payload:=payload_text::json;canonical:=private.learning_json_canonical_v1(payload);
 if json_typeof(payload) is distinct from 'object' or canonical<>payload_text or payload->>'contractVersion' is distinct from 'learning-results-v1' then raise exception 'INVALID_CONTRACT';end if;
 envelope:=jsonb_build_object('p_expected_user_id',expected_user,'p_operation_id',operation_id,'p_payload',payload_text);
 if octet_length(private.learning_json_canonical_v1(envelope::json))>262144 then raise exception 'EVIDENCE_LIMIT';end if;
 return jsonb_build_object('payload',payload::jsonb,'requestHash',private.learning_sha256_v1(convert_to(private.learning_json_canonical_v1(jsonb_build_object('kind',operation_kind,'request',envelope)::json),'UTF8')));
end $f$;
create function private.learning_head_v1(attempt private.learning_result_attempts) returns jsonb language sql immutable set search_path='' as $f$
 select jsonb_build_object('revision',attempt.accepted_revision,'acceptedThroughSequence',attempt.accepted_sequence,'acceptedPrefixHash',attempt.prefix_hash,
 'acceptedStateHash',attempt.state_hash,'acceptedEvidenceBytes',attempt.evidence_bytes,'status','accepted');
$f$;
create function private.learning_receipt_v1(owner_id uuid,operation_id uuid,operation_kind text,request_hash text) returns jsonb
language plpgsql set search_path='' as $f$
declare receipt private.learning_result_receipts;
begin
 select * into receipt from private.learning_result_receipts r where r.user_id=owner_id and r.operation_id=learning_receipt_v1.operation_id;
 if receipt.operation_id is null then return null;end if;
 if receipt.kind<>operation_kind or receipt.request_hash<>learning_receipt_v1.request_hash then raise exception 'OPERATION_CONFLICT';end if;
 return receipt.response;
end $f$;
create function private.learning_claim_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare request jsonb:=private.learning_request_v1(p_expected_user_id,p_operation_id,p_payload,'claim');p jsonb:=request->'payload';receipt jsonb;
 prepared private.learning_result_preparations;task private.learning_result_tasks;attempt private.learning_result_attempts;
 schedule jsonb;prefix text;state_hash text;variant uuid;variants jsonb;hash text;variant_index integer;
begin
 perform private.learning_keys_v1(p,array['contractVersion','preparationId','attemptId','kind','seed','scheduleDigest','startContext','predecessorAttemptId']);
 perform private.ensure_student_progress_summary_v3(p_expected_user_id);
 receipt:=private.learning_receipt_v1(p_expected_user_id,p_operation_id,'claim',request->>'requestHash');if receipt is not null then return receipt;end if;
 select * into prepared from private.learning_result_preparations where id=(p->>'preparationId')::uuid and user_id=p_expected_user_id;
 if prepared.id is null then raise exception 'PREPARATION_REQUIRED' using errcode='42501';end if;
 select * into task from private.learning_result_tasks where id=prepared.task_id;
 if not private.has_school_role(task.school_id,'student',p_expected_user_id) then raise exception 'SCHOOL_UNAVAILABLE' using errcode='42501';end if;
 if prepared.assignment_id is not null and not private.can_read_student_assignment(prepared.assignment_id,p_expected_user_id) then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
 if coalesce(p->>'kind','') not in ('ranked_full','practice') or p->'startContext' is distinct from prepared.start_context then raise exception 'INVALID_CLAIM';end if;
 schedule:=private.learning_schedule_v1(task.task,(p->>'seed')::bigint);
 if p->>'scheduleDigest' is distinct from private.learning_sha256_v1(convert_to(private.learning_json_canonical_v1(schedule::json),'UTF8')) then raise exception 'SCHEDULE_MISMATCH';end if;
 if p->>'predecessorAttemptId' is not null and not exists(select 1 from private.learning_result_attempts a where a.id=(p->>'predecessorAttemptId')::uuid and a.user_id=p_expected_user_id and a.context_key=prepared.context_key and a.task_id=task.id) then raise exception 'INVALID_PREDECESSOR';end if;
 prefix:=private.learning_sha256_v1(convert_to(private.learning_json_canonical_v1(jsonb_build_object('contractVersion','learning-results-v1','attemptId',p->>'attemptId','taskId',task.id)::json),'UTF8'));
 state_hash:=private.learning_sha256_v1(convert_to('null','UTF8'));
 if task.activity_type in ('crossword','word-search') then
  select jsonb_agg(v order by v->>'variantId') into variants from jsonb_array_elements(task.task->'variants') v;
  hash:=private.learning_sha256_v1(convert_to(private.learning_json_canonical_v1(jsonb_build_object('attemptId',p->>'attemptId','taskId',task.id)::json),'UTF8'));
  variant_index:=mod(('x'||substr(hash,1,8))::bit(32)::bigint,jsonb_array_length(variants))::integer;
  variant:=(variants->variant_index->>'variantId')::uuid;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('learning-attempt:'||(p->>'attemptId'),0));
 select * into attempt from private.learning_result_attempts a where a.id=(p->>'attemptId')::uuid and a.user_id=p_expected_user_id for update;
 if attempt.id is not null then
  if attempt.preparation_id<>prepared.id or attempt.kind<>p->>'kind' or attempt.seed<>(p->>'seed')::bigint
  or attempt.schedule is distinct from schedule or attempt.start_context is distinct from p->'startContext'
  or attempt.predecessor_id is distinct from (p->>'predecessorAttemptId')::uuid then raise exception 'ATTEMPT_CONFLICT';end if;
  receipt:=private.learning_head_v1(attempt)||jsonb_build_object('receiptId',p_operation_id,'existingClaim',true);
  insert into private.learning_result_receipts(user_id,operation_id,kind,request_hash,accepted_revision,response) values(p_expected_user_id,p_operation_id,'claim',request->>'requestHash',attempt.accepted_revision,receipt);
  return receipt;
 elsif exists(select 1 from private.learning_result_attempts a where a.id=(p->>'attemptId')::uuid) then raise exception 'ATTEMPT_CONFLICT';end if;
 insert into private.learning_result_attempts(id,user_id,preparation_id,task_id,assignment_id,context_key,unit_key,vocabulary_id,spark_id,activity_type,compatibility_attempt_id,kind,target,schedule,seed,variant_id,start_context,predecessor_id,prefix_hash,state_hash)
 values((p->>'attemptId')::uuid,p_expected_user_id,prepared.id,task.id,prepared.assignment_id,prepared.context_key,prepared.unit_key,prepared.vocabulary_id,prepared.spark_id,task.activity_type,(p->>'attemptId')::uuid,p->>'kind',prepared.target,schedule,(p->>'seed')::bigint,variant,prepared.start_context,(p->>'predecessorAttemptId')::uuid,prefix,state_hash)
 returning * into attempt;
 insert into private.student_activity_attempts(id,user_id,vocabulary_id,spark_id,unit_key,activity_type,assignment_id,record_protocol,learning_attempt_id)
 values(attempt.id,p_expected_user_id,prepared.vocabulary_id,prepared.spark_id,prepared.unit_key,task.activity_type,prepared.assignment_id,'learning-results-v1',attempt.id);
 receipt:=private.learning_head_v1(attempt)||jsonb_build_object('receiptId',p_operation_id);
 insert into private.learning_result_receipts(user_id,operation_id,kind,request_hash,accepted_revision,response) values(p_expected_user_id,p_operation_id,'claim',request->>'requestHash',attempt.accepted_revision,receipt);
 return receipt;
end $f$;
create unique index learning_reading_original_submission on private.learning_result_evidence(attempt_id) where event_type='reading-submission';
create function private.learning_checkpoint_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb
language plpgsql security definer set search_path='' as $f$
<<checkpoint>>
declare request jsonb:=private.learning_request_v1(p_expected_user_id,p_operation_id,p_payload,'checkpoint');p jsonb:=request->'payload';receipt jsonb;
 attempt private.learning_result_attempts;event jsonb;sequence_no integer;prefix text;evidence_bytes integer;recorded_ms bigint;state jsonb;originals integer;event_type text;encoded text;validated_prefix jsonb;rewards jsonb;opportunity_ids jsonb;
begin
 perform private.learning_keys_v1(p,array['contractVersion','attemptId','expectedRevision','localCheckpointRevision','baseSequence','baseHash','throughSequence','throughHash','events','recoverableState','chunkHash']);
 perform private.ensure_student_progress_summary_v3(p_expected_user_id);
 receipt:=private.learning_receipt_v1(p_expected_user_id,p_operation_id,'checkpoint',request->>'requestHash');if receipt is not null then return receipt;end if;
 select * into attempt from private.learning_result_attempts where id=(p->>'attemptId')::uuid and user_id=p_expected_user_id for update;
 if attempt.id is null then raise exception 'ATTEMPT_UNAVAILABLE' using errcode='42501';end if;
 if not exists(select 1 from private.learning_result_tasks t where t.id=attempt.task_id and private.has_school_role(t.school_id,'student',p_expected_user_id))
 or (attempt.assignment_id is not null and not private.can_read_student_assignment(attempt.assignment_id,p_expected_user_id)) then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
 if exists(select 1 from private.learning_result_results where attempt_id=attempt.id and full_task_finished_at is not null) then raise exception 'ATTEMPT_FINISHED';end if;
 if (p->>'expectedRevision')::bigint is distinct from attempt.accepted_revision or (p->>'baseSequence')::integer is distinct from attempt.accepted_sequence or p->>'baseHash' is distinct from attempt.prefix_hash then raise exception 'ATTEMPT_CONFLICT' using detail=private.learning_head_v1(attempt)::text;end if;
 if jsonb_typeof(p->'recoverableState') is distinct from 'object' then raise exception 'STATE_MISMATCH';end if;
 if p->>'chunkHash' is distinct from private.learning_sha256_v1(convert_to(private.learning_json_canonical_v1(jsonb_build_object('operationId',p_operation_id,'payload',p-'chunkHash')::json),'UTF8')) then raise exception 'CHUNK_HASH_MISMATCH';end if;
 if jsonb_typeof(p->'events') is distinct from 'array' then raise exception 'EVIDENCE_GAP';end if;
 sequence_no:=attempt.accepted_sequence;prefix:=attempt.prefix_hash;evidence_bytes:=attempt.evidence_bytes;recorded_ms:=attempt.recorded_milliseconds;
 state:=coalesce(attempt.state,jsonb_build_object('phase','paused','crosswordPhase','original','recordedMilliseconds',0,'evidenceThroughSequence',0,'draft','{}'::jsonb,'writingRevisionId',null));
 select count(*) into originals from private.learning_result_evidence e where e.attempt_id=attempt.id and e.event_type='original';
 select jsonb_object_agg(o->>'id','true'::jsonb) into opportunity_ids from jsonb_array_elements(attempt.schedule) o;
 for event in select jsonb_array_elements(p->'events') loop
  sequence_no:=sequence_no+1;event_type:=event->>'type';
  perform private.learning_keys_v1(event,array['attemptId','eventId','sequence','type','recordedMilliseconds']||case event_type when 'phase' then array['phase'] when 'draft' then array['draft'] when 'assist' then array['opportunityIds'] when 'original' then array['opportunityId','response','assisted'] when 'correction' then array['opportunityId','answer'] when 'submission' then array['writingRevisionId'] when 'reading-submission' then array['responses','writingRevisionId'] else '{}'::text[] end);
  if event->>'attemptId' is distinct from attempt.id::text or (event->>'sequence')::integer is distinct from sequence_no or sequence_no>50000 then raise exception 'EVIDENCE_GAP';end if;
  if (event->>'recordedMilliseconds')::bigint is null or (event->>'recordedMilliseconds')::bigint<recorded_ms then raise exception 'INVALID_TIME';end if;
  recorded_ms:=(event->>'recordedMilliseconds')::bigint;
  case event_type
   when 'resume' then state:=jsonb_set(state,'{phase}','"answer"');
   when 'pause','submission','reading-submission' then state:=jsonb_set(state,'{phase}','"paused"');
   when 'timer' then null;
   when 'phase' then
    if coalesce(event->>'phase','') not in ('study','help','feedback','paused','reading','writing') then raise exception 'INVALID_PHASE';end if;
    state:=jsonb_set(state,'{phase}',event->'phase');
   when 'assist' then state:=jsonb_set(state,'{phase}','"help"');
   when 'correction' then state:=jsonb_set(state,'{phase}','"correction"');
   when 'draft' then
    if not event ? 'draft' then raise exception 'INVALID_EVENT';end if;
    state:=jsonb_set(state,'{draft}',event->'draft');
   when 'original' then
    if not coalesce(opportunity_ids ? (event->>'opportunityId'),false) then raise exception 'INVALID_OPPORTUNITY';end if;
    originals:=originals+1;
    if originals=jsonb_array_length(attempt.schedule) then state:=jsonb_set(state,'{crosswordPhase}','"correction"');end if;
    state:=jsonb_set(state,'{phase}',to_jsonb(case when attempt.activity_type in ('crossword','word-search') and originals<jsonb_array_length(attempt.schedule) then 'answer' else 'feedback' end));
   else raise exception 'INVALID_EVENT_TYPE';
  end case;
  if event_type in ('submission','reading-submission') then
   if not event ? 'writingRevisionId' then raise exception 'INVALID_EVENT';end if;
   state:=jsonb_set(state,'{writingRevisionId}',event->'writingRevisionId');end if;
  encoded:=private.learning_json_canonical_v1(event::json);evidence_bytes:=evidence_bytes+4+octet_length(encoded);
  if evidence_bytes>8388608 then raise exception 'EVIDENCE_LIMIT';end if;
  prefix:=private.learning_extend_hash_v1(prefix,event::json);
  insert into private.learning_result_evidence(attempt_id,sequence,event_id,event_type,opportunity_id,event,canonical_bytes,prefix_hash)
  values(attempt.id,sequence_no,(event->>'eventId')::uuid,event_type,event->>'opportunityId',event,convert_to(encoded,'UTF8'),prefix);
 end loop;
 state:=jsonb_set(jsonb_set(state,'{recordedMilliseconds}',to_jsonb(recorded_ms)),'{evidenceThroughSequence}',to_jsonb(sequence_no));
 if sequence_no is distinct from (p->>'throughSequence')::integer or prefix is distinct from p->>'throughHash' then raise exception 'PREFIX_MISMATCH';end if;
 if state is distinct from p->'recoverableState' then raise exception 'STATE_MISMATCH';end if;
 -- Only private validation state bound to this exact accepted head can seed an append.
 if attempt.accepted_revision>0 and (
  (attempt.accepted_validation->>'revision')::bigint is distinct from attempt.accepted_revision
  or (attempt.accepted_validation->>'throughSequence')::integer is distinct from attempt.accepted_sequence
  or attempt.accepted_validation->>'throughHash' is distinct from attempt.prefix_hash
  or attempt.accepted_validation->>'stateHash' is distinct from attempt.state_hash
  or jsonb_typeof(attempt.accepted_validation->'replayState') is distinct from 'object') then raise exception 'VALIDATED_PREFIX_REQUIRED';end if;
 validated_prefix:=private.learning_evaluate_incremental_v1((select t.task from private.learning_result_tasks t where t.id=attempt.task_id),attempt.schedule,
  p->'events',attempt.target,attempt.variant_id,false,case when attempt.accepted_revision=0 then null else attempt.accepted_validation->'replayState' end);
 -- Freeze original points before untimed review, without completion, rewards or board admission.
 if validated_prefix ? 'points' then
  insert into private.learning_result_results(attempt_id,weighted_numerator,weighted_denominator,speed_numerator,speed_denominator,recorded_milliseconds,points,stars,longest_combo,passed,validation_status,eligibility_reason)
  values(attempt.id,(validated_prefix->'weighted'->>'numerator')::numeric,(validated_prefix->'weighted'->>'denominator')::numeric,(validated_prefix->'speed'->>'numerator')::numeric,(validated_prefix->'speed'->>'denominator')::numeric,
   (validated_prefix->>'recordedMilliseconds')::bigint,(validated_prefix->>'points')::integer,(validated_prefix->>'stars')::integer,(validated_prefix->>'longestCombo')::integer,(validated_prefix->>'passed')::boolean,'original_locked','review_pending')
  on conflict(attempt_id) do nothing;
 end if;
 encoded:=private.learning_json_canonical_v1(state::json);if octet_length(encoded)>65536 then raise exception 'EVIDENCE_LIMIT';end if;
 update private.learning_result_attempts set accepted_revision=accepted_revision+1,accepted_sequence=sequence_no,prefix_hash=prefix,evidence_bytes=checkpoint.evidence_bytes,
  state=checkpoint.state,state_hash=private.learning_sha256_v1(convert_to(encoded,'UTF8')),recorded_milliseconds=recorded_ms,
  accepted_validation=jsonb_build_object('revision',attempt.accepted_revision+1,'throughSequence',sequence_no,'throughHash',prefix,'stateHash',private.learning_sha256_v1(convert_to(encoded,'UTF8')),'replayState',validated_prefix->'replayState','evaluation',validated_prefix-'replayState') where id=attempt.id returning * into attempt;
 rewards:=private.apply_learning_progress_rewards_v1(attempt.id,attempt.accepted_revision);
 receipt:=private.learning_head_v1(attempt)||jsonb_build_object('receiptId',p_operation_id,'localCheckpointRevision',p->'localCheckpointRevision','rewards',rewards);
 insert into private.learning_result_receipts(user_id,operation_id,kind,request_hash,accepted_revision,response) values(p_expected_user_id,p_operation_id,'checkpoint',request->>'requestHash',attempt.accepted_revision,receipt);
 return receipt;
end $f$;

-- Full replay checks assistance, first answers, corrections, phases and visual-only combos.
create function private.learning_evaluate_incremental_v1(task jsonb,schedule jsonb,events jsonb,passing_target integer,assigned_variant uuid,require_submission boolean,previous jsonb)
returns jsonb language plpgsql stable set search_path='' as $f$
declare event jsonb;opportunity jsonb;item jsonb;word jsonb;outcome jsonb;credit jsonb;
 opportunities jsonb;opportunity_indices jsonb;opportunity_index integer;original_outcomes jsonb[]:=array[]::jsonb[];uncorrected_count integer:=0;correct_count integer:=0;word_map jsonb;original_count integer:=0;assistance jsonb:='{}'::jsonb;corrections jsonb:='{}'::jsonb;totals jsonb:='{}'::jsonb;responses jsonb;
 opportunity_id text;phase text:='paused';recorded_ms bigint:=0;current_ms bigint;event_type text;activity text:=task->>'activity';
 assisted boolean;full_run boolean;current_combo integer:=0;longest integer:=0;reading_locked boolean:=false;
 replay_state jsonb;word_count integer:=0;n numeric:=0;d numeric:=1;wn numeric;wd numeric;total_n numeric;total_d numeric;g numeric;result jsonb;
begin
 if jsonb_typeof(events) is distinct from 'array' or jsonb_array_length(events)>50000 then raise exception 'EVIDENCE_LIMIT';end if;
 select jsonb_object_agg(o->>'id',o),jsonb_object_agg(o->>'id',ordinal) into opportunities,opportunity_indices from jsonb_array_elements(schedule) with ordinality as scheduled(o,ordinal);
 select jsonb_object_agg(w->>'id',w) into word_map from jsonb_array_elements(task->'words') w;
 original_outcomes:=array_fill(null::jsonb,array[jsonb_array_length(schedule)]);
 if previous is not null then
  if previous->>'version' is distinct from '1' then raise exception 'VALIDATED_PREFIX_REQUIRED';end if;
  select array_agg(case when value='null'::jsonb then null::jsonb else value end order by ordinality)
   into original_outcomes from jsonb_array_elements(previous->'originalOutcomes') with ordinality;
  phase:=previous->>'phase';recorded_ms:=(previous->>'recordedMilliseconds')::bigint;
  original_count:=(previous->>'originalCount')::integer;correct_count:=(previous->>'correctCount')::integer;
  uncorrected_count:=(previous->>'uncorrectedCount')::integer;current_combo:=(previous->>'currentCombo')::integer;
  longest:=(previous->>'longestCombo')::integer;reading_locked:=(previous->>'readingLocked')::boolean;
  assistance:=previous->'assistance';corrections:=previous->'corrections';
 end if;
 for event in select jsonb_array_elements(events) loop
  if reading_locked then raise exception 'ATTEMPT_FINISHED';end if;
  event_type:=event->>'type';current_ms:=(event->>'recordedMilliseconds')::bigint;
  if current_ms is null or current_ms<recorded_ms or (phase<>'answer' and current_ms<>recorded_ms) then raise exception 'INVALID_TIME';end if;
  recorded_ms:=current_ms;
  case event_type
  when 'resume' then
   if activity<>'reading-check' and original_count=jsonb_array_length(schedule) then raise exception 'ORIGINAL_SET_LOCKED';end if;
   if activity in ('fill-in-blank','speed-match') and uncorrected_count>0 then raise exception 'CORRECTION_REQUIRED';end if;
   phase:='answer';
  when 'pause' then phase:='paused';
  when 'timer','draft' then null;
  when 'phase' then
   if coalesce(event->>'phase','') not in ('study','help','feedback','paused','reading','writing') then raise exception 'INVALID_PHASE';end if;
   phase:=event->>'phase';
  when 'assist' then
   if jsonb_typeof(event->'opportunityIds') is distinct from 'array' then raise exception 'INVALID_OPPORTUNITY';end if;
   for opportunity_id in select jsonb_array_elements_text(event->'opportunityIds') loop
    if not opportunities ? opportunity_id then raise exception 'INVALID_OPPORTUNITY';end if;
    if original_outcomes[(opportunity_indices->>opportunity_id)::integer] is null then assistance:=jsonb_set(assistance,array[opportunity_id],'true');end if;
   end loop;
   phase:='help';
  when 'original' then
   if phase<>'answer' then raise exception 'ANSWER_NOT_USABLE';end if;
   if activity='reading-check' then raise exception 'READING_SUBMISSION_REQUIRED';end if;
   if activity in ('fill-in-blank','speed-match') and uncorrected_count>0 then raise exception 'CORRECTION_REQUIRED';end if;
   opportunity_id:=event->>'opportunityId';
   opportunity:=opportunities->opportunity_id;
   if opportunity is null then raise exception 'INVALID_OPPORTUNITY';end if;
   opportunity_index:=(opportunity_indices->>opportunity_id)::integer;if original_outcomes[opportunity_index] is not null then raise exception 'ORIGINAL_LOCKED';end if;
   assisted:=assistance ? opportunity_id;
   if event->'assisted' is distinct from to_jsonb(assisted) then raise exception 'ASSISTANCE_MISMATCH';end if;
   if activity='word-search' and event->'response'->>'variantId' is distinct from assigned_variant::text then raise exception 'VARIANT_MISMATCH';end if;
   outcome:=private.learning_response_credit_v1(task,opportunity,event->'response',assisted,word_map);
   opportunity_index:=(opportunity_indices->>opportunity_id)::integer;original_outcomes[opportunity_index]:=outcome||jsonb_build_object('wordId',opportunity->>'wordId');original_count:=original_count+1;if (outcome->>'correct')::boolean then correct_count:=correct_count+1;end if;if not (outcome->>'correct')::boolean then uncorrected_count:=uncorrected_count+1;end if;
   credit:=outcome->'credit';
   current_combo:=case when not assisted and credit->>'numerator'=credit->>'denominator' then current_combo+1 else 0 end;longest:=greatest(longest,current_combo);
   phase:=case when activity in ('crossword','word-search') and original_count<jsonb_array_length(schedule) then 'answer' else 'feedback' end;
  when 'correction' then
   opportunity_id:=event->>'opportunityId';
   opportunity_index:=(opportunity_indices->>opportunity_id)::integer;if opportunity_index is null or original_outcomes[opportunity_index] is null then raise exception 'ORIGINAL_NOT_LOCKED';end if;
   if activity='crossword' and original_count<>jsonb_array_length(schedule) then raise exception 'CORRECTION_NOT_READY';end if;
   word:=word_map->(original_outcomes[opportunity_index]->>'wordId');
   if private.learning_normalize_spelling_v1(event->>'answer') is distinct from private.learning_normalize_spelling_v1(word->>'word') then raise exception 'CORRECTION_INCORRECT';end if;
   if not corrections ? opportunity_id and not (original_outcomes[opportunity_index]->>'correct')::boolean then uncorrected_count:=uncorrected_count-1;end if;corrections:=jsonb_set(corrections,array[opportunity_id],'true');phase:='correction';
  when 'reading-submission' then
   if activity<>'reading-check' or original_count<>0 then raise exception 'INVALID_READING_SUBMISSION';end if;
   responses:=event->'responses';
   if jsonb_typeof(responses) is distinct from 'object' or (select count(*) from jsonb_each(responses))<>jsonb_array_length(schedule) then raise exception 'INCOMPLETE_READING_CHECK';end if;
   for opportunity in select jsonb_array_elements(schedule) loop
    opportunity_id:=opportunity->>'id';assisted:=assistance ? opportunity_id;
    outcome:=private.learning_response_credit_v1(task,opportunity,responses->opportunity_id,assisted,word_map);
    opportunity_index:=(opportunity_indices->>opportunity_id)::integer;original_outcomes[opportunity_index]:=outcome||jsonb_build_object('wordId',opportunity->>'wordId');original_count:=original_count+1;if (outcome->>'correct')::boolean then correct_count:=correct_count+1;end if;if not (outcome->>'correct')::boolean then uncorrected_count:=uncorrected_count+1;end if;
    credit:=outcome->'credit';current_combo:=case when not assisted and credit->>'numerator'=credit->>'denominator' then current_combo+1 else 0 end;longest:=greatest(longest,current_combo);
   end loop;
   phase:='paused';reading_locked:=true;
  when 'submission' then
   if activity='reading-check' then raise exception 'READING_SUBMISSION_REQUIRED';end if;
   phase:='paused';reading_locked:=true;
  else raise exception 'INVALID_EVENT_TYPE';
  end case;
 end loop;
 replay_state:=jsonb_build_object('version',1,'originalOutcomes',to_jsonb(original_outcomes),'phase',phase,
 'recordedMilliseconds',recorded_ms,'originalCount',original_count,'correctCount',correct_count,'uncorrectedCount',uncorrected_count,
 'currentCombo',current_combo,'longestCombo',longest,'readingLocked',reading_locked,'assistance',assistance,'corrections',corrections);
 if not reading_locked and require_submission then raise exception 'SUBMISSION_REQUIRED';end if;
 full_run:=original_count=jsonb_array_length(schedule);
 if not full_run then
  if require_submission then raise exception 'EVIDENCE_INCOMPLETE';end if;
  return jsonb_build_object('replayState',replay_state,'status','prefix_valid','originalSetComplete',false,'progressEvidence',jsonb_build_object('originalCount',original_count,'correctCount',correct_count,'resolvedCount',original_count-uncorrected_count));
 end if;
 for score_index in 1..jsonb_array_length(schedule) loop
  outcome:=original_outcomes[score_index];opportunity_id:=schedule->(score_index-1)->>'id';
  item:=coalesce(totals->(outcome->>'wordId'),jsonb_build_object('n','0','d','1','count',0));
  wn:=(item->>'n')::numeric;wd:=(item->>'d')::numeric;
  total_n:=wn*(outcome->'credit'->>'denominator')::numeric+(outcome->'credit'->>'numerator')::numeric*wd;
  total_d:=wd*(outcome->'credit'->>'denominator')::numeric;g:=private.learning_gcd_v1(total_n,total_d);
  totals:=jsonb_set(totals,array[outcome->>'wordId'],jsonb_build_object('n',div(total_n,g)::text,'d',div(total_d,g)::text,'count',(item->>'count')::integer+1));
  if activity<>'reading-check' and not (outcome->>'correct')::boolean and not corrections ? opportunity_id then full_run:=false;end if;
 end loop;
 for item in select value from jsonb_each(totals) loop
  word_count:=word_count+1;wn:=(item->>'n')::numeric;wd:=(item->>'d')::numeric*(item->>'count')::integer;
  total_n:=n*wd+wn*d;total_d:=d*wd;g:=private.learning_gcd_v1(total_n,total_d);n:=div(total_n,g);d:=div(total_d,g);
 end loop;
 if word_count=0 then raise exception 'INVALID_TASK';end if;
 d:=d*word_count;g:=private.learning_gcd_v1(n,d);n:=div(n,g);d:=div(d,g);
 -- All originals are present here. Review completion cannot change the locked speed component.
 result:=private.learning_score_v1(n,d,recorded_ms,(task->>'sharedTargetMilliseconds')::integer,passing_target,true);
 return result||jsonb_build_object('replayState',replay_state,'weighted',jsonb_build_object('numerator',n::text,'denominator',d::text),'recordedMilliseconds',recorded_ms,'longestCombo',longest,'finished',full_run,'progressEvidence',jsonb_build_object('originalCount',original_count,'correctCount',correct_count,'resolvedCount',original_count-uncorrected_count));
end $f$;

-- Full-transcript evaluator remains available for parity checks and independent audits.
create function private.learning_evaluate_v1(task jsonb,schedule jsonb,events jsonb,passing_target integer,assigned_variant uuid default null,require_submission boolean default true)
returns jsonb language sql stable set search_path='' as $f$
 select private.learning_evaluate_incremental_v1(task,schedule,events,passing_target,assigned_variant,require_submission,null)-'replayState';
$f$;

-- One reward calculation shared by validated legacy writes and the learning bridge.
create function private.apply_student_activity_reward_delta_v1(old_score numeric,new_score numeric,old_complete boolean,new_complete boolean,settings jsonb)
returns jsonb language plpgsql stable set search_path='' as $f$
declare progress_rate integer:=least(10,greatest(0,floor(private.jsonb_number(settings,'progressReward',1))::integer));
 completion_rate integer:=least(200,greatest(0,floor(private.jsonb_number(settings,'completionBonus',50))::integer));progress integer;completion integer;
begin
 progress:=greatest(0,(floor(new_score/10)::integer-floor(old_score/10)::integer)*progress_rate);
 completion:=case when new_complete and not old_complete then completion_rate else 0 end;
 return jsonb_build_object('progress',progress,'completion',completion,'total',progress+completion);
end $f$;
do $share_reward_calculation$
declare definition text;modified text;start_pos integer;end_pos integer;
begin
 select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='submit_student_activity_progress_v2';
 start_pos:=strpos(definition,'    progress_reward :=');end_pos:=strpos(definition,'    if p_is_complete then old_plays :=');
 if start_pos=0 or end_pos<=start_pos then raise exception 'Cannot share current legacy reward calculation';end if;
 modified:=substr(definition,1,start_pos-1)||E'    reward := (private.apply_student_activity_reward_delta_v1(old_score,sanitized_score,old_complete,new_complete,vocabulary_row.activity_settings)->>''total'')::integer;\n'||substr(definition,end_pos);
 modified:=regexp_replace(modified,'(?in)^    (progress_reward|completion_bonus|steps_gained) integer[^\n]*\n','','g');
 execute modified;
end $share_reward_calculation$;
create function private.apply_learning_progress_rewards_v1(p_attempt_id uuid,p_accepted_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $f$
<<bridge>>
declare owner_id uuid;attempt private.learning_result_attempts;result private.learning_result_results;task private.learning_result_tasks;
 summary public.student_progress_summary;old_activity public.student_activity_progress;vocabulary public.vocabularies;material_version private.class_material_versions;
 context jsonb;settings jsonb:='{}'::jsonb;required_activity boolean:=false;metric numeric:=0;old_score numeric:=0;old_complete boolean:=false;new_complete boolean;
 old_plays integer:=0;old_earned integer:=0;delta jsonb;progress_award integer:=0;completion_award integer:=0;xp_award integer:=0;amount integer;balance integer;coin_data jsonb;
 correct_count integer:=0;original_count integer:=0;resolved_count integer:=0;legacy_accuracy numeric;progress_evidence jsonb;role_name text;completed_now boolean;
begin
 select user_id into owner_id from private.learning_result_attempts where id=p_attempt_id;
 if owner_id is null or auth.uid() is distinct from owner_id then raise exception 'OWNER_CHANGED' using errcode='42501';end if;
 summary:=private.ensure_student_progress_summary_v3(owner_id);
 select * into attempt from private.learning_result_attempts where id=p_attempt_id for update;
 perform 1 from private.student_activity_attempts where id=p_attempt_id and record_protocol='learning-results-v1' for update;
 select * into result from private.learning_result_results where attempt_id=p_attempt_id;
 if attempt.accepted_revision<>p_accepted_revision or p_accepted_revision<=0 or (result.attempt_id is not null and result.validation_status not in ('original_locked','validated')) then raise exception 'VALIDATED_PREFIX_REQUIRED';end if;
 if result.attempt_id is not null then update private.student_activity_attempts set finished_at=coalesce(finished_at,now()),capture_quality='complete' where id=attempt.id;end if;
 if attempt.bridge_revision>=p_accepted_revision then return jsonb_build_object('coins',0,'xp',0);end if;
 if attempt.kind<>'ranked_full' then
  update private.learning_result_attempts set bridge_revision=p_accepted_revision where id=attempt.id;
  return jsonb_build_object('coins',0,'xp',0);
 end if;
 select * into task from private.learning_result_tasks where id=attempt.task_id;
 if attempt.vocabulary_id is not null then
  select * into vocabulary from public.vocabularies where id=attempt.vocabulary_id;
  if vocabulary.id is null then raise exception 'CONTENT_UNAVAILABLE';end if;
  if attempt.assignment_id is not null then
   select v.* into material_version from private.class_material_versions v join public.class_assignments a on a.version_id=v.id where a.id=attempt.assignment_id;
   vocabulary.words:=material_version.student_content->'words';vocabulary.activity_settings:=material_version.student_content->'activitySettings';
  end if;
  settings:=coalesce(vocabulary.activity_settings,'{}');required_activity:=attempt.activity_type=any(private.required_vocabulary_activities(vocabulary));
  context:=jsonb_build_object('unitId',vocabulary.id,'unitName',vocabulary.name,'subjectSlug',coalesce(vocabulary.teacher_subject_id::text,vocabulary.subject_slug),'trimester',coalesce(vocabulary.trimester,''),'grade',task.grade::text);
 else
  -- Existing reading submission has no coin/XP schedule. Preserve that behavior.
  context:=jsonb_build_object('unitId',attempt.spark_id,'unitName',coalesce((select title from public.weekly_sparks where id=attempt.spark_id),''),'grade',task.grade::text);
 end if;
 perform private.upsert_student_unit_work_v3(owner_id,attempt.unit_key,context,'{}');
 select * into old_activity from public.student_activity_progress p where p.user_id=owner_id and p.unit_key=attempt.unit_key and p.activity_type=attempt.activity_type for update;
 if old_activity.user_id is not null then
  old_score:=old_activity.score;old_complete:=old_activity.is_complete or (old_activity.completion_semantics='legacy' and old_activity.score>=100);
  old_plays:=old_activity.plays;old_earned:=old_activity.total_earned;
 end if;
 completed_now:=coalesce(result.passed,false) and result.validation_status='validated' and result.full_task_finished_at is not null and attempt.completion_applied_at is null;
 new_complete:=old_complete or completed_now;
 -- The checkpoint derived these counters from the complete accepted prefix.
 -- Bind reuse to that exact server revision, sequence and hashes; terminal only
 -- increments the revision after validating the same immutable accepted head.
 if attempt.accepted_validation->>'throughHash' is distinct from attempt.prefix_hash
 or (attempt.accepted_validation->>'throughSequence')::integer is distinct from attempt.accepted_sequence
 or attempt.accepted_validation->>'stateHash' is distinct from attempt.state_hash
 or (attempt.accepted_validation->>'revision')::bigint is distinct from
   (attempt.accepted_revision-case when result.validation_status='validated' and result.full_task_finished_at is not null then 1 else 0 end) then raise exception 'VALIDATED_PREFIX_REQUIRED';end if;
 progress_evidence:=attempt.accepted_validation->'evaluation'->'progressEvidence';
 if jsonb_typeof(progress_evidence) is distinct from 'object' then raise exception 'VALIDATED_PREFIX_REQUIRED';end if;
 if attempt.activity_type<>'reading-check' then
  original_count:=(progress_evidence->>'originalCount')::integer;correct_count:=(progress_evidence->>'correctCount')::integer;resolved_count:=(progress_evidence->>'resolvedCount')::integer;
 end if;
 legacy_accuracy:=case when original_count>0 then round(100::numeric*correct_count/original_count) else null end;
 if attempt.activity_type in ('quiz','synonym-antonym') then metric:=coalesce(legacy_accuracy,0);
 elsif attempt.activity_type='wordle' then metric:=round(100::numeric*correct_count/jsonb_array_length(attempt.schedule));
 elsif attempt.activity_type='speed-match' then metric:=least(100,correct_count*10);
 elsif attempt.activity_type='reading-check' then metric:=case when completed_now then 100 else 0 end;
 elsif attempt.activity_type='hangman' then metric:=round(100::numeric*original_count/jsonb_array_length(attempt.schedule));
 else metric:=round(100::numeric*resolved_count/jsonb_array_length(attempt.schedule));end if;
 update private.student_activity_attempts set score=metric,accuracy=legacy_accuracy,correct_actions=case when original_count>0 then correct_count else null end,
  attempted_actions=nullif(original_count,0),metric_label=case when attempt.activity_type in ('quiz','synonym-antonym') then 'Accuracy' else 'Progress' end,
  mastered=coalesce(result.passed,false) and result.validation_status='validated' and result.full_task_finished_at is not null,
  details=jsonb_build_object('learningAttemptId',attempt.id,'taskId',task.id,'points',result.points,'stars',result.stars,'originalSetLocked',result.attempt_id is not null,'requiredReviewFinished',result.full_task_finished_at is not null)
 where id=attempt.id;
 if attempt.vocabulary_id is not null then delta:=private.apply_student_activity_reward_delta_v1(old_score,metric,old_complete,new_complete,settings);
 else delta:=jsonb_build_object('progress',0,'completion',0);end if;
 coin_data:=private.normalize_coin_data(summary.coin_data);balance:=(coin_data->>'balance')::integer;
 amount:=(delta->>'progress')::integer;
 if amount>0 then
  insert into public.student_coin_ledger(user_id,event_key,event_type,amount,balance_after,source,description,metadata)
  values(owner_id,'learning:'||attempt.id::text||':progress:'||p_accepted_revision::text,'earn',amount,balance+amount,'activity',attempt.activity_type,jsonb_build_object('attemptId',attempt.id,'acceptedRevision',p_accepted_revision))
  on conflict(user_id,event_key) do nothing returning public.student_coin_ledger.amount into progress_award;
  progress_award:=coalesce(progress_award,0);balance:=balance+progress_award;
 end if;
 amount:=(delta->>'completion')::integer;
 if amount>0 then
  insert into public.student_coin_ledger(user_id,event_key,event_type,amount,balance_after,source,description,metadata)
  values(owner_id,'learning:'||attempt.id::text||':completion','earn',amount,balance+amount,'activity',attempt.activity_type,jsonb_build_object('attemptId',attempt.id))
  on conflict(user_id,event_key) do nothing returning public.student_coin_ledger.amount into completion_award;
  completion_award:=coalesce(completion_award,0);balance:=balance+completion_award;
 end if;
 insert into public.student_activity_progress(user_id,unit_key,activity_type,score,is_complete,plays,total_earned,accuracy,details,verified,attempt_id,last_played,updated_at,completion_semantics)
 values(owner_id,attempt.unit_key,attempt.activity_type,greatest(old_score,metric),new_complete,old_plays+case when completed_now then 1 else 0 end,old_earned+progress_award+completion_award,
  legacy_accuracy,jsonb_build_object('learningAttemptId',attempt.id,'points',result.points,'stars',result.stars),true,attempt.id::text,now(),now(),'explicit')
 on conflict(user_id,unit_key,activity_type) do update set score=excluded.score,is_complete=excluded.is_complete,plays=excluded.plays,total_earned=excluded.total_earned,
  accuracy=excluded.accuracy,details=excluded.details,verified=excluded.verified,attempt_id=excluded.attempt_id,last_played=excluded.last_played,updated_at=excluded.updated_at,completion_semantics='explicit';
 if result.attempt_id is not null then
  update public.student_activity_progress p set latest_attempt_id=case when attempt.originals_applied_at is null then attempt.id else p.latest_attempt_id end,
   best_attempt_id=case when p.best_attempt_id is null or metric>=coalesce((select a.score from private.student_activity_attempts a where a.id=p.best_attempt_id),-1) then attempt.id else p.best_attempt_id end,
   best_accuracy=greatest(p.best_accuracy,legacy_accuracy),
   finished_runs=p.finished_runs+case when attempt.originals_applied_at is null then 1 else 0 end,
   mastered_runs=p.mastered_runs+case when completed_now then 1 else 0 end,
   lifetime_correct=p.lifetime_correct+case when attempt.originals_applied_at is null then correct_count else 0 end,
   lifetime_attempted=p.lifetime_attempted+case when attempt.originals_applied_at is null then original_count else 0 end
  where p.user_id=owner_id and p.unit_key=attempt.unit_key and p.activity_type=attempt.activity_type;
 end if;
 if completed_now then
  if attempt.vocabulary_id is not null then
   role_name:=case when required_activity then 'required' else 'optional' end;
   insert into public.student_xp_events(user_id,unit_key,activity_type,activity_role,attempt_id,xp_amount,reason)
   values(owner_id,attempt.unit_key,attempt.activity_type,role_name,attempt.id::text,private.student_activity_xp_amount(attempt.activity_type),case when required_activity then 'First required activity completion' else 'Optional activity completion' end)
   on conflict do nothing returning xp_amount into xp_award;xp_award:=coalesce(xp_award,0);
  end if;
  update private.student_activity_attempts set completed_at=coalesce(completed_at,now()) where id=attempt.id;
 end if;
 coin_data:=jsonb_set(coin_data,'{balance}',to_jsonb(balance));
 coin_data:=jsonb_set(coin_data,'{totalEarned}',to_jsonb((coin_data->>'totalEarned')::integer+progress_award+completion_award));
 if progress_award+completion_award+xp_award>0 then update public.student_progress_summary set coins=balance,coin_data=bridge.coin_data,total_xp=total_xp+xp_award,version=version+1,updated_at=now() where user_id=owner_id;end if;
 update private.learning_result_attempts set bridge_revision=p_accepted_revision,originals_applied_at=case when result.attempt_id is not null then coalesce(originals_applied_at,now()) else originals_applied_at end,completion_applied_at=case when completed_now then now() else completion_applied_at end where id=attempt.id;
 return jsonb_build_object('coins',progress_award+completion_award,'xp',xp_award);
end $f$;
revoke all on function private.apply_student_activity_reward_delta_v1(numeric,numeric,boolean,boolean,jsonb),private.apply_learning_progress_rewards_v1(uuid,bigint) from public,anon,authenticated;

create unique index learning_support_result_once on private.learning_result_support_events(attempt_id) where outcome_type in ('pass','failure');
create function private.learning_support_v1(p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $f$
<<support_projection>>
declare attempt private.learning_result_attempts;result private.learning_result_results;support private.learning_result_support;event_id uuid;pass_attempt uuid;failures jsonb;count_failures integer;
begin
 select * into attempt from private.learning_result_attempts where id=p_attempt_id;
 if attempt.user_id is distinct from auth.uid() then raise exception 'OWNER_CHANGED' using errcode='42501';end if;
 select * into result from private.learning_result_results where attempt_id=p_attempt_id and validation_status='validated' and full_task_finished_at is not null;
 if result.attempt_id is null or attempt.kind<>'ranked_full' then return jsonb_build_object('counted',false);end if;
 insert into private.learning_result_support(user_id,assignment_id,context_key,activity_type) values(attempt.user_id,attempt.assignment_id,attempt.context_key,attempt.activity_type) on conflict do nothing;
 select * into support from private.learning_result_support s where s.user_id=attempt.user_id and s.context_key=attempt.context_key and s.activity_type=attempt.activity_type for update;
 if exists(select 1 from private.learning_result_support_events where attempt_id=attempt.id and outcome_type in ('pass','failure')) then return jsonb_build_object('help',support.help,'failures',jsonb_array_length(support.failures));end if;
 event_id:=gen_random_uuid();
 insert into private.learning_result_support_events(id,user_id,assignment_id,context_key,activity_type,attempt_id,outcome_type,cycle_id,relation)
 values(event_id,attempt.user_id,attempt.assignment_id,attempt.context_key,attempt.activity_type,attempt.id,case when result.passed then 'pass' else 'failure' end,support.pass_event_id,
 jsonb_build_object('classification',case when result.passed then 'pass' when support.pass_event_id is null then 'before_first_pass' else 'uncertain' end,'startContext',attempt.start_context,'predecessorAttemptId',attempt.predecessor_id));
 if result.passed then
  support.pass_event_id:=event_id;support.earned_completion:=true;
 end if;
 if support.pass_event_id is null then
  select coalesce(jsonb_agg(e.attempt_id order by e.attempt_id),'[]') into failures from private.learning_result_support_events e
   where e.user_id=attempt.user_id and e.context_key=attempt.context_key and e.activity_type=attempt.activity_type and e.outcome_type='failure';
 else
  select e.attempt_id into pass_attempt from private.learning_result_support_events e where e.id=support.pass_event_id;
  with recursive candidates as materialized(
   select a.id,a.predecessor_id,a.start_context from private.learning_result_support_events e join private.learning_result_attempts a on a.id=e.attempt_id
   where e.user_id=attempt.user_id and e.context_key=attempt.context_key and e.activity_type=attempt.activity_type and e.outcome_type='failure'
  ), proven(id) as (
   select c.id from candidates c where c.start_context->>'passEventId'=support.pass_event_id::text or c.predecessor_id=pass_attempt
   union select c.id from candidates c join proven p on p.id=c.predecessor_id
  ) select coalesce(jsonb_agg(id order by id),'[]') into failures from proven;
  insert into private.learning_result_support_events(id,user_id,assignment_id,context_key,activity_type,attempt_id,outcome_type,cycle_id,relation)
   select gen_random_uuid(),attempt.user_id,attempt.assignment_id,attempt.context_key,attempt.activity_type,value::uuid,'classification',support.pass_event_id,jsonb_build_object('classification','post_pass','passEventId',support.pass_event_id)
   from jsonb_array_elements_text(failures) on conflict(attempt_id,outcome_type,cycle_id) do nothing;
 end if;
 count_failures:=jsonb_array_length(failures);
 update private.learning_result_support s set pass_event_id=support.pass_event_id,earned_completion=support.earned_completion,failures=support_projection.failures,help=count_failures>=2,revision=s.revision+1
 where s.user_id=attempt.user_id and s.context_key=attempt.context_key and s.activity_type=attempt.activity_type;
 return jsonb_build_object('help',count_failures>=2,'failures',count_failures,'passEventId',support.pass_event_id);
end $f$;

create function private.learning_reading_projection_v1(attempt private.learning_result_attempts,task private.learning_result_tasks,result jsonb,writing private.learning_result_writing_revisions)
returns void language plpgsql security definer set search_path='' as $f$
<<projection>>
declare head private.learning_result_writing_heads;legacy public.class_assignment_responses;event jsonb;opportunity jsonb;word jsonb;outcome jsonb;
 answers jsonb:=coalesce(writing.responses,'{}');checks jsonb:='[]'::jsonb;evaluation jsonb;response_text text:='';correct_count integer:=0;automatic_count integer:=jsonb_array_length(task.task->'words');
 total integer:=jsonb_array_length(task.task->'words')+jsonb_array_length(coalesce(task.task->'writingQuestions','[]'));completed boolean;question jsonb;selected text;
begin
 if task.activity_type<>'reading-check' then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(coalesce(attempt.assignment_id::text,attempt.context_key)||attempt.user_id::text,0));
 if writing.id is not null then
  select * into head from private.learning_result_writing_heads h where h.user_id=attempt.user_id and h.context_key=attempt.context_key and h.content_version=task.canonical_digest for update;
  if head.writing_revision_id is distinct from writing.id then raise exception 'WRITING_CONFLICT';end if;
 end if;
 if attempt.assignment_id is not null then
  select * into legacy from public.class_assignment_responses where assignment_id=attempt.assignment_id and student_id=attempt.user_id for update;
  if writing.id is not null and head.legacy_revision is distinct from legacy.revision then raise exception 'WRITING_CONFLICT';end if;
 end if;
 select e.event into event from private.learning_result_evidence e where e.attempt_id=attempt.id and e.event_type='reading-submission';
 for opportunity in select jsonb_array_elements(attempt.schedule) loop
  select w into word from jsonb_array_elements(task.task->'words') w where w->>'id'=opportunity->>'wordId';
  selected:=event->'responses'->(opportunity->>'id')->>'optionId';
  outcome:=private.learning_response_credit_v1(task.task,opportunity,jsonb_build_object('optionId',selected),false);
  -- Source options use stable option:<original index> IDs for legacy response readers.
  if selected !~ '^option:[0-9]+$' then raise exception 'INVALID_SOURCE';end if;
  answers:=answers||jsonb_build_object(word->>'id',substring(selected from 8)::integer);
  correct_count:=correct_count+case when (outcome->>'correct')::boolean then 1 else 0 end;
  checks:=checks||jsonb_build_array(jsonb_build_object('id',word->>'id','answered',true,'correct',outcome->'correct'));
 end loop;
 for question in select jsonb_array_elements(coalesce(task.task->'writingQuestions','[]')) loop
  checks:=checks||jsonb_build_array(jsonb_build_object('id',question->>'id','answered',true,'correct',null));end loop;
 completed:=coalesce((result->>'passed')::boolean,false) or exists(select 1 from private.learning_result_support s where s.user_id=attempt.user_id and s.context_key=attempt.context_key and s.activity_type=attempt.activity_type and s.earned_completion);
 evaluation:=jsonb_build_object('answered',total,'total',total,'correct',correct_count,'automaticTotal',automatic_count,'needsTeacherReview',total>automatic_count,
 'isComplete',completed,'results',checks,'weighted',result->'weighted','points',result->'points','learningAttemptId',attempt.id);
 if attempt.assignment_id is not null then
  select string_agg('['||key||'] '||case when jsonb_typeof(value)='string' then value#>>'{}' else value::text end,E'\n\n' order by key collate "C") into response_text from jsonb_each(answers);
  insert into public.class_assignment_responses(assignment_id,student_id,response,answers,evaluation)
  values(attempt.assignment_id,attempt.user_id,left(response_text,10000),answers,evaluation)
  on conflict(assignment_id,student_id) do update set response=excluded.response,revision=class_assignment_responses.revision+1,submitted_at=now();
  -- Run after the existing response-edit trigger clears previous check fields.
  update public.class_assignment_responses set answers=projection.answers,evaluation=projection.evaluation where assignment_id=attempt.assignment_id and student_id=attempt.user_id returning * into legacy;
  if writing.id is not null then update private.learning_result_writing_heads set legacy_revision=legacy.revision where user_id=attempt.user_id and context_key=attempt.context_key and content_version=task.canonical_digest;end if;
 else
  insert into public.student_spark_responses(user_id,spark_id,answers,evaluation,is_complete,completed_at)
  values(attempt.user_id,attempt.spark_id,answers,evaluation,completed,case when completed then now() else null end)
  on conflict(user_id,spark_id) do update set answers=excluded.answers,evaluation=excluded.evaluation,
   is_complete=student_spark_responses.is_complete or excluded.is_complete,completed_at=coalesce(student_spark_responses.completed_at,excluded.completed_at);
 end if;
end $f$;

create function private.learning_submit_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare request jsonb:=private.learning_request_v1(p_expected_user_id,p_operation_id,p_payload,'submit');p jsonb:=request->'payload';receipt jsonb;
 attempt private.learning_result_attempts;task private.learning_result_tasks;writing private.learning_result_writing_revisions;question jsonb;
 result jsonb;rewards jsonb;writing_id uuid;finished_at timestamptz;eligible boolean;changed boolean:=false;
begin
 perform private.learning_keys_v1(p,array['contractVersion','attemptId','expectedRevision','terminalSequence','terminalHash','stateHash','writingRevisionId','finishDeclaration']);
 perform private.learning_keys_v1(p->'finishDeclaration',array['originalSetSubmitted','requiredReviewSubmitted']);
 if octet_length(private.learning_json_canonical_v1(jsonb_build_object('p_expected_user_id',p_expected_user_id,'p_operation_id',p_operation_id,'p_payload',p_payload)::json))>16384 then raise exception 'EVIDENCE_LIMIT';end if;
 perform private.ensure_student_progress_summary_v3(p_expected_user_id);
 receipt:=private.learning_receipt_v1(p_expected_user_id,p_operation_id,'submit',request->>'requestHash');if receipt is not null then return receipt;end if;
 select * into attempt from private.learning_result_attempts where id=(p->>'attemptId')::uuid and user_id=p_expected_user_id for update;
 if attempt.id is null then raise exception 'ATTEMPT_UNAVAILABLE' using errcode='42501';end if;
 perform 1 from private.student_activity_attempts where id=attempt.id for update;
 if exists(select 1 from private.learning_result_results where attempt_id=attempt.id and full_task_finished_at is not null) then
  select * into task from private.learning_result_tasks where id=attempt.task_id;
  if not private.has_school_role(task.school_id,'student',p_expected_user_id) or (attempt.assignment_id is not null and not private.can_read_student_assignment(attempt.assignment_id,p_expected_user_id)) then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
  if (p->>'expectedRevision')::bigint not between attempt.accepted_revision-1 and attempt.accepted_revision
  or (p->>'terminalSequence')::integer is distinct from attempt.accepted_sequence or p->>'terminalHash' is distinct from attempt.prefix_hash or p->>'stateHash' is distinct from attempt.state_hash
  or p->'writingRevisionId' is distinct from attempt.state->'writingRevisionId'
  or p->'finishDeclaration' is distinct from jsonb_build_object('originalSetSubmitted',true,'requiredReviewSubmitted',true) then raise exception 'ATTEMPT_CONFLICT' using detail=private.learning_head_v1(attempt)::text;end if;
  select r.response->'result' into result from private.learning_result_receipts r where r.user_id=p_expected_user_id and r.kind='submit' and r.response->'result'->>'attemptId'=attempt.id::text order by r.committed_at,r.operation_id limit 1;
  if result is null then raise exception 'RESULT_RECOVERY_REQUIRED';end if;
  receipt:=private.learning_head_v1(attempt)||jsonb_build_object('status','confirmed','receiptId',p_operation_id,'alreadyConfirmed',true,'result',result||jsonb_build_object('rewards',jsonb_build_object('coins',0,'xp',0)));
  insert into private.learning_result_receipts(user_id,operation_id,kind,request_hash,accepted_revision,response) values(p_expected_user_id,p_operation_id,'submit',request->>'requestHash',attempt.accepted_revision,receipt);
  return receipt;
 end if;
 if (p->>'expectedRevision')::bigint is distinct from attempt.accepted_revision or (p->>'terminalSequence')::integer is distinct from attempt.accepted_sequence
 or p->>'terminalHash' is distinct from attempt.prefix_hash or p->>'stateHash' is distinct from attempt.state_hash then raise exception 'ATTEMPT_CONFLICT' using detail=private.learning_head_v1(attempt)::text;end if;
 if p->'finishDeclaration'->'originalSetSubmitted' is distinct from 'true'::jsonb then raise exception 'SUBMISSION_REQUIRED';end if;
 select * into task from private.learning_result_tasks where id=attempt.task_id;
 if not private.has_school_role(task.school_id,'student',p_expected_user_id) then raise exception 'SCHOOL_UNAVAILABLE' using errcode='42501';end if;
 if attempt.assignment_id is not null and not private.can_read_student_assignment(attempt.assignment_id,p_expected_user_id) then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
 writing_id:=(p->>'writingRevisionId')::uuid;
 if p->'writingRevisionId' is distinct from attempt.state->'writingRevisionId' then raise exception 'WRITING_REVISION_MISMATCH';end if;
 if writing_id is not null then
  select * into writing from private.learning_result_writing_revisions where id=writing_id and user_id=p_expected_user_id and context_key=attempt.context_key and spark_id=attempt.spark_id and content_version=task.canonical_digest;
  if writing.id is null then raise exception 'WRITING_REVISION_REQUIRED';end if;
 end if;
 for question in select jsonb_array_elements(coalesce(task.task->'writingQuestions','[]')) loop
  if coalesce((question->>'required')::boolean,true) and (writing.id is null or length(trim(writing.responses->>(question->>'id'))) not between 12 and 3000 or writing.responses->>(question->>'id') is null) then raise exception 'WRITING_INCOMPLETE';end if;
 end loop;
 -- Every append validates its new evidence against private state bound to the
 -- preceding accepted head, then saves both atomically. Finalization accepts
 -- only that exact revision/sequence/hash/state; no browser score is reused.
 if (attempt.accepted_validation->>'revision')::bigint is distinct from attempt.accepted_revision
 or (attempt.accepted_validation->>'throughSequence')::integer is distinct from attempt.accepted_sequence
 or attempt.accepted_validation->>'throughHash' is distinct from attempt.prefix_hash
 or attempt.accepted_validation->>'stateHash' is distinct from attempt.state_hash then raise exception 'VALIDATED_PREFIX_REQUIRED';end if;
 result:=(attempt.accepted_validation->'evaluation')-'progressEvidence';
 if jsonb_typeof(result) is distinct from 'object' or not result ? 'points' then raise exception 'EVIDENCE_INCOMPLETE';end if;
 if (result->>'finished')::boolean is distinct from true or p->'finishDeclaration'->'requiredReviewSubmitted' is distinct from 'true'::jsonb then raise exception 'REVIEW_REQUIRED';end if;
 finished_at:=now();
 eligible:=attempt.kind='ranked_full';
 insert into private.learning_result_results(attempt_id,weighted_numerator,weighted_denominator,speed_numerator,speed_denominator,recorded_milliseconds,points,stars,longest_combo,passed,full_task_finished_at,validation_status,eligibility_reason)
 values(attempt.id,(result->'weighted'->>'numerator')::numeric,(result->'weighted'->>'denominator')::numeric,(result->'speed'->>'numerator')::numeric,(result->'speed'->>'denominator')::numeric,
 (result->>'recordedMilliseconds')::bigint,(result->>'points')::integer,(result->>'stars')::integer,(result->>'longestCombo')::integer,(result->>'passed')::boolean,finished_at,'validated',case when eligible then 'eligible' else 'practice' end)
 on conflict(attempt_id) do update set full_task_finished_at=excluded.full_task_finished_at,validation_status=excluded.validation_status,eligibility_reason=excluded.eligibility_reason;
 update private.learning_result_attempts set accepted_revision=accepted_revision+1 where id=attempt.id returning * into attempt;
 perform private.learning_reading_projection_v1(attempt,task,result,writing);
 rewards:=private.apply_learning_progress_rewards_v1(attempt.id,attempt.accepted_revision);
 perform private.learning_support_v1(attempt.id);
 -- Best points and the shorter time always come from the same validated attempt.
 if eligible then
  insert into private.learning_result_board_versions(task_id) values(task.id) on conflict do nothing;
  perform 1 from private.learning_result_board_versions where task_id=task.id for update;
  insert into private.learning_result_board_entries as existing(task_id,user_id,attempt_id,points,recorded_milliseconds)
  values(task.id,p_expected_user_id,attempt.id,(result->>'points')::integer,(result->>'recordedMilliseconds')::bigint)
  on conflict(task_id,user_id) do update set attempt_id=excluded.attempt_id,points=excluded.points,recorded_milliseconds=excluded.recorded_milliseconds
  where excluded.points>existing.points or (excluded.points=existing.points and excluded.recorded_milliseconds<existing.recorded_milliseconds)
   or (excluded.points=existing.points and excluded.recorded_milliseconds=existing.recorded_milliseconds and excluded.attempt_id<existing.attempt_id)
  returning true into changed;
  if coalesce(changed,false) then update private.learning_result_board_versions set revision=revision+1 where task_id=task.id;end if;
 end if;
 receipt:=private.learning_head_v1(attempt)||jsonb_build_object('status','confirmed','receiptId',p_operation_id,'result',result||jsonb_build_object('rewards',rewards,'taskId',task.id,'attemptId',attempt.id,'eligible',eligible));
 insert into private.learning_result_receipts(user_id,operation_id,kind,request_hash,accepted_revision,response) values(p_expected_user_id,p_operation_id,'submit',request->>'requestHash',attempt.accepted_revision,receipt);
 return receipt;
end $f$;

-- Authorization, the full ordering digest, ranks and each page share one SQL statement snapshot.
create function private.learning_board_v1(p_expected_user_id uuid,p_payload text) returns jsonb
language sql stable security definer set search_path='' as $f$
 with input as materialized(select p_payload::jsonb p),
 board as materialized(select t.*,coalesce(v.revision,0) board_revision from private.learning_result_tasks t
  left join private.learning_result_board_versions v on v.task_id=t.id,input where t.id=(input.p->>'taskId')::uuid
  and auth.uid()=p_expected_user_id and (private.can_edit_school_library(t.school_id) or
   (private.has_school_role(t.school_id,'student',p_expected_user_id) and exists(select 1 from public.school_memberships m
    where m.school_id=t.school_id and m.user_id=p_expected_user_id and m.active and case when m.grade~'^[0-9]{1,2}$' then m.grade::integer end=t.grade)
   and (exists(select 1 from private.learning_result_preparations prepared where prepared.task_id=t.id and prepared.user_id=p_expected_user_id and (prepared.assignment_id is null or private.can_read_student_assignment(prepared.assignment_id,p_expected_user_id)))
    or exists(select 1 from public.class_assignments ca where 'version:'||ca.version_id::text=t.content_set_id and private.can_read_student_assignment(ca.id,p_expected_user_id))
    or exists(select 1 from public.weekly_sparks spark where 'spark:'||spark.id=t.content_set_id and spark.school_id=t.school_id and spark.status='scheduled' and spark.scheduled_date<=(now() at time zone 'America/Panama')::date and t.grade::text=any(spark.target_grades)))))),
 eligible as materialized(select e.user_id,e.attempt_id,e.points,e.recorded_milliseconds,
  trim(concat_ws(' ',p.first_name,p.last_name)) display_name,translate(normalize(trim(concat_ws(' ',p.first_name,p.last_name)),NFC),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') collate "C" sort_name
  from board b join private.learning_result_board_entries e on e.task_id=b.id
  join private.learning_result_results r on r.attempt_id=e.attempt_id and r.validation_status='validated' and r.full_task_finished_at is not null and r.eligibility_reason='eligible'
  join public.profiles p on p.user_id=e.user_id
  join public.school_memberships m on m.school_id=b.school_id and m.user_id=e.user_id and m.active and case when m.grade~'^[0-9]{1,2}$' then m.grade::integer end=b.grade
  join public.schools school on school.id=b.school_id and school.active
  join public.school_member_roles role on role.school_id=b.school_id and role.user_id=e.user_id and role.role='student'),
 -- Exact lr-json-v1 bytes for concrete UUID/text/integer fields, without building
 -- and recursively walking a 5000-object JSON tree on every page. Names retain
 -- canonical string escaping. Current eligibility and names share this snapshot.
 ordering as materialized(select private.learning_sha256_v1(convert_to('['||coalesce(string_agg(
  '{"attemptId":"'||attempt_id::text||'","name":'||private.learning_json_canonical_v1(to_json(display_name))||
  ',"points":'||points::text||',"recordedMilliseconds":'||recorded_milliseconds::text||
  ',"sortName":'||private.learning_json_canonical_v1(to_json(sort_name))||',"userId":"'||user_id::text||'"}',',' order by user_id),'')||']','UTF8')) digest from eligible),
 ranked as materialized(select *,rank() over(order by points desc) rank from eligible),
 bounds as materialized(select b.board_revision,o.digest,input.p,
  (input.p->'cursor' is null or input.p->'cursor'='null'::jsonb or
    ((input.p->>'boardRevision')::bigint=b.board_revision and input.p->>'orderingDigest'=o.digest)) fresh
  from board b cross join ordering o cross join input),
 page as materialized(select r.* from ranked r,bounds b where b.fresh and r.rank<=5 and
  (b.p->'cursor' is null or b.p->'cursor'='null'::jsonb or
   (-r.points,r.recorded_milliseconds,r.sort_name collate "C",r.user_id) >
   (-(b.p->'cursor'->>'points')::integer,(b.p->'cursor'->>'recordedMilliseconds')::bigint,(b.p->'cursor'->>'sortName') collate "C",(b.p->'cursor'->>'userId')::uuid))
  order by points desc,recorded_milliseconds,sort_name collate "C",user_id limit 100),
 display_entries as materialized(select p.* from page p union all select r.* from ranked r,bounds b where b.fresh and r.user_id=p_expected_user_id and not exists(select 1 from page p where p.user_id=r.user_id)),
 last_row as materialized(select * from page order by points,recorded_milliseconds desc,sort_name collate "C" desc,user_id desc limit 1)
 select case when not exists(select 1 from board) then jsonb_build_object('status','unavailable')
 when not coalesce((select fresh from bounds),false) then jsonb_build_object('status','refresh_required')
 else jsonb_build_object('status','ok','boardRevision',(select board_revision from bounds),'orderingDigest',(select digest from bounds),
 'pageUserIds',coalesce((select jsonb_agg(user_id order by points desc,recorded_milliseconds,sort_name collate "C",user_id) from page),'[]'::jsonb),
 'entries',coalesce((select jsonb_agg(jsonb_build_object('userId',user_id,'attemptId',attempt_id,'name',display_name,'points',points,'recordedMilliseconds',recorded_milliseconds,'rank',rank)
  order by points desc,recorded_milliseconds,sort_name collate "C",user_id) from display_entries),'[]'::jsonb),
 'nextCursor',(select case when exists(select 1 from ranked r where r.rank<=5 and (-r.points,r.recorded_milliseconds,r.sort_name collate "C",r.user_id)>(-last_row.points,last_row.recorded_milliseconds,last_row.sort_name collate "C",last_row.user_id))
  then jsonb_build_object('points',points,'recordedMilliseconds',recorded_milliseconds,'sortName',sort_name,'userId',user_id) else null end from last_row)) end;
$f$;

-- Validate browser candidates independently before any task can be published.
create function private.learning_layout_v1(words jsonb, activity text, layout jsonb)
returns void language plpgsql stable set search_path='' as $f$
declare nr integer;nc integer;placement jsonb;word jsonb;label text;direction text;dr integer;dc integer;
 r integer;c integer;i integer;j integer;k integer;cell integer;other integer;run_cells integer[];
 occupied integer[]:=array_fill(0,array[1600]); across_owner integer[]:=array_fill(0,array[1600]);down_owner integer[]:=array_fill(0,array[1600]);
 seen text[]:='{}'::text[];labels text[]:='{}'::text[];paths jsonb:='[]'::jsonb;path integer[];links jsonb:='[]'::jsonb;reachable integer[]:=array[1];changed boolean;edge jsonb;entry jsonb;
begin
 if activity not in ('crossword','word-search') or jsonb_typeof(words) is distinct from 'array'
 or jsonb_array_length(words) not between 1 and 200 then raise exception 'LAYOUT_INVALID';end if;
 perform private.learning_keys_v1(layout,array['variantId','generatorVersion','seed','rows','columns','gridRows','placements']);
 if (layout->>'variantId')::uuid is null or layout->>'generatorVersion' is distinct from 'grid-v1'
 or coalesce(layout->>'seed','') !~ '^[0-9a-f]{8}$' or layout->>'seed'='00000000' then raise exception 'LAYOUT_INVALID';end if;
 if jsonb_typeof(layout->'rows') is distinct from 'number' or jsonb_typeof(layout->'columns') is distinct from 'number' or coalesce(layout->>'rows','') !~ '^[1-9][0-9]?$' or coalesce(layout->>'columns','') !~ '^[1-9][0-9]?$' then raise exception 'LAYOUT_INVALID';end if;
 nr:=(layout->>'rows')::integer;nc:=(layout->>'columns')::integer;
 if nr>40 or nc>40 or octet_length(convert_to(private.learning_json_canonical_v1(layout::json),'UTF8'))>49152
 or jsonb_typeof(layout->'gridRows') is distinct from 'array' or jsonb_array_length(layout->'gridRows')<>nr
 or jsonb_typeof(layout->'placements') is distinct from 'array' or jsonb_array_length(layout->'placements')<>jsonb_array_length(words)
 then raise exception 'LAYOUT_INVALID';end if;
 for entry in select value from jsonb_array_elements(layout->'gridRows') loop
 if jsonb_typeof(entry)<>'string' or length(entry#>>'{}')<>nc or (entry#>>'{}') !~ (case when activity='crossword' then '^[A-Z#]+$' else '^[A-Z]+$' end)
 then raise exception 'LAYOUT_INVALID';end if;end loop;
 -- Validate unique authoritative IDs and normalized labels, not candidate labels.
 for word in select value from jsonb_array_elements(words) loop
 if jsonb_typeof(word->'id') is distinct from 'string' or coalesce(word->>'id','')='' or word->>'id'=any(seen) then raise exception 'LAYOUT_INVALID';end if;
 seen:=array_append(seen,word->>'id');label:=upper(private.learning_normalize_spelling_v1(word->>'word'));
 if label !~ '^[A-Z]{2,30}$' or (activity='word-search' and label=any(labels)) then raise exception 'LAYOUT_INVALID';end if;
 labels:=array_append(labels,label);end loop;seen:='{}';k:=0;
 for placement in select value from jsonb_array_elements(layout->'placements') loop
 k:=k+1;perform private.learning_keys_v1(placement,array['wordId','startRow','startColumn','direction']);
 select value into word from jsonb_array_elements(words) where value->>'id'=placement->>'wordId';
 if word is null or placement->>'wordId'=any(seen) then raise exception 'LAYOUT_INVALID';end if;
 seen:=array_append(seen,placement->>'wordId');label:=upper(private.learning_normalize_spelling_v1(word->>'word'));
 if jsonb_typeof(placement->'startRow') is distinct from 'number' or jsonb_typeof(placement->'startColumn') is distinct from 'number' or coalesce(placement->>'startRow','') !~ '^(0|[1-9][0-9]?)$' or coalesce(placement->>'startColumn','') !~ '^(0|[1-9][0-9]?)$' then raise exception 'LAYOUT_INVALID';end if;
 r:=(placement->>'startRow')::integer;c:=(placement->>'startColumn')::integer;direction:=placement->>'direction';
 if r>=nr or c>=nc or direction is null or (activity='crossword' and direction not in ('across','down'))
 or (activity='word-search' and direction not in ('N','NE','E','SE','S','SW','W','NW')) then raise exception 'LAYOUT_INVALID';end if;
 dr:=case direction when 'N' then -1 when 'NE' then -1 when 'NW' then -1 when 'S' then 1 when 'SE' then 1 when 'SW' then 1 when 'down' then 1 else 0 end;
 dc:=case direction when 'E' then 1 when 'NE' then 1 when 'SE' then 1 when 'W' then -1 when 'NW' then -1 when 'SW' then -1 when 'across' then 1 else 0 end;
 path:='{}';
 for letter_index in 1..length(label) loop
 if r<0 or r>=nr or c<0 or c>=nc or substr(layout->'gridRows'->>r,c+1,1)<>substr(label,letter_index,1) then raise exception 'LAYOUT_INVALID';end if;
 cell:=r*40+c+1;path:=array_append(path,cell);
 if activity='crossword' then
 if (direction='across' and across_owner[cell]<>0) or (direction='down' and down_owner[cell]<>0) then raise exception 'LAYOUT_INVALID';end if;
 other:=case when direction='across' then down_owner[cell] else across_owner[cell] end;
 if other<>0 then links:=links||jsonb_build_array(jsonb_build_array(other,k));end if;
 if direction='across' then across_owner[cell]:=k;else down_owner[cell]:=k;end if;
 end if;occupied[cell]:=k;r:=r+dr;c:=c+dc;end loop;
 paths:=paths||jsonb_build_array(to_jsonb(path));end loop;
 if activity='crossword' then
 loop changed:=false;
 for edge in select value from jsonb_array_elements(links) loop
 i:=(edge->>0)::integer;j:=(edge->>1)::integer;
 if i=any(reachable) and not j=any(reachable) then reachable:=array_append(reachable,j);changed:=true;end if;
 if j=any(reachable) and not i=any(reachable) then reachable:=array_append(reachable,i);changed:=true;end if;
 end loop;exit when not changed;end loop;
 if cardinality(reachable)<>jsonb_array_length(words) then raise exception 'LAYOUT_INVALID';end if;
 for grid_row in 0..nr-1 loop for grid_column in 0..nc-1 loop
 if substr(layout->'gridRows'->>grid_row,grid_column+1,1)='#' then continue;end if;
 cell:=grid_row*40+grid_column+1;if occupied[cell]=0 then raise exception 'LAYOUT_INVALID';end if;
 -- Every horizontal/vertical run of two or more letters must be declared exactly.
 for orientation in 0..1 loop
 dr:=orientation;dc:=1-orientation;
 if (grid_row-dr)>=0 and (grid_column-dc)>=0 and substr(layout->'gridRows'->>(grid_row-dr),grid_column-dc+1,1)<>'#' then continue;end if;
 i:=grid_row;k:=grid_column;run_cells:='{}';
 while i<nr and k<nc and substr(layout->'gridRows'->>i,k+1,1)<>'#' loop
 run_cells:=array_append(run_cells,i*40+k+1);i:=i+dr;k:=k+dc;end loop;
 if cardinality(run_cells)>1 and not paths @> jsonb_build_array(to_jsonb(run_cells)) then raise exception 'LAYOUT_INVALID';end if;
 end loop;end loop;end loop;end if;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'LAYOUT_INVALID';
end $f$;

create function private.learning_task_valid_v1(task jsonb) returns void
language plpgsql stable set search_path='' as $f$
declare activity text:=task->>'activity';word jsonb;option jsonb;variant jsonb;ids text[]:='{}'::text[];option_ids text[];label text;labels text[]:='{}'::text[];definitions text[]:='{}'::text[];definition text;variant_ids uuid[]:='{}'::uuid[];
begin
 if jsonb_typeof(task) is distinct from 'object' or task->>'contractVersion' is distinct from 'learning-results-v1'
 or activity is null or activity not in ('flashcards','matching','scramble','wordle','hangman','fill-in-blank','crossword','word-search','quiz','synonym-antonym','speed-match','reading-check')
 or (task->>'id')::uuid is null or jsonb_typeof(task->'sharedTargetMilliseconds') is distinct from 'number' or coalesce(task->>'sharedTargetMilliseconds','') !~ '^[0-9]+$'
 or (task->>'sharedTargetMilliseconds')::numeric not between 1000 and 86400000
 or jsonb_typeof(task->'words') is distinct from 'array' or jsonb_array_length(task->'words') not between 1 and 200 then raise exception 'INVALID_TASK';end if;
 for word in select value from jsonb_array_elements(task->'words') loop
 if jsonb_typeof(word->'id') is distinct from 'string' or coalesce(word->>'id','')='' or word->>'id'=any(ids)
 or jsonb_typeof(word->'word') is distinct from 'string' or trim(word->>'word')='' then raise exception 'INVALID_TASK';end if;
 ids:=array_append(ids,word->>'id');label:=private.learning_normalize_spelling_v1(word->>'word');
 if activity<>'reading-check' then
  if activity='synonym-antonym' then
   if coalesce(word->>'relation','') not in ('synonym','antonym') then raise exception 'INVALID_TASK';end if;
   definition:=label||':'||(word->>'relation');
  else definition:=label;end if;
  if label='' or definition=any(labels) then raise exception 'WORD_AMBIGUOUS';end if;labels:=array_append(labels,definition);
  if activity in ('matching','speed-match') and word ? 'definition' then
   definition:=trim(word->>'definition');if coalesce(definition,'')='' or definition=any(definitions) then raise exception 'WORD_AMBIGUOUS';end if;definitions:=array_append(definitions,definition);
  end if;
 end if;
 if activity in ('wordle','hangman','scramble','crossword','word-search') then
 if label !~ '^[a-z]+$' or length(label)<(case when activity='wordle' then 3 when activity in ('crossword','word-search') then 2 else 1 end)
 or length(label)>(case when activity='wordle' then 10 else 30 end) then raise exception 'WORD_UNPLAYABLE';end if;end if;
 if activity in ('flashcards','quiz','synonym-antonym','reading-check') then
 if jsonb_typeof(word->'options') is distinct from 'array' or jsonb_array_length(word->'options') not between 2 and 8 then raise exception 'INVALID_TASK';end if;
 option_ids:='{}';
 for option in select value from jsonb_array_elements(word->'options') loop
 if jsonb_typeof(option->'id') is distinct from 'string' or coalesce(option->>'id','')='' or option->>'id'=any(option_ids) then raise exception 'INVALID_TASK';end if;
 option_ids:=array_append(option_ids,option->>'id');end loop;
 if not coalesce(word->>'correctOptionId'=any(option_ids),false) then raise exception 'INVALID_TASK';end if;end if;end loop;
 if activity in ('matching','speed-match') then
 if cardinality(ids)<2 or coalesce(task->>'appearances','5') !~ '^[0-9]+$' or coalesce((task->>'appearances')::numeric,5) not between 1 and 20 then raise exception 'INVALID_TASK';end if;end if;
 if activity in ('matching','speed-match') and cardinality(ids)*coalesce((task->>'appearances')::integer,5)>250 then raise exception 'TASK_CAPACITY_EXCEEDED';end if;
 if activity in ('crossword','word-search') then
 if jsonb_typeof(task->'variants') is distinct from 'array' or jsonb_array_length(task->'variants') not between 1 and 4 then raise exception 'LAYOUT_INVALID';end if;
 for variant in select value from jsonb_array_elements(task->'variants') loop
 if (variant->>'variantId')::uuid=any(variant_ids) then raise exception 'LAYOUT_INVALID';end if;
 variant_ids:=array_append(variant_ids,(variant->>'variantId')::uuid);perform private.learning_layout_v1(task->'words',activity,variant);end loop;end if;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'INVALID_TASK';
end $f$;

-- Read sources through current school/class authority. No editable profile claims.
create function private.learning_source_v1(source jsonb, grade integer, authoring boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $f$
<<source_scope>>
declare a public.class_assignments;v private.class_material_versions;school_id uuid;content jsonb;assessment jsonb:='{}'::jsonb;
 vocabulary_id text;spark_id text;content_id text;context_key text;source_token text;
begin
 perform private.learning_keys_v1(source,array['kind','id']);
 if grade is null or grade not between 1 and 12 or jsonb_typeof(source->'id') is distinct from 'string' or coalesce(source->>'id','')='' then raise exception 'INVALID_SOURCE';end if;
 if source->>'kind'='assignment' then
  select * into a from public.class_assignments where id=(source->>'id')::uuid for share;
  if a.id is null then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
  school_id:=a.school_id;
  if authoring then
   if not private.owns_teaching_class(a.class_id) then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
  else
   a:=private.assert_assignment_work_access('assignment:'||a.id::text);
  end if;
  select * into v from private.class_material_versions where id=a.version_id;
  content:=v.student_content;assessment:=v.assessment_key;vocabulary_id:=v.vocabulary_id;spark_id:=v.spark_id;
  content_id:='version:'||v.id::text;context_key:='assignment:'||a.id::text;
 elsif source->>'kind'='vocabulary' then
  if not authoring then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
  select s.school_id, jsonb_build_object('kind','vocabulary','name',name,'description',description,'words',words,'activitySettings',activity_settings,'grades',grades),id
  into school_id,content,vocabulary_id from public.vocabularies s where s.id=source->>'id' for share;
  if content is null or not (content->'grades' @> jsonb_build_array(grade::text)) then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
  content_id:='vocabulary:'||vocabulary_id;context_key:=vocabulary_id;
 elsif source->>'kind'='spark' then
  select s.school_id,jsonb_build_object('kind','spark','title',s.title,'sparkText',s.spark_text,'whyItMatters',s.why_it_matters,'question',s.question,'gradeQuestions',s.grade_questions,'checkMode',s.check_mode,'questions',s.questions),s.id
  into school_id,content,spark_id from public.weekly_sparks s where s.id=source->>'id'
   and grade::text=any(s.target_grades) and (authoring or (s.status='scheduled' and s.scheduled_date<=(now() at time zone 'America/Panama')::date)) for share;
  if content is null then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
  assessment:=jsonb_build_object('questions',content->'questions');content_id:='spark:'||spark_id;context_key:=content_id;
 else raise exception 'INVALID_SOURCE';end if;
 if not authoring and content#>>'{activitySettings,retiredWeeklySet}'='true' then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
 if school_id is null then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
 if authoring then
  if not private.can_edit_school_library(school_id) or not exists(
   select 1 from public.teaching_classes c join public.class_memberships cm on cm.class_id=c.id and cm.active
   join public.school_memberships sm on sm.school_id=c.school_id and sm.user_id=cm.student_id and sm.active
   where c.school_id=source_scope.school_id and not c.archived and private.owns_teaching_class(c.id)
   and sm.grade=learning_source_v1.grade::text and (a.id is null or c.id=a.class_id)) then raise exception 'TEACHING_GRADE_REQUIRED' using errcode='42501';end if;
 else
  if not private.has_school_role(school_id,'student') or not exists(select 1 from public.school_memberships sm where sm.school_id=source_scope.school_id and sm.user_id=auth.uid() and sm.active and sm.grade=learning_source_v1.grade::text)
  then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
 end if;
 source_token:=private.learning_sha256_v1(convert_to(private.learning_json_canonical_v1(jsonb_build_object('content',content,'assessment',assessment,'schoolId',school_id,'grade',grade,'contentSetId',content_id)::json),'UTF8'));
 return jsonb_build_object('schoolId',school_id,'grade',grade,'contentSetId',content_id,'contextKey',context_key,'assignmentId',a.id,'vocabularyId',vocabulary_id,'sparkId',spark_id,'content',content,'assessment',assessment,'sourceDigest',source_token);
end $f$;

-- The official answer set is derived from stored source content, never supplied by students or teachers.
create function private.learning_words_v1(source jsonb, activity text) returns jsonb
language plpgsql stable set search_path='' as $f$
declare content jsonb:=source->'content';raw jsonb;word jsonb;other jsonb;question jsonb;questions jsonb;options jsonb;result jsonb:='[]'::jsonb;writing jsonb:='[]'::jsonb;
 word_id text;label text;definition text;answer text;relation text;option_text text;seen text[]:='{}'::text[];texts text[];idx integer:=0;oi integer;correct integer;
begin
 if activity='reading-check' then
  if content->>'checkMode'='reading_only' then raise exception 'NO_SCORED_QUESTIONS';end if;
  questions:=coalesce(source->'assessment'->'questions',content->'questions','[]'::jsonb);
  if jsonb_typeof(questions) is distinct from 'array' or jsonb_array_length(questions)>200 then raise exception 'INVALID_SOURCE';end if;
  for question in select value from jsonb_array_elements(questions) loop
   word_id:=question->>'id';label:=trim(question->>'prompt');
   if coalesce(word_id,'')='' or word_id=any(seen) or coalesce(label,'')='' then raise exception 'INVALID_SOURCE';end if;seen:=array_append(seen,word_id);
   if question->>'type'='short_text' then writing:=writing||jsonb_build_array(jsonb_build_object('id',word_id,'prompt',label,'required',true));continue;end if;
   if question->>'type' is distinct from 'multiple_choice' or jsonb_typeof(question->'options') is distinct from 'array' or jsonb_array_length(question->'options') not between 2 and 8
   or jsonb_typeof(question->'correctOption') is distinct from 'number' or coalesce(question->>'correctOption','') !~ '^[0-9]+$' then raise exception 'INVALID_SOURCE';end if;
   correct:=(question->>'correctOption')::integer;options:='[]';texts:='{}';oi:=0;
   for raw in select value from jsonb_array_elements(question->'options') loop
    option_text:=trim(raw#>>'{}');
    if jsonb_typeof(raw)<>'string' or coalesce(option_text,'')='' or option_text=any(texts) then raise exception 'INVALID_SOURCE';end if;
    texts:=array_append(texts,option_text);options:=options||jsonb_build_array(jsonb_build_object('id','option:'||oi,'text',option_text));oi:=oi+1;end loop;
   if correct>=oi then raise exception 'INVALID_SOURCE';end if;
   result:=result||jsonb_build_array(jsonb_build_object('id',word_id,'word',label,'options',options,'correctOptionId','option:'||correct));
  end loop;
  if result='[]'::jsonb then raise exception 'NO_SCORED_QUESTIONS';end if;
 else
  if jsonb_typeof(content->'words') is distinct from 'array' or jsonb_array_length(content->'words') not between 1 and 200 then raise exception 'INVALID_SOURCE';end if;
  for raw in select value from jsonb_array_elements(content->'words') loop
   idx:=idx+1;word_id:=coalesce(nullif(raw->>'id',''),'word:'||idx);label:=trim(raw->>'word');definition:=trim(raw->>'definition');
   if coalesce(label,'')='' or coalesce(definition,'')='' or word_id=any(seen) then raise exception 'INVALID_SOURCE';end if;seen:=array_append(seen,word_id);
   word:=jsonb_build_object('id',word_id,'word',label,'definition',definition,'example',coalesce(raw->>'example',''));
   if activity='synonym-antonym' then
    for relation in select unnest(array['synonym','antonym']) loop
     if jsonb_typeof(raw->(relation||'s')) is distinct from 'array' or jsonb_array_length(raw->(relation||'s'))=0 then continue;end if;
     answer:=trim(raw->(relation||'s')->>0);if coalesce(answer,'')='' then raise exception 'WORD_UNPLAYABLE';end if;
     options:=jsonb_build_array(jsonb_build_object('id','option:0','text',answer));texts:=array[answer];oi:=1;
     for other in select value from jsonb_array_elements(content->'words') loop
      option_text:=trim(other->>'word');
      if coalesce(raw->'synonyms','[]'::jsonb) @> jsonb_build_array(option_text) or coalesce(raw->'antonyms','[]'::jsonb) @> jsonb_build_array(option_text) or option_text=label then continue;end if;
      if coalesce(option_text,'')<>'' and not option_text=any(texts) then options:=options||jsonb_build_array(jsonb_build_object('id','option:'||oi,'text',option_text));texts:=array_append(texts,option_text);oi:=oi+1;end if;exit when oi=4;
     end loop;
     if oi<2 then raise exception 'WORD_UNPLAYABLE';end if;
     result:=result||jsonb_build_array(word||jsonb_build_object('id',word_id||':'||relation,'sourceWordId',word_id,'relation',relation,'options',options,'correctOptionId','option:0'));
    end loop;
    if coalesce(jsonb_array_length(raw->'synonyms'),0)+coalesce(jsonb_array_length(raw->'antonyms'),0)=0 then raise exception 'WORD_UNPLAYABLE';end if;
    continue;
   end if;
   if activity in ('quiz','flashcards') then
    answer:=definition;options:=jsonb_build_array(jsonb_build_object('id','option:0','text',answer));texts:=array[answer];oi:=1;
    for other in select value from jsonb_array_elements(content->'words') loop
     option_text:=trim(other->>'definition');
     if coalesce(option_text,'')<>'' and not option_text=any(texts) then options:=options||jsonb_build_array(jsonb_build_object('id','option:'||oi,'text',option_text));texts:=array_append(texts,option_text);oi:=oi+1;end if;exit when oi=4;
    end loop;
    if oi<2 then raise exception 'WORD_UNPLAYABLE';end if;
    word:=word||jsonb_build_object('options',options,'correctOptionId','option:0');
   end if;
   result:=result||jsonb_build_array(word);
  end loop;
 end if;
 return jsonb_build_object('words',result,'writingQuestions',writing);
end $f$;

create function private.learning_publish_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare request jsonb:=private.learning_request_v1(p_expected_user_id,p_operation_id,p_payload,'settings');p jsonb:=request->'payload';receipt jsonb;
 source jsonb;setting private.learning_results_settings;task private.learning_result_tasks;words jsonb;task_body jsonb;digest text;old_task uuid;response jsonb;
begin
 perform private.learning_keys_v1(p,array['contractVersion','source','grade','activity','expectedRevision','sourceDigest','sharedTargetMilliseconds','enabled'],array['appearances','layoutCandidates']);
 perform pg_advisory_xact_lock(hashtextextended(p_expected_user_id::text||':'||p_operation_id::text,0));
 receipt:=private.learning_receipt_v1(p_expected_user_id,p_operation_id,'settings',request->>'requestHash');if receipt is not null then return receipt;end if;
 if jsonb_typeof(p->'grade') is distinct from 'number' or coalesce(p->>'grade','') !~ '^[0-9]+$'
 or jsonb_typeof(p->'expectedRevision') is distinct from 'number' or coalesce(p->>'expectedRevision','') !~ '^[0-9]+$'
 or jsonb_typeof(p->'enabled') is distinct from 'boolean' then raise exception 'INVALID_SETTINGS';end if;
 source:=private.learning_source_v1(p->'source',(p->>'grade')::integer,true);
 if p->>'sourceDigest' is distinct from source->>'sourceDigest' then raise exception 'SOURCE_CHANGED';end if;
 if ((source->>'sparkId' is not null) is distinct from (p->>'activity'='reading-check')) then raise exception 'INVALID_ACTIVITY';end if;
 words:=private.learning_words_v1(source,p->>'activity');
 task_body:=words||jsonb_build_object('contractVersion','learning-results-v1','activity',p->>'activity','sharedTargetMilliseconds',p->'sharedTargetMilliseconds',
 'appearances',coalesce(p->'appearances','5'::jsonb));
 if p->>'activity' in ('crossword','word-search') then task_body:=task_body||jsonb_build_object('variants',p->'layoutCandidates');
 elsif p ? 'layoutCandidates' and p->'layoutCandidates' not in ('null'::jsonb,'[]'::jsonb) then raise exception 'INVALID_SETTINGS';end if;
 perform private.learning_task_valid_v1(task_body||jsonb_build_object('id','00000000-0000-4000-8000-000000000000'));
 digest:=private.learning_sha256_v1(convert_to(private.learning_json_canonical_v1(task_body::json),'UTF8'));
 -- Serialize all authors editing this exact shared scope, including its first publication.
 perform pg_advisory_xact_lock(hashtextextended((source->>'schoolId')||':'||(source->>'grade')||':'||(source->>'contentSetId')||':'||(p->>'activity'),0));
 select * into setting from private.learning_results_settings s where s.school_id=(source->>'schoolId')::uuid and s.grade=(source->>'grade')::integer and s.content_set_id=source->>'contentSetId' and s.activity_type=p->>'activity' for update;
 if coalesce(setting.revision,0)<>(p->>'expectedRevision')::bigint then raise exception 'SETTINGS_CONFLICT' using detail=jsonb_build_object('revision',setting.revision,'taskId',setting.published_task_id)::text;end if;
 old_task:=setting.published_task_id;
 select * into task from private.learning_result_tasks t where t.school_id=(source->>'schoolId')::uuid and t.grade=(source->>'grade')::integer and t.content_set_id=source->>'contentSetId' and t.activity_type=p->>'activity' and t.canonical_digest=digest;
 if task.id is null then
  task.id:=gen_random_uuid();task_body:=task_body||jsonb_build_object('id',task.id);
  insert into private.learning_result_tasks(id,school_id,grade,content_set_id,activity_type,canonical_digest,task,creator_id)
  values(task.id,(source->>'schoolId')::uuid,(source->>'grade')::integer,source->>'contentSetId',p->>'activity',digest,task_body,p_expected_user_id) returning * into task;
 end if;
 insert into private.learning_results_settings(school_id,grade,content_set_id,activity_type,revision,shared_target_milliseconds,appearances,source_digest,published_task_id,enabled)
 values(task.school_id,task.grade,task.content_set_id,task.activity_type,1,(p->>'sharedTargetMilliseconds')::integer,coalesce((p->>'appearances')::integer,5),source->>'sourceDigest',task.id,(p->>'enabled')::boolean)
 on conflict(school_id,grade,content_set_id,activity_type) do update set revision=private.learning_results_settings.revision+1,
 shared_target_milliseconds=excluded.shared_target_milliseconds,appearances=excluded.appearances,source_digest=excluded.source_digest,published_task_id=excluded.published_task_id,enabled=excluded.enabled returning * into setting;
 response:=jsonb_build_object('status','published','revision',setting.revision,'taskId',task.id,'oldTaskId',old_task,'task',task.task,'sourceDigest',source->>'sourceDigest');
 insert into private.learning_result_receipts(user_id,operation_id,kind,request_hash,accepted_revision,response) values(p_expected_user_id,p_operation_id,'settings',request->>'requestHash',setting.revision,response);
 return response;
end $f$;

create function private.learning_prepare_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare request jsonb:=private.learning_request_v1(p_expected_user_id,p_operation_id,p_payload,'prepare');p jsonb:=request->'payload';receipt jsonb;
 source jsonb;task private.learning_result_tasks;setting private.learning_results_settings;target_override private.learning_result_target_overrides;support private.learning_result_support;
 prepared private.learning_result_preparations;writing_head private.learning_result_writing_heads;writing private.learning_result_writing_revisions;legacy_revision integer;legacy_answers jsonb;prior_writing jsonb:='{}'::jsonb;question jsonb;writing_snapshot jsonb;target integer:=80;target_source jsonb:=jsonb_build_object('kind','default','target',80);start_context jsonb;content jsonb;manifest text;response jsonb;
begin
 perform private.learning_keys_v1(p,array['contractVersion','source','grade','activity','expectedTaskId']);
 perform pg_advisory_xact_lock(hashtextextended(p_expected_user_id::text||':'||p_operation_id::text,0));
 receipt:=private.learning_receipt_v1(p_expected_user_id,p_operation_id,'prepare',request->>'requestHash');if receipt is not null then return receipt;end if;
 source:=private.learning_source_v1(p->'source',(p->>'grade')::integer,false);
 if source->>'vocabularyId' is not null then perform private.assert_student_activity_access(p_expected_user_id,source->>'contextKey',source->>'vocabularyId',p->>'activity');end if;
 select * into setting from private.learning_results_settings s where s.school_id=(source->>'schoolId')::uuid and s.grade=(source->>'grade')::integer and s.content_set_id=source->>'contentSetId' and s.activity_type=p->>'activity' and s.enabled for share;
 if setting.published_task_id is null then raise exception 'TASK_NOT_PUBLISHED';end if;
 if p->>'expectedTaskId' is not null and (p->>'expectedTaskId')::uuid<>setting.published_task_id then raise exception 'TASK_CHANGED';end if;
 select * into task from private.learning_result_tasks t where t.id=setting.published_task_id;
 if setting.source_digest is distinct from source->>'sourceDigest' then raise exception 'TASK_NOT_PUBLISHED';end if;
 select * into target_override from private.learning_result_target_overrides o where o.user_id=p_expected_user_id and o.context_key=source->>'contextKey' and o.activity_type=task.activity_type;
 if target_override.target is not null then target:=target_override.target;target_source:=jsonb_build_object('kind','individual','revision',target_override.revision,'target',target);end if;
 select * into support from private.learning_result_support s where s.user_id=p_expected_user_id and s.context_key=source->>'contextKey' and s.activity_type=task.activity_type;
 start_context:=jsonb_build_object('passEventId',support.pass_event_id,'supportRevision',coalesce(support.revision,0));
 select * into writing_head from private.learning_result_writing_heads h where h.user_id=p_expected_user_id and h.context_key=source->>'contextKey' and h.content_version=task.canonical_digest;
 select * into writing from private.learning_result_writing_revisions where id=writing_head.writing_revision_id;
 if source->>'assignmentId' is not null then select r.revision,r.answers into legacy_revision,legacy_answers from public.class_assignment_responses r where r.assignment_id=(source->>'assignmentId')::uuid and r.student_id=p_expected_user_id;
 else select r.answers into legacy_answers from public.student_spark_responses r where r.spark_id=source->>'sparkId' and r.user_id=p_expected_user_id;end if;
 if writing.id is null then for question in select jsonb_array_elements(coalesce(task.task->'writingQuestions','[]')) loop
  if jsonb_typeof(legacy_answers->(question->>'id'))='string' then prior_writing:=prior_writing||jsonb_build_object(question->>'id',legacy_answers->(question->>'id'));end if;
 end loop;end if;
 writing_snapshot:=jsonb_build_object('writingRevisionId',writing.id,'responses',coalesce(writing.responses,prior_writing),'legacyRevision',coalesce(legacy_revision,0));
 content:=jsonb_build_object('task',task.task,'source',source->'content','contextKey',source->>'contextKey','target',target,'targetSource',target_source,'startContext',start_context,'writing',writing_snapshot);
 manifest:=private.learning_sha256_v1(convert_to(private.learning_json_canonical_v1(content::json),'UTF8'));
 insert into private.learning_result_preparations(user_id,task_id,assignment_id,context_key,unit_key,vocabulary_id,spark_id,target,target_source,manifest_hash,start_context,package)
 values(p_expected_user_id,task.id,(source->>'assignmentId')::uuid,source->>'contextKey',source->>'contextKey',source->>'vocabularyId',source->>'sparkId',target,target_source,manifest,start_context,content) returning * into prepared;
 response:=jsonb_build_object('status','prepared','preparationId',prepared.id,'ownerUserId',p_expected_user_id,'task',task.task,'content',content,'manifestHash',manifest,'passingTarget',target,'startContext',start_context,'writing',writing_snapshot);
 insert into private.learning_result_receipts(user_id,operation_id,kind,request_hash,accepted_revision,response) values(p_expected_user_id,p_operation_id,'prepare',request->>'requestHash',0,response);
 return response;
end $f$;

create function private.learning_target_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb
language plpgsql security definer set search_path='' as $f$
<<target_scope>>
declare request jsonb:=private.learning_request_v1(p_expected_user_id,p_operation_id,p_payload,'target');p jsonb:=request->'payload';receipt jsonb;
 source jsonb;target_row private.learning_result_target_overrides;student_id uuid;response jsonb;proposed integer;
begin
 perform private.learning_keys_v1(p,array['contractVersion','source','grade','studentId','activity','expectedRevision','target']);
 perform pg_advisory_xact_lock(hashtextextended(p_expected_user_id::text||':'||p_operation_id::text,0));
 receipt:=private.learning_receipt_v1(p_expected_user_id,p_operation_id,'target',request->>'requestHash');if receipt is not null then return receipt;end if;
 source:=private.learning_source_v1(p->'source',(p->>'grade')::integer,true);student_id:=(p->>'studentId')::uuid;
 if student_id is null or not private.has_school_role((source->>'schoolId')::uuid,'student',student_id)
 or not exists(select 1 from public.class_memberships cm join public.teaching_classes c on c.id=cm.class_id and not c.archived
  join public.school_memberships sm on sm.school_id=c.school_id and sm.user_id=cm.student_id and sm.active
  where cm.student_id=target_scope.student_id and cm.active and private.owns_teaching_class(c.id) and c.school_id=(source->>'schoolId')::uuid
  and sm.grade=p->>'grade' and (source->>'assignmentId' is null or c.id=(select a.class_id from public.class_assignments a where a.id=(source->>'assignmentId')::uuid)))
 then raise exception 'STUDENT_UNAVAILABLE' using errcode='42501';end if;
 if p->>'activity' is null or p->>'activity' not in ('flashcards','matching','scramble','wordle','hangman','fill-in-blank','crossword','word-search','quiz','synonym-antonym','speed-match','reading-check') then raise exception 'INVALID_ACTIVITY';end if;
 if p->'target' is distinct from 'null'::jsonb then
  if jsonb_typeof(p->'target') is distinct from 'number' or coalesce(p->>'target','') !~ '^[0-9]+$' or (p->>'target')::numeric not between 1 and 100 then raise exception 'INVALID_TARGET';end if;
  proposed:=(p->>'target')::integer;
 end if;
 if jsonb_typeof(p->'expectedRevision') is distinct from 'number' or coalesce(p->>'expectedRevision','') !~ '^[0-9]+$' then raise exception 'INVALID_REVISION';end if;
 perform pg_advisory_xact_lock(hashtextextended(student_id::text||':'||(source->>'contextKey')||':'||(p->>'activity'),0));
 select * into target_row from private.learning_result_target_overrides o where o.user_id=student_id and o.context_key=source->>'contextKey' and o.activity_type=p->>'activity' for update;
 if coalesce(target_row.revision,0)<>(p->>'expectedRevision')::bigint then raise exception 'TARGET_CONFLICT' using detail=jsonb_build_object('revision',target_row.revision,'target',target_row.target)::text;end if;
 insert into private.learning_result_target_overrides(user_id,assignment_id,context_key,activity_type,target,actor_id,revision)
 values(student_id,(source->>'assignmentId')::uuid,source->>'contextKey',p->>'activity',proposed,p_expected_user_id,1)
 on conflict(user_id,context_key,activity_type) do update set target=excluded.target,actor_id=excluded.actor_id,revision=private.learning_result_target_overrides.revision+1 returning * into target_row;
 response:=jsonb_build_object('status','saved','revision',target_row.revision,'target',coalesce(proposed,80),'individualTarget',proposed);
 insert into private.learning_result_receipts(user_id,operation_id,kind,request_hash,accepted_revision,response) values(p_expected_user_id,p_operation_id,'target',request->>'requestHash',target_row.revision,response);
 return response;
end $f$;

create function private.learning_writing_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare request jsonb:=private.learning_request_v1(p_expected_user_id,p_operation_id,p_payload,'writing');p jsonb:=request->'payload';receipt jsonb;
 prepared private.learning_result_preparations;task private.learning_result_tasks;head private.learning_result_writing_heads;writing private.learning_result_writing_revisions;
 question jsonb;responses jsonb:='{}'::jsonb;answer text;response_text text:='';legacy public.class_assignment_responses;response jsonb;expected uuid;
begin
 perform private.learning_keys_v1(p,array['contractVersion','preparationId','writingRevisionId','expectedWritingRevisionId','expectedLegacyRevision','responses']);
 perform pg_advisory_xact_lock(hashtextextended(p_expected_user_id::text||':'||p_operation_id::text,0));
 receipt:=private.learning_receipt_v1(p_expected_user_id,p_operation_id,'writing',request->>'requestHash');if receipt is not null then return receipt;end if;
 select * into prepared from private.learning_result_preparations where id=(p->>'preparationId')::uuid and user_id=p_expected_user_id;
 if prepared.id is null then raise exception 'PREPARATION_REQUIRED' using errcode='42501';end if;
 select * into task from private.learning_result_tasks where id=prepared.task_id;
 if task.activity_type<>'reading-check' or not private.has_school_role(task.school_id,'student')
 or (prepared.assignment_id is not null and not private.can_read_student_assignment(prepared.assignment_id,p_expected_user_id)) then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
 if jsonb_typeof(p->'responses') is distinct from 'object' or octet_length(private.learning_json_canonical_v1((p->'responses')::json))>10000 then raise exception 'INVALID_WRITING';end if;
 for question in select jsonb_array_elements(coalesce(task.task->'writingQuestions','[]')) loop
  if jsonb_typeof(p->'responses'->(question->>'id')) is distinct from 'string' then raise exception 'WRITING_INCOMPLETE';end if;
  answer:=trim(p->'responses'->>(question->>'id'));
  if length(answer) not between 12 and 3000 then raise exception 'WRITING_INCOMPLETE';end if;
  responses:=responses||jsonb_build_object(question->>'id',answer);
  response_text:=response_text||case when response_text='' then '' else E'\n\n' end||answer;
 end loop;
 if (select count(*) from jsonb_object_keys(responses))<>(select count(*) from jsonb_object_keys(p->'responses')) then raise exception 'INVALID_WRITING';end if;
 -- The same context lock also serializes existing classroom response writes.
 perform pg_advisory_xact_lock(hashtextextended(coalesce(prepared.assignment_id::text,prepared.context_key)||p_expected_user_id::text,0));
 select * into head from private.learning_result_writing_heads h where h.user_id=p_expected_user_id and h.context_key=prepared.context_key and h.content_version=task.canonical_digest for update;
 expected:=(p->>'expectedWritingRevisionId')::uuid;
 if head.writing_revision_id is distinct from expected then raise exception 'WRITING_CONFLICT' using detail=jsonb_build_object('writingRevisionId',head.writing_revision_id)::text;end if;
 if prepared.assignment_id is not null then
  select * into legacy from public.class_assignment_responses where assignment_id=prepared.assignment_id and student_id=p_expected_user_id for update;
  if jsonb_typeof(p->'expectedLegacyRevision') is distinct from 'number' or coalesce(legacy.revision,0) is distinct from (p->>'expectedLegacyRevision')::integer then raise exception 'WRITING_CONFLICT';end if;
 end if;
 if exists(select 1 from private.learning_result_writing_revisions where id=(p->>'writingRevisionId')::uuid) then raise exception 'WRITING_CONFLICT';end if;
 insert into private.learning_result_writing_revisions(id,user_id,assignment_id,context_key,spark_id,content_version,predecessor_id,responses)
 values((p->>'writingRevisionId')::uuid,p_expected_user_id,prepared.assignment_id,prepared.context_key,prepared.spark_id,task.canonical_digest,expected,responses) returning * into writing;
 -- A writing save cannot mark a check passed or invent an automatic score.
 if prepared.assignment_id is not null then
  insert into public.class_assignment_responses(assignment_id,student_id,response,answers,evaluation)
  values(prepared.assignment_id,p_expected_user_id,coalesce(nullif(response_text,''),'Reading answers pending'),responses,null)
  on conflict(assignment_id,student_id) do update set response=excluded.response,revision=class_assignment_responses.revision+1,submitted_at=now()
  returning * into legacy;
  update public.class_assignment_responses set answers=coalesce(answers,'{}')||responses,evaluation=null where assignment_id=prepared.assignment_id and student_id=p_expected_user_id;
 else
  insert into public.student_spark_responses(user_id,spark_id,answers,question_snapshot) values(p_expected_user_id,prepared.spark_id,responses,coalesce(prepared.package->'source'->'questions','[]'))
  on conflict(user_id,spark_id) do update set answers=student_spark_responses.answers||excluded.answers,evaluation='{}';
 end if;
 insert into private.learning_result_writing_heads(user_id,context_key,content_version,writing_revision_id,legacy_revision)
 values(p_expected_user_id,prepared.context_key,task.canonical_digest,writing.id,legacy.revision)
 on conflict(user_id,context_key,content_version) do update set writing_revision_id=excluded.writing_revision_id,legacy_revision=excluded.legacy_revision;
 response:=jsonb_build_object('status','saved','writingRevisionId',writing.id,'responses',writing.responses,'legacyRevision',legacy.revision);
 insert into private.learning_result_receipts(user_id,operation_id,kind,request_hash,accepted_revision,response) values(p_expected_user_id,p_operation_id,'writing',request->>'requestHash',coalesce(legacy.revision,0),response);
 return response;
end $f$;

create function private.learning_read_v1(p_expected_user_id uuid,p_payload text,p_teacher_class uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $f$
declare p jsonb;attempt private.learning_result_attempts;task private.learning_result_tasks;result private.learning_result_results;support private.learning_result_support;
 response jsonb;events jsonb:='[]'::jsonb;candidate jsonb;row record;after_sequence integer;has_more boolean:=false;last_sequence integer;
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise exception 'OWNER_CHANGED' using errcode='42501';end if;
 if p_payload is null or octet_length(p_payload)>16384 then raise exception 'INVALID_REQUEST';end if;p:=p_payload::jsonb;
 perform private.learning_keys_v1(p,array['attemptId'],array['afterSequence','expectedRevision']);
 select * into attempt from private.learning_result_attempts a where a.id=(p->>'attemptId')::uuid and (p_teacher_class is not null or a.user_id=p_expected_user_id);
 if attempt.id is null then raise exception 'ATTEMPT_UNAVAILABLE' using errcode='42501';end if;
 select * into task from private.learning_result_tasks where id=attempt.task_id;
 if p_teacher_class is not null then
  if not private.owns_teaching_class(p_teacher_class) or not exists(select 1 from public.teaching_classes c join public.class_memberships cm on cm.class_id=c.id and cm.active where c.id=p_teacher_class and c.school_id=task.school_id and cm.student_id=attempt.user_id)
  or (attempt.assignment_id is not null and not exists(select 1 from public.class_assignments ca where ca.id=attempt.assignment_id and ca.class_id=p_teacher_class)) then raise exception 'ATTEMPT_UNAVAILABLE' using errcode='42501';end if;
 else
  if not private.has_school_role(task.school_id,'student') or (attempt.assignment_id is not null and not private.can_read_student_assignment(attempt.assignment_id,p_expected_user_id)) then raise exception 'ATTEMPT_UNAVAILABLE' using errcode='42501';end if;
 end if;
 if p->>'expectedRevision' is not null and (p->>'expectedRevision')::bigint<>attempt.accepted_revision then return jsonb_build_object('status','refresh_required');end if;
 select * into result from private.learning_result_results where attempt_id=attempt.id;
 select * into support from private.learning_result_support s where s.user_id=attempt.user_id and s.context_key=attempt.context_key and s.activity_type=attempt.activity_type;
 response:=private.learning_head_v1(attempt)||jsonb_build_object('status','ok','attemptId',attempt.id,'taskId',task.id,'state',attempt.state,
 'result',case when result.attempt_id is not null then to_jsonb(result)||jsonb_build_object('weighted_numerator',result.weighted_numerator::text,'weighted_denominator',result.weighted_denominator::text,'speed_numerator',result.speed_numerator::text,'speed_denominator',result.speed_denominator::text) else null end,
 'confirmedResult',(select r.response->'result' from private.learning_result_receipts r where r.user_id=attempt.user_id and r.kind='submit' and r.response->'result'->>'attemptId'=attempt.id::text order by r.committed_at,r.operation_id limit 1),'support',case when support.user_id is not null then jsonb_build_object('help',support.help,'failureCount',jsonb_array_length(support.failures),'passEventId',support.pass_event_id,'earnedCompletion',support.earned_completion,'revision',support.revision) else null end);
 if p_teacher_class is not null and not (p ? 'afterSequence') then response:=response||jsonb_build_object('task',task.task);end if;
 if p ? 'afterSequence' then
  if jsonb_typeof(p->'afterSequence') is distinct from 'number' or coalesce(p->>'afterSequence','') !~ '^[0-9]+$' then raise exception 'INVALID_CURSOR';end if;
  after_sequence:=(p->>'afterSequence')::integer;if after_sequence>attempt.accepted_sequence then raise exception 'INVALID_CURSOR';end if;last_sequence:=after_sequence;
  for row in select e.sequence,e.event from private.learning_result_evidence e where e.attempt_id=attempt.id and e.sequence>after_sequence order by e.sequence limit 1001 loop
   candidate:=response||jsonb_build_object('events',events||jsonb_build_array(row.event),'nextAfterSequence',row.sequence,'hasMore',true);
   if jsonb_array_length(events)>=1000 or octet_length(convert_to(private.learning_json_canonical_v1(candidate::json),'UTF8'))>196608 then has_more:=true;exit;end if;
   events:=events||jsonb_build_array(row.event);last_sequence:=row.sequence;
  end loop;
  response:=response||jsonb_build_object('events',events,'nextAfterSequence',last_sequence,'hasMore',has_more);
 end if;
 return response;
end $f$;

create function private.learning_authoring_v1(p_expected_user_id uuid,p_payload text) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare p jsonb;source jsonb;setting private.learning_results_settings;sections jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise exception 'OWNER_CHANGED' using errcode='42501';end if;
 if p_payload is null or octet_length(p_payload)>16384 then raise exception 'INVALID_REQUEST';end if;p:=p_payload::jsonb;
 perform private.learning_keys_v1(p,array['source','grade','activity']);
 source:=private.learning_source_v1(p->'source',(p->>'grade')::integer,true);
 select * into setting from private.learning_results_settings s where s.school_id=(source->>'schoolId')::uuid and s.grade=(p->>'grade')::integer and s.content_set_id=source->>'contentSetId' and s.activity_type=p->>'activity';
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id),'[]') into sections
 from public.teaching_classes c where c.school_id=(source->>'schoolId')::uuid and not c.archived and private.owns_teaching_class(c.id)
 and exists(select 1 from public.class_memberships cm join public.school_memberships sm on sm.school_id=c.school_id and sm.user_id=cm.student_id and sm.active where cm.class_id=c.id and cm.active and sm.grade=p->>'grade')
 and (source->>'assignmentId' is null or exists(select 1 from public.class_assignments a where a.class_id=c.id and 'version:'||a.version_id::text=source->>'contentSetId'));
 return jsonb_build_object('status','ok','source',source,'scoredContent',private.learning_words_v1(source,p->>'activity'),'settings',case when setting.id is not null then to_jsonb(setting) else null end,'task',(select t.task from private.learning_result_tasks t where t.id=setting.published_task_id),'affectedSections',sections,
 'students',coalesce((select jsonb_agg(jsonb_build_object('studentId',m.user_id,'name',coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),'Student'),'target',o.target,'revision',coalesce(o.revision,0)) order by coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),'Student'),m.user_id)
 from public.school_memberships m join public.profiles p on p.user_id=m.user_id
 left join private.learning_result_target_overrides o on o.user_id=m.user_id and o.context_key=source->>'contextKey' and o.activity_type=p_payload::jsonb->>'activity'
 where m.school_id=(source->>'schoolId')::uuid and m.active and m.grade=p_payload::jsonb->>'grade'
 and exists(select 1 from public.class_memberships cm join public.teaching_classes c on c.id=cm.class_id and not c.archived where cm.student_id=m.user_id and cm.active and c.school_id=m.school_id and private.owns_teaching_class(c.id) and (source->>'assignmentId' is null or c.id=(select a.class_id from public.class_assignments a where a.id=(source->>'assignmentId')::uuid)))),'[]'),
 'timing', (select jsonb_build_object('finishedAttempts',count(*),'medianMilliseconds',round(percentile_cont(0.5) within group(order by r.recorded_milliseconds))::bigint)
 from private.learning_result_results r join private.learning_result_attempts a on a.id=r.attempt_id
 where a.task_id=setting.published_task_id and a.kind='ranked_full' and r.validation_status='validated' and r.full_task_finished_at is not null));
end $f$;

create function private.learning_teacher_read_v1(p_expected_user_id uuid,p_payload text) returns jsonb
language plpgsql security definer set search_path='' as $f$
<<teacher_scope>>
declare p jsonb;class_id uuid;school_id uuid;response jsonb;after_id uuid;limit_rows integer;
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise exception 'OWNER_CHANGED' using errcode='42501';end if;
 if p_payload is null or octet_length(p_payload)>16384 then raise exception 'INVALID_REQUEST';end if;p:=p_payload::jsonb;
 if p->>'mode'='grades' then
  perform private.learning_keys_v1(p,array['mode','source']);
  if p->'source'->>'kind' is distinct from 'assignment' then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
  select a.class_id into class_id from public.class_assignments a where a.id=(p->'source'->>'id')::uuid;
  if class_id is null or not private.owns_teaching_class(class_id) then raise exception 'CLASS_UNAVAILABLE' using errcode='42501';end if;
  return jsonb_build_object('status','ok','grades',coalesce((select jsonb_agg(grade order by grade) from
   (select distinct sm.grade::integer grade from public.class_memberships cm join public.teaching_classes c on c.id=cm.class_id
    join public.school_memberships sm on sm.school_id=c.school_id and sm.user_id=cm.student_id and sm.active
    where cm.class_id=teacher_scope.class_id and cm.active and sm.grade~'^[0-9]{1,2}$' and sm.grade::integer between 1 and 12) g),'[]'));
 end if;
 if p->>'mode'='authoring' then return private.learning_authoring_v1(p_expected_user_id,(p-'mode')::text);end if;
 if p->>'mode'='evidence' then
  perform private.learning_keys_v1(p,array['mode','classId','attemptId'],array['afterSequence','expectedRevision']);
  return private.learning_read_v1(p_expected_user_id,(p-'mode'-'classId')::text,(p->>'classId')::uuid);
 end if;
 perform private.learning_keys_v1(p,array['mode','classId'],array['studentId','assignmentId','afterId','limit']);
 if p->>'mode' is distinct from 'results' then raise exception 'INVALID_MODE';end if;
 class_id:=(p->>'classId')::uuid;
 select c.school_id into school_id from public.teaching_classes c where c.id=class_id;
 if school_id is null or not private.owns_teaching_class(class_id) then raise exception 'CLASS_UNAVAILABLE' using errcode='42501';end if;
 if p->>'studentId' is not null and not exists(select 1 from public.class_memberships cm where cm.class_id=teacher_scope.class_id and cm.student_id=(p->>'studentId')::uuid and cm.active) then raise exception 'STUDENT_UNAVAILABLE' using errcode='42501';end if;
 if p->>'assignmentId' is not null and not exists(select 1 from public.class_assignments a where a.class_id=teacher_scope.class_id and a.id=(p->>'assignmentId')::uuid) then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';end if;
 limit_rows:=coalesce((p->>'limit')::integer,50);if limit_rows not between 1 and 100 then raise exception 'INVALID_LIMIT';end if;after_id:=(p->>'afterId')::uuid;
 with page as materialized(select a.id,a.user_id,a.task_id,a.context_key,a.assignment_id,a.activity_type,a.target,a.created_at,a.accepted_revision,a.recorded_milliseconds,r.points,r.stars,r.weighted_numerator::text,r.weighted_denominator::text,r.longest_combo,r.passed,r.full_task_finished_at,r.validation_status,s.help,jsonb_array_length(s.failures) failure_count,s.pass_event_id,s.earned_completion,
 row_number() over(order by a.id) ordinal
 from private.learning_result_attempts a join private.learning_result_tasks t on t.id=a.task_id
 left join private.learning_result_results r on r.attempt_id=a.id
 left join private.learning_result_support s on s.user_id=a.user_id and s.context_key=a.context_key and s.activity_type=a.activity_type
 where t.school_id=teacher_scope.school_id and (after_id is null or a.id>after_id)
 and exists(select 1 from public.class_memberships cm where cm.class_id=teacher_scope.class_id and cm.student_id=a.user_id and cm.active)
 and (a.assignment_id is null or exists(select 1 from public.class_assignments ca where ca.id=a.assignment_id and ca.class_id=teacher_scope.class_id))
 and (p->>'studentId' is null or a.user_id=(p->>'studentId')::uuid) and (p->>'assignmentId' is null or a.assignment_id=(p->>'assignmentId')::uuid)
 order by a.id limit limit_rows+1)
 select jsonb_build_object('status','ok','results',coalesce((select jsonb_agg(to_jsonb(page)-'ordinal' order by id) from page where ordinal<=limit_rows),'[]'),
 'nextAfterId',case when exists(select 1 from page where ordinal>limit_rows) then (select id from page where ordinal=limit_rows) else null end) into response;
 return response;
end $f$;

-- Retain legacy coverage-as-completion while explicit results require the saved pass flag.
-- These are the installed readers, including replacement-credit and gradebook projections.
do $completion_readers$
declare routine record;definition text;modified text;patched integer:=0;required_patched integer:=0;
begin
 for routine in select p.oid,p.proname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname in ('vocabulary_assignment_grade_v1','teacher_class_progress_v1','assignment_replacement_credits','teacher_class_progress_v2','teacher_roster_progress_summary_v1') loop
  definition:=pg_get_functiondef(routine.oid);
  modified:=regexp_replace(definition,'p\.is_complete or p\.score\s*>=\s*100',
   $replace$p.is_complete or (p.completion_semantics='legacy' and p.score>=100)$replace$,'g');
  if modified=definition then
   -- The current deployed v1 API delegates to v2; its body has no completion predicate.
   if routine.proname='teacher_class_progress_v1' and definition ~ 'select private[.]teacher_class_progress_v2[(]' and definition !~ 'p[.](is_complete|score)' then continue;end if;
   raise exception 'Completion reader requires explicit migration review: %',routine.oid::regprocedure;
  end if;
  execute modified;patched:=patched+1;
  if routine.proname in ('vocabulary_assignment_grade_v1','assignment_replacement_credits','teacher_class_progress_v2') then required_patched:=required_patched+1;end if;
 end loop;
 if required_patched<>3 or patched not between 3 and 5 then raise exception 'Completion reader coverage requires review: % required, % total',required_patched,patched;end if;
end $completion_readers$;

create function private.learning_board_owned_v1(p_expected_user_id uuid,p_payload text) returns jsonb
language plpgsql stable security definer set search_path='' as $f$
declare p jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise exception 'OWNER_CHANGED' using errcode='42501';end if;
 if p_payload is null or octet_length(p_payload)>16384 then raise exception 'INVALID_REQUEST';end if;p:=p_payload::jsonb;
 perform private.learning_keys_v1(p,array['taskId'],array['cursor','boardRevision','orderingDigest']);
 if p->'cursor' is not null and p->'cursor'<>'null'::jsonb then perform private.learning_keys_v1(p->'cursor',array['points','recordedMilliseconds','sortName','userId']);end if;
 return private.learning_board_v1(p_expected_user_id,p_payload);
end $f$;



-- Device replacement discovers only the signed-in student's current accessible work.
create function private.learning_history_v1(p_expected_user_id uuid,p_payload text) returns jsonb
language plpgsql stable security definer set search_path='' as $f$
declare p jsonb;items jsonb;page_size integer;after_id uuid;after_created timestamptz;
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise exception 'OWNER_CHANGED' using errcode='42501';end if;
 if p_payload is null or octet_length(p_payload)>16384 then raise exception 'INVALID_REQUEST';end if;p:=p_payload::jsonb;
 perform private.learning_keys_v1(p,array['mode','contextKey','activity'],array['afterId','limit']);
 if p->>'mode' is distinct from 'history' or coalesce(length(p->>'contextKey'),0) not between 1 and 512 or p->>'activity' is null or p->>'activity' not in ('flashcards','matching','scramble','wordle','hangman','fill-in-blank','crossword','word-search','quiz','synonym-antonym','speed-match','reading-check') then raise exception 'INVALID_REQUEST';end if;
 page_size:=coalesce((p->>'limit')::integer,20);if page_size not between 1 and 100 then raise exception 'INVALID_LIMIT';end if;after_id:=(p->>'afterId')::uuid;
 if after_id is not null then select a.created_at into after_created from private.learning_result_attempts a where a.id=after_id and a.user_id=p_expected_user_id and a.context_key=p->>'contextKey' and a.activity_type=p->>'activity';if after_created is null then raise exception 'INVALID_CURSOR';end if;end if;
 with page as materialized (
 select a.id,a.task_id,a.created_at,a.accepted_revision,r.points,r.passed,r.full_task_finished_at,r.validation_status,
 row_number() over(order by a.created_at desc,a.id desc) ordinal
 from private.learning_result_attempts a join private.learning_result_tasks t on t.id=a.task_id
 left join private.learning_result_results r on r.attempt_id=a.id
 where a.user_id=p_expected_user_id and a.context_key=p->>'contextKey' and a.activity_type=p->>'activity'
 and (after_id is null or (a.created_at,a.id)<(after_created,after_id))
 and private.has_school_role(t.school_id,'student',p_expected_user_id)
 and exists(select 1 from public.school_memberships m where m.school_id=t.school_id and m.user_id=p_expected_user_id and m.active)
 and (a.assignment_id is null or private.can_read_student_assignment(a.assignment_id,p_expected_user_id))
 order by a.created_at desc,a.id desc limit page_size+1)
 select jsonb_build_object('status','ok','attempts',coalesce(jsonb_agg(jsonb_build_object('attemptId',id,'taskId',task_id,'createdAt',created_at,'revision',accepted_revision,'points',points,'passed',passed,'finishedAt',full_task_finished_at,'validationStatus',validation_status) order by created_at desc,id desc) filter(where ordinal<=page_size),'[]'),
 'nextAfterId',case when count(*)>page_size then (array_agg(id order by created_at desc,id desc))[page_size] else null end) into items from page;
 return items;
end $f$;

create function private.learning_student_read_v1(p_expected_user_id uuid,p_payload text) returns jsonb
language plpgsql stable security definer set search_path='' as $f$
begin
 if p_payload is null or octet_length(p_payload)>16384 then raise exception 'INVALID_REQUEST';end if;
 if p_payload::jsonb->>'mode'='history' then return private.learning_history_v1(p_expected_user_id,p_payload);end if;
 if p_payload::jsonb->>'mode'='recovery' then
  perform private.learning_keys_v1(p_payload::jsonb,array['mode','attemptId']);
  -- The normal reader performs owner and current-context checks before exposing a saved package.
  return private.learning_read_v1(p_expected_user_id,(p_payload::jsonb-'mode')::text)||(
   select jsonb_build_object('recovery',jsonb_build_object('seed',a.seed,'kind',a.kind,'variantId',a.variant_id,'predecessorAttemptId',a.predecessor_id,
    'preparationId',p.id,'grade',t.grade,'source',case when p.assignment_id is not null then jsonb_build_object('kind','assignment','id',p.assignment_id) else jsonb_build_object('kind','spark','id',p.spark_id) end,'passingTarget',p.target,'startContext',p.start_context,'content',p.package,'manifestHash',p.manifest_hash,
    'task',t.task,'ownerUserId',a.user_id,'writing',coalesce((select jsonb_build_object('writingRevisionId',w.id,'responses',w.responses,'legacyRevision',coalesce(h.legacy_revision,0))
      from private.learning_result_writing_heads h join private.learning_result_writing_revisions w on w.id=h.writing_revision_id where h.user_id=a.user_id and h.context_key=a.context_key and h.content_version=t.canonical_digest),p.package->'writing')))
   from private.learning_result_attempts a join private.learning_result_tasks t on t.id=a.task_id join private.learning_result_preparations p on p.id=a.preparation_id
   where a.id=(p_payload::jsonb->>'attemptId')::uuid and a.user_id=p_expected_user_id);
 end if;
 return private.learning_read_v1(p_expected_user_id,p_payload);
end $f$;

revoke all on function private.learning_history_v1(uuid,text), private.learning_student_read_v1(uuid,text) from public, anon, authenticated;

-- Only these owner-asserting entry points are exposed through PostgREST.
create function public.prepare_student_learning_task_owned_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb language sql security definer set search_path='' as $f$ select private.learning_prepare_v1(p_expected_user_id,p_operation_id,p_payload); $f$;
revoke all on function public.prepare_student_learning_task_owned_v1(uuid,uuid,text) from public, anon;
grant execute on function public.prepare_student_learning_task_owned_v1(uuid,uuid,text) to authenticated;
create function public.claim_student_learning_attempt_owned_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb language sql security definer set search_path='' set statement_timeout='30s' as $f$ select private.learning_claim_v1(p_expected_user_id,p_operation_id,p_payload); $f$;
revoke all on function public.claim_student_learning_attempt_owned_v1(uuid,uuid,text) from public, anon;
grant execute on function public.claim_student_learning_attempt_owned_v1(uuid,uuid,text) to authenticated;
-- Bounded offline uploads can replay 4,000 opportunities under concurrent load.
-- PostgREST hoists this function-only limit; other RPC timeouts remain unchanged.
create function public.save_student_learning_checkpoint_owned_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb language sql security definer set search_path='' set statement_timeout='30s' as $f$ select private.learning_checkpoint_v1(p_expected_user_id,p_operation_id,p_payload); $f$;
revoke all on function public.save_student_learning_checkpoint_owned_v1(uuid,uuid,text) from public, anon;
grant execute on function public.save_student_learning_checkpoint_owned_v1(uuid,uuid,text) to authenticated;
create function public.submit_student_learning_result_owned_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb language sql security definer set search_path='' as $f$ select private.learning_submit_v1(p_expected_user_id,p_operation_id,p_payload); $f$;
revoke all on function public.submit_student_learning_result_owned_v1(uuid,uuid,text) from public, anon;
grant execute on function public.submit_student_learning_result_owned_v1(uuid,uuid,text) to authenticated;
create function public.save_student_learning_writing_owned_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb language sql security definer set search_path='' as $f$ select private.learning_writing_v1(p_expected_user_id,p_operation_id,p_payload); $f$;
revoke all on function public.save_student_learning_writing_owned_v1(uuid,uuid,text) from public, anon;
grant execute on function public.save_student_learning_writing_owned_v1(uuid,uuid,text) to authenticated;
create function public.save_teacher_learning_settings_owned_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb language sql security definer set search_path='' as $f$ select private.learning_publish_v1(p_expected_user_id,p_operation_id,p_payload); $f$;
revoke all on function public.save_teacher_learning_settings_owned_v1(uuid,uuid,text) from public, anon;
grant execute on function public.save_teacher_learning_settings_owned_v1(uuid,uuid,text) to authenticated;
create function public.save_teacher_learning_target_owned_v1(p_expected_user_id uuid,p_operation_id uuid,p_payload text) returns jsonb language sql security definer set search_path='' as $f$ select private.learning_target_v1(p_expected_user_id,p_operation_id,p_payload); $f$;
revoke all on function public.save_teacher_learning_target_owned_v1(uuid,uuid,text) from public, anon;
grant execute on function public.save_teacher_learning_target_owned_v1(uuid,uuid,text) to authenticated;
create function public.get_student_learning_result_owned_v1(p_expected_user_id uuid,p_payload text) returns jsonb language sql security definer set search_path='' as $f$ select private.learning_student_read_v1(p_expected_user_id,p_payload); $f$;
revoke all on function public.get_student_learning_result_owned_v1(uuid,text) from public, anon;
grant execute on function public.get_student_learning_result_owned_v1(uuid,text) to authenticated;
create function public.get_teacher_learning_results_owned_v1(p_expected_user_id uuid,p_payload text) returns jsonb language sql security definer set search_path='' as $f$ select private.learning_teacher_read_v1(p_expected_user_id,p_payload); $f$;
revoke all on function public.get_teacher_learning_results_owned_v1(uuid,text) from public, anon;
grant execute on function public.get_teacher_learning_results_owned_v1(uuid,text) to authenticated;
create function public.get_learning_leaderboard_owned_v1(p_expected_user_id uuid,p_payload text) returns jsonb language sql security definer set search_path='' as $f$ select private.learning_board_owned_v1(p_expected_user_id,p_payload); $f$;
revoke all on function public.get_learning_leaderboard_owned_v1(uuid,text) from public, anon;
grant execute on function public.get_learning_leaderboard_owned_v1(uuid,text) to authenticated;

-- No authenticated execution grants on pure/trusted helpers, including definer guard.
do $grants$ declare routine record;begin
 for routine in select p.oid from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and (p.proname like 'learning_%_v1' or p.proname in ('assert_legacy_activity_attempt_v1','apply_learning_progress_rewards_v1','apply_student_activity_reward_delta_v1')) loop
 execute format('revoke all on function %s from public,anon,authenticated',routine.oid::regprocedure);
 end loop;
end $grants$;
commit;
