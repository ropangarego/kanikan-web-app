import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider } from './features/auth/auth-context'
import { AppDataProvider } from './features/app/app-data-context'
import { ToastProvider } from './features/feedback/toast-provider'
import { AppRouter } from './routes/app-router'

function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  useEffect(() => {
    let darkMode = false
    try {
      const raw = window.localStorage.getItem('kanikan-dark-mode')
      darkMode = raw ? JSON.parse(raw) === true : false
    } catch {
      darkMode = false
    }
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light'
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppDataProvider>
          <ToastProvider>
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
          </ToastProvider>
        </AppDataProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
