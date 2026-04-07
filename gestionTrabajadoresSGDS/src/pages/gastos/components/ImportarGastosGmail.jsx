import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabase/client';
import styles from '../../../styles/gastos/ImportarGastosGmail.module.css';

const CLIENT_ID = '398456466014-m74i2k0p2lqp1b48q2e5bogfsh47nl8m.apps.googleusercontent.com';
const SCOPES    = 'https://www.googleapis.com/auth/gmail.readonly';

// ── Helpers ───────────────────────────────────────────────────────────────────

function htmlATexto(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extraerMonto(texto, ...regexes) {
  for (const re of regexes) {
    const m = texto.match(re);
    if (m) return parseFloat(m[1].replace(/,/g, ''));
  }
  return null;
}

function extraerTexto(texto, re) {
  const m = texto.match(re);
  return m ? m[1].trim() : null;
}

function categorizarEmpresa(empresa = '') {
  const e = empresa.toUpperCase();
  if (e.match(/NETFLIX|SPOTIFY|GOOGLE|AMAZON|APPLE|DISNEY|HBO|OPENAI|CHATGPT/)) return 'Servicios / Internet';
  if (e.match(/ENTEL|CLARO|MOVISTAR|BITEL/))      return 'Servicios / Internet';
  if (e.match(/LUZ DEL SUR|ENEL|EDELNOR|SEDAPAL/)) return 'Servicios / Internet';
  if (e.match(/GRIFO|PETRO|REPSOL|PRIMAX|SHELL/))  return 'Combustible';
  if (e.match(/UBER|TAXI|CABIFY|BEAT|INDRIVER/))   return 'Movilidad';
  if (e.match(/WONG|PLAZA|TOTTUS|VIVANDA|TAMBO|MASS|RAPPI|JUSTO/)) return 'Alimentación';
  if (e.match(/FARMACIA|INKAFARMA|MIFARMA/))        return 'Salud';
  if (e.match(/USIL|PUCP|UPC|UPN|COLEGIO/))        return 'Educación';
  if (e.match(/TUBOPLAST|MAESTRO|SODIMAC|PROMART/)) return 'Materiales';
  return 'Otros';
}

function extraerBody(msg) {
  let bodyRaw = '';
  const partes = msg.payload?.parts || [];
  if (partes.length > 0) {
    const html  = partes.find(p => p.mimeType === 'text/html');
    const plain = partes.find(p => p.mimeType === 'text/plain');
    const parte = html || plain;
    if (parte?.body?.data) {
      bodyRaw = atob(parte.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
  } else if (msg.payload?.body?.data) {
    bodyRaw = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  return htmlATexto(bodyRaw);
}

// ── Parser principal ──────────────────────────────────────────────────────────

function parsearMensaje(msg) {
  const headers = msg.payload?.headers || [];
  const subject = headers.find(h => h.name === 'Subject')?.value || '';
  const date    = headers.find(h => h.name === 'Date')?.value    || '';
  const fecha   = date ? new Date(date).toISOString().split('T')[0]
                       : new Date().toISOString().split('T')[0];
  const snippet = msg.snippet || '';
  const texto   = extraerBody(msg) + ' ' + snippet;

  // ── IGNORAR: ingresos y operaciones que no son gastos ───────────────────
  if (subject.includes('recepción de Yapeo'))        return null; // yapeo recibido
  if (subject.includes('rechazó'))                   return null; // compra rechazada
  if (subject.includes('devolución'))                return null; // devolución
  if (subject.includes('Entre mis Cuentas'))         return null; // transferencia propia
  if (subject.includes('encuesta') || subject.includes('Recordatorio')) return null;

  // ── BCP: consumo tarjeta débito ──────────────────────────────────────────
  if (subject.includes('consumo con tu Tarjeta de Débito')) {
    const monto   = extraerMonto(texto,
      /Total del consumo\s+S\/\s*([\d,]+\.?\d*)/i,
      /consumo de\s+S\/\s*([\d,]+\.?\d*)/i,
    );
    const empresa = extraerTexto(texto, /Empresa\s+([A-Z0-9*\s&.\-]+?)(?:\s{2,}|Número|Fecha)/i)
                 || extraerTexto(snippet, /en\s+([A-Z0-9*\s]+?)\./i);
    const nroOp   = extraerTexto(texto, /Número de operación\s+(\d+)/i);
    if (!monto) return null;
    return {
      cuenta: 'BCP', monto, fecha,
      descripcion: empresa ? `Consumo en ${empresa.trim()}` : 'Consumo Tarjeta Débito BCP',
      comprobante: nroOp || '',
      categoria:   categorizarEmpresa(empresa || ''),
    };
  }

  // ── BCP: operación con tarjeta de crédito ────────────────────────────────
  if (subject.includes('operación con tu Tarjeta de Crédito')) {
    const monto   = extraerMonto(texto,
      /Total de la operación\s+S\/\s*([\d,]+\.?\d*)/i,
      /operación de\s+S\/\s*([\d,]+\.?\d*)/i,
    );
    const empresa = extraerTexto(texto, /Empresa\s+([A-Z0-9*\s&.\-]+?)(?:\s{2,}|Número|Fecha)/i)
                 || extraerTexto(snippet, /en\s+([A-Z0-9*\s]+?)\./i);
    const nroOp   = extraerTexto(texto, /Número de operación\s+(\d+)/i);
    if (!monto) return null;
    return {
      cuenta: 'BCP', monto, fecha,
      descripcion: empresa ? `Consumo en ${empresa.trim()}` : 'Consumo Tarjeta Crédito BCP',
      comprobante: nroOp || '',
      categoria:   categorizarEmpresa(empresa || ''),
    };
  }

  // ── BCP: transferencia a otros bancos (interbancaria) ────────────────────
  if (subject.includes('Transferencia a Otros Bancos')) {
    const monto   = extraerMonto(texto,
      /Monto enviado\s+S\/\s*([\d,]+\.?\d*)/i,
      /transferencia de\s+S\/\s*([\d,]+\.?\d*)/i,
    );
    const destino = extraerTexto(texto, /(?:Destinatario|Nombre del destinatario)\s+([^\n]{3,50})/i);
    const nroOp   = extraerTexto(texto, /Número de operación\s+(\d+)/i);
    if (!monto) return null;
    return {
      cuenta: 'BCP', monto, fecha,
      descripcion: destino ? `Transferencia a ${destino.trim()}` : 'Transferencia a otros bancos',
      comprobante: nroOp || '',
      categoria:   'Transferencia',
    };
  }

  // ── BCP: transferencia a terceros BCP ────────────────────────────────────
  if (subject.includes('Transferencia a Terceros BCP')) {
    const monto   = extraerMonto(texto,
      /Monto transferido\s+S\/\s*([\d,]+\.?\d*)/i,
      /transferencia de\s+S\/\s*([\d,]+\.?\d*)/i,
    );
    const destino = extraerTexto(texto, /(?:Destinatario|Nombre del destinatario)\s+([^\n]{3,50})/i);
    const nroOp   = extraerTexto(texto, /Número de operación\s+(\d+)/i);
    if (!monto) return null;
    return {
      cuenta: 'BCP', monto, fecha,
      descripcion: destino ? `Transferencia a ${destino.trim()}` : 'Transferencia a terceros BCP',
      comprobante: nroOp || '',
      categoria:   'Transferencia',
    };
  }

  // ── BCP: pago de servicio (Entel, Claro, Sedapal, Luz del Sur, etc.) ─────
  if (subject.includes('CONSTANCIA DE PAGO DE SERVICIO')) {
    // El monto viene en el snippet: "Número de operación: XXXX Fecha y hora: ... Empresa: ENTEL"
    const monto   = extraerMonto(snippet, /S\/\s*([\d,]+\.?\d*)/i)
                 || extraerMonto(texto, /Monto[:\s]+S\/\s*([\d,]+\.?\d*)/i);
    const empresa = extraerTexto(snippet, /Empresa:\s*([^\s,]+(?:\s+[^\s,]+)*?)(?:\s+Servicio:|$)/i)
                 || extraerTexto(texto,   /Empresa:\s*([^\n]{2,40})/i);
    const nroOp   = extraerTexto(snippet, /Número de operación:\s*(\d+)/i)
                 || extraerTexto(texto,   /Número de operación:\s*(\d+)/i);
    if (!monto) return null;
    return {
      cuenta: 'BCP', monto, fecha,
      descripcion: empresa ? `Pago ${empresa.trim()}` : 'Pago de servicio BCP',
      comprobante: nroOp || '',
      categoria:   categorizarEmpresa(empresa || ''),
    };
  }

  // ── BCP: disposición de efectivo (avance tarjeta crédito) ────────────────
  if (subject.includes('DISPOSICION DE EFECTIVO')) {
    const monto = extraerMonto(texto,
      /Monto retirado\s+S\/\s*([\d,]+\.?\d*)/i,
      /disposición de efectivo de\s+S\/\s*([\d,]+\.?\d*)/i,
    );
    if (!monto) return null;
    return {
      cuenta: 'BCP', monto, fecha,
      descripcion: 'Disposición de efectivo BCP',
      comprobante: '',
      categoria:   'Otros',
    };
  }

  // ── BCP: retiro en cajero ────────────────────────────────────────────────
  if (subject.includes('retiro en un cajero')) {
    const monto = extraerMonto(texto,
      /Total retirado\s+S\/\s*([\d,]+\.?\d*)/i,
      /retiro de\s+S\/\s*([\d,]+\.?\d*)/i,
    );
    if (!monto) return null;
    return {
      cuenta: 'BCP', monto, fecha,
      descripcion: 'Retiro en cajero BCP',
      comprobante: '',
      categoria:   'Otros',
    };
  }

  // ── BCP: Yapeo a celular enviado desde app BCP ───────────────────────────
  if (subject.includes('Constancia de Yapeo a Celular')) {
    const monto   = extraerMonto(texto,
      /Monto enviado\s+S\/\s*([\d,]+\.?\d*)/i,
      /yapeo a celular de\s+S\/\s*([\d,]+\.?\d*)/i,
    );
    const destino = extraerTexto(texto, /Enviado a\s+([^\n]{3,50})/i)
                 || extraerTexto(texto, /Destinatario\s+([^\n]{3,50})/i);
    const nroOp   = extraerTexto(texto, /Número de operación\s+(\d+)/i);
    if (!monto) return null;
    return {
      cuenta: 'Yape', monto, fecha,
      descripcion: destino ? `Yape a ${destino.trim()}` : 'Yapeo a celular',
      comprobante: nroOp || '',
      categoria:   'Otros',
    };
  }

  return null;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function ImportarGastosGmail({ onImportado }) {
  const [gapiListo,   setGapiListo]   = useState(false);
  const [leyendo,     setLeyendo]     = useState(false);
  const [guardando,   setGuardando]   = useState(false);
  const [gastos,      setGastos]      = useState([]);
  const [seleccion,   setSeleccion]   = useState([]);
  const [resumen,     setResumen]     = useState(null);
  const [error,       setError]       = useState('');

  useEffect(() => {
    if (window.google?.accounts) { setGapiListo(true); return; }
    const script = document.createElement('script');
    script.src   = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => setGapiListo(true);
    document.head.appendChild(script);
  }, []);

  const conectarYLeer = useCallback(() => {
    if (!gapiListo) return;
    setError('');
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope:     SCOPES,
      callback:  async (tokenResponse) => {
        if (tokenResponse.error) {
          setError('Error al conectar con Google: ' + tokenResponse.error);
          return;
        }
        await leerCorreos(tokenResponse.access_token);
      },
    });
    client.requestAccessToken();
  }, [gapiListo]);

  async function leerCorreos(token) {
    setLeyendo(true);
    setGastos([]);
    setSeleccion([]);
    setResumen(null);
    try {
      const query = `from:notificaciones@notificacionesbcp.com.pe after:2026/01/30`;
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const listData = await listRes.json();
      const mensajes = listData.messages || [];

      if (mensajes.length === 0) {
        setError('No se encontraron correos bancarios desde el 30 de enero.');
        setLeyendo(false);
        return;
      }

      const detalles = await Promise.all(
        mensajes.slice(0, 80).map(m =>
          fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
          ).then(r => r.json())
        )
      );

      const gastosDetectados = detalles
        .map(parsearMensaje)
        .filter(Boolean)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      if (gastosDetectados.length === 0) {
        setError('Se encontraron correos pero ninguno corresponde a un gasto saliente.');
        setLeyendo(false);
        return;
      }

      setGastos(gastosDetectados);
      setSeleccion(gastosDetectados.map((_, i) => i));
    } catch (e) {
      setError('Error al leer correos: ' + e.message);
    }
    setLeyendo(false);
  }

  async function guardarSeleccion() {
    setGuardando(true);
    const aGuardar = gastos.filter((_, i) => seleccion.includes(i));
    for (const g of aGuardar) {
      await supabase.from('gastos_personales').insert({
        fecha:           g.fecha,
        quien:           'asistenta',
        cuenta_bancaria: g.cuenta,
        categoria:       g.categoria,
        descripcion:     g.descripcion,
        monto:           g.monto,
        comprobante:     g.comprobante,
      });
    }
    setResumen({
      total: aGuardar.length,
      monto: aGuardar.reduce((a, g) => a + g.monto, 0),
    });
    setGuardando(false);
    setGastos([]);
    setSeleccion([]);
    if (onImportado) onImportado();
  }

  function toggleSeleccion(i) {
    setSeleccion(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  }

  function reiniciar() {
    setResumen(null);
    setError('');
    setGastos([]);
    setSeleccion([]);
  }

  const fmt = n => Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2 });

  return (
    <div className={styles.wrap}>
      {/* Banner */}
      <div className={styles.banner}>
        <div className={styles.bannerIcono}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M1 3h14v10a1 1 0 01-1 1H2a1 1 0 01-1-1V3z" stroke="#1A2F5E" strokeWidth="1.4"/>
            <path d="M1 3l7 6 7-6" stroke="#1A2F5E" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>
        <div className={styles.bannerTexto}>
          <div className={styles.bannerTitulo}>Importar gastos desde Gmail</div>
          <div className={styles.bannerSub}>Lee automáticamente tus notificaciones BCP desde el 30 de enero</div>
        </div>
        {!leyendo && !guardando && gastos.length === 0 && !resumen && (
          <button className={styles.btnLeer} onClick={conectarYLeer} disabled={!gapiListo}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M13 8A5 5 0 113 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M13 8V4M13 8H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            {gapiListo ? 'Conectar Gmail' : 'Cargando...'}
          </button>
        )}
        {resumen && (
          <button className={styles.btnSecundario} onClick={reiniciar}>Nueva importación</button>
        )}
      </div>

      {leyendo && (
        <div className={styles.estadoMsg}>
          <div className={styles.spinner} />
          Leyendo correos bancarios...
        </div>
      )}

      {guardando && (
        <div className={styles.estadoMsg}>
          <div className={styles.spinner} />
          Registrando gastos en Supabase...
        </div>
      )}

      {error && <div className={styles.errorMsg}>{error}</div>}

      {!leyendo && !guardando && gastos.length > 0 && (
        <div className={styles.confirmacion}>
          <div className={styles.confirmacionHeader}>
            <div className={styles.confirmacionTitulo}>
              {gastos.length} gasto{gastos.length !== 1 ? 's' : ''} detectado{gastos.length !== 1 ? 's' : ''} — selecciona los que quieres registrar
            </div>
            <button
              className={styles.btnToggleTodos}
              onClick={() => setSeleccion(
                seleccion.length === gastos.length ? [] : gastos.map((_, i) => i)
              )}
            >
              {seleccion.length === gastos.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Fecha</th>
                  <th>Cuenta</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((g, i) => (
                  <tr
                    key={i}
                    className={seleccion.includes(i) ? styles.filaSeleccionada : styles.filaDesactivada}
                    onClick={() => toggleSeleccion(i)}
                  >
                    <td>
                      <div className={`${styles.checkbox} ${seleccion.includes(i) ? styles.checkboxActivo : ''}`}>
                        {seleccion.includes(i) && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </td>
                    <td>{g.fecha}</td>
                    <td>
                      <span className={`${styles.cuentaBadge} ${g.cuenta === 'BCP' ? styles.cuentaBCP : styles.cuentaYape}`}>
                        {g.cuenta}
                      </span>
                    </td>
                    <td>{g.descripcion}</td>
                    <td><span className={styles.badge}>{g.categoria}</span></td>
                    <td className={styles.monto}>S/ {fmt(g.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.confirmacionFooter}>
            <span className={styles.resumenSel}>
              {seleccion.length} seleccionado{seleccion.length !== 1 ? 's' : ''} · Total: S/ {fmt(
                gastos.filter((_, i) => seleccion.includes(i)).reduce((a, g) => a + g.monto, 0)
              )}
            </span>
            <div className={styles.footerBtns}>
              <button className={styles.btnSecundario} onClick={reiniciar}>Cancelar</button>
              <button
                className={styles.btnGuardar}
                onClick={guardarSeleccion}
                disabled={seleccion.length === 0}
              >
                Registrar {seleccion.length} gasto{seleccion.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {resumen && (
        <div className={styles.exitoBanner}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#15803d" strokeWidth="1.4"/>
            <path d="M5 8l2 2 4-4" stroke="#15803d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>
            <strong>{resumen.total} gasto{resumen.total !== 1 ? 's' : ''}</strong> registrados · Total: <strong>S/ {fmt(resumen.monto)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}