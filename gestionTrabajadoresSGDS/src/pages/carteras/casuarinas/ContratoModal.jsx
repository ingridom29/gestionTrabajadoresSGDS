import { useState } from "react";
import styles from "../../../styles/carteras/ContratoModal.module.css";

export default function ContratoModal({ socio, onClose }) {
  const montoSugerido = socio._montoSugerido || "";
  const [form, setForm] = useState({
    montoIndividual: montoSugerido ? String(montoSugerido) : "",
    cuotaInicial: "",
    numeroCuotas: "",
    fechaFirma: new Date().toISOString().split("T")[0],
    servicio: "Red de Agua Potable, Alcantarillado y Conexión Domiciliaria",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const montoIndividual = parseFloat(form.montoIndividual) || 0;
  const cuotaInicial = parseFloat(form.cuotaInicial) || 0;
  const numeroCuotas = parseInt(form.numeroCuotas) || 0;
  const montoRestante = montoIndividual - cuotaInicial;
  const montoPorCuota =
    numeroCuotas > 0 && montoRestante > 0
      ? (montoRestante / numeroCuotas).toFixed(2)
      : 0;

  const validate = () => {
    const e = {};
    if (!form.montoIndividual || montoIndividual <= 0)
      e.montoIndividual = "Ingresa el monto";
    if (!form.cuotaInicial || cuotaInicial <= 0)
      e.cuotaInicial = "Ingresa la cuota inicial";
    if (cuotaInicial >= montoIndividual)
      e.cuotaInicial = "Debe ser menor al monto total";
    if (!form.numeroCuotas || numeroCuotas <= 0)
      e.numeroCuotas = "Ingresa número de cuotas";
    if (!form.fechaFirma) e.fechaFirma = "Selecciona la fecha";
    if (!form.servicio.trim()) e.servicio = "Describe el servicio";
    return e;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const handleGenerar = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setLoading(true);
    try {
      await generarContratoPDF({
        socio,
        montoIndividual,
        cuotaInicial,
        numeroCuotas,
        montoPorCuota: parseFloat(montoPorCuota),
        montoRestante,
        fechaFirma: form.fechaFirma,
        servicio: form.servicio,
      });
    } catch (err) {
      console.error("Error generando contrato:", err);
      alert("Ocurrió un error al generar el contrato.");
    }
    setLoading(false);
  };

  const formatSoles = (val) =>
    val > 0
      ? `S/ ${parseFloat(val).toLocaleString("es-PE", {
          minimumFractionDigits: 2,
        })}`
      : "—";

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.iconDoc}>📄</span>
            <div>
              <h2 className={styles.title}>Generar Contrato</h2>
              <p className={styles.subtitle}>Urbanización Las Casuarinas</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Datos del socio (solo lectura) */}
        <div className={styles.socioCard}>
          <div className={styles.socioAvatar}>
            {socio.nombres?.charAt(0)?.toUpperCase() || "S"}
          </div>
          <div className={styles.socioInfo}>
            <span className={styles.socioNombre}>{socio.nombres} {socio.apellidos}</span>
            <span className={styles.socioDatos}>
              DNI: {socio.dni} &nbsp;|&nbsp; Mz. {socio.manzana} Lote {socio.lote}
            </span>
          </div>
        </div>

        {/* Banner traspaso */}
        {socio._montoSugerido && (
          <div className={styles.traspasoBanner}>
            🔄 <strong>Contrato por traspaso</strong> — Monto calculado automáticamente con el saldo pendiente del titular anterior ({new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 0 }).format(socio._montoSugerido)}).
          </div>
        )}

        {/* Formulario */}
        <div className={styles.form}>
          {/* Servicio */}
          <div className={styles.fieldFull}>
            <label className={styles.label}>Servicio contratado</label>
            <input
              className={`${styles.input} ${errors.servicio ? styles.inputError : ""}`}
              name="servicio"
              value={form.servicio}
              onChange={handleChange}
              placeholder="Ej. Red de Agua Potable..."
            />
            {errors.servicio && <span className={styles.error}>{errors.servicio}</span>}
          </div>

          {/* Fecha */}
          <div className={styles.field}>
            <label className={styles.label}>Fecha de firma</label>
            <input
              className={`${styles.input} ${errors.fechaFirma ? styles.inputError : ""}`}
              type="date"
              name="fechaFirma"
              value={form.fechaFirma}
              onChange={handleChange}
            />
            {errors.fechaFirma && <span className={styles.error}>{errors.fechaFirma}</span>}
          </div>

          {/* Monto individual */}
          <div className={styles.field}>
            <label className={styles.label}>Monto individual (S/)</label>
            <input
              className={`${styles.input} ${errors.montoIndividual ? styles.inputError : ""}`}
              type="number"
              name="montoIndividual"
              value={form.montoIndividual}
              onChange={handleChange}
              placeholder="8500.00"
              min="0"
            />
            {errors.montoIndividual && <span className={styles.error}>{errors.montoIndividual}</span>}
          </div>

          {/* Cuota inicial */}
          <div className={styles.field}>
            <label className={styles.label}>Cuota inicial (S/)</label>
            <input
              className={`${styles.input} ${errors.cuotaInicial ? styles.inputError : ""}`}
              type="number"
              name="cuotaInicial"
              value={form.cuotaInicial}
              onChange={handleChange}
              placeholder="1000.00"
              min="0"
            />
            {errors.cuotaInicial && <span className={styles.error}>{errors.cuotaInicial}</span>}
          </div>

          {/* Número de cuotas */}
          <div className={styles.field}>
            <label className={styles.label}>N° de cuotas mensuales</label>
            <input
              className={`${styles.input} ${errors.numeroCuotas ? styles.inputError : ""}`}
              type="number"
              name="numeroCuotas"
              value={form.numeroCuotas}
              onChange={handleChange}
              placeholder="12"
              min="1"
            />
            {errors.numeroCuotas && <span className={styles.error}>{errors.numeroCuotas}</span>}
          </div>

          {/* Resumen calculado */}
          {montoIndividual > 0 && cuotaInicial > 0 && numeroCuotas > 0 && (
            <div className={styles.resumen}>
              <h4 className={styles.resumenTitle}>Resumen de pago</h4>
              <div className={styles.resumenGrid}>
                <div className={styles.resumenItem}>
                  <span className={styles.resumenLabel}>Monto total</span>
                  <span className={styles.resumenValor}>{formatSoles(montoIndividual)}</span>
                </div>
                <div className={styles.resumenItem}>
                  <span className={styles.resumenLabel}>Cuota inicial</span>
                  <span className={styles.resumenValor}>{formatSoles(cuotaInicial)}</span>
                </div>
                <div className={styles.resumenItem}>
                  <span className={styles.resumenLabel}>Saldo a financiar</span>
                  <span className={styles.resumenValor}>{formatSoles(montoRestante)}</span>
                </div>
                <div className={`${styles.resumenItem} ${styles.resumenDestacado}`}>
                  <span className={styles.resumenLabel}>{numeroCuotas} cuotas de</span>
                  <span className={styles.resumenValorGrande}>{formatSoles(montoPorCuota)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className={styles.actions}>
          <button className={styles.btnCancelar} onClick={onClose}>
            Cancelar
          </button>
          <button
            className={styles.btnGenerar}
            onClick={handleGenerar}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.loadingSpinner}>⏳ Generando...</span>
            ) : (
              <>📥 Generar Contrato PDF</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}