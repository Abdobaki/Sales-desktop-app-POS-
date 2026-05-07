import { useEffect, useState } from 'react';
import { Store, CreditCard, Bell, Shield, Save, RefreshCw } from 'lucide-react';
import {
  getNotificationPreferences,
  getPaymentMethods,
  getStoreSettings,
  saveNotificationPreferences,
  savePaymentMethods,
  saveStoreSettings,
  subscribeSettings,
  type PaymentMethodSetting,
  type StoreSettings,
} from './data/settings';
import { getErrorMessage } from './data/shared';

type SettingsSectionProps = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

function SettingsSection({ title, description, icon: Icon, children, footer }: SettingsSectionProps) {
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
      {footer && <div className="mt-6 flex justify-end">{footer}</div>}
    </div>
  );
}

export function SettingsView() {
  const [storeForm, setStoreForm] = useState<StoreSettings>(getStoreSettings());
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSetting[]>(getPaymentMethods());
  const [notifications, setNotifications] = useState(getNotificationPreferences());
  const [savingSection, setSavingSection] = useState<'store' | 'payments' | 'notifications' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    return subscribeSettings(() => {
      setStoreForm(getStoreSettings());
      setPaymentMethods(getPaymentMethods());
      setNotifications(getNotificationPreferences());
    });
  }, []);

  const setField = (field: keyof StoreSettings, value: string | number) => {
    setStoreForm((prev) => ({ ...prev, [field]: value }));
    setStatusMessage(null);
  };

  const handleSaveStore = async () => {
    setSavingSection('store');
    setStatusMessage(null);
    try {
      await saveStoreSettings({
        storeName: storeForm.storeName.trim(),
        email: storeForm.email.trim(),
        phone: storeForm.phone.trim(),
        address: storeForm.address.trim(),
        lowStockThreshold: Math.max(0, Math.trunc(Number(storeForm.lowStockThreshold) || 0)),
        currencyCode: storeForm.currencyCode.trim() || 'DZD',
      });
      setStatusMessage({ type: 'success', text: 'Store settings saved.' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setSavingSection(null);
    }
  };

  const handleSavePayments = async () => {
    setSavingSection('payments');
    setStatusMessage(null);
    try {
      await savePaymentMethods(paymentMethods);
      setStatusMessage({ type: 'success', text: 'Payment methods saved.' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveNotifications = async () => {
    setSavingSection('notifications');
    setStatusMessage(null);
    try {
      await saveNotificationPreferences({
        lowStockAlertsEnabled: notifications.lowStockAlertsEnabled,
        dailySalesSummaryEnabled: notifications.dailySalesSummaryEnabled,
        newCustomerSignupsEnabled: notifications.newCustomerSignupsEnabled,
      });
      setStatusMessage({ type: 'success', text: 'Notification preferences saved.' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setSavingSection(null);
    }
  };

  const togglePaymentMethod = (code: string) => {
    setPaymentMethods((prev) =>
      prev.map((method) =>
        method.code === code ? { ...method, enabled: !method.enabled } : method
      )
    );
    setStatusMessage(null);
  };

  const toggleNotification = (key: keyof Omit<typeof notifications, 'id' | 'updatedAt'>) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    setStatusMessage(null);
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1>Settings</h1>
          <p className="text-muted-foreground mt-1">Configure store preferences</p>
        </div>
        {statusMessage && (
          <div className={`rounded-lg px-3 py-2 text-sm ${statusMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {statusMessage.text}
          </div>
        )}
      </div>

      <div className="max-w-3xl space-y-6">
        <SettingsSection
          title="Store Information"
          description="Manage your store details, stock threshold, and currency"
          icon={Store}
          footer={
            <button
              onClick={() => void handleSaveStore()}
              disabled={savingSection === 'store'}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {savingSection === 'store' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Store Settings
            </button>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block mb-2 text-sm">Store Name</label>
              <input
                type="text"
                value={storeForm.storeName}
                onChange={(e) => setField('storeName', e.target.value)}
                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm">Email</label>
                <input
                  type="email"
                  value={storeForm.email}
                  onChange={(e) => setField('email', e.target.value)}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm">Phone</label>
                <input
                  type="tel"
                  value={storeForm.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block mb-2 text-sm">Address</label>
              <input
                type="text"
                value={storeForm.address}
                onChange={(e) => setField('address', e.target.value)}
                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm">Low Stock Threshold</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={storeForm.lowStockThreshold}
                  onChange={(e) => setField('lowStockThreshold', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm">Currency Code</label>
                <input
                  type="text"
                  value={storeForm.currencyCode}
                  onChange={(e) => setField('currencyCode', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-lg"
                  placeholder="DZD"
                />
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Payment Methods"
          description="Configure accepted payment options"
          icon={CreditCard}
          footer={
            <button
              onClick={() => void handleSavePayments()}
              disabled={savingSection === 'payments'}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {savingSection === 'payments' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Payment Methods
            </button>
          }
        >
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <label key={method.code} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={method.enabled}
                  onChange={() => togglePaymentMethod(method.code)}
                  className="w-5 h-5 rounded border-border"
                />
                <span>{method.label}</span>
              </label>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Notifications"
          description="Manage alert preferences"
          icon={Bell}
          footer={
            <button
              onClick={() => void handleSaveNotifications()}
              disabled={savingSection === 'notifications'}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {savingSection === 'notifications' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Notifications
            </button>
          }
        >
          <div className="space-y-3">
            {[
              { key: 'lowStockAlertsEnabled', label: 'Low stock alerts' },
              { key: 'dailySalesSummaryEnabled', label: 'Daily sales summary' },
              { key: 'newCustomerSignupsEnabled', label: 'New customer signups' },
            ].map((option) => (
              <label key={option.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications[option.key as keyof typeof notifications] as boolean}
                  onChange={() => toggleNotification(option.key as keyof Omit<typeof notifications, 'id' | 'updatedAt'>)}
                  className="w-5 h-5 rounded border-border"
                />
                <span>{option.label}</span>
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
