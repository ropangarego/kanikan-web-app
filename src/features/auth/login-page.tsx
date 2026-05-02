import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth-context'

const fieldClassName =
  'w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 outline-none ring-[var(--color-primary)] transition focus:border-[#93c5fd] focus:bg-white focus:ring'

const actionButtonClassName =
  'inline-flex w-full items-center justify-center rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold transition'

export const LoginPage = () => {
  const auth = useAuth()
  const navigate = useNavigate()
  const emailInputRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const normalizedEmail = email.includes('@') ? email.trim() : `${email.trim()}@mail.com`
      await auth.signInWithPassword(normalizedEmail, password)
      navigate('/')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  const clearEmail = () => {
    setEmail('')
    window.requestAnimationFrame(() => emailInputRef.current?.focus())
  }

  return (
    <div className="min-h-screen bg-white px-4 py-10 text-[var(--color-text)]">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.05fr_minmax(380px,420px)] md:items-center">
        <section className="flex min-h-[280px] items-center justify-center rounded-[var(--radius-shell)] bg-white p-6 sm:min-h-[340px] md:min-h-[380px] md:p-8">
          <img
            src="/cat-holding-fish.jpeg"
            alt="Cat holding fish illustration"
            className="max-h-[180px] w-full max-w-[180px] object-contain sm:max-h-[220px] sm:max-w-[220px] md:max-h-[240px] md:max-w-[240px]"
          />
        </section>

        <section className="overflow-hidden rounded-[var(--radius-shell)] border border-[var(--color-border)] bg-white text-[var(--color-text)] shadow-[0_28px_80px_rgba(15,23,42,0.12)] md:justify-self-end md:w-full md:max-w-[420px]">
          <div className="h-1.5 bg-[var(--color-primary)]" />
          <div className="p-6 sm:p-7">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Login</h2>
              <p className="text-sm text-[var(--color-text-muted)]">Masuk ke dashboard pengelolaan farm.</p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[var(--color-text)]">Email</span>
                <div className="relative">
                  <input
                    ref={emailInputRef}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={`${fieldClassName} pr-10`}
                    placeholder="name@mail.com"
                  />
                  {email ? (
                    <button
                      type="button"
                      onClick={clearEmail}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-sm font-semibold text-[var(--color-text-muted)] transition hover:bg-white hover:text-[var(--color-text)]"
                      aria-label="Clear email"
                    >
                      x
                    </button>
                  ) : null}
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[var(--color-text)]">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`${fieldClassName} pr-10`}
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-white hover:text-[var(--color-text)]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      {showPassword ? (
                        <>
                          <path d="M3 3l18 18" />
                          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                          <path d="M9.5 5.4A9.8 9.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13.8 13.8 0 0 1-2.4 3.6" />
                          <path d="M6.4 6.7A13.7 13.7 0 0 0 2.5 12C3.5 14.5 7 19 12 19a9.7 9.7 0 0 0 4-.9" />
                        </>
                      ) : (
                        <>
                          <path d="M2.5 12C3.5 9.5 7 5 12 5s8.5 4.5 9.5 7c-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7Z" />
                          <circle cx="12" cy="12" r="2.5" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </label>

              {error ? <p className="rounded-[var(--radius-control)] bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

              <div className="grid gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`${actionButtonClassName} bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-strong)] disabled:opacity-60`}
                >
                  {submitting ? 'Masuk...' : 'Lanjutkan'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}
