'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signUpWithEmail, signInWithOAuth } from '@/lib/auth/supabase-auth'

function GoogleIcon() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="var(--color-google-blue)"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="var(--color-google-green)"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="var(--color-google-yellow)"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="var(--color-google-red)"/>
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="size-5 animate-spin text-ink/60" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<'google' | 'email' | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    function restorePage() {
      setLoading(null)
    }

    window.addEventListener('pageshow', restorePage)
    return () => window.removeEventListener('pageshow', restorePage)
  }, [])

  async function handleGoogleSignUp() {
    setError('')
    setLoading('google')

    try {
      const { error } = await signInWithOAuth('google')
      if (error) throw error
    } catch (err) {
      setLoading(null)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  async function handleEmailSignup() {
    setError('')
    setSuccess('')

    if (!username.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading('email')

    try {
      const { data, error } = await signUpWithEmail(email.trim(), password, username.trim())
      if (error) throw error

      if (data?.user) {
        setSuccess('Account created! Check your email to verify your address.')
        setUsername('')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setTimeout(() => router.push('/login'), 3000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="auth-shell flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="auth-card w-full max-w-md rounded-2xl border border-white/5 bg-panel p-8 ">
        <h1 className="mb-2 text-center text-2xl font-bold text-ink">
          Create Account
        </h1>
        <p className="mb-6 text-center text-sm text-muted">
          Join Chess Library to build your repertoire
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-2.5 text-center text-sm text-error">
            {error}
          </p>
        )}

        {success && (
          <p className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-center text-sm text-accent">
            {success}
          </p>
        )}

        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 py-3 text-sm font-semibold text-ink transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'google' ? <Spinner /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-panel px-2 text-muted">Or</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block space-y-1.5"><span className="block text-sm text-secondary">Username</span><input
              aria-label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full rounded-lg border border-white/10 bg-field px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/50"
            /></label>
            <label className="block space-y-1.5"><span className="block text-sm text-secondary">Email address</span><input
              aria-label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-lg border border-white/10 bg-field px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/50"
            /></label>
            <label className="block space-y-1.5"><span className="block text-sm text-secondary">Password (min 6 characters)</span><input
              aria-label="Password (min 6 characters)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              className="w-full rounded-lg border border-white/10 bg-field px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/50"
            /></label>
            <label className="block space-y-1.5"><span className="block text-sm text-secondary">Confirm password</span><input
              aria-label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full rounded-lg border border-white/10 bg-field px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/50"
              onKeyDown={(e) => e.key === 'Enter' && handleEmailSignup()}
            /></label>
            <button
              type="button"
              onClick={handleEmailSignup}
              disabled={loading !== null}
              className="flex w-full items-center justify-center rounded-lg bg-accent py-3 text-sm font-bold text-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {loading === 'email' ? 'Creating account...' : 'Sign Up'}
            </button>
          </div>

          <p className="text-center text-sm text-muted">
            Already have an account?{' '}
            <a href="/login" className="text-accent font-semibold hover:text-accent-hover transition-colors">
              Sign In
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}