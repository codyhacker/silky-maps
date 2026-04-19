import 'mapbox-gl/dist/mapbox-gl.css'
import { MapView } from '../features/map-core/MapView'
import { ControlPanel } from '../features/parks/ControlPanel'
import { LegendPanel } from '../features/parks/LegendPanel'
import { ParkDetailPanel } from '../features/parks/ParkDetailPanel'
import { MobileToggles } from '../features/chrome/MobileToggles'

function App() {
  return (
    <div className="map-container">
      <MapView>
        <MobileToggles />
        <ControlPanel />
        <LegendPanel />
        <ParkDetailPanel />
      </MapView>
    </div>
  )
}

export default App
