import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import Home from './pages/Home.jsx'
import DocRegister from './pages/DocRegister.jsx'
import DocLogin from './pages/DocLogin.jsx'
import UserRegister from './pages/UserRegister.jsx'
import UserLogin from './pages/UserLogin.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminRegister from './pages/AdminRegister.jsx'

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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return <AnimatedRoutes />
}
