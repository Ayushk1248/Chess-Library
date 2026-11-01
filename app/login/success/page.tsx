'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

export default function LoginSuccessPage() {
  return (
    <Suspense fallback={null}>
      <LoginSuccessContent />
    </Suspense>
  )
}

function LoginSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isSigningOut = searchParams.get('mode') === 'logout'
  const nextPath = searchParams.get('next') || (isSigningOut ? '/login?logged_out=1' : '/dashboard')

  useEffect(() => {
    const t = setTimeout(() => router.replace(nextPath), 2400)
    return () => clearTimeout(t)
  }, [nextPath, router])

  return (
    <main className="auth-shell flex min-h-screen items-center justify-center p-4">
      <div className="auth-card w-full max-w-md" role="status">
        <svg className="success-mark" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2" /><path fill="none" stroke="currentColor" strokeWidth="3" d="M14 27l8 7 16-17" /></svg>
        <h1>{isSigningOut ? 'Signed out' : 'You’re signed in'}</h1>
        <p>{isSigningOut ? 'Successfully signed out of Chess Library.' : 'Successfully logged into Chess Library.'}</p>
        <p className="mt-4 text-muted">{isSigningOut ? 'Returning to login…' : 'Opening your library…'}</p>
      </div>
    </main>
  )
}
