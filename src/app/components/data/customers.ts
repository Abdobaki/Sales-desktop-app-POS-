export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  lastPurchase: string;
};

let _customers: Customer[] = [
  { id: '1', name: 'Sarah Johnson', email: 'sarah.j@email.com', phone: '(555) 123-4567', totalOrders: 12, totalSpent: 1248.88, lastPurchase: '2026-04-08' },
  { id: '2', name: 'Michael Chen', email: 'mchen@email.com', phone: '(555) 234-5678', totalOrders: 8, totalSpent: 892.45, lastPurchase: '2026-04-05' },
  { id: '3', name: 'Emma Davis', email: 'emma.davis@email.com', phone: '(555) 345-6789', totalOrders: 15, totalSpent: 2156.30, lastPurchase: '2026-04-09' },
  { id: '4', name: 'James Wilson', email: 'jwilson@email.com', phone: '(555) 456-7890', totalOrders: 5, totalSpent: 567.20, lastPurchase: '2026-04-01' },
  { id: '5', name: 'Olivia Martinez', email: 'olivia.m@email.com', phone: '(555) 567-8901', totalOrders: 20, totalSpent: 3445.75, lastPurchase: '2026-04-10' },
];

let _listeners: (() => void)[] = [];

export function getCustomers() {
  return [..._customers];
}

export function addCustomer(c: Omit<Customer, 'id' | 'totalOrders' | 'totalSpent' | 'lastPurchase'>) {
  const newCustomer: Customer = {
    ...c,
    id: `${Date.now()}`,
    totalOrders: 0,
    totalSpent: 0,
    lastPurchase: '-',
  };
  _customers = [..._customers, newCustomer];
  _listeners.forEach((l) => l());
  return newCustomer;
}

export function updateCustomer(updated: Customer) {
  _customers = _customers.map((c) => (c.id === updated.id ? updated : c));
  _listeners.forEach((l) => l());
}

export function deleteCustomer(id: string) {
  _customers = _customers.filter((c) => c.id !== id);
  _listeners.forEach((l) => l());
}

export function subscribeCustomers(listener: () => void) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}
