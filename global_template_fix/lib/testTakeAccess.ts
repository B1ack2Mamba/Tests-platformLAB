export const DEFAULT_TEST_TAKE_PRICE_RUB = Number(process.env.NEXT_PUBLIC_TEST_TAKE_PRICE_RUB || process.env.TEST_TAKE_PRICE_RUB || 99);

export function getTestTakePriceRub() {
  return Number.isFinite(DEFAULT_TEST_TAKE_PRICE_RUB) && DEFAULT_TEST_TAKE_PRICE_RUB > 0
    ? Math.round(DEFAULT_TEST_TAKE_PRICE_RUB)
    : 99;
}
