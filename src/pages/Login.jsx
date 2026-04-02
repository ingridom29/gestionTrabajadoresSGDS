import { useState } from 'react'
import { supabase } from '../supabase/client'
import styles from '../styles/Login.module.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Credenciales incorrectas')
    setLoading(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.logo}>SGDS</h1>
        <p className={styles.subtitle}>Sistema de Gestión Interna</p>
        <input className={styles.input} type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} />
        <input className={styles.input} type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.btn} onClick={handleLogin} disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </div>
    </div>
  )
}
