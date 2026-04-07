import { useState, useEffect } from 'react';
import { supabase } from '../../../supabase/client';
import styles from '../../../styles/gastos/GastosPersonales.module.css';
import ImportarGastosGmail from './ImportarGastosGmail';

const CATEGORIAS = [
  'Útiles de oficina', 'Alimentación', 'Movilidad', 'Transporte / Flete',
  'Servicios / Internet', 'Combustible', 'Materiales', 'Herramientas',
  'Planilla', 'Otros',
];
const CATEGORIAS_OBRA = [
  'Materiales', 'Herramientas', 'Transporte / Flete',
  'Mano de obra externa', 'Alimentación', 'Combustible', 'Planilla', 'Otros',
];
const CUENTAS_EMPRESA = ['Interbank', 'Efectivo caja'];

const FORM_INICIAL = {
  fecha: new Date().toISOString().split('T')[0],
  quien: 'asistenta',
  cuenta_bancaria: '',
  categoria: '',
  descripcion: '',
  monto: '',
  comprobante: '',
};
const FORM_OBRA_INICIAL = {
  obra_id: '',
  categoria_obra: '',
  descripcion_obra: '',
  responsable: '',
};

const IconPlus  = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
const IconEdit  = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconTrash = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconObra  = () => <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 13h12M4 13V7l4-4 4 4v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="6" y="10" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.4"/></svg>;

