import {
  type Paddle,
  type PricePreviewParams,
  type PricePreviewResponse,
} from "@paddle/paddle-js";
import { useEffect, useState } from "react";
import { allTierPriceIds, type Tier } from "../config/pricingTiers";

export type PaddlePrices = Record<string, string>;

/** App-side sentinel only — never send to Paddle as a country code. */
export const PADDLE_COUNTRY_OTHERS = "OTHERS";

function getPriceAmounts(prices: PricePreviewResponse): PaddlePrices {
  return prices.data.details.lineItems.reduce<PaddlePrices>((acc, item) => {
    acc[item.price.id] = item.formattedTotals.total;
    return acc;
  }, {});
}

export function usePaddlePrices(
  paddle: Paddle | undefined,
  country: string,
  tiers: Tier[],
): { prices: PaddlePrices; loading: boolean; error: string | null } {
  const [prices, setPrices] = useState<PaddlePrices>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paddle || tiers.length === 0) {
      setLoading(false);
      return;
    }

    const items = allTierPriceIds(tiers).map((priceId) => ({ priceId, quantity: 1 }));
    const params: PricePreviewParams = {
      items,
      ...(country && country !== PADDLE_COUNTRY_OTHERS
        ? { address: { countryCode: country } }
        : {}),
    };

    setLoading(true);
    setError(null);
    paddle
      .PricePreview(params)
      .then((response) => {
        setPrices((prev) => ({ ...prev, ...getPriceAmounts(response) }));
      })
      .catch((err: unknown) => {
        console.error("Paddle.PricePreview failed", err);
        setError("We couldn't load prices. Please refresh the page.");
      })
      .finally(() => setLoading(false));
  }, [country, paddle, tiers]);

  return { prices, loading, error };
}
