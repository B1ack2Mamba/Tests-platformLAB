/* eslint-disable react-hooks/exhaustive-deps, @next/next/no-img-element */
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { OnboardingTour, type OnboardingStep } from "@/components/OnboardingTour";
import { useSession } from "@/lib/useSession";
import { COMMERCIAL_GOALS, getGoalDefinition, type AssessmentGoal } from "@/lib/commercialGoals";
import { COMPETENCY_ROUTES, getCompetencyLongLabel } from "@/lib/competencyRouter";
import { FOLDER_ICONS, getFolderIcon, type FolderIconKey } from "@/lib/folderIcons";
import { useWallet } from "@/lib/useWallet";
import { isAdminEmail, isGlobalTemplateOwnerEmail } from "@/lib/admin";
import { FOLDER_TEMPLATE_ID, PROJECT_TEMPLATE_ID, pickSceneStandard, pickTemplatePositions as pickGlobalDeskTemplates } from "@/lib/globalDeskTemplate";
import { type WorkspaceSubscriptionStatus } from "@/lib/commercialSubscriptions";
import { formatEstimatedMinutes, getTestEstimatedMinutes, getTotalEstimatedMinutes } from "@/lib/testTitles";

type DashboardPayload = {
  profile: {
    full_name: string | null;
    company_name: string | null;
    email: string | null;
  } | null;
  stats: {
    attempts_count: number;
    unique_tests_count: number;
  };
};

type FolderRow = {
  id: string;
  name: string;
  icon_key: string | null;
  sort_order: number;
  created_at: string;
};

type ProjectRow = {
  id: string;
  title: string;
  goal: AssessmentGoal;
  package_mode: string;
  target_role: string | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
  registry_comment_updated_at?: string | null;
  folder_id: string | null;
  person: { id: string; full_name: string; email: string | null; current_position: string | null; updated_at?: string | null } | null;
  tests: Array<{ test_slug: string; test_title: string; sort_order: number }>;
  attempts_count: number;
};

type WorkspacePayload = {
  ok: true;
  workspace: { workspace_id: string; role: string; name: string };
  folders: FolderRow[];
  projects: ProjectRow[];
};

type DashboardBootstrapPayload = DashboardPayload &
  WorkspacePayload & {
    ok: true;
    active_subscription: WorkspaceSubscriptionStatus | null;
    shared_scene_standard?: {
      positions?: DeskPositions;
      widgets?: SceneWidget[];
      trayGuideText?: string;
    } | null;
  };

type CandidateComparisonPayload = {
  ok: true;
  summary: string;
  competency_summary?: string;
  selected_competency_ids?: string[];
  selected_competency_label?: string;
  ranking: Array<{
    project_id: string | null;
    name: string;
    baseline_index: number;
    calibrated_index: number;
    focus_score?: number;
    delta: number;
    best_for: string[];
    main_risks: string[];
    comparison_line: string;
  }>;
  domain_leaders: Array<{
    domain: string;
    label: string;
    leader_project_id: string | null;
    leader_name: string | null;
    leader_score: number | null;
    runner_up_project_id: string | null;
    runner_up_name: string | null;
    runner_up_score: number | null;
    gap: number | null;
    lead_type: string;
    top_three: Array<{ project_id: string | null; name: string; score: number }>;
  }>;
  competency_leaders: Array<{
    competency_id: string;
    competency_name: string;
    competency_cluster: string;
    leader_project_id: string | null;
    leader_name: string | null;
    leader_score: number | null;
    gap: number | null;
    lead_type: string;
    top_three: Array<{ project_id: string | null; name: string; score: number; level?: string | null; confidence?: string | null }>;
  }>;
  winner_board: Array<{
    project_id: string | null;
    name: string;
    calibrated_index: number;
    baseline_index: number;
    total_wins: number;
    domain_wins: number;
    competency_wins: number;
    lead_competencies: string[];
    lead_domains: string[];
  }>;
  best_candidate_ai?: {
    winner_name: string;
    winner_project_id: string | null;
    summary: string;
    rationale?: string;
  } | null;
  candidate_briefs?: Array<{
    project_id: string | null;
    name: string;
    summary: string;
  }>;
};

type AssemblyAiProvider = "openai" | "deepseek";
type AssemblyAiMode = "message" | "folder_analysis" | "project_message";
type AssemblyAiContextScope = "folder" | "loose" | "none";
type AssemblyAiFolderTarget = "folder" | "person";
type AssemblyAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};
type AssemblyAiInsight =
  | {
      type: "folder";
      title: string;
      subtitle?: string;
      summary?: string;
      focus?: string;
      ranking?: Array<{ project_id: string; name: string; score: number | null; place: number; verdict: string; reason?: string }>;
      competency_leaders?: Array<{
        id: string;
        name: string;
        cluster: string;
        leader_name: string;
        leader_score: number | null;
        top: Array<{ project_id: string; name: string; score: number }>;
      }>;
    }
  | {
      type: "person";
      title: string;
      subtitle?: string;
      summary?: string;
      focus?: string;
      person: {
        project_id: string;
        name: string;
        score: number | null;
        verdict: string;
        strengths: string[];
        risks: string[];
        questions: string[];
        top_competencies: Array<{ id: string; name: string; cluster: string; score: number; level: string }>;
        low_competencies: Array<{ id: string; name: string; cluster: string; score: number; level: string }>;
      };
    };
type AssemblyAiChat = {
  id: string;
  title: string;
  updatedAt: string;
  provider: AssemblyAiProvider;
  model: string;
  contextScope: AssemblyAiContextScope;
  folderId: string | null;
  projectId: string | null;
  analysisAnchor?: {
    mode: "folder_analysis" | "project_message";
    contextScope: "folder" | "loose";
    folderId: string | null;
    projectId: string | null;
    signature: string;
    serverSignature?: string;
  } | null;
  contextLabel: string;
  lastUserMessage: string;
  messages: AssemblyAiMessage[];
  insight: AssemblyAiInsight | null;
};

type DeskPosition = {
  x: number;
  y: number;
  z: number;
  width?: number;
  height?: number;
  rotation?: number;
  tiltX?: number;
  tiltY?: number;
  clipTlx?: number;
  clipTly?: number;
  clipTrx?: number;
  clipTry?: number;
  clipBrx?: number;
  clipBry?: number;
  clipBlx?: number;
  clipBly?: number;
};
type DeskPositions = Record<string, DeskPosition>;
type DeskItemKind = "folder" | "project" | "guide" | "device" | "panel";
type DeskItemInteractionMode = "drag" | "resize" | "rotate";
type DeskItemInteractionState = {
  id: string;
  kind: DeskItemKind;
  mode: DeskItemInteractionMode;
  startX: number;
  startY: number;
  position: DeskPosition;
};

type SceneWidgetKind = "text" | "button" | "image" | "video";
type SceneWidgetAction = "createProject" | "createFolder" | "openCatalog" | "openProjectAssembly" | "none";
type SceneWidgetTone = "marker" | "note" | "buttonPrimary" | "buttonSecondary" | "buttonSketch" | "scheme";
type DesktopVariant = "scheme" | "classic" | "assembly";
type ClassicViewMode = "desktop" | "sheet";
type ClassicSheetKindFilter = "all" | "folder" | "project";
type ClassicSheetPlaceFilter = "all" | "desktop" | "folder";
type TrashItemKind = "folder" | "project";

type TrashEntry = {
  kind: TrashItemKind;
  id: string;
  title: string;
  deletedAt: number;
  expiresAt: number;
};

type SceneWidget = {
  id: string;
  kind: SceneWidgetKind;
  text: string;
  src?: string;
  action?: SceneWidgetAction;
  tone?: SceneWidgetTone;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize: number;
  z: number;
};

type LayoutBackupSnapshot = {
  id: string;
  createdAt: string;
  label: string;
  workspaceId: string;
  variant: DesktopVariant;
  classicViewMode: ClassicViewMode;
  deskPositions: DeskPositions;
  sceneWidgets: SceneWidget[];
  trayGuideText: string;
  roomLight: "normal" | "dimmed";
  roomSwitchPosition: { x: number; y: number };
};

type WidgetInteractionMode = "drag" | "resize" | "rotate";
type WidgetInteractionState = {
  id: string;
  mode: WidgetInteractionMode;
  startX: number;
  startY: number;
  widget: SceneWidget;
};

const DESK_WIDTH = 1400;
const DESK_HEIGHT = 760;
const OFFICE_SCENE_WIDTH = 1400;
const OFFICE_SCENE_HEIGHT = 920;
const DESK_FOLDER_WIDTH = 164;
const DESK_FOLDER_HEIGHT = 142;
const DESK_SHEET_WIDTH = 184;
const DESK_SHEET_HEIGHT = 132;
const DESK_STORAGE_PREFIX = "commercialDeskLayout:v1835:";
const GLOBAL_DESK_TEMPLATE_STORAGE_KEY = "commercialGlobalDeskTemplate:v1839";
const SCENE_WIDGETS_STORAGE_PREFIX = "commercialSceneWidgets:v1840:";
const DESKTOP_VARIANT_STORAGE_PREFIX = "commercialDesktopVariant:v1841:";
const ROOM_LIGHT_STORAGE_PREFIX = "commercialRoomLight:v1842:";
const ROOM_SWITCH_STORAGE_PREFIX = "commercialRoomSwitch:v1843:";
const CLASSIC_VIEW_MODE_STORAGE_PREFIX = "commercialClassicViewMode:v1844:";
const TRAY_GUIDE_TEXT_STORAGE_PREFIX = "commercialTrayGuideText:v1836:";
const TRASH_STORAGE_PREFIX = "commercialTrash:v18365:";
const LAYOUT_BACKUP_STORAGE_PREFIX = "commercialLayoutBackups:v1:";
const ASSEMBLY_AI_CHATS_STORAGE_PREFIX = "commercialAssemblyAiChats:v1:";
const MAX_LAYOUT_BACKUPS = 8;
const DASHBOARD_FIRST_LOGIN_ONBOARDING_KEY = "dashboard-first-login-onboarding";
const DASHBOARD_POST_PROJECT_TRASH_HINT_KEY = "dashboard-post-project-trash-hint";
const DASHBOARD_TRASH_HINT_SHOWN_KEY = "dashboard-trash-hint-shown";
const TRASH_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
const ASSEMBLY_PROJECT_LIMIT = 20;
const BOARD_ZONE = { x: 238, y: 124, width: 770, height: 214 };
const TRAY_ZONE = { x: 1042, y: 520, width: 246, height: 168 };
const TRAY_CLIP = { x: 1050, y: 526, width: 226, height: 124 };
const SHEET_ZONE = { x: 110, y: 618, width: 760, height: 110 };
const TRASH_ZONE = { x: 16, y: 434, width: 160, height: 180 };
const DEFAULT_ROOM_SWITCH_ZONE = { x: 48, y: 248, width: 136, height: 116 };
const ROOM_DIM_HOTSPOT = { x: 42, y: 386, width: 188, height: 94 };
const ROOM_SWITCH_STANDARD_ID = "scene:roomSwitch";
const LAPTOP_DEVICE_ID = "scene:deskLaptop";
const LAPTOP_PANEL_ID = "scene:deskLaptopPanel";
const SHARED_SCENE_POSITION_IDS = new Set([ROOM_SWITCH_STANDARD_ID, LAPTOP_DEVICE_ID, LAPTOP_PANEL_ID]);
const TRAY_GUIDE_ID = "guide:tray";
const TRASH_GUIDE_ID = "guide:trash";
const DESK_TEMPLATE_IDS = new Set([FOLDER_TEMPLATE_ID, PROJECT_TEMPLATE_ID, TRAY_GUIDE_ID, TRASH_GUIDE_ID]);
const DEFAULT_LAPTOP_POSITION: DeskPosition = { x: 936, y: 432, width: 372, height: 248, z: 24, rotation: -5.4, tiltX: 0, tiltY: 0 };
const DEFAULT_LAPTOP_PANEL_POSITION: DeskPosition = { x: 1004, y: 469, width: 226, height: 132, z: 26, rotation: -5.4, tiltX: 0, tiltY: 0 };
const CERTIFICATE_PSI_PROFILE_ID = "certificate-psi-profile";
const CERTIFICATE_COGITO_ID = "certificate-cogito-centre";
const CERTIFICATE_WIDGET_IDS = new Set([CERTIFICATE_PSI_PROFILE_ID, CERTIFICATE_COGITO_ID]);
const AI_CHAT_BOARD_ID = "ai-chat-board";
const AI_CHAT_BOARD_SRC = "/dashboard-ai-chat-board-transparent.png";
const PROJECT_ASSEMBLY_GUIDE_ID = "project-assembly-guide";
const PROJECT_ASSEMBLY_GUIDE_SRC = "/dashboard-guide.webm";
const ASSEMBLY_AI_MAX_OUTPUT_TOKENS = 11776;
const ASSEMBLY_AI_OPENAI_MODELS = [
  { id: "gpt-5.4-mini", label: "OpenAI 5.4 mini" },
  { id: "gpt-5.5", label: "OpenAI 5.5" },
];
const ASSEMBLY_AI_DEEPSEEK_MODELS = [
  { id: "deepseek-v4-flash", label: "DeepSeek обычная" },
  { id: "deepseek-v4-pro", label: "DeepSeek Pro" },
];

const DASHBOARD_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: "dashboard-create-project",
    title: "Создать проект",
    body: "Нажмите кнопку «Создать проект». Она открывает форму, где вводятся данные кандидата, цель оценки и набор тестов.",
    placement: "bottom",
  },
  {
    target: "dashboard-trash",
    title: "Корзина",
    body: "Если удалить проект, он ещё 3 дня хранится в корзине. В любой момент за эти 3 дня его можно открыть здесь и восстановить.",
    placement: "right",
  },
  {
    target: "dashboard-create-folder",
    title: "Создать папку",
    body: "Эта стойка создаёт папку проектов. Папки нужны, чтобы собрать несколько кандидатов по одной вакансии или клиенту, а потом сравнить их общей оценкой.",
    placement: "left",
  },
  {
    target: "dashboard-wallet-link",
    title: "Кошелёк и тариф",
    body: "Здесь видно баланс и активный пакет. Нажмите «Кошелёк», чтобы пополнить баланс или подключить месячный пакет проектов.",
    placement: "left",
  },
];


type DeskRect = { left: number; top: number; right: number; bottom: number };

function getDeskRect(position: Partial<DeskPosition>, fallbackWidth: number, fallbackHeight: number, inset = 0): DeskRect {
  const width = Math.max(0, Number(position.width ?? fallbackWidth));
  const height = Math.max(0, Number(position.height ?? fallbackHeight));
  const left = Number(position.x ?? 0) + inset;
  const top = Number(position.y ?? 0) + inset;
  const right = left + Math.max(0, width - inset * 2);
  const bottom = top + Math.max(0, height - inset * 2);
  return { left, top, right, bottom };
}

function rectsOverlap(a: DeskRect, b: DeskRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function keepRectOutOfBlockedZone(itemRect: DeskRect, blockedRect: DeskRect, bounds: { minX: number; minY: number; maxX: number; maxY: number }) {
  if (!rectsOverlap(itemRect, blockedRect)) {
    return { x: itemRect.left, y: itemRect.top };
  }

  const width = itemRect.right - itemRect.left;
  const height = itemRect.bottom - itemRect.top;
  const candidates = [
    { x: blockedRect.left - width - 12, y: itemRect.top },
    { x: blockedRect.right + 12, y: itemRect.top },
    { x: itemRect.left, y: blockedRect.top - height - 12 },
    { x: itemRect.left, y: blockedRect.bottom + 12 },
  ].map((candidate) => ({
    x: clampDesk(candidate.x, bounds.minX, bounds.maxX),
    y: clampDesk(candidate.y, bounds.minY, bounds.maxY),
  }));

  const valid = candidates.find((candidate) => !rectsOverlap({ left: candidate.x, top: candidate.y, right: candidate.x + width, bottom: candidate.y + height }, blockedRect));
  if (valid) return valid;

  return {
    x: clampDesk(itemRect.left, bounds.minX, bounds.maxX),
    y: clampDesk(blockedRect.bottom + 12, bounds.minY, bounds.maxY),
  };
}

function getSubscriptionDaysLeft(expiresAt: string | null | undefined) {
  if (!expiresAt) return null;
  const target = new Date(expiresAt).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = target - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const GOAL_ORDER = Object.fromEntries(COMMERCIAL_GOALS.map((item, index) => [item.key, index + 1])) as Record<AssessmentGoal, number>;

function sortProjects(list: ProjectRow[]) {
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

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "PR";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function getEntityTilt(seedSource: string, spread = 4) {
  const seed = Array.from(seedSource).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ((seed % (spread * 2 + 1)) - spread) * 1.2;
}

function DesktopLoadingOverlay() {
  return (
    <div className="dashboard-desktop-loader absolute inset-0 z-[220] flex items-center justify-center">
      <div className="dashboard-desktop-loader-card">
        <div className="dashboard-desktop-loader-spinner" aria-hidden="true" />
        <div className="text-sm font-semibold text-slate-900">Собираем рабочий стол</div>
      </div>
    </div>
  );
}

function MobileDashboardHome({
  displayName,
  workspaceName,
  balanceText,
  activeSubscription,
  projects,
  folders,
  trashCount,
  loading,
  error,
  onCreateProject,
  onCreateFolder,
  onOpenTrash,
  onOpenProject,
}: {
  displayName: string;
  workspaceName: string;
  balanceText: string;
  activeSubscription: WorkspaceSubscriptionStatus | null;
  projects: ProjectRow[];
  folders: FolderRow[];
  trashCount: number;
  loading: boolean;
  error: string;
  onCreateProject: () => void;
  onCreateFolder: () => void;
  onOpenTrash: () => void;
  onOpenProject: (id: string) => void;
}) {
  const recentProjects = projects.slice(0, 6);
  const completedProjects = projects.filter((project) => {
    const total = project.tests?.length || 0;
    return total > 0 && (project.attempts_count || 0) >= total;
  }).length;

  return (
    <div className="mobile-dashboard-home lg:hidden">
      <div className="space-y-4">
        {error ? <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <section className="rounded-[26px] border border-[#d7e4dc] bg-[linear-gradient(180deg,#ffffff_0%,#eef8f1_100%)] p-4 shadow-[0_18px_34px_-28px_rgba(22,78,55,0.18)]">
          <div className="text-[11px] font-semibold uppercase text-[#527261]">Кабинет специалиста</div>
          <div className="mt-2 text-[24px] font-semibold leading-tight text-[#183f31]">{displayName}</div>
          <div className="mt-1 text-sm leading-5 text-[#5a7468]">{workspaceName}</div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-[18px] border border-white/80 bg-white/88 px-3 py-3">
              <div className="text-[11px] text-[#667c72]">Проекты</div>
              <div className="mt-1 text-xl font-semibold text-[#183f31]">{projects.length}</div>
            </div>
            <div className="rounded-[18px] border border-white/80 bg-white/88 px-3 py-3">
              <div className="text-[11px] text-[#667c72]">Готово</div>
              <div className="mt-1 text-xl font-semibold text-[#183f31]">{completedProjects}</div>
            </div>
            <div className="rounded-[18px] border border-white/80 bg-white/88 px-3 py-3">
              <div className="text-[11px] text-[#667c72]">Баланс</div>
              <div className="mt-1 truncate text-xl font-semibold text-[#183f31]">{balanceText}</div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <button type="button" data-onboarding-id="dashboard-create-project" className="btn btn-primary h-12 justify-center" onClick={onCreateProject}>
            Создать проект
          </button>
          <Link href="/wallet" data-onboarding-id="dashboard-wallet-link" className="btn btn-secondary h-12 justify-center">
            Кошелёк
          </Link>
          <button type="button" data-onboarding-id="dashboard-create-folder" className="btn btn-secondary h-12 justify-center" onClick={onCreateFolder}>
            Создать папку
          </button>
          <Link href="/assessments" className="btn btn-secondary h-12 justify-center">
            Каталог тестов
          </Link>
          <Link href="/results" className="btn btn-secondary h-12 justify-center">
            История тестов
          </Link>
          <button type="button" data-onboarding-id="dashboard-trash" className="btn btn-secondary h-12 justify-center" onClick={onOpenTrash}>
            Корзина{trashCount ? ` · ${trashCount}` : ""}
          </button>
        </section>

        {activeSubscription ? (
          <section className="rounded-[22px] border border-[#d7e3ee] bg-white px-4 py-3">
            <div className="text-sm font-semibold text-[#223548]">{activeSubscription.plan_title}</div>
            <div className="mt-1 text-xs leading-5 text-[#64788c]">
              Осталось проектов: {activeSubscription.projects_remaining} из {activeSubscription.projects_limit}. До завершения: {getSubscriptionDaysLeft(activeSubscription.expires_at) ?? 0} дн.
            </div>
          </section>
        ) : null}

        <section className="rounded-[24px] border border-[#d5deea] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-[#223548]">Проекты</div>
              <div className="mt-1 text-xs text-[#6c7d8f]">{folders.length ? `${folders.length} папок` : "Без папок"} · последние проекты сверху</div>
            </div>
            {loading ? <div className="text-xs text-[#6c7d8f]">Загрузка…</div> : null}
          </div>

          <div className="mt-3 space-y-2">
            {recentProjects.length ? recentProjects.map((project) => {
              const total = project.tests?.length || 0;
              const completed = Math.min(project.attempts_count || 0, total || 0);
              const goal = getGoalDefinition(project.goal);
              return (
                <button
                  key={project.id}
                  type="button"
                  className="w-full rounded-[18px] border border-[#e1e8ef] bg-[#fbfdff] px-4 py-3 text-left transition hover:border-[#b9c9db]"
                  onClick={() => onOpenProject(project.id)}
                >
                  <div className="text-sm font-semibold leading-tight text-[#1f3142]">{project.person?.full_name || project.title || "Проект"}</div>
                  <div className="mt-1 text-xs leading-5 text-[#607386]">{goal?.shortTitle || goal?.title || project.goal}{project.target_role ? ` · ${project.target_role}` : ""}</div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e9eff5]">
                    <div className="h-full rounded-full bg-[#4d9b72]" style={{ width: total ? `${Math.round((completed / total) * 100)}%` : "0%" }} />
                  </div>
                  <div className="mt-1 text-xs text-[#6c7d8f]">{completed} из {total || 0} тестов пройдено</div>
                </button>
              );
            }) : (
              <div className="rounded-[18px] border border-dashed border-[#cfdbe7] bg-[#fbfdff] px-4 py-5 text-sm leading-6 text-[#6f8193]">
                Проектов пока нет. Начните с кнопки «Создать проект».
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function getStickyNoteTone(goal: AssessmentGoal) {
  switch (goal) {
    case "motivation":
      return "sticky-note-gold";
    case "general_assessment":
      return "sticky-note-mint";
    case "management_potential":
    case "leadership":
      return "sticky-note-blue";
    case "team_interaction":
    case "communication_influence":
      return "sticky-note-peach";
    case "self_organization":
    case "learning_agility":
      return "sticky-note-lilac";
    case "emotional_regulation":
      return "sticky-note-rose";
    default:
      return "sticky-note-cream";
  }
}

function goalColor(goal: AssessmentGoal) {
  switch (goal) {
    case "motivation":
      return "from-emerald-200 to-green-100 text-emerald-950 border-emerald-300";
    case "general_assessment":
      return "from-teal-200 to-emerald-100 text-teal-950 border-teal-300";
    case "management_potential":
    case "leadership":
      return "from-sky-200 to-cyan-100 text-sky-950 border-sky-300";
    case "team_interaction":
    case "communication_influence":
      return "from-amber-200 to-yellow-100 text-amber-950 border-amber-300";
    case "self_organization":
    case "learning_agility":
      return "from-violet-200 to-indigo-100 text-violet-950 border-violet-300";
    case "emotional_regulation":
      return "from-rose-200 to-pink-100 text-rose-950 border-rose-300";
    default:
      return "from-lime-200 to-emerald-100 text-lime-950 border-lime-300";
  }
}

type GreeneryLevel = 0 | 1 | 2 | 3 | 4;

function getGreeneryLevel(amountRub: number, isUnlimited = false): GreeneryLevel {
  if (isUnlimited) return 4;
  if (amountRub >= 5000) return 4;
  if (amountRub >= 2500) return 3;
  if (amountRub >= 1000) return 2;
  if (amountRub >= 300) return 1;
  return 0;
}

function getGreeneryLabel(level: GreeneryLevel) {
  switch (level) {
    case 4:
      return "Премиальный кабинет";
    case 3:
      return "Густая зелень";
    case 2:
      return "Живой интерьер";
    case 1:
      return "Первые вьюны";
    default:
      return "Чистый кабинет";
  }
}

function getGreeneryHint(level: GreeneryLevel) {
  switch (level) {
    case 4:
      return "Окна и панели уже мягко обрамлены реалистичной зеленью, а кабинет выглядит как дорогой живой интерьер.";
    case 3:
      return "Вьюны уже хорошо видны по рамкам и собирают интерьер в цельную живую композицию.";
    case 2:
      return "Зелень заметно оживляет панели: по краям окон уже идут первые уверенные линии вьюнов.";
    case 1:
      return "Появились первые аккуратные вьюны вокруг окон и карточек.";
    default:
      return "Пока кабинет остаётся чистым и строгим. Чем больше пополнений, тем богаче станет живая зелень вокруг окон.";
  }
}

function clampDesk(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isInsideTrayZone(x: number, y: number) {
  return x >= TRAY_ZONE.x && x <= TRAY_ZONE.x + TRAY_ZONE.width && y >= TRAY_ZONE.y && y <= TRAY_ZONE.y + TRAY_ZONE.height;
}

function getGuideClipRect(position?: DeskPosition) {
  const x = Math.round(position?.x ?? getDefaultTrayGuidePosition().x);
  const y = Math.round(position?.y ?? getDefaultTrayGuidePosition().y);
  const width = Math.round(position?.width ?? getDefaultTrayGuidePosition().width ?? 228);
  const height = Math.round(position?.height ?? getDefaultTrayGuidePosition().height ?? 104);
  return { x, y, width, height };
}

function getGuideTransform(position?: DeskPosition) {
  const rotation = position?.rotation || 0;
  const tiltX = position?.tiltX || 0;
  const tiltY = position?.tiltY || 0;
  return `perspective(1400px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotate(${rotation}deg)`;
}

function getGuideClipPath(position?: DeskPosition) {
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
    tlx * trY + trx * bry + brx * bly + blx * tly -
    tly * trx - trY * brx - bry * blx - bly * tlx
  ) / 2;
  if (!Number.isFinite(area) || area < width * height * 0.08) {
    return `polygon(0px 0px, ${width}px 0px, ${width}px ${height}px, 0px ${height}px)`;
  }
  return `polygon(${tlx}px ${tly}px, ${trx}px ${trY}px, ${brx}px ${bry}px, ${blx}px ${bly}px)`;
}

function getDeskStorageKey(workspaceId: string, variant: DesktopVariant = "scheme") {
  return variant === "scheme"
    ? `${DESK_STORAGE_PREFIX}${workspaceId}`
    : `${DESK_STORAGE_PREFIX}${workspaceId}:${variant}`;
}

function readGlobalDeskTemplates(): DeskPositions {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GLOBAL_DESK_TEMPLATE_STORAGE_KEY);
    if (!raw) return {};
    return pickGlobalDeskTemplates(JSON.parse(raw) as DeskPositions) as DeskPositions;
  } catch {
    return {};
  }
}

function writeGlobalDeskTemplates(source: DeskPositions) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GLOBAL_DESK_TEMPLATE_STORAGE_KEY, JSON.stringify(pickGlobalDeskTemplates(source) as DeskPositions));
  } catch {}
}

function getSceneWidgetsStorageKey(workspaceId: string, variant: DesktopVariant = "scheme") {
  return variant === "scheme"
    ? `${SCENE_WIDGETS_STORAGE_PREFIX}${workspaceId}`
    : `${SCENE_WIDGETS_STORAGE_PREFIX}${workspaceId}:${variant}`;
}

function getDesktopVariantStorageKey(workspaceId: string) {
  return `${DESKTOP_VARIANT_STORAGE_PREFIX}${workspaceId}`;
}

function getRoomLightStorageKey(workspaceId: string) {
  return `${ROOM_LIGHT_STORAGE_PREFIX}${workspaceId}`;
}

function getRoomSwitchStorageKey(workspaceId: string) {
  return `${ROOM_SWITCH_STORAGE_PREFIX}${workspaceId}`;
}

function getClassicViewModeStorageKey(workspaceId: string) {
  return `${CLASSIC_VIEW_MODE_STORAGE_PREFIX}${workspaceId}`;
}

function getTrayGuideTextStorageKey(workspaceId: string) {
  return `${TRAY_GUIDE_TEXT_STORAGE_PREFIX}${workspaceId}`;
}

function getTrashStorageKey(workspaceId: string) {
  return `${TRASH_STORAGE_PREFIX}${workspaceId}`;
}

function getLayoutBackupStorageKey(workspaceId: string) {
  return `${LAYOUT_BACKUP_STORAGE_PREFIX}${workspaceId}`;
}

function readLayoutBackups(workspaceId: string): LayoutBackupSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getLayoutBackupStorageKey(workspaceId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) as LayoutBackupSnapshot[] : [];
  } catch {
    return [];
  }
}

function writeLayoutBackups(workspaceId: string, snapshots: LayoutBackupSnapshot[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getLayoutBackupStorageKey(workspaceId),
      JSON.stringify(snapshots.slice(0, MAX_LAYOUT_BACKUPS))
    );
  } catch {}
}

function isDesktopVariant(value: unknown): value is DesktopVariant {
  return value === "scheme" || value === "classic" || value === "assembly";
}

function isClassicViewMode(value: unknown): value is ClassicViewMode {
  return value === "desktop" || value === "sheet";
}

function normalizeLayoutBackupSnapshot(raw: any, fallbackWorkspaceId: string): LayoutBackupSnapshot | null {
  const source = raw?.snapshot && typeof raw.snapshot === "object" ? raw.snapshot : raw;
  if (!source || typeof source !== "object") return null;
  const variant = isDesktopVariant(source.variant) ? source.variant : isDesktopVariant(source.desktopVariant) ? source.desktopVariant : "scheme";
  const classicMode = isClassicViewMode(source.classicViewMode) ? source.classicViewMode : "desktop";
  const deskPositions = source.deskPositions && typeof source.deskPositions === "object" ? source.deskPositions as DeskPositions : {};
  const sceneWidgets = Array.isArray(source.sceneWidgets) ? source.sceneWidgets as SceneWidget[] : [];
  const createdAt = typeof source.createdAt === "string" ? source.createdAt : new Date().toISOString();
  const id = typeof source.id === "string" && source.id ? source.id : `layout-${Date.now()}`;

  return {
    id,
    createdAt,
    label: typeof source.label === "string" && source.label ? source.label : "Импортированный снимок",
    workspaceId: typeof source.workspaceId === "string" && source.workspaceId ? source.workspaceId : fallbackWorkspaceId,
    variant,
    classicViewMode: classicMode,
    deskPositions,
    sceneWidgets,
    trayGuideText: typeof source.trayGuideText === "string" ? source.trayGuideText : "",
    roomLight: source.roomLight === "dimmed" ? "dimmed" : "normal",
    roomSwitchPosition: {
      x: Number(source.roomSwitchPosition?.x ?? DEFAULT_ROOM_SWITCH_ZONE.x),
      y: Number(source.roomSwitchPosition?.y ?? DEFAULT_ROOM_SWITCH_ZONE.y),
    },
  };
}

