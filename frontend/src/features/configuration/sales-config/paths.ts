const ROOT = "/configuration/sales-config";

export const salesConfigPaths = {
  root: ROOT,
  offerSetup: `${ROOT}/offer-setup`,
  offerCreate: (kind: string) => `${ROOT}/offer-setup/new?type=${kind}`,
  offerEdit: (id: string) => `${ROOT}/offer-setup/${id}`,
  customerPriceSetup: `${ROOT}/customer-price-setup`,
  salesSetup: `${ROOT}/sales-setup`,
  standardPriceSetup: `${ROOT}/standard-price-setup`,
  walletSetup: `${ROOT}/wallet-setup`,
  salesReturn: `${ROOT}/sales-return`,
  priceSetup: `${ROOT}/price-setup`,
} as const;
