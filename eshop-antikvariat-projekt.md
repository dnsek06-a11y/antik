# Projekt: E-shop – Antikvariát LP desek a knih

> Tento dokument slouží jako kompletní zadání a technická specifikace pro implementaci. Je určen jako vstupní kontext pro Claude Code.

## 1. Přehled projektu

- **Typ obchodu:** antikvariát – prodej použitých LP desek a knih
- **Rozsah katalogu:** ~1000 položek
- **Klíčové specifikum:** naprostá většina položek je **unikátní kus** (1 produkt = 1 konkrétní fyzický exemplář, ne "skladová varianta v 50 ks")
- **Provoz:** VPS od Hetzneru (doporučeno CX22 – 2 vCPU / 4 GB RAM / 40 GB NVMe, ~4,5 €/měsíc, s rezervou dostačující pro 1000 položek)
- **Vývojář:** self, s pomocí Claude Code
- **Cílový trh:** Česká republika (platby, doprava, marketingové feedy jsou lokalizované na CZ)

## 2. Tech stack (celé open-source / zdarma)

| Vrstva | Technologie | Poznámka |
|---|---|---|
| Backend / e-commerce engine | **Medusa.js v2** (Node.js, TypeScript) | headless, REST API, vlastní admin UI |
| Storefront | **Next.js** (oficiální medusa-next storefront jako základ) | |
| Databáze | **PostgreSQL** | hlavní úložiště dat |
| Cache / fronty | **Redis** | Medusa v2 workflow engine, event bus |
| Fulltextové hledání a filtry | **Meilisearch** | self-hosted, lehké na 1000 položek |
| Objektové úložiště fotek | **MinIO** (S3-kompatibilní) nebo lokální disk + zálohy | |
| Reverse proxy / HTTPS | **Caddy** | automatický TLS (Let's Encrypt), VPS má vlastní veřejnou IP, žádný port-forwarding řešit netřeba |
| CDN / DDoS ochrana (volitelné) | **Cloudflare** (proxy DNS, free tier) | nepovinné, ale zdarma přidá cache a ochranu před Caddy |
| Analytika | **Umami** nebo **Plausible** (self-hosted) | GDPR-friendly náhrada GA4 |
| Monitoring dostupnosti | **Uptime Kuma** | notifikace na mobil při výpadku |
| CI/CD | GitHub Actions (free tier) | deploy na homelab přes SSH/Docker |
| Zálohy | `pg_dump` + cron → offsite (Backblaze B2 free tier) | **musí být mimo homelab** |

## 3. Architektura – Docker Compose služby

Doporučená sada kontejnerů (jeden `docker-compose.yml` na homelabu):

```
caddy            (reverse proxy, HTTPS)
medusa-backend   (Node.js, Medusa v2)
storefront        (Next.js)
postgres          (databáze)
redis             (cache/fronty pro Medusa)
meilisearch       (search)
minio             (volitelně, S3-kompatibilní storage pro obrázky)
uptime-kuma       (monitoring)
umami / plausible (analytika)
```

Zákazník → (volitelně Cloudflare proxy) → Caddy (na veřejné IP VPS) → Next.js storefront / Medusa backend API → PostgreSQL / Redis / Meilisearch.

Externí (mimo homelab, volané přes API z Medusa backendu):
- GoPay / Comgate (platby)
- Zásilkovna (Packeta) API (doprava)
- Discogs API (metadata desek)
- Google Books API / OpenLibrary API (metadata knih)
- Heureka.cz / Zboží.cz (XML feed exportu produktů)

## 4. Datový model produktu

### 4.1 Princip pro unikátní kusy

Jeden produkt = jedna fyzická položka = **jedna varianta** (žádné skutečné product options jako velikost/barva).

```
Product "Pink Floyd – The Dark Side of the Moon (UK press, 1973)"
  └── 1 ProductVariant (defaultní)
        ├── InventoryItem → InventoryLevel: quantity = 1, allow_backorder = false
        └── PriceSet → cena
```

Po prodeji klesne quantity na 0 → produkt automaticky zmizí z nabídky. Přesně odpovídá logice "1 kus, žádný sklad".

### 4.2 Core Product entity (Medusa v2, out-of-box)

`title`, `subtitle`, `description`, `handle`, `status`, `thumbnail`, `images[]`, `categories`, `collections`, `tags`, `type`, `options`, `metadata` (JSON).

**Ceny a sklad nejsou na variantě přímo** – jsou propojené přes moduly:
- Pricing modul (`PriceSet`) ↔ ProductVariant
- Inventory modul (`InventoryItem` + `InventoryLevel`) ↔ ProductVariant

### 4.3 Vlastní pole přes Module Links (ne `metadata`!)

`metadata` JSON je rychlé, ale netypované a špatně filtrovatelné/indexovatelné. Pro produkční data použij **vlastní modul + `defineLink`** – oficiálně doporučený postup v Medusa v2.

```ts
// src/modules/antiquarian/models/item-details.ts
import { model } from "@medusajs/framework/utils"

const ItemDetails = model.define("item_details", {
  id: model.id().primaryKey(),
  condition: model.enum(["mint", "vg_plus", "vg", "good", "fair"]),
  category_type: model.enum(["vinyl", "book"]),
  creator: model.text(),                    // interpret / autor
  year: model.number().nullable(),
  publisher_or_label: model.text().nullable(),
  discogs_release_id: model.text().nullable(),
  isbn: model.text().nullable(),
  language: model.text().nullable(),
})

export default ItemDetails
```

```ts
// src/links/product-item-details.ts
import ProductModule from "@medusajs/medusa/product"
import AntiquarianModule from "../modules/antiquarian"
import { defineLink } from "@medusajs/framework/utils"

export default defineLink(
  ProductModule.linkable.product,
  AntiquarianModule.linkable.itemDetails
)
```

Po `npx medusa db:migrate` (resp. `db:sync-links`):
- zápis: přes `additional_data` parametr na Create/Update Product API routách, konzumovaný ve workflow hooks (`productsCreated` / `productsUpdated`)
- čtení: `query.graph({ entity: "product", fields: ["*", "item_details.*"], filters: { id } })`

Tento vzor se použije i pro hromadný CSV import (viz sekce 6).

## 5. Kategorie a taxonomie

Použít vestavěný **Product Category** modul (žádné rozšiřování potřeba):

```
LP desky
  ├── Rock
  ├── Jazz
  ├── Klasika
  ├── Elektronika
  └── ...
Knihy
  ├── Beletrie
  ├── Literatura faktu
  ├── Poezie
  └── ...
```

## 6. Import 1000 položek

1. Katalogizace probíhá souběžně s vývojem (fotky, stav, ISBN/Discogs ID) – toto je časově nejnáročnější část projektu, ne kód.
2. CSV/spreadsheet se sloupci: title, creator, year, condition, isbn/discogs_id, price, category, photos (cesty k souborům)
3. Import skript volá Medusa Admin API (Create Product route s `additional_data` pro item_details)
4. Pro každou položku automatické doplnění metadat:
   - Knihy: dotaz na Google Books API / OpenLibrary API podle ISBN → obálka, autor, popis
   - Desky: dotaz na Discogs API podle release ID → tracklist, rok, label
5. Fotky nahrát do MinIO/storage a připojit URL k produktu

## 7. Integrace – platby a doprava (ČR)

### Platby
- **Comgate** – tarif Easy: 0,9 % + 1 Kč/transakci, měsíční paušál 100–200 Kč (odpadá při vyšším obratu), první měsíce často akce zdarma
- **GoPay** – cca 1 % + 1 Kč/transakci, ~190 Kč/měsíc (časté akce 3–12 měsíců zdarma pro nové obchodníky)
- Žádný oficiální Medusa modul pro tyto brány neexistuje → vlastní payment provider modul implementující Medusa Payment Module interface (redirect na hostovaný checkout brány → karty nikdy neprochází přes váš server, minimální PCI DSS scope)

### Doprava
- **Zásilkovna (Packeta) API** – napojení a pluginy jsou zdarma, platí se jen skutečné poštovné za zásilku
- Vlastní fulfillment modul: widget pro výběr výdejního místa v checkoutu, generování štítků přes API, tracking

### Marketingové feedy
- Heureka.cz / Zboží.cz – XML feed generovaný vlastním API endpointem z produktového katalogu (feed zdarma, viditelnost/PPC na Heurece je placená služba – volitelné, lze nechat na později)

## 8. Nasazení na Hetzner VPS

- **Instance:** doporučeno CX22 (2 vCPU / 4 GB RAM / 40 GB NVMe, 20 TB provozu v ceně) – pro 1000 položek s rezervou dostačující; lze kdykoliv za pár kliků upgradovat na CX32, pokud by výkon nestačil
- **Síť:** VPS má vlastní veřejnou IPv4/IPv6, žádné řešení port-forwardingu jako u homelabu – Caddy si rovnou vytáhne Let's Encrypt certifikát
- **Firewall:** Hetzner Cloud Firewall (zdarma součást) – povolit jen 80/443/22 (SSH ideálně jen z vlastní IP nebo přes klíč)
- **Volitelně Cloudflare** před VPS (DNS proxy) – zdarma přidá CDN cache a DDoS ochranu, není ale nutné jako u homelabu
- **Offsite zálohy** – `pg_dump` + cron → Backblaze B2/Storj (nezávisle na VPS) + volitelně Hetzner Snapshots (placené, ale levné) jako druhá vrstva zálohy celého disku
- **Uptime Kuma** s notifikací na mobil při výpadku
- Platby přes hostovaný checkout GoPay/Comgate → citlivá data karet se nikdy neukládají na VPS
- Odpadá starost o domácí internet/elektřinu, ISP smluvní podmínky a UPS – Hetzner garantuje síťovou a napájecí redundanci datacentra

## 9. Přehled nákladů (bez VPS)

| Typ | Položka | Cena |
|---|---|---|
| Fixní | Hetzner VPS (CX22) | ~4,5 €/měsíc (~110 Kč/měsíc) |
| Fixní | Doména .cz | ~200–300 Kč/rok |
| Fixní | Software stack | 0 Kč (open-source) |
| Fixní | Cloudflare Tunnel/DNS/SSL | 0 Kč |
| Skoro-fixní | Offsite zálohy | 0 Kč do ~10 GB |
| Skoro-fixní | Transakční e-mail | 0 Kč do ~300/den |
| Variabilní | Platební brána | 0,9–1 % + 1 Kč/transakci (dle obratu) |
| Variabilní | Poštovné (Zásilkovna) | dle skutečných zásilek, přenositelné na zákazníka |
| Volitelné | Heureka/Zboží PPC viditelnost | dle rozpočtu, lze vynechat na start |

## 10. Fáze projektu

1. **Příprava dat** – katalogizace 1000 položek (fotky, stav, ISBN/Discogs ID) – běží souběžně s vývojem
2. **Infrastruktura** – Docker Compose (Postgres, Redis, Meilisearch, Medusa, Next.js, Caddy, cloudflared), doména, CI/CD kostra
3. **Datový model + admin** – custom modul `antiquarian` + module link, kategorie, import skript
4. **Storefront** – úprava Next.js šablony, filtrování (žánr/stav/cena/rok), stránka produktu, košík, checkout
5. **Platby a doprava** – vlastní payment provider modul (GoPay/Comgate), fulfillment modul (Zásilkovna)
6. **SEO a feedy** – Heureka/Zboží XML, sitemap, structured data (schema.org Product)
7. **Testování, GDPR (obchodní podmínky, cookies), ostrý start**
8. **Provoz** – zálohy, monitoring, iterace

## 11. Otevřené otázky / rozhodnutí pro vývoj

- [ ] Přesná struktura žánrových kategorií (finální seznam)
- [ ] Zvolit GoPay vs. Comgate (doporučeno začít s Comgate – nejlevnější tarif)
- [ ] Formát vstupního CSV pro import 1000 položek (názvy sloupců, kódování stavu)
- [ ] Rozsah MinIO vs. lokální disk pro fotky (závisí na kapacitě homelabu)
- [ ] Design storefrontu (barvy, branding) – zatím neřešeno, viz frontend-design skill při implementaci
