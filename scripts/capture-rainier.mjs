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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForEngine(page) {
  await page.waitForFunction(
    () => !!(window).__engine && (window).__engine.getMap && (window).__engine.getMap().isStyleLoaded(),
    null,
    { timeout: 60_000 },
  )
}

async function flyToRainier(page) {
  await page.evaluate(() => {
    const map = (window).__engine.getMap()
    map.jumpTo({ center: [-121.7603, 46.852], zoom: 9, pitch: 0, bearing: 0 })
  })
  // wait for the parks vector source AND base style to be fully loaded
  await page.waitForFunction(
    () => {
      const map = (window).__engine.getMap()
      if (!map.isStyleLoaded()) return false
      if (!map.isSourceLoaded('national-parks')) return false
      try {
        const feats = map.querySourceFeatures('national-parks', { sourceLayer: 'geo' })
        return feats.some((f) => {
          const n = String((f.properties && (f.properties.NAME || f.properties.NAME_ENG)) || '')
          return /mount rainier/i.test(n)
        })
      } catch {
        return false
      }
    },
    null,
    { timeout: 60_000 },
  )
  // small settle to make sure feature-state filter queries don't race
  await sleep(800)
}

async function selectRainierAndStartTour(page) {
  // Get the SITE_PID for Mt Rainier and dispatch selectedFeature
  const pid = await page.evaluate(() => {
    const map = (window).__engine.getMap()
    const feats = map.querySourceFeatures('national-parks', { sourceLayer: 'geo' })
    let best = null
    for (const f of feats) {
      const n = String((f.properties && (f.properties.NAME || f.properties.NAME_ENG)) || '')
      if (/mount rainier/i.test(n)) {
        // Prefer the National Park (DESIG)
        if (!best || /national park/i.test(String(f.properties.DESIG || ''))) best = f
      }
    }
    if (!best) return null
    const props = best.properties
    ;(window).__store.dispatch({ type: 'parksInteraction/setSelectedFeature', payload: props })
    return props.SITE_PID
  })

  if (pid == null) throw new Error('Mount Rainier not found in loaded tiles')
  console.log('Selected Mt Rainier SITE_PID:', pid)

  // wait for satellite source
  await page.waitForFunction(
    () => {
      const map = (window).__engine.getMap()
      return !!map.getSource('selection-satellite-src')
    },
    null,
    { timeout: 60_000 },
  )
  // give the camera fitBounds + image apply a moment
  await sleep(1200)

  // Start tour
  await page.evaluate(() => {
    ;(window).__store.dispatch({ type: 'parksInteraction/setTourActive', payload: true })
  })

  // Wait for pitch ramp to settle (~2s)
  await sleep(2200)

  // Freeze orbit while keeping pitch + bearing + selection.
  // Bypass the listener (which would restore camera) by calling engine directly.
  await page.evaluate(() => {
    ;(window).__engine.stopTour({ restoreCamera: false })
  })
  await sleep(300)
}

async function applyTheme(page, themeId, mode) {
  // UI_THEME_CHANGE only repaints custom-basemap layers in place — no style swap,
  // so the selection overlay survives. We never dispatch setBasemapSync here
  // because that would trigger a full BASEMAP_CHANGE and tear down the satellite.
  await page.evaluate(
    ({ themeId, mode }) => {
      const store = (window).__store
      store.dispatch({ type: 'mapStyle/setSelectedUiTheme', payload: themeId })
      store.dispatch({ type: 'mapStyle/setUiMode', payload: mode })
    },
    { themeId, mode },
  )
  // Force a consistent pitch/bearing for a clean comparison grid.
  await page.evaluate(() => {
    const map = (window).__engine.getMap()
    map.jumpTo({ center: map.getCenter(), zoom: map.getZoom(), pitch: 60, bearing: 25 })
  })
  await sleep(900)
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
  console.log('Selecting Rainier and starting tour…')
  await selectRainierAndStartTour(page)

  for (const [themeId, mode] of COMBOS) {
    console.log(`→ ${themeId} / ${mode}`)
    await applyTheme(page, themeId, mode)
    const file = resolve(OUT_DIR, `rainier-${themeId}-${mode}.png`)
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
