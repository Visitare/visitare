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
import { PRIORIDADE, PRIORIDADE_ORDEM, COR_VISITADO } from '../../shared/recipes.ts'

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

describe('prioridade: a rampa do pin não inverte a leitura', () => {
  /*
   * O bug que o 88a5129 consertou A OLHO: charcoal em `baixa` pesava mais que o
   * mint de `media` e invertia a leitura no fim da escala.
   *
   * A primeira versão deste teste exigia luminância monotonicamente crescente de
   * `critica` a `baixa` — e FALHOU, corretamente: #8A4A09 (âmbar) é mais escuro
   * que #C62828 (vermelho). O modelo estava errado, não a paleta. No topo da
   * escala quem carrega urgência é o MATIZ (vermelho = perigo, e o DESIGN.md
   * separa vermelho de coral justamente para isso); só na parte calma da escala
   * a leitura é por peso.
   *
   * Então o invariante real, e o que o 88a5129 de fato consertou, é: o par de
   * ALARME (critica, alta) tem que ser inequivocamente mais pesado que o par
   * CALMO (media, baixa), e dentro do par calmo o peso tem que cair. É isso que
   * fica travado aqui.
   */
  function luminancia(hex: string): number {
    const canal = (c: number) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    const n = parseInt(hex.replace('#', ''), 16)
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
  }

  const lum = (nivel: keyof typeof PRIORIDADE) => luminancia(PRIORIDADE[nivel].dot)

  it('o par de alarme é mais pesado que o par calmo', () => {
    const alarmeMaisLeve = Math.max(lum('critica'), lum('alta'))
    const calmoMaisPesado = Math.min(lum('media'), lum('baixa'))

    expect(
      alarmeMaisLeve,
      `critica (${PRIORIDADE.critica.dot}) e alta (${PRIORIDADE.alta.dot}) têm que ser ` +
        `mais pesados que media (${PRIORIDADE.media.dot}) e baixa (${PRIORIDADE.baixa.dot})`,
    ).toBeLessThan(calmoMaisPesado)
  })

  it('dentro do par calmo, o peso cai de media para baixa', () => {
    expect(
      lum('baixa'),
      `baixa (${PRIORIDADE.baixa.dot}) tem que ser mais leve que media (${PRIORIDADE.media.dot}) ` +
        '— era exatamente isso que o charcoal invertia',
    ).toBeGreaterThan(lum('media'))
  })

  it('critica e alta são distinguíveis entre si', () => {
    expect(PRIORIDADE.critica.dot).not.toBe(PRIORIDADE.alta.dot)
  })

  it('todo nível de Prioridade tem exatamente uma receita', () => {
    // Se alguém adiciona um nível no type e esquece a receita, o badge cai em
    // undefined e renderiza sem cor nenhuma.
    expect(Object.keys(PRIORIDADE).sort()).toEqual([...PRIORIDADE_ORDEM].sort())
  })

  it('visitado sai da escala de urgência', () => {
    const dots = PRIORIDADE_ORDEM.map((n) => PRIORIDADE[n].dot)
    expect(dots).not.toContain(COR_VISITADO)
  })
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

describe('receitas: os dois stacks escaneiam shared/', () => {
  /*
   * A pegadinha que custou uma rodada: `shared/recipes.ts` fica FORA da raiz dos
   * dois projetos, e nenhum dos dois olhava para lá. As classes existiam na
   * string, o token existia no tema, e ainda assim nada era gerado — o badge
   * renderizou com padding 0 e fonte 16px em vez de 12px, sem um único erro.
   * Falha silenciosa, dos dois lados, pelo mesmo motivo.
   */
  const indexCss = readFileSync(
    join(repoRoot, 'frontend', 'src', 'index.css'),
    'utf8',
  )

  it('o PWA declara @source para shared/', () => {
    expect(indexCss).toMatch(/@source\s+["'][^"']*shared/)
  })

  it('o Expo inclui shared/ no content', () => {
    expect(mobileConfig).toMatch(/content:[\s\S]*shared/)
  })
})
