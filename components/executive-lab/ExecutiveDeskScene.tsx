import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import type { ExecutiveLabProject, ExecutiveLabWorkspace } from "../../lib/executiveLab";
import styles from "../../styles/ExecutiveDeskScene.module.css";

const MODEL_ROOT = "/executive-lab/models";
const LAYER_ROOT = "/executive-lab/layers";

type Props = {
  workspace: ExecutiveLabWorkspace;
  onCreateProject: () => void;
};

type PanelName = "projects" | "archive" | "ai" | "insights" | "tests" | "wallet" | "trash" | "project" | null;
type BuilderMode = "translate" | "rotate" | "scale";
type ObjectId = "projects" | "archive" | "organizer" | "trash" | "lamp" | "droid" | "ai";
type ProjectFilter = "all" | "active" | "paused" | "completed";
type ProjectView = "all" | "mine" | "favorites" | "archive";
type ProjectSort = "progress_desc" | "progress_asc" | "title";
type ProjectOwnerFilter = "all" | "owner" | "maria" | "dmitry";
type ProjectDeadlineFilter = "any" | "overdue" | "week" | "month";

type LayoutItem = {
  x: number;
  y: number;
  width: number;
  scale: number;
  rotation: number;
  hidden: boolean;
};

type DeskLayout = Record<ObjectId, LayoutItem>;

const BUILDER_OBJECTS: Array<{ id: ObjectId; label: string }> = [
  { id: "projects", label: "Книга проектов" },
  { id: "archive", label: "Архивный блокнот" },
  { id: "organizer", label: "Информационное табло" },
  { id: "trash", label: "Корзина" },
  { id: "lamp", label: "Настольная лампа" },
  { id: "droid", label: "AI-дроид" },
  { id: "ai", label: "Экран аналитика" },
];

const DEFAULT_LAYOUT: DeskLayout = {
  trash: { x: 15, y: 35, width: 19, scale: 1, rotation: -1.5, hidden: false },
  archive: { x: 15.5, y: 70, width: 27, scale: 1, rotation: -1.2, hidden: false },
  lamp: { x: 9, y: 26, width: 18, scale: 1, rotation: 0, hidden: false },
  projects: { x: 49, y: 59, width: 32, scale: 1, rotation: 0, hidden: false },
  droid: { x: 70.5, y: 31, width: 10.5, scale: 1, rotation: 0, hidden: false },
  ai: { x: 87, y: 30, width: 15.5, scale: 1, rotation: -1.2, hidden: false },
  organizer: { x: 82, y: 70, width: 28, scale: 1, rotation: 0.6, hidden: false },
};

function cloneDefaultLayout(): DeskLayout {
  return Object.fromEntries(
    Object.entries(DEFAULT_LAYOUT).map(([id, item]) => [id, { ...item }]),
  ) as DeskLayout;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatBalance(kopeks: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(kopeks / 100);
}

const PROJECT_MONTHS: Record<string, number> = {
  янв: 0,
  февр: 1,
  мар: 2,
  апр: 3,
  мая: 4,
  июн: 5,
  июл: 6,
  авг: 7,
  сент: 8,
  окт: 9,
  нояб: 10,
  дек: 11,
};

function projectOwnerKey(index: number): Exclude<ProjectOwnerFilter, "all"> {
  if (index % 3 === 0) return "owner";
  if (index % 3 === 1) return "maria";
  return "dmitry";
}

function parseProjectDate(value: string) {
  const match = value.toLocaleLowerCase("ru-RU").match(/(\d{1,2})\s+([а-яё.]+)\s+(\d{4})/u);
  if (!match) return null;
  const monthToken = match[2].replaceAll(".", "");
  const monthKey = Object.keys(PROJECT_MONTHS).find((key) => monthToken.startsWith(key));
  if (!monthKey) return null;
  return new Date(Number(match[3]), PROJECT_MONTHS[monthKey], Number(match[1]), 23, 59, 59);
}

type ModelViewportProps = {
  file: string;
  kind: "lamp" | "droid";
  lampOn?: boolean;
  onLoaded: (kind: "lamp" | "droid") => void;
};

function ModelViewport({ file, kind, lampOn = true, onLoaded }: ModelViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lampOnRef = useRef(lampOn);
  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    lampOnRef.current = lampOn;
  }, [lampOn]);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sceneCanvas: HTMLCanvasElement = canvas;

    let disposed = false;
    let frame = 0;
    let cleanup = () => {};

    async function start() {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(kind === "lamp" ? 24 : 30, 1, 0.1, 50);
      camera.position.set(0, kind === "lamp" ? 2.4 : 1.7, kind === "lamp" ? 12 : 6.8);
      camera.lookAt(0, kind === "lamp" ? 2.1 : 1.3, 0);

      const renderer = new THREE.WebGLRenderer({
        canvas: sceneCanvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;

      scene.add(new THREE.HemisphereLight(0xe9ded0, 0x130b08, 1.9));
      const warm = new THREE.DirectionalLight(0xffc174, 5.2);
      warm.position.set(-4, 7, 5);
      scene.add(warm);
      const rim = new THREE.DirectionalLight(0x9ccfee, 2.1);
      rim.position.set(5, 4, -3);
      scene.add(rim);
      const lampLight = new THREE.PointLight(0xff9c3d, lampOnRef.current ? 34 : 0, 8, 2);
      lampLight.position.set(-0.6, 2.9, 1.6);
      scene.add(lampLight);

      const gltf = await new GLTFLoader().loadAsync(`${MODEL_ROOT}/${file}`);
      if (disposed) return;
      const model = gltf.scene;
      model.traverse((child) => {
        const mesh = child as import("three").Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          material.side = THREE.FrontSide;
        });
      });

      const originalBox = new THREE.Box3().setFromObject(model);
      const originalSize = originalBox.getSize(new THREE.Vector3());
      const targetSize = kind === "lamp" ? 4.5 : 3.5;
      model.scale.setScalar(targetSize / Math.max(originalSize.x, originalSize.y, originalSize.z, 0.001));
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -box.min.y, -center.z);
      model.rotation.y = kind === "lamp" ? 0.42 : -0.26;
      scene.add(model);
      onLoadedRef.current(kind);

      function resize() {
        const width = Math.max(sceneCanvas.clientWidth, 1);
        const height = Math.max(sceneCanvas.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }

      const observer = new ResizeObserver(resize);
      observer.observe(sceneCanvas);
      resize();
      const started = performance.now();

      function render() {
        const elapsed = (performance.now() - started) / 1000;
        if (kind === "droid") {
          model.position.y = Math.sin(elapsed * 1.55) * 0.045;
          model.rotation.y = -0.26 + Math.sin(elapsed * 0.62) * 0.06;
        }
        lampLight.intensity += ((lampOnRef.current ? 34 : 0) - lampLight.intensity) * 0.08;
        renderer.render(scene, camera);
        frame = requestAnimationFrame(render);
      }
      render();

      cleanup = () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        renderer.dispose();
        scene.traverse((object) => {
          const mesh = object as import("three").Mesh;
          mesh.geometry?.dispose?.();
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => material?.dispose?.());
        });
      };
    }

    void start().catch(() => {
      onLoadedRef.current(kind);
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [file, kind]);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}

