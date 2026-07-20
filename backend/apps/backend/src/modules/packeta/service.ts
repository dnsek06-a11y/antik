import {
  AbstractFulfillmentProviderService,
  MedusaError,
  isDefined,
} from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"
import type { PacketaOptions } from "./types"

const PACKETA_BASE_URL = "https://www.zasilkovna.cz/api/rest"

/** Average parcel weight (kg) used when line items don't carry a real weight. */
const DEFAULT_ITEM_WEIGHT_KG = 0.3

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function xmlTag(name: string, value: string | number | undefined): string {
  if (value === undefined || value === "") {
    return ""
  }
  return `<${name}>${escapeXml(String(value))}</${name}>`
}

function extractXmlTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  return match?.[1]
}

/**
 * Fulfillment provider for Packeta / Zásilkovna (https://www.zasilkovna.cz)
 * pickup-point delivery.
 *
 * Built against the long-documented REST/XML Packet API
 * (base URL confirmed via https://github.com/Salamek/zasilkovna and
 * community references - the current docs.packeta.com portal renders
 * client-side and could not be scraped for field-level verification here).
 * The customer's chosen pickup point id must be collected on the storefront
 * (Packeta's pickup-point widget - not implemented yet, see project notes)
 * and passed through as `data.pickup_point_id` on the shipping method;
 * `validateFulfillmentData` enforces that it's present.
 *
 * Verify the exact XML field names/response shape against a live sandbox
 * account before going live.
 */
class PacketaProviderService extends AbstractFulfillmentProviderService {
  static identifier = "packeta"

  protected options_: PacketaOptions

  constructor(cradle: Record<string, unknown>, options: PacketaOptions) {
    super()
    void cradle
    this.options_ = options
  }

  private async request(method: string, bodyXml: string): Promise<string> {
    const response = await fetch(PACKETA_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: `<${method}>${bodyXml}</${method}>`,
    })

    return response.text()
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      { id: "packeta-pickup-point" },
      { id: "packeta-pickup-point-return", is_return: true },
    ]
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: ValidateFulfillmentDataContext
  ): Promise<Record<string, unknown>> {
    void optionData
    void context
    if (!isDefined(data.pickup_point_id)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No Packeta pickup point selected (missing `pickup_point_id`)"
      )
    }
    return data
  }

  async validateOption(): Promise<boolean> {
    return true
  }

  async canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
    void data
    // Shipping price is a flat rate configured on the shipping option in
    // the admin, not calculated dynamically from weight/destination.
    return false
  }

  async calculatePrice(): Promise<CalculatedShippingOptionPrice> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Packeta fulfillment does not support price calculation - set a flat rate on the shipping option instead"
    )
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    const pickupPointId = data.pickup_point_id as string
    if (!pickupPointId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No Packeta pickup point selected (missing `pickup_point_id`)"
      )
    }

    const address = order?.shipping_address
    const weightKg =
      items.reduce((sum, item) => sum + (item.quantity ?? 1), 0) *
      DEFAULT_ITEM_WEIGHT_KG

    const packetAttributes = [
      xmlTag("number", (order?.display_id ?? fulfillment.id) as string),
      xmlTag("name", address?.first_name),
      xmlTag("surname", address?.last_name),
      xmlTag("email", order?.email),
      xmlTag("phone", address?.phone),
      xmlTag("addressId", pickupPointId),
      xmlTag("cod", 0),
      xmlTag("value", Number(order?.item_total ?? 0)),
      xmlTag("weight", weightKg.toFixed(2)),
      xmlTag("eshop", this.options_.eshopId),
    ].join("")

    const responseXml = await this.request(
      "createPacket",
      xmlTag("apiPassword", this.options_.apiPassword) +
        `<packetAttributes>${packetAttributes}</packetAttributes>`
    )

    const fault = extractXmlTag(responseXml, "fault")
    if (fault) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Packeta createPacket failed: ${fault}`
      )
    }

    const packetId = extractXmlTag(responseXml, "id")
    if (!packetId) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Packeta createPacket did not return a packet id"
      )
    }

    return {
      data: { ...data, packet_id: packetId },
      labels: [
        {
          tracking_number: packetId,
          tracking_url: `https://tracking.packeta.com/en/?id=${packetId}`,
          // The shipment label PDF requires a separate authenticated call
          // (see getShipmentDocuments) rather than a public URL.
          label_url: "",
        },
      ],
    }
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<unknown> {
    const packetId = data.packet_id as string
    if (!packetId) {
      return {}
    }

    const responseXml = await this.request(
      "cancelPacket",
      xmlTag("apiPassword", this.options_.apiPassword) +
        xmlTag("packetId", packetId)
    )

    const fault = extractXmlTag(responseXml, "fault")
    if (fault) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Packeta cancelPacket failed: ${fault}`
      )
    }

    return {}
  }

  async createReturnFulfillment(
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    // Returns to a pickup point are arranged by the customer directly with
    // Packeta (drop-off), not created via this API - nothing to do here.
    void fulfillment
    return { data: {}, labels: [] }
  }

  // The base class types this (and getFulfillmentDocuments/getReturnDocuments
  // below) as `Promise<never[]>` - a stub signature that can't express real
  // document data. Cast at the return so real callers still get the PDF.
  async getShipmentDocuments(data: Record<string, unknown>): Promise<never[]> {
    const packetId = data.packet_id as string
    if (!packetId) {
      return []
    }

    const responseXml = await this.request(
      "packetLabelPdf",
      xmlTag("apiPassword", this.options_.apiPassword) +
        xmlTag("packetId", packetId) +
        xmlTag("format", "A6") +
        xmlTag("offset", 0)
    )

    const fault = extractXmlTag(responseXml, "fault")
    if (fault) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Packeta packetLabelPdf failed: ${fault}`
      )
    }

    const pdfBase64 = extractXmlTag(responseXml, "response")
    const documents = pdfBase64 ? [{ label_pdf_base64: pdfBase64 }] : []
    return documents as unknown as never[]
  }

  async getReturnDocuments(): Promise<never[]> {
    return []
  }

  async getFulfillmentDocuments(): Promise<never[]> {
    return []
  }

  async retrieveDocuments(): Promise<void> {
    return
  }
}

export default PacketaProviderService
