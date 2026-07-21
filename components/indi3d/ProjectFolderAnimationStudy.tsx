import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import styles from "../../styles/IndiProjectFolderStudy.module.css";

type Timeline = {
  from: number;
  to: number;
  startedAt: number;
  durationMs: number;
};

const PHASES = [
  { at: 0, label: "Ожидание" },
  { at: 0.14, label: "Фокус камеры" },
  { at: 0.25, label: "Защёлка" },
  { at: 0.42, label: "Ремешок" },
  { at: 0.58, label: "Обложка" },
  { at: 0.76, label: "Страницы" },
  { at: 0.96, label: "Проекты открыты" },
];

function smoothstep(value: number) {
  return value * value * (3 - 2 * value);
}

function makeCoverInterface() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1280;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.fillStyle = "#d8b878";
  context.strokeStyle = "rgba(216,184,120,.65)";
  context.lineWidth = 5;
  context.strokeRect(245, 172, 534, 720);

  context.font = "600 52px Georgia";
  context.letterSpacing = "8px";
  context.fillText("ПРОЕКТЫ", 512, 418);

  context.font = "500 26px Georgia";
  context.textAlign = "left";
  context.fillStyle = "#d7c7a8";
  context.fillText("12 активных", 445, 548);
  context.fillText("4 на паузе", 445, 616);

  context.beginPath();
  context.fillStyle = "#62a875";
  context.arc(400, 540, 11, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.fillStyle = "#d39a4c";
  context.arc(400, 608, 11, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(216,184,120,.55)";
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(326, 706, 372, 92, 18);
  context.stroke();
  context.font = "500 25px Georgia";
  context.textAlign = "center";
  context.fillStyle = "#d7c7a8";
  context.fillText("ОТКРЫТЬ ПРОЕКТЫ", 512, 765);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeSurfaceTexture(kind: "leather" | "wood") {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const noise = seed - Math.floor(seed);
      const grain = kind === "wood"
        ? Math.sin(y * 0.055 + Math.sin(x * 0.018) * 2.4) * 0.5 + 0.5
        : noise;
      const pore = kind === "leather" && noise > 0.965 ? 0.42 : 1;
      const base = kind === "wood" ? [58, 27, 14] : [42, 25, 18];
      const variance = kind === "wood" ? grain * 34 + noise * 8 : noise * 16;
      image.data[index] = Math.round((base[0] + variance) * pore);
      image.data[index + 1] = Math.round((base[1] + variance * 0.42) * pore);
      image.data[index + 2] = Math.round((base[2] + variance * 0.22) * pore);
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "wood" ? 1.4 : 3.2, kind === "wood" ? 3.4 : 4.0);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const PROJECTS = [
  { title: "Альфа", subtitle: "Внедрение платформы", owner: "Алексей Иванов", status: "Активный", progress: 94, tone: "green" },
  { title: "Orion", subtitle: "Исследование рынка", owner: "Мария Смирнова", status: "На паузе", progress: 52, tone: "amber" },
  { title: "Nova", subtitle: "Разработка продукта", owner: "Дмитрий Волков", status: "Активный", progress: 68, tone: "green" },
  { title: "Север", subtitle: "Оптимизация процессов", owner: "Екатерина Орлова", status: "На согласовании", progress: 37, tone: "blue" },
];

export default function ProjectFolderAnimationStudy() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const durationRef = useRef(1);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const guidedCameraRef = useRef(true);
  const frameRef = useRef(0);
  const lastUiUpdateRef = useRef(0);

  const [loadProgress, setLoadProgress] = useState(0);
  const [sceneError, setSceneError] = useState("");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [cameraGuided, setCameraGuided] = useState(true);
  const [projectQuery, setProjectQuery] = useState("");

  const phase = [...PHASES].reverse().find((item) => progress >= item.at)?.label || PHASES[0].label;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090807);
    scene.fog = new THREE.Fog(0x090807, 13, 27);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(7.6, 8.1, 10.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    mount.appendChild(renderer.domElement);

    const environmentGenerator = new THREE.PMREMGenerator(renderer);
    const environment = environmentGenerator.fromScene(new RoomEnvironment(), 0.035).texture;
    scene.environment = environment;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.minDistance = 7.4;
    controls.maxDistance = 16;
    controls.minPolarAngle = Math.PI * 0.19;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, 0.65, 0.1);
    controlsRef.current = controls;

    const stopGuidedCamera = () => {
      guidedCameraRef.current = false;
      setCameraGuided(false);
    };
    controls.addEventListener("start", stopGuidedCamera);

    scene.add(new THREE.HemisphereLight(0xe8c993, 0x100805, 1.45));
    const key = new THREE.SpotLight(0xffd99d, 54, 30, Math.PI * 0.24, 0.62, 1.15);
    key.position.set(-4.5, 11, 6.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.SpotLight(0xb56b35, 46, 26, Math.PI * 0.28, 0.7, 1.2);
    rim.position.set(8, 5, -7);
    scene.add(rim);
    const fill = new THREE.PointLight(0x6c88aa, 10, 15, 1.7);
    fill.position.set(-5, 3, -5);
    scene.add(fill);

    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x170d08, roughness: 0.46, metalness: 0.04 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(42, 28), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.14;
    ground.receiveShadow = true;
    scene.add(ground);

    const brassLineMaterial = new THREE.MeshStandardMaterial({ color: 0x6c3b15, roughness: 0.34, metalness: 0.78 });
    for (const z of [-5.6, 5.6]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(18, 0.035, 0.025), brassLineMaterial);
      line.position.set(0, -0.1, z);
      scene.add(line);
    }

    const loader = new GLTFLoader();
    loader.load(
      "/indi-3d/models/executive-project-folder.glb",
      (gltf) => {
        const model = gltf.scene;
        modelRef.current = model;
        const leatherTexture = makeSurfaceTexture("leather");
        const woodTexture = makeSurfaceTexture("wood");
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = true;
          object.receiveShadow = true;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (!(material instanceof THREE.MeshStandardMaterial)) return;
            const name = material.name.toLowerCase();
            if (name.includes("leather")) {
              material.map = leatherTexture;
              material.bumpMap = leatherTexture;
              material.bumpScale = 0.018;
              material.roughness = 0.58;
              material.color.set(0xffffff);
            } else if (name.includes("walnut")) {
              material.map = woodTexture;
              material.bumpMap = woodTexture;
              material.bumpScale = 0.028;
              material.roughness = 0.4;
              material.color.set(0xffffff);
            }
            material.needsUpdate = true;
          });
        });

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.position.y += 0.55;
        model.rotation.y = -0.04;

        const cover = model.getObjectByName("Front_Cover") as THREE.Mesh | undefined;
        const texture = makeCoverInterface();
        if (cover && texture) {
          const interfacePlane = new THREE.Mesh(
            new THREE.PlaneGeometry(3.72, 4.55),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
          );
          interfacePlane.name = "Crisp_Cover_Interface";
          interfacePlane.position.set(0, 0, 0.071);
          interfacePlane.renderOrder = 4;
          cover.add(interfacePlane);
        }

        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
        durationRef.current = Math.max(...gltf.animations.map((clip) => clip.duration), 1);
        for (const clip of gltf.animations) {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
        }
        mixer.setTime(0);
        scene.add(model);
        setLoadProgress(100);
      },
      (event) => {
        if (event.total) setLoadProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      },
      () => setSceneError("Не удалось загрузить экспериментальную 3D-модель."),
    );

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const renderStartedAt = performance.now();
    const render = () => {
      frameRef.current = window.requestAnimationFrame(render);
      const elapsed = (performance.now() - renderStartedAt) / 1000;
      const timeline = timelineRef.current;

      if (timeline && mixerRef.current) {
        const raw = Math.min(1, (performance.now() - timeline.startedAt) / timeline.durationMs);
        const eased = smoothstep(raw);
        const currentTime = THREE.MathUtils.lerp(timeline.from, timeline.to, eased);
        mixerRef.current.setTime(currentTime);

        if (performance.now() - lastUiUpdateRef.current > 40 || raw === 1) {
          setProgress(currentTime / durationRef.current);
          lastUiUpdateRef.current = performance.now();
        }
        if (raw === 1) {
          timelineRef.current = null;
          setPlaying(false);
        }
      }

      const currentProgress = mixerRef.current ? mixerRef.current.time / durationRef.current : 0;
      if (guidedCameraRef.current) {
        const cameraEase = smoothstep(Math.min(1, currentProgress / 0.62));
        const desired = new THREE.Vector3(
          THREE.MathUtils.lerp(7.6, 5.8, cameraEase),
          THREE.MathUtils.lerp(8.1, 6.6, cameraEase),
          THREE.MathUtils.lerp(10.2, 9.0, cameraEase),
        );
        camera.position.lerp(desired, 0.035);
      }

      if (modelRef.current && !timelineRef.current && currentProgress < 0.04) {
        modelRef.current.rotation.z = Math.sin(elapsed * 0.7) * 0.004;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      controls.removeEventListener("start", stopGuidedCamera);
      controls.dispose();
      renderer.dispose();
      environment.dispose();
      environmentGenerator.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          const withMap = material as THREE.Material & { map?: THREE.Texture };
          withMap.map?.dispose();
          material.dispose();
        });
      });
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      mixerRef.current = null;
      modelRef.current = null;
    };
  }, []);

  const animateTo = (targetProgress: number, seconds?: number) => {
    if (!mixerRef.current) return;
    const from = mixerRef.current.time;
    const to = THREE.MathUtils.clamp(targetProgress, 0, 1) * durationRef.current;
    timelineRef.current = {
      from,
      to,
      startedAt: performance.now(),
      durationMs: (seconds ?? Math.max(0.65, Math.abs(to - from) * 0.95)) * 1000,
    };
    setPlaying(true);
  };

  const resetCamera = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(7.6, 8.1, 10.2);
    controls.target.set(0, 0.65, 0.1);
    controls.update();
    guidedCameraRef.current = true;
    setCameraGuided(true);
  };

  const runFullDemo = () => {
    if (!mixerRef.current) return;
    if (mixerRef.current.time / durationRef.current > 0.94) {
      mixerRef.current.setTime(0);
      setProgress(0);
    }
    animateTo(1, 6.35);
  };

  const visibleProjects = PROJECTS.filter((project) => {
    const query = projectQuery.trim().toLocaleLowerCase("ru-RU");
    if (!query) return true;
    return `${project.title} ${project.subtitle} ${project.owner}`.toLocaleLowerCase("ru-RU").includes(query);
  });

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>ЛК</span>
          <div><strong>Лаборатория движения</strong><small>Indi · исследование одной детали</small></div>
        </div>
        <span className={styles.experimental}>3D MOTION STUDY 01</span>
      </header>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>EXECUTIVE OBJECT</span>
          <h1>Папка проектов<br />как интерфейс</h1>
          <p>Одна модель, шесть связанных движений и данные, закреплённые непосредственно на кожаной обложке.</p>
        </div>

        <div className={styles.stageShell}>
          <div ref={mountRef} className={styles.stage} aria-label="Интерактивная 3D-папка проектов" />
          {loadProgress < 100 && !sceneError ? (
            <div className={styles.loader}><span>Собираем механизм</span><strong>{loadProgress}%</strong></div>
          ) : null}
          {sceneError ? <div className={styles.error}>{sceneError}</div> : null}

          <div className={styles.phaseBadge}><span>Текущая фаза</span><strong>{phase}</strong></div>
          <div className={styles.dragHint}><span>↔</span> Потяните, чтобы осмотреть</div>

          <div className={styles.timeline}>
            <div className={styles.timelineTrack}><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <div className={styles.phaseTicks}>
              {PHASES.slice(1).map((item) => <span key={item.label} className={progress >= item.at ? styles.phaseActive : ""}>{item.label}</span>)}
            </div>
          </div>

          <section className={`${styles.projectWorkspace} ${progress > 0.90 ? styles.projectWorkspaceVisible : ""}`} aria-hidden={progress <= 0.90}>
            <header>
              <div><span className={styles.folderGlyph}>▰</span><strong>Проекты</strong><small>12 активных</small></div>
              <button>+ Создать проект</button>
            </header>
            <div className={styles.projectToolbar}>
              <label><span>⌕</span><input value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="Поиск проектов..." /></label>
              <button>Фильтры</button><button>Сортировка</button>
            </div>
            <div className={styles.projectTable}>
              <div className={styles.projectTableHead}><span>Проект</span><span>Статус</span><span>Владелец</span><span>Прогресс</span></div>
              {visibleProjects.map((project) => (
                <button className={styles.projectRow} key={project.title}>
                  <span><strong>{project.title}</strong><small>{project.subtitle}</small></span>
                  <span><i className={styles[`tone_${project.tone}`]} />{project.status}</span>
                  <span>{project.owner}</span>
                  <span><strong>{project.progress}%</strong><em><i style={{ width: `${project.progress}%` }} /></em></span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.controls}>
          <span className={styles.controlLabel}>Управление сценой</span>
          <button className={styles.primaryButton} disabled={loadProgress < 100 || playing} onClick={runFullDemo}>
            <span>{progress > 0.94 ? "Повторить демонстрацию" : "Запустить демонстрацию"}</span><i>▶</i>
          </button>
          <div className={styles.controlGrid}>
            <button disabled={loadProgress < 100 || playing} onClick={() => animateTo(0.56)}><span>Открыть</span><small>обложку</small></button>
            <button disabled={loadProgress < 100 || playing} onClick={() => animateTo(1)}><span>Листать</span><small>страницы</small></button>
            <button disabled={loadProgress < 100 || playing} onClick={() => animateTo(0)}><span>Закрыть</span><small>механизм</small></button>
            <button onClick={resetCamera}><span>Камера</span><small>{cameraGuided ? "ведомая" : "вернуть"}</small></button>
          </div>
          <div className={styles.motionNotes}>
            <div><strong>6,3 сек</strong><span>полный цикл</span></div>
            <div><strong>6 дорожек</strong><span>синхронно</span></div>
            <div><strong>1,7 МБ</strong><span>модель</span></div>
          </div>
        </aside>
      </section>
    </main>
  );
}
