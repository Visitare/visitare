/**
 * Gera shared/tokens.css a partir de shared/tokens.ts.
 * Rode sempre que alterar tokens.ts:
 *   node --experimental-strip-types shared/scripts/gen-tokens-css.ts
 *
 * Requer Node >= 22.6.
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { colors, borderRadius } from '../tokens.ts'

const __dir = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dir, '..', 'tokens.css')

function entries(obj: Record<string, string>): [string, string][] {
  return Object.entries(obj) as [string, string][]
}

const lines: string[] = [
  '/* =============================================================',
  '   VISITARE — DESIGN TOKENS (gerado automaticamente)',
  '   FONTE CANÔNICA: shared/tokens.ts',
  '   NÃO EDITE ESTE ARQUIVO DIRETAMENTE.',
  '   Para alterar tokens: edite tokens.ts e rode:',
  '     node --experimental-strip-types shared/scripts/gen-tokens-css.ts',
  '',
  '   Importado por:',
  '     site/src/styles/globals.css   → @import "../../../shared/tokens.css"',
  '     frontend/src/theme.css        → @import "../../shared/tokens.css"',
  '   Espelho TS em: shared/tokens.ts (para mobile/NativeWind)',
  '   ============================================================= */',
  '',
  '@theme {',
  '  /* ── Tipografia ──────────────────────────────────────────── */',
  '  /* site/ usa Merriweather Sans; PWA/mobile usam Prompt       */',
  '  --font-display:  "Merriweather Sans", system-ui, sans-serif;',
  '  --font-sans:     "Merriweather Sans", system-ui, sans-serif;',
  '  --font-heading:  "Merriweather Sans", system-ui, sans-serif;',
  '  --font-mono:     "DM Mono", ui-monospace, "SF Mono", Menlo, monospace;',
  '  --font-prompt:   "Prompt", system-ui, sans-serif;',
  '  --font-ibm-mono: "IBM Plex Mono", ui-monospace, monospace;',
  '',
]

// Grupo por prefixo para manter comentários de seção
const groups: { label: string; prefix: string }[] = [
  { label: 'Primary — teal (ação, marca, confiança)', prefix: 'primary' },
  { label: 'Secondary — mint (sustenta, preenche)', prefix: 'secondary' },
  { label: 'Tertiary — coral (acento, acolhimento; NÃO urgência)', prefix: 'tertiary' },
  { label: 'Superfícies', prefix: 'surface' },
  { label: 'Urgência / erro (vermelho ≠ coral)', prefix: 'error' },
  { label: 'Contexto: subtle (fundo) + strong (texto/borda)', prefix: '' },
]

const written = new Set<string>()

for (const group of groups) {
  const matching = entries(colors).filter(([k]) =>
    group.prefix ? k === group.prefix || k.startsWith(group.prefix + '-') || k.startsWith('on-' + group.prefix) : true
  ).filter(([k]) => !written.has(k))

  if (!matching.length) continue

  lines.push(`  /* ── ${group.label} `)
  if (group.label.length < 44) lines[lines.length - 1] += '─'.repeat(44 - group.label.length)
  lines[lines.length - 1] += ' */'

  for (const [k, v] of matching) {
    lines.push(`  --color-${k}: ${v};`)
    written.add(k)
  }
  lines.push('')
}

// Catch any tokens not matched by groups
const remaining = entries(colors).filter(([k]) => !written.has(k))
if (remaining.length) {
  for (const [k, v] of remaining) lines.push(`  --color-${k}: ${v};`)
  lines.push('')
}

lines.push('  /* ── Raios ───────────────────────────────────────────────── */')
for (const [k, v] of entries(borderRadius)) {
  lines.push(`  --radius-${k}: ${v};`)
}
lines.push('}', '')

writeFileSync(outPath, lines.join('\n'), 'utf8')
console.log(`✓ tokens.css gerado em ${outPath}`)
