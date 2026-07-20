import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import styles from "../../styles/IndiDesktop3D.module.css";

const MODEL_ROOT = "/indi-3d/models";
const LAYOUT_STORAGE_KEY = "indi-3d-workspace-layout-v1";

const PROJECTS = [
  { title: "Оценка руководителей", meta: "24 участника", progress: 75, status: "В процессе" },
  { title: "Потенциал сотрудников", meta: "36 участников", progress: 60, status: "В процессе" },
  { title: "Онбординг-оценка", meta: "15 участников", progress: 30, status: "В процессе" },
  { title: "Оценка soft skills", meta: "22 участника", progress: 100, status: "Завершён" },
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
  | "test-catalog";

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
  { id: "ai-screen", label: "Экран AI" },
  { id: "balance", label: "Кошелёк" },
  { id: "ai-analyst", label: "AI-аналитик" },
  { id: "command-create", label: "Создать проект" },
  { id: "command-folder", label: "Новая папка" },
  { id: "command-trash", label: "Корзина" },
  { id: "command-tests", label: "Каталог тестов" },
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
  }[action];
}

export default function IndiDesktop3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const setArchiveModelOpenRef = useRef<(open: boolean) => void>(() => {});
  const sceneControllerRef = useRef<SceneController>(EMPTY_CONTROLLER);
  const selectedObjectIdRef = useRef("archive");
  const [loadProgress, setLoadProgress] = useState(0);
  const [sceneError, setSceneError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePage, setArchivePage] = useState(0);
  const [aiOpen, setAiOpen] = useState(true);
  const [selectedProject, setSelectedProject] = useState(0);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState<BuilderMode>("translate");
  const [selectedObjectId, setSelectedObjectId] = useState("archive");
  const [hiddenObjectIds, setHiddenObjectIds] = useState<string[]>([]);
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundTheme>("marble");
  const [toast, setToast] = useState("Экспериментальный 3D-кабинет Indi готов");

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
        "archive-binder-closed-web.glb",
        "archive-binder-open-web.glb",
        "folder-organizer-web.glb",
        "project-folder-web.glb",
        "project-display-frame-web.glb",
        "ai-smart-glass-frame-web.glb",
        "balance-wallet-web.glb",
        "command-button-web.glb",
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
        loaded.get("archive-binder-closed-web.glb")!.scene,
        4.2,
        [-4.25, 0, 0.45],
        [0.03, 0.42, 0],
        "archive",
        "archive",
      );

      const archiveLeather = new THREE.MeshStandardMaterial({ color: 0x17372a, roughness: 0.7, metalness: 0.08 });
      const archivePages = new THREE.MeshStandardMaterial({ color: 0xeadfc9, roughness: 0.92 });
      const pageBlock = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.28, 4.05), archivePages);
      pageBlock.position.set(0.06, 0.12, 0);
      pageBlock.castShadow = true;
      pageBlock.receiveShadow = true;
      const backCover = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.16, 4.28), archiveLeather);
      backCover.position.set(0, 0.045, 0);
      backCover.castShadow = true;
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 4.3), archiveLeather);
      spine.position.set(-1.72, 0.18, 0);
      spine.castShadow = true;
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 4.38), archiveLeather);
      strap.position.set(1.08, 0.21, 0);
      strap.castShadow = true;
      const frontPages = new THREE.Mesh(new THREE.BoxGeometry(3.18, 0.42, 0.2), archivePages);
      frontPages.position.set(0.05, 0.38, 2.03);
      const rearPages = frontPages.clone();
      rearPages.position.z = -2.03;
      const leftLeatherEdge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 4.25), archiveLeather);
      leftLeatherEdge.position.set(-1.7, 0.3, 0);
      const rightLeatherEdge = leftLeatherEdge.clone();
      rightLeatherEdge.position.x = 1.7;
      closedArchive.add(pageBlock, backCover, spine, strap, frontPages, rearPages, leftLeatherEdge, rightLeatherEdge);

      const titleCanvas = document.createElement("canvas");
      titleCanvas.width = 768;
      titleCanvas.height = 240;
      const titleContext = titleCanvas.getContext("2d");
      if (titleContext) {
        titleContext.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
        titleContext.fillStyle = "#d6af70";
        titleContext.textAlign = "center";
        titleContext.font = "600 66px Georgia";
        titleContext.fillText("АРХИВ", titleCanvas.width / 2, 105);
        titleContext.font = "32px Georgia";
        titleContext.fillText("ЕЖЕДНЕВНИК · 2026", titleCanvas.width / 2, 164);
        const titleTexture = new THREE.CanvasTexture(titleCanvas);
        titleTexture.colorSpace = THREE.SRGBColorSpace;
        const titlePlate = new THREE.Mesh(
          new THREE.PlaneGeometry(2.15, 0.68),
          new THREE.MeshStandardMaterial({ map: titleTexture, transparent: true, roughness: 0.78 }),
        );
        titlePlate.rotation.x = -Math.PI / 2;
        titlePlate.position.set(-0.22, 0.78, -0.25);
        closedArchive.add(titlePlate);
      }

      const openArchive = prepare(
        loaded.get("archive-binder-open-web.glb")!.scene,
        5.5,
        [-3.6, 0, 0.2],
        [0.02, 0.24, 0],
        "archive",
      );
      openArchive.visible = false;

      prepare(
        loaded.get("project-display-frame-web.glb")!.scene,
        5.6,
        [0, 0, -1.55],
        [-0.03, 0, 0],
        undefined,
        "project-display",
      );
      prepare(
        loaded.get("folder-organizer-web.glb")!.scene,
        3.2,
        [4.25, 0, -1.8],
        [0, -0.38, 0],
        "folder",
        "folder-organizer",
      );

      const folderSource = loaded.get("project-folder-web.glb")!.scene;
      [-0.42, 0, 0.42].forEach((offset, index) => {
        const folder = prepare(
          folderSource.clone(true),
          1.55,
          [3.55 + offset * 1.9, 1.17 + index * 0.08, -1.2 - index * 0.18],
          [-0.08, -0.22, -0.04 + offset * 0.05],
          "folder",
          `folder-${index + 1}`,
        );
        folder.userData.projectIndex = index;
      });

      prepare(
        loaded.get("ai-smart-glass-frame-web.glb")!.scene,
        2.45,
        [4.2, 0, 0.25],
        [0, -0.25, 0],
        undefined,
        "ai-screen",
      );
      prepare(
        loaded.get("balance-wallet-web.glb")!.scene,
        2.6,
        [4.05, 0, 2.35],
        [0, -0.2, 0],
        "balance",
        "balance",
      );

      const commandSource = loaded.get("command-button-web.glb")!.scene;
      const commandActions: ActionName[] = ["create-project", "new-folder", "trash", "test-catalog"];
      const commandBuilderIds = ["command-create", "command-folder", "command-trash", "command-tests"];
      commandActions.forEach((action, index) => {
        prepare(
          commandSource.clone(true),
          1.05,
          [-1.8 + index * 1.2, 0, 3.25],
          [0, 0, 0],
          action,
          commandBuilderIds[index],
        );
      });

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
      let archiveIsOpen = false;
      setArchiveModelOpenRef.current = (open) => {
        archiveIsOpen = open;
        closedArchive.visible = !open;
        openArchive.visible = open;
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
        } else if (action === "folder") {
          const index = Number(target?.userData.projectIndex ?? 0);
          setSelectedProject(index % PROJECTS.length);
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
  const archive = ARCHIVE_PAGES[archivePage];

  function runAction(action: ActionName) {
    if (action === "archive") {
      setArchiveOpen((value) => {
        const next = !value;
        setArchiveModelOpenRef.current(next);
        return next;
      });
    }
    if (action === "ai") setAiOpen((value) => !value);
    setToast(actionLabel(action));
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

  function saveBuilderLayout() {
    sceneControllerRef.current.saveLayout(backgroundTheme);
    setToast("Персональная раскладка сохранена в этом браузере");
  }

  function resetBuilderLayout() {
    sceneControllerRef.current.resetLayout();
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

        <section className={styles.projectsPanel} aria-label="Недавние проекты">
          <div className={styles.panelHeading}>
            <div><span>ПРОЕКТЫ</span><strong>Недавняя работа</strong></div>
            <button>Смотреть все</button>
          </div>
          <div className={styles.projectList}>
            {PROJECTS.map((project, index) => (
              <button
                key={project.title}
                className={index === selectedProject ? styles.selectedProject : ""}
                onClick={() => setSelectedProject(index)}
              >
                <i>{String(index + 1).padStart(2, "0")}</i>
                <span><strong>{project.title}</strong><small>{project.meta}</small></span>
                <b style={{ "--progress": `${project.progress * 3.6}deg` } as CSSProperties}>{project.progress}%</b>
              </button>
            ))}
          </div>
        </section>

        <aside className={`${styles.archiveCard} ${archiveOpen ? styles.archiveVisible : ""}`}>
          <button className={styles.archiveClose} onClick={() => runAction("archive")} aria-label="Закрыть архив">×</button>
          <span>АРХИВ · СТРАНИЦА {archivePage + 1}</span>
          <h2>{archive.title}</h2>
          <strong>{archive.value}</strong>
          <p>{archive.note}</p>
          <div>
            <button onClick={() => setArchivePage((archivePage + ARCHIVE_PAGES.length - 1) % ARCHIVE_PAGES.length)}>Назад</button>
            <button onClick={() => setArchivePage((archivePage + 1) % ARCHIVE_PAGES.length)}>Далее</button>
          </div>
        </aside>

        <aside className={`${styles.aiPanel} ${aiOpen ? styles.aiVisible : ""}`}>
          <span>AI-АНАЛИТИК</span>
          <h2>Добрый день</h2>
          <p>Я могу собрать краткую сводку по проектам и отметить результаты, требующие внимания.</p>
          <button onClick={() => setToast("Чат AI-аналитика будет подключён к данным Indi на следующем этапе")}>Открыть чат</button>
        </aside>

        <aside className={styles.folderLabel}>
          <span>ПАПКА</span>
          <strong>{selected.title}</strong>
          <small>{selected.meta} · {selected.status}</small>
        </aside>

        <aside className={styles.balanceLabel}>
          <span>БАЛАНС</span>
          <strong>125 630 ₽</strong>
          <button onClick={() => runAction("balance")}>Пополнить</button>
        </aside>

        <div className={styles.commandDock} aria-label="Быстрые действия">
          <button onClick={() => runAction("create-project")}><i>+</i><span>Создать проект</span></button>
          <button onClick={() => runAction("new-folder")}><i>F</i><span>Новая папка</span></button>
          <button onClick={() => runAction("trash")}><i>×</i><span>Корзина</span></button>
          <button onClick={() => runAction("test-catalog")}><i>T</i><span>Каталог тестов</span></button>
        </div>

        <div className={styles.toast} role="status"><span />{toast}</div>
        <div className={styles.experimentBadge}>INDI · EXPERIMENTAL</div>
      </section>
    </main>
  );
}
