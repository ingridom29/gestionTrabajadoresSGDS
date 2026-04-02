"""
Script de importación: Casuarinas → Supabase
Importa socios desde ListadoClientes + socios faltantes desde PagosRegistrados
Luego importa todos los pagos vinculados por socio_id
"""

import pandas as pd
from supabase import create_client
from datetime import datetime

# ─── CONFIGURACIÓN ─────────────────────────────────────────────────────────────
SUPABASE_URL = "https://lhrskkacenvypcnnkwxy.supabase.co"       # ← reemplaza
SUPABASE_KEY = "sb_publishable_OOEZVXNRrL6rS_NjanOOdg_sGnCE1tC"  # ← reemplaza
EXCEL_PATH   = "C:/Users/Ingrid/Downloads/RegistroPagos.xlsx"    # ← pon la ruta completa si es necesario
# ────────────────────────────────────────────────────────────────────────────────

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── 1. Leer Excel ───────────────────────────────────────────────────────────────
print("Leyendo Excel...")
clientes = pd.read_excel(EXCEL_PATH, sheet_name="ListadoClientes")
pagos_df  = pd.read_excel(EXCEL_PATH, sheet_name="PagosRegistrados")

# Normalizar columna Lote a string
clientes["Lote"]  = clientes["Lote"].astype(str).str.strip()
pagos_df["Lote"]  = pagos_df["Lote"].astype(str).str.strip()
clientes["Dni"]   = clientes["Dni"].astype(str).str.strip().str.replace(".0","",regex=False)
pagos_df["Dni"]   = pagos_df["Dni"].fillna("").astype(str).str.replace(".0","",regex=False).str.strip()
clientes["Celular"] = clientes["Celular"].fillna("").astype(str).str.replace(".0","",regex=False).str.strip()
pagos_df["Celular"] = pagos_df["Celular"].fillna("").astype(str).str.replace(".0","",regex=False).str.strip()

# ── 2. Socios faltantes (en pagos pero no en ListadoClientes) ──────────────────
clientes_key = set(zip(clientes["Sector"], clientes["Mz"], clientes["Lote"]))
pagos_df["_key"] = list(zip(pagos_df["Sector"], pagos_df["Mz"], pagos_df["Lote"]))

faltantes_mask = ~pagos_df["_key"].isin(clientes_key)
faltantes = (
    pagos_df[faltantes_mask]
    .drop_duplicates(subset=["Sector","Mz","Lote"])
    [["Sector","Mz","Lote","Apellido","Nombre","Dni","Celular","Servicio"]]
    .copy()
)
faltantes["MontoContratado"] = 7500
faltantes["Servicio"] = faltantes["Servicio"].fillna("Agua, Desagüe y Electrificación")

print(f"Socios en ListadoClientes: {len(clientes)}")
print(f"Socios faltantes (solo en pagos): {len(faltantes)}")

# ── 3. Unir todos los socios ────────────────────────────────────────────────────
todos = pd.concat([
    clientes.rename(columns={"Apellido":"Apellido","Nombre":"Nombre"}),
    faltantes
], ignore_index=True)

todos["Apellido"]  = todos["Apellido"].fillna("").str.strip()
todos["Nombre"]    = todos["Nombre"].fillna("").str.strip()
todos["Servicio"]  = todos["Servicio"].fillna("Agua, Desagüe y Electrificación")
todos["MontoContratado"] = pd.to_numeric(todos["MontoContratado"], errors="coerce").fillna(7500)

# ── 4. Insertar socios en Supabase ─────────────────────────────────────────────
print("\nInsertando socios...")
socio_map = {}  # key (sector, mz, lote) → uuid

for _, row in todos.iterrows():
    data = {
        "sector":          int(row["Sector"]),
        "manzana":         str(row["Mz"]).strip(),
        "lote":            str(row["Lote"]).strip(),
        "dni":             str(row["Dni"]).strip() if row["Dni"] else None,
        "apellidos":       row["Apellido"],
        "nombres":         row["Nombre"] if row["Nombre"] else None,
        "celular":         str(row["Celular"]).strip() if row["Celular"] else None,
        "servicio":        row["Servicio"],
        "monto_contratado": float(row["MontoContratado"]),
    }
    try:
        res = supabase.table("socios_casuarinas").insert(data).execute()
        inserted = res.data[0]
        key = (int(row["Sector"]), str(row["Mz"]).strip(), str(row["Lote"]).strip())
        socio_map[key] = inserted["id"]
    except Exception as e:
        print(f"  Error socio {row['Sector']}-{row['Mz']}-{row['Lote']}: {e}")

print(f"Socios insertados: {len(socio_map)}")

# ── 5. Insertar pagos ──────────────────────────────────────────────────────────
print("\nInsertando pagos...")
ok = 0
err = 0

for _, row in pagos_df.iterrows():
    key = (int(row["Sector"]), str(row["Mz"]).strip(), str(row["Lote"]).strip())
    socio_id = socio_map.get(key)

    if not socio_id:
        print(f"  Sin socio_id para {key}, omitiendo pago")
        err += 1
        continue

    # Parsear fecha
    fecha = None
    if pd.notna(row["Fecha"]):
        try:
            if isinstance(row["Fecha"], datetime):
                fecha = row["Fecha"].strftime("%Y-%m-%d")
            else:
                fecha = pd.to_datetime(str(row["Fecha"]), dayfirst=True, errors="coerce")
                fecha = fecha.strftime("%Y-%m-%d") if pd.notna(fecha) else None
        except:
            fecha = None

    # Monto
    try:
        monto = float(str(row["Monto"]).replace("S/","").replace(",",".").strip())
    except:
        err += 1
        continue

    if monto <= 0:
        continue

    # Medio de pago normalizado
    medio = str(row["MedioPago"]).strip().upper() if pd.notna(row["MedioPago"]) else "EFECTIVO"
    if medio in ["BCP","BBVA"]:
        medio = "Depósito"
    elif medio == "YAPE":
        medio = "Yape / Plin"
    elif medio == "EFECTIVO":
        medio = "Efectivo"
    else:
        medio = "Transferencia"

    data = {
        "socio_id":  socio_id,
        "fecha":     fecha,
        "medio_pago": medio,
        "operacion": str(row["Operacion"]).strip() if pd.notna(row["Operacion"]) else None,
        "monto":     monto,
    }

    try:
        supabase.table("pagos_casuarinas").insert(data).execute()
        ok += 1
    except Exception as e:
        print(f"  Error pago {key}: {e}")
        err += 1

print(f"\n✅ Pagos insertados: {ok}")
print(f"⚠️  Errores: {err}")
print("\n¡Importación completa!")