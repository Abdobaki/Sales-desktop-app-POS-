import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, AlertCircle, Calendar, Download, FileText, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Area, AreaChart,
} from 'recharts';

// Generate mock daily sales data for the last 90 days
function generateSalesData() {
  const data: { date: string; day: string; revenue: number; orders: number; items: number }[] = [];
  const today = new Date(2026, 3, 10); // April 10, 2026
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const base = 3000 + Math.random() * 5000;
    const weekday = d.getDay();
    const multiplier = weekday === 0 || weekday === 6 ? 1.3 : 1;
    const revenue = Math.round(base * multiplier);
    const orders = Math.round(revenue / 120 + Math.random() * 10);
    const items = Math.round(orders * (1.5 + Math.random()));
    data.push({
      date: d.toISOString().split('T')[0],
      day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue,
      orders,
      items,
    });
  }
  return data;
}

const allSalesData = generateSalesData();

const recentTransactions = [
  { id: '1', customer: 'Sarah Johnson', amount: 129.99, time: '10:34 AM', items: 2, date: '2026-04-10' },
  { id: '2', customer: 'Michael Chen', amount: 79.99, time: '10:21 AM', items: 1, date: '2026-04-10' },
  { id: '3', customer: 'Emma Davis', amount: 249.97, time: '10:15 AM', items: 3, date: '2026-04-10' },
  { id: '4', customer: 'James Wilson', amount: 59.99, time: '10:08 AM', items: 1, date: '2026-04-10' },
  { id: '5', customer: 'Olivia Martinez', amount: 189.98, time: '09:52 AM', items: 2, date: '2026-04-09' },
  { id: '6', customer: 'Robert Taylor', amount: 34.99, time: '09:41 AM', items: 1, date: '2026-04-09' },
  { id: '7', customer: 'Lisa Anderson', amount: 154.97, time: '04:12 PM', items: 3, date: '2026-04-08' },
  { id: '8', customer: 'David Kim', amount: 89.99, time: '02:30 PM', items: 1, date: '2026-04-08' },
  { id: '9', customer: 'Rachel Green', amount: 219.98, time: '11:45 AM', items: 2, date: '2026-04-07' },
  { id: '10', customer: 'Tom Harris', amount: 44.99, time: '09:15 AM', items: 1, date: '2026-04-07' },
];

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

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export function ReportsView() {
  const [dateRange, setDateRange] = useState('7days');
  const [customFrom, setCustomFrom] = useState('2026-04-04');
  const [customTo, setCustomTo] = useState('2026-04-10');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<{
    from: string;
    to: string;
    data: typeof allSalesData;
    totalRevenue: number;
    totalOrders: number;
    totalItems: number;
  } | null>(null);

  const filteredData = useMemo(() => {
    const today = new Date(2026, 3, 10);
    let from: Date;
    switch (dateRange) {
      case 'today':
        from = today;
        break;
      case '7days':
        from = new Date(today);
        from.setDate(from.getDate() - 6);
        break;
      case '30days':
        from = new Date(today);
        from.setDate(from.getDate() - 29);
        break;
      case '90days':
        from = new Date(today);
        from.setDate(from.getDate() - 89);
        break;
      default:
        from = new Date(today);
        from.setDate(from.getDate() - 6);
    }
    const fromStr = formatDate(from);
    const toStr = formatDate(today);
    return allSalesData.filter((d) => d.date >= fromStr && d.date <= toStr);
  }, [dateRange]);

  const totalRevenue = filteredData.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = filteredData.reduce((s, d) => s + d.orders, 0);

  const handleGenerateReport = () => {
    const data = allSalesData.filter((d) => d.date >= customFrom && d.date <= customTo);
    setGeneratedReport({
      from: customFrom,
      to: customTo,
      data,
      totalRevenue: data.reduce((s, d) => s + d.revenue, 0),
      totalOrders: data.reduce((s, d) => s + d.orders, 0),
      totalItems: data.reduce((s, d) => s + d.items, 0),
    });
    setShowCustomRange(false);
  };

  const handleExportReport = (report: NonNullable<typeof generatedReport>) => {
    const lines = [
      `Sales Report: ${report.from} to ${report.to}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      `Total Revenue: $${report.totalRevenue.toLocaleString()}`,
      `Total Orders: ${report.totalOrders}`,
      `Total Items Sold: ${report.totalItems}`,
      '',
      'Date,Revenue,Orders,Items',
      ...report.data.map((d) => `${d.date},$${d.revenue},${d.orders},${d.items}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${report.from}-to-${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            onClick={() => {
              const report = {
                from: filteredData[0]?.date || '',
                to: filteredData[filteredData.length - 1]?.date || '',
                data: filteredData,
                totalRevenue,
                totalOrders,
                totalItems: filteredData.reduce((s, d) => s + d.items, 0),
              };
              handleExportReport(report);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <SummaryCard
          title="Period Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          change="+12.5%"
          icon={DollarSign}
          trend="up"
        />
        <SummaryCard
          title="Total Orders"
          value={`${totalOrders}`}
          change="+8.2%"
          icon={ShoppingBag}
          trend="up"
        />
        <SummaryCard
          title="Items Low on Stock"
          value="6"
          change="-2.1%"
          icon={AlertCircle}
          trend="down"
        />
      </div>

      {/* Sales Line Chart */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h3 className="mb-6">Sales Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={filteredData}>
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
                const d = new Date(val + 'T00:00:00');
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
              interval={filteredData.length > 14 ? Math.floor(filteredData.length / 7) : 0}
            />
            <YAxis stroke="#64748b" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#0e7490"
              strokeWidth={2}
              fill="url(#salesGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart + Recent Transactions */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-card border border-border rounded-lg p-6">
          <h3 className="mb-6">Daily Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={filteredData.slice(-14)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                tickFormatter={(val: string) => {
                  const d = new Date(val + 'T00:00:00');
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
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
              />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {filteredData.slice(-14).map((entry) => (
                  <Cell key={`bar-${entry.date}`} fill="#0e7490" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="mb-6">Recent Transactions</h3>
          <div className="space-y-4">
            {recentTransactions.slice(0, 6).map((transaction) => (
              <div key={transaction.id} className="pb-4 border-b border-border last:border-0 last:pb-0">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-sm">{transaction.customer}</div>
                  <div className="text-sm text-primary">${transaction.amount.toFixed(2)}</div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">{transaction.date} {transaction.time}</div>
                  <div className="text-xs text-muted-foreground">{transaction.items} item{transaction.items > 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
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
                {new Date(generatedReport.from).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {' — '}
                {new Date(generatedReport.to).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {' '}({generatedReport.data.length} day{generatedReport.data.length !== 1 ? 's' : ''})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportReport(generatedReport)}
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

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Total Revenue</div>
              <div className="text-lg">${generatedReport.totalRevenue.toLocaleString()}</div>
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
                  const d = new Date(val + 'T00:00:00');
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
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
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
                  max="2026-04-10"
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
                      const to = new Date(2026, 3, 10);
                      const from = new Date(to);
                      from.setDate(from.getDate() - preset.days + 1);
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