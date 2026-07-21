import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const apiKey = process.env.MESHY_API_KEY;
if (!apiKey) throw new Error("MESHY_API_KEY is required");

const root = process.cwd();
const projectDir = path.join(root, "design", "executive-desk-meshy-v1");
const source = path.join(projectDir, "references", "executive-desk.png");
const prepared = path.join(projectDir, "prepared", "executive-desk.png");
const modelDir = path.join(projectDir, "models");
const destination = path.join(modelDir, "executive-desk.glb");
const taskFile = path.join(modelDir, "meshy-task.json");

fs.mkdirSync(path.dirname(prepared), { recursive: true });
fs.mkdirSync(modelDir, { recursive: true });

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
      if (!response.ok) throw new Error(`${response.status}: ${body.message ?? raw}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
    }
  }
  throw lastError;
}

await sharp(source)
  .trim({ background: "#eeeae5", threshold: 10 })
  .extend({ top: 80, right: 80, bottom: 80, left: 80, background: "#eeeae5" })
  .resize(1024, 1024, { fit: "contain", background: "#eeeae5" })
  .png()
  .toFile(prepared);

let taskLog = fs.existsSync(taskFile) ? JSON.parse(fs.readFileSync(taskFile, "utf8")) : {};
let id = taskLog.id;
if (!id) {
  const imageUrl = `data:image/png;base64,${fs.readFileSync(prepared).toString("base64")}`;
  const created = await api("/openapi/v1/image-to-3d", {
    method: "POST",
    body: JSON.stringify({
      image_url: imageUrl,
      model_type: "smart-topology",
      ai_model: "meshy-t2",
      should_texture: true,
      enable_pbr: true,
      target_polycount: 15000,
      target_formats: ["glb"],
      auto_size: true,
      origin_at: "bottom",
      multi_view_thumbnails: true,
    }),
  });
  id = created.result;
  taskLog = { id, target_polycount: 15000 };
  fs.writeFileSync(taskFile, `${JSON.stringify(taskLog, null, 2)}\n`);
}

let task;
for (;;) {
  task = await api(`/openapi/v1/image-to-3d/${id}`);
  console.log(`executive-desk: ${task.status} ${task.progress ?? 0}%`);
  if (task.status === "SUCCEEDED") break;
  if (["FAILED", "CANCELED"].includes(task.status)) {
    throw new Error(task.task_error?.message ?? task.status);
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

const response = await fetch(task.model_urls.glb);
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
fs.writeFileSync(destination, bytes);
fs.writeFileSync(taskFile, `${JSON.stringify({ ...taskLog, status: task.status, consumed_credits: task.consumed_credits, bytes: bytes.length }, null, 2)}\n`);
console.log(`executive-desk: ${bytes.length} bytes`);
