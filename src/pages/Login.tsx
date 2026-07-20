import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { Button, Card, CardDescription, CardHeader, CardTitle, Input } from '../components/ui'

export default function Login() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(email, password)
    } catch {
      setError('E-mail ou senha inválidos.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-8 top-8 select-none font-bold leading-none text-muted text-[8rem]"
      >
        WP
      </span>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm"
      >
        <Card padding="lg">
          <CardHeader className="mb-6 text-center">
            <CardTitle className="text-3xl tracking-tighter">
              Work<span className="text-accent">PRO</span>
            </CardTitle>
            <CardDescription>Gerencie seus leads da Workana com IA</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="E-mail"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
            />

            <Input
              label="Senha"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />

            {error && (
              <p className="border-2 border-status-error bg-transparent px-3 py-2 text-sm normal-case text-status-error">
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} className="w-full">
              Entrar
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  )
}
