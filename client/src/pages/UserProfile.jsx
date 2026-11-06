import { useContext, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Wallet } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Brand } from '../components/AuthPage.jsx'
import { UserDataContext } from '../context/UserDataContext.js'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = new Headers({ Authorization: `Bearer ${token}` })
  let requestBody = body
  if (body && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: requestBody,
    credentials: 'include'
  })
  const text = await response.text()
  let result = {}
  if (text) {
    try {
      result = JSON.parse(text)
    } catch {
      result = { message: text }
    }
  }
  if (!response.ok) {
    const error = new Error(result.message || 'The request could not be completed.')
    error.status = response.status
    throw error
  }
  return result
}

async function authenticatedRequest(path, options, refreshSession) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (error.status !== 401) throw error
    const token = await refreshSession()
    return apiRequest(path, { ...options, token })
  }
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Razorpay checkout. Check your internet connection and try again.'))
    document.body.appendChild(script)
  })
}

export default function UserProfile() {
  const { userId } = useParams()
  const auth = useContext(UserDataContext)
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [recoveryOrderId, setRecoveryOrderId] = useState('')
  const [recoveryPaymentId, setRecoveryPaymentId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    authenticatedRequest(
      `/api/user/auth/profile/${encodeURIComponent(userId)}`,
      { token: auth.accessToken },
      auth.refreshSession
    ).then(({ user }) => {
      if (active) setProfile(user)
    }).catch((requestError) => {
      if (active) setError(requestError.message)
    }).finally(() => {
      if (active) setIsLoading(false)
    })

    return () => {
      active = false
    }
  }, [auth.accessToken, auth.refreshSession, userId])

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSaving(true)

    try {
      const { user, message: resultMessage } = await authenticatedRequest(
        `/api/user/auth/profile/${encodeURIComponent(userId)}`,
        {
          method: 'PUT',
          body: new FormData(event.currentTarget),
          token: auth.accessToken
        },
        auth.refreshSession
      )
      setProfile(user)
      auth.setUser(user)
      setMessage(resultMessage)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTopup() {
    setError('')
    setMessage('')
    setIsPaying(true)
    try {
      const order = await authenticatedRequest(
        '/api/user/auth/wallet/topup/order',
        { method: 'POST', body: {}, token: auth.accessToken },
        auth.refreshSession
      )
      await loadRazorpay()

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Medix',
        description: 'Wallet top-up',
        prefill: {
          name: profile?.username || '',
          email: profile?.email || ''
        },
        theme: { color: '#ad3e43' },
        handler: async (payment) => {
          try {
            const result = await authenticatedRequest('/api/user/auth/wallet/topup/verify', {
              method: 'POST',
              body: {
                orderId: payment.razorpay_order_id,
                paymentId: payment.razorpay_payment_id,
                signature: payment.razorpay_signature
              },
              token: auth.accessToken
            }, auth.refreshSession)
            setProfile((current) => ({ ...current, wallet: result.wallet }))
            auth.setUser((current) => ({ ...current, wallet: result.wallet }))
            setMessage(result.message)
          } catch (requestError) {
            setError(requestError.message)
          } finally {
            setIsPaying(false)
          }
        },
        modal: {
          ondismiss: () => setIsPaying(false)
        }
      })
      checkout.on('payment.failed', (event) => {
        setError(event.error?.description || 'Payment failed. Please try again.')
        setIsPaying(false)
      })
      checkout.open()
    } catch (requestError) {
      setError(requestError.message)
      setIsPaying(false)
    }
  }

  async function handleRecoverPayment(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsPaying(true)
    try {
      const result = await authenticatedRequest('/api/user/auth/wallet/topup/verify', {
        method: 'POST',
        body: {
          orderId: recoveryOrderId.trim(),
          paymentId: recoveryPaymentId.trim()
        },
        token: auth.accessToken
      }, auth.refreshSession)
      setProfile((current) => ({ ...current, wallet: result.wallet }))
      auth.setUser((current) => ({ ...current, wallet: result.wallet }))
      setMessage(result.message)
      setRecoveryOrderId('')
      setRecoveryPaymentId('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <main className="account-page">
      <header className="site-header">
        <Brand />
        <Link className="profile-back-link" to="/user/dashboard">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to dashboard</span>
        </Link>
      </header>

      <section className="profile-page-content">
        <div className="profile-page-heading">
          <span className="form-eyebrow">YOUR ACCOUNT</span>
          <h1>Profile & wallet</h1>
          <p>Manage your personal details and wallet balance.</p>
        </div>

        {error && <p className="auth-feedback auth-feedback--error" role="alert">{error}</p>}
        {message && <p className="auth-feedback" role="status">{message}</p>}

        {isLoading ? (
          <p className="auth-loading">Loading your profile…</p>
        ) : profile ? (
          <div className="profile-page-grid">
            <section className="profile-card">
              <div className="profile-card-heading">
                <h2>Your profile</h2>
                <p>Update your name, UPI ID, or profile photo.</p>
              </div>
              <form className="profile-edit-form" onSubmit={handleSave}>
                <div className="profile-avatar">
                  {profile.profilePicture
                    ? <img src={profile.profilePicture} alt={`${profile.username}'s profile`} />
                    : <span aria-label="No profile picture">{profile.username?.charAt(0)?.toUpperCase() || 'U'}</span>}
                </div>
                <label className="profile-photo-picker" htmlFor="profilePicture">
                  <Camera size={16} aria-hidden="true" />
                  <span>Choose profile photo</span>
                  <input accept="image/*" id="profilePicture" name="profilePicture" type="file" />
                </label>

                <label className="profile-input-label" htmlFor="profile-username">Full name</label>
                <input
                  autoComplete="name"
                  className="profile-input"
                  defaultValue={profile.username}
                  id="profile-username"
                  name="username"
                  required
                />

                <label className="profile-input-label" htmlFor="profile-email">Email address</label>
                <input
                  className="profile-input profile-input--readonly"
                  id="profile-email"
                  readOnly
                  value={profile.email}
                />

                <label className="profile-input-label" htmlFor="profile-upi">UPI ID</label>
                <input
                  autoComplete="off"
                  className="profile-input"
                  defaultValue={profile.UPI_Id || ''}
                  id="profile-upi"
                  maxLength={100}
                  name="UPI_Id"
                  placeholder="name@bank"
                />
                <button className="submit-button profile-save-button" disabled={isSaving} type="submit">
                  <span>{isSaving ? 'Saving…' : 'Save changes'}</span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </form>
            </section>

            <section className="profile-card wallet-card">
              <div className="wallet-icon"><Wallet size={22} aria-hidden="true" /></div>
              <span className="form-eyebrow">MEDIX WALLET</span>
              <h2>₹{(Number(profile.wallet) || 0).toLocaleString('en-IN')}</h2>
              <p>Available wallet balance</p>
              <div className="wallet-topup-note">Add ₹2,000 securely using Razorpay.</div>
              <button
                className="submit-button wallet-topup-button"
                disabled={isPaying}
                onClick={handleTopup}
                type="button"
              >
                <span>{isPaying ? 'Waiting for payment…' : 'Top up ₹2,000'}</span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <details className="wallet-recovery">
                <summary>Already completed a payment?</summary>
                <p>Enter its Razorpay order ID and payment ID to verify it and update your wallet.</p>
                <form onSubmit={handleRecoverPayment}>
                  <label className="profile-input-label" htmlFor="recovery-order-id">Razorpay order ID</label>
                  <input
                    autoComplete="off"
                    className="profile-input"
                    id="recovery-order-id"
                    onChange={(event) => setRecoveryOrderId(event.target.value)}
                    required
                    value={recoveryOrderId}
                  />
                  <label className="profile-input-label" htmlFor="recovery-payment-id">Razorpay payment ID</label>
                  <input
                    autoComplete="off"
                    className="profile-input"
                    id="recovery-payment-id"
                    onChange={(event) => setRecoveryPaymentId(event.target.value)}
                    required
                    value={recoveryPaymentId}
                  />
                  <button className="profile-recovery-button" disabled={isPaying} type="submit">
                    {isPaying ? 'Checking payment…' : 'Verify previous payment'}
                  </button>
                </form>
              </details>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  )
}
