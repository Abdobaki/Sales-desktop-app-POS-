import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, Download, RefreshCw, Copy, Check } from 'lucide-react';

type BarcodeDisplayProps = {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
};

export function BarcodeDisplay({ value, width = 2, height = 60, showText = true }: BarcodeDisplayProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width,
          height,
          displayValue: showText,
          fontSize: 14,
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch {
        // Invalid barcode value – leave SVG blank
      }
    }
  }, [value, width, height, showText]);

  if (!value) return null;
  return <svg ref={svgRef} />;
}

// Generate a unique barcode number (EAN-13 style, 13 digits)
export function generateBarcodeNumber(): string {
  // Start with country prefix 200-299 (internal use range for EAN-13)
  const prefix = '2' + String(Math.floor(Math.random() * 10));
  const body = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  const partial = prefix + body;

  // Calculate EAN-13 check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(partial[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return partial + checkDigit;
}

type BarcodeGeneratorModalProps = {
  initialValue?: string;
  productName?: string;
  onApply: (barcode: string) => void;
  onClose: () => void;
};

export function BarcodeGeneratorModal({ initialValue, productName, onApply, onClose }: BarcodeGeneratorModalProps) {
  const [barcode, setBarcode] = useState(initialValue || generateBarcodeNumber());
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleRegenerate = () => {
    setBarcode(generateBarcodeNumber());
    setCopied(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=450,height=350');
    if (!printWindow) return;

    // Get the SVG from the current display
    const svgEl = printRef.current?.querySelector('svg');
    const svgHtml = svgEl ? svgEl.outerHTML : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode Label</title>
          <style>
            body {
              margin: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              font-family: 'Arial', sans-serif;
            }
            .label {
              text-align: center;
              padding: 16px 24px;
              border: 1px dashed #ccc;
              border-radius: 8px;
            }
            .product-name {
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 8px;
              color: #333;
            }
            svg { display: block; margin: 0 auto; }
            @media print {
              .label { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="label">
            ${productName ? `<div class="product-name">${productName}</div>` : ''}
            ${svgHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleDownload = () => {
    const svgEl = printRef.current?.querySelector('svg');
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const link = document.createElement('a');
        link.download = `barcode-${barcode}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2>Generate Barcode</h2>
          {productName && (
            <p className="text-sm text-muted-foreground mt-1">For: {productName}</p>
          )}
        </div>

        <div className="p-5 space-y-5">
          {/* Barcode Preview */}
          <div
            ref={printRef}
            className="bg-white border border-border rounded-lg p-6 flex items-center justify-center"
          >
            <BarcodeDisplay value={barcode} width={2} height={70} />
          </div>

          {/* Barcode Value */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Barcode Number</label>
            <div className="flex gap-2">
              <input
                value={barcode}
                onChange={(e) => { setBarcode(e.target.value); setCopied(false); }}
                className="flex-1 px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm font-mono tracking-wider"
                placeholder="Enter or generate barcode"
              />
              <button
                onClick={handleRegenerate}
                className="px-3 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
                title="Generate new barcode"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopy}
                className="px-3 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
                title="Copy barcode"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Printer className="w-4 h-4" />
              Print Label
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Download PNG
            </button>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(barcode)}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Apply Barcode
          </button>
        </div>
      </div>
    </div>
  );
}
