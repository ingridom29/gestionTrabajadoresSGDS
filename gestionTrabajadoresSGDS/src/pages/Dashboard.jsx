import { useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import styles from "../styles/Dashboard.module.css";
import Carteras from "./carteras/Carteras";
import Casuarinas from "./carteras/casuarinas/Casuarinas";
import ReportesCasuarinas from "./carteras/casuarinas/ReportesCasuarinas";
import Inventario from "./inventario/Inventario";
import Empleados from "./empleados/Empleados";
import Gastos from "./gastos/Gastos";
import Asistencia from "./empleados/Asistencia";

const MODULES = [
  {
    key: "proyectos", title: "Proyectos",
    desc: "Gestiona obras activas, presupuestos y avances por proyecto.", count: "12 activos",
    colorClass: styles.iconBlue,
    icon: (<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M2 12L5 6l3 3 3-5 3 3" stroke="#1A2F5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  },
  {
    key: "empleados", title: "Empleados",
    desc: "Ficha personal, cargos, contratos y documentos de cada trabajador.", count: "84 registrados",
    colorClass: styles.iconYellow,
    icon: (<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="#9a7000" strokeWidth="1.4" /><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="#9a7000" strokeWidth="1.4" strokeLinecap="round" /></svg>),
  },
  {
    key: "asistencia", title: "Asistencia",
    desc: "Registro diario de entradas, salidas, faltas y tardanzas.", count: "Hoy: 77/84",
    colorClass: styles.iconGreen,
    icon: (<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="2" stroke="#15803d" strokeWidth="1.4" /><path d="M5 3V1M11 3V1M1 7h14" stroke="#15803d" strokeWidth="1.4" strokeLinecap="round" /></svg>),
  },
  {
    key: "gastos", title: "Gastos",
    desc: "Control de gastos por obra, gastos personales y compensaciones.", count: "Ver registros",
    colorClass: styles.iconOrange,
    icon: (<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="2" stroke="#c2410c" strokeWidth="1.4" /><path d="M1 7h14M5 10h2M10 10h1" stroke="#c2410c" strokeWidth="1.4" strokeLinecap="round" /></svg>),
  },
  {
    key: "carteras", title: "Carteras",
    desc: "Gestión de socios, cobranza, boletas y contratos por cartera.", count: "Ver carteras",
    colorClass: styles.iconTeal,
    icon: (<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M2 13h12M4 13V7l4-4 4 4v6" stroke="#0369a1" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><rect x="6" y="10" width="4" height="3" rx="0.5" stroke="#0369a1" strokeWidth="1.4" /></svg>),
  },
];

const KPI_DATA = [
  {
    label: "Proyectos activos", value: "12", delta: "+2 este mes", deltaPositive: true,
    colorClass: styles.iconBlue,
    icon: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 12L5 6l3 3 3-5 3 3" stroke="#1A2F5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  },
  {
    label: "Total empleados", value: "84", delta: "+5 incorporaciones", deltaPositive: true,
    colorClass: styles.iconYellow,
    icon: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="#9a7000" strokeWidth="1.4" /><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="#9a7000" strokeWidth="1.4" strokeLinecap="round" /></svg>),
  },
  {
    label: "Asistencia hoy", value: "91%", delta: "Por encima del objetivo", deltaPositive: true,
    colorClass: styles.iconGreen,
    icon: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="2" stroke="#15803d" strokeWidth="1.4" /><path d="M5 3V1M11 3V1M1 7h14" stroke="#15803d" strokeWidth="1.4" strokeLinecap="round" /></svg>),
  },
  {
    label: "Planilla mensual", value: "S/ 248k", delta: "Procesado", deltaPositive: false,
    colorClass: styles.iconOrange,
    icon: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 1v8M8 1l-3 3M8 1l3 3" stroke="#c2410c" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" stroke="#c2410c" strokeWidth="1.4" strokeLinecap="round" /></svg>),
  },
];

const CARTERAS_NAV = ["carteras", "casuarinas", "reportes_casuarinas"];

function getPageTitle(activeNav) {
  if (activeNav === "dashboard")           return "Dashboard General";
  if (activeNav === "carteras")            return "Carteras";
  if (activeNav === "casuarinas")          return "Carteras — Casuarinas";
  if (activeNav === "reportes_casuarinas") return "Carteras — Reportes Casuarinas";
  if (activeNav === "inventario")          return "Inventario";
  if (activeNav === "empleados")           return "Empleados";
  if (activeNav === "gastos")              return "Gastos";
  if (activeNav === "asistencia")          return "Asistencia";
  const mod = MODULES.find((m) => m.key === activeNav);
  return mod ? mod.title : "Dashboard";
}

export default function Dashboard() {
  const [user, setUser]           = useState(null);
  const [activeNav, setActiveNav] = useState("dashboard");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const now        = new Date();
  const monthLabel = now.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  const initials   = user?.email ? user.email.slice(0, 2).toUpperCase() : "US";
  const enCarteras = CARTERAS_NAV.includes(activeNav);

  const renderContent = () => {
    if (activeNav === "carteras")            return <Carteras onNavegar={setActiveNav} />;
    if (activeNav === "casuarinas")          return <Casuarinas />;
    if (activeNav === "reportes_casuarinas") return <ReportesCasuarinas />;
    if (activeNav === "inventario")          return <Inventario />;
    if (activeNav === "empleados")           return <Empleados />;
    if (activeNav === "gastos")              return <Gastos />;
    if (activeNav === "asistencia")          return <Asistencia />;
    return (
      <>
        <div className={styles.sectionLabel}>Resumen del mes</div>
        <div className={styles.kpiGrid}>
          {KPI_DATA.map((k) => (
            <div key={k.label} className={styles.kpiCard}>
              <div className={`${styles.kpiIcon} ${k.colorClass}`}>{k.icon}</div>
              <div className={styles.kpiLabel}>{k.label}</div>
              <div className={styles.kpiValue}>{k.value}</div>
              <div className={`${styles.kpiDelta} ${k.deltaPositive ? styles.positive : styles.neutral}`}>{k.delta}</div>
            </div>
          ))}
        </div>
        <div className={styles.sectionLabel}>Módulos del sistema</div>
        <div className={styles.modulesGrid}>
          {MODULES.map((m) => (
            <div key={m.key} className={styles.modCard} onClick={() => setActiveNav(m.key)}>
              <div className={styles.modHeader}>
                <div className={`${styles.modIcon} ${m.colorClass}`}>{m.icon}</div>
                <div className={styles.modTitle}>{m.title}</div>
              </div>
              <div className={styles.modDesc}>{m.desc}</div>
              <div className={styles.modFooter}>
                <span className={styles.modCount}>{m.count}</span>
                <span className={styles.modArrow}>Ver →</span>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandName}>SGDS Montenegro</div>
          <div className={styles.brandSub}>Sistema de Gestión</div>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navLabel}>Principal</div>
          <button
            className={`${styles.navItem} ${activeNav === "dashboard" ? styles.navItemActive : ""}`}
            onClick={() => setActiveNav("dashboard")}
          >
            <svg className={styles.navIcon} viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
              <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5" />
              <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5" />
              <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5" />
            </svg>
            Dashboard
          </button>

          <div className={styles.navLabel}>Módulos</div>

          {/* Empleados */}
          <button
            className={`${styles.navItem} ${activeNav === "empleados" ? styles.navItemActive : ""}`}
            onClick={() => setActiveNav("empleados")}
          >
            <svg className={styles.navIcon} viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Empleados
          </button>

          {/* Asistencia */}
          <button
            className={`${styles.navItem} ${activeNav === "asistencia" ? styles.navItemActive : ""}`}
            onClick={() => setActiveNav("asistencia")}
          >
            <svg className={styles.navIcon} viewBox="0 0 16 16" fill="none">
              <rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5 3V1M11 3V1M1 7h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Asistencia
          </button>

          {/* Gastos */}
          <button
            className={`${styles.navItem} ${activeNav === "gastos" ? styles.navItemActive : ""}`}
            onClick={() => setActiveNav("gastos")}
          >
            <svg className={styles.navIcon} viewBox="0 0 16 16" fill="none">
              <rect x="1" y="4" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M1 7h14M5 10h2M10 10h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Gastos
          </button>



          {/* Inventario */}
          <button
            className={`${styles.navItem} ${activeNav === "inventario" ? styles.navItemActive : ""}`}
            onClick={() => setActiveNav("inventario")}
          >
            <svg className={styles.navIcon} viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            Inventario
          </button>

          <div className={styles.navLabel}>Carteras</div>

          <button
            className={`${styles.navItem} ${activeNav === "carteras" ? styles.navItemActive : ""}`}
            onClick={() => setActiveNav("carteras")}
          >
            <svg className={styles.navIcon} viewBox="0 0 16 16" fill="none">
              <path d="M2 13h12M4 13V7l4-4 4 4v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="6" y="10" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            Carteras
          </button>

          {enCarteras && (
            <>
              <button
                className={`${styles.navItem} ${activeNav === "casuarinas" ? styles.navItemActive : ""}`}
                onClick={() => setActiveNav("casuarinas")}
                style={{ paddingLeft: "28px" }}
              >
                <span style={{ fontSize: "11px", opacity: 0.6, marginRight: "6px" }}>└</span>
                Casuarinas
              </button>
              <button
                className={`${styles.navItem} ${activeNav === "reportes_casuarinas" ? styles.navItemActive : ""}`}
                onClick={() => setActiveNav("reportes_casuarinas")}
                style={{ paddingLeft: "40px" }}
              >
                <span style={{ fontSize: "11px", opacity: 0.6, marginRight: "6px" }}>└</span>
                Reportes
              </button>
            </>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userRow}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user?.email ?? "Usuario"}</div>
              <div className={styles.userRole}>Recursos Humanos</div>
            </div>
            <button className={styles.logoutBtn} onClick={handleLogout} title="Cerrar sesión">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topbar}>
          <span className={styles.pageTitle}>{getPageTitle(activeNav)}</span>
          <div className={styles.topbarRight}>
            <span className={styles.badgePill}>{monthLabel}</span>
          </div>
        </div>
        <div className={styles.content}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}