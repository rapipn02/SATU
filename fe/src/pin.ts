// Nomor gambar = nama berkas (1..9), sama dengan aplikasi guru.
const files = import.meta.glob('./assets/pin/*', { eager: true, import: 'default' }) as Record<string, string>

export const PIN_IMAGES: Record<number, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [Number(path.match(/(\d+)\.\w+$/)![1]), url]),
)
export const PIN_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
