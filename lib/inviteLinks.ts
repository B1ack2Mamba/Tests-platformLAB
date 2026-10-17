// Public URLs are resolved at build time by Next.js.
export const DEFAULT_INVITE_BASE_URL = (
  process.env.NEXT_PUBLIC_INVITE_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://tests-platform-lab.vercel.app"
).trim().replace(/\/+$/, "");

export const PRIMARY_INVITE_BASE_URLS = [
  { key: "primary", label: "Основная ссылка", baseUrl: DEFAULT_INVITE_BASE_URL },
  { key: "rf", label: "Запасная ссылка", baseUrl: "https://www.xn--80aaachl0aqe6abetcez8t.xn--p1ai" },
].filter((item, index, items) => items.findIndex((other) => other.baseUrl === item.baseUrl) === index);
