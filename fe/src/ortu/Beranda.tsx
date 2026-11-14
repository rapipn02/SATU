import { useEffect, useState } from 'react'
import { HALAMAN } from '../screens/Kategori'
import type { Anak, ItemTugas, LevelPeta, Tugas } from './data'
import { Header, IkonChevron, Kartu, KotakCentang, Tombol } from './ui'

export type Api = <T>(path: string, opts?: { method?: string; body?: unknown }) => Promise<T>

/** 4 kategori peta anak (sama dengan web anak), tiap kategori 5 latihan. */
export const KATEGORI = [
  { id: 'vokal', nama: 'Huruf Vokal' },
  { id: 'konsonan', nama: 'Huruf Konsonan' },
  { id: 'suku_kata', nama: 'Suku Kata' },
  { id: 'kata', nama: 'Kata 2 Suku Kata' },
].map((k) => ({ ...k, items: HALAMAN[k.id] }))

export const bintangPeta = (peta: LevelPeta[] | null) =>
  new Map((peta ?? []).flatMap((l) => l.items.map((i) => [i.id, i.bestStars] as const)))

/** Latihan peta yang sudah selesai (≥ 1 bintang), urut seperti peta anak. */
export function sudahBisa(peta: LevelPeta[] | null) {
  const bintang = bintangPeta(peta)
  return KATEGORI.flatMap((k) => k.items).filter((h) => (bintang.get(h.id) ?? 0) > 0).map((h) => h.label)
}

/** Status latihan peta untuk Beranda: 3 bintang = sudah bisa, 1-2 = hampir bisa, ada di tugas tapi belum berbintang = sedang dilatih. */
export function statusLatihan(peta: LevelPeta[] | null, aktif: Tugas[]) {
  const bintang = bintangPeta(peta)
  const peta20 = KATEGORI.flatMap((k) => k.items)
  const bisa = peta20.filter((h) => (bintang.get(h.id) ?? 0) >= 3).map((h) => h.label)
  const hampir = peta20.filter((h) => [1, 2].includes(bintang.get(h.id) ?? 0)).map((h) => h.label)
  const dilatih = [...new Set(aktif.flatMap((t) => t.items).filter((i) => !i.completedAt && (bintang.get(i.item) ?? i.bestStars) === 0).map((i) => i.itemText))]
  return [
    { nama: 'Sudah Bisa', isi: bisa },
    { nama: 'Hampir Bisa', isi: hampir },
    { nama: 'Sedang Dilatih', isi: dilatih },
  ]
}

const TOTAL_PETA = KATEGORI.reduce((n, k) => n + k.items.length, 0) // 20 latihan di peta

/** Kartu status dengan persen dari seluruh latihan peta, mis. 5 dari 20 = 25%. */
export function KartuStatus({ status, memuat, onClick }: { status: { nama: string; isi: string[] }; memuat: boolean; onClick?: () => void }) {
  const pct = Math.round((Math.min(status.isi.length, TOTAL_PETA) * 100) / TOTAL_PETA)
  return (
    <Kartu onClick={onClick}>
      <div className="m-baris kiri">
        <span className="m-kotak" aria-label={`${pct} persen dari ${TOTAL_PETA} latihan`}>{memuat ? '…' : `${pct}%`}</span>
        <div>
          <b className="m-teks-besar">{status.nama}</b>
          <p className="m-teks gelap">{memuat ? '…' : status.isi.length ? status.isi.join(' - ') : '-'}</p>
          {!memuat && <p className="m-teks kecil">{status.isi.length} dari {TOTAL_PETA} latihan</p>}
        </div>
      </div>
    </Kartu>
  )
}

export function Beranda({ apiO, anak, daftarAnak, onPilihAnak, onBukaTugas, onMulai, onProgress }: {
  apiO: Api
  anak: Anak
  daftarAnak: Anak[]
  onPilihAnak: (i: number) => void
  onBukaTugas: (t: Tugas) => void
  onMulai: (t: Tugas, item?: ItemTugas) => void
  onProgress: () => void
}) {
  const [tugas, setTugas] = useState<Tugas[] | null>(null)
  const [peta, setPeta] = useState<LevelPeta[] | null>(null)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    apiO<Tugas[]>(`/parent/children/${anak.id}/homework?status=assigned`).then(setTugas).catch((e) => setGalat((e as Error).message))
    apiO<LevelPeta[]>(`/parent/children/${anak.id}/progress`).then(setPeta).catch(() => {})
  }, [apiO, anak.id])

  const aktif = [...(tugas ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const terbaru = aktif[0]
  const selesai = terbaru ? terbaru.items.filter((i) => i.completedAt).length : 0

  return (
    <Header judul="Tugas hari ini">
      {daftarAnak.length > 1 && (
        <div className="m-pilih-anak">
          {daftarAnak.map((a, i) => <button key={a.id} className={a.id === anak.id ? 'on' : ''} onClick={() => onPilihAnak(i)}>{a.nickname}</button>)}
        </div>
      )}
      <div className="m-tumpuk">
        {tugas === null && !galat && <Kartu><p className="m-teks">Memuat tugas…</p></Kartu>}
        {galat && <Kartu><p className="m-teks merah">{galat}</p></Kartu>}

        {terbaru ? (
          <Kartu onClick={() => onBukaTugas(terbaru)}>
            <div className="m-baris">
              <div>
                <b className="m-teks-besar">{terbaru.items.map((i) => i.itemText).join(' - ')}</b>
                <p className="m-teks gelap">{selesai} dari {terbaru.items.length} selesai</p>
              </div>
              <IkonChevron size={24} />
            </div>
          </Kartu>
        ) : tugas && (
          <Kartu>
            <b className="m-teks-besar">Belum ada tugas dari guru</b>
            <p className="m-teks gelap">Tugas baru untuk {anak.nickname} akan muncul di sini.</p>
          </Kartu>
        )}

        <Tombol disabled={!terbaru} onClick={() => terbaru && onMulai(terbaru)}>Mulai Latihan</Tombol>

        {statusLatihan(peta, aktif).map((s) => <KartuStatus key={s.nama} status={s} memuat={peta === null} onClick={onProgress} />)}
      </div>
    </Header>
  )
}

/** ParentTaskWordsScreen: daftar latihan di satu tugas, centang yang sudah selesai. */
export function TugasHariIni({ tugas, onPilih, onKembali }: { tugas: Tugas; onPilih: (item: ItemTugas) => void; onKembali: () => void }) {
  const pertama = tugas.items.find((i) => !i.completedAt) ?? tugas.items[0]
  return (
    <Header judul="Tugas Hari Ini" onKembali={onKembali}>
      <div className="m-tumpuk">
        {tugas.items.map((i) => (
          <Kartu key={i.id} onClick={() => onPilih(i)}>
            <div className="m-baris">
              <div className="m-baris kiri">
                <KotakCentang selesai={!!i.completedAt} />
                <div>
                  <b className="m-teks-besar">Pelafalan '{i.itemText}'</b>
                  <p className={`m-teks ${i.completedAt ? 'oranye' : ''}`}>
                    {i.completedAt ? `Selesai dikerjakan ✓ ${'⭐'.repeat(i.bestStars)}` : 'Klik untuk menonton tutorial & latihan'}
                  </p>
                </div>
              </div>
              <IkonChevron />
            </div>
          </Kartu>
        ))}
      </div>
      <div className="m-bawah">
        <Tombol onClick={() => pertama && onPilih(pertama)}>Mulai Latihan Kata</Tombol>
      </div>
    </Header>
  )
}
