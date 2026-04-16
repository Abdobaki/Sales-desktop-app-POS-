export type Product = {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  category: string;
  image: string;
  barcode: string;
  sku: string;
  variants: string;
  stock: number;
  supplierId?: string;
};

let _products: Product[] = [
  { id: '1', name: 'Classic White T-Shirt', price: 29.99, costPrice: 15.99, category: 'Shirts', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop', barcode: '8901234567001', sku: 'TS-001', variants: 'S, M, L, XL / White', stock: 145 },
  { id: '2', name: 'Denim Jeans', price: 79.99, costPrice: 45.99, category: 'Pants', image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop', barcode: '8901234567002', sku: 'JN-002', variants: '28, 30, 32, 34 / Blue', stock: 8 },
  { id: '3', name: 'Leather Jacket', price: 199.99, costPrice: 100.99, category: 'Accessories', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop', barcode: '8901234567003', sku: 'LJ-003', variants: 'M, L, XL / Black', stock: 23 },
  { id: '4', name: 'Cotton Polo Shirt', price: 39.99, costPrice: 20.99, category: 'Shirts', image: 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=400&h=400&fit=crop', barcode: '8901234567004', sku: 'PS-004', variants: 'S, M, L / Navy, White', stock: 67 },
  { id: '5', name: 'Chino Pants', price: 59.99, costPrice: 30.99, category: 'Pants', image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=400&fit=crop', barcode: '8901234567005', sku: 'CP-005', variants: '30, 32, 34 / Khaki, Navy', stock: 42 },
  { id: '6', name: 'Wool Sweater', price: 69.99, costPrice: 35.99, category: 'Shirts', image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop', barcode: '8901234567006', sku: 'WS-006', variants: 'M, L, XL / Gray, Navy', stock: 12 },
  { id: '7', name: 'Cargo Pants', price: 64.99, costPrice: 32.99, category: 'Pants', image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&h=400&fit=crop', barcode: '8901234567007', sku: 'CG-007', variants: '30, 32, 34, 36 / Olive', stock: 31 },
  { id: '8', name: 'Leather Belt', price: 34.99, costPrice: 18.99, category: 'Accessories', image: 'https://images.unsplash.com/photo-1624222247344-550fb60583c2?w=400&h=400&fit=crop', barcode: '8901234567008', sku: 'LB-008', variants: 'S, M, L / Brown, Black', stock: 89 },
  { id: '9', name: 'Linen Shirt', price: 54.99, costPrice: 25.99, category: 'Shirts', image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&h=400&fit=crop', barcode: '8901234567009', sku: 'LS-009', variants: 'S, M, L / White, Blue', stock: 34 },
];

let _listeners: (() => void)[] = [];

// Keep backward-compatible export
export const productCatalog = _products;

export function getProducts() {
  return [..._products];
}

export function addProduct(p: Omit<Product, 'id'>) {
  const newProduct: Product = { ...p, id: `${Date.now()}` };
  _products = [..._products, newProduct];
  // Update the exported reference
  productCatalog.length = 0;
  productCatalog.push(..._products);
  _listeners.forEach((l) => l());
  return newProduct;
}

export function updateProduct(updated: Product) {
  _products = _products.map((p) => (p.id === updated.id ? updated : p));
  productCatalog.length = 0;
  productCatalog.push(..._products);
  _listeners.forEach((l) => l());
}

export function deleteProduct(id: string) {
  _products = _products.filter((p) => p.id !== id);
  productCatalog.length = 0;
  productCatalog.push(..._products);
  _listeners.forEach((l) => l());
}

export function subscribeProducts(listener: () => void) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}