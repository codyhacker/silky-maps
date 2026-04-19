# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (Vite, localhost:5173)
npm run build     # type-check + production build → dist/
npm run preview   # serve dist/ locally
npx tsc --noEmit  # type-check without building
```

No test runner is configured.

## Environment

Create `.env` in the project root:
```
VITE_MAPBOX_ACCESS_TOKEN=...
VITE_PMTILES_URL=http://localhost:8080/wdpa.pmtiles
```

`VITE_PMTILES_URL` points directly to a `.pmtiles` file. The source layer inside the tiles is named `geo`. Features are promoted by `SITE_PID`.

## Architecture

The app has one strict rule: **React components never call Mapbox GL directly.** All map operations go through a command dispatch pattern:

```
Redux action → RTK Listener → engine.execute(MapCommand) → MapEngine method → map.*()
```

### File structure

```
src/
  app/            store.ts, hooks.ts, listenerMiddleware.ts, App.tsx
  features/
    map/          styleSlice.ts, terrainSlice.ts, cameraSlice.ts
      engine/     MapEngine.ts, MapView.tsx, MapEngineContext.ts,
                  registerListeners.ts, styleAugmentation.ts, commands.ts
    parks/        filterSlice.ts, interactionSlice.ts
    panels/       ControlPanel.tsx, LegendPanel.tsx, ParkDetailPanel.tsx
    shell/        MobileToggles.tsx, uiSlice.ts
  shared/
    api/          parkMedia.ts
    components/   TitleGlobe.tsx, ParkPlaceholderImage.tsx
    constants/    uiThemes.ts, basemaps.ts, dataPalettes.ts, filters.ts, parkLabels.ts
    types/        index.ts
