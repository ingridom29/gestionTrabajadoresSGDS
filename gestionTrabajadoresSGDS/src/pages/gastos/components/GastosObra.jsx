import { useState, useEffect } from 'react';
import { supabase } from '../../../supabase/client';
import styles from '../../../styles/gastos/GastosObra.module.css';

const CATEGORIAS_OBRA = [
  'Materiales', 'Herramientas', 'Transporte / Flete',
  'Mano de obra externa', 'Alimentación', 'Combustible', 'Planilla', 'Otros',
];

const FORM_INICIAL = {
  obra_id: '',
  fecha: new Date().toISOString().split('T')[0],
  categoria: '',
  descripcion: '',
  monto: '',
  comprobante: '',
  responsable: '',
  pagado_por: 'empresa',
  observaciones: '',
};

const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function GastosObra() {
  const [gastos, setGastos]       = useState([]);
  const [obras, setObras]         = useState([]);
  const [form, setForm]           = useState(FORM_INICIAL);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalObra, setModalObra] = useState(false);
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [filtroObra, setFiltroObra] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [nuevaObra, setNuevaObra] = useState({ nombre: '', ubicacion: '' });
  const [filtroCat, setFiltroCat]   = useState('');
  const [empleados, setEmpleados]   = useState([]);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setCargando(true);
    const [{ data: g }, { data: o }, { data: e }] = await Promise.all([
      supabase.from('gastos_obra').select('*, obras(nombre)').order('fecha', { ascending: false }),
      supabase.from('obras').select('*').order('nombre'),
      supabase.from('empleados').select('id, nombres').order('nombres'),
    ]);
    setGastos(g || []);
    setObras(o || []);
    setEmpleados(e || []);
    setCargando(false);
  }

  async function guardarGasto(e) {
    e.preventDefault();
    setGuardando(true);
    const payload = { ...form, monto: parseFloat(form.monto), obra_id: form.obra_id || null };
    if (editandoId) {
      await supabase.from('gastos_obra').update(payload).eq('id', editandoId);
    } else {
      await supabase.from('gastos_obra').insert(payload);
    }
    setGuardando(false);
    cerrarModal();
    cargarDatos();
  }

  async function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    await supabase.from('gastos_obra').delete().eq('id', id);
    cargarDatos();
  }

  async function crearObra(e) {
    e.preventDefault();
    await supabase.from('obras').insert({ ...nuevaObra, estado: 'activa' });
    setNuevaObra({ nombre: '', ubicacion: '' });
    setModalObra(false);
    cargarDatos();
  }

  function abrirEditar(g) {
    setForm({
      obra_id: g.obra_id || '',
      fecha: g.fecha,
      categoria: g.categoria,
      descripcion: g.descripcion || '',
      monto: g.monto,
      comprobante: g.comprobante || '',
      responsable: g.responsable,
      pagado_por: g.pagado_por,
      observaciones: g.observaciones || '',
    });
    setEditandoId(g.id);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setForm(FORM_INICIAL);
    setEditandoId(null);
  }

  const gastosFiltrados = gastos.filter(g => {
    if (filtroObra && g.obra_id !== filtroObra) return false;
    if (filtroCat  && g.categoria !== filtroCat)  return false;
    return true;
  });
  const totalFiltrado    = gastosFiltrados.reduce((a, g) => a + Number(g.monto), 0);
  const pendientes       = gastosFiltrados.filter(g => g.pagado_por === 'responsable' && !g.compensado).length;
  const totalPendiente   = gastosFiltrados.filter(g => g.pagado_por === 'responsable' && !g.compensado).reduce((a, g) => a + Number(g.monto), 0);

  const fmt = n => Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2 });
  const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('es-PE');

  return (
    <>
      {/* KPIs */}
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Total gastos</div>
          <div className={styles.kpiVal}>S/ {fmt(totalFiltrado)}</div>
          <div className={styles.kpiSub}>{gastosFiltrados.length} registros</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Obras registradas</div>
          <div className={styles.kpiVal}>{obras.length}</div>
          <div className={styles.kpiSub}>activas en el sistema</div>
        </div>
        <div className={`${styles.kpi} ${pendientes > 0 ? styles.kpiAlerta : ''}`}>
          <div className={styles.kpiLabel}>Pendientes compensación</div>
          <div className={styles.kpiVal}>{pendientes}</div>
          <div className={styles.kpiSub}>{pendientes > 0 ? `S/ ${fmt(totalPendiente)} por devolver` : 'Todo al día'}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Pagados por empresa</div>
          <div className={styles.kpiVal}>{gastosFiltrados.filter(g => g.pagado_por === 'empresa').length}</div>
          <div className={styles.kpiSub}>de {gastosFiltrados.length} gastos</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <select className={styles.select} value={filtroObra} onChange={e => setFiltroObra(e.target.value)}>
          <option value="">Todas las obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <select className={styles.select} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS_OBRA.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className={styles.spacer} />
        <button className={styles.btnSecundario} onClick={() => setModalObra(true)}>
          <IconPlus /> Nueva obra
        </button>
        <button className={styles.btnPrimario} onClick={() => { setForm(FORM_INICIAL); setEditandoId(null); setModalAbierto(true); }}>
          <IconPlus /> Registrar gasto
        </button>
      </div>

      {/* Tabla */}
      {cargando ? (
        <div className={styles.loadingMsg}>Cargando gastos...</div>
      ) : gastosFiltrados.length === 0 ? (
        <div className={styles.emptyMsg}>No hay gastos registrados</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Obra</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Responsable</th>
                <th>Pagó</th>
                <th>Monto</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gastosFiltrados.map(g => (
                <tr key={g.id} className={g.pagado_por === 'responsable' && !g.compensado ? styles.filaAlerta : ''}>
                  <td>{fmtDate(g.fecha)}</td>
                  <td>
                    {g.obras?.nombre
                      ? <span className={styles.nombreObra}>{g.obras.nombre}</span>
                      : <span className={styles.sinObra}>Sin obra</span>}
                  </td>
                  <td><span className={styles.badge}>{g.categoria}</span></td>
                  <td>{g.descripcion || '—'}</td>
                  <td>{g.responsable}</td>
                  <td>
                    <span className={`${styles.pagadoPor} ${g.pagado_por === 'empresa' ? styles.pagadoEmpresa : styles.pagadoResponsable}`}>
                      {g.pagado_por === 'empresa' ? 'Empresa' : 'Responsable'}
                    </span>
                  </td>
                  <td className={styles.monto}>S/ {fmt(g.monto)}</td>
                  <td>
                    {g.pagado_por === 'responsable'
                      ? g.compensado
                        ? <span className={styles.estadoOk}>Compensado</span>
                        : <span className={styles.estadoPendiente}>Pendiente</span>
                      : <span className={styles.estadoNa}>—</span>}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actBtn} onClick={() => abrirEditar(g)} title="Editar"><IconEdit /></button>
                      <button className={`${styles.actBtn} ${styles.actBtnDanger}`} onClick={() => eliminarGasto(g.id)} title="Eliminar"><IconTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.tableFooter}>{gastosFiltrados.length} registros · Total: S/ {fmt(totalFiltrado)}</div>
        </div>
      )}

      {/* Modal Registrar/Editar Gasto */}
      {modalAbierto && (
        <div className={styles.modalOverlay} onClick={cerrarModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editandoId ? 'Editar gasto' : 'Registrar gasto por obra'}</div>
              <button className={styles.modalClose} onClick={cerrarModal}>✕</button>
            </div>

            <form onSubmit={guardarGasto}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Obra</label>
                  <select value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })}>
                    <option value="">Sin obra asignada</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Fecha *</label>
                  <input type="date" required value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>Categoría *</label>
                  <select required value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {CATEGORIAS_OBRA.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Monto (S/) *</label>
                  <input type="number" step="0.01" min="0" required value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0.00" />
                </div>
                <div className={styles.formGroupFull}>
                  <label>Descripción</label>
                  <input type="text" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalle del gasto..." />
                </div>
                <div className={styles.formGroup}>
                  <label>Responsable *</label>
                  <select required value={form.responsable} onChange={e => setForm({ ...form, responsable: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {empleados.map(emp => <option key={emp.id} value={emp.nombres}>{emp.nombres}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>¿Quién pagó? *</label>
                  <select required value={form.pagado_por} onChange={e => setForm({ ...form, pagado_por: e.target.value })}>
                    <option value="empresa">Empresa</option>
                    <option value="responsable">Responsable (pendiente compensación)</option>
                  </select>
                </div>
                <div className={styles.formGroupFull}>
                  <label>N° Comprobante / Referencia</label>
                  <input type="text" value={form.comprobante} onChange={e => setForm({ ...form, comprobante: e.target.value })} placeholder="Boleta, factura, referencia..." />
                </div>
                <div className={styles.formGroupFull}>
                  <label>Observaciones</label>
                  <textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} placeholder="Notas adicionales..." rows={2} />
                </div>
              </div>

              {form.pagado_por === 'responsable' && (
                <div className={styles.alertaCompensacion}>
                  Este gasto quedará pendiente de compensación al responsable.
                </div>
              )}

              <div className={styles.formBtns}>
                <button type="button" className={styles.btnCancel} onClick={cerrarModal}>Cancelar</button>
                <button type="submit" className={styles.btnSave} disabled={guardando}>
                  {guardando ? 'Guardando...' : editandoId ? 'Actualizar' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nueva Obra */}
      {modalObra && (
        <div className={styles.modalOverlay} onClick={() => setModalObra(false)}>
          <div className={`${styles.modal} ${styles.modalSm}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Nueva obra</div>
              <button className={styles.modalClose} onClick={() => setModalObra(false)}>✕</button>
            </div>
            <form onSubmit={crearObra}>
              <div className={styles.formGrid}>
                <div className={styles.formGroupFull}>
                  <label>Nombre de la obra *</label>
                  <input type="text" required value={nuevaObra.nombre} onChange={e => setNuevaObra({ ...nuevaObra, nombre: e.target.value })} placeholder="Ej: Residencial Los Pinos" />
                </div>
                <div className={styles.formGroupFull}>
                  <label>Ubicación</label>
                  <input type="text" value={nuevaObra.ubicacion} onChange={e => setNuevaObra({ ...nuevaObra, ubicacion: e.target.value })} placeholder="Distrito, dirección..." />
                </div>
              </div>
              <div className={styles.formBtns}>
                <button type="button" className={styles.btnCancel} onClick={() => setModalObra(false)}>Cancelar</button>
                <button type="submit" className={styles.btnSave}>Crear obra</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}