'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeRecoverySessionFromUrl, sendPasswordResetEmail, updatePassword } from '@/lib/auth/supabase-auth'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [canSetPassword, setCanSetPassword] = useState(false)

  useEffect(() => {
    const initializeRecovery = async () => {
      const { error } = await completeRecoverySessionFromUrl()
      if (error) {
        setError('This reset link is invalid or has expired.')
        return
      }

      setCanSetPassword(true)
    }

    initializeRecovery()
  }, [])

  async function handleSendResetEmail() {
    setError('')
    setSuccess('')

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)

    try {
      const { error } = await sendPasswordResetEmail(email)

      if (error) {
        throw error
      }

      setSubmitted(true)
      setSuccess('If an account exists for that email, a password reset email has been sent.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdatePassword() {
    setError('')
    setSuccess('')

    if (!password) {
      setError('Please enter a new password.')
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

    setLoading(true)

    try {
      const { error } = await updatePassword(password)

      if (error) {
        throw error
      }

      setSuccess('Password updated successfully. Redirecting to login...')
      setTimeout(() => router.push('/login'), 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="auth-card w-full max-w-md rounded-2xl border border-white/10 bg-panel p-8  backdrop-blur-xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-ink">
          {canSetPassword ? 'Set New Password' : 'Reset Password'}
        </h1>
        <p className="mb-6 text-center text-sm text-muted">
          {canSetPassword ? 'Choose a new password for your account.' : 'Enter your email to receive a reset link.'}
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

        {!canSetPassword ? (
          <div className="space-y-3">
            <label className="block space-y-1.5"><span className="block text-sm text-secondary">Email address</span><input
              aria-label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-lg border border-white/10 bg-field px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
              onKeyDown={(e) => e.key === 'Enter' && handleSendResetEmail()}
            /></label>
            <button
              type="button"
              onClick={handleSendResetEmail}
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-accent py-3 text-sm font-medium text-ink transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Sending...' : submitted ? 'Resend Email' : 'Send Reset Email'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1.5"><span className="block text-sm text-secondary">New password</span><input
              aria-label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-lg border border-white/10 bg-field px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
            /></label>
            <label className="block space-y-1.5"><span className="block text-sm text-secondary">Confirm new password</span><input
              aria-label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-lg border border-white/10 bg-field px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
              onKeyDown={(e) => e.key === 'Enter' && handleUpdatePassword()}
            /></label>
            <button
              type="button"
              onClick={handleUpdatePassword}
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-accent py-3 text-sm font-medium text-ink transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        )}

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-sm text-accent hover:text-accent-hover transition"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  )
}