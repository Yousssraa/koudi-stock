# KOUDI STOCK — Wood Sales & Inventory Management

Full-stack timber sales & stock management app (Moroccan timber market, priced in MAD/m³).

- **Backend:** Django 5 + Django REST Framework, connected to Supabase PostgreSQL 17
- **Frontend:** React 18 + Vite + Tailwind CSS 4 (warm beige & brown theme — beige surfaces, brown text/accents, muted green for inflow, terracotta for outflow)
- **Database:** existing Supabase `public` schema (11 tables from `schema.sql`)
- **Demo:** one command (`start_demo.bat`) serves the built interface + API on a single port

## Quick start (presentation demo)

Double-click **`start_demo.bat`** (or run it from a terminal). It:
1. builds the frontend (`npm run build`, incl. gzip compression),
2. collects static files (`python manage.py collectstatic` — whitenoise compression + cache headers),
3. starts Django on `http://127.0.0.1:8001` (which serves **both** the API and the built interface),
4. opens the browser automatically.

> Only one URL to show: **http://127.0.0.1:8001** — no dev server, no CORS, no second terminal.

### Connexion (démo)

L'API est protégée par authentification par token. La première page affichée est
l'écran de connexion :

- **utilisateur :** `demo`
- **mot de passe :** `demo2026`

Le compte `demo` est créé par `python seed_demo.py` (idempotent).

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm

## Project layout

```
KOUDI STOCK/
├── backend/            Django REST API
│   ├── koudi_backend/  project settings/urls (whitenoise static serving)
│   ├── stock/          models, serializers, views, services
│   ├── schema.sql      original Supabase schema (source of truth)
│   ├── smoke_test.py   API integration test
│   ├── seed_demo.py    demo data (MAD/m³, Dépôt Casablanca / Dépôt Tanger)
│   └── .env            DB credentials + SECRET_KEY (already configured)
└── frontend/           React + Vite + Tailwind app
    ├── .env.example    optional VITE_API_URL override (copy to .env)
    └── src/
        ├── pages/      Dashboard, Inventory, Transactions, Clients, Drying,
            │               Archive, Audit, Login, NotFound
        ├── components/ Layout (top bar + sidebar), WoodCalculatorModal,
        │               ToastContext, MetricCard, StockBadge, MoistureBadge,
        │               ProductModal, EmptyState, Skeleton
        ├── context/    AppContext (warehouses, selected dépôt, refresh)
        └── api/        axios client (baseURL: /api in prod, 127.0.0.1:8001 in dev),
                        download helper (PDFs) in download.js
```

## 1. Backend setup & run

```bash
cd backend
python -m venv venv
venv\Scripts\activate           # Windows
pip install -r requirements.txt

python manage.py migrate        # applies the authtoken tables on first run
python manage.py migrate --fake-initial   # adopt existing Supabase tables
python manage.py collectstatic --noinput # whitenoise compression + cache headers
python seed_demo.py                       # demo data + user (rebuilds a realistic Jan–Aug 2026 ledger)

python manage.py runserver 127.0.0.1:8001
```

> Port **8001** is used because port 8000 is occupied by the separate
> **GestionBois** project — do not touch that one.

### Tests

```bash
cd backend
python manage.py test stock --keepdb -v 2
```

17 regression tests cover the enterprise modules (landed cost & margins,
client credit/payments/overdue, kiln drying, tier pricing and the discount
line on the invoice PDF). A fresh test database needs the `maintain_inventory`
trigger — it is installed by migration `0005_maintain_inventory_trigger`
(idempotent `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS`). Use
`--keepdb` so Supabase skips the `DROP DATABASE` teardown (the hosting role may
not close the last connection).

## 2. Frontend setup & run

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

The frontend calls the Django API directly at `http://127.0.0.1:8001/api`
(CORS is enabled in the backend), so no proxy configuration is required.

### API URL (frontend → backend)

