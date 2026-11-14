import { useEffect, useState } from 'react'
import { api, ApiError, DEVICE_TOKEN, type StudentCard, type StudentSession } from '../api'
import { PIN_IMAGES, PIN_NUMBERS } from '../pin'
import { Avatar } from './Avatar'

export function PinGambar({
  student, index, onDone, onBack,
}: {
  student: StudentCard
  index: number
  onDone: (s: StudentSession) => void
  onBack: () => void
}) {
  const [pin, setPin] = useState<number[]>([])
  const [wrong, setWrong] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(student.isLocked)
  const [called, setCalled] = useState(false)

  // Terkunci: guru membukanya dari aplikasi guru, jadi cek tiap 5 detik sampai terbuka.
  useEffect(() => {
    if (!locked) return
    const timer = setInterval(async () => {
      try {
        const list = await api<StudentCard[]>('/classroom/students', { token: DEVICE_TOKEN })
        if (list.find((s) => s.id === student.id)?.isLocked === false) {
          setLocked(false)
          setCalled(false)
          setPin([])
        }
      } catch {
        /* coba lagi pada putaran berikutnya */
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [locked, student.id])

  async function tap(n: number) {
    if (busy || pin.length >= 3) return // gambar yang sama boleh dipilih lagi (mis. bintang, bintang, bintang)
    const next = [...pin, n]
    setPin(next)
    setError('')
    if (next.length < 3) return
    setBusy(true)
    try {
      const res = await api<{ token: string; student: StudentCard }>('/auth/student/login', {
        token: DEVICE_TOKEN,
        body: { studentId: student.id, picturePassword: next },
      })
      onDone({ token: res.token, student: res.student })
    } catch (e) {
      const err = e as ApiError
      if (err.status === 403) setLocked(true)
      else setError(err.status === 401 ? 'PIN salah, coba lagi' : err.message)
      setWrong(true)
      setTimeout(() => { setWrong(false); setPin([]); setBusy(false) }, 800)
    }
  }

  if (locked) {
    return (
      <div className="page">
        <div className="bar-atas">
          <button className="kembali" onClick={onBack} aria-label="Kembali">←</button>
          <h1 className="title">PIN GAMBAR</h1>
        </div>
        <div className="panel">
          <div className="terkunci">
            <svg viewBox="0 0 24 24" className="gembok-besar" aria-hidden="true">
              <path d="M7 10V7a5 5 0 0 1 10 0v3h1.5A1.5 1.5 0 0 1 20 11.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5v-9A1.5 1.5 0 0 1 5.5 10zm2 0h6V7a3 3 0 0 0-6 0z" />
            </svg>
            <b>Minta Bantuan Guru</b>
            {called && <p className="badge">Tunjukkan layar ini ke gurumu ya.</p>}
            <button className="btn" onClick={() => setCalled(true)}>Panggil Guru</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="bar-atas">
        <button className="kembali" onClick={onBack} aria-label="Kembali">←</button>
        <h1 className="title">PIN GAMBAR</h1>
      </div>
      <div className="panel">
        <div className="pin-wrap">
          <div className="pin-profil">
            <Avatar student={student} index={index} />
            <b>{student.nickname}</b>
            <div className={`slots ${wrong ? 'shake' : ''}`}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={`slot ${pin[i] ? (wrong ? 'salah' : 'isi') : ''}`}>
                  {pin[i] && !wrong && <img src={PIN_IMAGES[pin[i]]} alt="" />}
                </div>
              ))}
            </div>
            <p className="error">{error}</p>
          </div>
          <div className="pin-grid">
            {PIN_NUMBERS.map((n) => (
              <button key={n} className="pin-btn" disabled={busy} onClick={() => tap(n)} aria-label={`Gambar ${n}`}>
                <img src={PIN_IMAGES[n]} alt="" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
