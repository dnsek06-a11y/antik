import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ANTIQUARIAN_MODULE } from "../../modules/antiquarian"
import AntiquarianModuleService from "../../modules/antiquarian/service"

createProductsWorkflow.hooks.productsCreated(
  async ({ products, additional_data }, { container }) => {
    if (!additional_data?.item_details) {
      return new StepResponse([], [])
    }

    const antiquarianModuleService: AntiquarianModuleService =
      container.resolve(ANTIQUARIAN_MODULE)
    const link = container.resolve(ContainerRegistrationKeys.LINK)

    const created = await Promise.all(
      products.map(async (product) => {
        const itemDetails = await antiquarianModuleService.createItemDetails(
          additional_data.item_details as Record<string, unknown>
        )

        await link.create({
          [Modules.PRODUCT]: {
            product_id: product.id,
          },
          [ANTIQUARIAN_MODULE]: {
            item_details_id: itemDetails.id,
          },
        })

        return itemDetails
      })
    )

    return new StepResponse(created, created)
  },
  async (createdItemDetails, { container }) => {
    if (!createdItemDetails?.length) {
      return
    }

    const antiquarianModuleService: AntiquarianModuleService =
      container.resolve(ANTIQUARIAN_MODULE)

    await antiquarianModuleService.deleteItemDetails(
      createdItemDetails.map((details) => details.id)
    )
  }
)
