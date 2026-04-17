import { useEffect, useState } from "react";
import { supabase } from "../../supabase/client";
import styles from "../../styles/proyectos/Proyectos.module.css";
import DetalleProyecto from "./DetalleProyecto";

export default function Proyectos() {
  const [proyectos,     setProyectos]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [obraActiva,    setObraActiva]    = useState(null); // null = lista, id = detalle

  // Modal nueva obra
  const [showModal,  setShowModal]  = useState(false);
  const [formData,   setFormData]   = useState({
    nombre: "", cliente: "", presupuesto: "", descripcion: "",
    fecha_inicio: new Date().toISOString().split('T')[0]
  });

  // Modal editar obra
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData,      setEditData]      = useState({});
  const [editandoId,    setEditandoId]    = useState(null);
  const [guardando,     setGuardando]     = useState(false);

  useEffect(() => { fetchProyectos(); }, []);

  async function fetchProyectos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("obras")
      .select(`*, facturas_obra (*)`)
      .order('fecha_inicio', { ascending: false });
    if (error) console.error("Error:", error);
    setProyectos(data || []);
    setLoading(false);
  }

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    const { error } = await supabase.from("obras").insert([{
      ...formData,
      presupuesto: parseFloat(formData.presupuesto) || 0,
      estado: 'activa'
    }]);
    setGuardando(false);
    if (error) { alert("Error al guardar: " + error.message); return; }
    setShowModal(false);
    setFormData({ nombre: "", cliente: "", presupuesto: "", descripcion: "", fecha_inicio: new Date().toISOString().split('T')[0] });
    fetchProyectos();
  }

  function abrirEditar(obra, e) {
    e.stopPropagation();
    setEditData({
      nombre:      obra.nombre      || '',
      cliente:     obra.cliente     || '',
      presupuesto: obra.presupuesto || '',
      descripcion: obra.descripcion || '',
      estado:      obra.estado      || 'activa',
    });
    setEditandoId(obra.id);
    setShowEditModal(true);
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setGuardando(true);
    const { error } = await supabase.from("obras").update({
      nombre:      editData.nombre,
      cliente:     editData.cliente,
      presupuesto: parseFloat(editData.presupuesto) || 0,
      descripcion: editData.descripcion,
      estado:      editData.estado,
    }).eq("id", editandoId);
    setGuardando(false);
    if (error) { alert("Error al actualizar: " + error.message); return; }
    setShowEditModal(false);
    fetchProyectos();
  }

  async function eliminarObra(obra, e) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${obra.nombre}"? También se eliminarán sus facturas.`)) return;
    await supabase.from("obras").delete().eq("id", obra.id);
    fetchProyectos();
  }

  // ── Si hay obra activa → mostrar detalle ─────────────────────────────────────
  if (obraActiva) {
    return (
      <DetalleProyecto
        proyectoId={obraActiva}
        onVolver={() => { setObraActiva(null); fetchProyectos(); }}
      />
    );
  }

  // ── Vista lista ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.headerTitle}>Gestión de proyectos y obras</div>
          <div className={styles.headerSub}>Control de presupuestos y facturación por avance</div>
        </div>
        <button className={styles.btnNueva} onClick={() => setShowModal(true)}>+ Nueva obra</button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontFamily: 'Poppins, sans-serif' }}>
          Cargando proyectos...
        </div>
      ) : proyectos.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontFamily: 'Poppins, sans-serif' }}>
          No hay obras registradas aún
        </div>
      ) : (
        <div className={styles.grid}>
          {proyectos.map((obra) => {
            const facObra     = obra.facturas_obra || [];
            const facturado   = facObra.reduce((acc, f) => acc + (parseFloat(f.monto) || 0), 0);
            const presupuesto = parseFloat(obra.presupuesto) || 0;
            const pctFacturado = presupuesto > 0
              ? Math.min(100, (facturado / presupuesto) * 100).toFixed(0)
              : 0;
            const tieneAlerta = facObra.some(f => {
              if (f.estado === 'pagada' || f.estado === 'anulada') return false;
              const dias = Math.ceil((new Date(f.fecha_vencimiento) - new Date()) / 86400000);
              return dias <= 3;
            });

            return (
              <div key={obra.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardIconWrap}>
                    <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
                      <path d="M2 14V5l6-3 6 3v9M2 14h12M6 14V8h4v6" stroke="#1A2F5E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {tieneAlerta && (
                      <span style={{
                        background: '#fee2e2', color: '#dc2626',
                        fontSize: 10, fontWeight: 700,
                        padding: '2px 7px', borderRadius: 99,
                        fontFamily: 'Poppins, sans-serif'
                      }}>
                        ⚠ Cobro urgente
                      </span>
                    )}
                    <span className={styles.estadoBadge}>{obra.estado}</span>
                  </div>
                </div>

                <div className={styles.cardTitle}>{obra.nombre}</div>
                <div className={styles.cardServicio}>{obra.cliente || 'Cliente General'}</div>
                <div className={styles.cardDesc}>{obra.descripcion}</div>

                <div className={styles.cardStats}>
                  <div className={styles.stat}>
                    <span className={styles.statVal}>
                      {presupuesto > 0 ? `S/ ${(presupuesto / 1000).toFixed(1)}k` : '—'}
                    </span>
                    <span className={styles.statLabel}>Presupuesto</span>
                  </div>
                  <div className={styles.statDivider} />
                  <div className={styles.stat}>
                    <span className={styles.statVal}>{pctFacturado}%</span>
                    <span className={styles.statLabel}>Facturado</span>
                  </div>
                  <div className={styles.statDivider} />
                  <div className={styles.stat}>
                    <span className={styles.statVal}>{facObra.length}</span>
                    <span className={styles.statLabel}>Facturas</span>
                  </div>
                </div>

                {/* Botón principal — navega al detalle */}
                <button
                  className={styles.btnEntrar}
                  onClick={() => setObraActiva(obra.id)}
                >
                  Ver detalles y facturas →
                </button>

                {/* Editar / Eliminar */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={(e) => abrirEditar(obra, e)}
                    style={{
                      flex: 1, padding: 8, background: '#f1f5f9', border: 'none',
                      borderRadius: 8, color: '#1A2F5E', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={(e) => eliminarObra(obra, e)}
                    style={{
                      flex: 1, padding: 8, background: '#fff5f5', border: 'none',
                      borderRadius: 8, color: '#dc2626', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TABLA FACTURAS PENDIENTES / VENCIDAS ── */}
      {!loading && (() => {
        const alertas = proyectos.flatMap(obra =>
          (obra.facturas_obra || [])
            .filter(f => f.estado !== 'pagada' && f.estado !== 'anulada')
            .map(f => {
              const dias = Math.ceil((new Date(f.fecha_vencimiento + 'T00:00:00') - new Date()) / 86400000);
              return { ...f, dias, obraNombre: obra.nombre, obraId: obra.id };
            })
        ).sort((a, b) => a.dias - b.dias);

        if (alertas.length === 0) return null;

        const vencidas  = alertas.filter(f => f.dias < 0);
        const urgentes  = alertas.filter(f => f.dias >= 0 && f.dias <= 7);
        const proximas  = alertas.filter(f => f.dias > 7);

        return (
          <div style={{ marginTop: 28, fontFamily: 'Poppins, sans-serif' }}>
            <div style={{ fontSize: 10.5, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 500, marginBottom: 14 }}>
              Facturas pendientes de cobro ({alertas.length})
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Obra', 'N° Factura', 'Descripción', 'Monto', 'Vencimiento', 'Estado', 'Acción'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.7px', borderBottom: '0.5px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alertas.map((f, i) => {
                    const esVencida = f.dias < 0;
                    const esUrgente = f.dias >= 0 && f.dias <= 3;
                    const rowBg = esVencida ? '#fff5f5' : esUrgente ? '#fffbeb' : '#fff';
                    const estadoLabel = esVencida ? 'Vencida' : esUrgente ? `Vence en ${f.dias}d` : `${f.dias}d restantes`;
                    const estadoBg    = esVencida ? '#fee2e2' : esUrgente ? '#fef9c3' : '#eff6ff';
                    const estadoColor = esVencida ? '#991b1b' : esUrgente ? '#854d0e' : '#1d4ed8';

                    return (
                      <tr key={f.id} style={{ background: rowBg, borderBottom: '0.5px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#1A2F5E', fontSize: 12.5 }}>{f.obraNombre}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1A2F5E', fontFamily: 'monospace' }}>{f.numero}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>{f.descripcion || '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1A2F5E', whiteSpace: 'nowrap' }}>
                          S/ {Number(f.monto || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {f.fecha_vencimiento ? new Date(f.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: estadoBg, color: estadoColor, fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99 }}>
                            {estadoLabel}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => setObraActiva(f.obraId)}
                            style={{ padding: '5px 12px', background: '#1A2F5E', border: 'none', borderRadius: 7, color: '#fff', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}
                          >
                            Ver obra →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '0.5px solid #e2e8f0' }}>
                    <td colSpan={3} style={{ padding: '10px 16px', fontSize: 12, color: '#64748b', textAlign: 'right', fontWeight: 600 }}>
                      Total por cobrar
                    </td>
                    <td colSpan={4} style={{ padding: '10px 16px', fontWeight: 700, color: '#1A2F5E', fontSize: 14 }}>
                      S/ {alertas.reduce((a, f) => a + Number(f.monto || 0), 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL NUEVA OBRA ── */}
      {showModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Registrar Nueva Obra</h3>
              <button className={styles.btnClose} onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Nombre de la Obra</label>
                <input name="nombre" value={formData.nombre} onChange={handleInputChange} required placeholder="Ej: Residencial Los Pinos" />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Cliente</label>
                  <input name="cliente" value={formData.cliente} onChange={handleInputChange} placeholder="Nombre del cliente" />
                </div>
                <div className={styles.formGroup}>
                  <label>Presupuesto (S/)</label>
                  <input type="number" name="presupuesto" min="0" step="0.01" value={formData.presupuesto} onChange={handleInputChange} required placeholder="0.00" />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Descripción</label>
                <textarea name="descripcion" value={formData.descripcion} onChange={handleInputChange} rows="3" placeholder="Descripción del proyecto..." />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnCancelar} onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className={styles.btnGuardar} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar Proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR OBRA ── */}
      {showEditModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Editar Obra</h3>
              <button className={styles.btnClose} onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpdate} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Nombre de la Obra</label>
                <input required value={editData.nombre} onChange={e => setEditData({...editData, nombre: e.target.value})} />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Cliente</label>
                  <input value={editData.cliente} onChange={e => setEditData({...editData, cliente: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label>Presupuesto (S/)</label>
                  <input type="number" min="0" step="0.01" value={editData.presupuesto} onChange={e => setEditData({...editData, presupuesto: e.target.value})} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Estado</label>
                <select value={editData.estado} onChange={e => setEditData({...editData, estado: e.target.value})}>
                  <option value="activa">ACTIVA</option>
                  <option value="pausada">PAUSADA</option>
                  <option value="terminada">TERMINADA</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Descripción</label>
                <textarea rows="3" value={editData.descripcion} onChange={e => setEditData({...editData, descripcion: e.target.value})} />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnCancelar} onClick={() => setShowEditModal(false)}>Cancelar</button>
                <button type="submit" className={styles.btnGuardar} disabled={guardando}>
                  {guardando ? 'Actualizando...' : 'Actualizar Proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}