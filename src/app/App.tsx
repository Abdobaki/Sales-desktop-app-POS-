import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { POSView } from './components/POSView';
import { ScannerView } from './components/ScannerView';
import { InventoryView } from './components/InventoryView';
import { SeriesView } from './components/SeriesView';
import { CustomersView } from './components/CustomersView';
import { SuppliersView } from './components/SuppliersView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';

export default function App() {
  const [activeView, setActiveView] = useState('pos');

  const renderView = () => {
    switch (activeView) {
      case 'pos':
        return <POSView />;
      case 'scanner':
        return <ScannerView />;
      case 'inventory':
        return <InventoryView />;
      case 'series':
        return <SeriesView />;
      case 'customers':
        return <CustomersView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <POSView />;
    }
  };

  return (
    <div className="size-full flex bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      {renderView()}
    </div>
  );
}