function downloadTextFile(filename: string, content: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function isGlobalSchemeWidget(id: string) {
  return !id.startsWith("folder:") && !id.startsWith("project:");
}

function getAssemblyAiPriceRub(provider: AssemblyAiProvider, model: string, mode: AssemblyAiMode) {
  if (mode === "message") {
    if (provider === "deepseek") return model === "deepseek-v4-pro" ? 20 : 10;
    return model === "gpt-5.4-mini" ? 30 : 50;
  }
  if (provider === "deepseek") {
    const base = mode === "folder_analysis" ? 500 : 200;
    return model === "deepseek-v4-pro" ? base * 2 : base;
  }
  if (model === "gpt-5.4-mini") {
    if (mode === "folder_analysis") return 1000;
    if (mode === "project_message") return 350;
  }
  if (mode === "folder_analysis") return 2000;
  if (mode === "project_message") return 500;
  return 50;
}

function getAssemblyAiModeLabel(mode: AssemblyAiMode) {
  if (mode === "folder_analysis") return "Анализ папки";
  if (mode === "project_message") return "Персонально по человеку";
  return "Обычное сообщение";
}

function getAssemblyAiChatsStorageKey(workspaceId: string) {
  return `${ASSEMBLY_AI_CHATS_STORAGE_PREFIX}${workspaceId}`;
}

function makeAssemblyProjectSignature(project: ProjectRow | null | undefined) {
  if (!project) return "";
  return [
    project.id,
    project.title,
    project.goal,
    project.target_role || "",
    project.status,
    project.folder_id || "",
    project.created_at,
    project.updated_at || "",
    project.registry_comment_updated_at || "",
    project.person?.id || "",
    project.person?.full_name || "",
    project.person?.email || "",
    project.person?.current_position || "",
    project.person?.updated_at || "",
    project.tests.map((test) => `${test.test_slug}:${test.sort_order}`).sort().join(","),
    project.attempts_count,
  ].join("|");
}

function makeAssemblyFolderSignature(folderId: string | null | undefined, projects: ProjectRow[]) {
  return [
    "folder",
    folderId || "",
    projects
      .map((project) => makeAssemblyProjectSignature(project))
      .sort()
      .join("||"),
  ].join("::");
}

function makeAssemblyPersonSignature(project: ProjectRow | null | undefined) {
  return project ? `person::${makeAssemblyProjectSignature(project)}` : "";
}

function isProjectReadyForAi(project: ProjectRow) {
  return project.tests.length > 0 && project.attempts_count >= project.tests.length;
}

function makeAssemblyChatTitle(input: string) {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return "Новый чат";
  return text.length > 64 ? `${text.slice(0, 64).trim()}...` : text;
}

function isDeprecatedProjectAssemblyWidget(widget: SceneWidget | null | undefined) {
  if (!widget) return false;
  const text = String(widget.text || "").toLowerCase();
  return (
    widget.id === "open-project-assembly" ||
    widget.id === "__legacy_assembly__" ||
    (widget.action === "openProjectAssembly" && widget.kind !== "video") ||
    (widget.kind !== "video" && text.includes("\u0441\u0431\u043e\u0440\u043a"))
  );
}

function buildSchemeSceneWidgets(): SceneWidget[] {
  return [
    { id: "board-scheme", kind: "image", text: "", src: "/dashboard-board-marker-scheme-transparent.png", action: "none", tone: "scheme", x: 52, y: 26, width: 1296, height: 716, rotation: 0, fontSize: 0, z: 10 },
    { id: AI_CHAT_BOARD_ID, kind: "image", text: "AI-чат и аналитика", src: AI_CHAT_BOARD_SRC, action: "none", tone: "scheme", x: 770, y: 232, width: 420, height: 356, rotation: -1.2, fontSize: 0, z: 22 },
    { id: CERTIFICATE_PSI_PROFILE_ID, kind: "image", text: "Свидетельство о регистрации программы", src: "/dashboard-certificate-psi-profile.png", action: "none", tone: "scheme", x: 278, y: 122, width: 146, height: 207, rotation: -3.8, fontSize: 0, z: 26 },
    { id: CERTIFICATE_COGITO_ID, kind: "image", text: "Сертификат Когито-Центр", src: "/dashboard-certificate-cogito.png", action: "none", tone: "scheme", x: 844, y: 118, width: 148, height: 210, rotation: 2.9, fontSize: 0, z: 27 },
    { id: PROJECT_ASSEMBLY_GUIDE_ID, kind: "video", text: "AI-аналитик", src: PROJECT_ASSEMBLY_GUIDE_SRC, action: "openProjectAssembly", tone: "scheme", x: 404, y: 284, width: 124, height: 274, rotation: 0, fontSize: 0, z: 29 },
    { id: "create-project", kind: "button", text: "Создать проект", action: "createProject", tone: "buttonPrimary", x: 230, y: 330, width: 360, height: 110, rotation: 0.4, fontSize: 30, z: 31 },
    { id: "open-tests", kind: "button", text: "Каталог тестов", action: "openCatalog", tone: "buttonPrimary", x: 770, y: 330, width: 388, height: 110, rotation: -0.2, fontSize: 30, z: 31 },
  ];
}

function buildClassicSceneWidgets(): SceneWidget[] {
  return [];
}

function isPreviewableSceneWidget(widget: SceneWidget | null | undefined): widget is SceneWidget {
  return Boolean(widget && widget.kind === "image" && CERTIFICATE_WIDGET_IDS.has(widget.id));
}

function getPreviewableSceneWidgetTitle(widget: SceneWidget): string {
  if (widget.id === CERTIFICATE_PSI_PROFILE_ID) return "Свидетельство о государственной регистрации программы";
  if (widget.id === CERTIFICATE_COGITO_ID) return "Сертификат Когито-Центр";
  return "Сертификат";
}

function SceneVideoWidget({ src, title, active }: { src: string; title: string; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (active) {
      video.loop = true;
      try {
        video.currentTime = 0;
      } catch {}
      void video.play().catch(() => undefined);
      return;
    }

    video.pause();
    if (video.readyState >= 1) {
      try {
        video.currentTime = 0;
      } catch {}
    }
  }, [active, src]);

  return (
    <>
      <video
        ref={videoRef}
        className="dashboard-scene-widget-video-el"
        src={src}
        muted
        playsInline
        preload="auto"
        aria-label={title}
      />
      <button type="button" className="dashboard-scene-widget-video-hit" aria-label={title} />
    </>
  );
}

function ScoreBar({ value }: { value: number | null }) {
  const score = Math.max(0, Math.min(100, Number(value ?? 0)));
  return (
    <div className="h-2 w-full rounded-full bg-[#e6edf5]">
      <div className="h-2 rounded-full bg-[linear-gradient(90deg,#86efac_0%,#22c55e_100%)]" style={{ width: `${score}%` }} />
    </div>
  );
}