`frontend/src/api/client.js` picks the base URL automatically:

| Build | Default base URL | How to override |
| ----- | ---------------- | --------------- |
| dev (`npm run dev`, port 5173) | `http://127.0.0.1:8001/api` | `VITE_API_URL` in `frontend/.env` |
| prod (`npm run build`) | `/api` (same origin) | `VITE_API_URL` in `frontend/.env` before building |

See `frontend/.env.example`.

## Production deployment

The demo is single-port and presentation-ready; for a real deployment:

```bash
# backend
pip install -r requirements.txt          # includes gunicorn + whitenoise + Brotli
python manage.py migrate
python manage.py collectstatic --noinput
python seed_demo.py                   # optional demo data + user (rebuilds ledger)

# frontend
cd frontend
npm install
npm run build                            # outputs to dist/ (gzip via vite-plugin-compression)

# run (Linux)
cd ../backend
gunicorn koudi_backend.wsgi:application \
  --bind 0.0.0.0:8001 \
  --workers 3 \
  --timeout 120
```

- **Static + SPA:** whitenoise serves `frontend/dist` at the site root (with
  `index.html` fallback for client-side routes) and Django's admin files from
  `staticfiles/`. Hashed assets (`index-*.js/css`) are served with
  `Cache-Control: public, max-age=31536000, immutable`.
- **Environment:** set `DEBUG=False`, a real `SECRET_KEY`, and
  `ALLOWED_HOSTS=yourdomain.com` in `backend/.env` (or env vars). See
  `backend/.env`.
- **CORS:** if the API and the frontend are on different domains, build with
  `VITE_API_URL=https://api.yourdomain.com/api` and allow that frontend origin
  via `CORS_ALLOWED_ORIGINS`.
- **HTTPS:** terminate TLS at a reverse proxy (nginx / Caddy / Cloudflare) in
  front of the gunicorn socket.
- **Backups:** the database lives in Supabase (managed); enable periodic
  backups there.

