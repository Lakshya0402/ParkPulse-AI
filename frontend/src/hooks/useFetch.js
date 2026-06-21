import { useState, useEffect, useCallback } from 'react'

/**
 * Simple data-fetching hook.
 * @param {Function} fetchFn — async function that returns data
 * @param {Array}    deps    — dependency array (re-fetches when these change)
 */
export function useFetch(fetchFn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchFn()
      setData(result)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { run() }, [run])

  return { data, loading, error, refetch: run }
}
