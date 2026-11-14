import { CategoryScale, Chart, Filler, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js'
import { useEffect, useRef, useState } from 'react'
import type { Anak, Grafik, LaporanMingguan, LevelPeta, SesiOrtu, Streak, Tugas } from './data'
import { bintangPeta, KartuStatus, KATEGORI, statusLatihan, type Api } from './Beranda'
import { Bar, Header, IkonAkun, Kartu, Tombol } from './ui'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

/** ParentProgressScreen: Sudah Bisa (3 bintang) dan Hampir Bisa (1-2 bintang) dari peta anak. */
export function Progress({ apiO, anak, onLaporan }: { apiO: Api; anak: Anak; onLaporan: () => void }) {
  const [peta, setPeta] = useState<LevelPeta[] | null>(null)
  useEffect(() => { apiO<LevelPeta[]>(`/parent/children/${anak.id}/progress`).then(setPeta).catch(() => {}) }, [apiO, anak.id])
  const [bisa, hampir] = statusLatihan(peta, [])
  return (
    <Header judul="Progres">
      <div className="m-tumpuk">
        {[bisa, hampir].map((s) => <KartuStatus key={s.nama} status={s} memuat={peta === null} />)}
        <Tombol onClick={onLaporan}>Lihat Laporan</Tombol>
      </div>
    </Header>
  )
}

// Kuning tua (kontras 3:1 di atas putih) untuk garis; kuning tema untuk isian di bawah garis.
const GARIS = '#b07c00'

/** Akurasi bicara per hari (Chart.js). Hari tanpa latihan = celah, bukan 0%. */
function GrafikAkurasi({ g }: { g: Grafik }) {
  const kanvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const latihan = g.series.attempts
    const grafik = new Chart(kanvas.current!, {
      type: 'line',
      data: {
        labels: g.labels.map((l) => l.split(' ')[0]),
        datasets: [{
          data: g.series.accuracy.map((v, i) => (latihan[i] ? v : null)),
          borderColor: GARIS,
          backgroundColor: 'rgba(247, 203, 80, 0.28)',
          fill: 'origin',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: GARIS,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        font: { family: 'Poppins, system-ui, sans-serif' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#222',
            displayColors: false,
            callbacks: {
              title: (t) => g.labels[t[0].dataIndex],
              label: (t) => (latihan[t.dataIndex] ? `Akurasi ${t.parsed.y}% · ${latihan[t.dataIndex]} latihan` : 'Tidak latihan'),
            },
          },
        },
        scales: {
          y: {
            min: 0, max: 100,
            ticks: { stepSize: 50, callback: (v) => `${v}%`, color: '#888', font: { size: 11 } },
            grid: { color: '#f1ead8' },
            border: { display: false },
          },
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#888', font: { size: 11 } } },
        },
      },
    })
    return () => grafik.destroy()
  }, [g])
  return <div className="m-grafik"><canvas ref={kanvas} role="img" aria-label="Grafik akurasi bicara per hari" /></div>
}

