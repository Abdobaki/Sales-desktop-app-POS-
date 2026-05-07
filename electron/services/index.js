function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function normalizeObject(input, label) {
  if (input === undefined || input === null) {
    return {};
  }

  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${label} must be an object.`);
  }

  return input;
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toPositiveInteger(value, label) {
  const numeric = Math.trunc(toNumber(value, NaN));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return numeric;
}

function toNonNegativeInteger(value, label) {
  const numeric = Math.trunc(toNumber(value, NaN));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }

  return numeric;
}

function toCents(amount) {
  return Math.round(toNumber(amount, 0) * 100);
}

function toDollars(cents) {
  return toNumber(cents, 0) / 100;
}

function toIsoString(value) {
  if (!value) {
    return '';
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function deepCloneSeriesComponent(component) {
  return {
    productId: String(component.productId ?? component.product_id ?? ''),
    quantity: toPositiveInteger(component.quantity, 'Series component quantity'),
    label: component.label ? String(component.label) : component.size ? String(component.size) : undefined,
  };
}

function deepCloneSeriesLegacyItem(item) {
  return {
    size: String(item.size ?? ''),
    quantity: toPositiveInteger(item.quantity, 'Series item quantity'),
    sold: Math.max(0, Math.trunc(toNumber(item.sold, 0))),
  };
}

function buildProductLookup(productRows) {
  const lookup = new Map();

  for (const row of productRows) {
    const product = {
      id: String(row.id),
      barcode: String(row.barcode ?? ''),
      sku: String(row.sku ?? ''),
      name: String(row.name ?? ''),
      cost_price_cents: row.cost_price_cents,
    };

    lookup.set(product.id, product);
    if (product.barcode) {
      lookup.set(product.barcode, product);
      lookup.set(product.barcode.toLowerCase(), product);
    }
    if (product.sku) {
      lookup.set(product.sku, product);
      lookup.set(product.sku.toLowerCase(), product);
    }
    if (product.name) {
      lookup.set(product.name, product);
      lookup.set(product.name.toLowerCase(), product);
    }
  }

  return lookup;
}

function composeSeriesRows(seriesRows, itemRows, productRows = []) {
  const itemsBySeriesId = new Map();
  const productLookup = buildProductLookup(productRows);

  for (const item of itemRows) {
    const seriesId = String(item.series_id ?? '');
    if (!seriesId) {
      continue;
    }

    const list = itemsBySeriesId.get(seriesId) ?? [];
    list.push({
      productId: item.product_id ? String(item.product_id) : '',
      size: String(item.size ?? ''),
      quantity: toPositiveInteger(item.quantity, 'Series item quantity'),
      sold: Math.max(0, Math.trunc(toNumber(item.sold, 0))),
    });
    itemsBySeriesId.set(seriesId, list);
  }

  return seriesRows.map((row) => {
    const seriesId = String(row.id);
    const legacyProductId = row.product_id ? String(row.product_id) : '';
    const rawItems = itemsBySeriesId.get(seriesId) ?? [];
    const components = [];
    const legacyItems = [];

    for (const rawItem of rawItems) {
      const resolvedProduct =
        (rawItem.productId && productLookup.get(rawItem.productId)) ||
        (rawItem.size && productLookup.get(rawItem.size)) ||
        (rawItem.size && productLookup.get(rawItem.size.toLowerCase())) ||
        (legacyProductId && productLookup.get(legacyProductId)) ||
        null;
      const productId = rawItem.productId || resolvedProduct?.id || legacyProductId || '';

      if (productId) {
        components.push({
          productId,
          quantity: rawItem.quantity,
          label: rawItem.size || resolvedProduct?.name || resolvedProduct?.sku || undefined,
        });
        continue;
      }

      legacyItems.push(deepCloneSeriesLegacyItem(rawItem));
    }

    return {
      id: seriesId,
      name: String(row.name ?? ''),
      boxBarcode: String(row.box_barcode ?? ''),
      productBarcode: String(row.product_barcode ?? ''),
      productId: row.product_id ? String(row.product_id) : undefined,
      category: String(row.category ?? ''),
      image: String(row.image_url ?? ''),
      costPrice: toDollars(row.cost_price_cents),
      sellingPrice: toDollars(row.selling_price_cents),
      unitPrice: toDollars(row.unit_price_cents),
      boxQuantity: toNonNegativeInteger(row.box_quantity ?? 1, 'Box quantity'),
      components,
      legacyItems: legacyItems.length > 0 ? legacyItems : undefined,
      supplierId: row.supplier_id ? String(row.supplier_id) : undefined,
      createdAt: String(row.created_at ?? '').slice(0, 10),
    };
  });
}

function buildSeriesPayload(rawPayload) {
  const payload = normalizeObject(rawPayload, 'payload');
  const values = payload.values !== undefined ? normalizeObject(payload.values, 'values') : payload;
  const id = textOrNull(payload.id ?? values.id);
  const rawComponents = Array.isArray(values.components)
    ? values.components
    : Array.isArray(values.items)
      ? values.items
      : [];
  const components = rawComponents.map((component) => {
    const raw = normalizeObject(component, 'component');
    return {
      productId: textOrNull(raw.productId ?? raw.product_id),
      quantity: toPositiveInteger(raw.quantity ?? raw.componentQuantity ?? raw.component_quantity ?? 1, 'Series component quantity'),
      label: textOrNull(raw.label ?? raw.size),
    };
  });

  if (components.length === 0) {
    throw new Error('Series must contain at least one product component.');
  }

  const productIds = new Set();
  for (const component of components) {
    if (!component.productId) {
      throw new Error('Each series component must reference a product.');
    }

    if (productIds.has(component.productId)) {
      throw new Error(`Duplicate product detected: ${component.productId}`);
    }

    productIds.add(component.productId);
  }

  const name = String(values.name ?? '').trim();
  const boxBarcode = String(values.boxBarcode ?? values.box_barcode ?? '').trim();
  const category = String(values.category ?? '').trim();
  const costPrice = toNumber(values.costPrice ?? values.cost_price ?? 0, NaN);
  const sellingPrice = toNumber(values.sellingPrice ?? values.selling_price ?? 0, NaN);
  const productBarcode = String(values.productBarcode ?? values.product_barcode ?? '').trim();
  const boxQuantity = toNonNegativeInteger(values.boxQuantity ?? values.box_quantity ?? 1, 'Box quantity');
  const unitPrice = toNumber(values.unitPrice ?? values.unit_price ?? sellingPrice, NaN);

  if (!name) {
    throw new Error('Series name is required.');
  }

  if (!boxBarcode) {
    throw new Error('Box barcode is required.');
  }

  if (!category) {
    throw new Error('Category is required.');
  }

  if (!Number.isFinite(costPrice) || costPrice < 0) {
    throw new Error('Cost price must be a non-negative number.');
  }

  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
    throw new Error('Selling price must be a non-negative number.');
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error('Unit price must be a non-negative number.');
  }

  return {
    id,
    name,
    boxBarcode,
    productBarcode: productBarcode || `${boxBarcode}-BOX`,
    category,
    image: String(values.image ?? values.image_url ?? '').trim(),
    costPrice,
    sellingPrice,
    unitPrice,
    boxQuantity,
    supplierId: textOrNull(values.supplierId ?? values.supplier_id),
    components,
  };
}

function getSeriesById(db, id) {
  const seriesRow = db.prepare('SELECT * FROM series WHERE id = ?').get(id);
  if (!seriesRow) {
    return null;
  }

  const itemRows = db
    .prepare('SELECT * FROM series_items WHERE series_id = ? ORDER BY sort_order ASC, size ASC')
    .all(id);
  const productRows = db.prepare('SELECT id, barcode, sku, name FROM products').all();

  return composeSeriesRows([seriesRow], itemRows, productRows)[0] ?? null;
}

function listSeries(db, rawOptions = {}) {
  const options = normalizeObject(rawOptions, 'options');
  const orderableColumns = new Set(['id', 'name', 'box_barcode', 'product_barcode', 'category', 'created_at', 'updated_at']);
  const requestedOrderBy = typeof options.orderBy === 'string' ? options.orderBy : 'name';
  const orderBy = orderableColumns.has(requestedOrderBy) ? requestedOrderBy : 'name';
  const direction = String(options.orderDirection || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : null;
  const offset = Number.isInteger(options.offset) && options.offset >= 0 ? options.offset : 0;

  let sql = `SELECT * FROM series ORDER BY ${quoteIdentifier(orderBy)} ${direction}`;
  const params = [];

  if (limit !== null) {
    sql += ' LIMIT ?';
    params.push(limit);

    if (offset > 0) {
      sql += ' OFFSET ?';
      params.push(offset);
    }
  }

  const seriesRows = db.prepare(sql).all(...params);
  if (seriesRows.length === 0) {
    return [];
  }

  const ids = seriesRows.map((row) => String(row.id));
  const itemRows = db
    .prepare(`SELECT * FROM series_items WHERE series_id IN (${ids.map(() => '?').join(', ')}) ORDER BY series_id ASC, sort_order ASC, size ASC`)
    .all(...ids);
  const productRows = db.prepare('SELECT id, barcode, sku, name FROM products').all();

  return composeSeriesRows(seriesRows, itemRows, productRows);
}

function persistSeries(db, rawPayload) {
  const payload = buildSeriesPayload(rawPayload);
  const now = nowIso();
  const productRows = db.prepare('SELECT id, barcode, sku, name, cost_price_cents FROM products').all();
  const productLookup = buildProductLookup(productRows);
  const computedCostPrice = payload.components.reduce((sum, component) => {
    const product = productLookup.get(component.productId);
    return sum + (product ? toDollars(product.cost_price_cents) * Math.max(1, Math.trunc(component.quantity)) : 0);
  }, 0);
  const costPrice = Number.isFinite(payload.costPrice) && payload.costPrice > 0 ? payload.costPrice : computedCostPrice;

  const save = db.transaction(() => {
    let seriesId = payload.id;
    const existing = seriesId ? db.prepare('SELECT id FROM series WHERE id = ?').get(seriesId) : null;

    if (existing) {
      db.prepare(`
        UPDATE series
        SET name = ?, box_barcode = ?, product_barcode = ?, category = ?, image_url = ?, cost_price_cents = ?, selling_price_cents = ?, unit_price_cents = ?, box_quantity = ?, supplier_id = ?, updated_at = ?
        WHERE id = ?
      `).run(
        payload.name,
        payload.boxBarcode,
        payload.productBarcode,
        payload.category,
        payload.image || null,
        toCents(costPrice),
        toCents(payload.sellingPrice),
        toCents(payload.unitPrice || payload.sellingPrice),
        payload.boxQuantity,
        payload.supplierId,
        now,
        seriesId
      );

      db.prepare('DELETE FROM series_items WHERE series_id = ?').run(seriesId);

      const insertItem = db.prepare(`
        INSERT INTO series_items (series_id, size, quantity, sold, sort_order, created_at, updated_at, product_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      payload.components.forEach((component, index) => {
        const product = productLookup.get(component.productId);
        if (!product) {
          throw new Error(`Product not found: ${component.productId}`);
        }

        insertItem.run(seriesId, component.label || product.name || product.sku || component.productId, component.quantity, 0, index, now, now, component.productId);
      });

      return getSeriesById(db, seriesId);
    }

    if (!seriesId) {
      seriesId = payload.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    }

    db.prepare(`
      INSERT INTO series (
        id, name, box_barcode, product_barcode, product_id, category, image_url,
        cost_price_cents, selling_price_cents, unit_price_cents, box_quantity, supplier_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      seriesId,
      payload.name,
      payload.boxBarcode,
      payload.productBarcode,
      payload.components[0]?.productId || null,
      payload.category,
      payload.image || null,
      toCents(costPrice),
      toCents(payload.sellingPrice),
      toCents(payload.unitPrice || payload.sellingPrice),
      payload.boxQuantity,
      payload.supplierId,
      now,
      now
    );

    const insertItem = db.prepare(`
      INSERT INTO series_items (series_id, size, quantity, sold, sort_order, created_at, updated_at, product_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    payload.components.forEach((component, index) => {
      const product = productLookup.get(component.productId);
      if (!product) {
        throw new Error(`Product not found: ${component.productId}`);
      }

      insertItem.run(seriesId, component.label || product.name || product.sku || component.productId, component.quantity, 0, index, now, now, component.productId);
    });

    return getSeriesById(db, seriesId);
  });

  return save();
}

