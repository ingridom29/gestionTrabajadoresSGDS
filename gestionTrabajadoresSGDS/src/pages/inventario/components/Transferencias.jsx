import { useEffect, useState } from "react";
import { supabase } from "../../../supabase/client";
import styles from "../../../styles/inventario/Inventario.module.css";

export default function Transferencias() {
  const [almacenes, setAlmacenes]   = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos]   = useState([]);
  const [productosFiltrados, setProductosFiltrados] = useState([]);
  const [stockOrigen, setStockOrigen] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [exito, setExito]           = useState(false);

  const [form, setForm] = useState({
    categoria_id: "", producto_id: "",
    almacen_origen_id: "", almacen_destino_id: "",
    cantidad: "", usuario_nombre: "", todo: false,
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
      if (!form.producto_id || !form.almacen_origen_id) { setStockOrigen(null); return; }
      const { data } = await supabase
        .from("stock_almacen").select("cantidad")
        .eq("producto_id", form.producto_id)
        .eq("almacen_id", form.almacen_origen_id)
        .single();
      const cant = data?.cantidad ?? 0;
      setStockOrigen(cant);
      if (form.todo) setForm((f) => ({ ...f, cantidad: String(cant) }));
    };
    cargarStock();
  }, [form.producto_id, form.almacen_origen_id]);

  const confirmar = async () => {
    if (!form.producto_id || !form.almacen_origen_id || !form.almacen_destino_id || !form.cantidad || !form.usuario_nombre) return;
    if (form.almacen_origen_id === form.almacen_destino_id) return;
    setSaving(true);
    const cant = Number(form.cantidad);

    // Reducir stock origen
    const { data: so } = await supabase.from("stock_almacen").select("*")
      .eq("producto_id", form.producto_id).eq("almacen_id", form.almacen_origen_id).single();
    if (so) await supabase.from("stock_almacen").update({ cantidad: Math.max(0, so.cantidad - cant) }).eq("id", so.id);

    // Aumentar stock destino
    const { data: sd } = await supabase.from("stock_almacen").select("*")
      .eq("producto_id", form.producto_id).eq("almacen_id", form.almacen_destino_id).single();
    if (sd) {
      await supabase.from("stock_almacen").update({ cantidad: sd.cantidad + cant }).eq("id", sd.id);
    } else {
      await supabase.from("stock_almacen").insert({ producto_id: form.producto_id, almacen_id: form.almacen_destino_id, cantidad: cant });
    }

    // Registrar movimiento
    await supabase.from("movimientos_inventario").insert({
      producto_id:        form.producto_id,
      almacen_id:         form.almacen_origen_id,
      almacen_destino_id: form.almacen_destino_id,
      tipo:               "transferencia",
      cantidad:           cant,
      usuario_nombre:     form.usuario_nombre,
    });

    setSaving(false);
    setExito(true);
    setForm((f) => ({ ...f, cantidad: "", todo: false }));
    setStockOrigen((s) => Math.max(0, s - cant));
    setTimeout(() => setExito(false), 3000);
  };

  return (
    <div className={styles.seccion}>
      <div className={styles.formCard}>
        <div className={styles.formTitle}>Transferir entre almacenes</div>
        <div className={styles.formDesc}>Mueve stock de un almacén a otro. Queda registrado en el historial.</div>

        <div className={styles.formGrid}>
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
          <div className={styles.formGroup}>
            <label>Almacén origen</label>
            <select className={styles.select} value={form.almacen_origen_id} onChange={(e) => setForm({...form, almacen_origen_id: e.target.value})}>
              <option value="">Seleccionar origen...</option>
              {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Almacén destino</label>
            <select className={styles.select} value={form.almacen_destino_id} onChange={(e) => setForm({...form, almacen_destino_id: e.target.value})}>
              <option value="">Seleccionar destino...</option>
              {almacenes.filter((a) => a.id !== form.almacen_origen_id).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
        </div>

        {stockOrigen !== null && (
          <div className={styles.stockInfo}>
            Stock disponible en origen: <strong>{stockOrigen}</strong>
          </div>
        )}

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>Cantidad a transferir</label>
            <input className={styles.input} type="number" min="0" placeholder="0"
              value={form.cantidad}
              onChange={(e) => setForm({...form, cantidad: e.target.value, todo: false})}
              disabled={form.todo}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Registrado por</label>
            <input className={styles.input} type="text" placeholder="Nombre del trabajador" value={form.usuario_nombre} onChange={(e) => setForm({...form, usuario_nombre: e.target.value})} />
          </div>
        </div>

        <label className={styles.checkRow}>
          <input type="checkbox" checked={form.todo} onChange={(e) => {
            const checked = e.target.checked;
            setForm((f) => ({ ...f, todo: checked, cantidad: checked ? String(stockOrigen ?? 0) : "" }));
          }} />
          Transferir todo el stock disponible
        </label>

        {exito && <div className={styles.exitoMsg}>✅ Transferencia realizada correctamente</div>}

        <button
          className={styles.btnPrimary}
          onClick={confirmar}
          disabled={saving || !form.producto_id || !form.almacen_origen_id || !form.almacen_destino_id || !form.cantidad || !form.usuario_nombre || form.almacen_origen_id === form.almacen_destino_id}
        >
          {saving ? "Procesando..." : "Confirmar transferencia"}
        </button>
      </div>
    </div>
  );
}