/**
 * Komponen tampilan yang meniru aplikasi Android SATU (peran Wali Murid):
 * MascotHeader, CardContainer, PrimaryButton/SecondaryButton, CustomTextField, ikon, bottom navigation,
 * CustomAppPopup, TopToastBanner, progress bar. Warna dan ukuran diambil dari ui/theme dan ui/components.
 */
import { useEffect, type ReactNode } from 'react'
import burung from '../assets/ortu/burung.png'
import navAkun from '../assets/ortu/nav-akun.png'
import navBeranda from '../assets/ortu/nav-beranda.png'
import navLaporan from '../assets/ortu/nav-laporan.png'
import navProgress from '../assets/ortu/nav-progress.png'

// ------------------------------------------------------------------ ikon (dari AppIcons.kt)

type IkonProps = { size?: number }

export const IkonAkun = ({ size = 24 }: IkonProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="9.1" r="3.8" fill="currentColor" stroke="none" />
    <path d="M6 19.2c2.4-4.3 9.6-4.3 12 0" />
  </svg>
)
export const IkonChevron = ({ size = 20 }: IkonProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="#333" strokeWidth={2.4} aria-hidden="true">
    <path d="m7 4 6.6 6L7 16" />
  </svg>
)
export const IkonKembali = ({ size = 24 }: IkonProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.9} strokeLinecap="round" aria-hidden="true">
    <path d="M13.2 6 7.2 12l6 6" />
    <path d="M7.2 12H18" />
  </svg>
)

// ------------------------------------------------------------------ MascotHeader

export const Awan = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 120 50" aria-hidden="true">
    <path d="M14 46a14 14 0 0 1 4-27 20 20 0 0 1 37-6 16 16 0 0 1 27 4 15 15 0 0 1 24 13 13 13 0 0 1 0 16Z" fill="#fff" />
  </svg>
)

/** Header kuning bergaris + awan + burung (sama dengan halaman Login). */
export function KepalaKuning({ onKembali, kecil }: { onKembali?: () => void; kecil?: boolean }) {
  return (
    <header className={`l-atas ${kecil ? 'kecil' : ''}`}>
      <Awan className="l-awan kiri" />
      <Awan className="l-awan kanan" />
      <img src={burung} alt="" className="l-burung" />
      {onKembali && (
        <button className="m-kembali" onClick={onKembali} aria-label="Kembali">
          <IkonKembali />
        </button>
      )}
    </header>
  )
}

export function Header({ judul, onKembali, children }: { judul: string; onKembali?: () => void; children: ReactNode }) {
  return (
    <div className="m-layar">
      <KepalaKuning onKembali={onKembali} />
      <div className="m-lembar">
        <h1 className="m-judul">{judul}</h1>
        <div className="m-isi">{children}</div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ CardContainer, tombol, input

export function Kartu({ children, onClick, className = '' }: { children: ReactNode; onClick?: () => void; className?: string }) {
  if (onClick) {
    return <button type="button" className={`m-kartu m-kartu-klik ${className}`} onClick={onClick}>{children}</button>
  }
  return <div className={`m-kartu ${className}`}>{children}</div>
}

export function Tombol({ children, onClick, disabled, sekunder, merah, type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; sekunder?: boolean; merah?: boolean; type?: 'button' | 'submit'
}) {
  return (
    <button type={type} className={`m-tombol ${sekunder ? 'sekunder' : ''} ${merah ? 'merah' : ''}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function Isian({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="m-isian">
      <span>{label}</span>
      <input {...props} />
    </label>
  )
}

export function Bar({ nilai, warna = 'var(--m-oranye)' }: { nilai: number; warna?: string }) {
  return (
    <div className="m-bar" style={{ background: `color-mix(in srgb, ${warna} 20%, transparent)` }}>
      <div style={{ width: `${Math.max(5, Math.min(100, nilai))}%`, background: warna }} />
    </div>
  )
}

export function KotakCentang({ selesai }: { selesai: boolean }) {
  return <span className={`m-centang ${selesai ? 'on' : ''}`}>{selesai ? '✓' : ''}</span>
}

// ------------------------------------------------------------------ bottom navigation

export type Tab = 'beranda' | 'progress' | 'pipit' | 'laporan' | 'akun'
const TABS: { id: Tab; nama: string; ikon: ReactNode }[] = [
  { id: 'beranda', nama: 'Beranda', ikon: <img src={navBeranda} alt="" /> },
  { id: 'progress', nama: 'Progress', ikon: <img src={navProgress} alt="" /> },
  { id: 'pipit', nama: 'Kak Pipit', ikon: <span className="m-nav-pipit"><img src={burung} alt="" /></span> },
  { id: 'laporan', nama: 'Laporan', ikon: <img src={navLaporan} alt="" /> },
  { id: 'akun', nama: 'Akun', ikon: <img src={navAkun} alt="" /> },
]

export function NavBawah({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="m-nav">
      {TABS.map((t) => (
        <button key={t.id} className={`${tab === t.id ? 'on' : ''} ${t.id === 'pipit' ? 'tengah' : ''}`} onClick={() => onTab(t.id)}>
          <i className="m-nav-garis" />
          {t.ikon}
          <span>{t.nama}</span>
        </button>
      ))}
    </nav>
  )
}

// ------------------------------------------------------------------ CustomAppPopup & TopToastBanner

/** Popup berbingkai kuning. Popup pesan biasa (tanpa children) memakai gambar burung. */
export function Popup({ judul, pesan, onOk, children }: { judul?: string; pesan?: string; onOk?: () => void; children?: ReactNode }) {
  return (
    <div className="m-popup-latar" role="dialog" aria-modal="true">
      <div className="m-popup">
        {!children && <img src={burung} alt="" className="m-popup-logo" />}
        {judul && <b className="m-popup-judul">{judul}</b>}
        {pesan && <p className="m-popup-pesan">{pesan}</p>}
        {children ?? <Tombol onClick={onOk}>OK</Tombol>}
      </div>
    </div>
  )
}

export type DataToast = { judul: string; pesan: string } | null

export function Toast({ data, onTutup }: { data: DataToast; onTutup: () => void }) {
  useEffect(() => {
    if (!data) return
    const t = setTimeout(onTutup, 4500)
    return () => clearTimeout(t)
  }, [data, onTutup])
  if (!data) return null
  return (
    <div className="m-toast" role="status" onClick={onTutup}>
      <span className="m-toast-ikon"><img src={burung} alt="" /></span>
      <div>
        <b>{data.judul}</b>
        <p>{data.pesan}</p>
      </div>
    </div>
  )
}
