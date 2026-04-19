// Theme-aware fallback artwork shown when a park has no Wikipedia thumbnail.
// Colors are pulled from the active UI theme via CSS custom properties so it
// blends with whichever palette the user has selected.
export function ParkPlaceholderImage() {
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full block"
      role="img"
      aria-label="No image available"
    >
      <defs>
        <linearGradient id="park-placeholder-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(var(--accent-rgb), 0.32)" />
          <stop offset="60%" stopColor="rgba(var(--bg-rich-rgb), 0.85)" />
          <stop offset="100%" stopColor="rgb(var(--bg-deep-rgb))" />
        </linearGradient>
      </defs>

      <rect width="400" height="200" fill="url(#park-placeholder-sky)" />

      {/* Sun / moon */}
      <circle cx="305" cy="62" r="22" fill="rgba(var(--accent-rgb), 0.45)" />
      <circle cx="305" cy="62" r="32" fill="rgba(var(--accent-rgb), 0.12)" />

      {/* Distant mountain ridge */}
      <path
        d="M0 200 L0 145 L55 100 L110 135 L170 85 L235 130 L295 95 L360 125 L400 110 L400 200 Z"
        fill="rgba(var(--bg-deep-rgb), 0.7)"
      />

      {/* Foreground mountain ridge */}
      <path
        d="M0 200 L0 170 L40 145 L95 175 L150 130 L210 168 L270 140 L335 172 L400 150 L400 200 Z"
        fill="rgb(var(--bg-deep-rgb))"
      />
    </svg>
  )
}
