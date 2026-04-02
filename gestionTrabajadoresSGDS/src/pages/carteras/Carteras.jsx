import styles from "../../styles/carteras/Carteras.module.css";

const CARTERAS_LIST = [
  {
    key: "casuarinas",
    title: "Casuarinas",
    desc: "Gestión de cobranza de socios. Registro de pagos parciales por avance, historial y seguimiento de saldos.",
    socios: 254,
    estado: "Activa",
    servicio: "Agua, Desagüe y Electrificación",
    colorClass: "blue",
    icon: (
      <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
        <path d="M2 13h12M4 13V7l4-4 4 4v6" stroke="#1A2F5E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="6" y="10" width="4" height="3" rx="0.5" stroke="#1A2F5E" strokeWidth="1.4" />
      </svg>
    ),
  },
  // Aquí irán las futuras carteras
];

export default function Carteras({ onNavegar }) {
  return (
    <div className={styles.wrap}>

      <div className={styles.header}>
        <div>
          <div className={styles.headerTitle}>Carteras de cobranza</div>
          <div className={styles.headerSub}>Gestiones especiales con clientes o comunidades con pagos recurrentes</div>
        </div>
        <button className={styles.btnNueva}>+ Nueva cartera</button>
      </div>

      <div className={styles.grid}>
        {CARTERAS_LIST.map((c) => (
          <div key={c.key} className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.cardIconWrap}>{c.icon}</div>
              <span className={styles.estadoBadge}>{c.estado}</span>
            </div>

            <div className={styles.cardTitle}>{c.title}</div>
            <div className={styles.cardServicio}>{c.servicio}</div>
            <div className={styles.cardDesc}>{c.desc}</div>

            <div className={styles.cardStats}>
              <div className={styles.stat}>
                <span className={styles.statVal}>{c.socios}</span>
                <span className={styles.statLabel}>Socios</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statVal}>Activa</span>
                <span className={styles.statLabel}>Estado</span>
              </div>
            </div>

            <button
              className={styles.btnEntrar}
              onClick={() => onNavegar(c.key)}
            >
              Abrir cartera →
            </button>
          </div>
        ))}

        {/* Card placeholder para futuras carteras */}
        <div className={styles.cardPlaceholder}>
          <div className={styles.placeholderIcon}>
            <svg width="32" height="32" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="3 2" />
              <path d="M8 5v6M5 8h6" stroke="#cbd5e1" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div className={styles.placeholderText}>Nueva cartera</div>
          <div className={styles.placeholderSub}>Próximamente podrás agregar más gestiones aquí</div>
        </div>
      </div>
    </div>
  );
}