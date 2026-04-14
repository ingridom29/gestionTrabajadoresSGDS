import { useEffect, useState } from "react";
import { supabase } from "../../supabase/client";
import styles from "../../styles/proyectos/DetalleProyecto.module.css";

export default function DetalleProyecto({ proyectoId, onVolver }) {
  const [obra, setObra] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para el Modal de Edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({});

  // Estados para el Modal de Nueva Factura
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [facturaData, setFacturaData] = useState({
    numero: '',
    fecha_vencimiento: '',
    monto: ''
  });

  useEffect(() => {
    if (proyectoId) fetchDatosCompletos();
  }, [proyectoId]);

  const fetchDatosCompletos = async () => {
    setLoading(true);
    try {
      const { data: obraData, error: obraError } = await supabase
        .from("obras")
        .select(`*, facturas_obra (*)`)
        .eq("id", proyectoId)
        .single();

      if (obraError) throw obraError;

      const { data: gastosData, error: gastosError } = await supabase
        .from("gastos_obra")
        .select("*")
        .eq("obra_id", proyectoId)
        .order('fecha', { ascending: false });

      if (gastosError) {
        console.error("Error cargando gastos:", gastosError);
        console.error("Detalles del error:", gastosError.message, gastosError.details, gastosError.hint);
      }

      setObra(obraData);
      setEditData(obraData);
      setGastos(gastosData || []);
    } catch (error) {
      console.error("Error general:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("obras")
      .update({
        nombre: editData.nombre,
        cliente: editData.cliente,
        presupuesto: parseFloat(editData.presupuesto),
        descripcion: editData.descripcion,
        estado: editData.estado
      })
      .eq("id", proyectoId);

    if (error) {
      alert("Error al actualizar: " + error.message);
    } else {
      setShowEditModal(false);
      fetchDatosCompletos();
    }
  };

  const calcularEstadoFactura = (factura) => {
    if (factura.estado === 'pagada') return 'pagada';
    if (factura.estado === 'anulada') return 'anulada';
    
    const hoy = new Date();
    const fechaVencimiento = new Date(factura.fecha_vencimiento);
    
    if (fechaVencimiento < hoy) {
      return 'vencida';
    }
    
    return 'pendiente';
  };

  const marcarComoPagado = async (facturaId) => {
    const { error: errorPago } = await supabase
      .from("facturas_obra")
      .update({ estado: 'pagada' })
      .eq("id", facturaId);

    if (errorPago) {
      alert("Error al marcar como pagado: " + errorPago.message);
    } else {
      fetchDatosCompletos();
    }
  };

  const mostrarEstadoFactura = (factura) => {
    const estado = calcularEstadoFactura(factura);
    return estado.charAt(0).toUpperCase() + estado.slice(1);
  };

  const handleFacturaSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("facturas_obra")
      .insert({
        obra_id: proyectoId,
        numero: facturaData.numero,
        fecha_vencimiento: facturaData.fecha_vencimiento,
        monto: parseFloat(facturaData.monto),
        estado: 'pendiente'
      });

    if (error) {
      alert("Error al crear factura: " + error.message);
    } else {
      setShowFacturaModal(false);
      setFacturaData({
        numero: '',
        fecha_vencimiento: '',
        monto: ''
      });
      fetchDatosCompletos();
    }
  };

  if (loading) return <div className={styles.loader}>Cargando panel de control...</div>;
  if (!obra) return <div className={styles.loader}>No se encontró la información del proyecto.</div>;

  const totalMontoFacturado = obra.facturas_obra?.reduce((acc, f) => acc + (parseFloat(f.monto) || 0), 0) || 0;
  const totalAvanceFacturado = obra.presupuesto > 0 ? (totalMontoFacturado / obra.presupuesto) * 100 : 0;
  const montoFacturadoSoles = totalMontoFacturado;
  const totalGastosEgresos = gastos.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
  const utilidadReal = montoFacturadoSoles - totalGastosEgresos;

  return (
    <div className={styles.wrap}>
      <header className={styles.headerDetail}>
        <button onClick={onVolver} className={styles.btnBack}>← Volver a la lista</button>
        <div className={styles.titleRow}>
          <div>
            <h1>{obra.nombre}</h1>
            <span className={styles.clienteBadge}>{obra.cliente || 'Cliente General'}</span>
          </div>
          <button className={styles.btnEditar} onClick={() => setShowEditModal(true)}>
             Editar Proyecto
          </button>
        </div>
      </header>

      {/* DASHBOARD DE MÉTRICAS */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Presupuesto Total</span>
          <span className={styles.statValue}>S/ {obra.presupuesto?.toLocaleString()}</span>
          <div className={styles.miniBar}><div style={{ width: '100%' }} /></div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Avance Facturado ({totalAvanceFacturado}%)</span>
          <span className={styles.statValue}>S/ {montoFacturadoSoles.toLocaleString()}</span>
          <div className={styles.miniBar}><div style={{ width: `${totalAvanceFacturado}%` }} /></div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Gastos Operativos</span>
          <span className={`${styles.statValue} ${styles.danger}`}>S/ {totalGastosEgresos.toLocaleString()}</span>
          <div className={styles.miniBar}>
            <div style={{ 
              width: `${Math.min((totalGastosEgresos / (obra.presupuesto || 1)) * 100, 100)}%`, 
              background: '#e11d48' 
            }} />
          </div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        {/* SECCIÓN DE FACTURACIÓN */}
        <section className={styles.sectionFacturas}>
          <div className={styles.sectionHeader}>
            <h3>Historial de Facturación</h3>
            <button className={styles.btnAccion} onClick={() => setShowFacturaModal(true)}>+ Nueva Factura</button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>N° Factura</th>
                <th>Vencimiento</th>
                <th>Avance</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {obra.facturas_obra?.length > 0 ? (
                obra.facturas_obra.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.numero}</strong></td>
                    <td>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString() : '-'}</td>
                    <td>{obra.presupuesto > 0 ? ((f.monto / obra.presupuesto) * 100).toFixed(1) : 0}%</td>
                    <td>S/ {f.monto?.toLocaleString()}</td>
                    <td>
                      <span className={`${styles.pill} ${styles[calcularEstadoFactura(f)]}`}>
                        {mostrarEstadoFactura(f)}
                      </span>
                      {!['pagada', 'anulada'].includes(calcularEstadoFactura(f)) && (
                        <button 
                          className={styles.btnMarcarPagado}
                          onClick={() => marcarComoPagado(f.id)}
                          title="Marcar como pagado"
                        >
                          ✓
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" className={styles.empty}>No hay facturas registradas.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        {/* SECCIÓN DE GASTOS Y UTILIDAD */}
        <section className={styles.sectionGastos}>
          <div className={styles.sectionHeader}>
            <h3>Gastos de Campo / Operativos</h3>
            <div className={styles.utilidadLabel}>Utilidad: S/ {utilidadReal.toLocaleString()}</div>
          </div>
          <div className={styles.gastosList}>
            {gastos.length > 0 ? (
              gastos.map(g => (
                <div key={g.id} className={styles.gastoItem}>
                  <div className={styles.gastoInfo}>
                    <span className={styles.gastoDesc}>{g.descripcion}</span>
                    <span className={styles.gastoFecha}>{new Date(g.fecha).toLocaleDateString()}</span>
                  </div>
                  <span className={styles.gastoMonto}>- S/ {g.monto}</span>
                </div>
              ))
            ) : (
              <p className={styles.empty}>No hay gastos registrados para esta obra.</p>
            )}
          </div>
        </section>
      </div>

      {/* MODAL DE EDICIÓN */}
      {showEditModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Configuración de Proyecto</h3>
              <button className={styles.btnClose} onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpdate} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nombre de la Obra</label>
                <input 
                  value={editData.nombre} 
                  onChange={(e) => setEditData({...editData, nombre: e.target.value})} 
                  required 
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Cliente</label>
                <input 
                  value={editData.cliente} 
                  onChange={(e) => setEditData({...editData, cliente: e.target.value})} 
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Presupuesto (S/)</label>
                <input 
                  type="number" 
                  value={editData.presupuesto} 
                  onChange={(e) => setEditData({...editData, presupuesto: e.target.value})} 
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Estado actual</label>
                <select 
                  value={editData.estado} 
                  onChange={(e) => setEditData({...editData, estado: e.target.value})}
                  className={styles.select}
                >
                  <option value="activa">ACTIVA</option>
                  <option value="finalizada">FINALIZADA</option>
                  <option value="pausada">PAUSADA</option>
                </select>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnCancelar} onClick={() => setShowEditModal(false)}>Cancelar</button>
                <button type="submit" className={styles.btnGuardar}>Actualizar Proyecto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE NUEVA FACTURA */}
      {showFacturaModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Nueva Factura</h3>
              <button className={styles.btnClose} onClick={() => setShowFacturaModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleFacturaSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Número de Factura</label>
                <input
                  value={facturaData.numero}
                  onChange={(e) => setFacturaData({...facturaData, numero: e.target.value})}
                  required
                  placeholder="Ej: F001-2024"
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Fecha de Vencimiento</label>
                <input
                  type="date"
                  value={facturaData.fecha_vencimiento}
                  onChange={(e) => setFacturaData({...facturaData, fecha_vencimiento: e.target.value})}
                  required
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Monto (S/)</label>
                <input
                  type="number"
                  step="0.01"
                  value={facturaData.monto}
                  onChange={(e) => setFacturaData({...facturaData, monto: e.target.value})}
                  required
                  placeholder="Ej: 15000.00"
                  className={styles.input}
                />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnCancelar} onClick={() => setShowFacturaModal(false)}>Cancelar</button>
                <button type="submit" className={styles.btnGuardar}>Crear Factura</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}