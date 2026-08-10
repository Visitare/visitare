import type { Config } from 'tailwindcss'
import {
  colors,
  fontFamily,
  borderRadius,
  fontSize,
  letterSpacing,
  spacing,
  duration,
  easing,
} from '../shared/tokens'

/* NÃO duplique valores aqui — altere em shared/tokens.ts.
   Espelho CSS para site/ e frontend/ em: shared/tokens.css (gerado).

   Este config e o @theme do web têm que expor o MESMO vocabulário de classes,
   senão uma receita compartilhada (shared/recipes.ts) resolve num stack e some
   no outro, silenciosamente. shared/tokens.test.ts falha quando divergem.

   Uma assimetria fica de fora de propósito: `fontWeight`. No web o peso é
   propriedade CSS; no React Native é OUTRO ARQUIVO de fonte. Por isso o peso
   entra via fontFamily (`font-medium` → Prompt_500Medium, `font-semibold` →
   Prompt_600SemiBold), que coincide com o que `font-medium`/`font-semibold`
   produzem no Tailwind do web. A classe é a mesma; o mecanismo, não.        */

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
      fontSize,
      letterSpacing,
      spacing,
      transitionDuration: duration,
      transitionTimingFunction: easing,
    },
  },
  plugins: [],
}

export default config
