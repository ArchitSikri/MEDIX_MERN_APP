import { useCallback, useEffect, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const refreshRequests = new Map()

export class AuthApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let requestBody
  if (body instanceof FormData) {
    requestBody = body
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: requestBody,
    credentials: 'include'
  })
  const responseText = await response.text()
  let payload = {}
  if (responseText) {
    try {
      payload = JSON.parse(responseText)
    } catch {
      payload = { message: responseText }
    }
  }

  if (!response.ok) {
    throw new AuthApiError(payload.message || 'The request could not be completed.', response.status)
  }

  return payload
}

function refreshAccessToken(role, authPath) {
  const existingRequest = refreshRequests.get(role)
  if (existingRequest) return existingRequest

  const refreshRequest = request(`${authPath}/refresh`, { method: 'POST' })
    .then(({ accessToken }) => {
      if (!accessToken) throw new Error('The server did not return an access token.')
      sessionStorage.setItem(`${role}AccessToken`, accessToken)
      return accessToken
    })
    .finally(() => refreshRequests.delete(role))

  refreshRequests.set(role, refreshRequest)
  return refreshRequest
}

function getRefreshDelay(token) {
  try {
    const encodedPayload = token.split('.')[1]
    const base64Payload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64Payload))
    const millisecondsUntilExpiry = Number(payload.exp) * 1000 - Date.now()
    if (Number.isFinite(millisecondsUntilExpiry)) {
      return Math.max(1000, millisecondsUntilExpiry - 60_000)
    }
  } catch {
    return 60_000
  }
  return 60_000
}

export function useAuthSession({ role, authPath, accountKey }) {
  const [account, setAccount] = useState(null)
  const [accessToken, setAccessToken] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const saveSession = useCallback((nextAccount, token) => {
    if (!token) throw new Error('The server did not return an access token.')
    sessionStorage.setItem(`${role}AccessToken`, token)
    setAccessToken(token)
    setAccount(nextAccount)
  }, [role])

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(`${role}AccessToken`)
    setAccessToken('')
    setAccount(null)
  }, [role])

  const getCurrentAccount = useCallback(async (token) => {
    const result = await request(`${authPath}/me`, { token })
    const currentAccount = result[accountKey]
    if (!currentAccount) throw new Error('The server did not return the account profile.')
    return currentAccount
  }, [accountKey, authPath])

  const refreshSession = useCallback(async () => {
    const token = await refreshAccessToken(role, authPath)
    const currentAccount = await getCurrentAccount(token)
    setAccessToken(token)
    setAccount(currentAccount)
    setError('')
    return token
  }, [authPath, getCurrentAccount, role])

  useEffect(() => {
    let active = true

    async function restoreSession() {
      try {
        const storedToken = sessionStorage.getItem(`${role}AccessToken`)
        let token = storedToken
        let currentAccount

        if (token) {
          try {
            currentAccount = await getCurrentAccount(token)
          } catch (requestError) {
            if (!(requestError instanceof AuthApiError) || requestError.status !== 401) {
              throw requestError
            }
            token = await refreshAccessToken(role, authPath)
            currentAccount = await getCurrentAccount(token)
          }
        } else {
          token = await refreshAccessToken(role, authPath)
          currentAccount = await getCurrentAccount(token)
        }

        if (active) {
          setAccessToken(token)
          setAccount(currentAccount)
        }
      } catch (requestError) {
        if (active) {
          clearSession()
          if (!(requestError instanceof AuthApiError) || requestError.status !== 401) {
            setError(requestError.message || 'Unable to restore your session.')
          }
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    restoreSession()
    return () => {
      active = false
    }
  }, [authPath, clearSession, getCurrentAccount, role])

  useEffect(() => {
    if (!accessToken || !account) return undefined

    let timeout
    let retryTimeout
    async function refreshSession() {
      try {
        const token = await refreshAccessToken(role, authPath)
        const currentAccount = await getCurrentAccount(token)
        setAccessToken(token)
        setAccount(currentAccount)
        setError('')
      } catch (requestError) {
        if (
          requestError instanceof AuthApiError &&
          (requestError.status === 401 || requestError.status === 403)
        ) {
          clearSession()
          setError('Your session expired. Please sign in again.')
          return
        }
        setError(requestError.message || 'Unable to refresh your session.')
        retryTimeout = window.setTimeout(refreshSession, 60_000)
      }
    }

    timeout = window.setTimeout(refreshSession, getRefreshDelay(accessToken))

    return () => {
      window.clearTimeout(timeout)
      window.clearTimeout(retryTimeout)
    }
  }, [accessToken, account, authPath, clearSession, getCurrentAccount, role])

  const perform = useCallback(async (operation) => {
    setIsLoading(true)
    setError('')
    try {
      return await operation()
    } catch (requestError) {
      setError(requestError.message || 'The request could not be completed.')
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }, [])

  const register = useCallback((body) => perform(() => request(`${authPath}/register`, {
    method: 'POST',
    body
  })), [authPath, perform])

  const verifyEmail = useCallback((email, otp) => perform(() => request(`${authPath}/verify-email`, {
    method: 'POST',
    body: { email, otp }
  })), [authPath, perform])

  const login = useCallback((credentials) => perform(async () => {
    const result = await request(`${authPath}/login`, {
      method: 'POST',
      body: credentials
    })
    saveSession(result[accountKey], result.accessToken)
    return result
  }), [accountKey, authPath, perform, saveSession])

  const googleLogin = useCallback((credential) => perform(async () => {
    const result = await request(`${authPath}/googlelogin`, {
      method: 'POST',
      body: { credential }
    })
    saveSession(result[accountKey], result.accessToken)
    return result
  }), [accountKey, authPath, perform, saveSession])

  const logout = useCallback(() => perform(async () => {
    try {
      if (accessToken) {
        try {
          await request(`${authPath}/logout`, { method: 'POST', token: accessToken })
        } catch (requestError) {
          if (!(requestError instanceof AuthApiError) || requestError.status !== 401) {
            throw requestError
          }
          const refreshedToken = await refreshAccessToken(role, authPath)
          await request(`${authPath}/logout`, { method: 'POST', token: refreshedToken })
        }
      }
    } finally {
      clearSession()
    }
  }), [accessToken, authPath, clearSession, perform, role])

  return {
    account,
    setAccount,
    accessToken,
    refreshSession,
    isLoading,
    error,
    setError,
    register,
    verifyEmail,
    login,
    googleLogin,
    logout
  }
}
