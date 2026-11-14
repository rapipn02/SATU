const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: {
        ...(opts.body ? { 'content-type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Tidak bisa terhubung ke server. Periksa internet.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? 'Terjadi kesalahan')
  return data as T
}

export interface StudentCard { id: string; nickname: string; photoUrl: string | null; isLocked: boolean }
export interface StudentSession { token: string; student: StudentCard }

/** Token perangkat kelas (hanya daftar anak + login PIN), dibuat di server: npm run device-token */
export const DEVICE_TOKEN: string = import.meta.env.VITE_DEVICE_TOKEN ?? ''

export interface LevelView {
  id: string
  orderNo: number
  category: 'vokal' | 'konsonan' | 'suku_kata' | 'kata'
  title: string
  unlocked: boolean
  lockedByTeacher: boolean
  items: LevelItem[]
}
export interface LevelItem { id: string; text: string; urutan: string[]; bestStars: number; tutorialUrl?: string | null }

/** URL video dari server: relatif (/tutorial/...) dilengkapi dengan alamat backend. */
export const urlServer = (u: string) => (/^https?:/.test(u) ? u : BASE.replace(/\/api$/, '') + u)
export interface Profile { totalPoints: number }

export interface AttemptResult {
  correct: boolean
  accuracy: number
  stars: number
  pointsEarned: number
  totalPoints: number
}
