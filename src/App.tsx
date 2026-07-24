import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { PageTransition } from './components/PageTransition'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ConversationView from './pages/ConversationView'
import NewProposal from './pages/NewProposal'

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <PageTransition>
                  <Login />
                </PageTransition>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <PageTransition>
                    <Dashboard />
                  </PageTransition>
                </ProtectedRoute>
              }
            />
            <Route
              path="/conversa/:id"
              element={
                <ProtectedRoute>
                  <PageTransition>
                    <ConversationView />
                  </PageTransition>
                </ProtectedRoute>
              }
            />
            <Route
              path="/proposta"
              element={
                <ProtectedRoute>
                  <PageTransition>
                    <NewProposal />
                  </PageTransition>
                </ProtectedRoute>
              }
            />
            <Route
              path="/proposta/:id"
              element={
                <ProtectedRoute>
                  <PageTransition>
                    <NewProposal />
                  </PageTransition>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </AuthProvider>
  )
}
