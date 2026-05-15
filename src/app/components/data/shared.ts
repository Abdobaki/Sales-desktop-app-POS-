type RendererDbApi = any;

export function getDbApi(): RendererDbApi {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.electronAPI?.db ?? null;
}

export function toCents(amount: unknown): number {
  const numeric = Number(amount ?? 0);
  return Math.round(numeric * 100);
}

export function toDollars(cents: unknown): number {
  const numeric = Number(cents ?? 0);
  return numeric / 100;
}

export function toDateOnly(value: unknown): string {
  const date = new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toISOString().split('T')[0];
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unexpected error.';
}

export function isUniqueConstraintError(error: unknown, table: string, column?: string): boolean {
  const message = getErrorMessage(error);
  const target = column ? `${table}.${column}` : `${table}.`;
  return message.includes('UNIQUE constraint failed') && message.includes(target);
}

export function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} DZ`;
}

/**
 * Normalize barcode scanner input by converting keyboard symbols back to digits.
 *
 * Barcode scanners act as keyboard input devices — they simulate key presses.
 * Depending on the OS keyboard layout, digit keys may produce symbols instead:
 *
 * QWERTY (Shift held): ! → 1, @ → 2, # → 3, $ → 4, % → 5, ^ → 6, & → 7, * → 8, ( → 9, ) → 0
 * AZERTY (unshifted):  é → 2, è → 7, ç → 9, à → 0
 */
const SYMBOL_TO_DIGIT: Record<string, string> = {
  // QWERTY Shift+number row
  '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
  '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
  // AZERTY-specific (non-conflicting)
  'é': '2', 'è': '7', 'ç': '9', 'à': '0',
};

export function normalizeBarcodeScan(raw: string): string {
  return raw
    .split('')
    .map((ch) => SYMBOL_TO_DIGIT[ch] ?? ch)
    .join('');
}
