import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api'
import burung from '../assets/ortu/burung.png'
import type { Api } from './Beranda'
import type { Anak } from './data'
import { KepalaKuning } from './ui'

/**
 * Kak Pipit: chatbot orang tua. Jawaban dari agent "tanya progres" di layanan ML: LLM yang hanya boleh
 * memakai data latihan anak, menolak soal kesehatan/diagnosis, dan jatuh ke ringkasan templat bila
 * jawabannya tidak lolos pagar. Tiap pertanyaan dijawab sendiri-sendiri (agent tidak membaca obrolan sebelumnya).
 */

type Pesan = { dari: 'saya' | 'pipit'; teks: string; galat?: boolean }

// Obrolan per anak bertahan selama tab terbuka (pindah menu tidak menghapusnya).
const riwayat = new Map<string, Pesan[]>()

// Pertanyaan saran: 4 pertama tampil di awal; setelah tiap jawaban tampil 3 yang belum ditanyakan.
const saran = (nama: string) => [
  `Bunyi apa yang sudah dikuasai ${nama}?`,
  `Bunyi apa yang paling sulit untuk ${nama}?`,
  `Bagaimana cara membantu ${nama} latihan di rumah?`,
  `Berapa hari ${nama} berlatih minggu ini?`,
  `Latihan apa yang cocok untuk ${nama} hari ini?`,
  `Bagaimana perkembangan ${nama} minggu ini?`,
  `Apa yang perlu saya perhatikan saat ${nama} latihan?`,
  `Kenapa bunyi tertentu masih sulit untuk ${nama}?`,
]

function saranBerikutnya(nama: string, pesan: Pesan[]) {
  const sudah = new Set(pesan.filter((p) => p.dari === 'saya').map((p) => p.teks))
  const sisa = saran(nama).filter((s) => !sudah.has(s))
  return pesan.length === 0 ? sisa.slice(0, 4) : sisa.slice(0, 3)
}

export function Pipit({ apiO, anak }: { apiO: Api; anak: Anak }) {
  const [pesan, setPesan] = useState<Pesan[]>(() => riwayat.get(anak.id) ?? [])
  const [tulis, setTulis] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const bawah = useRef<HTMLDivElement>(null)

  useEffect(() => setPesan(riwayat.get(anak.id) ?? []), [anak.id])
  useEffect(() => {
    riwayat.set(anak.id, pesan)
    bawah.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [pesan, sibuk, anak.id])

  async function tanya(teks: string) {
    const q = teks.trim()
    if (q.length < 3 || sibuk) return
    setPesan((p) => [...p, { dari: 'saya', teks: q }])
    setTulis('')
    setSibuk(true)
    try {
      const r = await apiO<{ answer: string; writer: string | null }>(`/parent/children/${anak.id}/ask`, { body: { question: q } })
      // LLM tidak tersambung / jawabannya tidak lolos pagar: ML mengirim ringkasan templat yang sama untuk
      // pertanyaan apa pun. Katakan terus terang supaya orang tua tidak mengira itu jawaban atas pertanyaannya.
      const teks = r.writer === 'llm' ? r.answer
        : `Kak Pipit belum bisa menjawab pertanyaan itu sekarang. Ini ringkasan latihan ${anak.nickname} terbaru:\n\n${r.answer}`
      setPesan((p) => [...p, { dari: 'pipit', teks }])
    } catch (e) {
      const teksGalat = e instanceof ApiError && e.status === 429
        ? e.message
        : 'Maaf, Kak Pipit belum bisa menjawab sekarang. Coba kirim lagi sebentar lagi, ya.'
      setPesan((p) => [...p, { dari: 'pipit', teks: teksGalat, galat: true }])
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="m-layar">
      <KepalaKuning kecil />
      <div className="m-lembar rapat m-obrolan">
        <h1 className="m-judul">Tanya Kak Pipit</h1>
        <p className="m-teks kecil tengah">Teman Ayah dan Bunda untuk memahami latihan bicara {anak.nickname}.</p>

        <div className="m-pesan-daftar" aria-live="polite">
          <Gelembung dari="pipit">
            Halo, Ayah/Bunda! Aku Kak Pipit. Aku sudah membaca catatan latihan {anak.nickname}. Mau tahu apa hari ini?
          </Gelembung>

          {pesan.map((p, i) => <Gelembung key={i} dari={p.dari} galat={p.galat}>{p.teks}</Gelembung>)}
          {sibuk && (
            <Gelembung dari="pipit">
              <span className="m-ketik" aria-label="Kak Pipit sedang mengetik"><i /><i /><i /></span>
            </Gelembung>
          )}

          {!sibuk && (
            <div className="m-saran-tanya">
              {pesan.length > 0 && <span className="m-teks kecil">Tanya lagi:</span>}
              {saranBerikutnya(anak.nickname, pesan).map((s) => <button key={s} onClick={() => void tanya(s)}>{s}</button>)}
            </div>
          )}
          <div ref={bawah} />
        </div>

        <form className="m-kirim" onSubmit={(e) => { e.preventDefault(); void tanya(tulis) }}>
          <input
            value={tulis}
            onChange={(e) => setTulis(e.target.value)}
            placeholder={`Tanya tentang ${anak.nickname}…`}
            maxLength={300}
            aria-label="Pertanyaan untuk Kak Pipit"
          />
          <button type="submit" disabled={sibuk || tulis.trim().length < 3} aria-label="Kirim">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 12h13M12 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
        <p className="m-teks kecil tengah">Kak Pipit menjawab dari catatan latihan. Untuk soal kesehatan pendengaran, tanyakan ke guru atau terapis wicara.</p>
      </div>
    </div>
  )
}

function Gelembung({ dari, galat, children }: { dari: Pesan['dari']; galat?: boolean; children: React.ReactNode }) {
  return (
    <div className={`m-gelembung ${dari} ${galat ? 'galat' : ''}`}>
      {dari === 'pipit' && <img src={burung} alt="" />}
      <p>{children}</p>
    </div>
  )
}
