import { model } from "@medusajs/framework/utils"

const ItemDetails = model.define("item_details", {
  id: model.id().primaryKey(),
  condition: model.enum(["mint", "vg_plus", "vg", "good", "fair"]),
  category_type: model.enum(["vinyl", "book"]),
  creator: model.text(), // interpret / autor
  year: model.number().nullable(),
  publisher_or_label: model.text().nullable(),
  discogs_release_id: model.text().nullable(),
  isbn: model.text().nullable(),
  language: model.text().nullable(),
})

export default ItemDetails
