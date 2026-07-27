import { useEffect, useRef, useState } from "react";

import type { ExecutiveLabWorkspace } from "../../lib/executiveLab";
import styles from "../../styles/ExecutiveDeskScene.module.css";

const MODEL_ROOT = "/executive-lab/models";

type Props = {
  workspace: ExecutiveLabWorkspace;
  onCreateProject: () => void;
};

type PanelName = "projects" | "archive" | "ai" | null;

type InteractiveObject = {
  id: string;
  root: import("three").Group;
  basePosition: import("three").Vector3;
  baseRotation: import("three").Euler;
};

const MODEL_SPECS = [
  {
    id: "organizer",
    file: "desk-organizer.glb",
    size: 4.4,
    position: [4.75, 0, 2.15] as const,
    rotation: [0, -0.16, 0] as const,
  },
  {
    id: "archive",
    file: "document-tray.glb",
    size: 3.8,
    position: [-4.75, 0, 1.85] as const,
    rotation: [0, 0.18, 0] as const,
  },
  {
    id: "trash",
    file: "trash-tray.glb",
    size: 2.65,
    position: [-3.6, 0, -2.95] as const,
    rotation: [0, 0.08, 0] as const,
  },
  {
    id: "lamp",
    file: "desk-lamp.glb",
    size: 3.5,
    position: [-6.15, 0, -2.45] as const,
    rotation: [0, 0.35, 0] as const,
  },
  {
    id: "projects",
    file: "projects-book.glb",
    size: 5.1,
    position: [-0.2, 0, 0.55] as const,
    rotation: [0, Math.PI, 0] as const,
  },
  {
    id: "droid",
    file: "ai-droid.glb",
    size: 2.15,
    position: [3.85, 0, -2.72] as const,
    rotation: [0, -0.28, 0] as const,
  },
  {
    id: "ai",
    file: "ai-console.glb",
    size: 3.2,
    position: [5.65, 0, -1.85] as const,
    rotation: [0, -0.24, 0] as const,
  },
] as const;

function formatBalance(kopeks: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(kopeks / 100);
}

