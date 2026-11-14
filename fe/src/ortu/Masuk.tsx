import { useEffect, useState } from 'react'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import { api, ApiError } from '../api'
import type { SesiOrtu } from './data'
import { Header, Isian, KepalaKuning, Kartu, Popup, Toast, Tombol, type DataToast } from './ui'

type JawabanMasuk = { token: string; parent: { name: string; email: string } }
/** LoginScreen (peran Wali Murid). Gagal login = pesan jelas, bukan "berhasil" palsu seperti versi Android. */
export function Login({ onMasuk, onAktivasi }: { onMasuk: (s: SesiOrtu) => void; onAktivasi: () => void }) {
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [toast, setToast] = useState<DataToast>(null)
  const [berhasil, setBerhasil] = useState<SesiOrtu | null>(null)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    setSibuk(true)
    try {
      const r = await api<JawabanMasuk>('/auth/parent/login', { body: { email: email.trim(), password: sandi } })
      setBerhasil({ token: r.token, nama: r.parent.name, email: r.parent.email })
    } catch (err) {
      const s = err instanceof ApiError ? err.status : 0
      setToast({
        judul: 'Gagal Masuk',
        pesan: s === 401 ? 'Email atau kata sandi salah.' : s === 429 ? 'Terlalu banyak percobaan. Tunggu 15 menit.' : (err as Error).message,
      })
    } finally {
      setSibuk(false)
    }
  }

  return (
    <>
      <div className="l-layar">
        <KepalaKuning />
        <form className="l-form" onSubmit={kirim}>
          <h1>Login</h1>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Kata Sandi<input type="password" autoComplete="current-password" value={sandi} onChange={(e) => setSandi(e.target.value)} required /></label>
          <button type="submit" className="l-masuk" disabled={sibuk}>{sibuk ? 'Memproses...' : 'Masuk'}</button>
          <button type="button" className="l-lupa" onClick={() => setToast({ judul: 'Lupa Kata Sandi', pesan: 'Hubungi guru kelas untuk mendapat link undangan baru.' })}>
            Lupa Kata Sandi?
          </button>
          <button type="button" className="l-lupa l-aktivasi" onClick={onAktivasi}>Punya link undangan guru? Aktivasi akun</button>
        </form>
      </div>
      <Toast data={toast} onTutup={() => setToast(null)} />
      {berhasil && <Popup judul="Berhasil Login!" pesan={`Selamat datang kembali, ${berhasil.nama}.`} onOk={() => onMasuk(berhasil)} />}
    </>
  )
}

/** AktivasiOrangTuaScreen: tempel link (atau buka /undangan/<token>), lalu buat email + sandi. */
export function Aktivasi({ tokenAwal, onMasuk, onKembali }: { tokenAwal?: string; onMasuk: (s: SesiOrtu) => void; onKembali: () => void }) {
  const [link, setLink] = useState(tokenAwal ? `${location.origin}/undangan/${tokenAwal}` : '')
  const [token, setToken] = useState<string | null>(null)
  const [info, setInfo] = useState<{ parentName: string; children: string[] } | null>(null)
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [toast, setToast] = useState<DataToast>(null)

  const ambilToken = (s: string) => s.trim().replace(/\/+$/, '').split('/').pop()?.split('?')[0] ?? ''
  const pesan = (e: unknown) => {
    const s = e instanceof ApiError ? e.status : 0
    return s === 404 ? 'Link undangan tidak berlaku (sudah dipakai atau lewat 7 hari). Minta guru membuat link baru.'
      : s === 409 ? 'Email ini sudah dipakai akun lain.'
      : s === 400 ? 'Periksa lagi: email harus valid dan sandi minimal 8 karakter.'
      : (e as Error).message
  }

  async function cek(t: string) {
    setSibuk(true)
    try {
      setInfo(await api<{ parentName: string; children: string[] }>(`/invites/${encodeURIComponent(t)}`))
      setToken(t)
    } catch (e) {
      setToast({ judul: 'Link Tidak Berlaku', pesan: pesan(e) })
    } finally {
      setSibuk(false)
    }
  }

  // Dibuka dari link guru (/undangan/<token>): langsung periksa.
  useEffect(() => {
    if (tokenAwal) void cek(tokenAwal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenAwal])

  async function aktifkan(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setSibuk(true)
    try {
      const r = await api<JawabanMasuk>(`/invites/${encodeURIComponent(token)}/accept`, { body: { email: email.trim(), password: sandi } })
      onMasuk({ token: r.token, nama: r.parent.name, email: r.parent.email })
    } catch (err) {
      setToast({ judul: 'Aktivasi Gagal', pesan: pesan(err) })
      if (err instanceof ApiError && err.status === 404) { setInfo(null); setToken(null) }
    } finally {
      setSibuk(false)
    }
  }

  return (
    <>
      <Header judul="Aktivasi Orang Tua" onKembali={onKembali}>
        {!info ? (
          <form className="m-form" onSubmit={(e) => { e.preventDefault(); void cek(ambilToken(link)) }}>
            <Kartu><p className="m-teks">Tempel link undangan yang dikirim guru.</p></Kartu>
            <Isian label="Link Undangan" placeholder="https://tunarungu.neotelemetri.id/undangan/..." value={link} onChange={(e) => setLink(e.target.value)} required />
            <Tombol type="submit" disabled={sibuk || !link.trim()}>{sibuk ? 'Memeriksa...' : 'Lanjut'}</Tombol>
          </form>
        ) : (
          <form className="m-form" onSubmit={aktifkan}>
            <Kartu>
              <b className="m-teks-besar">Halo, {info.parentName}!</b>
              <p className="m-teks oranye">Anak: {info.children.join(', ')}</p>
            </Kartu>
            <Isian label="Email (Gmail)" type="email" placeholder="Masukkan email anda" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Isian label="Kata Sandi (min. 8 karakter)" type="password" placeholder="Buat kata sandi" autoComplete="new-password" minLength={8} value={sandi} onChange={(e) => setSandi(e.target.value)} required />
            <Tombol type="submit" disabled={sibuk || sandi.length < 8 || !email}>{sibuk ? 'Mengaktifkan...' : 'Aktifkan & Masuk'}</Tombol>
          </form>
        )}
      </Header>
      <Toast data={toast} onTutup={() => setToast(null)} />
    </>
  )
}
