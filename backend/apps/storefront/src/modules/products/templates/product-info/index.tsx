import { CONDITION_LABELS } from "@lib/types/item-details"
import { StoreProductWithItemDetails } from "@lib/types/item-details"
import { Heading, Text } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ProductInfoProps = {
  product: StoreProductWithItemDetails
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  const itemDetails = product.item_details

  return (
    <div id="product-info">
      <div className="flex flex-col gap-y-4 lg:max-w-[500px] mx-auto">
        {product.collection && (
          <LocalizedClientLink
            href={`/collections/${product.collection.handle}`}
            className="text-medium text-ui-fg-muted hover:text-ui-fg-subtle"
          >
            {product.collection.title}
          </LocalizedClientLink>
        )}

        {itemDetails?.creator && (
          <Text className="text-medium text-ui-fg-subtle">
            {itemDetails.creator}
          </Text>
        )}

        <Heading
          level="h2"
          className="text-3xl leading-10 text-ui-fg-base"
          data-testid="product-title"
        >
          {product.title}
        </Heading>

        {itemDetails && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 txt-compact-small text-ui-fg-muted">
            <span>Stav: {CONDITION_LABELS[itemDetails.condition]}</span>
            {itemDetails.year && <span>Rok: {itemDetails.year}</span>}
            {itemDetails.publisher_or_label && (
              <span>{itemDetails.publisher_or_label}</span>
            )}
          </div>
        )}

        <Text
          className="text-medium text-ui-fg-subtle whitespace-pre-line"
          data-testid="product-description"
        >
          {product.description}
        </Text>
      </div>
    </div>
  )
}

export default ProductInfo
