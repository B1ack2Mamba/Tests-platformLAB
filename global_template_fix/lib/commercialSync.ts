import type { ScoreResult } from "@/lib/score";

export async function saveCommercialAttempt({
  accessToken,
  attemptId,
  testSlug,
  testTitle,
  result,
}: {
  accessToken: string;
  attemptId: string;
  testSlug: string;
  testTitle: string;
  result: ScoreResult;
}) {
  try {
    const resp = await fetch("/api/commercial/attempts/upsert", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        attempt_id: attemptId,
        test_slug: testSlug,
        test_title: testTitle,
        result,
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось сохранить коммерческую попытку");
    return json;
  } catch (error) {
    console.warn("commercial attempt save failed", error);
    return null;
  }
}
