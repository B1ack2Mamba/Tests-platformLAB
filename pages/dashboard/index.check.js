"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// tmp/proj/lib/supabaseClient.ts
function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}
function createSupabaseClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase env is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }
  return (0, import_supabase_js.createClient)(env.url, env.key);
}
var import_supabase_js;
var init_supabaseClient = __esm({
  "tmp/proj/lib/supabaseClient.ts"() {
    "use strict";
    import_supabase_js = require("@supabase/supabase-js");
  }
});

// tmp/proj/lib/supabaseBrowser.ts
function getSupabaseBrowser() {
  if (typeof window === "undefined") return null;
  const env = getSupabaseEnv();
  if (!env) return null;
  if (!browserClient) browserClient = createSupabaseClient();
  return browserClient;
}
var browserClient;
var init_supabaseBrowser = __esm({
  "tmp/proj/lib/supabaseBrowser.ts"() {
    "use strict";
    init_supabaseClient();
    browserClient = null;
  }
});

// tmp/proj/lib/useSession.ts
function useSession() {
  const supabase = (0, import_react.useMemo)(() => getSupabaseBrowser(), []);
  const [session, setSession] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [envOk] = (0, import_react.useState)(() => !!supabase);
  (0, import_react.useEffect)(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data: data2 }) => {
      if (!mounted) return;
      setSession(data2.session ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);
  return { supabase, session, user: session?.user ?? null, loading, envOk };
}
var import_react;
var init_useSession = __esm({
  "tmp/proj/lib/useSession.ts"() {
    "use strict";
    import_react = require("react");
    init_supabaseBrowser();
  }
});

// tmp/proj/components/AuthNav.tsx
var AuthNav_exports = {};
__export(AuthNav_exports, {
  AuthNav: () => AuthNav
});
function AuthNav() {
  const { supabase, session, user, envOk } = useSession();
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [email, setEmail] = (0, import_react2.useState)("");
  (0, import_react2.useEffect)(() => {
    setEmail(user?.email ?? "");
  }, [user]);
  if (!envOk) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "text-xs text-slate-500", children: "Supabase \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D" });
  }
  if (!session || !user) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_link.default,
      {
        href: "/auth",
        className: "btn btn-secondary btn-sm",
        children: "\u0412\u043E\u0439\u0442\u0438"
      }
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex items-center gap-2", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "hidden max-w-40 truncate text-xs text-slate-500 sm:inline", children: email || user.id }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        disabled: busy,
        onClick: async () => {
          if (!supabase) return;
          setBusy(true);
          try {
            await supabase.auth.signOut();
          } finally {
            setBusy(false);
          }
        },
        className: "btn btn-secondary btn-sm",
        children: "\u0412\u044B\u0439\u0442\u0438"
      }
    )
  ] });
}
var import_link, import_react2, import_jsx_runtime;
var init_AuthNav = __esm({
  "tmp/proj/components/AuthNav.tsx"() {
    "use strict";
    import_link = __toESM(require("next/link"));
    import_react2 = require("react");
    init_useSession();
    import_jsx_runtime = require("react/jsx-runtime");
  }
});

// tmp/proj/lib/admin.ts
function isAdminEmail(email) {
  return (email ?? "").toLowerCase() === ADMIN_EMAIL;
}
var ADMIN_EMAIL;
var init_admin = __esm({
  "tmp/proj/lib/admin.ts"() {
    "use strict";
    ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || // Fallback for local builds
    "storyguild9@gmail.com").toLowerCase();
  }
});

// tmp/proj/components/AdminNav.tsx
var AdminNav_exports = {};
__export(AdminNav_exports, {
  AdminNav: () => AdminNav
});
function AdminNav() {
  const { session, user } = useSession();
  if (!session || !user) return null;
  if (!isAdminEmail(user.email)) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_link2.default, { href: "/admin", className: "btn btn-secondary btn-sm", children: "\u0410\u0434\u043C\u0438\u043D" });
}
var import_link2, import_jsx_runtime2;
var init_AdminNav = __esm({
  "tmp/proj/components/AdminNav.tsx"() {
    "use strict";
    import_link2 = __toESM(require("next/link"));
    init_useSession();
    init_admin();
    import_jsx_runtime2 = require("react/jsx-runtime");
  }
});

