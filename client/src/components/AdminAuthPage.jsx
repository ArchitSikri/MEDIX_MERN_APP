import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

function AdminBrand() {
  return (
    <Link className="inline-flex items-center gap-2.5 no-underline" to="/" aria-label="Medix home">
      <span className="grid size-[34px] place-items-center rounded-full border border-[#e7d7d4] text-[19px] text-accent">
        <i className="ri-heart-pulse-line" aria-hidden="true" />
      </span>
      <span className="text-[22px] font-semibold tracking-[-1.2px] text-ink">
        medix<span className="text-accent">.</span>
      </span>
    </Link>
  )
}

function AdminTextField({ id, label, placeholder, type = 'text', icon: Icon, autoComplete }) {
  return (
    <label className="grid gap-2 text-ink" htmlFor={id}>
      <span className="text-[11px] font-medium">{label}</span>
      <span className="flex h-[46px] items-center gap-[11px] rounded-[3px] border border-[#e7e3dd] bg-input px-[13px] transition-colors focus-within:border-[#c58f8d] focus-within:bg-[#fffdfa]">
        <Icon className="shrink-0 text-[#a49b93]" size={17} strokeWidth={1.7} aria-hidden="true" />
        <input
          autoComplete={autoComplete}
          className="h-full min-w-0 w-full border-0 bg-transparent p-0 text-xs text-ink outline-none placeholder:text-[#aaa49e]"
          id={id}
          name={id}
          placeholder={placeholder}
          required
          type={type}
        />
      </span>
    </label>
  )
}

function AdminPasswordField({ id, label, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="grid gap-2 text-ink" htmlFor={id}>
      <span className="text-[11px] font-medium">{label}</span>
      <span className="flex h-[46px] items-center gap-[11px] rounded-[3px] border border-[#e7e3dd] bg-input px-[13px] transition-colors focus-within:border-[#c58f8d] focus-within:bg-[#fffdfa]">
        <LockKeyhole className="shrink-0 text-[#a49b93]" size={17} strokeWidth={1.7} aria-hidden="true" />
        <input
          autoComplete={autoComplete}
          className="h-full min-w-0 w-full border-0 bg-transparent p-0 text-xs text-ink outline-none placeholder:text-[#aaa49e]"
          id={id}
          name={id}
          placeholder={placeholder}
          required
          type={visible ? 'text' : 'password'}
        />
        <button
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="grid size-[30px] shrink-0 place-items-center border-0 bg-transparent text-[#928a83] transition-colors hover:text-accent"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible
            ? <EyeOff size={17} strokeWidth={1.7} aria-hidden="true" />
            : <Eye size={17} strokeWidth={1.7} aria-hidden="true" />}
        </button>
      </span>
    </label>
  )
}

