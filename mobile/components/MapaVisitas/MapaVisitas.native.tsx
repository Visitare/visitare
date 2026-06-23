// Implementação nativa — Google Maps SDK via react-native-maps.
// Roda em Android (GoogleMap) e iOS (Apple Maps com fallback Google).
// Requer GOOGLE_MAPS_API_KEY configurada no app.json e nas env vars.

import React from 'react'
import { StyleSheet, View } from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import type { Paciente } from '../../../shared/types'
import { TIER_CORES } from '../../../shared/constants'

interface Props {
  pacientes: Paciente[]
  centerLat: number
  centerLng: number
  onPacientePress?: (p: Paciente) => void
}

export function MapaVisitas({ pacientes, centerLat, centerLng, onPacientePress }: Props) {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {pacientes.map((p) => {
          const tier = p.prioScore >= 61 ? 'alto' : p.prioScore >= 31 ? 'medio' : 'habitual'
          return (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              title={p.nome}
              description={p.motivoPrioridade}
              pinColor={TIER_CORES[tier].dot}
              onPress={() => onPacientePress?.(p)}
            />
          )
        })}
      </MapView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 280 },
  map: { ...StyleSheet.absoluteFillObject },
})
