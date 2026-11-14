import { useEffect, useState } from 'react'
import { api, DEVICE_TOKEN, type StudentCard } from '../api'
import { Avatar } from './Avatar'

export function PilihKarakter({ onPick }: { onPick: (s: StudentCard, index: number) => void }) {
  const [students, setStudents] = useState<StudentCard[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    api<StudentCard[]>('/classroom/students', { token: DEVICE_TOKEN })
      .then((s) => live && setStudents(s))
      .catch((e) => live && setError(e.status === 401 ? 'Perangkat ini belum diatur. Minta guru mengisi token kelas.' : e.message))
    return () => { live = false }
  }, [])

  return (
    <div className="page tengah-layar">
      <h1 className="title">PILIH KARAKTER</h1>
      <div className="panel">
        {error && <p className="error">{error}</p>}
        {students?.length === 0 && <p className="error">Belum ada anak di kelas ini.</p>}
        <div className="grid-karakter">
          {students?.map((s, i) => (
            <button key={s.id} className={`karakter ${s.isLocked ? 'locked' : ''}`} onClick={() => onPick(s, i)}>
              {s.isLocked && <span className="gembok">🔒</span>}
              <Avatar student={s} index={i} />
              {s.nickname}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