/** ParentReportScreen: ringkasan, grafik, penguasaan per level, catatan minggu ini. */
export function Laporan({ apiO, anak, onKembali }: { apiO: Api; anak: Anak; onKembali?: () => void }) {
  const [grafik, setGrafik] = useState<Grafik | null>(null)
  const [streak, setStreak] = useState<Streak | null>(null)
  const [peta, setPeta] = useState<LevelPeta[] | null>(null)
  const [tugas, setTugas] = useState<Tugas[]>([])
  const [ai, setAi] = useState<LaporanMingguan | null>(null)

  useEffect(() => {
    apiO<Grafik>(`/parent/children/${anak.id}/chart?days=7`).then(setGrafik).catch(() => {})
    apiO<Streak>(`/parent/children/${anak.id}/streak`).then(setStreak).catch(() => {})
    apiO<LevelPeta[]>(`/parent/children/${anak.id}/progress`).then(setPeta).catch(() => {})
    apiO<Tugas[]>(`/parent/children/${anak.id}/homework?status=assigned`).then(setTugas).catch(() => {})
    apiO<LaporanMingguan>(`/parent/children/${anak.id}/weekly-report`).then(setAi).catch(() => {})
  }, [apiO, anak.id])

  // Penguasaan per kategori peta: sudah bisa (≥ 1 bintang), sedang dilatih (ada di tugas aktif), belum.
  const bintang = bintangPeta(peta)
  const diTugas = new Set(tugas.flatMap((t) => t.items.filter((i) => !i.completedAt).map((i) => i.item)))

  return (
    <Header judul={`Laporan ${anak.nickname}`} onKembali={onKembali}>
      <div className="m-tumpuk">
        <div className="m-tiga">
          <Kartu className="tengah"><b className="m-angka">{grafik ? `${grafik.summary.practiceDays}/7` : '–'}</b><span className="m-teks kecil">Hari latihan</span></Kartu>
          <Kartu className="tengah"><b className="m-angka">{anak.totalPoints}</b><span className="m-teks kecil">Poin</span></Kartu>
          <Kartu className="tengah"><b className="m-angka">{streak?.current ?? 0} hari</b><span className="m-teks kecil">Streak</span></Kartu>
        </div>

        <Kartu>
          <b className="m-kartu-judul">Perkembangan Bicara</b>
          <span className="m-teks kecil">Akurasi rata-rata per hari, 7 hari terakhir</span>
          {!grafik && <p className="m-teks">Memuat grafik…</p>}
          {grafik && grafik.summary.attempts === 0 && <p className="m-teks">Belum ada latihan dalam 7 hari terakhir.</p>}
          {grafik && grafik.summary.attempts > 0 && <GrafikAkurasi g={grafik} />}
        </Kartu>

        <b className="m-subjudul">Penguasaan per Level</b>
        {KATEGORI.map((k) => {
          const bisa = k.items.filter((h) => (bintang.get(h.id) ?? 0) > 0).length
          const pct = Math.round((bisa * 100) / k.items.length)
          return (
            <Kartu key={k.id}>
              <div className="m-baris">
                <b>{k.nama}</b>
                <b className="m-teks oranye">{bisa}/{k.items.length} · {pct}%</b>
              </div>
              <Bar nilai={pct} />
              <div className="m-chip">
                {k.items.map((h) => {
                  const b = bintang.get(h.id) ?? 0
                  return <span key={h.id} className={b > 0 ? 'bisa' : diTugas.has(h.id) ? 'latih' : ''}>{h.label}{b > 0 ? ` ${'★'.repeat(b)}` : ''}</span>
                })}
              </div>
            </Kartu>
          )
        })}
        <p className="m-teks kecil">Kuning = sudah bisa (★ bintang terbaik) · bingkai kuning = sedang dilatih di tugas · abu = belum dilatih</p>

        <Kartu>
          <b className="m-kartu-judul">Catatan Minggu Ini</b>
          {!ai && <p className="m-teks">Sedang disusun…</p>}
          {ai && (
            <dl className="m-catatan">
              <dt>Sudah bisa</dt><dd>{ai.achieved}</dd>
              <dt>Sedang dilatih</dt><dd>{ai.practising}</dd>
              <dt>Cara membantu di rumah</dt><dd>{ai.howToHelp}</dd>
            </dl>
          )}
          {ai && <span className="m-teks kecil">{ai.source === 'ai' ? 'Disusun AI dari data latihan' : 'Ringkasan otomatis dari data latihan'} · {ai.practiceDays} hari latihan minggu ini</span>}
        </Kartu>
      </div>
    </Header>
  )
}

/** ParentAkunScreen: Keluar butuh konfirmasi (Keluar / Batal). */
export function Akun({ sesi, onKeluar }: { sesi: SesiOrtu; onKeluar: () => void }) {
  const [yakin, setYakin] = useState(false)
  return (
    <Header judul="Akun">
      <div className="m-tumpuk">
        {!yakin && (
          <Kartu>
            <div className="m-baris kiri">
              <span className="m-ikon-akun"><IkonAkun size={32} /></span>
              <div>
                <b className="m-teks-besar">{sesi.nama}</b>
                <p className="m-teks">{sesi.email}</p>
              </div>
            </div>
          </Kartu>
        )}
      </div>
      <div className="m-bawah">
        {yakin ? (
          <>
            <Tombol merah onClick={onKeluar}>Keluar</Tombol>
            <Tombol sekunder onClick={() => setYakin(false)}>Batal</Tombol>
          </>
        ) : (
          <Tombol merah onClick={() => setYakin(true)}>Keluar</Tombol>
        )}
      </div>
    </Header>
  )
}
