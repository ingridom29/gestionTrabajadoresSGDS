import { useEffect, useState } from 'react'
import { supabase } from './supabase/client'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function App() {
  const [session,  setSession]  = useState(null)
  const [cargando, setCargando] = useState(true) // ← evita el flash del Login

  useEffect(() => {
    // Verificar sesión existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setCargando(false) // ← ya sabemos si hay sesión o no
    })

    // Escuchar cambios (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setCargando(false)
    })

    return () => subscription.unsubscribe() // ← limpiar listener al desmontar
  }, [])

  // Mientras verifica la sesión, no mostrar nada
  if (cargando) return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f4f6f9',
      fontFamily: 'Poppins, sans-serif', color: '#94a3b8', fontSize: 14
    }}>
      Cargando...
    </div>
  )

  return (
    <div style={{ height: '100%', width: '100%' }}>
      {session ? <Dashboard /> : <Login />}
    </div>
  )
}

export default App