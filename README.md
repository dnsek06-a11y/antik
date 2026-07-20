# Antikvariát – e-shop

E-shop pro prodej použitých LP desek a knih (unikátní kusy). Postaveno na Medusa.js v2 + Next.js.
Kompletní zadání a architektura: [`eshop-antikvariat-projekt.md`](./eshop-antikvariat-projekt.md).

## Struktura repozitáře

```
antikeshop/
├── backend/                  Medusa v2 backend (Node.js/TypeScript)
│   └── apps/storefront/      Next.js storefront (medusa-next starter)
├── infra/
│   └── caddy/Caddyfile       reverse proxy konfigurace
├── scripts/                  import/utility skripty (katalog, feedy...)
├── docker-compose.yml        celý stack pro lokální vývoj i produkci na VPS
└── .env.example              vzor proměnných prostředí
```

## Lokální vývoj

1. Zkopíruj `.env.example` do `.env` a doplň hodnoty (hesla, secrets vygeneruj náhodně).
2. Spusť infrastrukturu:
   ```bash
   docker compose up -d postgres redis meilisearch
   ```
3. Backend (Medusa):
   ```bash
   cd backend
   npm install
   npx medusa db:migrate
   npm run dev
   ```
4. Storefront (Next.js):
   ```bash
   cd backend/apps/storefront
   npm install
   npm run dev
   ```

## Produkční nasazení (Hetzner VPS)

```bash
git clone <repo> antikeshop && cd antikeshop
cp .env.example .env   # doplnit produkční hodnoty
docker compose build
docker compose up -d
```

Volitelné služby (MinIO, Uptime Kuma, Umami):
```bash
docker compose --profile extra up -d
```

Caddy automaticky vyřídí HTTPS (Let's Encrypt) pro domény nastavené v `.env`
(`DOMAIN_STOREFRONT`, `DOMAIN_BACKEND`) – VPS musí mít tyto domény nasměrované na svou veřejnou IP.

## Import katalogu

Skript `scripts/import-catalog` čte CSV (viz `scripts/import-catalog/sample.csv` pro formát
sloupců), doplní metadata z Discogs/Google Books a vytvoří produkty přes Medusa Admin API
včetně vlastních polí (`item_details`) a skladové úrovně 1 ks.

```bash
cd scripts/import-catalog
npm install
export MEDUSA_BACKEND_URL=http://localhost:9000
export MEDUSA_ADMIN_EMAIL=admin@example.cz
export MEDUSA_ADMIN_PASSWORD=...
export DISCOGS_TOKEN=...        # volitelné
export GOOGLE_BOOKS_API_KEY=... # volitelné
npm run import -- ./katalog.csv --photos-dir ./fotky
```

Kategorie v CSV musí odpovídat názvům leaf kategorií vytvořeným seed skriptem
(`npm run seed` v `backend/apps/backend`).

## Fáze projektu

Viz sekce 10 v [`eshop-antikvariat-projekt.md`](./eshop-antikvariat-projekt.md). Aktuální stav a rozhodnutí
se průběžně doplňují níže.

### Stav

- [x] Fáze 2 – infrastruktura (docker-compose, Caddy, .env skeleton)
- [x] Fáze 3 – custom datový model (`antiquarian` modul, kategorie, import skript)
- [x] Fáze 4 – storefront (filtrování dle stavu/ceny/roku, produktová stránka); branding a plný i18n pass zatím neřešeny
- [x] Fáze 5 – platby (Comgate) a doprava (Packeta/Zásilkovna) – provider moduly hotové a ověřené proti Store API, chybí reálné sandbox přihlašovací údaje a storefront widget pro výběr výdejního místa (dočasně ruční zadání ID)
- [ ] Fáze 6 – SEO a feedy (Heureka/Zboží, sitemap)
- [ ] Fáze 7 – testování, GDPR, ostrý start