export default function ExecutiveDeskScene({ workspace, onCreateProject }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    id: ObjectId;
    startX: number;
    startY: number;
    initial: LayoutItem;
  } | null>(null);
  const [loadedModels, setLoadedModels] = useState<Array<"lamp" | "droid">>([]);
  const [panel, setPanel] = useState<PanelName>(null);
  const [selectedProject, setSelectedProject] = useState(0);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [projectView, setProjectView] = useState<ProjectView>("all");
  const [projectSort, setProjectSort] = useState<ProjectSort>("progress_desc");
  const [projectOwnerFilter, setProjectOwnerFilter] = useState<ProjectOwnerFilter>("all");
  const [projectDeadlineFilter, setProjectDeadlineFilter] = useState<ProjectDeadlineFilter>("any");
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<string[]>([]);
  const [projectPage, setProjectPage] = useState(0);
  const [projectSearch, setProjectSearch] = useState("");
  const [archivePage, setArchivePage] = useState(0);
  const [assignedTests, setAssignedTests] = useState<string[]>(["16PF-A", "Эмоциональный интеллект"]);
  const [restoredProjectIds, setRestoredProjectIds] = useState<string[]>([]);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [lampOn, setLampOn] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState<BuilderMode>("translate");
  const [selectedObjectId, setSelectedObjectId] = useState<ObjectId>("projects");
  const [layout, setLayout] = useState<DeskLayout>(cloneDefaultLayout);
  const [toast, setToast] = useState("Кабинет подключён к отдельной тестовой базе");
  const layoutStorageKey = `executive-lab-${workspace.id}-desk-layout-v4`;

  const activeProjects = workspace.projects.filter((project) => project.disposition === "active");
  const archivedProjects = workspace.projects.filter((project) => project.disposition === "archived");
  const trashProjects = workspace.projects.filter(
    (item) => item.disposition === "trash" && !restoredProjectIds.includes(item.id),
  );
  const project = workspace.projects[selectedProject] ?? workspace.projects[0];
  const loadProgress = Math.round((loadedModels.length / 2) * 100);
  const visibleProjects = workspace.projects.filter((item, index) => {
    const normalizedStatus = item.status.toLocaleLowerCase("ru-RU");
    const ownerKey = projectOwnerKey(index);
    const matchesSearch = `${item.title} ${item.folderTitle}`
      .toLocaleLowerCase("ru-RU")
      .includes(projectSearch.trim().toLocaleLowerCase("ru-RU"));
    if (!matchesSearch) return false;
    if (projectView === "mine" && ownerKey !== "owner") return false;
    if (projectView === "favorites" && !favoriteProjectIds.includes(item.id)) return false;
    if (projectView === "archive" && item.disposition !== "archived") return false;
    if (projectView !== "archive" && item.disposition === "trash") return false;
    if (projectOwnerFilter !== "all" && ownerKey !== projectOwnerFilter) return false;
    if (projectDeadlineFilter !== "any") {
      const deadline = parseProjectDate(item.date);
      if (!deadline) return false;
      const days = Math.ceil((deadline.getTime() - Date.now()) / 86_400_000);
      if (projectDeadlineFilter === "overdue" && days >= 0) return false;
      if (projectDeadlineFilter === "week" && (days < 0 || days > 7)) return false;
      if (projectDeadlineFilter === "month" && (days < 0 || days > 30)) return false;
    }
    if (projectFilter === "active") return item.disposition === "active" && !normalizedStatus.includes("пауз");
    if (projectFilter === "paused") return normalizedStatus.includes("пауз");
    if (projectFilter === "completed") {
      return item.disposition === "archived" || normalizedStatus.includes("заверш");
    }
    return true;
  }).sort((left, right) => {
    if (projectSort === "progress_asc") return left.progress - right.progress;
    if (projectSort === "title") return left.title.localeCompare(right.title, "ru");
    return right.progress - left.progress;
  });
  const projectPageCount = Math.max(1, Math.ceil(visibleProjects.length / 5));
  const paginatedProjects = visibleProjects.slice(projectPage * 5, projectPage * 5 + 5);
  const averageProgress = activeProjects.length
    ? Math.round(activeProjects.reduce((total, item) => total + item.progress, 0) / activeProjects.length)
    : 0;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(layoutStorageKey);
      if (saved) setLayout({ ...cloneDefaultLayout(), ...(JSON.parse(saved) as Partial<DeskLayout>) });
    } catch {
      window.localStorage.removeItem(layoutStorageKey);
    }
  }, [layoutStorageKey]);

  useEffect(() => {
    setProjectPage((current) => Math.min(current, projectPageCount - 1));
  }, [projectPageCount]);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      const stage = stageRef.current;
      if (!drag || !stage) return;
      const rect = stage.getBoundingClientRect();
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      setLayout((current) => {
        const next = { ...current, [drag.id]: { ...current[drag.id] } };
        if (builderMode === "translate") {
          next[drag.id].x = clamp(drag.initial.x + (dx / rect.width) * 100, 3, 97);
          next[drag.id].y = clamp(drag.initial.y + (dy / rect.height) * 100, 10, 94);
        } else if (builderMode === "rotate") {
          next[drag.id].rotation = drag.initial.rotation + dx * 0.18;
        } else {
          next[drag.id].scale = clamp(drag.initial.scale + dx / 260, 0.45, 1.8);
        }
        return next;
      });
    }

    function onPointerUp() {
      dragRef.current = null;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [builderMode]);

  function markModelLoaded(kind: "lamp" | "droid") {
    setLoadedModels((current) => (current.includes(kind) ? current : [...current, kind]));
  }

  function activate(id: ObjectId) {
    if (builderOpen) return;
    if (id === "projects") {
      setPanel("projects");
      setToast("Книга проектов раскрыта");
    } else if (id === "organizer") {
      setPanel("insights");
      setToast("Информационное табло раскрыто");
    } else if (id === "archive") {
      setPanel("archive");
      setToast("Архивный блокнот открыт");
    } else if (id === "ai" || id === "droid") {
      setPanel("ai");
      setToast("AI-аналитик готов к диалогу");
    } else if (id === "lamp") {
      setLampOn((value) => {
        setToast(value ? "Рабочая лампа выключена" : "Рабочая лампа включена");
        return !value;
      });
    } else {
      setPanel("trash");
      setToast(trashProjects.length ? "Корзина открыта" : "Корзина пуста");
    }
  }

  function beginTransform(event: React.PointerEvent, id: ObjectId) {
    if (!builderOpen || layout[id].hidden) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedObjectId(id);
    dragRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      initial: { ...layout[id] },
    };
  }

  function objectStyle(id: ObjectId) {
    const item = layout[id];
    return {
      left: `${item.x}%`,
      top: `${item.y}%`,
      width: `${item.width}%`,
      opacity: item.hidden ? 0 : 1,
      pointerEvents: item.hidden ? "none" as const : "auto" as const,
      transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`,
    };
  }

  function objectClass(id: ObjectId, extra = "") {
    return [
      styles.deskObject,
      extra,
      builderOpen ? styles.builderObject : "",
      builderOpen && selectedObjectId === id ? styles.selectedDeskObject : "",
      panel === "projects" && id === "projects" ? styles.projectsOpening : "",
    ].filter(Boolean).join(" ");
  }

  function toggleBuilder() {
    setBuilderOpen((current) => {
      const next = !current;
      if (next) {
        setPanel(null);
        setToast("Конструктор включён: двигайте предмет прямо по столу");
      } else {
        setToast("Расположение предметов готово");
      }
      return next;
    });
  }

  function toggleVisibility(id: ObjectId) {
    setLayout((current) => ({
      ...current,
      [id]: { ...current[id], hidden: !current[id].hidden },
    }));
  }

  function saveBuilderLayout() {
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(layout));
    setToast("Расположение сохранено в этом браузере");
  }

  function resetBuilderLayout() {
    window.localStorage.removeItem(layoutStorageKey);
    setLayout(cloneDefaultLayout());
    setSelectedObjectId("projects");
    setToast("Восстановлена исходная композиция");
  }

  function closeProjects() {
    setPanel(null);
    setToast("Книга проектов закрыта");
  }

  function toggleTest(test: string) {
    setAssignedTests((current) => (
      current.includes(test) ? current.filter((item) => item !== test) : [...current, test]
    ));
  }

  function restoreProject(item: ExecutiveLabProject) {
    setRestoredProjectIds((current) => [...new Set([...current, item.id])]);
    setToast(`Проект «${item.title}» восстановлен`);
  }

  function askAi(event: React.FormEvent) {
    event.preventDefault();
    const question = aiQuestion.trim();
    if (!question) return;
    const weakest = [...activeProjects].sort((left, right) => left.progress - right.progress)[0];
    setAiAnswer(
      weakest
        ? `В портфеле ${activeProjects.length} активных проекта, средний прогресс ${averageProgress}%. В первую очередь проверьте «${weakest.title}»: его готовность ${weakest.progress}%. Затем сформируйте сводку по участникам и незавершённым оценкам.`
        : "Сначала создайте активный проект. После этого аналитик сможет сравнить прогресс и предложить следующий шаг.",
    );
    setAiQuestion("");
  }

  const selectedBuilderObject = BUILDER_OBJECTS.find((item) => item.id === selectedObjectId);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <strong>EX</strong>
          <span>EXECUTIVE<br />SPACE</span>
        </div>
        <div className={styles.overview}>
          <span>GENERAL OVERVIEW</span>
          <i />
        </div>
        <div className={styles.profile}>
          <b>{workspace.ownerName}</b>
          <small>{workspace.ownerRole}</small>
        </div>
      </header>

      <section ref={stageRef} className={`${styles.stage} ${panel ? styles.panelFocus : ""}`}>
        <Image
          className={styles.deskBackground}
          src={`${LAYER_ROOT}/desk-background.webp`}
          alt=""
          fill
          priority
          sizes="100vw"
          unoptimized
          draggable={false}
        />
        <div className={styles.ambientLight} aria-hidden="true" />

        <button
          className={objectClass("trash", styles.trashObject)}
          style={objectStyle("trash")}
          onClick={() => activate("trash")}
          onPointerDown={(event) => beginTransform(event, "trash")}
        >
          <Image src={`${LAYER_ROOT}/trash-tray.webp`} alt="" fill sizes="28vw" unoptimized draggable={false} />
          <span className={styles.trayContent}><b>Корзина</b><small>3 документа</small></span>
        </button>

        <button
          className={objectClass("archive", styles.archiveObject)}
          style={objectStyle("archive")}
          onClick={() => activate("archive")}
          onPointerDown={(event) => beginTransform(event, "archive")}
        >
          <Image src={`${LAYER_ROOT}/archive-book.webp`} alt="" fill sizes="30vw" unoptimized draggable={false} />
          <span className={styles.archiveCover}><b>Архив</b><strong>156</strong><small>документов</small></span>
        </button>

        <button
          className={objectClass("projects", styles.projectsObject)}
          style={objectStyle("projects")}
          onClick={() => activate("projects")}
          onPointerDown={(event) => beginTransform(event, "projects")}
        >
          <Image src={`${LAYER_ROOT}/projects-closed.webp`} alt="" fill sizes="34vw" unoptimized draggable={false} />
          <span className={styles.projectsCover}>
            <i>▰</i><b>ПРОЕКТЫ</b>
            <small><em /> {activeProjects.length} активных</small>
            <small><em className={styles.pauseDot} /> 4 на паузе</small>
          </span>
        </button>

        <button
          className={objectClass("organizer", styles.organizerObject)}
          style={objectStyle("organizer")}
          onClick={() => activate("organizer")}
          onPointerDown={(event) => beginTransform(event, "organizer")}
        >
          <Image src={`${LAYER_ROOT}/info-board.webp`} alt="" fill sizes="32vw" unoptimized draggable={false} />
          <span className={styles.infoBoardContent}>
            <b>Информационное табло</b>
            <span><small>Прогресс портфеля</small><strong>72%</strong></span>
            <span><small>Бюджет портфеля</small><strong>{formatBalance(workspace.balanceKopeks)}</strong></span>
            <span><small>Командная активность</small><strong>85%</strong></span>
            <em className={styles.boardRule} />
            <span className={styles.boardLine}><small>Проекты без риска</small><strong>{Math.max(activeProjects.length - 1, 0)}</strong></span>
            <span className={styles.boardLine}><small>Ждут решения</small><strong>2</strong></span>
            <span className={styles.boardLine}><small>Новые отчёты</small><strong>4</strong></span>
          </span>
        </button>

        <button
          className={objectClass("ai", styles.aiObject)}
          style={objectStyle("ai")}
          onClick={() => activate("ai")}
          onPointerDown={(event) => beginTransform(event, "ai")}
        >
          <Image src={`${LAYER_ROOT}/ai-console.webp`} alt="" fill sizes="18vw" unoptimized draggable={false} />
          <span className={styles.aiScreenContent}>
            <b>AI-аналитик</b>
            <i />
            <small>Рекомендация на сегодня</small>
            <strong>Проверить проект «{project?.title ?? "Альфа"}»</strong>
            <em>Вероятность успешного завершения: {workspace.aiEfficiency}%</em>
            <span>Подробнее&nbsp;&nbsp;→</span>
          </span>
        </button>

        <button
          className={objectClass("lamp", `${styles.modelObject} ${styles.lampObject} ${lampOn ? styles.lampOn : ""}`)}
          style={objectStyle("lamp")}
          onClick={() => activate("lamp")}
          onPointerDown={(event) => beginTransform(event, "lamp")}
        >
          <span className={styles.lampAura} />
          <span className={styles.modelViewport}>
            <ModelViewport file="desk-lamp.glb" kind="lamp" lampOn={lampOn} onLoaded={markModelLoaded} />
          </span>
        </button>

        <button
          className={objectClass("droid", `${styles.modelObject} ${styles.droidObject}`)}
          style={objectStyle("droid")}
          onClick={() => activate("droid")}
          onPointerDown={(event) => beginTransform(event, "droid")}
        >
          <span className={styles.modelViewport}>
            <ModelViewport file="ai-droid.glb" kind="droid" onLoaded={markModelLoaded} />
          </span>
        </button>

        {loadProgress < 100 ? (
          <div className={styles.loader}>
            <span>СОБИРАЕМ КАБИНЕТ</span>
            <strong>{loadProgress}%</strong>
            <i><b style={{ width: `${loadProgress}%` }} /></i>
          </div>
        ) : null}

        <section className={styles.summary}>
          <span>Сводка за сегодня</span>
          <div>
            <button onClick={() => activate("projects")}><small>Проекты</small><strong>{activeProjects.length}</strong></button>
            <button onClick={() => setPanel("tests")}><small>Тесты</small><strong>{workspace.projects.length * 2 + 18}</strong></button>
            <button onClick={() => setPanel("wallet")}><small>Баланс</small><strong>{formatBalance(workspace.balanceKopeks)}</strong></button>
            <button onClick={() => activate("ai")}><small>AI-аналитик</small><strong>{workspace.aiEfficiency}%</strong></button>
          </div>
        </section>

        <aside className={styles.navigationHint}>
          <span>Навигация по пространству</span>
          <small>Нажимайте на предметы, чтобы открыть раздел</small>
        </aside>

        <nav className={styles.bottomNav}>
          <button className={styles.active}>Обзор</button>
          <button onClick={() => setToast("Календарь подготовлен для следующего этапа")}>Календарь</button>
          <button onClick={() => setToast("Новых уведомлений: 3")}>Уведомления <b>3</b></button>
        </nav>

        <button className={`${styles.settings} ${builderOpen ? styles.settingsActive : ""}`} onClick={toggleBuilder} disabled={loadProgress < 100}>
          {builderOpen ? "Готово" : "Настроить пространство"}
        </button>

        <div className={styles.toast} key={toast}>{toast}</div>

        <aside className={`${styles.builderPanel} ${builderOpen ? styles.builderPanelOpen : ""}`} aria-hidden={!builderOpen}>
          <header>
            <div><span>КОНСТРУКТОР СЦЕНЫ</span><strong>{selectedBuilderObject?.label}</strong></div>
            <button onClick={toggleBuilder} aria-label="Закрыть конструктор">×</button>
          </header>
          <div className={styles.builderModes}>
            {([
              ["translate", "Двигать"],
              ["rotate", "Вращать"],
              ["scale", "Размер"],
            ] as const).map(([mode, label]) => (
              <button key={mode} className={builderMode === mode ? styles.builderModeActive : ""} onClick={() => setBuilderMode(mode)}>{label}</button>
            ))}
          </div>
          <div className={styles.builderObjects}>
            {BUILDER_OBJECTS.map((item) => {
              const hidden = layout[item.id].hidden;
              return (
                <div key={item.id} className={selectedObjectId === item.id ? styles.builderObjectActive : ""}>
                  <button onClick={() => setSelectedObjectId(item.id)} disabled={hidden}><i /><span>{item.label}</span></button>
                  <button className={styles.visibilityButton} onClick={() => toggleVisibility(item.id)}>{hidden ? "○" : "●"}</button>
                </div>
              );
            })}
          </div>
          <p>Режим «Двигать» меняет позицию, «Вращать» поворачивает, «Размер» масштабирует предмет.</p>
          <footer>
            <button onClick={resetBuilderLayout}>Сбросить</button>
            <button className={styles.saveLayoutButton} onClick={saveBuilderLayout}>Сохранить</button>
          </footer>
        </aside>

        {panel === "projects" ? (
          <section className={`${styles.bookPanel} ${styles.panelEnter}`} aria-label="Книга проектов">
            <Image className={styles.openBookVisual} src={`${LAYER_ROOT}/projects-open.webp`} alt="" fill sizes="94vw" unoptimized draggable={false} />
            <button className={styles.close} onClick={closeProjects} aria-label="Закрыть">×</button>
            <aside className={styles.folioFilters}>
              <span>Фильтры</span>
              <section>
                <b>Статус</b>
                {([
                  ["active", "Активный", "green"],
                  ["paused", "На паузе", "amber"],
                  ["completed", "Завершён", "gray"],
                ] as const).map(([filter, label, color]) => (
                  <button
                    key={filter}
                    className={projectFilter === filter ? styles.folioFilterActive : ""}
                    onClick={() => {
                      setProjectFilter(projectFilter === filter ? "all" : filter);
                      setProjectPage(0);
                    }}
                  >
                    <i className={styles[color]} />
                    <em />
                    {label}
                  </button>
                ))}
              </section>
              <section>
                <b>Владелец</b>
                <button className={projectOwnerFilter === "all" ? styles.folioFilterActive : ""} onClick={() => {
                  setProjectOwnerFilter("all");
                  setProjectPage(0);
                }}><em />Все владельцы</button>
                <button className={projectOwnerFilter === "owner" ? styles.folioFilterActive : ""} onClick={() => {
                  setProjectOwnerFilter("owner");
                  setProjectPage(0);
                }}><em />{workspace.ownerName}</button>
                <button className={projectOwnerFilter === "maria" ? styles.folioFilterActive : ""} onClick={() => {
                  setProjectOwnerFilter("maria");
                  setProjectPage(0);
                }}><em />Мария Смирнова</button>
                <button className={projectOwnerFilter === "dmitry" ? styles.folioFilterActive : ""} onClick={() => {
                  setProjectOwnerFilter("dmitry");
                  setProjectPage(0);
                }}><em />Дмитрий Волков</button>
              </section>
              <section>
                <b>Дедлайн</b>
                {([
                  ["any", "Любой период"],
                  ["overdue", "Просроченные"],
                  ["week", "До 7 дней"],
                  ["month", "До 30 дней"],
                ] as const).map(([filter, label]) => (
                  <button key={filter} className={projectDeadlineFilter === filter ? styles.folioFilterActive : ""} onClick={() => {
                    setProjectDeadlineFilter(filter);
                    setProjectPage(0);
                  }}><em />{label}</button>
                ))}
              </section>
              <button className={styles.resetFolioFilters} onClick={() => {
                setProjectFilter("all");
                setProjectView("all");
                setProjectOwnerFilter("all");
                setProjectDeadlineFilter("any");
                setProjectSearch("");
                setProjectPage(0);
              }}>Сбросить фильтры</button>
            </aside>

            <div className={styles.folioScreen}>
              <header>
                <div className={styles.folioTitle}>
                  <i>▰</i>
                  <h2>Проекты</h2>
                  <span><em /> {activeProjects.length} активных</span>
                </div>
                <button className={styles.createFolioProject} onClick={onCreateProject}>+ Создать проект</button>
              </header>
              <div className={styles.folioToolbar}>
                <label>
                  <i>⌕</i>
                  <input
                    value={projectSearch}
                    onChange={(event) => {
                      setProjectSearch(event.target.value);
                      setProjectPage(0);
                    }}
                    placeholder="Поиск проектов..."
                    aria-label="Поиск проектов"
                  />
                </label>
                <button onClick={() => setProjectFilter(projectFilter === "all" ? "active" : "all")}>Фильтры⌄</button>
                <select value={projectSort} onChange={(event) => setProjectSort(event.target.value as ProjectSort)} aria-label="Сортировка проектов">
                  <option value="progress_desc">Прогресс: сначала высокий</option>
                  <option value="progress_asc">Прогресс: сначала низкий</option>
                  <option value="title">По названию</option>
                </select>
              </div>
              <div className={styles.folioTable}>
                <div className={styles.folioColumns}>
                  <span>Проект</span><span>Статус</span><span>Владелец</span><span>Дедлайн</span><span>Прогресс</span>
                </div>
                <div className={styles.folioRows}>
                  {paginatedProjects.map((item) => {
                    const index = workspace.projects.findIndex((projectItem) => projectItem.id === item.id);
                    const owner = index % 3 === 0 ? workspace.ownerName : index % 3 === 1 ? "Мария Смирнова" : "Дмитрий Волков";
                    const selected = index === selectedProject;
                    return (
                      <button
                        key={item.id}
                        className={selected ? styles.selectedFolioProject : ""}
                        onClick={() => setSelectedProject(index)}
                        onDoubleClick={() => setPanel("project")}
                      >
                        <span><strong>{item.title}</strong><small>{item.folderTitle} · {item.participants} участников</small></span>
                        <span><i className={item.disposition === "archived" ? styles.gray : item.status.toLocaleLowerCase("ru-RU").includes("пауз") ? styles.amber : styles.green} />{item.status}</span>
                        <span><em>{owner.slice(0, 1)}</em>{owner}</span>
                        <span>{item.date}</span>
                        <span><strong>{item.progress}%</strong><i><b style={{ width: `${item.progress}%` }} /></i><small>›</small></span>
                      </button>
                    );
                  })}
                  {paginatedProjects.length === 0 ? <p className={styles.emptyProjects}>Проекты по заданным условиям не найдены.</p> : null}
                </div>
              </div>
              <footer className={styles.folioPagination}>
                <span>Показано {paginatedProjects.length ? projectPage * 5 + 1 : 0}–{Math.min((projectPage + 1) * 5, visibleProjects.length)} из {visibleProjects.length}</span>
                <div>
                  <button onClick={() => setProjectPage((page) => Math.max(0, page - 1))}>‹</button>
                  {Array.from({ length: projectPageCount }, (_, index) => (
                    <button key={index} className={projectPage === index ? styles.activeFolioPage : ""} onClick={() => setProjectPage(index)}>{index + 1}</button>
                  ))}
                  <button onClick={() => setProjectPage((page) => Math.min(projectPageCount - 1, page + 1))}>›</button>
                </div>
              </footer>
            </div>

            <nav className={styles.folioTabs}>
              {([
                ["all", "Все проекты"],
                ["mine", "Мои проекты"],
                ["favorites", "Избранное"],
                ["archive", "Архив"],
              ] as const).map(([view, label]) => (
                <button key={view} className={projectView === view ? styles.activeFolioTab : ""} onClick={() => {
                  setProjectView(view);
                  setProjectOwnerFilter(view === "mine" ? "owner" : "all");
                  setProjectFilter("all");
                  setProjectPage(0);
                }}>{label}</button>
              ))}
            </nav>

            <footer className={styles.folioActions}>
              <button className={styles.openFolioProject} onClick={() => setPanel("project")}>Открыть</button>
              <button onClick={() => setPanel("project")}>Подробнее</button>
              <button onClick={() => {
                if (!project) return;
                setFavoriteProjectIds((current) => current.includes(project.id) ? current.filter((id) => id !== project.id) : [...current, project.id]);
                setToast(favoriteProjectIds.includes(project.id) ? "Проект удалён из избранного" : "Проект добавлен в избранное");
              }}>•••</button>
            </footer>
          </section>
        ) : null}

        {panel === "archive" ? (
          <section className={`${styles.archivePanel} ${styles.panelEnter}`}>
            <button className={styles.close} onClick={() => setPanel(null)} aria-label="Закрыть">×</button>
            <span>АРХИВНЫЙ РЕЕСТР</span>
            <h2>{archivePage === 0 ? "Завершённые проекты" : "Документы и отчёты"}</h2>
            <div className={styles.archiveList}>
              {(archivedProjects.length ? archivedProjects : workspace.projects.slice(0, 3)).map((item) => (
                <article key={item.id}><strong>{item.title}</strong><small>{item.date} · {item.participants} участников</small></article>
              ))}
            </div>
            <footer>
              <button onClick={() => setArchivePage((value) => Math.max(0, value - 1))}>←</button>
              <span>Страница {archivePage + 1} из 2</span>
              <button onClick={() => setArchivePage((value) => Math.min(1, value + 1))}>→</button>
            </footer>
          </section>
        ) : null}

        {panel === "ai" ? (
          <section className={`${styles.aiPanel} ${styles.panelEnter}`}>
            <button className={styles.close} onClick={() => setPanel(null)} aria-label="Закрыть">×</button>
            <span>AI-АНАЛИТИК · В СЕТИ</span>
            <h2>Рекомендация на сегодня</h2>
            <p>{aiAnswer || (project ? `Проект «${project.title}» выполнен на ${project.progress}%. Следующий приоритет: проверить незавершённые оценки и подготовить краткую управленческую сводку.` : "Создайте первый проект, чтобы получить рекомендации.")}</p>
            <div>
              <article><small>Эффективность</small><strong>{workspace.aiEfficiency}%</strong></article>
              <article><small>Активных проектов</small><strong>{activeProjects.length}</strong></article>
            </div>
            <form className={styles.aiAsk} onSubmit={askAi}>
              <input value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} placeholder="Спросить о портфеле проектов" />
              <button className={styles.aiAction} type="submit">Получить рекомендацию</button>
            </form>
          </section>
        ) : null}

        {panel === "insights" ? (
          <section className={`${styles.workspacePanel} ${styles.insightsPanel} ${styles.panelEnter}`}>
            <button className={styles.close} onClick={() => setPanel(null)} aria-label="Закрыть">×</button>
            <header>
              <span>ЦЕНТР ПОКАЗАТЕЛЕЙ</span>
              <h2>Состояние портфеля</h2>
              <p>Данные рассчитаны по проектам отдельного Executive Lab.</p>
            </header>
            <div className={styles.insightMetrics}>
              <article><small>Средний прогресс</small><strong>{averageProgress}%</strong><i><b style={{ width: `${averageProgress}%` }} /></i></article>
              <article><small>Участников</small><strong>{workspace.projects.reduce((total, item) => total + item.participants, 0)}</strong><em>во всех проектах</em></article>
              <article><small>Нуждаются во внимании</small><strong>{activeProjects.filter((item) => item.progress < 50).length}</strong><em>прогресс ниже 50%</em></article>
            </div>
            <div className={styles.portfolioRows}>
              {activeProjects.map((item) => (
                <button key={item.id} onClick={() => {
                  setSelectedProject(workspace.projects.findIndex((projectItem) => projectItem.id === item.id));
                  setPanel("project");
                }}>
                  <span><strong>{item.title}</strong><small>{item.participants} участников</small></span>
                  <i><b style={{ width: `${item.progress}%` }} /></i>
                  <em>{item.progress}%</em>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {panel === "tests" ? (
          <section className={`${styles.workspacePanel} ${styles.panelEnter}`}>
            <button className={styles.close} onClick={() => setPanel(null)} aria-label="Закрыть">×</button>
            <header>
              <span>КАТАЛОГ МЕТОДИК</span>
              <h2>Тесты</h2>
              <p>Выберите инструменты для нового проекта. Настройка сохраняется в текущей сессии.</p>
            </header>
            <div className={styles.testCatalog}>
              {[
                ["16PF-A", "Личностный профиль", "35 мин"],
                ["Эмоциональный интеллект", "Эмоциональные компетенции", "6 мин"],
                ["Мотивационные карты", "Ведущие мотиваторы", "7 мин"],
                ["Ваш переговорный стиль", "Поведение в переговорах", "5 мин"],
                ["Тайм-менеджмент", "Организация времени", "3 мин"],
                ["Ситуативное руководство", "Управленческий стиль", "5 мин"],
              ].map(([title, description, duration]) => {
                const assigned = assignedTests.includes(title);
                return (
                  <button key={title} className={assigned ? styles.testAssigned : ""} onClick={() => toggleTest(title)}>
                    <i>{assigned ? "✓" : "+"}</i>
                    <span><strong>{title}</strong><small>{description}</small></span>
                    <em>{duration}</em>
                  </button>
                );
              })}
            </div>
            <footer className={styles.panelFooter}>
              <span>Выбрано методик: <strong>{assignedTests.length}</strong></span>
              <button onClick={() => {
                setPanel("projects");
                setToast("Набор тестов подготовлен для проекта");
              }}>Использовать в проекте</button>
            </footer>
          </section>
        ) : null}

        {panel === "wallet" ? (
          <section className={`${styles.workspacePanel} ${styles.walletPanel} ${styles.panelEnter}`}>
            <button className={styles.close} onClick={() => setPanel(null)} aria-label="Закрыть">×</button>
            <header><span>EXECUTIVE WALLET</span><h2>Баланс</h2><p>Демонстрационный кошелёк отдельного тестового кабинета.</p></header>
            <div className={styles.walletCard}>
              <small>Доступно средств</small>
              <strong>{formatBalance(workspace.balanceKopeks)}</strong>
              <span>Тестовая среда · платежи отключены</span>
            </div>
            <div className={styles.walletActions}>
              {[50000, 100000, 250000].map((amount) => (
                <button key={amount} onClick={() => setToast(`Подготовлено пополнение на ${formatBalance(amount * 100)}`)}>
                  + {new Intl.NumberFormat("ru-RU").format(amount)} ₽
                </button>
              ))}
            </div>
            <p className={styles.safeNote}>Реальные списания и ЮKassa в этом экспериментальном интерфейсе не вызываются.</p>
          </section>
        ) : null}

        {panel === "trash" ? (
          <section className={`${styles.workspacePanel} ${styles.trashPanel} ${styles.panelEnter}`}>
            <button className={styles.close} onClick={() => setPanel(null)} aria-label="Закрыть">×</button>
            <header><span>КОРЗИНА</span><h2>Удалённые проекты</h2><p>Восстановление действует только в текущем тестовом интерфейсе.</p></header>
            <div className={styles.trashList}>
              {trashProjects.length ? trashProjects.map((item) => (
                <article key={item.id}>
                  <span><strong>{item.title}</strong><small>{item.folderTitle} · {item.date}</small></span>
                  <button onClick={() => restoreProject(item)}>Восстановить</button>
                </article>
              )) : <div className={styles.emptyTrash}><strong>Корзина пуста</strong><span>Удалённые проекты появятся здесь.</span></div>}
            </div>
          </section>
        ) : null}

        {panel === "project" && project ? (
          <section className={`${styles.workspacePanel} ${styles.projectDetailPanel} ${styles.panelEnter}`}>
            <button className={styles.close} onClick={() => setPanel("projects")} aria-label="Закрыть">×</button>
            <header><span>КАРТОЧКА ПРОЕКТА</span><h2>{project.title}</h2><p>{project.folderTitle} · обновлено {project.date}</p></header>
            <div className={styles.projectDetailGrid}>
              <article><small>Статус</small><strong>{project.status}</strong></article>
              <article><small>Участников</small><strong>{project.participants}</strong></article>
              <article><small>Готовность</small><strong>{project.progress}%</strong></article>
            </div>
            <div className={styles.projectProgress}><i><b style={{ width: `${project.progress}%` }} /></i><span>{project.progress}% выполнено</span></div>
            <div className={styles.projectActions}>
              <button onClick={() => setPanel("ai")}>Спросить AI</button>
              <button onClick={() => setPanel("tests")}>Настроить тесты</button>
              <button className={styles.primaryAction} onClick={() => setToast(`Проект «${project.title}» подготовлен к открытию`)}>Перейти к проекту</button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
