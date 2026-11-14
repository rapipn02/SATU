-- =====================================================================
-- Isi peta petualangan: Vokal -> Konsonan -> Suku kata -> Kata.
-- CONTOH: ganti kata-katanya dengan daftar Lampiran 4 buku guru
-- (Aini & Handriani 2024) sebelum demo. Kolom "image" diisi URL gambar.
-- =====================================================================

insert into public.levels (id, category, order_no, title, items, unlock_after_level_id) values
  ('vokal-1',     'vokal',     1,  'Vokal A dan I',      '[{"text":"a","image":null},{"text":"i","image":null}]', null),
  ('vokal-2',     'vokal',     2,  'Vokal U dan O',      '[{"text":"u","image":null},{"text":"o","image":null}]', 'vokal-1'),
  ('vokal-3',     'vokal',     3,  'Vokal É dan Ê',      '[{"text":"é","image":null},{"text":"ê","image":null}]', 'vokal-2'),
  ('konsonan-1',  'konsonan',  4,  'Konsonan M dan B',   '[{"text":"m","image":null},{"text":"b","image":null}]', 'vokal-3'),
  ('konsonan-2',  'konsonan',  5,  'Konsonan P dan W',   '[{"text":"p","image":null},{"text":"w","image":null}]', 'konsonan-1'),
  ('suku-kata-1', 'suku_kata', 6,  'Suku kata MA BA PA', '[{"text":"ma","image":null},{"text":"ba","image":null},{"text":"pa","image":null}]', 'konsonan-2'),
  ('suku-kata-2', 'suku_kata', 7,  'Suku kata MI BI PI', '[{"text":"mi","image":null},{"text":"bi","image":null},{"text":"pi","image":null}]', 'suku-kata-1'),
  ('suku-kata-3', 'suku_kata', 8,  'Suku kata MU BU PU', '[{"text":"mu","image":null},{"text":"bu","image":null},{"text":"pu","image":null}]', 'suku-kata-2'),
  ('kata-1',      'kata',      9,  'Kata: keluarga',     '[{"text":"mama","image":null},{"text":"papa","image":null},{"text":"ibu","image":null}]', 'suku-kata-3'),
  ('kata-2',      'kata',      10, 'Kata: benda',        '[{"text":"bola","image":null},{"text":"buku","image":null},{"text":"bambu","image":null}]', 'kata-1'),
  ('kata-3',      'kata',      11, 'Kata: tubuh',        '[{"text":"pipi","image":null},{"text":"bibir","image":null},{"text":"mata","image":null}]', 'kata-2');
