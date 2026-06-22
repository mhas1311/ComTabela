import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AccessibilityProvider } from './contexts/AccessibilityContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Categories from './pages/Categories'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <AccessibilityProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/transactions" element={
            <ProtectedRoute><Transactions /></ProtectedRoute>
          } />
          <Route path="/categories" element={
            <ProtectedRoute><Categories /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AccessibilityProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App