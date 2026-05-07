import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, ShoppingBag, AlertCircle, Calendar, Download, FileText, RefreshCw, Package, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Area, AreaChart,
} from 'recharts';
import { getDbApi, getErrorMessage } from './data/shared';
import { getStoreSettings, subscribeSettings, type StoreSettings } from './data/settings';

type SalesOrderRow = {
  id: string;
  receipt_number: string;
  customer_id: string | null;
  source_view: string;
  sold_at: string;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  payment_method_code: string | null;
  notes: string | null;
};

type SalesOrderItemRow = {
  id: string;
  sales_order_id: string;
  product_id: string | null;
  product_name_snapshot: string;
  product_sku_snapshot: string | null;
  product_barcode_snapshot: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  unit_cost_cents: number | null;
};

type CustomerRow = {
  id: string;
  name: string;
};

type ProductRow = {
  id: string;
  name: string;
  stock_qty: number;
  sale_price_cents: number;
  cost_price_cents: number;
  is_active: number;
};

type ReportSource = {
  orders: SalesOrderRow[];
  items: SalesOrderItemRow[];
  customers: CustomerRow[];
  products: ProductRow[];
};

type DailyPoint = {
  date: string;
  day: string;
  revenue: number;
  profit: number;
  orders: number;
  items: number;
};

type RecentTransaction = {
  id: string;
  customer: string;
  amount: number;
  time: string;
  items: number;
  date: string;
};

type TopProduct = {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
};

type ReportSnapshot = {
  from: string;
  to: string;
  data: DailyPoint[];
  totalRevenue: number;
  totalProfit: number;
  totalOrders: number;
  totalItems: number;
  lowStockCount: number;
  revenueChange: string;
  ordersChange: string;
  profitChange: string;
  lowStockChange: string;
  recentTransactions: RecentTransaction[];
  topProducts: TopProduct[];
  currencyCode: string;
};

type SummaryCardProps = {
  title: string;
  value: string;
  change: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: 'up' | 'down';
};

