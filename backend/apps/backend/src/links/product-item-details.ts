import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import AntiquarianModule from "../modules/antiquarian"

export default defineLink(
  ProductModule.linkable.product,
  AntiquarianModule.linkable.itemDetails
)
