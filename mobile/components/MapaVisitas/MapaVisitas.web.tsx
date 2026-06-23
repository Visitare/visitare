// Implementação web — Leaflet (sem API key, sem custo).
// Roda no browser quando o Expo compila para web.
// A mesma interface de props que MapaVisitas.native.tsx.

import React, { useEffect, useRef } from 'react'
import type { Paciente } from '../../../shared/types'
import { TIER_CORES } from '../../../shared/constants'

interface Props {
  pacientes: Paciente[]
  centerLat: number
  centerLng: number
  onPacientePress?: (p: Paciente) => void
}

export function MapaVisitas({ pacientes, centerLat, centerLng, onPacientePress }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return

    // Carrega Leaflet dinamicamente (só no browser)
    Promise.all([
      import('leaflet'),
      import('leaflet/dist/leaflet.css' as string),
    ]).then(([L]) => {
      if (mapRef.current) return

      const map = L.map(containerRef.current!).setView([centerLat, centerLng], 15)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map)

      pacientes.forEach((p) => {
        const tier = p.prioScore >= 61 ? 'alto' : p.prioScore >= 31 ? 'medio' : 'habitual'
        const color = TIER_CORES[tier].dot
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })
        const marker = L.marker([p.lat, p.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${p.nome}</b><br>${p.motivoPrioridade}`)
        if (onPacientePress) marker.on('click', () => onPacientePress(p))
      })
    })

    return () => {
      if (mapRef.current) {
        ;(mapRef.current as { remove(): void }).remove()
        mapRef.current = null
      }
    }
  }, [centerLat, centerLng, pacientes, onPacientePress])

  return <div ref={containerRef} style={{ width: '100%', height: 280 }} />
}
