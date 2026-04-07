import { useEffect, useState } from "react";
import { supabase } from "../../../supabase/client";
import styles from "../../../styles/inventario/Inventario.module.css";

const TIPO_LABELS = {
  ingreso:       { label: "Ingreso",       color: "#15803d", bg: "#dcfce7" },
  salida:        { label: "Salida",        color: "#dc2626", bg: "#fee2e2" },
  transferencia: { label: "Transferencia", color: "#1d4ed8", bg: "#dbeafe" },
};

export default function Historial() {
  const [movimientos, setMovimientos] = useState([]);
  const [almacenes, setAlmacenes]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filtroAlmacen, setFiltroAlmacen] = useState("todos");
  const [filtroTipo, setFiltroTipo]       = useState("todos");
  const [busqueda, setBusqueda]           = useState("");

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [{ data: m }, { data: a }] = await Promise.all([
      supabase.from("movimientos_inventario")
        .select(`*, producto:productos_inventario(nombre, unidad_medida), almacen:almacenes!almacen_id(nombre), destino:almacenes!almacen_destino_id(nombre)`)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("almacenes").select("*").eq("activo", true).order("nombre"),
    ]);
    setMovimientos(m || []);
    setAlmacenes(a || []);
    setLoading(false);
  };

  const filtrado = movimientos.filter((m) => {
    if (filtroAlmacen !== "todos" && m.almacen_id !== filtroAlmacen) return false;
    if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (
        !(m.producto?.nombre || "").toLowerCase().includes(q) &&
        !(m.usuario_nombre || "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  return (
    <div className={styles.seccion}>
      <div className={styles.toolbar}>
        <select className={styles.select} value={filtroAlmacen} onChange={(e) => setFiltroAlmacen(e.target.value)}>
          <option value="todos">Todos los almacenes</option>
          {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <select className={styles.select} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos los tipos</option>
          <option value="ingreso">Ingresos</option>
          <option value="salida">Salidas</option>
          <option value="transferencia">Transferencias</option>
        </select>
        <input className={styles.search} type="text" placeholder="Buscar producto o trabajador..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <button className={styles.btnSecondary} onClick={cargar}>Actualizar</button>
      </div>

      {loading ? (
        <div className={styles.loadingMsg}>Cargando historial...</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cant.</th>
                <th>Almacén</th>
                <th>Destino</th>
                <th>Motivo</th>
                <th>Registrado por</th>
              </tr>
            </thead>
            <tbody>
              {filtrado.length === 0 ? (
                <tr><td colSpan={9} className={styles.emptyMsg}>Sin movimientos registrados</td></tr>
              ) : (
                filtrado.map((m) => {
                  const fecha = new Date(m.created_at);
                  const tipo  = TIPO_LABELS[m.tipo] || { label: m.tipo, color: "#64748b", bg: "#f1f5f9" };
                  return (
                    <tr key={m.id}>
                      <td>{fecha.toLocaleDateString("es-PE")}</td>
                      <td>{fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className={styles.productoNombre}>{m.producto?.nombre || "—"} <span className={styles.unidad}>({m.producto?.unidad_medida})</span></td>
                      <td>
                        <span className={styles.tipoBadge} style={{ color: tipo.color, background: tipo.bg }}>
                          {tipo.label}
                        </span>
                      </td>
                      <td className={styles.cantNum}>{m.cantidad}</td>
                      <td>{m.almacen?.nombre || "—"}</td>
                      <td>{m.destino?.nombre || "—"}</td>
                      <td className={styles.motivo}>{m.motivo || "—"}</td>
                      <td>{m.usuario_nombre || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}