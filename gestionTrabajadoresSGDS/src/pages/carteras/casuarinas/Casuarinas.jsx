import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../supabase/client";
import styles from "../../../styles/carteras/Casuarinas.module.css";
import Boleta from "./Boleta";
import ContratoModal from "./ContratoModal";

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Yape / Plin", "Depósito"];
const BANCOS      = ["BCP", "BBVA", "Interbank", "Scotiabank", "Otro"];

function getPctClass(pct, s) {
  if (pct >= 70) return s.pctGreen;
  if (pct >= 30) return s.pctYellow;
  if (pct > 0)   return s.pctRed;
  return s.pctGray;
}
function getFillClass(pct, s) {
  if (pct >= 70) return s.fillGreen;
  if (pct >= 30) return s.fillYellow;
  if (pct > 0)   return s.fillRed;
  return s.fillGray;
}

const fmt = (n) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency", currency: "PEN", minimumFractionDigits: 0,
  }).format(Number(n) || 0);

const necesitaBanco = (medio) =>
  medio === "Depósito" || medio === "Transferencia";

export default function Casuarinas() {
  const [socios, setSocios]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filtro, setFiltro]             = useState("todos");
  const [busqueda, setBusqueda]         = useState("");
  const [modalSocio, setModalSocio]     = useState(null);
  const [modalPagos, setModalPagos]     = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [boletaData, setBoletaData]     = useState(null);
  const [anularModal, setAnularModal]   = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [anulando, setAnulando]         = useState(false);
  const [tabActiva, setTabActiva]       = useState("pagos");
  const [modalNuevoSocio, setModalNuevoSocio] = useState(false);
  const [guardandoSocio, setGuardandoSocio]   = useState(false);
  const [nuevoSocio, setNuevoSocio] = useState({
    apellidos: "", nombres: "", dni: "", celular: "",
    sector: "1", manzana: "", lote: "",
    servicio: "Agua, Desagüe y Electrificación",
    monto_contratado: "", activo: true,
  });
  const [filtroServicio, setFiltroServicio] = useState("todos");
  const [editandoMonto, setEditandoMonto] = useState(false);
  const [nuevoMonto, setNuevoMonto]     = useState("");
  const [guardandoMonto, setGuardandoMonto] = useState(false);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [datosSocio, setDatosSocio]     = useState({});
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [nuevoPago, setNuevoPago]       = useState({
    fecha: new Date().toISOString().split("T")[0],
    monto: "", medio_pago: "Efectivo", banco: "", operacion: "",
  });
  const [kpis, setKpis] = useState({
    totalSocios: 0, totalPagado: 0, totalPendiente: 0,
    pagaronCompleto: 0, conSaldoAlto: 0,
  });

  // ── Modal contrato ──
  const [socioContrato, setSocioContrato] = useState(null);

  // ── Traspaso ──
  const [showTraspaso, setShowTraspaso] = useState(false);
  const [guardandoTraspaso, setGuardandoTraspaso] = useState(false);
  const [nuevoTitular, setNuevoTitular] = useState({
    apellidos: "", nombres: "", dni: "", celular: "",
    fecha_traspaso: new Date().toISOString().split("T")[0],
  });

  const cargarSocios = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("resumen_socios").select("*")
      .order("sector").order("manzana").order("lote");
    if (!error && data) {
      setSocios(data);
      const totalPagado     = data.reduce((s, r) => s + Number(r.total_pagado || 0), 0);
      const totalContratado = data.reduce((s, r) => s + Number(r.monto_contratado || 0), 0);
      setKpis({
        totalSocios:     data.length,
        totalPagado,
        totalPendiente:  totalContratado - totalPagado,
        pagaronCompleto: data.filter((r) => Number(r.porcentaje_pagado) >= 100).length,
        conSaldoAlto:    data.filter((r) => Number(r.porcentaje_pagado) < 30).length,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargarSocios(); }, [cargarSocios]);

  const abrirModal = async (socio, abrirForm = false) => {
    setModalSocio(socio);
    setShowForm(abrirForm);
    setTabActiva("pagos");
    setModalLoading(true);
    const { data } = await supabase
      .from("pagos_casuarinas").select("*")
      .eq("socio_id", socio.id).order("fecha", { ascending: false });
    setModalPagos(data || []);
    setModalLoading(false);
  };

  const cerrarModal = () => {
    setModalSocio(null); setModalPagos([]);
    setShowForm(false);
    setNuevoPago({ fecha: new Date().toISOString().split("T")[0], monto: "", medio_pago: "Efectivo", banco: "", operacion: "" });
  };

  const generarNumeroBoleta = async () => {
    const { count } = await supabase
      .from("pagos_casuarinas")
      .select("*", { count: "exact", head: true });
    const anio = new Date().getFullYear();
    const correlativo = String((count || 0) + 1).padStart(6, "0");
    return `SGDS-${anio}-${correlativo}`;
  };

  const guardarPago = async () => {
    if (!nuevoPago.monto || Number(nuevoPago.monto) <= 0) return;
    setSaving(true);
    const numeroBoleta = await generarNumeroBoleta();
    const { data: pagoInsertado, error } = await supabase
      .from("pagos_casuarinas")
      .insert({
        socio_id:      modalSocio.id,
        fecha:         nuevoPago.fecha || null,
        fecha_emision: new Date().toISOString(),
        monto:         Number(nuevoPago.monto),
        medio_pago:    nuevoPago.medio_pago,
        banco:         necesitaBanco(nuevoPago.medio_pago) ? nuevoPago.banco || null : null,
        operacion:     nuevoPago.operacion || null,
        numero_boleta: numeroBoleta,
      })
      .select().single();

    if (!error && pagoInsertado) {
      setBoletaData({ pago: pagoInsertado, socio: modalSocio });
      setNuevoPago({ fecha: new Date().toISOString().split("T")[0], monto: "", medio_pago: "Efectivo", banco: "", operacion: "" });
      setShowForm(false);
      const { data } = await supabase.from("pagos_casuarinas").select("*")
        .eq("socio_id", modalSocio.id).order("fecha", { ascending: false });
      setModalPagos(data || []);
      const { data: actualizado } = await supabase.from("resumen_socios")
        .select("*").eq("id", modalSocio.id).single();
      if (actualizado) setModalSocio(actualizado);
      cargarSocios();
    }
    setSaving(false);
  };

  const confirmarAnulacion = async () => {
    if (!motivoAnulacion.trim()) return;
    setAnulando(true);
    const { error } = await supabase
      .from("pagos_casuarinas")
      .update({
        anulado: true,
        motivo_anulacion: motivoAnulacion.trim(),
        fecha_anulacion: new Date().toISOString(),
      })
      .eq("id", anularModal.id);
    if (!error) {
      setAnularModal(null);
      setMotivoAnulacion("");
      const { data } = await supabase.from("pagos_casuarinas").select("*")
        .eq("socio_id", modalSocio.id).order("fecha", { ascending: false });
      setModalPagos(data || []);
      cargarSocios();
    }
    setAnulando(false);
  };

  const guardarNuevoSocio = async () => {
    if (!nuevoSocio.apellidos || !nuevoSocio.manzana || !nuevoSocio.lote || !nuevoSocio.monto_contratado) return;
    setGuardandoSocio(true);
    const { error } = await supabase.from("socios_casuarinas").insert({
      apellidos:        nuevoSocio.apellidos.trim().toUpperCase(),
      nombres:          nuevoSocio.nombres.trim().toUpperCase() || null,
      dni:              nuevoSocio.dni.trim() || null,
      celular:          nuevoSocio.celular.trim() || null,
      sector:           nuevoSocio.sector,
      manzana:          nuevoSocio.manzana.trim().toUpperCase(),
      lote:             nuevoSocio.lote.trim(),
      servicio:         nuevoSocio.servicio.trim() || null,
      monto_contratado: Number(nuevoSocio.monto_contratado),
      activo:           true,
    });
    if (!error) {
      setModalNuevoSocio(false);
      setNuevoSocio({ apellidos: "", nombres: "", dni: "", celular: "", sector: "1", manzana: "", lote: "", servicio: "Agua, Desagüe y Electrificación", monto_contratado: "", activo: true });
      cargarSocios();
    }
    setGuardandoSocio(false);
  };

  const guardarDatos = async () => {
    setGuardandoDatos(true);

    // Verificar si la mz/lote ya existe en otro socio
    if (datosSocio.manzana || datosSocio.lote) {
      const { data: duplicado } = await supabase
        .from("socios_casuarinas")
        .select("id, apellidos, nombres")
        .eq("manzana", datosSocio.manzana?.trim().toUpperCase())
        .eq("lote", datosSocio.lote?.trim())
        .neq("id", modalSocio.id)
        .single();

      if (duplicado) {
        const confirmar = window.confirm(
          `⚠️ Advertencia: La Mz. ${datosSocio.manzana} Lote ${datosSocio.lote} ya está ocupada por ${duplicado.apellidos} ${duplicado.nombres || ""}.\n\n¿Deseas continuar de todas formas?`
        );
        if (!confirmar) {
          setGuardandoDatos(false);
          return;
        }
      }
    }

    const { error } = await supabase
      .from("socios_casuarinas")
      .update({
        apellidos: datosSocio.apellidos?.trim(),
        nombres:   datosSocio.nombres?.trim(),
        dni:       datosSocio.dni?.trim(),
        celular:   datosSocio.celular?.trim(),
        servicio:  datosSocio.servicio?.trim(),
        manzana:   datosSocio.manzana?.trim().toUpperCase(),
        lote:      datosSocio.lote?.trim(),
      })
      .eq("id", modalSocio.id);
    if (!error) {
      const { data: actualizado } = await supabase
        .from("resumen_socios").select("*").eq("id", modalSocio.id).single();
      if (actualizado) setModalSocio(actualizado);
      setEditandoDatos(false);
      cargarSocios();
    }
    setGuardandoDatos(false);
  };

  const guardarMonto = async () => {
    if (!nuevoMonto || Number(nuevoMonto) <= 0) return;
    setGuardandoMonto(true);
    const { error } = await supabase
      .from("socios_casuarinas")
      .update({ monto_contratado: Number(nuevoMonto) })
      .eq("id", modalSocio.id);
    if (!error) {
      const { data: actualizado } = await supabase
        .from("resumen_socios").select("*").eq("id", modalSocio.id).single();
      if (actualizado) setModalSocio(actualizado);
      setEditandoMonto(false);
      cargarSocios();
    }
    setGuardandoMonto(false);
  };

  const toggleServicio = async (campo, valor) => {
    const { error } = await supabase
      .from("socios_casuarinas")
      .update({ [campo]: valor })
      .eq("id", modalSocio.id);
    if (!error) {
      setModalSocio((prev) => ({ ...prev, [campo]: valor }));
    }
  };

  const guardarTraspaso = async () => {
    if (!nuevoTitular.apellidos || !nuevoTitular.dni) return;
    setGuardandoTraspaso(true);
    const montoPagadoAnterior = Number(modalSocio.total_pagado) || 0;
    const saldoRestante = Number(modalSocio.monto_contratado) - montoPagadoAnterior;
    const { error } = await supabase
      .from("socios_casuarinas")
      .update({
        titular_anterior:      `${modalSocio.apellidos} ${modalSocio.nombres || ""}`.trim(),
        dni_anterior:          modalSocio.dni || null,
        celular_anterior:      modalSocio.celular || null,
        fecha_traspaso:        nuevoTitular.fecha_traspaso,
        monto_pagado_anterior: montoPagadoAnterior,
        apellidos: nuevoTitular.apellidos.trim().toUpperCase(),
        nombres:   nuevoTitular.nombres.trim().toUpperCase() || null,
        dni:       nuevoTitular.dni.trim() || null,
        celular:   nuevoTitular.celular.trim() || null,
      })
      .eq("id", modalSocio.id);
    if (!error) {
      const { data: actualizado } = await supabase
        .from("resumen_socios").select("*").eq("id", modalSocio.id).single();
      if (actualizado) {
        setModalSocio(actualizado);
        // Abrir ContratoModal con saldo restante precargado
        setSocioContrato({ ...actualizado, _montoSugerido: saldoRestante });
      }
      setShowTraspaso(false);
      setNuevoTitular({ apellidos: "", nombres: "", dni: "", celular: "", fecha_traspaso: new Date().toISOString().split("T")[0] });
      cargarSocios();
    }
    setGuardandoTraspaso(false);
  };

  const sociosFiltrados = socios.filter((s) => {
    const pct = Number(s.porcentaje_pagado);
    if (filtro === "aldia"   && pct < 70)                return false;
    if (filtro === "parcial" && (pct < 30 || pct >= 70)) return false;
    if (filtro === "bajo"    && pct >= 30)               return false;
    if (filtroServicio === "agua"   && !s.agua_instalada)                return false;
    if (filtroServicio === "desague" && !s.desague_instalado)            return false;
    if (filtroServicio === "electrificacion" && !s.electrificacion_instalada) return false;
    if (filtroServicio === "sin_agua"   && s.agua_instalada)             return false;
    if (filtroServicio === "sin_desague" && s.desague_instalado)         return false;
    if (filtroServicio === "sin_electrificacion" && s.electrificacion_instalada) return false;
    if (busqueda) {
      const q   = busqueda.toLowerCase();
      const nom = `${s.apellidos} ${s.nombres || ""}`.toLowerCase();
      const lot = `${s.manzana}-${s.lote}`.toLowerCase();
      if (!nom.includes(q) && !lot.includes(q) && !(s.dni || "").includes(q)) return false;
    }
    return true;
  });

  return (
    <div className={styles.wrap}>

      {boletaData && (
        <Boleta pago={boletaData.pago} socio={boletaData.socio} onCerrar={() => setBoletaData(null)} />
      )}

      {/* ── MODAL CONTRATO ── */}
      {socioContrato && (
        <ContratoModal
          socio={socioContrato}
          onClose={() => setSocioContrato(null)}
        />
      )}

      {/* KPIs */}
      <div className={styles.kpis}>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Total socios</div><div className={styles.kpiVal}>{kpis.totalSocios}</div><div className={styles.kpiSub}>Casuarinas</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Total pagado</div><div className={styles.kpiVal} style={{ color: "#15803d" }}>{fmt(kpis.totalPagado)}</div><div className={styles.kpiSub} style={{ color: "#10b981" }}>Acumulado histórico</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Saldo pendiente</div><div className={styles.kpiVal} style={{ color: "#dc2626" }}>{fmt(kpis.totalPendiente)}</div><div className={styles.kpiSub} style={{ color: "#dc2626" }}>Por cobrar</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Pagaron completo</div><div className={styles.kpiVal}>{kpis.pagaronCompleto}</div><div className={styles.kpiSub} style={{ color: "#10b981" }}>{kpis.totalSocios ? Math.round(kpis.pagaronCompleto / kpis.totalSocios * 100) : 0}% del total</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Con saldo alto</div><div className={styles.kpiVal} style={{ color: "#dc2626" }}>{kpis.conSaldoAlto}</div><div className={styles.kpiSub} style={{ color: "#dc2626" }}>menos del 30% pagado</div></div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={`${styles.filterBtn} ${filtro === "todos"   ? styles.filterActive : ""}`} onClick={() => setFiltro("todos")}>Todos</button>
        <button className={`${styles.filterBtn} ${filtro === "aldia"   ? styles.filterActive : ""}`} style={filtro === "aldia"   ? {} : { background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }} onClick={() => setFiltro("aldia")}>Al día ≥70%</button>
        <button className={`${styles.filterBtn} ${filtro === "parcial" ? styles.filterActive : ""}`} style={filtro === "parcial" ? {} : { background: "#fef9c3", color: "#854d0e", borderColor: "#fde68a" }} onClick={() => setFiltro("parcial")}>Parcial 30–69%</button>
        <button className={`${styles.filterBtn} ${filtro === "bajo"    ? styles.filterActive : ""}`} style={filtro === "bajo"    ? {} : { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }} onClick={() => setFiltro("bajo")}>Bajo &lt;30%</button>
        <input className={styles.search} type="text" placeholder="Buscar socio, lote o DNI..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <button className={styles.btnNuevoSocio} onClick={() => setModalNuevoSocio(true)}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M12 9v4M10 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          Nuevo socio
        </button>
      </div>

      {/* Filtros de servicio */}
      <div className={styles.servicioFiltros}>
        <span className={styles.servicioFiltroLabel}>Servicio:</span>
        <select
          className={styles.servicioSelect}
          value={filtroServicio}
          onChange={(e) => setFiltroServicio(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="agua">💧 Con agua</option>
          <option value="sin_agua">💧 Sin agua</option>
          <option value="desague">🔵 Con desagüe</option>
          <option value="sin_desague">🔵 Sin desagüe</option>
          <option value="electrificacion">⚡ Con electrificación</option>
          <option value="sin_electrificacion">⚡ Sin electrificación</option>
        </select>
      </div>

      {/* Leyenda */}
      <div className={styles.legend}>
        <span className={styles.legendTitle}>Estado de pago:</span>
        <span className={styles.legItem}><span className={styles.legDot} style={{ background: "#22c55e" }} />≥ 70%</span>
        <span className={styles.legItem}><span className={styles.legDot} style={{ background: "#FEC70B" }} />30–69%</span>
        <span className={styles.legItem}><span className={styles.legDot} style={{ background: "#ef4444" }} />&lt; 30%</span>
        <span className={styles.legItem}><span className={styles.legDot} style={{ background: "#cbd5e1" }} />Sin pago</span>
      </div>

      {/* Tabla */}
      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.loadingMsg}>Cargando socios...</div>
        ) : (
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Socio / Lote</th>
                <th>Contrato</th>
                <th>Total pagado</th>
                <th>% Cumplimiento</th>
                <th>Saldo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sociosFiltrados.length === 0 ? (
                <tr><td colSpan={6} className={styles.emptyMsg}>No se encontraron socios</td></tr>
              ) : (
                sociosFiltrados.map((s) => {
                  const pct   = Math.min(Number(s.porcentaje_pagado) || 0, 100);
                  const saldo = Number(s.saldo_pendiente) || 0;
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className={styles.socioName}>{s.apellidos} {s.nombres || ""}</div>
                        <div className={styles.socioLote}>Sector {s.sector} · {s.manzana}-{s.lote}{s.dni ? ` · DNI ${s.dni}` : ""}</div>
                      </td>
                      <td className={styles.monto}>{fmt(s.monto_contratado)}</td>
                      <td className={styles.pagado}>{fmt(s.total_pagado)}</td>
                      <td>
                        <div className={styles.progWrap}>
                          <div className={styles.progBar}>
                            <div className={`${styles.progFill} ${getFillClass(pct, styles)}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`${styles.pctPill} ${getPctClass(pct, styles)}`}>{Math.round(pct)}%</span>
                        </div>
                      </td>
                      <td className={saldo > 0 ? styles.saldoRed : styles.saldoOk}>{fmt(saldo)}</td>
                      <td>
                        <div className={styles.actions}>
                          <button className={styles.actBtn} title="Ver historial" onClick={() => abrirModal(s, false)}>
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 6v4M8 5.2v-.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                          </button>
                          <button className={styles.actBtn} title="Registrar pago" onClick={() => abrirModal(s, true)}>
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 8h6M8 5.5v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                          </button>
                          {/* ── NUEVO: botón generar contrato ── */}
                          <button
                            className={styles.actBtn}
                            title="Generar contrato"
                            onClick={() => setSocioContrato(s)}
                            style={{ color: "#1A2F5E" }}
                          >
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                              <path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && (
        <div className={styles.tableFooter}>Mostrando {sociosFiltrados.length} de {socios.length} socios</div>
      )}

      {/* Modal detalle socio */}
      {modalSocio && (
        <div className={styles.modalOverlay} onClick={cerrarModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>{modalSocio.apellidos} {modalSocio.nombres || ""}</div>
                <div className={styles.modalSub}>
                  Sector {modalSocio.sector} · {modalSocio.manzana}-{modalSocio.lote}
                  {modalSocio.dni      ? ` · DNI ${modalSocio.dni}`    : ""}
                  {modalSocio.celular  ? ` · ${modalSocio.celular}`    : ""}
                  {modalSocio.servicio ? ` · ${modalSocio.servicio}`   : ""}
                </div>
              </div>
              <button className={styles.modalClose} onClick={cerrarModal}>✕</button>
            </div>

            <div className={styles.modalResumen}>
              <div className={styles.modalKpi}><span className={styles.modalKpiLabel}>Contrato</span><span className={styles.modalKpiVal}>{fmt(modalSocio.monto_contratado)}</span></div>
              <div className={styles.modalKpi}><span className={styles.modalKpiLabel}>Pagado</span><span className={styles.modalKpiVal} style={{ color: "#15803d" }}>{fmt(modalSocio.total_pagado)}</span></div>
              <div className={styles.modalKpi}><span className={styles.modalKpiLabel}>Saldo</span><span className={styles.modalKpiVal} style={{ color: Number(modalSocio.saldo_pendiente) > 0 ? "#dc2626" : "#15803d" }}>{fmt(modalSocio.saldo_pendiente)}</span></div>
              <div className={styles.modalKpi}><span className={styles.modalKpiLabel}>Avance</span><span className={`${styles.modalKpiVal} ${getPctClass(Number(modalSocio.porcentaje_pagado), styles)}`}>{Math.round(Math.min(Number(modalSocio.porcentaje_pagado), 100))}%</span></div>
            </div>

            {/* Pestañas */}
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${tabActiva === "pagos" ? styles.tabActive : ""}`}
                onClick={() => setTabActiva("pagos")}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 8h6M8 5.5v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                Pagos
              </button>
              <button
                className={`${styles.tab} ${tabActiva === "datos" ? styles.tabActive : ""}`}
                onClick={() => setTabActiva("datos")}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                Datos del socio
              </button>
              <button
                className={`${styles.tab} ${tabActiva === "traspaso" ? styles.tabActive : ""}`}
                onClick={() => setTabActiva("traspaso")}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Traspaso
                {modalSocio.titular_anterior && <span style={{marginLeft:"4px",background:"#FEC70B",color:"#1A2F5E",borderRadius:"999px",fontSize:"10px",padding:"0 5px",fontWeight:"700"}}>1</span>}
              </button>
            </div>

            {/* ── PESTAÑA PAGOS ── */}
            {tabActiva === "pagos" && (<>
            {showForm ? (
              <div className={styles.pagoForm}>
                <div className={styles.pagoFormTitle}>Registrar nuevo pago</div>
                <div className={styles.pagoFormRow}>
                  <div className={styles.pagoFormGroup}>
                    <label>Fecha</label>
                    <input type="date" value={nuevoPago.fecha} onChange={(e) => setNuevoPago({ ...nuevoPago, fecha: e.target.value })} />
                  </div>
                  <div className={styles.pagoFormGroup}>
                    <label>Monto (S/)</label>
                    <input type="number" placeholder="0" value={nuevoPago.monto} onChange={(e) => setNuevoPago({ ...nuevoPago, monto: e.target.value })} />
                  </div>
                </div>
                <div className={styles.pagoFormRow}>
                  <div className={styles.pagoFormGroup}>
                    <label>Medio de pago</label>
                    <select value={nuevoPago.medio_pago} onChange={(e) => setNuevoPago({ ...nuevoPago, medio_pago: e.target.value, banco: "" })}>
                      {MEDIOS_PAGO.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  {necesitaBanco(nuevoPago.medio_pago) ? (
                    <div className={styles.pagoFormGroup}>
                      <label>Banco</label>
                      <select value={nuevoPago.banco} onChange={(e) => setNuevoPago({ ...nuevoPago, banco: e.target.value })}>
                        <option value="">Seleccionar banco...</option>
                        {BANCOS.map((b) => <option key={b}>{b}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className={styles.pagoFormGroup}>
                      <label>N° Operación (opcional)</label>
                      <input type="text" placeholder="R000123" value={nuevoPago.operacion} onChange={(e) => setNuevoPago({ ...nuevoPago, operacion: e.target.value })} />
                    </div>
                  )}
                </div>
                {necesitaBanco(nuevoPago.medio_pago) && (
                  <div className={styles.pagoFormRow}>
                    <div className={styles.pagoFormGroup}>
                      <label>N° Operación (opcional)</label>
                      <input type="text" placeholder="R000123" value={nuevoPago.operacion} onChange={(e) => setNuevoPago({ ...nuevoPago, operacion: e.target.value })} />
                    </div>
                    <div className={styles.pagoFormGroup} />
                  </div>
                )}
                <div className={styles.pagoFormBtns}>
                  <button className={styles.btnCancel} onClick={() => setShowForm(false)}>Cancelar</button>
                  <button className={styles.btnSave} onClick={guardarPago} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar y generar boleta"}
                  </button>
                </div>
              </div>
            ) : (
              <button className={styles.btnRegistrar} onClick={() => setShowForm(true)}>+ Registrar pago</button>
            )}

            <div className={styles.historialTitle}>Historial de pagos ({modalPagos.length})</div>
            {modalLoading ? (
              <div className={styles.loadingMsg}>Cargando...</div>
            ) : modalPagos.length === 0 ? (
              <div className={styles.emptyMsg}>Sin pagos registrados</div>
            ) : (
              <div className={styles.historialList}>
                {modalPagos.map((p) => (
                  <div key={p.id} className={`${styles.historialItem} ${p.anulado ? styles.historialAnulado : ""}`}>
                    <div className={styles.historialLeft}>
                      <div className={styles.historialFecha}>
                        {p.fecha ? new Date(p.fecha + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "Sin fecha"}
                      </div>
                      <div className={styles.historialMedio}>
                        {p.medio_pago || "—"}
                        {p.banco ? ` · ${p.banco}` : ""}
                        {p.operacion ? ` · ${p.operacion}` : ""}
                        {p.numero_boleta ? ` · ${p.numero_boleta}` : ""}
                        {p.anulado && p.motivo_anulacion && <span style={{color:"#dc2626"}}> · {p.motivo_anulacion}</span>}
                      </div>
                    </div>
                    <div className={styles.historialRight}>
                      <div className={`${styles.historialMonto} ${p.anulado ? styles.montoAnulado : ""}`}>{fmt(p.monto)}</div>
                      <div style={{display:"flex",gap:"4px",flexWrap:"wrap",justifyContent:"flex-end"}}>
                        {p.numero_boleta && (
                          <button className={styles.btnVerBoleta} onClick={() => setBoletaData({ pago: p, socio: modalSocio })} title="Ver boleta">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                            Boleta
                          </button>
                        )}
                        {!p.anulado && (
                          <button className={styles.btnAnular} onClick={() => setAnularModal(p)} title="Anular pago">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                            Anular
                          </button>
                        )}
                        {p.anulado && <span className={styles.badgeAnulado}>Anulado</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </>)}

            {/* ── PESTAÑA DATOS ── */}
            {tabActiva === "datos" && (
              <div className={styles.datosTab}>

                <div className={styles.datosSeccion}>
                  <div className={styles.datosSeccTitle}>Monto contratado</div>
                  <div className={styles.editMontoRow}>
                    {editandoMonto ? (
                      <>
                        <input
                          type="number"
                          className={styles.editMontoInput}
                          value={nuevoMonto}
                          onChange={(e) => setNuevoMonto(e.target.value)}
                          autoFocus
                          style={{flex:1}}
                        />
                        <button className={styles.btnSaveSmall} onClick={guardarMonto} disabled={guardandoMonto}>✓</button>
                        <button className={styles.btnCancelSmall} onClick={() => setEditandoMonto(false)}>✕</button>
                      </>
                    ) : (
                      <>
                        <span style={{fontSize:"18px",fontWeight:"700",color:"#1A2F5E"}}>{fmt(modalSocio.monto_contratado)}</span>
                        <button className={styles.btnEditMonto} onClick={() => { setEditandoMonto(true); setNuevoMonto(modalSocio.monto_contratado); }}>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5-7 7L4 13l.5-2.5 7-7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Editar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.datosSeccion}>
                  <div className={styles.datosSeccTitle}>Servicios instalados</div>
                  <div className={styles.serviciosGrid}>
                    {[
                      { campo: "agua_instalada",           label: "Agua",            color: "#0ea5e9" },
                      { campo: "desague_instalado",         label: "Desagüe",         color: "#8b5cf6" },
                      { campo: "electrificacion_instalada", label: "Electrificación", color: "#f59e0b" },
                    ].map(({ campo, label, color }) => (
                      <label key={campo} className={styles.servicioItem} style={{ borderColor: modalSocio[campo] ? color : "#e2e8f0" }}>
                        <input type="checkbox" checked={!!modalSocio[campo]} onChange={(e) => toggleServicio(campo, e.target.checked)} style={{display:"none"}} />
                        <span className={styles.servicioCheckbox} style={{ background: modalSocio[campo] ? color : "#fff", borderColor: modalSocio[campo] ? color : "#d1d5db" }}>
                          {modalSocio[campo] && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </span>
                        <span className={styles.servicioLabel} style={{ color: modalSocio[campo] ? color : "#64748b" }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className={styles.datosSeccion}>
                  <div className={styles.datosSeccTitleRow}>
                    <div className={styles.datosSeccTitle}>Información del socio</div>
                    {!editandoDatos ? (
                      <button className={styles.btnEditDatos} onClick={() => { setEditandoDatos(true); setDatosSocio({ apellidos: modalSocio.apellidos, nombres: modalSocio.nombres || "", dni: modalSocio.dni || "", celular: modalSocio.celular || "", servicio: modalSocio.servicio || "", manzana: modalSocio.manzana || "", lote: modalSocio.lote || "" }); }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5-7 7L4 13l.5-2.5 7-7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Editar
                      </button>
                    ) : (
                      <div style={{display:"flex",gap:"6px"}}>
                        <button className={styles.btnGuardarDatos} onClick={guardarDatos} disabled={guardandoDatos}>
                          {guardandoDatos ? "Guardando..." : "Guardar"}
                        </button>
                        <button className={styles.btnCancelarDatos} onClick={() => setEditandoDatos(false)}>Cancelar</button>
                      </div>
                    )}
                  </div>

                  {editandoDatos ? (
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoKey}>Apellidos</span>
                        <input className={styles.infoInput} value={datosSocio.apellidos || ""} onChange={(e) => setDatosSocio({...datosSocio, apellidos: e.target.value})} />
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoKey}>Nombres</span>
                        <input className={styles.infoInput} value={datosSocio.nombres || ""} onChange={(e) => setDatosSocio({...datosSocio, nombres: e.target.value})} />
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoKey}>DNI</span>
                        <input className={styles.infoInput} value={datosSocio.dni || ""} onChange={(e) => setDatosSocio({...datosSocio, dni: e.target.value})} />
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoKey}>Celular</span>
                        <input className={styles.infoInput} value={datosSocio.celular || ""} onChange={(e) => setDatosSocio({...datosSocio, celular: e.target.value})} />
                      </div>
                      <div className={styles.infoItem} style={{gridColumn:"1/-1"}}>
                        <span className={styles.infoKey}>Servicio contratado</span>
                        <input className={styles.infoInput} value={datosSocio.servicio || ""} onChange={(e) => setDatosSocio({...datosSocio, servicio: e.target.value})} />
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoKey}>Sector</span>
                        <span className={styles.infoVal}>{modalSocio.sector}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoKey}>Manzana</span>
                        <input className={styles.infoInput} value={datosSocio.manzana || ""} onChange={(e) => setDatosSocio({...datosSocio, manzana: e.target.value})} />
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoKey}>Lote</span>
                        <input className={styles.infoInput} value={datosSocio.lote || ""} onChange={(e) => setDatosSocio({...datosSocio, lote: e.target.value})} />
                      </div>
                    </div>
                  ) : (
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}><span className={styles.infoKey}>Apellidos</span><span className={styles.infoVal}>{modalSocio.apellidos}</span></div>
                      <div className={styles.infoItem}><span className={styles.infoKey}>Nombres</span><span className={styles.infoVal}>{modalSocio.nombres || "—"}</span></div>
                      <div className={styles.infoItem}><span className={styles.infoKey}>DNI</span><span className={styles.infoVal}>{modalSocio.dni || "—"}</span></div>
                      <div className={styles.infoItem}><span className={styles.infoKey}>Celular</span><span className={styles.infoVal}>{modalSocio.celular || "—"}</span></div>
                      <div className={styles.infoItem}><span className={styles.infoKey}>Sector</span><span className={styles.infoVal}>{modalSocio.sector}</span></div>
                      <div className={styles.infoItem}><span className={styles.infoKey}>Manzana / Lote</span><span className={styles.infoVal}>{modalSocio.manzana}-{modalSocio.lote}</span></div>
                      <div className={styles.infoItem} style={{gridColumn:"1/-1"}}><span className={styles.infoKey}>Servicio contratado</span><span className={styles.infoVal}>{modalSocio.servicio || "—"}</span></div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ── PESTAÑA TRASPASO ── */}
            {tabActiva === "traspaso" && (
              <div className={styles.datosTab}>

                {/* Titular anterior registrado */}
                {modalSocio.titular_anterior ? (
                  <div className={styles.datosSeccion}>
                    <div className={styles.datosSeccTitle}>Último traspaso registrado</div>
                    <div className={styles.traspasoCard}>
                      <div className={styles.traspasoCardHeader}>
                        <span className={styles.traspasoIcono}>🔄</span>
                        <div>
                          <div className={styles.traspasoTitularNombre}>{modalSocio.titular_anterior}</div>
                          <div className={styles.traspasoTitularSub}>Titular anterior</div>
                        </div>
                        <div className={styles.traspasoBadge}>
                          {modalSocio.fecha_traspaso
                            ? new Date(modalSocio.fecha_traspaso + "T12:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
                            : "—"}
                        </div>
                      </div>
                      <div className={styles.infoGrid} style={{marginTop:"10px"}}>
                        <div className={styles.infoItem}><span className={styles.infoKey}>DNI anterior</span><span className={styles.infoVal}>{modalSocio.dni_anterior || "—"}</span></div>
                        <div className={styles.infoItem}><span className={styles.infoKey}>Celular anterior</span><span className={styles.infoVal}>{modalSocio.celular_anterior || "—"}</span></div>
                        <div className={styles.infoItem}><span className={styles.infoKey}>Monto que pagó</span><span className={styles.infoVal} style={{color:"#15803d",fontWeight:"600"}}>{fmt(modalSocio.monto_pagado_anterior)}</span></div>
                        <div className={styles.infoItem}><span className={styles.infoKey}>Saldo que dejó</span><span className={styles.infoVal} style={{color:"#dc2626",fontWeight:"600"}}>{fmt(Number(modalSocio.monto_contratado) - Number(modalSocio.monto_pagado_anterior))}</span></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.datosSeccion}>
                    <div style={{color:"#94a3b8",fontSize:"13px",textAlign:"center",padding:"16px 0"}}>
                      Este lote no tiene traspasos registrados.
                    </div>
                  </div>
                )}

                {/* Formulario nuevo traspaso */}
                <div className={styles.datosSeccion}>
                  <div className={styles.datosSeccTitleRow}>
                    <div className={styles.datosSeccTitle}>Registrar nuevo traspaso</div>
                  </div>
                  <div style={{fontSize:"12px",color:"#64748b",marginBottom:"12px",background:"#fef9c3",border:"1px solid #fde68a",borderRadius:"8px",padding:"8px 12px"}}>
                    ⚠️ Al registrar el traspaso, los datos del titular actual (<strong>{modalSocio.apellidos} {modalSocio.nombres || ""}</strong>) quedarán guardados como titular anterior y serán reemplazados por el nuevo titular.
                  </div>

                  {!showTraspaso ? (
                    <button className={styles.btnRegistrar} onClick={() => setShowTraspaso(true)}>
                      🔄 Registrar traspaso
                    </button>
                  ) : (
                    <div className={styles.pagoForm}>
                      <div className={styles.pagoFormRow}>
                        <div className={styles.pagoFormGroup}>
                          <label>Apellidos nuevo titular *</label>
                          <input type="text" placeholder="GARCÍA LÓPEZ" value={nuevoTitular.apellidos}
                            onChange={(e) => setNuevoTitular({...nuevoTitular, apellidos: e.target.value})} />
                        </div>
                        <div className={styles.pagoFormGroup}>
                          <label>Nombres</label>
                          <input type="text" placeholder="JUAN CARLOS" value={nuevoTitular.nombres}
                            onChange={(e) => setNuevoTitular({...nuevoTitular, nombres: e.target.value})} />
                        </div>
                      </div>
                      <div className={styles.pagoFormRow}>
                        <div className={styles.pagoFormGroup}>
                          <label>DNI nuevo titular *</label>
                          <input type="text" placeholder="12345678" maxLength={8} value={nuevoTitular.dni}
                            onChange={(e) => setNuevoTitular({...nuevoTitular, dni: e.target.value})} />
                        </div>
                        <div className={styles.pagoFormGroup}>
                          <label>Celular</label>
                          <input type="text" placeholder="987654321" value={nuevoTitular.celular}
                            onChange={(e) => setNuevoTitular({...nuevoTitular, celular: e.target.value})} />
                        </div>
                      </div>
                      <div className={styles.pagoFormRow}>
                        <div className={styles.pagoFormGroup}>
                          <label>Fecha de traspaso</label>
                          <input type="date" value={nuevoTitular.fecha_traspaso}
                            onChange={(e) => setNuevoTitular({...nuevoTitular, fecha_traspaso: e.target.value})} />
                        </div>
                        <div className={styles.pagoFormGroup} />
                      </div>
                      <div className={styles.pagoFormBtns}>
                        <button className={styles.btnCancel} onClick={() => setShowTraspaso(false)}>Cancelar</button>
                        <button
                          className={styles.btnSave}
                          onClick={guardarTraspaso}
                          disabled={guardandoTraspaso || !nuevoTitular.apellidos || !nuevoTitular.dni}
                        >
                          {guardandoTraspaso ? "Guardando..." : "✓ Confirmar traspaso"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>
      )}
      {modalNuevoSocio && (
        <div className={styles.modalOverlay} onClick={() => setModalNuevoSocio(false)}>
          <div className={styles.modal} style={{maxWidth:"520px"}} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>Registrar nuevo socio</div>
                <div className={styles.modalSub}>Completa los datos del nuevo socio de Casuarinas</div>
              </div>
              <button className={styles.modalClose} onClick={() => setModalNuevoSocio(false)}>✕</button>
            </div>

            <div className={styles.pagoFormRow}>
              <div className={styles.pagoFormGroup}>
                <label>Apellidos *</label>
                <input type="text" placeholder="GARCÍA LÓPEZ" value={nuevoSocio.apellidos} onChange={(e) => setNuevoSocio({...nuevoSocio, apellidos: e.target.value})} />
              </div>
              <div className={styles.pagoFormGroup}>
                <label>Nombres</label>
                <input type="text" placeholder="JUAN CARLOS" value={nuevoSocio.nombres} onChange={(e) => setNuevoSocio({...nuevoSocio, nombres: e.target.value})} />
              </div>
            </div>

            <div className={styles.pagoFormRow}>
              <div className={styles.pagoFormGroup}>
                <label>DNI</label>
                <input type="text" placeholder="12345678" maxLength={8} value={nuevoSocio.dni} onChange={(e) => setNuevoSocio({...nuevoSocio, dni: e.target.value})} />
              </div>
              <div className={styles.pagoFormGroup}>
                <label>Celular</label>
                <input type="text" placeholder="987654321" value={nuevoSocio.celular} onChange={(e) => setNuevoSocio({...nuevoSocio, celular: e.target.value})} />
              </div>
            </div>

            <div className={styles.pagoFormRow}>
              <div className={styles.pagoFormGroup}>
                <label>Sector</label>
                <input type="text" placeholder="1" value={nuevoSocio.sector} onChange={(e) => setNuevoSocio({...nuevoSocio, sector: e.target.value})} />
              </div>
              <div className={styles.pagoFormGroup}>
                <label>Manzana *</label>
                <input type="text" placeholder="A1" value={nuevoSocio.manzana} onChange={(e) => setNuevoSocio({...nuevoSocio, manzana: e.target.value})} />
              </div>
              <div className={styles.pagoFormGroup}>
                <label>Lote *</label>
                <input type="text" placeholder="10" value={nuevoSocio.lote} onChange={(e) => setNuevoSocio({...nuevoSocio, lote: e.target.value})} />
              </div>
            </div>

            <div className={styles.pagoFormRow}>
              <div className={styles.pagoFormGroup}>
                <label>Servicio contratado</label>
                <input type="text" placeholder="Agua, Desagüe y Electrificación" value={nuevoSocio.servicio} onChange={(e) => setNuevoSocio({...nuevoSocio, servicio: e.target.value})} />
              </div>
              <div className={styles.pagoFormGroup}>
                <label>Monto contratado (S/) *</label>
                <input type="number" placeholder="7500" value={nuevoSocio.monto_contratado} onChange={(e) => setNuevoSocio({...nuevoSocio, monto_contratado: e.target.value})} />
              </div>
            </div>

            <div className={styles.pagoFormBtns}>
              <button className={styles.btnCancel} onClick={() => setModalNuevoSocio(false)}>Cancelar</button>
              <button
                className={styles.btnSave}
                onClick={guardarNuevoSocio}
                disabled={guardandoSocio || !nuevoSocio.apellidos || !nuevoSocio.manzana || !nuevoSocio.lote || !nuevoSocio.monto_contratado}
              >
                {guardandoSocio ? "Guardando..." : "Registrar socio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal anulación */}
      {anularModal && (
        <div className={styles.modalOverlay} onClick={() => { setAnularModal(null); setMotivoAnulacion(""); }}>
          <div className={styles.modal} style={{maxWidth:"420px"}} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle} style={{color:"#dc2626"}}>Anular pago</div>
                <div className={styles.modalSub}>
                  {fmt(anularModal.monto)} · {anularModal.fecha ? new Date(anularModal.fecha + "T00:00:00").toLocaleDateString("es-PE") : "Sin fecha"}
                  {anularModal.numero_boleta ? ` · ${anularModal.numero_boleta}` : ""}
                </div>
              </div>
              <button className={styles.modalClose} onClick={() => { setAnularModal(null); setMotivoAnulacion(""); }}>✕</button>
            </div>
            <div className={styles.pagoFormGroup}>
              <label>Motivo de anulación</label>
              <input
                type="text"
                placeholder="Ej: Pago duplicado, error en monto..."
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                style={{width:"100%"}}
              />
            </div>
            <div className={styles.pagoFormBtns}>
              <button className={styles.btnCancel} onClick={() => { setAnularModal(null); setMotivoAnulacion(""); }}>Cancelar</button>
              <button
                className={styles.btnAnularConfirm}
                onClick={confirmarAnulacion}
                disabled={anulando || !motivoAnulacion.trim()}
              >
                {anulando ? "Anulando..." : "Confirmar anulación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}