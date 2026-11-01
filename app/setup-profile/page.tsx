'use client'

import { Crown } from "lucide-react"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, updatePassword, updateUserProfile, isNewUser, getLinkedIdentities } from '@/lib/auth/supabase-auth'

export default function SetupProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [linkedProviders, setLinkedProviders] = useState<string[]>([])

  useEffect(() => {
    checkAndSetup()
  }, [])

  async function checkAndSetup() {
    try {
      const { isNew, error: newUserError } = await isNewUser()

      if (newUserError) {
        setError('Unable to verify your account. Please try logging in again.')
        setTimeout(() => router.push('/login'), 2000)
        return
      }

      if (!isNew) {
        const { identities, error: identError } = await getLinkedIdentities()
        if (!identError && identities) {
          const providers = identities.map((id) => id.provider)
          setLinkedProviders(providers)
          setInfo(`Your account is already set up with: ${providers.join(', ')}. Your profile was automatically restored.`)
        }
        setTimeout(() => router.push('/dashboard'), 2000)
        return
      }

      const { data, error: userError } = await getCurrentUser()
      if (userError || !data?.user) {
        setError('Session expired. Please log in again.')
        setTimeout(() => router.push('/login'), 2000)
        return
      }

      const { identities } = await getLinkedIdentities()
      if (identities) {
        const providers = identities.map((id) => id.provider)
        setLinkedProviders(providers)
        if (providers.length > 1) {
          setInfo(`Your account is linked with: ${providers.join(', ')}. You can use any of these to sign in.`)
        }
      }

      setLoading(false)
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setTimeout(() => router.push('/login'), 2000)
    }
  }

  async function handleSetupProfile() {
    setError('')

    if (!username.trim() || username.trim().length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)

    try {
      const { error: passwordError } = await updatePassword(password)
      if (passwordError) throw passwordError

      const { error: profileError } = await updateUserProfile({
        username: username.trim(),
        display_name: username.trim(),
      })
      if (profileError) throw profileError

      router.push('/login/success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="auth-shell flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-accent mx-auto" />
          <p className="text-sm text-muted">Setting up your profile...</p>
        </div>
      </div>
    )
  }

  if (info && !error) {
    return (
      <div className="auth-shell flex min-h-screen items-center justify-center bg-canvas p-4">
        <div className="text-center">
          <div className="mb-4 text-lg text-accent">✓</div>
          <div className="rounded-lg border border-accent/30 bg-accent/10 p-4 text-sm text-accent max-w-sm mb-4">
            {info}
          </div>
          <p className="text-xs text-muted">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell relative flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="auth-card w-full max-w-md rounded-2xl border border-white/5 bg-panel px-8 py-10 ">
        <div className="mb-6 text-center">
          <Crown size={28} className="text-accent mx-auto" aria-hidden="true" />
        </div>

        <h1 className="mb-2 text-center text-xl font-bold text-ink">Complete your profile</h1>
        <p className="mb-7 text-center text-sm text-muted">Set up your username and password to get started</p>

        {error && (
          <p className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-2.5 text-center text-sm text-error">
            {error}
          </p>
        )}

        {linkedProviders.length > 0 && (
          <p className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5 text-center text-xs text-accent">
            Connected with: {linkedProviders.join(', ')}
          </p>
        )}

        <div className="rounded-xl border border-white/5 bg-black/20 p-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted">Username</label>
              <input
                aria-label="Choose a username"
              type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="mt-1 w-full rounded-lg border border-white/10 bg-field px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted">Password</label>
              <input
                aria-label="Create a password"
              type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                className="mt-1 w-full rounded-lg border border-white/10 bg-field px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/50"
              />
              <p className="mt-1 text-xs text-muted">You&apos;ll be able to sign in with email + password or Google</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted">Confirm password</label>
              <input
                aria-label="Confirm password"
              type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                className="mt-1 w-full rounded-lg border border-white/10 bg-field px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/50"
                onKeyDown={(e) => e.key === 'Enter' && handleSetupProfile()}
              />
            </div>

            <button
              type="button"
              onClick={handleSetupProfile}
              disabled={saving}
              className="mt-4 flex w-full items-center justify-center rounded-lg bg-accent py-3 text-sm font-bold text-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Continue to Dashboard'}
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-muted">You can change these settings later</p>
      </div>
    </div>
  )
}