function deleteSeries(db, rawPayload) {
  const payload = normalizeObject(rawPayload, 'payload');
  const id = textOrNull(payload.id ?? payload.seriesId ?? payload);
  if (!id) {
    throw new Error('Missing series id.');
  }

  const info = db.prepare('DELETE FROM series WHERE id = ?').run(id);
  return {
    deleted: info.changes > 0,
    changes: info.changes,
  };
}

function generateReceiptNumber(db) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const receiptNumber = `REC-${Date.now().toString(36).toUpperCase()}-${suffix}`;
    const existing = db.prepare('SELECT 1 FROM sales_orders WHERE receipt_number = ?').get(receiptNumber);
    if (!existing) {
      return receiptNumber;
    }
  }

  throw new Error('Failed to generate a unique receipt number.');
}

function loadProduct(db, productId) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(productId) ?? null;
}

function loadSeries(db, seriesId) {
  const seriesRow = db.prepare('SELECT * FROM series WHERE id = ?').get(seriesId);
  if (!seriesRow) {
    return null;
  }

  const items = db.prepare('SELECT * FROM series_items WHERE series_id = ? ORDER BY sort_order ASC, size ASC').all(seriesId);
  const productRows = db.prepare('SELECT id, barcode, sku, name FROM products').all();
  const series = composeSeriesRows([seriesRow], items, productRows)[0] ?? null;
  return series;
}

