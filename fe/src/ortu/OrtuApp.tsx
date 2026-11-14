import { useCallback, useEffect, useMemo, useState } from 'react'
import { Beranda, TugasHariIni } from './Beranda'
import { apiOrtu, muatSesi, siapkanLatihan, simpanSesi, type Anak, type ItemLatihan, type ItemTugas, type SesiOrtu, type Tugas } from './data'
import { Latihan } from './Latihan'
import { Aktivasi, Login } from './Masuk'
import { Pipit } from './Pipit'
import { Akun, Laporan, Progress } from './Progres'
import { Header, Kartu, NavBawah, Toast, type DataToast, type Tab } from './ui'

function layarPenuh() {
  const terpasang = matchMedia('(display-mode: standalone)').matches
  if (!terpasang && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
}

/** Aplikasi orang tua di web (tampilan sama dengan aplikasi Android): /ortu dan /undangan/<token>. */
export function OrtuApp() {
  const [undangan, setUndangan] = useState(() => location.pathname.match(/^\/undangan\/([^/?#]+)/)?.[1] ?? null)
  const [aktivasi, setAktivasi] = useState(false)
  const [sesi, setSesi] = useState<SesiOrtu | null>(muatSesi)

  const keLogin = () => {
    setUndangan(null)
    setAktivasi(false)
    history.replaceState(null, '', '/ortu')
  }
  // Aplikasi bisa dipasang di layar utama HP (terbuka tanpa bilah browser).
  useEffect(() => {
    const tag = (nama: string, atribut: Record<string, string>) => Object.assign(document.createElement(nama), atribut)
    document.head.append(
      tag('link', { rel: 'manifest', href: '/ortu.webmanifest' }),
      tag('link', { rel: 'apple-touch-icon', href: '/ortu-ikon-192.png' }),
      tag('meta', { name: 'theme-color', content: '#F7CB50' }),
      tag('meta', { name: 'mobile-web-app-capable', content: 'yes' }),
      tag('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }),
      tag('meta', { name: 'apple-mobile-web-app-title', content: 'SATU' }),
    )
    document.title = 'SATU untuk Orang Tua'
  }, [])

  // Sudah masuk = layar penuh. Browser hanya mengizinkannya dari sentuhan, jadi dipicu saat login
  // atau sentuhan pertama setelah halaman dibuka. Tidak berlaku di iPhone (Safari tidak mendukung);
  // di sana pakai "Tambahkan ke Layar Utama".
  useEffect(() => {
    if (!sesi) return
    // 'click', bukan 'pointerdown': di layar sentuh, Chrome baru menganggap sentuhan sebagai aksi pengguna
    // saat jari diangkat, jadi requestFullscreen dari pointerdown ditolak.
    // Tidak 'once': kalau keluar dari layar penuh (tombol kembali), sentuhan berikutnya masuk lagi.
    addEventListener('click', layarPenuh)
    return () => removeEventListener('click', layarPenuh)
  }, [sesi])

  const masuk = (s: SesiOrtu) => {
    layarPenuh()
    simpanSesi(s)
    setSesi(s)
    keLogin()
  }
  const keluar = useCallback(() => {
    simpanSesi(null)
    setSesi(null)
  }, [])

  let isi
  if (undangan || aktivasi) isi = <Aktivasi tokenAwal={undangan ? decodeURIComponent(undangan) : undefined} onMasuk={masuk} onKembali={keLogin} />
  else if (!sesi) isi = <Login onMasuk={masuk} onAktivasi={() => setAktivasi(true)} />
  else isi = <Utama sesi={sesi} keluar={keluar} />
  return <div className="m-app">{isi}</div>
}

type Layar =
  | { jenis: 'tab' }
  | { jenis: 'tugas'; tugas: Tugas }
  | { jenis: 'laporan' }
  | { jenis: 'latihan'; token: string; items: ItemLatihan[] }

function Utama({ sesi, keluar }: { sesi: SesiOrtu; keluar: () => void }) {
  const apiO = useMemo(() => apiOrtu(sesi, keluar), [sesi, keluar])
  const [tab, setTab] = useState<Tab>('beranda')
  const [layar, setLayar] = useState<Layar>({ jenis: 'tab' })
  const [anak, setAnak] = useState<Anak[] | null>(null)
  const [pilih, setPilih] = useState(0)
  const [toast, setToast] = useState<DataToast>(null)
  const [segar, setSegar] = useState(0) // naik setelah latihan supaya data dimuat ulang

  const muatAnak = useCallback(() => {
    apiO<Anak[]>('/parent/children').then(setAnak).catch((e) => setToast({ judul: 'Gagal Memuat', pesan: (e as Error).message }))
  }, [apiO])
  useEffect(muatAnak, [muatAnak])

  const sekarang = anak?.[pilih]

  // Mulai dari item yang dipilih; tanpa pilihan: yang belum selesai dulu, kalau semua selesai ulang semuanya.
  async function mulai(t: Tugas, dari?: ItemTugas) {
    if (!sekarang) return
    const belum = t.items.filter((i) => !i.completedAt)
    const urut = dari ? [dari, ...belum.filter((i) => i.id !== dari.id)] : belum.length ? belum : t.items
    try {
      const { token, latihan } = await siapkanLatihan(sesi, sekarang.id, urut)
      if (!latihan.length) throw new Error('Latihan di tugas ini belum tersedia.')
      setLayar({ jenis: 'latihan', token, items: latihan })
    } catch (e) {
      setToast({ judul: 'Gagal Memulai Latihan', pesan: (e as Error).message })
    }
  }

  const kembali = () => setLayar({ jenis: 'tab' })
  let isi
  if (!anak) isi = <Header judul="Memuat..."><Kartu><p className="m-teks">Memuat data anak…</p></Kartu></Header>
  else if (!sekarang) isi = <Header judul="Belum Ada Anak"><Kartu><p className="m-teks">Belum ada anak yang tertaut ke akun ini. Hubungi guru kelas.</p></Kartu></Header>
  else if (layar.jenis === 'latihan') {
    isi = <Latihan token={layar.token} items={layar.items} onKembali={() => { kembali(); setSegar((n) => n + 1); muatAnak() }} />
  } else if (layar.jenis === 'tugas') {
    isi = <TugasHariIni tugas={layar.tugas} onPilih={(i) => void mulai(layar.tugas, i)} onKembali={kembali} />
  } else if (layar.jenis === 'laporan') {
    isi = <Laporan apiO={apiO} anak={sekarang} onKembali={() => { kembali(); setTab('progress') }} />
  } else {
    isi = (
      <div key={`${sekarang.id}-${segar}`}>
        {tab === 'beranda' && (
          <Beranda
            apiO={apiO}
            anak={sekarang}
            daftarAnak={anak}
            onPilihAnak={setPilih}
            onBukaTugas={(t) => setLayar({ jenis: 'tugas', tugas: t })}
            onMulai={(t, i) => void mulai(t, i)}
            onProgress={() => setTab('progress')}
          />
        )}
        {tab === 'progress' && <Progress apiO={apiO} anak={sekarang} onLaporan={() => setLayar({ jenis: 'laporan' })} />}
        {tab === 'laporan' && <Laporan apiO={apiO} anak={sekarang} />}
        {tab === 'pipit' && <Pipit apiO={apiO} anak={sekarang} />}
        {tab === 'akun' && <Akun sesi={sesi} onKeluar={keluar} />}
      </div>
    )
  }

  return (
    <>
      {isi}
      {layar.jenis === 'tab' && <NavBawah tab={tab} onTab={setTab} />}
      <Toast data={toast} onTutup={() => setToast(null)} />
    </>
  )
}
