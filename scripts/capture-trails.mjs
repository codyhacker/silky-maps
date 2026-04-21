// Capture themed screenshots of one showcase trail (the Wonderland Trail
// circling Mt Rainier) across all 8 UI theme + mode combinations. Mirrors
// scripts/capture-rainier.mjs but for the trails feature: selects the trail,
// lets the engine fit camera + populate the TrailDetailPanel, then iterates
// the theme matrix and snapshots each.
//
// Prereqs:
//   - dev server running at http://localhost:5173/silky-maps/
//   - VITE_TRAILS_PMTILES_URL configured to a hosted trails.pmtiles that
//     covers the Mt Rainier area (the bake script outputs cover whatever
//     OSM extract you fed it)
//
// Outputs to docs/screenshots/wonderland-{themeId}-{mode}.png
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../docs/screenshots')
const URL = 'http://localhost:5173/silky-maps/'

const COMBOS = [
  ['sage-forest', 'dark'],
  ['sage-forest', 'light'],
  ['dark-earth', 'dark'],
  ['dark-earth', 'light'],
  ['slate-mist', 'dark'],
  ['slate-mist', 'light'],
  ['botanica', 'dark'],
  ['botanica', 'light'],
]

const TRAIL_NAME_RE = /wonderland trail/i

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForEngine(page) {
  await page.waitForFunction(
    () => !!(window).__engine && (window).__engine.getMap && (window).__engine.getMap().isStyleLoaded(),
    null,
    { timeout: 60_000 },
  )
}

// Fly to Rainier and wait until BOTH the parks tiles AND the trails tiles
// have streamed in for the visible viewport. Trails layers only appear at
// minzoom=11 (locals) / minzoom=8 (thru-hikes), so we go to z11 to make
// sure the local-trails layer is queryable.
async function flyToRainier(page) {
  await page.evaluate(() => {
    const map = (window).__engine.getMap()
    map.jumpTo({ center: [-121.7603, 46.852], zoom: 11, pitch: 0, bearing: 0 })
  })
  await page.waitForFunction(
    () => {
      const map = (window).__engine.getMap()
      if (!map.isStyleLoaded()) return false
      // We need at least one of the trail sources loaded — `trails` is the
      // primary, `thruhikes` is the fallback for long-distance routes.
      const trailsReady = map.getSource('trails') && map.isSourceLoaded('trails')
      const thruReady = map.getSource('thruhikes') && map.isSourceLoaded('thruhikes')
      return trailsReady || thruReady
    },
    null,
    { timeout: 60_000 },
  )
  await sleep(800)
}

// Locate the Wonderland Trail in the loaded vector tiles and select it via
// the same Redux action the click handler dispatches. The trail may live in
// either `trails` (the local layer) or `thruhikes` (long-distance routes
// promoted from OSM `route=hiking` relations) depending on how the bake
// classified it.
async function selectWonderland(page) {
  const found = await page.evaluate((nameSrc) => {
    const re = new RegExp(nameSrc, 'i')
    const map = (window).__engine.getMap()
    const candidates = []
    for (const [sourceId, sourceLayer] of [
      ['trails', 'trails'],
      ['thruhikes', 'thruhikes'],
    ]) {
      if (!map.getSource(sourceId)) continue
      try {
        const feats = map.querySourceFeatures(sourceId, { sourceLayer })
        for (const f of feats) {
          const n = String((f.properties && f.properties.name) || '')
          if (re.test(n)) {
            const id = f.id ?? (f.properties && f.properties.osm_id)
            if (id != null) {
              candidates.push({ id, props: f.properties, source: sourceId })
            }
          }
        }
      } catch {
        // ignore source not ready
      }
    }
    if (candidates.length === 0) return null
    const pick = candidates[0]
    ;(window).__store.dispatch({
      type: 'trailsInteraction/setSelectedTrail',
      payload: { id: pick.id, props: pick.props },
    })
    return { id: pick.id, source: pick.source, name: pick.props.name }
  }, TRAIL_NAME_RE.source)

  if (!found) throw new Error('Wonderland Trail not found in loaded trail tiles')
  console.log('Selected trail:', found.name, '·', found.source, '·', found.id)

  // Engine's selectTrail does a fitBounds on the trail's geometry. Give it
  // a beat to settle, then add some pitch + bearing so the screenshot has
  // some 3D presence rather than a flat top-down.
  await sleep(1500)
  await page.evaluate(() => {
    const map = (window).__engine.getMap()
    map.easeTo({ pitch: 55, bearing: 20, duration: 800 })
  })
  await sleep(1100)
}

async function applyTheme(page, themeId, mode) {
  // UI_THEME_CHANGE repaints layers in place — no style swap, so trail
  // selection + camera + panel state all survive.
  await page.evaluate(
    ({ themeId, mode }) => {
      const store = (window).__store
      store.dispatch({ type: 'mapStyle/setSelectedUiTheme', payload: themeId })
      store.dispatch({ type: 'mapStyle/setUiMode', payload: mode })
    },
    { themeId, mode },
  )
  await sleep(700)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[browser error]', msg.text())
  })

  console.log('Opening', URL)
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await waitForEngine(page)
  console.log('Engine ready, flying to Rainier…')
  await flyToRainier(page)
  console.log('Selecting Wonderland Trail…')
  await selectWonderland(page)

  for (const [themeId, mode] of COMBOS) {
    console.log(`→ ${themeId} / ${mode}`)
    await applyTheme(page, themeId, mode)
    const file = resolve(OUT_DIR, `wonderland-${themeId}-${mode}.png`)
    await page.screenshot({ path: file, fullPage: false })
    console.log('  saved', file)
  }

  await browser.close()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
