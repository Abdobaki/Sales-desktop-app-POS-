import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Filter,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  Clock,
  Banknote,
  Trash2,
} from 'lucide-react';
import {
  fetchDebts,
  getDebts,
  subscribeDebts,
  payDebt,
  deleteDebt,
  type Debt,
  type DebtStatus,
} from './data/debts';
import { formatCurrency, getErrorMessage } from './data/shared';

export function DebtsView() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DebtStatus>('all');

  // Pay modal
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payError, setPayError] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  // Delete modal
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    void fetchDebts();
    const unsub = subscribeDebts(() => setDebts(getDebts()));
    return () => { unsub(); };
  }, []);

  const filteredDebts = useMemo(() => {
    return debts.filter((debt) => {
      const matchesSearch =
        debt.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        debt.customerPhone.includes(searchQuery) ||
        debt.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || debt.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [debts, searchQuery, statusFilter]);

  const totals = useMemo(() => {
    const outstanding = debts.filter((d) => d.status !== 'paid');
    return {
      totalRemaining: outstanding.reduce((sum, d) => sum + d.remainingAmount, 0),
      count: outstanding.length,
    };
  }, [debts]);

  const handlePay = async () => {
    if (!payingDebt) return;
    setPayError('');
    setIsPaying(true);
    try {
      const amountCents = Math.round((parseFloat(payAmount) || 0) * 100);
      await payDebt(payingDebt.id, amountCents);
      setPayingDebt(null);
      setPayAmount('');
    } catch (err) {
      setPayError(getErrorMessage(err));
    } finally {
      setIsPaying(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDebt) return;
    setDeleteError('');
    setIsDeleting(true);
    try {
      await deleteDebt(deletingDebt.id);
      setDeletingDebt(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const statusBadge = (status: DebtStatus) => {
    switch (status) {
      case 'unpaid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            <AlertCircle className="w-3 h-3" /> Unpaid
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
            <Clock className="w-3 h-3" /> Partial
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3" /> Paid
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Debts</h1>
          <p className="text-muted-foreground mt-2">
            Track and manage outstanding customer payments.
          </p>
        </div>
        {totals.count > 0 && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{totals.count} outstanding debt{totals.count !== 1 ? 's' : ''}</div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totals.totalRemaining)}</div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by customer, phone or receipt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-input-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted p-1 rounded-lg border border-border">
            {(['all', 'unpaid', 'partial', 'paid'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? `bg-background shadow-sm ${s === 'unpaid' ? 'text-red-600' : s === 'partial' ? 'text-amber-600' : s === 'paid' ? 'text-green-600' : ''}`
                    : 'hover:bg-background/50'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Debts Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-6 py-4 font-semibold text-sm">Date</th>
              <th className="px-6 py-4 font-semibold text-sm">Customer</th>
              <th className="px-6 py-4 font-semibold text-sm">Receipt</th>
              <th className="px-6 py-4 font-semibold text-sm text-right">Total</th>
              <th className="px-6 py-4 font-semibold text-sm text-right">Paid</th>
              <th className="px-6 py-4 font-semibold text-sm text-right">Remaining</th>
              <th className="px-6 py-4 font-semibold text-sm">Status</th>
              <th className="px-6 py-4 font-semibold text-sm text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDebts.map((debt) => (
              <tr key={debt.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {debt.createdAt}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">
                      {debt.customerName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium">{debt.customerName}</div>
                      <div className="text-xs text-muted-foreground">{debt.customerPhone}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                  #{debt.receiptNumber}
                </td>
                <td className="px-6 py-4 text-sm text-right font-mono">
                  {formatCurrency(debt.totalAmount)}
                </td>
                <td className="px-6 py-4 text-sm text-right font-mono text-green-600">
                  {formatCurrency(debt.paidAmount)}
                </td>
                <td className="px-6 py-4 text-sm text-right font-mono font-bold text-red-600">
                  {formatCurrency(debt.remainingAmount)}
                </td>
                <td className="px-6 py-4 text-sm">
                  {statusBadge(debt.status)}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {debt.status !== 'paid' && (
                      <button
                        onClick={() => {
                          setPayingDebt(debt);
                          setPayAmount('');
                          setPayError('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-sm font-medium transition-colors flex items-center gap-1.5"
                        title="Record payment"
                      >
                        <Banknote className="w-4 h-4" /> Pay
                      </button>
                    )}
                    <button
                      onClick={() => { setDeletingDebt(debt); setDeleteError(''); }}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete debt"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredDebts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-20 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="w-8 h-8 opacity-20" />
                    <p>No debts found matching your filters.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pay Modal */}
      {payingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-green-700">
              <div className="p-2 rounded-full bg-green-100">
                <Banknote className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold">Record Payment</h2>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{payingDebt.customerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total order</span>
                <span className="font-mono">{formatCurrency(payingDebt.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Already paid</span>
                <span className="font-mono text-green-600">{formatCurrency(payingDebt.paidAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span>Remaining</span>
                <span className="font-mono text-red-600">{formatCurrency(payingDebt.remainingAmount)}</span>
              </div>

              <div className="pt-3 border-t border-border">
                <label className="text-sm text-muted-foreground mb-1 block">Payment amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={payingDebt.remainingAmount.toFixed(2)}
                  autoFocus
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setPayAmount(payingDebt.remainingAmount.toFixed(2))}
                className="text-xs text-primary hover:underline"
              >
                Pay full remaining ({formatCurrency(payingDebt.remainingAmount)})
              </button>
            </div>

            {payError && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {payError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setPayingDebt(null)}
                disabled={isPaying}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-muted font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={isPaying || !payAmount}
                className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPaying ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-destructive">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold">Delete Debt</h2>
            </div>

            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete this debt record for{' '}
              <span className="font-semibold text-foreground">{deletingDebt.customerName}</span>?
              This action cannot be undone.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingDebt(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-muted font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? 'Deleting...' : 'Delete Debt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
