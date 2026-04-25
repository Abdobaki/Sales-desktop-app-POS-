import { ShoppingCart, Package, Users, BarChart3, Settings, ScanBarcode, Truck, PackageOpen } from 'lucide-react';

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { id: 'pos', label: 'POS', icon: ShoppingCart },
  { id: 'scanner', label: 'Scanner', icon: ScanBarcode },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'series', label: 'Series', icon: PackageOpen },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

type SidebarProps = {
  activeView: string;
  onViewChange: (view: string) => void;
};

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <div className="w-24 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-6 gap-2">
      <div className="mb-8 w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
        <ShoppingCart className="w-7 h-7" />
      </div>

      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-[11.5px]">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}