import { useEffect, useRef, useState } from 'react'
import { api, type AttemptResult, type LevelItem } from '../api'
import { gambarCermin, rasioDariTitik, RASIO_MULUT_BAWAAN } from '../cermin'
import { bacaModel, layakDipakai, TEKS_PETUNJUK, type Bunyi, type Keadaan, type Mata, type Petunjuk } from '../mata'
import { getMata } from '../mata-session'

type Pesan = { teks: string; jenis: 'info' | 'baik' | 'ulang' } | null

const SUARA_PETUNJUK: Record<string, string> = {
  bersuara: 'Bentuk sudah pas, sekarang keluarkan suaramu',
  hembuskan: 'Bentuk sudah pas, sekarang hembuskan napas',
  desiskan: 'Bentuk sudah pas, sekarang desiskan suaranya',
}
const NAPAS: readonly Bunyi[] = ['H', 'S']

function teksPetunjuk(k: Keadaan | null): string {
  if (!k) return ''
  if (k.status === 'jeda') return 'Wajahmu tidak terlihat. Hadap kamera, jangan tutupi mulut.'
  if (k.cocok && !k.petunjuk) return 'Pas! Tahan terus…'
  if (!k.petunjuk) return ''
  return SUARA_PETUNJUK[k.petunjuk] ?? TEKS_PETUNJUK[k.petunjuk as Petunjuk] ?? ''
}

// Rasio lebar mulut / jarak mata diukur sekali saat kalibrasi; dipakai lagi di latihan berikutnya.
let rasioTersimpan = RASIO_MULUT_BAWAAN

