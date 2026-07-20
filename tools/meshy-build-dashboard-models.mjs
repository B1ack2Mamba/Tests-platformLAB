import fs from "node:fs";
import path from "node:path";

const apiKey = process.env.MESHY_API_KEY;
if (!apiKey) throw new Error("MESHY_API_KEY is required");

const root = process.cwd();
const outputDir = path.join(root, "design", "meshy-dashboard-models");
const finalWebDir = path.join(outputDir, "web");
const taskFile = path.join(outputDir, "meshy-tasks.json");
fs.mkdirSync(outputDir, { recursive: true });

const taskLog = fs.existsSync(taskFile)
  ? JSON.parse(fs.readFileSync(taskFile, "utf8"))
  : {};

function saveTaskLog() {
  fs.writeFileSync(taskFile, `${JSON.stringify(taskLog, null, 2)}\n`);
}

function dataUri(file, mimeType = "application/octet-stream") {
  return `data:${mimeType};base64,${fs.readFileSync(file).toString("base64")}`;
}

async function api(route, options = {}) {
  const response = await fetch(`https://api.meshy.ai${route}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${route}: ${body.message ?? text}`);
  }
  return body;
}

async function poll(route, id, label) {
  let lastProgress = -1;
  for (;;) {
    const task = await api(`${route}/${id}`);
    if (task.progress !== lastProgress) {
      console.log(`${label}: ${task.status} ${task.progress ?? 0}%`);
      lastProgress = task.progress;
    }
    if (task.status === "SUCCEEDED") return task;
    if (["FAILED", "CANCELED"].includes(task.status)) {
      throw new Error(`${label}: ${task.status}: ${task.task_error?.message ?? "unknown error"}`);
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

async function buildImageAsset(asset) {
  const name = `web-${asset.name}`;
  const destination = path.join(outputDir, asset.output);
  const finalDestination = path.join(finalWebDir, asset.output);
  if (fs.existsSync(finalDestination)) {
    console.log(`${name}: final web model already exists`);
    return;
  }
  if (fs.existsSync(destination)) {
    console.log(`${name}: already downloaded`);
    return;
  }

  let taskId = taskLog[name]?.id;
  if (!taskId) {
    const source = path.join(root, "design", "meshy-dashboard-assets", asset.source);
    console.log(`${name}: creating Smart Topology model`);
    const created = await api("/openapi/v1/image-to-3d", {
      method: "POST",
      body: JSON.stringify({
        image_url: dataUri(source, "image/png"),
        model_type: "smart-topology",
        ai_model: "meshy-t2",
        should_texture: true,
        enable_pbr: false,
        target_polycount: asset.polygons,
        target_formats: ["glb"],
        auto_size: true,
        origin_at: "bottom",
        multi_view_thumbnails: true,
      }),
    });
    taskId = created.result;
    taskLog[name] = {
      id: taskId,
      type: "image-to-3d-smart-topology",
      target_polycount: asset.polygons,
      source: asset.source,
    };
    saveTaskLog();
  }

  const task = await poll("/openapi/v1/image-to-3d", taskId, name);
  const bytes = await download(task.model_urls.glb, destination);
  taskLog[name] = {
    ...taskLog[name],
    status: task.status,
    consumed_credits: task.consumed_credits,
    output: asset.output,
    bytes,
  };
  saveTaskLog();
}

async function buildCharacter() {
  const name = "ai-analyst-character";
  const destination = path.join(outputDir, "ai-analyst-character.glb");
  const finalRigDestination = path.join(finalWebDir, "ai-analyst-rigged.glb");
  if (fs.existsSync(finalRigDestination)) {
    console.log("ai-analyst-rigged: final web model already exists");
    return;
  }
  let taskId = taskLog[name]?.id;

  if (!fs.existsSync(destination)) {
    if (!taskId) {
      const imageFiles = [
        "01-ai-analyst-tpose-front.png",
        "01-ai-analyst-tpose-left-profile.png",
        "01-ai-analyst-tpose-back.png",
        "01-ai-analyst-tpose-front-3q.png",
      ].map((file) => path.join(root, "design", "meshy-dashboard-assets", file));
      console.log(`${name}: uploading four views`);
      const created = await api("/openapi/v1/multi-image-to-3d", {
        method: "POST",
        body: JSON.stringify({
          image_urls: imageFiles.map((file) => dataUri(file, "image/png")),
          ai_model: "meshy-6",
          should_texture: true,
          enable_pbr: true,
          should_remesh: true,
          topology: "triangle",
          target_polycount: 60000,
          pose_mode: "t-pose",
          target_formats: ["glb"],
          auto_size: true,
          origin_at: "bottom",
          multi_view_thumbnails: true,
        }),
      });
      taskId = created.result;
      taskLog[name] = { id: taskId, type: "multi-image-to-3d", target_polycount: 60000 };
      saveTaskLog();
    }

    const task = await poll("/openapi/v1/multi-image-to-3d", taskId, name);
    const bytes = await download(task.model_urls.glb, destination);
    taskLog[name] = {
      ...taskLog[name],
      status: task.status,
      consumed_credits: task.consumed_credits,
      output: path.basename(destination),
      bytes,
    };
    saveTaskLog();
  }

  const rigName = "ai-analyst-rigged";
  const rigDestination = path.join(outputDir, "ai-analyst-rigged.glb");
  if (fs.existsSync(rigDestination)) {
    console.log(`${rigName}: already downloaded`);
    return;
  }

  let rigTaskId = taskLog[rigName]?.id;
  if (!rigTaskId) {
    console.log(`${rigName}: creating skeleton`);
    const created = await api("/openapi/v1/rigging", {
      method: "POST",
      body: JSON.stringify({
        model_url: dataUri(destination, "model/gltf-binary"),
        height_meters: 1.72,
      }),
    });
    rigTaskId = created.result;
    taskLog[rigName] = {
      id: rigTaskId,
      type: "rigging",
      source: path.basename(destination),
    };
    saveTaskLog();
  }

  const rigTask = await poll("/openapi/v1/rigging", rigTaskId, rigName);
  const bytes = await download(rigTask.result.rigged_character_glb_url, rigDestination);
  taskLog[rigName] = {
    ...taskLog[rigName],
    status: rigTask.status,
    consumed_credits: rigTask.consumed_credits,
    output: path.basename(rigDestination),
    bytes,
  };
  saveTaskLog();
}

const imageAssets = [
  {
    name: "folder-organizer",
    source: "03-folder-organizer.png",
    output: "folder-organizer-web.glb",
    polygons: 12000,
  },
  {
    name: "balance-wallet",
    source: "05-balance-wallet.png",
    output: "balance-wallet-web.glb",
    polygons: 10000,
  },
  {
    name: "command-button",
    source: "04-command-button.png",
    output: "command-button-web.glb",
    polygons: 6000,
  },
  {
    name: "project-display-frame",
    source: "06-project-display-frame.png",
    output: "project-display-frame-web.glb",
    polygons: 8000,
  },
  {
    name: "archive-binder-open",
    source: "02-archive-binder-open.png",
    output: "archive-binder-open-web.glb",
    polygons: 15000,
  },
  {
    name: "ai-smart-glass-frame",
    source: "07-ai-smart-glass-frame.png",
    output: "ai-smart-glass-frame-web.glb",
    polygons: 8000,
  },
  {
    name: "archive-binder-closed",
    source: "08-archive-binder-closed.png",
    output: "archive-binder-closed-web.glb",
    polygons: 10000,
  },
  {
    name: "project-folder",
    source: "09-project-folder.png",
    output: "project-folder-web.glb",
    polygons: 5000,
  },
];

for (const asset of imageAssets) await buildImageAsset(asset);
await buildCharacter();
console.log("Meshy dashboard model build completed");
