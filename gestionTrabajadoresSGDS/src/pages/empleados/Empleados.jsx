import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../supabase/client";
import styles from "../../styles/empleados/Empleados.module.css";

const fmt = (n) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency", currency: "PEN", minimumFractionDigits: 0,
  }).format(Number(n) || 0);

const fmtFecha = (f) =>
  f ? new Date(f + "T12:00:00").toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  }) : "—";

// Calcula próximo sábado de pago dado una fecha de ingreso (o fecha base global)
const calcularProximoPago = (fechaIngreso) => {
  const hoy = new Date();
  const base = fechaIngreso
    ? new Date(fechaIngreso + "T12:00:00")
    : new Date("2026-03-30T12:00:00");

  // Buscar el sábado que cierra la segunda semana (días 7-13 desde ingreso)
  let primerPago = null;
  for (let i = 7; i <= 13; i++) {
    const d = new Date(base.getTime() + i * 24 * 60 * 60 * 1000);
    if (d.getDay() === 6) { primerPago = d; break; }
  }
  if (!primerPago) primerPago = new Date(base.getTime() + 13 * 24 * 60 * 60 * 1000);

  // Avanzar quincenas hasta encontrar el próximo pago
  const diff = Math.max(0, Math.floor((hoy - primerPago) / (1000 * 60 * 60 * 24 * 14)));
  const ultimoPago = new Date(primerPago.getTime() + diff * 14 * 24 * 60 * 60 * 1000);
  const proximoPago = ultimoPago < hoy
    ? new Date(ultimoPago.getTime() + 14 * 24 * 60 * 60 * 1000)
    : ultimoPago;
  const diasRestantes = Math.ceil((proximoPago - hoy) / (1000 * 60 * 60 * 24));
  return { proximo: proximoPago, diasRestantes, ultimo: ultimoPago };
};

// Para KPIs globales usa base del 30 de marzo
const proximoSabadoPago = () => calcularProximoPago(null);

const CARGOS = ["GERENTE GENERAL", "ANALISTA DE NEGOCIOS", "INGENIERO", "PRACTICANTE", "MAESTRO DE OBRA", "PEÓN", "VIGÍA", "OTRO"];
const BANCOS = ["BCP", "BBVA", "Interbank", "Scotiabank", "BanBif", "Otro"];
const GRUPOS = ["SGDS MONTENEGRO", "STAFF ING. PERCY", "OTRO"];

