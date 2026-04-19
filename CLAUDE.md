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
VITE_TILE_SERVER_URL=http://localhost:8080
```

The tile server must serve WDPA PMTiles data at `{TILE_SERVER_URL}/data/pmtiles/{z}/{x}/{y}.pbf`. The source layer inside the tiles is named `geo`. Features are promoted by `SITE_PID`.

## Architecture

The app has one strict rule: **React components never call Mapbox GL directly.** All map operations go through a command dispatch pattern:

```
Redux action → RTK Listener → engine.execute(MapCommand) → MapEngine method → map.*()
```

### MapEngine (`src/features/map-core/MapEngine.ts`)
The only class that holds a `mapboxgl.Map` instance and calls Mapbox GL methods. Accepts a discriminated union `MapCommand` (defined in `mapCommands.ts`) via `execute()`. Adding a new map capability means: add a command variant → add a case in `execute()` → implement the private method.

### Data flow for map state
`selectAugmentationSpec` in `styleAugmentation.ts` is the single RTK selector that derives the complete Mapbox layer/source spec from Redux state (theme, filters, terrain, opacity). It uses `createSelector` so it only re-evaluates when inputs change. The listener middleware diffs the previous vs. next spec and calls `engine.execute({ type: 'STYLE_RECONCILE', spec })`, which in turn diffs at the Mapbox style-spec level using `@mapbox/mapbox-gl-style-spec`'s `diff()`. **Never add data layers directly to MapEngine** — add them to `selectAugmentationSpec` instead.

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
| Slice | Owns |
|---|---|
| `mapStyle` | active theme index, fill opacity, basemap id, UI theme id |
| `mapFilter` | category + designation filter values |
| `terrain` | terrain exaggeration value |
| `mapInteraction` | hovered feature properties, last observed camera position |
| `commandedCamera` | last flyTo / fitBounds payloads (write-only; MapEngine reads these via listener, not selector) |
| `ui` | panel open/closed states, section collapse state |

### WDPA feature properties
Properties available on park features (used in popups, hover, filters, theming):
`NAME`, `NAME_ENG`, `DESIG_TYPE` (National/International), `DESIG` (designation string), `IUCN_CAT`, `STATUS`, `STATUS_YR`, `GOV_TYPE`, `REP_AREA` (km²), `ISO3`
