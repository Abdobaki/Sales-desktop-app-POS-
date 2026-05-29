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
  return `${amount.toFixed(2)} DZD`;
}

export function normalizeBarcodeScan(raw: string): string {
  if (/^[\d]+$/.test(raw)) return raw;

  const isAzerty = /[éèçà"'\-_]/.test(raw);
  const useAzerty = isAzerty || /^[&é"'\(\-è_çà]+$/.test(raw);

  if (useAzerty) {
    const azertyMap: Record<string, string> = {
      '&': '1', 'é': '2', '"': '3', "'": '4', '(': '5',
      '-': '6', 'è': '7', '_': '8', 'ç': '9', 'à': '0'
    };
    return raw.split('').map(ch => azertyMap[ch] ?? ch).join('');
  } else {
    const qwertyMap: Record<string, string> = {
      '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
      '^': '6', '&': '7', '*': '8', '(': '9', ')': '0'
    };
    return raw.split('').map(ch => qwertyMap[ch] ?? ch).join('');
  }
}
