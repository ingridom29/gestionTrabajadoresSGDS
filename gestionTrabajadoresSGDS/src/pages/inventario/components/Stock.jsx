import { useEffect, useState } from "react";
import { supabase } from "../../../supabase/client";
import styles from "../../../styles/inventario/Inventario.module.css";

export default function Stock() {
  const [stock, setStock]           = useState([]);
  const [almacenes, setAlmacenes]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filtroAlmacen, setFiltroAlmacen] = useState("todos");
  const [filtroAlerta, setFiltroAlerta]   = useState(false);
  const [busqueda, setBusqueda]     = useState("");

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setLoading(true);
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("stock_con_alertas").select("*").order("categoria").order("producto"),
      supabase.from("almacenes").select("*").eq("activo", true).order("nombre"),
    ]);
    setStock(s || []);
    setAlmacenes(a || []);
    setLoading(false);
  };

  const filtrado = stock.filter((s) => {
    if (filtroAlmacen !== "todos" && s.almacen_id !== filtroAlmacen) return false;
    if (filtroAlerta && !s.alerta_stock) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!s.producto.toLowerCase().includes(q) && !s.categoria.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const alertas = stock.filter((s) => s.alerta_stock).length;

  return (
    <div className={styles.seccion}>
      {alertas > 0 && (
        <div className={styles.alertaBanner}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#dc2626" strokeWidth="1.5"/><path d="M8 5v3M8 10v.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <strong>{alertas} producto{alertas > 1 ? "s" : ""}</strong> con stock bajo o agotado
          <button className={styles.btnAlertaFiltro} onClick={() => setFiltroAlerta(!filtroAlerta)}>
            {filtroAlerta ? "Ver todos" : "Ver solo alertas"}
          </button>
        </div>
      )}

      <div className={styles.toolbar}>
        <select className={styles.select} value={filtroAlmacen} onChange={(e) => setFiltroAlmacen(e.target.value)}>
          <option value="todos">Todos los almacenes</option>
          {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <input className={styles.search} type="text" placeholder="Buscar producto o categoría..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {loading ? (
        <div className={styles.loadingMsg}>Cargando stock...</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Unidad</th>
                <th>Almacén</th>
                <th>Stock actual</th>
                <th>Stock mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrado.length === 0 ? (
                <tr><td colSpan={7} className={styles.emptyMsg}>No se encontraron productos</td></tr>
              ) : (
                filtrado.map((s, i) => (
                  <tr key={i} className={s.alerta_stock ? styles.rowAlerta : ""}>
                    <td className={styles.productoNombre}>{s.producto}</td>
                    <td>{s.categoria}</td>
                    <td>{s.unidad_medida}</td>
                    <td>{s.almacen}</td>
                    <td className={s.alerta_stock ? styles.stockBajo : styles.stockOk}>
                      {s.stock_actual}
                    </td>
                    <td className={styles.stockMin}>{s.stock_minimo}</td>
                    <td>
                      {s.stock_actual === 0 ? (
                        <span className={styles.badgeAgotado}>Agotado</span>
                      ) : s.alerta_stock ? (
                        <span className={styles.badgeBajo}>Stock bajo</span>
                      ) : (
                        <span className={styles.badgeOk}>OK</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}