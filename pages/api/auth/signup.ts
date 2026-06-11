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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    return res.status(500).json({
      ok: false,
      error: "Server env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const body: Body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const fullName = String(body.full_name || "").trim();
  const companyName = String(body.company_name || "").trim();

  if (!email) return res.status(400).json({ ok: false, error: "Укажите email." });
  if (!fullName) return res.status(400).json({ ok: false, error: "Укажите имя и фамилию." });
  if (password.length < 8) return res.status(400).json({ ok: false, error: "Пароль должен быть не короче 8 символов." });

  const supabaseAdmin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const supabaseAnon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const createRes = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        company_name: companyName,
      },
    });

    if (createRes.error || !createRes.data.user) {
      return res.status(400).json({ ok: false, error: normalizeAuthError(createRes.error?.message || "Create user failed") });
    }

    const signInRes = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (signInRes.error || !signInRes.data.session) {
      return res.status(200).json({
        ok: true,
        created: true,
        login_required: true,
        user: createRes.data.user,
        session: null,
        email_confirmation_required: false,
        message: "Кабинет создан. Теперь войдите по email и паролю.",
      });
    }

    return res.status(200).json({
      ok: true,
      user: signInRes.data.user,
      session: signInRes.data.session,
      email_confirmation_required: false,
    });
  } catch (err: any) {
    return res.status(502).json({ ok: false, error: normalizeAuthError(err?.message || "Load failed") });
  }
}
