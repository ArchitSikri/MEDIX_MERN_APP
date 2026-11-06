import { useCallback, useContext, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, MapPin, Stethoscope } from 'lucide-react'
import { Brand } from '../components/AuthPage.jsx'
import { UserDataContext } from '../context/UserDataContext.js'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

function getLocalDateTimeMinimum() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

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

export default function UserMain() {
  const auth = useContext(UserDataContext)
  const { user, logout, isLoading } = auth
  const navigate = useNavigate()
  const [doctors, setDoctors] = useState([])
  const [appointments, setAppointments] = useState([])
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true)
  const [bookingDoctorId, setBookingDoctorId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadDirectory = useCallback(async () => {
    const options = { token: auth.accessToken }
    const [doctorResult, appointmentResult] = await Promise.all([
      authenticatedRequest('/api/user/auth/doctors', options, auth.refreshSession),
      authenticatedRequest('/api/user/auth/appointments', options, auth.refreshSession)
    ])
    setDoctors(doctorResult.doctors)
    setAppointments(appointmentResult.appointments)
  }, [auth.accessToken, auth.refreshSession])

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => loadDirectory())
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setIsLoadingDoctors(false)
      })
    return () => {
      active = false
    }
  }, [loadDirectory])

  async function handleLogout() {
    try {
      await logout()
      navigate('/user/login', { replace: true })
    } catch {
      navigate('/user/login', { replace: true })
    }
  }

  async function handleBookAppointment(event, doctor) {
    event.preventDefault()
    setError('')
    setMessage('')
    setBookingDoctorId(doctor._id)
    const scheduledAt = event.currentTarget.elements.scheduledAt.value

    try {
      const result = await authenticatedRequest('/api/user/auth/appointments', {
        method: 'POST',
        body: { doctorId: doctor._id, scheduledAt: new Date(scheduledAt).toISOString() },
        token: auth.accessToken
      }, auth.refreshSession)
      setMessage(result.message)
      await loadDirectory()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBookingDoctorId('')
    }
  }

  return (
    <main className="account-page">
      <header className="site-header">
        <Brand />
        <div className="account-header-actions">
          <Link className="profile-back-link" to={`/user/profile/${user?.id}`}>Profile & wallet</Link>
          <button className="account-logout" disabled={isLoading} onClick={handleLogout} type="button">
            Sign out
          </button>
        </div>
      </header>

      <section className="account-card user-welcome-card">
        <span className="form-eyebrow">PATIENT ACCOUNT</span>
        <h1>Welcome, {user?.username || 'there'}.</h1>
        <p>You’re signed in to your Medix account.</p>
        <dl>
          <div><dt>Email</dt><dd>{user?.email}</dd></div>
          <div><dt>Wallet balance</dt><dd>₹{(Number(user?.wallet) || 0).toLocaleString('en-IN')}</dd></div>
        </dl>
      </section>

      <section className="doctor-directory" aria-labelledby="doctor-directory-title">
        <div className="doctor-directory-heading">
          <div>
            <span className="form-eyebrow">MEDIX DOCTORS</span>
            <h2 id="doctor-directory-title">Find your doctor</h2>
            <p>Browse verified, admin-approved doctors and request an appointment.</p>
          </div>
          <Link className="directory-profile-link" to={`/user/profile/${user?.id}`}>
            <span>Manage profile</span><ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        {error && <p className="auth-feedback auth-feedback--error" role="alert">{error}</p>}
        {message && <p className="auth-feedback" role="status">{message}</p>}

        {isLoadingDoctors ? (
          <p className="auth-loading">Loading approved doctors…</p>
        ) : doctors.length === 0 ? (
          <p className="directory-empty">No approved doctors are available right now. Please check back soon.</p>
        ) : (
          <div className="doctor-directory-grid">
            {doctors.map((doctor) => (
              <article className="doctor-directory-card" key={doctor._id}>
                <div className="doctor-directory-profile">
                  {doctor.profilePicture
                    ? <img src={doctor.profilePicture} alt="" />
                    : <span className="doctor-directory-avatar-fallback"><Stethoscope size={22} aria-hidden="true" /></span>}
                  <div>
                    <h3>Dr. {doctor.username}</h3>
                    <p>{doctor.specialization}</p>
                  </div>
                </div>

                {doctor.bio && <p className="doctor-directory-bio">{doctor.bio}</p>}
                <dl className="doctor-directory-details">
                  <div><dt>Experience</dt><dd>{doctor.experienceYears || 0} years</dd></div>
                  <div><dt>Consultation</dt><dd>₹{Number(doctor.consultationFee || 0).toLocaleString('en-IN')}</dd></div>
                  {doctor.qualifications?.length > 0 && (
                    <div><dt>Qualifications</dt><dd>{doctor.qualifications.join(', ')}</dd></div>
                  )}
                  {doctor.clinicAddress && (
                    <div className="doctor-clinic-address">
                      <dt><MapPin size={14} aria-hidden="true" /> Clinic</dt><dd>{doctor.clinicAddress}</dd>
                    </div>
                  )}
                </dl>

                <form className="doctor-booking-form" onSubmit={(event) => handleBookAppointment(event, doctor)}>
                  <label htmlFor={`appointment-${doctor._id}`}>
                    <CalendarDays size={15} aria-hidden="true" /> Preferred date & time
                  </label>
                  <input
                    id={`appointment-${doctor._id}`}
                    min={getLocalDateTimeMinimum()}
                    name="scheduledAt"
                    required
                    type="datetime-local"
                  />
                  <button
                    className="submit-button"
                    disabled={bookingDoctorId === doctor._id}
                    type="submit"
                  >
                    <span>{bookingDoctorId === doctor._id ? 'Sending request…' : 'Request appointment'}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="user-appointments-section" aria-labelledby="user-appointments-title">
        <span className="form-eyebrow">YOUR VISITS</span>
        <h2 id="user-appointments-title">Appointment requests</h2>
        {appointments.length === 0 ? (
          <p className="directory-empty">Your appointment requests will show here.</p>
        ) : (
          <div className="user-appointment-list">
            {appointments.map((appointment) => (
              <article className="user-appointment-row" key={appointment._id}>
                <div>
                  <h3>Dr. {appointment.doctor?.username || 'Doctor'}</h3>
                  <p>{appointment.doctor?.specialization} · {formatAppointmentDate(appointment.scheduledAt)}</p>
                </div>
                <span className={`appointment-status appointment-status--${appointment.status.toLowerCase()}`}>
                  {appointment.status}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
