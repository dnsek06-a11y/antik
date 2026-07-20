import { placeOrder } from "@lib/data/cart"
import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ status?: string }>
}

/**
 * Comgate redirects the customer back here after the hosted payment page
 * (see `url_paid`/`url_cancelled`/`url_pending` in the comgate provider's
 * `initiatePayment`). `placeOrder()` completes the cart, which triggers our
 * Comgate provider's `authorizePayment` - it polls Comgate's live `/status`
 * rather than trusting this redirect alone, since redirect query params can
 * be manipulated by the customer (per Comgate's own docs).
 */
export default async function ComgateReturnPage(props: Props) {
  const { countryCode } = await props.params
  const { status } = await props.searchParams

  if (status !== "paid") {
    redirect(`/${countryCode}/checkout?step=payment&comgate_error=1`)
  }

  await placeOrder()

  // placeOrder() redirects to the order confirmation page once the cart
  // completes; reaching this line means it didn't (payment not yet
  // authorized), so send the customer back to retry.
  redirect(`/${countryCode}/checkout?step=payment&comgate_error=1`)
}
