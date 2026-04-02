import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import styles from "../../../styles/carteras/Boleta.module.css";
import logo from "../../../assets/logoSGDS.png";
import logoYape from "../../../assets/yape.png";
import logoBCP from "../../../assets/bcp.png";
import logoBBVA from "../../../assets/bbva.png";

const EMPRESA = {
  nombre:  "SGDS Montenegro EIRL",
  ruc:     "20603207085",
  telf:    "962 335 890",
  correo:  "contabilidad@sgds.pe",
  yape:    "962 335 890",
  titular: "Ingrid Ochoa M.",
  cta:     "19395096405073",
  cci:     "002193195096405073 11",
};

export default function Boleta({ pago, socio, onCerrar }) {
  const boletaRef = useRef(null);
  if (!pago || !socio) return null;

  const fechaEmision = pago.fecha_emision
    ? new Date(pago.fecha_emision).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const fechaPago = pago.fecha
    ? new Date(pago.fecha + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : fechaEmision;

  const fmt = (n) =>
    new Intl.NumberFormat("es-PE", {
      style: "currency", currency: "PEN", minimumFractionDigits: 2,
    currencyDisplay: "symbol",
    }).format(Number(n) || 0);

  const formaPago = pago.banco
    ? `${pago.medio_pago} · ${pago.banco}`
    : pago.medio_pago || "—";

  const esAnulado = pago.anulado === true;
  const qrData = JSON.stringify({
    boleta: `B001-${(pago.numero_boleta || "").split("-").pop()}`,
    estado: esAnulado ? "ANULADO" : "VALIDO",
    empresa: "SGDS Montenegro EIRL",
    ruc: "20603207085",
    socio: `${socio.apellidos} ${socio.nombres || ""}`.trim(),
    dni: socio.dni || "—",
    lote: `Mz. ${socio.manzana} Lote ${socio.lote}`,
    monto: fmt(pago.monto),
    fechaEmision,
    fechaPago,
    medio: formaPago,
    operacion: pago.operacion || "—",
    ...(esAnulado && {
      motivoAnulacion: pago.motivo_anulacion,
      fechaAnulacion: pago.fecha_anulacion
        ? new Date(pago.fecha_anulacion).toLocaleDateString("es-PE")
        : "—",
    }),
  });

  const descargarPDF = async () => {
    const elemento = boletaRef.current;
    if (!elemento) return;
    const canvas = await html2canvas(elemento, {
      scale: 2, useCORS: true, backgroundColor: "#ffffff",
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfWidth  = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Boleta-${pago.numero_boleta}.pdf`);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <div className={styles.acciones}>
          <button className={styles.btnImprimir} onClick={descargarPDF}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v8M8 9l-3-3M8 9l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Descargar PDF
          </button>
          <button className={styles.btnCerrar} onClick={onCerrar}>✕ Cerrar</button>
        </div>

        <div className={styles.boleta} ref={boletaRef} style={{position:"relative"}}>

          {/* Marca de agua anulado */}
          {esAnulado && (
            <div style={{
              position:"absolute", inset:0, display:"flex",
              alignItems:"center", justifyContent:"center",
              pointerEvents:"none", zIndex:10,
              transform:"rotate(-35deg)",
            }}>
              <div style={{
                fontSize:"72px", fontWeight:"900",
                color:"rgba(220,38,38,0.12)",
                letterSpacing:"4px", userSelect:"none",
                fontFamily:"Poppins,sans-serif",
                whiteSpace:"nowrap",
              }}>ANULADO</div>
            </div>
          )}

          {/* Banner anulado */}
          {esAnulado && (
            <div style={{
              background:"#dc2626", color:"#fff",
              padding:"8px 16px", borderRadius:"8px",
              display:"flex", alignItems:"center", gap:"10px",
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#fff" strokeWidth="1.5"/><path d="M5 5l6 6M11 5l-6 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <div>
                <div style={{fontSize:"12px",fontWeight:"700"}}>BOLETA ANULADA</div>
                <div style={{fontSize:"11px",opacity:0.85}}>
                  Motivo: {pago.motivo_anulacion} · Fecha: {pago.fecha_anulacion ? new Date(pago.fecha_anulacion).toLocaleDateString("es-PE") : "—"}
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className={styles.header}>
            <div className={styles.logoArea}>
              <img src={logo} alt="SGDS Montenegro" className={styles.logoImg} />
              <div className={styles.empresaInfo}>
                <div className={styles.empresaNombre}>{EMPRESA.nombre}</div>
                <div className={styles.empresaDato}>Telf. {EMPRESA.telf}</div>
                <div className={styles.empresaDato}>Correo: {EMPRESA.correo}</div>
              </div>
            </div>
            <div className={styles.boletaNumArea}>
              <div className={styles.rucLabel}>RUC. {EMPRESA.ruc}</div>
              <span className={styles.boletaLabel}>Boleta N°</span>
              <div className={styles.boletaNum}>
                {pago.numero_boleta
                  ? "B001-" + pago.numero_boleta.split("-").pop()
                  : "—"}
              </div>
            </div>
          </div>

          <div className={styles.divider} />

          {/* Datos socio */}
          <div className={styles.datos}>
            <div className={styles.datoRow}><span className={styles.datoKey}>Fecha de Emisión</span><span className={styles.datoVal}>{fechaEmision}</span></div>
            <div className={styles.datoRow}><span className={styles.datoKey}>DNI</span><span className={styles.datoVal}>{socio.dni || "—"}</span></div>
            <div className={styles.datoRow}><span className={styles.datoKey}>Señor (es)</span><span className={styles.datoVal}>{socio.apellidos} {socio.nombres || ""}</span></div>
            <div className={styles.datoRow}><span className={styles.datoKey}>Dirección</span><span className={styles.datoVal}>Mz. {socio.manzana} Lote {socio.lote}</span></div>
            {socio.celular && <div className={styles.datoRow}><span className={styles.datoKey}>Celular</span><span className={styles.datoVal}>{socio.celular}</span></div>}
          </div>

          <div className={styles.divider} />

          {/* Tabla */}
          <table className={styles.tablaSrv}>
            <thead><tr><th>Descripción</th><th>Valor Unitario</th></tr></thead>
            <tbody>
              <tr>
                <td>{socio.servicio || "Agua, Desagüe y Electrificación"}</td>
                <td>{fmt(pago.monto)}</td>
              </tr>
            </tbody>
          </table>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Importe Total</span>
            <span className={styles.totalVal}>{fmt(pago.monto)}</span>
          </div>

          {/* Detalle pago — Opción C */}
          <div className={styles.detallePago}>
            <div className={styles.detalleHeader}>Detalle del Pago</div>
            <div className={styles.detalleGrid}>
              <div className={styles.detalleItem}>
                <span className={styles.detalleKey}>Tipo de Moneda</span>
                <span className={styles.detalleVal}>PEN - Soles</span>
              </div>
              <div className={styles.detalleItem}>
                <span className={styles.detalleKey}>Forma de Pago</span>
                <span className={styles.detalleVal}>{formaPago}</span>
              </div>
              <div className={styles.detalleItem}>
                <span className={styles.detalleKey}>N° Operación</span>
                <span className={styles.detalleVal}>{pago.operacion || "—"}</span>
              </div>
              <div className={styles.detalleItem}>
                <span className={styles.detalleKey}>Fecha de Pago</span>
                <span className={styles.detalleVal}>{fechaPago}</span>
              </div>
            </div>
          </div>

          {/* QR + 3 tarjetas en una fila */}
          <div className={styles.metodoRow}>
            <div className={styles.qrPlaceholder}>
              <QRCodeSVG
                value={qrData}
                size={100}
                fgColor="#1A2F5E"
                bgColor="#ffffff"
                level="Q"
              />
              <div className={styles.qrLabel}>Escanea para<br/>validar comprobante</div>
            </div>
            <div className={styles.cuentasGrid}>
              <div className={styles.cuentaCard}>
                <img src={logoYape} alt="Yape" className={styles.medioPagoImg} />
                <div className={styles.cuentaCardLinea}>{EMPRESA.yape}</div>
                <div className={styles.cuentaCardNombre} style={{ color: "#6C2D91" }}>{EMPRESA.titular}</div>
              </div>
              <div className={styles.cuentaCard}>
                <img src={logoBCP} alt="BCP" className={styles.medioPagoImg} />
                <div className={styles.cuentaCardLinea}>{EMPRESA.cta}</div>
                <div className={styles.cuentaCardLinea} style={{ fontSize: "9.5px", color: "#94a3b8" }}>CCI: {EMPRESA.cci}</div>
                <div className={styles.cuentaCardNombre} style={{ color: "#0066CC" }}>{EMPRESA.titular}</div>
              </div>
              <div className={styles.cuentaCard}>
                <img src={logoBBVA} alt="BBVA" className={styles.medioPagoImg} />
                <div className={styles.cuentaCardLinea}>001107500200023496</div>
                <div className={styles.cuentaCardNombre} style={{ color: "#004A97" }}>Ana Montenegro J.</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}