function checkoutSale(db, rawPayload = {}) {
  const payload = normalizeObject(rawPayload, 'payload');
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    throw new Error('Cart is empty.');
  }

  const sourceView = payload.sourceView === 'scanner' ? 'scanner' : 'pos';
  const customerId = textOrNull(payload.customerId ?? payload.customer_id);
  const paymentMethodCode = textOrNull(payload.paymentMethodCode ?? payload.payment_method_code);
  const notes = String(payload.notes ?? '').trim();
  const soldAt = toIsoString(payload.soldAt) || nowIso();
  const receiptNumber = generateReceiptNumber(db);
  const now = nowIso();

  const normalizedItems = items.map((rawItem) => {
    const item = normalizeObject(rawItem, 'item');
    const type = String(item.type ?? '');
    const quantity = toPositiveInteger(item.quantity ?? 1, 'Item quantity');
    const price = toNumber(item.price, NaN);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error('Item price must be a non-negative number.');
    }

    const components = Array.isArray(item.components)
      ? item.components.map((rawComponent) => {
          const component = normalizeObject(rawComponent, 'component');
          return {
            productId: String(component.productId ?? component.product_id ?? '').trim(),
            quantity: toPositiveInteger(component.quantity ?? 1, 'Series component quantity'),
            label: String(component.label ?? '').trim(),
          };
        })
      : [];

    return {
      type,
      quantity,
      price,
      id: String(item.id ?? ''),
      name: String(item.name ?? ''),
      image: String(item.image ?? ''),
      serieId: item.serieId ? String(item.serieId) : '',
      size: item.size ? String(item.size) : '',
      components,
    };
  });

  const transaction = db.transaction(() => {
    const orderSubtotalCents = normalizedItems.reduce((sum, item) => sum + toCents(item.price * item.quantity), 0);
    const discountCents = Math.max(0, Math.trunc(toNumber(payload.discountCents ?? 0, 0)));
    const taxCents = Math.max(0, Math.trunc(toNumber(payload.taxCents ?? 0, 0)));
    const totalCents = Math.max(0, orderSubtotalCents - discountCents + taxCents);

    db.prepare(`
      INSERT INTO sales_orders (
        id, receipt_number, customer_id, source_view, sold_at, subtotal_cents,
        discount_cents, tax_cents, total_cents, payment_method_code, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      receiptNumber,
      customerId,
      sourceView,
      soldAt,
      orderSubtotalCents,
      discountCents,
      taxCents,
      totalCents,
      paymentMethodCode,
      notes || null
    );

    const orderId = db.prepare('SELECT id FROM sales_orders WHERE receipt_number = ?').get(receiptNumber)?.id;
    if (!orderId) {
      throw new Error('Failed to load created sales order.');
    }

    const insertOrderItem = db.prepare(`
      INSERT INTO sales_order_items (
        id, sales_order_id, product_id, product_name_snapshot, product_sku_snapshot,
        product_barcode_snapshot, quantity, unit_price_cents, line_total_cents, unit_cost_cents
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (id, product_id, source_type, source_id, quantity_delta, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const resolvedSales = [];
    const productDeltas = new Map();

    for (const item of normalizedItems) {
      if (item.type === 'product') {
        const product = loadProduct(db, item.id);
        if (!product) {
          throw new Error(`Product not found: ${item.id}`);
        }

        resolvedSales.push({ type: 'product', item, product });
        productDeltas.set(product.id, (productDeltas.get(product.id) ?? 0) + item.quantity);
        continue;
      }

      if (item.type === 'serie') {
        if (!item.serieId) {
          throw new Error('Missing series id on cart item.');
        }

        const loadedSerie = loadSeries(db, item.serieId);
        if (!loadedSerie) {
          throw new Error(`Series not found: ${item.serieId}`);
        }

        const baseComponents = item.components.length > 0 ? item.components : loadedSerie.components;
        const normalizedComponents = baseComponents
          .map((component) => ({
            productId: String(component.productId ?? '').trim(),
            quantity: Math.max(1, Math.trunc(toNumber(component.quantity, 0))),
            label: String(component.label ?? '').trim(),
          }))
          .filter((component) => component.productId.length > 0);

        if (normalizedComponents.length === 0) {
          throw new Error(`Box ${loadedSerie.name} has no configured products.`);
        }

        for (const component of normalizedComponents) {
          const product = loadProduct(db, component.productId);
          if (!product) {
            throw new Error(`Product not found for box ${loadedSerie.name}: ${component.productId}`);
          }

          productDeltas.set(product.id, (productDeltas.get(product.id) ?? 0) + component.quantity * item.quantity);
        }

        resolvedSales.push({ type: 'serie', item, serie: loadedSerie, components: normalizedComponents });
      }
    }

    for (const [productId, required] of productDeltas.entries()) {
      const product = loadProduct(db, productId);
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      const stockQty = Math.trunc(toNumber(product.stock_qty, 0));
      if (required > stockQty) {
        throw new Error(`Not enough stock for ${product.name}. Available: ${stockQty}`);
      }
    }

    for (const sale of resolvedSales) {
      if (sale.type === 'product') {
        const { item, product } = sale;
        const lineTotalCents = toCents(item.price * item.quantity);

        insertOrderItem.run(
          `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          orderId,
          product.id,
          item.name || String(product.name ?? ''),
          String(product.sku ?? ''),
          String(product.barcode ?? ''),
          item.quantity,
          toCents(item.price),
          lineTotalCents,
          product.cost_price_cents ?? null
        );
        continue;
      }

      const { item, serie } = sale;
      const lineTotalCents = toCents(item.price * item.quantity);
      const boxCostCents = Math.trunc(toNumber(serie.costPrice, 0) * 100);

      insertOrderItem.run(
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        orderId,
        null,
        item.name || String(serie.name ?? ''),
        null,
        String(serie.boxBarcode ?? ''),
        item.quantity,
        toCents(item.price),
        lineTotalCents,
        boxCostCents
      );
    }

    for (const [productId, required] of productDeltas.entries()) {
      const product = loadProduct(db, productId);
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      const info = db.prepare(`
        UPDATE products
        SET stock_qty = stock_qty - ?, updated_at = ?
        WHERE id = ? AND stock_qty >= ?
      `).run(required, now, product.id, required);

      if (info.changes === 0) {
        throw new Error(`Not enough stock for ${product.name}. Available: ${Math.trunc(toNumber(product.stock_qty, 0))}`);
      }

      insertMovement.run(
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        product.id,
        'sale',
        orderId,
        -required,
        `Sale ${receiptNumber}`,
        now
      );
    }

    return {
      orderId,
      receiptNumber,
      soldAt,
      subtotalCents: orderSubtotalCents,
      discountCents,
      taxCents,
      totalCents,
      sourceView,
      customerId,
      paymentMethodCode,
    };
  });

  return transaction();
}

export {
  checkoutSale,
  deleteSeries,
  getSeriesById,
  listSeries,
  persistSeries as saveSeries,
};
