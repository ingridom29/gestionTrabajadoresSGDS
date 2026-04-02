import { useEffect, useState } from 'react'
import { supabase } from './supabase/client'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_event, session) => setSession(session))
  }, [])

  return (
    <div style={{ height: '100%', width: '100%' }}>
      {session ? <Dashboard /> : <Login />}
    </div>
  )
}

export default App