import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setShowBasemapMenu } from './uiSlice'
import { setSelectedBasemap } from '../parks/mapStyleSlice'
import { BASEMAP_OPTIONS } from '../../shared/constants/basemaps'

export function BasemapControl() {
  const dispatch = useAppDispatch()
  const showBasemapMenu = useAppSelector(s => s.ui.showBasemapMenu)
  const selectedBasemap = useAppSelector(s => s.mapStyle.selectedBasemap)

  return (
    <div className="basemap-control">
      <button
        className={`basemap-toggle ${showBasemapMenu ? 'active' : ''}`}
        onClick={() => dispatch(setShowBasemapMenu(!showBasemapMenu))}
        aria-label="Change basemap"
        title="Change basemap"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      </button>
      {showBasemapMenu && (
        <div className="basemap-menu">
          {BASEMAP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className={`basemap-menu-item ${selectedBasemap === opt.id ? 'active' : ''}`}
              onClick={() => {
                dispatch(setSelectedBasemap(opt.id))
                dispatch(setShowBasemapMenu(false))
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
