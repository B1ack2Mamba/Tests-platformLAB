import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProjectResultsFlow, type FlowStage } from "@/components/ProjectResultsFlow";
import { ThinkingStatus } from "@/components/ThinkingStatus";
import { isAdminEmail } from "@/lib/admin";
import {
  EVALUATION_PACKAGES,
  getEvaluationPackageDefinition,
  getUpgradePriceRub,
  isPackageAccessible,
  type EvaluationPackage,
} from "@/lib/commercialGoals";
import { formatMonthlySubscriptionPeriod, type WorkspaceSubscriptionStatus } from "@/lib/commercialSubscriptions";
import { getFitRoleProfiles, type FitRoleProfile } from "@/lib/fitProfiles";
import { useSession } from "@/lib/useSession";
import { useWalletBalance } from "@/lib/useWalletBalance";
import type {
  ResultsBlueprint,
  ResultsBlueprintBridgeNode,
  ResultsBlueprintCompetencyNode,
  ResultsBlueprintFinalNode,
  ResultsBlueprintTestNode,
} from "@/lib/projectResultsBlueprint";

type ResultsPagePayload = {
  ok: true;
  fully_done: boolean;
  completed: number;
  total: number;
  collected_at: string | null;
  collect_mode: "view" | "collect";
  project: {
    id: string;
    title: string;
    goal: string;
    status: string | null;
    package_mode: string | null;
    unlocked_package_mode: EvaluationPackage | null;
    target_role: string | null;
    routing_meta: {
      mode: "goal" | "competency";
      competencyIds?: string[];
      selectionLabel?: string | null;
    } | null;
    person: {
      full_name: string | null;
      email: string | null;
      current_position: string | null;
    } | null;
  };
  blueprint: ResultsBlueprint | null;
};

type EvaluationPayload = {
  ok: true;
  fully_done: boolean;
  completed: number;
  total: number;
  unlocked_package_mode?: EvaluationPackage | null;
  evaluation: {
    mode: string;
    sections: Array<{ kind: string; title: string; body: string }>;
  } | null;
};

type SubscriptionStatusResp = {
  ok: boolean;
  error?: string;
  active_subscription?: WorkspaceSubscriptionStatus | null;
};

type DetailNode =
  | { kind: "test"; node: ResultsBlueprintTestNode }
  | { kind: "competency"; node: ResultsBlueprintCompetencyNode }
  | { kind: "bridge"; node: ResultsBlueprintBridgeNode }
  | { kind: "final"; node: ResultsBlueprintFinalNode };

function getThinkingMessages(mode: EvaluationPackage | null) {
  switch (mode) {
    case "premium_ai_plus":
      return [
        "Обрабатываем информацию. Это может занять около 5 минут.",
        "Собираем общий профиль по всем тестам и формируем вывод по запросу.",
        "Проверяем связи между результатами и считаем индекс соответствия.",
        "AI раскладывает рекомендации по развитию и управленческим выводам.",
      ];
    case "premium":
      return [
        "Обрабатываем информацию. Это может занять около 5 минут.",
        "Формируем вывод по каждому тесту и проверяем смысловые связи.",
        "AI догружает данные и собирает интерпретации по разделам.",
      ];
    default:
      return [
        "Подгружаем результат и собираем итоговые показатели.",
        "Сверяем данные проекта и готовим аккуратную выдачу.",
      ];
  }
}