export default function GastosPersonales() {
  const [gastos,        setGastos]        = useState([]);
  const [obras,         setObras]         = useState([]);
  const [empleados,     setEmpleados]     = useState([]);
  const [form,          setForm]          = useState(FORM_INICIAL);
  const [formObra,      setFormObra]      = useState(FORM_OBRA_INICIAL);
  const [esGastoObra,   setEsGastoObra]   = useState(false);
  const [modalAbierto,  setModalAbierto]  = useState(false);
  const [cargando,      setCargando]      = useState(true);
  const [guardando,     setGuardando]     = useState(false);
  const [subTab,        setSubTab]        = useState('principal'); // 'principal' | 'empresa'
  const [filtroQuien,   setFiltroQuien]   = useState('');
  const [filtroCat,     setFiltroCat]     = useState('');
  const [fechaDesde,    setFechaDesde]    = useState('');
  const [fechaHasta,    setFechaHasta]    = useState('');
  const [editandoId,    setEditandoId]    = useState(null);

  useEffect(() => { cargarTodo(); }, []);

  async function cargarTodo() {
    setCargando(true);
    const [{ data: g }, { data: o }, { data: e }] = await Promise.all([
      supabase.from('gastos_personales').select('*, gastos_obra(id, obras(nombre))').order('fecha', { ascending: false }),
      supabase.from('obras').select('*').order('nombre'),
      supabase.from('empleados').select('id, nombres').order('nombres'),
    ]);
    setGastos(g || []);
    setObras(o || []);
    setEmpleados(e || []);
    setCargando(false);
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);

    let gastoObraId = null;
    const esCuentaEmpresa = subTab === 'empresa';

    if ((form.quien === 'gerenta' || esCuentaEmpresa) && esGastoObra) {
      const { data: obraData } = await supabase.from('gastos_obra').insert({
        obra_id:       formObra.obra_id || null,
        fecha:         form.fecha,
        categoria:     formObra.categoria_obra,
        descripcion:   formObra.descripcion_obra || form.descripcion,
        monto:         parseFloat(form.monto),
        comprobante:   form.comprobante,
        responsable:   formObra.responsable || (esCuentaEmpresa ? 'Empresa' : 'Gerenta'),
        pagado_por:    'empresa',
        compensado:    false,
        observaciones: `Desde Gastos ${esCuentaEmpresa ? 'Empresa' : 'Personales'} — ${form.cuenta_bancaria}`,
      }).select().single();
      gastoObraId = obraData?.id || null;
    }

    const payload = {
      ...form,
      monto:         parseFloat(form.monto),
      tipo_cuenta:   subTab,
      categoria:     esGastoObra ? formObra.categoria_obra : form.categoria,
      gasto_obra_id: gastoObraId,
    };

    if (editandoId) {
      await supabase.from('gastos_personales').update(payload).eq('id', editandoId);
    } else {
      await supabase.from('gastos_personales').insert(payload);
    }

    setGuardando(false);
    cerrarModal();
    cargarTodo();
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    await supabase.from('gastos_personales').delete().eq('id', id);
    cargarTodo();
  }

  function abrirEditar(g) {
    setForm({
      fecha:           g.fecha,
      quien:           g.quien,
      cuenta_bancaria: g.cuenta_bancaria,
      categoria:       g.categoria,
      descripcion:     g.descripcion || '',
      monto:           g.monto,
      comprobante:     g.comprobante || '',
    });
    setFormObra(FORM_OBRA_INICIAL);
    setEsGastoObra(false);
    setEditandoId(g.id);
    setModalAbierto(true);
  }

  function abrirNuevo() {
    setForm({
      ...FORM_INICIAL,
      quien: subTab === 'empresa' ? 'gerenta' : 'asistenta',
      cuenta_bancaria: subTab === 'empresa' ? 'Interbank' : '',
    });
    setFormObra(FORM_OBRA_INICIAL);
    setEsGastoObra(false);
    setEditandoId(null);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setForm(FORM_INICIAL);
    setFormObra(FORM_OBRA_INICIAL);
    setEsGastoObra(false);
    setEditandoId(null);
  }

  function handleQuienChange(valor) {
    setForm(f => ({ ...f, quien: valor }));
    if (valor !== 'gerenta') setEsGastoObra(false);
  }

  // Filtrar por sub-tab + filtros adicionales
  const gastosPorTab = gastos.filter(g =>
    subTab === 'principal'
      ? (!g.tipo_cuenta || g.tipo_cuenta === 'principal')
      : g.tipo_cuenta === 'empresa'
  );

  const gastosFiltrados = gastosPorTab.filter(g => {
    if (filtroQuien && g.quien !== filtroQuien) return false;
    if (filtroCat   && g.categoria !== filtroCat) return false;
    if (fechaDesde  && g.fecha < fechaDesde) return false;
    if (fechaHasta  && g.fecha > fechaHasta) return false;
    return true;
  });

  // KPIs reactivos a los filtros activos
  const totalFiltrado  = gastosFiltrados.reduce((a, g) => a + Number(g.monto), 0);
  const totalGerenta   = gastosFiltrados.filter(g => g.quien === 'gerenta').reduce((a, g) => a + Number(g.monto), 0);
  const totalAsistenta = gastosFiltrados.filter(g => g.quien === 'asistenta').reduce((a, g) => a + Number(g.monto), 0);
  const totalObra      = gastosFiltrados.filter(g => g.gasto_obra_id).reduce((a, g) => a + Number(g.monto), 0);

  const fmt     = n => Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2 });
  const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('es-PE');

  const mostrarCamposBase = !esGastoObra || (form.quien !== 'gerenta' && subTab !== 'empresa');
  const puedeVincularObra = form.quien === 'gerenta' || subTab === 'empresa';

  return (
    <>
      {/* Sub-tabs Cuenta Principal / Cuenta Empresa */}
      <div className={styles.subTabs}>
        <button
          className={`${styles.subTab} ${subTab === 'principal' ? styles.subTabActivo : ''}`}
          onClick={() => { setSubTab('principal'); setFiltroQuien(''); setFiltroCat(''); setFechaDesde(''); setFechaHasta(''); }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="4" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M1 7h14M5 10h2M10 10h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Cuenta Principal
          <span className={styles.subTabBadge}>BCP / Yape</span>
        </button>
        <button
          className={`${styles.subTab} ${subTab === 'empresa' ? styles.subTabActivo : ''}`}
          onClick={() => { setSubTab('empresa'); setFiltroQuien(''); setFiltroCat(''); setFechaDesde(''); setFechaHasta(''); }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 13h12M4 13V7l4-4 4 4v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="6" y="10" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.4"/>
          </svg>
          Cuenta Empresa
          <span className={styles.subTabBadge}>Interbank</span>
        </button>
      </div>

      {/* Importar Gmail solo en Cuenta Principal */}
      {subTab === 'principal' && <ImportarGastosGmail onImportado={cargarTodo} />}

      {/* KPIs — reactivos a filtros */}
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Total filtrado</div>
          <div className={styles.kpiVal}>S/ {fmt(totalFiltrado)}</div>
          <div className={styles.kpiSub}>{gastosFiltrados.length} registros</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Gerenta</div>
          <div className={styles.kpiVal}>S/ {fmt(totalGerenta)}</div>
          <div className={styles.kpiSub}>{gastosFiltrados.filter(g => g.quien === 'gerenta').length} registros</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Asistenta</div>
          <div className={styles.kpiVal}>S/ {fmt(totalAsistenta)}</div>
          <div className={styles.kpiSub}>{gastosFiltrados.filter(g => g.quien === 'asistenta').length} registros</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Vinculados a obra</div>
          <div className={styles.kpiVal}>S/ {fmt(totalObra)}</div>
          <div className={styles.kpiSub}>{gastosFiltrados.filter(g => g.gasto_obra_id).length} registros</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        {/* Filtros quien — solo en cuenta principal */}
        {subTab === 'principal' && [
          { val: '', label: 'Todos' },
          { val: 'gerenta', label: 'Gerenta' },
          { val: 'asistenta', label: 'Asistenta' },
        ].map(({ val, label }) => (
          <button
            key={val}
            className={`${styles.filterBtn} ${filtroQuien === val ? styles.filterActive : ''}`}
            onClick={() => setFiltroQuien(val)}
          >
            {label}
          </button>
        ))}

        {/* Filtro categoría */}
        <select className={styles.select} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className={styles.spacer} />

        {/* Filtro fechas */}
        <input type="date" className={styles.inputFecha} value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} title="Desde" />
        <span className={styles.fechaSep}>—</span>
        <input type="date" className={styles.inputFecha} value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} title="Hasta" />
        {(fechaDesde || fechaHasta) && (
          <button className={styles.btnLimpiarFecha} onClick={() => { setFechaDesde(''); setFechaHasta(''); }} title="Limpiar fechas">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        )}

        <button className={styles.btnPrimario} onClick={abrirNuevo}>
          <IconPlus /> Registrar gasto
        </button>
      </div>

      {/* Tabla */}
      {cargando ? (
        <div className={styles.loadingMsg}>Cargando...</div>
      ) : gastosFiltrados.length === 0 ? (
        <div className={styles.emptyMsg}>No hay gastos registrados</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Fecha</th>
                {subTab === 'principal' && <th>Quién</th>}
                <th>Cuenta</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Comprobante</th>
                <th>Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gastosFiltrados.map(g => {
                const vinculadoObra = !!g.gasto_obra_id;
                const nombreObra    = g.gastos_obra?.obras?.nombre;
                return (
                  <tr key={g.id} className={vinculadoObra ? styles.filaObra : ''}>
                    <td>{fmtDate(g.fecha)}</td>
                    {subTab === 'principal' && (
                      <td>
                        <span className={`${styles.quien} ${g.quien === 'gerenta' ? styles.quienGerenta : styles.quienAsistenta}`}>
                          {g.quien === 'gerenta' ? 'Gerenta' : 'Asistenta'}
                        </span>
                      </td>
                    )}
                    <td><span className={styles.badge}>{g.cuenta_bancaria}</span></td>
                    <td>
                      <div className={styles.categoriaCell}>
                        {g.categoria}
                        {vinculadoObra && (
                          <span className={styles.badgeObra} title={nombreObra ? `Obra: ${nombreObra}` : 'Gasto de obra'}>
                            <IconObra /> {nombreObra || 'Obra'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{g.descripcion || '—'}</td>
                    <td>{g.comprobante || '—'}</td>
                    <td className={styles.monto}>S/ {fmt(g.monto)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.actBtn} onClick={() => abrirEditar(g)} title="Editar"><IconEdit /></button>
                        <button className={`${styles.actBtn} ${styles.actBtnDanger}`} onClick={() => eliminar(g.id)} title="Eliminar"><IconTrash /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className={styles.tableFooter}>
            {gastosFiltrados.length} registros · Total: S/ {fmt(totalFiltrado)}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalAbierto && (
        <div className={styles.modalOverlay} onClick={cerrarModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                {editandoId ? 'Editar gasto' : `Registrar gasto — ${subTab === 'empresa' ? 'Cuenta Empresa' : 'Cuenta Principal'}`}
              </div>
              <button className={styles.modalClose} onClick={cerrarModal}>✕</button>
            </div>

            <form onSubmit={guardar}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Fecha *</label>
                  <input type="date" required value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                </div>

                {/* Quien — solo en cuenta principal */}
                {subTab === 'principal' && (
                  <div className={styles.formGroup}>
                    <label>¿Quién gastó? *</label>
                    <select required value={form.quien} onChange={e => handleQuienChange(e.target.value)}>
                      <option value="gerenta">Gerenta</option>
                      <option value="asistenta">Asistenta (Ingrid)</option>
                    </select>
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label>Cuenta *</label>
                  {subTab === 'empresa' ? (
                    <select required value={form.cuenta_bancaria} onChange={e => setForm({ ...form, cuenta_bancaria: e.target.value })}>
                      <option value="">Seleccionar...</option>
                      {CUENTAS_EMPRESA.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={form.cuenta_bancaria} readOnly className={styles.inputReadonly} placeholder="Se completa al importar" />
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label>Monto (S/) *</label>
                  <input type="number" step="0.01" min="0" required value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0.00" />
                </div>

                {/* Categoría y descripción solo si NO es modo obra */}
                {mostrarCamposBase && (
                  <>
                    <div className={styles.formGroup}>
                      <label>Categoría *</label>
                      <select required value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                        <option value="">Seleccionar...</option>
                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label>N° Comprobante</label>
                      <input type="text" value={form.comprobante} onChange={e => setForm({ ...form, comprobante: e.target.value })} placeholder="Boleta, factura..." />
                    </div>
                    <div className={styles.formGroupFull}>
                      <label>Descripción</label>
                      <input type="text" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalle del gasto..." />
                    </div>
                  </>
                )}

                {!mostrarCamposBase && (
                  <div className={styles.formGroup}>
                    <label>N° Comprobante</label>
                    <input type="text" value={form.comprobante} onChange={e => setForm({ ...form, comprobante: e.target.value })} placeholder="Boleta, factura..." />
                  </div>
                )}
              </div>

              {/* Toggle ¿Es gasto de obra? — Gerenta o Cuenta Empresa */}
              {puedeVincularObra && (
                <div className={styles.obraSeccion}>
                  <div className={styles.obraToggleRow}>
                    <div className={styles.obraToggleTexto}>
                      <div className={styles.obraToggleTitulo}>¿Este gasto corresponde a una obra?</div>
                      <div className={styles.obraToggleSub}>Se registrará también en Gastos por Obra</div>
                    </div>
                    <div className={styles.toggleBtns}>
                      <button type="button" className={`${styles.toggleBtn} ${esGastoObra ? styles.toggleBtnActivo : ''}`} onClick={() => setEsGastoObra(true)}>Sí</button>
                      <button type="button" className={`${styles.toggleBtn} ${!esGastoObra ? styles.toggleBtnActivo : ''}`} onClick={() => setEsGastoObra(false)}>No</button>
                    </div>
                  </div>

                  {esGastoObra && (
                    <div className={styles.obraDetalle}>
                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <label>Obra</label>
                          <select value={formObra.obra_id} onChange={e => setFormObra({ ...formObra, obra_id: e.target.value })}>
                            <option value="">Sin obra asignada</option>
                            {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                          </select>
                        </div>
                        <div className={styles.formGroup}>
                          <label>Categoría de obra *</label>
                          <select required value={formObra.categoria_obra} onChange={e => setFormObra({ ...formObra, categoria_obra: e.target.value })}>
                            <option value="">Seleccionar...</option>
                            {CATEGORIAS_OBRA.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className={styles.formGroup}>
                          <label>Responsable</label>
                          <select value={formObra.responsable} onChange={e => setFormObra({ ...formObra, responsable: e.target.value })}>
                            <option value="">Seleccionar...</option>
                            {empleados.map(emp => <option key={emp.id} value={emp.nombres}>{emp.nombres}</option>)}
                          </select>
                        </div>
                        <div className={styles.formGroupFull}>
                          <label>¿Qué se compró o pagó para esta obra?</label>
                          <input type="text" value={formObra.descripcion_obra} onChange={e => setFormObra({ ...formObra, descripcion_obra: e.target.value })} placeholder="Ej: Compra de cemento, pago de transporte..." />
                        </div>
                      </div>
                    </div>
                  )}
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
    </>
  );
}