function SummaryCard({ title, value, change, icon: Icon, trend }: SummaryCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="text-sm text-muted-foreground">{title}</div>
      </div>
      <div className="mb-2">{value}</div>
      <div className={`text-sm flex items-center gap-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
        {trend === 'up' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        {change}
      </div>
    </div>
  );
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function parseOrderRow(row: Record<string, unknown>): SalesOrderRow {
  return {
    id: String(row.id ?? ''),
    receipt_number: String(row.receipt_number ?? ''),
    customer_id: row.customer_id ? String(row.customer_id) : null,
    source_view: String(row.source_view ?? 'pos'),
    sold_at: String(row.sold_at ?? new Date().toISOString()),
    subtotal_cents: Number(row.subtotal_cents ?? 0),
    discount_cents: Number(row.discount_cents ?? 0),
    tax_cents: Number(row.tax_cents ?? 0),
    total_cents: Number(row.total_cents ?? 0),
    payment_method_code: row.payment_method_code ? String(row.payment_method_code) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

function parseItemRow(row: Record<string, unknown>): SalesOrderItemRow {
  return {
    id: String(row.id ?? ''),
    sales_order_id: String(row.sales_order_id ?? ''),
    product_id: row.product_id ? String(row.product_id) : null,
    product_name_snapshot: String(row.product_name_snapshot ?? ''),
    product_sku_snapshot: row.product_sku_snapshot ? String(row.product_sku_snapshot) : null,
    product_barcode_snapshot: row.product_barcode_snapshot ? String(row.product_barcode_snapshot) : null,
    quantity: Number(row.quantity ?? 0),
    unit_price_cents: Number(row.unit_price_cents ?? 0),
    line_total_cents: Number(row.line_total_cents ?? 0),
    unit_cost_cents: row.unit_cost_cents !== null && row.unit_cost_cents !== undefined ? Number(row.unit_cost_cents) : null,
  };
}

function parseCustomerRow(row: Record<string, unknown>): CustomerRow {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? 'Walk-in Customer'),
  };
}

function parseProductRow(row: Record<string, unknown>): ProductRow {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    stock_qty: Number(row.stock_qty ?? 0),
    sale_price_cents: Number(row.sale_price_cents ?? 0),
    cost_price_cents: Number(row.cost_price_cents ?? 0),
    is_active: Number(row.is_active ?? 1),
  };
}

function getDayLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getRangeBounds(dateRange: string) {
  const today = new Date();
  let from = new Date(today);

  switch (dateRange) {
    case 'today':
      break;
    case '7days':
      from = addDays(today, -6);
      break;
    case '30days':
      from = addDays(today, -29);
      break;
    case '90days':
      from = addDays(today, -89);
      break;
    default:
      from = addDays(today, -6);
      break;
  }

  return {
    from: formatDate(from),
    to: formatDate(today),
  };
}

function daysBetween(fromStr: string, toStr: string) {
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);
  const diff = Math.round((to.getTime() - from.getTime()) / 86400000);
  return Math.max(0, diff);
}

function formatCurrency(value: number, currencyCode: string) {
  const amount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  const suffix = (currencyCode || 'DZD').toUpperCase() === 'DZD' ? 'DZ' : (currencyCode || 'DZD').toUpperCase();
  return `${amount} ${suffix}`;
}

function formatPercentChange(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return '0%';
    return '+100%';
  }

  const delta = ((current - previous) / previous) * 100;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

function filterOrdersByRange(orders: SalesOrderRow[], fromStr: string, toStr: string) {
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);
  return orders.filter((order) => {
    const soldAt = new Date(order.sold_at).getTime();
    return soldAt >= from.getTime() && soldAt <= to.getTime();
  });
}

function buildSnapshot(source: ReportSource, fromStr: string, toStr: string, settings: StoreSettings): ReportSnapshot {
  const selectedOrders = filterOrdersByRange(source.orders, fromStr, toStr);
  const selectedOrderIds = new Set(selectedOrders.map((order) => order.id));
  const selectedItems = source.items.filter((item) => selectedOrderIds.has(item.sales_order_id));
  const customerMap = new Map(source.customers.map((customer) => [customer.id, customer.name]));
  const productMap = new Map(source.products.map((product) => [product.id, product]));
  const orderItemsByOrder = new Map<string, SalesOrderItemRow[]>();

  for (const item of selectedItems) {
    const list = orderItemsByOrder.get(item.sales_order_id) ?? [];
    list.push(item);
    orderItemsByOrder.set(item.sales_order_id, list);
  }

  const totalRevenueCents = selectedOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const totalOrders = selectedOrders.length;
  const totalItems = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalProfitCents = selectedItems.reduce((sum, item) => {
    const cost = (item.unit_cost_cents ?? 0) * item.quantity;
    return sum + Math.max(0, item.line_total_cents - cost);
  }, 0);

  const lowStockCount = source.products.filter((product) => product.is_active !== 0 && Math.trunc(product.stock_qty) <= settings.lowStockThreshold).length;

  const dailyMap = new Map<string, DailyPoint>();
  const rangeLength = daysBetween(fromStr, toStr);
  const baseDate = new Date(`${fromStr}T00:00:00`);

  for (let i = 0; i <= rangeLength; i += 1) {
    const date = formatDate(addDays(baseDate, i));
    dailyMap.set(date, {
      date,
      day: getDayLabel(date),
      revenue: 0,
      profit: 0,
      orders: 0,
      items: 0,
    });
  }

  for (const order of selectedOrders) {
    const date = formatDate(new Date(order.sold_at));
    const row = dailyMap.get(date);
    if (!row) continue;

    row.orders += 1;
    row.revenue += order.total_cents / 100;
    const orderItems = orderItemsByOrder.get(order.id) ?? [];
    row.items += orderItems.reduce((sum, item) => sum + item.quantity, 0);
    row.profit += orderItems.reduce((sum, item) => {
      const cost = ((item.unit_cost_cents ?? 0) * item.quantity) / 100;
      return sum + Math.max(0, item.line_total_cents / 100 - cost);
    }, 0);
  }

  const recentTransactions = [...selectedOrders]
    .sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime())
    .slice(0, 6)
    .map((order) => {
      const orderItems = orderItemsByOrder.get(order.id) ?? [];
      const customer = order.customer_id ? customerMap.get(order.customer_id) ?? 'Walk-in Customer' : 'Walk-in Customer';
      return {
        id: order.id,
        customer,
        amount: order.total_cents / 100,
        time: new Date(order.sold_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        date: formatDate(new Date(order.sold_at)),
      } satisfies RecentTransaction;
    });

  const topMap = new Map<string, TopProduct>();
  for (const item of selectedItems) {
    const key = item.product_id || item.product_barcode_snapshot || item.product_name_snapshot;
    const current = topMap.get(key) ?? {
      id: key,
      name: item.product_id && productMap.get(item.product_id) ? productMap.get(item.product_id)!.name : item.product_name_snapshot,
      quantity: 0,
      revenue: 0,
      profit: 0,
    };

    current.quantity += item.quantity;
    current.revenue += item.line_total_cents / 100;
    current.profit += Math.max(0, (item.line_total_cents - (item.unit_cost_cents ?? 0) * item.quantity) / 100);
    topMap.set(key, current);
  }

  const topProducts = [...topMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const previousEnd = addDays(new Date(`${fromStr}T00:00:00`), -1);
  const previousStart = addDays(previousEnd, -(rangeLength));
  const prevFrom = formatDate(previousStart);
  const prevTo = formatDate(previousEnd);
  const previousOrders = filterOrdersByRange(source.orders, prevFrom, prevTo);
  const previousOrderIds = new Set(previousOrders.map((order) => order.id));
  const previousItems = source.items.filter((item) => previousOrderIds.has(item.sales_order_id));
  const previousRevenue = previousOrders.reduce((sum, order) => sum + order.total_cents / 100, 0);
  const previousProfit = previousItems.reduce((sum, item) => sum + Math.max(0, (item.line_total_cents - (item.unit_cost_cents ?? 0) * item.quantity) / 100), 0);

  return {
    from: fromStr,
    to: toStr,
    data: [...dailyMap.values()],
    totalRevenue: totalRevenueCents / 100,
    totalProfit: totalProfitCents / 100,
    totalOrders,
    totalItems,
    lowStockCount,
    revenueChange: formatPercentChange(totalRevenueCents / 100, previousRevenue),
    ordersChange: formatPercentChange(totalOrders, previousOrders.length),
    profitChange: formatPercentChange(totalProfitCents / 100, previousProfit),
    lowStockChange: `Threshold ${settings.lowStockThreshold}`,
    recentTransactions,
    topProducts,
    currencyCode: settings.currencyCode || 'DZD',
  };
}

export function ReportsView() {
  const [dateRange, setDateRange] = useState('7days');
  const today = formatDate(new Date());
  const defaultFrom = formatDate(addDays(new Date(), -6));
  const [customFrom, setCustomFrom] = useState(defaultFrom);
  const [customTo, setCustomTo] = useState(today);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<ReportSnapshot | null>(null);
  const [reportSource, setReportSource] = useState<ReportSource | null>(null);
  const [settings, setSettings] = useState<StoreSettings>(getStoreSettings());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    return subscribeSettings(() => {
      setSettings(getStoreSettings());
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadReportSource() {
      const db = getDbApi();
      if (!db) {
        setLoadError('Database is not available.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError('');

      try {
        const [orders, items, customers, products] = await Promise.all([
          db.sales_orders.list({ orderBy: 'sold_at', orderDirection: 'ASC' }),
          db.sales_order_items.list(),
          db.customers.list({ orderBy: 'name' }),
          db.products.list({ orderBy: 'name' }),
        ]);

        if (cancelled) return;

        setReportSource({
          orders: orders.map((row) => parseOrderRow(row as Record<string, unknown>)),
          items: items.map((row) => parseItemRow(row as Record<string, unknown>)),
          customers: customers.map((row) => parseCustomerRow(row as Record<string, unknown>)),
          products: products.map((row) => parseProductRow(row as Record<string, unknown>)),
        });
      } catch (error) {
        if (!cancelled) {
          setLoadError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReportSource();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentRange = useMemo(() => getRangeBounds(dateRange), [dateRange]);

  const currentReport = useMemo(() => {
    if (!reportSource) return null;
    return buildSnapshot(reportSource, currentRange.from, currentRange.to, settings);
  }, [reportSource, currentRange.from, currentRange.to, settings]);

  const exportReport = (report: ReportSnapshot) => {
    const lines = [
      `Sales Report: ${report.from} to ${report.to}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      `Total Revenue: ${formatCurrency(report.totalRevenue, report.currencyCode)}`,
      `Total Profit: ${formatCurrency(report.totalProfit, report.currencyCode)}`,
      `Total Orders: ${report.totalOrders}`,
      `Total Items Sold: ${report.totalItems}`,
      '',
      'Date,Revenue,Profit,Orders,Items',
      ...report.data.map((d) => `${d.date},${d.revenue.toFixed(2)},${d.profit.toFixed(2)},${d.orders},${d.items}`),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${report.from}-to-${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateReport = () => {
    if (!reportSource) return;
    setGeneratedReport(buildSnapshot(reportSource, customFrom, customTo, settings));
    setShowCustomRange(false);
  };

  const activeReport = generatedReport ?? currentReport;

  if (loading) {
    return (
      <div className="flex-1 p-8 overflow-auto flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Loading report data...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 p-8 overflow-auto">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {loadError}
        </div>
      </div>
    );
  }

  if (!activeReport) {
    return null;
  }

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1>Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your store performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-sm outline-none cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
            </select>
          </div>
          <button
            onClick={() => setShowCustomRange(true)}
            className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg hover:bg-muted text-sm transition-colors"
          >
            <FileText className="w-5 h-5" />
            Generate Report
          </button>
          <button
            onClick={() => exportReport(activeReport)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <SummaryCard
          title="Period Revenue"
          value={formatCurrency(activeReport.totalRevenue, activeReport.currencyCode)}
          change={`${activeReport.revenueChange} vs prev period`}
          icon={TrendingUp}
          trend={activeReport.revenueChange.startsWith('-') ? 'down' : 'up'}
        />
        <SummaryCard
          title="Total Orders"
          value={`${activeReport.totalOrders}`}
          change={`${activeReport.ordersChange} vs prev period`}
          icon={ShoppingBag}
          trend={activeReport.ordersChange.startsWith('-') ? 'down' : 'up'}
        />
        <SummaryCard
          title="Gross Profit"
          value={formatCurrency(activeReport.totalProfit, activeReport.currencyCode)}
          change={`${activeReport.profitChange} vs prev period`}
          icon={BarChart3}
          trend={activeReport.profitChange.startsWith('-') ? 'down' : 'up'}
        />
        <SummaryCard
          title="Items Low on Stock"
          value={`${activeReport.lowStockCount}`}
          change={activeReport.lowStockChange}
          icon={AlertCircle}
          trend={activeReport.lowStockCount > 0 ? 'down' : 'up'}
        />
      </div>

      {/* Sales Line Chart */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h3 className="mb-6">Sales Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={activeReport.data}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0e7490" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#0e7490" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              tickFormatter={(val: string) => {
                const d = new Date(`${val}T00:00:00`);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
              interval={activeReport.data.length > 14 ? Math.floor(activeReport.data.length / 7) : 0}
            />
            <YAxis stroke="#64748b" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [formatCurrency(value, activeReport.currencyCode), 'Revenue']}
            />
            <Area type="monotone" dataKey="revenue" stroke="#0e7490" strokeWidth={2} fill="url(#salesGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Profit Line Chart */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h3 className="mb-6">Profit Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={activeReport.data}>
            <defs>
              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              tickFormatter={(val: string) => {
                const d = new Date(`${val}T00:00:00`);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
              interval={activeReport.data.length > 14 ? Math.floor(activeReport.data.length / 7) : 0}
            />
            <YAxis stroke="#64748b" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [formatCurrency(value, activeReport.currencyCode), 'Profit']}
            />
            <Area type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={2} fill="url(#profitGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart + Sidebar Cards */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-card border border-border rounded-lg p-6">
          <h3 className="mb-6">Daily Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={activeReport.data.slice(-14)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                tickFormatter={(val: string) => {
                  const d = new Date(`${val}T00:00:00`);
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [formatCurrency(value, activeReport.currencyCode), 'Revenue']}
              />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {activeReport.data.slice(-14).map((entry) => (
                  <Cell key={`bar-${entry.date}`} fill="#0e7490" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="mb-6">Recent Transactions</h3>
            <div className="space-y-4">
              {activeReport.recentTransactions.length === 0 ? (
                <div className="text-sm text-muted-foreground">No transactions in this range.</div>
              ) : (
                activeReport.recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="pb-4 border-b border-border last:border-0 last:pb-0">
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-sm">{transaction.customer}</div>
                      <div className="text-sm text-primary">{formatCurrency(transaction.amount, activeReport.currencyCode)}</div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">{transaction.date} {transaction.time}</div>
                      <div className="text-xs text-muted-foreground">{transaction.items} item{transaction.items > 1 ? 's' : ''}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="mb-6">Top Products</h3>
            <div className="space-y-4">
              {activeReport.topProducts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No product sales in this range.</div>
              ) : (
                activeReport.topProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm truncate">{product.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        {product.quantity} sold
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-primary">{formatCurrency(product.revenue, activeReport.currencyCode)}</div>
                      <div className="text-xs text-muted-foreground">{formatCurrency(product.profit, activeReport.currencyCode)} profit</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Generated Report */}
      {generatedReport && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3>Generated Report</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(`${generatedReport.from}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {' — '}
                {new Date(`${generatedReport.to}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {' '}({generatedReport.data.length} day{generatedReport.data.length !== 1 ? 's' : ''})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportReport(generatedReport)}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => setGeneratedReport(null)}
                className="px-3 py-2 border border-border rounded-lg hover:bg-muted text-sm transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Total Revenue</div>
              <div className="text-lg">{formatCurrency(generatedReport.totalRevenue, generatedReport.currencyCode)}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Gross Profit</div>
              <div className="text-lg">{formatCurrency(generatedReport.totalProfit, generatedReport.currencyCode)}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Total Orders</div>
              <div className="text-lg">{generatedReport.totalOrders}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Items Sold</div>
              <div className="text-lg">{generatedReport.totalItems}</div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={generatedReport.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                tickFormatter={(val: string) => {
                  const d = new Date(`${val}T00:00:00`);
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
                interval={generatedReport.data.length > 14 ? Math.floor(generatedReport.data.length / 7) : 0}
              />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [formatCurrency(value, generatedReport.currencyCode), 'Revenue']}
              />
              <Line type="monotone" dataKey="revenue" stroke="#0e7490" strokeWidth={2} dot={generatedReport.data.length <= 14} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Custom Range Modal */}
      {showCustomRange && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2>Generate Report</h2>
              <button onClick={() => setShowCustomRange(false)} className="text-muted-foreground hover:text-foreground">
                <span className="text-xl">&times;</span>
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Choose a custom date range to generate a detailed sales report.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  max={customTo}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  min={customFrom}
                  max={today}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                />
              </div>

              {/* Quick presets */}
              <div className="flex gap-2">
                {[
                  { label: 'Last 7 days', days: 7 },
                  { label: 'Last 30 days', days: 30 },
                  { label: 'Last 60 days', days: 60 },
                ].map((preset) => (
                  <button
                    key={preset.days}
                    onClick={() => {
                      const to = new Date();
                      const from = addDays(to, -(preset.days - 1));
                      setCustomFrom(formatDate(from));
                      setCustomTo(formatDate(to));
                    }}
                    className="flex-1 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCustomRange(false)}
                className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
