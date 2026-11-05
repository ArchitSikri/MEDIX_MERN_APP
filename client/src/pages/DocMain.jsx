import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brand } from '../components/AuthPage.jsx'
import { DoctorDataContext } from '../context/DoctorDataContext.js'

export default function DocMain() {
  const { doctor, logout, isLoading, error } = useContext(DoctorDataContext)
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // The context clears local session state and exposes the request error.
    }
    navigate('/doctor/login', { replace: true })
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
        <span className="form-eyebrow">DOCTOR ACCOUNT</span>
        <h1>Welcome, Dr. {doctor?.username || 'there'}.</h1>
        <p>You’re signed in to your Medix professional account.</p>
        <dl>
          <div><dt>Email</dt><dd>{doctor?.email}</dd></div>
          <div><dt>Specialization</dt><dd>{doctor?.specialization}</dd></div>
          <div><dt>Account status</dt><dd>{doctor?.status}</dd></div>
        </dl>
        {error && <p className="auth-feedback auth-feedback--error" role="alert">{error}</p>}
      </section>
    </main>
  )
}