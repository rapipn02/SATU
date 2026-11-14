/**
 * Gambar di atas Cermin Ajaib: titik bibir anak (dari MediaPipe), titik bibir acuan
 * (bentuk target dari tutorial Mata, diselaraskan ke mulut anak), dan panah arahan
 * per titik sesuai petunjuk aturan Mata. Kanvas dicerminkan lewat CSS seperti videonya,
 * jadi semua koordinat di sini memakai koordinat video asli.
 */
import {
  DALAM_ATAS, DALAM_BAWAH, koordinatBentuk, LUAR_ATAS, LUAR_BAWAH,
  type BentukTutorial, type Bunyi, type Keadaan, type Titik,
} from './mata'

export const BENTUK: Record<Bunyi, BentukTutorial> = {
  a: 'a', i: 'i', u: 'u', e: 'e', o: 'o', M: 'katup', F: 'gigi_bibir', H: 'hembusan', S: 'desis', T: 'lidah',
}

// Pada bentuk tutorial, lebar mulut netral = 0,6 kotak (lebar 0,3 dari pusat ke sudut).
const LEBAR_NETRAL_TUTORIAL = 0.6
/** Lebar mulut diam dibanding jarak sudut luar mata (33-263). Diganti hasil ukur saat kalibrasi. */
export const RASIO_MULUT_BAWAAN = 0.55

const WARNA = { cocok: '#2fb84a', belum: '#ff8a3d', diam: '#ffffff', acuan: '#2f6fe4', panah: '#ffd400' }

type Px = { x: number; y: number }

/** Koordinat video 0-1 ke piksel kanvas, mengikuti video `object-fit: cover`. */
function pemeta(video: HTMLVideoElement, kanvas: HTMLCanvasElement) {
  const vw = video.videoWidth || 640
  const vh = video.videoHeight || 480
  const s = Math.max(kanvas.width / vw, kanvas.height / vh)
  const ox = (kanvas.width - vw * s) / 2
  const oy = (kanvas.height - vh * s) / 2
  return (t: Titik): Px => ({ x: ox + t.x * vw * s, y: oy + t.y * vh * s })
}

const jarak = (a: Px, b: Px) => Math.hypot(a.x - b.x, a.y - b.y)

function kontur(ctx: CanvasRenderingContext2D, p: (i: number) => Px | undefined, atas: readonly number[], bawah: readonly number[]) {
  const urut = [...atas, ...[...bawah].reverse().slice(1, -1)].map(p).filter((q): q is Px => !!q)
  if (urut.length < 3) return
  ctx.beginPath()
  ctx.moveTo(urut[0].x, urut[0].y)
  for (const q of urut.slice(1)) ctx.lineTo(q.x, q.y)
  ctx.closePath()
}

function panah(ctx: CanvasRenderingContext2D, dari: Px, arah: Px, panjang: number) {
  const n = Math.hypot(arah.x, arah.y) || 1
  const ux = arah.x / n
  const uy = arah.y / n
  const ke = { x: dari.x + ux * panjang, y: dari.y + uy * panjang }
  const sayap = panjang * 0.45
  ctx.beginPath()
  ctx.moveTo(dari.x, dari.y)
  ctx.lineTo(ke.x, ke.y)
  ctx.moveTo(ke.x, ke.y)
  ctx.lineTo(ke.x - ux * sayap - uy * sayap * 0.6, ke.y - uy * sayap + ux * sayap * 0.6)
  ctx.moveTo(ke.x, ke.y)
  ctx.lineTo(ke.x - ux * sayap + uy * sayap * 0.6, ke.y - uy * sayap - ux * sayap * 0.6)
  ctx.stroke()
}

/**
 * Panah di titik bibir untuk tiap petunjuk aturan Mata.
 * Titik: 61/291 sudut mulut, 0/17 tengah bibir luar atas/bawah, 13/14 tengah bibir dalam.
 */
function arahan(petunjuk: Keadaan['petunjuk'], p: (i: number) => Px | undefined, pusat: Px): [Px, Px][] {
  const at = (i: number) => p(i)
  const keluar = (i: number): [Px, Px] | null => { const q = at(i); return q ? [q, { x: q.x - pusat.x, y: 0 }] : null }
  const masuk = (i: number): [Px, Px] | null => { const q = at(i); return q ? [q, { x: pusat.x - q.x, y: 0 }] : null }
  const naik = (i: number): [Px, Px] | null => { const q = at(i); return q ? [q, { x: 0, y: -1 }] : null }
  const turun = (i: number): [Px, Px] | null => { const q = at(i); return q ? [q, { x: 0, y: 1 }] : null }
  const daftar: ([Px, Px] | null)[] = (() => {
    switch (petunjuk) {
      case 'buka_lebar':
      case 'buka_sedikit':
      case 'buka_mulut':
        return [turun(17), naik(0)] // rahang turun, bibir terbuka
      case 'tutup_sedikit':
        return [naik(17)]
      case 'tarik_samping':
      case 'jangan_bulatkan':
        return [keluar(61), keluar(291)]
      case 'kerucutkan':
      case 'bulatkan':
        return [masuk(61), masuk(291)]
      case 'rapatkan':
        return [turun(13), naik(14)]
      case 'gigi_ke_bibir':
      case 'gigi_rapat':
        return [naik(14)]
      default:
        return []
    }
  })()
  return daftar.filter((d): d is [Px, Px] => !!d)
}

