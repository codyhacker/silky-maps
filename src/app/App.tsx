import 'mapbox-gl/dist/mapbox-gl.css'
import { MapView } from '../features/map/engine/MapView'
import { ControlPanel } from '../features/panels/ControlPanel'
import { LegendPanel } from '../features/panels/LegendPanel'
import { ParkDetailPanel } from '../features/panels/ParkDetailPanel'
import { MobileToggles } from '../features/shell/MobileToggles'

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
