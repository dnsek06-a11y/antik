export type ComgateOptions = {
  merchant: string
  secret: string
  /**
   * Defaults to true so a missing/misconfigured env var never accidentally
   * charges real money. Set explicitly to false to go live.
   */
  testMode?: boolean
  /** Storefront base URL, used to build Comgate's return URLs. */
  storefrontUrl: string
}

export type ComgateCreatePaymentResponse = {
  code: number
  message: string
  transId?: string
  redirect?: string
}

export type ComgateStatusResponse = {
  code: number
  message: string
  status?: "PENDING" | "PAID" | "CANCELLED" | "AUTHORIZED"
  price?: string
  curr?: string
  refId?: string
  vs?: string
}

export type ComgateRefundResponse = {
  code: number
  message: string
}

/**
 * Data persisted on the Medusa payment session between calls.
 */
export type ComgateSessionData = {
  session_id: string
  transId?: string
  redirect?: string
  status?: ComgateStatusResponse["status"]
  amount: number
  currency_code: string
}
