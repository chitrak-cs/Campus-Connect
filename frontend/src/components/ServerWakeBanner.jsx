import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import '../styles/pages/wake.css'

const apiBase = import.meta.env.VITE_API_URL || '/api'
const healthUrl = `${new URL(apiBase, window.location.origin).origin}/health`

/**
 * The free Render plan sleeps when idle and can take up to a minute to wake.
 * If /health doesn't answer within 3 s, show a banner and keep retrying (with backoff) until it does.
 */
export default function ServerWakeBanner() {
  const [waking, setWaking] = useState(false)

  useEffect(() => {
    let cancelled = false
    let slowTimer
    let retryTimer
    const ping = async (attempt) => {
      const ctrl = new AbortController()
      const abort = setTimeout(() => ctrl.abort(), 8000)
      try {
        const res = await fetch(healthUrl, { signal: ctrl.signal, cache: 'no-store' })
        if (!res.ok) throw new Error(`status ${res.status}`)
        clearTimeout(slowTimer)
        if (!cancelled) setWaking(false)
      } catch {
        if (cancelled) return
        retryTimer = setTimeout(() => ping(attempt + 1), Math.min(1000 * 2 ** attempt, 8000))
      } finally { clearTimeout(abort) }
    }
    slowTimer = setTimeout(() => { if (!cancelled) setWaking(true) }, 3000)
    ping(0)
    return () => { cancelled = true; clearTimeout(slowTimer); clearTimeout(retryTimer) }
  }, [])

  if (!waking) return null
  return (
    <div className="wake" role="status" aria-live="polite">
      <Loader2 size={16} className="wake__spin" aria-hidden="true" />
      Starting up the server. This can take up to a minute on the free plan…
    </div>
  )
}
