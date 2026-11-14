import { Mata } from './mata'

// Model kamera dimuat sekali per tab; berikutnya dipakai ulang.
let instance: Promise<Mata> | null = null

export function getMata(): Promise<Mata> {
  instance ??= Mata.buat({ wasmPath: '/wasm', modelPath: '/model/face_landmarker.task' }).catch((e) => {
    instance = null
    throw e
  })
  return instance
}
