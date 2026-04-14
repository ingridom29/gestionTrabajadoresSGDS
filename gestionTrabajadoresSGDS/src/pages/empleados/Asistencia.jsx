import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase/client';
import styles from '../../styles/empleados/Asistencia.module.css';
import * as XLSX from 'xlsx';

// ── Constantes de horario ─────────────────────────────────────────────────────
const HORA_PUNTUAL = '08:30';
const HORA_TARDE   = '10:00';
const HORA_LIMITE  = '11:30';

// ── Feriados nacionales Perú 2026 ─────────────────────────────────────────────
const FERIADOS_2026 = new Set([
  '2026-01-01', // Año Nuevo
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajo
  '2026-06-29', // San Pedro y San Pablo
  '2026-07-28', // Fiestas Patrias
  '2026-07-29', // Fiestas Patrias
  '2026-08-30', // Santa Rosa de Lima
  '2026-10-08', // Batalla de Angamos
  '2026-11-01', // Todos los Santos
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
]);

function esFeriado(fechaStr) {
  return FERIADOS_2026.has(fechaStr);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parsearFecha(str) {
  if (!str && str !== 0) return null;
  if (typeof str === 'number') {
    const epoch = new Date(1899, 11, 30);
    const fecha = new Date(epoch.getTime() + str * 86400000);
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(str);
  if (s.includes('/')) {
    const partes = s.split('/');
    if (partes.length === 3) {
      const [d, m, y] = partes;
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
  }
  return s.split('T')[0];
}

function parsearHora(str) {
  if (!str && str !== 0) return null;
  if (typeof str === 'number') {
    const fraccion = str % 1;
    const totalSeg = Math.round(fraccion * 86400);
    const hh = Math.floor(totalSeg / 3600);
    const mm = Math.floor((totalSeg % 3600) / 60);
    const ss = totalSeg % 60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }
  const s = String(str).trim();
  const partes = s.split(':');
  if (partes.length < 2) return null;
  const hh = partes[0].padStart(2,'0');
  const mm = partes[1].padStart(2,'0');
  const ss = (partes[2] || '00').padStart(2,'0');
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
  if (esFeriado(fechaStr)) return false;
  const d = new Date(fechaStr + 'T00:00:00');
  const dia = d.getDay();
  return dia >= 1 && dia <= 6;
}

function calcularDescuento(sueldo, faltas) {
  return (Number(sueldo) / 30) * faltas;
}

function fmtFecha(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtFechaCorta(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtMoneda(n) {
  return `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

// ── Badge estado ──────────────────────────────────────────────────────────────
function BadgeEstado({ estado }) {
  const map = {
    puntual:      { label: 'Puntual',   cls: styles.estadoPuntual },
    tarde:        { label: 'Tarde',     cls: styles.estadoTarde },
    muy_tarde:    { label: 'Muy tarde', cls: styles.estadoMuyTarde },
    sin_registro: { label: 'Sin reg.',  cls: styles.estadoSinReg },
    falta:        { label: 'Falta',     cls: styles.estadoFalta },
  };
  const { label, cls } = map[estado] || map.sin_registro;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Asistencia() {
  const [vista,          setVista]          = useState('registro');
  const [asistencias,    setAsistencias]    = useState([]);
  const [empleados,      setEmpleados]      = useState([]);
  const [cargando,       setCargando]       = useState(true);
  const [subiendo,       setSubiendo]       = useState(false);
  const [filtroFecha,    setFiltroFecha]    = useState('');
  const [filtroObra,     setFiltroObra]     = useState('');
  const [filtroEstado,   setFiltroEstado]   = useState('');
  const [filtroDni,      setFiltroDni]      = useState('');
  const [preview,        setPreview]        = useState(null);
  const [erroresUpload,  setErroresUpload]  = useState([]);

  // Modal detalle empleado
  const [modalEmpleado,  setModalEmpleado]  = useState(null); // empleado seleccionado
  const [detalleFiltro,  setDetalleFiltro]  = useState({ desde: '', hasta: '' });
  const [obsTexto,       setObsTexto]       = useState('');
  const [obsTipo,        setObsTipo]        = useState('general');
  const [observaciones,  setObservaciones]  = useState([]);
  const [guardandoObs,   setGuardandoObs]   = useState(false);

  // Modal editar registro
  const [editandoReg,    setEditandoReg]    = useState(null);
  const [formEdit,       setFormEdit]       = useState({});
  const [guardandoEdit,  setGuardandoEdit]  = useState(false);

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

  // ── Cargar observaciones de un empleado ─────────────────────────────────────
  async function cargarObservaciones(dni) {
    const { data } = await supabase
      .from('asistencia_observaciones')
      .select('*')
      .eq('dni', dni)
      .order('created_at', { ascending: false });
    setObservaciones(data || []);
  }

  // ── Abrir modal detalle empleado ─────────────────────────────────────────────
  async function abrirDetalleEmpleado(emp) {
    setModalEmpleado(emp);
    setDetalleFiltro({ desde: '', hasta: '' });
    setObsTexto('');
    setObsTipo('general');
    await cargarObservaciones(emp.dni);
  }

  // ── Guardar observación ──────────────────────────────────────────────────────
  async function guardarObservacion() {
    if (!obsTexto.trim() || !modalEmpleado) return;
    setGuardandoObs(true);
    await supabase.from('asistencia_observaciones').insert({
      empleado_id: modalEmpleado.empleado_id || null,
      dni:         modalEmpleado.dni,
      fecha:       new Date().toISOString().split('T')[0],
      observacion: obsTexto.trim(),
      tipo:        obsTipo,
    });
    setObsTexto('');
    await cargarObservaciones(modalEmpleado.dni);
    setGuardandoObs(false);
  }

  async function eliminarObservacion(id) {
    if (!confirm('¿Eliminar esta observación?')) return;
    await supabase.from('asistencia_observaciones').delete().eq('id', id);
    await cargarObservaciones(modalEmpleado.dni);
  }

  // ── Abrir modal editar registro ──────────────────────────────────────────────
  function abrirEditarRegistro(reg) {
    setEditandoReg(reg);
    setFormEdit({
      fecha:           reg.fecha,
      hora:            reg.hora?.substring(0, 5) || '',
      tipo:            reg.tipo,
      estado:          reg.estado,
      cumple_direccion: reg.cumple_direccion || '',
      observacion:     reg.observacion || '',
    });
  }

  async function guardarEdicion() {
    if (!editandoReg) return;
    setGuardandoEdit(true);
    await supabase.from('asistencia').update({
      fecha:            formEdit.fecha,
      hora:             formEdit.hora + ':00',
      tipo:             formEdit.tipo,
      estado:           formEdit.estado,
      cumple_direccion: formEdit.cumple_direccion,
      observacion:      formEdit.observacion,
    }).eq('id', editandoReg.id);
    setEditandoReg(null);
    setGuardandoEdit(false);
    cargarTodo();
  }

  // ── Reporte PDF por empleado ─────────────────────────────────────────────────
  async function exportarReportePDF(emp, registros, obs) {
    // Cargar jsPDF dinámicamente
    let jsPDF;
    if (window.jspdf) {
      jsPDF = window.jspdf.jsPDF;
    } else {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      jsPDF = window.jspdf.jsPDF;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210; const margen = 15;
    let y = 0;

    // ── Helpers PDF ──
    const azul    = [26, 47, 94];
    const azulMed = [46, 72, 124];
    const amarillo= [254, 199, 11];
    const gris    = [148, 163, 184];
    const grisCla = [241, 245, 249];
    const rojo    = [220, 38, 38];
    const verde   = [21, 128, 61];
    const naranja = [217, 119, 6];
    const textOsc = [51, 65, 85];
    const blanco  = [255, 255, 255];

    function nuevaPagina() {
      doc.addPage();
      y = 20;
    }
    function checkPagina(espacio = 20) {
      if (y + espacio > 270) nuevaPagina();
    }

    // ── HEADER ──────────────────────────────────────────────────────────────────
    doc.setFillColor(...azul);
    doc.rect(0, 0, W, 32, 'F');
    doc.setFillColor(...amarillo);
    doc.rect(0, 0, 4, 32, 'F');

    doc.setTextColor(...blanco);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('SGDS Montenegro', 12, 11);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Reporte de Asistencia Individual', 12, 18);
    doc.setFontSize(9);
    doc.text(`Generado: ${fmtFechaCorta(new Date().toISOString().split('T')[0])}`, 12, 24);

    y = 40;

    // ── INFO EMPLEADO ────────────────────────────────────────────────────────────
    doc.setFillColor(...grisCla);
    doc.rect(margen, y, W - margen * 2, 22, 'F');
    doc.setTextColor(...azul);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(emp.nombre, margen + 4, y + 8);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textOsc);
    doc.text(`DNI: ${emp.dni}   |   Cargo: ${emp.cargo}   |   Sueldo: S/ ${emp.sueldo}/mes`, margen + 4, y + 16);
    y += 28;

    // ── RESUMEN KPIs ─────────────────────────────────────────────────────────────
    const ingresos   = registros.filter(r => r.tipo === 'INGRESO');
    const fechasReg  = [...new Set(ingresos.map(r => r.fecha))];
    const diasAsis   = fechasReg.filter(esDiaLaboral).length;
    const nFaltas    = registros.filter(r => r.estado === 'falta').length;
    const nTardanzas = ingresos.filter(r => r.estado === 'tarde').length;
    const nMuyTardes = ingresos.filter(r => r.estado === 'muy_tarde').length;
    const descuento  = calcularDescuento(emp.sueldo, nFaltas);

    const kpis = [
      { label: 'Días asistidos', val: String(diasAsis),        color: verde },
      { label: 'Tardanzas',      val: String(nTardanzas),       color: naranja },
      { label: 'Muy tarde',      val: String(nMuyTardes),       color: rojo },
      { label: 'Descuento',      val: fmtMoneda(descuento),     color: rojo },
    ];
    const kW = (W - margen * 2 - 9) / 4;
    kpis.forEach((k, i) => {
      const kx = margen + i * (kW + 3);
      doc.setFillColor(...blanco);
      doc.setDrawColor(...[226, 232, 240]);
      doc.rect(kx, y, kW, 16, 'FD');
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gris);
      doc.text(k.label.toUpperCase(), kx + kW / 2, y + 5, { align: 'center' });
      doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...k.color);
      doc.text(k.val, kx + kW / 2, y + 13, { align: 'center' });
    });
    y += 22;

    // ── TABLA INCIDENCIAS (faltas y tardanzas) ───────────────────────────────────
    const incidencias = registros.filter(r =>
      r.tipo === 'INGRESO' && (r.estado === 'tarde' || r.estado === 'muy_tarde' || r.estado === 'falta')
    ).sort((a, b) => a.fecha.localeCompare(b.fecha));

    checkPagina(14);
    doc.setFillColor(...azulMed);
    doc.rect(margen, y, W - margen * 2, 7, 'F');
    doc.setTextColor(...blanco);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('INCIDENCIAS — FALTAS Y TARDANZAS', margen + 3, y + 5);
    y += 9;

    if (incidencias.length === 0) {
      doc.setFillColor(...grisCla);
      doc.rect(margen, y, W - margen * 2, 8, 'F');
      doc.setTextColor(...gris);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text('Sin incidencias registradas en el período', W / 2, y + 5.5, { align: 'center' });
      y += 10;
    } else {
      // Cabecera tabla
      const cols = [28, 20, 22, 70, 50];
      const heads = ['Fecha', 'Hora', 'Estado', 'Obra', 'Observación'];
      doc.setFillColor(...grisCla);
      doc.rect(margen, y, W - margen * 2, 6, 'F');
      doc.setTextColor(...[71, 85, 105]);
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
      let cx = margen + 2;
      heads.forEach((h, i) => { doc.text(h, cx, y + 4.3); cx += cols[i]; });
      y += 7;

      incidencias.forEach((r, idx) => {
        checkPagina(8);
        if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(margen, y, W - margen * 2, 7, 'F'); }
        const estadoColor = r.estado === 'tarde' ? naranja : rojo;
        const estadoLabel = r.estado === 'tarde' ? 'Tarde' : r.estado === 'falta' ? 'Falta' : 'Muy tarde';
        const obs_r = obs.find(o => o.fecha === r.fecha);

        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textOsc);
        cx = margen + 2;
        doc.text(fmtFechaCorta(r.fecha), cx, y + 4.8); cx += cols[0];
        doc.text(r.hora?.substring(0,5) || '—', cx, y + 4.8); cx += cols[1];
        doc.setTextColor(...estadoColor); doc.setFont('helvetica', 'bold');
        doc.text(estadoLabel, cx, y + 4.8); cx += cols[2];
        doc.setTextColor(...textOsc); doc.setFont('helvetica', 'normal');
        doc.text(doc.splitTextToSize(r.obra || '—', cols[3] - 2)[0], cx, y + 4.8); cx += cols[3];
        doc.setTextColor(...(obs_r ? [21, 128, 61] : gris));
        doc.text(obs_r ? doc.splitTextToSize(obs_r.observacion, cols[4] - 2)[0] : 'Sin justificación', cx, y + 4.8);
        y += 7;
      });
    }

    y += 4;

    // ── TABLA COMPLETA DE ASISTENCIA ─────────────────────────────────────────────
    checkPagina(14);
    doc.setFillColor(...azulMed);
    doc.rect(margen, y, W - margen * 2, 7, 'F');
    doc.setTextColor(...blanco);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('HISTORIAL COMPLETO DE MARCACIONES', margen + 3, y + 5);
    y += 9;

    const colsH = [28, 18, 18, 22, 60, 20];
    const headsH = ['Fecha', 'Hora', 'Tipo', 'Estado', 'Obra', 'Cumple'];
    doc.setFillColor(...grisCla);
    doc.rect(margen, y, W - margen * 2, 6, 'F');
    doc.setTextColor(...[71, 85, 105]);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    let cxH = margen + 2;
    headsH.forEach((h, i) => { doc.text(h, cxH, y + 4.3); cxH += colsH[i]; });
    y += 7;

    registros.forEach((r, idx) => {
      checkPagina(7);
      if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(margen, y, W - margen * 2, 6, 'F'); }
      const estColor = r.estado === 'puntual' ? verde : r.estado === 'tarde' ? naranja : rojo;
      const estLabel = { puntual: 'Puntual', tarde: 'Tarde', muy_tarde: 'Muy tarde', falta: 'Falta', sin_registro: '—' }[r.estado] || r.estado;
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      cxH = margen + 2;
      doc.setTextColor(...textOsc); doc.text(fmtFechaCorta(r.fecha), cxH, y + 4.2); cxH += colsH[0];
      doc.text(r.hora?.substring(0,5) || '—', cxH, y + 4.2); cxH += colsH[1];
      if (r.tipo === 'INGRESO') { doc.setTextColor(29, 78, 216); } else { doc.setTextColor(...gris); }
      doc.text(r.tipo, cxH, y + 4.2); cxH += colsH[2];
      doc.setTextColor(...estColor); doc.setFont('helvetica', 'bold');
      doc.text(estLabel, cxH, y + 4.2); cxH += colsH[3];
      doc.setTextColor(...textOsc); doc.setFont('helvetica', 'normal');
      doc.text(doc.splitTextToSize(r.obra || '—', colsH[4] - 2)[0], cxH, y + 4.2); cxH += colsH[4];
      if (r.cumple_direccion === 'SI') { doc.setTextColor(...verde); } else { doc.setTextColor(...rojo); }
      doc.text(r.cumple_direccion || '—', cxH, y + 4.2);
      y += 6;
    });

    y += 6;

    // ── OBSERVACIONES ────────────────────────────────────────────────────────────
    if (obs.length > 0) {
      checkPagina(14);
      doc.setFillColor(...azulMed);
      doc.rect(margen, y, W - margen * 2, 7, 'F');
      doc.setTextColor(...blanco);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('OBSERVACIONES Y NOTAS', margen + 3, y + 5);
      y += 9;

      obs.forEach((o, idx) => {
        const tipoColor = o.tipo === 'amonestacion' ? rojo : o.tipo === 'justificacion' ? verde : azulMed;
        const tipoLabel = { general: 'GENERAL', justificacion: 'JUSTIFICACIÓN', amonestacion: 'AMONESTACIÓN' }[o.tipo] || o.tipo.toUpperCase();
        const lineas = doc.splitTextToSize(o.observacion, W - margen * 2 - 40);
        const alturaObs = Math.max(10, lineas.length * 5 + 6);
        checkPagina(alturaObs + 2);
        if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(margen, y, W - margen * 2, alturaObs, 'F'); }
        doc.setFillColor(...tipoColor);
        doc.rect(margen, y, 3, alturaObs, 'F');
        doc.setFontSize(7); doc.setFont('helvetica', 'bold');
        doc.setTextColor(...tipoColor);
        doc.text(tipoLabel, margen + 6, y + 4.5);
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gris);
        doc.text(fmtFechaCorta(o.fecha), W - margen - 2, y + 4.5, { align: 'right' });
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textOsc);
        doc.text(lineas, margen + 6, y + 10);
        y += alturaObs + 2;
      });
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────────
    const totalPaginas = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      doc.setFillColor(...[244, 246, 249]);
      doc.rect(0, 285, W, 12, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gris);
      doc.text('SGDS Montenegro — Sistema de Gestión Interno', margen, 291);
      doc.text(`Página ${p} de ${totalPaginas}`, W - margen, 291, { align: 'right' });
    }

    doc.save(`Reporte_Asistencia_${emp.nombre.replace(/\s+/g, '_')}.pdf`);
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

          const emp    = empleados.find(e => String(e.dni).trim() === dni);
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
    for (let i = 0; i < preview.length; i += 50) {
      const lote = preview.slice(i, i + 50);
      const { error } = await supabase.from('asistencia').upsert(lote, {
        onConflict: 'dni,fecha,tipo',
        ignoreDuplicates: true,
      });
      if (error) {
        setErroresUpload([`Error al guardar: ${error.message}`]);
        setSubiendo(false);
        return;
      }
    }
    setPreview(null);
    setSubiendo(false);
    cargarTodo();
  }

  // ── Filtros ──────────────────────────────────────────────────────────────────
  const asistenciasFiltradas = asistencias.filter(a => {
    if (filtroFecha  && a.fecha !== filtroFecha) return false;
    if (filtroObra   && !a.obra?.toLowerCase().includes(filtroObra.toLowerCase())) return false;
    if (filtroEstado && a.estado !== filtroEstado) return false;
    if (filtroDni    && !a.dni?.includes(filtroDni) && !a.nombre_completo?.toLowerCase().includes(filtroDni.toLowerCase())) return false;
    return true;
  });

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const fechasUnicas = [...new Set(asistencias.map(a => a.fecha))];
  const puntuales    = asistenciasFiltradas.filter(a => a.estado === 'puntual').length;
  const tardanzas    = asistenciasFiltradas.filter(a => a.estado === 'tarde' || a.estado === 'muy_tarde').length;
  const obras        = [...new Set(asistencias.map(a => a.obra).filter(Boolean))];

  // ── Rango de trabajo ─────────────────────────────────────────────────────────
  // Inicio fijo: 30 marzo 2026. Fin: última fecha registrada en asistencias
  const FECHA_INICIO = '2026-03-30';
  const fechaFin = asistencias.length > 0
    ? asistencias.reduce((max, a) => a.fecha > max ? a.fecha : max, asistencias[0].fecha)
    : new Date().toISOString().split('T')[0];

  // Generar todos los días laborables entre inicio y fin
  function diasLaborablesEnRango(desde, hasta) {
    const dias = [];
    const d = new Date(desde + 'T00:00:00');
    const fin = new Date(hasta + 'T00:00:00');
    while (d <= fin) {
      const fechaStr = d.toISOString().split('T')[0];
      if (esDiaLaboral(fechaStr)) {        // ← incluye chequeo de feriados
        dias.push(fechaStr);
      }
      d.setDate(d.getDate() + 1);
    }
    return dias;
  }

  const todosLosDiasLaborables = diasLaborablesEnRango(FECHA_INICIO, fechaFin);

  // ── Resumen por empleado ──────────────────────────────────────────────────────
  function calcularResumen() {
    // Construir mapa con todos los empleados que tienen al menos 1 registro
    const mapa = {};
    asistenciasFiltradas.forEach(a => {
      if (!mapa[a.dni]) {
        const emp = empleados.find(e => String(e.dni) === String(a.dni));
        mapa[a.dni] = {
          dni: a.dni, nombre: a.nombre_completo,
          cargo: emp?.cargo || '—', sueldo: Number(emp?.sueldo || 0),
          empleado_id: emp?.id || null,
          diasConIngreso: [], tardanzas: 0, muytardes: 0,
        };
      }
      if (a.tipo === 'INGRESO' && !mapa[a.dni].diasConIngreso.includes(a.fecha)) {
        mapa[a.dni].diasConIngreso.push(a.fecha);
      }
      if (a.estado === 'tarde')     mapa[a.dni].tardanzas++;
      if (a.estado === 'muy_tarde') mapa[a.dni].muytardes++;
    });

    const diasLaborables = filtroFecha ? 1 : todosLosDiasLaborables.length;

    return Object.values(mapa).map(emp => {
      const asistidos = filtroFecha
        ? (emp.diasConIngreso.includes(filtroFecha) ? 1 : 0)
        : emp.diasConIngreso.filter(d => esDiaLaboral(d)).length;
      const faltas    = Math.max(0, diasLaborables - asistidos);
      const descuento = calcularDescuento(emp.sueldo, faltas);

      // Días que faltó = días laborables sin registro de INGRESO
      const diasFaltados = filtroFecha
        ? (asistidos === 0 ? [filtroFecha] : [])
        : todosLosDiasLaborables.filter(d => !emp.diasConIngreso.includes(d));

      return { ...emp, diasLaborables, asistidos, faltas, descuento, diasFaltados };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  const resumen = calcularResumen();
  const totalDescuentos = resumen.reduce((acc, e) => acc + e.descuento, 0);

  // ── Detalle empleado: registros filtrados por rango ───────────────────────────
  const registrosDetalleEmpleado = modalEmpleado
    ? asistencias.filter(a => {
        if (String(a.dni) !== String(modalEmpleado.dni)) return false;
        if (detalleFiltro.desde && a.fecha < detalleFiltro.desde) return false;
        if (detalleFiltro.hasta && a.fecha > detalleFiltro.hasta) return false;
        return true;
      }).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))
    : [];

  const tipoObsLabel = { general: 'General', justificacion: 'Justificación', amonestacion: 'Amonestación' };
  const tipoObsColor = { general: styles.obsGeneral, justificacion: styles.obsJustificacion, amonestacion: styles.obsAmonestacion };

  return (
    <div className={styles.wrap}>

      {/* Tabs vista */}
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

      {/* Upload */}
      <div className={styles.uploadArea}>
        <div className={styles.uploadInfo}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 1v8M8 1L5 4M8 1l3 3" stroke="#1A2F5E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="#1A2F5E" strokeWidth="1.4" strokeLinecap="round"/></svg>
          <div>
            <div className={styles.uploadTitulo}>Subir Excel de asistencia</div>
            <div className={styles.uploadSub}>Formato: Fecha, Hora, Tipo, DNI, Nombre Completo, Obra...</div>
          </div>
        </div>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={procesarExcel} style={{ display: 'none' }} />
        <button className={styles.btnSubir} onClick={() => inputRef.current.click()}>Seleccionar archivo</button>
      </div>

      {erroresUpload.length > 0 && (
        <div className={styles.erroresBox}>
          <strong>Advertencias ({erroresUpload.length}):</strong>
          {erroresUpload.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

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
              <thead><tr><th>Fecha</th><th>Hora</th><th>DNI</th><th>Nombre</th><th>Obra</th><th>Estado</th><th>Empleado</th></tr></thead>
              <tbody>
                {preview.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td>{fmtFecha(r.fecha)}</td><td>{r.hora}</td><td>{r.dni}</td>
                    <td>{r.nombre_completo}</td><td>{r.obra || '—'}</td>
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
        <div className={styles.kpi}><div className={styles.kpiLabel}>Total registros</div><div className={styles.kpiVal}>{asistenciasFiltradas.length}</div><div className={styles.kpiSub}>{fechasUnicas.length} días registrados</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Puntuales</div><div className={styles.kpiVal}>{puntuales}</div><div className={styles.kpiSub}>hasta las {HORA_PUNTUAL}</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Tardanzas</div><div className={styles.kpiVal}>{tardanzas}</div><div className={styles.kpiSub}>después de las {HORA_TARDE}</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Total descuentos</div><div className={`${styles.kpiVal} ${totalDescuentos > 0 ? styles.kpiRojo : ''}`}>{fmtMoneda(totalDescuentos)}</div><div className={styles.kpiSub}>por faltas en el rango</div></div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input type="date" className={styles.inputFecha} value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} title="Filtrar por fecha" />
        <input type="text" className={styles.inputBuscar} placeholder="Buscar por nombre o DNI..." value={filtroDni} onChange={e => setFiltroDni(e.target.value)} />
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

      {/* ── VISTA REGISTRO ── */}
      {vista === 'registro' && (
        cargando ? <div className={styles.loadingMsg}>Cargando...</div>
        : asistenciasFiltradas.length === 0 ? <div className={styles.emptyMsg}>No hay registros de asistencia</div>
        : (
          <div className={styles.tableWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr><th>Fecha</th><th>Hora</th><th>DNI</th><th>Nombre</th><th>Obra</th><th>Estado</th><th>Cumple dir.</th><th>Observación</th><th></th></tr>
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
                    <td><span className={a.cumple_direccion === 'SI' ? styles.cumpleSi : styles.cumpleNo}>{a.cumple_direccion || '—'}</span></td>
                    <td className={styles.obsCell}>{a.observacion || '—'}</td>
                    <td>
                      <button className={styles.actBtn} onClick={() => abrirEditarRegistro(a)} title="Editar registro">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.tableFooter}>{asistenciasFiltradas.length} registros</div>
          </div>
        )
      )}

      {/* ── VISTA RESUMEN ── */}
      {vista === 'resumen' && (
        cargando ? <div className={styles.loadingMsg}>Cargando...</div>
        : resumen.length === 0 ? <div className={styles.emptyMsg}>No hay datos para mostrar</div>
        : (
          <div className={styles.tableWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr><th>Empleado</th><th>Cargo</th><th>Sueldo</th><th>Días lab.</th><th>Asistió</th><th>Faltas</th><th>Tardanzas</th><th>Muy tarde</th><th>Descuento</th><th>A pagar</th><th></th></tr>
              </thead>
              <tbody>
                {resumen.map((emp, i) => {
                  const aPagar = Math.max(0, emp.sueldo / 2 - emp.descuento);
                  return (
                    <tr key={i} className={emp.faltas > 0 ? styles.filaConFaltas : ''}>
                      <td><div className={styles.empNombre}>{emp.nombre}</div><div className={styles.empDni}>{emp.dni}</div></td>
                      <td>{emp.cargo}</td>
                      <td className={styles.monto}>{fmtMoneda(emp.sueldo)}<span className={styles.montoSub}>/mes</span></td>
                      <td className={styles.centrado}>{emp.diasLaborables}</td>
                      <td className={styles.centrado}><span className={styles.diasAsistio}>{emp.asistidos}</span></td>
                      <td className={styles.centrado}>{emp.faltas > 0 ? <span className={styles.faltasBadge}>{emp.faltas}</span> : <span className={styles.sinFaltas}>—</span>}</td>
                      <td className={styles.centrado}>{emp.tardanzas > 0 ? <span className={styles.tardeBadge}>{emp.tardanzas}</span> : '—'}</td>
                      <td className={styles.centrado}>{emp.muytardes > 0 ? <span className={styles.muyTardeBadge}>{emp.muytardes}</span> : '—'}</td>
                      <td className={styles.descuento}>{emp.descuento > 0 ? <span className={styles.descuentoVal}>-{fmtMoneda(emp.descuento)}</span> : '—'}</td>
                      <td className={styles.aPagar}>{fmtMoneda(aPagar)}</td>
                      <td>
                        <button className={styles.btnDetalle} onClick={() => abrirDetalleEmpleado(emp)} title="Ver detalle y observaciones">
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7v5M8 5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                          Detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} className={styles.totalLabel}>Total descuentos por faltas</td>
                  <td className={styles.totalValor}>{fmtMoneda(totalDescuentos)}</td>
                  <td className={styles.totalValor}>{fmtMoneda(resumen.reduce((a, e) => a + Math.max(0, e.sueldo/2 - e.descuento), 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL: DETALLE EMPLEADO
      ════════════════════════════════════════════════════════════════════════ */}
      {modalEmpleado && (
        <div className={styles.modalOverlay} onClick={() => setModalEmpleado(null)}>
          <div className={styles.modalGrande} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitulo}>{modalEmpleado.nombre}</div>
                <div className={styles.modalSub}>{modalEmpleado.cargo} · DNI {modalEmpleado.dni} · Sueldo {fmtMoneda(modalEmpleado.sueldo)}/mes</div>
              </div>
              <div className={styles.modalHeaderBtns}>
                <button
                  className={styles.btnExportar}
                  onClick={() => exportarReportePDF(modalEmpleado, registrosDetalleEmpleado, observaciones)}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1v8M8 9l-3-3M8 9l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  Exportar PDF
                </button>
                <button className={styles.modalClose} onClick={() => setModalEmpleado(null)}>✕</button>
              </div>
            </div>

            <div className={styles.modalBody}>
              {/* KPIs del empleado */}
              <div className={styles.empKpis}>
                <div className={styles.empKpi}><div className={styles.empKpiLabel}>Registros</div><div className={styles.empKpiVal}>{registrosDetalleEmpleado.length}</div></div>
                <div className={styles.empKpi}><div className={styles.empKpiLabel}>Días asistidos</div><div className={styles.empKpiVal}>{[...new Set(registrosDetalleEmpleado.filter(r => r.tipo==='INGRESO').map(r => r.fecha))].length}</div></div>
                <div className={styles.empKpi}><div className={styles.empKpiLabel}>Tardanzas</div><div className={styles.empKpiVal}>{registrosDetalleEmpleado.filter(r => r.estado==='tarde'||r.estado==='muy_tarde').length}</div></div>
                <div className={styles.empKpi}><div className={styles.empKpiLabel}>Observaciones</div><div className={styles.empKpiVal}>{observaciones.length}</div></div>
              </div>

              {/* Filtro por rango */}
              <div className={styles.detalleToolbar}>
                <span className={styles.detalleToolbarLabel}>Rango:</span>
                <input type="date" className={styles.inputFecha} value={detalleFiltro.desde} onChange={e => setDetalleFiltro(f => ({ ...f, desde: e.target.value }))} />
                <span className={styles.fechaSep}>—</span>
                <input type="date" className={styles.inputFecha} value={detalleFiltro.hasta} onChange={e => setDetalleFiltro(f => ({ ...f, hasta: e.target.value }))} />
                {(detalleFiltro.desde || detalleFiltro.hasta) && (
                  <button className={styles.btnLimpiar} onClick={() => setDetalleFiltro({ desde: '', hasta: '' })}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  </button>
                )}
              </div>

              {/* Tabla de registros */}
              <div className={styles.modalSeccion}>
                <div className={styles.modalSeccionTitulo}>Historial de marcaciones</div>
                {registrosDetalleEmpleado.length === 0 ? (
                  <div className={styles.emptyMsg}>Sin registros en este rango</div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.tbl}>
                      <thead>
                        <tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Estado</th><th>Obra</th><th>Cumple dir.</th><th>Observación</th><th></th></tr>
                      </thead>
                      <tbody>
                        {registrosDetalleEmpleado.map(r => (
                          <tr key={r.id} className={r.estado === 'muy_tarde' ? styles.filaMuyTarde : r.estado === 'tarde' ? styles.filaTarde : ''}>
                            <td>{fmtFechaCorta(r.fecha)}</td>
                            <td className={styles.hora}>{r.hora?.substring(0,5)}</td>
                            <td><span className={r.tipo==='INGRESO' ? styles.tipoIngreso : styles.tipoSalida}>{r.tipo}</span></td>
                            <td><BadgeEstado estado={r.estado} /></td>
                            <td>{r.obra || '—'}</td>
                            <td><span className={r.cumple_direccion === 'SI' ? styles.cumpleSi : styles.cumpleNo}>{r.cumple_direccion || '—'}</span></td>
                            <td className={styles.obsCell}>{r.observacion || '—'}</td>
                            <td>
                              <button className={styles.actBtn} onClick={() => { setModalEmpleado(null); abrirEditarRegistro(r); }} title="Editar">
                                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Observaciones */}
              <div className={styles.modalSeccion}>
                <div className={styles.modalSeccionTitulo}>Observaciones y notas</div>

                {/* Incidencias pendientes de justificación */}
                {(() => {
                  // Tardanzas sin justificación
                  const tardanzasReg = registrosDetalleEmpleado.filter(r =>
                    r.tipo === 'INGRESO' && (r.estado === 'tarde' || r.estado === 'muy_tarde')
                  ).filter(r => !observaciones.some(o => o.fecha === r.fecha));

                  // Días faltados sin justificación
                  const empResumen = resumen.find(e => String(e.dni) === String(modalEmpleado.dni));
                  const diasFaltados = (empResumen?.diasFaltados || []).filter(f => {
                    if (detalleFiltro.desde && f < detalleFiltro.desde) return false;
                    if (detalleFiltro.hasta && f > detalleFiltro.hasta) return false;
                    return true;
                  });
                  const faltasSinJustificar = diasFaltados.filter(f => !observaciones.some(o => o.fecha === f));

                  const totalPendientes = tardanzasReg.length + faltasSinJustificar.length;
                  if (totalPendientes === 0) return null;

                  return (
                    <div className={styles.incidenciasBox}>
                      <div className={styles.incidenciasTitle}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M8 7v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        {totalPendientes} incidencia{totalPendientes !== 1 ? 's' : ''} sin justificación
                      </div>
                      <div className={styles.incidenciasList}>
                        {faltasSinJustificar.map((fecha, i) => (
                          <button
                            key={'f'+i}
                            className={`${styles.incidenciaChip} ${styles.chipFalta}`}
                            onClick={() => {
                              setObsTexto(`Justificación falta ${fmtFechaCorta(fecha)}: `);
                              setObsTipo('justificacion');
                            }}
                            title="Clic para agregar justificación"
                          >
                            {fmtFechaCorta(fecha)} — Falta
                          </button>
                        ))}
                        {tardanzasReg.map((r, i) => (
                          <button
                            key={'t'+i}
                            className={`${styles.incidenciaChip} ${r.estado === 'muy_tarde' ? styles.chipMuyTarde : styles.chipTarde}`}
                            onClick={() => {
                              setObsTexto(`Justificación ${fmtFechaCorta(r.fecha)}: `);
                              setObsTipo('justificacion');
                            }}
                            title="Clic para agregar justificación"
                          >
                            {fmtFechaCorta(r.fecha)} — {r.estado === 'muy_tarde' ? 'Muy tarde' : 'Tarde'}
                            {r.hora ? ` (${r.hora.substring(0,5)})` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Agregar observación */}
                <div className={styles.obsForm}>
                  <select className={styles.select} value={obsTipo} onChange={e => setObsTipo(e.target.value)}>
                    <option value="general">General</option>
                    <option value="justificacion">Justificación de falta</option>
                    <option value="amonestacion">Amonestación</option>
                  </select>
                  <input
                    type="text"
                    className={styles.obsInput}
                    placeholder="Escribe una observación..."
                    value={obsTexto}
                    onChange={e => setObsTexto(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && guardarObservacion()}
                  />
                  <button className={styles.btnGuardarObs} onClick={guardarObservacion} disabled={!obsTexto.trim() || guardandoObs}>
                    {guardandoObs ? '...' : 'Agregar'}
                  </button>
                </div>

                {/* Lista de observaciones */}
                {observaciones.length === 0 ? (
                  <div className={styles.emptyMsgSm}>Sin observaciones registradas</div>
                ) : (
                  <div className={styles.obsList}>
                    {observaciones.map(o => (
                      <div key={o.id} className={styles.obsItem}>
                        <div className={styles.obsTop}>
                          <span className={`${styles.obsTipoBadge} ${tipoObsColor[o.tipo] || ''}`}>{tipoObsLabel[o.tipo] || o.tipo}</span>
                          <span className={styles.obsFecha}>{fmtFechaCorta(o.fecha)}</span>
                          <button className={styles.obsEliminar} onClick={() => eliminarObservacion(o.id)} title="Eliminar">
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                        <div className={styles.obsTexto}>{o.observacion}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL: EDITAR REGISTRO
      ════════════════════════════════════════════════════════════════════════ */}
      {editandoReg && (
        <div className={styles.modalOverlay} onClick={() => setEditandoReg(null)}>
          <div className={styles.modalChico} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitulo}>Editar registro</div>
              <button className={styles.modalClose} onClick={() => setEditandoReg(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.editSubTitulo}>{editandoReg.nombre_completo} · DNI {editandoReg.dni}</div>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Fecha</label>
                  <input type="date" value={formEdit.fecha} onChange={e => setFormEdit(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div className={styles.formGroup}>
                  <label>Hora (HH:MM)</label>
                  <input type="time" value={formEdit.hora} onChange={e => setFormEdit(f => ({ ...f, hora: e.target.value }))} />
                </div>
                <div className={styles.formGroup}>
                  <label>Tipo</label>
                  <select value={formEdit.tipo} onChange={e => setFormEdit(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="INGRESO">INGRESO</option>
                    <option value="SALIDA">SALIDA</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Estado</label>
                  <select value={formEdit.estado} onChange={e => setFormEdit(f => ({ ...f, estado: e.target.value }))}>
                    <option value="puntual">Puntual</option>
                    <option value="tarde">Tarde</option>
                    <option value="muy_tarde">Muy tarde</option>
                    <option value="sin_registro">Sin registro</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Cumple dirección</label>
                  <select value={formEdit.cumple_direccion} onChange={e => setFormEdit(f => ({ ...f, cumple_direccion: e.target.value }))}>
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                    <option value="">—</option>
                  </select>
                </div>
                <div className={styles.formGroupFull}>
                  <label>Observación</label>
                  <input type="text" value={formEdit.observacion} onChange={e => setFormEdit(f => ({ ...f, observacion: e.target.value }))} placeholder="Nota sobre este registro..." />
                </div>
              </div>
              <div className={styles.formBtns}>
                <button className={styles.btnCancel} onClick={() => setEditandoReg(null)}>Cancelar</button>
                <button className={styles.btnSave} onClick={guardarEdicion} disabled={guardandoEdit}>
                  {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}