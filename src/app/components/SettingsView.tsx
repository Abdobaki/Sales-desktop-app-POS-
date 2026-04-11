import { Store, CreditCard, Bell, Shield } from 'lucide-react';

type SettingsSectionProps = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
};

function SettingsSection({ title, description, icon: Icon, children }: SettingsSectionProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function SettingsView() {
  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="mb-6">
        <h1>Settings</h1>
        <p className="text-muted-foreground mt-1">Configure store preferences</p>
      </div>

      <div className="max-w-3xl space-y-6">
        <SettingsSection
          title="Store Information"
          description="Manage your store details and contact information"
          icon={Store}
        >
          <div className="space-y-4">
            <div>
              <label className="block mb-2 text-sm">Store Name</label>
              <input
                type="text"
                defaultValue="Fashion Boutique"
                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm">Email</label>
                <input
                  type="email"
                  defaultValue="contact@fashionboutique.com"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm">Phone</label>
                <input
                  type="tel"
                  defaultValue="(555) 000-0000"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-lg"
                />
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Payment Methods"
          description="Configure accepted payment options"
          icon={CreditCard}
        >
          <div className="space-y-3">
            {['Credit Card', 'Debit Card', 'Cash', 'Digital Wallet'].map((method) => (
              <label key={method} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-border" />
                <span>{method}</span>
              </label>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Notifications"
          description="Manage alert preferences"
          icon={Bell}
        >
          <div className="space-y-3">
            {['Low stock alerts', 'Daily sales summary', 'New customer signups'].map((option) => (
              <label key={option} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-border" />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Security"
          description="Password and authentication settings"
          icon={Shield}
        >
          <button className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-muted">
            Change Password
          </button>
        </SettingsSection>
      </div>
    </div>
  );
}