export default function AdminAuthPage({ mode }) {
  const isRegister = mode === 'register'
  const alternatePath = isRegister ? '/admin/login' : '/admin/register'
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setStatusMessage('')

    const form = event.currentTarget
    const formData = new FormData(form)
    const password = String(formData.get('password') || '')
    if (isRegister && password !== formData.get('confirm-password')) {
      setError('Passwords do not match.')
      return
    }

    const body = isRegister
      ? {
          username: formData.get('username'),
          email: formData.get('email'),
          password,
          adminSecretKey: formData.get('adminSecretKey')
        }
      : {
          email: formData.get('email'),
          password,
          adminSecretKey: formData.get('adminSecretKey')
        }

    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.message || 'The request could not be completed.')
      }

      if (!isRegister && result.accessToken) {
        sessionStorage.setItem('adminAccessToken', result.accessToken)
        navigate('/admin/dashboard', { replace: true, state: { admin: result.admin } })
        return
      }
      setStatusMessage(result.message || (isRegister ? 'Admin registered successfully.' : 'Admin login successful.'))
      if (isRegister) form.reset()
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect to the server.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="admin-auth-page flex min-h-screen flex-col bg-paper px-[clamp(23px,7vw,112px)] text-ink">
      <header className="mx-auto flex h-[62px] w-full max-w-[1180px] shrink-0 items-center justify-between border-b border-line sm:h-[86px]">
        <AdminBrand />
        <Link
          className="inline-flex items-center gap-2 text-xs text-muted no-underline transition-colors hover:text-accent"
          to="/"
        >
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Back to home</span>
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-[980px] flex-1 grid-cols-1 items-center gap-6 py-6 sm:gap-14 sm:py-9 lg:grid-cols-[minmax(0,0.9fr)_minmax(370px,0.8fr)] lg:gap-[clamp(56px,9vw,120px)]">
        <section className="hidden pb-3 lg:block">
          <span className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.05em] text-accent">
            <ShieldCheck size={16} strokeWidth={1.7} aria-hidden="true" />
            Medix administration
          </span>
          <h1 className="mt-7 mb-5 font-display text-[clamp(48px,5vw,66px)] font-medium leading-[1.13] tracking-[-0.055em] text-ink">
            Care, guided
            <br />
            <em className="font-medium text-accent">with purpose.</em>
          </h1>
          <p className="m-0 max-w-[350px] text-sm leading-[1.9] text-muted">
            A dedicated space for the people who help keep care thoughtful, trusted, and connected.
          </p>
          <div className="mt-10 h-px w-[43px] bg-rose" />
          <span className="mt-4 block font-display text-xs italic text-[#938b85]">
            A little more care, in every connection.
          </span>
        </section>

        <section className="mx-auto w-full max-w-[430px] lg:ml-auto" aria-labelledby="admin-form-title">
          <div className="mb-6">
            <span className="text-[9px] font-semibold tracking-[0.15em] text-accent">
              {isRegister ? 'ADMINISTRATOR REGISTRATION' : 'ADMINISTRATOR ACCESS'}
            </span>
            <h2 id="admin-form-title" className="mt-3 mb-2 font-display text-[32px] font-medium tracking-[-0.035em] text-ink">
              {isRegister ? 'Create admin account' : 'Welcome back'}
            </h2>
            <p className="m-0 text-xs leading-[1.7] text-muted">
              {isRegister
                ? 'Set up your administrator credentials to get started.'
                : 'Sign in to continue to your administration account.'}
            </p>
          </div>

          <form
            className={`grid gap-3 sm:gap-[15px]${isRegister ? ' sm:grid-cols-2' : ''}`}
            onSubmit={handleSubmit}
          >
            {isRegister && (
              <AdminTextField
                autoComplete="username"
                icon={UserRound}
                id="username"
                label="Full name"
                placeholder="Your full name"
              />
            )}
            <AdminTextField
              autoComplete="email"
              icon={Mail}
              id="email"
              label="Email address"
              placeholder="you@example.com"
              type="email"
            />
            <AdminPasswordField
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              id="password"
              label="Password"
              placeholder={isRegister ? 'Create a password' : 'Enter your password'}
            />
            {isRegister && (
              <AdminPasswordField
                autoComplete="new-password"
                id="confirm-password"
                label="Confirm password"
                placeholder="Enter your password again"
              />
            )}
            <AdminTextField
              autoComplete="off"
              icon={KeyRound}
              id="adminSecretKey"
              label="Admin secret key"
              placeholder="Enter your admin secret key"
              type="password"
            />
            <button
              className={`mt-1 flex min-h-11 cursor-pointer items-center justify-between rounded-[3px] border border-accent bg-accent px-[17px] text-xs font-medium text-white transition hover:-translate-y-px hover:border-[#8e3336] hover:bg-[#8e3336] sm:min-h-12${isRegister ? ' sm:col-span-2' : ''}`}
              disabled={isSubmitting}
              type="submit"
            >
              <span>{isSubmitting ? 'Please wait…' : isRegister ? 'Create admin account' : 'Sign in as admin'}</span>
              <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </form>

          {error && <p className="mt-3 text-xs text-red-700" role="alert">{error}</p>}
          {statusMessage && <p className="mt-3 text-xs text-green-800" role="status">{statusMessage}</p>}

          <p className="mt-5 text-center text-[11px] text-muted">
            {isRegister ? 'Already have an admin account?' : 'Need an admin account?'}
            {' '}
            <Link className="font-medium text-accent underline decoration-[#d8b5b2] underline-offset-[3px]" to={alternatePath}>
              {isRegister ? 'Sign in' : 'Register'}
            </Link>
          </p>
          <p className="mt-5 text-center text-[9px] leading-[1.7] text-[#99928b]">
            Administrator access is intended for authorized Medix staff only.
          </p>
        </section>
      </div>

      <footer className="mx-auto flex min-h-[42px] w-full max-w-[1180px] shrink-0 items-center justify-between gap-3 border-t border-line text-[10px] text-[#928b84]">
        <span>© {new Date().getFullYear()} Medix Health</span>
        <span>Private. Trusted. Thoughtful.</span>
      </footer>
    </main>
  )
}
