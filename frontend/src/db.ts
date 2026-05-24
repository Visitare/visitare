import Dexie, { type Table } from 'dexie'
import type { RegistroVisita } from './types'

export class ACSDatabase extends Dexie {
  visitas!: Table<RegistroVisita>

  constructor(name = 'acs-visitas-db') {
    super(name)
    // 'synced' não é indexado: boolean não é um tipo de chave válido no IndexedDB spec.
    // Para o volume de uso (< 100 visitas/semana), scan in-memory é suficiente.
    this.version(1).stores({
      visitas: '++id, pacienteId, profissionalId, dataVisita, createdAt',
    })
  }
}

export const db = new ACSDatabase()

export async function salvarVisita(registro: Omit<RegistroVisita, 'id'>): Promise<number> {
  return await db.visitas.add(registro)
}

export async function getVisitasPendentes(): Promise<RegistroVisita[]> {
  const todos = await db.visitas.toArray()
  return todos.filter((v) => !v.synced)
}

export async function marcarComoSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  await db.transaction('rw', db.visitas, async () => {
    await Promise.all(ids.map((id) => db.visitas.update(id, { synced: true })))
  })
}

export async function getVisitasHoje(profissionalId: string): Promise<RegistroVisita[]> {
  const hoje = new Date().toISOString().split('T')[0]
  return await db.visitas
    .where('profissionalId')
    .equals(profissionalId)
    .and((v) => v.dataVisita === hoje)
    .toArray()
}
