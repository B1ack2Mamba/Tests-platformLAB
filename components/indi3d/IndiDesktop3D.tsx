import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import styles from "../../styles/IndiDesktop3D.module.css";

const MODEL_ROOT = "/indi-3d/models";
const LAYOUT_STORAGE_KEY = "indi-3d-workspace-layout-v2";
const PROJECT_PANEL_STORAGE_KEY = "indi-3d-project-panel-position-v2";

const PROJECTS = [
  { title: "Оценка руководителей", folderTitle: "Руководители", meta: "24 участника", participants: 24, progress: 75, status: "В процессе", date: "20 мая 2025" },
  { title: "Потенциал сотрудников", folderTitle: "Потенциал", meta: "36 участников", participants: 36, progress: 60, status: "В процессе", date: "18 мая 2025" },
  { title: "Онбординг-оценка", folderTitle: "Онбординг", meta: "15 участников", participants: 15, progress: 30, status: "В процессе", date: "15 мая 2025" },
  { title: "Оценка soft skills", folderTitle: "Soft skills", meta: "22 участника", participants: 22, progress: 100, status: "Завершён", date: "10 мая 2025" },
];

const ARCHIVE_ITEMS = [
  { title: "Оценка soft skills", meta: "22 участника · 10 мая 2025" },
  { title: "Лидерский потенциал", meta: "18 участников · 5 мая 2025" },
  { title: "Довольность команд", meta: "32 участника · 28 апр. 2025" },
];

const ARCHIVE_PAGES = [
  { title: "Завершённые проекты", value: "18", note: "за последние 90 дней" },
  { title: "Готовые отчёты", value: "42", note: "доступны для скачивания" },
  { title: "Кандидаты в резерве", value: "67", note: "в кадровом архиве" },
];

type ActionName =
  | "archive"
  | "ai"
  | "balance"
  | "folder"
  | "create-project"
  | "new-folder"
  | "trash"
  | "test-catalog"
  | "archive-zone"
  | "trash-zone";

type SceneObject = import("three").Object3D;
type BuilderMode = "translate" | "rotate" | "scale";
type BackgroundTheme = "marble" | "walnut" | "linen";

type SceneController = {
  setBuilderEnabled: (enabled: boolean) => void;
  setMode: (mode: BuilderMode) => void;
  select: (id: string) => void;
  toggleVisibility: (id: string) => void;
  saveLayout: (theme: BackgroundTheme) => void;
  resetLayout: () => void;
  setBackground: (theme: BackgroundTheme) => void;
};

const BUILDER_OBJECTS = [
  { id: "archive", label: "Архивный ежедневник" },
  { id: "project-display", label: "Экран проектов" },
  { id: "folder-organizer", label: "Органайзер папок" },
  { id: "folder-1", label: "Папка 1" },
  { id: "folder-2", label: "Папка 2" },
  { id: "folder-3", label: "Папка 3" },
  { id: "folder-4", label: "Папка 4" },
  { id: "ai-screen", label: "Экран AI" },
  { id: "balance", label: "Кошелёк" },
  { id: "ai-analyst", label: "AI-аналитик" },
  { id: "archive-zone", label: "Зона архива" },
  { id: "trash-zone", label: "Зона корзины" },
] as const;

const EMPTY_CONTROLLER: SceneController = {
  setBuilderEnabled: () => {},
  setMode: () => {},
  select: () => {},
  toggleVisibility: () => {},
  saveLayout: () => {},
  resetLayout: () => {},
  setBackground: () => {},
};

function actionLabel(action: ActionName) {
  return {
    "create-project": "Создание проекта откроется на следующем этапе",
    "new-folder": "Новая папка подготовлена",
    trash: "Корзина открыта",
    "test-catalog": "Каталог тестов открыт",
    balance: "Открыт кошелёк",
    folder: "Выбрана проектная папка",
    archive: "Архив переключён",
    ai: "AI-аналитик готов к работе",
    "archive-zone": "Выбранный проект перемещён в архив",
    "trash-zone": "Выбранный проект перемещён в корзину",
  }[action];
}

