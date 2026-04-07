import { useState, useEffect } from 'react';
import { supabase } from '../../../supabase/client';
import styles from '../../../styles/gastos/Compensaciones.module.css';

const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconUndo = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M3 8a5 5 0 105-5H5M3 8V4M3 8H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconAlert = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M8 7v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

export default function Compensaciones() {
  const [pendientes, setPendientes]   = useState([]);
  const [compensados, setCompensados] = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [vista, setVista]             = useState('pendientes');

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setCargando(true);
    const { data } = await supabase
      .from('gastos_obra')
      .select('*, obras(nombre)')
      .eq('pagado_por', 'responsable')
      .order('fecha', { ascending: false });
    const todos = data || [];
    setPendientes(todos.filter(g => !g.compensado));
    setCompensados(todos.filter(g => g.compensado));
    setCargando(false);
  }

  async function marcarCompensado(id) {
    await supabase.from('gastos_obra').update({
      compensado: true,
      fecha_compensacion: new Date().toISOString().split('T')[0],
    }).eq('id', id);
    cargarDatos();
  }

  async function desmarcarCompensado(id) {
    await supabase.from('gastos_obra').update({ compensado: false, fecha_compensacion: null }).eq('id', id);
    cargarDatos();
  }

  const totalPendiente = pendientes.reduce((a, g) => a + Number(g.monto), 0);
  const fmt     = n => Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2 });
  const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('es-PE');

  const porResponsable = pendientes.reduce((acc, g) => {
    if (!acc[g.responsable]) acc[g.responsable] = { gastos: [], total: 0 };
    acc[g.responsable].gastos.push(g);
    acc[g.responsable].total += Number(g.monto);
    return acc;
  }, {});

  return (
    <>
      {totalPendiente > 0 && (
        <div className={styles.alertaBanner}>
          <span className={styles.alertaIcono}><IconAlert /></span>
          <span className={styles.alertaBannerTexto}>
            <strong>S/ {fmt(totalPendiente)}</strong> pendientes de compensar
            <span className={styles.alertaBannerSub}> — {pendientes.length} gasto{pendientes.length !== 1 ? 's' : ''} pagado{pendientes.length !== 1 ? 's' : ''} por responsables</span>
          </span>
        </div>
      )}

      <div className={styles.subtabs}>
        <button className={`${styles.subtab} ${vista === 'pendientes' ? styles.subtabActivo : ''}`} onClick={() => setVista('pendientes')}>
          Pendientes ({pendientes.length})
        </button>
        <button className={`${styles.subtab} ${vista === 'compensados' ? styles.subtabActivo : ''}`} onClick={() => setVista('compensados')}>
          Compensados ({compensados.length})
        </button>
        <button className={`${styles.subtab} ${vista === 'resumen' ? styles.subtabActivo : ''}`} onClick={() => setVista('resumen')}>
          Por responsable
        </button>
      </div>

      {cargando ? (
        <div className={styles.loadingMsg}>Cargando compensaciones...</div>
      ) : (
        <>
          {/* Pendientes */}
          {vista === 'pendientes' && (
            pendientes.length === 0 ? (
              <div className={styles.emptyMsg}>Sin compensaciones pendientes</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.tbl}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Responsable</th>
                      <th>Obra</th>
                      <th>Categoría</th>
                      <th>Descripción</th>
                      <th>Monto</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendientes.map(g => (
                      <tr key={g.id}>
                        <td>{fmtDate(g.fecha)}</td>
                        <td><strong>{g.responsable}</strong></td>
                        <td>{g.obras?.nombre || '—'}</td>
                        <td><span className={styles.badge}>{g.categoria}</span></td>
                        <td>{g.descripcion || '—'}</td>
                        <td className={styles.monto}>S/ {fmt(g.monto)}</td>
                        <td>
                          <button className={styles.btnCompensar} onClick={() => marcarCompensado(g.id)}>
                            <IconCheck /> Compensar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} className={styles.totalLabel}>Total a compensar</td>
                      <td className={styles.totalValor}>S/ {fmt(totalPendiente)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}

          {/* Compensados */}
          {vista === 'compensados' && (
            compensados.length === 0 ? (
              <div className={styles.emptyMsg}>Aún no hay compensaciones realizadas</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.tbl}>
                  <thead>
                    <tr>
                      <th>Fecha gasto</th>
                      <th>Fecha compensación</th>
                      <th>Responsable</th>
                      <th>Obra</th>
                      <th>Descripción</th>
                      <th>Monto</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {compensados.map(g => (
                      <tr key={g.id} className={styles.filaCompensada}>
                        <td>{fmtDate(g.fecha)}</td>
                        <td>{g.fecha_compensacion ? fmtDate(g.fecha_compensacion) : '—'}</td>
                        <td>{g.responsable}</td>
                        <td>{g.obras?.nombre || '—'}</td>
                        <td>{g.descripcion || '—'}</td>
                        <td className={styles.monto}>S/ {fmt(g.monto)}</td>
                        <td>
                          <button className={styles.btnDeshacer} onClick={() => desmarcarCompensado(g.id)} title="Deshacer compensación">
                            <IconUndo /> Deshacer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Por responsable */}
          {vista === 'resumen' && (
            Object.keys(porResponsable).length === 0 ? (
              <div className={styles.emptyMsg}>Sin compensaciones pendientes por responsable</div>
            ) : (
              <div className={styles.tarjetasGrid}>
                {Object.entries(porResponsable).map(([nombre, data]) => (
                  <div key={nombre} className={styles.tarjetaResponsable}>
                    <div className={styles.tarjetaHeader}>
                      <span className={styles.tarjetaNombre}>{nombre}</span>
                      <span className={styles.tarjetaTotal}>S/ {fmt(data.total)}</span>
                    </div>
                    <div className={styles.tarjetaDetalle}>
                      {data.gastos.map(g => (
                        <div key={g.id} className={styles.tarjetaFila}>
                          <div className={styles.tarjetaInfo}>
                            <span className={styles.tarjetaFecha}>{fmtDate(g.fecha)}</span>
                            <span className={styles.tarjetaDesc}>{g.descripcion || g.categoria}</span>
                            {g.obras && <span className={styles.tarjetaObra}>{g.obras.nombre}</span>}
                          </div>
                          <span className={styles.tarjetaMonto}>S/ {fmt(g.monto)}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      className={styles.btnCompensarTodo}
                      onClick={async () => {
                        if (!confirm(`¿Compensar todos los gastos de ${nombre}?`)) return;
                        for (const g of data.gastos) await marcarCompensado(g.id);
                      }}
                    >
                      Compensar todo ({data.gastos.length} gastos)
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </>
  );
}