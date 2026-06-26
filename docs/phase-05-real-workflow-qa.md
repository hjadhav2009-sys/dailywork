# Phase 5 Real Workflow QA

Use this checklist on the real Windows machine before starting Android scanner work. Phase 5 is a QA and polish pass only: no Android app, no new scraping, and no full catalog image downloads.

## Fixtures

Local offline fixtures live in `tests/fixtures/phase5`:

- `small-catalog-master.xlsx`: 12-SKU Meesho Catalog Master with Products, Images, Attributes, and Errors sheets.
- `daily-manifest.xlsx`: courier manifest rows plus a picklist summary sheet.
- `daily-manifest.csv`: copied/exported manifest table sample.
- `picklist-summary.csv`: AWB-less picklist summary sample.
- `manifest-pdf-like-parsed.json`: PDF-like parsed manifest sample based on the existing parser shape.

## Windows Run Instructions

1. Open PowerShell in the `app` folder.
2. Run `npm install`.
3. Run `$env:DATABASE_URL='file:./dev.db'; npx prisma generate`.
4. Start the app with `$env:DATABASE_URL='file:./dev.db'; npm run dev -- --hostname 0.0.0.0 --port 3000`.
5. On the PC, open `http://localhost:3000`.
6. From a mobile device on the same Wi-Fi, open `http://<PC-LAN-IP>:3000`.
7. If mobile login fails on local Wi-Fi, confirm `.env` uses `SESSION_COOKIE_SECURE=false` for local HTTP testing.

## Owner Setup

1. Create or log in as owner.
2. Select the test account.
3. Import `tests/fixtures/phase5/small-catalog-master.xlsx` from `/owner/catalog`.
4. Confirm catalog stats show products, image URLs, attributes, and zero unexpected invalid rows.
5. Search `QA-BR-GOLD-01` as owner and confirm title, image URL, Product Highlights, and Additional Details render.

## Picker Catalog Search

1. Open `/picker/search-sku`.
2. Search `QA-BR-GOLD-01`.
3. Confirm the main image loads or shows a clear failed-image state.
4. Confirm SKU, title, Product Highlights, Additional Details, and thumbnail URLs are visible.
5. Search `QA-NOT-CATALOG` and confirm the empty state is clear.

## Daily Upload Workflow

1. Open `/owner/uploads/new`.
2. Upload `tests/fixtures/phase5/daily-manifest.xlsx`.
3. Confirm review rows include courier-wise AWB rows and AWB-less picklist summary rows.
4. Confirm duplicate AWB warning appears for `QA-AWB-0001`.
5. Confirm `QA-NOT-CATALOG` shows Missing Catalog SKU.
6. Confirm `QA-BROKEN-11` shows Image Missing / Broken.
7. Confirm import and verify duplicate AWB rows are skipped.
8. Repeat with `tests/fixtures/phase5/daily-manifest.csv`.

## Picker Workflow

1. Open `/picker`.
2. Confirm SKU cards show big readable SKU, product image, title, total quantity, AWB count, color, and size.
3. Confirm `QA-BR-GOLD-01` groups quantity from multiple AWBs.
4. Open the SKU detail screen.
5. Confirm Product Highlights and Additional Details are visible.
6. Use Picked, Not Found, Damaged, and Wrong Product actions on test data only.

## Packer Workflow

1. Open `/packing`.
2. Scan or type `QA-AWB-0001`.
3. Confirm the AWB result screen shows SKU, quantity, image/title/details, color, size, courier, and order number.
4. Confirm packed action marks only the scanned AWB.
5. Confirm problem action records a problem without blocking other AWBs for the same SKU.

## Reports And Exports

Download and inspect:

- `/owner/exports/today-picking-list`
- `/owner/exports/today-packing-list`
- `/owner/exports/missing-catalog-skus`
- `/owner/exports/broken-image-urls`
- `/owner/exports/duplicate-awbs-skipped`
- `/owner/exports/active-skus`

Confirm each CSV has headers and the expected QA fixture rows.

## Active 5-Day Loop

1. Open `/owner`.
2. Confirm Active 5-day SKUs increases after importing the manifest.
3. Change Active SKU loop days only for testing, then set it back to `5`.
4. Confirm current-order SKUs stay active and missing/broken image counts remain understandable.

## If Something Fails

- Image URL fails: picker can continue; owner should check broken image report and queue the SKU refresh from reports or catalog sync.
- SKU missing from catalog: owner should add the SKU to the Master Excel or queue a selected SKU refresh if the product URL exists.
- Manifest rows missing AWB/SKU: keep them held for review and correct the source file before import.
- Mobile scanner cannot reach the app: check PC firewall, Wi-Fi network, the `0.0.0.0` dev host, and the PC LAN IP.

## Validation Commands

Run before PR:

```powershell
npm install
$env:DATABASE_URL='file:./dev.db'; npx prisma generate
npm run typecheck
npm run lint
$env:DATABASE_URL='file:./dev.db'; npm run build
npm run test:validators
```
