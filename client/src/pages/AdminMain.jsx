import { useState } from 'react'
import { LogOut, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export default function AdminMain() {
	const navigate = useNavigate()
	const location = useLocation()
	const [isLoggingOut, setIsLoggingOut] = useState(false)
	const admin = location.state?.admin

	async function handleLogout() {
		setIsLoggingOut(true)
		const token = sessionStorage.getItem('adminAccessToken')
		try {
			if (token) {
				await fetch(`${API_BASE_URL}/api/admin/logout`, {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}` },
					credentials: 'include'
				})
			}
		} finally {
			sessionStorage.removeItem('adminAccessToken')
			navigate('/admin/login', { replace: true })
		}
	}

	return (
		<main className="min-h-screen bg-paper px-5 text-ink sm:px-8">
			<header className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between border-b border-line">
				<Link className="text-xl font-semibold text-ink no-underline" to="/">
					medix<span className="text-accent">.</span>
				</Link>
				<button
					className="inline-flex items-center gap-2 border-0 bg-transparent text-xs text-muted hover:text-accent disabled:opacity-60"
					disabled={isLoggingOut}
					onClick={handleLogout}
					type="button"
				>
					<LogOut size={16} aria-hidden="true" />
					{isLoggingOut ? 'Signing out…' : 'Sign out'}
				</button>
			</header>
			<section className="mx-auto max-w-[1180px] py-12 sm:py-16">
				<p className="mb-3 inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.08em] text-accent">
					<ShieldCheck size={16} aria-hidden="true" /> MEDIX ADMINISTRATION
				</p>
				<h1 className="mb-2 font-display text-3xl font-medium text-ink">Admin dashboard</h1>
				<p className="m-0 text-sm text-muted">
					Signed in{admin?.username ? ` as ${admin.username}` : ''}.
				</p>
			</section>
		</main>
	)
}
