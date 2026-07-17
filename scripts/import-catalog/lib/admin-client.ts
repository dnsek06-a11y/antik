import { readFile } from "node:fs/promises"
import { basename } from "node:path"

export class AdminClient {
  private token: string | undefined
  private categoryCache = new Map<string, string>()
  private stockLocationId: string | undefined
  private salesChannelId: string | undefined

  constructor(private readonly baseUrl: string) {}

  async login(email: string, password: string) {
    const res = await this.raw("/auth/user/emailpass", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      throw new Error(`Přihlášení do Medusa Admin selhalo: HTTP ${res.status}`)
    }
    const data = (await res.json()) as { token: string }
    this.token = data.token
  }

  private async raw(path: string, init: RequestInit = {}) {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...init.headers,
      },
    })
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.raw(path, init)
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Admin API ${init.method ?? "GET"} ${path} -> HTTP ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  async getStockLocationId(): Promise<string> {
    if (this.stockLocationId) return this.stockLocationId
    const data = await this.request<{ stock_locations: { id: string }[] }>(
      "/admin/stock-locations?limit=1"
    )
    if (!data.stock_locations.length) {
      throw new Error("Žádný stock location nenalezen – spusť napřed seed skript.")
    }
    this.stockLocationId = data.stock_locations[0].id
    return this.stockLocationId
  }

  async getSalesChannelId(): Promise<string> {
    if (this.salesChannelId) return this.salesChannelId
    const data = await this.request<{ sales_channels: { id: string }[] }>(
      "/admin/sales-channels?limit=1"
    )
    if (!data.sales_channels.length) {
      throw new Error("Žádný sales channel nenalezen – spusť napřed seed skript.")
    }
    this.salesChannelId = data.sales_channels[0].id
    return this.salesChannelId
  }

  async getCategoryIdByName(name: string): Promise<string> {
    const cached = this.categoryCache.get(name)
    if (cached) return cached

    const data = await this.request<{ product_categories: { id: string; name: string }[] }>(
      `/admin/product-categories?q=${encodeURIComponent(name)}&limit=1`
    )
    const match = data.product_categories.find((c) => c.name === name)
    if (!match) {
      throw new Error(
        `Kategorie "${name}" neexistuje – zkontroluj taxonomii v seed skriptu nebo CSV.`
      )
    }
    this.categoryCache.set(name, match.id)
    return match.id
  }

  /** Nahraje lokální soubory (nebo předá URL beze změny) a vrátí jejich URL. */
  async resolveImageUrls(photoPaths: string[], photosDir: string): Promise<string[]> {
    const urls: string[] = []
    const localFiles: string[] = []
    const localIndexes: number[] = []

    photoPaths.forEach((p, i) => {
      if (p.startsWith("http://") || p.startsWith("https://")) {
        urls[i] = p
      } else {
        localFiles.push(p)
        localIndexes.push(i)
      }
    })

    if (localFiles.length) {
      const form = new FormData()
      for (const file of localFiles) {
        const fullPath = `${photosDir}/${file}`
        const buf = await readFile(fullPath)
        form.append("files", new Blob([buf]), basename(file))
      }

      const res = await fetch(`${this.baseUrl}/admin/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}` },
        body: form,
      })
      if (!res.ok) {
        throw new Error(`Upload fotek selhal: HTTP ${res.status}`)
      }
      const data = (await res.json()) as { files: { url: string }[] }
      data.files.forEach((f, i) => {
        urls[localIndexes[i]] = f.url
      })
    }

    return urls
  }

  async createProduct(body: Record<string, unknown>) {
    return this.request<{
      product: {
        id: string
        variants: { id: string; inventory_items: { inventory_item_id: string }[] }[]
      }
    }>("/admin/products", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  async setInventoryLevel(inventoryItemId: string, locationId: string, quantity = 1) {
    await this.request(`/admin/inventory-items/${inventoryItemId}/location-levels`, {
      method: "POST",
      body: JSON.stringify({ location_id: locationId, stocked_quantity: quantity }),
    })
  }
}
