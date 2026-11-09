const THEME_STORAGE_KEY = 'messenger-theme'
const THEME_MODES = new Set(['light', 'dark', 'auto'])

export function readThemeMode() {
  const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY)
  return THEME_MODES.has(storedMode) ? storedMode : 'light'
}

function applyThemeMode(mode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolvedTheme = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode
  document.documentElement.setAttribute('data-theme', resolvedTheme)
}

export function saveThemeMode(mode) {
  if (!THEME_MODES.has(mode)) {
    throw new Error(`Unsupported theme mode: ${mode}`)
  }
  window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  applyThemeMode(mode)
}

export function initializeTheme() {
  applyThemeMode(readThemeMode())
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (readThemeMode() === 'auto') applyThemeMode('auto')
  })
}
