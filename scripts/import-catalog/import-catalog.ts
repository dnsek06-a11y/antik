import { readFile } from "node:fs/promises"
import { parse } from "csv-parse/sync"
import { AdminClient } from "./lib/admin-client.js"
import { enrichFromDiscogs } from "./lib/discogs.js"
import { enrichFromGoogleBooks } from "./lib/google-books.js"
import type { CatalogRow } from "./types.js"

function env(name: string, required = true): string {
  const value = process.env[name]
  if (!value && required) {
    throw new Error(`Chybí povinná proměnná prostředí ${name}`)
  }
  return value ?? ""
}

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g")

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error("Použití: npm run import -- <cesta-k-csv> [--photos-dir <dir>]")
    process.exit(1)
  }
  const photosDirArgIndex = process.argv.indexOf("--photos-dir")
  const photosDir =
    photosDirArgIndex !== -1 ? process.argv[photosDirArgIndex + 1] : "./photos"

  const backendUrl = env("MEDUSA_BACKEND_URL")
  const adminEmail = env("MEDUSA_ADMIN_EMAIL")
  const adminPassword = env("MEDUSA_ADMIN_PASSWORD")
  const discogsToken = env("DISCOGS_TOKEN", false)
  const googleBooksApiKey = env("GOOGLE_BOOKS_API_KEY", false)

  const csvContent = await readFile(csvPath, "utf-8")
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CatalogRow[]

  console.log(`Načteno ${rows.length} položek z ${csvPath}`)

  const client = new AdminClient(backendUrl)
  await client.login(adminEmail, adminPassword)

  const stockLocationId = await client.getStockLocationId()
  const salesChannelId = await client.getSalesChannelId()

  let ok = 0
  let failed = 0

  for (const [index, row] of rows.entries()) {
    const label = `[${index + 1}/${rows.length}] "${row.title}"`
    try {
      let enriched = {}
      if (row.category_type === "book" && row.isbn) {
        enriched = await enrichFromGoogleBooks(row.isbn, googleBooksApiKey || undefined)
      } else if (row.category_type === "vinyl" && row.discogs_release_id) {
        enriched = await enrichFromDiscogs(row.discogs_release_id, discogsToken || undefined)
      }

      const categoryId = await client.getCategoryIdByName(row.category)

      const photoPaths = row.photos ? row.photos.split(";").map((p) => p.trim()).filter(Boolean) : []
      const imageUrls = photoPaths.length
        ? await client.resolveImageUrls(photoPaths, photosDir)
        : []

      const merged = {
        description: row.description || (enriched as any).description,
        year: row.year ? parseInt(row.year, 10) : (enriched as any).year,
        publisher_or_label: row.publisher_or_label || (enriched as any).publisher_or_label,
        language: row.language || (enriched as any).language,
      }

      const sku = `${slugify(row.title)}-${index + 1}`

      const { product } = await client.createProduct({
        title: row.title,
        description: merged.description ?? "",
        status: "published",
        category_ids: [categoryId],
        images: imageUrls.map((url) => ({ url })),
        thumbnail: imageUrls[0],
        sales_channels: [{ id: salesChannelId }],
        options: [{ title: "Výchozí", values: ["Výchozí"] }],
        variants: [
          {
            title: "Výchozí",
            sku,
            manage_inventory: true,
            options: { Výchozí: "Výchozí" },
            prices: [{ amount: parseFloat(row.price_czk), currency_code: "czk" }],
          },
        ],
        additional_data: {
          item_details: {
            condition: row.condition,
            category_type: row.category_type,
            creator: row.creator,
            year: merged.year ?? null,
            publisher_or_label: merged.publisher_or_label ?? null,
            discogs_release_id: row.discogs_release_id ?? null,
            isbn: row.isbn ?? null,
            language: merged.language ?? null,
          },
        },
      })

      const inventoryItemId = product.variants[0]?.inventory_items?.[0]?.inventory_item_id
      if (inventoryItemId) {
        await client.setInventoryLevel(inventoryItemId, stockLocationId, 1)
      }

      console.log(`${label} OK -> product ${product.id}`)
      ok++
    } catch (err) {
      console.error(`${label} SELHALO:`, err instanceof Error ? err.message : err)
      failed++
    }
  }

  console.log(`\nHotovo. Úspěšně: ${ok}, selhalo: ${failed}.`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