function AssemblyAiInsightPanel({ insight }: { insight: AssemblyAiInsight | null }) {
  if (!insight) {
    return (
      <div className="rounded-[26px] border border-dashed border-[#cfdbe7] bg-white/70 p-5 text-sm leading-6 text-[#6f8193]">
        После анализа здесь появится наглядная схема: рейтинг, лидеры по компетенциям и персональная карта человека.
      </div>
    );
  }

  if (insight.type === "person") {
    const person = insight.person;
    return (
      <div className="rounded-[28px] border border-[#d5deea] bg-white p-5 shadow-[0_20px_44px_-34px_rgba(37,63,89,0.2)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#68809a]">Персональная карта</div>
            <div className="mt-1 text-2xl font-semibold text-[#17283a]">{person.name}</div>
            <div className="mt-1 text-sm text-[#64788c]">{insight.subtitle || person.verdict}</div>
          </div>
          <div className="min-w-[120px] rounded-[20px] border border-[#dbe7f1] bg-[#f8fbff] px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.18em] text-[#7a8fa4]">Индекс</div>
            <div className="mt-1 text-3xl font-semibold text-[#17283a]">{person.score ?? "—"}</div>
          </div>
        </div>
        <div className="mt-4 rounded-[20px] border border-[#dfe8f2] bg-[#fbfdff] p-4 text-sm leading-6 text-[#40566d]">{insight.summary || person.verdict}</div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[22px] border border-[#d9e6d0] bg-[#f7fcf4] p-4">
            <div className="text-sm font-semibold text-[#28462c]">Сильные стороны</div>
            <div className="mt-3 space-y-2 text-sm text-[#37523a]">
              {(person.strengths.length ? person.strengths : ["Сильные стороны появятся после анализа."]).map((item) => <div key={item}>• {item}</div>)}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#ead8c2] bg-[#fffaf2] p-4">
            <div className="text-sm font-semibold text-[#6b4b24]">Риски и проверка</div>
            <div className="mt-3 space-y-2 text-sm text-[#6a533b]">
              {(person.risks.length ? person.risks : ["Риски появятся после анализа."]).map((item) => <div key={item}>• {item}</div>)}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[22px] border border-[#d5deea] bg-[#f9fbfe] p-4">
            <div className="text-sm font-semibold text-[#223548]">Сильные компетенции</div>
            <div className="mt-3 grid gap-3">
              {person.top_competencies.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-[18px] border border-[#e2ebf4] bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#223548]">{item.name}</div>
                      <div className="text-xs text-[#6f8193]">{item.cluster}</div>
                    </div>
                    <div className="text-sm font-semibold text-[#28462c]">{item.score}</div>
                  </div>
                  <div className="mt-2"><ScoreBar value={item.score} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#ead8c2] bg-[#fffaf2] p-4">
            <div className="text-sm font-semibold text-[#6b4b24]">Зоны внимания</div>
            <div className="mt-3 grid gap-3">
              {(person.low_competencies.length ? person.low_competencies : person.top_competencies.slice(-3)).map((item) => (
                <div key={item.id} className="rounded-[18px] border border-[#ead8c2] bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#223548]">{item.name}</div>
                      <div className="text-xs text-[#6f8193]">{item.cluster}</div>
                    </div>
                    <div className="text-sm font-semibold text-[#6b4b24]">{item.score}</div>
                  </div>
                  <div className="mt-2"><ScoreBar value={item.score} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {person.questions.length ? (
          <div className="mt-4 rounded-[22px] border border-[#d5deea] bg-[#fbfdff] p-4">
            <div className="text-sm font-semibold text-[#223548]">Вопросы для уточнения</div>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-[#40566d]">
              {person.questions.map((item) => <div key={item}>• {item}</div>)}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-[#d5deea] bg-white p-5 shadow-[0_20px_44px_-34px_rgba(37,63,89,0.2)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#68809a]">Схема сравнения</div>
          <div className="mt-1 text-2xl font-semibold text-[#17283a]">{insight.title}</div>
          <div className="mt-1 text-sm text-[#64788c]">{insight.subtitle}</div>
        </div>
      </div>
      {insight.summary ? <div className="mt-4 rounded-[20px] border border-[#dfe8f2] bg-[#fbfdff] p-4 text-sm leading-6 text-[#40566d]">{insight.summary}</div> : null}
      <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[22px] border border-[#d5deea] bg-[#f9fbfe] p-4">
          <div className="text-sm font-semibold text-[#223548]">Кто лучше подходит</div>
          <div className="mt-3 space-y-3">
            {(insight.ranking || []).map((item) => (
              <div key={item.project_id} className="rounded-[18px] border border-[#e2ebf4] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#7d8ea0]">#{item.place}</div>
                    <div className="truncate text-base font-semibold text-[#17283a]">{item.name}</div>
                    <div className="mt-1 text-xs text-[#6f8193]">{item.verdict}</div>
                  </div>
                  <div className="text-xl font-semibold text-[#223548]">{item.score ?? "—"}</div>
                </div>
                <div className="mt-2"><ScoreBar value={item.score} /></div>
                {item.reason ? <div className="mt-2 text-xs leading-5 text-[#5f7286]">{item.reason}</div> : null}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[22px] border border-[#d9e6d0] bg-[#f7fcf4] p-4">
          <div className="text-sm font-semibold text-[#28462c]">Лидеры по компетенциям</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {(insight.competency_leaders || []).slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-[18px] border border-[#dbe8d6] bg-white px-4 py-3">
                <div className="text-sm font-semibold text-[#223548]">{item.name}</div>
                <div className="mt-1 text-xs text-[#6f8193]">{item.cluster}</div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="text-sm font-medium text-[#28462c]">{item.leader_name || "—"}</div>
                  <div className="text-lg font-semibold text-[#28462c]">{item.leader_score ?? "—"}</div>
                </div>
                <div className="mt-2"><ScoreBar value={item.leader_score} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function serializeSceneWidgets(source: SceneWidget[]) {
  return source.map((item) => ({
    id: item.id,
    kind: item.kind,
    text: item.text,
    src: item.src,
    action: item.action,
    tone: item.tone,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    fontSize: item.fontSize,
    z: item.z,
  }));
}


function getClassicFolderPosition(index: number): DeskPosition {
  const col = Math.floor(index / 8);
  const row = index % 8;
  return {
    x: 48 + col * 112,
    y: 72 + row * 100,
    z: 80 + index,
    width: 88,
    height: 98,
  };
}

function getClassicProjectPosition(index: number): DeskPosition {
  const col = Math.floor(index / 8);
  const row = index % 8;
  return {
    x: 292 + col * 108,
    y: 72 + row * 100,
    z: 180 + index,
    width: 86,
    height: 98,
  };
}

function getDefaultFolderPosition(index: number): DeskPosition {
  return {
    x: TRAY_CLIP.x + 8 + index * 16,
    y: TRAY_CLIP.y + 10 + index * 8,
    z: 30 + index,
  };
}

function getDefaultProjectPosition(index: number): DeskPosition {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const offsets = [
    { x: 0, y: 4 },
    { x: 206, y: 16 },
    { x: 418, y: 10 },
  ];
  const offset = offsets[col] || offsets[0];
  return {
    x: SHEET_ZONE.x + offset.x + row * 18,
    y: SHEET_ZONE.y + offset.y + row * 12,
    z: 180 + index,
  };
}

function getDefaultTrayGuidePosition(): DeskPosition {
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
    clipBly: 104,
  };
}

function getDefaultTrashGuidePosition(): DeskPosition {
  return {
    x: TRASH_ZONE.x,
    y: TRASH_ZONE.y,
    z: 18,
    width: TRASH_ZONE.width,
    height: TRASH_ZONE.height,
    rotation: 0,
    tiltX: 0,
    tiltY: 0,
  };
}

function stripSharedScenePositions(source: DeskPositions): DeskPositions {
  const next: DeskPositions = {};
  for (const [key, value] of Object.entries(source || {})) {
    if (SHARED_SCENE_POSITION_IDS.has(key)) continue;
    if (DESK_TEMPLATE_IDS.has(key)) continue;
    next[key] = value;
  }
  return next;
}

function mergeDeskPositions(folders: FolderRow[], projects: ProjectRow[], saved: DeskPositions): DeskPositions {
  const next: DeskPositions = {};

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
      clipBly: folderTemplate.clipBly,
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
      clipBly: projectTemplate.clipBly,
    };
  });

  if (saved[FOLDER_TEMPLATE_ID]) next[FOLDER_TEMPLATE_ID] = saved[FOLDER_TEMPLATE_ID];
  if (saved[PROJECT_TEMPLATE_ID]) next[PROJECT_TEMPLATE_ID] = saved[PROJECT_TEMPLATE_ID];
  if (saved[LAPTOP_DEVICE_ID]) next[LAPTOP_DEVICE_ID] = saved[LAPTOP_DEVICE_ID];
  if (saved[LAPTOP_PANEL_ID]) next[LAPTOP_PANEL_ID] = saved[LAPTOP_PANEL_ID];

  return next;
}

export default function DashboardPage() {
  const { supabase, session, user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderIcon, setNewFolderIcon] = useState<FolderIconKey>("folder");
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [busyFolderId, setBusyFolderId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [iconPickerFolder, setIconPickerFolder] = useState<FolderRow | null>(null);
  const [folderActionTarget, setFolderActionTarget] = useState<FolderRow | null>(null);
  const [folderRenameTarget, setFolderRenameTarget] = useState<FolderRow | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState("");
  const [folderDeleteTarget, setFolderDeleteTarget] = useState<FolderRow | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const { wallet, ledger, loading: walletLoading, isUnlimited, refresh: refreshWallet } = useWallet();
  const isAdmin = isAdminEmail(user?.email);
  const canManageGlobalTemplates = isGlobalTemplateOwnerEmail(user?.email);
  const [mechanicPulse, setMechanicPulse] = useState(0);
  const [deskPositions, setDeskPositions] = useState<DeskPositions>({});
  const [deskLayer, setDeskLayer] = useState(300);
  const [previewProject, setPreviewProject] = useState<ProjectRow | null>(null);
  const [previewSceneImage, setPreviewSceneImage] = useState<{ src: string; title: string } | null>(null);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [trashHover, setTrashHover] = useState<{ kind: "project" | "folder"; id: string } | null>(null);
  const trashHoverTimer = useRef<number | null>(null);
  const [trashEntries, setTrashEntries] = useState<TrashEntry[]>([]);
  const [trashOpen, setTrashOpen] = useState(false);
  const canEditScene = isAdmin;
  const [sceneEditMode, setSceneEditMode] = useState(false);
  const [sceneWidgets, setSceneWidgets] = useState<SceneWidget[]>([]);
  const [desktopVariant, setDesktopVariant] = useState<DesktopVariant>("scheme");
  const [classicViewMode, setClassicViewMode] = useState<ClassicViewMode>("desktop");
  const [classicSheetQuery, setClassicSheetQuery] = useState("");
  const [classicSheetKindFilter, setClassicSheetKindFilter] = useState<ClassicSheetKindFilter>("all");
  const [classicSheetPlaceFilter, setClassicSheetPlaceFilter] = useState<ClassicSheetPlaceFilter>("all");
  const [trayGuideText, setTrayGuideText] = useState("Создать новую папку проектов");
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [activeAssemblyGuideId, setActiveAssemblyGuideId] = useState<string | null>(null);
  const [selectedDeskItemId, setSelectedDeskItemId] = useState<string | null>(null);
  const widgetInteractionRef = useRef<WidgetInteractionState | null>(null);
  const deskInteractionRef = useRef<DeskItemInteractionState | null>(null);
  const assemblyGuideTimerRef = useRef<number | null>(null);
  const assemblyAiLoadedRef = useRef(false);
  const pendingCreatedFolderRef = useRef<{ id: string } | null>(null);
  const templateFeedbackTimerRef = useRef<number | null>(null);
  const [templateFeedback, setTemplateFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const layoutImportInputRef = useRef<HTMLInputElement | null>(null);
  const [sharedDeskPositions, setSharedDeskPositions] = useState<DeskPositions>({});
  const [sharedSceneWidgets, setSharedSceneWidgets] = useState<SceneWidget[]>([]);
  const [sharedTrayGuideText, setSharedTrayGuideText] = useState("");
  const [sharedSceneReady, setSharedSceneReady] = useState(false);
  const [deskVisualReady, setDeskVisualReady] = useState(false);
  const [isRoomLightDimmed, setIsRoomLightDimmed] = useState(false);
  const [roomSwitchPosition, setRoomSwitchPosition] = useState(DEFAULT_ROOM_SWITCH_ZONE);
  const roomSwitchInteractionRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number; moved: boolean } | null>(null);
  const suppressRoomSwitchClickRef = useRef(false);
  const officeSceneRef = useRef<HTMLDivElement | null>(null);
  const loadedDashboardUserRef = useRef<string | null>(null);
  const [officeSceneScale, setOfficeSceneScale] = useState(1);
  const [activeSubscription, setActiveSubscription] = useState<WorkspaceSubscriptionStatus | null>(null);
  const [assemblyFolderId, setAssemblyFolderId] = useState<string | null>(null);
  const [assemblyLoading, setAssemblyLoading] = useState(false);
  const [assemblyError, setAssemblyError] = useState("");
  const [assemblyComparison, setAssemblyComparison] = useState<CandidateComparisonPayload | null>(null);
  const [assemblySelectedCompetencyIds, setAssemblySelectedCompetencyIds] = useState<string[]>([]);
  const [assemblyFitRequest, setAssemblyFitRequest] = useState("");
  const [assemblyAiProvider, setAssemblyAiProvider] = useState<AssemblyAiProvider>("openai");
  const [assemblyAiModel, setAssemblyAiModel] = useState("gpt-5.4-mini");
  const [assemblyAiMode, setAssemblyAiMode] = useState<AssemblyAiMode>("message");
  const [assemblyAiContextScope, setAssemblyAiContextScope] = useState<AssemblyAiContextScope>("folder");
  const [assemblyAiFolderTarget, setAssemblyAiFolderTarget] = useState<AssemblyAiFolderTarget>("folder");
  const [assemblyAiProjectId, setAssemblyAiProjectId] = useState("");
  const [assemblyAiDraft, setAssemblyAiDraft] = useState("");
  const [assemblyAiChats, setAssemblyAiChats] = useState<AssemblyAiChat[]>([]);
  const [assemblyAiActiveChatId, setAssemblyAiActiveChatId] = useState("");
  const [assemblyAiChatSearch, setAssemblyAiChatSearch] = useState("");
  const [assemblyAiEditingChatId, setAssemblyAiEditingChatId] = useState("");
  const [assemblyAiEditingTitle, setAssemblyAiEditingTitle] = useState("");
  const [assemblyAiInsight, setAssemblyAiInsight] = useState<AssemblyAiInsight | null>(null);
  const [assemblyAiMessages, setAssemblyAiMessages] = useState<AssemblyAiMessage[]>([
    {
      id: "assembly-ai-welcome",
      role: "assistant",
      content: "Выберите папку для общего анализа, готового человека без папки для персонального разбора или режим без выбора для обычного вопроса.",
    },
  ]);
  const [assemblyAiBusy, setAssemblyAiBusy] = useState(false);
  const [assemblyAiError, setAssemblyAiError] = useState("");
  const [assemblyAiLastCharge, setAssemblyAiLastCharge] = useState<number | null>(null);
  const [dashboardTourStartTarget, setDashboardTourStartTarget] = useState<string | null>(null);

  const balance_rub = useMemo(() => {
    if (isUnlimited) return 999999;
    return Math.floor(Number(wallet?.balance_kopeks ?? 0) / 100);
  }, [isUnlimited, wallet?.balance_kopeks]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DASHBOARD_FIRST_LOGIN_ONBOARDING_KEY) === "1") {
        window.localStorage.removeItem(DASHBOARD_FIRST_LOGIN_ONBOARDING_KEY);
        window.localStorage.setItem(DASHBOARD_TRASH_HINT_SHOWN_KEY, "1");
        setDashboardTourStartTarget("dashboard-create-project");
        return;
      }
      if (window.localStorage.getItem(DASHBOARD_POST_PROJECT_TRASH_HINT_KEY) !== "1") return;
      window.localStorage.removeItem(DASHBOARD_POST_PROJECT_TRASH_HINT_KEY);
      window.localStorage.setItem(DASHBOARD_TRASH_HINT_SHOWN_KEY, "1");
      setDashboardTourStartTarget("dashboard-trash");
    } catch {}
  }, []);

  const investedRub = useMemo(() => {
    if (isUnlimited) return 10000;
    const creditedKopeks = ledger.reduce((sum, item) => {
      const amount = Number(item?.amount_kopeks ?? 0);
      return amount > 0 ? sum + amount : sum;
    }, 0);
    const fromLedger = Math.floor(creditedKopeks / 100);
    return Math.max(fromLedger, balance_rub, 0);
  }, [balance_rub, isUnlimited, ledger]);

  const greeneryLevel = useMemo(() => getGreeneryLevel(investedRub, isUnlimited), [investedRub, isUnlimited]);
  const greeneryLabel = useMemo(() => getGreeneryLabel(greeneryLevel), [greeneryLevel]);
  const greeneryHint = useMemo(() => getGreeneryHint(greeneryLevel), [greeneryLevel]);
  const balanceText = walletLoading ? "…" : isUnlimited ? "∞" : `${balance_rub} ₽`;
  const investedText = isUnlimited ? "без лимита" : `${investedRub} ₽`;

  const triggerMechanics = useCallback((after?: () => void, delay = 220) => {
    setMechanicPulse((value) => value + 1);
    if (after) {
      window.setTimeout(() => {
        after();
      }, delay);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!session) return false;
    setLoading(true);
    setError("");
    setSharedSceneReady(false);
    try {
      const requestBootstrap = async (accessToken: string) => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 30000);
        try {
          return await fetch("/api/commercial/dashboard/bootstrap", {
            headers: { authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeoutId);
        }
      };

      let accessToken = session.access_token;
      if (supabase) {
        try {
          const { data: current } = await supabase.auth.getSession();
          if (current.session?.access_token) accessToken = current.session.access_token;
        } catch {}
      }

      let resp = await requestBootstrap(accessToken);
      if (resp.status === 401 && supabase) {
        try {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed.session?.access_token) {
            resp = await requestBootstrap(refreshed.session.access_token);
          }
        } catch {}
      }
      const json = (await resp.json().catch(() => ({}))) as Partial<DashboardBootstrapPayload> & { error?: string };
      if (!resp.ok || !json?.ok) {
        if (resp.status === 401) throw new Error("Сессия входа устарела. Обновите страницу или войдите снова.");
        throw new Error(json?.error || "Не удалось загрузить кабинет");
      }

      const parsedStandard = pickSceneStandard(json.shared_scene_standard || {});
      const nextSharedPositions = (parsedStandard.positions || {}) as DeskPositions;
      const nextSharedWidgets = (parsedStandard.widgets || []) as SceneWidget[];
      setSharedDeskPositions(nextSharedPositions);
      setSharedSceneWidgets(nextSharedWidgets);
      setSharedTrayGuideText(parsedStandard.trayGuideText || "");
      writeGlobalDeskTemplates(nextSharedPositions);
      setSharedSceneReady(true);

      setData({ profile: json.profile ?? null, stats: json.stats ?? { attempts_count: 0, unique_tests_count: 0 } });
      setWorkspace({
        ok: true,
        workspace: json.workspace!,
        folders: json.folders || [],
        projects: json.projects || [],
      });
      setActiveSubscription(json.active_subscription || null);
      return true;
    } catch (e: any) {
      setSharedDeskPositions({});
      setSharedSceneWidgets([]);
      setSharedTrayGuideText("");
      setSharedSceneReady(true);
      setActiveSubscription(null);
      setError(e?.name === "AbortError" ? "Кабинет слишком долго отвечает. Проверьте подключение и обновите страницу." : e?.message || "Ошибка");
      return false;
    } finally {
      setLoading(false);
    }
  }, [session, supabase]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sessionLoading) return;
    if (!session || !user) {
      loadedDashboardUserRef.current = null;
      router.replace("/auth?next=%2Fdashboard");
      return;
    }
    if (loadedDashboardUserRef.current === user.id) return;

    let cancelled = false;
    void loadDashboard().then((ok) => {
      if (!cancelled && ok) loadedDashboardUserRef.current = user.id;
    });
    return () => {
      cancelled = true;
    };
  }, [router, session, sessionLoading, user?.id, loadDashboard]);

  const displayName = data?.profile?.full_name || (user?.user_metadata as any)?.full_name || user?.email || "Пользователь";
  const workspaceName = workspace?.workspace?.name || data?.profile?.company_name || (user?.user_metadata as any)?.company_name || "Рабочее пространство";
  const toggleRoomLight = useCallback(() => {
    setIsRoomLightDimmed((current) => !current);
  }, []);
  const laptopPosition = deskPositions[LAPTOP_DEVICE_ID] || DEFAULT_LAPTOP_POSITION;
  const laptopPanelPosition = deskPositions[LAPTOP_PANEL_ID] || DEFAULT_LAPTOP_PANEL_POSITION;

  const sceneEditControls = canEditScene ? (
    <div className="pointer-events-auto absolute right-4 top-4 z-[90] flex flex-wrap items-center justify-end gap-2 rounded-[18px] border border-white/70 bg-white/88 px-3 py-2 shadow-[0_16px_30px_-24px_rgba(54,35,19,0.24)] backdrop-blur-xl">
      <button type="button" className={`btn btn-sm ${sceneEditMode ? "btn-primary" : "btn-secondary"}`} onClick={(e) => { e.stopPropagation(); setSceneEditMode((prev) => !prev); }}>
        {sceneEditMode ? "Выйти из конструктора" : "Режим конструктора"}
      </button>
      {sceneEditMode && canManageGlobalTemplates ? (
        <button type="button" className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); saveSceneStandardForAll(); }}>
          Сохранить шаблон стола для всех
        </button>
      ) : null}
      {sceneEditMode ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); resetSceneWidgets(); }}>
          Сбросить сцену
        </button>
      ) : null}
      {sceneEditMode ? (
        <>
          <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); saveLayoutSnapshot("Ручной снимок"); }}>
            Сохранить снимок
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); restoreLatestLayoutSnapshot(); }}>
            Откатить
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); exportLayoutSnapshot(); }}>
            Экспорт
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); layoutImportInputRef.current?.click(); }}>
            Импорт
          </button>
          <input
            ref={layoutImportInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => void importLayoutSnapshot(event)}
          />
        </>
      ) : null}
      {sceneEditMode && templateFeedback ? (
        <span className={`w-full rounded-xl border px-3 py-1.5 text-xs font-medium ${templateFeedback.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {templateFeedback.text}
        </span>
      ) : null}
    </div>
  ) : null;
  const defaultSceneWidgets = useMemo(
    () => (desktopVariant === "classic" || desktopVariant === "assembly" ? buildClassicSceneWidgets() : buildSchemeSceneWidgets()),
    // The board scene itself is static; keeping this stable prevents needless remounts when profile or wallet data refreshes.
    [desktopVariant]
  );
  const persistableSceneWidgets = useMemo(
    () => (sceneWidgets.length ? sceneWidgets : sharedSceneWidgets.length ? sharedSceneWidgets : defaultSceneWidgets).filter((item) => !isDeprecatedProjectAssemblyWidget(item)),
    [defaultSceneWidgets, sceneWidgets, sharedSceneWidgets]
  );

  useEffect(() => {
    if (desktopVariant !== "scheme") return;
    const node = officeSceneRef.current;
    if (!node) return;

    const recalc = () => {
      const width = node.clientWidth || OFFICE_SCENE_WIDTH;
      const nextScale = Math.min(1, width / OFFICE_SCENE_WIDTH);
      setOfficeSceneScale(nextScale > 0 ? nextScale : 1);
    };

    recalc();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(recalc) : null;
    observer?.observe(node);
    window.addEventListener("resize", recalc);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [desktopVariant]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getDesktopVariantStorageKey(workspace.workspace.workspace_id));
      if (raw === "classic" || raw === "scheme" || raw === "assembly") setDesktopVariant(raw);
    } catch {}
  }, [workspace?.workspace?.workspace_id]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(getDesktopVariantStorageKey(workspace.workspace.workspace_id), desktopVariant);
    } catch {}
  }, [desktopVariant, workspace?.workspace?.workspace_id]);

  useEffect(() => {
    const forcedDesktop = typeof router.query.desktop === "string" ? router.query.desktop : "";
    if (forcedDesktop !== "scheme") return;
    setDesktopVariant("scheme");
    setClassicViewMode("desktop");
  }, [router.query.desktop]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getClassicViewModeStorageKey(workspace.workspace.workspace_id));
      if (raw === "desktop" || raw === "sheet") setClassicViewMode(raw);
    } catch {}
  }, [workspace?.workspace?.workspace_id]);

  useEffect(() => {
    setDeskVisualReady(false);
  }, [classicViewMode, desktopVariant, loading, sharedSceneReady, workspace?.workspace?.workspace_id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading || !sharedSceneReady || !workspace?.workspace?.workspace_id) return;

    let rafOne = 0;
    let rafTwo = 0;
    rafOne = window.requestAnimationFrame(() => {
      rafTwo = window.requestAnimationFrame(() => {
        setDeskVisualReady(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(rafOne);
      window.cancelAnimationFrame(rafTwo);
    };
  }, [classicViewMode, desktopVariant, loading, sharedSceneReady, workspace?.workspace?.workspace_id]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(getClassicViewModeStorageKey(workspace.workspace.workspace_id), classicViewMode);
    } catch {}
  }, [classicViewMode, workspace?.workspace?.workspace_id]);


  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getRoomLightStorageKey(workspace.workspace.workspace_id));
      setIsRoomLightDimmed(raw === "dimmed");
    } catch {
      setIsRoomLightDimmed(false);
    }
  }, [workspace?.workspace?.workspace_id]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady || typeof window === "undefined") return;
    try {
      const sharedPosition = sharedDeskPositions[ROOM_SWITCH_STANDARD_ID] as DeskPosition | undefined;
      if (sharedPosition && Number.isFinite(Number(sharedPosition.x)) && Number.isFinite(Number(sharedPosition.y))) {
        setRoomSwitchPosition({
          x: clampDesk(Number(sharedPosition.x), 0, DESK_WIDTH - DEFAULT_ROOM_SWITCH_ZONE.width),
          y: clampDesk(Number(sharedPosition.y), 0, DESK_HEIGHT - DEFAULT_ROOM_SWITCH_ZONE.height),
          width: DEFAULT_ROOM_SWITCH_ZONE.width,
          height: DEFAULT_ROOM_SWITCH_ZONE.height,
        });
        return;
      }

      const raw = window.localStorage.getItem(getRoomSwitchStorageKey(workspace.workspace.workspace_id));
      if (!raw) {
        setRoomSwitchPosition(DEFAULT_ROOM_SWITCH_ZONE);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_ROOM_SWITCH_ZONE>;
      setRoomSwitchPosition({
        x: clampDesk(Number(parsed?.x ?? DEFAULT_ROOM_SWITCH_ZONE.x), 0, DESK_WIDTH - DEFAULT_ROOM_SWITCH_ZONE.width),
        y: clampDesk(Number(parsed?.y ?? DEFAULT_ROOM_SWITCH_ZONE.y), 0, DESK_HEIGHT - DEFAULT_ROOM_SWITCH_ZONE.height),
        width: DEFAULT_ROOM_SWITCH_ZONE.width,
        height: DEFAULT_ROOM_SWITCH_ZONE.height,
      });
    } catch {
      setRoomSwitchPosition(DEFAULT_ROOM_SWITCH_ZONE);
    }
  }, [sharedDeskPositions, sharedSceneReady, workspace?.workspace?.workspace_id]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(getRoomLightStorageKey(workspace.workspace.workspace_id), isRoomLightDimmed ? "dimmed" : "normal");
    } catch {}
  }, [isRoomLightDimmed, workspace?.workspace?.workspace_id]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(getRoomSwitchStorageKey(workspace.workspace.workspace_id), JSON.stringify({
        x: Math.round(roomSwitchPosition.x),
        y: Math.round(roomSwitchPosition.y),
      }));
    } catch {}
  }, [roomSwitchPosition, workspace?.workspace?.workspace_id]);

  useEffect(() => {
    if (!canEditScene || !session?.access_token || !sharedSceneReady) return;
    const sharedPosition = sharedDeskPositions[ROOM_SWITCH_STANDARD_ID] as DeskPosition | undefined;
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
              z: Number(sharedPosition?.z ?? 182),
            },
          },
          widgets: serializeSceneWidgets(persistableSceneWidgets),
          trayGuideText,
        };

        const resp = await fetch("/api/commercial/scene-template", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            standard: standardPayload,
            positions: standardPayload.positions,
            widgets: standardPayload.widgets,
            trayGuideText: standardPayload.trayGuideText,
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось сохранить положение выключателя");
        const parsedStandard = pickSceneStandard(json?.standard || json || {});
        setSharedDeskPositions((parsedStandard.positions || {}) as DeskPositions);
        setSharedSceneWidgets((parsedStandard.widgets || []) as SceneWidget[]);
        setSharedTrayGuideText(parsedStandard.trayGuideText || "");
      } catch (err) {
        console.error(err);
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [canEditScene, persistableSceneWidgets, roomSwitchPosition.x, roomSwitchPosition.y, session?.access_token, sharedDeskPositions, sharedSceneReady, trayGuideText]);

  useEffect(() => {
    if (!canEditScene || !session?.access_token || !sharedSceneReady) return;
    const sharedLaptop = (sharedDeskPositions[LAPTOP_DEVICE_ID] || DEFAULT_LAPTOP_POSITION) as DeskPosition;
    const sharedPanel = (sharedDeskPositions[LAPTOP_PANEL_ID] || DEFAULT_LAPTOP_PANEL_POSITION) as DeskPosition;
    const currentLaptop = laptopPosition;
    const currentPanel = laptopPanelPosition;

    const sameLaptop = Math.round(currentLaptop.x || 0) === Math.round(sharedLaptop.x || 0)
      && Math.round(currentLaptop.y || 0) === Math.round(sharedLaptop.y || 0)
      && Math.round(currentLaptop.width || 0) === Math.round(sharedLaptop.width || 0)
      && Math.round(currentLaptop.height || 0) === Math.round(sharedLaptop.height || 0)
      && Number((currentLaptop.rotation || 0).toFixed(1)) === Number((sharedLaptop.rotation || 0).toFixed(1));
    const samePanel = Math.round(currentPanel.x || 0) === Math.round(sharedPanel.x || 0)
      && Math.round(currentPanel.y || 0) === Math.round(sharedPanel.y || 0)
      && Math.round(currentPanel.width || 0) === Math.round(sharedPanel.width || 0)
      && Math.round(currentPanel.height || 0) === Math.round(sharedPanel.height || 0)
      && Number((currentPanel.rotation || 0).toFixed(1)) === Number((sharedPanel.rotation || 0).toFixed(1));

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
              z: Number(currentLaptop.z ?? sharedLaptop.z ?? DEFAULT_LAPTOP_POSITION.z ?? 24),
            },
            [LAPTOP_PANEL_ID]: {
              x: Math.round(currentPanel.x || 0),
              y: Math.round(currentPanel.y || 0),
              width: Math.round(currentPanel.width || DEFAULT_LAPTOP_PANEL_POSITION.width || 0),
              height: Math.round(currentPanel.height || DEFAULT_LAPTOP_PANEL_POSITION.height || 0),
              rotation: Number((currentPanel.rotation || 0).toFixed(1)),
              z: Number(currentPanel.z ?? sharedPanel.z ?? DEFAULT_LAPTOP_PANEL_POSITION.z ?? 26),
            },
          },
          widgets: serializeSceneWidgets(persistableSceneWidgets),
          trayGuideText,
        };

        const resp = await fetch("/api/commercial/scene-template", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            standard: standardPayload,
            positions: standardPayload.positions,
            widgets: standardPayload.widgets,
            trayGuideText: standardPayload.trayGuideText,
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось сохранить ноутбук на сцене");
        const parsedStandard = pickSceneStandard(json?.standard || json || {});
        setSharedDeskPositions((parsedStandard.positions || {}) as DeskPositions);
        setSharedSceneWidgets((parsedStandard.widgets || []) as SceneWidget[]);
        setSharedTrayGuideText(parsedStandard.trayGuideText || "");
      } catch (err) {
        console.error(err);
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [canEditScene, laptopPanelPosition.height, laptopPanelPosition.rotation, laptopPanelPosition.width, laptopPanelPosition.x, laptopPanelPosition.y, laptopPosition.height, laptopPosition.rotation, laptopPosition.width, laptopPosition.x, laptopPosition.y, persistableSceneWidgets, session?.access_token, sharedDeskPositions, sharedSceneReady, trayGuideText]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady) return;
    const key = getSceneWidgetsStorageKey(workspace.workspace.workspace_id, desktopVariant);
    let saved: SceneWidget[] = [];
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) saved = JSON.parse(raw) as SceneWidget[];
        if (!raw && desktopVariant === "scheme") {
          const legacyRaw = window.localStorage.getItem(getSceneWidgetsStorageKey(workspace.workspace.workspace_id));
          if (legacyRaw) saved = JSON.parse(legacyRaw) as SceneWidget[];
        }
      } catch {
        saved = [];
      }
    }

    const allowedIds = new Set(defaultSceneWidgets.map((item) => item.id));
    const defaultsById = new Map(defaultSceneWidgets.map((item) => [item.id, item]));

    let sourceWidgets: SceneWidget[] = [];
    if (desktopVariant === "classic" || desktopVariant === "assembly") {
      sourceWidgets = saved.length ? saved : defaultSceneWidgets;
    } else {
      const legacyWidgetIds = new Set([
        "wallet-title",
        "wallet-value",
        "wallet-note",
        "profile-title",
        "profile-name",
        "profile-role",
        "profile-email",
        "create-folder",
      ]);
      const hasLegacyBoardLayout = saved.some((item) => legacyWidgetIds.has(item.id));
      const hasMarkerScheme = saved.some((item) => item.id === "board-scheme") || sharedSceneWidgets.some((item) => item.id === "board-scheme");
      const needsMarkerSceneUpgrade = !hasLegacyBoardLayout && !hasMarkerScheme;
      sourceWidgets = hasLegacyBoardLayout || needsMarkerSceneUpgrade
        ? (sharedSceneWidgets.some((item) => item.id === "board-scheme") ? sharedSceneWidgets : defaultSceneWidgets)
        : (sharedSceneWidgets.length ? sharedSceneWidgets : (saved.length ? saved : defaultSceneWidgets));
    }

    const normalizedWidgets = sourceWidgets
      .filter((item) => allowedIds.has(item.id) && !isDeprecatedProjectAssemblyWidget(item))
      .map((item) => {
        const defaults = defaultsById.get(item.id);
        if (!defaults) return item;
        return {
          ...item,
          text: typeof item.text === "string" ? item.text : defaults.text,
          action: defaults.action,
          kind: defaults.kind,
          tone: defaults.tone,
          src: defaults.kind === "video" ? defaults.src : (item as SceneWidget).src || defaults.src,
        };
      });

    for (const defaults of defaultSceneWidgets) {
      if (!normalizedWidgets.some((item) => item.id === defaults.id)) normalizedWidgets.push({ ...defaults });
    }

    normalizedWidgets.sort((a, b) => a.z - b.z);

    setSceneWidgets(normalizedWidgets.length ? normalizedWidgets : defaultSceneWidgets);
  }, [defaultSceneWidgets, desktopVariant, sharedSceneReady, sharedSceneWidgets, workspace?.workspace?.workspace_id]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady || typeof window === "undefined" || !sceneWidgets.length) return;
    if (desktopVariant === "scheme") {
      window.localStorage.removeItem(getSceneWidgetsStorageKey(workspace.workspace.workspace_id, desktopVariant));
      return;
    }
    window.localStorage.setItem(getSceneWidgetsStorageKey(workspace.workspace.workspace_id, desktopVariant), JSON.stringify(sceneWidgets));
  }, [desktopVariant, sceneWidgets, sharedSceneReady, workspace?.workspace?.workspace_id]);


  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getTrayGuideTextStorageKey(workspace.workspace.workspace_id));
      if (sharedTrayGuideText) setTrayGuideText(sharedTrayGuideText);
      else if (raw && raw.trim()) setTrayGuideText(raw);
      else setTrayGuideText("Создать новую папку проектов");
    } catch {
      setTrayGuideText(sharedTrayGuideText || "Создать новую папку проектов");
    }
  }, [sharedSceneReady, sharedTrayGuideText, workspace?.workspace?.workspace_id]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady || typeof window === "undefined") return;
    window.localStorage.setItem(getTrayGuideTextStorageKey(workspace.workspace.workspace_id), trayGuideText);
  }, [sharedSceneReady, trayGuideText, workspace?.workspace?.workspace_id]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getTrashStorageKey(workspace.workspace.workspace_id));
      const parsed = raw ? (JSON.parse(raw) as TrashEntry[]) : [];
      const now = Date.now();
      setTrashEntries(parsed.filter((item) => item.expiresAt > now));
    } catch {
      setTrashEntries([]);
    }
  }, [workspace?.workspace?.workspace_id]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    window.localStorage.setItem(getTrashStorageKey(workspace.workspace.workspace_id), JSON.stringify(trashEntries));
  }, [trashEntries, workspace?.workspace?.workspace_id]);

  const selectedWidget = useMemo(() => sceneWidgets.find((item) => item.id === selectedWidgetId) || null, [sceneWidgets, selectedWidgetId]);

  const updateSceneWidget = useCallback((id: string, patch: Partial<SceneWidget>) => {
    setSceneWidgets((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const updateDeskItem = useCallback((id: string, patch: Partial<DeskPosition>) => {
    setDeskPositions((prev) => {
      const current = {
        ...(prev[id] || { x: 48, y: 48, z: deskLayer + 1 }),
        ...patch,
      } as DeskPosition;

      if (id.startsWith("project:")) {
        const itemWidth = current.width || DESK_SHEET_WIDTH;
        const itemHeight = current.height || DESK_SHEET_HEIGHT;
        const minX = -itemWidth * 0.5;
        const minY = -itemHeight * 0.5;
        const maxX = DESK_WIDTH - itemWidth * 0.5;
        const maxY = DESK_HEIGHT - itemHeight * 0.5;
        const panelPosition = (prev[LAPTOP_PANEL_ID] || DEFAULT_LAPTOP_PANEL_POSITION) as DeskPosition;
        const blockedRect = getDeskRect(
          panelPosition,
          panelPosition.width || DEFAULT_LAPTOP_PANEL_POSITION.width || 226,
          panelPosition.height || DEFAULT_LAPTOP_PANEL_POSITION.height || 132,
          6,
        );
        const nextRect = { left: current.x ?? 0, top: current.y ?? 0, right: (current.x ?? 0) + itemWidth, bottom: (current.y ?? 0) + itemHeight };
        const safe = keepRectOutOfBlockedZone(nextRect, blockedRect, { minX, minY, maxX, maxY });
        current.x = safe.x;
        current.y = safe.y;
      }

      return {
        ...prev,
        [id]: current,
      };
    });
  }, [deskLayer]);

  const showTemplateFeedback = useCallback((kind: "success" | "error", text: string) => {
    setTemplateFeedback({ kind, text });
    if (typeof window !== "undefined") {
      if (templateFeedbackTimerRef.current) window.clearTimeout(templateFeedbackTimerRef.current);
      templateFeedbackTimerRef.current = window.setTimeout(() => setTemplateFeedback(null), 2200);
    }
  }, []);

  useEffect(() => () => {
    if (typeof window !== "undefined" && templateFeedbackTimerRef.current) {
      window.clearTimeout(templateFeedbackTimerRef.current);
    }
  }, []);

  useEffect(() => () => {
    if (typeof window !== "undefined" && assemblyGuideTimerRef.current) {
      window.clearTimeout(assemblyGuideTimerRef.current);
    }
  }, []);

  const buildLayoutSnapshot = useCallback((label: string): LayoutBackupSnapshot | null => {
    const workspaceId = workspace?.workspace?.workspace_id;
    if (!workspaceId) return null;
    return {
      id: `layout-${Date.now()}`,
      createdAt: new Date().toISOString(),
      label,
      workspaceId,
      variant: desktopVariant,
      classicViewMode,
      deskPositions: stripSharedScenePositions(deskPositions),
      sceneWidgets: serializeSceneWidgets(persistableSceneWidgets),
      trayGuideText,
      roomLight: isRoomLightDimmed ? "dimmed" : "normal",
      roomSwitchPosition: {
        x: Math.round(roomSwitchPosition.x),
        y: Math.round(roomSwitchPosition.y),
      },
    };
  }, [classicViewMode, deskPositions, desktopVariant, isRoomLightDimmed, persistableSceneWidgets, roomSwitchPosition.x, roomSwitchPosition.y, trayGuideText, workspace?.workspace?.workspace_id]);

  const saveLayoutSnapshot = useCallback((label = "Ручной снимок") => {
    const workspaceId = workspace?.workspace?.workspace_id;
    const snapshot = buildLayoutSnapshot(label);
    if (!workspaceId || !snapshot) {
      showTemplateFeedback("error", "Рабочее пространство ещё не готово для снимка");
      return null;
    }

    const current = readLayoutBackups(workspaceId);
    writeLayoutBackups(workspaceId, [
      snapshot,
      ...current.filter((item) => item.id !== snapshot.id),
    ]);
    showTemplateFeedback("success", "Снимок раскладки сохранён");
    return snapshot;
  }, [buildLayoutSnapshot, showTemplateFeedback, workspace?.workspace?.workspace_id]);

  const applyLayoutSnapshot = useCallback((snapshot: LayoutBackupSnapshot, reason: "restore" | "import") => {
    const workspaceId = workspace?.workspace?.workspace_id;
    if (!workspaceId || typeof window === "undefined") {
      showTemplateFeedback("error", "Рабочее пространство ещё не готово для восстановления");
      return;
    }

    const nextDeskPositions = snapshot.deskPositions || {};
    const nextSceneWidgets = Array.isArray(snapshot.sceneWidgets) ? snapshot.sceneWidgets : [];
    const nextVariant = snapshot.variant;
    const nextClassicViewMode = snapshot.classicViewMode;
    const nextTrayText = snapshot.trayGuideText || "Создать новую папку проектов";
    const nextRoomSwitch = {
      ...DEFAULT_ROOM_SWITCH_ZONE,
      x: clampDesk(Number(snapshot.roomSwitchPosition?.x ?? DEFAULT_ROOM_SWITCH_ZONE.x), 0, DESK_WIDTH - DEFAULT_ROOM_SWITCH_ZONE.width),
      y: clampDesk(Number(snapshot.roomSwitchPosition?.y ?? DEFAULT_ROOM_SWITCH_ZONE.y), 0, DESK_HEIGHT - DEFAULT_ROOM_SWITCH_ZONE.height),
    };

    setDesktopVariant(nextVariant);
    setClassicViewMode(nextClassicViewMode);
    setDeskPositions(nextDeskPositions);
    setSceneWidgets(nextSceneWidgets);
    setTrayGuideText(nextTrayText);
    setIsRoomLightDimmed(snapshot.roomLight === "dimmed");
    setRoomSwitchPosition(nextRoomSwitch);
    setSelectedWidgetId(null);
    setSelectedDeskItemId(null);

    try {
      window.localStorage.setItem(getDesktopVariantStorageKey(workspaceId), nextVariant);
      window.localStorage.setItem(getClassicViewModeStorageKey(workspaceId), nextClassicViewMode);
      window.localStorage.setItem(getDeskStorageKey(workspaceId, nextVariant), JSON.stringify(stripSharedScenePositions(nextDeskPositions)));
      window.localStorage.setItem(getTrayGuideTextStorageKey(workspaceId), nextTrayText);
      window.localStorage.setItem(getRoomLightStorageKey(workspaceId), snapshot.roomLight === "dimmed" ? "dimmed" : "normal");
      window.localStorage.setItem(getRoomSwitchStorageKey(workspaceId), JSON.stringify({ x: nextRoomSwitch.x, y: nextRoomSwitch.y }));
      if (nextVariant !== "scheme" && nextSceneWidgets.length) {
        window.localStorage.setItem(getSceneWidgetsStorageKey(workspaceId, nextVariant), JSON.stringify(nextSceneWidgets));
      }
    } catch {}

    const current = readLayoutBackups(workspaceId);
    writeLayoutBackups(workspaceId, [
      { ...snapshot, workspaceId, id: reason === "import" ? `layout-${Date.now()}` : snapshot.id },
      ...current.filter((item) => item.id !== snapshot.id),
    ]);
    showTemplateFeedback("success", reason === "import" ? "Снимок импортирован и применён" : "Раскладка восстановлена из снимка");
  }, [showTemplateFeedback, workspace?.workspace?.workspace_id]);

  const restoreLatestLayoutSnapshot = useCallback(() => {
    const workspaceId = workspace?.workspace?.workspace_id;
    if (!workspaceId || typeof window === "undefined") {
      showTemplateFeedback("error", "Нет рабочего пространства для восстановления");
      return;
    }

    const backups = readLayoutBackups(workspaceId);
    const snapshot = backups.find((item) => item.variant === desktopVariant) || backups[0] || null;
    if (!snapshot) {
      showTemplateFeedback("error", "Снимков раскладки пока нет");
      return;
    }

    if (!window.confirm("Восстановить последний сохранённый снимок раскладки? Текущие несохранённые перестановки будут заменены.")) {
      return;
    }
    applyLayoutSnapshot(snapshot, "restore");
  }, [applyLayoutSnapshot, desktopVariant, showTemplateFeedback, workspace?.workspace?.workspace_id]);

  const exportLayoutSnapshot = useCallback(() => {
    const snapshot = saveLayoutSnapshot("Экспортированный снимок");
    if (!snapshot) return;
    const stamp = snapshot.createdAt.replace(/[:.]/g, "-");
    downloadTextFile(
      `dashboard-layout-${snapshot.variant}-${stamp}.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), snapshot }, null, 2)
    );
  }, [saveLayoutSnapshot]);

  const importLayoutSnapshot = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] || null;
    event.currentTarget.value = "";
    const workspaceId = workspace?.workspace?.workspace_id;
    if (!file || !workspaceId) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const snapshot = normalizeLayoutBackupSnapshot(parsed, workspaceId);
      if (!snapshot) throw new Error("Файл не похож на снимок раскладки");
      applyLayoutSnapshot(snapshot, "import");
    } catch (error: any) {
      showTemplateFeedback("error", error?.message || "Не удалось импортировать снимок");
    }
  }, [applyLayoutSnapshot, showTemplateFeedback, workspace?.workspace?.workspace_id]);

  const buildCurrentSceneStandard = useCallback(() => ({
    positions: {
      ...sharedDeskPositions,
      ...pickGlobalDeskTemplates(deskPositions),
      ...(deskPositions[TRAY_GUIDE_ID] ? { [TRAY_GUIDE_ID]: deskPositions[TRAY_GUIDE_ID] } : {}),
      ...(deskPositions[TRASH_GUIDE_ID] ? { [TRASH_GUIDE_ID]: deskPositions[TRASH_GUIDE_ID] } : {}),
      ...(deskPositions[ROOM_SWITCH_STANDARD_ID] ? { [ROOM_SWITCH_STANDARD_ID]: deskPositions[ROOM_SWITCH_STANDARD_ID] } : {}),
      ...(deskPositions[LAPTOP_DEVICE_ID] ? { [LAPTOP_DEVICE_ID]: deskPositions[LAPTOP_DEVICE_ID] } : {}),
      ...(deskPositions[LAPTOP_PANEL_ID] ? { [LAPTOP_PANEL_ID]: deskPositions[LAPTOP_PANEL_ID] } : {}),
    },
    widgets: serializeSceneWidgets(persistableSceneWidgets),
    trayGuideText,
  }), [deskPositions, persistableSceneWidgets, sharedDeskPositions, trayGuideText]);

  const saveSceneStandardForAll = useCallback(async () => {
    if (!session?.access_token || !canManageGlobalTemplates) {
      showTemplateFeedback("error", "Недостаточно прав для сохранения общего шаблона сцены");
      return;
    }

    const standardPayload = buildCurrentSceneStandard();
    try {
      const resp = await fetch("/api/commercial/scene-template", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          standard: standardPayload,
          positions: standardPayload.positions,
          widgets: standardPayload.widgets,
          trayGuideText: standardPayload.trayGuideText,
          templates: pickGlobalDeskTemplates(deskPositions),
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось сохранить общий шаблон сцены");
      const parsedStandard = pickSceneStandard(json?.standard || json || {});
      const sharedPositions = (parsedStandard.positions || {}) as DeskPositions;
      const sharedWidgets = (parsedStandard.widgets || []) as SceneWidget[];
      setSharedDeskPositions(sharedPositions);
      setSharedSceneWidgets(sharedWidgets);
      setSharedTrayGuideText(parsedStandard.trayGuideText || "");
      writeGlobalDeskTemplates(sharedPositions);
      showTemplateFeedback("success", "Сохранён общий шаблон рабочего стола");
    } catch (e: any) {
      showTemplateFeedback("error", e?.message || "Не удалось сохранить общий шаблон сцены");
    }
  }, [buildCurrentSceneStandard, canManageGlobalTemplates, deskPositions, session?.access_token, showTemplateFeedback]);

  const saveDeskItemAsTemplate = useCallback(async (itemId: string, kind: "folder" | "project") => {
    const source = deskPositions[itemId];
    if (!source) {
      showTemplateFeedback("error", "Не удалось найти объект для сохранения стандарта");
      return;
    }

    const templateId = kind === "folder" ? FOLDER_TEMPLATE_ID : PROJECT_TEMPLATE_ID;
    const templatePatch: DeskPosition = {
      x: (deskPositions[templateId]?.x ?? source.x ?? 0),
      y: (deskPositions[templateId]?.y ?? source.y ?? 0),
      z: (deskPositions[templateId]?.z ?? source.z ?? 0),
      ...(source.width !== undefined ? { width: source.width } : {}),
      ...(source.height !== undefined ? { height: source.height } : {}),
      ...(source.rotation !== undefined ? { rotation: source.rotation } : {}),
      ...(source.tiltX !== undefined ? { tiltX: source.tiltX } : {}),
      ...(source.tiltY !== undefined ? { tiltY: source.tiltY } : {}),
      ...(source.clipTlx !== undefined ? { clipTlx: source.clipTlx } : {}),
      ...(source.clipTly !== undefined ? { clipTly: source.clipTly } : {}),
      ...(source.clipTrx !== undefined ? { clipTrx: source.clipTrx } : {}),
      ...(source.clipTry !== undefined ? { clipTry: source.clipTry } : {}),
      ...(source.clipBrx !== undefined ? { clipBrx: source.clipBrx } : {}),
      ...(source.clipBry !== undefined ? { clipBry: source.clipBry } : {}),
      ...(source.clipBlx !== undefined ? { clipBlx: source.clipBlx } : {}),
      ...(source.clipBly !== undefined ? { clipBly: source.clipBly } : {}),
    };

    const nextDeskPositions: DeskPositions = {
      ...deskPositions,
      [templateId]: {
        ...(deskPositions[templateId] || {}),
        ...templatePatch,
      },
    };

    setDeskPositions(nextDeskPositions);
    writeGlobalDeskTemplates(nextDeskPositions);

    if (!session?.access_token || !canManageGlobalTemplates) {
      showTemplateFeedback("success", `Шаблон ${kind === "folder" ? "папок" : "листов"} сохранён локально`);
      return;
    }

    const standardPayload = {
      ...buildCurrentSceneStandard(),
      positions: {
        ...buildCurrentSceneStandard().positions,
        ...pickGlobalDeskTemplates(nextDeskPositions),
        ...(nextDeskPositions[TRAY_GUIDE_ID] ? { [TRAY_GUIDE_ID]: nextDeskPositions[TRAY_GUIDE_ID] } : {}),
        ...(nextDeskPositions[TRASH_GUIDE_ID] ? { [TRASH_GUIDE_ID]: nextDeskPositions[TRASH_GUIDE_ID] } : {}),
        ...(nextDeskPositions[ROOM_SWITCH_STANDARD_ID] ? { [ROOM_SWITCH_STANDARD_ID]: nextDeskPositions[ROOM_SWITCH_STANDARD_ID] } : {}),
        ...(nextDeskPositions[LAPTOP_DEVICE_ID] ? { [LAPTOP_DEVICE_ID]: nextDeskPositions[LAPTOP_DEVICE_ID] } : {}),
        ...(nextDeskPositions[LAPTOP_PANEL_ID] ? { [LAPTOP_PANEL_ID]: nextDeskPositions[LAPTOP_PANEL_ID] } : {}),
      },
    };

    try {
      const resp = await fetch("/api/commercial/scene-template", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          standard: standardPayload,
          positions: standardPayload.positions,
          widgets: standardPayload.widgets,
          trayGuideText: standardPayload.trayGuideText,
          templates: pickGlobalDeskTemplates(nextDeskPositions),
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Не удалось сохранить общий стандарт");
      }
      const parsedStandard = pickSceneStandard(json?.standard || json || {});
      const sharedPositions = (parsedStandard.positions || {}) as DeskPositions;
      const sharedWidgets = (parsedStandard.widgets || []) as SceneWidget[];
      setSharedDeskPositions(sharedPositions);
      setSharedSceneWidgets(sharedWidgets);
      setSharedTrayGuideText(parsedStandard.trayGuideText || "");
      writeGlobalDeskTemplates(sharedPositions);
      showTemplateFeedback("success", `Сохранён общий стандарт сцены: ${kind === "folder" ? "папки" : "листы"}, стойка и кнопки`);
    } catch (e: any) {
      showTemplateFeedback("error", e?.message || "Не удалось сохранить общий стандарт");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildCurrentSceneStandard, canManageGlobalTemplates, deskPositions, sceneWidgets, session?.access_token, showTemplateFeedback, trayGuideText]);

  const applyDeskTemplateToExistingItems = useCallback((kind: "folder" | "project") => {
    const templateId = kind === "folder" ? FOLDER_TEMPLATE_ID : PROJECT_TEMPLATE_ID;
    const template = deskPositions[templateId];
    if (!template) {
      showTemplateFeedback("error", `Сначала сохраните шаблон для ${kind === "folder" ? "папок" : "листов"}`);
      return;
    }

    const prefix = kind === "folder" ? "folder:" : "project:";
    const targetIds = Object.keys(deskPositions).filter((key) => key.startsWith(prefix));
    if (!targetIds.length) {
      showTemplateFeedback("error", `Нет объектов для применения шаблона`);
      return;
    }

    saveLayoutSnapshot("Перед применением шаблона");

    setDeskPositions((prev) => {
      const next: DeskPositions = { ...prev };
      targetIds.forEach((key) => {
        next[key] = {
          ...prev[key],
          ...(template.width !== undefined ? { width: template.width } : {}),
          ...(template.height !== undefined ? { height: template.height } : {}),
          ...(template.rotation !== undefined ? { rotation: template.rotation } : {}),
          ...(template.tiltX !== undefined ? { tiltX: template.tiltX } : {}),
          ...(template.tiltY !== undefined ? { tiltY: template.tiltY } : {}),
          ...(template.clipTlx !== undefined ? { clipTlx: template.clipTlx } : {}),
          ...(template.clipTly !== undefined ? { clipTly: template.clipTly } : {}),
          ...(template.clipTrx !== undefined ? { clipTrx: template.clipTrx } : {}),
          ...(template.clipTry !== undefined ? { clipTry: template.clipTry } : {}),
          ...(template.clipBrx !== undefined ? { clipBrx: template.clipBrx } : {}),
          ...(template.clipBry !== undefined ? { clipBry: template.clipBry } : {}),
          ...(template.clipBlx !== undefined ? { clipBlx: template.clipBlx } : {}),
          ...(template.clipBly !== undefined ? { clipBly: template.clipBly } : {}),
        };
      });

      return next;
    });

    showTemplateFeedback("success", `Шаблон применён: ${targetIds.length} ${kind === "folder" ? "объектов-папок" : "объектов-листов"}`);
  }, [deskPositions, saveLayoutSnapshot, showTemplateFeedback]);

  const moveToTrash = useCallback((kind: TrashItemKind, id: string, title: string) => {
    const now = Date.now();
    setTrashEntries((prev) => {
      const next = prev.filter((item) => !(item.kind === kind && item.id === id));
      next.unshift({ kind, id, title, deletedAt: now, expiresAt: now + TRASH_RETENTION_MS });
      return next;
    });
    setActiveFolderId((current) => (kind === "folder" && current === id ? null : current));
    setPreviewProject((current) => (kind === "project" && current?.id === id ? null : current));
  }, []);

  const restoreTrashEntry = useCallback((entry: TrashEntry) => {
    setTrashEntries((prev) => prev.filter((item) => !(item.kind === entry.kind && item.id === entry.id)));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSceneWidgetAction = useCallback(
    (action: SceneWidgetAction | undefined, widget?: SceneWidget) => {
      if (action === "createProject") {
        router.push('/projects/new');
        return;
      }
      if (action === "openCatalog") {
        router.push('/assessments');
        return;
      }
      if (action === "createFolder") {
        promptAndCreateFolder();
        return;
      }
      if (action === "openProjectAssembly") {
        if (widget?.kind === "video") {
          if (assemblyGuideTimerRef.current) window.clearTimeout(assemblyGuideTimerRef.current);
          setActiveAssemblyGuideId(widget.id);
          assemblyGuideTimerRef.current = window.setTimeout(() => {
            setClassicViewMode("desktop");
            setDesktopVariant("assembly");
            setActiveAssemblyGuideId(null);
            assemblyGuideTimerRef.current = null;
          }, 2600);
          return;
        }
        setClassicViewMode("desktop");
        setDesktopVariant("assembly");
        return;
      }
    },
    [router]
  );

  const startWidgetInteraction = useCallback(
    (e: any, widget: SceneWidget, mode: WidgetInteractionMode) => {
      if (!sceneEditMode || !canEditScene) return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedWidgetId(widget.id);
      widgetInteractionRef.current = { id: widget.id, mode, startX: e.clientX, startY: e.clientY, widget: { ...widget } };
    },
    [canEditScene, sceneEditMode]
  );

  useEffect(() => {
    if (!sceneEditMode) return;
    const handleMove = (e: MouseEvent) => {
      const current = widgetInteractionRef.current;
      if (!current) return;
      const dx = (e.clientX - current.startX) / officeSceneScale;
      const dy = (e.clientY - current.startY) / officeSceneScale;
      if (current.mode === "drag") {
        updateSceneWidget(current.id, {
          x: clampDesk(current.widget.x + dx, 40, DESK_WIDTH - current.widget.width - 40),
          y: clampDesk(current.widget.y + dy, 40, DESK_HEIGHT - current.widget.height - 40),
        });
        return;
      }
      if (current.mode === "resize") {
        const isMediaWidget = current.widget.kind === "image" || current.widget.kind === "video";
        const isCertificateWidget = current.widget.kind === "image" && CERTIFICATE_WIDGET_IDS.has(current.widget.id);
        updateSceneWidget(current.id, {
          width: clampDesk(current.widget.width + dx, isMediaWidget ? (isCertificateWidget ? 200 : 90) : 110, isMediaWidget ? DESK_WIDTH - 20 : 520),
          height: clampDesk(current.widget.height + dy, isMediaWidget ? (isCertificateWidget ? 140 : 120) : 30, isMediaWidget ? DESK_HEIGHT - 10 : 180),
        });
        return;
      }
      updateSceneWidget(current.id, { rotation: current.widget.rotation + dx * 0.18 });
    };
    const handleUp = () => {
      widgetInteractionRef.current = null;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [officeSceneScale, sceneEditMode, updateSceneWidget]);

  const startDeskItemInteraction = useCallback((e: any, itemId: string, kind: DeskItemKind, mode: DeskItemInteractionMode, position: DeskPosition) => {
    if (!sceneEditMode || !canEditScene) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedDeskItemId(itemId);
    deskInteractionRef.current = { id: itemId, kind, mode, startX: e.clientX, startY: e.clientY, position: { ...position } };
  }, [canEditScene, sceneEditMode]);

  useEffect(() => {
    if (!sceneEditMode) return;
    const handleMove = (e: MouseEvent) => {
      const currentSwitch = roomSwitchInteractionRef.current;
      if (currentSwitch) {
        const dx = (e.clientX - currentSwitch.startX) / officeSceneScale;
        const dy = (e.clientY - currentSwitch.startY) / officeSceneScale;
        if (!currentSwitch.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) currentSwitch.moved = true;
        setRoomSwitchPosition({
          x: clampDesk(currentSwitch.startLeft + dx, 0, DESK_WIDTH - DEFAULT_ROOM_SWITCH_ZONE.width),
          y: clampDesk(currentSwitch.startTop + dy, 0, DESK_HEIGHT - DEFAULT_ROOM_SWITCH_ZONE.height),
          width: DEFAULT_ROOM_SWITCH_ZONE.width,
          height: DEFAULT_ROOM_SWITCH_ZONE.height,
        });
        return;
      }
      const current = deskInteractionRef.current;
      if (!current) return;
      const dx = (e.clientX - current.startX) / officeSceneScale;
      const dy = (e.clientY - current.startY) / officeSceneScale;
      const isFolder = current.kind === "folder";
      const isGuide = current.kind === "guide";
      const isDevice = current.kind === "device";
      const isPanel = current.kind === "panel";
      const defaultWidth = isPanel
        ? (current.position.width ?? DEFAULT_LAPTOP_PANEL_POSITION.width ?? 226)
        : isDevice
          ? (current.position.width ?? DEFAULT_LAPTOP_POSITION.width ?? 372)
          : isGuide
            ? (current.position.width ?? 228)
            : isFolder
              ? DESK_FOLDER_WIDTH
              : DESK_SHEET_WIDTH;
      const defaultHeight = isPanel
        ? (current.position.height ?? DEFAULT_LAPTOP_PANEL_POSITION.height ?? 132)
        : isDevice
          ? (current.position.height ?? DEFAULT_LAPTOP_POSITION.height ?? 248)
          : isGuide
            ? (current.position.height ?? 104)
            : isFolder
              ? DESK_FOLDER_HEIGHT
              : DESK_SHEET_HEIGHT;
      const baseWidth = current.position.width ?? defaultWidth;
      const baseHeight = current.position.height ?? defaultHeight;
      if (current.mode === "drag") {
        const minX = current.kind === "project" ? -baseWidth * 0.5 : isDevice ? -baseWidth * 0.2 : 0;
        const minY = current.kind === "project" ? -baseHeight * 0.5 : isDevice ? -baseHeight * 0.12 : 0;
        const maxX = current.kind === "project" ? DESK_WIDTH - baseWidth * 0.5 : isDevice ? DESK_WIDTH - baseWidth * 0.8 : DESK_WIDTH - baseWidth;
        const maxY = current.kind === "project" ? OFFICE_SCENE_HEIGHT : isDevice ? DESK_HEIGHT - baseHeight * 0.8 : DESK_HEIGHT - baseHeight;
        updateDeskItem(current.id, {
          x: clampDesk((current.position.x ?? 0) + dx, minX, maxX),
          y: clampDesk((current.position.y ?? 0) + dy, minY, maxY),
        });
        return;
      }
      if (current.mode === "resize") {
        updateDeskItem(current.id, {
          width: clampDesk(baseWidth + dx, isPanel ? 180 : isDevice ? 260 : isGuide ? 120 : isFolder ? 120 : 140, isPanel ? 420 : isDevice ? 560 : isGuide ? 420 : isFolder ? 280 : 320),
          height: clampDesk(baseHeight + dy, isPanel ? 110 : isDevice ? 160 : isGuide ? 48 : isFolder ? 100 : 110, isPanel ? 260 : isDevice ? 360 : isGuide ? 220 : isFolder ? 260 : 320),
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
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [officeSceneScale, sceneEditMode, updateDeskItem]);

  const trashedProjectIds = useMemo(() => new Set(trashEntries.filter((item) => item.kind === "project").map((item) => item.id)), [trashEntries]);
  const trashedFolderIds = useMemo(() => new Set(trashEntries.filter((item) => item.kind === "folder").map((item) => item.id)), [trashEntries]);
  const projects = useMemo(() => (workspace?.projects || []).filter((item) => !trashedProjectIds.has(item.id)), [trashedProjectIds, workspace?.projects]);
  const folders = useMemo(() => (workspace?.folders || []).filter((item) => !trashedFolderIds.has(item.id)), [trashedFolderIds, workspace?.folders]);
  const folderBuckets = useMemo(() => {
    const buckets = new Map<string, ProjectRow[]>();
    for (const folder of folders) buckets.set(folder.id, []);
    const uncategorized: ProjectRow[] = [];
    for (const project of projects) {
      if (project.folder_id && buckets.has(project.folder_id)) {
        buckets.get(project.folder_id)!.push(project);
      } else {
        uncategorized.push(project);
      }
    }
    return {
      uncategorized: sortProjects(uncategorized),
      byFolder: folders.map((folder) => ({ folder, projects: sortProjects(buckets.get(folder.id) || []) })),
    };
  }, [folders, projects]);

  const classicSheetRows = useMemo(() => {
    const folderRows = folderBuckets.byFolder.map(({ folder, projects: folderProjects }) => ({
      rowId: `folder:${folder.id}`,
      kind: "folder" as const,
      id: folder.id,
      name: folder.name,
      goal: `Папка · ${folderProjects.length} ${folderProjects.length === 1 ? "проект" : folderProjects.length >= 2 && folderProjects.length <= 4 ? "проекта" : "проектов"}`,
      status: "Готова к работе",
      place: "Рабочий стол",
      createdAt: folder.created_at,
    }));
    const projectRows = projects.map((project) => ({
      rowId: `project:${project.id}`,
      kind: "project" as const,
      id: project.id,
      name: project.person?.full_name || project.title || "Проект",
      goal: getGoalDefinition(project.goal)?.title || "Цель не указана",
      status: project.status === "completed" ? "Оценка собрана" : project.status === "in_progress" ? "В работе" : "Ещё не собрана",
      place: project.folder_id ? (folders.find((folder) => folder.id === project.folder_id)?.name || "Папка") : "На рабочем столе",
      createdAt: project.created_at,
    }));
    return [...folderRows, ...projectRows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [folderBuckets.byFolder, folders, projects]);

  const visibleClassicSheetRows = useMemo(() => {
    const needle = classicSheetQuery.trim().toLowerCase();
    return classicSheetRows.filter((row) => {
      if (classicSheetKindFilter !== "all" && row.kind !== classicSheetKindFilter) return false;
      if (classicSheetPlaceFilter === "desktop" && row.place !== "Рабочий стол" && row.place !== "На рабочем столе") return false;
      if (classicSheetPlaceFilter === "folder" && (row.kind !== "project" || row.place === "На рабочем столе")) return false;
      if (!needle) return true;
      return [row.name, row.goal, row.status, row.place]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [classicSheetKindFilter, classicSheetPlaceFilter, classicSheetQuery, classicSheetRows]);

  const arrangeClassicDesktop = useCallback(() => {
    saveLayoutSnapshot("Перед упорядочиванием рабочего стола");
    const next: DeskPositions = { ...deskPositions };
    let z = deskLayer + 1;

    folderBuckets.byFolder.forEach(({ folder }, index) => {
      const col = Math.floor(index / 8);
      const row = index % 8;
      next[`folder:${folder.id}`] = {
        ...(next[`folder:${folder.id}`] || {}),
        x: 48 + col * 112,
        y: 72 + row * 100,
        z: z++,
        width: 86,
        height: 98,
        rotation: 0,
        tiltX: 0,
        tiltY: 0,
      };
    });

    folderBuckets.uncategorized.forEach((project, index) => {
      const col = Math.floor(index / 8);
      const row = index % 8;
      next[`project:${project.id}`] = {
        ...(next[`project:${project.id}`] || {}),
        x: 292 + col * 108,
        y: 72 + row * 100,
        z: z++,
        width: 86,
        height: 98,
        rotation: 0,
        tiltX: 0,
        tiltY: 0,
      };
    });

    setClassicViewMode("desktop");
    setDesktopVariant("classic");
    setDeskLayer(z + 1);
    setDeskPositions(next);
  }, [deskLayer, deskPositions, folderBuckets.byFolder, folderBuckets.uncategorized, saveLayoutSnapshot]);

  const resetSceneWidgets = useCallback(() => {
    const workspaceId = workspace?.workspace?.workspace_id;
    if (workspaceId && typeof window !== "undefined") {
      saveLayoutSnapshot("Перед сбросом сцены");
      window.localStorage.removeItem(getSceneWidgetsStorageKey(workspaceId, desktopVariant));
      window.localStorage.removeItem(getTrayGuideTextStorageKey(workspaceId));
      window.localStorage.removeItem(getDeskStorageKey(workspaceId, desktopVariant));
    }

    const allowedIds = new Set(defaultSceneWidgets.map((item) => item.id));
    const defaultsById = new Map(defaultSceneWidgets.map((item) => [item.id, item]));
    const baseWidgets = desktopVariant === "scheme" && sharedSceneWidgets.length ? sharedSceneWidgets : defaultSceneWidgets;
    const normalizedWidgets = baseWidgets
      .filter((item) => allowedIds.has(item.id) && !isDeprecatedProjectAssemblyWidget(item))
      .map((item) => {
        const defaults = defaultsById.get(item.id);
        if (!defaults) return item;
        return {
          ...item,
          text: typeof item.text === "string" ? item.text : defaults.text,
          action: defaults.action,
          kind: defaults.kind,
          tone: defaults.tone,
        };
      })
      .sort((a, b) => a.z - b.z);

    setSceneWidgets(normalizedWidgets.length ? normalizedWidgets : defaultSceneWidgets);
    setTrayGuideText(sharedTrayGuideText || "Создать новую папку проектов");
    setDeskPositions(mergeDeskPositions(folders, folderBuckets.uncategorized, { ...sharedDeskPositions, ...readGlobalDeskTemplates() }));
    setSelectedWidgetId(null);
    setSelectedDeskItemId(null);
  }, [defaultSceneWidgets, desktopVariant, folderBuckets.uncategorized, folders, saveLayoutSnapshot, sharedDeskPositions, sharedSceneWidgets, sharedTrayGuideText, workspace?.workspace?.workspace_id]);

  const activeFolder = useMemo(
    () => folderBuckets.byFolder.find((item) => item.folder.id === activeFolderId) || null,
    [activeFolderId, folderBuckets.byFolder]
  );
  const assemblyFolder = useMemo(
    () => folderBuckets.byFolder.find((item) => item.folder.id === assemblyFolderId) || null,
    [assemblyFolderId, folderBuckets.byFolder]
  );
  const completedFolderBuckets = useMemo(
    () => folderBuckets.byFolder.map((item) => ({ ...item, projects: item.projects.filter(isProjectReadyForAi) })),
    [folderBuckets.byFolder]
  );
  const completedLooseProjects = useMemo(
    () => folderBuckets.uncategorized.filter(isProjectReadyForAi),
    [folderBuckets.uncategorized]
  );
  const completedFoldersForAi = useMemo(
    () => completedFolderBuckets.filter((item) => item.projects.length > 0),
    [completedFolderBuckets]
  );
  const assemblyCompletedFolder = useMemo(
    () => completedFolderBuckets.find((item) => item.folder.id === assemblyFolderId) || null,
    [assemblyFolderId, completedFolderBuckets]
  );
  const assemblyAiContextProjects = useMemo(() => {
    if (assemblyAiContextScope === "folder") return assemblyCompletedFolder?.projects || [];
    if (assemblyAiContextScope === "loose") return completedLooseProjects;
    return [];
  }, [assemblyAiContextScope, assemblyCompletedFolder, completedLooseProjects]);
  const assemblyAiContextLabel = assemblyAiContextScope === "folder"
    ? assemblyCompletedFolder?.folder.name || "Папка не выбрана"
    : assemblyAiContextScope === "loose"
      ? "Готовые проекты без папки"
      : "Обычное сообщение";
  const assemblySuggestedCompetencies = useMemo(() => {
    if (!assemblyFolder?.projects.length) return COMPETENCY_ROUTES;
    const goalSet = new Set(assemblyFolder.projects.map((item) => item.goal));
    const filtered = COMPETENCY_ROUTES.filter((route) => route.linkedGoals.some((goal) => goalSet.has(goal)));
    return filtered.length ? filtered : COMPETENCY_ROUTES;
  }, [assemblyFolder]);
  const assemblyAiModelOptions = useMemo(
    () => (assemblyAiProvider === "openai" ? ASSEMBLY_AI_OPENAI_MODELS : ASSEMBLY_AI_DEEPSEEK_MODELS),
    [assemblyAiProvider]
  );
  const assemblyAiSelectedProject = useMemo(
    () => assemblyAiContextProjects.find((item) => item.id === assemblyAiProjectId) || assemblyAiContextProjects[0] || null,
    [assemblyAiContextProjects, assemblyAiProjectId]
  );
  const assemblyAiActiveChat = useMemo(
    () => assemblyAiChats.find((item) => item.id === assemblyAiActiveChatId) || null,
    [assemblyAiActiveChatId, assemblyAiChats]
  );
  const assemblyAiAnalysisMode: AssemblyAiMode =
    assemblyAiContextScope === "folder"
      ? assemblyAiFolderTarget === "person"
        ? "project_message"
        : "folder_analysis"
      : assemblyAiContextScope === "loose"
        ? "project_message"
        : "message";
  const assemblyAiCurrentSignature = useMemo(() => {
    if (assemblyAiAnalysisMode === "folder_analysis") {
      return makeAssemblyFolderSignature(assemblyCompletedFolder?.folder.id || null, assemblyAiContextProjects);
    }
    if (assemblyAiAnalysisMode === "project_message") {
      return makeAssemblyPersonSignature(assemblyAiSelectedProject);
    }
    return "";
  }, [assemblyAiAnalysisMode, assemblyAiContextProjects, assemblyAiSelectedProject, assemblyCompletedFolder?.folder.id]);
  const assemblyAiCanFollowUp = Boolean(
    assemblyAiActiveChat?.analysisAnchor &&
    assemblyAiCurrentSignature &&
    assemblyAiActiveChat.analysisAnchor.signature === assemblyAiCurrentSignature &&
    assemblyAiActiveChat.analysisAnchor.mode === assemblyAiAnalysisMode &&
    assemblyAiActiveChat.analysisAnchor.contextScope === assemblyAiContextScope &&
    assemblyAiActiveChat.analysisAnchor.folderId === (assemblyAiContextScope === "folder" ? assemblyCompletedFolder?.folder.id || null : null) &&
    assemblyAiActiveChat.analysisAnchor.projectId === (assemblyAiAnalysisMode === "project_message" ? assemblyAiSelectedProject?.id || null : null)
  );
  const assemblyAiEffectiveMode: AssemblyAiMode =
    assemblyAiAnalysisMode === "message" || assemblyAiCanFollowUp ? "message" : assemblyAiAnalysisMode;
  const assemblyAiMaxOutputTokens = assemblyAiEffectiveMode === "message" ? 3000 : ASSEMBLY_AI_MAX_OUTPUT_TOKENS;
  const assemblyAiFolderPriceRub = useMemo(
    () => getAssemblyAiPriceRub(assemblyAiProvider, assemblyAiModel, "folder_analysis"),
    [assemblyAiModel, assemblyAiProvider]
  );
  const assemblyAiPersonPriceRub = useMemo(
    () => getAssemblyAiPriceRub(assemblyAiProvider, assemblyAiModel, "project_message"),
    [assemblyAiModel, assemblyAiProvider]
  );
  const assemblyAiMessagePriceRub = useMemo(
    () => getAssemblyAiPriceRub(assemblyAiProvider, assemblyAiModel, "message"),
    [assemblyAiModel, assemblyAiProvider]
  );
  const assemblyAiPriceRub = useMemo(
    () => getAssemblyAiPriceRub(assemblyAiProvider, assemblyAiModel, assemblyAiEffectiveMode),
    [assemblyAiEffectiveMode, assemblyAiModel, assemblyAiProvider]
  );
  const assemblyAiCanAfford = isUnlimited || balance_rub >= assemblyAiPriceRub;
  const assemblyAiCanSend =
    !assemblyAiBusy &&
    assemblyAiCanAfford &&
    (assemblyAiEffectiveMode === "message"
      ? Boolean(assemblyAiDraft.trim())
      : assemblyAiEffectiveMode === "folder_analysis"
        ? Boolean(assemblyCompletedFolder && assemblyAiContextProjects.length > 0)
        : Boolean(assemblyAiSelectedProject));
  const assemblyAiStorageKey = useMemo(
    () => (workspace?.workspace?.workspace_id ? getAssemblyAiChatsStorageKey(workspace.workspace.workspace_id) : ""),
    [workspace?.workspace?.workspace_id]
  );
  const filteredAssemblyAiChats = useMemo(() => {
    const needle = assemblyAiChatSearch.trim().toLowerCase();
    return assemblyAiChats.filter((chat) => {
      if (!needle) return true;
      return `${chat.title} ${chat.contextLabel} ${chat.lastUserMessage} ${chat.model}`.toLowerCase().includes(needle);
    });
  }, [assemblyAiChatSearch, assemblyAiChats]);

  const persistAssemblyAiChats = useCallback((updater: (prev: AssemblyAiChat[]) => AssemblyAiChat[]) => {
    setAssemblyAiChats((prev) => {
      const next = updater(prev).slice(0, 60);
      if (assemblyAiStorageKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(assemblyAiStorageKey, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  }, [assemblyAiStorageKey]);

  useEffect(() => {
    if (!assemblyAiStorageKey || typeof window === "undefined") return;
    if (assemblyAiLoadedRef.current) return;
    assemblyAiLoadedRef.current = true;
    try {
      const raw = window.localStorage.getItem(assemblyAiStorageKey);
      const loaded = raw ? JSON.parse(raw) : [];
      const chats = Array.isArray(loaded) ? (loaded as AssemblyAiChat[]) : [];
      setAssemblyAiChats(chats);
      if (chats[0] && !assemblyAiActiveChatId) {
        setAssemblyAiActiveChatId(chats[0].id);
        setAssemblyAiMessages(chats[0].messages?.length ? chats[0].messages : []);
        setAssemblyAiInsight(chats[0].insight || null);
        setAssemblyAiProvider(chats[0].provider || "openai");
        setAssemblyAiModel(chats[0].model || "gpt-5.4-mini");
        setAssemblyAiContextScope(chats[0].contextScope || "folder");
        setAssemblyAiFolderTarget(chats[0].contextScope === "folder" && chats[0].analysisAnchor?.mode === "project_message" ? "person" : "folder");
        setAssemblyFolderId(chats[0].folderId || null);
        setAssemblyAiProjectId(chats[0].projectId || "");
      }
    } catch {
      setAssemblyAiChats([]);
    }
  }, [assemblyAiActiveChatId, assemblyAiStorageKey]);

  const openAssemblyAiChat = useCallback((chat: AssemblyAiChat) => {
    setAssemblyAiActiveChatId(chat.id);
    setAssemblyAiMessages(chat.messages?.length ? chat.messages : []);
    setAssemblyAiInsight(chat.insight || null);
    setAssemblyAiProvider(chat.provider || "openai");
    setAssemblyAiModel(chat.model || "gpt-5.4-mini");
    setAssemblyAiContextScope(chat.contextScope || "folder");
    setAssemblyAiFolderTarget(chat.contextScope === "folder" && chat.analysisAnchor?.mode === "project_message" ? "person" : "folder");
    setAssemblyFolderId(chat.folderId || null);
    setAssemblyAiProjectId(chat.projectId || "");
    setAssemblyAiDraft("");
    setAssemblyAiError("");
  }, []);

  const startNewAssemblyAiChat = useCallback(() => {
    setAssemblyAiActiveChatId("");
    setAssemblyAiInsight(null);
    setAssemblyAiFolderTarget("folder");
    setAssemblyAiDraft("");
    setAssemblyAiError("");
    setAssemblyAiLastCharge(null);
    setAssemblyAiMessages([
      {
        id: "assembly-ai-welcome",
        role: "assistant",
        content: "Выберите папку для общего анализа, готового человека без папки для персонального разбора или режим без выбора для обычного вопроса.",
      },
    ]);
  }, []);

  const saveAssemblyAiRename = useCallback(() => {
    const title = assemblyAiEditingTitle.trim();
    if (!assemblyAiEditingChatId || !title) return;
    persistAssemblyAiChats((prev) => prev.map((chat) => chat.id === assemblyAiEditingChatId ? { ...chat, title } : chat));
    setAssemblyAiEditingChatId("");
    setAssemblyAiEditingTitle("");
  }, [assemblyAiEditingChatId, assemblyAiEditingTitle, persistAssemblyAiChats]);

  const deleteAssemblyAiChat = useCallback((chatId: string) => {
    persistAssemblyAiChats((prev) => prev.filter((chat) => chat.id !== chatId));
    if (assemblyAiActiveChatId === chatId) startNewAssemblyAiChat();
  }, [assemblyAiActiveChatId, persistAssemblyAiChats, startNewAssemblyAiChat]);

  useEffect(() => {
    if (assemblyAiModelOptions.some((item) => item.id === assemblyAiModel)) return;
    setAssemblyAiModel(assemblyAiModelOptions[0]?.id || "gpt-5.4-mini");
  }, [assemblyAiModel, assemblyAiModelOptions]);

  useEffect(() => {
    if (!assemblyAiContextProjects.length) {
      setAssemblyAiProjectId("");
      return;
    }
    if (assemblyAiContextProjects.some((item) => item.id === assemblyAiProjectId)) return;
    setAssemblyAiProjectId(assemblyAiContextProjects[0].id);
  }, [assemblyAiContextProjects, assemblyAiProjectId]);
  const totalAttempts = useMemo(
    () => projects.reduce((sum, item) => sum + (item.attempts_count || 0), 0),
    [projects]
  );
  const selectedDeskItem = useMemo(() => {
    if (!selectedDeskItemId) return null;
    if (selectedDeskItemId === TRAY_GUIDE_ID) {
      return { kind: "guide" as const, id: selectedDeskItemId, title: "Виртуальная стойка", position: deskPositions[selectedDeskItemId] || getDefaultTrayGuidePosition() };
    }
    if (selectedDeskItemId === TRASH_GUIDE_ID) {
      return { kind: "guide" as const, id: selectedDeskItemId, title: "Виртуальная зона корзины", position: deskPositions[selectedDeskItemId] || getDefaultTrashGuidePosition() };
    }
    if (selectedDeskItemId === LAPTOP_DEVICE_ID) {
      return { kind: "device" as const, id: selectedDeskItemId, title: "Ноутбук на столе", position: deskPositions[selectedDeskItemId] || DEFAULT_LAPTOP_POSITION };
    }
    if (selectedDeskItemId === LAPTOP_PANEL_ID) {
      return { kind: "panel" as const, id: selectedDeskItemId, title: "Панель ноутбука", position: deskPositions[selectedDeskItemId] || DEFAULT_LAPTOP_PANEL_POSITION };
    }
    if (selectedDeskItemId.startsWith("folder:")) {
      const id = selectedDeskItemId.replace("folder:", "");
      const folder = folders.find((item) => item.id === id);
      if (!folder) return null;
      return { kind: "folder" as const, id: selectedDeskItemId, title: folder.name, position: deskPositions[selectedDeskItemId] || { x: 0, y: 0, z: 0 } };
    }
    if (selectedDeskItemId.startsWith("project:")) {
      const id = selectedDeskItemId.replace("project:", "");
      const project = projects.find((item) => item.id === id);
      if (!project) return null;
      return { kind: "project" as const, id: selectedDeskItemId, title: project.title || project.person?.full_name || "Проект", position: deskPositions[selectedDeskItemId] || { x: 0, y: 0, z: 0 } };
    }
    return null;
  }, [deskPositions, folders, projects, selectedDeskItemId]);

  useEffect(() => {
    if (!activeFolderId) return;
    const stillExists = folderBuckets.byFolder.some((item) => item.folder.id === activeFolderId);
    if (!stillExists) setActiveFolderId(null);
  }, [activeFolderId, folderBuckets.byFolder]);

  useEffect(() => {
    if (desktopVariant !== "assembly") return;
    if (assemblyAiContextScope !== "folder") return;
    if (assemblyFolderId && completedFoldersForAi.some((item) => item.folder.id === assemblyFolderId)) return;
    setAssemblyFolderId(completedFoldersForAi[0]?.folder.id || null);
  }, [assemblyAiContextScope, assemblyFolderId, completedFoldersForAi, desktopVariant]);

  useEffect(() => {
    if (!assemblyFolder?.projects.length) return;
    const suggestedRole = assemblyFolder.projects.find((item) => item.target_role)?.target_role || "";
    setAssemblyFitRequest((prev) => prev || suggestedRole);
  }, [assemblyFolder?.folder.id, assemblyFolder?.projects]);

  const loadAssemblyComparison = useCallback(async (folderId: string) => {
    if (!session?.access_token) return;
    const bucket = folderBuckets.byFolder.find((item) => item.folder.id === folderId) || null;
    if (!bucket) {
      setAssemblyComparison(null);
      setAssemblyError("Папка не найдена.");
      return;
    }
    if (bucket.projects.length < 2) {
      setAssemblyComparison(null);
      setAssemblyError("Для общего анализа в папке нужно минимум два проекта.");
      return;
    }
    setAssemblyLoading(true);
    setAssemblyError("");
    try {
      const projectsForComparison = bucket.projects.slice(0, ASSEMBLY_PROJECT_LIMIT);
      const resp = await fetch("/api/commercial/projects/candidate-comparison", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          project_ids: projectsForComparison.map((item) => item.id),
          selected_competency_ids: assemblySelectedCompetencyIds,
          fit_request: assemblyFitRequest.trim(),
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось собрать общий анализ папки");
      setAssemblyComparison(json as CandidateComparisonPayload);
    } catch (e: any) {
      setAssemblyComparison(null);
      setAssemblyError(e?.message || "Не удалось собрать общий анализ папки");
    } finally {
      setAssemblyLoading(false);
    }
  }, [assemblyFitRequest, assemblySelectedCompetencyIds, folderBuckets.byFolder, session?.access_token]);

  const sendAssemblyAiMessage = useCallback(async (modeOverride?: AssemblyAiMode) => {
    if (!session?.access_token) return;
    const mode = modeOverride || assemblyAiEffectiveMode;
    if (mode === "folder_analysis" && !assemblyCompletedFolder) {
      setAssemblyAiError("Выберите папку с полностью завершенными проектами.");
      return;
    }
    if (mode === "folder_analysis" && !assemblyAiContextProjects.length) {
      setAssemblyAiError("В выбранном контексте пока нет полностью завершенных проектов.");
      return;
    }
    const draft = assemblyAiDraft.trim();
    if (mode === "message" && !draft) {
      setAssemblyAiError("Напишите вопрос.");
      return;
    }
    if (mode === "project_message" && !assemblyAiSelectedProject) {
      setAssemblyAiError("Выберите завершенный проект-человека для персонального сообщения.");
      return;
    }
    if (!assemblyAiCanAfford) {
      setAssemblyAiError(`Недостаточно средств на балансе. Нужно ${assemblyAiPriceRub} ₽.`);
      return;
    }

    const visibleText =
      draft ||
      (mode === "folder_analysis"
        ? `Сделай анализ: ${assemblyAiContextLabel}.`
        : `Разбери проект «${assemblyAiSelectedProject?.person?.full_name || assemblyAiSelectedProject?.title || "человек"}».`);
    const requestProjectId =
      mode === "project_message"
        ? assemblyAiSelectedProject?.id || ""
        : mode === "message" && assemblyAiCanFollowUp
          ? assemblyAiActiveChat?.analysisAnchor?.projectId || ""
          : "";
    const userMessage: AssemblyAiMessage = { id: `assembly-ai-user-${Date.now()}`, role: "user", content: visibleText };
    const pendingMessage: AssemblyAiMessage = { id: `assembly-ai-pending-${Date.now()}`, role: "assistant", content: "Собираю завершенные проекты и готовлю ответ...", pending: true };
    const history = assemblyAiMessages
      .filter((item) => item.id !== "assembly-ai-welcome" && !item.pending)
      .slice(-8)
      .map((item) => ({ role: item.role, content: item.content }));
    const messagesWithPending = [...assemblyAiMessages, userMessage, pendingMessage];

    setAssemblyAiBusy(true);
    setAssemblyAiError("");
    setAssemblyAiLastCharge(null);
    setAssemblyAiDraft("");
    setAssemblyAiMode(mode);
    setAssemblyAiMessages(messagesWithPending);

    try {
      const expectedSignature = mode === "message" && assemblyAiCanFollowUp
        ? assemblyAiActiveChat?.analysisAnchor?.serverSignature || assemblyAiActiveChat?.analysisAnchor?.signature || assemblyAiCurrentSignature
        : "";
      const resp = await fetch("/api/commercial/ai-folder-chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          provider: assemblyAiProvider,
          model: assemblyAiModel,
          mode,
          context_scope: assemblyAiContextScope,
          folder_id: assemblyAiContextScope === "folder" ? assemblyCompletedFolder?.folder.id || "" : "",
          project_id: requestProjectId,
          expected_context_signature: expectedSignature,
          message: draft,
          history,
          max_output_tokens: assemblyAiMaxOutputTokens,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось получить AI-ответ.");
      setAssemblyAiLastCharge(Math.floor(Number(json.charged_kopeks || json.price_kopeks || 0) / 100));
      const assistantMessage: AssemblyAiMessage = {
        id: `assembly-ai-assistant-${Date.now()}`,
        role: "assistant",
        content: String(json.text || "Готово."),
      };
      const nextMessages = messagesWithPending.map((item) => (item.id === pendingMessage.id ? assistantMessage : item));
      const nextInsight = (json.insight || null) as AssemblyAiInsight | null;
      const chatProjectId =
        mode === "project_message"
          ? assemblyAiSelectedProject?.id || null
          : assemblyAiActiveChat?.analysisAnchor?.projectId || null;
      const nextAnchor =
        mode === "folder_analysis" || mode === "project_message"
          ? {
              mode,
              contextScope: assemblyAiContextScope === "folder" ? "folder" as const : "loose" as const,
              folderId: assemblyAiContextScope === "folder" ? assemblyCompletedFolder?.folder.id || null : null,
              projectId: mode === "project_message" ? assemblyAiSelectedProject?.id || null : null,
              signature: assemblyAiCurrentSignature,
              serverSignature: String(json.context_signature || ""),
            }
          : assemblyAiActiveChat?.analysisAnchor || null;
      setAssemblyAiMessages(nextMessages);
      if (nextInsight) setAssemblyAiInsight(nextInsight);
      const chatId = assemblyAiActiveChatId || `assembly-ai-chat-${Date.now()}`;
      const chat: AssemblyAiChat = {
        id: chatId,
        title: assemblyAiActiveChat?.title || makeAssemblyChatTitle(visibleText),
        updatedAt: new Date().toISOString(),
        provider: assemblyAiProvider,
        model: assemblyAiModel,
        contextScope: assemblyAiContextScope,
        folderId: assemblyAiContextScope === "folder" ? assemblyCompletedFolder?.folder.id || null : null,
        projectId: chatProjectId,
        analysisAnchor: nextAnchor,
        contextLabel: String(json.context_label || assemblyAiContextLabel),
        lastUserMessage: visibleText,
        messages: nextMessages,
        insight: nextInsight || assemblyAiInsight,
      };
      setAssemblyAiActiveChatId(chatId);
      persistAssemblyAiChats((prev) => [chat, ...prev.filter((item) => item.id !== chatId)]);
      await refreshWallet();
    } catch (e: any) {
      setAssemblyAiError(e?.message || "Не удалось получить AI-ответ.");
      setAssemblyAiMessages((prev) => prev.filter((item) => item.id !== pendingMessage.id));
    } finally {
      setAssemblyAiBusy(false);
    }
  }, [
    assemblyAiCanAfford,
    assemblyAiCanFollowUp,
    assemblyAiActiveChat,
    assemblyAiActiveChatId,
    assemblyAiContextLabel,
    assemblyAiContextProjects.length,
    assemblyAiContextScope,
    assemblyAiDraft,
    assemblyAiEffectiveMode,
    assemblyAiCurrentSignature,
    assemblyAiInsight,
    assemblyAiMessages,
    assemblyAiMaxOutputTokens,
    assemblyAiMode,
    assemblyAiModel,
    assemblyAiPriceRub,
    assemblyAiProvider,
    assemblyAiSelectedProject,
    assemblyCompletedFolder,
    persistAssemblyAiChats,
    refreshWallet,
    session?.access_token,
  ]);

  useEffect(() => {
    if (desktopVariant !== "assembly") return;
    setAssemblyComparison(null);
    setAssemblyError("");
  }, [desktopVariant]);

  useEffect(() => {
    if (!previewProject) return;
    const stillExists = projects.some((item) => item.id === previewProject.id);
    if (!stillExists) setPreviewProject(null);
  }, [previewProject, projects]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady) return;
    const saved = typeof window !== "undefined"
      ? (() => {
          try {
            const raw = window.localStorage.getItem(getDeskStorageKey(workspace.workspace.workspace_id, desktopVariant));
            const parsed = raw ? (JSON.parse(raw) as DeskPositions) : {};
            return stripSharedScenePositions(parsed);
          } catch {
            return {} as DeskPositions;
          }
        })()
      : ({} as DeskPositions);
    const globalTemplates = readGlobalDeskTemplates();

    const merged = mergeDeskPositions(folders, folderBuckets.uncategorized, { ...sharedDeskPositions, ...globalTemplates, ...saved });
    setDeskLayer(Object.values(merged).reduce((max, item) => Math.max(max, item.z || 0), 300));
    setDeskPositions(merged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktopVariant, workspace?.workspace?.workspace_id, folders, folderBuckets.uncategorized, sharedDeskPositions]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || !sharedSceneReady || typeof window === "undefined") return;
    window.localStorage.setItem(
      getDeskStorageKey(workspace.workspace.workspace_id, desktopVariant),
      JSON.stringify(stripSharedScenePositions(deskPositions))
    );
  }, [deskPositions, desktopVariant, sharedSceneReady, workspace?.workspace?.workspace_id]);

  function getNextFolderSpawnPosition(folderId: string): DeskPosition {
    const guideRect = getGuideClipRect(deskPositions[TRAY_GUIDE_ID]);
    const template = deskPositions[FOLDER_TEMPLATE_ID] || {};
    const folderCountInTray = folders.filter((folder) => {
      const position = deskPositions[`folder:${folder.id}`];
      if (!position) return true;
      const centerX = (position.x || 0) + ((position.width || DESK_FOLDER_WIDTH) / 2);
      const centerY = (position.y || 0) + ((position.height || DESK_FOLDER_HEIGHT) / 2);
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
      clipBly: template.clipBly,
    } as DeskPosition;
  }

  useEffect(() => {
    const pending = pendingCreatedFolderRef.current;
    if (!pending) return;
    const folderExists = folders.some((item) => item.id === pending.id);
    if (!folderExists) return;
    const nextPosition = getNextFolderSpawnPosition(pending.id);
    setDeskPositions((prev) => ({
      ...prev,
      [`folder:${pending.id}`]: {
        ...(prev[`folder:${pending.id}`] || {}),
        ...nextPosition,
      },
    }));
    pendingCreatedFolderRef.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deskLayer, deskPositions, folders]);

  const bringDeskItemToFront = useCallback((itemId: string) => {
    setDeskLayer((current) => {
      const next = current + 1;
      setDeskPositions((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || { x: 48, y: 48, z: next }),
          z: next,
        },
      }));
      return next;
    });
  }, []);

  const isInsideGuideRect = useCallback((x: number, y: number) => {
    const rect = getGuideClipRect(deskPositions[TRAY_GUIDE_ID]);
    const centerX = x + 48;
    const centerY = y + 48;
    return centerX >= rect.x && centerX <= rect.x + rect.width && centerY >= rect.y && centerY <= rect.y + rect.height;
  }, [deskPositions]);

  const trashGuideRect = useMemo(() => getGuideClipRect(deskPositions[TRASH_GUIDE_ID]), [deskPositions]);


  const placeDeskItem = useCallback((itemId: string, kind: "folder" | "project", x: number, y: number) => {
    const current = deskPositions[itemId] || {};
    const itemWidth = current.width || (kind === "folder" ? DESK_FOLDER_WIDTH : DESK_SHEET_WIDTH);
    const itemHeight = current.height || (kind === "folder" ? DESK_FOLDER_HEIGHT : DESK_SHEET_HEIGHT);
    const minX = kind === "project" ? -itemWidth * 0.5 : 24;
    const minY = kind === "project" ? -itemHeight * 0.5 : 24;
    const maxX = kind === "project" ? DESK_WIDTH - itemWidth * 0.5 : DESK_WIDTH - itemWidth - 24;
    const maxY = kind === "project" ? OFFICE_SCENE_HEIGHT : DESK_HEIGHT - itemHeight - 24;
    let nextX = clampDesk(x, minX, maxX);
    let nextY = clampDesk(y, minY, maxY);

    if (kind === "project") {
      const blockedRect = getDeskRect(
        laptopPanelPosition,
        laptopPanelPosition.width || DEFAULT_LAPTOP_PANEL_POSITION.width || 226,
        laptopPanelPosition.height || DEFAULT_LAPTOP_PANEL_POSITION.height || 132,
        6,
      );
      const safe = keepRectOutOfBlockedZone({ left: nextX, top: nextY, right: nextX + itemWidth, bottom: nextY + itemHeight }, blockedRect, { minX, minY, maxX, maxY });
      nextX = safe.x;
      nextY = safe.y;
    }

    if (kind === "folder") {
      const folderId = itemId.replace("folder:", "");
      const folderIndex = Math.max(0, folders.findIndex((item) => item.id === folderId));
      const guideRect = getGuideClipRect(deskPositions[TRAY_GUIDE_ID]);
      const snapped = isInsideGuideRect(nextX, nextY)
        ? { x: guideRect.x + 8 + folderIndex * 12, y: guideRect.y + 6 + folderIndex * 7, z: 20 + folderIndex, width: current.width, height: current.height, rotation: current.rotation, tiltX: current.tiltX, tiltY: current.tiltY }
        : { x: nextX, y: nextY, z: 20 + folderIndex, width: current.width, height: current.height, rotation: current.rotation, tiltX: current.tiltX, tiltY: current.tiltY };
      setDeskPositions((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || { z: deskLayer + 1 }),
          x: snapped.x,
          y: snapped.y,
          z: prev[itemId]?.z || deskLayer + 1,
          width: snapped.width,
          height: snapped.height,
          rotation: snapped.rotation,
        },
      }));
      return;
    }

    setDeskPositions((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { z: deskLayer + 1 }),
        x: nextX,
        y: nextY,
        z: prev[itemId]?.z || deskLayer + 1,
        width: current.width,
        height: current.height,
        rotation: current.rotation,
      },
    }));
  }, [deskLayer, deskPositions, folders, isInsideGuideRect, laptopPanelPosition]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleDeskDrop = useCallback((e: any) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const draggedProjectId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
    const draggedFolderId = e.dataTransfer.getData("text/folder-id") || "";
    const sceneX = (e.clientX - rect.left) / officeSceneScale;
    const sceneY = (e.clientY - rect.top) / officeSceneScale;

    if (draggedProjectId) {
      const wasInFolder = !folderBuckets.uncategorized.some((project) => project.id === draggedProjectId);
      const itemId = `project:${draggedProjectId}`;
      bringDeskItemToFront(itemId);
      placeDeskItem(itemId, "project", sceneX - DESK_SHEET_WIDTH / 2, sceneY - DESK_SHEET_HEIGHT / 2);
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
      placeDeskItem(itemId, "folder", sceneX - DESK_FOLDER_WIDTH / 2, sceneY - DESK_FOLDER_HEIGHT / 2);
      setDraggingFolderId(null);
      clearTrashHover();
    }
  }, [bringDeskItemToFront, clearTrashHover, draggingProjectId, folderBuckets.uncategorized, moveProject, officeSceneScale, placeDeskItem]);

  async function createFolderNamed(nameValue: string, iconKey: FolderIconKey = newFolderIcon) {
    const name = nameValue.trim();
    if (!name || !session) return;
    setBusyFolderId("new");
    try {
      const resp = await fetch("/api/commercial/folders/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name, icon_key: iconKey }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось создать папку");
      const newFolderId = String(json?.folder?.id || "");
      if (newFolderId) {
        pendingCreatedFolderRef.current = { id: newFolderId };
        const nextPosition = getNextFolderSpawnPosition(newFolderId);
        setDeskPositions((prev) => ({
          ...prev,
          [`folder:${newFolderId}`]: nextPosition,
        }));
      }
      setNewFolderName("");
      setNewFolderIcon("folder");
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setBusyFolderId(null);
    }
  }

  function promptAndCreateFolder() {
    const name = typeof window !== 'undefined' ? window.prompt('Название новой папки', 'Новая папка') : null;
    if (name && name.trim()) void createFolderNamed(name.trim(), 'folder');
  }

  async function createFolder() {
    return createFolderNamed(newFolderName, newFolderIcon);
  }

  function openRenameFolder(folder: FolderRow) {
    setFolderActionTarget(null);
    setFolderRenameTarget(folder);
    setFolderRenameValue(folder.name);
  }

  async function saveRenameFolder() {
    if (!session || !folderRenameTarget) return;
    const name = folderRenameValue.trim();
    if (!name) return;
    if (name === folderRenameTarget.name) {
      setFolderRenameTarget(null);
      return;
    }
    setBusyFolderId(folderRenameTarget.id);
    try {
      const resp = await fetch("/api/commercial/folders/update", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: folderRenameTarget.id, name }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось переименовать папку");
      setFolderRenameTarget(null);
      setFolderRenameValue("");
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setBusyFolderId(null);
    }
  }

  async function updateFolderIcon(folder: FolderRow, iconKey: FolderIconKey) {
    if (!session) return;
    setBusyFolderId(folder.id);
    try {
      const resp = await fetch("/api/commercial/folders/update", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: folder.id, icon_key: iconKey }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось обновить иконку");
      setIconPickerFolder(null);
      setFolderActionTarget(null);
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setBusyFolderId(null);
    }
  }

  function openDeleteFolder(folder: FolderRow) {
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
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: folder.id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось удалить папку");
      setFolderDeleteTarget(null);
      setActiveFolderId((current) => (current === folder.id ? null : current));
      setIconPickerFolder((current) => (current?.id === folder.id ? null : current));
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setBusyFolderId(null);
    }
  }

  async function deleteFolderDirect(folderId: string) {
    if (!session) return;
    setBusyFolderId(folderId);
    try {
      const resp = await fetch("/api/commercial/folders/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: folderId }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось удалить папку");
      setFolderDeleteTarget(null);
      setActiveFolderId((current) => (current === folderId ? null : current));
      setIconPickerFolder((current) => (current?.id === folderId ? null : current));
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setBusyFolderId(null);
    }
  }

  async function moveProject(projectId: string, folderId: string | null) {
    if (!session) return;
    setBusyFolderId(folderId || "desktop");
    try {
      const resp = await fetch("/api/commercial/folders/move-project", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ project_id: projectId, folder_id: folderId }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось переместить проект");
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setDraggingProjectId(null);
      setBusyFolderId(null);
    }
  }

  async function deleteProject(projectId: string, skipConfirm = false) {
    if (!session) return;
    if (!skipConfirm && !window.confirm("Удалить проект? Это действие уберёт проект, приглашение и результаты по нему.")) return;
    setBusyFolderId(`delete:${projectId}`);
    try {
      const resp = await fetch("/api/commercial/projects/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ project_id: projectId }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось удалить проект");
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
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

  const beginTrashHover = useCallback((kind: "project" | "folder", id: string) => {
    setTrashHover((current) => {
      if (current?.kind === kind && current?.id === id) return current;
      return { kind, id };
    });
    if (trashHoverTimer.current) window.clearTimeout(trashHoverTimer.current);
    trashHoverTimer.current = window.setTimeout(() => {
      if (kind === "project") {
        const project = (workspace?.projects || []).find((item) => item.id === id);
        moveToTrash("project", id, project?.title || project?.person?.full_name || "Проект");
      } else {
        const folder = (workspace?.folders || []).find((item) => item.id === id);
        moveToTrash("folder", id, folder?.name || "Папка");
      }
      setDraggingProjectId(null);
      setDraggingFolderId(null);
      setTrashHover(null);
      trashHoverTimer.current = null;
    }, 650);
  }, [moveToTrash, workspace?.folders, workspace?.projects]);

  useEffect(() => () => {
    if (trashHoverTimer.current) window.clearTimeout(trashHoverTimer.current);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
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
    return (
      <Layout title="Кабинет">
        <div className="card text-sm text-slate-700">Переадресация на вход…</div>
      </Layout>
    );
  }

  const trayFolders = folderBuckets.byFolder.filter(({ folder }, index) => {
    const pos = deskPositions[`folder:${folder.id}`] || getDefaultFolderPosition(index);
    return isInsideGuideRect(pos.x, pos.y);
  });
  const looseFolders = folderBuckets.byFolder.filter(({ folder }, index) => {
    const pos = deskPositions[`folder:${folder.id}`] || getDefaultFolderPosition(index);
    return !isInsideGuideRect(pos.x, pos.y);
  });
  const showDesktopLoader = !error && (loading || !sharedSceneReady || Boolean(workspace?.workspace?.workspace_id && !deskVisualReady));
  const assemblyLeader = assemblyComparison?.winner_board?.[0] || null;
  const assemblyAverageIndex = assemblyComparison?.ranking?.length
    ? Math.round(assemblyComparison.ranking.reduce((sum, item) => sum + item.calibrated_index, 0) / Math.max(1, assemblyComparison.ranking.length))
    : null;
  const assemblyTopCompetency = assemblyComparison?.competency_leaders?.[0] || null;
  const mobileDashboard = (
    <MobileDashboardHome
      displayName={displayName}
      workspaceName={workspaceName}
      balanceText={balanceText}
      activeSubscription={activeSubscription}
      projects={projects}
      folders={folders}
      trashCount={trashEntries.length}
      loading={loading}
      error={error}
      onCreateProject={() => router.push("/projects/new")}
      onCreateFolder={promptAndCreateFolder}
      onOpenTrash={() => setTrashOpen(true)}
      onOpenProject={(id) => router.push(`/projects/${id}`)}
    />
  );
  const trashRestoreModal = trashOpen ? (
    <TrashRestoreModal
      entries={trashEntries}
      folders={workspace?.folders || []}
      projects={workspace?.projects || []}
      onClose={() => setTrashOpen(false)}
      onRestore={restoreTrashEntry}
      onDeleteNow={(entry) => {
        if (entry.kind === "project") void deleteProject(entry.id, true);
        else void deleteFolderDirect(entry.id);
        setTrashEntries((prev) => prev.filter((item) => !(entry.kind === item.kind && entry.id === item.id)));
      }}
    />
  ) : null;
  const desktopModeTabs = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`btn btn-sm ${desktopVariant === "scheme" ? "btn-primary" : "btn-secondary"}`}
        onClick={() => setDesktopVariant("scheme")}
      >
        Основной
      </button>
      <button
        type="button"
        className={`btn btn-sm ${desktopVariant === "classic" && classicViewMode === "desktop" ? "btn-primary" : "btn-secondary"}`}
        onClick={() => {
          setDesktopVariant("classic");
          setClassicViewMode("desktop");
        }}
      >
        Стандартный
      </button>
      <button
        type="button"
        className={`btn btn-sm ${desktopVariant === "classic" && classicViewMode === "sheet" ? "btn-primary" : "btn-secondary"}`}
        onClick={() => {
          setDesktopVariant("classic");
          setClassicViewMode("sheet");
        }}
      >
        Таблицы
      </button>
    </div>
  );
  const classicQuickActions = (
    <>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => router.push("/projects/new")}>
        Создать проект
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={promptAndCreateFolder}>
        Создать папку
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={arrangeClassicDesktop}>
        Упорядочить
      </button>
    </>
  );
  const classicDragHint = (
    <div className="mb-3 rounded-[22px] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#eef8f1_100%)] px-4 py-3 text-sm leading-6 text-[#315f49] shadow-[0_16px_30px_-26px_rgba(24,85,58,0.18)]">
      Проекты можно переносить мышкой в папки. Чтобы вернуть проект обратно на рабочий стол, открой папку и перетащи проект на затемнённый фон за пределами окна.
    </div>
  );
  const folderManagementDialogs = (
    <>
      {folderActionTarget ? (
        <FolderActionDialog
          folder={folderActionTarget}
          onClose={() => setFolderActionTarget(null)}
          onRename={() => openRenameFolder(folderActionTarget)}
          onDelete={() => openDeleteFolder(folderActionTarget)}
          onChooseIcon={() => {
            setIconPickerFolder(folderActionTarget);
            setFolderActionTarget(null);
          }}
        />
      ) : null}

      {folderRenameTarget ? (
        <FolderRenameDialog
          folder={folderRenameTarget}
          value={folderRenameValue}
          busy={busyFolderId === folderRenameTarget.id}
          onChange={setFolderRenameValue}
          onClose={() => {
            setFolderRenameTarget(null);
            setFolderRenameValue("");
          }}
          onSave={saveRenameFolder}
        />
      ) : null}

      {folderDeleteTarget ? (
        <FolderDeleteDialog
          folder={folderDeleteTarget}
          busy={busyFolderId === folderDeleteTarget.id}
          onClose={() => setFolderDeleteTarget(null)}
          onDelete={confirmDeleteFolder}
        />
      ) : null}

      {iconPickerFolder ? (
        <FolderIconPicker
          folder={iconPickerFolder}
          busy={busyFolderId === iconPickerFolder.id}
          onClose={() => setIconPickerFolder(null)}
          onSelect={(iconKey) => updateFolderIcon(iconPickerFolder, iconKey)}
        />
      ) : null}
    </>
  );
  const assemblyAiWorkspace = (
    <Layout title="AI-аналитика папок">
      <OnboardingTour tourId="dashboard-specialist-v3" steps={DASHBOARD_ONBOARDING_STEPS} startTarget={dashboardTourStartTarget} autoStart={false} />
      {mobileDashboard}
      <div className="dashboard-experience dashboard-experience-classic relative isolate -mx-3 hidden overflow-hidden rounded-[36px] px-3 py-3 sm:-mx-4 sm:px-4 sm:py-4 lg:block">
        {error ? <div className="mb-4 card dashboard-panel text-sm text-red-600">{error}</div> : null}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_16px_30px_-26px_rgba(54,35,19,0.18)] backdrop-blur-xl">
          {desktopModeTabs}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {sceneEditControls}
          </div>
        </div>

        <div className="mb-4 rounded-[26px] border border-[#d8e4ef] bg-[linear-gradient(180deg,#ffffff_0%,#edf6ff_100%)] px-5 py-4 shadow-[0_20px_42px_-32px_rgba(37,63,89,0.2)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#647c95]">AI-аналитика</div>
              <h1 className="mt-1 text-2xl font-semibold text-[#17283a]">Чат и анализ папок</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5d7185]">
                Выберите папку с проектами, задайте вопрос или запустите полный анализ. Система берет в контекст людей, тесты, результаты и комментарии Registry внутри выбранной папки.
              </p>
            </div>
            <div className="rounded-[18px] border border-[#dbe7f1] bg-white px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-[#7a8fa4]">Баланс</div>
              <div className="mt-1 text-xl font-semibold text-[#17283a]">{balanceText}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
          <div className="rounded-[28px] border border-[#d5deea] bg-white p-4 shadow-[0_18px_42px_-34px_rgba(37,63,89,0.18)]">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#68809a]">Чаты</div>
              <button type="button" className="btn btn-primary btn-sm" onClick={startNewAssemblyAiChat} disabled={assemblyAiBusy}>
                Новый
              </button>
            </div>
            <input
              className="mt-3 w-full rounded-[16px] border border-[#d5deea] bg-[#fbfdff] px-3 py-2.5 text-sm text-[#223548] outline-none focus:border-[#8db37f] focus:ring-2 focus:ring-[#d8ecd1]"
              value={assemblyAiChatSearch}
              onChange={(event) => setAssemblyAiChatSearch(event.target.value)}
              placeholder="Найти чат"
            />
            <div className="mt-3 max-h-[650px] space-y-2 overflow-y-auto pr-1">
              {filteredAssemblyAiChats.length ? filteredAssemblyAiChats.map((chat) => (
                <div key={chat.id} className={`rounded-[18px] border px-3 py-3 transition ${chat.id === assemblyAiActiveChatId ? "border-[#7ca36f] bg-[#eef8ea]" : "border-[#e2ebf4] bg-[#f9fbfe]"}`}>
                  {assemblyAiEditingChatId === chat.id ? (
                    <div className="space-y-2">
                      <input
                        className="w-full rounded-[12px] border border-[#d5deea] px-2 py-1.5 text-sm"
                        value={assemblyAiEditingTitle}
                        onChange={(event) => setAssemblyAiEditingTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveAssemblyAiRename();
                          if (event.key === "Escape") {
                            setAssemblyAiEditingChatId("");
                            setAssemblyAiEditingTitle("");
                          }
                        }}
                        autoFocus
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveAssemblyAiRename}>Сохранить</button>
                    </div>
                  ) : (
                    <>
                      <button type="button" className="block w-full text-left" onClick={() => openAssemblyAiChat(chat)}>
                        <div className="truncate text-sm font-semibold text-[#223548]">{chat.title || "Новый чат"}</div>
                        <div className="mt-1 text-xs text-[#6f8193]">{chat.contextLabel} · {chat.model}</div>
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#7a8fa4]">{chat.lastUserMessage || "Пустой чат"}</div>
                      </button>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-xs text-[#5f7286] hover:bg-white"
                          onClick={() => {
                            setAssemblyAiEditingChatId(chat.id);
                            setAssemblyAiEditingTitle(chat.title || "Новый чат");
                          }}
                        >
                          Переименовать
                        </button>
                        <button type="button" className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-white" onClick={() => deleteAssemblyAiChat(chat.id)}>
                          Удалить
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )) : (
                <div className="rounded-[18px] border border-dashed border-[#cfdbe7] bg-[#fbfdff] px-3 py-5 text-sm leading-6 text-[#6f8193]">
                  Сохраненных чатов пока нет.
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-[30px] border border-[#d5deea] bg-[linear-gradient(180deg,#fbfdff_0%,#eef4fb_100%)] p-5 shadow-[0_24px_54px_-36px_rgba(53,34,17,0.16)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#68809a]">Чат аналитика</div>
                <div className="mt-1 text-2xl font-semibold text-[#223548]">{assemblyAiActiveChat?.title || assemblyAiContextLabel}</div>
                <div className="mt-1 text-sm text-[#64788c]">
                  {assemblyAiEffectiveMode === "message"
                    ? `${assemblyAiCanFollowUp ? "Продолжение уже оплаченного анализа" : "Обычное сообщение без выбранной папки или человека"}. Сейчас: ${assemblyAiPriceRub} ₽.`
                    : assemblyAiContextProjects.length
                    ? `${assemblyAiContextProjects.length} готовых проектов в контексте. Сейчас: ${getAssemblyAiModeLabel(assemblyAiEffectiveMode)} за ${assemblyAiPriceRub} ₽.`
                    : "Выберите контекст с полностью завершенными проектами."}
                </div>
              </div>
              <div className="rounded-[18px] border border-[#dbe7f1] bg-white px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.18em] text-[#7a8fa4]">Запрос</div>
                <div className="mt-1 text-xl font-semibold text-[#17283a]">{assemblyAiPriceRub} ₽</div>
              </div>
            </div>

            {assemblyAiError ? <div className="mt-4 rounded-[18px] border border-[#e6c8c3] bg-[#fff3f0] px-4 py-3 text-sm text-[#9a4e45]">{assemblyAiError}</div> : null}
            {assemblyAiLastCharge != null ? (
              <div className="mt-4 rounded-[18px] border border-[#d9e6d0] bg-[#f6fcf3] px-4 py-3 text-sm text-[#315f49]">
                Списано: {assemblyAiLastCharge} ₽. Баланс обновлен.
              </div>
            ) : null}

            <div className="mt-4 h-[520px] overflow-y-auto rounded-[24px] border border-[#dce6f1] bg-white/88 p-4">
              <div className="space-y-3">
                {assemblyAiMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[86%] rounded-[20px] border px-4 py-3 text-sm leading-6 shadow-[0_12px_28px_-24px_rgba(37,63,89,0.22)] ${message.role === "user" ? "ml-auto border-[#c9e3cc] bg-[#eff9ee] text-[#29472d]" : "mr-auto border-[#dde7f2] bg-[#fbfdff] text-[#26394d]"}`}
                  >
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a8fa4]">
                      {message.role === "user" ? "Вы" : "AI-аналитик"}
                    </div>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-[#dce6f1] bg-white p-4">
              <textarea
                className="min-h-[118px] w-full resize-y rounded-[18px] border border-[#d5deea] bg-[#fbfdff] px-4 py-3 text-sm leading-6 text-[#223548] outline-none transition focus:border-[#8db37f] focus:ring-2 focus:ring-[#d8ecd1]"
                value={assemblyAiDraft}
                onChange={(event) => setAssemblyAiDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !(event.nativeEvent as any).isComposing) {
                    event.preventDefault();
                    if (assemblyAiCanSend) void sendAssemblyAiMessage();
                  }
                }}
                placeholder={assemblyAiEffectiveMode === "folder_analysis" ? "Например: сравни людей под руководителя отдела продаж и выдели риски. Можно оставить пустым." : assemblyAiEffectiveMode === "project_message" ? "Например: какие вопросы задать этому человеку? Можно оставить пустым." : "Задайте обычный вопрос AI-аналитику"}
                disabled={assemblyAiBusy}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs leading-5 text-[#6f8193]">
                  Enter отправляет сообщение, Shift+Enter переносит строку. В контекст попадают только полностью завершенные проекты.
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void sendAssemblyAiMessage()}
                  disabled={!assemblyAiCanSend}
                >
                  {assemblyAiBusy ? "Отправляю..." : "Отправить"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-[#d5deea] bg-white p-4 shadow-[0_18px_42px_-34px_rgba(37,63,89,0.18)]">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#68809a]">Модель и цены</div>
              <div className="mt-3 grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b8ea0]">
                  Провайдер
                  <select
                    className="mt-2 w-full rounded-[16px] border border-[#d5deea] bg-[#fbfdff] px-3 py-2.5 text-sm text-[#223548] outline-none focus:border-[#8db37f] focus:ring-2 focus:ring-[#d8ecd1]"
                    value={assemblyAiProvider}
                    onChange={(event) => setAssemblyAiProvider(event.target.value as AssemblyAiProvider)}
                    disabled={assemblyAiBusy}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="deepseek">DeepSeek</option>
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b8ea0]">
                  Модель
                  <select
                    className="mt-2 w-full rounded-[16px] border border-[#d5deea] bg-[#fbfdff] px-3 py-2.5 text-sm text-[#223548] outline-none focus:border-[#8db37f] focus:ring-2 focus:ring-[#d8ecd1]"
                    value={assemblyAiModel}
                    onChange={(event) => setAssemblyAiModel(event.target.value)}
                    disabled={assemblyAiBusy}
                  >
                    {assemblyAiModelOptions.map((model) => (
                      <option key={model.id} value={model.id}>{model.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4 grid gap-2">
                <div className="rounded-[18px] border border-[#dbe4ee] bg-[#fbfdff] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#223548]">Анализ папки</span>
                    <span className="text-sm font-semibold text-[#315f49]">{assemblyAiFolderPriceRub} ₽</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#6f8193]">Списывается, когда выбран режим папки. Строит общую схему сравнения.</div>
                </div>
                <div className="rounded-[18px] border border-[#dbe4ee] bg-[#fbfdff] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#223548]">Анализ человека</span>
                    <span className="text-sm font-semibold text-[#315f49]">{assemblyAiPersonPriceRub} ₽</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#6f8193]">Списывается, когда выбран конкретный готовый человек. Строит персональную карту.</div>
                </div>
                <div className="rounded-[18px] border border-[#dbe4ee] bg-[#fbfdff] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#223548]">Обычное сообщение</span>
                    <span className="text-sm font-semibold text-[#315f49]">{assemblyAiMessagePriceRub} ₽</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#6f8193]">Списывается без выбора контекста или как продолжение уже оплаченного анализа.</div>
                </div>
                <div className="rounded-[18px] border border-[#c9e3cc] bg-[#eff9ee] px-3 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-[#7a8fa4]">Сейчас будет списано</div>
                  <div className="mt-1 text-xl font-semibold text-[#17283a]">{assemblyAiPriceRub} ₽</div>
                  <div className="mt-1 text-xs leading-5 text-[#6f8193]">{getAssemblyAiModeLabel(assemblyAiEffectiveMode)}</div>
                  {assemblyAiCanFollowUp ? (
                    <div className="mt-2 rounded-[12px] bg-white/80 px-2 py-1 text-xs leading-5 text-[#315f49]">
                      Данные не менялись, поэтому это продолжение уже оплаченного анализа.
                    </div>
                  ) : null}
                </div>
              </div>
              {!assemblyAiCanAfford ? (
                <div className="mt-3 rounded-[16px] border border-[#e8c6bf] bg-[#fff4f1] px-3 py-2 text-xs leading-5 text-[#955144]">
                  На балансе не хватает средств для выбранного режима.
                </div>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-[#d5deea] bg-[linear-gradient(180deg,#fbfdff_0%,#eef4fb_100%)] p-4 shadow-[0_24px_54px_-36px_rgba(53,34,17,0.16)]">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#68809a]">Данные для анализа</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className={`rounded-[16px] border px-3 py-2.5 text-sm font-semibold transition ${assemblyAiContextScope === "folder" ? "border-[#7ca36f] bg-[#eef8ea] text-[#25462c]" : "border-[#dbe4ee] bg-white text-[#52687d] hover:border-[#b9c9db]"}`}
                  onClick={() => {
                    setAssemblyAiContextScope("folder");
                    setAssemblyFolderId((current) =>
                      current && completedFoldersForAi.some((item) => item.folder.id === current)
                        ? current
                        : completedFoldersForAi[0]?.folder.id || null
                    );
                  }}
                  disabled={assemblyAiBusy}
                >
                  Папка
                </button>
                <button
                  type="button"
                  className={`rounded-[16px] border px-3 py-2.5 text-sm font-semibold transition ${assemblyAiContextScope === "loose" ? "border-[#7ca36f] bg-[#eef8ea] text-[#25462c]" : "border-[#dbe4ee] bg-white text-[#52687d] hover:border-[#b9c9db]"}`}
                  onClick={() => {
                    setAssemblyAiContextScope("loose");
                    setAssemblyAiFolderTarget("folder");
                    setAssemblyFolderId(null);
                  }}
                  disabled={assemblyAiBusy}
                >
                  Без папки
                </button>
                <button
                  type="button"
                  className={`rounded-[16px] border px-3 py-2.5 text-sm font-semibold transition ${assemblyAiContextScope === "none" ? "border-[#7ca36f] bg-[#eef8ea] text-[#25462c]" : "border-[#dbe4ee] bg-white text-[#52687d] hover:border-[#b9c9db]"}`}
                  onClick={() => {
                    setAssemblyAiContextScope("none");
                    setAssemblyAiFolderTarget("folder");
                    setAssemblyFolderId(null);
                    setAssemblyAiProjectId("");
                  }}
                  disabled={assemblyAiBusy}
                >
                  Без выбора
                </button>
              </div>

              {assemblyAiContextScope === "folder" ? (
                <div className="mt-3 space-y-2">
                  {completedFoldersForAi.length ? completedFoldersForAi.map(({ folder, projects }) => {
                    const isActive = folder.id === assemblyFolderId;
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        className={`w-full rounded-[20px] border px-4 py-3 text-left transition ${isActive ? "border-[#7ca36f] bg-[#eef8ea] shadow-[0_14px_28px_-24px_rgba(48,90,39,0.28)]" : "border-[#d5deea] bg-white hover:border-[#b9c9db]"}`}
                        onClick={() => setAssemblyFolderId(folder.id)}
                        disabled={assemblyAiBusy}
                      >
                        <div className="text-sm font-semibold text-[#223548]">{folder.name}</div>
                        <div className="mt-1 text-xs text-[#64788c]">Готовы к анализу: {projects.length}</div>
                      </button>
                    );
                  }) : (
                    <div className="rounded-[20px] border border-dashed border-[#cfdbe7] bg-white/75 px-4 py-5 text-sm leading-6 text-[#6f8193]">
                      В папках пока нет полностью завершенных проектов.
                    </div>
                  )}
                  {assemblyCompletedFolder?.projects.length ? (
                    <div className="mt-3 rounded-[20px] border border-[#d5deea] bg-white px-3 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8fa4]">Что анализируем</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className={`rounded-[14px] border px-3 py-2 text-sm font-semibold transition ${assemblyAiFolderTarget === "folder" ? "border-[#7ca36f] bg-[#eef8ea] text-[#25462c]" : "border-[#dbe4ee] bg-white text-[#52687d] hover:border-[#b9c9db]"}`}
                          onClick={() => setAssemblyAiFolderTarget("folder")}
                          disabled={assemblyAiBusy}
                        >
                          Вся папка
                        </button>
                        <button
                          type="button"
                          className={`rounded-[14px] border px-3 py-2 text-sm font-semibold transition ${assemblyAiFolderTarget === "person" ? "border-[#7ca36f] bg-[#eef8ea] text-[#25462c]" : "border-[#dbe4ee] bg-white text-[#52687d] hover:border-[#b9c9db]"}`}
                          onClick={() => setAssemblyAiFolderTarget("person")}
                          disabled={assemblyAiBusy}
                        >
                          Человек
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : assemblyAiContextScope === "loose" ? (
                <div className="mt-3 rounded-[20px] border border-[#d5deea] bg-white px-4 py-3">
                  <div className="text-sm font-semibold text-[#223548]">Готовые проекты без папки</div>
                  <div className="mt-1 text-xs text-[#64788c]">В контексте: {completedLooseProjects.length}</div>
                </div>
              ) : (
                <div className="mt-3 rounded-[20px] border border-[#d5deea] bg-white px-4 py-3">
                  <div className="text-sm font-semibold text-[#223548]">Обычное сообщение</div>
                  <div className="mt-1 text-xs leading-5 text-[#64788c]">AI ответит без данных конкретной папки или кандидата. Результаты людей в такой запрос не попадут.</div>
                </div>
              )}
            </div>

            {assemblyAiContextScope === "loose" || (assemblyAiContextScope === "folder" && assemblyAiFolderTarget === "person") ? (
            <div className="rounded-[28px] border border-[#d5deea] bg-white p-4 shadow-[0_18px_42px_-34px_rgba(37,63,89,0.18)]">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#68809a]">Проект-человек</div>
              {assemblyAiContextProjects.length ? (
                <>
                  <select
                    className="mt-3 w-full rounded-[16px] border border-[#d5deea] bg-[#fbfdff] px-3 py-2.5 text-sm text-[#223548] outline-none focus:border-[#8db37f] focus:ring-2 focus:ring-[#d8ecd1]"
                    value={assemblyAiSelectedProject?.id || ""}
                    onChange={(event) => setAssemblyAiProjectId(event.target.value)}
                    disabled={assemblyAiBusy}
                  >
                    {assemblyAiContextProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.person?.full_name || project.title}
                      </option>
                    ))}
                  </select>
                  <div className="mt-3 space-y-2">
                    {assemblyAiContextProjects.slice(0, 8).map((project) => (
                      <div key={project.id} className="rounded-[16px] border border-[#e4ebf3] bg-[#f9fbfe] px-3 py-2.5">
                        <div className="text-sm font-semibold text-[#223548]">{project.person?.full_name || project.title}</div>
                        <div className="mt-1 text-xs text-[#6b7f93]">
                          {getGoalDefinition(project.goal)?.shortTitle || getGoalDefinition(project.goal)?.title || project.goal}
                          {project.target_role ? ` · ${project.target_role}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 rounded-[20px] border border-dashed border-[#cfdbe7] bg-[#fbfdff] px-4 py-5 text-sm leading-6 text-[#6f8193]">
                  Здесь появятся только люди, которые полностью завершили все назначенные тесты.
                </div>
              )}
            </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <AssemblyAiInsightPanel insight={assemblyAiInsight} />
        </div>
      </div>
      {folderManagementDialogs}
      {trashRestoreModal}
    </Layout>
  );

  if (desktopVariant === "assembly") {
    return assemblyAiWorkspace;
  }

  if (selectedWidgetId === "__legacy_assembly__") {
    return (
      <Layout title="Кабинет специалиста">
        <OnboardingTour tourId="dashboard-specialist-v3" steps={DASHBOARD_ONBOARDING_STEPS} startTarget={dashboardTourStartTarget} autoStart={false} />
        {mobileDashboard}
        <div className="dashboard-experience dashboard-experience-classic relative isolate -mx-3 hidden overflow-hidden rounded-[36px] px-3 py-3 sm:-mx-4 sm:px-4 sm:py-4 lg:block">
          {error ? <div className="mb-4 card dashboard-panel text-sm text-red-600">{error}</div> : null}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_16px_30px_-26px_rgba(54,35,19,0.18)] backdrop-blur-xl">
            {desktopModeTabs}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {sceneEditControls}
            </div>
          </div>

          <div className="mb-4 rounded-[22px] border border-[#d9c8aa] bg-[linear-gradient(180deg,#fff8ef_0%,#f4ead9_100%)] px-4 py-3 text-sm text-[#60442c] shadow-[0_16px_30px_-26px_rgba(54,35,19,0.18)]">
            Отдельный режим общей оценки папки. Здесь собирается анализ сразу по всем проектам внутри выбранной папки с поиском лидеров по кандидатам, доменам и компетенциям.
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-[24px] border border-[#d8e4ef] bg-[linear-gradient(180deg,#ffffff_0%,#eef5fb_100%)] px-5 py-4 shadow-[0_18px_34px_-26px_rgba(37,63,89,0.18)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6f879d]">Кандидатов в папке</div>
              <div className="mt-2 text-[30px] font-semibold leading-none text-[#223548]">{assemblyFolder?.projects.length || 0}</div>
              <div className="mt-2 text-sm text-[#62788d]">Для уверенного сравнения лучше держать в одной папке 3–7 проектов.</div>
            </div>
            <div className="rounded-[24px] border border-[#dbe6d6] bg-[linear-gradient(180deg,#ffffff_0%,#f0f8ee_100%)] px-5 py-4 shadow-[0_18px_34px_-26px_rgba(48,90,39,0.18)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#688160]">Средний итоговый индекс</div>
              <div className="mt-2 text-[30px] font-semibold leading-none text-[#27402b]">{assemblyAverageIndex ?? "—"}</div>
              <div className="mt-2 text-sm text-[#60755f]">Сводный ориентир по силе текущего набора кандидатов в выбранной папке.</div>
            </div>
            <div className="rounded-[24px] border border-[#ead8c2] bg-[linear-gradient(180deg,#fffdfa_0%,#f8ede0_100%)] px-5 py-4 shadow-[0_18px_34px_-26px_rgba(108,72,29,0.18)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8a6a41]">Лидер в целом</div>
              <div className="mt-2 text-[22px] font-semibold leading-tight text-[#5b4126]">{assemblyLeader?.name || "—"}</div>
              <div className="mt-2 text-sm text-[#7b6143]">{assemblyLeader ? `${assemblyLeader.calibrated_index}/100 и ${assemblyLeader.total_wins} лидерских позиций по всей папке` : "Появится после сборки анализа."}</div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-[28px] border border-[#d5deea] bg-[linear-gradient(180deg,#fbfdff_0%,#eef4fb_100%)] p-4 shadow-[0_24px_54px_-36px_rgba(53,34,17,0.16)]">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#68809a]">Папки для общей оценки</div>
              <div className="mt-3 space-y-2">
                {folderBuckets.byFolder.length ? folderBuckets.byFolder.map(({ folder, projects }) => {
                  const isActive = folder.id === assemblyFolderId;
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      className={`w-full rounded-[20px] border px-4 py-3 text-left transition ${isActive ? "border-[#7ca36f] bg-[#eef8ea] shadow-[0_14px_28px_-24px_rgba(48,90,39,0.28)]" : "border-[#d5deea] bg-white hover:border-[#b9c9db]"}`}
                      onClick={() => setAssemblyFolderId(folder.id)}
                    >
                      <div className="text-sm font-semibold text-[#223548]">{folder.name}</div>
                      <div className="mt-1 text-xs text-[#64788c]">{projects.length} {projects.length === 1 ? "проект" : projects.length < 5 ? "проекта" : "проектов"}</div>
                    </button>
                  );
                }) : (
                  <div className="rounded-[20px] border border-dashed border-[#cfdbe7] bg-white/75 px-4 py-5 text-sm text-[#6f8193]">
                    Сначала создайте папку и положите в неё проекты.
                  </div>
                )}
              </div>

              {assemblyFolder?.projects.length ? (
                <div className="mt-4 rounded-[22px] border border-[#dbe4ee] bg-white/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6f879d]">Состав папки</div>
                  <div className="mt-3 space-y-2">
                    {assemblyFolder.projects.map((project) => (
                      <div key={project.id} className="rounded-[16px] border border-[#e4ebf3] bg-[#f9fbfe] px-3 py-2.5">
                        <div className="text-sm font-semibold text-[#223548]">{project.person?.full_name || project.title}</div>
                        <div className="mt-1 text-xs text-[#6b7f93]">
                          {getGoalDefinition(project.goal)?.shortTitle || getGoalDefinition(project.goal)?.title || project.goal}
                          {project.target_role ? ` · ${project.target_role}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-[22px] border border-[#dbe4ee] bg-white/80 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6f879d]">Фокус сравнения</div>
                <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7b8ea0]">
                  Должность или запрос
                  <input
                    value={assemblyFitRequest}
                    onChange={(event) => setAssemblyFitRequest(event.target.value)}
                    placeholder="Например: руководитель продаж, методолог, аккаунт-менеджер"
                    className="mt-2 w-full rounded-[16px] border border-[#d5deea] bg-[#fbfdff] px-3 py-2.5 text-sm text-[#223548] outline-none transition focus:border-[#8db37f] focus:ring-2 focus:ring-[#d8ecd1]"
                  />
                </label>
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#7b8ea0]">Компетенции для сравнения</div>
                <div className="mt-3 grid gap-2">
                  {assemblySuggestedCompetencies.map((route) => {
                    const active = assemblySelectedCompetencyIds.includes(route.id);
                    return (
                      <button
                        key={route.id}
                        type="button"
                        className={`rounded-[16px] border px-3 py-2.5 text-left transition ${active ? "border-[#7ca36f] bg-[#eef8ea]" : "border-[#dbe4ee] bg-[#fbfdff] hover:border-[#b9c9db]"}`}
                        onClick={() => setAssemblySelectedCompetencyIds((prev) => prev.includes(route.id) ? prev.filter((item) => item !== route.id) : [...prev, route.id])}
                      >
                        <div className="text-sm font-semibold text-[#223548]">{route.name}</div>
                        <div className="mt-1 text-xs text-[#6b7f93]">{route.cluster}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs leading-5 text-[#6b7f93]">
                  {assemblySelectedCompetencyIds.length
                    ? `Сейчас сравнение собрано по фокусу: ${getCompetencyLongLabel(assemblySelectedCompetencyIds)}.`
                    : "Если компетенции не выбраны, система сравнивает кандидатов по общей силе профиля."}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#d5deea] bg-[linear-gradient(180deg,#fbfdff_0%,#eef4fb_100%)] p-5 shadow-[0_24px_54px_-36px_rgba(53,34,17,0.16)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#68809a]">Общая оценка папки</div>
                  <div className="mt-1 text-2xl font-semibold text-[#223548]">{assemblyFolder?.folder.name || "Выберите папку"}</div>
                  <div className="mt-1 text-sm text-[#64788c]">
                    {assemblyFolder
                      ? assemblyFolder.projects.length > ASSEMBLY_PROJECT_LIMIT
                        ? `В анализ попадут первые ${ASSEMBLY_PROJECT_LIMIT} из ${assemblyFolder.projects.length} проектов. Для точного сравнения лучше делить большие папки на короткие списки.`
                        : `В анализ попадут все проекты этой папки: ${assemblyFolder.projects.length} шт.`
                      : "Пока папка не выбрана."}
                  </div>
                  {assemblyComparison?.selected_competency_label ? (
                    <div className="mt-2 text-sm font-medium text-[#49627a]">Фокус по компетенциям: {assemblyComparison.selected_competency_label}</div>
                  ) : null}
                </div>
                {assemblyFolder ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadAssemblyComparison(assemblyFolder.folder.id)} disabled={assemblyLoading}>
                    {assemblyLoading ? "Собираем…" : "Обновить анализ"}
                  </button>
                ) : null}
              </div>

              {assemblyError ? <div className="mt-4 rounded-[18px] border border-[#e6c8c3] bg-[#fff3f0] px-4 py-3 text-sm text-[#9a4e45]">{assemblyError}</div> : null}

              {!assemblyError && !assemblyComparison && !assemblyLoading ? (
                <div className="mt-4 rounded-[20px] border border-dashed border-[#cfdbe7] bg-white/75 px-4 py-5 text-sm text-[#6f8193]">
                  Выберите папку с несколькими проектами, и система соберёт общий анализ кандидатов.
                </div>
              ) : null}

              {assemblyComparison ? (
                <div className="mt-4 space-y-4">
                  {assemblyComparison.best_candidate_ai ? (
                    <div className="rounded-[22px] border border-[#e4d2b8] bg-[linear-gradient(180deg,#fffdfa_0%,#f6eee1_100%)] p-4">
                      <div className="text-sm font-semibold text-[#6b4b24]">Лидер под должность</div>
                      <div className="mt-2 text-[24px] font-semibold leading-tight text-[#3f2b18]">{assemblyComparison.best_candidate_ai.winner_name}</div>
                      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[#8b6e4e]">Кого система считает самым подходящим под ваш запрос и выбранные компетенции</div>
                      <div className="mt-3 text-sm leading-6 text-[#5e4630]">{assemblyComparison.best_candidate_ai.summary}</div>
                      {assemblyComparison.best_candidate_ai.rationale ? (
                        <div className="mt-3 text-sm leading-6 text-[#6a533b]">{assemblyComparison.best_candidate_ai.rationale}</div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="rounded-[22px] border border-[#d9e6d0] bg-[#f7fcf4] p-4">
                    <div className="text-sm font-semibold text-[#28462c]">Итог по папке</div>
                    <div className="mt-2 text-sm leading-6 text-[#37523a]">{assemblyComparison.summary}</div>
                    {assemblyComparison.competency_summary ? (
                      <div className="mt-3 text-sm leading-6 text-[#4d644f]">{assemblyComparison.competency_summary}</div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[22px] border border-[#d5deea] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[#223548]">Рейтинг кандидатов</div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[#7a8fa4]">Итоговый индекс</div>
                      </div>
                      <div className="mt-3 space-y-3">
                        {assemblyComparison.ranking.map((item, index) => (
                          <div key={`${item.project_id || item.name}:rank`} className="rounded-[18px] border border-[#e2ebf4] bg-[#f9fbfe] px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs uppercase tracking-[0.18em] text-[#7d8ea0]">#{index + 1}</div>
                                <div className="text-lg font-semibold leading-tight text-[#152838]">{item.name}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-[#223548]">{item.focus_score ?? item.calibrated_index}/100</div>
                                <div className="text-xs text-[#6c7d8f]">Базовый индекс {item.baseline_index}/100 · Итоговый {item.calibrated_index}/100</div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-[#5f7286]">{item.comparison_line}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-[#d9e4d5] bg-[linear-gradient(180deg,#ffffff_0%,#f3faf1_100%)] p-4">
                      <div className="text-sm font-semibold text-[#223548]">Лидер по компетенциям</div>
                      <div className="mt-1 text-xs text-[#70856f]">Кто сильнее всего выглядит по самой выраженной компетенции в этой папке</div>
                      <div className="mt-3 rounded-[18px] border border-[#dce8d7] bg-white px-4 py-3">
                        <div className="text-sm font-semibold text-[#2b472f]">{assemblyTopCompetency?.competency_name || "—"}</div>
                        <div className="mt-1 text-xs text-[#70856f]">{assemblyTopCompetency?.competency_cluster || "Лидирующая компетенция папки"}</div>
                        <div className="mt-3 flex items-end justify-between gap-3">
                          <div className="text-sm text-[#355438]">{assemblyTopCompetency?.leader_name || "—"}</div>
                          <div className="text-right">
                            <div className="text-[28px] font-semibold leading-none text-[#28462c]">{assemblyTopCompetency?.leader_score ?? "—"}</div>
                            <div className="mt-1 text-xs text-[#70856f]">Отрыв {assemblyTopCompetency?.gap ?? "—"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {assemblyComparison.competency_leaders.slice(1, 5).map((item) => (
                          <div key={`${item.competency_id}:focus`} className="flex items-center justify-between gap-3 rounded-[16px] border border-[#e1eadf] bg-white px-3 py-2.5">
                            <div>
                              <div className="text-sm font-medium text-[#223548]">{item.competency_name}</div>
                              <div className="text-xs text-[#6f8193]">{item.leader_name || "—"}</div>
                            </div>
                            <div className="text-right text-sm font-semibold text-[#28462c]">{item.leader_score ?? "—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-[22px] border border-[#d5deea] bg-white p-4">
                      <div className="text-sm font-semibold text-[#223548]">Лидеры в целом</div>
                      <div className="mt-1 text-xs text-[#6c7d8f]">Кто чаще всего выходит первым по совокупности силы профиля, доменов и компетенций</div>
                      <div className="mt-3 space-y-3">
                        {assemblyComparison.winner_board.slice(0, 5).map((item, index) => (
                          <div key={`${item.project_id || item.name}:winner`} className="rounded-[18px] border border-[#e2ebf4] bg-[#f9fbfe] px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs uppercase tracking-[0.18em] text-[#7d8ea0]">#{index + 1}</div>
                                <div className="text-lg font-semibold leading-tight text-[#152838]">{item.name}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-[#223548]">{item.calibrated_index}/100</div>
                                <div className="text-xs text-[#6c7d8f]">{item.total_wins} лидерств</div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-[#5f7286]">Домены: {item.domain_wins} · Компетенции: {item.competency_wins}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-[#d5deea] bg-white p-4">
                      <div className="text-sm font-semibold text-[#223548]">Самый сильный в конкретной зоне</div>
                      <div className="mt-1 text-xs text-[#6c7d8f]">Отдельно показывает, кто лучший в каждом крупном блоке: мышление, коммуникация, управление и других</div>
                      <div className="mt-3 space-y-3">
                        {assemblyComparison.domain_leaders.map((item) => (
                          <div key={item.domain} className="rounded-[18px] border border-[#e2ebf4] bg-[#f9fbfe] px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-[#223548]">{item.label}</div>
                                <div className="mt-1 text-base font-semibold leading-tight text-[#152838]">{item.leader_name || "—"}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-[#223548]">{item.leader_score ?? "—"}</div>
                                <div className="text-xs text-[#6c7d8f]">Отрыв {item.gap ?? "—"}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {assemblyComparison.candidate_briefs?.length ? (
                    <div className="rounded-[22px] border border-[#d5deea] bg-white p-4">
                      <div className="text-sm font-semibold text-[#223548]">Короткие различия по кандидатам</div>
                      <div className="mt-3 grid gap-3 xl:grid-cols-2">
                        {assemblyComparison.candidate_briefs.map((item) => (
                          <div key={`${item.project_id || item.name}:brief`} className="rounded-[18px] border border-[#e2ebf4] bg-[#f9fbfe] px-4 py-3">
                            <div className="text-lg font-semibold leading-tight text-[#152838]">{item.name}</div>
                            <div className="mt-2 text-sm leading-6 text-[#5f7286]">{item.summary}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[22px] border border-[#d5deea] bg-white p-4">
                    <div className="text-sm font-semibold text-[#223548]">Кто сильнее в какой компетенции</div>
                    <div className="mt-1 text-xs text-[#6c7d8f]">Удобно смотреть, кто лучше именно в конкретных навыках и рабочих паттернах</div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {assemblyComparison.competency_leaders.slice(0, 12).map((item) => (
                        <div key={item.competency_id} className="rounded-[18px] border border-[#e2ebf4] bg-[#f9fbfe] px-4 py-3">
                          <div className="text-sm font-semibold text-[#223548]">{item.competency_name}</div>
                          <div className="mt-1 text-xs text-[#7a8b9d]">{item.competency_cluster}</div>
                          <div className="mt-3 flex items-end justify-between gap-3">
                            <div className="text-base font-semibold leading-tight text-[#152838]">{item.leader_name || "—"}</div>
                            <div className="text-right">
                              <div className="text-lg font-semibold text-[#223548]">{item.leader_score ?? "—"}</div>
                              <div className="text-xs text-[#6c7d8f]">Отрыв {item.gap ?? "—"}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {folderManagementDialogs}
        {trashRestoreModal}
      </Layout>
    );
  }

  if (desktopVariant === "classic") {
    return (
      <Layout title="Кабинет специалиста">
        <OnboardingTour tourId="dashboard-specialist-v3" steps={DASHBOARD_ONBOARDING_STEPS} startTarget={dashboardTourStartTarget} autoStart={false} />
        {mobileDashboard}
        <div className="dashboard-experience dashboard-experience-classic relative isolate -mx-3 hidden overflow-hidden rounded-[36px] px-3 py-3 sm:-mx-4 sm:px-4 sm:py-4 lg:block">
          {error ? <div className="mb-4 card dashboard-panel text-sm text-red-600">{error}</div> : null}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_16px_30px_-26px_rgba(54,35,19,0.18)] backdrop-blur-xl">
            {desktopModeTabs}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {classicQuickActions}
              {sceneEditControls}
            </div>
          </div>

          {classicDragHint}

          {canEditScene && sceneEditMode && selectedDeskItem ? (
            <div className="mb-3 rounded-[22px] border border-[#cdb799] bg-white/92 p-4 shadow-[0_18px_34px_-26px_rgba(54,35,19,0.2)]">
              <div className="mb-3 text-sm font-semibold text-[#55361f]">Объект · {selectedDeskItem.title}</div>
              <div className="grid gap-3 md:grid-cols-7">
                <label className="text-xs text-[#7b5b3b]">X
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.x || 0)} onChange={(e) => updateDeskItem(selectedDeskItem.id, { x: Number(e.target.value || 0) })} />
                </label>
                <label className="text-xs text-[#7b5b3b]">Y
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.y || 0)} onChange={(e) => updateDeskItem(selectedDeskItem.id, { y: Number(e.target.value || 0) })} />
                </label>
                <label className="text-xs text-[#7b5b3b]">Ширина
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.width || (selectedDeskItem.kind === "folder" ? 96 : 92))} onChange={(e) => updateDeskItem(selectedDeskItem.id, { width: Number(e.target.value || 0) })} />
                </label>
                <label className="text-xs text-[#7b5b3b]">Высота
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.height || (selectedDeskItem.kind === "folder" ? 96 : 104))} onChange={(e) => updateDeskItem(selectedDeskItem.id, { height: Number(e.target.value || 0) })} />
                </label>
                <label className="text-xs text-[#7b5b3b]">Поворот Z
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={Number((selectedDeskItem.position.rotation || 0).toFixed(1))} onChange={(e) => updateDeskItem(selectedDeskItem.id, { rotation: Number(e.target.value || 0) })} />
                </label>
                <label className="text-xs text-[#7b5b3b]">Поворот X
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={Number((selectedDeskItem.position.tiltX || 0).toFixed(1))} onChange={(e) => updateDeskItem(selectedDeskItem.id, { tiltX: Number(e.target.value || 0) })} />
                </label>
                <label className="text-xs text-[#7b5b3b]">Поворот Y
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={Number((selectedDeskItem.position.tiltY || 0).toFixed(1))} onChange={(e) => updateDeskItem(selectedDeskItem.id, { tiltY: Number(e.target.value || 0) })} />
                </label>
              </div>
            </div>
          ) : null}

          <div className="dashboard-classic-scene relative min-h-[920px] overflow-hidden rounded-[34px] border border-[#d4d9e4] bg-white shadow-[0_30px_70px_-44px_rgba(53,34,17,0.14)]" onClick={() => { setSelectedWidgetId(null); setSelectedDeskItemId(null); }} onDragOver={(e) => e.preventDefault()} onDrop={handleDeskDrop}>
            {showDesktopLoader ? <DesktopLoadingOverlay /> : null}
            <div className="dashboard-classic-surface absolute inset-0" />
            {classicViewMode === "sheet" ? (
              <div className="absolute inset-0 z-[2] p-5">
                <div className="h-full overflow-auto rounded-[28px] border border-[#d5deea] bg-[linear-gradient(180deg,#fbfdff_0%,#eef4fb_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                  <div className="grid gap-3 border-b border-[#d5deea] bg-white/88 px-4 py-3 lg:grid-cols-[minmax(240px,1fr)_auto_auto_auto] lg:items-center">
                    <input
                      className="input h-10 bg-white"
                      value={classicSheetQuery}
                      onChange={(event) => setClassicSheetQuery(event.target.value)}
                      placeholder="Найти проект или папку"
                    />
                    <div className="flex flex-wrap gap-2">
                      {([
                        ["all", "Все"],
                        ["project", "Проекты"],
                        ["folder", "Папки"],
                      ] as const).map(([value, label]) => (
                        <button key={value} type="button" className={`btn btn-sm ${classicSheetKindFilter === value ? "btn-primary" : "btn-secondary"}`} onClick={() => setClassicSheetKindFilter(value)}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {([
                        ["all", "Везде"],
                        ["desktop", "На столе"],
                        ["folder", "В папках"],
                      ] as const).map(([value, label]) => (
                        <button key={value} type="button" className={`btn btn-sm ${classicSheetPlaceFilter === value ? "btn-primary" : "btn-secondary"}`} onClick={() => setClassicSheetPlaceFilter(value)}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="text-right text-xs font-semibold uppercase tracking-[0.18em] text-[#6f879d]">
                      {visibleClassicSheetRows.length} из {classicSheetRows.length}
                    </div>
                  </div>
                  <div className="sticky top-0 z-[3] grid min-w-[1180px] grid-cols-[128px_minmax(280px,2fr)_minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(210px,1.1fr)_190px] border-b border-[#d5deea] bg-[linear-gradient(180deg,#eff4fa_0%,#dde7f3_100%)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5f7992]">
                    <div className="px-4 py-3">Тип</div>
                    <div className="px-4 py-3">Название</div>
                    <div className="px-4 py-3">Цель / состав</div>
                    <div className="px-4 py-3">Статус</div>
                    <div className="px-4 py-3">Расположение</div>
                    <div className="px-4 py-3 text-right">Действие</div>
                  </div>
                  <div className="divide-y divide-[#dde6f0]">
                    {visibleClassicSheetRows.map((row, index) => {
                      const isFolderRow = row.kind === "folder";
                      const currentFolder = isFolderRow ? folders.find((item) => item.id === row.id) : null;
                      const currentProject = !isFolderRow ? projects.find((item) => item.id === row.id) : null;
                      const createdText = new Date(row.createdAt).toLocaleDateString("ru-RU");
                      return (
                        <div key={row.rowId} className={`grid min-w-[1180px] grid-cols-[128px_minmax(280px,2fr)_minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(210px,1.1fr)_190px] text-[13px] text-[#24384b] transition hover:bg-[#edf7f1] ${index % 2 === 0 ? "bg-white/88" : "bg-[#f5f9fd]/92"}`}>
                          <div className="px-4 py-4">
                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${isFolderRow ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
                              <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                              {isFolderRow ? "Папка" : "Проект"}
                            </span>
                          </div>
                          <div className="px-4 py-4">
                            <div className="font-semibold leading-[1.25] text-[#1f3142]">{row.name}</div>
                            <div className="mt-1 text-xs text-[#7a8b9d]">Создано {createdText}</div>
                          </div>
                          <div className="px-4 py-4 leading-5 text-[#516679]">{row.goal}</div>
                          <div className="px-4 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${row.status === "Оценка собрана" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : row.status.includes("работе") ? "border-sky-200 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-700"}`}>
                              {row.status}
                            </span>
                          </div>
                          <div className="px-4 py-4 leading-5 text-[#516679]">{row.place}</div>
                          <div className="flex items-center justify-end gap-2 px-4 py-4">
                            {isFolderRow ? (
                              <>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveFolderId(row.id)}>Открыть</button>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { if (currentFolder) setFolderActionTarget(currentFolder); }} disabled={!currentFolder}>Управление</button>
                              </>
                            ) : (
                              <>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { if (currentProject) setPreviewProject(currentProject); }} disabled={!currentProject}>Открыть</button>
                                <button type="button" className="btn btn-secondary btn-sm text-red-600 hover:text-red-700" onClick={() => void deleteProject(row.id)}>Удалить</button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {!visibleClassicSheetRows.length ? (
                      <div className="px-4 py-10 text-center text-sm text-[#6f8193]">
                        По этим условиям ничего не найдено.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <>
            {folderBuckets.byFolder.map(({ folder, projects: folderProjects }, folderIndex) => {
              const itemId = `folder:${folder.id}`;
              const position = deskPositions[itemId] || getClassicFolderPosition(folderIndex);
              const width = position.width || 104;
              const height = position.height || 108;
              const isSelected = selectedDeskItemId === itemId;
              return (
                <div key={folder.id} className="absolute" style={{ left: position.x, top: position.y, zIndex: position.z, width: `${width}px`, height: `${height}px` }}>
                  <FolderDesktopIcon
                    variant="classic"
                    folder={folder}
                    projects={folderProjects}
                    busy={busyFolderId === folder.id}
                    onOpen={() => setActiveFolderId(folder.id)}
                    onManage={() => setFolderActionTarget(folder)}
                    onDropProject={(projectId) => moveProject(projectId, folder.id)}
                    draggingProjectId={draggingProjectId}
                    sceneEditMode={sceneEditMode}
                    selected={isSelected}
                    onSelect={() => { setSelectedDeskItemId(itemId); setSelectedWidgetId(null); }}
                    onResizeHandleMouseDown={(e) => startDeskItemInteraction(e, itemId, "folder", "resize", position)}
                    onRotateHandleMouseDown={(e) => startDeskItemInteraction(e, itemId, "folder", "rotate", position)}
                    onDragMoveStart={(e) => startDeskItemInteraction(e, itemId, "folder", "drag", position)}
                    onDragStart={() => { setDraggingFolderId(folder.id); bringDeskItemToFront(itemId); }}
                    onDragEnd={() => setDraggingFolderId(null)}
                  />
                </div>
              );
            })}

            {folderBuckets.uncategorized.map((project, projectIndex) => {
              const itemId = `project:${project.id}`;
              const position = deskPositions[itemId] || getClassicProjectPosition(projectIndex);
              const width = position.width || 96;
              const height = position.height || 112;
              const isSelected = selectedDeskItemId === itemId;
              return (
                <div key={project.id} className="absolute" style={{ left: position.x, top: position.y, zIndex: position.z, width: `${width}px`, height: `${height}px` }}>
                  <ProjectDesktopIcon
                    variant="classic"
                    project={project}
                    busy={busyFolderId === `delete:${project.id}`}
                    sceneEditMode={sceneEditMode}
                    selected={isSelected}
                    onSelect={() => { setSelectedDeskItemId(itemId); setSelectedWidgetId(null); }}
                    onResizeHandleMouseDown={(e) => startDeskItemInteraction(e, itemId, "project", "resize", position)}
                    onRotateHandleMouseDown={(e) => startDeskItemInteraction(e, itemId, "project", "rotate", position)}
                    onDragMoveStart={(e) => startDeskItemInteraction(e, itemId, "project", "drag", position)}
                    onOpen={() => setPreviewProject(project)}
                    onDragStart={() => { setDraggingProjectId(project.id); bringDeskItemToFront(itemId); }}
                    onDragEnd={() => { setDraggingProjectId(null); clearTrashHover(); }}
                    onDelete={() => deleteProject(project.id)}
                  />
                </div>
              );
            })}
              </>
            )}
          </div>

          {activeFolder ? (
            <FolderModal
              folder={activeFolder.folder}
              projects={activeFolder.projects}
              busy={busyFolderId === activeFolder.folder.id}
              onClose={() => setActiveFolderId(null)}
              onManage={() => setFolderActionTarget(activeFolder.folder)}
              onOpenProject={(projectId) => {
                const project = activeFolder.projects.find((item) => item.id === projectId);
                if (project) setPreviewProject(project);
              }}
              onMoveToDesktop={(projectId) => moveProject(projectId, null)}
              onDeleteProject={deleteProject}
            />
          ) : null}

          {previewProject ? (
            <ProjectSheetPreviewModal
              project={previewProject}
              onClose={() => setPreviewProject(null)}
              onOpenFull={() => router.push(`/projects/${previewProject.id}`)}
            />
          ) : null}

          {previewSceneImage ? (
            <SceneImagePreviewModal
              src={previewSceneImage.src}
              title={previewSceneImage.title}
              onClose={() => setPreviewSceneImage(null)}
            />
          ) : null}
        </div>
        {folderManagementDialogs}
        {trashRestoreModal}
      </Layout>
    );
  }

  return (
    <Layout title="Кабинет специалиста">
        <OnboardingTour tourId="dashboard-specialist-v3" steps={DASHBOARD_ONBOARDING_STEPS} startTarget={dashboardTourStartTarget} autoStart={false} />
        {mobileDashboard}
        <div className="dashboard-experience relative isolate -mx-3 hidden overflow-hidden rounded-[36px] px-3 py-3 sm:-mx-4 sm:px-4 sm:py-4 lg:block">
          {error ? <div className="mb-4 card dashboard-panel text-sm text-red-600">{error}</div> : null}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_16px_30px_-26px_rgba(54,35,19,0.18)] backdrop-blur-xl">
            {desktopModeTabs}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {sceneEditControls}
            </div>
        </div>

        {canEditScene && sceneEditMode && selectedWidget ? (
          <div className="mb-3 rounded-[22px] border border-[#cdb799] bg-white/92 p-4 shadow-[0_18px_34px_-26px_rgba(54,35,19,0.2)]">
            <div className="mb-3 text-sm font-semibold text-[#55361f]">Конструктор сцены · {selectedWidget.id}</div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-xs text-[#7b5b3b]">X
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedWidget.x)} onChange={(e) => updateSceneWidget(selectedWidget.id, { x: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b]">Y
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedWidget.y)} onChange={(e) => updateSceneWidget(selectedWidget.id, { y: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b]">Ширина
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedWidget.width)} onChange={(e) => updateSceneWidget(selectedWidget.id, { width: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b]">Высота
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedWidget.height)} onChange={(e) => updateSceneWidget(selectedWidget.id, { height: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b] md:col-span-1">Поворот
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={selectedWidget.rotation} onChange={(e) => updateSceneWidget(selectedWidget.id, { rotation: Number(e.target.value || 0) })} />
              </label>
              {selectedWidget.kind !== "image" && selectedWidget.kind !== "video" ? (
                <>
                  <label className="text-xs text-[#7b5b3b] md:col-span-1">Шрифт
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={selectedWidget.fontSize} onChange={(e) => updateSceneWidget(selectedWidget.id, { fontSize: Number(e.target.value || 0) })} />
                  </label>
                  <label className="text-xs text-[#7b5b3b] md:col-span-2">Текст
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="text" value={selectedWidget.text} onChange={(e) => updateSceneWidget(selectedWidget.id, { text: e.target.value })} />
                  </label>
                </>
              ) : (
                <label className="text-xs text-[#7b5b3b] md:col-span-3">Изображение
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] bg-[#f8f3ea] px-3 py-2 text-sm text-[#7b5b3b]" type="text" value={selectedWidget.src || ""} readOnly />
                </label>
              )}
            </div>
          </div>
        ) : null}

        {canEditScene && sceneEditMode && selectedDeskItem ? (
          <div className="mb-3 rounded-[22px] border border-[#cdb799] bg-white/92 p-4 shadow-[0_18px_34px_-26px_rgba(54,35,19,0.2)]">
            <div className="mb-3 text-sm font-semibold text-[#55361f]">Объект на столе · {selectedDeskItem.title}</div>
            <div className="grid gap-3 md:grid-cols-7">
              <label className="text-xs text-[#7b5b3b]">X
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.x || 0)} onChange={(e) => updateDeskItem(selectedDeskItem.id, { x: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b]">Y
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.y || 0)} onChange={(e) => updateDeskItem(selectedDeskItem.id, { y: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b]">Ширина
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.width || (selectedDeskItem.kind === "panel" ? (DEFAULT_LAPTOP_PANEL_POSITION.width || 226) : selectedDeskItem.kind === "device" ? (DEFAULT_LAPTOP_POSITION.width || 372) : selectedDeskItem.kind === "guide" ? 228 : selectedDeskItem.kind === "folder" ? DESK_FOLDER_WIDTH : DESK_SHEET_WIDTH))} onChange={(e) => updateDeskItem(selectedDeskItem.id, { width: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b]">Высота
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.height || (selectedDeskItem.kind === "panel" ? (DEFAULT_LAPTOP_PANEL_POSITION.height || 132) : selectedDeskItem.kind === "device" ? (DEFAULT_LAPTOP_POSITION.height || 248) : selectedDeskItem.kind === "guide" ? 104 : selectedDeskItem.kind === "folder" ? DESK_FOLDER_HEIGHT : DESK_SHEET_HEIGHT))} onChange={(e) => updateDeskItem(selectedDeskItem.id, { height: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b]">Поворот Z
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={Number((selectedDeskItem.position.rotation || 0).toFixed(1))} onChange={(e) => updateDeskItem(selectedDeskItem.id, { rotation: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b]">Поворот X
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={Number((selectedDeskItem.position.tiltX || 0).toFixed(1))} onChange={(e) => updateDeskItem(selectedDeskItem.id, { tiltX: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b]">Поворот Y
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={Number((selectedDeskItem.position.tiltY || 0).toFixed(1))} onChange={(e) => updateDeskItem(selectedDeskItem.id, { tiltY: Number(e.target.value || 0) })} />
              </label>
              {selectedDeskItem.kind === "guide" ? (
                <>
                  {selectedDeskItem.id === TRAY_GUIDE_ID ? (
                    <label className="text-xs text-[#7b5b3b] md:col-span-7">Текст на стойке
                      <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="text" value={trayGuideText} onChange={(e) => setTrayGuideText(e.target.value)} />
                    </label>
                  ) : null}
                  <label className="text-xs text-[#7b5b3b]">TL X
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipTlx || 0)} onChange={(e) => updateDeskItem(selectedDeskItem.id, { clipTlx: Number(e.target.value || 0) })} />
                  </label>
                  <label className="text-xs text-[#7b5b3b]">TL Y
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipTly || 0)} onChange={(e) => updateDeskItem(selectedDeskItem.id, { clipTly: Number(e.target.value || 0) })} />
                  </label>
                  <label className="text-xs text-[#7b5b3b]">TR X
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipTrx || 0)} onChange={(e) => updateDeskItem(selectedDeskItem.id, { clipTrx: Number(e.target.value || 0) })} />
                  </label>
                  <label className="text-xs text-[#7b5b3b]">TR Y
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipTry || 0)} onChange={(e) => updateDeskItem(selectedDeskItem.id, { clipTry: Number(e.target.value || 0) })} />
                  </label>
                  <label className="text-xs text-[#7b5b3b]">BR X
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipBrx || 0)} onChange={(e) => updateDeskItem(selectedDeskItem.id, { clipBrx: Number(e.target.value || 0) })} />
                  </label>
                  <label className="text-xs text-[#7b5b3b]">BR Y
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipBry || 0)} onChange={(e) => updateDeskItem(selectedDeskItem.id, { clipBry: Number(e.target.value || 0) })} />
                  </label>
                  <label className="text-xs text-[#7b5b3b]">BL X
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipBlx || 0)} onChange={(e) => updateDeskItem(selectedDeskItem.id, { clipBlx: Number(e.target.value || 0) })} />
                  </label>
                  <label className="text-xs text-[#7b5b3b]">BL Y
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipBly || 0)} onChange={(e) => updateDeskItem(selectedDeskItem.id, { clipBly: Number(e.target.value || 0) })} />
                  </label>
                </>
              ) : null}
            </div>
            {selectedDeskItem.kind === "folder" || selectedDeskItem.kind === "project" ? (
              <div className="mt-3 border-t border-[#ead9c2] pt-3">
                {templateFeedback ? (
                  <div
                    aria-live="polite"
                    className={`mb-3 rounded-2xl border px-3 py-2 text-sm font-medium ${templateFeedback.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}
                  >
                    {templateFeedback.kind === "success" ? "✓ " : "⚠ "}{templateFeedback.text}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                {canManageGlobalTemplates ? (
                <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => saveDeskItemAsTemplate(selectedDeskItem.id, selectedDeskItem.kind)}
                >
                  Сохранить шаблон для всех {selectedDeskItem.kind === "folder" ? "папок" : "листов"}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => applyDeskTemplateToExistingItems(selectedDeskItem.kind)}
                >
                  Применить стандарт ко всем {selectedDeskItem.kind === "folder" ? "папкам" : "листам"}
                </button>
                </>
                ) : null}
                </div>
                {canManageGlobalTemplates ? <div className="mt-2 text-xs text-[#8a6a47]">Стандарт хранится на сервере и подхватывается у новых пользователей и на других устройствах.</div> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          ref={officeSceneRef}
          className="dashboard-office-scene relative overflow-hidden rounded-[34px] border border-[#4f3420]/10 bg-white shadow-[0_30px_70px_-44px_rgba(53,34,17,0.28)]"
          style={{ height: `${Math.max(520, OFFICE_SCENE_HEIGHT * officeSceneScale)}px` }}
        >
          {showDesktopLoader ? <DesktopLoadingOverlay /> : null}
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: `${OFFICE_SCENE_WIDTH}px`,
              height: `${OFFICE_SCENE_HEIGHT}px`,
              transform: `scale(${officeSceneScale})`,
            }}
          >
          <div className="dashboard-office-scene-backdrop absolute inset-0" />
          <div className="dashboard-office-scene-vignette absolute inset-0" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[160] transition-opacity duration-300"
            style={{
              opacity: isRoomLightDimmed ? 1 : 0,
              background: "radial-gradient(circle at 50% 14%, rgba(26, 23, 18, 0.2) 0%, rgba(10, 10, 14, 0.84) 56%, rgba(3, 4, 7, 0.94) 100%)",
            }}
          />

          <button
            type="button"
            className="absolute z-[182] flex items-start justify-start transition-[transform,opacity] duration-200"
            style={{
              left: `${roomSwitchPosition.x}px`,
              top: `${roomSwitchPosition.y}px`,
              width: `${roomSwitchPosition.width}px`,
              height: `${roomSwitchPosition.height}px`,
              cursor: sceneEditMode ? "grab" : "pointer",
              opacity: isRoomLightDimmed ? 0.9 : 0.98,
              transform: sceneEditMode ? "translateZ(0)" : "none",
            }}
            onMouseDown={(e) => {
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
                moved: false,
              };
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (suppressRoomSwitchClickRef.current) {
                suppressRoomSwitchClickRef.current = false;
                return;
              }
              toggleRoomLight();
            }}
            aria-label={isRoomLightDimmed ? "Включить основной свет" : "Приглушить основной свет"}
            aria-pressed={isRoomLightDimmed}
            title={sceneEditMode ? "Перетащи выключатель или кликни, чтобы переключить свет" : isRoomLightDimmed ? "Включить основной свет" : "Приглушить основной свет"}
          >
            <span
              className="pointer-events-none relative block transition-all duration-300"
              style={{
                width: "118px",
                height: "78px",
                filter: isRoomLightDimmed
                  ? "brightness(0.58) saturate(0.84) contrast(0.96)"
                  : "brightness(1) saturate(1.02) contrast(1)",
                transform: isRoomLightDimmed ? "translateY(2px) scale(0.992)" : "translateY(0) scale(1)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/room-light-switch-office.png"
                alt=""
                aria-hidden="true"
                draggable={false}
                className="h-full w-full object-contain"
                style={{
                  filter: isRoomLightDimmed
                    ? "drop-shadow(0 6px 16px rgba(6, 6, 10, 0.34)) drop-shadow(0 0 6px rgba(255, 213, 145, 0.08))"
                    : "drop-shadow(0 10px 18px rgba(24, 17, 11, 0.24))",
                }}
              />
              {sceneEditMode ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-[18px] border border-dashed border-white/28"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)" }}
                />
              ) : null}
            </span>
          </button>

          <button
            type="button"
            className="absolute z-[181] transition-all duration-200"
            style={{
              left: `${ROOM_DIM_HOTSPOT.x}px`,
              top: `${ROOM_DIM_HOTSPOT.y}px`,
              width: `${ROOM_DIM_HOTSPOT.width}px`,
              minHeight: `${ROOM_DIM_HOTSPOT.height}px`,
              borderRadius: sceneEditMode ? "28px" : "32px",
              border: sceneEditMode ? `1.5px dashed ${isRoomLightDimmed ? "rgba(245, 208, 147, 0.52)" : "rgba(255,255,255,0.36)"}` : "none",
              background: sceneEditMode ? (isRoomLightDimmed ? "rgba(73, 53, 31, 0.2)" : "rgba(255,255,255,0.05)") : "transparent",
              boxShadow: sceneEditMode ? "inset 0 0 0 1px rgba(255,255,255,0.06)" : "none",
              opacity: sceneEditMode ? 1 : 0,
              pointerEvents: sceneEditMode ? "auto" : "none",
              backdropFilter: sceneEditMode ? "blur(2px)" : "none",
              WebkitBackdropFilter: sceneEditMode ? "blur(2px)" : "none",
            }}
            onClick={(e) => {
              e.stopPropagation();
              toggleRoomLight();
            }}
            aria-label={isRoomLightDimmed ? "Вернуть обычное освещение" : "Приглушить свет на 90%"}
            title={isRoomLightDimmed ? "Вернуть обычное освещение" : "Приглушить свет на 90%"}
            tabIndex={sceneEditMode ? 0 : -1}
          >
            {sceneEditMode ? (
              <span className="pointer-events-none absolute inset-0 flex flex-col justify-between rounded-[28px] px-4 py-3 text-left">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Виртуальная зона</span>
                <span className="text-sm font-semibold text-white/82">{isRoomLightDimmed ? "Вернуть свет" : "Клик — приглушить на 90%"}</span>
              </span>
            ) : null}
          </button>

          <div className="dashboard-office-workzone absolute inset-0 overflow-hidden transition-[filter] duration-300" style={{ filter: isRoomLightDimmed ? "brightness(0.16) saturate(0.7)" : "brightness(1)", willChange: "filter" }} onClick={() => { setSelectedWidgetId(null); setSelectedDeskItemId(null); }} onDragOver={(e) => e.preventDefault()} onDrop={handleDeskDrop}>
            <div className="absolute inset-0 z-[8]">
              {sceneWidgets.filter((widget) => !isDeprecatedProjectAssemblyWidget(widget)).map((widget) => {
                const isSelected = widget.id === selectedWidgetId;
                return (
                  <div
                    key={widget.id}
                    data-onboarding-id={widget.id === "create-project" ? "dashboard-create-project" : undefined}
                    className={`dashboard-scene-widget dashboard-scene-widget-${widget.kind} dashboard-scene-widget-${widget.tone || "note"} ${sceneEditMode ? "dashboard-scene-widget-editing" : ""} ${sceneEditMode && isSelected ? "dashboard-scene-widget-selected" : ""}`}
                    style={{
                      left: `${widget.x}px`,
                      top: `${widget.y}px`,
                      width: `${widget.width}px`,
                      height: `${widget.height}px`,
                      transform: `rotate(${widget.rotation}deg)`,
                      zIndex: widget.z,
                      fontSize: `${widget.fontSize}px`,
                      pointerEvents:
                        widget.kind === "video" && !sceneEditMode
                          ? "none"
                          : widget.kind === "image" && !sceneEditMode && !isPreviewableSceneWidget(widget)
                            ? "none"
                            : "auto",
                      cursor: !sceneEditMode && isPreviewableSceneWidget(widget) ? "zoom-in" : undefined,
                    }}
                    onMouseDown={(e) => startWidgetInteraction(e, widget, "drag")}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (widget.kind === "image" && !sceneEditMode) {
                        if (isPreviewableSceneWidget(widget)) {
                          setPreviewSceneImage({ src: widget.src || "", title: getPreviewableSceneWidgetTitle(widget) });
                        }
                        return;
                      }
                      if (sceneEditMode) {
                        setSelectedWidgetId(widget.id);
                        setSelectedDeskItemId(null);
                      }
                      if (!sceneEditMode && (widget.kind === "button" || widget.kind === "video")) handleSceneWidgetAction(widget.action, widget);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!sceneEditMode && (widget.kind === "button" || widget.kind === "video")) handleSceneWidgetAction(widget.action, widget);
                    }}
                  >
                    {widget.kind === "video" ? (
                      <SceneVideoWidget
                        src={widget.src || PROJECT_ASSEMBLY_GUIDE_SRC}
                        title={widget.text || "AI-аналитик"}
                        active={activeAssemblyGuideId === widget.id}
                      />
                    ) : widget.kind === "image" ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="dashboard-scene-widget-image-el" src={widget.src} alt="Схема на доске" draggable={false} />
                      </>
                    ) : (
                      <span className="dashboard-scene-widget-label">{widget.text}</span>
                    )}
                    {sceneEditMode && isSelected ? (
                      <>
                        <button type="button" className="dashboard-scene-widget-rotate" onMouseDown={(e) => startWidgetInteraction(e, widget, "rotate")} aria-label="Повернуть элемент">↻</button>
                        <button type="button" className="dashboard-scene-widget-resize" onMouseDown={(e) => startWidgetInteraction(e, widget, "resize")} aria-label="Изменить размер элемента">↘</button>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div
              className={`absolute ${sceneEditMode && selectedDeskItemId === LAPTOP_DEVICE_ID ? "dashboard-desk-entity-selected" : ""}`}
              style={{
                left: `${laptopPosition.x}px`,
                top: `${laptopPosition.y}px`,
                width: `${laptopPosition.width || DEFAULT_LAPTOP_POSITION.width}px`,
                height: `${laptopPosition.height || DEFAULT_LAPTOP_POSITION.height}px`,
                zIndex: laptopPosition.z || DEFAULT_LAPTOP_POSITION.z || 24,
                transform: `rotate(${laptopPosition.rotation || 0}deg)`,
                transformOrigin: "center center",
                pointerEvents: sceneEditMode ? "auto" : "none",
              }}
              onMouseDown={(e) => {
                if (!sceneEditMode) return;
                e.preventDefault();
                e.stopPropagation();
                setSelectedDeskItemId(LAPTOP_DEVICE_ID);
                setSelectedWidgetId(null);
                startDeskItemInteraction(e, LAPTOP_DEVICE_ID, "device", "drag", laptopPosition);
              }}
              onClick={(e) => {
                if (!sceneEditMode) return;
                e.stopPropagation();
                setSelectedDeskItemId(LAPTOP_DEVICE_ID);
                setSelectedWidgetId(null);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dashboard-laptop-transparent.png"
                alt="Ноутбук на столе"
                draggable={false}
                className="pointer-events-none h-full w-full object-contain"
                style={{ filter: "drop-shadow(0 26px 28px rgba(5,10,24,0.34))" }}
              />
              {sceneEditMode && selectedDeskItemId === LAPTOP_DEVICE_ID ? (
                <>
                  <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={(e) => startDeskItemInteraction(e, LAPTOP_DEVICE_ID, "device", "rotate", laptopPosition)} aria-label="Повернуть ноутбук">↻</button>
                  <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={(e) => startDeskItemInteraction(e, LAPTOP_DEVICE_ID, "device", "resize", laptopPosition)} aria-label="Изменить размер ноутбука">↘</button>
                </>
              ) : null}
            </div>

            <div
              className={`absolute ${sceneEditMode && selectedDeskItemId === LAPTOP_PANEL_ID ? "dashboard-desk-entity-selected" : ""}`}
              style={{
                left: `${laptopPanelPosition.x}px`,
                top: `${laptopPanelPosition.y}px`,
                width: `${laptopPanelPosition.width || DEFAULT_LAPTOP_PANEL_POSITION.width}px`,
                height: `${laptopPanelPosition.height || DEFAULT_LAPTOP_PANEL_POSITION.height}px`,
                zIndex: laptopPanelPosition.z || DEFAULT_LAPTOP_PANEL_POSITION.z || 26,
                transform: `rotate(${laptopPanelPosition.rotation || 0}deg)`,
                transformOrigin: "center center",
              }}
              onMouseDown={(e) => {
                if (!sceneEditMode) return;
                e.preventDefault();
                e.stopPropagation();
                setSelectedDeskItemId(LAPTOP_PANEL_ID);
                setSelectedWidgetId(null);
                startDeskItemInteraction(e, LAPTOP_PANEL_ID, "panel", "drag", laptopPanelPosition);
              }}
              onClick={(e) => {
                if (!sceneEditMode) return;
                e.stopPropagation();
                setSelectedDeskItemId(LAPTOP_PANEL_ID);
                setSelectedWidgetId(null);
              }}
            >
              <div className="relative h-full w-full overflow-hidden border border-[#8ea8bb] bg-[linear-gradient(180deg,#f3f8fc_0%,#dfe9f2_100%)] text-slate-900 shadow-[0_14px_28px_-18px_rgba(47,76,105,0.28)]">
                <div className="absolute inset-x-0 top-0 h-[20px] border-b border-[#9eb8cc] bg-[linear-gradient(180deg,#d7ecfd_0%,#9fc2e3_100%)]" />
                <div className="absolute left-2 top-[5px] flex items-center gap-1.5">
                  <span className="h-[8px] w-[8px] rounded-[2px] border border-white/70 bg-white/75" />
                  <span className="h-[8px] w-[22px] rounded-[2px] bg-white/35" />
                </div>
                <div className="absolute right-2 top-[4px] flex items-center gap-1">
                  <span className="h-[10px] w-[10px] border border-white/55 bg-white/25" />
                  <span className="h-[10px] w-[10px] border border-white/55 bg-white/25" />
                  <span className="h-[10px] w-[10px] border border-white/55 bg-white/25" />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.7),transparent_48%)]" />
                <div className="relative z-[1] grid h-full grid-cols-[0.95fr_1.05fr] gap-2 px-2 pb-2 pt-6">
                  <div className="flex h-full min-h-0 flex-col rounded-[4px] border border-[#b8cad8] bg-[linear-gradient(180deg,#ffffff_0%,#eef4f8_100%)] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                    <div className="text-[8px] uppercase tracking-[0.14em] text-slate-500">Баланс</div>
                    <div className="mt-1 text-[18px] font-semibold leading-none text-slate-900">{balanceText}</div>
                    <Link
                      href="/wallet"
                      data-onboarding-id="dashboard-wallet-link"
                      onClick={(e) => { e.stopPropagation(); if (sceneEditMode) e.preventDefault(); }}
                      className={`mt-2 inline-flex h-7 w-full items-center justify-center border px-2 text-[10px] font-semibold transition ${sceneEditMode ? "pointer-events-none border-slate-300 bg-slate-200/70 text-slate-500" : "border-[#7f97ab] bg-[linear-gradient(180deg,#ffffff_0%,#dbe7f0_100%)] text-[#29435b] shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] hover:bg-[linear-gradient(180deg,#ffffff_0%,#d2e0eb_100%)]"}`}
                    >
                      Кошелёк
                    </Link>
                  </div>
                  <div className="flex h-full min-h-0 flex-col rounded-[4px] border border-[#b8cad8] bg-[linear-gradient(180deg,#ffffff_0%,#eef4f8_100%)] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                    <div className="text-[8px] uppercase tracking-[0.14em] text-slate-500">Тариф</div>
                    <div className="mt-1 line-clamp-2 text-[10px] font-semibold leading-[1.15] text-slate-900">{activeSubscription ? activeSubscription.plan_title : "Не подключён"}</div>
                    {activeSubscription ? (
                      <div className="mt-1.5 space-y-1 text-[9px] leading-[1.25] text-slate-700">
                        <div className="rounded-[3px] border border-[#d4dee7] bg-[#f8fbfe] px-2 py-1">
                          До завершения: <span className="font-semibold text-slate-900">{getSubscriptionDaysLeft(activeSubscription.expires_at) ?? 0} дн.</span>
                        </div>
                        <div className="rounded-[3px] border border-[#d4dee7] bg-[#f8fbfe] px-2 py-1">
                          Осталось: <span className="font-semibold text-slate-900">{activeSubscription.projects_remaining}</span> / {activeSubscription.projects_limit}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1.5 rounded-[3px] border border-[#d4dee7] bg-[#f8fbfe] px-2 py-1 text-[9px] leading-[1.25] text-slate-600">
                        Тариф не подключён.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {sceneEditMode && selectedDeskItemId === LAPTOP_PANEL_ID ? (
                <>
                  <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={(e) => startDeskItemInteraction(e, LAPTOP_PANEL_ID, "panel", "rotate", laptopPanelPosition)} aria-label="Повернуть панель ноутбука">↻</button>
                  <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={(e) => startDeskItemInteraction(e, LAPTOP_PANEL_ID, "panel", "resize", laptopPanelPosition)} aria-label="Изменить размер панели ноутбука">↘</button>
                </>
              ) : null}
            </div>

            {(() => {
              const trashPosition = deskPositions[TRASH_GUIDE_ID] || getDefaultTrashGuidePosition();
              const width = trashPosition.width || TRASH_ZONE.width;
              const height = trashPosition.height || TRASH_ZONE.height;
              const isSelected = selectedDeskItemId === TRASH_GUIDE_ID;
              return (
                <div
                  data-onboarding-id="dashboard-trash"
                  className={`dashboard-trash-zone absolute z-[14] ${trashHover ? 'dashboard-trash-zone-active' : ''} ${sceneEditMode ? 'dashboard-trash-zone-editing' : ''} ${isSelected ? 'dashboard-desk-entity-selected' : ''}`}
                  style={{ left: `${trashPosition.x}px`, top: `${trashPosition.y}px`, width: `${width}px`, height: `${height}px`, transform: getGuideTransform(trashPosition), transformOrigin: 'top left' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (sceneEditMode) {
                      setSelectedDeskItemId(TRASH_GUIDE_ID);
                      setSelectedWidgetId(null);
                    } else {
                      setTrashOpen(true);
                    }
                  }}
                  onMouseDown={(e) => {
                    if (!sceneEditMode) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedDeskItemId(TRASH_GUIDE_ID);
                    setSelectedWidgetId(null);
                    startDeskItemInteraction(e, TRASH_GUIDE_ID, 'guide', 'drag', trashPosition);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    const draggedProjectId = e.dataTransfer.getData('text/project-id') || draggingProjectId;
                    const draggedFolderId = e.dataTransfer.getData('text/folder-id') || draggingFolderId;
                    if (draggedProjectId) beginTrashHover('project', draggedProjectId);
                    else if (draggedFolderId) beginTrashHover('folder', draggedFolderId);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const draggedProjectId = e.dataTransfer.getData('text/project-id') || draggingProjectId;
                    const draggedFolderId = e.dataTransfer.getData('text/folder-id') || draggingFolderId;
                    if (draggedProjectId) beginTrashHover('project', draggedProjectId);
                    else if (draggedFolderId) beginTrashHover('folder', draggedFolderId);
                  }}
                  onDragLeave={() => clearTrashHover()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedProjectId = e.dataTransfer.getData('text/project-id') || draggingProjectId;
                    const draggedFolderId = e.dataTransfer.getData('text/folder-id') || draggingFolderId;
                    if (draggedProjectId) {
                      const project = (workspace?.projects || []).find((item) => item.id === draggedProjectId);
                      moveToTrash('project', draggedProjectId, project?.title || project?.person?.full_name || 'Проект');
                      setDraggingProjectId(null);
                    } else if (draggedFolderId) {
                      const folder = (workspace?.folders || []).find((item) => item.id === draggedFolderId);
                      moveToTrash('folder', draggedFolderId, folder?.name || 'Папка');
                      setDraggingFolderId(null);
                    }
                    clearTrashHover();
                  }}
                  aria-label="Корзина"
                  title="Корзина"
                >
                  {sceneEditMode ? <span className="dashboard-trash-zone-label">Корзина</span> : null}
                  {sceneEditMode && isSelected ? (
                    <>
                      <button type="button" style={{ pointerEvents: 'auto' }} className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={(e) => startDeskItemInteraction(e, TRASH_GUIDE_ID, 'guide', 'rotate', trashPosition)} aria-label="Повернуть зону корзины">↻</button>
                      <button type="button" style={{ pointerEvents: 'auto' }} className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={(e) => startDeskItemInteraction(e, TRASH_GUIDE_ID, 'guide', 'resize', trashPosition)} aria-label="Изменить размер зоны корзины">↘</button>
                    </>
                  ) : null}
                </div>
              );
            })()}
            {(() => {
              const guidePosition = deskPositions[TRAY_GUIDE_ID] || getDefaultTrayGuidePosition();
              const guideWidth = guidePosition.width || 228;
              const guideHeight = guidePosition.height || 104;
              const guideRotation = guidePosition.rotation || 0;
              const guideTiltX = guidePosition.tiltX || 0;
              const guideTiltY = guidePosition.tiltY || 0;
              const isSelected = selectedDeskItemId === TRAY_GUIDE_ID;
              return (
                <div
                  className={`absolute ${isSelected ? "dashboard-desk-entity-selected" : ""}`}
                  style={{
                    left: guidePosition.x,
                    top: guidePosition.y,
                    zIndex: isSelected ? 19 : 11,
                    width: `${guideWidth}px`,
                    height: `${guideHeight}px`,
                    transform: `perspective(1400px) rotateX(${guideTiltX}deg) rotateY(${guideTiltY}deg) rotate(${guideRotation}deg)`,
                    transformOrigin: 'top left',
                    transformStyle: 'preserve-3d',
                    pointerEvents: sceneEditMode ? 'auto' : 'none'
                  }}
                >
                  <div className={`dashboard-tray-guide-box ${sceneEditMode ? "dashboard-tray-guide-box-editing" : ""}`}>
                    <button
                      type="button"
                      data-onboarding-id="dashboard-create-folder"
                      className="dashboard-tray-guide-inner"
                      style={{ clipPath: getGuideClipPath(guidePosition), pointerEvents: 'auto', cursor: sceneEditMode ? 'grab' : 'pointer' }}
                      onMouseDown={(e) => {
                        if (!sceneEditMode) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedDeskItemId(TRAY_GUIDE_ID);
                        setSelectedWidgetId(null);
                        startDeskItemInteraction(e, TRAY_GUIDE_ID, "guide", "drag", guidePosition);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!sceneEditMode) {
                          promptAndCreateFolder();
                        }
                      }}
                    >
                      <div className="dashboard-tray-guide-label">{trayGuideText}</div>
                    </button>
                  </div>
                  {sceneEditMode ? (
                    <button
                      type="button"
                      className="dashboard-tray-guide-selector"
                      style={{ pointerEvents: 'auto' }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedDeskItemId(TRAY_GUIDE_ID);
                        setSelectedWidgetId(null);
                        startDeskItemInteraction(e, TRAY_GUIDE_ID, "guide", "drag", guidePosition);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDeskItemId(TRAY_GUIDE_ID);
                        setSelectedWidgetId(null);
                      }}
                      aria-label="Выбрать виртуальную стойку"
                      title="Выбрать виртуальную стойку"
                    >
                      ⤢
                    </button>
                  ) : null}
                  {sceneEditMode && isSelected ? (
                    <>
                      <button type="button" style={{ pointerEvents: 'auto' }} className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={(e) => startDeskItemInteraction(e, TRAY_GUIDE_ID, "guide", "rotate", guidePosition)} aria-label="Повернуть зону стойки">↻</button>
                      <button type="button" style={{ pointerEvents: 'auto' }} className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={(e) => startDeskItemInteraction(e, TRAY_GUIDE_ID, "guide", "resize", guidePosition)} aria-label="Изменить размер зоны стойки">↘</button>
                    </>
                  ) : null}
                </div>
              );
            })()}

            {(() => {
              const guideClip = getGuideClipRect(deskPositions[TRAY_GUIDE_ID]);
              return (
                <div className="absolute z-[12] overflow-hidden" style={{ left: `${guideClip.x}px`, top: `${guideClip.y}px`, width: `${guideClip.width}px`, height: `${guideClip.height}px`, transform: getGuideTransform(deskPositions[TRAY_GUIDE_ID]), transformOrigin: 'top left', clipPath: getGuideClipPath(deskPositions[TRAY_GUIDE_ID]), pointerEvents: 'none' }}>
              {trayFolders.map(({ folder, projects: folderProjects }, folderIndex) => {
                const itemId = `folder:${folder.id}`;
                const position = deskPositions[itemId] || getDefaultFolderPosition(folderIndex);
                const width = position.width || DESK_FOLDER_WIDTH;
                const height = position.height || DESK_FOLDER_HEIGHT;
                const rotation = (position.rotation || 0) + getEntityTilt(folder.id, 2) * 0.42;
                const isSelected = selectedDeskItemId === itemId;
                return (
                  <div key={folder.id} className="absolute" style={{ left: position.x - guideClip.x, top: position.y - guideClip.y, zIndex: position.z, width: `${width}px`, height: `${height}px`, transform: `perspective(1400px) rotateX(${position.tiltX || 0}deg) rotateY(${position.tiltY || 0}deg) rotate(${rotation}deg)`, transformStyle: 'preserve-3d', pointerEvents: 'auto' }}>
                    <FolderDesktopIcon
                      folder={folder}
                      projects={folderProjects}
                      busy={busyFolderId === folder.id}
                      onOpen={() => setActiveFolderId(folder.id)}
                      onManage={() => setFolderActionTarget(folder)}
                      onDropProject={(projectId) => moveProject(projectId, folder.id)}
                      draggingProjectId={draggingProjectId}
                      sceneEditMode={sceneEditMode}
                      selected={isSelected}
                      onSelect={() => { setSelectedDeskItemId(itemId); setSelectedWidgetId(null); }}
                      onResizeHandleMouseDown={(e) => startDeskItemInteraction(e, itemId, "folder", "resize", position)}
                      onRotateHandleMouseDown={(e) => startDeskItemInteraction(e, itemId, "folder", "rotate", position)}
                      onDragMoveStart={(e) => startDeskItemInteraction(e, itemId, "folder", "drag", position)}
                      onDragStart={() => {
                        setDraggingFolderId(folder.id);
                        bringDeskItemToFront(itemId);
                      }}
                      onDragEnd={() => setDraggingFolderId(null)}
                    />
                  </div>
                );
              })}
            </div>
              );
            })()}

            {looseFolders.map(({ folder, projects: folderProjects }, folderIndex) => {
              const itemId = `folder:${folder.id}`;
              const position = deskPositions[itemId] || getDefaultFolderPosition(folderIndex);
              const width = position.width || DESK_FOLDER_WIDTH;
              const height = position.height || DESK_FOLDER_HEIGHT;
              const rotation = (position.rotation || 0) + getEntityTilt(folder.id, 2) * 0.42;
              const isSelected = selectedDeskItemId === itemId;
              return (
                <div key={folder.id} className="absolute" style={{ left: position.x, top: position.y, zIndex: position.z, width: `${width}px`, height: `${height}px`, transform: `perspective(1400px) rotateX(${position.tiltX || 0}deg) rotateY(${position.tiltY || 0}deg) rotate(${rotation}deg)`, transformStyle: 'preserve-3d' }}>
                  <FolderDesktopIcon
                    folder={folder}
                    projects={folderProjects}
                    busy={busyFolderId === folder.id}
                    onOpen={() => setActiveFolderId(folder.id)}
                    onManage={() => setFolderActionTarget(folder)}
                    onDropProject={(projectId) => moveProject(projectId, folder.id)}
                    draggingProjectId={draggingProjectId}
                    sceneEditMode={sceneEditMode}
                    selected={isSelected}
                    onSelect={() => { setSelectedDeskItemId(itemId); setSelectedWidgetId(null); }}
                    onResizeHandleMouseDown={(e) => startDeskItemInteraction(e, itemId, "folder", "resize", position)}
                    onRotateHandleMouseDown={(e) => startDeskItemInteraction(e, itemId, "folder", "rotate", position)}
                    onDragMoveStart={(e) => startDeskItemInteraction(e, itemId, "folder", "drag", position)}
                    onDragStart={() => {
                      setDraggingFolderId(folder.id);
                      bringDeskItemToFront(itemId);
                    }}
                    onDragEnd={() => setDraggingFolderId(null)}
                  />
                </div>
              );
            })}

            {folderBuckets.uncategorized.map((project, projectIndex) => {
              const itemId = `project:${project.id}`;
              const position = deskPositions[itemId] || getDefaultProjectPosition(projectIndex);
              const width = position.width || DESK_SHEET_WIDTH;
              const height = position.height || DESK_SHEET_HEIGHT;
              const rotation = (position.rotation || 0) + getEntityTilt(project.id, 1) * 0.18;
              const isSelected = selectedDeskItemId === itemId;
              return (
                <div key={project.id} className="absolute" style={{ left: position.x, top: position.y, zIndex: position.z, width: `${width}px`, height: `${height}px`, transform: `perspective(1400px) rotateX(${position.tiltX || 0}deg) rotateY(${position.tiltY || 0}deg) rotate(${rotation}deg)`, transformStyle: 'preserve-3d' }}>
                  <ProjectDesktopIcon
                    project={project}
                    busy={busyFolderId === `delete:${project.id}`}
                    sceneEditMode={sceneEditMode}
                    selected={isSelected}
                    onSelect={() => { setSelectedDeskItemId(itemId); setSelectedWidgetId(null); }}
                    onResizeHandleMouseDown={(e) => startDeskItemInteraction(e, itemId, "project", "resize", position)}
                    onRotateHandleMouseDown={(e) => startDeskItemInteraction(e, itemId, "project", "rotate", position)}
                    onDragMoveStart={(e) => startDeskItemInteraction(e, itemId, "project", "drag", position)}
                    onOpen={() => setPreviewProject(project)}
                    onDragStart={() => {
                      setDraggingProjectId(project.id);
                      bringDeskItemToFront(itemId);
                    }}
                    onDragEnd={() => {
                      setDraggingProjectId(null);
                      clearTrashHover();
                    }}
                    onDelete={() => deleteProject(project.id)}
                  />
                </div>
              );
            })}

            <button
              type="button"
              className="dashboard-pen-trigger absolute bottom-12 right-10 z-[220]"
              onClick={() => router.push('/projects/new')}
              aria-label="Создать проект оценки"
              title="Создать проект оценки"
            >
              <span className="dashboard-pen-body" />
              <span className="dashboard-pen-cap" />
              <span className="dashboard-pen-tip" />
            </button>

            {!folderBuckets.byFolder.length && !folderBuckets.uncategorized.length ? (
              <div className="absolute inset-x-8 bottom-12 rounded-2xl border border-dashed border-black/10 bg-white/88 p-8 text-center text-sm text-[#4b3727] shadow-[0_14px_30px_-24px_rgba(31,18,10,0.22)]">
                Здесь пока пусто. Создай первый проект или добавь папку в стойку справа.
              </div>
            ) : null}
          </div>
        </div>
      </div>
      </div>

      {activeFolder ? (
        <FolderModal
          folder={activeFolder.folder}
          projects={activeFolder.projects}
          busy={busyFolderId === activeFolder.folder.id}
          onClose={() => setActiveFolderId(null)}
          onManage={() => setFolderActionTarget(activeFolder.folder)}
          onOpenProject={(id) => router.push(`/projects/${id}`)}
          onMoveToDesktop={(projectId) => moveProject(projectId, null)}
          onDeleteProject={(projectId) => deleteProject(projectId)}
        />
      ) : null}

      {trashOpen ? (
        <TrashRestoreModal
          entries={trashEntries}
          folders={workspace?.folders || []}
          projects={workspace?.projects || []}
          onClose={() => setTrashOpen(false)}
          onRestore={restoreTrashEntry}
          onDeleteNow={(entry) => {
            if (entry.kind === "project") void deleteProject(entry.id, true);
            else void deleteFolderDirect(entry.id);
            setTrashEntries((prev) => prev.filter((item) => !(item.kind === entry.kind && item.id === entry.id)));
          }}
        />
      ) : null}

      {previewProject ? (
        <ProjectSheetPreviewModal
          project={previewProject}
          onClose={() => setPreviewProject(null)}
          onOpenFull={() => router.push(`/projects/${previewProject.id}`)}
        />
      ) : null}

      {previewSceneImage ? (
        <SceneImagePreviewModal
          src={previewSceneImage.src}
          title={previewSceneImage.title}
          onClose={() => setPreviewSceneImage(null)}
        />
      ) : null}

      {folderManagementDialogs}
    </Layout>
  );
}

type DashboardBackdropProps = {
  pulseToken: number;
  greeneryLevel: GreeneryLevel;
};

type PremiumActionButtonProps = {
  label: string;
  onClick: () => void;
  pulseToken: number;
  variant?: "primary" | "secondary";
  compact?: boolean;
};

type VineFrameProps = {
  growthLevel: GreeneryLevel;
  density?: "rich" | "light";
  pulseToken?: number;
};

function DashboardBackdrop({ pulseToken, greeneryLevel }: DashboardBackdropProps) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 dashboard-surface-gradient" />
        <div className="absolute left-[6%] top-[3%] h-56 w-[42%] rounded-[40px] bg-white/20 blur-3xl" />
        <div className="absolute right-[4%] top-[6%] h-48 w-[30%] rounded-[40px] bg-white/22 blur-3xl" />
        <div className="absolute inset-y-0 left-[11%] w-px bg-white/8" />
        <div className="absolute inset-y-0 left-[42%] w-px bg-black/5" />
        <div className="absolute inset-y-0 right-[18%] w-px bg-white/7" />
        <div className="absolute inset-x-0 top-[18%] h-px bg-white/7" />
        <div className="absolute inset-x-0 top-[53%] h-px bg-black/5" />
      </div>

      {greeneryLevel >= 1 ? (
        <div key={`desk-breath-${pulseToken}-${greeneryLevel}`} className="pointer-events-none absolute right-[4%] top-[6%] z-[1] h-40 w-40 rounded-full bg-emerald-200/10 blur-3xl" />
      ) : null}
    </>
  );
}

function PremiumActionButton({ label, onClick, pulseToken, variant = "primary", compact = false }: PremiumActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dashboard-action-btn ${variant === "primary" ? "dashboard-action-btn-primary" : "dashboard-action-btn-secondary"} ${compact ? "dashboard-action-btn-compact" : ""}`}
    >
      <span className="relative z-10">{label}</span>
      <span className="dashboard-action-badge-shell" aria-hidden="true">
        <SproutBadge key={`${label}-${pulseToken}`} compact={compact} />
      </span>
    </button>
  );
}

function SproutBadge({ compact = false }: { compact?: boolean }) {
  const size = compact ? 28 : 32;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true" className="dashboard-button-sprout">
      <circle cx="24" cy="24" r="20" className="dashboard-button-sprout-orb" />
      <path d="M24 31V18" className="dashboard-button-sprout-stem" />
      <path d="M24 20C17 15 11 15 7 20C13 23 18 23 24 20Z" className="dashboard-button-sprout-leaf" />
      <path d="M24 20C30 12 36 10 42 14C37 22 31 24 24 20Z" className="dashboard-button-sprout-leaf dashboard-button-sprout-leaf-alt" />
    </svg>
  );
}

function VineLeaf({ x, y, rotate = 0, scale = 1, className = "" }: { x: number; y: number; rotate?: number; scale?: number; className?: string }) {
  return (
    <path
      d="M0 0C7 -8 15 -10 24 -2C18 10 8 12 0 0Z"
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}
      className={`dashboard-vine-leaf ${className}`.trim()}
    />
  );
}

function VineFrame({ growthLevel, density = "rich", pulseToken = 0 }: VineFrameProps) {
  if (growthLevel === 0) return null;

  return (
    <div key={`vines-${density}-${growthLevel}-${pulseToken}`} className={`dashboard-vine-shell pointer-events-none absolute inset-[10px] z-0 ${density === "rich" ? "opacity-100" : "opacity-90"}`}>
      <CornerVine className="-left-5 -top-5" growthLevel={growthLevel} />
      <CornerVine className="-right-5 -top-5 -scale-x-100" growthLevel={growthLevel} />
      <CornerVine className="-bottom-5 -left-5 -scale-y-100" growthLevel={growthLevel} />
      <CornerVine className="-bottom-5 -right-5 scale-y-[-1] scale-x-[-1]" growthLevel={growthLevel} />
      {growthLevel >= 1 ? <EdgeVine side="top" growthLevel={growthLevel} /> : null}
      {growthLevel >= 2 ? <EdgeVine side="right" growthLevel={growthLevel} /> : null}
      {growthLevel >= 3 && density === "rich" ? <EdgeVine side="bottom" growthLevel={growthLevel} /> : null}
    </div>
  );
}

function CornerVine({ className = "", growthLevel }: { className?: string; growthLevel: GreeneryLevel }) {
  return (
    <div className={`absolute h-24 w-32 sm:h-28 sm:w-36 ${className}`}>
      <svg viewBox="0 0 180 160" className="h-full w-full" fill="none" aria-hidden="true">
        <path d="M14 150C28 124 40 104 58 86C78 67 96 54 120 45C136 39 150 26 166 10" className="dashboard-vine-stroke dashboard-vine-stroke-main" />
        {growthLevel >= 2 ? <path d="M34 148C48 122 58 104 74 89" className="dashboard-vine-stroke dashboard-vine-stroke-soft" /> : null}
        {growthLevel >= 2 ? <path d="M76 86C70 72 60 63 46 59" className="dashboard-vine-stroke dashboard-vine-stroke-soft" /> : null}
        {growthLevel >= 3 ? <path d="M116 45C112 31 102 19 87 12" className="dashboard-vine-stroke dashboard-vine-stroke-soft" /> : null}
        <VineLeaf x={54} y={98} rotate={-34} scale={0.9} />
        <VineLeaf x={76} y={74} rotate={14} scale={0.95} className="dashboard-vine-leaf-delay" />
        {growthLevel >= 2 ? <VineLeaf x={98} y={57} rotate={-22} scale={0.82} className="dashboard-vine-leaf-delay" /> : null}
        {growthLevel >= 3 ? <VineLeaf x={126} y={36} rotate={18} scale={0.88} className="dashboard-vine-leaf-delay-2" /> : null}
        {growthLevel >= 4 ? <VineLeaf x={30} y={122} rotate={42} scale={0.76} className="dashboard-vine-leaf-delay-2" /> : null}
      </svg>
    </div>
  );
}

function EdgeVine({ side, growthLevel }: { side: "top" | "right" | "bottom"; growthLevel: GreeneryLevel }) {
  if (side === "top") {
    return (
      <div className="absolute left-16 right-16 top-0 h-9 opacity-90">
        <svg viewBox="0 0 360 58" className="h-full w-full" fill="none" aria-hidden="true">
          <path d="M8 40C56 18 102 15 154 30C208 45 264 44 352 18" className="dashboard-vine-stroke dashboard-vine-stroke-soft" />
          <VineLeaf x={72} y={23} rotate={-18} scale={0.84} />
          <VineLeaf x={122} y={31} rotate={14} scale={0.8} className="dashboard-vine-leaf-delay" />
          <VineLeaf x={192} y={35} rotate={-10} scale={0.82} className="dashboard-vine-leaf-delay" />
          {growthLevel >= 2 ? <VineLeaf x={260} y={28} rotate={22} scale={0.86} className="dashboard-vine-leaf-delay-2" /> : null}
          {growthLevel >= 3 ? <VineLeaf x={310} y={20} rotate={-16} scale={0.78} className="dashboard-vine-leaf-delay-2" /> : null}
        </svg>
      </div>
    );
  }

  if (side === "right") {
    return (
      <div className="absolute right-0 top-14 bottom-14 w-8 opacity-85">
        <svg viewBox="0 0 48 240" className="h-full w-full" fill="none" aria-hidden="true">
          <path d="M18 10C34 44 34 80 22 116C12 152 13 188 32 230" className="dashboard-vine-stroke dashboard-vine-stroke-soft" />
          <VineLeaf x={26} y={58} rotate={72} scale={0.88} />
          <VineLeaf x={12} y={108} rotate={-60} scale={0.86} className="dashboard-vine-leaf-delay" />
          <VineLeaf x={28} y={162} rotate={64} scale={0.84} className="dashboard-vine-leaf-delay-2" />
          {growthLevel >= 4 ? <VineLeaf x={16} y={212} rotate={-52} scale={0.78} className="dashboard-vine-leaf-delay-2" /> : null}
        </svg>
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-20 right-20 h-8 opacity-80">
      <svg viewBox="0 0 360 50" className="h-full w-full" fill="none" aria-hidden="true">
        <path d="M12 12C68 32 130 36 190 25C246 15 300 15 348 32" className="dashboard-vine-stroke dashboard-vine-stroke-soft" />
        <VineLeaf x={92} y={26} rotate={-12} scale={0.84} />
        <VineLeaf x={158} y={30} rotate={18} scale={0.84} className="dashboard-vine-leaf-delay" />
        <VineLeaf x={228} y={22} rotate={-8} scale={0.82} className="dashboard-vine-leaf-delay" />
        <VineLeaf x={286} y={28} rotate={14} scale={0.86} className="dashboard-vine-leaf-delay-2" />
      </svg>
    </div>
  );
}

type FolderDesktopIconVariant = "scheme" | "classic";

type FolderDesktopIconProps = {
  variant?: FolderDesktopIconVariant;
  folder: FolderRow;
  projects: ProjectRow[];
  busy?: boolean;
  onOpen: () => void;
  onManage: () => void;
  onDropProject: (projectId: string) => void;
  draggingProjectId: string | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  sceneEditMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onResizeHandleMouseDown?: (e: any) => void;
  onRotateHandleMouseDown?: (e: any) => void;
  onDragMoveStart?: (e: any) => void;
};

function FolderDesktopIcon({ variant = "scheme", folder, projects, busy, onOpen, onManage, onDropProject, draggingProjectId, onDragStart, onDragEnd, sceneEditMode = false, selected = false, onSelect, onResizeHandleMouseDown, onRotateHandleMouseDown, onDragMoveStart }: FolderDesktopIconProps) {
  const preview = projects.slice(0, 3);

  if (variant === "classic") {
    const icon = getFolderIcon(folder.icon_key);
    return (
      <div className={`dashboard-classic-icon-shell group relative flex h-full w-full flex-col items-center ${selected ? "dashboard-desk-entity-selected" : ""}`}>
        <button
          type="button"
          draggable={!sceneEditMode && !busy}
          onMouseDownCapture={() => { onSelect?.(); }}
          disabled={busy}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/folder-id", folder.id);
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          onMouseDown={(e) => { if (sceneEditMode) onDragMoveStart?.(e); }}
          onClick={() => { onSelect?.(); if (!sceneEditMode) onOpen(); }}
          className={`dashboard-classic-icon-button dashboard-classic-folder ${busy ? "opacity-70" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
            if (draggedId) onDropProject(draggedId);
          }}
        >
          <span className="dashboard-classic-folder-tab" />
          <span className="dashboard-classic-folder-body" />
          <span className="dashboard-classic-folder-badge">{icon.symbol}</span>
          <span className="dashboard-classic-folder-count">{projects.length}</span>
        </button>
        <div className="dashboard-classic-icon-label">{folder.name}</div>
        {sceneEditMode && selected ? (
          <>
            <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={onRotateHandleMouseDown} aria-label="Повернуть папку">↻</button>
            <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={onResizeHandleMouseDown} aria-label="Изменить размер папки">↘</button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`group relative flex h-full w-full flex-col items-center gap-2 ${selected ? "dashboard-desk-entity-selected" : ""}`}>
      <button
        type="button"
        draggable={!sceneEditMode && !busy}
        onMouseDownCapture={() => { onSelect?.(); }}
        disabled={busy}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/folder-id", folder.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onMouseDown={(e) => { if (sceneEditMode) onDragMoveStart?.(e); }}
        onClick={() => {
          onSelect?.();
          if (!sceneEditMode) onOpen();
        }}
        className={`dashboard-folder-card dashboard-folder-card-angled relative flex h-full w-full items-end justify-start overflow-visible border transition hover:-translate-y-0.5 ${draggingProjectId ? "border-[#94724a]" : "border-[#b88c5a]"} ${busy ? "opacity-70" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
          if (draggedId) onDropProject(draggedId);
        }}
      >
        <div className="dashboard-folder-shadow-strip" />
        <div className="dashboard-folder-spine" />
        <div className="dashboard-folder-tab" />
        <div className="dashboard-folder-pocket" />
        <div className="dashboard-folder-mouth" />
        <div className="dashboard-folder-inner-shadow" />
        <div className="dashboard-folder-gloss" />

        <div className="absolute left-4 right-12 top-10 z-20">
          <div className="truncate text-[16px] font-semibold leading-tight text-[#5c3e1f]">{folder.name}</div>
          <div className="mt-1 text-[11px] text-[#7a5830]">Открыть папку</div>
        </div>

        <div className="pointer-events-none absolute left-4 right-4 top-[68px] z-20 flex flex-col gap-1.5">
          {preview.length ? preview.map((project, index) => {
            const slipTitle = project.person?.full_name || project.title || "Проект";
            return (
              <div
                key={project.id}
                className="dashboard-folder-name-slip rounded-[8px] border px-3 py-1 text-left text-[10px] font-semibold shadow-sm"
                style={{
                  marginLeft: `${index * 10}px`,
                  marginRight: `${Math.max(0, 20 - index * 5)}px`,
                  transform: `translateY(${index * 8}px) rotate(${index % 2 === 0 ? -0.8 : 0.65}deg)`,
                  zIndex: 30 - index,
                }}
              >
                <span className="block truncate">{slipTitle}</span>
              </div>
            );
          }) : (
            <div className="dashboard-folder-name-slip rounded-[8px] border px-3 py-1 text-left text-[10px] font-semibold shadow-sm">
              <span className="block truncate">Папка пуста</span>
            </div>
          )}
        </div>

        <div className="absolute bottom-3 right-4 z-20 rounded-full border border-[#d5be99] bg-[#fff9f0]/92 px-2 py-1 text-[11px] font-medium text-[#5b4024] shadow-sm">{projects.length}</div>
      </button>
      <button
        type="button"
        onClick={onManage}
        className="absolute right-0 top-0 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-[#f2e7d3] bg-[#fffaf2]/96 text-sm text-[#6e4d2f] shadow-sm opacity-0 transition hover:text-slate-900 group-hover:opacity-100"
        title="Управление папкой"
        aria-label="Управление папкой"
      >
        ⋯
      </button>
      {sceneEditMode && selected ? (
        <>
          <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={onRotateHandleMouseDown} aria-label="Повернуть папку">↻</button>
          <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={onResizeHandleMouseDown} aria-label="Изменить размер папки">↘</button>
        </>
      ) : null}
    </div>
  );
}

type ProjectDesktopIconProps = {
  variant?: FolderDesktopIconVariant;
  project: ProjectRow;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDelete?: () => void;
  busy?: boolean;
  compact?: boolean;
  sceneEditMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onResizeHandleMouseDown?: (e: any) => void;
  onRotateHandleMouseDown?: (e: any) => void;
  onDragMoveStart?: (e: any) => void;
};

function ProjectDesktopIcon({ variant = "scheme", project, onOpen, onDragStart, onDragEnd, onDelete, busy = false, compact = false, sceneEditMode = false, selected = false, onSelect, onResizeHandleMouseDown, onRotateHandleMouseDown, onDragMoveStart }: ProjectDesktopIconProps) {
  const displayName = project.person?.full_name || project.title || "Проект";
  const titleLine = project.title || displayName;
  const roleLine = project.target_role || project.person?.current_position || "Роль не указана";
  const goal = getGoalDefinition(project.goal);
  const total = project.tests?.length || 0;
  const completed = Math.min(project.attempts_count || 0, total || 0);
  const isDone = total > 0 && completed >= total;
  const assessmentLine = isDone ? "сформирована" : completed > 0 ? "в процессе" : "ещё не собрана";

  if (variant === "classic") {
    return (
      <div className={`dashboard-classic-icon-shell group relative flex h-full w-full flex-col items-center ${selected ? "dashboard-desk-entity-selected" : ""}`}>
        <button
          type="button"
          draggable={!sceneEditMode && !busy}
          disabled={busy}
          onMouseDownCapture={() => { onSelect?.(); }}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/project-id", project.id);
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          onMouseDown={(e) => { if (sceneEditMode) onDragMoveStart?.(e); }}
          onClick={() => { onSelect?.(); if (!sceneEditMode) onOpen(); }}
          className={`dashboard-classic-icon-button dashboard-classic-file ${busy ? "opacity-60" : ""}`}
        >
          <span className="dashboard-classic-file-paper" />
          <span className="dashboard-classic-file-corner" />
          <span className="dashboard-classic-file-accent" />
          <span className={`dashboard-classic-file-dot ${isDone ? "dashboard-classic-file-dot-done" : "dashboard-classic-file-dot-pending"}`}></span>
        </button>
        <div className="dashboard-classic-icon-label">{titleLine}</div>
        {sceneEditMode && selected ? (
          <>
            <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={onRotateHandleMouseDown} aria-label="Повернуть файл">↻</button>
            <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={onResizeHandleMouseDown} aria-label="Изменить размер файла">↘</button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`group relative h-full w-full dashboard-desk-sheet-wrap ${selected ? "dashboard-desk-entity-selected" : ""}`}>
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="dashboard-desk-sheet-delete"
          title="Удалить проект"
          aria-label="Удалить проект"
        >
          ✕
        </button>
      ) : null}
      <button
        type="button"
        draggable={!sceneEditMode && !busy}
        disabled={busy}
        onMouseDownCapture={() => { onSelect?.(); }}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/project-id", project.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onMouseDown={(e) => { if (sceneEditMode) onDragMoveStart?.(e); }}
        onClick={() => {
          onSelect?.();
          if (!sceneEditMode) onOpen();
        }}
        className={`dashboard-desk-sheet dashboard-desk-sheet-plain ${compact ? "dashboard-desk-sheet-compact" : ""} ${busy ? "opacity-60" : ""}`}
      >
        <span className="dashboard-desk-sheet-clip" aria-hidden="true" />
        <span className="dashboard-desk-sheet-kicker">Лист проекта</span>
        <span className="dashboard-desk-sheet-title">{titleLine}</span>
        <span className="dashboard-desk-sheet-row"><span>Имя</span><strong>{displayName}</strong></span>
        <span className="dashboard-desk-sheet-row"><span>Цель</span><strong>{goal?.shortTitle || project.goal}</strong></span>
        <span className="dashboard-desk-sheet-row"><span>Роль</span><strong>{roleLine}</strong></span>
        <span className="dashboard-desk-sheet-row"><span>Оценка</span><strong>{assessmentLine}</strong></span>
        <span className="dashboard-desk-sheet-footer">
          <span>{completed}/{total || 0} тестов</span>
          <span>{new Date(project.created_at).toLocaleDateString("ru-RU")}</span>
        </span>
        <span className={`dashboard-desk-sheet-stamp ${isDone ? "dashboard-desk-sheet-stamp-done" : "dashboard-desk-sheet-stamp-pending"}`}>{isDone ? "ЗАВЕРШЕНО" : "НЕ ЗАВЕРШЕНО"}</span>
      </button>
      {sceneEditMode && selected ? (
        <>
          <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={onRotateHandleMouseDown} aria-label="Повернуть лист">↻</button>
          <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={onResizeHandleMouseDown} aria-label="Изменить размер листа">↘</button>
        </>
      ) : null}
    </div>
  );
}

type SceneImagePreviewModalProps = {
  src: string;
  title: string;
  onClose: () => void;
};

function SceneImagePreviewModal({ src, title, onClose }: SceneImagePreviewModalProps) {
  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="relative w-full max-w-[980px]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="absolute right-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/92 text-lg text-slate-700 shadow-lg hover:text-slate-950"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ✕
        </button>
        <div className="overflow-hidden rounded-[28px] border border-[#d8ccb7] bg-[#f7f3eb] p-4 shadow-[0_32px_70px_-32px_rgba(31,22,11,0.4)]">
          <div className="mb-3 text-center text-sm font-semibold uppercase tracking-[0.24em] text-[#7b5b3b]">{title}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={title}
            draggable={false}
            className="mx-auto max-h-[78vh] w-auto max-w-full rounded-[20px] object-contain shadow-[0_18px_36px_-24px_rgba(31,22,11,0.45)]"
          />
        </div>
      </div>
    </div>
  );
}

type ProjectSheetPreviewModalProps = {
  project: ProjectRow;
  onClose: () => void;
  onOpenFull: () => void;
};

function ProjectSheetPreviewModal({ project, onClose, onOpenFull }: ProjectSheetPreviewModalProps) {
  const displayName = project.person?.full_name || project.title || "Проект";
  const goal = getGoalDefinition(project.goal);
  const total = project.tests?.length || 0;
  const completed = Math.min(project.attempts_count || 0, total || 0);
  const isDone = total > 0 && completed >= total;
  const assessmentLine = isDone ? "Общая оценка сформирована" : completed > 0 ? "Общая оценка в процессе" : "Общая оценка ещё не собрана";
  const roleLine = project.target_role || project.person?.current_position || "Не указана";
  const totalEstimatedMinutes = getTotalEstimatedMinutes((project.tests || []).map((test) => test.test_slug));

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="dashboard-project-preview-wrap relative w-full max-w-[920px]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="absolute right-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/92 text-lg text-slate-700 shadow-lg hover:text-slate-950"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ✕
        </button>

        <div className="dashboard-project-preview-board">
          <div className="dashboard-project-preview-clip" aria-hidden="true" />
          <div className="dashboard-project-preview-clip-inner" aria-hidden="true" />

          <div className="dashboard-project-preview-sheet">
            <div className="dashboard-project-preview-topline">
              <div>
                <div className="dashboard-project-preview-kicker">Лист проекта оценки</div>
                <div className="dashboard-project-preview-title">{project.title || displayName}</div>
              </div>
              <div className={`dashboard-project-preview-stamp ${isDone ? "dashboard-project-preview-stamp-ready" : "dashboard-project-preview-stamp-progress"}`}>
                {assessmentLine}
              </div>
            </div>

            <div className="dashboard-project-preview-columns">
              <div className="dashboard-project-preview-section">
                <div className="dashboard-project-preview-section-title">Карточка участника</div>
                <div className="dashboard-project-preview-table">
                  <div><span>Имя и фамилия</span><strong>{displayName}</strong></div>
                  <div><span>Email</span><strong>{project.person?.email || "Не указан"}</strong></div>
                  <div><span>Текущая должность</span><strong>{project.person?.current_position || "Не указана"}</strong></div>
                  <div><span>Целевая роль</span><strong>{roleLine}</strong></div>
                  <div><span>Цель оценки</span><strong>{goal?.title || goal?.shortTitle || project.goal}</strong></div>
                  <div><span>Создан</span><strong>{new Date(project.created_at).toLocaleString("ru-RU")}</strong></div>
                </div>
              </div>

              <div className="dashboard-project-preview-section">
                <div className="dashboard-project-preview-section-title">Сводка по проекту</div>
                <div className="dashboard-project-preview-table">
                  <div><span>Статус</span><strong>{assessmentLine}</strong></div>
                  <div><span>Тестов в наборе</span><strong>{total}</strong></div>
                  <div><span>Общее время</span><strong>{formatEstimatedMinutes(totalEstimatedMinutes)}</strong></div>
                  <div><span>Завершено попыток</span><strong>{completed}</strong></div>
                  <div><span>Пакет</span><strong>{project.package_mode || "standard"}</strong></div>
                </div>

                <div className="dashboard-project-preview-tests">
                  <div className="dashboard-project-preview-section-title">Инструменты в проекте</div>
                  {project.tests?.length ? (
                    <ul>
                      {project.tests
                        .slice()
                        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                        .map((test) => (
                          <li key={`${project.id}-${test.test_slug}`}>
                            {(test.test_title || test.test_slug)}
                            {(() => {
                              const minutes = getTestEstimatedMinutes(test.test_slug);
                              return minutes ? ` (${formatEstimatedMinutes(minutes)})` : "";
                            })()}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-slate-500">Тесты пока не добавлены.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="dashboard-project-preview-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Закрыть лист</button>
              <button type="button" className="btn btn-primary" onClick={onOpenFull}>Открыть проект полностью</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type FolderModalProps = {
  folder: FolderRow;
  projects: ProjectRow[];
  busy?: boolean;
  onClose: () => void;
  onManage: () => void;
  onOpenProject: (id: string) => void;
  onMoveToDesktop: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
};

function FolderModal({ folder, projects, busy, onClose, onManage, onOpenProject, onMoveToDesktop, onDeleteProject }: FolderModalProps) {
  const [draggingInnerProjectId, setDraggingInnerProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const icon = getFolderIcon(folder.icon_key);
  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((project) => {
      const haystack = [
        project.title,
        project.target_role,
        project.person?.full_name,
        project.person?.email,
        project.person?.current_position,
        getGoalDefinition(project.goal)?.title,
        getGoalDefinition(project.goal)?.shortTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [projects, query]);

  return (
    <div
      className={`fixed inset-0 z-[9000] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm ${draggingInnerProjectId ? "ring-4 ring-emerald-300/50" : ""}`}
      onClick={onClose}
      onDragOver={(e) => {
        if (draggingInnerProjectId) e.preventDefault();
      }}
      onDrop={(e) => {
        const draggedId = e.dataTransfer.getData("text/project-id") || draggingInnerProjectId;
        if (!draggedId) return;
        e.preventDefault();
        e.stopPropagation();
        setDraggingInnerProjectId(null);
        onMoveToDesktop(draggedId);
      }}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-[#b68b58] bg-[#f8f0e3] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br text-3xl shadow-sm ${icon.tileClass}`}>{icon.symbol}</div>
            <div>
              <div className="text-sm text-slate-500">Папка</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
              <div className="mt-1 text-sm text-slate-500">
                {projects.length} {projects.length === 1 ? "проект" : projects.length < 5 ? "проекта" : "проектов"} внутри. Открой проект или перетащи его за пределы окна папки, чтобы вернуть на рабочий стол.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onManage} className="btn btn-secondary btn-sm">Управление</button>
            <button type="button" onClick={onClose} className="btn btn-primary btn-sm">Закрыть</button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900">
          Рабочий стол снаружи этого окна. Потяни иконку проекта на затемнённый фон, и она вернётся из папки обратно на стол.
        </div>

        <div className="mt-4">
          <input
            className="input w-full"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти проект в папке"
          />
        </div>

        <div className={`mt-4 min-h-0 flex-1 overflow-auto rounded-[28px] border border-emerald-100 bg-white p-4 ${busy ? "opacity-70" : ""}`}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            {visibleProjects.length ? (
              visibleProjects.map((project) => (
                <div key={project.id} className="min-h-[260px] min-w-0">
                  <ProjectDesktopIcon
                    project={project}
                    compact
                    busy={busy}
                    onOpen={() => onOpenProject(project.id)}
                    onDragStart={() => setDraggingInnerProjectId(project.id)}
                    onDragEnd={() => setDraggingInnerProjectId(null)}
                    onDelete={onDeleteProject ? () => onDeleteProject(project.id) : undefined}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
                {projects.length ? "По этому запросу проектов не найдено." : "Папка пока пустая. Перетащи на неё проекты с рабочего стола."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type FolderActionDialogProps = {
  folder: FolderRow;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onChooseIcon: () => void;
};

function FolderActionDialog({ folder, onClose, onRename, onDelete, onChooseIcon }: FolderActionDialogProps) {
  return (
    <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm text-slate-500">Управление папкой</div>
        <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
        <div className="mt-4 grid gap-2">
          <button type="button" className="btn btn-secondary justify-start" onClick={onRename}>Переименовать</button>
          <button type="button" className="btn btn-secondary justify-start" onClick={onChooseIcon}>Сменить иконку</button>
          <button type="button" className="btn btn-secondary justify-start text-red-600 hover:text-red-700" onClick={onDelete}>Удалить папку</button>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

type FolderRenameDialogProps = {
  folder: FolderRow;
  value: string;
  busy?: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

function FolderRenameDialog({ folder, value, busy, onChange, onClose, onSave }: FolderRenameDialogProps) {
  return (
    <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm text-slate-500">Переименование папки</div>
        <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700">Новое название</label>
          <input
            className="input mt-2 w-full"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Введите название папки"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (value.trim() && !busy) onSave();
              }
            }}
            autoFocus
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={busy || !value.trim()}>{busy ? "Сохраняем…" : "Сохранить"}</button>
        </div>
      </div>
    </div>
  );
}

type FolderDeleteDialogProps = {
  folder: FolderRow;
  busy?: boolean;
  onClose: () => void;
  onDelete: () => void;
};

function FolderDeleteDialog({ folder, busy, onClose, onDelete }: FolderDeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[28px] border border-rose-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm text-slate-500">Удаление папки</div>
        <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
        <div className="mt-4 text-sm leading-6 text-slate-600">Проекты из папки вернутся на рабочий стол. Сама папка будет удалена.</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-primary btn-sm bg-rose-600 hover:bg-rose-700 border-rose-600" onClick={onDelete} disabled={busy}>{busy ? "Удаляем…" : "Удалить"}</button>
        </div>
      </div>
    </div>
  );
}

type FolderIconPickerProps = {
  folder: FolderRow;
  busy?: boolean;
  onClose: () => void;
  onSelect: (iconKey: FolderIconKey) => void;
};

function FolderIconPicker({ folder, busy, onClose, onSelect }: FolderIconPickerProps) {
  const active = getFolderIcon(folder.icon_key);
  return (
    <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">Иконка папки</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
            <div className="mt-1 text-sm text-slate-500">Выбери минимальную иконку — папка на рабочем столе полностью сменится на неё.</div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Закрыть</button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br text-2xl shadow-sm ${active.tileClass}`}>{active.symbol}</div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Сейчас: {active.label}</div>
            <div className="text-xs text-slate-500">Иконка влияет только на вид папки на рабочем столе.</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FOLDER_ICONS.map((icon) => {
            const selected = active.key === icon.key;
            return (
              <button
                key={icon.key}
                type="button"
                onClick={() => onSelect(icon.key)}
                disabled={busy}
                className={`rounded-[22px] border p-3 text-left transition ${selected ? `border-transparent ring-2 ${icon.ringClass}` : "border-emerald-100 hover:border-emerald-200"} ${busy ? "opacity-70" : ""}`}
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br text-2xl shadow-sm ${icon.tileClass}`}>{icon.symbol}</div>
                <div className="mt-3 text-sm font-medium text-slate-900">{icon.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type TrashRestoreModalProps = {
  entries: TrashEntry[];
  folders: FolderRow[];
  projects: ProjectRow[];
  onClose: () => void;
  onRestore: (entry: TrashEntry) => void;
  onDeleteNow: (entry: TrashEntry) => void;
};

function TrashRestoreModal({ entries, onClose, onRestore, onDeleteNow }: TrashRestoreModalProps) {
  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-full max-w-[760px] rounded-[28px] border border-[#dac4a7] bg-[#fffaf2] p-5 shadow-[0_30px_70px_-44px_rgba(53,34,17,0.38)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[#5a3b20]">Корзина</div>
            <div className="text-sm text-[#84664a]">Папки и проекты можно восстановить в течение 3 суток.</div>
          </div>
          <button type="button" className="rounded-full border border-[#d9c6ab] bg-white px-4 py-2 text-sm text-[#5a3b20]" onClick={onClose}>Закрыть</button>
        </div>
        <div className="space-y-3">
          {entries.length ? entries.map((entry) => {
            const remaining = Math.max(0, entry.expiresAt - Date.now());
            const hours = Math.ceil(remaining / (60 * 60 * 1000));
            return (
              <div key={`${entry.kind}:${entry.id}`} className="rounded-[20px] border border-[#e3d0b2] bg-white/92 p-4 shadow-[0_12px_26px_-22px_rgba(53,34,17,0.28)] dashboard-trash-item-crumpled">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-[#a2835d]">{entry.kind === 'folder' ? 'Папка' : 'Проект'}</div>
                    <div className="mt-1 text-base font-semibold text-[#51361e]">{entry.title}</div>
                    <div className="mt-1 text-sm text-[#7b5f44]">Удалится через ~{hours} ч.</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="rounded-full border border-[#cfe1d0] bg-[#eaf7ea] px-4 py-2 text-sm font-medium text-[#335a36]" onClick={() => onRestore(entry)}>Восстановить</button>
                    <button type="button" className="rounded-full border border-[#e6c5c5] bg-[#fff2f2] px-4 py-2 text-sm font-medium text-[#8a3f3f]" onClick={() => onDeleteNow(entry)}>Удалить сейчас</button>
                  </div>
                </div>
              </div>
            );
          }) : <div className="rounded-[20px] border border-dashed border-[#dbc9ac] bg-white/80 p-8 text-center text-sm text-[#84664a]">Корзина пуста.</div>}
        </div>
      </div>
    </div>
  );
}
