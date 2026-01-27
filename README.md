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
VITE_TILE_SERVER_URL=http://localhost:8080
```

### 3. Start your tile server

The app expects vector tiles at:
```
{TILE_SERVER_URL}/data/pmtiles/{z}/{x}/{y}.pbf
```

### 4. Run the development server
```bash
npm run dev
```

### 5. Build for production
```bash
npm run build
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox GL access token | Required |
| `VITE_TILE_SERVER_URL` | URL to your tile server | `http://localhost:8080` |

## Tech Stack

- React 18
- TypeScript
- Vite
- Mapbox GL JS

## Data Source

Protected areas data from the [World Database on Protected Areas (WDPA)](https://www.protectedplanet.net/).

## License

MIT
