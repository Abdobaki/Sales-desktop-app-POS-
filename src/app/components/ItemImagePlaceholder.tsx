import { useEffect, useState } from 'react';
import { Footprints, Shirt, Package } from 'lucide-react';

type ItemImagePlaceholderProps = {
  category?: string;
  className?: string;
  iconClassName?: string;
};

function getPlaceholderIcon(category?: string) {
  const value = (category ?? '').trim().toLowerCase();
  if (value.includes('shoe')) return Footprints;
  if (value.includes('shirt') || value.includes('tee')) return Shirt;
  return Package;
}

export function ItemImagePlaceholder({ category, className = '', iconClassName = 'w-6 h-6' }: ItemImagePlaceholderProps) {
  const Icon = getPlaceholderIcon(category);

  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400 ${className}`}
      aria-label="No image available"
    >
      <Icon className={iconClassName} />
    </div>
  );
}

type ItemImageProps = ItemImagePlaceholderProps & {
  src?: string;
  alt: string;
};

export function ItemImage({ src, alt, category, className = '', iconClassName }: ItemImageProps) {
  const normalizedSrc = typeof src === 'string' ? src.trim() : '';
  const isValidSrc = normalizedSrc && normalizedSrc !== 'undefined' && normalizedSrc !== 'null';
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [normalizedSrc]);

  if (isValidSrc && !failed) {
    return (
      <div className={`overflow-hidden ${className}`}>
        <img
          src={normalizedSrc}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return <ItemImagePlaceholder category={category} className={className} iconClassName={iconClassName} />;
}
