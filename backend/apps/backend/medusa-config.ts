import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  modules: [
    {
      resolve: "./src/modules/antiquarian",
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/comgate",
            id: "comgate",
            options: {
              merchant: process.env.COMGATE_MERCHANT_ID,
              secret: process.env.COMGATE_SECRET,
              testMode: process.env.COMGATE_TEST_MODE !== "false",
              storefrontUrl: process.env.STOREFRONT_URL,
            },
          },
        ],
      },
    },
    {
      // Re-declaring this module means we must re-list the default "manual"
      // provider too, or it disappears (defineConfig only applies its
      // built-in fulfillment default when the fulfillment module isn't
      // configured at all - see @medusajs/utils/dist/common/define-config.js).
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
          {
            resolve: "./src/modules/packeta",
            id: "packeta",
            options: {
              apiPassword: process.env.PACKETA_API_KEY,
              eshopId: process.env.PACKETA_ESHOP_ID,
            },
          },
        ],
      },
    },
  ],
})
