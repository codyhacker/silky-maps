# Silky Maps - Protected Areas Visualization

An interactive 3D map application for visualizing the World Database on Protected Areas (WDPA) data. Built with React, TypeScript, and Mapbox GL JS.

## Features

- Interactive 3D map with terrain exaggeration
- Multiple basemap options including custom dark purple theme
- Vector tile data from tile server
- Category and designation filters
- Thematic styling by IUCN category, designation type, status, and governance
- Collapsible control panels with smooth animations
- Mobile-responsive design
- Interactive popups with feature details

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set environment variables

Create a `.env` file in the root directory:
```bash
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
VITE_PMTILES_URL=https://pub-<hash>.r2.dev/wdpa.pmtiles
```

### 3. Host the PMTiles file

The app loads protected-areas data directly from a single `.pmtiles` file
via the PMTiles support built into Mapbox GL JS v3.21+. Any host that
supports HTTP range requests and CORS works (Cloudflare R2, S3, etc.).

Required CORS rules on the bucket:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://your-prod-domain"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "If-Match", "If-None-Match"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"]
  }
]
```

For local development without a remote bucket, serve the file with a
range-capable static server:

```bash
npx serve /path/to/spatialData -l 8080 --cors
# then set VITE_PMTILES_URL=http://localhost:8080/wdpa.pmtiles
```

### 4. (Re)building the PMTiles file from raw WDPA

```bash
tippecanoe -o wdpa.pmtiles -l geo -zg \
  --drop-densest-as-needed --force wdpa_poly.geojson
```

The layer name **must** be `geo` (matches `SOURCE_LAYER` in
`src/features/map-core/styleAugmentation.ts`).

### 5. Run the development server
```bash
npm run dev
```

### 6. Build for production
```bash
npm run build
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox GL access token | Required |
| `VITE_PMTILES_URL` | Public URL to the WDPA `.pmtiles` file | `http://localhost:8080/wdpa.pmtiles` |

## Tech Stack

- React 18
- TypeScript
- Vite
- Mapbox GL JS

## Data Source

Protected areas data from the [World Database on Protected Areas (WDPA)](https://www.protectedplanet.net/).

## License

MIT
