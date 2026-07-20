import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
  isDefined,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import type {
  ComgateCreatePaymentResponse,
  ComgateOptions,
  ComgateRefundResponse,
  ComgateSessionData,
  ComgateStatusResponse,
} from "./types"

const COMGATE_BASE_URL = "https://payments.comgate.cz/v1.0"

/**
 * 2-decimal currencies used by this shop. Comgate wants the price as an
 * integer in the currency's smallest unit (haléře/cents), while Medusa
 * gives us the amount in major units (e.g. 890 for 890 Kč).
 */
function toMinorUnits(amount: number, currencyCode: string): number {
  void currencyCode
  return Math.round(amount * 100)
}

function fromMinorUnits(amount: number): number {
  return amount / 100
}

function mapStatus(
  status: ComgateStatusResponse["status"]
): PaymentSessionStatus {
  switch (status) {
    case "PAID":
      return PaymentSessionStatus.CAPTURED
    case "AUTHORIZED":
      return PaymentSessionStatus.AUTHORIZED
    case "CANCELLED":
      return PaymentSessionStatus.CANCELED
    case "PENDING":
    default:
      return PaymentSessionStatus.PENDING_AUTHORIZATION
  }
}

/**
 * Payment provider for Comgate (https://www.comgate.cz), a Czech payment
 * gateway supporting card payments, bank transfers and local wallets.
 *
 * Comgate is a redirect gateway: `initiatePayment` creates the transaction
 * and returns a `redirect` URL the storefront must send the customer's
 * browser to. There is no client-side SDK/embedded form (unlike Stripe).
 * Confirmation happens two ways, both handled here:
 *  - synchronously, by polling `/status` (used from `authorizePayment`,
 *    called when the customer returns from the gateway to our site)
 *  - asynchronously, via Comgate's push notification to
 *    `${MEDUSA_BACKEND_URL}/hooks/payment/comgate` (`getWebhookActionAndData`)
 *
 * Built against the publicly documented Merchant API
 * (https://apidoc.comgate.cz/en/api/post/) without a live sandbox account -
 * verify field names/webhook payload shape against a real sandbox merchant
 * before going live.
 */
class ComgateProviderService extends AbstractPaymentProvider<ComgateOptions> {
  static identifier = "comgate"

  protected options_: ComgateOptions

