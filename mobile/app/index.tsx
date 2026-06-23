// Lista do ACS — tela principal do app.
// Placeholder: substitua pelo conteúdo migrado de frontend/src/pages/ListaPage.tsx
// usando componentes Gluestack no lugar de divs/buttons HTML.

import { View, Text, StyleSheet } from 'react-native'

export default function ListaScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Visitare ACS</Text>
      <Text style={styles.sub}>Lista do dia — em construção</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF9F6' },
  title: { fontSize: 24, fontWeight: '600', color: '#006D77' },
  sub: { fontSize: 16, color: '#36454F', marginTop: 8 },
})
