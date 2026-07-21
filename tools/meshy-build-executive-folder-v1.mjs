import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const apiKey = process.env.MESHY_API_KEY;
if (!apiKey) throw new Error("MESHY_API_KEY is required");

const root = process.cwd();
const projectDir = path.join(root, "design", "executive-folder-meshy-v1");
const referenceDir = path.join(projectDir, "references");
const preparedDir = path.join(projectDir, "prepared");
const modelDir = path.join(projectDir, "models");
const taskFile = path.join(modelDir, "meshy-tasks.json");

fs.mkdirSync(preparedDir, { recursive: true });
fs.mkdirSync(modelDir, { recursive: true });

const taskLog = fs.existsSync(taskFile) ? JSON.parse(fs.readFileSync(taskFile, "utf8")) : {};
const assets = [
  { name: "front-cover", source: "front-cover.png", polycount: 15000 },
  { name: "open-shell", source: "open-shell.png", polycount: 15000 },
  { name: "clasp-strap", source: "clasp-strap.png", polycount: 12000 },
  { name: "filter-panel", source: "filter-panel.png", polycount: 14000 },
];

function saveTaskLog() {
  fs.writeFileSync(taskFile, `${JSON.stringify(taskLog, null, 2)}\n`);
}

function dataUri(file) {
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

async function api(route, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(`https://api.meshy.ai${route}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
      });
      const raw = await response.text();
      const body = raw ? JSON.parse(raw) : {};
      if (!response.ok) throw new Error(`${response.status} ${route}: ${body.message ?? raw}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      console.log(`Meshy connection retry ${attempt}/3 for ${route}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
    }
  }
  throw lastError;
}

async function prepare(asset) {
  const source = path.join(referenceDir, asset.source);
  const destination = path.join(preparedDir, asset.source);
  await sharp(source)
    .trim({ background: "#eee9e2", threshold: 12 })
    .extend({ top: 96, right: 96, bottom: 96, left: 96, background: "#eee9e2" })
    .resize(1024, 1024, { fit: "contain", background: "#eee9e2" })
    .png()
    .toFile(destination);
  return destination;
}

async function poll(id, name) {
  let previousProgress = -1;
  for (;;) {
    const task = await api(`/openapi/v1/image-to-3d/${id}`);
    if (task.progress !== previousProgress) {
      console.log(`${name}: ${task.status} ${task.progress ?? 0}%`);
      previousProgress = task.progress;
    }
    if (task.status === "SUCCEEDED") return task;
    if (["FAILED", "CANCELED"].includes(task.status)) {
      throw new Error(`${name}: ${task.status}: ${task.task_error?.message ?? "unknown error"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${destination}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, bytes);
  return bytes.length;
}

async function build(asset) {
  const destination = path.join(modelDir, `${asset.name}.glb`);
  if (fs.existsSync(destination)) {
    console.log(`${asset.name}: already downloaded`);
    return;
  }

  const prepared = await prepare(asset);
  let id = taskLog[asset.name]?.id;
  if (!id) {
    const created = await api("/openapi/v1/image-to-3d", {
      method: "POST",
      body: JSON.stringify({
        image_url: dataUri(prepared),
        model_type: "smart-topology",
        ai_model: "meshy-t2",
        should_texture: true,
        enable_pbr: true,
        target_polycount: asset.polycount,
        target_formats: ["glb"],
        auto_size: true,
        origin_at: "bottom",
        multi_view_thumbnails: true,
      }),
    });
    id = created.result;
    taskLog[asset.name] = { id, source: asset.source, target_polycount: asset.polycount };
    saveTaskLog();
  }

  const task = await poll(id, asset.name);
  const bytes = await download(task.model_urls.glb, destination);
  taskLog[asset.name] = {
    ...taskLog[asset.name],
    status: task.status,
    consumed_credits: task.consumed_credits,
    bytes,
  };
  saveTaskLog();
}

for (const asset of assets) await build(asset);
console.log("Executive folder Meshy parts completed");
