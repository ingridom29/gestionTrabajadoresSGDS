import { useEffect, useState } from "react";
import { supabase } from "../../supabase/client";
import styles from "../../styles/proyectos/Proyectos.module.css";

export default function Proyectos({ onVerDetalle }) {
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para el Modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    cliente: "",
    presupuesto: "",
    descripcion: "",
    fecha_inicio: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchProyectos();
  }, []);

  const fetchProyectos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("obras")
      .select(`*, facturas_obra (*)`)
      .order('fecha_inicio', { ascending: false });

    if (error) console.error("Error:", error);
    else setProyectos(data || []);
    setLoading(false);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("obras").insert([
      { 
        ...formData, 
        presupuesto: parseFloat(formData.presupuesto),
        estado: 'activa' 
      }
    ]);

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      setShowModal(false);
      setFormData({ nombre: "", cliente: "", presupuesto: "", descripcion: "", fecha_inicio: new Date().toISOString().split('T')[0] });
      fetchProyectos();
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.headerTitle}>Gestión de proyectos y obras</div>
          <div className={styles.headerSub}>Control de presupuestos y facturación por avance</div>
        </div>
        <button className={styles.btnNueva} onClick={() => setShowModal(true)}>+ Nueva obra</button>
      </div>

      <div className={styles.grid}>
        {proyectos.map((obra) => {
          const avanceTotal = obra.facturas_obra?.reduce((acc, f) => acc + (f.porcentaje_avance || 0), 0) || 0;
          
          return (
            <div key={obra.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardIconWrap}>
                  <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
                    <path d="M2 14V5l6-3 6 3v9M2 14h12M6 14V8h4v6" stroke="#1A2F5E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className={styles.estadoBadge}>{obra.estado}</span>
              </div>

              <div className={styles.cardTitle}>{obra.nombre}</div>
              <div className={styles.cardServicio}>{obra.cliente || 'Cliente General'}</div>
              <div className={styles.cardDesc}>{obra.descripcion}</div>

              <div className={styles.cardStats}>
                <div className={styles.stat}>
                  <span className={styles.statVal}>S/ {(obra.presupuesto / 1000).toFixed(1)}k</span>
                  <span className={styles.statLabel}>Presupuesto</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <span className={styles.statVal}>{avanceTotal}%</span>
                  <span className={styles.statLabel}>Facturado</span>
                </div>
              </div>

              {/* SOLUCIÓN AL ERROR: Usamos onVerDetalle en lugar de navigate */}
              <button 
                className={styles.btnEntrar} 
                onClick={() => onVerDetalle(obra.id)}
              >
                Ver detalles y facturas →
              </button>
            </div>
          );
        })}
      </div>

      {/* MODAL DE REGISTRO (Mantener igual) */}
      {showModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Registrar Nueva Obra</h3>
              <button className={styles.btnClose} onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Nombre de la Obra</label>
                <input name="nombre" value={formData.nombre} onChange={handleInputChange} required />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Cliente</label>
                  <input name="cliente" value={formData.cliente} onChange={handleInputChange} required />
                </div>
                <div className={styles.formGroup}>
                  <label>Presupuesto (S/)</label>
                  <input type="number" name="presupuesto" value={formData.presupuesto} onChange={handleInputChange} required />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Descripción</label>
                <textarea name="descripcion" value={formData.descripcion} onChange={handleInputChange} rows="3" />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnCancelar} onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className={styles.btnGuardar}>Guardar Proyecto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}