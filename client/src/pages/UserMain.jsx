import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brand } from '../components/AuthPage.jsx'
import { UserDataContext } from '../context/UserDataContext.js'

export default function UserMain() {
  const { user, logout, isLoading, error } = useContext(UserDataContext)
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
      navigate('/user/login', { replace: true })
    } catch {
      // The context clears local session state and exposes the request error.
      navigate('/user/login', { replace: true })
    }
  }

  return (
    <main className="account-page">
      <header className="site-header">
        <Brand />
        <button className="account-logout" disabled={isLoading} onClick={handleLogout} type="button">
          Sign out
        </button>
      </header>
      <section className="account-card">
        <span className="form-eyebrow">PATIENT ACCOUNT</span>
        <h1>Welcome, {user?.username || 'there'}.</h1>
        <p>You’re signed in to your Medix account.</p>
        <dl>
          <div><dt>Email</dt><dd>{user?.email}</dd></div>
        </dl>
        {error && <p className="auth-feedback auth-feedback--error" role="alert">{error}</p>}
      </section>
    </main>
  )
}