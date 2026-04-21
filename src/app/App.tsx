import 'mapbox-gl/dist/mapbox-gl.css'
import { MapView } from '../features/map/engine/MapView'
import { ControlPanel } from '../features/panels/ControlPanel'
import { LegendPanel } from '../features/panels/LegendPanel'
import { DetailPanel } from '../features/panels/DetailPanel'
import { MobileToggles } from '../features/shell/MobileToggles'
import { FavoritesDrawer } from '../features/favorites/FavoritesDrawer'
import { useUrlSync } from '../features/shell/useUrlSync'

// Mounted as a MapView child so the engine context is populated when the
// hook runs — useUrlSync gates park rehydration on the WDPA source being
// loaded, which it asks the engine about directly.
function UrlSync() {
  useUrlSync()
  return null
}

function App() {
  return (
    <div className="map-container">
      <MapView>
        <UrlSync />
        <MobileToggles />
        <ControlPanel />
        <LegendPanel />
        <DetailPanel />
        <FavoritesDrawer />
      </MapView>
    </div>
  )
}

export default App
