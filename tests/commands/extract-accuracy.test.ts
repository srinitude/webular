// EXTRACT field-accuracy eval: product, article, and recipe pages shaped like
// real schema.org markup, with gold values. Scores exact and normalized (spaces
// collapsed, case folded) match per field, with Jev off so every pick is the
// deterministic code rule.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { Effect } from 'effect'
import { parseFieldSpecs, selectFields } from '../../src/lib/select.ts'
import { eff } from '../_support/run.ts'

process.env['WEBULAR_JEV'] = 'off'

const pages = [
  {
    file: 'extract-product.html',
    fields:
      'title:h1,sku,priceCurrency,price,availability,ratingValue,reviewCount,description:p.desc',
    gold: {
      title: 'Trail Runner 3',
      sku: 'TR3-0042',
      priceCurrency: 'USD',
      price: '129.00',
      availability: 'https://schema.org/InStock',
      ratingValue: '4.6',
      reviewCount: '212',
      description: 'Lightweight trail running shoe with a grippy outsole.',
    },
  },
  {
    file: 'extract-article.html',
    fields: 'title:article h1,headline,datePublished,dateModified,author,publisher,description',
    gold: {
      title: 'City council approves bike lanes',
      headline: 'City council approves bike lanes',
      datePublished: '2026-03-14T09:30:00Z',
      dateModified: '2026-03-14T12:05:00Z',
      author: 'Maya Ortiz',
      publisher: 'The Daily Ledger',
      description: 'The vote passed 7-2 after a three-hour hearing.',
    },
  },
  {
    file: 'extract-recipe.html',
    fields:
      'title:h1.recipe-title,ingredients:ul.ingredients,recipeYield,prep_time,cookTime,recipeCuisine,ratingValue,author',
    gold: {
      title: 'Weeknight Lentil Soup',
      ingredients: '1 cup red lentils 1 onion, diced 4 cups stock',
      recipeYield: '4 servings',
      prep_time: 'PT10M',
      cookTime: 'PT35M',
      recipeCuisine: 'Mediterranean',
      ratingValue: '4.8',
      author: 'Sam Lee',
    },
  },
].map((p) => ({ ...p, html: readFileSync(`tests/fixtures/html/${p.file}`, 'utf8') }))

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
const ROUNDS = 50
const runAll = Effect.forEach(pages, (p) =>
  Effect.flatMap(parseFieldSpecs(p.fields), (specs) => selectFields(p.html, specs)),
)

test(
  'extract field accuracy on gold pages',
  eff(
    Effect.gen(function* () {
      const results = yield* runAll
      const t0 = performance.now()
      yield* Effect.repeat(runAll, { times: ROUNDS - 1 })
      const msPerRound = (performance.now() - t0) / ROUNDS
      const scored = pages.flatMap((p, i) =>
        Object.entries(p.gold).map(([name, want]) => {
          const got = results[i]?.[name] ?? ''
          if (norm(got) !== norm(want))
            console.log(`miss ${p.file} ${name}: ${JSON.stringify(got)}`)
          return { exact: got === want, normalized: norm(got) === norm(want) }
        }),
      )
      const exact = scored.filter((s) => s.exact).length
      const normalized = scored.filter((s) => s.normalized).length
      console.log(
        `extract accuracy: exact ${exact}/${scored.length}, normalized ${normalized}/${scored.length}, ${msPerRound.toFixed(2)} ms per round`,
      )
      expect(scored.length).toBe(23)
      expect(exact).toBe(23)
    }),
  ),
  30_000,
)
