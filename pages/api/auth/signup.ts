import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Body = {
  email?: string;
  password?: string;
  full_name?: string;
  company_name?: string;
};

function normalizeAuthError(message: string) {
  const source = String(message || "").trim();
  if (/already registered|already exists|user.*exists|email.*exists/i.test(source)) {
    return "Кабинет с такой почтой уже есть. Войдите или восстановите пароль.";
  }
  if (/invalid email/i.test(source)) return "Проверьте email: похоже, адрес указан неверно.";
  if (/password/i.test(source)) return "Пароль должен быть не короче 8 символов.";
  if (/fetch failed|load failed|network|timeout/i.test(source)) {
    return "Не удалось связаться с сервисом регистрации. Попробуйте ещё раз через минуту.";
  }
  return source || "Не удалось создать кабинет.";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
  const fullName = String(body.full_name || "").trim();
  const companyName = String(body.company_name || "").trim();

  if (!email) return res.status(400).json({ ok: false, error: "Укажите email." });
  if (!fullName) return res.status(400).json({ ok: false, error: "Укажите имя и фамилию." });
  if (password.length < 8) return res.status(400).json({ ok: false, error: "Пароль должен быть не короче 8 символов." });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (req.headers.origin ? String(req.headers.origin) : "");
  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: siteUrl ? `${siteUrl.replace(/\/$/, "")}/dashboard` : undefined,
        data: {
          full_name: fullName,
          company_name: companyName,
        },
      },
    });

    if (error) return res.status(400).json({ ok: false, error: normalizeAuthError(error.message) });

    return res.status(200).json({
      ok: true,
      user: data.user,
      session: data.session,
      email_confirmation_required: !data.session,
    });
  } catch (err: any) {
    return res.status(502).json({ ok: false, error: normalizeAuthError(err?.message || "Load failed") });
  }
}
