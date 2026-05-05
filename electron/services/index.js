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

function deepCloneSeriesItem(item) {
  return {
    size: String(item.size ?? ''),
    quantity: toPositiveInteger(item.quantity, 'Series item quantity'),
    sold: Math.max(0, Math.trunc(toNumber(item.sold, 0))),
  };
}

function composeSeriesRows(seriesRows, itemRows) {
  const itemsBySeriesId = new Map();

  for (const item of itemRows) {
    const seriesId = String(item.series_id ?? '');
    if (!seriesId) {
      continue;
    }

    const list = itemsBySeriesId.get(seriesId) ?? [];
    list.push({
      size: String(item.size ?? ''),
      quantity: toPositiveInteger(item.quantity, 'Series item quantity'),
      sold: Math.max(0, Math.trunc(toNumber(item.sold, 0))),
    });
    itemsBySeriesId.set(seriesId, list);
  }

  return seriesRows.map((row) => ({
    id: String(row.id),
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
    items: (itemsBySeriesId.get(String(row.id)) ?? []).map((item) => deepCloneSeriesItem(item)),
    supplierId: row.supplier_id ? String(row.supplier_id) : undefined,
    createdAt: String(row.created_at ?? '').slice(0, 10),
  }));
}

function buildSeriesPayload(rawPayload) {
  const payload = normalizeObject(rawPayload, 'payload');
  const values = payload.values !== undefined ? normalizeObject(payload.values, 'values') : payload;
  const id = textOrNull(payload.id ?? values.id);
  const items = Array.isArray(values.items) ? values.items.map((item) => deepCloneSeriesItem(item)) : [];

  if (items.length === 0) {
    throw new Error('Series must contain at least one size item.');
  }

  const sizes = new Set();
  for (const item of items) {
    if (!item.size) {
      throw new Error('Series item size is required.');
    }

    if (sizes.has(item.size)) {
      throw new Error(`Duplicate size detected: ${item.size}`);
    }

    sizes.add(item.size);
  }

  const name = String(values.name ?? '').trim();
  const boxBarcode = String(values.boxBarcode ?? values.box_barcode ?? '').trim();
  const productBarcode = String(values.productBarcode ?? values.product_barcode ?? '').trim();
  const category = String(values.category ?? '').trim();
  const costPrice = toNumber(values.costPrice ?? values.cost_price ?? 0, NaN);
  const sellingPrice = toNumber(values.sellingPrice ?? values.selling_price ?? 0, NaN);
  const unitPrice = toNumber(values.unitPrice ?? values.unit_price ?? 0, NaN);
  const boxQuantity = toNonNegativeInteger(values.boxQuantity ?? values.box_quantity ?? 1, 'Box quantity');

  if (!name) {
    throw new Error('Series name is required.');
  }

  if (!boxBarcode) {
    throw new Error('Box barcode is required.');
  }

  if (!productBarcode) {
    throw new Error('Product barcode is required.');
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
    productBarcode,
    productId: textOrNull(values.productId ?? values.product_id),
    category,
    image: String(values.image ?? values.image_url ?? '').trim(),
    costPrice,
    sellingPrice,
    unitPrice,
    boxQuantity,
    supplierId: textOrNull(values.supplierId ?? values.supplier_id),
    items,
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

  return composeSeriesRows([seriesRow], itemRows)[0] ?? null;
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

  return composeSeriesRows(seriesRows, itemRows);
}

function persistSeries(db, rawPayload) {
  const payload = buildSeriesPayload(rawPayload);
  const now = nowIso();

  const save = db.transaction(() => {
    let seriesId = payload.id;
    const existing = seriesId ? db.prepare('SELECT id FROM series WHERE id = ?').get(seriesId) : null;

    if (existing) {
      db.prepare(`
        UPDATE series
        SET name = ?, box_barcode = ?, product_barcode = ?, product_id = ?, category = ?, image_url = ?, cost_price_cents = ?, selling_price_cents = ?, unit_price_cents = ?, box_quantity = ?, supplier_id = ?, updated_at = ?
        WHERE id = ?
      `).run(
        payload.name,
        payload.boxBarcode,
        payload.productBarcode,
        payload.productId,
        payload.category,
        payload.image || null,
        toCents(payload.costPrice),
        toCents(payload.sellingPrice),
        toCents(payload.unitPrice),
        payload.boxQuantity,
        payload.supplierId,
        now,
        seriesId
      );

      const existingItems = db.prepare('SELECT size, sold FROM series_items WHERE series_id = ?').all(seriesId);
      const soldBySize = new Map(existingItems.map((item) => [String(item.size), Math.max(0, Math.trunc(toNumber(item.sold, 0)))]));

      db.prepare('DELETE FROM series_items WHERE series_id = ?').run(seriesId);

      const insertItem = db.prepare(`
        INSERT INTO series_items (series_id, size, quantity, sold, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      payload.items.forEach((item, index) => {
        const previousSold = soldBySize.get(item.size) ?? Math.max(0, Math.trunc(toNumber(item.sold, 0)));
        const sold = Math.min(previousSold, item.quantity);
        insertItem.run(seriesId, item.size, item.quantity, sold, index, now, now);
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
      payload.productId,
      payload.category,
      payload.image || null,
      toCents(payload.costPrice),
      toCents(payload.sellingPrice),
      toCents(payload.unitPrice),
      payload.boxQuantity,
      payload.supplierId,
      now,
      now
    );

    const insertItem = db.prepare(`
      INSERT INTO series_items (series_id, size, quantity, sold, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    payload.items.forEach((item, index) => {
      insertItem.run(seriesId, item.size, item.quantity, Math.min(Math.max(0, item.sold), item.quantity), index, now, now);
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
  return { seriesRow, items };
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

    return {
      type,
      quantity,
      price,
      id: String(item.id ?? ''),
      name: String(item.name ?? ''),
      image: String(item.image ?? ''),
      serieId: item.serieId ? String(item.serieId) : '',
      size: item.size ? String(item.size) : '',
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

    for (const item of normalizedItems) {
      if (item.type === 'product') {
        const product = loadProduct(db, item.id);
        if (!product) {
          throw new Error(`Product not found: ${item.id}`);
        }

        const stockQty = Math.trunc(toNumber(product.stock_qty, 0));
        if (item.quantity > stockQty) {
          throw new Error(`Not enough stock for ${product.name}. Available: ${stockQty}`);
        }

        const lineTotalCents = toCents(item.price * item.quantity);
        db.prepare(`
          UPDATE products
          SET stock_qty = stock_qty - ?, updated_at = ?
          WHERE id = ?
        `).run(item.quantity, now, item.id);

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

        insertMovement.run(
          `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          product.id,
          'sale',
          orderId,
          -item.quantity,
          `Sale ${receiptNumber}`,
          now
        );
        continue;
      }

      if (item.type === 'serie-item' || item.type === 'serie') {
        if (!item.serieId) {
          throw new Error('Missing series id on cart item.');
        }

        const loadedSeries = loadSeries(db, item.serieId);
        if (!loadedSeries) {
          throw new Error(`Series not found: ${item.serieId}`);
        }

        const { seriesRow, items: seriesItems } = loadedSeries;
        const totalUnits = seriesItems.reduce((sum, row) => sum + Math.trunc(toNumber(row.quantity, 0)), 0);
        const unitCostCents = totalUnits > 0 ? Math.round(toNumber(seriesRow.cost_price_cents, 0) / totalUnits) : null;
        const boxCostCents = Math.trunc(toNumber(seriesRow.cost_price_cents, 0));
        const productId = seriesRow.product_id ? String(seriesRow.product_id) : null;

        if (item.type === 'serie') {
          const boxQuantity = Math.trunc(toNumber(seriesRow.box_quantity, 0));
          if (item.quantity > boxQuantity) {
            throw new Error(`Not enough boxes for series: ${seriesRow.name}. Available: ${boxQuantity}`);
          }

          const info = db.prepare(`
            UPDATE series
            SET box_quantity = box_quantity - ?, updated_at = ?
            WHERE id = ? AND box_quantity >= ?
          `).run(item.quantity, now, seriesRow.id, item.quantity);

          if (info.changes === 0) {
            throw new Error(`Not enough boxes for series: ${seriesRow.name}. Available: ${boxQuantity}`);
          }

          const lineTotalCents = toCents(item.price * item.quantity);

          insertOrderItem.run(
            `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
            orderId,
            productId,
            String(seriesRow.name ?? ''),
            null,
            String(seriesRow.box_barcode ?? ''),
            item.quantity,
            toCents(item.price),
            lineTotalCents,
            boxCostCents
          );

          continue;
        }

        const targetSize = item.size;
        const targetRow = seriesItems.find((row) => String(row.size ?? '') === targetSize);
        if (!targetRow) {
          throw new Error(`Size not found in series ${seriesRow.name}: ${targetSize}`);
        }

        const remaining = Math.max(0, Math.trunc(toNumber(targetRow.quantity, 0)) - Math.max(0, Math.trunc(toNumber(targetRow.sold, 0))));
        if (item.quantity > remaining) {
          throw new Error(`Not enough stock for ${seriesRow.name} size ${targetSize}. Available: ${remaining}`);
        }

        const info = db.prepare(`
          UPDATE series_items
          SET sold = sold + ?, updated_at = ?
          WHERE series_id = ? AND size = ? AND sold + ? <= quantity
        `).run(item.quantity, now, seriesRow.id, targetSize, item.quantity);

        if (info.changes === 0) {
          throw new Error(`Failed to update series item ${seriesRow.name} size ${targetSize}.`);
        }

        db.prepare(`
          UPDATE series
          SET updated_at = ?
          WHERE id = ?
        `).run(now, seriesRow.id);

        insertOrderItem.run(
          `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          orderId,
          productId,
          `${item.name || String(seriesRow.name ?? '')} — Size ${targetSize}`,
          null,
          String(seriesRow.product_barcode ?? ''),
          item.quantity,
          toCents(item.price),
          toCents(item.price * item.quantity),
          unitCostCents
        );
      }
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