export interface GambarCermin {
  titik: Record<number, Titik> | null
  /** Bunyi yang sedang dikerjakan; null = belum mencoba. */
  target: Bunyi | null
  keadaan: Keadaan | null
  /** Lebar mulut diam / jarak sudut luar mata, untuk mengukur besar bibir acuan. */
  rasioMulut: number
}

export function gambarCermin(kanvas: HTMLCanvasElement, video: HTMLVideoElement, g: GambarCermin) {
  const ctx = kanvas.getContext('2d')
  if (!ctx) return
  // Ukuran kanvas mengikuti ukuran tampilnya, supaya titik tidak buram atau bergeser.
  const w = kanvas.clientWidth
  const h = kanvas.clientHeight
  if (kanvas.width !== w || kanvas.height !== h) { kanvas.width = w; kanvas.height = h }
  ctx.clearRect(0, 0, w, h)
  if (!g.titik) return

  const ke = pemeta(video, kanvas)
  const p = (i: number) => (g.titik?.[i] ? ke(g.titik[i]) : undefined)
  const kiri = p(61)
  const kanan = p(291)
  const atas = p(0)
  const bawah = p(17)
  const mataKiri = p(33)
  const mataKanan = p(263)
  if (!kiri || !kanan || !atas || !bawah || !mataKiri || !mataKanan) return
  const pusat = { x: (kiri.x + kanan.x) / 2, y: (atas.y + bawah.y) / 2 }
  const lebarDiam = jarak(mataKiri, mataKanan) * g.rasioMulut
  const ukur = Math.max(4, lebarDiam / 22)

  // 1) Titik acuan: bentuk target, berpusat di mulut anak, sebesar mulut anak saat diam.
  if (g.target) {
    const acuan = koordinatBentuk(BENTUK[g.target])
    const skala = lebarDiam / LEBAR_NETRAL_TUTORIAL
    const pa = (i: number) => {
      const q = acuan[i]
      return q ? { x: pusat.x + (q.x - 0.5) * skala, y: pusat.y + (q.y - 0.5) * skala } : undefined
    }
    ctx.setLineDash([ukur, ukur * 0.8])
    ctx.lineWidth = Math.max(2, ukur * 0.45)
    ctx.strokeStyle = WARNA.acuan
    kontur(ctx, pa, LUAR_ATAS, LUAR_BAWAH)
    ctx.stroke()
    kontur(ctx, pa, DALAM_ATAS, DALAM_BAWAH)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = WARNA.acuan
    for (const i of [...LUAR_ATAS, ...LUAR_BAWAH]) {
      const q = pa(i)
      if (q) { ctx.beginPath(); ctx.arc(q.x, q.y, ukur * 0.35, 0, Math.PI * 2); ctx.fill() }
    }
  }

  // 2) Titik bibir anak: hijau kalau bentuk sudah pas, oranye kalau belum, putih kalau belum mencoba.
  const warna = !g.target || !g.keadaan ? WARNA.diam : g.keadaan.cocok ? WARNA.cocok : WARNA.belum
  ctx.strokeStyle = warna
  ctx.lineWidth = Math.max(2, ukur * 0.4)
  kontur(ctx, p, LUAR_ATAS, LUAR_BAWAH)
  ctx.stroke()
  kontur(ctx, p, DALAM_ATAS, DALAM_BAWAH)
  ctx.stroke()
  ctx.fillStyle = warna
  for (const i of [...LUAR_ATAS, ...LUAR_BAWAH, ...DALAM_ATAS, ...DALAM_BAWAH]) {
    const q = p(i)
    if (q) { ctx.beginPath(); ctx.arc(q.x, q.y, ukur * 0.45, 0, Math.PI * 2); ctx.fill() }
  }

  // 3) Panah arahan di titik yang harus digerakkan (hanya saat bentuk belum pas).
  if (g.keadaan && !g.keadaan.cocok) {
    ctx.strokeStyle = WARNA.panah
    ctx.lineWidth = Math.max(3, ukur * 0.7)
    ctx.lineCap = 'round'
    for (const [dari, arah] of arahan(g.keadaan.petunjuk, p, pusat)) panah(ctx, dari, arah, lebarDiam * 0.45)
  }
}

/** Lebar mulut / jarak sudut mata dari satu frame (dipakai saat kalibrasi, mulut diam). */
export function rasioDariTitik(titik: Record<number, Titik> | null): number | null {
  const a = titik?.[61], b = titik?.[291], c = titik?.[33], d = titik?.[263]
  if (!a || !b || !c || !d) return null
  const mata = Math.hypot(c.x - d.x, c.y - d.y)
  return mata > 0 ? Math.hypot(a.x - b.x, a.y - b.y) / mata : null
}
