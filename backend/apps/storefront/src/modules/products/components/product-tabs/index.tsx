"use client"

import Back from "@modules/common/icons/back"
import FastDelivery from "@modules/common/icons/fast-delivery"
import Refresh from "@modules/common/icons/refresh"

import Accordion from "./accordion"
import {
  CONDITION_LABELS,
  ItemCondition,
  StoreProductWithItemDetails,
} from "@lib/types/item-details"

type ProductTabsProps = {
  product: StoreProductWithItemDetails
}

const CONDITION_DESCRIPTIONS: Record<ItemCondition, string> = {
  mint: "Bez viditelných stop používání, prakticky nový stav.",
  vg_plus:
    "Minimální stopy používání, bez zásadních vad. U desek jemné povrchové vlásenky bez vlivu na poslech.",
  vg: "Znatelné stopy používání odpovídající stáří, funkční a plně použitelné.",
  good: "Výraznější opotřebení (např. ohmataný obal, podpisy v knize), přesto kompletní a čitelné/hratelné.",
  fair: "Silně opotřebený kus s viditelnými vadami – ideální spíš pro sběratele nebo jako čtecí/poslechová kopie.",
}

const ProductTabs = ({ product }: ProductTabsProps) => {
  const tabs = [
    {
      label: "Stav a podrobnosti",
      component: <ConditionTab product={product} />,
    },
    {
      label: "Doprava a vrácení",
      component: <ShippingInfoTab />,
    },
  ]

  return (
    <div className="w-full">
      <Accordion type="multiple">
        {tabs.map((tab, i) => (
          <Accordion.Item
            key={i}
            title={tab.label}
            headingSize="medium"
            value={tab.label}
          >
            {tab.component}
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  )
}

const ConditionTab = ({ product }: ProductTabsProps) => {
  const itemDetails = product.item_details

  return (
    <div className="text-small-regular py-8 flex flex-col gap-y-4">
      {itemDetails ? (
        <div>
          <span className="font-semibold">
            Stav: {CONDITION_LABELS[itemDetails.condition]}
          </span>
          <p className="max-w-sm">
            {CONDITION_DESCRIPTIONS[itemDetails.condition]}
          </p>
        </div>
      ) : (
        <p>Informace o stavu tohoto kusu nejsou k dispozici.</p>
      )}
      <p className="text-ui-fg-muted max-w-sm">
        Jde o použitý, unikátní kus – skladem je vždy jen 1 ks. Fotografie u
        inzerátu odpovídají reálnému stavu prodávaného kusu.
      </p>
    </div>
  )
}

const ShippingInfoTab = () => {
  return (
    <div className="text-small-regular py-8">
      <div className="grid grid-cols-1 gap-y-8">
        <div className="flex items-start gap-x-2">
          <FastDelivery />
          <div>
            <span className="font-semibold">Odeslání</span>
            <p className="max-w-sm">
              Zboží odesíláme obvykle do 2 pracovních dnů od objednávky,
              pečlivě zabalené s ohledem na křehkost desek a knih.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Refresh />
          <div>
            <span className="font-semibold">Reklamace</span>
            <p className="max-w-sm">
              Pokud stav zboží neodpovídá popisu, kontaktujte nás – domluvíme
              se na opravě, výměně nebo vrácení peněz.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Back />
          <div>
            <span className="font-semibold">Vrácení zboží</span>
            <p className="max-w-sm">
              Jako spotřebitel máte právo odstoupit od smlouvy do 14 dnů od
              převzetí zboží bez udání důvodu, v souladu s platnou legislativou
              ČR. Vzhledem k unikátnosti každého kusu doporučujeme nákup
              předem pečlivě zvážit.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs
