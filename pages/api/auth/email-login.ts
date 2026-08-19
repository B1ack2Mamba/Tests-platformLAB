import type { NextApiRequest, NextApiResponse } from "next";

type Body = {
  email?: string;
  password?: string;
};

function normalizeLoginError(message: string) {
  const source = String(message || "").trim();
  if (/invalid login credentials|invalid credentials|invalid_credentials|email not confirmed/i.test(source)) {
    return "Неверный email или пароль. Проверьте данные и попробуйте ещё раз.";
  }
  if (/fetch failed|failed to fetch|load failed|network|timeout|econn|ERR_NETWORK_CHANGED/i.test(source)) {
    return "Не удалось связаться с сервером авторизации.";
  }
  return source || "Не удалось войти. Попробуйте ещё раз.";
}

async function signInWithPasswordDirect(url: string, key: string, email: string, password: string) {
  const response = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok || !json?.access_token || !json?.refresh_token || !json?.user) {
    const message =
      json?.error_description ||
      json?.msg ||
      json?.message ||
      json?.error_code ||
      response.statusText;
    throw new Error(message || "Invalid login credentials");
  }

  const expiresIn = Number(json.expires_in || 3600);
  const session = {
    access_token: String(json.access_token),
    refresh_token: String(json.refresh_token),
    expires_in: expiresIn,
    expires_at: Number(json.expires_at || Math.floor(Date.now() / 1000) + expiresIn),
    token_type: String(json.token_type || "bearer"),
    user: json.user,
  };

  return { session, user: json.user };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return res.status(500).json({
      ok: false,
      error: "Server env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    });
  }

  const body: Body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Укажите email и пароль." });
  }

  try {
    const data = await signInWithPasswordDirect(url, anonKey, email, password);

    return res.status(200).json({ ok: true, session: data.session, user: data.user });
  } catch (err: any) {
    const rawMessage = err?.message || "Load failed";
    const normalized = normalizeLoginError(rawMessage);
    const status = /Неверный email или пароль/.test(normalized) ? 401 : 502;
    return res.status(status).json({ ok: false, error: normalized });
  }
}
