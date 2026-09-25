import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type AuthProvider = 'google' | 'email'

function getMissingEnvError() {
  return new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment.')
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createSupabaseBrowserClient()
  if (!supabase) {
    return { data: null, error: getMissingEnvError() }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signUpWithEmail(email: string, password: string, username: string) {
  const supabase = createSupabaseBrowserClient()
  if (!supabase) {
    return { data: null, error: getMissingEnvError() }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username,
        display_name: username,
      },
    },
  })
  return { data, error }
}

export async function signInWithOAuth(
  provider: 'google',
  redirectTo = `${window.location.origin}/auth/callback`
) {
  const supabase = createSupabaseBrowserClient()
  if (!supabase) {
    return { data: null, error: getMissingEnvError() }
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    const message = error.message || 'Authentication failed.'

    if (/unsupported provider|provider is not enabled|not enabled/i.test(message)) {
      return {
        data: null,
        error: new Error(
          `Google OAuth is not enabled for this Supabase project. In the Supabase Dashboard, go to Authentication → Providers, enable Google, and add the redirect URL ${redirectTo}.`
        ),
      }
    }
  }

  return { data, error }
}

export async function sendPasswordResetEmail(email: string, redirectTo = `${window.location.origin}/forgot-password`) {
  const supabase = createSupabaseBrowserClient()
  if (!supabase) {
    return { data: null, error: getMissingEnvError() }
  }

  const trimmedEmail = email.trim()
  const { data, error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
    redirectTo,
  })

  return { data, error }
}

export async function updatePassword(newPassword: string) {
  const supabase = createSupabaseBrowserClient()
  if (!supabase) {
    return { data: null, error: getMissingEnvError() }
  }

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  return { data, error }
}

export async function completeRecoverySessionFromUrl() {
  const supabase = createSupabaseBrowserClient()
  if (!supabase) {
    return { error: getMissingEnvError() }
  }

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type')

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return { error }
  }

  if (tokenHash && type === 'recovery') {
    const { error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    })
    return { error }
  }

  return { error: null }
}

export async function signOutUser() {
  const supabase = createSupabaseBrowserClient()
  if (!supabase) {
    return { error: getMissingEnvError() }
  }

  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getSupabaseSession() {
  const supabase = createSupabaseBrowserClient()
  if (!supabase) {
    return { data: { session: null }, error: getMissingEnvError() }
  }

  const { data, error } = await supabase.auth.getSession()
  return { data, error }
}

export async function getCurrentUser() {
  const supabase = createSupabaseBrowserClient()
  if (!supabase) {
    return { data: { user: null }, error: getMissingEnvError() }
  }

  const { data, error } = await supabase.auth.getUser()
  return { data, error }
}

export async function updateUserProfile(updates: { username?: string; display_name?: string }) {
  const supabase = createSupabaseBrowserClient()
  if (!supabase) {
    return { data: null, error: getMissingEnvError() }
  }

  const { data, error } = await supabase.auth.updateUser({
    data: updates,
  })
  return { data, error }
}

export async function isNewUser(): Promise<{ isNew: boolean; error: Error | null }> {
  try {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) {
      return { isNew: false, error: getMissingEnvError() }
    }

    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) {
      return { isNew: false, error }
    }

    const username = data.user.user_metadata?.username
    return { isNew: !username, error: null }
  } catch (err) {
    return { isNew: false, error: err instanceof Error ? err : new Error('Unknown error') }
  }
}

export async function getLinkedIdentities(): Promise<{
  identities: Array<{ provider: string; id: string }> | null
  error: Error | null
}> {
  try {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) {
      return { identities: null, error: getMissingEnvError() }
    }

    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) {
      return { identities: null, error }
    }

    const identities =
      data.user.identities?.map((id) => ({
        provider: id.provider,
        id: id.id,
      })) || []

    return { identities, error: null }
  } catch (err) {
    return {
      identities: null,
      error: err instanceof Error ? err : new Error('Failed to get linked identities'),
    }
  }
}

export async function handleOAuthCallback(): Promise<{
  success: boolean
  redirectUrl: string
  error: Error | null
}> {
  try {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) {
      return {
        success: false,
        redirectUrl: '/login',
        error: getMissingEnvError(),
      }
    }

    const { data, error: userError } = await supabase.auth.getUser()
    if (userError || !data?.user) {
      return {
        success: false,
        redirectUrl: '/login',
        error: userError || new Error('Failed to get user after OAuth callback'),
      }
    }

    const user = data.user
    const hasUsername = !!user.user_metadata?.username

    let redirectUrl = '/dashboard'
    
    if (!hasUsername) {
      redirectUrl = '/setup-profile'
    }

    return {
      success: true,
      redirectUrl,
      error: null,
    }
  } catch (err) {
    return {
      success: false,
      redirectUrl: '/login',
      error: err instanceof Error ? err : new Error('OAuth callback failed'),
    }
  }
}