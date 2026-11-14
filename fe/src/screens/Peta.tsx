import { useEffect, useState } from 'react'
import { api, type LevelView, type Profile, type StudentSession } from '../api'
import garis from '../assets/Vector 2.png'

// 4 titik pada gambar garis (992 x 457), dalam persen. Urutan = urutan kategori level.
const TITIK = [
  { kategori: 'vokal', nama: 'Huruf Vokal', x: 9.6, y: 1 },
  { kategori: 'konsonan', nama: 'Huruf Konsonan', x: 20.7, y: 84.9 },
  { kategori: 'suku_kata', nama: 'Suku Kata', x: 52.4, y: 42.7 },
  { kategori: 'kata', nama: 'Kata 2 Suku Kata', x: 95.6, y: 73.1 },
] as const

export { TITIK }
export function Peta({ session, levels, onLevels, onPick, onBack, onToko }: {
  session: StudentSession
  levels: LevelView[]
  onLevels: (l: LevelView[]) => void
  onPick: (kategori: (typeof TITIK)[number]) => void
  onBack: () => void
  onToko: () => void
}) {
  const [poin, setPoin] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = session.token
    Promise.all([api<LevelView[]>('/levels', { token }), api<Profile>('/me/student', { token })])
      .then(([l, p]) => { onLevels(l); setPoin(p.totalPoints) })
      .catch((e) => setError(e.message))
  }, [session.token, onLevels])

  // Satu titik di peta = satu kategori; terbuka kalau ada level di dalamnya yang terbuka.
  const terbuka = (kategori: string) => levels.length === 0 || levels.some((l) => l.category === kategori && l.unlocked)

  return (
    <div className="page peta">
      <div className="bar-atas tengah">
        <button className="kembali garis" onClick={onBack} aria-label="Kembali">←</button>
        <h1 className="title">PETA PETUALANGAN</h1>
        <button className="troli" onClick={onToko} aria-label="Toko hadiah">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 3.5h2.6l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.2l1.6-6.8H6.1" />
            <circle cx="9.5" cy="20" r="1.4" />
            <circle cx="17.5" cy="20" r="1.4" />
          </svg>
        </button>
      </div>
      <div className="panel">
        <div className="peta-kartu">
          {poin !== null && <div className="poin">★ {poin}</div>}
          {error && <p className="error">{error}</p>}

          <div className="peta-jalur">
            <img src={garis} alt="" draggable={false} />
            {TITIK.map((t) => (
              <button key={t.kategori} className={`node ${terbuka(t.kategori) ? '' : 'terkunci-level'}`} disabled={!terbuka(t.kategori)} onClick={() => onPick(t)} style={{ left: `${t.x}%`, top: `${t.y}%` }}>
                <div className="lingkaran" />
                <span className="label-level">{t.nama}</span>
              </button>
            ))}
          </div>

          <div className="peta-grid">
            {TITIK.map((t) => (
              <button key={t.kategori} className={`node ${terbuka(t.kategori) ? '' : 'terkunci-level'}`} disabled={!terbuka(t.kategori)} onClick={() => onPick(t)}>
                <div className="lingkaran" />
                <span className="label-level">{t.nama}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
