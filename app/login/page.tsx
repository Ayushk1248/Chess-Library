'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmail, signInWithOAuth } from '@/lib/auth/supabase-auth'

function GoogleIcon() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="size-5 animate-spin text-white/60" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#21201d]">
        <div className="size-8 animate-spin rounded-full border-4 border-white/10 border-t-[#81b64c]" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<'google' | 'email' | null>(null)
  const [error, setError] = useState(searchParams.get('error') || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    function restorePage() {
      setLoading(null)
    }

    window.addEventListener('pageshow', restorePage)
    return () => window.removeEventListener('pageshow', restorePage)
  }, [])

  async function handleGoogleSignIn() {
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

  async function handleEmailLogin() {
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.')
      return
    }

    setLoading('email')

    try {
      const { data, error } = await signInWithEmail(email.trim(), password)
      if (error) throw error
      if (data?.user) {
        router.push('/login/success?next=' + encodeURIComponent('/dashboard'))
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(/invalid login credentials/i.test(messageText) ? 'Invalid email or password.' : messageText)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#21201d] p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#262421] p-8 shadow-2xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          Welcome Back
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-400">
          Sign in to your Chess Library
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-center text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'google' ? <Spinner /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#262421] px-2 text-zinc-500">Or</span>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#81b64c]/50 focus:ring-1 focus:ring-[#81b64c]/50"
              onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#81b64c]/50 focus:ring-1 focus:ring-[#81b64c]/50"
              onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
            />
            <button
              type="button"
              onClick={handleEmailLogin}
              disabled={loading !== null}
              className="flex w-full items-center justify-center rounded-lg bg-[#81b64c] py-3 text-sm font-bold text-white transition-colors hover:bg-[#8bc255] disabled:opacity-50"
            >
              {loading === 'email' ? 'Signing in...' : 'Sign In'}
            </button>
          </div>

          <div className="space-y-2 text-center text-sm">
            <a href="/forgot-password" className="block text-[#81b64c] hover:text-[#8bc255] transition-colors">
              Forgot Password?
            </a>
            <p className="text-zinc-400">
              Don't have an account?{' '}
              <a href="/signup" className="text-[#81b64c] font-semibold hover:text-[#8bc255] transition-colors">
                Sign Up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}