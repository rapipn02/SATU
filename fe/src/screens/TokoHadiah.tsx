import { useEffect, useState } from 'react'
import { api, type StudentSession } from '../api'

// Gambar hadiah dari aset lokal, dipilih dari nama hadiah (guru mengisi nama di aplikasi guru).
const aset = import.meta.glob('../assets/store/*.png', { eager: true, import: 'default' }) as Record<string, string>
const gambar = (kunci: string) => Object.entries(aset).find(([p]) => p.includes(kunci))?.[1]
const GAMBAR: [RegExp, string | undefined][] = [
  [/pensil|pencil/i, gambar('pencil')],
  [/buku|book/i, gambar('book')],
  [/permen|candy/i, gambar('candy')],
  [/kue|cookie|biskuit/i, gambar('cookie')],
  [/buah|apel|apple/i, gambar('apple')],
]
const gambarHadiah = (nama: string) => GAMBAR.find(([pola]) => pola.test(nama))?.[1]

interface Hadiah { id: string; name: string; imageUrl: string | null; costPoints: number; stock: number | null }
interface Toko { totalPoints: number; rewards: Hadiah[] }

export function TokoHadiah({ session, onBack }: { session: StudentSession; onBack: () => void }) {
  const [toko, setToko] = useState<Toko | null>(null)
  const [pesan, setPesan] = useState<{ teks: string; baik: boolean } | null>(null)
  const [sibuk, setSibuk] = useState<string | null>(null)

  useEffect(() => {
    api<Toko>('/rewards', { token: session.token })
      .then(setToko)
      .catch((e) => setPesan({ teks: e.message, baik: false }))
  }, [session.token])

  async function tukar(h: Hadiah) {
    setSibuk(h.id)
    setPesan(null)
    try {
      const res = await api<{ totalPoints: number }>(`/rewards/${h.id}/redeem`, { token: session.token, method: 'POST' })
      setToko((t) => t && {
        totalPoints: res.totalPoints,
        rewards: t.rewards.map((r) => (r.id === h.id && r.stock !== null ? { ...r, stock: r.stock - 1 } : r)),
      })
      setPesan({ teks: `Hore! ${h.name} sudah ditukar. Minta hadiahmu ke guru ya.`, baik: true })
    } catch (e) {
      setPesan({ teks: (e as Error).message, baik: false })
    } finally {
      setSibuk(null)
    }
  }

  return (
    <div className="page peta">
      <div className="bar-atas tengah">
        <button className="kembali garis" onClick={onBack} aria-label="Kembali">←</button>
        <h1 className="title">TOKO HADIAH</h1>
        {toko && <div className="poin-atas">★ {toko.totalPoints}</div>}
      </div>
      <div className="panel">
        <div className="peta-kartu toko-kartu">
          {pesan && <p className={`pesan-toko ${pesan.baik ? 'baik' : ''}`}>{pesan.teks}</p>}
          {toko?.rewards.length === 0 && <p className="pesan-toko">Belum ada hadiah. Minta guru menambahkannya.</p>}
          <div className="toko-grid">
            {toko?.rewards.map((h) => {
              const kurang = toko.totalPoints < h.costPoints
              const habis = h.stock !== null && h.stock <= 0
              const src = h.imageUrl ?? gambarHadiah(h.name)
              return (
                <div key={h.id} className="hadiah">
                  <span className="harga">★<small>{h.costPoints}</small></span>
                  <div className="hadiah-gambar">{src ? <img src={src} alt="" /> : <span aria-hidden="true">🎁</span>}</div>
                  <b>{h.name}</b>
                  <button className="tukar" disabled={kurang || habis || sibuk !== null} onClick={() => tukar(h)}>
                    {habis ? 'Habis' : sibuk === h.id ? 'Menukar…' : 'Tukar Hadiah'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
