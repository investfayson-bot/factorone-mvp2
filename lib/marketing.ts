/**
 * Status das integrações de Marketing (ads + ecommerce).
 * Cada canal liga preenchendo o token/credencial no ambiente. Sem isso, a UI
 * mostra "conectar" (fluxo OAuth do provedor entra quando as chaves chegarem).
 */
export function marketingStatus() {
  const has = (k: string) => Boolean(process.env[k])
  return {
    ads: {
      meta: has('META_ADS_TOKEN'),
      google: has('GOOGLE_ADS_TOKEN'),
      tiktok: has('TIKTOK_ADS_TOKEN'),
    },
    ecommerce: {
      nuvemshop: has('NUVEMSHOP_TOKEN'),
      mercadolivre: has('MERCADOLIVRE_TOKEN'),
      shopify: has('SHOPIFY_TOKEN'),
    },
  }
}
