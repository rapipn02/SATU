import { useEffect, useRef, useState } from 'react'
import { api, urlServer } from '../api'
import type { ItemLatihan } from './data'
import { gambarCermin, rasioDariTitik, RASIO_MULUT_BAWAAN } from '../cermin'
import { bacaModel, layakDipakai, TEKS_PETUNJUK, type Bunyi, type Keadaan, type Mata, type Petunjuk } from '../mata'
import { getMata } from '../mata-session'
import { ceritaGagal, type Hitung } from '../screens/MariBerlatih'

// Latihan di rumah (orang tua) tetap menilai bentuk bibir saja; web siswa memakai mikrofon.
const TANPA_SUARA = true
import { Bar, Kartu, KepalaKuning, Popup, Toast, Tombol, type DataToast } from './ui'

const Bintang = ({ penuh }: { penuh: boolean }) => (
  <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
    <path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2 6.1 20.4l1.3-6.5L2.5 9.3l6.6-.8Z"
      fill={penuh ? '#f7b733' : '#e6e0d0'} stroke={penuh ? '#e8a21a' : '#d6cfbd'} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
)

const Api = ({ angka }: { angka: number }) => (
  <svg viewBox="0 0 64 80" width="72" height="90" aria-hidden="true">
    <path d="M32 3c4 14 22 22 22 44a22 22 0 0 1-44 0c0-10 5-17 10-22 0 8 4 12 8 13-3-14 0-26 4-35Z" fill="#f59a1b" />
    <path d="M32 34c3 7 12 11 12 21a12 12 0 0 1-24 0c0-6 4-9 6-11 1 4 3 6 5 6-1-6-1-11 1-16Z" fill="#fcd34d" />
    <text x="32" y="65" textAnchor="middle" fontFamily="Gluten, sans-serif" fontWeight="700" fontSize="22" fill="#fff" stroke="#e07b0c" strokeWidth="1">{angka}</text>
  </svg>
)

// Saran bentuk bibir per bunyi (sama dengan aplikasi Android).
const SARAN: Record<string, string> = {
  a: "Buka mulut lebar-lebar dan bunyikan 'A'",
  i: 'Tarik sudut bibir ke samping kanan dan kiri',
  u: 'Kerucutkan dan bulatkan bibir ke depan',
  e: 'Buka mulut sedang dan senyum sedikit',
  o: 'Bulatkan bibir dengan rongga mulut terbuka',
  f: 'Sentuhkan gigi atas ke bibir bawah',
  h: 'Buka mulut rileks dan hembuskan napas',
  m: 'Rapatkan bibir atas dan bawah',
  s: 'Rapatkan gigi dan hembuskan desisan',
  t: 'Sentuhkan ujung lidah ke belakang gigi atas',
}
const saran = (teks: string) => SARAN[teks.toLowerCase()] ?? SARAN[teks.toLowerCase()[0]] ?? 'Perhatikan bentuk bibir pada video tutorial di atas'

const TEKS_SUARA: Record<string, string> = {
  bersuara: 'Bentuk sudah pas, sekarang keluarkan suara',
  hembuskan: 'Bentuk sudah pas, sekarang hembuskan napas',
  desiskan: 'Bentuk sudah pas, sekarang desiskan suaranya',
}
function arahan(k: Keadaan | null) {
  if (!k) return ''
  if (k.status === 'jeda') return 'Wajah belum terlihat, hadap kamera'
  if (k.cocok && !k.petunjuk) return 'Pas! Tahan terus…'
  if (!k.petunjuk) return ''
  return TEKS_SUARA[k.petunjuk] ?? TEKS_PETUNJUK[k.petunjuk as Petunjuk] ?? ''
}

interface HasilServer { correct: boolean; accuracy: number; stars: number; pointsEarned: number; streak?: { current: number } }

let rasioTersimpan = RASIO_MULUT_BAWAAN

