import { useState, useEffect, useCallback } from 'react'

/** Counts down from `start()` seconds to 0. */
export default function useCountdown() {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  const start = useCallback((seconds = 60) => setLeft(seconds), [])
  return [left, start]
}
