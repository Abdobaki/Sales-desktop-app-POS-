import { useState, useEffect, useRef } from 'react';
import { Search, Plus, MoreVertical, ChevronDown, X, Pencil, Trash2, Upload, ImageIcon } from 'lucide-react';
import { getProducts, addProduct, updateProduct, deleteProduct, subscribeProducts, type Product } from './data/products';

const categories = ['All Categories', 'Shirts', 'Pants', 'Accessories'];
const productCategories = ['Shirts', 'Pants', 'Accessories'];

const emptyForm = {
  name: '',
  price: '',
  costPrice: '',
  category: 'Shirts',
  image: '',
  barcode: '',
  sku: '',
  variants: '',
  stock: '',
};

export function InventoryView() {
  const [products, setProducts] = useState(getProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeProducts(() => setProducts(getProducts()));
  }, []);

  const filteredInventory = products.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.barcode.includes(searchQuery);
    const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openAdd = () => {
    setForm(emptyForm);
    setFormErrors({});
    setEditingProduct(null);
    setShowAddModal(true);
  };

  const openEdit = (product: Product) => {
    setForm({
      name: product.name,
      price: product.price.toString(),
      costPrice: product.costPrice.toString(),
      category: product.category,
      image: product.image,
      barcode: product.barcode,
      sku: product.sku,
      variants: product.variants,
      stock: product.stock.toString(),
    });
    setFormErrors({});
    setEditingProduct(product);
    setShowAddModal(true);
    setOpenMenuId(null);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Required';
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) errors.price = 'Enter a valid price';
    if (!form.costPrice || isNaN(Number(form.costPrice)) || Number(form.costPrice) <= 0) errors.costPrice = 'Enter a valid price';
    if (!form.barcode.trim()) errors.barcode = 'Required';
    if (!form.stock || isNaN(Number(form.stock)) || Number(form.stock) < 0) errors.stock = 'Enter a valid number';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    const productData = {
      name: form.name.trim(),
      price: parseFloat(form.price),
      costPrice: parseFloat(form.costPrice),
      category: form.category,
      image: form.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
      barcode: form.barcode.trim(),
      sku: form.sku.trim() || `SKU-${Date.now().toString(36).toUpperCase()}`,
      variants: form.variants.trim() || '-',
      stock: parseInt(form.stock),
    };
    if (editingProduct) {
      updateProduct({ ...productData, id: editingProduct.id });
    } else {
      addProduct(productData);
    }
    setShowAddModal(false);
  };

  const handleDelete = (id: string) => {
    deleteProduct(id);
    setDeleteConfirmId(null);
    setOpenMenuId(null);
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1>Inventory</h1>
          <p className="text-muted-foreground mt-1">Manage product stock levels</p>
        </div>
        <button
          onClick={openAdd}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add New Product
        </button>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search inventory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-input-background border border-border rounded-lg"
          />
        </div>
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="appearance-none pl-4 pr-10 py-3 bg-input-background border border-border rounded-lg cursor-pointer"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Product Image</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">SKU</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Barcode</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Name</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Category</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Variants (Size/Color)</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">In Stock</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Buying Price</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Selling Price</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-6 py-4">
                  <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{item.sku}</td>
                <td className="px-6 py-4 text-muted-foreground font-mono text-sm">{item.barcode}</td>
                <td className="px-6 py-4">{item.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{item.category}</td>
                <td className="px-6 py-4 text-muted-foreground text-sm">{item.variants}</td>
                <td className="px-6 py-4">
                  <span className={item.stock <= 10 ? 'text-red-600' : ''}>
                    {item.stock}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground">${item.costPrice.toFixed(2)}</td>
                <td className="px-6 py-4">${item.price.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {openMenuId === item.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-8 bg-card border border-border rounded-lg shadow-lg z-20 w-36 py-1">
                          <button
                            onClick={() => openEdit(item)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => { setDeleteConfirmId(item.id); setOpenMenuId(null); }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-red-600 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredInventory.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-muted-foreground">
                  No products found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Product Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.name ? 'border-red-400' : 'border-border'}`}
                    placeholder="e.g. Cotton Hoodie"
                  />
                  {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                  >
                    {productCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">SKU <span className="text-xs">(optional)</span></label>
                  <input
                    value={form.sku}
                    onChange={(e) => updateField('sku', e.target.value)}
                    className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Barcode *</label>
                  <input
                    value={form.barcode}
                    onChange={(e) => updateField('barcode', e.target.value)}
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.barcode ? 'border-red-400' : 'border-border'}`}
                    placeholder="e.g. 8901234567010"
                  />
                  {formErrors.barcode && <p className="text-red-500 text-xs mt-1">{formErrors.barcode}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Buying Price *</label>
                  <input
                    value={form.costPrice}
                    onChange={(e) => updateField('costPrice', e.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.costPrice ? 'border-red-400' : 'border-border'}`}
                    placeholder="0.00"
                  />
                  {formErrors.costPrice && <p className="text-red-500 text-xs mt-1">{formErrors.costPrice}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Selling Price *</label>
                  <input
                    value={form.price}
                    onChange={(e) => updateField('price', e.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.price ? 'border-red-400' : 'border-border'}`}
                    placeholder="0.00"
                  />
                  {formErrors.price && <p className="text-red-500 text-xs mt-1">{formErrors.price}</p>}
                </div>
              </div>
              {Number(form.costPrice) > 0 && Number(form.price) > 0 && (
                <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Profit per unit</span>
                  <span className={`text-sm ${Number(form.price) - Number(form.costPrice) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${(Number(form.price) - Number(form.costPrice)).toFixed(2)}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({((Number(form.price) - Number(form.costPrice)) / Number(form.costPrice) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Stock *</label>
                  <input
                    value={form.stock}
                    onChange={(e) => updateField('stock', e.target.value)}
                    type="number"
                    min="0"
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.stock ? 'border-red-400' : 'border-border'}`}
                    placeholder="0"
                  />
                  {formErrors.stock && <p className="text-red-500 text-xs mt-1">{formErrors.stock}</p>}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Variants (Size / Color)</label>
                <input
                  value={form.variants}
                  onChange={(e) => updateField('variants', e.target.value)}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                  placeholder="e.g. S, M, L / Black, Gray"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Product Image</label>
                <div
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          updateField('image', ev.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                  className="border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  {form.image ? (
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm mb-1">Image uploaded</p>
                        <p className="text-xs text-muted-foreground">Click to change</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); updateField('image', ''); }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-2 text-muted-foreground">
                      <Upload className="w-8 h-8 opacity-40" />
                      <p className="text-sm">Click to upload image</p>
                      <p className="text-xs">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                {editingProduct ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="mb-2">Delete Product</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}