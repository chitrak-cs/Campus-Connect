import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import Dashboard from './pages/Dashboard'
import FilesPage from './pages/FilesPage'
import ChatPage from './pages/ChatPage'
import GroupsPage from './pages/GroupsPage'
import AdminPage from './pages/AdminPage'
import ProfilePage from './pages/ProfilePage'
import NotFoundPage from './pages/NotFoundPage'

const Splash = () => (
  <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
      <Spinner size="lg" label="Loading Campus Connect" />
      <p style={{ marginTop: 12 }}>Loading Campus Connect…</p>
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
  )
}
