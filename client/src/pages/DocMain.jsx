import { useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brand } from '../components/AuthPage.jsx'
import { DoctorDataContext } from '../context/DoctorDataContext.js'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
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
    return await request(path, options)
  } catch (error) {
    if (error.status !== 401) throw error
    return request(path, { ...options, token: await refreshSession() })
  }
}

function formatAppointmentDate(date) {
  return new Date(date).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export default function DocMain() {
  const auth = useContext(DoctorDataContext)
  const { doctor, logout, isLoading } = auth
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [appointmentError, setAppointmentError] = useState('')
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true)
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState('')

  const loadAppointments = useCallback(async () => {
    const { appointments: results } = await authenticatedRequest(
      '/api/doctor/auth/appointments',
      { token: auth.accessToken },
      auth.refreshSession
    )
    setAppointments(results)
  }, [auth.accessToken, auth.refreshSession])

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => loadAppointments())
      .catch((error) => {
        if (active) setAppointmentError(error.message)
      })
      .finally(() => {
        if (active) setIsLoadingAppointments(false)
      })
    return () => {
      active = false
    }
  }, [loadAppointments])

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // The session is cleared even when the server logout request fails.
    }
    navigate('/doctor/login', { replace: true })
  }

  async function handleAppointmentDecision(appointmentId, status) {
    setAppointmentError('')
    setUpdatingAppointmentId(appointmentId)
    try {
      await authenticatedRequest(`/api/doctor/auth/appointments/${appointmentId}`, {
        method: 'PATCH',
        body: { status },
        token: auth.accessToken
      }, auth.refreshSession)
      await loadAppointments()
    } catch (error) {
      setAppointmentError(error.message)
    } finally {
      setUpdatingAppointmentId('')
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
        <span className="form-eyebrow">DOCTOR ACCOUNT</span>
        <h1>Welcome, Dr. {doctor?.username || 'there'}.</h1>
        <p>You’re signed in to your Medix professional account.</p>
        <dl>
          <div><dt>Email</dt><dd>{doctor?.email}</dd></div>
          <div><dt>Specialization</dt><dd>{doctor?.specialization}</dd></div>
          <div><dt>Account status</dt><dd>{doctor?.status}</dd></div>
        </dl>
      </section>

      <section className="doctor-appointments-section" aria-labelledby="doctor-appointments-title">
        <span className="form-eyebrow">PATIENT BOOKINGS</span>
        <h2 id="doctor-appointments-title">Appointment requests</h2>
        {appointmentError && <p className="auth-feedback auth-feedback--error" role="alert">{appointmentError}</p>}
        {isLoadingAppointments ? (
          <p className="auth-loading">Loading appointment requests…</p>
        ) : appointments.length === 0 ? (
          <p className="directory-empty">You don’t have appointment requests yet.</p>
        ) : (
          <div className="user-appointment-list">
            {appointments.map((appointment) => (
              <article className="user-appointment-row doctor-appointment-row" key={appointment._id}>
                <div>
                  <h3>{appointment.user?.username || 'Patient'}</h3>
                  <p>{appointment.user?.email} · {formatAppointmentDate(appointment.scheduledAt)}</p>
                  {appointment.reason && <p>Note: {appointment.reason}</p>}
                </div>
                <div className="doctor-appointment-actions">
                  <span className={`appointment-status appointment-status--${appointment.status.toLowerCase()}`}>
                    {appointment.status}
                  </span>
                  {appointment.status === 'PENDING' && (
                    <>
                      <button
                        className="appointment-decision appointment-decision--confirm"
                        disabled={updatingAppointmentId === appointment._id}
                        onClick={() => handleAppointmentDecision(appointment._id, 'CONFIRMED')}
                        type="button"
                      >
                        Accept
                      </button>
                      <button
                        className="appointment-decision appointment-decision--reject"
                        disabled={updatingAppointmentId === appointment._id}
                        onClick={() => handleAppointmentDecision(appointment._id, 'REJECTED')}
                        type="button"
                      >
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
