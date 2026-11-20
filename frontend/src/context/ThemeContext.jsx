import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext({ theme: 'light', toggle: () => {} })

const readTheme = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'

// theme-init.js (loaded in <head>) sets the initial data-theme before React renders.
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readTheme)

  const apply = useCallback((next) => {
    document.documentElement.setAttribute('data-theme', next)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0A1628' : '#0B1F3A')
    try { localStorage.setItem('cc_theme', next) } catch { /* storage unavailable */ }
    setTheme(next)
  }, [])

  const toggle = useCallback(() => apply(theme === 'dark' ? 'light' : 'dark'), [theme, apply])

  // Follow the OS only until the user has chosen explicitly
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = (e) => { try { if (localStorage.getItem('cc_theme')) return } catch { /* ignore */ } apply(e.matches ? 'dark' : 'light') }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [apply])

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
