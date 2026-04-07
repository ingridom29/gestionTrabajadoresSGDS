import { useState } from "react";
import styles from "../../styles/inventario/Inventario.module.css";
import Stock from "./components/Stock";
import Movimientos from "./components/Movimientos";
import Transferencias from "./components/Transferencias";
import Historial from "./components/Historial";
import Productos from "./components/Productos";
import Config from "./components/Config";

const TABS = [
  { key: "stock",          label: "Stock"          },
  { key: "movimientos",    label: "Movimientos"    },
  { key: "transferencias", label: "Transferencias" },
  { key: "historial",      label: "Historial"      },
  { key: "productos",      label: "Productos"      },
  { key: "config",         label: "Config"         },
];

export default function Inventario() {
  const [tabActiva, setTabActiva] = useState("stock");

  const renderTab = () => {
    switch (tabActiva) {
      case "stock":          return <Stock />;
      case "movimientos":    return <Movimientos />;
      case "transferencias": return <Transferencias />;
      case "historial":      return <Historial />;
      case "productos":      return <Productos />;
      case "config":         return <Config />;
      default:               return <Stock />;
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.tab} ${tabActiva === t.key ? styles.tabActive : ""}`}
            onClick={() => setTabActiva(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.content}>
        {renderTab()}
      </div>
    </div>
  );
}