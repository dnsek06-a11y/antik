import { Module } from "@medusajs/framework/utils"
import AntiquarianModuleService from "./service"

export const ANTIQUARIAN_MODULE = "antiquarian"

export default Module(ANTIQUARIAN_MODULE, {
  service: AntiquarianModuleService,
})
