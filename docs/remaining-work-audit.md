# POS App Audit - Remaining Work

Date: 2026-04-21
Project: `Sales-desktop-app-POS-`

## Scope reviewed

- Renderer app views: POS, Scanner, Inventory, Customers, Suppliers, Reports, Settings
- Data modules in `src/app/components/data/*`
- Electron main/preload/db/IPC handlers
- Build/tooling setup (`package.json`, Vite config)

This audit focuses on what is already implemented vs what is still incomplete for production readiness, especially dashboard linking and real statistics.

## Current status snapshot

### Implemented and working (foundation)

- Electron + Vite desktop shell is wired (`electron/main.js`, `electron/preload.js`)
- SQLite schema exists with many POS tables and views (`electron/db/schema.js`)
- Generic CRUD IPC bridge exists for all declared tables (`electron/handlers/crud.js`)
- Product CRUD is connected to DB (`src/app/components/data/products.ts`)
- Customer CRUD is connected to DB (`src/app/components/data/customers.ts`)
- Supplier and purchase CRUD are connected to DB (`src/app/components/data/suppliers.ts`)
- Purchase create/update/delete adjusts product stock (`src/app/components/data/suppliers.ts`)
- Inventory, Customers, Suppliers UIs are feature-rich and mostly connected

### Partially implemented

- Reports page exists but uses mock/generated data, not live DB analytics (`src/app/components/ReportsView.tsx`)
- Customer metrics are designed to read from `sales_orders`, but checkout flow does not write sales (`src/app/components/data/customers.ts`)
- Scanner has scan history UI, but scan events are not persisted (`src/app/components/ScannerView.tsx`)

### Not implemented / missing links

- No Dashboard view component and no dashboard navigation entry
- Checkout does not persist orders/items to `sales_orders` and `sales_order_items`
- Checkout does not reduce stock or write `inventory_movements`
- Settings UI does not save/read from `store_settings`, `payment_methods`, `notification_preferences`
- Receipts do not use saved store settings (currently hardcoded store info)

## Highest-priority remaining tasks

## P0 - Critical data flow gaps

1. Persist sales on checkout (POS + Scanner)
   - Create a shared checkout service used by both views.
   - On checkout, insert one row in `sales_orders` and multiple rows in `sales_order_items`.
   - Include: receipt number, customer id, source view, subtotal, total, payment method.

2. Reduce stock on sale and log movement
   - For each sold line item, decrement `products.stock_qty`.
   - Insert corresponding `inventory_movements` rows with `source_type='sale'`.
   - Reject or warn on insufficient stock before finalizing order.

3. Replace report mocks with real analytics queries
   - Stop using generated random data in `ReportsView`.
   - Read from `sales_orders`, `sales_order_items`, and `v_daily_sales`.
   - Recompute KPI cards from real date-filtered data.

4. Implement dashboard linking
   - Add a new `DashboardView`.
   - Add sidebar nav entry and route switch in `App.tsx`.
   - Show daily sales, orders, top products, low-stock alerts, and quick actions.

## P1 - Operational correctness

5. Wire Settings to DB
   - Load and save `store_settings`.
   - Load and save `payment_methods` toggle state.
   - Load and save `notification_preferences`.

6. Make receipts dynamic
   - Use store name, address, phone from `store_settings`.
   - Use selected currency symbol/code consistently.
   - Include payment method and cashier/source metadata.

7. Persist barcode scan events
   - Write `barcode_scan_events` from scanner/POS barcode submits.
   - Track success/failure and source view.

8. Unify POS + Scanner business logic
   - They currently duplicate cart/receipt code.
   - Extract shared hooks/services for cart state, totals, checkout, and receipt generation.

## P2 - Quality and maintainability

9. Add developer quality gates
   - Add lint script.
   - Add typecheck script (there is no `tsconfig` today).
   - Add test scripts (unit + smoke).

10. Add basic Electron hardening
   - Review `sandbox: false` usage and tighten if possible.
   - Add/review CSP policy for renderer.

11. Improve file/blob storage strategy
   - Receipt images are stored as data URLs in DB; this can bloat DB quickly.
   - Move to filesystem storage + DB path reference.

12. Fix large bundle warning
   - Current build warns about large JS chunk.
   - Introduce route-based lazy loading and chart chunk split.

## Observed inconsistencies to address

- Currency mismatch:
  - Inventory labels prices in `DZ`.
  - POS/Scanner/Reports use `$`.
  - DB default currency is `USD`.
- Hardcoded analytics date in reports (`2026-04-10`) prevents real-time behavior.
- Reports recent transactions are hardcoded sample rows.
- Several schema tables/views exist but are currently unused in renderer logic.

## Suggested implementation order (practical)

1. Build checkout persistence service and wire both POS + Scanner.
2. Update stock + inventory movement logging during sales.
3. Replace Reports data layer with DB-backed analytics.
4. Add Dashboard view + sidebar link.
5. Wire Settings and dynamic receipt headers.
6. Add tests/typecheck/lint and refactor duplicated checkout code.

## Acceptance checklist for "core complete"

- Every checkout creates `sales_orders` + `sales_order_items` rows.
- Product stock changes correctly for both purchases and sales.
- `inventory_movements` logs purchase and sale deltas.
- Reports and dashboard display real DB-driven metrics by date range.
- Settings persist and affect runtime behavior (receipt/store/payment/notifications).
- No mock analytics data remains in production code.
