import type { Config } from 'tailwindcss'
import { colors, fontFamily, borderRadius } from '../shared/tokens'

/* NÃO duplique valores de cor aqui — altere em shared/tokens.ts.
   Espelho CSS para site/ e frontend/ em: shared/tokens.css        */

const config: Config = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      fontFamily,
      borderRadius,
    },
  },
  plugins: [],
}

export default config