export function Latihan({ token, items, onKembali }: { token: string; items: ItemLatihan[]; onKembali: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const kanvas = useRef<HTMLCanvasElement>(null)
  const mataRef = useRef<Mata | null>(null)
  const batal = useRef<() => void>(() => {})
  const targetRef = useRef<Bunyi | null>(null)
  const keadaanRef = useRef<Keadaan | null>(null)
  const [ke, setKe] = useState(0)
  const [kamera, setKamera] = useState<'muat' | 'siap' | 'ditolak'>('muat')
  const [percobaanKamera, setPercobaanKamera] = useState(0)
  const [sibuk, setSibuk] = useState(false)
  const [keadaan, setKeadaan] = useState<Keadaan | null>(null)
  const [kemiripan, setKemiripan] = useState(0)
  const [toast, setToast] = useState<DataToast>(null)
  const [hasil, setHasil] = useState<HasilServer | null>(null)
  const [streak, setStreak] = useState<number | null>(null)
  const item = items[ke]

  // Kamera + model Mata menyala saat layar dibuka, mati saat keluar.
  useEffect(() => {
    let hidup = true
    let lepas = () => {}
    setKamera('muat')
    ;(async () => {
      try {
        const mata = await getMata()
        if (!hidup) return
        mataRef.current = mata
        await mata.mulaiKamera(video.current!)
        lepas = mata.padaFrame((f) => {
          if (kanvas.current && video.current) {
            gambarCermin(kanvas.current, video.current, { titik: f.titik, target: targetRef.current, keadaan: keadaanRef.current, rasioMulut: rasioTersimpan })
          }
        })
        const tersimpan = await api<{ model: unknown }>('/me/calibration', { token }).catch(() => ({ model: null }))
        const model = bacaModel(tersimpan.model)
        mata.model = layakDipakai(model) ? model : null
        mata.aturPercobaan({ tanpaSuara: TANPA_SUARA })
        if (hidup) setKamera('siap')
      } catch {
        if (hidup) setKamera('ditolak')
      }
    })()
    return () => {
      hidup = false
      lepas()
      batal.current()
      void mataRef.current?.berhenti()
    }
  }, [token, percobaanKamera])

  async function ucapkan() {
    const mata = mataRef.current
    if (!mata || !item || sibuk) return
    setSibuk(true)
    const hitung: Hitung = { jeda: 0, bentuk: 0, suara: 0 }
    const petunjukHitung: Record<string, number> = {}
    try {
      if (!mata.terkalibrasi) {
        setToast({ judul: 'Kalibrasi', pesan: 'Diam sebentar dengan mulut tertutup…' })
        const rasio: number[] = []
        const lepas = mata.padaFrame((f) => { const r = rasioDariTitik(f.titik); if (r) rasio.push(r) })
        const k = await mata.kalibrasi()
        lepas()
        if (!k.ok) {
          setToast({ judul: 'Kalibrasi Gagal', pesan: k.alasan === 'mulut_terbuka' ? 'Tutup mulut dulu, lalu tekan Ucapkan lagi.' : 'Wajah belum terlihat jelas. Hadap kamera di tempat terang.' })
          return
        }
        if (rasio.length) rasioTersimpan = rasio.sort((a, b) => a - b)[Math.floor(rasio.length / 2)]
        setToast(null)
      }
      targetRef.current = item.urutan[0] as Bunyi
      const run = mata.percobaan(item.urutan as Bunyi[], (k) => {
        keadaanRef.current = k
        targetRef.current = k.target ?? targetRef.current
        setKeadaan(k)
        setKemiripan(k.kemiripan)
        if (k.status === 'jeda') hitung.jeda++
        else if (!k.cocok) {
          hitung.bentuk++
          if (k.petunjuk) petunjukHitung[k.petunjuk] = (petunjukHitung[k.petunjuk] ?? 0) + 1
        } else if (k.petunjuk) hitung.suara++
      })
      batal.current = run.batal
      const h = await run.hasil
      if (!h) return
      setKemiripan(h.kemiripan)
      const res = await api<HasilServer>('/attempts', {
        token,
        body: { itemId: item.id, homeworkItemId: item.tugasItemId, berhasil: h.berhasil, langkah_tercapai: h.langkah_tercapai, durasi_ms: h.durasi_ms, kemiripan: h.kemiripan },
      })
      if (res.correct) {
        if (mata.model) void api('/me/calibration', { token, method: 'PUT', body: mata.model }).catch(() => {})
        setHasil(res)
      } else {
        setToast({ judul: 'Pengucapan Belum Sesuai', pesan: ceritaGagal(res.accuracy, hitung, petunjukHitung, targetRef.current) })
      }
    } catch (e) {
      setToast({ judul: 'Gagal Menyimpan', pesan: (e as Error).message })
    } finally {
      keadaanRef.current = null
      targetRef.current = null
      setKeadaan(null)
      setSibuk(false)
    }
  }

  function lanjutSetelahStreak() {
    setStreak(null)
    setKemiripan(0)
    if (ke + 1 < items.length) setKe(ke + 1)
    else onKembali()
  }

  if (!item) return null
  const persen = Math.round(kemiripan * 100)

  return (
    <>
      <div className="m-layar">
        <KepalaKuning kecil onKembali={onKembali} />
        <div className="m-lembar rapat">
        <div className="m-tumpuk">
          <Kartu className="tengah">
            <b className="m-kartu-judul">Tutorial</b>
            {item.tutorialUrl
              ? <video key={item.id} className="m-video" src={urlServer(item.tutorialUrl)} autoPlay loop muted playsInline />
              : <div className="m-video kosong">{item.text}</div>}
            <p className="m-teks kecil">'{item.text}': {saran(item.text)}</p>
          </Kartu>

          <Kartu className="tengah m-kartu-kamera">
            <b className="m-kartu-judul">Cermin Ajaib</b>
            <div className="m-kamera" style={{ display: kamera === 'ditolak' ? 'none' : 'block' }}>
              <video ref={video} playsInline muted />
              <canvas ref={kanvas} className="lapisan-bibir" />
              <span className="m-lencana">📷 {kamera === 'siap' ? 'Cermin Ajaib Aktif' : 'Menyalakan kamera…'}</span>
              {keadaan && <span className="m-arahan">{arahan(keadaan)}</span>}
            </div>
            {kamera === 'ditolak' && (
              <div className="m-izin">
                <b>Akses Kamera Diperlukan</b>
                <p>Izinkan akses kamera untuk mengaktifkan Cermin Ajaib</p>
                <Tombol sekunder onClick={() => setPercobaanKamera((n) => n + 1)}>Izinkan Kamera</Tombol>
              </div>
            )}
          </Kartu>

          <Kartu>
            <Bar nilai={persen} />
            <span className="m-teks kecil">Kemiripan {persen}%{persen >= 50 ? ' · bentuk pas ✓' : ''}</span>
          </Kartu>
        </div>
        <div className="m-bawah">
          <Tombol onClick={ucapkan} disabled={sibuk || kamera !== 'siap'}>{sibuk ? 'Menilai Pelafalan...' : 'Ucapkan'}</Tombol>
        </div>
        </div>
      </div>

      <Toast data={toast} onTutup={() => setToast(null)} />

      {hasil && (
        <Popup judul="Selamat">
          <div className="m-bintang" aria-label={`${hasil.stars} bintang`}>
            {[1, 2, 3].map((n) => <Bintang key={n} penuh={n <= hasil.stars} />)}
          </div>
          <b className="m-akurasi">Akurasi {hasil.accuracy}%</b>
          <span className="m-poin">{hasil.pointsEarned} poin</span>
          <div className="m-dua">
            <button className="m-pil" onClick={() => { setHasil(null); void ucapkan() }}>Ulangi</button>
            <button className="m-pil" onClick={() => { setStreak(hasil.streak?.current ?? 0); setHasil(null) }}>Lanjut</button>
          </div>
        </Popup>
      )}
      {streak !== null && (
        <Popup>
          <Api angka={streak} />
          <b className="m-akurasi">{streak > 0 ? `${streak} Hari Streak!` : 'Latihan Tersimpan!'}</b>
          <p className="m-popup-pesan">
            {streak > 0 ? 'Terus belajar setiap hari dan kumpulkan api semangatmu!' : 'Selesaikan 3 latihan benar hari ini untuk memulai streak.'}
          </p>
          <button className="m-pil" onClick={lanjutSetelahStreak}>{ke + 1 < items.length ? `Lanjut: ${items[ke + 1].text}` : 'Lanjut'}</button>
        </Popup>
      )}
    </>
  )
}
