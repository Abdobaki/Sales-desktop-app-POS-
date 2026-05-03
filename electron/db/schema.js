const MIGRATIONS = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS store_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          store_name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          low_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
          currency_code TEXT NOT NULL DEFAULT 'USD',
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS payment_methods (
          code TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
          sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS notification_preferences (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          low_stock_alerts_enabled INTEGER NOT NULL DEFAULT 1 CHECK (low_stock_alerts_enabled IN (0, 1)),
          daily_sales_summary_enabled INTEGER NOT NULL DEFAULT 1 CHECK (daily_sales_summary_enabled IN (0, 1)),
          new_customer_signups_enabled INTEGER NOT NULL DEFAULT 1 CHECK (new_customer_signups_enabled IN (0, 1)),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
        );

        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          name TEXT NOT NULL,
          company TEXT,
          phone TEXT NOT NULL,
          email TEXT,
          address TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
        );

        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          sku TEXT NOT NULL UNIQUE,
          barcode TEXT UNIQUE,
          variants TEXT NOT NULL DEFAULT '-',
          image_url TEXT,
          cost_price_cents INTEGER NOT NULL CHECK (cost_price_cents >= 0),
          sale_price_cents INTEGER NOT NULL CHECK (sale_price_cents >= 0),
          stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
          supplier_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS supplier_purchases (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          supplier_id TEXT NOT NULL,
          product_id TEXT,
          product_name_snapshot TEXT NOT NULL,
          product_barcode_snapshot TEXT,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
          total_cost_cents INTEGER NOT NULL CHECK (total_cost_cents >= 0),
          purchase_date TEXT NOT NULL,
          notes TEXT,
          receipt_data_url TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS sales_orders (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          receipt_number TEXT NOT NULL UNIQUE,
          customer_id TEXT,
          source_view TEXT NOT NULL DEFAULT 'pos' CHECK (source_view IN ('pos', 'scanner')),
          sold_at TEXT NOT NULL DEFAULT (datetime('now')),
          subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
          discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
          tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
          total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
          payment_method_code TEXT,
          notes TEXT,
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
          FOREIGN KEY (payment_method_code) REFERENCES payment_methods(code) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS sales_order_items (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          sales_order_id TEXT NOT NULL,
          product_id TEXT,
          product_name_snapshot TEXT NOT NULL,
          product_sku_snapshot TEXT,
          product_barcode_snapshot TEXT,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
          line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),
          unit_cost_cents INTEGER,
          FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS barcode_scan_events (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          barcode TEXT NOT NULL,
          product_id TEXT,
          product_name_snapshot TEXT,
          success INTEGER NOT NULL CHECK (success IN (0, 1)),
          scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
          source_view TEXT NOT NULL DEFAULT 'scanner' CHECK (source_view IN ('scanner', 'pos')),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS inventory_movements (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          product_id TEXT NOT NULL,
          source_type TEXT NOT NULL CHECK (source_type IN ('purchase', 'sale', 'manual_adjustment')),
          source_id TEXT,
          quantity_delta INTEGER NOT NULL,
          reason TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
        CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
        CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
        CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
        CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
        CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
        CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company);
        CREATE INDEX IF NOT EXISTS idx_supplier_purchases_supplier_date ON supplier_purchases(supplier_id, purchase_date DESC);
        CREATE INDEX IF NOT EXISTS idx_sales_orders_sold_at ON sales_orders(sold_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id, sold_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sales_items_order ON sales_order_items(sales_order_id);
        CREATE INDEX IF NOT EXISTS idx_sales_items_product ON sales_order_items(product_id);

        CREATE VIEW IF NOT EXISTS v_customer_metrics AS
        SELECT
          c.id AS customer_id,
          COUNT(so.id) AS total_orders,
          COALESCE(SUM(so.total_cents), 0) AS total_spent_cents,
          MAX(so.sold_at) AS last_purchase_at
        FROM customers c
        LEFT JOIN sales_orders so ON so.customer_id = c.id
        GROUP BY c.id;

        CREATE VIEW IF NOT EXISTS v_supplier_metrics AS
        SELECT
          s.id AS supplier_id,
          COUNT(sp.id) AS total_purchases,
          COALESCE(SUM(sp.total_cost_cents), 0) AS total_spent_cents
        FROM suppliers s
        LEFT JOIN supplier_purchases sp ON sp.supplier_id = s.id
        GROUP BY s.id;

        CREATE VIEW IF NOT EXISTS v_daily_sales AS
        SELECT
          date(sold_at) AS sales_day,
          COUNT(*) AS orders_count,
          COALESCE(SUM(total_cents), 0) AS revenue_cents
        FROM sales_orders
        GROUP BY date(sold_at)
        ORDER BY sales_day;
      `);

      db.exec(`
        INSERT INTO store_settings (id, store_name)
        VALUES (1, 'Fashion Boutique')
        ON CONFLICT(id) DO NOTHING;

        INSERT INTO notification_preferences (id)
        VALUES (1)
        ON CONFLICT(id) DO NOTHING;

        INSERT INTO payment_methods (code, label, enabled, sort_order)
        VALUES ('credit_card', 'Credit Card', 1, 1)
        ON CONFLICT(code) DO NOTHING;

        INSERT INTO payment_methods (code, label, enabled, sort_order)
        VALUES ('debit_card', 'Debit Card', 1, 2)
        ON CONFLICT(code) DO NOTHING;

        INSERT INTO payment_methods (code, label, enabled, sort_order)
        VALUES ('cash', 'Cash', 1, 3)
        ON CONFLICT(code) DO NOTHING;

        INSERT INTO payment_methods (code, label, enabled, sort_order)
        VALUES ('digital_wallet', 'Digital Wallet', 1, 4)
        ON CONFLICT(code) DO NOTHING;
      `);
    },
  },
  {
    version: 2,
    up(db) {
      db.exec(`
        DELETE FROM products
        WHERE id IN ('1', '2', '3', '4', '5', '6', '7', '8', '9')
          AND sku IN ('TS-001', 'JN-002', 'LJ-003', 'PS-004', 'CP-005', 'WS-006', 'CG-007', 'LB-008', 'LS-009');
      `);
    },
  },
  {
    version: 3,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS series (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          name TEXT NOT NULL,
          box_barcode TEXT NOT NULL UNIQUE,
          product_barcode TEXT NOT NULL UNIQUE,
          product_id TEXT,
          category TEXT NOT NULL,
          image_url TEXT,
          cost_price_cents INTEGER NOT NULL CHECK (cost_price_cents >= 0),
          selling_price_cents INTEGER NOT NULL CHECK (selling_price_cents >= 0),
          unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
          supplier_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS series_items (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          series_id TEXT NOT NULL,
          size TEXT NOT NULL,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          sold INTEGER NOT NULL DEFAULT 0 CHECK (sold >= 0 AND sold <= quantity),
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
          UNIQUE (series_id, size)
        );

        CREATE INDEX IF NOT EXISTS idx_series_category ON series(category);
        CREATE INDEX IF NOT EXISTS idx_series_supplier ON series(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_series_items_series ON series_items(series_id, sort_order);
      `);
    },
  },
  {
    version: 4,
    up(db) {
      db.exec(`
        ALTER TABLE series ADD COLUMN box_quantity INTEGER NOT NULL DEFAULT 1 CHECK (box_quantity >= 0);
      `);
    },
  },
];

function getUserVersion(db) {
  return db.pragma('user_version', { simple: true });
}

function setUserVersion(db, version) {
  db.pragma(`user_version = ${version}`);
}

export function runSchemaMigrations(db) {
  let currentVersion = getUserVersion(db);

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) {
      continue;
    }

    const applyMigration = db.transaction(() => {
      migration.up(db);
      setUserVersion(db, migration.version);
    });

    applyMigration();
    currentVersion = migration.version;
  }
}
