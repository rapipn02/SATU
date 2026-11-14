import { useState } from 'react'
import type { StudentCard } from '../api'

const COLORS = ['#2f6fe4', '#ff8a3d', '#2fa866', '#a35bd9', '#e03a3e', '#17a2b8']

export function Avatar({ student, index }: { student: StudentCard; index: number }) {
  // Foto yang gagal dimuat (link rusak) diganti ikon orang, bukan gambar rusak.
  const [gagal, setGagal] = useState<string | null>(null)
  const foto = student.photoUrl && student.photoUrl !== gagal ? student.photoUrl : null
  return (
    <div className="avatar" style={{ background: COLORS[index % COLORS.length] }}>
      {foto ? (
        <img src={foto} alt="" onError={() => setGagal(foto)} />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="4.2" />
          <path d="M3.5 21c0-4.7 3.8-7.5 8.5-7.5s8.5 2.8 8.5 7.5z" />
        </svg>
      )}
    </div>
  )
}
