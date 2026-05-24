import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { DEFAULT_TEST_INTERPRETATIONS } from "@/lib/defaultTestInterpretations";

function text(value: any) {
  return String(value || "").trim();
}

function firstSentence(value: any) {
  const source = text(value).replace(/\s+/g, " ");
  if (!source) return "";
  const match = source.match(/^.*?[.!?](?:\s|$)/);
  return (match ? match[0] : source).trim();
}

function rowLabel(row: any) {
  return text(row?.style || row?.name || row?.label || row?.tag || "показатель");
}

function rowValue(row: any) {
  const count = Number(row?.count);
  const percent = Number(row?.percent);
  if (Number.isFinite(percent) && percent > 0) return `${Math.round(percent)}%`;
  if (Number.isFinite(count)) return `${Math.round(count)} балл.`;
  return "";
}

function lookupMethodEntry(keys: any, row: any) {
  const tag = text(row?.tag);
  const kind = text(keys?.kind);
  if (!tag) return null;
  if (kind === "belbin_v1") return keys?.roles?.[tag] || null;
  if (kind === "usk_v1") return keys?.scales?.[tag] || keys?.scales?.[tag.toUpperCase()] || null;
  if (kind === "time_management_v1") return keys?.scales?.[tag] || null;
  if (kind === "learning_typology_v1") return keys?.types?.[tag] || keys?.scales?.[tag] || null;
  if (kind === "color_types_v1") return keys?.colors?.[tag] || keys?.scales?.[tag] || null;
  if (kind === "emin_v1") return keys?.scales?.[tag] || null;
  return keys?.styles?.[tag] || keys?.factors?.[tag] || keys?.scales?.[tag] || null;
}

function describeEntry(entry: any, row: any) {
  if (!entry) return "";
  const level = text(row?.level).toLowerCase();
  if (level.includes("низ") || level.includes("экстер")) return firstSentence(entry.low || entry.risks?.[0] || entry.about || entry.description);
  if (level.includes("выс") || level.includes("интер")) return firstSentence(entry.high || entry.about || entry.description || entry.strengths?.[0]);
  return firstSentence(entry.about || entry.description || entry.mid || entry.medium || entry.high || entry.low);
}

function buildBriefInterpretation(result: any, keys: any, testSlug: string) {
  const ranked = Array.isArray(result?.ranked) ? result.ranked : [];
  const ordered = [...ranked].sort((a, b) => Number(b?.percent ?? b?.count ?? 0) - Number(a?.percent ?? a?.count ?? 0));
  const top = ordered[0] || null;
  const second = ordered[1] || null;
  const low = ordered.length > 2 ? ordered[ordered.length - 1] : null;
  const title = text(keys?.title || result?.title || testSlug);
  if (!top) {
    return `По тесту «${title}» результат сохранён, но выраженные шкалы не определены. Краткая интерпретация требует проверки числового профиля и повторного открытия результата.`;
  }

  const topLabel = rowLabel(top);
  const secondLabel = second ? rowLabel(second) : "";
  const lowLabel = low ? rowLabel(low) : "";
  const topValue = rowValue(top);
  const topEntry = lookupMethodEntry(keys, top);
  const secondEntry = second ? lookupMethodEntry(keys, second) : null;
  const lowEntry = low ? lookupMethodEntry(keys, low) : null;
  const topMeaning = describeEntry(topEntry, top);
  const secondMeaning = describeEntry(secondEntry, second);
  const lowMeaning = describeEntry(lowEntry, low);

  const sentences = [
    `По тесту «${title}» ведущим показателем выглядит «${topLabel}»${topValue ? ` (${topValue})` : ""}.`,
    topMeaning ? `Это означает: ${topMeaning}` : `В поведении сильнее всего проявляется линия, связанная с этим показателем.`,
    second && secondLabel
      ? secondMeaning
        ? `Дополнительно заметен показатель «${secondLabel}»: ${secondMeaning}`
        : `Дополнительно заметен показатель «${secondLabel}», который уточняет основной профиль.`
      : "",
    low && lowLabel
      ? lowMeaning
        ? `Зона внимания — «${lowLabel}»: ${lowMeaning}`
        : `Зона внимания — «${lowLabel}», так как этот показатель выражен слабее остальных.`
      : "",
    "Интерпретацию стоит читать как краткий ориентир по методичке, а не как окончательный диагноз: точнее всего она работает вместе с контекстом роли, задач и наблюдений.",
  ].filter(Boolean);

  return sentences.slice(0, 5).join(" ");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const attemptId = String(req.body?.attempt_id || "").trim();
  const testSlug = String(req.body?.test_slug || "").trim();
  if (!attemptId || !testSlug) {
    return res.status(400).json({ ok: false, error: "attempt_id and test_slug are required" });
  }

  const { data: attempt, error: attemptError } = await authed.supabaseAdmin
    .from("commercial_attempts")
    .select("id, test_slug, result")
    .eq("id", attemptId)
    .eq("user_id", authed.user.id)
    .maybeSingle();

  if (attemptError) return res.status(400).json({ ok: false, error: attemptError.message });
  if (!attempt) return res.status(404).json({ ok: false, error: "Attempt not found" });
  if (String((attempt as any).test_slug || "").trim() !== testSlug) {
    return res.status(400).json({ ok: false, error: "Attempt does not match test_slug" });
  }

  const { data: row, error: interpretationError } = await authed.supabaseAdmin
    .from("test_interpretations")
    .select("content")
    .eq("test_slug", testSlug)
    .maybeSingle();

  if (interpretationError) return res.status(400).json({ ok: false, error: interpretationError.message });
  const fallback = DEFAULT_TEST_INTERPRETATIONS[testSlug];
  if (!row && fallback === undefined) {
    return res.status(404).json({ ok: false, error: "Interpretation not found" });
  }

  const keys = (row as any)?.content ?? fallback ?? null;
  return res.status(200).json({
    ok: true,
    content: buildBriefInterpretation((attempt as any).result, keys, testSlug),
  });
}
