import { useEffect, useState } from "react";
import { supabase } from "../../../supabase/client";
import styles from "../../../styles/inventario/Inventario.module.css";

export default function Movimientos() {
  const [almacenes, setAlmacenes]     = useState([]);
  const [categorias, setCategorias]   = useState([]);
  const [productos, setProductos]     = useState([]);
  const [productosFiltrados, setProductosFiltrados] = useState([]);
  const [stockActual, setStockActual] = useState(null);
  const [saving, setSaving]           = useState(false);
  const [exito, setExito]             = useState(false);

  const [form, setForm] = useState({
    almacen_id: "", tipo: "ingreso",
    categoria_id: "", producto_id: "",
    cantidad: "", motivo: "", usuario_nombre: "",
  });

  useEffect(() => {
    const cargar = async () => {
      const [{ data: a }, { data: c }, { data: p }] = await Promise.all([
        supabase.from("almacenes").select("*").eq("activo", true).order("nombre"),
        supabase.from("categorias_inventario").select("*").order("nombre"),
        supabase.from("productos_inventario").select("*").eq("activo", true).order("nombre"),
      ]);
      setAlmacenes(a || []);
      setCategorias(c || []);
      setProductos(p || []);
    };
    cargar();
  }, []);

  useEffect(() => {
    if (form.categoria_id) {
      setProductosFiltrados(productos.filter((p) => p.categoria_id === form.categoria_id));
      setForm((f) => ({ ...f, producto_id: "" }));
    } else {
      setProductosFiltrados(productos);
    }
  }, [form.categoria_id, productos]);

  useEffect(() => {
    const cargarStock = async () => {
      if (!form.producto_id || !form.almacen_id) { setStockActual(null); return; }
      const { data } = await supabase
        .from("stock_almacen")
        .select("cantidad")
        .eq("producto_id", form.producto_id)
        .eq("almacen_id", form.almacen_id)
        .single();
      setStockActual(data?.cantidad ?? 0);
    };
    cargarStock();
  }, [form.producto_id, form.almacen_id]);

  const registrar = async () => {
    if (!form.almacen_id || !form.producto_id || !form.cantidad || !form.usuario_nombre) return;
    setSaving(true);
    const cant = Number(form.cantidad);

    // Actualizar stock
    const { data: stockExistente } = await supabase
      .from("stock_almacen")
      .select("*")
      .eq("producto_id", form.producto_id)
      .eq("almacen_id", form.almacen_id)
      .single();

    const nuevoStock = form.tipo === "ingreso"
      ? (stockExistente?.cantidad || 0) + cant
      : (stockExistente?.cantidad || 0) - cant;

    if (stockExistente) {
      await supabase.from("stock_almacen")
        .update({ cantidad: Math.max(0, nuevoStock) })
        .eq("id", stockExistente.id);
    } else {
      await supabase.from("stock_almacen")
        .insert({ producto_id: form.producto_id, almacen_id: form.almacen_id, cantidad: Math.max(0, nuevoStock) });
    }

    // Registrar movimiento
    await supabase.from("movimientos_inventario").insert({
      producto_id:   form.producto_id,
      almacen_id:    form.almacen_id,
      tipo:          form.tipo,
      cantidad:      cant,
      motivo:        form.motivo || null,
      usuario_nombre: form.usuario_nombre,
    });

    setSaving(false);
    setExito(true);
    setForm((f) => ({ ...f, cantidad: "", motivo: "" }));
    setStockActual(nuevoStock);
    setTimeout(() => setExito(false), 3000);
  };

  return (
    <div className={styles.seccion}>
      <div className={styles.formCard}>
        <div className={styles.formTitle}>Registrar movimiento</div>
        <div className={styles.formDesc}>Registra entradas de stock (compras) o salidas (consumo en obra).</div>

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>Almacén</label>
            <select className={styles.select} value={form.almacen_id} onChange={(e) => setForm({...form, almacen_id: e.target.value})}>
              <option value="">Seleccionar almacén...</option>
              {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Tipo</label>
            <select className={styles.select} value={form.tipo} onChange={(e) => setForm({...form, tipo: e.target.value})}>
              <option value="ingreso">Ingreso — Aumenta stock</option>
              <option value="salida">Salida — Reduce stock</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Categoría</label>
            <select className={styles.select} value={form.categoria_id} onChange={(e) => setForm({...form, categoria_id: e.target.value})}>
              <option value="">Todas las categorías</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Producto</label>
            <select className={styles.select} value={form.producto_id} onChange={(e) => setForm({...form, producto_id: e.target.value})}>
              <option value="">Seleccionar producto...</option>
              {productosFiltrados.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>

        {stockActual !== null && (
          <div className={styles.stockInfo}>
            Stock actual en este almacén: <strong>{stockActual}</strong>
          </div>
        )}

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>Cantidad</label>
            <input className={styles.input} type="number" min="0" placeholder="0" value={form.cantidad} onChange={(e) => setForm({...form, cantidad: e.target.value})} />
          </div>
          <div className={styles.formGroup}>
            <label>Registrado por</label>
            <input className={styles.input} type="text" placeholder="Nombre del trabajador" value={form.usuario_nombre} onChange={(e) => setForm({...form, usuario_nombre: e.target.value})} />
          </div>
          <div className={styles.formGroup} style={{gridColumn:"1/-1"}}>
            <label>Motivo (opcional)</label>
            <input className={styles.input} type="text" placeholder="Ej: compra, consumo en obra, devolución..." value={form.motivo} onChange={(e) => setForm({...form, motivo: e.target.value})} />
          </div>
        </div>

        {exito && <div className={styles.exitoMsg}>✅ Movimiento registrado correctamente</div>}

        <button
          className={styles.btnPrimary}
          onClick={registrar}
          disabled={saving || !form.almacen_id || !form.producto_id || !form.cantidad || !form.usuario_nombre}
        >
          {saving ? "Registrando..." : "Registrar movimiento"}
        </button>
      </div>
    </div>
  );
}