  static validateOptions(options: ComgateOptions): void {
    if (!isDefined(options.merchant)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "Required option `merchant` is missing in the Comgate payment provider"
      )
    }
    if (!isDefined(options.secret)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "Required option `secret` is missing in the Comgate payment provider"
      )
    }
    if (!isDefined(options.storefrontUrl)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "Required option `storefrontUrl` is missing in the Comgate payment provider"
      )
    }
  }

  constructor(cradle: Record<string, unknown>, options: ComgateOptions) {
    super(cradle, options)
    this.options_ = options
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const body = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        body.append(key, String(value))
      }
    })

    const response = await fetch(`${COMGATE_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })

    // A malformed/unrecognized request (e.g. an unknown `merchant`) can
    // redirect to Comgate's own error page instead of returning the
    // documented `code=/message=` body - that page's HTML would otherwise
    // get silently (and uselessly) parsed as an empty query string below.
    if (response.redirected) {
      throw this.buildError(
        `An error occurred calling Comgate ${path}`,
        `unexpected redirect to ${response.url} - check the merchant/secret credentials`
      )
    }

    const text = await response.text()

    // Comgate responds with a plain query-string body, not JSON
    // (e.g. `code=0&message=OK&transId=AB12-CD34&redirect=https://...`).
    const parsed = new URLSearchParams(text)
    const result: Record<string, string> = {}
    parsed.forEach((value, key) => {
      result[key] = value
    })

    return result as unknown as T
  }

  private buildError(message: string, reason: string): MedusaError {
    return new MedusaError(
      MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
      `${message}: ${reason}`
    )
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const { amount, currency_code, data, context } = input
    const sessionId = data?.session_id as string

    // For a logged-in customer, Medusa populates `context.customer`. Guest
    // checkouts (the common case for this shop) have no linked customer, so
    // there's nothing in `context` to read - the storefront passes the
    // cart's guest email/phone/name through `data` instead (see the
    // `isComgate` branch in the storefront's payment step).
    const email = (data?.email as string | undefined) ?? context?.customer?.email
    const phone = (data?.phone as string | undefined) ?? context?.customer?.phone
    if (!email && !phone) {
      throw this.buildError(
        "An error occurred in initiatePayment",
        "Comgate requires either a customer email or phone number"
      )
    }

    const fullName =
      (data?.full_name as string | undefined) ||
      [context?.customer?.first_name, context?.customer?.last_name]
        .filter(Boolean)
        .join(" ") ||
      (email as string) ||
      "Zákazník"

    // Single-region shop (CZ only) - hardcoding the locale segment here is
    // fine for now; parameterize if more storefront regions are added.
    const returnBase = `${this.options_.storefrontUrl}/cz/checkout/comgate-return`

    const response = await this.request<ComgateCreatePaymentResponse>(
      "/create",
      {
        merchant: this.options_.merchant,
        secret: this.options_.secret,
        test: this.options_.testMode ?? true,
        price: toMinorUnits(Number(amount), currency_code),
        curr: currency_code.toUpperCase(),
        label: "Antikvariat",
        refId: sessionId,
        method: "ALL",
        email: email as string | undefined,
        phone: phone as string | undefined,
        fullName,
        country: "CZ",
        lang: "cs",
        category: "PHYSICAL_GOODS_ONLY",
        url_paid: `${returnBase}?status=paid`,
        url_cancelled: `${returnBase}?status=cancelled`,
        url_pending: `${returnBase}?status=pending`,
      }
    )

    if (Number(response.code) !== 0 || !response.transId) {
      throw this.buildError(
        "An error occurred in initiatePayment",
        response.message ?? "unknown Comgate error"
      )
    }

    const sessionData: ComgateSessionData = {
      session_id: sessionId,
      transId: response.transId,
      redirect: response.redirect,
      status: "PENDING",
      amount: Number(amount),
      currency_code,
    }

    return {
      id: response.transId,
      status: PaymentSessionStatus.PENDING_AUTHORIZATION,
      data: sessionData as unknown as Record<string, unknown>,
    }
  }

  private async fetchStatus(
    transId: string
  ): Promise<ComgateStatusResponse> {
    const response = await this.request<ComgateStatusResponse>("/status", {
      merchant: this.options_.merchant,
      secret: this.options_.secret,
      transId,
    })

    if (Number(response.code) !== 0) {
      throw this.buildError(
        "An error occurred while checking the Comgate payment status",
        response.message ?? "unknown Comgate error"
      )
    }

    return response
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const data = input.data as unknown as ComgateSessionData
    if (!data?.transId) {
      throw this.buildError(
        "No transaction ID provided while getting payment status",
        "missing data.transId"
      )
    }

    const status = await this.fetchStatus(data.transId)

    return {
      status: mapStatus(status.status),
      data: { ...data, status: status.status } as unknown as Record<
        string,
        unknown
      >,
    }
  }

  /**
   * Called when the customer returns to our site from the Comgate gateway
   * (see the storefront's Comgate return page). Polls the live status
   * synchronously rather than relying solely on the async webhook, so the
   * order can be completed even if the webhook is delayed or missed.
   */
  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const result = await this.getPaymentStatus(input)
    return result as AuthorizePaymentOutput
  }

  /**
   * Comgate has no separate authorize-then-capture step for its supported
   * methods (bank transfer, cards, wallets) - the transaction is captured
   * the moment it reaches PAID. There is nothing further to do here; we
   * just pass the current data through.
   */
  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    return { data: input.data }
  }

  /**
   * Comgate has no documented "cancel an unpaid transaction" endpoint - an
   * unpaid transaction simply expires. Nothing to call, just pass through.
   */
  async cancelPayment(
    input: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    return { data: input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    const data = input.data as unknown as ComgateSessionData
    if (!data?.transId) {
      throw this.buildError(
        "No transaction ID provided while refunding payment",
        "missing data.transId"
      )
    }

    const response = await this.request<ComgateRefundResponse>("/refund", {
      merchant: this.options_.merchant,
      secret: this.options_.secret,
      transId: data.transId,
      amount: toMinorUnits(Number(input.amount), data.currency_code),
      test: this.options_.testMode ?? true,
    })

    if (Number(response.code) !== 0) {
      throw this.buildError(
        "An error occurred in refundPayment",
        response.message ?? "unknown Comgate error"
      )
    }

    return { data: input.data }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const data = input.data as unknown as ComgateSessionData
    if (!data?.transId) {
      return { data: input.data }
    }

    const status = await this.fetchStatus(data.transId)
    return { data: { ...data, status: status.status } as unknown as Record<string, unknown> }
  }

  /**
   * Comgate has no amend-amount endpoint for an existing transaction. If
   * the cart total changed after the session was created, the previous
   * transaction is stale - create a fresh one instead of trying to update it.
   */
  async updatePayment(
    input: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    const data = input.data as unknown as ComgateSessionData
    if (data?.amount === Number(input.amount)) {
      return { data: input.data }
    }

    return this.initiatePayment(input)
  }

  /**
   * Handles Comgate's push notification (`url_push` configured against your
   * merchant account, should point to
   * `${MEDUSA_BACKEND_URL}/hooks/payment/comgate`). Comgate documents this
   * as a POST request with the payment result as form-encoded parameters,
   * mirroring the `/create` and `/status` responses (transId, status, refId).
   * We use our own `refId` (the Medusa payment session id we sent when
   * initiating) to associate the event back to the right session - verify
   * the exact payload shape against a live sandbox notification.
   */
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const raw =
      typeof payload.rawData === "string"
        ? payload.rawData
        : payload.rawData?.toString("utf-8")

    const parsed = raw
      ? Object.fromEntries(new URLSearchParams(raw))
      : (payload.data as Record<string, string>)

    const sessionId = parsed.refId
    const status = parsed.status as ComgateStatusResponse["status"]
    const price = parsed.price ? fromMinorUnits(Number(parsed.price)) : 0

    if (!sessionId) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    switch (status) {
      case "PAID":
        return {
          action: PaymentActions.SUCCESSFUL,
          data: { session_id: sessionId, amount: price },
        }
      case "CANCELLED":
        return {
          action: PaymentActions.CANCELED,
          data: { session_id: sessionId, amount: price },
        }
      case "AUTHORIZED":
        return {
          action: PaymentActions.AUTHORIZED,
          data: { session_id: sessionId, amount: price },
        }
      case "PENDING":
        return {
          action: PaymentActions.PENDING_AUTHORIZATION,
          data: { session_id: sessionId, amount: price },
        }
      default:
        return { action: PaymentActions.NOT_SUPPORTED }
    }
  }
}

export default ComgateProviderService
