import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase/client';
import styles from '../../styles/empleados/Asistencia.module.css';
import * as XLSX from 'xlsx';

// ── Constantes de horario ─────────────────────────────────────────────────────
const HORA_PUNTUAL = '08:30'; // hasta aquí = puntual
const HORA_TARDE   = '09:30'; // hasta aquí = tarde sin descuento
const HORA_LIMITE  = '11:00'; // después = descuento por tardanza

// ── Helpers ───────────────────────────────────────────────────────────────────
function parsearFecha(str) {
  if (!str && str !== 0) return null;
  // Excel guarda fechas como número serial (ej: 46921 = 31/03/2026)
  if (typeof str === 'number') {
    const epoch = new Date(1899, 11, 30);
    const fecha = new Date(epoch.getTime() + str * 86400000);
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(str);
  // Soporta DD/MM/YYYY
  if (s.includes('/')) {
    const partes = s.split('/');
    if (partes.length === 3) {
      const [d, m, y] = partes;
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
  }
  // Soporta YYYY-MM-DD
  return s.split('T')[0];
}

function parsearHora(str) {
  if (!str && str !== 0) return null;
  // Si viene como número (decimal de Excel)
  if (typeof str === 'number') {
    // Si es mayor a 1 significa que tiene fecha+hora combinadas, extraer solo parte decimal
    const fraccion = str % 1;
    const totalSeg = Math.round(fraccion * 86400);
    const hh = Math.floor(totalSeg / 3600);
    const mm = Math.floor((totalSeg % 3600) / 60);
    const ss = totalSeg % 60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }
  // Si viene como texto: "7:27:08" o "07:27:08" o "17:52:10"
  const s = String(str).trim();
  // Verificar que tiene formato HH:MM o HH:MM:SS
  const partes = s.split(':');
  if (partes.length < 2) return null;
  const hh = partes[0].padStart(2,'0');
  const mm = partes[1].padStart(2,'0');
  const ss = (partes[2] || '00').padStart(2,'0');
  // Validar que son números válidos
  if (isNaN(parseInt(hh)) || isNaN(parseInt(mm))) return null;
  return `${hh}:${mm}:${ss}`;
}

function calcularEstado(hora) {
  if (!hora) return 'sin_registro';
  const hhmm = hora.substring(0, 5);
  if (hhmm <= HORA_PUNTUAL) return 'puntual';
  if (hhmm <= HORA_TARDE)   return 'tarde';
  if (hhmm <= HORA_LIMITE)  return 'muy_tarde';
  return 'muy_tarde';
}

function esDiaLaboral(fechaStr) {
  const d = new Date(fechaStr + 'T00:00:00');
  const dia = d.getDay(); // 0=dom, 6=sab
  return dia >= 1 && dia <= 6; // lunes a sábado
}

function calcularDescuento(sueldo, faltasEnPeriodo) {
  const salarioDiario = Number(sueldo) / 30;
  return salarioDiario * faltasEnPeriodo;
}

function fmtFecha(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtMoneda(n) {
  return `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Asistencia() {
  const [vista,        setVista]        = useState('registro');   // 'registro' | 'resumen'
  const [asistencias,  setAsistencias]  = useState([]);
  const [empleados,    setEmpleados]    = useState([]);
  const [cargando,     setCargando]     = useState(true);
  const [subiendo,     setSubiendo]     = useState(false);
  const [filtroFecha,  setFiltroFecha]  = useState('');
  const [filtroObra,   setFiltroObra]   = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroDni,    setFiltroDni]    = useState('');
  const [preview,      setPreview]      = useState(null); // filas del Excel antes de guardar
  const [erroresUpload,setErroresUpload]= useState([]);
  const inputRef = useRef();

  useEffect(() => { cargarTodo(); }, []);

  async function cargarTodo() {
    setCargando(true);
    const [{ data: a }, { data: e }] = await Promise.all([
      supabase.from('asistencia').select('*').order('fecha', { ascending: false }).order('hora', { ascending: true }),
      supabase.from('empleados').select('id, nombres, dni, sueldo, cargo').order('nombres'),
    ]);
    setAsistencias(a || []);
    setEmpleados(e || []);
    setCargando(false);
  }

  // ── Procesar Excel ──────────────────────────────────────────────────────────
  function procesarExcel(e) {
    const file = e.target.files[0];
    if (!file) return;
    setErroresUpload([]);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'binary', cellDates: false });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const filas = [];
        const errores = [];

        rows.forEach((row, i) => {
          const fecha = parsearFecha(row['Fecha'] || row['fecha']);
          const hora  = parsearHora(row['Hora']  || row['hora']);
          const dni   = String(row['DNI'] || row['dni'] || '').trim();

          if (!fecha || !hora || !dni) {
            errores.push(`Fila ${i + 2}: datos incompletos (fecha, hora o DNI faltante)`);
            return;
          }

          // Buscar empleado por DNI
          const emp = empleados.find(e => String(e.dni).trim() === dni);
          const estado = calcularEstado(hora);

          filas.push({
            fecha,
            hora,
            tipo:             String(row['Tipo'] || row['tipo'] || 'INGRESO').toUpperCase(),
            dni,
            nombre_completo:  row['Nombre Completo'] || row['nombre_completo'] || emp?.nombres || '',
            obra:             row['Obra'] || row['obra'] || '',
            lat:              row['lat'] ? parseFloat(String(row['lat']).replace(',', '.')) : null,
            lng:              row['lng'] ? parseFloat(String(row['lng']).replace(',', '.')) : null,
            coords:           row['coords'] || '',
            accuracy_m:       row['accuracy_m'] ? parseFloat(String(row['accuracy_m']).replace(',', '.')) : null,
            user_agent:       row['userAgent'] || row['user_agent'] || '',
            cumple_direccion: row['Cumple dirección'] || row['cumple_direccion'] || '',
            estado,
            empleado_id:      emp?.id || null,
          });
        });

        setPreview(filas);
        setErroresUpload(errores);
      } catch (err) {
        setErroresUpload([`Error al leer el archivo: ${err.message}`]);
      }
    };
    reader.readAsBinaryString(file);
    inputRef.current.value = '';
  }

  async function confirmarSubida() {
    if (!preview || preview.length === 0) return;
    setSubiendo(true);

    // Insertar en lotes de 50
    for (let i = 0; i < preview.length; i += 50) {
      const lote = preview.slice(i, i + 50);
      await supabase.from('asistencia').upsert(lote, {
        onConflict: 'dni,fecha,tipo',
        ignoreDuplicates: true,
      });
    }

    setPreview(null);
    setSubiendo(false);
    cargarTodo();
  }

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const asistenciasFiltradas = asistencias.filter(a => {
    if (filtroFecha  && a.fecha !== filtroFecha)                           return false;
    if (filtroObra   && !a.obra?.toLowerCase().includes(filtroObra.toLowerCase())) return false;
    if (filtroEstado && a.estado !== filtroEstado)                         return false;
    if (filtroDni    && !a.dni?.includes(filtroDni) && !a.nombre_completo?.toLowerCase().includes(filtroDni.toLowerCase())) return false;
    return true;
  });

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const fechasUnicas = [...new Set(asistencias.map(a => a.fecha))];
  const puntuales    = asistenciasFiltradas.filter(a => a.estado === 'puntual').length;
  const tardanzas    = asistenciasFiltradas.filter(a => a.estado === 'tarde' || a.estado === 'muy_tarde').length;
  const obras        = [...new Set(asistencias.map(a => a.obra).filter(Boolean))];

  // ── Resumen por empleado ─────────────────────────────────────────────────────
  function calcularResumenEmpleados() {
    const mapa = {};
    asistenciasFiltradas.forEach(a => {
      if (!mapa[a.dni]) {
        const emp = empleados.find(e => String(e.dni) === String(a.dni));
        mapa[a.dni] = {
          dni:         a.dni,
          nombre:      a.nombre_completo,
          cargo:       emp?.cargo || '—',
          sueldo:      Number(emp?.sueldo || 0),
          dias:        [],
          tardanzas:   0,
          muytardes:   0,
        };
      }
      if (!mapa[a.dni].dias.includes(a.fecha)) {
        mapa[a.dni].dias.push(a.fecha);
      }
      if (a.estado === 'tarde')     mapa[a.dni].tardanzas++;
      if (a.estado === 'muy_tarde') mapa[a.dni].muytardes++;
    });

    // Calcular días laborables en el rango filtrado
    return Object.values(mapa).map(emp => {
      const diasFiltro = filtroFecha ? 1 : fechasUnicas.filter(f => esDiaLaboral(f)).length;
      const asistidos  = emp.dias.filter(d => esDiaLaboral(d)).length;
      const faltas     = Math.max(0, diasFiltro - asistidos);
      const descuento  = calcularDescuento(emp.sueldo, faltas);
      return { ...emp, diasFiltro, asistidos, faltas, descuento };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  const resumen = calcularResumenEmpleados();
  const totalDescuentos = resumen.reduce((acc, e) => acc + e.descuento, 0);

  // ── Badge de estado ─────────────────────────────────────────────────────────
  function BadgeEstado({ estado }) {
    const map = {
      puntual:      { label: 'Puntual',    cls: styles.estadoPuntual },
      tarde:        { label: 'Tarde',      cls: styles.estadoTarde },
      muy_tarde:    { label: 'Muy tarde',  cls: styles.estadoMuyTarde },
      sin_registro: { label: 'Sin reg.',   cls: styles.estadoSinReg },
    };
    const { label, cls } = map[estado] || map.sin_registro;
    return <span className={`${styles.badge} ${cls}`}>{label}</span>;
  }

  return (
    <div className={styles.wrap}>
      {/* Vista tabs */}
      <div className={styles.vistaTabs}>
        <button className={`${styles.vistaTab} ${vista === 'registro' ? styles.vistaTabActivo : ''}`} onClick={() => setVista('registro')}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M5 3V1M11 3V1M1 7h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          Registro de asistencia
        </button>
        <button className={`${styles.vistaTab} ${vista === 'resumen' ? styles.vistaTabActivo : ''}`} onClick={() => setVista('resumen')}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          Resumen por empleado
        </button>
      </div>

      {/* Upload Excel */}
      <div className={styles.uploadArea}>
        <div className={styles.uploadInfo}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 1v8M8 1L5 4M8 1l3 3" stroke="#1A2F5E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="#1A2F5E" strokeWidth="1.4" strokeLinecap="round"/></svg>
          <div>
            <div className={styles.uploadTitulo}>Subir Excel de asistencia</div>
            <div className={styles.uploadSub}>Formato: Fecha, Hora, Tipo, DNI, Nombre Completo, Obra...</div>
          </div>
        </div>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={procesarExcel} style={{ display: 'none' }} />
        <button className={styles.btnSubir} onClick={() => inputRef.current.click()}>
          Seleccionar archivo
        </button>
      </div>

      {/* Errores de upload */}
      {erroresUpload.length > 0 && (
        <div className={styles.erroresBox}>
          <strong>Advertencias ({erroresUpload.length}):</strong>
          {erroresUpload.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* Preview antes de confirmar */}
      {preview && preview.length > 0 && (
        <div className={styles.previewBox}>
          <div className={styles.previewHeader}>
            <div>
              <div className={styles.previewTitulo}>{preview.length} registros listos para importar</div>
              <div className={styles.previewSub}>Revisa los datos antes de confirmar</div>
            </div>
            <div className={styles.previewBtns}>
              <button className={styles.btnCancelar} onClick={() => setPreview(null)}>Cancelar</button>
              <button className={styles.btnConfirmar} onClick={confirmarSubida} disabled={subiendo}>
                {subiendo ? 'Importando...' : `Confirmar ${preview.length} registros`}
              </button>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Fecha</th><th>Hora</th><th>DNI</th><th>Nombre</th><th>Obra</th><th>Estado</th><th>Empleado</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td>{fmtFecha(r.fecha)}</td>
                    <td>{r.hora}</td>
                    <td>{r.dni}</td>
                    <td>{r.nombre_completo}</td>
                    <td>{r.obra || '—'}</td>
                    <td><BadgeEstado estado={r.estado} /></td>
                    <td>{r.empleado_id ? <span className={styles.empMatch}>✓ Encontrado</span> : <span className={styles.empNoMatch}>Sin match</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 20 && <div className={styles.tableFooter}>Mostrando 20 de {preview.length} registros</div>}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Total registros</div>
          <div className={styles.kpiVal}>{asistenciasFiltradas.length}</div>
          <div className={styles.kpiSub}>{fechasUnicas.length} días registrados</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Puntuales</div>
          <div className={styles.kpiVal}>{puntuales}</div>
          <div className={styles.kpiSub}>hasta las {HORA_PUNTUAL}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Tardanzas</div>
          <div className={styles.kpiVal}>{tardanzas}</div>
          <div className={styles.kpiSub}>después de las {HORA_TARDE}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Total descuentos período</div>
          <div className={`${styles.kpiVal} ${totalDescuentos > 0 ? styles.kpiRojo : ''}`}>{fmtMoneda(totalDescuentos)}</div>
          <div className={styles.kpiSub}>por faltas en el rango</div>
        </div>
      </div>

      {/* Toolbar filtros */}
      <div className={styles.toolbar}>
        <input
          type="date" className={styles.inputFecha}
          value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)}
          title="Filtrar por fecha"
        />
        <input
          type="text" className={styles.inputBuscar}
          placeholder="Buscar por nombre o DNI..."
          value={filtroDni} onChange={e => setFiltroDni(e.target.value)}
        />
        <select className={styles.select} value={filtroObra} onChange={e => setFiltroObra(e.target.value)}>
          <option value="">Todas las obras</option>
          {obras.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className={styles.select} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="puntual">Puntual</option>
          <option value="tarde">Tarde</option>
          <option value="muy_tarde">Muy tarde</option>
        </select>
        {(filtroFecha || filtroObra || filtroEstado || filtroDni) && (
          <button className={styles.btnLimpiar} onClick={() => { setFiltroFecha(''); setFiltroObra(''); setFiltroEstado(''); setFiltroDni(''); }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        )}
      </div>

      {/* ── VISTA: REGISTRO ── */}
      {vista === 'registro' && (
        cargando ? <div className={styles.loadingMsg}>Cargando...</div>
        : asistenciasFiltradas.length === 0 ? <div className={styles.emptyMsg}>No hay registros de asistencia</div>
        : (
          <div className={styles.tableWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>DNI</th>
                  <th>Nombre</th>
                  <th>Obra</th>
                  <th>Estado</th>
                  <th>Cumple dir.</th>
                </tr>
              </thead>
              <tbody>
                {asistenciasFiltradas.map(a => (
                  <tr key={a.id} className={a.estado === 'muy_tarde' ? styles.filaMuyTarde : a.estado === 'tarde' ? styles.filaTarde : ''}>
                    <td>{fmtFecha(a.fecha)}</td>
                    <td className={styles.hora}>{a.hora?.substring(0, 5)}</td>
                    <td>{a.dni}</td>
                    <td className={styles.nombre}>{a.nombre_completo}</td>
                    <td>{a.obra || '—'}</td>
                    <td><BadgeEstado estado={a.estado} /></td>
                    <td>
                      <span className={a.cumple_direccion === 'SI' ? styles.cumpleSi : styles.cumpleNo}>
                        {a.cumple_direccion || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.tableFooter}>{asistenciasFiltradas.length} registros</div>
          </div>
        )
      )}

      {/* ── VISTA: RESUMEN POR EMPLEADO ── */}
      {vista === 'resumen' && (
        cargando ? <div className={styles.loadingMsg}>Cargando...</div>
        : resumen.length === 0 ? <div className={styles.emptyMsg}>No hay datos para mostrar</div>
        : (
          <div className={styles.tableWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Cargo</th>
                  <th>Sueldo</th>
                  <th>Días laborables</th>
                  <th>Asistió</th>
                  <th>Faltas</th>
                  <th>Tardanzas</th>
                  <th>Muy tarde</th>
                  <th>Descuento</th>
                  <th>A pagar</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((emp, i) => {
                  const salarioQuincenal = emp.sueldo / 2;
                  const aPagar = Math.max(0, salarioQuincenal - emp.descuento);
                  return (
                    <tr key={i} className={emp.faltas > 0 ? styles.filaConFaltas : ''}>
                      <td>
                        <div className={styles.empNombre}>{emp.nombre}</div>
                        <div className={styles.empDni}>{emp.dni}</div>
                      </td>
                      <td>{emp.cargo}</td>
                      <td className={styles.monto}>{fmtMoneda(emp.sueldo)}<span className={styles.montoSub}>/mes</span></td>
                      <td className={styles.centrado}>{emp.diasFiltro}</td>
                      <td className={styles.centrado}><span className={styles.diasAsistio}>{emp.asistidos}</span></td>
                      <td className={styles.centrado}>
                        {emp.faltas > 0
                          ? <span className={styles.faltasBadge}>{emp.faltas}</span>
                          : <span className={styles.sinFaltas}>—</span>}
                      </td>
                      <td className={styles.centrado}>{emp.tardanzas > 0 ? <span className={styles.tardeBadge}>{emp.tardanzas}</span> : '—'}</td>
                      <td className={styles.centrado}>{emp.muytardes > 0 ? <span className={styles.muyTardeBadge}>{emp.muytardes}</span> : '—'}</td>
                      <td className={styles.descuento}>
                        {emp.descuento > 0 ? <span className={styles.descuentoVal}>-{fmtMoneda(emp.descuento)}</span> : '—'}
                      </td>
                      <td className={styles.aPagar}>{fmtMoneda(aPagar)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} className={styles.totalLabel}>Total descuentos por faltas</td>
                  <td className={styles.totalValor}>{fmtMoneda(totalDescuentos)}</td>
                  <td className={styles.totalValor}>{fmtMoneda(resumen.reduce((a, e) => a + Math.max(0, e.sueldo/2 - e.descuento), 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}
    </div>
  );
}