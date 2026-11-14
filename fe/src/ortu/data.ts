import { api, ApiError, type LevelItem } from '../api'

/** Sesi orang tua disimpan di perangkat (token 30 hari). Penyimpanan bisa diblokir; aplikasi tetap jalan. */
export interface SesiOrtu { token: string; nama: string; email: string }

const KUNCI = 'satu.ortu'

export function muatSesi(): SesiOrtu | null {
  try {
    const s = localStorage.getItem(KUNCI)
    return s ? (JSON.parse(s) as SesiOrtu) : null
  } catch {
    return null
  }
}

export function simpanSesi(s: SesiOrtu | null) {
  try {
    if (s) localStorage.setItem(KUNCI, JSON.stringify(s))
    else localStorage.removeItem(KUNCI)
  } catch {
    /* penyimpanan diblokir: sesi hanya hidup selama tab terbuka */
  }
}

export interface Anak { id: string; nickname: string; photoUrl: string | null; totalPoints: number; classroomName: string }

export interface ItemTugas {
  id: string
  item: string
  itemText: string
  levelTitle: string
  completedAt: string | null
  attempts: number
  bestStars: number
  tutorialUrl: string | null
}
export interface Tugas {
  id: string
  dueDate: string
  note: string | null
  status: 'assigned' | 'done'
  createdAt: string
  completedAt: string | null
  items: ItemTugas[]
}

export interface Streak {
  current: number
  longest: number
  dailyTarget: number
  todayCount: number
  last7Days: { day: string; count: number; active: boolean }[]
}

export interface Grafik {
  days: number
  labels: string[]
  series: { attempts: number[]; correct: number[]; accuracy: number[]; points: number[] }
  summary: { practiceDays: number; attempts: number; correct: number; points: number; accuracy: number }
}

export interface LaporanMingguan {
  achieved: string
  practising: string
  howToHelp: string
  practiceDays: number
  source: 'ai' | 'fallback'
}

export type ItemLatihan = LevelItem & { tugasItemId: string }

export interface LevelPeta { id: string; unlocked: boolean; items: LevelItem[] }

/** Panggil API sebagai orang tua; token kedaluwarsa (401) memanggil `keluar`. */
export function apiOrtu(sesi: SesiOrtu, keluar: () => void) {
  return async <T,>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> => {
    try {
      return await api<T>(path, { ...opts, token: sesi.token })
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) keluar()
      throw e
    }
  }
}

/**
 * Siapkan latihan dari tugas: minta token latihan rumah untuk anak, lalu lengkapi tiap item tugas
 * dengan urutan bunyi dan video dari peta (dibutuhkan Mata).
 */
export async function siapkanLatihan(sesi: SesiOrtu, anakId: string, items: ItemTugas[]) {
  const { token } = await api<{ token: string }>(`/parent/children/${anakId}/practice-token`, { token: sesi.token, method: 'POST' })
  const peta = await api<LevelPeta[]>('/levels', { token })
  const semua = new Map(peta.flatMap((l) => l.items.map((i) => [i.id, i] as const)))
  // tugasItemId dikirim ke /attempts supaya tercatat di tugas INI (bukan tugas lama dengan bunyi yang sama).
  const latihan: ItemLatihan[] = items.flatMap((i) => {
    const l = semua.get(i.item)
    return l ? [{ ...l, tugasItemId: i.id }] : []
  })
  return { token, latihan }
}
