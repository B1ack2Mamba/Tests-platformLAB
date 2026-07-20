import fs from "node:fs";
import path from "node:path";

function readGlbJson(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString("utf8", 0, 4) !== "glTF") {
    throw new Error(`${file}: not a binary glTF file`);
  }

  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString("utf8", offset + 4, offset + 8);
    if (type === "JSON") {
      return {
        bytes: buffer.length,
        json: JSON.parse(buffer.toString("utf8", offset + 8, offset + 8 + length)),
      };
    }
    offset += 8 + length;
  }
  throw new Error(`${file}: JSON chunk not found`);
}

function inspect(file) {
  const { bytes, json } = readGlbJson(file);
  let vertices = 0;
  let triangles = 0;
  let primitives = 0;

  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      primitives += 1;
      const position = json.accessors?.[primitive.attributes?.POSITION];
      const indices = json.accessors?.[primitive.indices];
      vertices += position?.count ?? 0;
      const elementCount = indices?.count ?? position?.count ?? 0;
      const mode = primitive.mode ?? 4;
      if (mode === 4) triangles += Math.floor(elementCount / 3);
      if (mode === 5 || mode === 6) triangles += Math.max(0, elementCount - 2);
    }
  }

  return {
    file: path.basename(file),
    megabytes: Number((bytes / 1024 / 1024).toFixed(2)),
    vertices,
    triangles,
    meshes: json.meshes?.length ?? 0,
    primitives,
    materials: json.materials?.length ?? 0,
    textures: json.textures?.length ?? 0,
    images: json.images?.length ?? 0,
    nodes: json.nodes?.length ?? 0,
    skins: json.skins?.length ?? 0,
    joints: (json.skins ?? []).reduce((sum, skin) => sum + (skin.joints?.length ?? 0), 0),
    animations: json.animations?.length ?? 0,
    extensions: json.extensionsUsed ?? [],
  };
}

const files = process.argv.slice(2);
if (files.length === 0) throw new Error("Pass one or more GLB paths");
console.log(JSON.stringify(files.map(inspect), null, 2));