// tmp/proj/components/DeveloperSupportWidget.tsx
var DeveloperSupportWidget_exports = {};
__export(DeveloperSupportWidget_exports, {
  DeveloperSupportWidget: () => DeveloperSupportWidget
});
function formatMessageTime(value) {
  try {
    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}
function DeveloperSupportWidget() {
  const { session, user } = useSession();
  const [open, setOpen] = (0, import_react3.useState)(false);
  const [message, setMessage] = (0, import_react3.useState)("");
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [loading, setLoading] = (0, import_react3.useState)(false);
  const [thread, setThread] = (0, import_react3.useState)(null);
  const [messages, setMessages] = (0, import_react3.useState)([]);
  const [error, setError] = (0, import_react3.useState)(null);
  const [info, setInfo] = (0, import_react3.useState)(null);
  const [unreadCount, setUnreadCount] = (0, import_react3.useState)(0);
  const viewportRef = (0, import_react3.useRef)(null);
  const userLabel = (0, import_react3.useMemo)(() => {
    const fullName = (user?.user_metadata?.full_name || "").toString().trim();
    return fullName || user?.email || "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C";
  }, [user?.email, user?.user_metadata]);
  const isSupportAdmin = (user?.email || "").toLowerCase() === "storyguild9@gmail.com";
  async function loadChat(markRead = false, silent = false) {
    if (!session?.access_token) {
      setThread(null);
      setMessages([]);
      setUnreadCount(0);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const resp = await fetch("/api/support/chat", {
        headers: { authorization: `Bearer ${session.access_token}` }
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0447\u0430\u0442 \u0441 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u043E\u043C");
      }
      setThread(json.thread || null);
      setMessages(json.messages || []);
      setUnreadCount(Number(json.unread_count || 0));
      if (markRead && Number(json.unread_count || 0) > 0) {
        await fetch("/api/support/chat/read", {
          method: "POST",
          headers: { authorization: `Bearer ${session.access_token}` }
        }).catch(() => null);
        setUnreadCount(0);
        setMessages((prev) => prev.map((item) => item.sender_type === "developer" ? { ...item, read_by_user_at: item.read_by_user_at || (/* @__PURE__ */ new Date()).toISOString() } : item));
      }
    } catch (err) {
      setError((current) => current || err?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0447\u0430\u0442 \u0441 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u043E\u043C");
    } finally {
      if (!silent) setLoading(false);
    }
  }
  async function configureTelegramWebhook() {
    if (!session?.access_token || !isSupportAdmin) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const resp = await fetch("/api/support/telegram/set-webhook", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` }
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C webhook Telegram");
      setInfo(`Webhook Telegram \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D: ${json.webhook_url || "ok"}`);
    } catch (err) {
      setError(err?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C webhook Telegram");
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    const body = message.trim();
    if (!body) {
      setError("\u041D\u0430\u043F\u0438\u0448\u0438, \u0447\u0442\u043E \u043D\u0443\u0436\u043D\u043E \u0443\u0431\u0440\u0430\u0442\u044C, \u043F\u043E\u0434\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0438\u043B\u0438 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C.");
      return;
    }
    if (!session?.access_token || !user) {
      setError("\u0414\u043B\u044F \u0441\u0432\u044F\u0437\u0438 \u0441 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u043E\u043C \u043D\u0443\u0436\u0435\u043D \u0432\u0445\u043E\u0434 \u0432 \u043A\u0430\u0431\u0438\u043D\u0435\u0442.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const resp = await fetch("/api/support/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ message: body })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u0443");
      }
      setMessage("");
      setInfo("\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E. \u041E\u0442\u0432\u0435\u0442 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u0430 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C \u0438 \u043F\u0440\u0438\u0434\u0451\u0442 \u0438\u0437 Telegram.");
      await loadChat(true, true);
    } catch (err) {
      setError(err?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u0443");
    } finally {
      setBusy(false);
    }
  }
  (0, import_react3.useEffect)(() => {
    if (!session?.access_token) return;
    loadChat(false, true);
    const interval = window.setInterval(() => {
      loadChat(open, true);
    }, open ? 6e3 : 3e4);
    return () => window.clearInterval(interval);
  }, [open, session?.access_token]);
  (0, import_react3.useEffect)(() => {
    if (open && session?.access_token) {
      setError(null);
      loadChat(true);
    }
  }, [open, session?.access_token]);
  (0, import_react3.useEffect)(() => {
    if (!open || !viewportRef.current) return;
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [messages, open]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "button",
      {
        type: "button",
        onClick: () => setOpen(true),
        className: "fixed bottom-5 right-5 z-[95] rounded-full border border-emerald-200 bg-white/95 px-4 py-3 text-sm font-medium text-slate-900 shadow-lg backdrop-blur hover:border-emerald-300 hover:text-emerald-900",
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "relative inline-flex items-center gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u0421\u0432\u044F\u0437\u044C \u0441 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u043E\u043C" }),
          unreadCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "inline-flex min-w-[22px] items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white", children: unreadCount > 99 ? "99+" : unreadCount }) : null
        ] })
      }
    ),
    open ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "fixed inset-0 z-[110] flex items-end justify-end bg-slate-950/30 p-4 backdrop-blur-[2px] sm:items-center sm:justify-center", onClick: () => setOpen(false), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "w-full max-w-2xl rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "text-sm font-semibold text-slate-950", children: "\u0427\u0430\u0442 \u0441 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u043E\u043C" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "mt-1 text-sm leading-6 text-slate-500", children: "\u0415\u0441\u043B\u0438 \u043D\u0443\u0436\u043D\u043E \u0447\u0442\u043E-\u0442\u043E \u0443\u0431\u0440\u0430\u0442\u044C, \u043F\u043E\u0434\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0438\u043B\u0438 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u0444\u0443\u043D\u043A\u0446\u0438\u044E \u2014 \u043D\u0430\u043F\u0438\u0448\u0438 \u0437\u0434\u0435\u0441\u044C. \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0439\u0434\u0451\u0442 \u0432 Telegram, \u0430 \u043E\u0442\u0432\u0435\u0442 \u0432\u0435\u0440\u043D\u0451\u0442\u0441\u044F \u043E\u0431\u0440\u0430\u0442\u043D\u043E \u043F\u0440\u044F\u043C\u043E \u0432 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441." })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "rounded-full border border-slate-200 px-2.5 py-1 text-sm text-slate-500", onClick: () => setOpen(false), children: "\u2715" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mt-4 grid gap-3 sm:grid-cols-[1.1fr,0.9fr]", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600", children: [
          "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u0435\u043B\u044C: ",
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "font-medium text-slate-900", children: userLabel }),
          user?.email ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mt-1", children: [
            "Email: ",
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "font-medium text-slate-900", children: user.email })
          ] }) : null,
          thread?.id ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mt-1", children: [
            "\u041D\u043E\u043C\u0435\u0440 \u0434\u0438\u0430\u043B\u043E\u0433\u0430: ",
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "font-medium text-slate-900", children: thread.id.slice(0, 8) })
          ] }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs leading-5 text-emerald-900", children: "\u041E\u0442\u0432\u0435\u0442\u044B \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u0430 \u043F\u0440\u0438\u0445\u043E\u0434\u044F\u0442 \u0441\u044E\u0434\u0430 \u0438\u0437 Telegram. \u041C\u043E\u0436\u043D\u043E \u043F\u0438\u0441\u0430\u0442\u044C \u043F\u0440\u044F\u043C\u043E \u0432 \u0441\u0430\u0439\u0442, \u0430 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \u0440\u0435\u043F\u043B\u0430\u0435\u043C \u0443 \u0441\u0435\u0431\u044F \u0432 Telegram." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { ref: viewportRef, className: "mt-4 max-h-[320px] min-h-[220px] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3", children: [
        loading ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "px-2 py-3 text-sm text-slate-500", children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0434\u0438\u0430\u043B\u043E\u0433\u2026" }) : null,
        !loading && !messages.length ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "px-2 py-6 text-sm leading-6 text-slate-500", children: "\u041F\u043E\u043A\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u043D\u0435\u0442. \u041D\u0430\u043F\u0438\u0448\u0438 \u0437\u0430\u0434\u0430\u0447\u0443, \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u0435 \u0438\u043B\u0438 \u0438\u0434\u0435\u044E \u2014 \u043E\u043D\u0430 \u0443\u0439\u0434\u0451\u0442 \u0432 Telegram, \u0430 \u043E\u0442\u0432\u0435\u0442 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C." }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "space-y-3", children: messages.map((item) => {
          const fromDeveloper = item.sender_type === "developer";
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: `flex ${fromDeveloper ? "justify-start" : "justify-end"}`, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: `max-w-[85%] rounded-[24px] px-4 py-3 shadow-sm ${fromDeveloper ? "border border-emerald-100 bg-white text-slate-900" : "bg-emerald-600 text-white"}`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: `text-[11px] font-semibold uppercase tracking-[0.18em] ${fromDeveloper ? "text-emerald-700" : "text-white/70"}`, children: fromDeveloper ? item.sender_label || "\u0420\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A" : "\u0412\u044B" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "mt-1 whitespace-pre-wrap text-sm leading-6", children: item.body }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: `mt-2 flex items-center gap-2 text-[11px] ${fromDeveloper ? "text-slate-400" : "text-white/70"}`, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: formatMessageTime(item.created_at) }),
              !fromDeveloper && item.delivery_status === "failed" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\xB7 \u043D\u0435 \u0443\u0448\u043B\u043E \u0432 Telegram" }) : null,
              !fromDeveloper && item.delivery_status === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\xB7 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u043C\u2026" }) : null,
              fromDeveloper ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\xB7 \u0438\u0437 Telegram" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\xB7 \u0441\u0430\u0439\u0442 \u2192 Telegram" })
            ] })
          ] }) }, item.id);
        }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "textarea",
        {
          className: "input mt-4 min-h-[150px]",
          value: message,
          onChange: (e) => setMessage(e.target.value),
          placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0431\u043B\u043E\u043A \u0441 \u0442\u0430\u0440\u0438\u0444\u0430\u043C\u0438, \u0443\u0431\u0435\u0440\u0438\u0442\u0435 \u043B\u0438\u0448\u043D\u0435\u0435 \u043F\u043E\u043B\u0435 \u0438\u043B\u0438 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u0430\u0439\u0442\u0435 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0443 \u043E\u0442\u0447\u0451\u0442\u0430."
        }
      ),
      error ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "mt-3 text-sm text-red-600", children: error }) : null,
      info ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "mt-3 text-sm text-emerald-700", children: info }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mt-4 flex flex-wrap justify-end gap-2", children: [
        isSupportAdmin ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_link3.default, { href: "/admin/support", className: "btn btn-secondary", onClick: () => setOpen(false), children: "\u0412\u0441\u0435 \u0434\u0438\u0430\u043B\u043E\u0433\u0438" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "btn btn-secondary", onClick: configureTelegramWebhook, disabled: busy || loading, children: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C Telegram webhook" })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "btn btn-secondary", onClick: () => loadChat(open, false), disabled: busy || loading, children: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "btn btn-secondary", onClick: () => setOpen(false), children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "btn btn-primary", onClick: send, disabled: busy || !message.trim(), children: busy ? "\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u043C\u2026" : "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u0443" })
      ] })
    ] }) }) : null
  ] });
}
var import_link3, import_react3, import_jsx_runtime3;
var init_DeveloperSupportWidget = __esm({
  "tmp/proj/components/DeveloperSupportWidget.tsx"() {
    "use strict";
    import_link3 = __toESM(require("next/link"));
    import_react3 = require("react");
    init_useSession();
    import_jsx_runtime3 = require("react/jsx-runtime");
  }
});

// tmp/proj/pages/dashboard/index.tsx
var index_exports = {};
__export(index_exports, {
  default: () => DashboardPage
});
module.exports = __toCommonJS(index_exports);
var import_react5 = require("react");
var import_link5 = __toESM(require("next/link"));
var import_router = require("next/router");

// tmp/proj/components/Layout.tsx
var import_link4 = __toESM(require("next/link"));
var import_dynamic = __toESM(require("next/dynamic"));
var import_jsx_runtime4 = require("react/jsx-runtime");
var AuthNavNoSSR = (0, import_dynamic.default)(
  () => Promise.resolve().then(() => (init_AuthNav(), AuthNav_exports)).then((m) => m.AuthNav),
  { ssr: false, loading: () => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-xs text-slate-500", children: "\u2026" }) }
);
var AdminNavNoSSR = (0, import_dynamic.default)(
  () => Promise.resolve().then(() => (init_AdminNav(), AdminNav_exports)).then((m) => m.AdminNav),
  { ssr: false, loading: () => null }
);
var DeveloperSupportWidgetNoSSR = (0, import_dynamic.default)(
  () => Promise.resolve().then(() => (init_DeveloperSupportWidget(), DeveloperSupportWidget_exports)).then((m) => m.DeveloperSupportWidget),
  { ssr: false, loading: () => null }
);
function Layout({
  title,
  children
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "min-h-screen bg-clean-white text-slate-950", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("header", { className: "border-b border-slate-200 bg-white shadow-sm", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_link4.default, { href: "/", className: "flex items-center gap-3 font-semibold tracking-tight app-brand", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "flex h-10 w-10 items-center justify-center rounded-2xl border border-[#b9efcf] bg-[#dffce9] text-[#0f8a55] shadow-sm", children: "\u041B\u041A" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "text-sm sm:text-base font-semibold text-slate-950", children: "\u041B\u0430\u0431\u043E\u0440\u0430\u0442\u043E\u0440\u0438\u044F \u043A\u0430\u0434\u0440\u043E\u0432" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "text-[11px] sm:text-xs text-slate-500", children: "\u041A\u0430\u0431\u0438\u043D\u0435\u0442 \u043E\u0446\u0435\u043D\u043A\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u0430" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("nav", { className: "flex flex-wrap items-center gap-2 sm:justify-end", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_link4.default, { href: "/dashboard", className: "btn btn-secondary btn-sm", children: "\u041A\u0430\u0431\u0438\u043D\u0435\u0442" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_link4.default, { href: "/wallet", className: "btn btn-secondary btn-sm", children: "\u041A\u043E\u0448\u0435\u043B\u0451\u043A" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AdminNavNoSSR, {}),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AuthNavNoSSR, {})
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("main", { className: "mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6", children: [
      title ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h1", { className: "mb-4 text-2xl font-semibold tracking-tight text-[#1f6b55]", children: title }) : null,
      children
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(DeveloperSupportWidgetNoSSR, {}),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("footer", { className: "border-t border-slate-200 bg-white", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "mx-auto max-w-7xl px-3 py-4 text-xs text-slate-500 sm:px-4 sm:py-5", children: "\u041B\u0430\u0431\u043E\u0440\u0430\u0442\u043E\u0440\u0438\u044F \u043A\u0430\u0434\u0440\u043E\u0432 \xB7 \u043A\u043E\u043C\u043C\u0435\u0440\u0447\u0435\u0441\u043A\u0438\u0439 \u043A\u0430\u0431\u0438\u043D\u0435\u0442 \u043E\u0446\u0435\u043D\u043A\u0438" }) })
  ] });
}

// tmp/proj/pages/dashboard/index.tsx
init_useSession();

// tmp/proj/lib/commercialGoals.ts
var TEST_PRIORITY_FALLBACK = [
  "16pf-a",
  "belbin",
  "emin",
  "usk",
  "situational-guidance",
  "motivation-cards",
  "time-management",
  "learning-typology",
  "negotiation-style",
  "color-types",
  "16pf-b"
];
var GOAL_TEST_WEIGHTS = {
  role_fit: {
    "16pf-a": 10,
    belbin: 5,
    usk: 10,
    emin: 6,
    "situational-guidance": 10,
    "negotiation-style": 10,
    "motivation-cards": 10,
    "time-management": 8,
    "color-types": 10,
    "learning-typology": 3,
    "16pf-b": 10
  },
  general_assessment: {
    "16pf-a": 10,
    usk: 9,
    emin: 8,
    belbin: 7,
    "motivation-cards": 6,
    "time-management": 6,
    "learning-typology": 5,
    "color-types": 6,
    "situational-guidance": 5,
    "negotiation-style": 6,
    "16pf-b": 2
  },
  motivation: {
    "motivation-cards": 10,
    usk: 8,
    emin: 7,
    "16pf-a": 6,
    "time-management": 5,
    "color-types": 6,
    "learning-typology": 4,
    belbin: 3,
    "situational-guidance": 3,
    "16pf-b": 2
  },
  management_potential: {
    "situational-guidance": 10,
    "16pf-a": 8,
    emin: 8,
    belbin: 7,
    usk: 7,
    "negotiation-style": 8,
    "time-management": 6,
    "motivation-cards": 6,
    "color-types": 6,
    "learning-typology": 3,
    "16pf-b": 2
  },
  team_interaction: {
    belbin: 10,
    emin: 8,
    "16pf-a": 7,
    usk: 6,
    "color-types": 6,
    "situational-guidance": 5,
    "negotiation-style": 8,
    "motivation-cards": 6,
    "learning-typology": 3,
    "time-management": 3,
    "16pf-b": 2
  },
  leadership: {
    "situational-guidance": 10,
    "16pf-a": 8,
    belbin: 8,
    emin: 7,
    "negotiation-style": 8,
    usk: 6,
    "color-types": 6,
    "motivation-cards": 6,
    "time-management": 4,
    "learning-typology": 3,
    "16pf-b": 2
  },
  self_organization: {
    "time-management": 10,
    usk: 9,
    "16pf-a": 7,
    emin: 5,
    "motivation-cards": 5,
    "learning-typology": 4,
    "situational-guidance": 4,
    belbin: 3,
    "color-types": 6,
    "16pf-b": 2
  },
  learning_agility: {
    "learning-typology": 10,
    "16pf-a": 7,
    "time-management": 6,
    "motivation-cards": 6,
    usk: 5,
    emin: 5,
    "color-types": 6,
    belbin: 3,
    "situational-guidance": 3,
    "16pf-b": 2
  },
  emotional_regulation: {
    emin: 10,
    usk: 8,
    "16pf-a": 7,
    "motivation-cards": 6,
    "time-management": 5,
    "color-types": 4,
    belbin: 3,
    "situational-guidance": 3,
    "learning-typology": 3,
    "negotiation-style": 4,
    "16pf-b": 2
  },
  communication_influence: {
    emin: 9,
    "16pf-a": 8,
    "negotiation-style": 10,
    belbin: 7,
    "situational-guidance": 6,
    "color-types": 6,
    usk: 5,
    "motivation-cards": 4,
    "learning-typology": 3,
    "time-management": 3,
    "16pf-b": 2
  }
};
var GOAL_RECOMMENDED_OVERRIDES = {
  role_fit: ["16pf-a", "belbin", "usk", "emin", "situational-guidance", "negotiation-style", "motivation-cards", "time-management", "color-types", "16pf-b"],
  general_assessment: ["16pf-a", "usk", "motivation-cards", "color-types", "negotiation-style"],
  motivation: ["motivation-cards", "usk", "color-types"],
  management_potential: [
    "situational-guidance",
    "16pf-a",
    "usk",
    "time-management",
    "motivation-cards",
    "color-types",
    "negotiation-style"
  ],
  team_interaction: ["belbin", "emin", "usk", "color-types", "motivation-cards"],
  leadership: ["situational-guidance", "16pf-a", "usk", "color-types", "motivation-cards", "negotiation-style"],
  self_organization: ["time-management", "usk", "16pf-a", "color-types"],
  learning_agility: ["learning-typology", "motivation-cards", "color-types"],
  emotional_regulation: ["emin", "usk", "16pf-a", "motivation-cards"],
  communication_influence: ["emin", "16pf-a", "color-types", "negotiation-style"]
};
function scoreGoalTest(goal, slug) {
  return GOAL_TEST_WEIGHTS[goal]?.[slug] ?? 0;
}
function sortSlugsByGoal(goal, slugs) {
  const fallbackOrder = new Map(TEST_PRIORITY_FALLBACK.map((slug, index) => [slug, index]));
  return [...new Set(slugs)].filter(Boolean).sort((a, b) => {
    const scoreDelta = scoreGoalTest(goal, b) - scoreGoalTest(goal, a);
    if (scoreDelta !== 0) return scoreDelta;
    const fallbackDelta = (fallbackOrder.get(a) ?? 999) - (fallbackOrder.get(b) ?? 999);
    if (fallbackDelta !== 0) return fallbackDelta;
    return a.localeCompare(b, "ru");
  });
}
function defaultScoredSlugs(goal) {
  return sortSlugsByGoal(goal, Object.keys(GOAL_TEST_WEIGHTS[goal] || {})).filter((slug) => scoreGoalTest(goal, slug) > 0);
}
function getGoalRecommendedTests(goal, availableSlugs) {
  const availableSet = availableSlugs?.length ? new Set(availableSlugs) : null;
  const override = GOAL_RECOMMENDED_OVERRIDES[goal];
  if (override?.length) {
    return override.filter((slug) => scoreGoalTest(goal, slug) > 0 && (!availableSet || availableSet.has(slug)));
  }
  const basis = availableSlugs?.length ? availableSlugs : defaultScoredSlugs(goal);
  return sortSlugsByGoal(goal, basis).filter((slug) => scoreGoalTest(goal, slug) >= 6).slice(0, 5);
}
var COMMERCIAL_GOALS = [
  {
    key: "role_fit",
    title: "\u041F\u043E\u0434\u0431\u043E\u0440 \u043D\u0430 \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C \u0438 \u043E\u0446\u0435\u043D\u043A\u0430 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u044F \u0440\u043E\u043B\u0438",
    shortTitle: "\u041F\u043E\u0434\u0431\u043E\u0440 \u043D\u0430 \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C",
    description: "\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u043F\u043E\u0434 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0443\u044E \u0440\u043E\u043B\u044C, \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u0440\u0438\u0441\u043A\u0438 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u0438 \u043F\u043E\u043D\u044F\u0442\u044C, \u043A\u0430\u043A\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0443 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0442 \u043B\u0443\u0447\u0448\u0435 \u0432\u0441\u0435\u0433\u043E.",
    outcomes: [
      "\u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435 \u0440\u043E\u043B\u0438 \u0438 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 \u0440\u0430\u0431\u043E\u0442\u044B",
      "\u0441\u0438\u043B\u044C\u043D\u044B\u0435 \u0441\u0442\u043E\u0440\u043E\u043D\u044B \u0438 \u0440\u0438\u0441\u043A\u0438 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F",
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438 \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044E \u043F\u043E \u0430\u0434\u0430\u043F\u0442\u0430\u0446\u0438\u0438"
    ],
    recommended: getGoalRecommendedTests("role_fit")
  },
  {
    key: "general_assessment",
    title: "\u041E\u0431\u0449\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u043B\u0438\u0447\u043D\u043E\u0441\u0442\u0438 \u0438 \u0440\u0430\u0431\u043E\u0447\u0435\u0433\u043E \u043F\u0440\u043E\u0444\u0438\u043B\u044F",
    shortTitle: "\u041E\u0431\u0449\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430",
    description: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0446\u0435\u043B\u044C\u043D\u044B\u0439 \u0441\u0440\u0435\u0437 \u043F\u043E \u0441\u0442\u0438\u043B\u044E \u043F\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F, \u0443\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u043E\u0441\u0442\u0438, \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044E \u0438 \u043E\u0431\u0449\u0435\u0439 \u0440\u0430\u0431\u043E\u0447\u0435\u0439 \u0441\u043E\u0431\u0440\u0430\u043D\u043D\u043E\u0441\u0442\u0438 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430.",
    outcomes: [
      "\u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430",
      "\u043F\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0435 \u043F\u043E\u0434 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u043E\u0439",
      "\u0441\u0438\u043B\u044C\u043D\u044B\u0435 \u0438 \u0441\u043B\u0430\u0431\u044B\u0435 \u0441\u0442\u043E\u0440\u043E\u043D\u044B \u0432 \u043F\u043E\u0432\u0441\u0435\u0434\u043D\u0435\u0432\u043D\u043E\u0439 \u0440\u0430\u0431\u043E\u0442\u0435"
    ],
    recommended: getGoalRecommendedTests("general_assessment")
  },
  {
    key: "motivation",
    title: "\u041C\u043E\u0442\u0438\u0432\u0430\u0446\u0438\u044F \u0438 \u0432\u043E\u0432\u043B\u0435\u0447\u0451\u043D\u043D\u043E\u0441\u0442\u044C",
    shortTitle: "\u041C\u043E\u0442\u0438\u0432\u0430\u0446\u0438\u044F",
    description: "\u041F\u043E\u043D\u044F\u0442\u044C, \u0447\u0442\u043E \u0440\u0435\u0430\u043B\u044C\u043D\u043E \u0434\u0432\u0438\u0433\u0430\u0435\u0442 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u043E\u043C, \u0447\u0442\u043E \u0435\u0433\u043E \u0434\u0435\u043C\u043E\u0442\u0438\u0432\u0438\u0440\u0443\u0435\u0442 \u0438 \u043A\u0430\u043A \u0443\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0442\u044C \u0432\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u043E\u0441\u0442\u044C \u0431\u0435\u0437 \u043B\u0438\u0448\u043D\u0435\u0433\u043E \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F.",
    outcomes: [
      "\u0432\u0435\u0434\u0443\u0449\u0438\u0435 \u043C\u043E\u0442\u0438\u0432\u0430\u0442\u043E\u0440\u044B",
      "\u0434\u0435\u043C\u043E\u0442\u0438\u0432\u0430\u0442\u043E\u0440\u044B \u0438 \u0440\u0438\u0441\u043A \u0432\u044B\u0433\u043E\u0440\u0430\u043D\u0438\u044F",
      "\u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0447\u0435\u0441\u043A\u0438\u0435 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438 \u043F\u043E \u0443\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u044E"
    ],
    recommended: getGoalRecommendedTests("motivation")
  },
  {
    key: "management_potential",
    title: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u043E\u0442\u0435\u043D\u0446\u0438\u0430\u043B",
    shortTitle: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u043E\u0442\u0435\u043D\u0446\u0438\u0430\u043B",
    description: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C, \u043D\u0430\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u0433\u043E\u0442\u043E\u0432 \u0431\u0440\u0430\u0442\u044C \u043D\u0430 \u0441\u0435\u0431\u044F \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0446\u0438\u044E, \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0447\u0435\u0441\u043A\u0438\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u044F \u0438 \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0437\u0430 \u0434\u0440\u0443\u0433\u0438\u0445.",
    outcomes: [
      "\u0433\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u044C \u043A \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0447\u0435\u0441\u043A\u043E\u0439 \u0440\u043E\u043B\u0438",
      "\u0441\u0438\u043B\u044C\u043D\u044B\u0435 \u0438 \u0441\u043B\u0430\u0431\u044B\u0435 \u0441\u0442\u043E\u0440\u043E\u043D\u044B \u043A\u0430\u043A \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F",
      "\u0442\u043E\u0447\u043A\u0438 \u0440\u043E\u0441\u0442\u0430 \u043F\u0435\u0440\u0435\u0434 \u043F\u043E\u0432\u044B\u0448\u0435\u043D\u0438\u0435\u043C"
    ],
    recommended: getGoalRecommendedTests("management_potential")
  },
  {
    key: "team_interaction",
    title: "\u041A\u043E\u043C\u0430\u043D\u0434\u043D\u043E\u0435 \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435",
    shortTitle: "\u041A\u043E\u043C\u0430\u043D\u0434\u043D\u0430\u044F \u0440\u043E\u043B\u044C",
    description: "\u041F\u043E\u043D\u044F\u0442\u044C, \u043A\u0430\u043A \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u0432\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0432 \u043A\u043E\u043C\u0430\u043D\u0434\u0443, \u0433\u0434\u0435 \u0443\u0441\u0438\u043B\u0438\u0432\u0430\u0435\u0442 \u0433\u0440\u0443\u043F\u043F\u0443, \u0430 \u0433\u0434\u0435 \u043C\u043E\u0436\u0435\u0442 \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u0442\u044C \u0442\u0440\u0435\u043D\u0438\u0435.",
    outcomes: [
      "\u043A\u043E\u043C\u0430\u043D\u0434\u043D\u0430\u044F \u0440\u043E\u043B\u044C \u0438 \u0441\u0442\u0438\u043B\u044C \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F",
      "\u0440\u0438\u0441\u043A \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442\u043E\u0432 \u0438 \u043F\u0435\u0440\u0435\u043A\u043E\u0441\u043E\u0432",
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438 \u043F\u043E \u0441\u043E\u0441\u0442\u0430\u0432\u0443 \u043A\u043E\u043C\u0430\u043D\u0434\u044B"
    ],
    recommended: getGoalRecommendedTests("team_interaction")
  },
  {
    key: "leadership",
    title: "\u041B\u0438\u0434\u0435\u0440\u0441\u0442\u0432\u043E \u0438 \u0432\u043B\u0438\u044F\u043D\u0438\u0435",
    shortTitle: "\u041B\u0438\u0434\u0435\u0440\u0441\u0442\u0432\u043E",
    description: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043B\u0438\u0434\u0435\u0440\u0441\u043A\u0438\u0439 \u0441\u0442\u0438\u043B\u044C, \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u0432\u0435\u0441\u0442\u0438 \u043B\u044E\u0434\u0435\u0439 \u0437\u0430 \u0441\u043E\u0431\u043E\u0439 \u0438 \u0441\u0442\u0435\u043F\u0435\u043D\u044C \u0432\u043B\u0438\u044F\u043D\u0438\u044F \u0432 \u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u044F\u0445.",
    outcomes: [
      "\u043B\u0438\u0434\u0435\u0440\u0441\u043A\u0438\u0439 \u0441\u0442\u0438\u043B\u044C",
      "\u0441\u043F\u043E\u0441\u043E\u0431 \u0432\u043B\u0438\u044F\u043D\u0438\u044F \u043D\u0430 \u043A\u043E\u043C\u0430\u043D\u0434\u0443",
      "\u0440\u0438\u0441\u043A \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F, \u0445\u0430\u043E\u0441\u0430 \u0438\u043B\u0438 \u043F\u0430\u0441\u0441\u0438\u0432\u043D\u043E\u0441\u0442\u0438"
    ],
    recommended: getGoalRecommendedTests("leadership")
  },
  {
    key: "self_organization",
    title: "\u0421\u0430\u043C\u043E\u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u0438 \u0442\u0430\u0439\u043C-\u043C\u0435\u043D\u0435\u0434\u0436\u043C\u0435\u043D\u0442",
    shortTitle: "\u0421\u0430\u043C\u043E\u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F",
    description: "\u041E\u0446\u0435\u043D\u0438\u0442\u044C, \u043D\u0430\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u0443\u043C\u0435\u0435\u0442 \u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0440\u0438\u0442\u043C, \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u0432\u0440\u0435\u043C\u0435\u043D\u0435\u043C, \u0434\u043E\u0432\u043E\u0434\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0438 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0442\u044C \u0441\u043E\u0431\u0440\u0430\u043D\u043D\u043E\u0441\u0442\u044C.",
    outcomes: [
      "\u0441\u0442\u0438\u043B\u044C \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0432\u0440\u0435\u043C\u0435\u043D\u0435\u043C",
      "\u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0441\u0430\u043C\u043E\u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044F \u0438 \u0434\u0438\u0441\u0446\u0438\u043F\u043B\u0438\u043D\u044B",
      "\u0440\u0438\u0441\u043A\u0438 \u0441\u0440\u044B\u0432\u0430 \u0441\u0440\u043E\u043A\u043E\u0432 \u0438 \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0430"
    ],
    recommended: getGoalRecommendedTests("self_organization")
  },
  {
    key: "learning_agility",
    title: "\u041E\u0431\u0443\u0447\u0430\u0435\u043C\u043E\u0441\u0442\u044C \u0438 \u0441\u0442\u0438\u043B\u044C \u043E\u0441\u0432\u043E\u0435\u043D\u0438\u044F",
    shortTitle: "\u041E\u0431\u0443\u0447\u0430\u0435\u043C\u043E\u0441\u0442\u044C",
    description: "\u041F\u043E\u043D\u044F\u0442\u044C, \u043A\u0430\u043A \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u0443\u0447\u0438\u0442\u0441\u044F, \u043A\u0430\u043A \u0431\u044B\u0441\u0442\u0440\u0435\u0435 \u043E\u0441\u0432\u0430\u0438\u0432\u0430\u0435\u0442 \u043D\u043E\u0432\u043E\u0435 \u0438 \u043A\u0430\u043A\u043E\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u0440\u0430\u0437\u0432\u0438\u0442\u0438\u044F \u0434\u043B\u044F \u043D\u0435\u0433\u043E \u0440\u0435\u0430\u043B\u044C\u043D\u043E \u0440\u0430\u0431\u043E\u0447\u0438\u0439.",
    outcomes: [
      "\u043F\u0440\u0435\u043E\u0431\u043B\u0430\u0434\u0430\u044E\u0449\u0438\u0439 \u0441\u0442\u0438\u043B\u044C \u043E\u0431\u0443\u0447\u0435\u043D\u0438\u044F",
      "\u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u0432 \u043D\u043E\u0432\u043E\u0435",
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438 \u043F\u043E \u043E\u0431\u0443\u0447\u0435\u043D\u0438\u044E \u0438 \u0430\u0434\u0430\u043F\u0442\u0430\u0446\u0438\u0438"
    ],
    recommended: getGoalRecommendedTests("learning_agility")
  },
  {
    key: "emotional_regulation",
    title: "\u042D\u043C\u043E\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u0430\u044F \u0443\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u043E\u0441\u0442\u044C \u0438 \u0440\u0435\u0433\u0443\u043B\u044F\u0446\u0438\u044F",
    shortTitle: "\u042D\u043C\u043E\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u0430\u044F \u0443\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u043E\u0441\u0442\u044C",
    description: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C, \u043A\u0430\u043A \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u0434\u0435\u0440\u0436\u0438\u0442 \u0441\u0435\u0431\u044F \u043F\u043E\u0434 \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u0435\u043C, \u043D\u0430\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0443\u043C\u0435\u0435\u0442 \u0440\u0435\u0433\u0443\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u044D\u043C\u043E\u0446\u0438\u0438 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0442\u044C \u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u0442\u043E\u043D\u0443\u0441.",
    outcomes: [
      "\u0443\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u043E\u0441\u0442\u044C \u043A \u043D\u0430\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u044E",
      "\u0441\u0430\u043C\u043E\u0440\u0435\u0433\u0443\u043B\u044F\u0446\u0438\u044F \u0432 \u0441\u0442\u0440\u0435\u0441\u0441\u0435",
      "\u0440\u0438\u0441\u043A\u0438 \u044D\u043C\u043E\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0441\u0440\u044B\u0432\u0430 \u0438\u043B\u0438 \u043D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u0438\u044F \u043D\u0430\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u044F"
    ],
    recommended: getGoalRecommendedTests("emotional_regulation")
  },
  {
    key: "communication_influence",
    title: "\u041A\u043E\u043C\u043C\u0443\u043D\u0438\u043A\u0430\u0446\u0438\u044F \u0438 \u0432\u043B\u0438\u044F\u043D\u0438\u0435",
    shortTitle: "\u041A\u043E\u043C\u043C\u0443\u043D\u0438\u043A\u0430\u0446\u0438\u044F",
    description: "\u041E\u0446\u0435\u043D\u0438\u0442\u044C, \u043A\u0430\u043A \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u0432\u044B\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u0442 \u043A\u043E\u043D\u0442\u0430\u043A\u0442, \u043F\u0435\u0440\u0435\u0434\u0430\u0451\u0442 \u0441\u043C\u044B\u0441\u043B, \u0443\u0431\u0435\u0436\u0434\u0430\u0435\u0442 \u0438 \u0432\u043B\u0438\u044F\u0435\u0442 \u043D\u0430 \u0441\u043E\u0431\u0435\u0441\u0435\u0434\u043D\u0438\u043A\u0430 \u0432 \u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0437\u0430\u0434\u0430\u0447\u0430\u0445.",
    outcomes: [
      "\u0441\u0442\u0438\u043B\u044C \u043A\u043E\u043C\u043C\u0443\u043D\u0438\u043A\u0430\u0446\u0438\u0438",
      "\u043A\u0430\u0447\u0435\u0441\u0442\u0432\u043E \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0430 \u0438 \u0432\u043B\u0438\u044F\u043D\u0438\u044F",
      "\u0440\u0438\u0441\u043A\u0438 \u043D\u0435\u0434\u043E\u043F\u043E\u043D\u0438\u043C\u0430\u043D\u0438\u044F \u0438 \u043F\u0435\u0440\u0435\u0433\u0438\u0431\u043E\u0432 \u0432\u043E \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0438"
    ],
    recommended: getGoalRecommendedTests("communication_influence")
  }
];
function getGoalDefinition(goal) {
  return COMMERCIAL_GOALS.find((item) => item.key === goal) || null;
}

// tmp/proj/lib/folderIcons.ts
var FOLDER_ICONS = [
  { key: "folder", label: "\u041F\u0430\u043F\u043A\u0430", symbol: "\u{1F4C1}", tileClass: "from-emerald-200 via-green-100 to-white text-emerald-950", ringClass: "ring-emerald-300" },
  { key: "briefcase", label: "\u041A\u0435\u0439\u0441", symbol: "\u{1F4BC}", tileClass: "from-teal-200 via-emerald-100 to-white text-teal-950", ringClass: "ring-teal-300" },
  { key: "target", label: "\u0426\u0435\u043B\u044C", symbol: "\u{1F3AF}", tileClass: "from-lime-200 via-emerald-100 to-white text-lime-950", ringClass: "ring-lime-300" },
  { key: "leaf", label: "\u0420\u043E\u0441\u0442", symbol: "\u{1F33F}", tileClass: "from-green-200 via-emerald-100 to-white text-green-950", ringClass: "ring-green-300" },
  { key: "spark", label: "\u0418\u0434\u0435\u044F", symbol: "\u2728", tileClass: "from-emerald-200 via-teal-100 to-white text-emerald-950", ringClass: "ring-emerald-300" },
  { key: "diamond", label: "\u0424\u043E\u043A\u0443\u0441", symbol: "\u25C6", tileClass: "from-slate-200 via-emerald-50 to-white text-slate-900", ringClass: "ring-slate-300" },
  { key: "grid", label: "\u0421\u0438\u0441\u0442\u0435\u043C\u0430", symbol: "\u25A3", tileClass: "from-emerald-100 via-lime-50 to-white text-emerald-950", ringClass: "ring-emerald-300" },
  { key: "shield", label: "\u041E\u043F\u043E\u0440\u0430", symbol: "\u{1F6E1}\uFE0F", tileClass: "from-teal-100 via-emerald-50 to-white text-teal-950", ringClass: "ring-teal-300" }
];
function getFolderIcon(key) {
  return FOLDER_ICONS.find((item) => item.key === key) || FOLDER_ICONS[0];
}

// tmp/proj/lib/useWallet.ts
var import_react4 = require("react");
init_useSession();

// tmp/proj/lib/testWallet.ts
var DEFAULT_TEST_UNLIMITED_EMAILS = [];
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function getTestUnlimitedEmails() {
  const raw = process.env.NEXT_PUBLIC_TEST_UNLIMITED_EMAILS || process.env.TEST_UNLIMITED_EMAILS || "";
  const fromEnv = raw.split(",").map((item) => normalizeEmail(item)).filter(Boolean);
  return Array.from(/* @__PURE__ */ new Set([...DEFAULT_TEST_UNLIMITED_EMAILS, ...fromEnv]));
}
function isTestUnlimitedEmail(email) {
  const normalized = normalizeEmail(email);
  return !!normalized && getTestUnlimitedEmails().includes(normalized);
}
var TEST_UNLIMITED_BALANCE_KOPEKS = 9999999e4;

// tmp/proj/lib/useWallet.ts
function useWallet() {
  const { supabase, user, session } = useSession();
  const isUnlimited = isTestUnlimitedEmail(user?.email);
  const [wallet, setWallet] = (0, import_react4.useState)(null);
  const [ledger, setLedger] = (0, import_react4.useState)([]);
  const [loading, setLoading] = (0, import_react4.useState)(false);
  const [error, setError] = (0, import_react4.useState)("");
  const refresh = (0, import_react4.useCallback)(async () => {
    if (!supabase || !user) {
      setWallet(null);
      setLedger([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (isUnlimited) {
        setWallet({ user_id: user.id, balance_kopeks: TEST_UNLIMITED_BALANCE_KOPEKS, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
        setLedger([
          {
            id: "test-unlimited-balance",
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            amount_kopeks: TEST_UNLIMITED_BALANCE_KOPEKS,
            reason: "test_unlimited_balance",
            ref: "storyguild9@gmail.com"
          }
        ]);
        return;
      }
      await supabase.from("wallets").upsert(
        { user_id: user.id, balance_kopeks: 0 },
        { onConflict: "user_id", ignoreDuplicates: true }
      );
      const w = await supabase.from("wallets").select("user_id,balance_kopeks,updated_at").eq("user_id", user.id).single();
      if (w.error) throw w.error;
      setWallet(w.data);
      const l = await supabase.from("wallet_ledger").select("id,created_at,amount_kopeks,reason,ref").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
      if (l.error) throw l.error;
      setLedger(l.data ?? []);
    } catch (e) {
      setError(e?.message ?? "Wallet load error");
    } finally {
      setLoading(false);
    }
  }, [supabase, user, isUnlimited]);
  (0, import_react4.useEffect)(() => {
    refresh();
  }, [refresh]);
  return { wallet, ledger, loading, error, refresh, isUnlimited };
}

// tmp/proj/pages/dashboard/index.tsx
init_admin();

// tmp/proj/lib/globalDeskTemplate.ts
var FOLDER_TEMPLATE_ID = "template:folder";
var PROJECT_TEMPLATE_ID = "template:project";
var POSITION_KEYS = [
  "x",
  "y",
  "z",
  "width",
  "height",
  "rotation",
  "tiltX",
  "tiltY",
  "clipTlx",
  "clipTly",
  "clipTrx",
  "clipTry",
  "clipBrx",
  "clipBry",
  "clipBlx",
  "clipBly"
];
function sanitizeDeskTemplatePosition(value) {
  if (!value || typeof value !== "object") return null;
  const next = {};
  for (const key of POSITION_KEYS) {
    const raw = value[key];
    if (raw === null || raw === void 0 || raw === "") continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) continue;
    next[key] = num;
  }
  return Object.keys(next).length ? next : null;
}
function sanitizeSceneWidget(value) {
  if (!value || typeof value !== "object") return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id) return null;
  const numericKeys = ["x", "y", "width", "height", "rotation", "fontSize", "z"];
  const next = { id };
  for (const key of numericKeys) {
    const raw = value[key];
    const num = Number(raw);
    if (!Number.isFinite(num)) return null;
    next[key] = num;
  }
  if (typeof value.kind === "string" && value.kind.trim()) next.kind = value.kind.trim();
  if (typeof value.text === "string") next.text = value.text;
  if (typeof value.src === "string" && value.src.trim()) next.src = value.src.trim();
  if (typeof value.action === "string" && value.action.trim()) next.action = value.action.trim();
  if (typeof value.tone === "string" && value.tone.trim()) next.tone = value.tone.trim();
  return next;
}
function sanitizeSceneWidgets(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => sanitizeSceneWidget(item)).filter(Boolean);
}
function pickTemplatePositions(source) {
  const root = source && typeof source === "object" && source.positions && typeof source.positions === "object" ? source.positions : source;
  if (!root || typeof root !== "object") return {};
  const next = {};
  const folder = sanitizeDeskTemplatePosition(root[FOLDER_TEMPLATE_ID]);
  const project = sanitizeDeskTemplatePosition(root[PROJECT_TEMPLATE_ID]);
  if (folder) next[FOLDER_TEMPLATE_ID] = folder;
  if (project) next[PROJECT_TEMPLATE_ID] = project;
  return next;
}
function pickSceneStandard(source) {
  const raw = source && typeof source === "object" && source.standard && typeof source.standard === "object" ? source.standard : source || {};
  const positionsSource = raw && typeof raw === "object" && raw.positions && typeof raw.positions === "object" ? raw.positions : raw;
  const positions = {};
  if (positionsSource && typeof positionsSource === "object") {
    for (const [key, value] of Object.entries(positionsSource)) {
      const sanitized = sanitizeDeskTemplatePosition(value);
      if (sanitized) positions[key] = sanitized;
    }
  }
  const widgets = sanitizeSceneWidgets(raw?.widgets);
  const trayGuideText = typeof raw?.trayGuideText === "string" && raw.trayGuideText.trim() ? raw.trayGuideText.trim() : void 0;
  return { positions, widgets, trayGuideText };
}

// tmp/proj/pages/dashboard/index.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var DESK_WIDTH = 1400;
var DESK_HEIGHT = 760;
var DESK_FOLDER_WIDTH = 164;
var DESK_FOLDER_HEIGHT = 142;
var DESK_SHEET_WIDTH = 184;
var DESK_SHEET_HEIGHT = 132;
var DESK_STORAGE_PREFIX = "commercialDeskLayout:v1835:";
var GLOBAL_DESK_TEMPLATE_STORAGE_KEY = "commercialGlobalDeskTemplate:v1839";
var SCENE_WIDGETS_STORAGE_PREFIX = "commercialSceneWidgets:v1840:";
var DESKTOP_VARIANT_STORAGE_PREFIX = "commercialDesktopVariant:v1841:";
var ROOM_LIGHT_STORAGE_PREFIX = "commercialRoomLight:v1842:";
var ROOM_SWITCH_STORAGE_PREFIX = "commercialRoomSwitch:v1843:";
var TRAY_GUIDE_TEXT_STORAGE_PREFIX = "commercialTrayGuideText:v1836:";
var TRASH_STORAGE_PREFIX = "commercialTrash:v18365:";
var TRASH_RETENTION_MS = 3 * 24 * 60 * 60 * 1e3;
var TRAY_CLIP = { x: 1050, y: 526, width: 226, height: 124 };
var SHEET_ZONE = { x: 110, y: 618, width: 760, height: 110 };
var TRASH_ZONE = { x: 16, y: 434, width: 160, height: 180 };
var DEFAULT_ROOM_SWITCH_ZONE = { x: 48, y: 248, width: 136, height: 116 };
var ROOM_DIM_HOTSPOT = { x: 42, y: 386, width: 188, height: 94 };
var ROOM_SWITCH_STANDARD_ID = "scene:roomSwitch";
var LAPTOP_DEVICE_ID = "scene:deskLaptop";
var LAPTOP_PANEL_ID = "scene:deskLaptopPanel";
var TRAY_GUIDE_ID = "guide:tray";
var TRASH_GUIDE_ID = "guide:trash";
var DEFAULT_LAPTOP_POSITION = { x: 936, y: 432, width: 372, height: 248, z: 24, rotation: -5.4, tiltX: 0, tiltY: 0 };
var DEFAULT_LAPTOP_PANEL_POSITION = { x: 1004, y: 469, width: 226, height: 132, z: 26, rotation: -5.4, tiltX: 0, tiltY: 0 };
function getDeskRect(position, fallbackWidth, fallbackHeight, inset = 0) {
  const width = Math.max(0, Number(position.width ?? fallbackWidth));
  const height = Math.max(0, Number(position.height ?? fallbackHeight));
  const left = Number(position.x ?? 0) + inset;
  const top = Number(position.y ?? 0) + inset;
  const right = left + Math.max(0, width - inset * 2);
  const bottom = top + Math.max(0, height - inset * 2);
  return { left, top, right, bottom };
}
function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
function keepRectOutOfBlockedZone(itemRect, blockedRect, bounds) {
  if (!rectsOverlap(itemRect, blockedRect)) {
    return { x: itemRect.left, y: itemRect.top };
  }
  const width = itemRect.right - itemRect.left;
  const height = itemRect.bottom - itemRect.top;
  const candidates = [
    { x: blockedRect.left - width - 12, y: itemRect.top },
    { x: blockedRect.right + 12, y: itemRect.top },
    { x: itemRect.left, y: blockedRect.top - height - 12 },
    { x: itemRect.left, y: blockedRect.bottom + 12 }
  ].map((candidate) => ({
    x: clampDesk(candidate.x, bounds.minX, bounds.maxX),
    y: clampDesk(candidate.y, bounds.minY, bounds.maxY)
  }));
  const valid = candidates.find((candidate) => !rectsOverlap({ left: candidate.x, top: candidate.y, right: candidate.x + width, bottom: candidate.y + height }, blockedRect));
  if (valid) return valid;
  return {
    x: clampDesk(itemRect.left, bounds.minX, bounds.maxX),
    y: clampDesk(blockedRect.bottom + 12, bounds.minY, bounds.maxY)
  };
}
function getSubscriptionDaysLeft(expiresAt) {
  if (!expiresAt) return null;
  const target = new Date(expiresAt).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = target - Date.now();
  return Math.max(0, Math.ceil(diff / (1e3 * 60 * 60 * 24)));
}
var GOAL_ORDER = Object.fromEntries(COMMERCIAL_GOALS.map((item, index) => [item.key, index + 1]));
function sortProjects(list) {
  return [...list].sort((a, b) => {
    const goalDelta = (GOAL_ORDER[a.goal] || 99) - (GOAL_ORDER[b.goal] || 99);
    if (goalDelta !== 0) return goalDelta;
    const nameA = (a.person?.full_name || a.title || "").toLowerCase();
    const nameB = (b.person?.full_name || b.title || "").toLowerCase();
    const nameDelta = nameA.localeCompare(nameB, "ru");
    if (nameDelta !== 0) return nameDelta;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
function getEntityTilt(seedSource, spread = 4) {
  const seed = Array.from(seedSource).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (seed % (spread * 2 + 1) - spread) * 1.2;
}
function getGreeneryLevel(amountRub, isUnlimited = false) {
  if (isUnlimited) return 4;
  if (amountRub >= 5e3) return 4;
  if (amountRub >= 2500) return 3;
  if (amountRub >= 1e3) return 2;
  if (amountRub >= 300) return 1;
  return 0;
}
function getGreeneryLabel(level) {
  switch (level) {
    case 4:
      return "\u041F\u0440\u0435\u043C\u0438\u0430\u043B\u044C\u043D\u044B\u0439 \u043A\u0430\u0431\u0438\u043D\u0435\u0442";
    case 3:
      return "\u0413\u0443\u0441\u0442\u0430\u044F \u0437\u0435\u043B\u0435\u043D\u044C";
    case 2:
      return "\u0416\u0438\u0432\u043E\u0439 \u0438\u043D\u0442\u0435\u0440\u044C\u0435\u0440";
    case 1:
      return "\u041F\u0435\u0440\u0432\u044B\u0435 \u0432\u044C\u044E\u043D\u044B";
    default:
      return "\u0427\u0438\u0441\u0442\u044B\u0439 \u043A\u0430\u0431\u0438\u043D\u0435\u0442";
  }
}
function getGreeneryHint(level) {
  switch (level) {
    case 4:
      return "\u041E\u043A\u043D\u0430 \u0438 \u043F\u0430\u043D\u0435\u043B\u0438 \u0443\u0436\u0435 \u043C\u044F\u0433\u043A\u043E \u043E\u0431\u0440\u0430\u043C\u043B\u0435\u043D\u044B \u0440\u0435\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u043D\u043E\u0439 \u0437\u0435\u043B\u0435\u043D\u044C\u044E, \u0430 \u043A\u0430\u0431\u0438\u043D\u0435\u0442 \u0432\u044B\u0433\u043B\u044F\u0434\u0438\u0442 \u043A\u0430\u043A \u0434\u043E\u0440\u043E\u0433\u043E\u0439 \u0436\u0438\u0432\u043E\u0439 \u0438\u043D\u0442\u0435\u0440\u044C\u0435\u0440.";
    case 3:
      return "\u0412\u044C\u044E\u043D\u044B \u0443\u0436\u0435 \u0445\u043E\u0440\u043E\u0448\u043E \u0432\u0438\u0434\u043D\u044B \u043F\u043E \u0440\u0430\u043C\u043A\u0430\u043C \u0438 \u0441\u043E\u0431\u0438\u0440\u0430\u044E\u0442 \u0438\u043D\u0442\u0435\u0440\u044C\u0435\u0440 \u0432 \u0446\u0435\u043B\u044C\u043D\u0443\u044E \u0436\u0438\u0432\u0443\u044E \u043A\u043E\u043C\u043F\u043E\u0437\u0438\u0446\u0438\u044E.";
    case 2:
      return "\u0417\u0435\u043B\u0435\u043D\u044C \u0437\u0430\u043C\u0435\u0442\u043D\u043E \u043E\u0436\u0438\u0432\u043B\u044F\u0435\u0442 \u043F\u0430\u043D\u0435\u043B\u0438: \u043F\u043E \u043A\u0440\u0430\u044F\u043C \u043E\u043A\u043E\u043D \u0443\u0436\u0435 \u0438\u0434\u0443\u0442 \u043F\u0435\u0440\u0432\u044B\u0435 \u0443\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0435 \u043B\u0438\u043D\u0438\u0438 \u0432\u044C\u044E\u043D\u043E\u0432.";
    case 1:
      return "\u041F\u043E\u044F\u0432\u0438\u043B\u0438\u0441\u044C \u043F\u0435\u0440\u0432\u044B\u0435 \u0430\u043A\u043A\u0443\u0440\u0430\u0442\u043D\u044B\u0435 \u0432\u044C\u044E\u043D\u044B \u0432\u043E\u043A\u0440\u0443\u0433 \u043E\u043A\u043E\u043D \u0438 \u043A\u0430\u0440\u0442\u043E\u0447\u0435\u043A.";
    default:
      return "\u041F\u043E\u043A\u0430 \u043A\u0430\u0431\u0438\u043D\u0435\u0442 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0447\u0438\u0441\u0442\u044B\u043C \u0438 \u0441\u0442\u0440\u043E\u0433\u0438\u043C. \u0427\u0435\u043C \u0431\u043E\u043B\u044C\u0448\u0435 \u043F\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0439, \u0442\u0435\u043C \u0431\u043E\u0433\u0430\u0447\u0435 \u0441\u0442\u0430\u043D\u0435\u0442 \u0436\u0438\u0432\u0430\u044F \u0437\u0435\u043B\u0435\u043D\u044C \u0432\u043E\u043A\u0440\u0443\u0433 \u043E\u043A\u043E\u043D.";
  }
}
function clampDesk(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function getGuideClipRect(position) {
  const x = Math.round(position?.x ?? getDefaultTrayGuidePosition().x);
  const y = Math.round(position?.y ?? getDefaultTrayGuidePosition().y);
  const width = Math.round(position?.width ?? getDefaultTrayGuidePosition().width ?? 228);
  const height = Math.round(position?.height ?? getDefaultTrayGuidePosition().height ?? 104);
  return { x, y, width, height };
}
function getGuideTransform(position) {
  const rotation = position?.rotation || 0;
  const tiltX = position?.tiltX || 0;
  const tiltY = position?.tiltY || 0;
  return `perspective(1400px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotate(${rotation}deg)`;
}
function getGuideClipPath(position) {
  const width = Math.max(24, Number(position?.width || getDefaultTrayGuidePosition().width || 228));
  const height = Math.max(24, Number(position?.height || getDefaultTrayGuidePosition().height || 104));
  const tlx = Math.min(width, Math.max(0, Number(position?.clipTlx || 0)));
  const tly = Math.min(height, Math.max(0, Number(position?.clipTly || 0)));
  const trx = Math.min(width, Math.max(0, Number(position?.clipTrx ?? width)));
  const trY = Math.min(height, Math.max(0, Number(position?.clipTry || 0)));
  const brx = Math.min(width, Math.max(0, Number(position?.clipBrx ?? width)));
  const bry = Math.min(height, Math.max(0, Number(position?.clipBry ?? height)));
  const blx = Math.min(width, Math.max(0, Number(position?.clipBlx || 0)));
  const bly = Math.min(height, Math.max(0, Number(position?.clipBly ?? height)));
  const area = Math.abs(
    tlx * trY + trx * bry + brx * bly + blx * tly - tly * trx - trY * brx - bry * blx - bly * tlx
  ) / 2;
  if (!Number.isFinite(area) || area < width * height * 0.08) {
    return `polygon(0px 0px, ${width}px 0px, ${width}px ${height}px, 0px ${height}px)`;
  }
  return `polygon(${tlx}px ${tly}px, ${trx}px ${trY}px, ${brx}px ${bry}px, ${blx}px ${bly}px)`;
}
function getDeskStorageKey(workspaceId, variant = "scheme") {
  return variant === "scheme" ? `${DESK_STORAGE_PREFIX}${workspaceId}` : `${DESK_STORAGE_PREFIX}${workspaceId}:${variant}`;
}
function readGlobalDeskTemplates() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GLOBAL_DESK_TEMPLATE_STORAGE_KEY);
    if (!raw) return {};
    return pickTemplatePositions(JSON.parse(raw));
  } catch {
    return {};
  }
}
function writeGlobalDeskTemplates(source) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GLOBAL_DESK_TEMPLATE_STORAGE_KEY, JSON.stringify(pickTemplatePositions(source)));
  } catch {
  }
}
function getSceneWidgetsStorageKey(workspaceId, variant = "scheme") {
  return variant === "scheme" ? `${SCENE_WIDGETS_STORAGE_PREFIX}${workspaceId}` : `${SCENE_WIDGETS_STORAGE_PREFIX}${workspaceId}:${variant}`;
}
function getDesktopVariantStorageKey(workspaceId) {
  return `${DESKTOP_VARIANT_STORAGE_PREFIX}${workspaceId}`;
}
function getRoomLightStorageKey(workspaceId) {
  return `${ROOM_LIGHT_STORAGE_PREFIX}${workspaceId}`;
}
function getRoomSwitchStorageKey(workspaceId) {
  return `${ROOM_SWITCH_STORAGE_PREFIX}${workspaceId}`;
}
function getTrayGuideTextStorageKey(workspaceId) {
  return `${TRAY_GUIDE_TEXT_STORAGE_PREFIX}${workspaceId}`;
}
function getTrashStorageKey(workspaceId) {
  return `${TRASH_STORAGE_PREFIX}${workspaceId}`;
}
function buildSchemeSceneWidgets(params) {
  return [
    { id: "board-scheme", kind: "image", text: "", src: "/dashboard-board-marker-scheme-transparent.png", action: "none", tone: "scheme", x: 52, y: 26, width: 1296, height: 716, rotation: 0, fontSize: 0, z: 10 },
    { id: "create-project", kind: "button", text: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442", action: "createProject", tone: "buttonPrimary", x: 230, y: 330, width: 360, height: 110, rotation: 0.4, fontSize: 30, z: 31 },
    { id: "open-tests", kind: "button", text: "\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0442\u0435\u0441\u0442\u043E\u0432", action: "openCatalog", tone: "buttonPrimary", x: 770, y: 330, width: 388, height: 110, rotation: -0.2, fontSize: 30, z: 31 }
  ];
}
function buildClassicSceneWidgets(params) {
  return [];
}
function getClassicFolderPosition(index) {
  const col = Math.floor(index / 6);
  const row = index % 6;
  return {
    x: 58 + col * 156,
    y: 88 + row * 124,
    z: 80 + index
  };
}
function getClassicProjectPosition(index) {
  const col = Math.floor(index / 6);
  const row = index % 6;
  return {
    x: 232 + col * 156,
    y: 88 + row * 124,
    z: 180 + index
  };
}
function getDefaultFolderPosition(index) {
  return {
    x: TRAY_CLIP.x + 8 + index * 16,
    y: TRAY_CLIP.y + 10 + index * 8,
    z: 30 + index
  };
}
function getDefaultProjectPosition(index) {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const offsets = [
    { x: 0, y: 4 },
    { x: 206, y: 16 },
    { x: 418, y: 10 }
  ];
  const offset = offsets[col] || offsets[0];
  return {
    x: SHEET_ZONE.x + offset.x + row * 18,
    y: SHEET_ZONE.y + offset.y + row * 12,
    z: 180 + index
  };
}
function getDefaultTrayGuidePosition() {
  return {
    x: 1208,
    y: 604,
    z: 18,
    width: 228,
    height: 104,
    rotation: 0,
    tiltX: 0,
    tiltY: 0,
    clipTlx: 0,
    clipTly: 10,
    clipTrx: 214,
    clipTry: 0,
    clipBrx: 228,
    clipBry: 92,
    clipBlx: 16,
    clipBly: 104
  };
}
function getDefaultTrashGuidePosition() {
  return {
    x: TRASH_ZONE.x,
    y: TRASH_ZONE.y,
    z: 18,
    width: TRASH_ZONE.width,
    height: TRASH_ZONE.height,
    rotation: 0,
    tiltX: 0,
    tiltY: 0
  };
}
function mergeDeskPositions(folders, projects, saved) {
  const next = {};
  next[TRAY_GUIDE_ID] = saved[TRAY_GUIDE_ID] || getDefaultTrayGuidePosition();
  next[TRASH_GUIDE_ID] = saved[TRASH_GUIDE_ID] || getDefaultTrashGuidePosition();
  next[LAPTOP_DEVICE_ID] = saved[LAPTOP_DEVICE_ID] || DEFAULT_LAPTOP_POSITION;
  next[LAPTOP_PANEL_ID] = saved[LAPTOP_PANEL_ID] || DEFAULT_LAPTOP_PANEL_POSITION;
  const folderTemplate = saved[FOLDER_TEMPLATE_ID] || {};
  const projectTemplate = saved[PROJECT_TEMPLATE_ID] || {};
  const trayRect = getGuideClipRect(next[TRAY_GUIDE_ID]);
  folders.forEach((folder, index) => {
    const key = `folder:${folder.id}`;
    next[key] = saved[key] || {
      x: trayRect.x + 8 + index * 12,
      y: trayRect.y + 6 + index * 7,
      z: 20 + index,
      width: folderTemplate.width,
      height: folderTemplate.height,
      rotation: folderTemplate.rotation,
      tiltX: folderTemplate.tiltX,
      tiltY: folderTemplate.tiltY,
      clipTlx: folderTemplate.clipTlx,
      clipTly: folderTemplate.clipTly,
      clipTrx: folderTemplate.clipTrx,
      clipTry: folderTemplate.clipTry,
      clipBrx: folderTemplate.clipBrx,
      clipBry: folderTemplate.clipBry,
      clipBlx: folderTemplate.clipBlx,
      clipBly: folderTemplate.clipBly
    };
  });
  projects.forEach((project, index) => {
    const key = `project:${project.id}`;
    next[key] = saved[key] || {
      ...getDefaultProjectPosition(index),
      width: projectTemplate.width,
      height: projectTemplate.height,
      rotation: projectTemplate.rotation,
      tiltX: projectTemplate.tiltX,
      tiltY: projectTemplate.tiltY,
      clipTlx: projectTemplate.clipTlx,
      clipTly: projectTemplate.clipTly,
      clipTrx: projectTemplate.clipTrx,
      clipTry: projectTemplate.clipTry,
      clipBrx: projectTemplate.clipBrx,
      clipBry: projectTemplate.clipBry,
      clipBlx: projectTemplate.clipBlx,
      clipBly: projectTemplate.clipBly
    };
  });
  if (saved[FOLDER_TEMPLATE_ID]) next[FOLDER_TEMPLATE_ID] = saved[FOLDER_TEMPLATE_ID];
  if (saved[PROJECT_TEMPLATE_ID]) next[PROJECT_TEMPLATE_ID] = saved[PROJECT_TEMPLATE_ID];
  if (saved[LAPTOP_DEVICE_ID]) next[LAPTOP_DEVICE_ID] = saved[LAPTOP_DEVICE_ID];
  if (saved[LAPTOP_PANEL_ID]) next[LAPTOP_PANEL_ID] = saved[LAPTOP_PANEL_ID];
  return next;
}
function DashboardPage() {
  const { session, user, loading: sessionLoading } = useSession();
  const router = (0, import_router.useRouter)();
  const [data, setData] = (0, import_react5.useState)(null);
  const [workspace, setWorkspace] = (0, import_react5.useState)(null);
  const [loading, setLoading] = (0, import_react5.useState)(false);
  const [error, setError] = (0, import_react5.useState)("");
  const [newFolderName, setNewFolderName] = (0, import_react5.useState)("");
  const [newFolderIcon, setNewFolderIcon] = (0, import_react5.useState)("folder");
  const [draggingProjectId, setDraggingProjectId] = (0, import_react5.useState)(null);
  const [busyFolderId, setBusyFolderId] = (0, import_react5.useState)(null);
  const [activeFolderId, setActiveFolderId] = (0, import_react5.useState)(null);
  const [iconPickerFolder, setIconPickerFolder] = (0, import_react5.useState)(null);
  const [folderActionTarget, setFolderActionTarget] = (0, import_react5.useState)(null);
  const [folderRenameTarget, setFolderRenameTarget] = (0, import_react5.useState)(null);
  const [folderRenameValue, setFolderRenameValue] = (0, import_react5.useState)("");
  const [folderDeleteTarget, setFolderDeleteTarget] = (0, import_react5.useState)(null);
  const [showCreateFolder, setShowCreateFolder] = (0, import_react5.useState)(false);
  const { wallet, ledger, loading: walletLoading, isUnlimited } = useWallet();
  const isAdmin = isAdminEmail(user?.email);
  const [mechanicPulse, setMechanicPulse] = (0, import_react5.useState)(0);
  const [deskPositions, setDeskPositions] = (0, import_react5.useState)({});
  const [deskLayer, setDeskLayer] = (0, import_react5.useState)(300);
  const [previewProject, setPreviewProject] = (0, import_react5.useState)(null);
  const [draggingFolderId, setDraggingFolderId] = (0, import_react5.useState)(null);
  const [trashHover, setTrashHover] = (0, import_react5.useState)(null);
  const trashHoverTimer = (0, import_react5.useRef)(null);
  const [trashEntries, setTrashEntries] = (0, import_react5.useState)([]);
  const [trashOpen, setTrashOpen] = (0, import_react5.useState)(false);
  const canEditScene = user?.email === "storyguild9@gmail.com" || isAdmin;
  const [sceneEditMode, setSceneEditMode] = (0, import_react5.useState)(false);
  const [sceneWidgets, setSceneWidgets] = (0, import_react5.useState)([]);
  const [desktopVariant, setDesktopVariant] = (0, import_react5.useState)("scheme");
  const [trayGuideText, setTrayGuideText] = (0, import_react5.useState)("\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u043F\u0430\u043F\u043A\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432");
  const [selectedWidgetId, setSelectedWidgetId] = (0, import_react5.useState)(null);
  const [selectedDeskItemId, setSelectedDeskItemId] = (0, import_react5.useState)(null);
  const widgetInteractionRef = (0, import_react5.useRef)(null);
  const deskInteractionRef = (0, import_react5.useRef)(null);
  const pendingCreatedFolderRef = (0, import_react5.useRef)(null);
  const templateFeedbackTimerRef = (0, import_react5.useRef)(null);
  const [templateFeedback, setTemplateFeedback] = (0, import_react5.useState)(null);
  const [sharedDeskPositions, setSharedDeskPositions] = (0, import_react5.useState)({});
  const [sharedSceneWidgets, setSharedSceneWidgets] = (0, import_react5.useState)([]);
  const [sharedTrayGuideText, setSharedTrayGuideText] = (0, import_react5.useState)("");
  const [sharedSceneReady, setSharedSceneReady] = (0, import_react5.useState)(false);
  const [isRoomLightDimmed, setIsRoomLightDimmed] = (0, import_react5.useState)(false);
  const [roomSwitchPosition, setRoomSwitchPosition] = (0, import_react5.useState)(DEFAULT_ROOM_SWITCH_ZONE);
  const roomSwitchInteractionRef = (0, import_react5.useRef)(null);
  const suppressRoomSwitchClickRef = (0, import_react5.useRef)(false);
  const [activeSubscription, setActiveSubscription] = (0, import_react5.useState)(null);
  const [subscriptionLoading, setSubscriptionLoading] = (0, import_react5.useState)(false);
  const [subscriptionError, setSubscriptionError] = (0, import_react5.useState)(null);
  const balance_rub = (0, import_react5.useMemo)(() => {
    if (isUnlimited) return 999999;
    return Math.floor(Number(wallet?.balance_kopeks ?? 0) / 100);
  }, [isUnlimited, wallet?.balance_kopeks]);
  const investedRub = (0, import_react5.useMemo)(() => {
    if (isUnlimited) return 1e4;
    const creditedKopeks = ledger.reduce((sum, item) => {
      const amount = Number(item?.amount_kopeks ?? 0);
      return amount > 0 ? sum + amount : sum;
    }, 0);
    const fromLedger = Math.floor(creditedKopeks / 100);
    return Math.max(fromLedger, balance_rub, 0);
  }, [balance_rub, isUnlimited, ledger]);
  const greeneryLevel = (0, import_react5.useMemo)(() => getGreeneryLevel(investedRub, isUnlimited), [investedRub, isUnlimited]);
  const greeneryLabel = (0, import_react5.useMemo)(() => getGreeneryLabel(greeneryLevel), [greeneryLevel]);
  const greeneryHint = (0, import_react5.useMemo)(() => getGreeneryHint(greeneryLevel), [greeneryLevel]);
  const balanceText = walletLoading ? "\u2026" : isUnlimited ? "\u221E" : `${balance_rub} \u20BD`;
  const investedText = isUnlimited ? "\u0431\u0435\u0437 \u043B\u0438\u043C\u0438\u0442\u0430" : `${investedRub} \u20BD`;
  const triggerMechanics = (0, import_react5.useCallback)((after, delay = 220) => {
    setMechanicPulse((value) => value + 1);
    if (after) {
      window.setTimeout(() => {
        after();
      }, delay);
    }
  }, []);
  const loadDashboard = (0, import_react5.useCallback)(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    setSharedSceneReady(false);
    try {
      const [profileResp, workspaceResp, sharedTemplatesResp] = await Promise.all([
        fetch("/api/commercial/profile/me", {
          headers: { authorization: `Bearer ${session.access_token}` }
        }),
        fetch("/api/commercial/projects/list", {
          headers: { authorization: `Bearer ${session.access_token}` }
        }),
        fetch("/api/commercial/scene-template", {
          headers: { authorization: `Bearer ${session.access_token}` }
        })
      ]);
      const profileJson = await profileResp.json().catch(() => ({}));
      const workspaceJson = await workspaceResp.json().catch(() => ({}));
      const sharedTemplatesJson = await sharedTemplatesResp.json().catch(() => ({}));
      if (!profileResp.ok || !profileJson?.ok) throw new Error(profileJson?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043A\u0430\u0431\u0438\u043D\u0435\u0442");
      if (!workspaceResp.ok || !workspaceJson?.ok) throw new Error(workspaceJson?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442\u044B");
      if (sharedTemplatesResp.ok && sharedTemplatesJson?.ok) {
        const parsedStandard = pickSceneStandard(sharedTemplatesJson?.standard || sharedTemplatesJson || {});
        const nextSharedPositions = parsedStandard.positions || {};
        const nextSharedWidgets = parsedStandard.widgets || [];
        setSharedDeskPositions(nextSharedPositions);
        setSharedSceneWidgets(nextSharedWidgets);
        setSharedTrayGuideText(parsedStandard.trayGuideText || "");
        writeGlobalDeskTemplates(nextSharedPositions);
      } else {
        setSharedDeskPositions({});
        setSharedSceneWidgets([]);
        setSharedTrayGuideText("");
      }
      setSharedSceneReady(true);
      setData(profileJson);
      setWorkspace(workspaceJson);
    } catch (e) {
      setSharedDeskPositions({});
      setSharedSceneWidgets([]);
      setSharedTrayGuideText("");
      setSharedSceneReady(true);
      setError(e?.message || "\u041E\u0448\u0438\u0431\u043A\u0430");
    } finally {
      setLoading(false);
    }
  }, [session, user?.email]);
  (0, import_react5.useEffect)(() => {
    if (sessionLoading) return;
    if (!session || !user) {
      router.replace("/auth?next=%2Fdashboard");
      return;
    }
    loadDashboard();
  }, [router, session, sessionLoading, user, loadDashboard]);
  const loadSubscriptionStatus = (0, import_react5.useCallback)(async () => {
    if (!session?.access_token) {
      setActiveSubscription(null);
      return;
    }
    setSubscriptionLoading(true);
    try {
      const resp = await fetch("/api/commercial/subscriptions/status", {
        headers: { authorization: `Bearer ${session.access_token}` }
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0442\u0430\u0440\u0438\u0444");
      setActiveSubscription(json.active_subscription || null);
      setSubscriptionError(null);
    } catch (err) {
      setSubscriptionError(err?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0442\u0430\u0440\u0438\u0444");
    } finally {
      setSubscriptionLoading(false);
    }
  }, [session?.access_token]);
  (0, import_react5.useEffect)(() => {
    if (!session?.access_token) return;
    loadSubscriptionStatus();
  }, [loadSubscriptionStatus, session?.access_token]);
  const displayName = data?.profile?.full_name || user?.user_metadata?.full_name || user?.email || "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C";
  const workspaceName = workspace?.workspace?.name || data?.profile?.company_name || user?.user_metadata?.company_name || "\u0420\u0430\u0431\u043E\u0447\u0435\u0435 \u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u043E";
  const toggleRoomLight = (0, import_react5.useCallback)(() => {
    setIsRoomLightDimmed((current) => !current);
  }, []);
  const laptopPosition = deskPositions[LAPTOP_DEVICE_ID] || DEFAULT_LAPTOP_POSITION;
  const laptopPanelPosition = deskPositions[LAPTOP_PANEL_ID] || DEFAULT_LAPTOP_PANEL_POSITION;
  const sceneEditControls = canEditScene ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "pointer-events-auto absolute right-4 top-4 z-[90] flex flex-wrap items-center justify-end gap-2 rounded-[18px] border border-white/70 bg-white/88 px-3 py-2 shadow-[0_16px_30px_-24px_rgba(54,35,19,0.24)] backdrop-blur-xl", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: `btn btn-sm ${sceneEditMode ? "btn-primary" : "btn-secondary"}`, onClick: (e) => {
      e.stopPropagation();
      setSceneEditMode((prev) => !prev);
    }, children: sceneEditMode ? "\u0412\u044B\u0439\u0442\u0438 \u0438\u0437 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430" : "\u0420\u0435\u0436\u0438\u043C \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430" }),
    sceneEditMode ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "btn btn-secondary btn-sm", onClick: (e) => {
      e.stopPropagation();
      resetSceneWidgets();
    }, children: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0441\u0446\u0435\u043D\u0443" }) : null
  ] }) : null;
  const defaultSceneWidgets = (0, import_react5.useMemo)(
    () => (desktopVariant === "classic" ? buildClassicSceneWidgets : buildSchemeSceneWidgets)({
      displayName,
      workspaceName,
      email: data?.profile?.email || user?.email || "email \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D",
      balanceText,
      investedText,
      greeneryLabel
    }),
    [balanceText, data?.profile?.email, desktopVariant, displayName, greeneryLabel, investedText, user?.email, workspaceName]
  );
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getDesktopVariantStorageKey(workspace.workspace.workspace_id));
      if (raw === "classic" || raw === "scheme") setDesktopVariant(raw);
    } catch {
    }
  }, [workspace?.workspace?.workspace_id]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(getDesktopVariantStorageKey(workspace.workspace.workspace_id), desktopVariant);
    } catch {
    }
  }, [desktopVariant, workspace?.workspace?.workspace_id]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getRoomLightStorageKey(workspace.workspace.workspace_id));
      setIsRoomLightDimmed(raw === "dimmed");
    } catch {
      setIsRoomLightDimmed(false);
    }
  }, [workspace?.workspace?.workspace_id]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady || typeof window === "undefined") return;
    try {
      const sharedPosition = sharedDeskPositions[ROOM_SWITCH_STANDARD_ID];
      if (sharedPosition && Number.isFinite(Number(sharedPosition.x)) && Number.isFinite(Number(sharedPosition.y))) {
        setRoomSwitchPosition({
          x: clampDesk(Number(sharedPosition.x), 0, DESK_WIDTH - DEFAULT_ROOM_SWITCH_ZONE.width),
          y: clampDesk(Number(sharedPosition.y), 0, DESK_HEIGHT - DEFAULT_ROOM_SWITCH_ZONE.height),
          width: DEFAULT_ROOM_SWITCH_ZONE.width,
          height: DEFAULT_ROOM_SWITCH_ZONE.height
        });
        return;
      }
      const raw = window.localStorage.getItem(getRoomSwitchStorageKey(workspace.workspace.workspace_id));
      if (!raw) {
        setRoomSwitchPosition(DEFAULT_ROOM_SWITCH_ZONE);
        return;
      }
      const parsed = JSON.parse(raw);
      setRoomSwitchPosition({
        x: clampDesk(Number(parsed?.x ?? DEFAULT_ROOM_SWITCH_ZONE.x), 0, DESK_WIDTH - DEFAULT_ROOM_SWITCH_ZONE.width),
        y: clampDesk(Number(parsed?.y ?? DEFAULT_ROOM_SWITCH_ZONE.y), 0, DESK_HEIGHT - DEFAULT_ROOM_SWITCH_ZONE.height),
        width: DEFAULT_ROOM_SWITCH_ZONE.width,
        height: DEFAULT_ROOM_SWITCH_ZONE.height
      });
    } catch {
      setRoomSwitchPosition(DEFAULT_ROOM_SWITCH_ZONE);
    }
  }, [sharedDeskPositions, sharedSceneReady, workspace?.workspace?.workspace_id]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(getRoomLightStorageKey(workspace.workspace.workspace_id), isRoomLightDimmed ? "dimmed" : "normal");
    } catch {
    }
  }, [isRoomLightDimmed, workspace?.workspace?.workspace_id]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(getRoomSwitchStorageKey(workspace.workspace.workspace_id), JSON.stringify({
        x: Math.round(roomSwitchPosition.x),
        y: Math.round(roomSwitchPosition.y)
      }));
    } catch {
    }
  }, [roomSwitchPosition, workspace?.workspace?.workspace_id]);
  (0, import_react5.useEffect)(() => {
    if (!canEditScene || !session?.access_token || !sharedSceneReady) return;
    const sharedPosition = sharedDeskPositions[ROOM_SWITCH_STANDARD_ID];
    const currentX = Math.round(roomSwitchPosition.x);
    const currentY = Math.round(roomSwitchPosition.y);
    const sharedX = Math.round(Number(sharedPosition?.x ?? DEFAULT_ROOM_SWITCH_ZONE.x));
    const sharedY = Math.round(Number(sharedPosition?.y ?? DEFAULT_ROOM_SWITCH_ZONE.y));
    if (currentX === sharedX && currentY === sharedY) return;
    const timer = window.setTimeout(async () => {
      try {
        const standardPayload = {
          positions: {
            ...sharedDeskPositions,
            [ROOM_SWITCH_STANDARD_ID]: {
              x: currentX,
              y: currentY,
              width: DEFAULT_ROOM_SWITCH_ZONE.width,
              height: DEFAULT_ROOM_SWITCH_ZONE.height,
              z: Number(sharedPosition?.z ?? 182)
            }
          },
          widgets: sceneWidgets.map((item) => ({
            id: item.id,
            kind: item.kind,
            text: item.text,
            action: item.action,
            tone: item.tone,
            src: item.src,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            rotation: item.rotation,
            fontSize: item.fontSize,
            z: item.z
          })),
          trayGuideText
        };
        const resp = await fetch("/api/commercial/scene-template", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            standard: standardPayload,
            positions: standardPayload.positions,
            widgets: standardPayload.widgets,
            trayGuideText: standardPayload.trayGuideText
          })
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok) throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044F");
        const parsedStandard = pickSceneStandard(json?.standard || json || {});
        setSharedDeskPositions(parsedStandard.positions || {});
        setSharedSceneWidgets(parsedStandard.widgets || []);
        setSharedTrayGuideText(parsedStandard.trayGuideText || "");
      } catch (err) {
        console.error(err);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [canEditScene, roomSwitchPosition.x, roomSwitchPosition.y, sceneWidgets, session?.access_token, sharedDeskPositions, sharedSceneReady, trayGuideText]);
  (0, import_react5.useEffect)(() => {
    if (!canEditScene || !session?.access_token || !sharedSceneReady) return;
    const sharedLaptop = sharedDeskPositions[LAPTOP_DEVICE_ID] || DEFAULT_LAPTOP_POSITION;
    const sharedPanel = sharedDeskPositions[LAPTOP_PANEL_ID] || DEFAULT_LAPTOP_PANEL_POSITION;
    const currentLaptop = laptopPosition;
    const currentPanel = laptopPanelPosition;
    const sameLaptop = Math.round(currentLaptop.x || 0) === Math.round(sharedLaptop.x || 0) && Math.round(currentLaptop.y || 0) === Math.round(sharedLaptop.y || 0) && Math.round(currentLaptop.width || 0) === Math.round(sharedLaptop.width || 0) && Math.round(currentLaptop.height || 0) === Math.round(sharedLaptop.height || 0) && Number((currentLaptop.rotation || 0).toFixed(1)) === Number((sharedLaptop.rotation || 0).toFixed(1));
    const samePanel = Math.round(currentPanel.x || 0) === Math.round(sharedPanel.x || 0) && Math.round(currentPanel.y || 0) === Math.round(sharedPanel.y || 0) && Math.round(currentPanel.width || 0) === Math.round(sharedPanel.width || 0) && Math.round(currentPanel.height || 0) === Math.round(sharedPanel.height || 0) && Number((currentPanel.rotation || 0).toFixed(1)) === Number((sharedPanel.rotation || 0).toFixed(1));
    if (sameLaptop && samePanel) return;
    const timer = window.setTimeout(async () => {
      try {
        const standardPayload = {
          positions: {
            ...sharedDeskPositions,
            [LAPTOP_DEVICE_ID]: {
              x: Math.round(currentLaptop.x || 0),
              y: Math.round(currentLaptop.y || 0),
              width: Math.round(currentLaptop.width || DEFAULT_LAPTOP_POSITION.width || 0),
              height: Math.round(currentLaptop.height || DEFAULT_LAPTOP_POSITION.height || 0),
              rotation: Number((currentLaptop.rotation || 0).toFixed(1)),
              z: Number(currentLaptop.z ?? sharedLaptop.z ?? DEFAULT_LAPTOP_POSITION.z ?? 24)
            },
            [LAPTOP_PANEL_ID]: {
              x: Math.round(currentPanel.x || 0),
              y: Math.round(currentPanel.y || 0),
              width: Math.round(currentPanel.width || DEFAULT_LAPTOP_PANEL_POSITION.width || 0),
              height: Math.round(currentPanel.height || DEFAULT_LAPTOP_PANEL_POSITION.height || 0),
              rotation: Number((currentPanel.rotation || 0).toFixed(1)),
              z: Number(currentPanel.z ?? sharedPanel.z ?? DEFAULT_LAPTOP_PANEL_POSITION.z ?? 26)
            }
          },
          widgets: sceneWidgets.map((item) => ({
            id: item.id,
            kind: item.kind,
            text: item.text,
            action: item.action,
            tone: item.tone,
            src: item.src,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            rotation: item.rotation,
            fontSize: item.fontSize,
            z: item.z
          })),
          trayGuideText
        };
        const resp = await fetch("/api/commercial/scene-template", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            standard: standardPayload,
            positions: standardPayload.positions,
            widgets: standardPayload.widgets,
            trayGuideText: standardPayload.trayGuideText
          })
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok) throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u043E\u0443\u0442\u0431\u0443\u043A \u043D\u0430 \u0441\u0446\u0435\u043D\u0435");
        const parsedStandard = pickSceneStandard(json?.standard || json || {});
        setSharedDeskPositions(parsedStandard.positions || {});
        setSharedSceneWidgets(parsedStandard.widgets || []);
        setSharedTrayGuideText(parsedStandard.trayGuideText || "");
      } catch (err) {
        console.error(err);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [canEditScene, laptopPanelPosition.height, laptopPanelPosition.rotation, laptopPanelPosition.width, laptopPanelPosition.x, laptopPanelPosition.y, laptopPosition.height, laptopPosition.rotation, laptopPosition.width, laptopPosition.x, laptopPosition.y, sceneWidgets, session?.access_token, sharedDeskPositions, sharedSceneReady, trayGuideText]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady) return;
    const key = getSceneWidgetsStorageKey(workspace.workspace.workspace_id, desktopVariant);
    let saved = [];
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) saved = JSON.parse(raw);
        if (!raw && desktopVariant === "scheme") {
          const legacyRaw = window.localStorage.getItem(getSceneWidgetsStorageKey(workspace.workspace.workspace_id));
          if (legacyRaw) saved = JSON.parse(legacyRaw);
        }
      } catch {
        saved = [];
      }
    }
    const allowedIds = new Set(defaultSceneWidgets.map((item) => item.id));
    const defaultsById = new Map(defaultSceneWidgets.map((item) => [item.id, item]));
    let sourceWidgets = [];
    if (desktopVariant === "classic") {
      sourceWidgets = saved.length ? saved : defaultSceneWidgets;
    } else {
      const legacyWidgetIds = /* @__PURE__ */ new Set([
        "wallet-title",
        "wallet-value",
        "wallet-note",
        "profile-title",
        "profile-name",
        "profile-role",
        "profile-email",
        "create-folder"
      ]);
      const hasLegacyBoardLayout = saved.some((item) => legacyWidgetIds.has(item.id));
      const hasMarkerScheme = saved.some((item) => item.id === "board-scheme") || sharedSceneWidgets.some((item) => item.id === "board-scheme");
      const needsMarkerSceneUpgrade = !hasLegacyBoardLayout && !hasMarkerScheme;
      sourceWidgets = hasLegacyBoardLayout || needsMarkerSceneUpgrade ? sharedSceneWidgets.some((item) => item.id === "board-scheme") ? sharedSceneWidgets : defaultSceneWidgets : saved.length ? saved : sharedSceneWidgets.length ? sharedSceneWidgets : defaultSceneWidgets;
    }
    const normalizedWidgets = sourceWidgets.filter((item) => allowedIds.has(item.id)).map((item) => {
      const defaults = defaultsById.get(item.id);
      if (!defaults) return item;
      return {
        ...item,
        text: defaults.text,
        action: defaults.action,
        kind: defaults.kind,
        tone: defaults.tone,
        src: item.src || defaults.src
      };
    });
    for (const defaults of defaultSceneWidgets) {
      if (!normalizedWidgets.some((item) => item.id === defaults.id)) normalizedWidgets.push({ ...defaults });
    }
    normalizedWidgets.sort((a, b) => a.z - b.z);
    setSceneWidgets(normalizedWidgets.length ? normalizedWidgets : defaultSceneWidgets);
  }, [defaultSceneWidgets, desktopVariant, sharedSceneReady, sharedSceneWidgets, workspace?.workspace?.workspace_id]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady || typeof window === "undefined" || !sceneWidgets.length) return;
    window.localStorage.setItem(getSceneWidgetsStorageKey(workspace.workspace.workspace_id, desktopVariant), JSON.stringify(sceneWidgets));
  }, [desktopVariant, sceneWidgets, sharedSceneReady, workspace?.workspace?.workspace_id]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getTrayGuideTextStorageKey(workspace.workspace.workspace_id));
      if (raw && raw.trim()) setTrayGuideText(raw);
      else if (sharedTrayGuideText) setTrayGuideText(sharedTrayGuideText);
      else setTrayGuideText("\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u043F\u0430\u043F\u043A\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432");
    } catch {
      setTrayGuideText(sharedTrayGuideText || "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u043F\u0430\u043F\u043A\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432");
    }
  }, [sharedSceneReady, sharedTrayGuideText, workspace?.workspace?.workspace_id]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady || typeof window === "undefined") return;
    window.localStorage.setItem(getTrayGuideTextStorageKey(workspace.workspace.workspace_id), trayGuideText);
  }, [sharedSceneReady, trayGuideText, workspace?.workspace?.workspace_id]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getTrashStorageKey(workspace.workspace.workspace_id));
      const parsed = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      setTrashEntries(parsed.filter((item) => item.expiresAt > now));
    } catch {
      setTrashEntries([]);
    }
  }, [workspace?.workspace?.workspace_id]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    window.localStorage.setItem(getTrashStorageKey(workspace.workspace.workspace_id), JSON.stringify(trashEntries));
  }, [trashEntries, workspace?.workspace?.workspace_id]);
  const selectedWidget = (0, import_react5.useMemo)(() => sceneWidgets.find((item) => item.id === selectedWidgetId) || null, [sceneWidgets, selectedWidgetId]);
  const updateSceneWidget = (0, import_react5.useCallback)((id, patch) => {
    setSceneWidgets((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  }, []);
  const updateDeskItem = (0, import_react5.useCallback)((id, patch) => {
    setDeskPositions((prev) => {
      const current = {
        ...prev[id] || { x: 48, y: 48, z: deskLayer + 1 },
        ...patch
      };
      if (id.startsWith("project:")) {
        const itemWidth = current.width || DESK_SHEET_WIDTH;
        const itemHeight = current.height || DESK_SHEET_HEIGHT;
        const minX = -itemWidth * 0.5;
        const minY = -itemHeight * 0.5;
        const maxX = DESK_WIDTH - itemWidth * 0.5;
        const maxY = DESK_HEIGHT - itemHeight * 0.5;
        const panelPosition = prev[LAPTOP_PANEL_ID] || DEFAULT_LAPTOP_PANEL_POSITION;
        const blockedRect = getDeskRect(
          panelPosition,
          panelPosition.width || DEFAULT_LAPTOP_PANEL_POSITION.width || 226,
          panelPosition.height || DEFAULT_LAPTOP_PANEL_POSITION.height || 132,
          6
        );
        const nextRect = { left: current.x ?? 0, top: current.y ?? 0, right: (current.x ?? 0) + itemWidth, bottom: (current.y ?? 0) + itemHeight };
        const safe = keepRectOutOfBlockedZone(nextRect, blockedRect, { minX, minY, maxX, maxY });
        current.x = safe.x;
        current.y = safe.y;
      }
      return {
        ...prev,
        [id]: current
      };
    });
  }, [deskLayer]);
  const showTemplateFeedback = (0, import_react5.useCallback)((kind, text) => {
    setTemplateFeedback({ kind, text });
    if (typeof window !== "undefined") {
      if (templateFeedbackTimerRef.current) window.clearTimeout(templateFeedbackTimerRef.current);
      templateFeedbackTimerRef.current = window.setTimeout(() => setTemplateFeedback(null), 2200);
    }
  }, []);
  (0, import_react5.useEffect)(() => () => {
    if (typeof window !== "undefined" && templateFeedbackTimerRef.current) {
      window.clearTimeout(templateFeedbackTimerRef.current);
    }
  }, []);
  const saveDeskItemAsTemplate = (0, import_react5.useCallback)(async (itemId, kind) => {
    const source = deskPositions[itemId];
    if (!source) {
      showTemplateFeedback("error", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0439\u0442\u0438 \u043E\u0431\u044A\u0435\u043A\u0442 \u0434\u043B\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u0430");
      return;
    }
    const templateId = kind === "folder" ? FOLDER_TEMPLATE_ID : PROJECT_TEMPLATE_ID;
    const templatePatch = {
      x: deskPositions[templateId]?.x ?? source.x ?? 0,
      y: deskPositions[templateId]?.y ?? source.y ?? 0,
      z: deskPositions[templateId]?.z ?? source.z ?? 0,
      ...source.width !== void 0 ? { width: source.width } : {},
      ...source.height !== void 0 ? { height: source.height } : {},
      ...source.rotation !== void 0 ? { rotation: source.rotation } : {},
      ...source.tiltX !== void 0 ? { tiltX: source.tiltX } : {},
      ...source.tiltY !== void 0 ? { tiltY: source.tiltY } : {},
      ...source.clipTlx !== void 0 ? { clipTlx: source.clipTlx } : {},
      ...source.clipTly !== void 0 ? { clipTly: source.clipTly } : {},
      ...source.clipTrx !== void 0 ? { clipTrx: source.clipTrx } : {},
      ...source.clipTry !== void 0 ? { clipTry: source.clipTry } : {},
      ...source.clipBrx !== void 0 ? { clipBrx: source.clipBrx } : {},
      ...source.clipBry !== void 0 ? { clipBry: source.clipBry } : {},
      ...source.clipBlx !== void 0 ? { clipBlx: source.clipBlx } : {},
      ...source.clipBly !== void 0 ? { clipBly: source.clipBly } : {}
    };
    const nextDeskPositions = {
      ...deskPositions,
      [templateId]: {
        ...deskPositions[templateId] || {},
        ...templatePatch
      }
    };
    setDeskPositions(nextDeskPositions);
    writeGlobalDeskTemplates(nextDeskPositions);
    if (!session?.access_token || !isAdmin) {
      showTemplateFeedback("success", `\u0428\u0430\u0431\u043B\u043E\u043D ${kind === "folder" ? "\u043F\u0430\u043F\u043E\u043A" : "\u043B\u0438\u0441\u0442\u043E\u0432"} \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E`);
      return;
    }
    const standardPayload = {
      positions: {
        ...pickTemplatePositions(nextDeskPositions),
        ...nextDeskPositions[TRAY_GUIDE_ID] ? { [TRAY_GUIDE_ID]: nextDeskPositions[TRAY_GUIDE_ID] } : {},
        ...nextDeskPositions[TRASH_GUIDE_ID] ? { [TRASH_GUIDE_ID]: nextDeskPositions[TRASH_GUIDE_ID] } : {}
      },
      widgets: sceneWidgets.map((item) => ({
        id: item.id,
        kind: item.kind,
        text: item.text,
        action: item.action,
        tone: item.tone,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        rotation: item.rotation,
        fontSize: item.fontSize,
        z: item.z
      })),
      trayGuideText
    };
    try {
      const resp = await fetch("/api/commercial/scene-template", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          standard: standardPayload,
          positions: standardPayload.positions,
          widgets: standardPayload.widgets,
          trayGuideText: standardPayload.trayGuideText,
          templates: pickTemplatePositions(nextDeskPositions)
        })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043E\u0431\u0449\u0438\u0439 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442");
      }
      const parsedStandard = pickSceneStandard(json?.standard || json || {});
      const sharedPositions = parsedStandard.positions || {};
      const sharedWidgets = parsedStandard.widgets || [];
      setSharedDeskPositions(sharedPositions);
      setSharedSceneWidgets(sharedWidgets);
      setSharedTrayGuideText(parsedStandard.trayGuideText || "");
      writeGlobalDeskTemplates(sharedPositions);
      showTemplateFeedback("success", `\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043E\u0431\u0449\u0438\u0439 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442 \u0441\u0446\u0435\u043D\u044B: ${kind === "folder" ? "\u043F\u0430\u043F\u043A\u0438" : "\u043B\u0438\u0441\u0442\u044B"}, \u0441\u0442\u043E\u0439\u043A\u0430 \u0438 \u043A\u043D\u043E\u043F\u043A\u0438`);
    } catch (e) {
      showTemplateFeedback("error", e?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043E\u0431\u0449\u0438\u0439 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442");
    }
  }, [deskPositions, isAdmin, sceneWidgets, session?.access_token, showTemplateFeedback, trayGuideText]);
  const applyDeskTemplateToExistingItems = (0, import_react5.useCallback)((kind) => {
    const templateId = kind === "folder" ? FOLDER_TEMPLATE_ID : PROJECT_TEMPLATE_ID;
    const template = deskPositions[templateId];
    if (!template) {
      showTemplateFeedback("error", `\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0448\u0430\u0431\u043B\u043E\u043D \u0434\u043B\u044F ${kind === "folder" ? "\u043F\u0430\u043F\u043E\u043A" : "\u043B\u0438\u0441\u0442\u043E\u0432"}`);
      return;
    }
    const prefix = kind === "folder" ? "folder:" : "project:";
    const targetIds = Object.keys(deskPositions).filter((key) => key.startsWith(prefix));
    if (!targetIds.length) {
      showTemplateFeedback("error", `\u041D\u0435\u0442 \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432 \u0434\u043B\u044F \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0448\u0430\u0431\u043B\u043E\u043D\u0430`);
      return;
    }
    setDeskPositions((prev) => {
      const next = { ...prev };
      targetIds.forEach((key) => {
        next[key] = {
          ...prev[key],
          ...template.width !== void 0 ? { width: template.width } : {},
          ...template.height !== void 0 ? { height: template.height } : {},
          ...template.rotation !== void 0 ? { rotation: template.rotation } : {},
          ...template.tiltX !== void 0 ? { tiltX: template.tiltX } : {},
          ...template.tiltY !== void 0 ? { tiltY: template.tiltY } : {},
          ...template.clipTlx !== void 0 ? { clipTlx: template.clipTlx } : {},
          ...template.clipTly !== void 0 ? { clipTly: template.clipTly } : {},
          ...template.clipTrx !== void 0 ? { clipTrx: template.clipTrx } : {},
          ...template.clipTry !== void 0 ? { clipTry: template.clipTry } : {},
          ...template.clipBrx !== void 0 ? { clipBrx: template.clipBrx } : {},
          ...template.clipBry !== void 0 ? { clipBry: template.clipBry } : {},
          ...template.clipBlx !== void 0 ? { clipBlx: template.clipBlx } : {},
          ...template.clipBly !== void 0 ? { clipBly: template.clipBly } : {}
        };
      });
      return next;
    });
    showTemplateFeedback("success", `\u0428\u0430\u0431\u043B\u043E\u043D \u043F\u0440\u0438\u043C\u0435\u043D\u0451\u043D: ${targetIds.length} ${kind === "folder" ? "\u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432-\u043F\u0430\u043F\u043E\u043A" : "\u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432-\u043B\u0438\u0441\u0442\u043E\u0432"}`);
  }, [deskPositions, showTemplateFeedback]);
  const moveToTrash = (0, import_react5.useCallback)((kind, id, title) => {
    const now = Date.now();
    setTrashEntries((prev) => {
      const next = prev.filter((item) => !(item.kind === kind && item.id === id));
      next.unshift({ kind, id, title, deletedAt: now, expiresAt: now + TRASH_RETENTION_MS });
      return next;
    });
    setActiveFolderId((current) => kind === "folder" && current === id ? null : current);
    setPreviewProject((current) => kind === "project" && current?.id === id ? null : current);
  }, []);
  const restoreTrashEntry = (0, import_react5.useCallback)((entry) => {
    setTrashEntries((prev) => prev.filter((item) => !(item.kind === entry.kind && item.id === entry.id)));
  }, []);
  const handleSceneWidgetAction = (0, import_react5.useCallback)(
    (action) => {
      if (action === "createProject") {
        router.push("/projects/new");
        return;
      }
      if (action === "openCatalog") {
        router.push("/assessments");
        return;
      }
      if (action === "createFolder") {
        promptAndCreateFolder();
        return;
      }
    },
    [router, session, newFolderIcon, loadDashboard]
  );
  const startWidgetInteraction = (0, import_react5.useCallback)(
    (e, widget, mode) => {
      if (!sceneEditMode || !canEditScene) return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedWidgetId(widget.id);
      widgetInteractionRef.current = { id: widget.id, mode, startX: e.clientX, startY: e.clientY, widget: { ...widget } };
    },
    [canEditScene, sceneEditMode]
  );
  (0, import_react5.useEffect)(() => {
    if (!sceneEditMode) return;
    const handleMove = (e) => {
      const current = widgetInteractionRef.current;
      if (!current) return;
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      if (current.mode === "drag") {
        updateSceneWidget(current.id, {
          x: clampDesk(current.widget.x + dx, 40, DESK_WIDTH - current.widget.width - 40),
          y: clampDesk(current.widget.y + dy, 40, DESK_HEIGHT - current.widget.height - 40)
        });
        return;
      }
      if (current.mode === "resize") {
        const isImageWidget = current.widget.kind === "image";
        updateSceneWidget(current.id, {
          width: clampDesk(current.widget.width + dx, isImageWidget ? 280 : 110, isImageWidget ? DESK_WIDTH - 20 : 520),
          height: clampDesk(current.widget.height + dy, isImageWidget ? 180 : 30, isImageWidget ? DESK_HEIGHT - 10 : 180)
        });
        return;
      }
      updateSceneWidget(current.id, { rotation: current.widget.rotation + dx * 0.18 });
    };
    const handleUp = () => {
      widgetInteractionRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [sceneEditMode, updateSceneWidget]);
  const startDeskItemInteraction = (0, import_react5.useCallback)((e, itemId, kind, mode, position) => {
    if (!sceneEditMode || !canEditScene) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedDeskItemId(itemId);
    deskInteractionRef.current = { id: itemId, kind, mode, startX: e.clientX, startY: e.clientY, position: { ...position } };
  }, [canEditScene, sceneEditMode]);
  (0, import_react5.useEffect)(() => {
    if (!sceneEditMode) return;
    const handleMove = (e) => {
      const currentSwitch = roomSwitchInteractionRef.current;
      if (currentSwitch) {
        const dx2 = e.clientX - currentSwitch.startX;
        const dy2 = e.clientY - currentSwitch.startY;
        if (!currentSwitch.moved && (Math.abs(dx2) > 4 || Math.abs(dy2) > 4)) currentSwitch.moved = true;
        setRoomSwitchPosition({
          x: clampDesk(currentSwitch.startLeft + dx2, 0, DESK_WIDTH - DEFAULT_ROOM_SWITCH_ZONE.width),
          y: clampDesk(currentSwitch.startTop + dy2, 0, DESK_HEIGHT - DEFAULT_ROOM_SWITCH_ZONE.height),
          width: DEFAULT_ROOM_SWITCH_ZONE.width,
          height: DEFAULT_ROOM_SWITCH_ZONE.height
        });
        return;
      }
      const current = deskInteractionRef.current;
      if (!current) return;
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      const isFolder = current.kind === "folder";
      const isGuide = current.kind === "guide";
      const isDevice = current.kind === "device";
      const isPanel = current.kind === "panel";
      const defaultWidth = isPanel ? current.position.width ?? DEFAULT_LAPTOP_PANEL_POSITION.width ?? 226 : isDevice ? current.position.width ?? DEFAULT_LAPTOP_POSITION.width ?? 372 : isGuide ? current.position.width ?? 228 : isFolder ? DESK_FOLDER_WIDTH : DESK_SHEET_WIDTH;
      const defaultHeight = isPanel ? current.position.height ?? DEFAULT_LAPTOP_PANEL_POSITION.height ?? 132 : isDevice ? current.position.height ?? DEFAULT_LAPTOP_POSITION.height ?? 248 : isGuide ? current.position.height ?? 104 : isFolder ? DESK_FOLDER_HEIGHT : DESK_SHEET_HEIGHT;
      const baseWidth = current.position.width ?? defaultWidth;
      const baseHeight = current.position.height ?? defaultHeight;
      if (current.mode === "drag") {
        const minX = current.kind === "project" ? -baseWidth * 0.5 : isDevice ? -baseWidth * 0.2 : 0;
        const minY = current.kind === "project" ? -baseHeight * 0.5 : isDevice ? -baseHeight * 0.12 : 0;
        const maxX = current.kind === "project" ? DESK_WIDTH - baseWidth * 0.5 : isDevice ? DESK_WIDTH - baseWidth * 0.8 : DESK_WIDTH - baseWidth;
        const maxY = current.kind === "project" ? DESK_HEIGHT - baseHeight * 0.5 : isDevice ? DESK_HEIGHT - baseHeight * 0.8 : DESK_HEIGHT - baseHeight;
        updateDeskItem(current.id, {
          x: clampDesk((current.position.x ?? 0) + dx, minX, maxX),
          y: clampDesk((current.position.y ?? 0) + dy, minY, maxY)
        });
        return;
      }
      if (current.mode === "resize") {
        updateDeskItem(current.id, {
          width: clampDesk(baseWidth + dx, isPanel ? 180 : isDevice ? 260 : isGuide ? 120 : isFolder ? 120 : 140, isPanel ? 420 : isDevice ? 560 : isGuide ? 420 : isFolder ? 280 : 320),
          height: clampDesk(baseHeight + dy, isPanel ? 110 : isDevice ? 160 : isGuide ? 48 : isFolder ? 100 : 110, isPanel ? 260 : isDevice ? 360 : isGuide ? 220 : isFolder ? 260 : 320)
        });
        return;
      }
      updateDeskItem(current.id, { rotation: (current.position.rotation ?? 0) + dx * 0.18 });
    };
    const handleUp = () => {
      if (roomSwitchInteractionRef.current?.moved) suppressRoomSwitchClickRef.current = true;
      roomSwitchInteractionRef.current = null;
      deskInteractionRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [sceneEditMode, updateDeskItem]);
  const trashedProjectIds = (0, import_react5.useMemo)(() => new Set(trashEntries.filter((item) => item.kind === "project").map((item) => item.id)), [trashEntries]);
  const trashedFolderIds = (0, import_react5.useMemo)(() => new Set(trashEntries.filter((item) => item.kind === "folder").map((item) => item.id)), [trashEntries]);
  const projects = (0, import_react5.useMemo)(() => (workspace?.projects || []).filter((item) => !trashedProjectIds.has(item.id)), [trashedProjectIds, workspace?.projects]);
  const folders = (0, import_react5.useMemo)(() => (workspace?.folders || []).filter((item) => !trashedFolderIds.has(item.id)), [trashedFolderIds, workspace?.folders]);
  const folderBuckets = (0, import_react5.useMemo)(() => {
    const buckets = /* @__PURE__ */ new Map();
    for (const folder of folders) buckets.set(folder.id, []);
    const uncategorized = [];
    for (const project of projects) {
      if (project.folder_id && buckets.has(project.folder_id)) {
        buckets.get(project.folder_id).push(project);
      } else {
        uncategorized.push(project);
      }
    }
    return {
      uncategorized: sortProjects(uncategorized),
      byFolder: folders.map((folder) => ({ folder, projects: sortProjects(buckets.get(folder.id) || []) }))
    };
  }, [folders, projects]);
  const resetSceneWidgets = (0, import_react5.useCallback)(() => {
    const workspaceId = workspace?.workspace?.workspace_id;
    if (workspaceId && typeof window !== "undefined") {
      window.localStorage.removeItem(getSceneWidgetsStorageKey(workspaceId, desktopVariant));
      window.localStorage.removeItem(getTrayGuideTextStorageKey(workspaceId));
      window.localStorage.removeItem(getDeskStorageKey(workspaceId, desktopVariant));
    }
    const allowedIds = new Set(defaultSceneWidgets.map((item) => item.id));
    const defaultsById = new Map(defaultSceneWidgets.map((item) => [item.id, item]));
    const baseWidgets = desktopVariant === "scheme" && sharedSceneWidgets.length ? sharedSceneWidgets : defaultSceneWidgets;
    const normalizedWidgets = baseWidgets.filter((item) => allowedIds.has(item.id)).map((item) => {
      const defaults = defaultsById.get(item.id);
      if (!defaults) return item;
      return {
        ...item,
        text: defaults.text,
        action: defaults.action,
        kind: defaults.kind,
        tone: defaults.tone
      };
    }).sort((a, b) => a.z - b.z);
    setSceneWidgets(normalizedWidgets.length ? normalizedWidgets : defaultSceneWidgets);
    setTrayGuideText(sharedTrayGuideText || "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u043F\u0430\u043F\u043A\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432");
    setDeskPositions(mergeDeskPositions(folders, folderBuckets.uncategorized, { ...sharedDeskPositions, ...readGlobalDeskTemplates() }));
    setSelectedWidgetId(null);
    setSelectedDeskItemId(null);
  }, [defaultSceneWidgets, desktopVariant, folderBuckets.uncategorized, folders, sharedDeskPositions, sharedSceneWidgets, sharedTrayGuideText, workspace?.workspace?.workspace_id]);
  const activeFolder = (0, import_react5.useMemo)(
    () => folderBuckets.byFolder.find((item) => item.folder.id === activeFolderId) || null,
    [activeFolderId, folderBuckets.byFolder]
  );
  const totalAttempts = (0, import_react5.useMemo)(
    () => projects.reduce((sum, item) => sum + (item.attempts_count || 0), 0),
    [projects]
  );
  const selectedDeskItem = (0, import_react5.useMemo)(() => {
    if (!selectedDeskItemId) return null;
    if (selectedDeskItemId === TRAY_GUIDE_ID) {
      return { kind: "guide", id: selectedDeskItemId, title: "\u0412\u0438\u0440\u0442\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u043E\u0439\u043A\u0430", position: deskPositions[selectedDeskItemId] || getDefaultTrayGuidePosition() };
    }
    if (selectedDeskItemId === TRASH_GUIDE_ID) {
      return { kind: "guide", id: selectedDeskItemId, title: "\u0412\u0438\u0440\u0442\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u0437\u043E\u043D\u0430 \u043A\u043E\u0440\u0437\u0438\u043D\u044B", position: deskPositions[selectedDeskItemId] || getDefaultTrashGuidePosition() };
    }
    if (selectedDeskItemId === LAPTOP_DEVICE_ID) {
      return { kind: "device", id: selectedDeskItemId, title: "\u041D\u043E\u0443\u0442\u0431\u0443\u043A \u043D\u0430 \u0441\u0442\u043E\u043B\u0435", position: deskPositions[selectedDeskItemId] || DEFAULT_LAPTOP_POSITION };
    }
    if (selectedDeskItemId === LAPTOP_PANEL_ID) {
      return { kind: "panel", id: selectedDeskItemId, title: "\u041F\u0430\u043D\u0435\u043B\u044C \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430", position: deskPositions[selectedDeskItemId] || DEFAULT_LAPTOP_PANEL_POSITION };
    }
    if (selectedDeskItemId.startsWith("folder:")) {
      const id = selectedDeskItemId.replace("folder:", "");
      const folder = folders.find((item) => item.id === id);
      if (!folder) return null;
      return { kind: "folder", id: selectedDeskItemId, title: folder.name, position: deskPositions[selectedDeskItemId] || { x: 0, y: 0, z: 0 } };
    }
    if (selectedDeskItemId.startsWith("project:")) {
      const id = selectedDeskItemId.replace("project:", "");
      const project = projects.find((item) => item.id === id);
      if (!project) return null;
      return { kind: "project", id: selectedDeskItemId, title: project.title || project.person?.full_name || "\u041F\u0440\u043E\u0435\u043A\u0442", position: deskPositions[selectedDeskItemId] || { x: 0, y: 0, z: 0 } };
    }
    return null;
  }, [deskPositions, folders, projects, selectedDeskItemId]);
  (0, import_react5.useEffect)(() => {
    if (!activeFolderId) return;
    const stillExists = folderBuckets.byFolder.some((item) => item.folder.id === activeFolderId);
    if (!stillExists) setActiveFolderId(null);
  }, [activeFolderId, folderBuckets.byFolder]);
  (0, import_react5.useEffect)(() => {
    if (!previewProject) return;
    const stillExists = projects.some((item) => item.id === previewProject.id);
    if (!stillExists) setPreviewProject(null);
  }, [previewProject, projects]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady) return;
    const saved = typeof window !== "undefined" ? (() => {
      try {
        const raw = window.localStorage.getItem(getDeskStorageKey(workspace.workspace.workspace_id, desktopVariant));
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })() : {};
    const globalTemplates = readGlobalDeskTemplates();
    setDeskPositions((current) => {
      const merged = mergeDeskPositions(folders, folderBuckets.uncategorized, { ...sharedDeskPositions, ...globalTemplates, ...saved, ...current });
      setDeskLayer(Object.values(merged).reduce((max, item) => Math.max(max, item.z || 0), 300));
      return merged;
    });
  }, [desktopVariant, workspace?.workspace?.workspace_id, folders, folderBuckets.uncategorized, sharedDeskPositions]);
  (0, import_react5.useEffect)(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady || typeof window === "undefined") return;
    window.localStorage.setItem(getDeskStorageKey(workspace.workspace.workspace_id, desktopVariant), JSON.stringify(deskPositions));
  }, [deskPositions, desktopVariant, sharedSceneReady, workspace?.workspace?.workspace_id]);
  function getNextFolderSpawnPosition(folderId) {
    const guideRect = getGuideClipRect(deskPositions[TRAY_GUIDE_ID]);
    const template = deskPositions[FOLDER_TEMPLATE_ID] || {};
    const folderCountInTray = folders.filter((folder) => {
      const position = deskPositions[`folder:${folder.id}`];
      if (!position) return true;
      const centerX = (position.x || 0) + (position.width || DESK_FOLDER_WIDTH) / 2;
      const centerY = (position.y || 0) + (position.height || DESK_FOLDER_HEIGHT) / 2;
      return centerX >= guideRect.x && centerX <= guideRect.x + guideRect.width && centerY >= guideRect.y && centerY <= guideRect.y + guideRect.height;
    }).length;
    return {
      x: guideRect.x + 8 + folderCountInTray * 12,
      y: guideRect.y + 6 + folderCountInTray * 7,
      z: deskLayer + folderCountInTray + 1,
      width: template.width,
      height: template.height,
      rotation: template.rotation,
      tiltX: template.tiltX,
      tiltY: template.tiltY,
      clipTlx: template.clipTlx,
      clipTly: template.clipTly,
      clipTrx: template.clipTrx,
      clipTry: template.clipTry,
      clipBrx: template.clipBrx,
      clipBry: template.clipBry,
      clipBlx: template.clipBlx,
      clipBly: template.clipBly
    };
  }
  (0, import_react5.useEffect)(() => {
    const pending = pendingCreatedFolderRef.current;
    if (!pending) return;
    const folderExists = folders.some((item) => item.id === pending.id);
    if (!folderExists) return;
    const nextPosition = getNextFolderSpawnPosition(pending.id);
    setDeskPositions((prev) => ({
      ...prev,
      [`folder:${pending.id}`]: {
        ...prev[`folder:${pending.id}`] || {},
        ...nextPosition
      }
    }));
    pendingCreatedFolderRef.current = null;
  }, [deskLayer, deskPositions, folders]);
  const bringDeskItemToFront = (0, import_react5.useCallback)((itemId) => {
    setDeskLayer((current) => {
      const next = current + 1;
      setDeskPositions((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId] || { x: 48, y: 48, z: next },
          z: next
        }
      }));
      return next;
    });
  }, []);
  const isInsideGuideRect = (0, import_react5.useCallback)((x, y) => {
    const rect = getGuideClipRect(deskPositions[TRAY_GUIDE_ID]);
    const centerX = x + 48;
    const centerY = y + 48;
    return centerX >= rect.x && centerX <= rect.x + rect.width && centerY >= rect.y && centerY <= rect.y + rect.height;
  }, [deskPositions]);
  const trashGuideRect = (0, import_react5.useMemo)(() => getGuideClipRect(deskPositions[TRASH_GUIDE_ID]), [deskPositions]);
  const placeDeskItem = (0, import_react5.useCallback)((itemId, kind, x, y) => {
    const current = deskPositions[itemId] || {};
    const itemWidth = current.width || (kind === "folder" ? DESK_FOLDER_WIDTH : DESK_SHEET_WIDTH);
    const itemHeight = current.height || (kind === "folder" ? DESK_FOLDER_HEIGHT : DESK_SHEET_HEIGHT);
    const minX = kind === "project" ? -itemWidth * 0.5 : 24;
    const minY = kind === "project" ? -itemHeight * 0.5 : 24;
    const maxX = kind === "project" ? DESK_WIDTH - itemWidth * 0.5 : DESK_WIDTH - itemWidth - 24;
    const maxY = kind === "project" ? DESK_HEIGHT - itemHeight * 0.5 : DESK_HEIGHT - itemHeight - 24;
    let nextX = clampDesk(x, minX, maxX);
    let nextY = clampDesk(y, minY, maxY);
    if (kind === "project") {
      const blockedRect = getDeskRect(
        laptopPanelPosition,
        laptopPanelPosition.width || DEFAULT_LAPTOP_PANEL_POSITION.width || 226,
        laptopPanelPosition.height || DEFAULT_LAPTOP_PANEL_POSITION.height || 132,
        6
      );
      const safe = keepRectOutOfBlockedZone({ left: nextX, top: nextY, right: nextX + itemWidth, bottom: nextY + itemHeight }, blockedRect, { minX, minY, maxX, maxY });
      nextX = safe.x;
      nextY = safe.y;
    }
    if (kind === "folder") {
      const folderId = itemId.replace("folder:", "");
      const folderIndex = Math.max(0, folders.findIndex((item) => item.id === folderId));
      const guideRect = getGuideClipRect(deskPositions[TRAY_GUIDE_ID]);
      const snapped = isInsideGuideRect(nextX, nextY) ? { x: guideRect.x + 8 + folderIndex * 12, y: guideRect.y + 6 + folderIndex * 7, z: 20 + folderIndex, width: current.width, height: current.height, rotation: current.rotation, tiltX: current.tiltX, tiltY: current.tiltY } : { x: nextX, y: nextY, z: 20 + folderIndex, width: current.width, height: current.height, rotation: current.rotation, tiltX: current.tiltX, tiltY: current.tiltY };
      setDeskPositions((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId] || { z: deskLayer + 1 },
          x: snapped.x,
          y: snapped.y,
          z: prev[itemId]?.z || deskLayer + 1,
          width: snapped.width,
          height: snapped.height,
          rotation: snapped.rotation
        }
      }));
      return;
    }
    setDeskPositions((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId] || { z: deskLayer + 1 },
        x: nextX,
        y: nextY,
        z: prev[itemId]?.z || deskLayer + 1,
        width: current.width,
        height: current.height,
        rotation: current.rotation
      }
    }));
  }, [deskLayer, deskPositions, folders, isInsideGuideRect, laptopPanelPosition]);
  const handleDeskDrop = (0, import_react5.useCallback)((e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const draggedProjectId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
    const draggedFolderId = e.dataTransfer.getData("text/folder-id") || "";
    if (draggedProjectId) {
      const wasInFolder = !folderBuckets.uncategorized.some((project) => project.id === draggedProjectId);
      const itemId = `project:${draggedProjectId}`;
      bringDeskItemToFront(itemId);
      placeDeskItem(itemId, "project", e.clientX - rect.left - DESK_SHEET_WIDTH / 2, e.clientY - rect.top - DESK_SHEET_HEIGHT / 2);
      if (wasInFolder) {
        moveProject(draggedProjectId, null);
      }
      setDraggingProjectId(null);
      clearTrashHover();
      return;
    }
    if (draggedFolderId) {
      const itemId = `folder:${draggedFolderId}`;
      bringDeskItemToFront(itemId);
      placeDeskItem(itemId, "folder", e.clientX - rect.left - DESK_FOLDER_WIDTH / 2, e.clientY - rect.top - DESK_FOLDER_HEIGHT / 2);
      setDraggingFolderId(null);
      clearTrashHover();
    }
  }, [bringDeskItemToFront, clearTrashHover, draggingProjectId, folderBuckets.uncategorized, moveProject, placeDeskItem]);
  async function createFolderNamed(nameValue, iconKey = newFolderIcon) {
    const name = nameValue.trim();
    if (!name || !session) return;
    setBusyFolderId("new");
    try {
      const resp = await fetch("/api/commercial/folders/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name, icon_key: iconKey })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0430\u043F\u043A\u0443");
      const newFolderId = String(json?.folder?.id || "");
      if (newFolderId) {
        pendingCreatedFolderRef.current = { id: newFolderId };
        const nextPosition = getNextFolderSpawnPosition(newFolderId);
        setDeskPositions((prev) => ({
          ...prev,
          [`folder:${newFolderId}`]: nextPosition
        }));
      }
      setNewFolderName("");
      setNewFolderIcon("folder");
      await loadDashboard();
    } catch (e) {
      setError(e?.message || "\u041E\u0448\u0438\u0431\u043A\u0430");
    } finally {
      setBusyFolderId(null);
    }
  }
  function promptAndCreateFolder() {
    const name = typeof window !== "undefined" ? window.prompt("\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043D\u043E\u0432\u043E\u0439 \u043F\u0430\u043F\u043A\u0438", "\u041D\u043E\u0432\u0430\u044F \u043F\u0430\u043F\u043A\u0430") : null;
    if (name && name.trim()) void createFolderNamed(name.trim(), "folder");
  }
  async function createFolder() {
    return createFolderNamed(newFolderName, newFolderIcon);
  }
  function openRenameFolder(folder) {
    setFolderActionTarget(null);
    setFolderRenameTarget(folder);
    setFolderRenameValue(folder.name);
  }
  async function saveRenameFolder() {
    if (!session || !folderRenameTarget) return;
    const name = folderRenameValue.trim();
    if (!name || name === folderRenameTarget.name) {
      setFolderRenameTarget(null);
      return;
    }
    setBusyFolderId(folderRenameTarget.id);
    try {
      const resp = await fetch("/api/commercial/folders/update", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: folderRenameTarget.id, name })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C \u043F\u0430\u043F\u043A\u0443");
      setFolderRenameTarget(null);
      setFolderRenameValue("");
      await loadDashboard();
    } catch (e) {
      setError(e?.message || "\u041E\u0448\u0438\u0431\u043A\u0430");
    } finally {
      setBusyFolderId(null);
    }
  }
  async function updateFolderIcon(folder, iconKey) {
    if (!session) return;
    setBusyFolderId(folder.id);
    try {
      const resp = await fetch("/api/commercial/folders/update", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: folder.id, icon_key: iconKey })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0438\u043A\u043E\u043D\u043A\u0443");
      setIconPickerFolder(null);
      setFolderActionTarget(null);
      await loadDashboard();
    } catch (e) {
      setError(e?.message || "\u041E\u0448\u0438\u0431\u043A\u0430");
    } finally {
      setBusyFolderId(null);
    }
  }
  function openDeleteFolder(folder) {
    setFolderActionTarget(null);
    setFolderDeleteTarget(folder);
  }
  async function confirmDeleteFolder() {
    if (!session || !folderDeleteTarget) return;
    const folder = folderDeleteTarget;
    setBusyFolderId(folder.id);
    try {
      const resp = await fetch("/api/commercial/folders/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: folder.id })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0430\u043F\u043A\u0443");
      setFolderDeleteTarget(null);
      setActiveFolderId((current) => current === folder.id ? null : current);
      setIconPickerFolder((current) => current?.id === folder.id ? null : current);
      await loadDashboard();
    } catch (e) {
      setError(e?.message || "\u041E\u0448\u0438\u0431\u043A\u0430");
    } finally {
      setBusyFolderId(null);
    }
  }
  async function deleteFolderDirect(folderId) {
    if (!session) return;
    setBusyFolderId(folderId);
    try {
      const resp = await fetch("/api/commercial/folders/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: folderId })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0430\u043F\u043A\u0443");
      setFolderDeleteTarget(null);
      setActiveFolderId((current) => current === folderId ? null : current);
      setIconPickerFolder((current) => current?.id === folderId ? null : current);
      await loadDashboard();
    } catch (e) {
      setError(e?.message || "\u041E\u0448\u0438\u0431\u043A\u0430");
    } finally {
      setBusyFolderId(null);
    }
  }
  async function moveProject(projectId, folderId) {
    if (!session) return;
    setBusyFolderId(folderId || "desktop");
    try {
      const resp = await fetch("/api/commercial/folders/move-project", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ project_id: projectId, folder_id: folderId })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442");
      await loadDashboard();
    } catch (e) {
      setError(e?.message || "\u041E\u0448\u0438\u0431\u043A\u0430");
    } finally {
      setDraggingProjectId(null);
      setBusyFolderId(null);
    }
  }
  async function deleteProject(projectId, skipConfirm = false) {
    if (!session) return;
    if (!skipConfirm && !window.confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442? \u042D\u0442\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0443\u0431\u0435\u0440\u0451\u0442 \u043F\u0440\u043E\u0435\u043A\u0442, \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043F\u043E \u043D\u0435\u043C\u0443.")) return;
    setBusyFolderId(`delete:${projectId}`);
    try {
      const resp = await fetch("/api/commercial/projects/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ project_id: projectId })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442");
      await loadDashboard();
    } catch (e) {
      setError(e?.message || "\u041E\u0448\u0438\u0431\u043A\u0430");
    } finally {
      setBusyFolderId(null);
    }
  }
  function clearTrashHover() {
    if (trashHoverTimer.current) {
      window.clearTimeout(trashHoverTimer.current);
      trashHoverTimer.current = null;
    }
    setTrashHover(null);
  }
  const beginTrashHover = (0, import_react5.useCallback)((kind, id) => {
    setTrashHover((current) => {
      if (current?.kind === kind && current?.id === id) return current;
      return { kind, id };
    });
    if (trashHoverTimer.current) window.clearTimeout(trashHoverTimer.current);
    trashHoverTimer.current = window.setTimeout(() => {
      if (kind === "project") {
        const project = (workspace?.projects || []).find((item) => item.id === id);
        moveToTrash("project", id, project?.title || project?.person?.full_name || "\u041F\u0440\u043E\u0435\u043A\u0442");
      } else {
        const folder = (workspace?.folders || []).find((item) => item.id === id);
        moveToTrash("folder", id, folder?.name || "\u041F\u0430\u043F\u043A\u0430");
      }
      setDraggingProjectId(null);
      setDraggingFolderId(null);
      setTrashHover(null);
      trashHoverTimer.current = null;
    }, 650);
  }, [moveToTrash, workspace?.folders, workspace?.projects]);
  (0, import_react5.useEffect)(() => () => {
    if (trashHoverTimer.current) window.clearTimeout(trashHoverTimer.current);
  }, []);
  (0, import_react5.useEffect)(() => {
    const now = Date.now();
    const expired = trashEntries.filter((item) => item.expiresAt <= now);
    if (!expired.length) return;
    setTrashEntries((prev) => prev.filter((item) => item.expiresAt > now));
    expired.forEach((entry) => {
      if (entry.kind === "project") void deleteProject(entry.id, true);
      else void deleteFolderDirect(entry.id);
    });
  }, [trashEntries]);
  if (!session || !user) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Layout, { title: "\u041A\u0430\u0431\u0438\u043D\u0435\u0442", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "card text-sm text-slate-700", children: "\u041F\u0435\u0440\u0435\u0430\u0434\u0440\u0435\u0441\u0430\u0446\u0438\u044F \u043D\u0430 \u0432\u0445\u043E\u0434\u2026" }) });
  }
  const trayFolders = folderBuckets.byFolder.filter(({ folder }, index) => {
    const pos = deskPositions[`folder:${folder.id}`] || getDefaultFolderPosition(index);
    return isInsideGuideRect(pos.x, pos.y);
  });
  const looseFolders = folderBuckets.byFolder.filter(({ folder }, index) => {
    const pos = deskPositions[`folder:${folder.id}`] || getDefaultFolderPosition(index);
    return !isInsideGuideRect(pos.x, pos.y);
  });
  if (desktopVariant === "classic") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Layout, { title: "\u041A\u0430\u0431\u0438\u043D\u0435\u0442 \u0441\u043F\u0435\u0446\u0438\u0430\u043B\u0438\u0441\u0442\u0430", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-experience dashboard-experience-classic relative isolate -mx-3 overflow-hidden rounded-[36px] px-3 py-3 sm:-mx-4 sm:px-4 sm:py-4", children: [
      error ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mb-4 card dashboard-panel text-sm text-red-600", children: error }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mb-3 flex items-center justify-end rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_16px_30px_-26px_rgba(54,35,19,0.18)] backdrop-blur-xl", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "btn btn-secondary btn-sm", onClick: () => setDesktopVariant("scheme"), children: "\u0421\u0445\u0435\u043C\u0430 \u043D\u0430 \u0434\u043E\u0441\u043A\u0435" }) }),
      canEditScene && sceneEditMode && selectedDeskItem ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mb-3 rounded-[22px] border border-[#cdb799] bg-white/92 p-4 shadow-[0_18px_34px_-26px_rgba(54,35,19,0.2)]", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mb-3 text-sm font-semibold text-[#55361f]", children: [
          "\u041E\u0431\u044A\u0435\u043A\u0442 \xB7 ",
          selectedDeskItem.title
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "grid gap-3 md:grid-cols-7", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "X",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.x || 0), onChange: (e) => updateDeskItem(selectedDeskItem.id, { x: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "Y",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.y || 0), onChange: (e) => updateDeskItem(selectedDeskItem.id, { y: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "\u0428\u0438\u0440\u0438\u043D\u0430",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.width || (selectedDeskItem.kind === "folder" ? 96 : 92)), onChange: (e) => updateDeskItem(selectedDeskItem.id, { width: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "\u0412\u044B\u0441\u043E\u0442\u0430",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.height || (selectedDeskItem.kind === "folder" ? 96 : 104)), onChange: (e) => updateDeskItem(selectedDeskItem.id, { height: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "\u041F\u043E\u0432\u043E\u0440\u043E\u0442 Z",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", step: "0.1", value: Number((selectedDeskItem.position.rotation || 0).toFixed(1)), onChange: (e) => updateDeskItem(selectedDeskItem.id, { rotation: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "\u041F\u043E\u0432\u043E\u0440\u043E\u0442 X",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", step: "0.1", value: Number((selectedDeskItem.position.tiltX || 0).toFixed(1)), onChange: (e) => updateDeskItem(selectedDeskItem.id, { tiltX: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "\u041F\u043E\u0432\u043E\u0440\u043E\u0442 Y",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", step: "0.1", value: Number((selectedDeskItem.position.tiltY || 0).toFixed(1)), onChange: (e) => updateDeskItem(selectedDeskItem.id, { tiltY: Number(e.target.value || 0) }) })
          ] })
        ] })
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-classic-scene relative min-h-[920px] overflow-hidden rounded-[34px] border border-[#d4d9e4] bg-white shadow-[0_30px_70px_-44px_rgba(53,34,17,0.14)]", onClick: () => {
        setSelectedWidgetId(null);
        setSelectedDeskItemId(null);
      }, onDragOver: (e) => e.preventDefault(), onDrop: handleDeskDrop, children: [
        sceneEditControls,
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-classic-surface absolute inset-0" }),
        folderBuckets.byFolder.map(({ folder, projects: folderProjects }, folderIndex) => {
          const itemId = `folder:${folder.id}`;
          const position = deskPositions[itemId] || getClassicFolderPosition(folderIndex);
          const width = position.width || 104;
          const height = position.height || 108;
          const isSelected = selectedDeskItemId === itemId;
          return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "absolute", style: { left: position.x, top: position.y, zIndex: position.z, width: `${width}px`, height: `${height}px` }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            FolderDesktopIcon,
            {
              variant: "classic",
              folder,
              projects: folderProjects,
              busy: busyFolderId === folder.id,
              onOpen: () => setActiveFolderId(folder.id),
              onManage: () => setFolderActionTarget(folder),
              onDropProject: (projectId) => moveProject(projectId, folder.id),
              draggingProjectId,
              sceneEditMode,
              selected: isSelected,
              onSelect: () => {
                setSelectedDeskItemId(itemId);
                setSelectedWidgetId(null);
              },
              onResizeHandleMouseDown: (e) => startDeskItemInteraction(e, itemId, "folder", "resize", position),
              onRotateHandleMouseDown: (e) => startDeskItemInteraction(e, itemId, "folder", "rotate", position),
              onDragMoveStart: (e) => startDeskItemInteraction(e, itemId, "folder", "drag", position),
              onDragStart: () => {
                setDraggingFolderId(folder.id);
                bringDeskItemToFront(itemId);
              },
              onDragEnd: () => setDraggingFolderId(null)
            }
          ) }, folder.id);
        }),
        folderBuckets.uncategorized.map((project, projectIndex) => {
          const itemId = `project:${project.id}`;
          const position = deskPositions[itemId] || getClassicProjectPosition(projectIndex);
          const width = position.width || 96;
          const height = position.height || 112;
          const isSelected = selectedDeskItemId === itemId;
          return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "absolute", style: { left: position.x, top: position.y, zIndex: position.z, width: `${width}px`, height: `${height}px` }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            ProjectDesktopIcon,
            {
              variant: "classic",
              project,
              busy: busyFolderId === `delete:${project.id}`,
              sceneEditMode,
              selected: isSelected,
              onSelect: () => {
                setSelectedDeskItemId(itemId);
                setSelectedWidgetId(null);
              },
              onResizeHandleMouseDown: (e) => startDeskItemInteraction(e, itemId, "project", "resize", position),
              onRotateHandleMouseDown: (e) => startDeskItemInteraction(e, itemId, "project", "rotate", position),
              onDragMoveStart: (e) => startDeskItemInteraction(e, itemId, "project", "drag", position),
              onOpen: () => setPreviewProject(project),
              onDragStart: () => {
                setDraggingProjectId(project.id);
                bringDeskItemToFront(itemId);
              },
              onDragEnd: () => {
                setDraggingProjectId(null);
                clearTrashHover();
              },
              onDelete: () => deleteProject(project.id)
            }
          ) }, project.id);
        })
      ] }),
      activeFolder ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        FolderModal,
        {
          folder: activeFolder.folder,
          projects: activeFolder.projects,
          busy: busyFolderId === activeFolder.folder.id,
          onClose: () => setActiveFolderId(null),
          onManage: () => setFolderActionTarget(activeFolder.folder),
          onOpenProject: (projectId) => {
            const project = activeFolder.projects.find((item) => item.id === projectId);
            if (project) setPreviewProject(project);
          },
          onMoveToDesktop: (projectId) => moveProject(projectId, null),
          onDeleteProject: deleteProject
        }
      ) : null,
      previewProject ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        ProjectSheetPreviewModal,
        {
          project: previewProject,
          onClose: () => setPreviewProject(null),
          onOpenFull: () => router.push(`/projects/${previewProject.id}`)
        }
      ) : null
    ] }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Layout, { title: "\u041A\u0430\u0431\u0438\u043D\u0435\u0442 \u0441\u043F\u0435\u0446\u0438\u0430\u043B\u0438\u0441\u0442\u0430", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-experience relative isolate -mx-3 overflow-hidden rounded-[36px] px-3 py-3 sm:-mx-4 sm:px-4 sm:py-4", children: [
      error ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mb-4 card dashboard-panel text-sm text-red-600", children: error }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mb-3 flex items-center justify-end rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_16px_30px_-26px_rgba(54,35,19,0.18)] backdrop-blur-xl", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "button",
        {
          type: "button",
          className: "btn btn-secondary btn-sm",
          onClick: () => setDesktopVariant((prev) => prev === "scheme" ? "classic" : "scheme"),
          children: desktopVariant === "scheme" ? "\u0420\u0430\u0431\u043E\u0447\u0438\u0439 \u0441\u0442\u043E\u043B" : "\u0421\u0445\u0435\u043C\u0430 \u043D\u0430 \u0434\u043E\u0441\u043A\u0435"
        }
      ) }),
      canEditScene && sceneEditMode && selectedWidget ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mb-3 rounded-[22px] border border-[#cdb799] bg-white/92 p-4 shadow-[0_18px_34px_-26px_rgba(54,35,19,0.2)]", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mb-3 text-sm font-semibold text-[#55361f]", children: [
          "\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u0441\u0446\u0435\u043D\u044B \xB7 ",
          selectedWidget.id
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "grid gap-3 md:grid-cols-4", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "X",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedWidget.x), onChange: (e) => updateSceneWidget(selectedWidget.id, { x: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "Y",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedWidget.y), onChange: (e) => updateSceneWidget(selectedWidget.id, { y: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "\u0428\u0438\u0440\u0438\u043D\u0430",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedWidget.width), onChange: (e) => updateSceneWidget(selectedWidget.id, { width: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "\u0412\u044B\u0441\u043E\u0442\u0430",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedWidget.height), onChange: (e) => updateSceneWidget(selectedWidget.id, { height: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b] md:col-span-1", children: [
            "\u041F\u043E\u0432\u043E\u0440\u043E\u0442",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", step: "0.1", value: selectedWidget.rotation, onChange: (e) => updateSceneWidget(selectedWidget.id, { rotation: Number(e.target.value || 0) }) })
          ] }),
          selectedWidget.kind !== "image" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b] md:col-span-1", children: [
              "\u0428\u0440\u0438\u0444\u0442",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: selectedWidget.fontSize, onChange: (e) => updateSceneWidget(selectedWidget.id, { fontSize: Number(e.target.value || 0) }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b] md:col-span-2", children: [
              "\u0422\u0435\u043A\u0441\u0442",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "text", value: selectedWidget.text, onChange: (e) => updateSceneWidget(selectedWidget.id, { text: e.target.value }) })
            ] })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b] md:col-span-3", children: [
            "\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] bg-[#f8f3ea] px-3 py-2 text-sm text-[#7b5b3b]", type: "text", value: selectedWidget.src || "", readOnly: true })
          ] })
        ] })
      ] }) : null,
      canEditScene && sceneEditMode && selectedDeskItem ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mb-3 rounded-[22px] border border-[#cdb799] bg-white/92 p-4 shadow-[0_18px_34px_-26px_rgba(54,35,19,0.2)]", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mb-3 text-sm font-semibold text-[#55361f]", children: [
          "\u041E\u0431\u044A\u0435\u043A\u0442 \u043D\u0430 \u0441\u0442\u043E\u043B\u0435 \xB7 ",
          selectedDeskItem.title
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "grid gap-3 md:grid-cols-7", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "X",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.x || 0), onChange: (e) => updateDeskItem(selectedDeskItem.id, { x: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "Y",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.y || 0), onChange: (e) => updateDeskItem(selectedDeskItem.id, { y: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "\u0428\u0438\u0440\u0438\u043D\u0430",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.width || (selectedDeskItem.kind === "panel" ? DEFAULT_LAPTOP_PANEL_POSITION.width || 226 : selectedDeskItem.kind === "device" ? DEFAULT_LAPTOP_POSITION.width || 372 : selectedDeskItem.kind === "guide" ? 228 : selectedDeskItem.kind === "folder" ? DESK_FOLDER_WIDTH : DESK_SHEET_WIDTH)), onChange: (e) => updateDeskItem(selectedDeskItem.id, { width: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "\u0412\u044B\u0441\u043E\u0442\u0430",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.height || (selectedDeskItem.kind === "panel" ? DEFAULT_LAPTOP_PANEL_POSITION.height || 132 : selectedDeskItem.kind === "device" ? DEFAULT_LAPTOP_POSITION.height || 248 : selectedDeskItem.kind === "guide" ? 104 : selectedDeskItem.kind === "folder" ? DESK_FOLDER_HEIGHT : DESK_SHEET_HEIGHT)), onChange: (e) => updateDeskItem(selectedDeskItem.id, { height: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "\u041F\u043E\u0432\u043E\u0440\u043E\u0442 Z",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", step: "0.1", value: Number((selectedDeskItem.position.rotation || 0).toFixed(1)), onChange: (e) => updateDeskItem(selectedDeskItem.id, { rotation: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "\u041F\u043E\u0432\u043E\u0440\u043E\u0442 X",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", step: "0.1", value: Number((selectedDeskItem.position.tiltX || 0).toFixed(1)), onChange: (e) => updateDeskItem(selectedDeskItem.id, { tiltX: Number(e.target.value || 0) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
            "\u041F\u043E\u0432\u043E\u0440\u043E\u0442 Y",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", step: "0.1", value: Number((selectedDeskItem.position.tiltY || 0).toFixed(1)), onChange: (e) => updateDeskItem(selectedDeskItem.id, { tiltY: Number(e.target.value || 0) }) })
          ] }),
          selectedDeskItem.kind === "guide" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
            selectedDeskItem.id === TRAY_GUIDE_ID ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b] md:col-span-7", children: [
              "\u0422\u0435\u043A\u0441\u0442 \u043D\u0430 \u0441\u0442\u043E\u0439\u043A\u0435",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "text", value: trayGuideText, onChange: (e) => setTrayGuideText(e.target.value) })
            ] }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
              "TL X",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.clipTlx || 0), onChange: (e) => updateDeskItem(selectedDeskItem.id, { clipTlx: Number(e.target.value || 0) }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
              "TL Y",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.clipTly || 0), onChange: (e) => updateDeskItem(selectedDeskItem.id, { clipTly: Number(e.target.value || 0) }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
              "TR X",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.clipTrx || 0), onChange: (e) => updateDeskItem(selectedDeskItem.id, { clipTrx: Number(e.target.value || 0) }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
              "TR Y",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.clipTry || 0), onChange: (e) => updateDeskItem(selectedDeskItem.id, { clipTry: Number(e.target.value || 0) }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
              "BR X",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.clipBrx || 0), onChange: (e) => updateDeskItem(selectedDeskItem.id, { clipBrx: Number(e.target.value || 0) }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
              "BR Y",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.clipBry || 0), onChange: (e) => updateDeskItem(selectedDeskItem.id, { clipBry: Number(e.target.value || 0) }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
              "BL X",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.clipBlx || 0), onChange: (e) => updateDeskItem(selectedDeskItem.id, { clipBlx: Number(e.target.value || 0) }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "text-xs text-[#7b5b3b]", children: [
              "BL Y",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm", type: "number", value: Math.round(selectedDeskItem.position.clipBly || 0), onChange: (e) => updateDeskItem(selectedDeskItem.id, { clipBly: Number(e.target.value || 0) }) })
            ] })
          ] }) : null
        ] }),
        selectedDeskItem.kind === "folder" || selectedDeskItem.kind === "project" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mt-3 border-t border-[#ead9c2] pt-3", children: [
          templateFeedback ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              "aria-live": "polite",
              className: `mb-3 rounded-2xl border px-3 py-2 text-sm font-medium ${templateFeedback.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`,
              children: [
                templateFeedback.kind === "success" ? "\u2713 " : "\u26A0 ",
                templateFeedback.text
              ]
            }
          ) : null,
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex flex-wrap gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "button",
              {
                type: "button",
                className: "btn btn-secondary btn-sm",
                onClick: () => saveDeskItemAsTemplate(selectedDeskItem.id, selectedDeskItem.kind),
                children: [
                  isAdmin ? "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442 \u0434\u043B\u044F \u0432\u0441\u0435\u0445 " : "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0448\u0430\u0431\u043B\u043E\u043D \u0434\u043B\u044F \u0432\u0441\u0435\u0445 ",
                  selectedDeskItem.kind === "folder" ? "\u043F\u0430\u043F\u043E\u043A" : "\u043B\u0438\u0441\u0442\u043E\u0432"
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "button",
              {
                type: "button",
                className: "btn btn-primary btn-sm",
                onClick: () => applyDeskTemplateToExistingItems(selectedDeskItem.kind),
                children: [
                  "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442 \u043A\u043E \u0432\u0441\u0435\u043C ",
                  selectedDeskItem.kind === "folder" ? "\u043F\u0430\u043F\u043A\u0430\u043C" : "\u043B\u0438\u0441\u0442\u0430\u043C"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-2 text-xs text-[#8a6a47]", children: "\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442 \u0445\u0440\u0430\u043D\u0438\u0442\u0441\u044F \u043D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u0438 \u043F\u043E\u0434\u0445\u0432\u0430\u0442\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0443 \u043D\u043E\u0432\u044B\u0445 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u0439 \u0438 \u043D\u0430 \u0434\u0440\u0443\u0433\u0438\u0445 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430\u0445." })
        ] }) : null
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-office-scene relative min-h-[920px] overflow-hidden rounded-[34px] border border-[#4f3420]/10 bg-white shadow-[0_30px_70px_-44px_rgba(53,34,17,0.28)]", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-office-scene-backdrop absolute inset-0" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-office-scene-vignette absolute inset-0" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            "aria-hidden": "true",
            className: "pointer-events-none absolute inset-0 z-[160] transition-opacity duration-300",
            style: {
              opacity: isRoomLightDimmed ? 1 : 0,
              background: "radial-gradient(circle at 50% 14%, rgba(26, 23, 18, 0.2) 0%, rgba(10, 10, 14, 0.84) 56%, rgba(3, 4, 7, 0.94) 100%)"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "button",
          {
            type: "button",
            className: "absolute z-[182] flex items-start justify-start transition-[transform,opacity] duration-200",
            style: {
              left: `${roomSwitchPosition.x}px`,
              top: `${roomSwitchPosition.y}px`,
              width: `${roomSwitchPosition.width}px`,
              height: `${roomSwitchPosition.height}px`,
              cursor: sceneEditMode ? "grab" : "pointer",
              opacity: isRoomLightDimmed ? 0.9 : 0.98,
              transform: sceneEditMode ? "translateZ(0)" : "none"
            },
            onMouseDown: (e) => {
              if (!sceneEditMode || !canEditScene) return;
              e.preventDefault();
              e.stopPropagation();
              suppressRoomSwitchClickRef.current = false;
              setSelectedWidgetId(null);
              setSelectedDeskItemId(null);
              roomSwitchInteractionRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                startLeft: roomSwitchPosition.x,
                startTop: roomSwitchPosition.y,
                moved: false
              };
            },
            onClick: (e) => {
              e.stopPropagation();
              if (suppressRoomSwitchClickRef.current) {
                suppressRoomSwitchClickRef.current = false;
                return;
              }
              toggleRoomLight();
            },
            "aria-label": isRoomLightDimmed ? "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u0432\u0435\u0442" : "\u041F\u0440\u0438\u0433\u043B\u0443\u0448\u0438\u0442\u044C \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u0432\u0435\u0442",
            "aria-pressed": isRoomLightDimmed,
            title: sceneEditMode ? "\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438 \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044C \u0438\u043B\u0438 \u043A\u043B\u0438\u043A\u043D\u0438, \u0447\u0442\u043E\u0431\u044B \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0441\u0432\u0435\u0442" : isRoomLightDimmed ? "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u0432\u0435\u0442" : "\u041F\u0440\u0438\u0433\u043B\u0443\u0448\u0438\u0442\u044C \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u0432\u0435\u0442",
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "span",
              {
                className: "pointer-events-none relative block transition-all duration-300",
                style: {
                  width: "118px",
                  height: "78px",
                  filter: isRoomLightDimmed ? "brightness(0.58) saturate(0.84) contrast(0.96)" : "brightness(1) saturate(1.02) contrast(1)",
                  transform: isRoomLightDimmed ? "translateY(2px) scale(0.992)" : "translateY(0) scale(1)"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "img",
                    {
                      src: "/room-light-switch-office.png",
                      alt: "",
                      "aria-hidden": "true",
                      draggable: false,
                      className: "h-full w-full object-contain",
                      style: {
                        filter: isRoomLightDimmed ? "drop-shadow(0 6px 16px rgba(6, 6, 10, 0.34)) drop-shadow(0 0 6px rgba(255, 213, 145, 0.08))" : "drop-shadow(0 10px 18px rgba(24, 17, 11, 0.24))"
                      }
                    }
                  ),
                  sceneEditMode ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "span",
                    {
                      "aria-hidden": "true",
                      className: "absolute inset-0 rounded-[18px] border border-dashed border-white/28",
                      style: { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)" }
                    }
                  ) : null
                ]
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "button",
          {
            type: "button",
            className: "absolute z-[181] transition-all duration-200",
            style: {
              left: `${ROOM_DIM_HOTSPOT.x}px`,
              top: `${ROOM_DIM_HOTSPOT.y}px`,
              width: `${ROOM_DIM_HOTSPOT.width}px`,
              minHeight: `${ROOM_DIM_HOTSPOT.height}px`,
              borderRadius: sceneEditMode ? "28px" : "32px",
              border: sceneEditMode ? `1.5px dashed ${isRoomLightDimmed ? "rgba(245, 208, 147, 0.52)" : "rgba(255,255,255,0.36)"}` : "none",
              background: sceneEditMode ? isRoomLightDimmed ? "rgba(73, 53, 31, 0.2)" : "rgba(255,255,255,0.05)" : "transparent",
              boxShadow: sceneEditMode ? "inset 0 0 0 1px rgba(255,255,255,0.06)" : "none",
              opacity: sceneEditMode ? 1 : 0,
              pointerEvents: sceneEditMode ? "auto" : "none",
              backdropFilter: sceneEditMode ? "blur(2px)" : "none",
              WebkitBackdropFilter: sceneEditMode ? "blur(2px)" : "none"
            },
            onClick: (e) => {
              e.stopPropagation();
              toggleRoomLight();
            },
            "aria-label": isRoomLightDimmed ? "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043E\u0431\u044B\u0447\u043D\u043E\u0435 \u043E\u0441\u0432\u0435\u0449\u0435\u043D\u0438\u0435" : "\u041F\u0440\u0438\u0433\u043B\u0443\u0448\u0438\u0442\u044C \u0441\u0432\u0435\u0442 \u043D\u0430 90%",
            title: isRoomLightDimmed ? "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043E\u0431\u044B\u0447\u043D\u043E\u0435 \u043E\u0441\u0432\u0435\u0449\u0435\u043D\u0438\u0435" : "\u041F\u0440\u0438\u0433\u043B\u0443\u0448\u0438\u0442\u044C \u0441\u0432\u0435\u0442 \u043D\u0430 90%",
            tabIndex: sceneEditMode ? 0 : -1,
            children: sceneEditMode ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "pointer-events-none absolute inset-0 flex flex-col justify-between rounded-[28px] px-4 py-3 text-left", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55", children: "\u0412\u0438\u0440\u0442\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u0437\u043E\u043D\u0430" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "text-sm font-semibold text-white/82", children: isRoomLightDimmed ? "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u0441\u0432\u0435\u0442" : "\u041A\u043B\u0438\u043A \u2014 \u043F\u0440\u0438\u0433\u043B\u0443\u0448\u0438\u0442\u044C \u043D\u0430 90%" })
            ] }) : null
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-office-workzone absolute inset-0 overflow-hidden transition-[filter] duration-300", style: { filter: isRoomLightDimmed ? "brightness(0.16) saturate(0.7)" : "brightness(1)", willChange: "filter" }, onClick: () => {
          setSelectedWidgetId(null);
          setSelectedDeskItemId(null);
        }, onDragOver: (e) => e.preventDefault(), onDrop: handleDeskDrop, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "absolute inset-0 z-[8]", children: sceneWidgets.map((widget) => {
            const isSelected = widget.id === selectedWidgetId;
            return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "div",
              {
                className: `dashboard-scene-widget dashboard-scene-widget-${widget.kind} dashboard-scene-widget-${widget.tone || "note"} ${sceneEditMode ? "dashboard-scene-widget-editing" : ""} ${isSelected ? "dashboard-scene-widget-selected" : ""}`,
                style: {
                  left: `${widget.x}px`,
                  top: `${widget.y}px`,
                  width: `${widget.width}px`,
                  height: `${widget.height}px`,
                  transform: `rotate(${widget.rotation}deg)`,
                  zIndex: widget.z,
                  fontSize: `${widget.fontSize}px`,
                  pointerEvents: widget.kind === "image" && !sceneEditMode ? "none" : "auto"
                },
                onMouseDown: (e) => startWidgetInteraction(e, widget, "drag"),
                onClick: (e) => {
                  e.stopPropagation();
                  if (widget.kind === "image" && !sceneEditMode) return;
                  setSelectedWidgetId(widget.id);
                  setSelectedDeskItemId(null);
                  if (!sceneEditMode && widget.kind === "button") handleSceneWidgetAction(widget.action);
                },
                onDoubleClick: (e) => {
                  e.stopPropagation();
                  if (widget.kind === "button") handleSceneWidgetAction(widget.action);
                },
                children: [
                  widget.kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("img", { className: "dashboard-scene-widget-image-el", src: widget.src, alt: "\u0421\u0445\u0435\u043C\u0430 \u043D\u0430 \u0434\u043E\u0441\u043A\u0435", draggable: false }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-scene-widget-label", children: widget.text }),
                  sceneEditMode && isSelected ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-scene-widget-rotate", onMouseDown: (e) => startWidgetInteraction(e, widget, "rotate"), "aria-label": "\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u044D\u043B\u0435\u043C\u0435\u043D\u0442", children: "\u21BB" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-scene-widget-resize", onMouseDown: (e) => startWidgetInteraction(e, widget, "resize"), "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430", children: "\u2198" })
                  ] }) : null
                ]
              },
              widget.id
            );
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              className: `absolute ${selectedDeskItemId === LAPTOP_DEVICE_ID ? "dashboard-desk-entity-selected" : ""}`,
              style: {
                left: `${laptopPosition.x}px`,
                top: `${laptopPosition.y}px`,
                width: `${laptopPosition.width || DEFAULT_LAPTOP_POSITION.width}px`,
                height: `${laptopPosition.height || DEFAULT_LAPTOP_POSITION.height}px`,
                zIndex: laptopPosition.z || DEFAULT_LAPTOP_POSITION.z || 24,
                transform: `rotate(${laptopPosition.rotation || 0}deg)`,
                transformOrigin: "center center"
              },
              onMouseDown: (e) => {
                if (!sceneEditMode) return;
                e.preventDefault();
                e.stopPropagation();
                setSelectedDeskItemId(LAPTOP_DEVICE_ID);
                setSelectedWidgetId(null);
                startDeskItemInteraction(e, LAPTOP_DEVICE_ID, "device", "drag", laptopPosition);
              },
              onClick: (e) => {
                e.stopPropagation();
                setSelectedDeskItemId(LAPTOP_DEVICE_ID);
                setSelectedWidgetId(null);
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "img",
                  {
                    src: "/dashboard-laptop-transparent.png",
                    alt: "\u041D\u043E\u0443\u0442\u0431\u0443\u043A \u043D\u0430 \u0441\u0442\u043E\u043B\u0435",
                    draggable: false,
                    className: "pointer-events-none h-full w-full object-contain",
                    style: { filter: "drop-shadow(0 26px 28px rgba(5,10,24,0.34))" }
                  }
                ),
                sceneEditMode && selectedDeskItemId === LAPTOP_DEVICE_ID ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-desk-entity-handle dashboard-desk-entity-rotate", onMouseDown: (e) => startDeskItemInteraction(e, LAPTOP_DEVICE_ID, "device", "rotate", laptopPosition), "aria-label": "\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043D\u043E\u0443\u0442\u0431\u0443\u043A", children: "\u21BB" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-desk-entity-handle dashboard-desk-entity-resize", onMouseDown: (e) => startDeskItemInteraction(e, LAPTOP_DEVICE_ID, "device", "resize", laptopPosition), "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430", children: "\u2198" })
                ] }) : null
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              className: `absolute ${selectedDeskItemId === LAPTOP_PANEL_ID ? "dashboard-desk-entity-selected" : ""}`,
              style: {
                left: `${laptopPanelPosition.x}px`,
                top: `${laptopPanelPosition.y}px`,
                width: `${laptopPanelPosition.width || DEFAULT_LAPTOP_PANEL_POSITION.width}px`,
                height: `${laptopPanelPosition.height || DEFAULT_LAPTOP_PANEL_POSITION.height}px`,
                zIndex: laptopPanelPosition.z || DEFAULT_LAPTOP_PANEL_POSITION.z || 26,
                transform: `rotate(${laptopPanelPosition.rotation || 0}deg)`,
                transformOrigin: "center center"
              },
              onMouseDown: (e) => {
                if (!sceneEditMode) return;
                e.preventDefault();
                e.stopPropagation();
                setSelectedDeskItemId(LAPTOP_PANEL_ID);
                setSelectedWidgetId(null);
                startDeskItemInteraction(e, LAPTOP_PANEL_ID, "panel", "drag", laptopPanelPosition);
              },
              onClick: (e) => {
                e.stopPropagation();
                setSelectedDeskItemId(LAPTOP_PANEL_ID);
                setSelectedWidgetId(null);
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "relative h-full w-full overflow-hidden border border-[#8ea8bb] bg-[linear-gradient(180deg,#f3f8fc_0%,#dfe9f2_100%)] text-slate-900 shadow-[0_14px_28px_-18px_rgba(47,76,105,0.28)]", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "absolute inset-x-0 top-0 h-[20px] border-b border-[#9eb8cc] bg-[linear-gradient(180deg,#d7ecfd_0%,#9fc2e3_100%)]" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "absolute left-2 top-[5px] flex items-center gap-1.5", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "h-[8px] w-[8px] rounded-[2px] border border-white/70 bg-white/75" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "h-[8px] w-[22px] rounded-[2px] bg-white/35" })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "absolute right-2 top-[4px] flex items-center gap-1", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "h-[10px] w-[10px] border border-white/55 bg-white/25" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "h-[10px] w-[10px] border border-white/55 bg-white/25" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "h-[10px] w-[10px] border border-white/55 bg-white/25" })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.7),transparent_48%)]" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "relative z-[1] grid h-full grid-cols-[0.95fr_1.05fr] gap-2 px-2 pb-2 pt-6", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex h-full min-h-0 flex-col rounded-[4px] border border-[#b8cad8] bg-[linear-gradient(180deg,#ffffff_0%,#eef4f8_100%)] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-[8px] uppercase tracking-[0.14em] text-slate-500", children: "\u0411\u0430\u043B\u0430\u043D\u0441" }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-1 text-[18px] font-semibold leading-none text-slate-900", children: balanceText }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                        import_link5.default,
                        {
                          href: "/wallet",
                          onClick: (e) => {
                            e.stopPropagation();
                            if (sceneEditMode) e.preventDefault();
                          },
                          className: `mt-2 inline-flex h-7 w-full items-center justify-center border px-2 text-[10px] font-semibold transition ${sceneEditMode ? "pointer-events-none border-slate-300 bg-slate-200/70 text-slate-500" : "border-[#7f97ab] bg-[linear-gradient(180deg,#ffffff_0%,#dbe7f0_100%)] text-[#29435b] shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] hover:bg-[linear-gradient(180deg,#ffffff_0%,#d2e0eb_100%)]"}`,
                          children: "\u041A\u043E\u0448\u0435\u043B\u0451\u043A"
                        }
                      )
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex h-full min-h-0 flex-col rounded-[4px] border border-[#b8cad8] bg-[linear-gradient(180deg,#ffffff_0%,#eef4f8_100%)] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-[8px] uppercase tracking-[0.14em] text-slate-500", children: "\u0422\u0430\u0440\u0438\u0444" }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-1 line-clamp-2 text-[10px] font-semibold leading-[1.15] text-slate-900", children: activeSubscription ? activeSubscription.plan_title : "\u041D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D" }),
                      activeSubscription ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mt-1.5 space-y-1 text-[9px] leading-[1.25] text-slate-700", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "rounded-[3px] border border-[#d4dee7] bg-[#f8fbfe] px-2 py-1", children: [
                          "\u0414\u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F: ",
                          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "font-semibold text-slate-900", children: [
                            getSubscriptionDaysLeft(activeSubscription.expires_at) ?? 0,
                            " \u0434\u043D."
                          ] })
                        ] }),
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "rounded-[3px] border border-[#d4dee7] bg-[#f8fbfe] px-2 py-1", children: [
                          "\u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C: ",
                          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "font-semibold text-slate-900", children: activeSubscription.projects_remaining }),
                          " / ",
                          activeSubscription.projects_limit
                        ] })
                      ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-1.5 rounded-[3px] border border-[#d4dee7] bg-[#f8fbfe] px-2 py-1 text-[9px] leading-[1.25] text-slate-600", children: "\u0422\u0430\u0440\u0438\u0444 \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D." })
                    ] })
                  ] })
                ] }),
                sceneEditMode && selectedDeskItemId === LAPTOP_PANEL_ID ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-desk-entity-handle dashboard-desk-entity-rotate", onMouseDown: (e) => startDeskItemInteraction(e, LAPTOP_PANEL_ID, "panel", "rotate", laptopPanelPosition), "aria-label": "\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u0430\u043D\u0435\u043B\u044C \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430", children: "\u21BB" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-desk-entity-handle dashboard-desk-entity-resize", onMouseDown: (e) => startDeskItemInteraction(e, LAPTOP_PANEL_ID, "panel", "resize", laptopPanelPosition), "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440 \u043F\u0430\u043D\u0435\u043B\u0438 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430", children: "\u2198" })
                ] }) : null
              ]
            }
          ),
          (() => {
            const trashPosition = deskPositions[TRASH_GUIDE_ID] || getDefaultTrashGuidePosition();
            const width = trashPosition.width || TRASH_ZONE.width;
            const height = trashPosition.height || TRASH_ZONE.height;
            const isSelected = selectedDeskItemId === TRASH_GUIDE_ID;
            return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "div",
              {
                className: `dashboard-trash-zone absolute z-[14] ${trashHover ? "dashboard-trash-zone-active" : ""} ${sceneEditMode ? "dashboard-trash-zone-editing" : ""} ${isSelected ? "dashboard-desk-entity-selected" : ""}`,
                style: { left: `${trashPosition.x}px`, top: `${trashPosition.y}px`, width: `${width}px`, height: `${height}px`, transform: getGuideTransform(trashPosition), transformOrigin: "top left" },
                onClick: (e) => {
                  e.stopPropagation();
                  if (sceneEditMode) {
                    setSelectedDeskItemId(TRASH_GUIDE_ID);
                    setSelectedWidgetId(null);
                  } else {
                    setTrashOpen(true);
                  }
                },
                onMouseDown: (e) => {
                  if (!sceneEditMode) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedDeskItemId(TRASH_GUIDE_ID);
                  setSelectedWidgetId(null);
                  startDeskItemInteraction(e, TRASH_GUIDE_ID, "guide", "drag", trashPosition);
                },
                onDragEnter: (e) => {
                  e.preventDefault();
                  const draggedProjectId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
                  const draggedFolderId = e.dataTransfer.getData("text/folder-id") || draggingFolderId;
                  if (draggedProjectId) beginTrashHover("project", draggedProjectId);
                  else if (draggedFolderId) beginTrashHover("folder", draggedFolderId);
                },
                onDragOver: (e) => {
                  e.preventDefault();
                  const draggedProjectId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
                  const draggedFolderId = e.dataTransfer.getData("text/folder-id") || draggingFolderId;
                  if (draggedProjectId) beginTrashHover("project", draggedProjectId);
                  else if (draggedFolderId) beginTrashHover("folder", draggedFolderId);
                },
                onDragLeave: () => clearTrashHover(),
                onDrop: (e) => {
                  e.preventDefault();
                  const draggedProjectId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
                  const draggedFolderId = e.dataTransfer.getData("text/folder-id") || draggingFolderId;
                  if (draggedProjectId) {
                    const project = (workspace?.projects || []).find((item) => item.id === draggedProjectId);
                    moveToTrash("project", draggedProjectId, project?.title || project?.person?.full_name || "\u041F\u0440\u043E\u0435\u043A\u0442");
                    setDraggingProjectId(null);
                  } else if (draggedFolderId) {
                    const folder = (workspace?.folders || []).find((item) => item.id === draggedFolderId);
                    moveToTrash("folder", draggedFolderId, folder?.name || "\u041F\u0430\u043F\u043A\u0430");
                    setDraggingFolderId(null);
                  }
                  clearTrashHover();
                },
                "aria-label": "\u041A\u043E\u0440\u0437\u0438\u043D\u0430",
                title: "\u041A\u043E\u0440\u0437\u0438\u043D\u0430",
                children: [
                  sceneEditMode ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-trash-zone-label", children: "\u041A\u043E\u0440\u0437\u0438\u043D\u0430" }) : null,
                  sceneEditMode && isSelected ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", style: { pointerEvents: "auto" }, className: "dashboard-desk-entity-handle dashboard-desk-entity-rotate", onMouseDown: (e) => startDeskItemInteraction(e, TRASH_GUIDE_ID, "guide", "rotate", trashPosition), "aria-label": "\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0437\u043E\u043D\u0443 \u043A\u043E\u0440\u0437\u0438\u043D\u044B", children: "\u21BB" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", style: { pointerEvents: "auto" }, className: "dashboard-desk-entity-handle dashboard-desk-entity-resize", onMouseDown: (e) => startDeskItemInteraction(e, TRASH_GUIDE_ID, "guide", "resize", trashPosition), "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440 \u0437\u043E\u043D\u044B \u043A\u043E\u0440\u0437\u0438\u043D\u044B", children: "\u2198" })
                  ] }) : null
                ]
              }
            );
          })(),
          (() => {
            const guidePosition = deskPositions[TRAY_GUIDE_ID] || getDefaultTrayGuidePosition();
            const guideWidth = guidePosition.width || 228;
            const guideHeight = guidePosition.height || 104;
            const guideRotation = guidePosition.rotation || 0;
            const guideTiltX = guidePosition.tiltX || 0;
            const guideTiltY = guidePosition.tiltY || 0;
            const isSelected = selectedDeskItemId === TRAY_GUIDE_ID;
            return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "div",
              {
                className: `absolute ${isSelected ? "dashboard-desk-entity-selected" : ""}`,
                style: {
                  left: guidePosition.x,
                  top: guidePosition.y,
                  zIndex: isSelected ? 19 : 11,
                  width: `${guideWidth}px`,
                  height: `${guideHeight}px`,
                  transform: `perspective(1400px) rotateX(${guideTiltX}deg) rotateY(${guideTiltY}deg) rotate(${guideRotation}deg)`,
                  transformOrigin: "top left",
                  transformStyle: "preserve-3d",
                  pointerEvents: sceneEditMode ? "auto" : "none"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: `dashboard-tray-guide-box ${sceneEditMode ? "dashboard-tray-guide-box-editing" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "button",
                    {
                      type: "button",
                      className: "dashboard-tray-guide-inner",
                      style: { clipPath: getGuideClipPath(guidePosition), pointerEvents: "auto", cursor: sceneEditMode ? "grab" : "pointer" },
                      onMouseDown: (e) => {
                        if (!sceneEditMode) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedDeskItemId(TRAY_GUIDE_ID);
                        setSelectedWidgetId(null);
                        startDeskItemInteraction(e, TRAY_GUIDE_ID, "guide", "drag", guidePosition);
                      },
                      onClick: (e) => {
                        e.stopPropagation();
                        if (!sceneEditMode) {
                          promptAndCreateFolder();
                        }
                      },
                      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-tray-guide-label", children: trayGuideText })
                    }
                  ) }),
                  sceneEditMode ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "button",
                    {
                      type: "button",
                      className: "dashboard-tray-guide-selector",
                      style: { pointerEvents: "auto" },
                      onMouseDown: (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedDeskItemId(TRAY_GUIDE_ID);
                        setSelectedWidgetId(null);
                        startDeskItemInteraction(e, TRAY_GUIDE_ID, "guide", "drag", guidePosition);
                      },
                      onClick: (e) => {
                        e.stopPropagation();
                        setSelectedDeskItemId(TRAY_GUIDE_ID);
                        setSelectedWidgetId(null);
                      },
                      "aria-label": "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0432\u0438\u0440\u0442\u0443\u0430\u043B\u044C\u043D\u0443\u044E \u0441\u0442\u043E\u0439\u043A\u0443",
                      title: "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0432\u0438\u0440\u0442\u0443\u0430\u043B\u044C\u043D\u0443\u044E \u0441\u0442\u043E\u0439\u043A\u0443",
                      children: "\u2922"
                    }
                  ) : null,
                  sceneEditMode && isSelected ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", style: { pointerEvents: "auto" }, className: "dashboard-desk-entity-handle dashboard-desk-entity-rotate", onMouseDown: (e) => startDeskItemInteraction(e, TRAY_GUIDE_ID, "guide", "rotate", guidePosition), "aria-label": "\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0437\u043E\u043D\u0443 \u0441\u0442\u043E\u0439\u043A\u0438", children: "\u21BB" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", style: { pointerEvents: "auto" }, className: "dashboard-desk-entity-handle dashboard-desk-entity-resize", onMouseDown: (e) => startDeskItemInteraction(e, TRAY_GUIDE_ID, "guide", "resize", guidePosition), "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440 \u0437\u043E\u043D\u044B \u0441\u0442\u043E\u0439\u043A\u0438", children: "\u2198" })
                  ] }) : null
                ]
              }
            );
          })(),
          (() => {
            const guideClip = getGuideClipRect(deskPositions[TRAY_GUIDE_ID]);
            return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "absolute z-[12] overflow-hidden", style: { left: `${guideClip.x}px`, top: `${guideClip.y}px`, width: `${guideClip.width}px`, height: `${guideClip.height}px`, transform: getGuideTransform(deskPositions[TRAY_GUIDE_ID]), transformOrigin: "top left", clipPath: getGuideClipPath(deskPositions[TRAY_GUIDE_ID]), pointerEvents: "none" }, children: trayFolders.map(({ folder, projects: folderProjects }, folderIndex) => {
              const itemId = `folder:${folder.id}`;
              const position = deskPositions[itemId] || getDefaultFolderPosition(folderIndex);
              const width = position.width || DESK_FOLDER_WIDTH;
              const height = position.height || DESK_FOLDER_HEIGHT;
              const rotation = (position.rotation || 0) + getEntityTilt(folder.id, 2) * 0.42;
              const isSelected = selectedDeskItemId === itemId;
              return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "absolute", style: { left: position.x - guideClip.x, top: position.y - guideClip.y, zIndex: position.z, width: `${width}px`, height: `${height}px`, transform: `perspective(1400px) rotateX(${position.tiltX || 0}deg) rotateY(${position.tiltY || 0}deg) rotate(${rotation}deg)`, transformStyle: "preserve-3d", pointerEvents: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                FolderDesktopIcon,
                {
                  folder,
                  projects: folderProjects,
                  busy: busyFolderId === folder.id,
                  onOpen: () => setActiveFolderId(folder.id),
                  onManage: () => setFolderActionTarget(folder),
                  onDropProject: (projectId) => moveProject(projectId, folder.id),
                  draggingProjectId,
                  sceneEditMode,
                  selected: isSelected,
                  onSelect: () => {
                    setSelectedDeskItemId(itemId);
                    setSelectedWidgetId(null);
                  },
                  onResizeHandleMouseDown: (e) => startDeskItemInteraction(e, itemId, "folder", "resize", position),
                  onRotateHandleMouseDown: (e) => startDeskItemInteraction(e, itemId, "folder", "rotate", position),
                  onDragMoveStart: (e) => startDeskItemInteraction(e, itemId, "folder", "drag", position),
                  onDragStart: () => {
                    setDraggingFolderId(folder.id);
                    bringDeskItemToFront(itemId);
                  },
                  onDragEnd: () => setDraggingFolderId(null)
                }
              ) }, folder.id);
            }) });
          })(),
          looseFolders.map(({ folder, projects: folderProjects }, folderIndex) => {
            const itemId = `folder:${folder.id}`;
            const position = deskPositions[itemId] || getDefaultFolderPosition(folderIndex);
            const width = position.width || DESK_FOLDER_WIDTH;
            const height = position.height || DESK_FOLDER_HEIGHT;
            const rotation = (position.rotation || 0) + getEntityTilt(folder.id, 2) * 0.42;
            const isSelected = selectedDeskItemId === itemId;
            return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "absolute", style: { left: position.x, top: position.y, zIndex: position.z, width: `${width}px`, height: `${height}px`, transform: `perspective(1400px) rotateX(${position.tiltX || 0}deg) rotateY(${position.tiltY || 0}deg) rotate(${rotation}deg)`, transformStyle: "preserve-3d" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              FolderDesktopIcon,
              {
                folder,
                projects: folderProjects,
                busy: busyFolderId === folder.id,
                onOpen: () => setActiveFolderId(folder.id),
                onManage: () => setFolderActionTarget(folder),
                onDropProject: (projectId) => moveProject(projectId, folder.id),
                draggingProjectId,
                sceneEditMode,
                selected: isSelected,
                onSelect: () => {
                  setSelectedDeskItemId(itemId);
                  setSelectedWidgetId(null);
                },
                onResizeHandleMouseDown: (e) => startDeskItemInteraction(e, itemId, "folder", "resize", position),
                onRotateHandleMouseDown: (e) => startDeskItemInteraction(e, itemId, "folder", "rotate", position),
                onDragMoveStart: (e) => startDeskItemInteraction(e, itemId, "folder", "drag", position),
                onDragStart: () => {
                  setDraggingFolderId(folder.id);
                  bringDeskItemToFront(itemId);
                },
                onDragEnd: () => setDraggingFolderId(null)
              }
            ) }, folder.id);
          }),
          folderBuckets.uncategorized.map((project, projectIndex) => {
            const itemId = `project:${project.id}`;
            const position = deskPositions[itemId] || getDefaultProjectPosition(projectIndex);
            const width = position.width || DESK_SHEET_WIDTH;
            const height = position.height || DESK_SHEET_HEIGHT;
            const rotation = (position.rotation || 0) + getEntityTilt(project.id, 1) * 0.18;
            const isSelected = selectedDeskItemId === itemId;
            return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "absolute", style: { left: position.x, top: position.y, zIndex: position.z, width: `${width}px`, height: `${height}px`, transform: `perspective(1400px) rotateX(${position.tiltX || 0}deg) rotateY(${position.tiltY || 0}deg) rotate(${rotation}deg)`, transformStyle: "preserve-3d" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              ProjectDesktopIcon,
              {
                project,
                busy: busyFolderId === `delete:${project.id}`,
                sceneEditMode,
                selected: isSelected,
                onSelect: () => {
                  setSelectedDeskItemId(itemId);
                  setSelectedWidgetId(null);
                },
                onResizeHandleMouseDown: (e) => startDeskItemInteraction(e, itemId, "project", "resize", position),
                onRotateHandleMouseDown: (e) => startDeskItemInteraction(e, itemId, "project", "rotate", position),
                onDragMoveStart: (e) => startDeskItemInteraction(e, itemId, "project", "drag", position),
                onOpen: () => setPreviewProject(project),
                onDragStart: () => {
                  setDraggingProjectId(project.id);
                  bringDeskItemToFront(itemId);
                },
                onDragEnd: () => {
                  setDraggingProjectId(null);
                  clearTrashHover();
                },
                onDelete: () => deleteProject(project.id)
              }
            ) }, project.id);
          }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "button",
            {
              type: "button",
              className: "dashboard-pen-trigger absolute bottom-12 right-10 z-[220]",
              onClick: () => router.push("/projects/new"),
              "aria-label": "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442 \u043E\u0446\u0435\u043D\u043A\u0438",
              title: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442 \u043E\u0446\u0435\u043D\u043A\u0438",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-pen-body" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-pen-cap" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-pen-tip" })
              ]
            }
          ),
          !folderBuckets.byFolder.length && !folderBuckets.uncategorized.length ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "absolute inset-x-8 bottom-12 rounded-2xl border border-dashed border-black/10 bg-white/88 p-8 text-center text-sm text-[#4b3727] shadow-[0_14px_30px_-24px_rgba(31,18,10,0.22)]", children: "\u0417\u0434\u0435\u0441\u044C \u043F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u043E. \u0421\u043E\u0437\u0434\u0430\u0439 \u043F\u0435\u0440\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0438\u043B\u0438 \u0434\u043E\u0431\u0430\u0432\u044C \u043F\u0430\u043F\u043A\u0443 \u0432 \u0441\u0442\u043E\u0439\u043A\u0443 \u0441\u043F\u0440\u0430\u0432\u0430." }) : null
        ] })
      ] })
    ] }),
    activeFolder ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      FolderModal,
      {
        folder: activeFolder.folder,
        projects: activeFolder.projects,
        busy: busyFolderId === activeFolder.folder.id,
        onClose: () => setActiveFolderId(null),
        onManage: () => setFolderActionTarget(activeFolder.folder),
        onOpenProject: (id) => router.push(`/projects/${id}`),
        onMoveToDesktop: (projectId) => moveProject(projectId, null),
        onDeleteProject: (projectId) => deleteProject(projectId)
      }
    ) : null,
    trashOpen ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      TrashRestoreModal,
      {
        entries: trashEntries,
        folders: workspace?.folders || [],
        projects: workspace?.projects || [],
        onClose: () => setTrashOpen(false),
        onRestore: restoreTrashEntry,
        onDeleteNow: (entry) => {
          if (entry.kind === "project") void deleteProject(entry.id, true);
          else void deleteFolderDirect(entry.id);
          setTrashEntries((prev) => prev.filter((item) => !(item.kind === entry.kind && item.id === entry.id)));
        }
      }
    ) : null,
    previewProject ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      ProjectSheetPreviewModal,
      {
        project: previewProject,
        onClose: () => setPreviewProject(null),
        onOpenFull: () => router.push(`/projects/${previewProject.id}`)
      }
    ) : null,
    folderActionTarget ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      FolderActionDialog,
      {
        folder: folderActionTarget,
        onClose: () => setFolderActionTarget(null),
        onRename: () => openRenameFolder(folderActionTarget),
        onDelete: () => openDeleteFolder(folderActionTarget),
        onChooseIcon: () => {
          setIconPickerFolder(folderActionTarget);
          setFolderActionTarget(null);
        }
      }
    ) : null,
    folderRenameTarget ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      FolderRenameDialog,
      {
        folder: folderRenameTarget,
        value: folderRenameValue,
        busy: busyFolderId === folderRenameTarget.id,
        onChange: setFolderRenameValue,
        onClose: () => {
          setFolderRenameTarget(null);
          setFolderRenameValue("");
        },
        onSave: saveRenameFolder
      }
    ) : null,
    folderDeleteTarget ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      FolderDeleteDialog,
      {
        folder: folderDeleteTarget,
        busy: busyFolderId === folderDeleteTarget.id,
        onClose: () => setFolderDeleteTarget(null),
        onDelete: confirmDeleteFolder
      }
    ) : null,
    iconPickerFolder ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      FolderIconPicker,
      {
        folder: iconPickerFolder,
        busy: busyFolderId === iconPickerFolder.id,
        onClose: () => setIconPickerFolder(null),
        onSelect: (iconKey) => updateFolderIcon(iconPickerFolder, iconKey)
      }
    ) : null
  ] });
}
function FolderDesktopIcon({ variant = "scheme", folder, projects, busy, onOpen, onManage, onDropProject, draggingProjectId, onDragStart, onDragEnd, sceneEditMode = false, selected = false, onSelect, onResizeHandleMouseDown, onRotateHandleMouseDown, onDragMoveStart }) {
  const preview = projects.slice(0, 3);
  if (variant === "classic") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: `group relative flex h-full w-full flex-col items-center ${selected ? "dashboard-desk-entity-selected" : ""}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "button",
        {
          type: "button",
          draggable: !sceneEditMode && !busy,
          onMouseDownCapture: () => {
            onSelect?.();
          },
          disabled: busy,
          onDragStart: (e) => {
            e.dataTransfer.setData("text/folder-id", folder.id);
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          },
          onDragEnd,
          onMouseDown: (e) => {
            if (sceneEditMode) onDragMoveStart?.(e);
          },
          onClick: () => {
            onSelect?.();
            if (!sceneEditMode) onOpen();
          },
          className: `dashboard-classic-folder ${busy ? "opacity-70" : ""}`,
          onDragOver: (e) => e.preventDefault(),
          onDrop: (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
            if (draggedId) onDropProject(draggedId);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-classic-folder-tab" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-classic-folder-body" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-classic-folder-count", children: projects.length })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-classic-icon-label", children: folder.name }),
      sceneEditMode && selected ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-desk-entity-handle dashboard-desk-entity-rotate", onMouseDown: onRotateHandleMouseDown, "aria-label": "\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u0430\u043F\u043A\u0443", children: "\u21BB" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-desk-entity-handle dashboard-desk-entity-resize", onMouseDown: onResizeHandleMouseDown, "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440 \u043F\u0430\u043F\u043A\u0438", children: "\u2198" })
      ] }) : null
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: `group relative flex h-full w-full flex-col items-center gap-2 ${selected ? "dashboard-desk-entity-selected" : ""}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "button",
      {
        type: "button",
        draggable: !sceneEditMode && !busy,
        onMouseDownCapture: () => {
          onSelect?.();
        },
        disabled: busy,
        onDragStart: (e) => {
          e.dataTransfer.setData("text/folder-id", folder.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        },
        onDragEnd,
        onMouseDown: (e) => {
          if (sceneEditMode) onDragMoveStart?.(e);
        },
        onClick: () => {
          onSelect?.();
          if (!sceneEditMode) onOpen();
        },
        className: `dashboard-folder-card dashboard-folder-card-angled relative flex h-full w-full items-end justify-start overflow-visible border transition hover:-translate-y-0.5 ${draggingProjectId ? "border-[#94724a]" : "border-[#b88c5a]"} ${busy ? "opacity-70" : ""}`,
        onDragOver: (e) => e.preventDefault(),
        onDrop: (e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
          if (draggedId) onDropProject(draggedId);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-folder-shadow-strip" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-folder-spine" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-folder-tab" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-folder-pocket" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-folder-mouth" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-folder-inner-shadow" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-folder-gloss" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "absolute left-4 right-12 top-10 z-20", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "truncate text-[16px] font-semibold leading-tight text-[#5c3e1f]", children: folder.name }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-1 text-[11px] text-[#7a5830]", children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0430\u043F\u043A\u0443" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "pointer-events-none absolute left-4 right-4 top-[68px] z-20 flex flex-col gap-1.5", children: preview.length ? preview.map((project, index) => {
            const slipTitle = project.person?.full_name || project.title || "\u041F\u0440\u043E\u0435\u043A\u0442";
            return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "div",
              {
                className: "dashboard-folder-name-slip rounded-[8px] border px-3 py-1 text-left text-[10px] font-semibold shadow-sm",
                style: {
                  marginLeft: `${index * 10}px`,
                  marginRight: `${Math.max(0, 20 - index * 5)}px`,
                  transform: `translateY(${index * 8}px) rotate(${index % 2 === 0 ? -0.8 : 0.65}deg)`,
                  zIndex: 30 - index
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "block truncate", children: slipTitle })
              },
              project.id
            );
          }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-folder-name-slip rounded-[8px] border px-3 py-1 text-left text-[10px] font-semibold shadow-sm", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "block truncate", children: "\u041F\u0430\u043F\u043A\u0430 \u043F\u0443\u0441\u0442\u0430" }) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "absolute bottom-3 right-4 z-20 rounded-full border border-[#d5be99] bg-[#fff9f0]/92 px-2 py-1 text-[11px] font-medium text-[#5b4024] shadow-sm", children: projects.length })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "button",
      {
        type: "button",
        onClick: onManage,
        className: "absolute right-0 top-0 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-[#f2e7d3] bg-[#fffaf2]/96 text-sm text-[#6e4d2f] shadow-sm opacity-0 transition hover:text-slate-900 group-hover:opacity-100",
        title: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u0430\u043F\u043A\u043E\u0439",
        "aria-label": "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u0430\u043F\u043A\u043E\u0439",
        children: "\u22EF"
      }
    ),
    sceneEditMode && selected ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-desk-entity-handle dashboard-desk-entity-rotate", onMouseDown: onRotateHandleMouseDown, "aria-label": "\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u0430\u043F\u043A\u0443", children: "\u21BB" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-desk-entity-handle dashboard-desk-entity-resize", onMouseDown: onResizeHandleMouseDown, "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440 \u043F\u0430\u043F\u043A\u0438", children: "\u2198" })
    ] }) : null
  ] });
}
function ProjectDesktopIcon({ variant = "scheme", project, onOpen, onDragStart, onDragEnd, onDelete, busy = false, compact = false, sceneEditMode = false, selected = false, onSelect, onResizeHandleMouseDown, onRotateHandleMouseDown, onDragMoveStart }) {
  const displayName = project.person?.full_name || project.title || "\u041F\u0440\u043E\u0435\u043A\u0442";
  const titleLine = project.title || displayName;
  const roleLine = project.target_role || project.person?.current_position || "\u0420\u043E\u043B\u044C \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430";
  const goal = getGoalDefinition(project.goal);
  const total = project.tests?.length || 0;
  const completed = Math.min(project.attempts_count || 0, total || 0);
  const isDone = total > 0 && completed >= total;
  const assessmentLine = isDone ? "\u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0430" : completed > 0 ? "\u0432 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0435" : "\u0435\u0449\u0451 \u043D\u0435 \u0441\u043E\u0431\u0440\u0430\u043D\u0430";
  if (variant === "classic") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: `group relative h-full w-full ${selected ? "dashboard-desk-entity-selected" : ""}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "button",
        {
          type: "button",
          draggable: !sceneEditMode && !busy,
          disabled: busy,
          onMouseDownCapture: () => {
            onSelect?.();
          },
          onDragStart: (e) => {
            e.dataTransfer.setData("text/project-id", project.id);
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          },
          onDragEnd,
          onMouseDown: (e) => {
            if (sceneEditMode) onDragMoveStart?.(e);
          },
          onClick: () => {
            onSelect?.();
            if (!sceneEditMode) onOpen();
          },
          className: `dashboard-classic-file ${busy ? "opacity-60" : ""}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-classic-file-paper" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-classic-file-corner" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `dashboard-classic-file-dot ${isDone ? "dashboard-classic-file-dot-done" : "dashboard-classic-file-dot-pending"}` })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-classic-icon-label", children: titleLine }),
      sceneEditMode && selected ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-desk-entity-handle dashboard-desk-entity-rotate", onMouseDown: onRotateHandleMouseDown, "aria-label": "\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0444\u0430\u0439\u043B", children: "\u21BB" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-desk-entity-handle dashboard-desk-entity-resize", onMouseDown: onResizeHandleMouseDown, "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440 \u0444\u0430\u0439\u043B\u0430", children: "\u2198" })
      ] }) : null
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: `group relative h-full w-full dashboard-desk-sheet-wrap ${selected ? "dashboard-desk-entity-selected" : ""}`, children: [
    onDelete ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "button",
      {
        type: "button",
        onClick: (e) => {
          e.stopPropagation();
          onDelete();
        },
        className: "dashboard-desk-sheet-delete",
        title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442",
        "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442",
        children: "\u2715"
      }
    ) : null,
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "button",
      {
        type: "button",
        draggable: !sceneEditMode && !busy,
        disabled: busy,
        onMouseDownCapture: () => {
          onSelect?.();
        },
        onDragStart: (e) => {
          e.dataTransfer.setData("text/project-id", project.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        },
        onDragEnd,
        onMouseDown: (e) => {
          if (sceneEditMode) onDragMoveStart?.(e);
        },
        onClick: () => {
          onSelect?.();
          if (!sceneEditMode) onOpen();
        },
        className: `dashboard-desk-sheet dashboard-desk-sheet-plain ${compact ? "dashboard-desk-sheet-compact" : ""} ${busy ? "opacity-60" : ""}`,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-desk-sheet-clip", "aria-hidden": "true" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-desk-sheet-kicker", children: "\u041B\u0438\u0441\u0442 \u043F\u0440\u043E\u0435\u043A\u0442\u0430" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dashboard-desk-sheet-title", children: titleLine }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dashboard-desk-sheet-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u0418\u043C\u044F" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: displayName })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dashboard-desk-sheet-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u0426\u0435\u043B\u044C" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: goal?.shortTitle || project.goal })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dashboard-desk-sheet-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u0420\u043E\u043B\u044C" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: roleLine })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dashboard-desk-sheet-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u041E\u0446\u0435\u043D\u043A\u0430" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: assessmentLine })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dashboard-desk-sheet-footer", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
              completed,
              "/",
              total || 0,
              " \u0442\u0435\u0441\u0442\u043E\u0432"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: new Date(project.created_at).toLocaleDateString("ru-RU") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `dashboard-desk-sheet-stamp ${isDone ? "dashboard-desk-sheet-stamp-done" : "dashboard-desk-sheet-stamp-pending"}`, children: isDone ? "\u0417\u0410\u0412\u0415\u0420\u0428\u0415\u041D\u041E" : "\u041D\u0415 \u0417\u0410\u0412\u0415\u0420\u0428\u0415\u041D\u041E" })
        ]
      }
    ),
    sceneEditMode && selected ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-desk-entity-handle dashboard-desk-entity-rotate", onMouseDown: onRotateHandleMouseDown, "aria-label": "\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043B\u0438\u0441\u0442", children: "\u21BB" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dashboard-desk-entity-handle dashboard-desk-entity-resize", onMouseDown: onResizeHandleMouseDown, "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440 \u043B\u0438\u0441\u0442\u0430", children: "\u2198" })
    ] }) : null
  ] });
}
function ProjectSheetPreviewModal({ project, onClose, onOpenFull }) {
  const displayName = project.person?.full_name || project.title || "\u041F\u0440\u043E\u0435\u043A\u0442";
  const goal = getGoalDefinition(project.goal);
  const total = project.tests?.length || 0;
  const completed = Math.min(project.attempts_count || 0, total || 0);
  const isDone = total > 0 && completed >= total;
  const assessmentLine = isDone ? "\u041E\u0431\u0449\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0430" : completed > 0 ? "\u041E\u0431\u0449\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u0432 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0435" : "\u041E\u0431\u0449\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0441\u043E\u0431\u0440\u0430\u043D\u0430";
  const roleLine = project.target_role || project.person?.current_position || "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430";
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-project-preview-wrap relative w-full max-w-[920px]", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "button",
      {
        type: "button",
        className: "absolute right-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/92 text-lg text-slate-700 shadow-lg hover:text-slate-950",
        onClick: onClose,
        "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
        children: "\u2715"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-project-preview-board", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-project-preview-clip", "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-project-preview-clip-inner", "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-project-preview-sheet", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-project-preview-topline", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-project-preview-kicker", children: "\u041B\u0438\u0441\u0442 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u043E\u0446\u0435\u043D\u043A\u0438" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-project-preview-title", children: project.title || displayName })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: `dashboard-project-preview-stamp ${isDone ? "dashboard-project-preview-stamp-ready" : "dashboard-project-preview-stamp-progress"}`, children: assessmentLine })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-project-preview-columns", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-project-preview-section", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-project-preview-section-title", children: "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-project-preview-table", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u0418\u043C\u044F \u0438 \u0444\u0430\u043C\u0438\u043B\u0438\u044F" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: displayName })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "Email" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: project.person?.email || "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: project.person?.current_position || "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u0426\u0435\u043B\u0435\u0432\u0430\u044F \u0440\u043E\u043B\u044C" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: roleLine })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u0426\u0435\u043B\u044C \u043E\u0446\u0435\u043D\u043A\u0438" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: goal?.title || goal?.shortTitle || project.goal })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u0421\u043E\u0437\u0434\u0430\u043D" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: new Date(project.created_at).toLocaleString("ru-RU") })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-project-preview-section", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-project-preview-section-title", children: "\u0421\u0432\u043E\u0434\u043A\u0430 \u043F\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0443" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-project-preview-table", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u0421\u0442\u0430\u0442\u0443\u0441" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: assessmentLine })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u0422\u0435\u0441\u0442\u043E\u0432 \u0432 \u043D\u0430\u0431\u043E\u0440\u0435" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: total })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E \u043F\u043E\u043F\u044B\u0442\u043E\u043A" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: completed })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u041F\u0430\u043A\u0435\u0442" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: project.package_mode || "standard" })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-project-preview-tests", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dashboard-project-preview-section-title", children: "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0432 \u043F\u0440\u043E\u0435\u043A\u0442\u0435" }),
              project.tests?.length ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ul", { children: project.tests.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((test) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("li", { children: test.test_title || test.test_slug }, `${project.id}-${test.test_slug}`)) }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-sm text-slate-500", children: "\u0422\u0435\u0441\u0442\u044B \u043F\u043E\u043A\u0430 \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B." })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dashboard-project-preview-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "btn btn-secondary", onClick: onClose, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043B\u0438\u0441\u0442" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "btn btn-primary", onClick: onOpenFull, children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E" })
        ] })
      ] })
    ] })
  ] }) });
}
function FolderModal({ folder, projects, busy, onClose, onManage, onOpenProject, onMoveToDesktop, onDeleteProject }) {
  const [draggingInnerProjectId, setDraggingInnerProjectId] = (0, import_react5.useState)(null);
  const icon = getFolderIcon(folder.icon_key);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      className: `fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm ${draggingInnerProjectId ? "ring-4 ring-emerald-300/50" : ""}`,
      onClick: onClose,
      onDragOver: (e) => {
        if (draggingInnerProjectId) e.preventDefault();
      },
      onDrop: (e) => {
        const draggedId = e.dataTransfer.getData("text/project-id") || draggingInnerProjectId;
        if (!draggedId) return;
        e.preventDefault();
        e.stopPropagation();
        setDraggingInnerProjectId(null);
        onMoveToDesktop(draggedId);
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "w-full max-w-5xl rounded-[32px] border border-[#b68b58] bg-[#f8f0e3]/95 p-5 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center gap-4", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: `flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br text-3xl shadow-sm ${icon.tileClass}`, children: icon.symbol }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-sm text-slate-500", children: "\u041F\u0430\u043F\u043A\u0430" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-1 text-2xl font-semibold text-slate-950", children: folder.name }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-1 text-sm text-slate-500", children: "\u041E\u0442\u043A\u0440\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u043A\u0430\u043A \u0438\u043A\u043E\u043D\u043A\u0443 \u0438\u043B\u0438 \u043F\u0440\u043E\u0441\u0442\u043E \u043F\u0435\u0440\u0435\u0442\u0430\u0449\u0438 \u0435\u0451 \u0437\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u044B \u043E\u043A\u043D\u0430 \u043F\u0430\u043F\u043A\u0438, \u0447\u0442\u043E\u0431\u044B \u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043D\u0430 \u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u0441\u0442\u043E\u043B." })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex flex-wrap gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: onManage, className: "btn btn-secondary btn-sm", children: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: onClose, className: "btn btn-primary btn-sm", children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-4 rounded-2xl border border-dashed border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900", children: "\u0420\u0430\u0431\u043E\u0447\u0438\u0439 \u0441\u0442\u043E\u043B \u0441\u043D\u0430\u0440\u0443\u0436\u0438 \u044D\u0442\u043E\u0433\u043E \u043E\u043A\u043D\u0430. \u041F\u043E\u0442\u044F\u043D\u0438 \u0438\u043A\u043E\u043D\u043A\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u043D\u0430 \u0437\u0430\u0442\u0435\u043C\u043D\u0451\u043D\u043D\u044B\u0439 \u0444\u043E\u043D, \u0438 \u043E\u043D\u0430 \u0432\u0435\u0440\u043D\u0451\u0442\u0441\u044F \u0438\u0437 \u043F\u0430\u043F\u043A\u0438 \u043E\u0431\u0440\u0430\u0442\u043D\u043E \u043D\u0430 \u0441\u0442\u043E\u043B." }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: `mt-6 rounded-[28px] border border-emerald-100 bg-white p-4 ${busy ? "opacity-70" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5", children: projects.length ? projects.map((project) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          ProjectDesktopIcon,
          {
            project,
            compact: true,
            busy,
            onOpen: () => onOpenProject(project.id),
            onDragStart: () => setDraggingInnerProjectId(project.id),
            onDragEnd: () => setDraggingInnerProjectId(null),
            onDelete: onDeleteProject ? () => onDeleteProject(project.id) : void 0
          },
          project.id
        )) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500", children: "\u041F\u0430\u043F\u043A\u0430 \u043F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u0430\u044F. \u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438 \u043D\u0430 \u043D\u0435\u0451 \u043F\u0440\u043E\u0435\u043A\u0442\u044B \u0441 \u0440\u0430\u0431\u043E\u0447\u0435\u0433\u043E \u0441\u0442\u043E\u043B\u0430." }) }) })
      ] })
    }
  );
}
function FolderActionDialog({ folder, onClose, onRename, onDelete, onChooseIcon }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "w-full max-w-md rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-sm text-slate-500", children: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u0430\u043F\u043A\u043E\u0439" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-1 text-2xl font-semibold text-slate-950", children: folder.name }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mt-4 grid gap-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "btn btn-secondary justify-start", onClick: onRename, children: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "btn btn-secondary justify-start", onClick: onChooseIcon, children: "\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u0438\u043A\u043E\u043D\u043A\u0443" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "btn btn-secondary justify-start text-red-600 hover:text-red-700", onClick: onDelete, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0430\u043F\u043A\u0443" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-4 flex justify-end", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "btn btn-primary btn-sm", onClick: onClose, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" }) })
  ] }) });
}
function FolderRenameDialog({ folder, value, busy, onChange, onClose, onSave }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "w-full max-w-xl rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-sm text-slate-500", children: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0430\u043F\u043A\u0438" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-1 text-2xl font-semibold text-slate-950", children: folder.name }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mt-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "\u041D\u043E\u0432\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "input",
        {
          className: "input mt-2 w-full",
          value,
          onChange: (e) => onChange(e.target.value),
          placeholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u0430\u043F\u043A\u0438",
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSave();
            }
          },
          autoFocus: true
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mt-5 flex justify-end gap-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "btn btn-secondary btn-sm", onClick: onClose, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "btn btn-primary btn-sm", onClick: onSave, disabled: busy || !value.trim(), children: busy ? "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C\u2026" : "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C" })
    ] })
  ] }) });
}
function FolderDeleteDialog({ folder, busy, onClose, onDelete }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "w-full max-w-md rounded-[28px] border border-rose-200 bg-white p-5 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-sm text-slate-500", children: "\u0423\u0434\u0430\u043B\u0435\u043D\u0438\u0435 \u043F\u0430\u043F\u043A\u0438" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-1 text-2xl font-semibold text-slate-950", children: folder.name }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-4 text-sm leading-6 text-slate-600", children: "\u041F\u0440\u043E\u0435\u043A\u0442\u044B \u0438\u0437 \u043F\u0430\u043F\u043A\u0438 \u0432\u0435\u0440\u043D\u0443\u0442\u0441\u044F \u043D\u0430 \u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u0441\u0442\u043E\u043B. \u0421\u0430\u043C\u0430 \u043F\u0430\u043F\u043A\u0430 \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043B\u0435\u043D\u0430." }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mt-5 flex justify-end gap-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "btn btn-secondary btn-sm", onClick: onClose, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "btn btn-primary btn-sm bg-rose-600 hover:bg-rose-700 border-rose-600", onClick: onDelete, disabled: busy, children: busy ? "\u0423\u0434\u0430\u043B\u044F\u0435\u043C\u2026" : "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })
    ] })
  ] }) });
}
function FolderIconPicker({ folder, busy, onClose, onSelect }) {
  const active = getFolderIcon(folder.icon_key);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "w-full max-w-xl rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-sm text-slate-500", children: "\u0418\u043A\u043E\u043D\u043A\u0430 \u043F\u0430\u043F\u043A\u0438" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-1 text-2xl font-semibold text-slate-950", children: folder.name }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-1 text-sm text-slate-500", children: "\u0412\u044B\u0431\u0435\u0440\u0438 \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0443\u044E \u0438\u043A\u043E\u043D\u043A\u0443 \u2014 \u043F\u0430\u043F\u043A\u0430 \u043D\u0430 \u0440\u0430\u0431\u043E\u0447\u0435\u043C \u0441\u0442\u043E\u043B\u0435 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0441\u043C\u0435\u043D\u0438\u0442\u0441\u044F \u043D\u0430 \u043D\u0435\u0451." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: onClose, className: "btn btn-secondary btn-sm", children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: `flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br text-2xl shadow-sm ${active.tileClass}`, children: active.symbol }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "text-sm font-semibold text-slate-900", children: [
          "\u0421\u0435\u0439\u0447\u0430\u0441: ",
          active.label
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-xs text-slate-500", children: "\u0418\u043A\u043E\u043D\u043A\u0430 \u0432\u043B\u0438\u044F\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u0432\u0438\u0434 \u043F\u0430\u043F\u043A\u0438 \u043D\u0430 \u0440\u0430\u0431\u043E\u0447\u0435\u043C \u0441\u0442\u043E\u043B\u0435." })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4", children: FOLDER_ICONS.map((icon) => {
      const selected = active.key === icon.key;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "button",
        {
          type: "button",
          onClick: () => onSelect(icon.key),
          disabled: busy,
          className: `rounded-[22px] border p-3 text-left transition ${selected ? `border-transparent ring-2 ${icon.ringClass}` : "border-emerald-100 hover:border-emerald-200"} ${busy ? "opacity-70" : ""}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: `flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br text-2xl shadow-sm ${icon.tileClass}`, children: icon.symbol }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-3 text-sm font-medium text-slate-900", children: icon.label })
          ]
        },
        icon.key
      );
    }) })
  ] }) });
}
function TrashRestoreModal({ entries, onClose, onRestore, onDeleteNow }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "w-full max-w-[760px] rounded-[28px] border border-[#dac4a7] bg-[#fffaf2] p-5 shadow-[0_30px_70px_-44px_rgba(53,34,17,0.38)]", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mb-4 flex items-center justify-between gap-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-lg font-semibold text-[#5a3b20]", children: "\u041A\u043E\u0440\u0437\u0438\u043D\u0430" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-sm text-[#84664a]", children: "\u041F\u0430\u043F\u043A\u0438 \u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u044B \u043C\u043E\u0436\u043D\u043E \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 3 \u0441\u0443\u0442\u043E\u043A." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "rounded-full border border-[#d9c6ab] bg-white px-4 py-2 text-sm text-[#5a3b20]", onClick: onClose, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "space-y-3", children: entries.length ? entries.map((entry) => {
      const remaining = Math.max(0, entry.expiresAt - Date.now());
      const hours = Math.ceil(remaining / (60 * 60 * 1e3));
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "rounded-[20px] border border-[#e3d0b2] bg-white/92 p-4 shadow-[0_12px_26px_-22px_rgba(53,34,17,0.28)] dashboard-trash-item-crumpled", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-start justify-between gap-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "text-xs uppercase tracking-[0.22em] text-[#a2835d]", children: entry.kind === "folder" ? "\u041F\u0430\u043F\u043A\u0430" : "\u041F\u0440\u043E\u0435\u043A\u0442" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mt-1 text-base font-semibold text-[#51361e]", children: entry.title }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mt-1 text-sm text-[#7b5f44]", children: [
            "\u0423\u0434\u0430\u043B\u0438\u0442\u0441\u044F \u0447\u0435\u0440\u0435\u0437 ~",
            hours,
            " \u0447."
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "rounded-full border border-[#cfe1d0] bg-[#eaf7ea] px-4 py-2 text-sm font-medium text-[#335a36]", onClick: () => onRestore(entry), children: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "rounded-full border border-[#e6c5c5] bg-[#fff2f2] px-4 py-2 text-sm font-medium text-[#8a3f3f]", onClick: () => onDeleteNow(entry), children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u0435\u0439\u0447\u0430\u0441" })
        ] })
      ] }) }, `${entry.kind}:${entry.id}`);
    }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "rounded-[20px] border border-dashed border-[#dbc9ac] bg-white/80 p-8 text-center text-sm text-[#84664a]", children: "\u041A\u043E\u0440\u0437\u0438\u043D\u0430 \u043F\u0443\u0441\u0442\u0430." }) })
  ] }) });
}