```

### MapEngine (`src/features/map/engine/MapEngine.ts`)
The only class that holds a `mapboxgl.Map` instance and calls Mapbox GL methods. Accepts a discriminated union `MapCommand` (defined in `commands.ts`) via `execute()`. Adding a new map capability means: add a command variant → add a case in `execute()` → implement the private method.

### Data flow for map state
`selectAugmentationSpec` in `styleAugmentation.ts` is the single RTK selector that derives the complete Mapbox layer/source spec from Redux state (theme, filters, terrain, opacity). It uses `createSelector` so it only re-evaluates when inputs change. The listener middleware diffs the previous vs. next spec and calls `engine.execute({ type: 'STYLE_RECONCILE', spec })`, which in turn diffs at the Mapbox style-spec level using `@mapbox/mapbox-gl-style-spec`'s `diff()`. **Never add data layers directly to MapEngine** — add them to `selectAugmentationSpec` instead.

### Selection + tour modes
Two layered map states drive the park view, each owned by its own listener:

**Selection** (mask + satellite overlay) — triggered on park click or search-result pick. `setSelectedFeature(props)` flips Redux; the selection listener in `registerListeners.ts` calls `engine.selectPark(siteId)`, which:
1. Captures a `preSelectionCamera` snapshot (only on first selection — preserved across park-to-park transitions so the close action always reverts to the user's original view)
2. Fetches the park's tile geometry via `querySourceFeatures` (with a `sourcedata`-driven retry if tiles haven't streamed in yet — relevant for search-from-far)
3. Pre-fetches Mapbox satellite tiles covering the bbox at an adaptive zoom (highest z whose covering tile grid fits in ~4096×4096 px — small parks get crisp z14, continent-scale parks fall back to z10), stitches them into one canvas, **and clips the canvas to the park polygon at stitch time** using `Path2D` + `ctx.clip('evenodd')`. The result is a PNG with transparent edges shaped exactly like the park silhouette — no separate mask layer is needed. See `engine/satelliteTiles.ts`. Why this over `type: 'raster'` + bounds? Eliminates LOD-swap flicker, keeps the silhouette pixel-perfect across zooms, lets the basemap show through naturally outside the park (no flat fill covering hillshade/water), and the polygon-clip handles holes (`evenodd` rule) and MultiPolygon pieces in one path.
4. Adds the result as a single Mapbox `image` source below `road-minor`, so road/admin/label vector layers still render on top of the satellite inside the park.
5. `fitBounds` to the park (gentle, no pitch change)

Race protection: the stitch is async, so an `AbortController` is wired through `stitchSatelliteTiles`. Any new selection / panel close / basemap swap aborts the in-flight fetch and revokes the blob URL on cleanup so the canvas isn't pinned in memory.

`setSelectedFeature(null)` (close button or click on empty land) → `engine.deselectPark()` removes the overlay and `easeTo`s back to `preSelectionCamera`.

**Tour** (orbit on top of selection) — triggered when the user clicks "Full detail" in the park panel. `setTourActive(true)` → `engine.startTour(siteId)`, which:
1. Captures `preTourCamera` (bearing + pitch only)
2. `fitBounds` again with `pitch: 60` for the dramatic angle
3. Starts a `requestAnimationFrame` orbit loop on `moveend`
4. Stops on any user gesture (`dragstart`, `rotatestart`, `zoomstart`, `pitchstart`) — orbit cancels and Redux is synced via `setTourActive(false)`

Programmatic stops ("Show less", panel close) `easeTo` back to `preTourCamera`. User-gesture stops do not (the user is already driving the camera). Closing the panel while the tour is active first stops the tour without restoring (the deselect-camera restore supersedes it).

### Park detail panel (`src/features/panels/ParkDetailPanel.tsx`)
On park selection, fetches Wikipedia hero image + summary via `src/shared/api/parkMedia.ts` (en.wikipedia.org REST summary API, in-memory cached). Mobile: bottom drawer (collapsed) → fullscreen transparent overlay with two glass cards and the live tour visible between them (expanded).

### UI theming system
All UI colors are CSS custom properties set on `:root`. The canonical definition is in `src/shared/constants/uiThemes.ts`, which contains:
- `UiPalette` interface — every color token used in CSS
- `UI_THEMES` array — the 4 named themes (Sage Forest, Dark Earth, Slate Mist, Botanica)
- `applyUiTheme(theme)` — writes CSS vars to `document.documentElement`
- `buildCustomMapStyle(palette)` — generates a full Mapbox `StyleSpecification` for the custom 'earth' basemap
- `getCustomLayerPaints(palette)` — returns per-layer `setPaintProperty` calls for live theme switching (no tile reload)

`index.css` uses only `var(--token)` and `rgba(var(--token-rgb), opacity)` — no hardcoded colors. The `:root` defaults match the Sage Forest theme. Theme switching dispatches `setSelectedUiTheme`, which the listener routes to `engine.execute({ type: 'UI_THEME_CHANGE' })`.

### Adding a new theme
Add a `UiTheme` object to `UI_THEMES` in `uiThemes.ts`. No other files need changes — the ControlPanel Appearance section reads `UI_THEMES` directly.

### Basemap handling
`BASEMAP_OPTIONS` in `basemaps.ts` lists available basemaps. The 'earth' entry has `style: null`, which signals `MapEngine` to call `buildCustomMapStyle(currentPalette)` rather than using a Mapbox URL. All other basemaps use Mapbox-hosted URLs. On basemap change, `currentAugmentation` is reset to `null` so the next reconcile does a full initial apply rather than a diff.

### Redux slices
| Slice | File | Owns |
|---|---|---|
| `mapStyle` | `features/map/styleSlice.ts` | active theme index, fill opacity, basemap id, UI theme id |
| `terrain` | `features/map/terrainSlice.ts` | terrain exaggeration value |
| `camera` | `features/map/cameraSlice.ts` | commanded flyTo/fitBounds payloads; observed camera position |
| `parksFilter` | `features/parks/filterSlice.ts` | category + designation filter values |
| `parksInteraction` | `features/parks/interactionSlice.ts` | hovered feature, selected feature, tourActive flag |
| `ui` | `features/shell/uiSlice.ts` | panel open/closed states, section collapse state |

### WDPA feature properties
Properties available on park features (used in popups, hover, filters, theming):
`NAME`, `NAME_ENG`, `DESIG_TYPE` (National/International), `DESIG` (designation string), `IUCN_CAT`, `STATUS`, `STATUS_YR`, `GOV_TYPE`, `REP_AREA` (km²), `ISO3`
