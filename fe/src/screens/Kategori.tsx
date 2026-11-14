import type { LevelItem, LevelView } from '../api'

/**
 * Isi tiap halaman (setelah mengetuk satu node di peta): 5 latihan bernomor 1-5.
 * `id` = id latihan di kurikulum ML. Yang belum ada di kurikulum tampil redup dan tidak bisa diketuk,
 * dan otomatis aktif begitu id-nya ditambahkan ke kurikulum.
 */
export const HALAMAN: Record<string, { label: string; id: string }[]> = {
  vokal: [
    { label: 'a', id: 't1-a' }, { label: 'i', id: 't1-i' }, { label: 'u', id: 't1-u' },
    { label: 'e', id: 't1-e' }, { label: 'o', id: 't1-o' },
  ],
  konsonan: [
    { label: 'f', id: 't1-F' }, { label: 'h', id: 't1-H' }, { label: 'm', id: 't1-M' },
    { label: 'w', id: 't1-w' }, { label: 'y', id: 't1-y' },
  ],
  suku_kata: [
    { label: 'fa', id: 't3-fa' }, { label: 'ha', id: 't3-ha' }, { label: 'ma', id: 't3-ma' },
    { label: 'wa', id: 't3-wa' }, { label: 'ya', id: 't3-ya' },
  ],
  kata: [
    { label: 'fafa', id: 't4-fafa' }, { label: 'haha', id: 't4-haha' }, { label: 'mama', id: 't4-mama' },
    { label: 'wawa', id: 't4-wawa' }, { label: 'yaya', id: 't4-yaya' },
  ],
}

export function Kategori({
  kategori, levels, onPick, onBack,
}: {
  kategori: string
  levels: LevelView[]
  onPick: (items: LevelItem[]) => void
  onBack: () => void
}) {
  // id latihan -> latihan + apakah levelnya terbuka untuk anak ini
  const ada = new Map(levels.flatMap((l) => l.items.map((i) => [i.id, { item: i, terbuka: l.unlocked }] as const)))
  const halaman = (HALAMAN[kategori] ?? []).map((h, i) => ({ ...h, nomor: i + 1, data: ada.get(h.id) }))

  return (
    <div className="page peta">
      <div className="bar-atas tengah">
        <button className="kembali garis" onClick={onBack} aria-label="Kembali">←</button>
        <h1 className="title">PETA PETUALANGAN</h1>
      </div>
      <div className="panel">
        <div className="peta-kartu">
          <div className="kat-grid">
            {halaman.map((h, idx) => {
              const bisa = !!h.data?.terbuka
              return (
                <button
                  key={h.id}
                  className={`node ${bisa ? '' : 'terkunci-level'}`}
                  disabled={!bisa}
                  title={h.data ? undefined : 'Latihan ini belum ada di kurikulum'}
                  // Lanjut di layar latihan berpindah ke nomor berikutnya yang tersedia.
                  onClick={() => onPick(halaman.slice(idx).flatMap((x) => (x.data?.terbuka ? [x.data.item] : [])))}
                >
                  {!!h.data?.item.bestStars && (
                    <span className={`bintang-node jumlah-${h.data.item.bestStars}`} aria-label={`${h.data.item.bestStars} bintang`}>
                      {Array.from({ length: h.data.item.bestStars }, (_, s) => <span key={s}>★</span>)}
                    </span>
                  )}
                  <div className="lingkaran">{h.nomor}</div>
                  <span className="label-level">{h.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
