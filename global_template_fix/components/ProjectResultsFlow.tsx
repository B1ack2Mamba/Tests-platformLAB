import { useEffect, useMemo, useRef, useState } from "react";
import type { ResultsBlueprintLink, ResultsBlueprintTone } from "@/lib/projectResultsBlueprint";

export type FlowStageNode = {
  id: string;
  title: string;
  body?: string;
  badges?: string[];
  meta?: string;
  footer?: string;
  tone?: ResultsBlueprintTone;
};

export type FlowStage = {
  id: string;
  title: string;
  caption?: string;
  nodes: FlowStageNode[];
};

type Props = {
  stages: FlowStage[];
  links: ResultsBlueprintLink[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

type RenderPath = {
  key: string;
  d: string;
  tone: ResultsBlueprintTone;
};

function toneStyles(tone: ResultsBlueprintTone | undefined) {
  switch (tone) {
    case "ready":
      return {
        border: "border-[#8fb48f]",
        bg: "bg-[linear-gradient(180deg,#f7fff6_0%,#eef8ec_100%)]",
        chip: "bg-[#e6f3e3] text-[#355039] border-[#bfd8bf]",
      };
    case "attention":
      return {
        border: "border-[#d6b98a]",
        bg: "bg-[linear-gradient(180deg,#fff9f0_0%,#fff1dc_100%)]",
        chip: "bg-[#fff3e1] text-[#7b5a2b] border-[#e4c79d]",
      };
    case "muted":
      return {
        border: "border-[#e4d7c4]",
        bg: "bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe5_100%)]",
        chip: "bg-[#f5ecde] text-[#8f7d65] border-[#e4d7c4]",
      };
    case "neutral":
    default:
      return {
        border: "border-[#d8c7ab]",
        bg: "bg-[linear-gradient(180deg,#fffaf2_0%,#f8f1e7_100%)]",
        chip: "bg-[#f4ecdf] text-[#6f5a42] border-[#e2d3bb]",
      };
  }
}

function linkColor(tone: ResultsBlueprintTone) {
  switch (tone) {
    case "ready":
      return "rgba(102, 145, 103, 0.72)";
    case "attention":
      return "rgba(184, 133, 62, 0.62)";
    case "muted":
      return "rgba(173, 155, 127, 0.35)";
    case "neutral":
    default:
      return "rgba(133, 112, 80, 0.46)";
  }
}

function nodeCountLabel(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} узел`;
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return `${count} узла`;
  return `${count} узлов`;
}

export function ProjectResultsFlow({ stages, links, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [paths, setPaths] = useState<RenderPath[]>([]);

  const flattenedIds = useMemo(() => stages.flatMap((stage) => stage.nodes.map((node) => node.id)), [stages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    const recompute = () => {
      const isDesktop = window.innerWidth >= 1024;
      if (!isDesktop) {
        setPaths([]);
        return;
      }
      const hostRect = container.getBoundingClientRect();
      const next: RenderPath[] = [];
      for (const link of links) {
        const from = nodeRefs.current[link.from];
        const to = nodeRefs.current[link.to];
        if (!from || !to) continue;
        const fromRect = from.getBoundingClientRect();
        const toRect = to.getBoundingClientRect();
        if (!fromRect.width || !toRect.width) continue;
        const startX = fromRect.right - hostRect.left;
        const startY = fromRect.top + fromRect.height / 2 - hostRect.top;
        const endX = toRect.left - hostRect.left;
        const endY = toRect.top + toRect.height / 2 - hostRect.top;
        const bend = Math.max(42, (endX - startX) * 0.42);
        next.push({
          key: `${link.from}->${link.to}`,
          tone: link.tone,
          d: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
        });
      }
      setPaths(next);
    };

    recompute();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => recompute()) : null;
    resizeObserver?.observe(container);
    flattenedIds.forEach((id) => {
      const node = nodeRefs.current[id];
      if (node) resizeObserver?.observe(node);
    });
    window.addEventListener("resize", recompute);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [flattenedIds, links]);

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-[30px] border border-[#dbc8ab] bg-[linear-gradient(180deg,#fffdfa_0%,#f7f0e6_100%)] p-4 shadow-[0_24px_54px_rgba(93,71,39,0.10)] sm:p-5 lg:p-6">
      {paths.length ? (
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" aria-hidden="true">
          {paths.map((path) => (
            <path
              key={path.key}
              d={path.d}
              fill="none"
              stroke={linkColor(path.tone)}
              strokeWidth={path.tone === "ready" ? 2.2 : 1.8}
              strokeDasharray={path.tone === "muted" ? "6 8" : undefined}
              strokeLinecap="round"
            />
          ))}
        </svg>
      ) : null}

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#eadcc6] pb-4">
        <div>
          <div className="text-sm font-semibold text-[#2d2a22]">Карта взаимосвязей</div>
          <div className="mt-1 text-xs leading-5 text-[#8b7760]">Слева исходные тесты, дальше компетенции и промежуточные блоки, справа верхний итог.</div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-[#6f5a42]">
          <span className="rounded-full border border-[#bfd8bf] bg-[#e6f3e3] px-3 py-1">Индивидуальный prompt</span>
          <span className="rounded-full border border-[#e2d3bb] bg-[#f4ecdf] px-3 py-1">Базовый шаблон</span>
          <span className="rounded-full border border-[#e4c79d] bg-[#fff3e1] px-3 py-1">Нужно внимание</span>
          <span className="rounded-full border border-[#e4d7c4] bg-[#f5ecde] px-3 py-1">Ещё не собрано</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4 lg:items-start xl:gap-5">
        {stages.map((stage, stageIndex) => (
          <section key={stage.id} className="relative rounded-[24px] border border-[#eadcc6] bg-white/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] lg:min-h-[260px]">
            <div className="mb-3 flex items-start gap-3 border-b border-[#efe3cf] pb-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d9c7aa] bg-[#fff7eb] text-sm font-semibold text-[#7b6240]">
                {stageIndex + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-[#2d2a22]">{stage.title}</div>
                  <span className="rounded-full border border-[#e2d3bb] bg-[#f4ecdf] px-2.5 py-1 text-[11px] text-[#6f5a42]">{nodeCountLabel(stage.nodes.length)}</span>
                </div>
                {stage.caption ? <div className="mt-1 text-xs leading-5 text-[#8b7760]">{stage.caption}</div> : null}
              </div>
            </div>

            <div className="grid gap-3">
              {stage.nodes.map((node) => {
                const tone = toneStyles(node.tone || "neutral");
                const selected = node.id === selectedId;
                return (
                  <button
                    key={node.id}
                    ref={(element) => {
                      nodeRefs.current[node.id] = element;
                    }}
                    type="button"
                    onClick={() => onSelect?.(node.id)}
                    className={`group relative overflow-hidden rounded-[22px] border px-4 py-3 text-left transition ${tone.border} ${tone.bg} ${selected ? "ring-2 ring-[#7ca36f]/50 shadow-[0_12px_28px_rgba(78,116,67,0.18)]" : "shadow-[0_8px_18px_rgba(93,71,39,0.08)] hover:-translate-y-[1px]"}`}
                  >
                    <div className="absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.92),transparent)]" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[0.95rem] font-semibold leading-6 text-[#2d2a22]">{node.title}</div>
                        {node.meta ? <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">{node.meta}</div> : null}
                      </div>
                    </div>
                    {node.body ? <div className="mt-2 text-sm leading-6 text-[#6f6454]">{node.body}</div> : null}
                    {node.badges?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {node.badges.map((badge) => (
                          <span key={badge} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone.chip}`}>
                            {badge}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {node.footer ? <div className="mt-3 text-xs leading-5 text-[#8b7760]">{node.footer}</div> : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
