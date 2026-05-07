# POS App - Recommended Features and Improvements

Date: 2026-04-21

This roadmap proposes improvements beyond the missing core tasks, with emphasis on practical value for a real store.

## Quick wins (high impact, low-to-medium effort)

1. End-of-day summary report
   - One-click printable report with sales, refunds, cash expected, and top items.

2. Low-stock center
   - Central list of products below threshold with reorder suggestions.
   - Link directly to supplier purchase creation.

3. Global search palette
   - Search product/customer/supplier from anywhere.
   - Jump actions: "new sale", "add purchase", "add customer".

4. Better receipt controls
   - Toggle logo/footer text.
   - Optional VAT/tax breakdown.
   - Print and email option (if email service added later).

5. Saved report presets
   - Store favorite date ranges and export presets per user.

## Core retail capabilities to add next

## Sales and checkout

- Discounts: line-level and order-level (fixed amount and percent)
- Tax profiles: per product category and tax-inclusive/exclusive modes
- Refunds/returns with reason tracking and inventory restock toggle
- Hold/resume cart and parked orders
- Split payment and partial payment support
- Cash drawer balance workflow (open/close shift, cash in/out)

## Inventory and purchasing

- Manual stock adjustment screen with reason codes
- Stock transfer model (if multi-location is planned)
- Purchase order lifecycle: draft -> ordered -> received (partial/full)
- Supplier lead-time tracking and reorder point automation
- Batch-level cost tracking for better margin analytics

## Customer features

- Customer loyalty points or tier program
- Customer tags/segments (VIP, wholesale, inactive)
- Purchase history timeline in customer detail
- Basic CRM notes and follow-up reminders

## Analytics and intelligence

- Top products by revenue, quantity, and margin
- Sales by hour/day to optimize staffing
- Category and supplier margin analysis
- Dead stock and slow-moving inventory report
- Forecast: expected stock-out dates based on sales velocity

## Platform and architecture improvements

1. Introduce repository/service layer in Electron
   - `electron/repositories/index.js` and `electron/services/index.js` are placeholders.
   - Move business rules out of renderer and out of generic CRUD calls.

2. Add domain modules in renderer
   - `sales.ts`, `settings.ts`, `analytics.ts` data modules for clearer boundaries.

3. Add schema migration discipline
   - Keep migration per change with clear up/down strategy.
   - Add migration smoke tests for blank DB and existing DB.

4. Add backup/restore
   - Manual and scheduled backup of SQLite DB.
   - Restore with integrity validation and warning prompts.

5. Add import/export tools
   - CSV import for products/customers/suppliers.
   - Export full catalog and selected reports.

## Product quality and reliability

- Add test layers:
  - unit tests for calculation/business rules,
  - integration tests for DB flows,
  - end-to-end smoke tests for checkout and reports.
- Add error boundary and user-friendly error toasts.
- Add telemetry/logging (local log files) for support diagnostics.
- Add feature flags for staged rollout of risky features.

## Suggested phased roadmap

### Phase 1 (1-2 weeks)

- Complete missing core flow (sales persistence, stock updates, real reports, dashboard link)
- Wire settings and dynamic receipts
- Add lint + typecheck + basic smoke tests

### Phase 2 (2-4 weeks)

- Add returns/refunds, discounts, tax rules
- Add low-stock center and reorder workflow
- Add end-of-day report and saved report presets

### Phase 3 (4-8 weeks)

- Add loyalty/segmentation, shift controls, split payments
- Add advanced analytics (margin, slow movers, supplier efficiency)
- Add backup/restore and import/export utilities

## Recommended success metrics

- Checkout completion time (median)
- Error rate during checkout and report generation
- Stock accuracy (system vs physical count)
- Repeat customer rate
- Gross margin trend by week/month
- Number of manual stock corrections (should decrease over time)
