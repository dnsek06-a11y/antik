import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createProductCategoriesWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * Základní seed pro CZ e-shop s antikvariátem: obchod v CZK, region/tax pro
 * Českou republiku, jeden sklad, dopravní profil a strom kategorií z
 * eshop-antikvariat-projekt.md (sekce 5). Produkty se sem NEzavádí – ty
 * přichází přes CSV import skript (scripts/import-catalog.ts), protože jde
 * o unikátní kusy, ne demo katalog.
 */
export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );

  const countries = ["cz"];

  logger.info("Seeding store data...");
  const {
    result: [defaultSalesChannel],
  } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        {
          name: "Výchozí prodejní kanál",
          description: "E-shop antikvariát",
        },
      ],
    },
  });

  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "Storefront publishable key",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel.id],
    },
  });

  await createStoresWorkflow(container).run({
    input: {
      stores: [
        {
          name: "Antikvariát",
          supported_currencies: [
            {
              currency_code: "czk",
              is_default: true,
            },
          ],
          default_sales_channel_id: defaultSalesChannel.id,
        },
      ],
    },
  });

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Česká republika",
          currency_code: "czk",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Sklad Praha",
          address: {
            city: "Praha",
            country_code: "CZ",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const { result: shippingProfileResult } = await createShippingProfilesWorkflow(
    container
  ).run({
    input: {
      data: [
        {
          name: "Výchozí",
          type: "default",
        },
      ],
    },
  });
  const shippingProfile = shippingProfileResult[0];

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Doprava po ČR",
    type: "shipping",
    service_zones: [
      {
        name: "Česká republika",
        geo_zones: [
          {
            country_code: "cz",
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Zásilkovna",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Výdejní místo Zásilkovna",
          description: "Doručení na výdejní místo Zásilkovny.",
          code: "packeta-pickup-point",
        },
        prices: [
          {
            currency_code: "czk",
            amount: 79,
          },
          {
            region_id: region.id,
            amount: 79,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel.id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding product category tree...");

  const { result: vinylTop } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [{ name: "LP desky", is_active: true }],
    },
  });
  const { result: bookTop } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [{ name: "Knihy", is_active: true }],
    },
  });

  await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: [
        { name: "Rock", is_active: true, parent_category_id: vinylTop[0].id },
        { name: "Jazz", is_active: true, parent_category_id: vinylTop[0].id },
        { name: "Klasika", is_active: true, parent_category_id: vinylTop[0].id },
        { name: "Elektronika", is_active: true, parent_category_id: vinylTop[0].id },
        { name: "Beletrie", is_active: true, parent_category_id: bookTop[0].id },
        { name: "Literatura faktu", is_active: true, parent_category_id: bookTop[0].id },
        { name: "Poezie", is_active: true, parent_category_id: bookTop[0].id },
      ],
    },
  });

  logger.info("Finished seeding product category tree.");
}
