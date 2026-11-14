import { useState } from 'react'
import { api, type LevelItem, type LevelView, type StudentCard, type StudentSession } from './api'
import { PilihKarakter } from './screens/PilihKarakter'
import { Kategori } from './screens/Kategori'
import { MariBerlatih } from './screens/MariBerlatih'
import { Peta } from './screens/Peta'
import { PinGambar } from './screens/PinGambar'
import { TokoHadiah } from './screens/TokoHadiah'
import { OrtuApp } from './ortu/OrtuApp'

// /ortu dan /undangan/<token> = aplikasi orang tua; alamat lain = mode kelas (web anak).
const ORTU = /^\/(ortu|undangan)(\/|$)/.test(location.pathname)

export default function App() {
  return ORTU ? <OrtuApp /> : <AppAnak />
}

function AppAnak() {
  const [picked, setPicked] = useState<{ student: StudentCard; index: number } | null>(null)
  const [kid, setKid] = useState<StudentSession | null>(null)
  const [levels, setLevels] = useState<LevelView[]>([])
  const [kategori, setKategori] = useState<string | null>(null)
  const [latihan, setLatihan] = useState<LevelItem[] | null>(null)
  const [toko, setToko] = useState(false)

  if (kid && toko) return <TokoHadiah session={kid} onBack={() => setToko(false)} />
  if (kid && latihan) {
    // Setelah latihan, ambil ulang peta supaya bintang di lingkaran ikut terbaru.
    const keluar = () => {
      setLatihan(null)
      void api<LevelView[]>('/levels', { token: kid.token }).then(setLevels).catch(() => {})
    }
    return <MariBerlatih token={kid.token} items={latihan} onBack={keluar} />
  }
  if (kid && kategori) {
    return (
      <Kategori
        kategori={kategori}
        levels={levels}
        onPick={(items) => setLatihan(items)}
        onBack={() => setKategori(null)}
      />
    )
  }
  if (kid) {
    return (
      <Peta
        session={kid}
        levels={levels}
        onLevels={setLevels}
        onPick={(t) => setKategori(t.kategori)}
        onToko={() => setToko(true)}
        onBack={() => { setKid(null); setPicked(null) }}
      />
    )
  }

  if (picked) {
    return <PinGambar student={picked.student} index={picked.index} onDone={setKid} onBack={() => setPicked(null)} />
  }
  return <PilihKarakter onPick={(student, index) => setPicked({ student, index })} />
}
