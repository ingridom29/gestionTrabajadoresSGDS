import { useState } from 'react';
import GastosObra from './components/GastosObra';
import GastosPersonales from './components/GastosPersonales';
import styles from '../../styles/gastos/Gastos.module.css';

const TABS = [
  {
    id: 'obra', label: 'Gastos por Obra',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M2 13h12M4 13V7l4-4 4 4v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="6" y="10" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    id: 'personal', label: 'Gastos Personales',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function Gastos() {
  const [tabActiva, setTabActiva] = useState('obra');

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${tabActiva === tab.id ? styles.tabActiva : ''}`}
            onClick={() => setTabActiva(tab.id)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {tabActiva === 'obra'     && <GastosObra />}
      {tabActiva === 'personal' && <GastosPersonales />}
    </div>
  );
}