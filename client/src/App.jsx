import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useContext, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import Home from './pages/Home.jsx'
import DocRegister from './pages/DocRegister.jsx'
import DocLogin from './pages/DocLogin.jsx'
import UserRegister from './pages/UserRegister.jsx'
import UserLogin from './pages/UserLogin.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminRegister from './pages/AdminRegister.jsx'
import AdminMain from './pages/AdminMain.jsx'
import UserMain from './pages/UserMain.jsx'
import DocMain from './pages/DocMain.jsx'
import UserContext from './context/UserContext.jsx'
import DoctorContext from './context/DocContext.jsx'
import { DoctorDataContext } from './context/DoctorDataContext.js'
import { UserDataContext } from './context/UserDataContext.js'

function AuthGuard({ audience, children }) {
  const auth = useContext(audience === 'doctor' ? DoctorDataContext : UserDataContext)
  const loginPath = audience === 'doctor' ? '/doctor/login' : '/user/login'

  if (auth.isLoading) {
    return <main className="auth-page auth-loading" aria-live="polite">Restoring your session…</main>
  }
  if (!auth.account) return <Navigate to={loginPath} replace />
  return children
}

function AdminGuard({ children }) {
  if (!sessionStorage.getItem('adminAccessToken')) {
    return <Navigate to="/admin/login" replace />
  }
  return children
}

function AnimatedRoutes() {
  const location = useLocation()
  const pageRef = useRef(null)

  useLayoutEffect(() => {
    const page = pageRef.current
    if (!page || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const animation = gsap.fromTo(
      page,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.48, ease: 'power2.out' }
    )

    return () => animation.kill()
  }, [location.pathname])

  return (
    <div ref={pageRef} className="page-transition">
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/doctor/register" element={<DocRegister />} />
        <Route path="/doctor/login" element={<DocLogin />} />
        <Route path="/user/register" element={<UserRegister />} />
        <Route path="/user/login" element={<UserLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/register" element={<AdminRegister />} />
        <Route
          path="/admin/dashboard"
          element={<AdminGuard><AdminMain /></AdminGuard>}
        />
        <Route
          path="/user/dashboard"
          element={<AuthGuard audience="user"><UserMain /></AuthGuard>}
        />
        <Route
          path="/doctor/dashboard"
          element={<AuthGuard audience="doctor"><DocMain /></AuthGuard>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <UserContext>
      <DoctorContext>
        <AnimatedRoutes />
      </DoctorContext>
    </UserContext>
  )
}
