import { useEffect, useState } from "react";
import { supabase } from "../../supabase/client";
import styles from "../../styles/proyectos/DetalleProyecto.module.css";
import * as XLSX from 'xlsx';

const fmt      = n  => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
const fmtFecha = d  => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const hoy      = () => new Date().toISOString().split('T')[0];

function diasParaVencer(fechaVenc) {
  if (!fechaVenc) return 999;
  const h = new Date(); h.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(fechaVenc + 'T00:00:00') - h) / 86400000);
}

const FAC_INI = { numero: '', fecha_vencimiento: '', monto: '', descripcion: '', porcentaje_avance: '' };

export default function DetalleProyecto({ proyectoId, onVolver }) {
  const [obra,         setObra]         = useState(null);
  const [gastos,       setGastos]       = useState([]);
  const [loading,      setLoading]      = useState(true);

  // Modal editar obra
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData,      setEditData]      = useState({});
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  // Modal factura
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [editandoFacId,    setEditandoFacId]    = useState(null);
  const [facturaData,      setFacturaData]      = useState(FAC_INI);
  const [guardandoFac,     setGuardandoFac]     = useState(false);

  // Modal pago
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [facturaAPagar, setFacturaAPagar] = useState(null);
  const [pagoData,      setPagoData]      = useState({ fecha_pago: hoy(), monto_pagado: '' });
  const [guardandoPago, setGuardandoPago] = useState(false);

  useEffect(() => {
    if (proyectoId) fetchDatosCompletos();
    else setLoading(false);
  }, [proyectoId]);

  async function fetchDatosCompletos() {
    setLoading(true);
    try {
      // Cargar obra y gastos en paralelo — sin depender del RPC
      const [{ data: obraData, error: obraError }, { data: gastosData }] = await Promise.all([
        supabase.from("obras").select(`*, facturas_obra (*)`).eq("id", proyectoId).single(),
        supabase.from("gastos_obra").select("*").eq("obra_id", proyectoId).order('fecha', { ascending: false }),
      ]);
      if (obraError) { console.error("Error obra:", obraError.message); setLoading(false); return; }
      setObra(obraData);
      setEditData(obraData || {});
      setGastos(gastosData || []);
    } catch (err) {
      console.error("Error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Editar obra ──────────────────────────────────────────────────────────────
  async function handleUpdate(e) {
    e.preventDefault();
    setGuardandoEdit(true);
    const { error } = await supabase.from("obras").update({
      nombre:      editData.nombre,
      cliente:     editData.cliente,
      presupuesto: parseFloat(editData.presupuesto) || 0,
      descripcion: editData.descripcion,
      estado:      editData.estado,
    }).eq("id", proyectoId);
    setGuardandoEdit(false);
    if (error) { alert("Error: " + error.message); return; }
    setShowEditModal(false);
    fetchDatosCompletos();
  }

  // ── CRUD Facturas ─────────────────────────────────────────────────────────────
  async function handleFacturaSubmit(e) {
    e.preventDefault();
    setGuardandoFac(true);
    const payload = {
      obra_id:           proyectoId,
      numero:            facturaData.numero,
      fecha_vencimiento: facturaData.fecha_vencimiento,
      monto:             parseFloat(facturaData.monto) || 0,
      descripcion:       facturaData.descripcion || null,
      porcentaje_avance: parseFloat(facturaData.porcentaje_avance) || null,
    };
    let error;
    if (editandoFacId) {
      ({ error } = await supabase.from("facturas_obra").update(payload).eq("id", editandoFacId));
    } else {
      ({ error } = await supabase.from("facturas_obra").insert({ ...payload, estado: 'pendiente' }));
    }
    setGuardandoFac(false);
    if (error) { alert("Error: " + error.message); return; }
    setShowFacturaModal(false);
    setFacturaData(FAC_INI);
    setEditandoFacId(null);
    fetchDatosCompletos();
  }

  function abrirEditarFactura(f) {
    setFacturaData({
      numero:            f.numero,
      fecha_vencimiento: f.fecha_vencimiento,
      monto:             f.monto,
      descripcion:       f.descripcion || '',
      porcentaje_avance: f.porcentaje_avance || '',
    });
    setEditandoFacId(f.id);
    setShowFacturaModal(true);
  }

  async function eliminarFactura(id) {
    if (!confirm('¿Eliminar esta factura?')) return;
    await supabase.from("facturas_obra").delete().eq("id", id);
    fetchDatosCompletos();
  }

  // ── Registrar pago ────────────────────────────────────────────────────────────
  async function handlePagoSubmit(e) {
    e.preventDefault();
    setGuardandoPago(true);
    const { error } = await supabase.from("facturas_obra").update({
      estado:       'pagada',
      fecha_pago:   pagoData.fecha_pago,
      monto_pagado: parseFloat(pagoData.monto_pagado) || facturaAPagar.monto,
    }).eq("id", facturaAPagar.id);
    setGuardandoPago(false);
    if (error) { alert("Error: " + error.message); return; }
    setShowPagoModal(false);
    fetchDatosCompletos();
  }

  // ── Estado factura ────────────────────────────────────────────────────────────
  function estadoFactura(f) {
    if (f.estado === 'pagada' || f.estado === 'anulada') return f.estado;
    return diasParaVencer(f.fecha_vencimiento) < 0 ? 'vencida' : 'pendiente';
  }

  // ── Exportar Excel ────────────────────────────────────────────────────────────
  function exportarReporte() {
    if (!obra) return;
    const wb = XLSX.utils.book_new();
    const facObra   = obra.facturas_obra || [];
    const facturado = facObra.reduce((a, f) => a + Number(f.monto || 0), 0);
    const cobrado   = facObra.filter(f => f.estado === 'pagada').reduce((a, f) => a + Number(f.monto_pagado || f.monto || 0), 0);
    const gastado   = gastos.reduce((a, g) => a + Number(g.monto || 0), 0);

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Campo: 'Obra',            Valor: obra.nombre },
      { Campo: 'Cliente',         Valor: obra.cliente || '—' },
      { Campo: 'Estado',          Valor: obra.estado },
      { Campo: 'Presupuesto',     Valor: Number(obra.presupuesto || 0) },
      { Campo: 'Total facturado', Valor: facturado },
      { Campo: 'Total cobrado',   Valor: cobrado },
      { Campo: 'Por cobrar',      Valor: facturado - cobrado },
      { Campo: 'Total gastado',   Valor: gastado },
      { Campo: 'Margen',          Valor: facturado - gastado },
    ]), 'Resumen');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      facObra.map(f => ({
        'N° Factura':   f.numero,
        'Descripción':  f.descripcion || '—',
        'Monto':        Number(f.monto || 0),
        'Vencimiento':  fmtFecha(f.fecha_vencimiento),
        'Estado':       f.estado,
        'Fecha pago':   f.fecha_pago ? fmtFecha(f.fecha_pago) : '—',
      }))
    ), 'Facturas');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      gastos.map(g => ({
        'Fecha':        fmtFecha(g.fecha),
        'Categoría':    g.categoria || '—',
        'Descripción':  g.descripcion || '—',
        'Monto':        Number(g.monto || 0),
        'Responsable':  g.responsable || '—',
      }))
    ), 'Gastos');

    XLSX.writeFile(wb, `Reporte_${(obra.nombre || 'obra').replace(/\s+/g, '_')}.xlsx`);
  }

  if (loading) return <div className={styles.loader}>Cargando panel de control...</div>;
  if (!obra)   return <div className={styles.loader}>No se encontró la información del proyecto.</div>;

  const facObra             = obra.facturas_obra || [];
  const totalFacturado      = facObra.reduce((a, f) => a + Number(f.monto || 0), 0);
  const totalCobrado        = facObra.filter(f => f.estado === 'pagada').reduce((a, f) => a + Number(f.monto_pagado || f.monto || 0), 0);
  const totalGastos         = gastos.reduce((a, g) => a + Number(g.monto || 0), 0);
  const margen              = totalFacturado - totalGastos;
  const pctFacturado        = obra.presupuesto > 0 ? Math.min(100, (totalFacturado / obra.presupuesto) * 100) : 0;

  const porCategoria = gastos.reduce((acc, g) => {
    const cat = g.categoria || 'Sin categoría';
    acc[cat] = (acc[cat] || 0) + Number(g.monto || 0);
    return acc;
  }, {});

  return (
    <div className={styles.wrap}>

      {/* ── HEADER ── */}
      <div className={styles.header}>
        <div>
          <button onClick={onVolver} className={styles.btnBack}>← Volver a proyectos</button>
          <div className={styles.headerTitle}>{obra.nombre}</div>
          <div className={styles.headerSub}>{obra.cliente || 'Cliente General'} {obra.ubicacion ? `· ${obra.ubicacion}` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className={styles.btnSecundario} onClick={exportarReporte}>↓ Excel</button>
          <button className={styles.btnSecundario} onClick={() => setShowEditModal(true)}>Editar obra</button>
          <button className={styles.btnNueva} onClick={() => { setFacturaData(FAC_INI); setEditandoFacId(null); setShowFacturaModal(true); }}>
            + Nueva factura
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: '#eff6ff' }}>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M8 1v8M5 6l3 3 3-3" stroke="#1A2F5E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="#1A2F5E" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </div>
          <span className={styles.statEstado}>{obra.estado}</span>
          <div className={styles.statVal}>{obra.presupuesto > 0 ? fmt(obra.presupuesto) : '—'}</div>
          <div className={styles.statLabel}>Presupuesto</div>
          <div className={styles.statSub}>monto contratado</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: '#eff6ff' }}>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="2" stroke="#2E487C" strokeWidth="1.4"/><path d="M1 7h14M5 10.5h2M10 10.5h1" stroke="#2E487C" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </div>
          <span className={styles.statEstado}>{facObra.length} facturas</span>
          <div className={styles.statVal}>{fmt(totalFacturado)}</div>
          <div className={styles.statLabel}>Total facturado</div>
          <div className={styles.miniBar}>
            <div className={styles.miniBarFill} style={{ width: `${pctFacturado}%`, background: '#1A2F5E' }} />
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: '#f0fdf4' }}>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M2 8l4 4 8-8" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className={styles.statEstado} style={{ background: '#dcfce7', color: '#15803d' }}>cobrado</span>
          <div className={styles.statVal} style={{ color: '#15803d' }}>{fmt(totalCobrado)}</div>
          <div className={styles.statLabel}>Total cobrado</div>
          <div className={styles.statSub}>por cobrar: {fmt(totalFacturado - totalCobrado)}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: '#fff5f5' }}>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="#dc2626" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </div>
          <span className={styles.statEstado} style={{ background: '#fee2e2', color: '#dc2626' }}>gastado</span>
          <div className={styles.statVal} style={{ color: '#dc2626' }}>{fmt(totalGastos)}</div>
          <div className={styles.statLabel}>Total gastado</div>
          <div className={styles.statSub}>margen: <strong style={{ color: margen >= 0 ? '#15803d' : '#dc2626' }}>{fmt(margen)}</strong></div>
        </div>
      </div>

      {/* ── FACTURAS estilo lista (igual que gastos) ── */}
      <div className={styles.seccionLabel}>Historial de facturación</div>
      <div className={styles.gastosBox}>
        {/* Resumen izquierda */}
        <div className={styles.gastosLeft}>
          <div className={styles.gastosTotal}>
            <span>Total facturado</span>
            <strong style={{ color: '#1A2F5E' }}>{fmt(totalFacturado)}</strong>
          </div>
          <div className={styles.gastosTotal} style={{ marginTop: 4 }}>
            <span>Total cobrado</span>
            <strong style={{ color: '#15803d' }}>{fmt(totalCobrado)}</strong>
          </div>
          <div className={styles.gastosMargen} style={{ marginTop: 4 }}>
            Por cobrar: <strong style={{ color: totalFacturado - totalCobrado > 0 ? '#dc2626' : '#15803d' }}>{fmt(totalFacturado - totalCobrado)}</strong>
          </div>

          {/* Desglose por estado */}
          {facObra.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {[
                { label: 'Pagadas',   val: facObra.filter(f => estadoFactura(f) === 'pagada').length,    color: '#15803d', bg: '#dcfce7' },
                { label: 'Pendientes',val: facObra.filter(f => estadoFactura(f) === 'pendiente').length, color: '#1d4ed8', bg: '#eff6ff' },
                { label: 'Vencidas',  val: facObra.filter(f => estadoFactura(f) === 'vencida').length,   color: '#991b1b', bg: '#fee2e2' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, color: '#64748b', fontFamily: 'Poppins, sans-serif' }}>{s.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 99, fontFamily: 'Poppins, sans-serif' }}>{s.val}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lista derecha */}
        <div className={styles.gastosLista}>
          {facObra.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontFamily: 'Poppins, sans-serif' }}>
              Sin facturas — crea la primera arriba
            </div>
          ) : (
            [...facObra]
              .sort((a, b) => (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || ''))
              .map(f => {
                const estado = estadoFactura(f);
                const dias   = diasParaVencer(f.fecha_vencimiento);
                const estadoColors = {
                  pagada:   { color: '#15803d', bg: '#dcfce7' },
                  pendiente:{ color: '#1d4ed8', bg: '#eff6ff' },
                  vencida:  { color: '#991b1b', bg: '#fee2e2' },
                  anulada:  { color: '#64748b', bg: '#f1f5f9' },
                }[estado] || { color: '#1d4ed8', bg: '#eff6ff' };

                return (
                  <div key={f.id} className={styles.gastoItem} style={{ alignItems: 'flex-start', paddingTop: 10, paddingBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span className={styles.gastoDesc}>{f.numero}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, background: estadoColors.bg, color: estadoColors.color, padding: '1px 7px', borderRadius: 99, fontFamily: 'Poppins, sans-serif' }}>
                          {estado === 'pendiente' && dias <= 3 && dias >= 0 ? `Vence en ${dias}d` : estado.charAt(0).toUpperCase() + estado.slice(1)}
                        </span>
                      </div>
                      {f.descripcion && <div style={{ fontSize: 11.5, color: '#64748b', fontFamily: 'Poppins, sans-serif', marginBottom: 2 }}>{f.descripcion}</div>}
                      <div className={styles.gastoMeta}>
                        {f.porcentaje_avance ? `${f.porcentaje_avance}% avance · ` : ''}
                        Vence: {fmtFecha(f.fecha_vencimiento)}
                        {f.fecha_pago && <span style={{ color: '#15803d', marginLeft: 6 }}>· Pagada: {fmtFecha(f.fecha_pago)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, marginLeft: 12 }}>
                      <span className={styles.gastoMonto} style={{ color: '#1A2F5E' }}>{fmt(f.monto)}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!['pagada', 'anulada'].includes(estado) && (
                          <button
                            onClick={() => { setFacturaAPagar(f); setPagoData({ fecha_pago: hoy(), monto_pagado: String(f.monto) }); setShowPagoModal(true); }}
                            style={{ padding: '3px 8px', background: '#f0fdf4', border: 'none', borderRadius: 6, color: '#15803d', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}
                          >✓ Cobrar</button>
                        )}
                        <button
                          onClick={() => abrirEditarFactura(f)}
                          style={{ padding: '3px 8px', background: '#f1f5f9', border: 'none', borderRadius: 6, color: '#1A2F5E', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}
                        >Editar</button>
                        <button
                          onClick={() => eliminarFactura(f.id)}
                          style={{ padding: '3px 8px', background: '#fff5f5', border: 'none', borderRadius: 6, color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}
                        >✕</button>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* ── GASTOS resumen ── */}
      <div className={styles.seccionLabel} style={{ marginTop: 24 }}>Gastos operativos</div>
      <div className={styles.gastosBox}>
        <div className={styles.gastosLeft}>
          <div className={styles.gastosTotal}>
            <span>Total gastado</span>
            <strong style={{ color: '#dc2626' }}>{fmt(totalGastos)}</strong>
          </div>
          <div className={styles.gastosMargen}>
            Margen (facturado − gastado):
            <strong style={{ color: margen >= 0 ? '#15803d' : '#dc2626', marginLeft: 6 }}>{fmt(margen)}</strong>
          </div>
          {Object.keys(porCategoria).length > 0 && (
            <div style={{ marginTop: 12 }}>
              {Object.entries(porCategoria).sort((a,b) => b[1]-a[1]).map(([cat, monto]) => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11.5, color: '#334155', width: 130, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Poppins, sans-serif' }}>{cat}</span>
                  <div style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${totalGastos > 0 ? (monto/totalGastos)*100 : 0}%`, height: '100%', background: '#2E487C', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#1A2F5E', whiteSpace: 'nowrap', fontFamily: 'Poppins, sans-serif' }}>{fmt(monto)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.gastosLista}>
          {gastos.length === 0 ? (
            <div className={styles.empty}>Sin gastos registrados — ver módulo Gastos</div>
          ) : gastos.slice(0, 8).map(g => (
            <div key={g.id} className={styles.gastoItem}>
              <div>
                <div className={styles.gastoDesc}>{g.descripcion || '—'}</div>
                <div className={styles.gastoMeta}>{g.categoria} · {fmtFecha(g.fecha)}</div>
              </div>
              <div className={styles.gastoMonto}>{fmt(g.monto)}</div>
            </div>
          ))}
          {gastos.length > 8 && <div style={{ fontSize: 11.5, color: '#94a3b8', textAlign: 'center', padding: '8px 0', fontFamily: 'Poppins, sans-serif' }}>+ {gastos.length - 8} más en módulo Gastos</div>}
        </div>
      </div>

      {/* ══ MODAL EDITAR OBRA ══ */}
      {showEditModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Editar Obra</h3>
              <button className={styles.btnClose} onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpdate} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nombre de la Obra</label>
                <input required value={editData.nombre || ''} onChange={e => setEditData({...editData, nombre: e.target.value})} className={styles.input} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Cliente</label>
                <input value={editData.cliente || ''} onChange={e => setEditData({...editData, cliente: e.target.value})} className={styles.input} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Presupuesto (S/)</label>
                <input type="number" min="0" step="0.01" value={editData.presupuesto || ''} onChange={e => setEditData({...editData, presupuesto: e.target.value})} className={styles.input} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Estado</label>
                <select value={editData.estado || 'activa'} onChange={e => setEditData({...editData, estado: e.target.value})} className={styles.select}>
                  <option value="activa">ACTIVA</option>
                  <option value="pausada">PAUSADA</option>
                  <option value="terminada">TERMINADA</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Descripción</label>
                <textarea rows={3} value={editData.descripcion || ''} onChange={e => setEditData({...editData, descripcion: e.target.value})} className={styles.input} style={{ resize: 'vertical' }} />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnCancelar} onClick={() => setShowEditModal(false)}>Cancelar</button>
                <button type="submit" className={styles.btnGuardar} disabled={guardandoEdit}>{guardandoEdit ? 'Guardando...' : 'Actualizar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL FACTURA ══ */}
      {showFacturaModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>{editandoFacId ? 'Editar Factura' : 'Nueva Factura'}</h3>
              <button className={styles.btnClose} onClick={() => { setShowFacturaModal(false); setEditandoFacId(null); setFacturaData(FAC_INI); }}>&times;</button>
            </div>
            <form onSubmit={handleFacturaSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>N° Factura *</label>
                <input required value={facturaData.numero} onChange={e => setFacturaData({...facturaData, numero: e.target.value})} placeholder="Ej: F001-2024" className={styles.input} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Descripción</label>
                <input value={facturaData.descripcion} onChange={e => setFacturaData({...facturaData, descripcion: e.target.value})} placeholder="Ej: Avance 30% - excavación" className={styles.input} />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>% Avance</label>
                  <input type="number" step="0.01" min="0" max="100" value={facturaData.porcentaje_avance} onChange={e => setFacturaData({...facturaData, porcentaje_avance: e.target.value})} placeholder="30" className={styles.input} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Monto (S/) *</label>
                  <input type="number" step="0.01" min="0" required value={facturaData.monto} onChange={e => setFacturaData({...facturaData, monto: e.target.value})} placeholder="0.00" className={styles.input} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Fecha de Vencimiento *</label>
                <input type="date" required value={facturaData.fecha_vencimiento} onChange={e => setFacturaData({...facturaData, fecha_vencimiento: e.target.value})} className={styles.input} />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnCancelar} onClick={() => { setShowFacturaModal(false); setEditandoFacId(null); setFacturaData(FAC_INI); }}>Cancelar</button>
                <button type="submit" className={styles.btnGuardar} disabled={guardandoFac}>{guardandoFac ? 'Guardando...' : editandoFacId ? 'Actualizar' : 'Crear Factura'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL PAGO ══ */}
      {showPagoModal && facturaAPagar && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Registrar Pago</h3>
              <button className={styles.btnClose} onClick={() => setShowPagoModal(false)}>&times;</button>
            </div>
            <form onSubmit={handlePagoSubmit} className={styles.form}>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', marginBottom: 8, fontFamily: 'Poppins, sans-serif' }}>
                <div style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>Factura: <strong>{facturaAPagar.numero}</strong></div>
                <div style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>Monto original: <strong>{fmt(facturaAPagar.monto)}</strong></div>
                <div style={{ fontSize: 13, color: '#334155' }}>Vencimiento: <strong>{fmtFecha(facturaAPagar.fecha_vencimiento)}</strong></div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Fecha de Pago *</label>
                <input type="date" required value={pagoData.fecha_pago} onChange={e => setPagoData({...pagoData, fecha_pago: e.target.value})} className={styles.input} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Monto Pagado (S/) *</label>
                <input type="number" step="0.01" min="0" required value={pagoData.monto_pagado} onChange={e => setPagoData({...pagoData, monto_pagado: e.target.value})} className={styles.input} />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnCancelar} onClick={() => setShowPagoModal(false)}>Cancelar</button>
                <button type="submit" className={styles.btnGuardar} disabled={guardandoPago}>{guardandoPago ? 'Guardando...' : 'Confirmar Pago'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}