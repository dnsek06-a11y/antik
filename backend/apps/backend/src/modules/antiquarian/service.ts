import { MedusaService } from "@medusajs/framework/utils"
import ItemDetails from "./models/item-details"

class AntiquarianModuleService extends MedusaService({
  ItemDetails,
}) {}

export default AntiquarianModuleService
