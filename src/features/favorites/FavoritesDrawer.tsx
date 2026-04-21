import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { removeFavorite, setFavoritesDrawerOpen } from './favoritesSlice'
import { setSelectedFeature } from '../parks/interactionSlice'
import { flyTo } from '../map/cameraSlice'

export function FavoritesDrawer() {
  const dispatch = useAppDispatch()
  const entries = useAppSelector(s => s.favorites.entries)
  const open    = useAppSelector(s => s.favorites.drawerOpen)

  function handleOpen() {
    dispatch(setFavoritesDrawerOpen(true))
  }

  function handleClose() {
    dispatch(setFavoritesDrawerOpen(false))
  }

  function handleVisit(entryId: string) {
    const entry = entries.find(e => e.id === entryId)
    if (!entry) return
    dispatch(setSelectedFeature(entry.feature))
    dispatch(flyTo({
      center: entry.camera.center,
      zoom: entry.camera.zoom,
      pitch: entry.camera.pitch,
      bearing: entry.camera.bearing,
    }))
    dispatch(setFavoritesDrawerOpen(false))
  }

  return (
    <>
      {/* Trigger button — fixed bottom-left */}
      <button
        className="favorites-trigger"
        onClick={open ? handleClose : handleOpen}
        aria-label="Saved parks"
        title="Saved parks"
        style={{ color: open || entries.length > 0 ? 'var(--accent)' : 'var(--text-muted)' }}
      >
        {open ? '♥' : entries.length > 0 ? '♥' : '♡'}
        {entries.length > 0 && (
          <span className="favorites-badge">{entries.length}</span>
        )}
      </button>

      {/* Drawer panel — slides up from bottom-left */}
      <div className={`favorites-drawer${open ? ' open' : ''}`} role="region" aria-label="Saved parks">
        <div className="favorites-drawer-header">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Saved Parks</span>
          <button
            className="w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer border-0 bg-transparent text-lg leading-none"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-4">
            No saved parks yet. Click ♡ on a park to save it.
          </p>
        ) : (
          <ul className="favorites-list">
            {entries.map(entry => {
              const name = String(entry.feature.NAME || entry.feature.NAME_ENG || 'Unknown Park')
              const iso3 = entry.feature.ISO3 as string | undefined
              const date = new Date(entry.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              return (
                <li key={entry.id} className="favorites-entry">
                  <button
                    className="favorites-entry-info"
                    onClick={() => handleVisit(entry.id)}
                    title={`Go to ${name}`}
                  >
                    <span className="text-[13px] font-medium text-[var(--text-primary)] leading-snug line-clamp-1">{name}</span>
                    <span className="text-[11px] text-[var(--text-muted)]">{iso3 ?? ''} · {date}</span>
                  </button>
                  <button
                    className="favorites-entry-remove"
                    onClick={() => dispatch(removeFavorite(entry.id))}
                    aria-label={`Remove ${name} from favourites`}
                    title="Remove"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