## API endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET/POST | `/api/products/` | Products + filters (`species`, `grade`, `warehouse`, `moisture_min/max`, `search`, `stock_status`) |
| GET/POST | `/api/products/<id>/` | Product detail (volume auto-computed on save; `landed_cost_per_m3` incl.) |
| GET | `/api/products/lookup/` | Lightweight product list incl. dimensions + MAD prices |
| GET | `/api/wood-types/`, `/api/warehouses/`, `/api/clients/`, `/api/suppliers/` | Reference data (clients incl. credit summary) |
| GET | `/api/inventory/`, `/api/stock-movements/` | Stock levels & movement ledger |
| POST | `/api/purchases/` | Create purchase + `purchase_in` movements (stock +); optional `fees` for landed cost |
| POST | `/api/sales/` | Create sale + `sale_out` movements (stock −) |
| POST | `/api/transfers/` | Transfer stock between warehouses |
| GET | `/api/dashboard/` | Aggregated metrics + `species_volume`, `monthly_sales_series`, `top_products`, `monthly_in/out` + recent movements |
| GET | `/api/purchase-orders/`, `/api/sales-orders/` | Order documents (line `volume_m3` included) |
| GET | `/api/sales-orders/<id>/invoice/` | Download an invoice PDF (TVA 20% incluse, signed layout) |
| GET | `/api/sales-orders/<id>/quotation/` | Download a quotation PDF (devis provisoire) |
| GET | `/api/products/<id>/label/?qty=&warehouse=` | QR bundle labels (A4 grid, SKU · dimensions · volume · dépôt scannable) |
| POST | `/api/reorders/` | Create a DRAFT purchase reorder from stock alerts (`items[].quantity` optional — server suggests restock qty from m³ deficit) |
| GET | `/api/clients/<id>/credit/` | Receivables summary per client (impayés, retards, plafond, disponible) |
| POST | `/api/payments/` | Enregistrer un encaissement (règle un facture/partie d'une facture) |
| GET | `/api/payments/?client=` | Payment ledger (filter by client) |
| GET | `/api/kilns/` | Séchoirs avec occupation live (m³ chargés, disponible, lots actifs) |
| GET | `/api/kilns/dashboard/` | Métriques séchoirs (occupation, taux d'utilisation, coût énergie, durée moyenne de cycle) |
| GET | `/api/kilns/<id>/batches/` | Historique complet des cycles d'un séchoir (200 derniers) |
| GET/POST | `/api/drying-batches/` | Lots de séchage (cycle : En cours → Terminé / Annulé) |
| POST | `/api/drying-batches/<id>/complete/` | Terminer un cycle (`current_moisture` optionnel) — humidité produit + répercussion du coût énergie sur le prix |
| POST | `/api/drying-batches/<id>/cancel/` | Annuler un cycle en cours (produit inchangé) |
| GET | `/api/price-tiers/` | Barèmes de remise volume (m³) |
| GET | `/api/pricing/lookup/?volume_m3=` | Remise applicable pour un volume donné (aperçu live) |
| GET | `/api/audit/` | Admin-only audit trail (actions: create/update/delete/price_update/login/logout/download/reorder/transfer/close_month; filters `action`, `entity_type`, `user`, `search`, `from`, `to`) |
| GET | `/api/auth/me/` | Current user (`is_staff`/`is_superuser`) — used to gate the Audit page |
| GET | `/api/archive/` | Archived months with summaries (clôture stock, achats, ventes) |
| GET | `/api/archive/<year>/<month>/` | Archived product/warehouse rows for a month (filters: `warehouse`, `category`, `search`) |
| POST | `/api/archive/close/` | Close a month: build `monthly_archive` snapshots from inventory + ledger |
| POST | `/api/auth/login/`, `/api/auth/logout/` | Token authentication (`Authorization: Token <key>`) |

Example sale request (priced per cubic metre in MAD):

```json
POST /api/sales/
{
  "client_id": 1,
  "warehouse_id": 1,
  "items": [{
    "product_id": 1,
    "quantity": 10,
    "price_per_m3": 12800,
    "thickness_mm": 27,
    "width_mm": 145,
    "length_mm": 2500,
    "lot_number": "LOT-2026-041"
  }]
}
```

Line totals are `volume_m3 × price_per_m3` (MAD). If dimensions are omitted the
product catalog dimensions are used.

## Volume calculation

Volume (m³) = (Thickness_mm × Width_mm × Length_mm × Quantity) / 1,000,000,000

- Computed automatically in `Product.save()` (`stock/models.py:compute_volume_m3`)
- Per-movement and per-order-line volume is exposed on the API
- The DB trigger `maintain_inventory()` updates `inventory` from each ledger
  row and raises an "Insufficient stock" error on overselling (surfaced as a
  toast notification in the UI)

## Key business rules

- Products track **dimensions** (T×W×L mm), **species**, **grade** (FAS, Cabinet…),
  **finish**, **moisture %** and per-unit volume
- **Pricing:** timber is sold per cubic metre (MAD/m³); totals are computed on
  the server as m³ × price_per_m3
- **Moisture status:** `kd` ≤ 12% (Sec Séchoir) · `air_dried` 12–18% · `green` > 18%
- **Lot/batch tracking** via `stock_movements.lot_number`
- Samples **PDF documents** generated server-side with ReportLab:
  - **Facture** & **Devis** per sale order (client, dépôt, lignes m³, PU MAD/m³,
    sous-total HT, TVA 20%, total TTC) — downloadable from the Transactions page
  - **QR bundle labels** per product/batch (payload: `KOUDI|SKU|dims|m³|dépôt`),
    printed on an A4 3×4 grid from the Inventory page
- **Reorder thresholds** (`reorder_threshold_m3` on each product, in m³): the
  dashboard flags every product below its threshold, shows the m³ deficit and a
  **suggested restock quantity**, and generates a DRAFT supplier purchase order
  in one click
- **Landed cost & true margin:** purchase orders accept logistics fees
  (`fees`: freight / customs / handling in MAD), allocated to lines by volume.
  Each product exposes a `landed_cost_per_m3` (weighted average across receipts)
  and each sale order computes `landed_subtotal`, `margin_mad` and `margin_pct`
  (net of the applied discount) — the real margin instead of the list gross.
- **Credit control & receivables:** clients carry a `credit_limit` (MAD),
  `payment_terms_days` and an optional `is_blocked` flag. A **payment ledger**
  (`/api/payments/`) tracks receipts, so every client shows `outstanding`,
  `overdue`, `available_credit` and `credit_used_pct`. New sales only hard-block
  blocked clients; sales that would exceed the limit return a `credit_warning`
  payload and are flagged in the UI (confirm-override pattern) and the audit trail.
- **Kiln drying lifecycle:** dedicated `kilns` units (capacity in m³, live
  occupancy computed from in-progress charges) host `drying_batches` running
  `in_progress → completed | cancelled`. The moisture *stage* (Vert /
  Séché à l'air / Sec Séchoir) is derived from the current moisture. Completing
  a batch stores the final moisture on the product, flags it `finish =
  kiln-dried` and raises its cost & sale prices by the batch **energy cost per
  m³**; cancelling leaves the product untouched. The server rejects any new
  charge exceeding the kiln's free capacity (`400 Capacité insuffisante`).
  Kiln dashboard + batch
  management on `/drying` via `/api/kilns/dashboard/`,
  `/api/drying-batches/<id>/complete/` and `/api/drying-batches/<id>/cancel/`.
- **Volume tier pricing:** `price_tiers` define discount brackets on the total
  order volume (m³) — e.g. détail 0 m³ / semi-gros ≥10 m³ −3% / gros ≥25 m³ −5% /
  industriel ≥50 m³ −8%. Sales and the live Wood Calculator apply the best
  matching tier (`tier_name`, `discount_percent`, `discount_amount`).
- **Audit trail** (`/api/audit/`, admin-only): full traceability of logins,
  product/stock/order changes, document downloads, transfers, reorders and
  month closes — browsable page at `/audit`, gated on the current user's role
- Multi-warehouse (Dépôt Casablanca / Dépôt Tanger) with inter-warehouse **transfers**
- Stock status badges: In Stock / Low Stock / Out of Stock (driven by `min_stock_qty`)

## Security

- All `/api/` endpoints require token authentication (DRF `TokenAuthentication`),
  plus session auth for the browsable API.
- `DEBUG` defaults to `False`, `CORS_ALLOW_ALL_ORIGINS` defaults to `False`, and a
  `SECRET_KEY` is required in `backend/.env` when not in debug mode. Override via
  the environment variables `DEBUG`, `CORS_ALLOW_ALL_ORIGINS`, `CORS_ALLOWED_ORIGINS`.
- Defaults are aligned with the business: `TIME_ZONE = Africa/Casablanca`,
  `LANGUAGE_CODE = fr-fr`, currency `MAD`.

## Presentation-ready features

- **Branding:** custom SVG logo/favicon, `lang="fr"`, meta description, per-page titles
- **Polish:** skeleton loaders, empty states, 404 page, French copy, toast notifications
- **Dashboard:** KPI cards, monthly sales trend, species volume chart, top products,
  movement log with green/red arrows, monthly in/out balance
- **Inventory:** advanced table (SKU, essence, dimensions, m³, moisture, grade, qty,
  dépôts, status), filter pills, global search, pagination and **CSV export**
- **Wood showcase:** each product card shows a **real photo of its wood species**
  (shot of the grain or the tree, from Wikimedia Commons, stored locally in
  `frontend/public/wood/` so the demo works offline — credits in
  `frontend/public/wood/CREDITS.md`)
- **Live Wood Calculator:** L×W×T×Qty → m³ → total MAD in real time, wired to
  purchases, sales and transfers — plus live **tier-discount preview** and a
  **credit warning** banner when the selected client nears/passes its limit
- **Clients & Crédit (`/clients`):** receivables dashboard with outstanding/limit
  gauges, overdue and blocked badges, and one-click **encaissements**
- **Séchage & Séchoir (`/drying`):** kiln dashboard — occupancy bars per séchoir
  (SEC-1/2/3, capacité m³), drying KPIs (capacité engagée, lots en cours, coût
  énergie, durée moyenne), batch table with moisture progress bars and
  **Terminer / Annuler** lifecycle actions
- **True margins everywhere:** Transactions page shows each sale's margin %,
  tier name and paid/remaining balance
- **Archives:** monthly stock snapshots (clôture / achats / ventes / transferts per
  product & dépôt), browsable month by month on a dedicated page (`/archive`),
  built by `seed_demo.py` for Jan–Jul 2026

## Mise en ligne (Render.com)

Le projet se déploie comme **un seul service web** : Django sert l'API `/api/*`,
l'admin `/admin/*` **et** le build React (WhiteNoise + fallback SPA), connecté à
la base Supabase existante.

### 1. Pousser le code sur GitHub

```bash
git init && git add . && git commit -m "KOUDI STOCK"
git remote add origin https://github.com/<vous>/koudi-stock.git
git push -u origin main
```

> ⚠️ Ne commitez jamais `backend/.env` (il contient les accès base de données).

### 2. Créer le service sur Render

1. [render.com](https://render.com) → **New → Web Service** → connecter le repo GitHub.
2. Laisser Render lire `render.yaml` (Blueprint) **ou** saisir manuellement :
   - **Root Directory** : *(racine du repo)*
   - **Build Command** : `bash build.sh`
   - **Start Command** : `gunicorn --chdir backend koudi_backend.wsgi:application --workers 2 --threads 4`
3. Renseigner la variable d'environnement **`DATABASE_URL`** avec l'URI Supabase
   (*Project Settings → Database → Connection string → URI*), en remplaçant
   `[YOUR-PASSWORD]`. Utiliser l'hôte **pooler session** (`...pooler.supabase.com:5432`)
   ou la connexion directe — pas le port `6543` (transaction mode, incompatible
   avec les connexions persistantes de Django).
4. Déployer : `build.sh` installe les dépendances, construit le frontend, applique
   les migrations et collecte les statiques automatiquement.

Les autres variables (`SECRET_KEY`, `DEBUG=False`, `ALLOWED_HOSTS`,
`CSRF_TRUSTED_ORIGINS`) sont déjà définies dans `render.yaml`.

### 3. Repartir sur des données réelles

```bash
python manage.py purge_demo            # vide catalogue, clients, mouvements…
python manage.py purge_demo --dry-run  # aperçu sans suppression
```

Conservés : dépôts, utilisateurs et **profil société**. Les données de démo
peuvent être restaurées à tout moment en local avec `python seed_demo.py`.

### 4. Identité société sur les factures (ICE, RC, IBAN…)

Les PDFs (factures/devis) lisent le profil société éditable :

- via l'API : `PATCH /api/company/` ;
- via l'admin Django : `/admin/` → **Company profile**
  (nom, adresse, téléphone, email, ICE, IF, patente, CNSS, RC, banque, RIB/IBAN).
  Tant qu'un champ est vide il n'est simplement **pas imprimé** — plus aucune
  valeur factice ne figure sur les documents.

### Notes

- Le plan gratuit Render s'endort après ~15 min d'inactivité (réveil ~30 s).
- Changer le mot de passe `demo` (ou créer un vrai compte) juste après la mise
  en ligne : `/admin/` → Users.


