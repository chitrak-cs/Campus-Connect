import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import ServerWakeBanner from './components/ServerWakeBanner'

// Heavy pages are fetched on demand (Landing and Login stay in the main bundle for a fast first paint)
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const FilesPage = lazy(() => import('./pages/FilesPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const GroupsPage = lazy(() => import('./pages/GroupsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const Splash = () => (
  <div className="splash">
    <div className="splash__inner">
      <Spinner size="lg" label="Loading Campus Connect" />
      <p>Loading Campus Connect…</p>
    </div>
  </div>
)

// Logged in: the app shell. Logged out: landing page at "/", otherwise sign in.
const Gate = () => {
  const { user, loading, sessionExpired } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <Splash />
  if (user) return <Layout />
  if (pathname === '/') return <LandingPage />
  return <Navigate to={sessionExpired ? '/login?expired=1' : '/login'} replace />
}

const AdminRoute = ({ children }) => {
  const { user } = useAuth()
  return user?.role === 'admin' ? children : <Navigate to="/" replace />
}

// Signed-in users have no reason to see the auth pages
const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  return user ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <>
    <ServerWakeBanner />
    <Suspense fallback={<Splash />}>
    <Routes>
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
      <Route path="/" element={<Gate />}>
        <Route index element={<Dashboard />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
    </>
  )
}
