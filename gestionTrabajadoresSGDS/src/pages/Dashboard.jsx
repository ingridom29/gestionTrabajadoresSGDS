import { useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import styles from "../styles/Dashboard.module.css";

// Componentes
import Carteras from "./carteras/Carteras";
import Casuarinas from "./carteras/casuarinas/Casuarinas";
import ReportesCasuarinas from "./carteras/casuarinas/ReportesCasuarinas";
import Inventario from "./inventario/Inventario";
import Empleados from "./empleados/Empleados";
import Gastos from "./gastos/Gastos";
import Asistencia from "./empleados/Asistencia";
import Proyectos from "./proyectos/Proyectos";

const MODULES = [
  {
    key: "proyectos", title: "Proyectos",
    desc: "Gestiona obras activas, presupuestos y avances por proyecto.", count: "Ver proyectos",
    colorClass: styles.iconBlue,
    icon: (<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M2 12L5 6l3 3 3-5 3 3" stroke="#1A2F5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  },
  {
    key: "empleados", title: "Empleados",
    desc: "Ficha personal, cargos, contratos y documentos de cada trabajador.", count: "Ver empleados",
    colorClass: styles.iconYellow,
    icon: (<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="#9a7000" strokeWidth="1.4" /><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="#9a7000" strokeWidth="1.4" strokeLinecap="round" /></svg>),
  },
  {
    key: "asistencia", title: "Asistencia",
    desc: "Registro diario de entradas, salidas, faltas y tardanzas.", count: "Ver asistencia",
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

export default function Dashboard() {
  const [user,      setUser]      = useState(null);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [stats,     setStats]     = useState({
    proyectos: 0, empleados: 0, asistencia: "—", planilla: "S/ 0"
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchRealStats();
  }, []);

  async function fetchRealStats() {
    try {
      const [
        { count: countEmp },
        { count: countProy },
        { data: dataSueldos },
      ] = await Promise.all([
        supabase.from('empleados').select('*', { count: 'exact', head: true }).eq('activo', true),
        supabase.from('obras').select('*', { count: 'exact', head: true }).eq('estado', 'activa'),
        supabase.from('empleados').select('sueldo').eq('activo', true),
      ]);
      const totalPlanilla = dataSueldos?.reduce((acc, e) => acc + (e.sueldo || 0), 0) || 0;
      setStats({
        proyectos:  countProy || 0,
        empleados:  countEmp  || 0,
        asistencia: "—",
        planilla:   `S/ ${(totalPlanilla / 1000).toFixed(0)}k`,
      });
    } catch (err) {
      console.error("Error cargando estadísticas:", err);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const KPI_DATA = [
    { label: "Proyectos activos", value: stats.proyectos,  delta: "obras en curso",          deltaPositive: true  },
    { label: "Total empleados",   value: stats.empleados,  delta: "Activos",                  deltaPositive: true  },
    { label: "Asistencia hoy",    value: stats.asistencia, delta: "ver módulo asistencia",    deltaPositive: false },
    { label: "Planilla estimada", value: stats.planilla,   delta: "Mensual",                  deltaPositive: false },
  ];

  const getPageTitle = (nav) => {
    const titles = {
      dashboard:           "Dashboard General",
      carteras:            "Carteras",
      casuarinas:          "Carteras — Casuarinas",
      reportes_casuarinas: "Carteras — Reportes Casuarinas",
      inventario:          "Inventario",
      empleados:           "Empleados",
      gastos:              "Gastos",
      asistencia:          "Asistencia",
      proyectos:           "Proyectos y Obras",
    };
    return titles[nav] || "Sistema SGDS";
  };

  const renderContent = () => {
    switch (activeNav) {
      case "proyectos":           return <Proyectos />;
      case "empleados":           return <Empleados />;
      case "asistencia":          return <Asistencia />;
      case "gastos":              return <Gastos />;
      case "inventario":          return <Inventario />;
      case "carteras":            return <Carteras onNavegar={setActiveNav} />;
      case "casuarinas":          return <Casuarinas />;
      case "reportes_casuarinas": return <ReportesCasuarinas />;
      default:
        return (
          <>
            <div className={styles.sectionLabel}>Resumen del mes</div>
            <div className={styles.kpiGrid}>
              {KPI_DATA.map((k) => (
                <div key={k.label} className={styles.kpiCard}>
                  <div className={styles.kpiLabel}>{k.label}</div>
                  <div className={styles.kpiValue}>{k.value}</div>
                  <div className={`${styles.kpiDelta} ${k.deltaPositive ? styles.positive : styles.neutral}`}>
                    {k.delta}
                  </div>
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
                    <span className={styles.modArrow}>Acceder →</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
    }
  };

  const enCarteras = activeNav === "carteras" || activeNav === "casuarinas" || activeNav === "reportes_casuarinas";
  const initials   = user?.email ? user.email.slice(0, 2).toUpperCase() : "US";

  return (
    <div className={styles.shell}>

      {/* ── SIDEBAR ── */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandName}>SGDS Montenegro</div>
          <div className={styles.brandSub}>Saneamiento y Construcción</div>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navLabel}>Principal</div>
          <button className={`${styles.navItem} ${activeNav === "dashboard" ? styles.navItemActive : ""}`} onClick={() => setActiveNav("dashboard")}>
            Dashboard
          </button>

          <div className={styles.navLabel}>Gestión Operativa</div>

          <button className={`${styles.navItem} ${activeNav === "proyectos" ? styles.navItemActive : ""}`} onClick={() => setActiveNav("proyectos")}>
            Proyectos
          </button>
          <button className={`${styles.navItem} ${activeNav === "empleados" ? styles.navItemActive : ""}`} onClick={() => setActiveNav("empleados")}>
            Empleados
          </button>
          <button className={`${styles.navItem} ${activeNav === "asistencia" ? styles.navItemActive : ""}`} onClick={() => setActiveNav("asistencia")}>
            Asistencia
          </button>
          <button className={`${styles.navItem} ${activeNav === "gastos" ? styles.navItemActive : ""}`} onClick={() => setActiveNav("gastos")}>
            Gastos
          </button>
          <button className={`${styles.navItem} ${activeNav === "inventario" ? styles.navItemActive : ""}`} onClick={() => setActiveNav("inventario")}>
            Inventario
          </button>

          <div className={styles.navLabel}>Administración</div>
          <button className={`${styles.navItem} ${enCarteras ? styles.navItemActive : ""}`} onClick={() => setActiveNav("carteras")}>
            Carteras
          </button>
          {enCarteras && (
            <div className={styles.subNav}>
              <button onClick={() => setActiveNav("casuarinas")}>└ Casuarinas</button>
              <button onClick={() => setActiveNav("reportes_casuarinas")}>└ Reportes</button>
            </div>
          )}
        </nav>

        {/* ── FOOTER: usuario + cerrar sesión ── */}
        <div className={styles.sidebarFooter}>
          <div className={styles.userRow}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>
                {user?.email?.split('@')[0] || 'Usuario'}
              </div>
              <div className={styles.userRole}>Administrador</div>
            </div>
            <button
              className={styles.logoutBtn}
              onClick={handleLogout}
              title="Cerrar sesión"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className={styles.main}>
        <div className={styles.topbar}>
          <span className={styles.pageTitle}>{getPageTitle(activeNav)}</span>
          <div className={styles.topbarRight}>
            <span className={styles.badgePill}>
              {new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
        <div className={styles.content}>
          {renderContent()}
        </div>
      </main>

    </div>
  );
}