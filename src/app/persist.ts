export const STORAGE_KEY = 'silkymaps:prefs'

export function loadPersisted<T>(slice: string): Partial<T> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return (JSON.parse(raw) as Record<string, T>)[slice] ?? {}
  } catch {
    return {}
  }
}

export function savePersisted(state: { mapStyle: unknown; terrain: unknown }): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mapStyle: state.mapStyle, terrain: state.terrain }),
    )
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}
