import { useEffect, useState } from "react";
import { supabase } from "../../../supabase/client";
import styles from "../../../styles/carteras/ReportesCasuarinas.module.css";

export default function ReportesCasuarinas() {
  const [socios, setSocios]       = useState([]);
  const [pagos, setPagos]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [exportando, setExportando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busqueda, setBusqueda]   = useState("");

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      const [{ data: s }, { data: p }] = await Promise.all([
        supabase.from("resumen_socios").select("*").order("sector").order("manzana").order("lote"),
        supabase.from("pagos_casuarinas").select("*").eq("anulado", false).order("fecha"),
      ]);
      setSocios(s || []);
      setPagos(p || []);
      setLoading(false);
    };
    cargar();
  }, []);

  // Construir filas — un socio puede tener múltiples pagos
  const filas = socios.flatMap((s) => {
    const pagosSocio = pagos.filter((p) => p.socio_id === s.id);
    const cancelado  = Number(s.total_pagado) >= Number(s.monto_contratado);
    const estado     = cancelado ? "Cancelado" : "No cancelado";

    if (pagosSocio.length === 0) {
      return [{
        sector: s.sector, manzana: s.manzana, lote: s.lote,
        apellido: s.apellidos, nombre: s.nombres || "",
        dni: s.dni || "", celular: s.celular || "",
        fecha: "", medio_pago: "", operacion: "",
        monto: 0, servicio: s.servicio || "",
        estado, total_pagado: s.total_pagado, monto_contratado: s.monto_contratado,
        socio_id: s.id,
      }];
    }

    return pagosSocio.map((p) => ({
      sector: s.sector, manzana: s.manzana, lote: s.lote,
      apellido: s.apellidos, nombre: s.nombres || "",
      dni: s.dni || "", celular: s.celular || "",
      fecha: p.fecha ? new Date(p.fecha + "T00:00:00").toLocaleDateString("es-PE") : "",
      medio_pago: p.medio_pago || "",
      operacion: p.operacion || "",
      monto: p.monto,
      servicio: s.servicio || "",
      estado, total_pagado: s.total_pagado, monto_contratado: s.monto_contratado,
      socio_id: s.id,
    }));
  });

  const filasFiltradas = filas.filter((f) => {
    if (filtroEstado === "cancelado"     && f.estado !== "Cancelado")     return false;
    if (filtroEstado === "no_cancelado"  && f.estado !== "No cancelado")  return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (
        !`${f.apellido} ${f.nombre}`.toLowerCase().includes(q) &&
        !f.dni.includes(q) &&
        !`${f.manzana}-${f.lote}`.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // Socios únicos filtrados para el conteo
  const sociosUnicos = [...new Set(filasFiltradas.map((f) => f.socio_id))].length;

  const exportarExcel = async () => {
    if (!filasFiltradas.length) return;
    setExportando(true);
    try {
      const { utils, writeFile } = await import("xlsx");
      const datos = filasFiltradas.map((f) => ({
        "Sector":      f.sector,
        "Mz":          f.manzana,
        "Lote":        f.lote,
        "Apellido":    f.apellido,
        "Nombre":      f.nombre,
        "DNI":         f.dni,
        "Celular":     f.celular,
        "Fecha":       f.fecha,
        "Medio Pago":  f.medio_pago,
        "Operación":   f.operacion,
        "Monto":       f.monto,
        "Servicio":    f.servicio,
        "Estado":      f.estado,
      }));
      const ws = utils.json_to_sheet(datos);
      // Ancho de columnas
      ws["!cols"] = [
        {wch:8},{wch:6},{wch:6},{wch:22},{wch:18},{wch:12},{wch:12},
        {wch:12},{wch:14},{wch:14},{wch:10},{wch:30},{wch:14},
      ];
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Casuarinas");
      const nombre = filtroEstado === "cancelado" ? "Cancelados" : filtroEstado === "no_cancelado" ? "NoCancelados" : "Todos";
      writeFile(wb, `Reporte-Casuarinas-${nombre}.xlsx`);
    } catch (e) {
      console.error(e);
    }
    setExportando(false);
  };

  const fmt = (n) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 0 }).format(Number(n) || 0);

  return (
    <div className={styles.wrap}>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filtros}>
          <button className={`${styles.filterBtn} ${filtroEstado === "todos" ? styles.filterActive : ""}`} onClick={() => setFiltroEstado("todos")}>Todos</button>
          <button className={`${styles.filterBtn} ${filtroEstado === "cancelado" ? styles.filterActive : ""}`}
            style={filtroEstado === "cancelado" ? {} : { background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}
            onClick={() => setFiltroEstado("cancelado")}>
            ✅ Cancelados
          </button>
          <button className={`${styles.filterBtn} ${filtroEstado === "no_cancelado" ? styles.filterActive : ""}`}
            style={filtroEstado === "no_cancelado" ? {} : { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }}
            onClick={() => setFiltroEstado("no_cancelado")}>
            ⏳ No cancelados
          </button>
        </div>
        <input className={styles.search} type="text" placeholder="Buscar socio, DNI o lote..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <button className={styles.btnExcel} onClick={exportarExcel} disabled={exportando || loading || !filasFiltradas.length}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1v8M8 9l-3-3M8 9l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          {exportando ? "Exportando..." : "Descargar Excel"}
        </button>
      </div>

      {/* Resumen */}
      <div className={styles.resumen}>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Socios</span>
          <span className={styles.resumenVal}>{sociosUnicos}</span>
        </div>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Filas</span>
          <span className={styles.resumenVal}>{filasFiltradas.length}</span>
        </div>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Total abonado</span>
          <span className={styles.resumenVal} style={{color:"#15803d"}}>{fmt(filasFiltradas.reduce((a, f) => a + Number(f.monto), 0))}</span>
        </div>
      </div>

      {/* Tabla */}
      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.loadingMsg}>Cargando datos...</div>
        ) : (
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Sector</th>
                <th>Mz</th>
                <th>Lote</th>
                <th>Apellido</th>
                <th>Nombre</th>
                <th>DNI</th>
                <th>Celular</th>
                <th>Fecha</th>
                <th>Medio Pago</th>
                <th>Operación</th>
                <th>Monto</th>
                <th>Servicio</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.length === 0 ? (
                <tr><td colSpan={13} className={styles.emptyMsg}>No se encontraron registros</td></tr>
              ) : (
                filasFiltradas.map((f, i) => (
                  <tr key={i} className={f.estado === "Cancelado" ? styles.rowCancelado : ""}>
                    <td>{f.sector}</td>
                    <td>{f.manzana}</td>
                    <td>{f.lote}</td>
                    <td className={styles.apellido}>{f.apellido}</td>
                    <td>{f.nombre}</td>
                    <td>{f.dni}</td>
                    <td>{f.celular}</td>
                    <td>{f.fecha}</td>
                    <td>{f.medio_pago}</td>
                    <td>{f.operacion}</td>
                    <td className={styles.monto}>{f.monto ? fmt(f.monto) : "—"}</td>
                    <td>{f.servicio}</td>
                    <td>
                      <span className={f.estado === "Cancelado" ? styles.badgeCancelado : styles.badgeNoCancelado}>
                        {f.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}