export function MariBerlatih({ token, items, onBack }: { token: string; items: LevelItem[]; onBack: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const kanvas = useRef<HTMLCanvasElement>(null)
  const mataRef = useRef<Mata | null>(null)
  const batal = useRef<() => void>(() => {})
  const targetRef = useRef<Bunyi | null>(null)
  const keadaanRef = useRef<Keadaan | null>(null)
  const [siap, setSiap] = useState(false)
  const [mic, setMic] = useState(true)
  const [sibuk, setSibuk] = useState(false)
  const [ke, setKe] = useState(0)
  const [keadaan, setKeadaan] = useState<Keadaan | null>(null)
  const [kemiripan, setKemiripan] = useState(0)
  const [suara, setSuara] = useState(0) // kenyaringan / ambang, 1 = cukup keras
  const [pesan, setPesan] = useState<Pesan>(null)
  const [berhasil, setBerhasil] = useState<{ bintang: number; akurasi: number; poin: number } | null>(null)

  const item = items[ke]

  // Kamera langsung menyala saat halaman dibuka; titik bibir digambar tiap frame (tanpa state React).
  useEffect(() => {
    let hidup = true
    let lepas = () => {}
    ;(async () => {
      try {
        const mata = await getMata()
        if (!hidup) return
        mataRef.current = mata
        await mata.mulaiKamera(video.current!)
        lepas = mata.padaFrame((f) => {
          if (kanvas.current && video.current) {
            gambarCermin(kanvas.current, video.current, {
              titik: f.titik, target: targetRef.current, keadaan: keadaanRef.current, rasioMulut: rasioTersimpan,
            })
          }
          setSuara(f.ambangSuara > 0 ? Math.min(2, f.rms / f.ambangSuara) : 0)
        })
        const tersimpan = await api<{ model: unknown }>('/me/calibration', { token }).catch(() => ({ model: null }))
        const model = bacaModel(tersimpan.model)
        mata.model = layakDipakai(model) ? model : null
        if (hidup) { setMic(mata.mikrofonAktif); setSiap(true) }
      } catch {
        if (hidup) setPesan({ teks: 'Kamera tidak bisa dipakai. Izinkan kamera dan mikrofon.', jenis: 'ulang' })
      }
    })()
    return () => {
      hidup = false
      lepas()
      batal.current()
      void mataRef.current?.berhenti()
    }
  }, [token])

  async function kalibrasi(mata: Mata): Promise<boolean> {
    setPesan({ teks: 'Diam sebentar, mulut tertutup…', jenis: 'info' })
    const rasio: number[] = []
    const lepas = mata.padaFrame((f) => { const r = rasioDariTitik(f.titik); if (r) rasio.push(r) })
    const k = await mata.kalibrasi()
    lepas()
    if (!k.ok) {
      setPesan({ teks: k.alasan === 'mulut_terbuka' ? 'Tutup mulutmu dulu, lalu tekan Coba.' : 'Wajahmu belum terlihat jelas. Coba lagi.', jenis: 'ulang' })
      return false
    }
    if (rasio.length) rasioTersimpan = rasio.sort((a, b) => a - b)[Math.floor(rasio.length / 2)]
    return true
  }

  async function coba() {
    const mata = mataRef.current
    if (!mata || !item || sibuk) return
    setSibuk(true)
    setPesan(null)
    // Hitung alasan paling sering selama percobaan, untuk pesan gagal yang jelas.
    const hitung = { jeda: 0, bentuk: 0, suara: 0 }
    try {
      if (!mata.terkalibrasi && !(await kalibrasi(mata))) return
      setPesan(null)
      targetRef.current = item.urutan[0] as Bunyi
      const run = mata.percobaan(item.urutan as Bunyi[], (k) => {
        keadaanRef.current = k
        targetRef.current = k.target ?? targetRef.current
        setKeadaan(k)
        setKemiripan(k.kemiripan)
        if (k.status === 'jeda') hitung.jeda++
        else if (!k.cocok) hitung.bentuk++
        else if (k.petunjuk) hitung.suara++
      })
      batal.current = run.batal
      const hasil = await run.hasil
      if (!hasil) return
      setKemiripan(hasil.kemiripan)
      const res = await api<AttemptResult>('/attempts', {
        token,
        body: { itemId: item.id, berhasil: hasil.berhasil, langkah_tercapai: hasil.langkah_tercapai, durasi_ms: hasil.durasi_ms, kemiripan: hasil.kemiripan },
      })
      if (hasil.berhasil) {
        if (mata.model) void api('/me/calibration', { token, method: 'PUT', body: mata.model }).catch(() => {})
        setBerhasil({ bintang: res.stars, akurasi: Math.round(hasil.kemiripan * 100), poin: res.pointsEarned })
      } else {
        const terbanyak = (Object.entries(hitung) as [keyof typeof hitung, number][]).sort((a, b) => b[1] - a[1])[0][0]
        const alasan = {
          suara: NAPAS.includes(targetRef.current as Bunyi)
            ? 'Bentuk bibirmu sudah benar, tapi hembusan napasnya belum terdengar.'
            : 'Bentuk bibirmu sudah benar, tapi suaramu belum terdengar. Ucapkan lebih keras sambil menahan bentuknya.',
          bentuk: 'Bentuk bibir belum pas. Samakan titik bibirmu dengan garis biru, ikuti panah kuning.',
          jeda: 'Wajahmu tidak terlihat. Hadap kamera dan jangan tutupi mulut.',
        }[terbanyak]
        setPesan({ teks: `✗ Belum berhasil. ${alasan}`, jenis: 'ulang' })
      }
    } catch (e) {
      setPesan({ teks: (e as Error).message, jenis: 'ulang' })
    } finally {
      keadaanRef.current = null
      targetRef.current = null
      setKeadaan(null)
      setSibuk(false)
    }
  }

  function ulangi() {
    setBerhasil(null)
    setTimeout(coba, 0)
  }

  function lanjut() {
    setBerhasil(null)
    if (ke + 1 < items.length) setKe(ke + 1)
    else onBack() // latihan terakhir di level ini selesai
  }

  const napas = keadaan?.target ? NAPAS.includes(keadaan.target) : false
  const bunyiOk = keadaan ? (keadaan.cocok ? !keadaan.petunjuk : keadaan.suara) : false

  return (
    <div className="page latih">
      <div className="bar-atas tengah">
        <button className="kembali garis" onClick={onBack} aria-label="Kembali">←</button>
        <h1 className="title">MARI BERLATIH</h1>
      </div>

      {berhasil && <PopupBerhasil {...berhasil} onUlangi={ulangi} onLanjut={lanjut} />}

      <div className="latih-grid">
        <div className="latih-kiri">
          <div className="kartu-emas cermin">
            <div className="kartu-judul">
              Cermin Ajaib
              <span className={`titik-rekam ${sibuk ? 'aktif' : ''}`} />
            </div>
            <div className="kartu-putih layar-cermin">
              <video ref={video} playsInline muted />
              <canvas ref={kanvas} className="lapisan-bibir" />
              {item && <span className="target-kata">{item.text}</span>}

              {keadaan && (
                <div className="status-latih">
                  <span className={`cek ${keadaan.cocok ? 'ya' : 'tidak'}`}>{keadaan.cocok ? '✓' : '✗'} Bentuk</span>
                  <span className={`cek ${bunyiOk ? 'ya' : 'tidak'}`}>{bunyiOk ? '✓' : '✗'} {napas ? 'Napas' : 'Suara'}</span>
                  <span className="tahan">
                    Tahan
                    <span className="tahan-bar"><span style={{ width: `${Math.round(keadaan.progres * 100)}%` }} /></span>
                  </span>
                  {keadaan.jumlahLangkah > 1 && <span className="cek">Bunyi {Math.min(keadaan.langkah + 1, keadaan.jumlahLangkah)}/{keadaan.jumlahLangkah}</span>}
                </div>
              )}
              {keadaan && <div className="petunjuk-latih">{teksPetunjuk(keadaan)}</div>}

              {!siap && !pesan && <span className="pesan info">Menyalakan kamera…</span>}
              {pesan && <span className={`pesan ${pesan.jenis}`}>{pesan.teks}</span>}
              {siap && !mic && <span className="peringatan-mic">Mikrofon tidak aktif: suara tidak bisa dinilai.</span>}
            </div>
          </div>
          <div className="latih-tombol">
            <button className="tombol-garis" onClick={coba} disabled={!siap || sibuk}>Coba</button>
            <button className="tombol-garis" onClick={onBack}>Selesai</button>
          </div>
        </div>

        <div className="kartu-emas tutorial">
          <div className="kartu-judul">Tutorial</div>
          <div className="kartu-putih kotak-tutorial" />
          <div className="kartu-putih kotak-mirip">
            <span>Kemiripan {Math.round(kemiripan * 100)}%</span>
            <div className="geser" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(kemiripan * 100)}>
              <div className="geser-isi" style={{ width: `${Math.round(kemiripan * 100)}%` }} />
              <div className="geser-kenop" style={{ left: `${Math.round(kemiripan * 100)}%` }} />
            </div>
            <span>Suara</span>
            <div className="geser">
              <div className={`geser-isi ${suara >= 1 ? 'cukup' : ''}`} style={{ width: `${Math.round((suara / 2) * 100)}%` }} />
              <div className="garis-ambang" title="Batas cukup keras" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PopupBerhasil({
  bintang, akurasi, poin, onUlangi, onLanjut,
}: { bintang: number; akurasi: number; poin: number; onUlangi: () => void; onLanjut: () => void }) {
  return (
    <div className="popup-latar" role="dialog" aria-modal="true" aria-label="Berhasil">
      {/* Filter yang membuat tepi kartu kuning bergelombang seperti di desain. */}
      <svg width="0" height="0" aria-hidden="true">
        <filter id="gelombang"><feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="2" seed="3" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="9" /></filter>
      </svg>
      <div className="popup">
        <div className="popup-tepi" />
        <div className="popup-isi">
          <b className="popup-judul">Selamat</b>
          <div className="popup-bintang">
            {[1, 2, 3].map((n) => <span key={n} className={n <= bintang ? 'penuh' : ''}>★</span>)}
          </div>
          <span className="popup-akurasi">Akurasi {akurasi}%</span>
          <span className="popup-poin">{poin} poin</span>
          <div className="popup-aksi">
            <button onClick={onUlangi}>Ulangi</button>
            <button onClick={onLanjut}>Lanjut</button>
          </div>
        </div>
      </div>
    </div>
  )
}
