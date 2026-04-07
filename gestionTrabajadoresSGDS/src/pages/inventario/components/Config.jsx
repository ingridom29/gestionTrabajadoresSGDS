import { useEffect, useState } from "react";
import { supabase } from "../../../supabase/client";
import styles from "../../../styles/inventario/Inventario.module.css";

export default function Config() {
  const [almacenes, setAlmacenes]   = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [nuevoAlmacen, setNuevoAlmacen]     = useState({ nombre: "", ubicacion: "" });
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [saving, setSaving]         = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [{ data: a }, { data: c }] = await Promise.all([
      supabase.from("almacenes").select("*").order("nombre"),
      supabase.from("categorias_inventario").select("*").order("nombre"),
    ]);
    setAlmacenes(a || []);
    setCategorias(c || []);
    setLoading(false);
  };

  const agregarAlmacen = async () => {
    if (!nuevoAlmacen.nombre.trim()) return;
    setSaving(true);
    await supabase.from("almacenes").insert({ nombre: nuevoAlmacen.nombre.trim(), ubicacion: nuevoAlmacen.ubicacion.trim() || null });
    setNuevoAlmacen({ nombre: "", ubicacion: "" });
    await cargar();
    setSaving(false);
  };

  const toggleAlmacen = async (a) => {
    await supabase.from("almacenes").update({ activo: !a.activo }).eq("id", a.id);
    await cargar();
  };

  const agregarCategoria = async () => {
    if (!nuevaCategoria.trim()) return;
    setSaving(true);
    await supabase.from("categorias_inventario").insert({ nombre: nuevaCategoria.trim() });
    setNuevaCategoria("");
    await cargar();
    setSaving(false);
  };

  const eliminarCategoria = async (id) => {
    await supabase.from("categorias_inventario").delete().eq("id", id);
    await cargar();
  };

  if (loading) return <div className={styles.loadingMsg}>Cargando configuración...</div>;

  return (
    <div className={styles.seccion}>

      {/* Almacenes */}
      <div className={styles.formCard}>
        <div className={styles.formTitle}>Almacenes</div>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>Nombre del almacén</label>
            <input className={styles.input} type="text" placeholder="Ej: Almacén Surquillo" value={nuevoAlmacen.nombre} onChange={(e) => setNuevoAlmacen({...nuevoAlmacen, nombre: e.target.value})} />
          </div>
          <div className={styles.formGroup}>
            <label>Ubicación (opcional)</label>
            <input className={styles.input} type="text" placeholder="Ej: Av. Principal 123" value={nuevoAlmacen.ubicacion} onChange={(e) => setNuevoAlmacen({...nuevoAlmacen, ubicacion: e.target.value})} />
          </div>
        </div>
        <button className={styles.btnPrimary} onClick={agregarAlmacen} disabled={saving || !nuevoAlmacen.nombre.trim()}>
          + Agregar almacén
        </button>

        <div className={styles.listaItems}>
          {almacenes.map((a) => (
            <div key={a.id} className={`${styles.itemRow} ${!a.activo ? styles.itemInactivo : ""}`}>
              <div className={styles.itemInfo}>
                <div className={styles.itemNombre}>{a.nombre}</div>
                {a.ubicacion && <div className={styles.itemSub}>{a.ubicacion}</div>}
              </div>
              <div className={styles.itemAcciones}>
                <span className={a.activo ? styles.badgeOk : styles.badgeInactivo}>{a.activo ? "Activo" : "Inactivo"}</span>
                <button className={a.activo ? styles.btnDesactivar : styles.btnActivar} onClick={() => toggleAlmacen(a)}>
                  {a.activo ? "Desactivar" : "Activar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Categorías */}
      <div className={styles.formCard}>
        <div className={styles.formTitle}>Categorías de productos</div>
        <div className={styles.formGrid}>
          <div className={styles.formGroup} style={{gridColumn:"1/-1"}}>
            <label>Nueva categoría</label>
            <div style={{display:"flex",gap:"10px"}}>
              <input className={styles.input} type="text" placeholder="Ej: Herramientas y equipos" value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && agregarCategoria()} style={{flex:1}} />
              <button className={styles.btnPrimary} onClick={agregarCategoria} disabled={saving || !nuevaCategoria.trim()} style={{whiteSpace:"nowrap"}}>
                + Agregar
              </button>
            </div>
          </div>
        </div>

        <div className={styles.listaItems}>
          {categorias.map((c) => (
            <div key={c.id} className={styles.itemRow}>
              <div className={styles.itemNombre}>{c.nombre}</div>
              <button className={styles.btnDesactivar} onClick={() => eliminarCategoria(c.id)}>Eliminar</button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}