export default function IndiDesktop3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const setArchiveModelOpenRef = useRef<(open: boolean) => void>(() => {});
  const setArchivePageModelRef = useRef<() => void>(() => {});
  const setProjectFolderSelectionRef = useRef<(index: number) => void>(() => {});
  const cycleWalletModelRef = useRef<() => void>(() => {});
  const pulseTrashModelRef = useRef<() => void>(() => {});
  const sceneControllerRef = useRef<SceneController>(EMPTY_CONTROLLER);
  const selectedObjectIdRef = useRef("archive");
  const selectedProjectRef = useRef(0);
  const projectPanelDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [sceneError, setSceneError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(true);
  const [archivePage, setArchivePage] = useState(0);
  const [aiOpen, setAiOpen] = useState(true);
  const [selectedProject, setSelectedProject] = useState(0);
  const [projectDisposition, setProjectDisposition] = useState<Record<number, "active" | "archived" | "trash">>({});
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState<BuilderMode>("translate");
  const [selectedObjectId, setSelectedObjectId] = useState("archive");
  const [hiddenObjectIds, setHiddenObjectIds] = useState<string[]>([]);
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundTheme>("marble");
  const [projectPanelOffset, setProjectPanelOffset] = useState({ x: 0, y: 0 });
  const [projectPanelDragging, setProjectPanelDragging] = useState(false);
  const [toast, setToast] = useState("Экспериментальный 3D-кабинет Indi готов");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PROJECT_PANEL_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { x?: unknown; y?: unknown };
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        setProjectPanelOffset({ x: parsed.x, y: parsed.y });
      }
    } catch {
      window.localStorage.removeItem(PROJECT_PANEL_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!projectPanelDragging) return;

    function onPointerMove(event: PointerEvent) {
      const drag = projectPanelDragRef.current;
      if (!drag) return;
      setProjectPanelOffset({
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      });
    }

    function onPointerUp() {
      projectPanelDragRef.current = null;
      setProjectPanelDragging(false);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [projectPanelDragging]);

  useEffect(() => {
    sceneControllerRef.current.setBuilderEnabled(builderOpen);
  }, [builderOpen]);

  useEffect(() => {
    sceneControllerRef.current.setMode(builderMode);
  }, [builderMode]);

  useEffect(() => {
    sceneControllerRef.current.setBackground(backgroundTheme);
  }, [backgroundTheme]);

  useEffect(() => {
    selectedProjectRef.current = selectedProject;
    setProjectFolderSelectionRef.current(selectedProject);
  }, [selectedProject]);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    const stageElement = stageRef.current;
    if (!canvasElement || !stageElement) return;

    let disposed = false;
    let animationFrame = 0;
    let cleanup = () => {};

    async function startScene(canvas: HTMLCanvasElement, stage: HTMLDivElement) {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { TransformControls } = await import("three/examples/jsm/controls/TransformControls.js");
      if (disposed) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xd8cdbb);
      scene.fog = new THREE.Fog(0xd8cdbb, 14, 28);

      const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 80);
      camera.position.set(0, 8.2, 12.4);
      camera.lookAt(0, 0.8, 0);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;

      scene.add(new THREE.HemisphereLight(0xfff5dc, 0x3b4b40, 2.2));
      const keyLight = new THREE.DirectionalLight(0xffe2b3, 4.3);
      keyLight.position.set(-5, 10, 7);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      keyLight.shadow.camera.left = -10;
      keyLight.shadow.camera.right = 10;
      keyLight.shadow.camera.top = 9;
      keyLight.shadow.camera.bottom = -7;
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0x9fd4bd, 2.2);
      rimLight.position.set(8, 6, -6);
      scene.add(rimLight);

      const table = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 12),
        new THREE.MeshStandardMaterial({ color: 0xb9a58c, roughness: 0.56, metalness: 0.02 }),
      );
      table.rotation.x = -Math.PI / 2;
      table.position.y = -0.06;
      table.receiveShadow = true;
      scene.add(table);

      const tableInlay = new THREE.Mesh(
        new THREE.RingGeometry(4.5, 7.8, 64),
        new THREE.MeshBasicMaterial({ color: 0xd8c7aa, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
      );
      tableInlay.rotation.x = -Math.PI / 2;
      tableInlay.position.y = -0.045;
      scene.add(tableInlay);

      const loader = new GLTFLoader();
      const mixers: import("three").AnimationMixer[] = [];
      const interactive: SceneObject[] = [];
      const loadedRoots: SceneObject[] = [];
      const editableObjects = new Map<string, SceneObject>();
      const defaultLayout = new Map<string, {
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
        visible: boolean;
      }>();
      const hoverable = new Set<SceneObject>();
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function prepare(
        root: SceneObject,
        targetSize: number,
        position: [number, number, number],
        rotation: [number, number, number],
        action?: ActionName,
        builderId?: string,
      ) {
        root.traverse((child) => {
          const mesh = child as import("three").Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const scale = targetSize / Math.max(size.x, size.y, size.z, 0.001);
        root.scale.setScalar(scale);
        const scaledBox = new THREE.Box3().setFromObject(root);
        const center = scaledBox.getCenter(new THREE.Vector3());
        root.position.x -= center.x;
        root.position.z -= center.z;
        root.position.y -= scaledBox.min.y;

        const pivot = new THREE.Group();
        pivot.add(root);
        pivot.position.set(...position);
        pivot.rotation.set(...rotation);
        pivot.userData.baseY = position[1];
        pivot.userData.baseScale = [1, 1, 1];
        if (builderId) {
          pivot.userData.builderId = builderId;
          editableObjects.set(builderId, pivot);
        }
        if (action) {
          pivot.userData.action = action;
          interactive.push(pivot);
          hoverable.add(pivot);
        }
        scene.add(pivot);
        loadedRoots.push(pivot);
        return pivot;
      }

      const modelFiles = [
        "hybrid-archive-planner-closed.glb",
        "hybrid-archive-planner-open.glb",
        "hybrid-archive-planner-page-turn.glb",
        "hybrid-folder-organizer.glb",
        "hybrid-project-folder-closed.glb",
        "project-display-frame-web.glb",
        "ai-smart-glass-frame-web.glb",
        "hybrid-balance-wallet-closed.glb",
        "hybrid-balance-wallet-open.glb",
        "hybrid-balance-wallet-card-half.glb",
        "hybrid-archive-tray.glb",
        "hybrid-trash-tray-closed.glb",
        "hybrid-trash-tray-open.glb",
        "ai-analyst-rigged.glb",
      ];

      const loaded = new Map<string, Awaited<ReturnType<typeof loader.loadAsync>>>();
      let complete = 0;
      await Promise.all(
        modelFiles.map(async (file) => {
          const gltf = await loader.loadAsync(`${MODEL_ROOT}/${file}`);
          loaded.set(file, gltf);
          complete += 1;
          if (!disposed) setLoadProgress(Math.round((complete / modelFiles.length) * 100));
        }),
      );
      if (disposed) return;

      const closedArchive = prepare(
        loaded.get("hybrid-archive-planner-closed.glb")!.scene,
        4.2,
        [-4.25, 0, 0.45],
        [0.03, 0.42, 0],
        "archive",
        "archive",
      );

      const openArchive = prepare(
        loaded.get("hybrid-archive-planner-open.glb")!.scene,
        5.5,
        [-3.6, 0, 0.2],
        [0.02, 0.24, 0],
        "archive",
      );
      const pageTurnArchive = prepare(
        loaded.get("hybrid-archive-planner-page-turn.glb")!.scene,
        5.5,
        [-3.6, 0, 0.2],
        [0.02, 0.24, 0],
        "archive",
      );
      closedArchive.visible = false;
      openArchive.visible = true;
      pageTurnArchive.visible = false;

      prepare(
        loaded.get("project-display-frame-web.glb")!.scene,
        5.6,
        [0, 0, -1.55],
        [-0.03, 0, 0],
        undefined,
        "project-display",
      );
      prepare(
        loaded.get("hybrid-folder-organizer.glb")!.scene,
        3.2,
        [4.25, 0, -1.8],
        [0, -0.38, 0],
        "folder",
        "folder-organizer",
      );

      const folderSource = loaded.get("hybrid-project-folder-closed.glb")!.scene;
      const projectFolders: SceneObject[] = [];
      const folderBasePositions: Array<[number, number, number]> = [];
      PROJECTS.forEach((project, index) => {
        const position: [number, number, number] = [2.95 + index * 0.68, 1.04 + index * 0.035, -1.46 - index * 0.09];
        const folder = prepare(
          folderSource.clone(true),
          1.5,
          position,
          [-0.08, -0.18, -0.06 + index * 0.035],
          "folder",
          `folder-${index + 1}`,
        );
        folder.userData.projectIndex = index;
        folder.userData.projectTitle = project.title;
        folderBasePositions.push(position);
        projectFolders.push(folder);
      });

      setProjectFolderSelectionRef.current = (selectedIndex) => {
        projectFolders.forEach((folder, index) => {
          const base = folderBasePositions[index];
          const selected = index === selectedIndex;
          folder.position.set(base[0] + (selected ? -0.1 : 0), base[1] + (selected ? 0.18 : 0), base[2] + (selected ? 0.68 : 0));
          folder.userData.baseY = folder.position.y;
          folder.userData.baseScale = selected ? [1.08, 1.08, 1.08] : [1, 1, 1];
          folder.scale.setScalar(selected ? 1.08 : 1);
        });
      };
      setProjectFolderSelectionRef.current(0);

      prepare(
        loaded.get("ai-smart-glass-frame-web.glb")!.scene,
        2.45,
        [4.2, 0, 0.25],
        [0, -0.25, 0],
        undefined,
        "ai-screen",
      );
      const closedWallet = prepare(
        loaded.get("hybrid-balance-wallet-closed.glb")!.scene,
        2.6,
        [4.05, 0, 2.35],
        [0, -0.2, 0],
        "balance",
        "balance",
      );
      const openWallet = prepare(
        loaded.get("hybrid-balance-wallet-open.glb")!.scene,
        2.6,
        [4.05, 0, 2.35],
        [0, -0.2, 0],
        "balance",
      );
      const cardWallet = prepare(
        loaded.get("hybrid-balance-wallet-card-half.glb")!.scene,
        2.6,
        [4.05, 0, 2.35],
        [0, -0.2, 0],
        "balance",
      );
      openWallet.visible = false;
      cardWallet.visible = false;

      prepare(
        loaded.get("hybrid-archive-tray.glb")!.scene,
        2.45,
        [-1.55, 0, 3.05],
        [0, 0, 0],
        "archive-zone",
        "archive-zone",
      );
      const closedTrash = prepare(
        loaded.get("hybrid-trash-tray-closed.glb")!.scene,
        2.45,
        [1.55, 0, 3.05],
        [0, 0, 0],
        "trash-zone",
        "trash-zone",
      );
      const openTrash = prepare(
        loaded.get("hybrid-trash-tray-open.glb")!.scene,
        2.45,
        [1.55, 0, 3.05],
        [0, 0, 0],
        "trash-zone",
      );
      openTrash.visible = false;

      const analystGltf = loaded.get("ai-analyst-rigged.glb")!;
      const analyst = prepare(analystGltf.scene, 2.75, [2.95, 0, 0.15], [0, -0.3, 0], "ai", "ai-analyst");
      if (analystGltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(analystGltf.scene);
        mixer.clipAction(analystGltf.animations[0]).play();
        mixers.push(mixer);
      }

      editableObjects.forEach((object, id) => {
        defaultLayout.set(id, {
          position: object.position.toArray() as [number, number, number],
          rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
          scale: object.scale.toArray() as [number, number, number],
          visible: object.visible,
        });
      });

      const transformControls = new TransformControls(camera, canvas);
      const transformHelper = transformControls.getHelper();
      transformHelper.visible = false;
      scene.add(transformHelper);
      transformControls.setTranslationSnap(0.1);
      transformControls.setRotationSnap(Math.PI / 12);
      transformControls.setScaleSnap(0.05);

      let builderEnabled = false;
      let selectedEditable: SceneObject | null = null;

      function applyBuilderMode(mode: BuilderMode) {
        transformControls.setMode(mode);
        transformControls.showX = mode !== "rotate";
        transformControls.showY = mode !== "translate";
        transformControls.showZ = mode !== "rotate";
        if (mode === "rotate") transformControls.showY = true;
      }

      function selectEditable(object: SceneObject | null) {
        selectedEditable = object;
        if (!object || !object.visible || !builderEnabled) {
          transformControls.detach();
          transformHelper.visible = false;
          return;
        }
        transformControls.attach(object);
        transformHelper.visible = true;
        selectedObjectIdRef.current = String(object.userData.builderId);
        setSelectedObjectId(selectedObjectIdRef.current);
      }

      function applyBackground(theme: BackgroundTheme) {
        const palette = {
          marble: { scene: 0xd8cdbb, table: 0xb9a58c, inlay: 0xd8c7aa, exposure: 1.08 },
          walnut: { scene: 0x594a3b, table: 0x5a3523, inlay: 0xc29a60, exposure: 1.2 },
          linen: { scene: 0xe6dfd2, table: 0xd3c7b4, inlay: 0x99ab94, exposure: 1.02 },
        }[theme];
        scene.background = new THREE.Color(palette.scene);
        if (scene.fog) scene.fog.color.setHex(palette.scene);
        (table.material as import("three").MeshStandardMaterial).color.setHex(palette.table);
        (tableInlay.material as import("three").MeshBasicMaterial).color.setHex(palette.inlay);
        renderer.toneMappingExposure = palette.exposure;
      }

      type SavedLayout = {
        version: 1;
        background: BackgroundTheme;
        objects: Record<string, {
          position: [number, number, number];
          rotation: [number, number, number];
          scale: [number, number, number];
          visible: boolean;
        }>;
      };

      function applyLayout(layout: SavedLayout) {
        const hidden: string[] = [];
        Object.entries(layout.objects).forEach(([id, transform]) => {
          const object = editableObjects.get(id);
          if (!object) return;
          object.position.fromArray(transform.position);
          object.rotation.set(...transform.rotation);
          object.scale.fromArray(transform.scale);
          object.visible = transform.visible;
          object.userData.baseY = transform.position[1];
          object.userData.baseScale = transform.scale;
          if (!transform.visible) hidden.push(id);
        });
        setHiddenObjectIds(hidden);
        setBackgroundTheme(layout.background);
        applyBackground(layout.background);
      }

      try {
        const saved = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (saved) applyLayout(JSON.parse(saved) as SavedLayout);
      } catch {
        window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
      }

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let hovered: SceneObject | null = null;
      let archiveIsOpen = true;
      let archivePageTimer = 0;
      let trashPulseTimer = 0;
      let walletState = 0;
      setArchiveModelOpenRef.current = (open) => {
        archiveIsOpen = open;
        window.clearTimeout(archivePageTimer);
        closedArchive.visible = !open;
        openArchive.visible = open;
        pageTurnArchive.visible = false;
      };
      setArchivePageModelRef.current = () => {
        if (!archiveIsOpen) return;
        window.clearTimeout(archivePageTimer);
        openArchive.visible = false;
        pageTurnArchive.visible = true;
        archivePageTimer = window.setTimeout(() => {
          pageTurnArchive.visible = false;
          openArchive.visible = true;
        }, 560);
      };
      cycleWalletModelRef.current = () => {
        walletState = (walletState + 1) % 3;
        closedWallet.visible = walletState === 0;
        openWallet.visible = walletState === 1;
        cardWallet.visible = walletState === 2;
      };
      pulseTrashModelRef.current = () => {
        window.clearTimeout(trashPulseTimer);
        closedTrash.visible = false;
        openTrash.visible = true;
        trashPulseTimer = window.setTimeout(() => {
          openTrash.visible = false;
          closedTrash.visible = true;
        }, 900);
      };

      function resolveAction(object: SceneObject | null) {
        let current = object;
        while (current) {
          if (current.userData.action) return current;
          current = current.parent;
        }
        return null;
      }

      function resolveEditable(object: SceneObject | null) {
        let current = object;
        while (current) {
          if (current.userData.builderId) return current;
          current = current.parent;
        }
        return null;
      }

      sceneControllerRef.current = {
        setBuilderEnabled(enabled) {
          builderEnabled = enabled;
          transformControls.enabled = enabled;
          if (enabled) {
            setArchiveOpen(false);
            setArchiveModelOpenRef.current(false);
            walletState = 0;
            closedWallet.visible = true;
            openWallet.visible = false;
            cardWallet.visible = false;
            closedTrash.visible = true;
            openTrash.visible = false;
            selectEditable(selectedEditable ?? editableObjects.get(selectedObjectIdRef.current) ?? editableObjects.get("archive") ?? null);
          } else {
            transformControls.detach();
            transformHelper.visible = false;
            selectedEditable = null;
          }
        },
        setMode(mode) {
          applyBuilderMode(mode);
        },
        select(id) {
          selectEditable(editableObjects.get(id) ?? null);
        },
        toggleVisibility(id) {
          const object = editableObjects.get(id);
          if (!object) return;
          object.visible = !object.visible;
          setHiddenObjectIds((current) => object.visible ? current.filter((item) => item !== id) : [...new Set([...current, id])]);
          if (!object.visible && selectedEditable === object) selectEditable(null);
        },
        saveLayout(theme) {
          const objects: SavedLayout["objects"] = {};
          editableObjects.forEach((object, id) => {
            objects[id] = {
              position: object.position.toArray() as [number, number, number],
              rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
              scale: object.scale.toArray() as [number, number, number],
              visible: object.visible,
            };
          });
          window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ version: 1, background: theme, objects }));
        },
        resetLayout() {
          window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
          defaultLayout.forEach((transform, id) => {
            const object = editableObjects.get(id);
            if (!object) return;
            object.position.fromArray(transform.position);
            object.rotation.set(...transform.rotation);
            object.scale.fromArray(transform.scale);
            object.visible = transform.visible;
            object.userData.baseY = transform.position[1];
            object.userData.baseScale = transform.scale;
          });
          setHiddenObjectIds([]);
          setBackgroundTheme("marble");
          applyBackground("marble");
          selectEditable(editableObjects.get("archive") ?? null);
        },
        setBackground(theme) {
          applyBackground(theme);
        },
      };
      applyBuilderMode("translate");

      function updatePointer(event: PointerEvent) {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      }

      function onPointerMove(event: PointerEvent) {
        updatePointer(event);
        raycaster.setFromCamera(pointer, camera);
        if (builderEnabled) {
          const hit = raycaster.intersectObjects([...editableObjects.values()], true)[0];
          hovered = resolveEditable(hit?.object ?? null);
          canvas.style.cursor = hovered ? "grab" : "default";
          return;
        }
        const hit = raycaster.intersectObjects(interactive, true)[0];
        hovered = resolveAction(hit?.object ?? null);
        canvas.style.cursor = hovered ? "pointer" : "default";
      }

      function onPointerDown(event: PointerEvent) {
        updatePointer(event);
        raycaster.setFromCamera(pointer, camera);
        if (builderEnabled) {
          const hit = raycaster.intersectObjects([...editableObjects.values()], true)[0];
          const target = resolveEditable(hit?.object ?? null);
          if (target) selectEditable(target);
          return;
        }
        const hit = raycaster.intersectObjects(interactive, true)[0];
        const target = resolveAction(hit?.object ?? null);
        const action = target?.userData.action as ActionName | undefined;
        if (!action) return;

        if (action === "archive") {
          archiveIsOpen = !archiveIsOpen;
          setArchiveModelOpenRef.current(archiveIsOpen);
          setArchiveOpen(archiveIsOpen);
        } else if (action === "ai") {
          setAiOpen((value) => !value);
        } else if (action === "balance") {
          cycleWalletModelRef.current();
        } else if (action === "folder") {
          const index = Number(target?.userData.projectIndex ?? 0);
          setSelectedProject(index % PROJECTS.length);
        } else if (action === "archive-zone") {
          setProjectDisposition((current) => ({ ...current, [selectedProjectRef.current]: "archived" }));
        } else if (action === "trash-zone") {
          setProjectDisposition((current) => ({ ...current, [selectedProjectRef.current]: "trash" }));
          pulseTrashModelRef.current();
        }
        setToast(actionLabel(action));
      }

      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerdown", onPointerDown);
      transformControls.addEventListener("objectChange", () => {
        if (selectedEditable) {
          selectedEditable.userData.baseY = selectedEditable.position.y;
          selectedEditable.userData.baseScale = selectedEditable.scale.toArray();
        }
      });

      const timer = new THREE.Timer();
      timer.connect(document);
      function resize() {
        const width = Math.max(1, stage.clientWidth);
        const height = Math.max(1, stage.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.fov = width < 760 ? 48 : 37;
        camera.position.z = width < 760 ? 15.8 : 12.4;
        camera.updateProjectionMatrix();
      }
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(stage);

      function render(timestamp?: number) {
        timer.update(timestamp);
        const delta = Math.min(timer.getDelta(), 0.05);
        const elapsed = timer.getElapsed();
        mixers.forEach((mixer) => mixer.update(delta));
        if (!reducedMotion && !builderEnabled) {
          analyst.rotation.y = -0.3 + Math.sin(elapsed * 0.55) * 0.045;
          camera.position.x += (pointer.x * 0.3 - camera.position.x) * 0.018;
          camera.lookAt(0, 0.8, 0);
        }
        if (!builderEnabled) {
          hoverable.forEach((item) => {
            const baseScale = (item.userData.baseScale ?? [1, 1, 1]) as [number, number, number];
            const hoverScale = item === hovered ? 1.035 : 1;
            item.scale.set(
              THREE.MathUtils.lerp(item.scale.x, baseScale[0] * hoverScale, 0.12),
              THREE.MathUtils.lerp(item.scale.y, baseScale[1] * hoverScale, 0.12),
              THREE.MathUtils.lerp(item.scale.z, baseScale[2] * hoverScale, 0.12),
            );
            item.position.y = THREE.MathUtils.lerp(
              item.position.y,
              Number(item.userData.baseY) + (item === hovered ? 0.09 : 0),
              0.12,
            );
          });
        }
        renderer.render(scene, camera);
        animationFrame = requestAnimationFrame(render);
      }
      render();

      cleanup = () => {
        cancelAnimationFrame(animationFrame);
        window.clearTimeout(archivePageTimer);
        window.clearTimeout(trashPulseTimer);
        resizeObserver.disconnect();
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerdown", onPointerDown);
        transformControls.detach();
        transformControls.dispose();
        scene.remove(transformHelper);
        loadedRoots.forEach((root) => {
          root.traverse((child) => {
            const mesh = child as import("three").Mesh;
            if (!mesh.isMesh) return;
            mesh.geometry?.dispose();
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => {
              Object.values(material).forEach((value) => {
                if (value && typeof value === "object" && "isTexture" in value) {
                  (value as import("three").Texture).dispose();
                }
              });
              material.dispose();
            });
          });
        });
        timer.dispose();
        renderer.dispose();
        setArchiveModelOpenRef.current = () => {};
        setArchivePageModelRef.current = () => {};
        setProjectFolderSelectionRef.current = () => {};
        cycleWalletModelRef.current = () => {};
        pulseTrashModelRef.current = () => {};
        sceneControllerRef.current = EMPTY_CONTROLLER;
      };
    }

    startScene(canvasElement, stageElement).catch((error: unknown) => {
      if (!disposed) setSceneError(error instanceof Error ? error.message : "Не удалось загрузить 3D-сцену");
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      cleanup();
    };
  }, []);

  const selected = PROJECTS[selectedProject];
  const selectedDisposition = projectDisposition[selectedProject] ?? "active";

  function runAction(action: ActionName) {
    if (action === "archive") {
      setArchiveOpen((value) => {
        const next = !value;
        setArchiveModelOpenRef.current(next);
        return next;
      });
    }
    if (action === "ai") setAiOpen((value) => !value);
    if (action === "balance") cycleWalletModelRef.current();
    if (action === "archive-zone") {
      setProjectDisposition((current) => ({ ...current, [selectedProject]: "archived" }));
    }
    if (action === "trash-zone") {
      setProjectDisposition((current) => ({ ...current, [selectedProject]: "trash" }));
      pulseTrashModelRef.current();
    }
    setToast(actionLabel(action));
  }

  function turnArchivePage(direction: -1 | 1) {
    setArchivePage((current) => (current + direction + ARCHIVE_PAGES.length) % ARCHIVE_PAGES.length);
    setArchivePageModelRef.current();
    setToast(direction > 0 ? "Перелистываем архив вперёд" : "Перелистываем архив назад");
  }

  function toggleBuilder() {
    setBuilderOpen((current) => {
      const next = !current;
      if (next) {
        setArchiveOpen(false);
        setArchiveModelOpenRef.current(false);
        setToast("Конструктор включён: выберите предмет на столе");
      } else {
        setToast("Конструктор закрыт, рабочий стол снова интерактивен");
      }
      return next;
    });
  }

  function selectBuilderObject(id: string) {
    selectedObjectIdRef.current = id;
    setSelectedObjectId(id);
    sceneControllerRef.current.select(id);
  }

  function startProjectPanelDrag(event: React.PointerEvent<HTMLElement>) {
    if (!builderOpen || event.button !== 0) return;
    event.preventDefault();
    projectPanelDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: projectPanelOffset.x,
      originY: projectPanelOffset.y,
    };
    setProjectPanelDragging(true);
    selectBuilderObject("project-display");
    setToast("Перемещаем окно проектов");
  }

  function saveBuilderLayout() {
    sceneControllerRef.current.saveLayout(backgroundTheme);
    window.localStorage.setItem(PROJECT_PANEL_STORAGE_KEY, JSON.stringify(projectPanelOffset));
    setToast("Персональная раскладка сохранена в этом браузере");
  }

  function resetBuilderLayout() {
    sceneControllerRef.current.resetLayout();
    window.localStorage.removeItem(PROJECT_PANEL_STORAGE_KEY);
    setProjectPanelOffset({ x: 0, y: 0 });
    selectedObjectIdRef.current = "archive";
    setSelectedObjectId("archive");
    setToast("Восстановлена исходная композиция рабочего стола");
  }

  const stageTheme = {
    marble: styles.themeMarble,
    walnut: styles.themeWalnut,
    linen: styles.themeLinen,
  }[backgroundTheme];
  const selectedBuilderObject = BUILDER_OBJECTS.find((item) => item.id === selectedObjectId);

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.connection}><span /> Indi-контур подключён</div>
        <nav aria-label="Навигация экспериментального кабинета">
          <button className={styles.activeNav}>Рабочий стол</button>
          <button>Проекты</button>
          <button>Тесты</button>
          <button>Кандидаты</button>
          <button>Аналитика</button>
        </nav>
        <div className={styles.profile}>
          <div><strong>Эксперимент Indi</strong><span>3D-интерфейс</span></div>
          <button
            className={`${styles.builderButton} ${builderOpen ? styles.builderButtonActive : ""}`}
            onClick={toggleBuilder}
            disabled={loadProgress < 100 || Boolean(sceneError)}
          >
            {builderOpen ? "Готово" : "Конструктор"}
          </button>
        </div>
      </header>

      <section ref={stageRef} className={`${styles.stage} ${stageTheme} ${builderOpen ? styles.builderActive : ""}`}>
        <canvas ref={canvasRef} className={styles.canvas} aria-label="Интерактивный 3D-рабочий стол" />
        <div className={styles.atmosphere} aria-hidden="true" />

        {loadProgress < 100 && !sceneError ? (
          <div className={styles.loader}>
            <span>Подготавливаем кабинет</span>
            <div><i style={{ width: `${loadProgress}%` }} /></div>
            <strong>{loadProgress}%</strong>
          </div>
        ) : null}

        {sceneError ? (
          <div className={styles.errorPanel}>
            <strong>3D-сцена не загрузилась</strong>
            <span>{sceneError}</span>
          </div>
        ) : null}

        <div className={styles.titleBlock}>
          <span>Лаборатория интерфейсов</span>
          <h1>Рабочий стол</h1>
          <p>Ретро-деловой кабинет с живыми 3D-инструментами</p>
        </div>

        <aside className={`${styles.builderPanel} ${builderOpen ? styles.builderPanelVisible : ""}`} aria-hidden={!builderOpen}>
          <div className={styles.builderHeading}>
            <div><span>КОНСТРУКТОР СЦЕНЫ</span><strong>{selectedBuilderObject?.label ?? "Выберите предмет"}</strong></div>
            <button onClick={toggleBuilder} aria-label="Закрыть конструктор">×</button>
          </div>

          <div className={styles.transformModes} aria-label="Режим трансформации">
            {([
              ["translate", "Двигать"],
              ["rotate", "Вращать"],
              ["scale", "Размер"],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                className={builderMode === mode ? styles.transformModeActive : ""}
                onClick={() => setBuilderMode(mode)}
              >{label}</button>
            ))}
          </div>

          <p className={styles.builderHint}>Нажмите на предмет в сцене и тяните цветные направляющие.</p>

          <div className={styles.builderObjectList}>
            {BUILDER_OBJECTS.map((item) => {
              const hidden = hiddenObjectIds.includes(item.id);
              return (
                <div key={item.id} className={selectedObjectId === item.id ? styles.builderObjectSelected : ""}>
                  <button onClick={() => selectBuilderObject(item.id)} disabled={hidden}>{item.label}</button>
                  <button
                    className={hidden ? styles.visibilityOff : ""}
                    onClick={() => sceneControllerRef.current.toggleVisibility(item.id)}
                    aria-label={hidden ? `Показать ${item.label}` : `Скрыть ${item.label}`}
                  >{hidden ? "Показать" : "Скрыть"}</button>
                </div>
              );
            })}
          </div>

          <div className={styles.backgroundPicker}>
            <span>ФОН И СТОЛ</span>
            <div>
              <button className={backgroundTheme === "marble" ? styles.backgroundActive : ""} onClick={() => setBackgroundTheme("marble")}><i />Мрамор</button>
              <button className={backgroundTheme === "walnut" ? styles.backgroundActive : ""} onClick={() => setBackgroundTheme("walnut")}><i />Орех</button>
              <button className={backgroundTheme === "linen" ? styles.backgroundActive : ""} onClick={() => setBackgroundTheme("linen")}><i />Светлый</button>
            </div>
          </div>

          <div className={styles.builderActions}>
            <button onClick={resetBuilderLayout}>Сбросить</button>
            <button onClick={saveBuilderLayout}>Сохранить макет</button>
          </div>
        </aside>

        <section
          className={`${styles.projectsPanel} ${builderOpen ? styles.projectsPanelEditable : ""} ${projectPanelDragging ? styles.projectsPanelDragging : ""}`}
          aria-label="Недавние проекты"
          onPointerDown={startProjectPanelDrag}
          style={{
            "--panel-offset-x": `${projectPanelOffset.x}px`,
            "--panel-offset-y": `${projectPanelOffset.y}px`,
          } as CSSProperties}
        >
          <div className={styles.panelHeading}>
            <div><span>ВЫБРАННЫЙ ПРОЕКТ</span><strong>{selected.title}</strong></div>
            {builderOpen ? <small className={styles.panelDragHint}>Перетащите окно</small> : null}
            <i className={`${styles.projectState} ${styles[`projectState_${selectedDisposition}`]}`}>
              {selectedDisposition === "archived" ? "В архиве" : selectedDisposition === "trash" ? "В корзине" : selected.status}
            </i>
          </div>
          <div className={styles.projectSummary}>
            <div><span>УЧАСТНИКИ</span><strong>{selected.participants}</strong></div>
            <div><span>ПРОГРЕСС</span><b style={{ "--progress": `${selected.progress * 3.6}deg` } as CSSProperties}>{selected.progress}%</b></div>
            <div><span>СТАРТ</span><strong>{selected.date}</strong></div>
          </div>
          <div className={styles.projectActions}>
            <button onClick={() => setToast(`Открываем проект «${selected.title}»`)}>Открыть</button>
            <button onClick={() => setToast(`Показываем результаты проекта «${selected.title}»`)}>Результаты</button>
            <button onClick={() => setToast(`Создаём приглашение в проект «${selected.title}»`)}>Пригласить</button>
          </div>
        </section>

        <div className={styles.folderRack} aria-label="Папки проектов">
          {PROJECTS.map((project, index) => (
            <button
              key={project.title}
              className={`${index === selectedProject ? styles.folderRackSelected : ""} ${styles[`folderRack_${projectDisposition[index] ?? "active"}`]}`}
              onClick={() => setSelectedProject(index)}
            >
              <span>{project.folderTitle}</span>
              <strong>{project.progress}%</strong>
            </button>
          ))}
        </div>

        <aside className={`${styles.archiveCard} ${archiveOpen ? styles.archiveVisible : ""}`}>
          <button className={styles.archiveClose} onClick={() => runAction("archive")} aria-label="Закрыть архив">×</button>
          <span>АРХИВ · СТРАНИЦА {archivePage + 1}</span>
          <h2>Завершённые проекты</h2>
          <div className={styles.archiveTabs}><button>Все</button><button>Завершённые</button></div>
          <div className={styles.archiveItems}>
            {ARCHIVE_ITEMS.map((item) => <div key={item.title}><i>✓</i><span><strong>{item.title}</strong><small>{item.meta}</small></span></div>)}
          </div>
          <div className={styles.archivePager}>
            <button onClick={() => turnArchivePage(-1)}>Назад</button>
            <button onClick={() => turnArchivePage(1)}>Далее</button>
          </div>
        </aside>

        <aside className={`${styles.aiPanel} ${aiOpen ? styles.aiVisible : ""}`}>
          <span>AI-АНАЛИТИК</span>
          <h2>3 результата требуют внимания</h2>
          <p>Подготовлен контекстный разбор проекта «{selected.folderTitle}».</p>
          <button onClick={() => setToast("Вашу модель AI-аналитика подключим к выбранному проекту")}>Открыть разбор</button>
        </aside>

        <aside className={styles.balanceLabel}>
          <span>БАЛАНС</span>
          <strong>125 630 ₽</strong>
          <button onClick={() => runAction("balance")}>Пополнить</button>
        </aside>

        <div className={styles.dropZones} aria-label="Зоны перемещения проекта">
          <button className={styles.archiveDropZone} onClick={() => runAction("archive-zone")}>
            <i>↙</i><strong>В архив</strong><span>Переместить выбранный проект</span>
          </button>
          <button className={styles.trashDropZone} onClick={() => runAction("trash-zone")}>
            <i>×</i><strong>Корзина</strong><span>Хранение удалённых проектов 30 дней</span>
          </button>
        </div>

        <div className={styles.toast} role="status"><span />{toast}</div>
        <div className={styles.experimentBadge}>INDI · EXPERIMENTAL</div>
      </section>
    </main>
  );
}
