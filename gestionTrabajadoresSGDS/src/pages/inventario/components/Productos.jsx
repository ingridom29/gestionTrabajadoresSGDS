import { useEffect, useState } from "react";
import { supabase } from "../../../supabase/client";
import styles from "../../../styles/inventario/Inventario.module.css";

const UNIDADES = ["unidad", "kg", "tonelada", "m", "m²", "m³", "litro", "bolsa", "caja", "rollo", "par", "juego"];

export default function Productos() {
  const [productos, setProductos]   = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [busqueda, setBusqueda]     = useState("");
  const [form, setForm] = useState({
    categoria_id: "", nombre: "", unidad_medida: "", stock_minimo: 0,
  });

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("productos_inventario")
        .select("*, categoria:categorias_inventario(nombre)")
        .order("nombre"),
      supabase.from("categorias_inventario").select("*").order("nombre"),
    ]);
    setProductos(p || []);
    setCategorias(c || []);
    setLoading(false);
  };

  const guardar = async () => {
    if (!form.nombre || !form.unidad_medida || !form.categoria_id) return;
    setSaving(true);
    await supabase.from("productos_inventario").insert({
      categoria_id:  form.categoria_id,
      nombre:        form.nombre.trim().toUpperCase(),
      unidad_medida: form.unidad_medida,
      stock_minimo:  Number(form.stock_minimo) || 0,
    });
    setForm({ categoria_id: "", nombre: "", unidad_medida: "", stock_minimo: 0 });
    await cargar();
    setSaving(false);
  };

  const toggleActivo = async (p) => {
    await supabase.from("productos_inventario").update({ activo: !p.activo }).eq("id", p.id);
    await cargar();
  };

  const filtrados = productos.filter((p) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return p.nombre.toLowerCase().includes(q) || (p.categoria?.nombre || "").toLowerCase().includes(q);
  });

  return (
    <div className={styles.seccion}>
      <div className={styles.formCard}>
        <div className={styles.formTitle}>Registrar nuevo producto</div>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>Categoría</label>
            <select className={styles.select} value={form.categoria_id} onChange={(e) => setForm({...form, categoria_id: e.target.value})}>
              <option value="">Seleccionar categoría...</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Nombre del producto</label>
            <input className={styles.input} type="text" placeholder="Ej: CEMENTO PORTLAND" value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} />
          </div>
          <div className={styles.formGroup}>
            <label>Unidad de medida</label>
            <select className={styles.select} value={form.unidad_medida} onChange={(e) => setForm({...form, unidad_medida: e.target.value})}>
              <option value="">Seleccionar...</option>
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Stock mínimo</label>
            <input className={styles.input} type="number" min="0" placeholder="0" value={form.stock_minimo} onChange={(e) => setForm({...form, stock_minimo: e.target.value})} />
          </div>
        </div>
        <button className={styles.btnPrimary} onClick={guardar} disabled={saving || !form.nombre || !form.unidad_medida || !form.categoria_id}>
          {saving ? "Guardando..." : "Registrar producto"}
        </button>
      </div>

      <div className={styles.toolbar}>
        <input className={styles.search} type="text" placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {loading ? <div className={styles.loadingMsg}>Cargando...</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Unidad</th>
                <th>Stock mínimo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className={!p.activo ? styles.rowInactivo : ""}>
                  <td className={styles.productoNombre}>{p.nombre}</td>
                  <td>{p.categoria?.nombre || "—"}</td>
                  <td>{p.unidad_medida}</td>
                  <td>{p.stock_minimo}</td>
                  <td>
                    <span className={p.activo ? styles.badgeOk : styles.badgeInactivo}>
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <button className={p.activo ? styles.btnDesactivar : styles.btnActivar} onClick={() => toggleActivo(p)}>
                      {p.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}