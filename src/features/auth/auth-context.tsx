import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { loadFromStorage, saveToStorage } from '../../lib/local-storage'
import { hasStoredLanguage, setStoredLanguage } from '../../lib/i18n'
import type { Profile, Role } from '../../types/domain'
import { seedSnapshot } from '../../lib/seed-data'

interface AuthContextValue {
  loading: boolean
  isDemoMode: boolean
  isAuthenticated: boolean
  profile: Profile | null
  signInWithPassword: (email: string, password: string) => Promise<void>
  signInDemo: (role: Role) => Promise<void>
  signOut: () => Promise<void>
  updateLocalProfile: (updater: (profile: Profile) => Profile) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const DEMO_STORAGE_KEY = 'kanikan-demo-profile'

const getSeedProfile = (role: Role) =>
  seedSnapshot.profiles.find((profile) => profile.role === role) ?? seedSnapshot.profiles[0]

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setProfile(loadFromStorage<Profile | null>(DEMO_STORAGE_KEY, getSeedProfile('owner')))
      setLoading(false)
      return
    }

    const bootstrap = async () => {
      const { data } = await supabase!.auth.getSession()
      const user = data.session?.user
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profileData } = await supabase!
        .from('profiles')
        .select('id, full_name, role, language, telegram_id')
        .eq('id', user.id)
        .single()

      if (profileData) {
        if (!hasStoredLanguage()) setStoredLanguage(profileData.language)
        setProfile({
          id: user.id,
          fullName: profileData.full_name ?? user.email ?? 'KANIKAN User',
          email: user.email ?? '',
          role: profileData.role,
          language: profileData.language,
          telegramId: String(profileData.telegram_id ?? ''),
        })
      }
      setLoading(false)
    }

    void bootstrap()

    const { data: listener } = supabase!.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      const demoProfile = getSeedProfile(email.includes('member') ? 'member' : 'owner')
      saveToStorage(DEMO_STORAGE_KEY, demoProfile)
      setProfile(demoProfile)
      return
    }

    const { data, error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: profileData } = await supabase!
      .from('profiles')
      .select('id, full_name, role, language, telegram_id')
      .eq('id', data.user.id)
      .single()

    setStoredLanguage(profileData?.language ?? 'id')
    setProfile({
      id: data.user.id,
      fullName: profileData?.full_name ?? data.user.email ?? 'KANIKAN User',
      email: data.user.email ?? '',
      role: profileData?.role ?? 'member',
      language: profileData?.language ?? 'id',
      telegramId: String(profileData?.telegram_id ?? ''),
    })
  }

  const signInDemo = async (role: Role) => {
    const demoProfile = getSeedProfile(role)
    saveToStorage(DEMO_STORAGE_KEY, demoProfile)
    setProfile(demoProfile)
  }

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase!.auth.signOut()
    } else {
      window.localStorage.removeItem(DEMO_STORAGE_KEY)
    }
    setProfile(null)
  }

  const updateLocalProfile = (updater: (current: Profile) => Profile) => {
    setProfile((current) => {
      if (!current) return current
      const next = updater(current)
      setStoredLanguage(next.language)
      if (!isSupabaseConfigured) saveToStorage(DEMO_STORAGE_KEY, next)
      return next
    })
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      isDemoMode: !isSupabaseConfigured,
      isAuthenticated: Boolean(profile),
      profile,
      signInWithPassword,
      signInDemo,
      signOut,
      updateLocalProfile,
    }),
    [loading, profile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
