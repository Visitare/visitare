/**
 * Trava a divergência entre os DOIS caminhos de token.
 *
 * O PWA lê os tokens como CSS custom properties (shared/tokens.css, @theme do
 * Tailwind v4). O Expo lê os MESMOS tokens como objeto JS (shared/tokens.ts,
 * config do Tailwind v3 + NativeWind). Os nomes de classe coincidem por
 * convenção, através de dois caminhos separados — e era exatamente aí que a
 * divergência entrava sem ninguém ver.
 *
 * Vive fora de `src/` de propósito: lê arquivos do disco, então é node-side
 * (tsconfig.node.json, que tem `types: ["node"]`). Em `src/` ele forçaria os
 * tipos de node no tsconfig do app, e aí qualquer componente do PWA passaria a
 * poder importar `node:fs` sem o compilador reclamar.
 *
 * Se este teste falha, rode:
 *   node --experimental-strip-types shared/scripts/gen-tokens-css.ts
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  colors,
  borderRadius,
  fontSize,
  fontWeight,
  letterSpacing,
  spacing,
  duration,
  easing,
} from '../../shared/tokens.ts'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const tokensCss = readFileSync(join(repoRoot, 'shared', 'tokens.css'), 'utf8')
const mobileConfig = readFileSync(join(repoRoot, 'mobile', 'tailwind.config.ts'), 'utf8')

/** Extrai `--prefixo-chave: valor;` do @theme. */
function cssVars(prefix: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = new RegExp(`--${prefix}-([a-z0-9-]+):\\s*([^;]+);`, 'gi')
  for (const m of tokensCss.matchAll(re)) out[m[1]] = m[2].trim()
  return out
}

// Grupos que TÊM que existir nos dois caminhos, com os mesmos valores.
const grupos = [
  { nome: 'colors', prefix: 'color', ts: colors as Record<string, string> },
  { nome: 'borderRadius', prefix: 'radius', ts: borderRadius as Record<string, string> },
  { nome: 'fontSize', prefix: 'text', ts: fontSize as Record<string, string> },
  { nome: 'fontWeight', prefix: 'font-weight', ts: fontWeight as Record<string, string> },
  { nome: 'letterSpacing', prefix: 'tracking', ts: letterSpacing as Record<string, string> },
  { nome: 'spacing', prefix: 'spacing', ts: spacing as Record<string, string> },
  { nome: 'duration', prefix: 'duration', ts: duration as Record<string, string> },
  { nome: 'easing', prefix: 'ease', ts: easing as Record<string, string> },
]

describe('tokens: shared/tokens.ts ⇄ shared/tokens.css', () => {
  for (const { nome, prefix, ts } of grupos) {
    it(`${nome}: todo token do TS existe no CSS com o mesmo valor`, () => {
      const css = cssVars(prefix)
      for (const [chave, valor] of Object.entries(ts)) {
        expect(css[chave], `--${prefix}-${chave} falta em tokens.css`).toBeDefined()
        expect(css[chave], `--${prefix}-${chave} divergiu`).toBe(valor)
      }
    })

    it(`${nome}: o CSS não tem token órfão (que não exista no TS)`, () => {
      const orfaos = Object.keys(cssVars(prefix)).filter((k) => !(k in ts))
      expect(orfaos, `órfãos em --${prefix}-*`).toEqual([])
    })
  }
})

describe('tokens: vocabulário de classes do Expo', () => {
  // O failure mode real: alguém adiciona um grupo em tokens.ts, o gerador passa
  // a emitir no CSS (o web ganha as classes), e o config do NativeWind não é
  // atualizado — a receita compartilhada resolve no PWA e some no Expo.
  const gruposNoNative = [
    'colors',
    'fontFamily',
    'borderRadius',
    'fontSize',
    'letterSpacing',
    'spacing',
  ]

  for (const grupo of gruposNoNative) {
    it(`mobile/tailwind.config.ts consome ${grupo}`, () => {
      expect(mobileConfig).toContain(grupo)
    })
  }

  it('motion chega no native como transitionDuration/transitionTimingFunction', () => {
    expect(mobileConfig).toContain('transitionDuration')
    expect(mobileConfig).toContain('transitionTimingFunction')
  })
})
