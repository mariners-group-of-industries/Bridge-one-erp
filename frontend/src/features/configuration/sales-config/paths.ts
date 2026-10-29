const ROOT = "/configuration/sales-config";

export const salesConfigPaths = {
  root: ROOT,
  offerSetup: `${ROOT}/offer-setup`,
  offerCreate: (kind: string) => `${ROOT}/offer-setup/new?type=${kind}`,
  offerEdit: (id: string) => `${ROOT}/offer-setup/${id}`,
  customerPriceSetup: `${ROOT}/customer-price-setup`,
  customerPriceNew: (tab: string) => `${ROOT}/customer-price-setup/new?tab=${tab}`,
  customerPriceEdit: (tab: string, id: string) => `${ROOT}/customer-price-setup/${tab}/${id}`,
  salesSetup: `${ROOT}/sales-setup`,
  standardPriceSetup: `${ROOT}/standard-price-setup`,
  walletSetup: `${ROOT}/wallet-setup`,
  walletNew: `${ROOT}/wallet-setup/new`,
  walletEdit: (id: string) => `${ROOT}/wallet-setup/${id}`,
  salesReturn: `${ROOT}/sales-return`,} as const;