export default function Empleados() {
  const [empleados, setEmpleados]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [busqueda, setBusqueda]           = useState("");
  const [filtroCargo, setFiltroCargo]     = useState("todos");
  const [tabPrincipal, setTabPrincipal]   = useState("empleados");
  const [modalEmp, setModalEmp]           = useState(null);
  const [tabModal, setTabModal]           = useState("datos");
  const [pagos, setPagos]                 = useState([]);
  const [loadingPagos, setLoadingPagos]   = useState(false);
  const [showPagoForm, setShowPagoForm]   = useState(false);
  const [savingPago, setSavingPago]       = useState(false);
  const [nuevoPago, setNuevoPago]         = useState({
    fecha_pago: new Date().toISOString().split("T")[0],
    monto: "", observacion: "",
  });
  const [modalNuevo, setModalNuevo]       = useState(false);
  const [guardando, setGuardando]         = useState(false);
  const [nuevoEmp, setNuevoEmp]           = useState({
    dni: "", nombres: "", apellido_paterno: "", apellido_materno: "",
    correo: "", celular: "", fecha_nacimiento: "", fecha_ingreso: "",
    cargo: "PEÓN", grupo: "SGDS MONTENEGRO", sueldo: "",
    talla_polo: "", talla_pantalon: "", talla_zapatilla: "",
    banco: "", tipo_cuenta: "", numero_cuenta: "", cuenta_interbancaria: "",
  });
  const [editando, setEditando]           = useState(false);
  const [datosEdit, setDatosEdit]         = useState({});
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  const { proximo, diasRestantes, ultimo } = proximoSabadoPago();
  const alertaPago = diasRestantes <= 3;

  const cargarEmpleados = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("empleados")
      .select(`*, epp_empleados(*), cuentas_empleados(*)`)
      .order("apellido_paterno");
    setEmpleados(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargarEmpleados(); }, [cargarEmpleados]);

  const abrirModal = async (emp) => {
    setModalEmp(emp);
    setTabModal("datos");
    setEditando(false);
    setShowPagoForm(false);
    setLoadingPagos(true);
    const { data } = await supabase
      .from("pagos_empleados").select("*")
      .eq("empleado_id", emp.id).order("fecha_pago", { ascending: false });
    setPagos(data || []);
    setLoadingPagos(false);
  };

  const cerrarModal = () => {
    setModalEmp(null); setPagos([]);
    setShowPagoForm(false); setEditando(false);
    setNuevoPago({ fecha_pago: new Date().toISOString().split("T")[0], monto: "", observacion: "" });
  };

  const guardarPago = async () => {
    if (!nuevoPago.monto || Number(nuevoPago.monto) <= 0) return;
    setSavingPago(true);
    const { error } = await supabase.from("pagos_empleados").insert({
      empleado_id: modalEmp.id,
      fecha_pago:  nuevoPago.fecha_pago,
      monto:       Number(nuevoPago.monto),
      observacion: nuevoPago.observacion || null,
    });
    if (!error) {
      const { data } = await supabase.from("pagos_empleados").select("*")
        .eq("empleado_id", modalEmp.id).order("fecha_pago", { ascending: false });
      setPagos(data || []);
      setShowPagoForm(false);
      setNuevoPago({ fecha_pago: new Date().toISOString().split("T")[0], monto: "", observacion: "" });
    }
    setSavingPago(false);
  };

  const guardarNuevoEmpleado = async () => {
    if (!nuevoEmp.dni || !nuevoEmp.apellido_paterno || !nuevoEmp.cargo) return;
    setGuardando(true);
    const { data: empCreado, error } = await supabase.from("empleados").insert({
      dni:              nuevoEmp.dni.trim(),
      nombres:          nuevoEmp.nombres.trim().toUpperCase() || null,
      apellido_paterno: nuevoEmp.apellido_paterno.trim().toUpperCase(),
      apellido_materno: nuevoEmp.apellido_materno.trim().toUpperCase() || null,
      correo:           nuevoEmp.correo.trim() || null,
      celular:          nuevoEmp.celular.trim() || null,
      fecha_nacimiento: nuevoEmp.fecha_nacimiento || null,
      fecha_ingreso:    nuevoEmp.fecha_ingreso || null,
      cargo:            nuevoEmp.cargo,
      grupo:            nuevoEmp.grupo,
      sueldo:           Number(nuevoEmp.sueldo) || null,
      activo:           true,
    }).select().single();

    if (!error && empCreado) {
      if (nuevoEmp.talla_polo || nuevoEmp.talla_pantalon || nuevoEmp.talla_zapatilla) {
        await supabase.from("epp_empleados").insert({
          empleado_id:     empCreado.id,
          talla_polo:      nuevoEmp.talla_polo || null,
          talla_pantalon:  nuevoEmp.talla_pantalon || null,
          talla_zapatilla: nuevoEmp.talla_zapatilla || null,
        });
      }
      if (nuevoEmp.banco || nuevoEmp.numero_cuenta) {
        await supabase.from("cuentas_empleados").insert({
          empleado_id:          empCreado.id,
          banco:                nuevoEmp.banco || null,
          tipo_cuenta:          nuevoEmp.tipo_cuenta || null,
          numero_cuenta:        nuevoEmp.numero_cuenta || null,
          cuenta_interbancaria: nuevoEmp.cuenta_interbancaria || null,
        });
      }
      setModalNuevo(false);
      setNuevoEmp({ dni: "", nombres: "", apellido_paterno: "", apellido_materno: "", correo: "", celular: "", fecha_nacimiento: "", fecha_ingreso: "", cargo: "PEÓN", grupo: "SGDS MONTENEGRO", sueldo: "", talla_polo: "", talla_pantalon: "", talla_zapatilla: "", banco: "", tipo_cuenta: "", numero_cuenta: "", cuenta_interbancaria: "" });
      cargarEmpleados();
    }
    setGuardando(false);
  };

  const guardarEdicion = async () => {
    setGuardandoEdit(true);
    const { error } = await supabase.from("empleados").update({
      dni:              datosEdit.dni?.trim(),
      nombres:          datosEdit.nombres?.trim().toUpperCase(),
      apellido_paterno: datosEdit.apellido_paterno?.trim().toUpperCase(),
      apellido_materno: datosEdit.apellido_materno?.trim().toUpperCase(),
      correo:           datosEdit.correo?.trim(),
      celular:          datosEdit.celular?.trim(),
      fecha_nacimiento: datosEdit.fecha_nacimiento || null,
      fecha_ingreso:    datosEdit.fecha_ingreso || null,
      cargo:            datosEdit.cargo,
      grupo:            datosEdit.grupo,
      sueldo:           Number(datosEdit.sueldo) || null,
    }).eq("id", modalEmp.id);

    const epp = modalEmp.epp_empleados?.[0];
    if (epp) {
      await supabase.from("epp_empleados").update({
        talla_polo:      datosEdit.talla_polo || null,
        talla_pantalon:  datosEdit.talla_pantalon || null,
        talla_zapatilla: datosEdit.talla_zapatilla || null,
      }).eq("id", epp.id);
    } else {
      await supabase.from("epp_empleados").insert({
        empleado_id:     modalEmp.id,
        talla_polo:      datosEdit.talla_polo || null,
        talla_pantalon:  datosEdit.talla_pantalon || null,
        talla_zapatilla: datosEdit.talla_zapatilla || null,
      });
    }

    const cuenta = modalEmp.cuentas_empleados?.[0];
    if (cuenta) {
      await supabase.from("cuentas_empleados").update({
        banco:                datosEdit.banco || null,
        tipo_cuenta:          datosEdit.tipo_cuenta || null,
        numero_cuenta:        datosEdit.numero_cuenta || null,
        cuenta_interbancaria: datosEdit.cuenta_interbancaria || null,
      }).eq("id", cuenta.id);
    } else {
      await supabase.from("cuentas_empleados").insert({
        empleado_id:          modalEmp.id,
        banco:                datosEdit.banco || null,
        tipo_cuenta:          datosEdit.tipo_cuenta || null,
        numero_cuenta:        datosEdit.numero_cuenta || null,
        cuenta_interbancaria: datosEdit.cuenta_interbancaria || null,
      });
    }

    if (!error) {
      await cargarEmpleados();
      const { data: actualizado } = await supabase
        .from("empleados").select(`*, epp_empleados(*), cuentas_empleados(*)`)
        .eq("id", modalEmp.id).single();
      if (actualizado) setModalEmp(actualizado);
      setEditando(false);
    }
    setGuardandoEdit(false);
  };

  const abrirEdicion = (emp) => {
    const epp    = emp.epp_empleados?.[0] || {};
    const cuenta = emp.cuentas_empleados?.[0] || {};
    setDatosEdit({
      dni: emp.dni || "", nombres: emp.nombres || "",
      apellido_paterno: emp.apellido_paterno || "",
      apellido_materno: emp.apellido_materno || "",
      correo: emp.correo || "", celular: emp.celular || "",
      fecha_nacimiento: emp.fecha_nacimiento || "",
      fecha_ingreso:    emp.fecha_ingreso || "",
      cargo: emp.cargo || "PEÓN", grupo: emp.grupo || "SGDS MONTENEGRO",
      sueldo: emp.sueldo || "",
      talla_polo: epp.talla_polo || "", talla_pantalon: epp.talla_pantalon || "",
      talla_zapatilla: epp.talla_zapatilla || "",
      banco: cuenta.banco || "", tipo_cuenta: cuenta.tipo_cuenta || "",
      numero_cuenta: cuenta.numero_cuenta || "",
      cuenta_interbancaria: cuenta.cuenta_interbancaria || "",
    });
    setEditando(true);
  };

  const exportarExcel = () => {
    const now = new Date();
    const mes = now.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
    const activos = empleados.filter(e => e.activo);
    const filas = activos.map((e) => ({
      "DNI":              e.dni || "",
      "Apellido Paterno": e.apellido_paterno || "",
      "Apellido Materno": e.apellido_materno || "",
      "Nombres":          e.nombres || "",
      "Celular":          e.celular || "",
      "Correo":           e.correo || "",
      "Cargo":            e.cargo || "",
      "Grupo":            e.grupo || "",
      "Fecha Nacimiento": e.fecha_nacimiento || "",
    }));
    const headers = Object.keys(filas[0] || {});
    const csvRows = [
      headers.join(","),
      ...filas.map(f => headers.map(h => `"${(f[h] || "").toString().replace(/"/g, '""')}"`).join(","))
    ];
    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Empleados_${mes.replace(/ /g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cargosUnicos = ["todos", ...new Set(empleados.map((e) => e.cargo).filter(Boolean))];

  const empFiltrados = empleados.filter((e) => {
    if (filtroCargo !== "todos" && e.cargo !== filtroCargo) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      const nombre = `${e.apellido_paterno} ${e.apellido_materno || ""} ${e.nombres || ""}`.toLowerCase();
      if (!nombre.includes(q) && !(e.dni || "").includes(q)) return false;
    }
    return true;
  });

  const totalSueldos = empleados.filter(e => e.activo).reduce((s, e) => s + Number(e.sueldo || 0), 0);

  return (
    <div className={styles.wrap}>

      {alertaPago && (
        <div className={styles.alertaBanner}>
          <div className={styles.alertaIcono}>💰</div>
          <div className={styles.alertaTexto}>
            <strong>¡Toca pagar el {proximo.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}!</strong>
            <span> Faltan {diasRestantes} día{diasRestantes !== 1 ? "s" : ""} para la quincena.</span>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Total empleados</div>
          <div className={styles.kpiVal}>{empleados.filter(e => e.activo).length}</div>
          <div className={styles.kpiSub}>activos</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Planilla quincenal</div>
          <div className={styles.kpiVal} style={{color:"#1A2F5E"}}>{fmt(totalSueldos / 2)}</div>
          <div className={styles.kpiSub}>estimado</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Planilla mensual</div>
          <div className={styles.kpiVal} style={{color:"#1A2F5E"}}>{fmt(totalSueldos)}</div>
          <div className={styles.kpiSub}>estimado</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Próximo pago</div>
          <div className={styles.kpiVal} style={{color: alertaPago ? "#dc2626" : "#1A2F5E", fontSize:"14px"}}>
            {proximo.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
          </div>
          <div className={styles.kpiSub} style={{color: alertaPago ? "#dc2626" : undefined}}>
            en {diasRestantes} día{diasRestantes !== 1 ? "s" : ""}
          </div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Último pago</div>
          <div className={styles.kpiVal} style={{fontSize:"14px",color:"#64748b"}}>
            {ultimo.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
          </div>
          <div className={styles.kpiSub}>quincena anterior</div>
        </div>
      </div>

      {/* Tabs principales */}
      <div className={styles.tabsPrincipales}>
        <button
          className={`${styles.tabPrincipal} ${tabPrincipal === "empleados" ? styles.tabPrincipalActive : ""}`}
          onClick={() => setTabPrincipal("empleados")}
        >Empleados</button>
        <button
          className={`${styles.tabPrincipal} ${tabPrincipal === "epp" ? styles.tabPrincipalActive : ""}`}
          onClick={() => setTabPrincipal("epp")}
        >EPP / Tallas</button>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        {tabPrincipal === "empleados" && (
          <select className={styles.selectFiltro} value={filtroCargo} onChange={(e) => setFiltroCargo(e.target.value)}>
            {cargosUnicos.map((c) => (
              <option key={c} value={c}>{c === "todos" ? "Todos los cargos" : c}</option>
            ))}
          </select>
        )}
        <input
          className={styles.search}
          type="text"
          placeholder="Buscar por nombre o DNI..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <button className={styles.btnExportar} onClick={exportarExcel}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1v8M8 9l-3-3M8 9l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Exportar Excel
        </button>
        {tabPrincipal === "empleados" && (
          <button className={styles.btnNuevo} onClick={() => setModalNuevo(true)}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 9v4M10 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Nuevo empleado
          </button>
        )}
      </div>

      {/* ── TABLA EMPLEADOS ── */}
      {tabPrincipal === "empleados" && (
        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.loadingMsg}>Cargando empleados...</div>
          ) : (
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Cargo</th>
                  <th>Grupo</th>
                  <th>Sueldo</th>
                  <th>Contacto</th>
                  <th>Banco</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empFiltrados.length === 0 ? (
                  <tr><td colSpan={7} className={styles.emptyMsg}>No se encontraron empleados</td></tr>
                ) : empFiltrados.map((e) => {
                  const cuenta = e.cuentas_empleados?.[0];
                  return (
                    <tr key={e.id} className={!e.activo ? styles.rowInactivo : ""}>
                      <td>
                        <div className={styles.empNombre}>
                          <div className={styles.empAvatar}>
                            {(e.nombres || e.apellido_paterno || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={styles.empName}>{e.apellido_paterno} {e.apellido_materno || ""}</div>
                            <div className={styles.empSub}>{e.nombres || "—"} · DNI {e.dni}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={styles.cargoBadge}>{e.cargo || "—"}</span></td>
                      <td><span className={styles.grupoBadge}>{e.grupo || "—"}</span></td>
                      <td className={styles.sueldoVal}>{e.sueldo ? fmt(e.sueldo) : "—"}</td>
                      <td>
                        <div className={styles.contactoInfo}>
                          {e.celular && <span>{e.celular}</span>}
                          {e.correo  && <span className={styles.correo}>{e.correo}</span>}
                        </div>
                      </td>
                      <td>
                        {cuenta?.banco
                          ? <div className={styles.bancoInfo}><span>{cuenta.banco}</span><span className={styles.numCuenta}>{cuenta.numero_cuenta || "—"}</span></div>
                          : <span className={styles.sinBanco}>—</span>}
                      </td>
                      <td>
                        <div className={styles.acciones}>
                          <button className={styles.actBtn} title="Ver empleado" onClick={() => abrirModal(e)}>
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 6v4M8 5.2v-.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                          </button>
                          <button className={styles.actBtn} title="Registrar pago" onClick={() => { abrirModal(e); setTabModal("pagos"); setShowPagoForm(true); }}>
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 8h6M8 5.5v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {!loading && tabPrincipal === "empleados" && (
        <div className={styles.tableFooter}>Mostrando {empFiltrados.length} de {empleados.length} empleados</div>
      )}

      {/* ── TABLA EPP ── */}
      {tabPrincipal === "epp" && (
        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.loadingMsg}>Cargando...</div>
          ) : (
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Cargo</th>
                  <th>Talla Polo</th>
                  <th>Talla Pantalón</th>
                  <th>Talla Zapatilla</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {empFiltrados.filter(e => e.activo).length === 0 ? (
                  <tr><td colSpan={6} className={styles.emptyMsg}>No se encontraron empleados</td></tr>
                ) : empFiltrados.filter(e => e.activo).map((e) => {
                  const epp = e.epp_empleados?.[0];
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className={styles.empNombre}>
                          <div className={styles.empAvatar}>
                            {(e.nombres || e.apellido_paterno || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={styles.empName}>{e.apellido_paterno} {e.apellido_materno || ""}</div>
                            <div className={styles.empSub}>{e.nombres || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={styles.cargoBadge}>{e.cargo || "—"}</span></td>
                      <td><span className={epp?.talla_polo ? styles.tallaBadge : styles.sinTalla}>{epp?.talla_polo || "—"}</span></td>
                      <td><span className={epp?.talla_pantalon ? styles.tallaBadge : styles.sinTalla}>{epp?.talla_pantalon || "—"}</span></td>
                      <td><span className={epp?.talla_zapatilla ? styles.tallaBadge : styles.sinTalla}>{epp?.talla_zapatilla || "—"}</span></td>
                      <td>
                        <button className={styles.actBtn} title="Editar tallas" onClick={() => { abrirModal(e); setTabModal("epp"); abrirEdicion(e); }}>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5-7 7L4 13l.5-2.5 7-7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {!loading && tabPrincipal === "epp" && (
        <div className={styles.tableFooter}>{empFiltrados.filter(e => e.activo).length} empleados activos</div>
      )}

      {/* ── MODAL EMPLEADO ── */}
      {modalEmp && (
        <div className={styles.overlay} onClick={cerrarModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalAvatarWrap}>
                <div className={styles.modalAvatar}>
                  {(modalEmp.nombres || modalEmp.apellido_paterno || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className={styles.modalNombre}>{modalEmp.apellido_paterno} {modalEmp.apellido_materno || ""}, {modalEmp.nombres || ""}</div>
                  <div className={styles.modalSub}>{modalEmp.cargo || "—"} · DNI {modalEmp.dni}</div>
                </div>
              </div>
              <button className={styles.modalClose} onClick={cerrarModal}>✕</button>
            </div>

            <div className={styles.modalTabs}>
              {[
                { key: "datos", label: "Datos personales" },
                { key: "epp",   label: "EPP" },
                { key: "banco", label: "Cuenta bancaria" },
                { key: "pagos", label: "Pagos" },
              ].map((t) => (
                <button key={t.key}
                  className={`${styles.modalTab} ${tabModal === t.key ? styles.modalTabActive : ""}`}
                  onClick={() => setTabModal(t.key)}
                >{t.label}</button>
              ))}
            </div>

            {/* DATOS */}
            {tabModal === "datos" && (
              <div className={styles.tabContent}>
                {!editando ? (
                  <>
                    <div className={styles.infoGrid}>
                      <InfoItem label="DNI"              val={modalEmp.dni} />
                      <InfoItem label="Nombres"          val={modalEmp.nombres} />
                      <InfoItem label="Apellido paterno" val={modalEmp.apellido_paterno} />
                      <InfoItem label="Apellido materno" val={modalEmp.apellido_materno} />
                      <InfoItem label="Celular"          val={modalEmp.celular} />
                      <InfoItem label="Correo"           val={modalEmp.correo} />
                      <InfoItem label="Fecha nacimiento" val={fmtFecha(modalEmp.fecha_nacimiento)} />
                      <InfoItem label="Fecha ingreso"    val={fmtFecha(modalEmp.fecha_ingreso)} />
                      <InfoItem label="Cargo"            val={modalEmp.cargo} />
                      <InfoItem label="Grupo"            val={modalEmp.grupo} />
                      <InfoItem label="Sueldo"           val={modalEmp.sueldo ? fmt(modalEmp.sueldo) : "—"} />
                    </div>
                    <button className={styles.btnEditar} onClick={() => abrirEdicion(modalEmp)}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5-7 7L4 13l.5-2.5 7-7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Editar
                    </button>
                  </>
                ) : (
                  <div className={styles.editForm}>
                    <div className={styles.editGrid}>
                      <EditField label="DNI"              name="dni"              value={datosEdit} set={setDatosEdit} />
                      <EditField label="Nombres"          name="nombres"          value={datosEdit} set={setDatosEdit} />
                      <EditField label="Apellido paterno" name="apellido_paterno" value={datosEdit} set={setDatosEdit} />
                      <EditField label="Apellido materno" name="apellido_materno" value={datosEdit} set={setDatosEdit} />
                      <EditField label="Celular"          name="celular"          value={datosEdit} set={setDatosEdit} />
                      <EditField label="Correo"           name="correo"           value={datosEdit} set={setDatosEdit} />
                      <EditField label="Fecha nacimiento" name="fecha_nacimiento" value={datosEdit} set={setDatosEdit} type="date" />
                      <EditField label="Fecha ingreso"    name="fecha_ingreso"    value={datosEdit} set={setDatosEdit} type="date" />
                      <EditField label="Sueldo (S/)"      name="sueldo"           value={datosEdit} set={setDatosEdit} type="number" />
                      <div className={styles.editGroup}>
                        <label>Cargo</label>
                        <select value={datosEdit.cargo || ""} onChange={(e) => setDatosEdit({...datosEdit, cargo: e.target.value})}>
                          {CARGOS.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className={styles.editGroup}>
                        <label>Grupo</label>
                        <select value={datosEdit.grupo || ""} onChange={(e) => setDatosEdit({...datosEdit, grupo: e.target.value})}>
                          {GRUPOS.map((g) => <option key={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={styles.editBtns}>
                      <button className={styles.btnCancelar} onClick={() => setEditando(false)}>Cancelar</button>
                      <button className={styles.btnGuardar} onClick={guardarEdicion} disabled={guardandoEdit}>
                        {guardandoEdit ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* EPP */}
            {tabModal === "epp" && (
              <div className={styles.tabContent}>
                {!editando ? (
                  <>
                    <div className={styles.eppGrid}>
                      {[
                        { label: "Polo",      val: modalEmp.epp_empleados?.[0]?.talla_polo,      icono: "👕" },
                        { label: "Pantalón",  val: modalEmp.epp_empleados?.[0]?.talla_pantalon,  icono: "👖" },
                        { label: "Zapatilla", val: modalEmp.epp_empleados?.[0]?.talla_zapatilla, icono: "👟" },
                      ].map(({ label, val, icono }) => (
                        <div key={label} className={styles.eppCard}>
                          <div className={styles.eppIcono}>{icono}</div>
                          <div className={styles.eppLabel}>{label}</div>
                          <div className={styles.eppTalla}>{val || "—"}</div>
                        </div>
                      ))}
                    </div>
                    <button className={styles.btnEditar} onClick={() => abrirEdicion(modalEmp)}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5-7 7L4 13l.5-2.5 7-7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Editar tallas
                    </button>
                  </>
                ) : (
                  <div className={styles.editForm}>
                    <div className={styles.editGrid}>
                      <EditField label="Talla polo"      name="talla_polo"      value={datosEdit} set={setDatosEdit} placeholder="M, L, XL..." />
                      <EditField label="Talla pantalón"  name="talla_pantalon"  value={datosEdit} set={setDatosEdit} placeholder="28, 30, 32..." />
                      <EditField label="Talla zapatilla" name="talla_zapatilla" value={datosEdit} set={setDatosEdit} placeholder="40, 41, 42..." />
                    </div>
                    <div className={styles.editBtns}>
                      <button className={styles.btnCancelar} onClick={() => setEditando(false)}>Cancelar</button>
                      <button className={styles.btnGuardar} onClick={guardarEdicion} disabled={guardandoEdit}>
                        {guardandoEdit ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BANCO */}
            {tabModal === "banco" && (
              <div className={styles.tabContent}>
                {!editando ? (
                  <>
                    <div className={styles.infoGrid}>
                      <InfoItem label="Banco"                val={modalEmp.cuentas_empleados?.[0]?.banco} />
                      <InfoItem label="Tipo de cuenta"       val={modalEmp.cuentas_empleados?.[0]?.tipo_cuenta} />
                      <InfoItem label="N° de cuenta"         val={modalEmp.cuentas_empleados?.[0]?.numero_cuenta} />
                      <InfoItem label="Cuenta interbancaria" val={modalEmp.cuentas_empleados?.[0]?.cuenta_interbancaria} fullWidth />
                    </div>
                    <button className={styles.btnEditar} onClick={() => abrirEdicion(modalEmp)}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5-7 7L4 13l.5-2.5 7-7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Editar cuenta
                    </button>
                  </>
                ) : (
                  <div className={styles.editForm}>
                    <div className={styles.editGrid}>
                      <div className={styles.editGroup}>
                        <label>Banco</label>
                        <select value={datosEdit.banco || ""} onChange={(e) => setDatosEdit({...datosEdit, banco: e.target.value})}>
                          <option value="">Sin banco</option>
                          {BANCOS.map((b) => <option key={b}>{b}</option>)}
                        </select>
                      </div>
                      <EditField label="Tipo de cuenta"       name="tipo_cuenta"          value={datosEdit} set={setDatosEdit} placeholder="Ahorros, Corriente..." />
                      <EditField label="N° de cuenta"         name="numero_cuenta"        value={datosEdit} set={setDatosEdit} />
                      <EditField label="Cuenta interbancaria" name="cuenta_interbancaria" value={datosEdit} set={setDatosEdit} />
                    </div>
                    <div className={styles.editBtns}>
                      <button className={styles.btnCancelar} onClick={() => setEditando(false)}>Cancelar</button>
                      <button className={styles.btnGuardar} onClick={guardarEdicion} disabled={guardandoEdit}>
                        {guardandoEdit ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PAGOS */}
            {tabModal === "pagos" && (
              <div className={styles.tabContent}>
                {(() => {
                  const { proximo: proxEmp, diasRestantes: diasEmp } = calcularProximoPago(modalEmp.fecha_ingreso);
                  return (
                    <div className={styles.proximoPagoBanner} style={{background: diasEmp <= 3 ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "linear-gradient(135deg,#1A2F5E,#2E487C)"}}>
                      <span>📅 Próximo pago: <strong>{proxEmp.toLocaleDateString("es-PE", { weekday:"long", day:"numeric", month:"long" })}</strong></span>
                      <span style={{marginLeft:"auto",background:"rgba(255,255,255,0.15)",borderRadius:"99px",padding:"2px 10px",fontSize:"11px"}}>en {diasEmp} día{diasEmp !== 1 ? "s" : ""}</span>
                    </div>
                  );
                })()}
                <div className={styles.pagosSummary}>
                  <div className={styles.pagosSummaryItem}>
                    <span className={styles.pagosSummaryLabel}>Sueldo registrado</span>
                    <span className={styles.pagosSummaryVal}>{modalEmp.sueldo ? fmt(modalEmp.sueldo) : "—"}</span>
                  </div>
                  <div className={styles.pagosSummaryItem}>
                    <span className={styles.pagosSummaryLabel}>Total pagado</span>
                    <span className={styles.pagosSummaryVal} style={{color:"#a8e6cf"}}>
                      {fmt(pagos.reduce((s, p) => s + Number(p.monto), 0))}
                    </span>
                  </div>
                  <div className={styles.pagosSummaryItem}>
                    <span className={styles.pagosSummaryLabel}>N° pagos</span>
                    <span className={styles.pagosSummaryVal}>{pagos.length}</span>
                  </div>
                </div>

                {!showPagoForm ? (
                  <button className={styles.btnRegistrarPago} onClick={() => setShowPagoForm(true)}>
                    + Registrar pago
                  </button>
                ) : (
                  <div className={styles.pagoForm}>
                    <div className={styles.pagoFormTitle}>Registrar pago</div>
                    <div className={styles.pagoFormRow}>
                      <div className={styles.pagoFormGroup}>
                        <label>Fecha</label>
                        <input type="date" value={nuevoPago.fecha_pago}
                          onChange={(e) => setNuevoPago({...nuevoPago, fecha_pago: e.target.value})} />
                      </div>
                      <div className={styles.pagoFormGroup}>
                        <label>Monto (S/)</label>
                        <input type="number" placeholder={modalEmp.sueldo ? String(modalEmp.sueldo / 2) : "0"}
                          value={nuevoPago.monto}
                          onChange={(e) => setNuevoPago({...nuevoPago, monto: e.target.value})} />
                      </div>
                    </div>
                    <div className={styles.pagoFormGroup}>
                      <label>Observación (opcional)</label>
                      <input type="text" placeholder="Ej: Quincena enero, adelanto..."
                        value={nuevoPago.observacion}
                        onChange={(e) => setNuevoPago({...nuevoPago, observacion: e.target.value})} />
                    </div>
                    <div className={styles.pagoFormBtns}>
                      <button className={styles.btnCancelar} onClick={() => setShowPagoForm(false)}>Cancelar</button>
                      <button className={styles.btnGuardar} onClick={guardarPago} disabled={savingPago}>
                        {savingPago ? "Guardando..." : "Guardar pago"}
                      </button>
                    </div>
                  </div>
                )}

                <div className={styles.historialTitle}>Historial de pagos ({pagos.length})</div>
                {loadingPagos ? (
                  <div className={styles.loadingMsg}>Cargando...</div>
                ) : pagos.length === 0 ? (
                  <div className={styles.emptyMsg}>Sin pagos registrados</div>
                ) : (
                  <div className={styles.historialList}>
                    {pagos.map((p) => (
                      <div key={p.id} className={styles.historialItem}>
                        <div className={styles.historialLeft}>
                          <div className={styles.historialFecha}>{fmtFecha(p.fecha_pago)}</div>
                          {p.observacion && <div className={styles.historialObs}>{p.observacion}</div>}
                        </div>
                        <div className={styles.historialMonto}>{fmt(p.monto)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL NUEVO EMPLEADO ── */}
      {modalNuevo && (
        <div className={styles.overlay} onClick={() => setModalNuevo(false)}>
          <div className={styles.modal} style={{maxWidth:"580px"}} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalNombre}>Registrar nuevo empleado</div>
                <div className={styles.modalSub}>Completa los datos del trabajador</div>
              </div>
              <button className={styles.modalClose} onClick={() => setModalNuevo(false)}>✕</button>
            </div>
            <div className={styles.tabContent}>
              <div className={styles.seccionLabel}>Datos personales</div>
              <div className={styles.editGrid}>
                <NuevoField label="DNI *"              name="dni"              val={nuevoEmp} set={setNuevoEmp} />
                <NuevoField label="Nombres"            name="nombres"          val={nuevoEmp} set={setNuevoEmp} />
                <NuevoField label="Apellido paterno *" name="apellido_paterno" val={nuevoEmp} set={setNuevoEmp} />
                <NuevoField label="Apellido materno"   name="apellido_materno" val={nuevoEmp} set={setNuevoEmp} />
                <NuevoField label="Celular"            name="celular"          val={nuevoEmp} set={setNuevoEmp} />
                <NuevoField label="Correo"             name="correo"           val={nuevoEmp} set={setNuevoEmp} />
                <NuevoField label="Fecha nacimiento"   name="fecha_nacimiento" val={nuevoEmp} set={setNuevoEmp} type="date" />
                <NuevoField label="Fecha ingreso"      name="fecha_ingreso"    val={nuevoEmp} set={setNuevoEmp} type="date" />
                <NuevoField label="Sueldo (S/)"        name="sueldo"           val={nuevoEmp} set={setNuevoEmp} type="number" />
                <div className={styles.editGroup}>
                  <label>Cargo *</label>
                  <select value={nuevoEmp.cargo} onChange={(e) => setNuevoEmp({...nuevoEmp, cargo: e.target.value})}>
                    {CARGOS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className={styles.editGroup}>
                  <label>Grupo</label>
                  <select value={nuevoEmp.grupo} onChange={(e) => setNuevoEmp({...nuevoEmp, grupo: e.target.value})}>
                    {GRUPOS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.seccionLabel} style={{marginTop:"14px"}}>EPP (tallas)</div>
              <div className={styles.editGrid}>
                <NuevoField label="Polo"      name="talla_polo"       val={nuevoEmp} set={setNuevoEmp} placeholder="M, L, XL" />
                <NuevoField label="Pantalón"  name="talla_pantalon"   val={nuevoEmp} set={setNuevoEmp} placeholder="30, 32..." />
                <NuevoField label="Zapatilla" name="talla_zapatilla"  val={nuevoEmp} set={setNuevoEmp} placeholder="40, 41..." />
              </div>
              <div className={styles.seccionLabel} style={{marginTop:"14px"}}>Datos bancarios</div>
              <div className={styles.editGrid}>
                <div className={styles.editGroup}>
                  <label>Banco</label>
                  <select value={nuevoEmp.banco} onChange={(e) => setNuevoEmp({...nuevoEmp, banco: e.target.value})}>
                    <option value="">Sin banco</option>
                    {BANCOS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <NuevoField label="Tipo cuenta"          name="tipo_cuenta"          val={nuevoEmp} set={setNuevoEmp} placeholder="Ahorros..." />
                <NuevoField label="N° cuenta"            name="numero_cuenta"        val={nuevoEmp} set={setNuevoEmp} />
                <NuevoField label="Cuenta interbancaria" name="cuenta_interbancaria" val={nuevoEmp} set={setNuevoEmp} />
              </div>
              <div className={styles.editBtns} style={{marginTop:"16px"}}>
                <button className={styles.btnCancelar} onClick={() => setModalNuevo(false)}>Cancelar</button>
                <button className={styles.btnGuardar} onClick={guardarNuevoEmpleado}
                  disabled={guardando || !nuevoEmp.dni || !nuevoEmp.apellido_paterno}>
                  {guardando ? "Guardando..." : "Registrar empleado"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──
function InfoItem({ label, val, fullWidth }) {
  return (
    <div style={fullWidth ? {gridColumn:"1/-1"} : {}}>
      <div style={{fontSize:"10.5px",fontWeight:"600",color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:"2px"}}>{label}</div>
      <div style={{fontSize:"13.5px",color:"#1A2F5E",fontWeight:"500"}}>{val || "—"}</div>
    </div>
  );
}

function EditField({ label, name, value, set, type = "text", placeholder = "" }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
      <label style={{fontSize:"10.5px",fontWeight:"600",color:"#64748b",textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</label>
      <input type={type} placeholder={placeholder} value={value[name] || ""}
        onChange={(e) => set({...value, [name]: e.target.value})}
        style={{padding:"7px 10px",borderRadius:"7px",border:"1px solid #d1d9ee",fontSize:"12.5px",fontFamily:"Poppins,sans-serif",color:"#1A2F5E",outline:"none",background:"#fff"}} />
    </div>
  );
}

function NuevoField({ label, name, val, set, type = "text", placeholder = "" }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
      <label style={{fontSize:"10.5px",fontWeight:"600",color:"#64748b",textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</label>
      <input type={type} placeholder={placeholder} value={val[name] || ""}
        onChange={(e) => set({...val, [name]: e.target.value})}
        style={{padding:"7px 10px",borderRadius:"7px",border:"1px solid #d1d9ee",fontSize:"12.5px",fontFamily:"Poppins,sans-serif",color:"#1A2F5E",outline:"none",background:"#fff"}} />
    </div>
  );
}