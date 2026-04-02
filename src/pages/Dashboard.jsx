import styles from '../styles/Dashboard.module.css'
import { supabase } from '../supabase/client'

export default function Dashboard() {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.logo}>SGDS</h1>
        <button className={styles.logoutBtn} onClick={handleLogout}>Cerrar sesion</button>
      </header>
      <main className={styles.main}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Nuestros Proyectos</h2>
          <p className={styles.cardDesc}>Gestiona y visualiza los proyectos activos de SGDS Montenegro.</p>
        </div>
      </main>
    </div>
  )
}
