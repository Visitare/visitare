import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import type { Paciente, Prioridade } from '../types'
import { EQUIPE_LAT, EQUIPE_LNG } from '../mockData'

const CORES: Record<Prioridade, string> = {
  critica: '#dc2626',
  alta: '#ea580c',
  media: '#ca8a04',
  baixa: '#16a34a',
}

function pinPaciente(prioridade: Prioridade, visitado: boolean) {
  const cor = visitado ? '#94a3b8' : CORES[prioridade]
  return L.divIcon({
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${cor};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>`,
    className: 'leaflet-div-icon-paciente',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  })
}

const PIN_UNIDADE = L.divIcon({
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#1d4ed8;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:14px">🏥</div>`,
  className: 'leaflet-div-icon-unidade',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
})

interface Props {
  pacientes: Paciente[]
  visitados: Set<string>
}

export function MapaVisitas({ pacientes, visitados }: Props) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView([EQUIPE_LAT, EQUIPE_LNG], 15)
    mapRef.current = map

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map)

    L.marker([EQUIPE_LAT, EQUIPE_LNG], { icon: PIN_UNIDADE })
      .addTo(map)
      .bindPopup('<b>Clínica da Família</b><br><span style="font-size:11px;color:#64748b">Ponto de partida</span>')

    for (const p of pacientes) {
      const visitado = visitados.has(p.id)
      const htmlPopup = `
        <div style="min-width:180px;padding:2px 0">
          <div style="font-weight:700;font-size:14px;margin-bottom:3px">${p.nome}</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:2px">${p.faixaEtaria}a · ${p.distanciaKm.toFixed(1).replace('.', ',')} km da unidade</div>
          <div style="font-size:11px;color:#64748b;margin-bottom:8px;line-height:1.4">${p.motivoPrioridade}</div>
          ${visitado
            ? '<span style="font-size:12px;color:#16a34a;font-weight:700">✓ Visitado</span>'
            : `<button data-pid="${p.id}" style="background:#1d4ed8;color:white;border:none;border-radius:8px;padding:8px 12px;font-size:13px;font-weight:700;cursor:pointer;width:100%;touch-action:manipulation">Registrar visita →</button>`
          }
        </div>
      `
      L.marker([p.lat, p.lng], { icon: pinPaciente(p.prioridade, visitado) })
        .addTo(map)
        .bindPopup(htmlPopup, { maxWidth: 240 })
    }

    // Event delegation: captura clique no botão dentro de qualquer popup
    const container = containerRef.current
    function onContainerClick(e: MouseEvent | TouchEvent) {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-pid]')
      if (target?.dataset.pid) {
        map.closePopup()
        navigate(`/visita/${target.dataset.pid}`)
      }
    }
    container.addEventListener('click', onContainerClick)
    container.addEventListener('touchend', onContainerClick)

    return () => {
      container.removeEventListener('click', onContainerClick)
      container.removeEventListener('touchend', onContainerClick)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      {/* Legenda */}
      <div className="flex gap-3 px-4 py-2 bg-white border-b border-slate-100 text-xs text-slate-500 flex-wrap">
        {(['critica', 'alta', 'media', 'baixa'] as Prioridade[]).map((p) => (
          <span key={p} className="flex items-center gap-1">
            <span style={{ background: CORES[p] }} className="inline-block w-3 h-3 rounded-full" />
            {p === 'critica' ? 'Crítica' : p === 'alta' ? 'Alta' : p === 'media' ? 'Média' : 'Baixa'}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span style={{ background: '#94a3b8' }} className="inline-block w-3 h-3 rounded-full" />
          Visitado
        </span>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  )
}
