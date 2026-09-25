'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const [isConfirming, setIsConfirming] = useState(false)

  async function handleSignOut() {
  const supabase = createSupabaseBrowserClient()
  if (!supabase) {
    window.location.replace('/')
    return
  }

  await supabase.auth.signOut()
  window.location.replace('/login/success?mode=logout&next=/')
}

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
      >
        <LogOut className="size-4" />
        Sign Out
      </button>

      {isConfirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-white">Sign Out?</h3>
            <p className="mt-2 text-sm text-slate-400">
              Are you sure you want to sign out?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsConfirming(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}