import jsPDF from "jspdf";
import encabezado from "../../../assets/encabezado.png";
import piePagina from "../../../assets/piepagina.png";
// ─── Helpers ────────────────────────────────────────────────────────────────

const formatSoles = (val) =>
  `S/ ${parseFloat(val).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

const formatFecha = (fechaStr) => {
  const meses = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre",
  ];
  const d = new Date(fechaStr + "T12:00:00");
  return `${d.getDate()} de ${meses[d.getMonth()]} del ${d.getFullYear()}`;
};

// Escribe texto justificado manualmente (jsPDF no justifica nativo)
const writeJustified = (doc, text, x, y, maxWidth, lineHeight) => {
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach((line, i) => {
    const isLast = i === lines.length - 1;
    if (isLast) {
      doc.text(line, x, y + i * lineHeight);
    } else {
      // Calcular ancho de la línea y distribuir espacios
      const words = line.split(" ");
      if (words.length <= 1) {
        doc.text(line, x, y + i * lineHeight);
        return;
      }
      const lineWidth = doc.getTextWidth(line.replace(/ /g, ""));
      const spaceWidth = (maxWidth - lineWidth) / (words.length - 1);
      let curX = x;
      words.forEach((word, wi) => {
        doc.text(word, curX, y + i * lineHeight);
        curX += doc.getTextWidth(word) + spaceWidth;
      });
    }
  });
  return y + lines.length * lineHeight;
};

// Texto normal con salto de línea automático, retorna Y siguiente
const writeWrapped = (doc, text, x, y, maxWidth, lineHeight) => {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};

// ─── Generador principal ─────────────────────────────────────────────────────

export const generarContratoPDF = async ({
  socio,
  montoIndividual,
  cuotaInicial,
  numeroCuotas,
  montoPorCuota,
  montoRestante,
  fechaFirma,
  servicio,
}) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN_L = 22;
  const MARGIN_R = 22;
  const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
  const HEADER_H = 35;   // altura reservada para encabezado
  const FOOTER_H = 28;   // altura reservada para pie de página
  const CONTENT_TOP = HEADER_H + 8;
  const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 6;

  // Carga imágenes como base64
  const toBase64 = (src) =>
    new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        res(canvas.toDataURL("image/png"));
      };
      img.onerror = rej;
      img.src = src;
    });

  let encabezadoB64, pieB64;
  try {
    encabezadoB64 = await toBase64(encabezado);
    pieB64 = await toBase64(piePagina);
  } catch {
    console.warn("No se pudo cargar encabezado/pie de página.");
  }

  // ── Función para agregar encabezado y pie en cada página ──
  const addHeaderFooter = () => {
    if (encabezadoB64) {
      doc.addImage(encabezadoB64, "PNG", 0, 0, PAGE_W, HEADER_H);
    }
    if (pieB64) {
      doc.addImage(pieB64, "PNG", 0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H);
    }
  };

  // ── Página 1 ──
  addHeaderFooter();

  // Variables del socio
  const nombreSocio = `${socio.nombres ?? ""} ${socio.apellidos ?? ""}`.trim().toUpperCase();
  const dniSocio = socio.dni ?? "";
  const mzSocio = socio.manzana ?? "";
  const loteSocio = socio.lote ?? "";
  const fechaTexto = formatFecha(fechaFirma);

  let y = CONTENT_TOP;
  const LH_BODY = 5.5;
  const LH_TITLE = 6;

  // ── Título ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  const titulo = `CONTRATO INDIVIDUAL DE EJECUCION DE OBRA DE ${servicio.toUpperCase()}, UBICADO EN LA URBANIZACIÓN LAS CASUARINAS, DISTRITO DE PUENTE PIEDRA.`;
  const tLines = doc.splitTextToSize(titulo, CONTENT_W);
  tLines.forEach((line) => {
    doc.text(line, PAGE_W / 2, y, { align: "center" });
    y += LH_TITLE;
  });
  y += 4;

  // ── Cuerpo introductorio ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);

  const intro1 = "Conste por el presente documento el ";
  const intro1Bold = "contrato de ejecución de red de agua potable y alcantarillado";
  const intro1Rest = ` que celebran de una parte el Sr. (a) ${nombreSocio} con N° DNI ${dniSocio} domiciliado en la Urbanización Las Casuarinas, Mz. ${mzSocio} Lote ${loteSocio} Distrito de Puente Piedra, provincia y departamento de Lima; Quien en adelante se le llamará `;

  // Texto mixto (normal + bold + normal)
  doc.setFont("helvetica", "normal");
  let lineText = intro1;
  doc.setFont("helvetica", "bold");
  lineText += intro1Bold;
  doc.setFont("helvetica", "normal");
  lineText += intro1Rest;

  // Simplificado: escribir todo el bloque como normal (jsPDF no mezcla estilos en splitTextToSize)
  const parrafo1 =
    `Conste por el presente documento el contrato de ejecución de red de agua potable y alcantarillado que celebran de una parte el Sr. (a) ${nombreSocio} con N° DNI ${dniSocio} domiciliado en la Urbanización Las Casuarinas, Mz. ${mzSocio} Lote ${loteSocio} Distrito de Puente Piedra, provincia y departamento de Lima; Quien en adelante se le llamará "EL CONTRATANTE", y de la otra parte la empresa SGDS MONTENEGRO E.I.R.L, con partida N°13871508; RUC N.° 20603207085, representada por la Sra. ANA LUZ MONTENEGRO JIMENEZ con DNI 42701764, con domicilio en la ASOC. JARDINES MZ E LOTE 6 SANTA CLARA ATE; que hora en adelante se le llamará "LA CONTRATISTA", conforme los términos y condiciones siguientes.`;

  y = writeJustified(doc, parrafo1, MARGIN_L, y, CONTENT_W, LH_BODY);
  y += 5;

  // ── PRIMERO ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("PRIMERO. -ANTECEDENTES", MARGIN_L, y);
  // Subrayado manual
  const tw1 = doc.getTextWidth("PRIMERO. -ANTECEDENTES");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_L, y + 0.8, MARGIN_L + tw1, y + 0.8);
  y += LH_TITLE;

  doc.setFont("helvetica", "normal");
  const p2 =
    'LOS CONTRATANTES declaran ser propietarios y representantes de los socios que se mencionan en líneas arriba y por acuerdo de asamblea realizada en el noviembre del año 2019, en la que aprueban el presupuesto de obra unánimamente y contratar a la empresa contratista, A fin de que esta ejecute el proyecto de servicios de agua potable, alcantarillado y electrificación.';
  y = writeJustified(doc, p2, MARGIN_L, y, CONTENT_W, LH_BODY);
  y += 4;

  // ── SEGUNDO ──
  doc.setFont("helvetica", "bold");
  doc.text("SEGUNDO. – EXPEDIENTE TECNICO", MARGIN_L, y);
  const tw2 = doc.getTextWidth("SEGUNDO. – EXPEDIENTE TECNICO");
  doc.line(MARGIN_L, y + 0.8, MARGIN_L + tw2, y + 0.8);
  y += LH_TITLE;

  doc.setFont("helvetica", "normal");
  const p3 =
    `LOS CONTRATANTES, contratan los servicios de LA CONTRATISTA, a fin de que este se encargue al 100% de la ejecución de obra de acuerdo con el proyecto aprobado por Sedapal hasta la entrega y recepción de obra a SEDAPAL.`;
  y = writeJustified(doc, p3, MARGIN_L, y, CONTENT_W, LH_BODY);
  y += 3;

  const p4 =
    "LA CONTRATISTA debe ejecutar la obra conforme los términos técnicos por la supervisión de Sedapal y dentro de los plazos establecidos por la Municipalidad.";
  y = writeJustified(doc, p4, MARGIN_L, y, CONTENT_W, LH_BODY);
  y += 4;

  // ── TERCERO ──
  doc.setFont("helvetica", "bold");
  doc.setFont("helvetica", "bolditalic");
  doc.text("TERCERO: TIEMPO DE EJECUCIÓN DE OBRA", MARGIN_L, y);
  const tw3 = doc.getTextWidth("TERCERO: TIEMPO DE EJECUCIÓN DE OBRA");
  doc.line(MARGIN_L, y + 0.8, MARGIN_L + tw3, y + 0.8);
  y += LH_TITLE;

  doc.setFont("helvetica", "italic");
  const p5 =
    "El tiempo de ejecución de obra será de 360 días hábiles, a partir de apertura de cuaderno de obra por Sedapal. Así mismo, el plazo de ejecución de obra se efectuará dependiendo del cumplimiento de pagos por los contratantes en las fechas indicadas en la cláusula cuarta - Contraprestación y forma de pago.";
  y = writeJustified(doc, p5, MARGIN_L, y, CONTENT_W, LH_BODY);
  y += 4;

  // ── CUARTA ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("CUARTA: CONTRAPRESTACIÓN Y FORMA DE PAGO", MARGIN_L, y);
  const tw4 = doc.getTextWidth("CUARTA: CONTRAPRESTACIÓN Y FORMA DE PAGO");
  doc.line(MARGIN_L, y + 0.8, MARGIN_L + tw4, y + 0.8);
  y += LH_TITLE;

  doc.setFont("helvetica", "normal");

  // Ítem 1
  const item1 = `1.   El monto individual a pagar por lote, asciende a ${formatSoles(montoIndividual)}, en la que se pagará de la siguiente forma:`;
  y = writeJustified(doc, item1, MARGIN_L, y, CONTENT_W, LH_BODY);
  y += 2;

  // Bullet: cuota inicial
  const bullet1 = `•   Cuota Inicial de ${formatSoles(cuotaInicial)} soles se realizará en la firma de contrato.`;
  y = writeJustified(doc, bullet1, MARGIN_L + 6, y, CONTENT_W - 6, LH_BODY);
  y += 2;

  // Bullet: cuotas mensuales
  const bullet2 = `•   La cuota de inicio de obra de ${formatSoles(montoRestante)}, distribuido en ${numeroCuotas} cuotas (${formatSoles(montoPorCuota)} por cada mes) que se deberá realizar el pago entre las fechas 30 hasta el 05 de cada mes.`;
  y = writeJustified(doc, bullet2, MARGIN_L + 6, y, CONTENT_W - 6, LH_BODY);
  y += 3;

  // Mora
  const pMora =
    "En caso de no realizar el pago en las fechas indicadas se pagará un monto de S/20.00 adicionales por mora.";
  y = writeJustified(doc, pMora, MARGIN_L, y, CONTENT_W, LH_BODY);
  y += 4;

  // Cuentas bancarias
  const pBanco =
    "Los montos y fechas indicadas, se abonará a la cuenta del Banco Continental 00110750020 0023496 - Ana Luz Montenegro Jimenez / Banco de Crédito 19106795688029 – Ingrid Lucero Ochoa Montenegro. Asimismo, el contratante deberá canjear o emitir el Boucher de pago a la Empresa.";
  y = writeJustified(doc, pBanco, MARGIN_L, y, CONTENT_W, LH_BODY);
  y += 5;

  // ── ¿Necesita nueva página? ──
  if (y > CONTENT_BOTTOM - 40) {
    doc.addPage();
    addHeaderFooter();
    y = CONTENT_TOP;
  }

  // ── QUINTA ──
  doc.setFont("helvetica", "bold");
  doc.text("QUINTA: PENALIDADES DE LAS PARTES", MARGIN_L, y);
  const tw5 = doc.getTextWidth("QUINTA: PENALIDADES DE LAS PARTES");
  doc.line(MARGIN_L, y + 0.8, MARGIN_L + tw5, y + 0.8);
  y += LH_TITLE;

  doc.setFont("helvetica", "normal");
  doc.text("Las partes convienen en que tendrán las siguientes Penalidades:", MARGIN_L, y);
  y += LH_BODY + 2;

  const p6 =
    "EL CONTRATANTE, de no cumplir con los pagos dentro de las fechas señaladas en la Cláusula cuarta, asumirá los gastos adicionales como Moras, Intereses, Gastos administrativos y Notariales. Dicho interés será el 1.5% por cada día de atraso.";
  y = writeJustified(doc, p6, MARGIN_L + 5, y, CONTENT_W - 5, LH_BODY);
  y += 3;

  const p7 =
    "LA CONTRATISTA, de no cumplir la ejecución de obra en los plazos mencionados en la cláusula Tercera, asumirá los gastos adicionales como Moras, Intereses, Gastos administrativos y Notariales. Dicho interés será el 1.5% por cada día de atraso.";
  y = writeJustified(doc, p7, MARGIN_L + 5, y, CONTENT_W - 5, LH_BODY);
  y += 5;

  // ── SEXTA ──
  doc.setFont("helvetica", "bold");
  doc.text("SEXTA: NOTIFICACIONES", MARGIN_L, y);
  const tw6 = doc.getTextWidth("SEXTA: NOTIFICACIONES");
  doc.line(MARGIN_L, y + 0.8, MARGIN_L + tw6, y + 0.8);
  y += LH_TITLE;

  doc.setFont("helvetica", "normal");
  const p8 =
    "Las partes contratantes renuncian al fuero de su domicilio y se someten a la jurisdicción de los jueces de Lima, para todos los efectos de este contrato, señalando como sus domicilios los indicados en el encabezamiento; lugar a donde se tendrá a bien hacer las notificaciones y avisos a que haya lugar.";
  y = writeJustified(doc, p8, MARGIN_L, y, CONTENT_W, LH_BODY);
  y += 4;

  const p9 = `Las partes declaran expresamente en el que están de acuerdo en todas y cada una de las cláusulas que anteceden y en señal de conformidad, lo firman ambas partes, en Lima, ${fechaTexto}.`;
  y = writeJustified(doc, p9, MARGIN_L, y, CONTENT_W, LH_BODY);
  y += 14;

  // ── Firmas ──
  if (y > CONTENT_BOTTOM - 35) {
    doc.addPage();
    addHeaderFooter();
    y = CONTENT_TOP;
  }

  const col1X = MARGIN_L + 10;
  const col2X = PAGE_W / 2 + 10;
  const firmaW = 60;

  // Líneas de firma
  doc.setLineWidth(0.3);
  doc.setDrawColor(0);
  doc.line(col1X, y, col1X + firmaW, y);
  doc.line(col2X, y, col2X + firmaW, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("SGDS MONTENEGRO E.I.R.L", col1X, y);
  doc.text(nombreSocio, col2X, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.text("RUC N° 20603207085", col1X, y);
  doc.text(`DNI: ${dniSocio}`, col2X, y);
  y += 14;

  // Firma central gerente
  const centerX = PAGE_W / 2 - 30;
  doc.line(centerX, y, centerX + 60, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("SGDS MONTENEGRO E.I.R.L.", PAGE_W / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("Ana Montenegro Jimenez", PAGE_W / 2, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "italic");
  doc.text("GERENTE GENERAL", PAGE_W / 2, y, { align: "center" });

  // ── Guardar ──
  const nombreArchivo = `Contrato_${nombreSocio.replace(/\s+/g, "_")}_Mz${mzSocio}L${loteSocio}.pdf`;
  doc.save(nombreArchivo);
};