import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Body = {
  email?: string;
  password?: string;
};

function normalizeLoginError(message: string) {
  const source = String(message || "").trim();
  if (/invalid login credentials|invalid credentials|email not confirmed/i.test(source)) {
    return "Неверный email или пароль. Проверьте данные и попробуйте ещё раз.";
  }
  if (/fetch failed|failed to fetch|load failed|network|timeout|econn/i.test(source)) {
    return "Не удалось связаться с сервером авторизации. Проверьте интернет, VPN или антивирус и попробуйте ещё раз.";
  }
  return source || "Не удалось войти. Попробуйте ещё раз.";
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
  const password = String(body.password || "");

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Укажите email и пароль." });
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return res.status(401).json({ ok: false, error: normalizeLoginError(error?.message || "Invalid login credentials") });
    }

    return res.status(200).json({ ok: true, session: data.session, user: data.user });
  } catch (err: any) {
    return res.status(502).json({ ok: false, error: normalizeLoginError(err?.message || "Load failed") });
  }
}