function formatRub(amount: number) {
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

function cleanSectionBody(body: string) {
  return body
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sectionKey(mode: string, index: number) {
  return `${mode}:${index}`;
}

function splitSectionBody(body: string) {
  const clean = cleanSectionBody(body);
  const [preview, ...rest] = clean.split(/\n\n+/);
  return {
    preview: preview || clean,
    details: rest.join("\n\n").trim(),
  };
}

function inferSectionTone(title: string) {
  const value = title.toLowerCase();
  if (value.includes("сильн") || value.includes("ресурс") || value.includes("опора")) return "positive" as const;
  if (value.includes("риск") || value.includes("огранич") || value.includes("зона внимания")) return "warning" as const;
  return "neutral" as const;
}

function promptCoverageLine(blueprint: ResultsBlueprint) {
  const coverage = blueprint.summary.promptCoverage;
  return `Индивидуальных: ${coverage.custom}/${coverage.total} · базовых: ${coverage.default} · выключено: ${coverage.disabled} · пустых: ${coverage.missing}`;
}

function statusLabel(value: string | null | undefined) {
  switch (value) {
    case "completed":
      return "Завершён";
    case "active":
      return "Активен";
    case "draft":
      return "Черновик";
    default:
      return "Проект";
  }
}

function formatCollectedAt(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function stageCountLine(blueprint: ResultsBlueprint) {
  return `Тестов: ${blueprint.tests.length} · компетенций: ${blueprint.competencies.length} · связей: ${blueprint.links.length}`;
}

function getPackageButtonLabel(
  target: EvaluationPackage,
  current: EvaluationPackage | null | undefined,
  isUnlimited: boolean,
  activeSubscription: WorkspaceSubscriptionStatus | null,
  projectCoveredBySubscription: boolean
) {
  if (isUnlimited) return "Открыть бесплатно";
  if (isPackageAccessible(current, target)) return "Открыто";
  if (projectCoveredBySubscription) return "Открыть по тарифу";
  if (activeSubscription && activeSubscription.projects_remaining > 0) return "Открыть по тарифу";
  const upgradeRub = getUpgradePriceRub(current, target);
  if (current) return `Доплатить ${formatRub(upgradeRub)}`;
  return `Оплатить ${formatRub(getEvaluationPackageDefinition(target)?.priceRub || 0)}`;
}

function DetailContent({ detailNode, isAdmin }: { detailNode: DetailNode | null; isAdmin: boolean }) {
  if (!detailNode) {
    return <div className="text-sm leading-7 text-[#6f6454]">Нажми на любой узел в схеме, чтобы увидеть, из чего он собран и какой смысл он сейчас отдаёт наружу.</div>;
  }

  if (detailNode.kind === "test") {
    const badges = detailNode.node.badges.length ? detailNode.node.badges : [detailNode.node.completed ? "Готово" : "Ожидает прохождения"];
    return (
    <Layout title={data?.project.title ? `${data.project.title} — результаты` : "Страница результатов"}>
      <div className="mx-auto max-w-[1340px] px-3 pb-12 pt-5 sm:px-4">
        {error ? <div className="mb-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {info ? <div className="mb-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div> : null}

        <div className="overflow-hidden rounded-[34px] border border-[#dcc8aa] bg-[linear-gradient(180deg,#fffdfa_0%,#fbf6ec_100%)] shadow-[0_26px_60px_rgba(93,71,39,0.08)]">
          <div className="border-b border-[#eadcc5] px-7 py-6 sm:px-8">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto_176px] xl:items-start">
              <div className="min-w-0">
                <div className="font-serif text-[2.05rem] leading-none text-[#4d3b24] sm:text-[2.55rem]">Проект: {data?.project.title || "Результаты проекта"}</div>
                <div className="mt-6 text-[2rem] font-semibold leading-none text-[#2d2a22] sm:text-[2.35rem]">{data?.project.person?.full_name || "Участник проекта"}</div>
                <div className="mt-4 space-y-1 text-[1rem] leading-7 text-[#6f5a42]">
                  <div>Статус: {data?.fully_done ? "Тесты пройдены" : `Готово ${data?.completed || 0} из ${data?.total || 0}`}</div>
                  {collectedLabel ? <div>Результат собран: {collectedLabel}</div> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-start justify-start gap-3 xl:justify-end">
                <button
                  type="button"
                  onClick={() => loadResults(true, { announce: lastCollectedAt ? "Анализ пересобран по всей информации проекта." : "Анализ собран по всей информации проекта." })}
                  disabled={collecting || !data?.fully_done}
                  className="rounded-[18px] border border-[#d9c4a4] bg-[#fffaf0] px-5 py-3 text-[1rem] font-medium text-[#5b4731] shadow-[0_6px_14px_rgba(93,71,39,0.05)] disabled:opacity-60"
                >
                  {collecting ? "Пересобираем анализ" : "Пересобрать анализ"}
                </button>
                <Link href={`/projects/${projectId}`} className="rounded-[18px] border border-[#d9c4a4] bg-[#fffaf0] px-5 py-3 text-[1rem] font-medium text-[#5b4731] shadow-[0_6px_14px_rgba(93,71,39,0.05)]">
                  Назад к проекту
                </Link>
              </div>

              <div className="flex justify-start xl:justify-end">
                <div className="grid h-[136px] w-[136px] place-items-center sm:h-[150px] sm:w-[150px]">
                  <img
                    src={data?.fully_done ? "/result-stamp.svg" : "/result-stamp-bw.svg"}
                    alt={data?.fully_done ? "Результат собран" : "Результат ожидает"}
                    className="h-full w-full object-contain opacity-95"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-7 py-6 sm:px-8">
            {!data?.fully_done ? (
              <div className="rounded-[24px] border border-[#d8c5a8] bg-[#fbf5ea] px-5 py-5 text-sm leading-7 text-[#6f6454]">
                Все уровни анализа откроются после завершения тестов. Сейчас готово {data?.completed || 0} из {data?.total || 0}.
              </div>
            ) : (
              <>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_250px] xl:items-stretch">
                  {EVALUATION_PACKAGES.map((item) => {
                    const unlocked = isPackageAccessible(unlockedMode, item.key);
                    const currentEval = evaluationByMode[item.key];
                    const isBusy = !!saving || !!evaluationLoading[item.key];
                    const accessible = unlocked || isUnlimited || projectCoveredBySubscription || (activeSubscription?.projects_remaining || 0) > 0;
                    const isActive = activeEvaluationMode === item.key;
                    const highlight = item.key === "premium_ai_plus";
                    return (
                      <div
                        key={item.key}
                        className={`flex min-h-[296px] flex-col rounded-[28px] border px-7 py-6 ${highlight ? "border-[#b7cfad] bg-[#f7fbf5]" : "border-[#dfcfb5] bg-[#fffaf2]"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[0.88rem] font-semibold uppercase tracking-[0.2em] text-[#7d5f34]">{item.title}</div>
                          {item.key === "premium" ? <div className="rounded-full bg-[#7f9d73] px-3 py-1 text-xs font-bold text-white">AI</div> : null}
                        </div>

                        <div className="mt-5 text-[1.02rem] leading-9 text-[#6f5a42]">{item.description}</div>

                        {item.key === "premium_ai_plus" ? (
                          <div className="mt-5 text-[#45623d]">
                            <div className="text-[3rem] font-semibold leading-none">99%</div>
                            <div className="mt-2 text-[1.2rem]">Индекс соответствия</div>
                          </div>
                        ) : null}

                        {item.bullets?.length ? (
                          <ul className="mt-6 space-y-3 text-[0.98rem] leading-8 text-[#6f5a42]">
                            {item.bullets.slice(0, 2).map((bullet) => (
                              <li key={bullet} className="flex items-start gap-3"><span className="mt-[11px] h-1.5 w-1.5 rounded-full bg-[#d2bb92]" /><span>{bullet}</span></li>
                            ))}
                          </ul>
                        ) : null}

                        <div className="mt-auto pt-7">
                          {unlocked ? (
                            <button
                              type="button"
                              className={`w-full rounded-[18px] border px-4 py-3 text-[1.02rem] font-medium ${isActive ? "border-[#8eb48d] bg-[#dceecd] text-[#27402b]" : "border-[#d9c4a4] bg-[#fffaf0] text-[#5b4731]"}`}
                              onClick={async () => {
                                setActiveEvaluationMode(item.key);
                                if (!evaluationByMode[item.key] && !evaluationLoading[item.key]) {
                                  await loadEvaluation(item.key, item.key === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined);
                                }
                              }}
                            >
                              {isActive ? "Открыт" : currentEval?.evaluation ? "Открыть" : "Собрать и открыть"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="w-full rounded-[18px] border border-[#7ca36f] bg-[#a8d19d] px-4 py-3 text-[1.02rem] font-semibold text-[#264029] disabled:opacity-60"
                              disabled={isBusy || !accessible}
                              onClick={() => unlockPackage(item.key)}
                            >
                              {getPackageButtonLabel(item.key, unlockedMode, isUnlimited, activeSubscription, projectCoveredBySubscription)}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <aside className="rounded-[28px] border border-[#dfcfb5] bg-[#fffaf2] px-6 py-6">
                    <div className="text-[1.15rem] font-semibold text-[#4d3b24]">Статус анализа</div>
                    <div className="mt-6 space-y-5 text-[1.02rem] leading-8 text-[#6f5a42]">
                      <div>Тестов: {blueprint?.tests.length || 0}</div>
                      <div>Компетенций: {blueprint?.competencies.length || 0}</div>
                      <div>Связей: {blueprint?.links.length || 0}</div>
                      <div>Процент промтов: {coveragePercent}%</div>
                    </div>
                    {collectedLabel ? <div className="mt-8 border-t border-[#ead9bf] pt-5 text-[0.96rem] text-[#7d6953]">Собрано: {collectedLabel}</div> : null}
                  </aside>
                </div>

                {activeEvaluationMode && isPackageAccessible(unlockedMode, activeEvaluationMode) ? (
                  <div className="mt-7 rounded-[30px] border border-[#d7c4a6] bg-[#fffaf2] px-6 py-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ead9bf] pb-4">
                      <div className="flex flex-wrap items-center gap-6 text-[1.02rem] font-medium text-[#786650]">
                        {availablePackages.map((mode) => {
                          const selected = activeEvaluationMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              className={`border-b-2 pb-2 ${selected ? "border-[#8eb48d] text-[#2f4e2f]" : "border-transparent text-[#8f7c64]"}`}
                              onClick={async () => {
                                setActiveEvaluationMode(mode);
                                if (!evaluationByMode[mode] && !evaluationLoading[mode]) {
                                  await loadEvaluation(mode, mode === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined);
                                }
                              }}
                            >
                              {getEvaluationPackageDefinition(mode)?.title || mode}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMechanism((prev) => !prev)}
                        className="rounded-[18px] border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2.5 text-[0.98rem] font-medium text-[#5b4731]"
                      >
                        {showMechanism ? "Скрыть внутренний механизм" : "Показать внутренний механизм"}
                      </button>
                    </div>

                    <div className={`mt-6 grid gap-6 ${showMechanism && blueprint ? "xl:grid-cols-[minmax(0,1.5fr)_360px]" : ""}`}>
                      <div className="min-w-0">
                        {evaluationLoading[activeEvaluationMode] ? (
                          <ThinkingStatus title={activeEvaluationMode === "premium_ai_plus" ? "AI+ формирует профиль" : activeEvaluationMode === "premium" ? "AI формирует интерпретацию" : "Собираем результат"} messages={getThinkingMessages(activeEvaluationMode)} />
                        ) : activeSections.length ? (
                          <div className="rounded-[24px] border border-[#e2d1b6] bg-white/70 p-6">
                            <div className="text-[2.2rem] font-semibold leading-tight text-[#4d3b24]">Итоговый аналитический вывод</div>

                            {activeEvaluationMode === "premium_ai_plus" ? (
                              <div className="mt-5">
                                <button
                                  type="button"
                                  onClick={() => setShowAiPlusPrompt((prev) => !prev)}
                                  className="rounded-[18px] border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2.5 text-sm font-medium text-[#5b4731]"
                                >
                                  {showAiPlusPrompt ? "Скрыть уточнение AI+" : "Уточнить AI+"}
                                </button>
                                {showAiPlusPrompt ? (
                                  <div className="mt-4 rounded-[22px] border border-[#e2d1b6] bg-[#fcf7ef] p-4">
                                    <div className="text-sm font-semibold text-[#2d2a22]">Дополнительный запрос для AI+</div>
                                    <div className="mt-1 text-sm text-[#8d7860]">Можно уточнить акцент итогового профиля и отдельно включить индекс соответствия.</div>
                                    <div className="mt-3 grid gap-3">
                                      <textarea className="input min-h-[92px]" value={aiPlusRequest} onChange={(e) => setAiPlusRequest(e.target.value)} placeholder="Например: сделай акцент на управленческий потенциал, стиле взаимодействия и зонах риска." />
                                      <div className="flex justify-end">
                                        <button type="button" className="rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029]" disabled={!!evaluationLoading.premium_ai_plus} onClick={() => loadEvaluation("premium_ai_plus", { customRequest: aiPlusRequest })}>
                                          {evaluationLoading.premium_ai_plus ? "Собираем…" : "Обновить AI+"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {overviewCards.length ? (
                              <div className={`mt-6 grid gap-5 ${overviewCards.length > 1 ? "lg:grid-cols-2" : ""}`}>
                                {overviewCards.map((section, index) => {
                                  const key = sectionKey(`${activeEvaluationMode}:overview`, index);
                                  const isOpen = openSections[key] ?? false;
                                  const parts = splitSectionBody(section.body);
                                  const tone = inferSectionTone(section.title);
                                  const toneClass = tone === "positive" ? "bg-[#f5fbf2] border-[#c7debd]" : tone === "warning" ? "bg-[#fff9f0] border-[#ead7b6]" : "bg-[#fffdf8] border-[#ead9bf]";
                                  return (
                                    <div key={`${section.title}:${index}`} className={`rounded-[22px] border p-5 ${toneClass}`}>
                                      <div className="text-[1.6rem] font-semibold text-[#4d3b24]">{section.title}</div>
                                      <div className="mt-4 whitespace-pre-line text-[1.02rem] leading-8 text-[#6f5a42]">{parts.preview}</div>
                                      {parts.details ? (
                                        <button type="button" className="mt-4 text-sm font-medium text-[#8b6b3c]" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !isOpen }))}>
                                          {isOpen ? "Скрыть детали" : "Подробнее"}
                                        </button>
                                      ) : null}
                                      {parts.details && isOpen ? <div className="mt-3 border-t border-[#ead9bf] pt-3 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{parts.details}</div> : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}

                            {testSections.length ? (
                              <div className="mt-6 rounded-[22px] border border-[#ead9bf] bg-[#fffdf8] p-4">
                                <div className="text-lg font-semibold text-[#4d3b24]">Подробности по отдельным тестам</div>
                                <div className="mt-4 grid gap-3">
                                  {testSections.map((section, index) => {
                                    const key = sectionKey(activeEvaluationMode, index);
                                    const isOpen = openSections[key] ?? index === 0;
                                    return (
                                      <div key={key} className="overflow-hidden rounded-[20px] border border-[#e2d1b6] bg-white/80">
                                        <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !(prev[key] ?? index === 0) }))}>
                                          <div className="text-sm font-semibold text-[#2d2a22]">{section.title}</div>
                                          <span className="text-xs text-[#8b6b3c]">{isOpen ? "Скрыть" : "Открыть"}</span>
                                        </button>
                                        {isOpen ? <div className="border-t border-[#ead9bf] px-4 py-4 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{cleanSectionBody(section.body)}</div> : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-[22px] border border-[#e1d3bf] bg-[#fcf7ef] p-4 text-sm text-[#6f6454]">Результат для этого уровня пока не собран. Выбери уровень и нажми сборку.</div>
                        )}
                      </div>

                      {showMechanism && blueprint ? (
                        <div className="min-w-0 space-y-4">
                          <div className="rounded-[22px] border border-[#e2d1b6] bg-white/75 p-4 text-sm leading-7 text-[#6f6454]">
                            <div className="text-base font-semibold text-[#4d3b24]">Внутренний механизм</div>
                            <div className="mt-2">{stageCountLine(blueprint)}</div>
                            <div className="mt-1">{promptCoverageLine(blueprint)}</div>
                          </div>
                          <div className="rounded-[22px] border border-[#e2d1b6] bg-white/80 p-4">
                            <ProjectResultsFlow stages={stages} links={blueprint.links} selectedId={selectedId} onSelect={setSelectedId} />
                          </div>
                          <aside className="rounded-[22px] border border-[#e2d1b6] bg-white/80 p-4">
                            <DetailContent detailNode={detailNode} isAdmin={isAdminEmail(user.email)} />
                          </aside>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