export default function ExecutiveDeskScene({ workspace, onCreateProject }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const actionRef = useRef<(id: string) => void>(() => {});
  const lampOnRef = useRef(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [sceneError, setSceneError] = useState("");
  const [panel, setPanel] = useState<PanelName>(null);
  const [selectedProject, setSelectedProject] = useState(0);
  const [archivePage, setArchivePage] = useState(0);
  const [, setLampOn] = useState(true);
  const [toast, setToast] = useState("Кабинет подключён к отдельной тестовой базе");

  const activeProjects = workspace.projects.filter((project) => project.disposition === "active");
  const archivedProjects = workspace.projects.filter((project) => project.disposition === "archived");
  const project = workspace.projects[selectedProject] ?? workspace.projects[0];

  function activate(id: string) {
    if (id === "projects" || id === "organizer") {
      setPanel("projects");
      setToast("Книга проектов открыта");
    } else if (id === "archive") {
      setPanel("archive");
      setToast("Архив выдвинут");
    } else if (id === "ai" || id === "droid") {
      setPanel("ai");
      setToast("AI-аналитик готов к диалогу");
    } else if (id === "lamp") {
      setLampOn((value) => {
        const nextValue = !value;
        lampOnRef.current = nextValue;
        setToast(nextValue ? "Рабочая лампа включена" : "Рабочая лампа выключена");
        return nextValue;
      });
    } else if (id === "trash") {
      setToast("Корзина пуста");
    }
    actionRef.current(id);
  }

  useEffect(() => {
    const canvasElement = canvasRef.current;
    const stageElement = stageRef.current;
    if (!canvasElement || !stageElement) return;
    const sceneCanvas: HTMLCanvasElement = canvasElement;
    const sceneStage: HTMLDivElement = stageElement;

    let disposed = false;
    let animationFrame = 0;
    let cleanup = () => {};

    async function startScene() {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        if (disposed) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x090807);
        scene.fog = new THREE.FogExp2(0x090807, 0.028);

        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
        camera.position.set(0, 9.1, 12.8);
        camera.lookAt(0, 0.3, 0);

        const renderer = new THREE.WebGLRenderer({
          canvas: sceneCanvas,
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;

        const deskMaterial = new THREE.MeshPhysicalMaterial({
          color: 0x2b1209,
          roughness: 0.34,
          metalness: 0.02,
          clearcoat: 0.24,
          clearcoatRoughness: 0.38,
        });
        const desk = new THREE.Mesh(new THREE.BoxGeometry(18, 0.7, 11.2, 1, 1, 1), deskMaterial);
        desk.position.y = -0.42;
        desk.receiveShadow = true;
        scene.add(desk);

        const grainCanvas = document.createElement("canvas");
        grainCanvas.width = 1024;
        grainCanvas.height = 512;
        const grainContext = grainCanvas.getContext("2d");
        if (grainContext) {
          const gradient = grainContext.createLinearGradient(0, 0, 0, grainCanvas.height);
          gradient.addColorStop(0, "#35180c");
          gradient.addColorStop(0.5, "#1b0d08");
          gradient.addColorStop(1, "#2f140a");
          grainContext.fillStyle = gradient;
          grainContext.fillRect(0, 0, grainCanvas.width, grainCanvas.height);
          grainContext.globalAlpha = 0.2;
          for (let row = 0; row < 72; row += 1) {
            grainContext.strokeStyle = row % 4 === 0 ? "#d48b45" : "#090504";
            grainContext.lineWidth = row % 5 === 0 ? 2 : 1;
            grainContext.beginPath();
            const y = (row / 72) * grainCanvas.height;
            grainContext.moveTo(0, y);
            for (let x = 0; x <= grainCanvas.width; x += 24) {
              grainContext.lineTo(x, y + Math.sin(x * 0.023 + row) * 3.5);
            }
            grainContext.stroke();
          }
        }
        const grainTexture = new THREE.CanvasTexture(grainCanvas);
        grainTexture.colorSpace = THREE.SRGBColorSpace;
        grainTexture.wrapS = THREE.RepeatWrapping;
        grainTexture.wrapT = THREE.RepeatWrapping;
        grainTexture.repeat.set(2.4, 2.2);
        deskMaterial.map = grainTexture;
        deskMaterial.needsUpdate = true;

        const wall = new THREE.Mesh(
          new THREE.PlaneGeometry(22, 9),
          new THREE.MeshStandardMaterial({ color: 0x11100f, roughness: 0.82 }),
        );
        wall.position.set(0, 3.8, -5.35);
        scene.add(wall);

        const brassStrip = new THREE.Mesh(
          new THREE.BoxGeometry(18, 0.06, 0.08),
          new THREE.MeshStandardMaterial({ color: 0xb17b36, metalness: 0.92, roughness: 0.2 }),
        );
        brassStrip.position.set(0, 0.08, -4.75);
        scene.add(brassStrip);

        scene.add(new THREE.HemisphereLight(0xd9e2e5, 0x160906, 0.78));
        scene.add(new THREE.AmbientLight(0xbda991, 0.38));

        const keyLight = new THREE.DirectionalLight(0xffc67d, 4.8);
        keyLight.position.set(-5, 9, 4);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(2048, 2048);
        keyLight.shadow.camera.left = -10;
        keyLight.shadow.camera.right = 10;
        keyLight.shadow.camera.top = 8;
        keyLight.shadow.camera.bottom = -8;
        scene.add(keyLight);

        const coolRim = new THREE.DirectionalLight(0x8cc4e2, 1.5);
        coolRim.position.set(7, 6, -5);
        scene.add(coolRim);

        const lampLight = new THREE.PointLight(0xffa94f, lampOnRef.current ? 32 : 0, 8, 2);
        lampLight.position.set(-5.7, 3.2, -2);
        lampLight.castShadow = true;
        scene.add(lampLight);

        const loader = new GLTFLoader();
        const interactive: InteractiveObject[] = [];
        const interactiveRoots: import("three").Object3D[] = [];
        const objectById = new Map<string, InteractiveObject>();
        const animationStartedAt = performance.now();
        const pointer = new THREE.Vector2(9, 9);
        const raycaster = new THREE.Raycaster();
        let hoveredId = "";
        let pointerX = 0;
        let pointerY = 0;
        let bookFocus = 0;
        let bookFocusTarget = 0;
        let archiveSlide = 0;
        let archiveSlideTarget = 0;
        let aiPulse = 0;
        let aiPulseTarget = 0;

        function prepare(
          source: import("three").Object3D,
          spec: (typeof MODEL_SPECS)[number],
        ) {
          source.traverse((child) => {
            const mesh = child as import("three").Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const material = mesh.material;
            if (Array.isArray(material)) {
              material.forEach((item) => {
                item.side = THREE.FrontSide;
              });
            } else {
              material.side = THREE.FrontSide;
            }
          });

          const box = new THREE.Box3().setFromObject(source);
          const size = box.getSize(new THREE.Vector3());
          const scale = spec.size / Math.max(size.x, size.y, size.z, 0.001);
          source.scale.setScalar(scale);

          const scaledBox = new THREE.Box3().setFromObject(source);
          const center = scaledBox.getCenter(new THREE.Vector3());
          source.position.x -= center.x;
          source.position.z -= center.z;
          source.position.y -= scaledBox.min.y;

          const root = new THREE.Group();
          root.name = spec.id;
          root.userData.interactiveId = spec.id;
          root.add(source);
          root.position.set(spec.position[0], spec.position[1], spec.position[2]);
          root.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2]);
          scene.add(root);

          const record: InteractiveObject = {
            id: spec.id,
            root,
            basePosition: root.position.clone(),
            baseRotation: root.rotation.clone(),
          };
          interactive.push(record);
          interactiveRoots.push(root);
          objectById.set(spec.id, record);
        }

        let loadedCount = 0;
        await Promise.all(
          MODEL_SPECS.map(async (spec) => {
            const gltf = await loader.loadAsync(`${MODEL_ROOT}/${spec.file}`);
            if (disposed) return;
            prepare(gltf.scene, spec);
            loadedCount += 1;
            setLoadProgress(Math.round((loadedCount / MODEL_SPECS.length) * 100));
          }),
        );
        if (disposed) return;

        function resize() {
          const width = Math.max(sceneStage.clientWidth, 1);
          const height = Math.max(sceneStage.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.fov = width < 760 ? 47 : 34;
          camera.position.y = width < 760 ? 10.8 : 9.1;
          camera.position.z = width < 760 ? 16.5 : 12.8;
          camera.updateProjectionMatrix();
          camera.lookAt(0, 0.25, 0);
        }

        function pointerCoordinates(event: PointerEvent) {
          const rect = sceneCanvas.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          pointerX = pointer.x;
          pointerY = pointer.y;
        }

        function findInteractiveId(object: import("three").Object3D | null) {
          let current = object;
          while (current) {
            if (typeof current.userData.interactiveId === "string") {
              return current.userData.interactiveId as string;
            }
            current = current.parent;
          }
          return "";
        }

        function onPointerMove(event: PointerEvent) {
          pointerCoordinates(event);
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObjects(interactiveRoots, true)[0];
          hoveredId = findInteractiveId(hit?.object ?? null);
          sceneCanvas.style.cursor = hoveredId ? "pointer" : "default";
        }

        function onPointerLeave() {
          pointer.set(9, 9);
          hoveredId = "";
          pointerX = 0;
          pointerY = 0;
          sceneCanvas.style.cursor = "default";
        }

        function onClick(event: PointerEvent) {
          pointerCoordinates(event);
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObjects(interactiveRoots, true)[0];
          const id = findInteractiveId(hit?.object ?? null);
          if (id) activate(id);
        }

        actionRef.current = (id) => {
          if (id === "projects" || id === "organizer") {
            bookFocusTarget = bookFocusTarget > 0.5 ? 0 : 1;
          }
          if (id === "archive") archiveSlideTarget = archiveSlideTarget > 0.5 ? 0 : 1;
          if (id === "ai" || id === "droid") aiPulseTarget = 1;
        };

        const observer = new ResizeObserver(resize);
        observer.observe(sceneStage);
        sceneCanvas.addEventListener("pointermove", onPointerMove);
        sceneCanvas.addEventListener("pointerleave", onPointerLeave);
        sceneCanvas.addEventListener("pointerup", onClick);
        resize();

        function render() {
          const elapsed = (performance.now() - animationStartedAt) / 1000;
          bookFocus += (bookFocusTarget - bookFocus) * 0.075;
          archiveSlide += (archiveSlideTarget - archiveSlide) * 0.08;
          aiPulse += (aiPulseTarget - aiPulse) * 0.1;
          aiPulseTarget *= 0.96;

          const book = objectById.get("projects");
          if (book) {
            book.root.position.x = book.basePosition.x;
            book.root.position.y = book.basePosition.y + bookFocus * 0.85;
            book.root.position.z = book.basePosition.z + bookFocus * 1.15;
            book.root.rotation.x = book.baseRotation.x - bookFocus * 0.17;
            book.root.rotation.y = book.baseRotation.y;
            book.root.scale.setScalar(1 + bookFocus * 0.075);
          }

          const archive = objectById.get("archive");
          if (archive) {
            archive.root.position.x = archive.basePosition.x + archiveSlide * 0.72;
            archive.root.position.z = archive.basePosition.z + archiveSlide * 0.3;
          }

          const droid = objectById.get("droid");
          if (droid) {
            droid.root.position.y = droid.basePosition.y + Math.sin(elapsed * 1.55) * 0.045;
            droid.root.rotation.y = droid.baseRotation.y + Math.sin(elapsed * 0.65) * 0.055;
            droid.root.scale.setScalar(1 + aiPulse * 0.035);
          }

          const hovered = objectById.get(hoveredId);
          for (const item of interactive) {
            if (item.id === "projects" || item.id === "archive" || item.id === "droid") continue;
            const targetScale = item === hovered ? 1.025 : 1;
            item.root.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
          }

          lampLight.intensity += ((lampOnRef.current ? 32 : 0) - lampLight.intensity) * 0.08;
          camera.position.x += (pointerX * 0.28 - camera.position.x) * 0.025;
          camera.position.y += ((sceneStage.clientWidth < 760 ? 10.8 : 9.1) + pointerY * 0.1 - camera.position.y) * 0.025;
          camera.lookAt(0, 0.25, 0);
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(render);
        }
        render();

        cleanup = () => {
          observer.disconnect();
          sceneCanvas.removeEventListener("pointermove", onPointerMove);
          sceneCanvas.removeEventListener("pointerleave", onPointerLeave);
          sceneCanvas.removeEventListener("pointerup", onClick);
          cancelAnimationFrame(animationFrame);
          renderer.dispose();
          grainTexture.dispose();
          scene.traverse((object) => {
            const mesh = object as import("three").Mesh;
            mesh.geometry?.dispose?.();
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => material?.dispose?.());
          });
        };
      } catch (error) {
        if (!disposed) {
          setSceneError(error instanceof Error ? error.message : "Не удалось открыть 3D-кабинет");
        }
      }
    }

    void startScene();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  function closePanel() {
    setPanel(null);
    actionRef.current("projects");
  }

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

      <section ref={stageRef} className={styles.stage}>
        <canvas ref={canvasRef} aria-label="Интерактивный кабинет Executive Space" />

        {loadProgress < 100 && !sceneError ? (
          <div className={styles.loader}>
            <span>СОБИРАЕМ КАБИНЕТ</span>
            <strong>{loadProgress}%</strong>
            <i><b style={{ width: `${loadProgress}%` }} /></i>
          </div>
        ) : null}

        {sceneError ? (
          <div className={styles.sceneError}>
            <strong>3D-сцена не загрузилась</strong>
            <span>{sceneError}</span>
          </div>
        ) : null}

        <section className={styles.summary}>
          <span>Сводка за сегодня</span>
          <div>
            <button onClick={() => activate("projects")}>
              <small>Проекты</small><strong>{activeProjects.length}</strong>
            </button>
            <button onClick={() => setToast("Каталог тестов откроется следующим модулем")}>
              <small>Тесты</small><strong>{workspace.projects.length * 2 + 18}</strong>
            </button>
            <button onClick={() => setToast("Баланс тестового кабинета")}>
              <small>Баланс</small><strong>{formatBalance(workspace.balanceKopeks)}</strong>
            </button>
            <button onClick={() => activate("ai")}>
              <small>AI-аналитик</small><strong>{workspace.aiEfficiency}%</strong>
            </button>
          </div>
        </section>

        <div className={styles.objectLabels} aria-hidden="true">
          <span className={styles.archiveLabel}>АРХИВ</span>
          <span className={styles.projectsLabel}>ПРОЕКТЫ</span>
          <span className={styles.aiLabel}>AI-АНАЛИТИК</span>
        </div>

        <aside className={styles.navigationHint}>
          <span>Навигация по пространству</span>
          <small>Нажимайте на предметы, чтобы открыть раздел</small>
        </aside>

        <nav className={styles.bottomNav}>
          <button className={styles.active}>Обзор</button>
          <button onClick={() => setToast("Календарь подготовлен для следующего этапа")}>Календарь</button>
          <button onClick={() => setToast("Новых уведомлений: 3")}>Уведомления <b>3</b></button>
        </nav>

        <button className={styles.settings} onClick={() => setToast("Настройки пространства сохранены локально")}>
          Настроить пространство
        </button>

        <div className={styles.toast} key={toast}>{toast}</div>

        {panel === "projects" ? (
          <section className={`${styles.bookPanel} ${styles.panelEnter}`} aria-label="Книга проектов">
            <button className={styles.close} onClick={closePanel} aria-label="Закрыть">×</button>
            <aside className={styles.bookFilters}>
              <span>ФИЛЬТРЫ</span>
              <button className={styles.selectedFilter}>Все проекты</button>
              <button>Активные</button>
              <button>На паузе</button>
              <button>Завершённые</button>
              <hr />
              <small>{workspace.projects.length} проектов в книге</small>
            </aside>
            <div className={styles.bookPage}>
              <header>
                <div>
                  <small>EXECUTIVE REGISTER</small>
                  <h2>Проекты</h2>
                </div>
                <button onClick={onCreateProject}>+ Создать проект</button>
              </header>
              <div className={styles.projectRows}>
                {workspace.projects.map((item, index) => (
                  <button
                    key={item.id}
                    className={index === selectedProject ? styles.selectedProject : ""}
                    onClick={() => setSelectedProject(index)}
                  >
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.folderTitle} · {item.participants} участников</small>
                    </span>
                    <span className={styles.projectStatus}>
                      <small>{item.status}</small>
                      <i><b style={{ width: `${item.progress}%` }} /></i>
                      <em>{item.progress}%</em>
                    </span>
                  </button>
                ))}
              </div>
              {project ? (
                <footer>
                  <span>Выбрано: <strong>{project.title}</strong></span>
                  <button>Открыть проект</button>
                </footer>
              ) : null}
            </div>
            <div className={styles.pageStack} aria-hidden="true"><i /><i /><i /></div>
          </section>
        ) : null}

        {panel === "archive" ? (
          <section className={`${styles.archivePanel} ${styles.panelEnter}`}>
            <button className={styles.close} onClick={() => setPanel(null)} aria-label="Закрыть">×</button>
            <span>АРХИВНЫЙ РЕЕСТР</span>
            <h2>{archivePage === 0 ? "Завершённые проекты" : "Документы и отчёты"}</h2>
            <div className={styles.archiveList}>
              {(archivedProjects.length ? archivedProjects : workspace.projects.slice(0, 3)).map((item) => (
                <article key={item.id}>
                  <strong>{item.title}</strong>
                  <small>{item.date} · {item.participants} участников</small>
                </article>
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
            <p>
              {project
                ? `Проект «${project.title}» выполнен на ${project.progress}%. Следующий приоритет: проверить незавершённые оценки и подготовить краткую управленческую сводку.`
                : "Создайте первый проект, чтобы получить рекомендации."}
            </p>
            <div>
              <article><small>Эффективность</small><strong>{workspace.aiEfficiency}%</strong></article>
              <article><small>Активных проектов</small><strong>{activeProjects.length}</strong></article>
            </div>
            <button className={styles.aiAction}>Открыть чат</button>
          </section>
        ) : null}
      </section>
    </main>
  );
}
