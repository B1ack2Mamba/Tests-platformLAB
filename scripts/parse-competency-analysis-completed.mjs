import fs from "fs";
import path from "path";
import yauzl from "yauzl";

const WORKBOOK_PATH = path.join(process.cwd(), "competency-analysis-completed.xlsx");
const OUTPUT_PATH = path.join(process.cwd(), "data", "competency-calibration", "completed-workbook.json");

function readZipEntry(zipPath, target) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error);
      let found = false;
      zip.readEntry();
      zip.on("entry", (entry) => {
        if (entry.fileName === target) {
          found = true;
          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError) return reject(streamError);
            const chunks = [];
            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
            stream.on("error", reject);
          });
        } else {
          zip.readEntry();
        }
      });
      zip.on("end", () => {
        if (!found) reject(new Error(`Entry not found: ${target}`));
      });
      zip.on("error", reject);
    });
  });
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#xA;|&#10;/g, "\n")
    .replace(/&#13;/g, "");
}

function stripTags(value) {
  return decodeXml(String(value || "").replace(/<rPh[\s\S]*?<\/rPh>/g, "").replace(/<[^>]+>/g, ""));
}

function parseAttributes(tag) {
  const attrs = {};
  for (const match of String(tag || "").matchAll(/([A-Za-z:]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function colToNumber(col) {
  let value = 0;
  for (const char of col) value = value * 26 + (char.charCodeAt(0) - 64);
  return value;
}

function normalizeCell(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function parseSharedStrings() {
  const xml = await readZipEntry(WORKBOOK_PATH, "xl/sharedStrings.xml");
  return [...xml.matchAll(/<si(?:[^>]*)>([\s\S]*?)<\/si>/g)].map((match) => stripTags(match[1]));
}

async function parseWorkbookSheetTargets() {
  const workbookXml = await readZipEntry(WORKBOOK_PATH, "xl/workbook.xml");
  const relsXml = await readZipEntry(WORKBOOK_PATH, "xl/_rels/workbook.xml.rels");
  const relTargets = new Map();
  for (const rel of relsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attrs = parseAttributes(rel[1]);
    if (attrs.Id && attrs.Target) relTargets.set(attrs.Id, `xl/${attrs.Target.replace(/^\/+/, "")}`);
  }
  const sheets = [];
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const attrs = parseAttributes(match[1]);
    const target = relTargets.get(attrs["r:id"]);
    if (target) sheets.push({ name: attrs.name, target });
  }
  return sheets;
}

async function parseSheetRows(target, sharedStrings) {
  const xml = await readZipEntry(WORKBOOK_PATH, target);
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = parseAttributes(cellMatch[1]);
      const ref = attrs.r || "A1";
      const col = (ref.match(/[A-Z]+/) || ["A"])[0];
      const colNumber = colToNumber(col);
      const type = attrs.t || "";
      const fragment = cellMatch[2];
      const valueMatch = fragment.match(/<v>([\s\S]*?)<\/v>/);
      const inlineMatch = fragment.match(/<is>([\s\S]*?)<\/is>/);
      let value = "";
      if (type === "s" && valueMatch) {
        value = sharedStrings[Number(valueMatch[1])] || "";
      } else if (type === "inlineStr" && inlineMatch) {
        value = stripTags(inlineMatch[1]);
      } else if (valueMatch) {
        value = stripTags(valueMatch[1]);
      }
      cells.push({ colNumber, value: normalizeCell(value) });
    }
    const ordered = cells.sort((a, b) => a.colNumber - b.colNumber);
    const row = [];
    let lastCol = 0;
    for (const cell of ordered) {
      while (lastCol + 1 < cell.colNumber) {
        row.push("");
        lastCol += 1;
      }
      row.push(cell.value);
      lastCol = cell.colNumber;
    }
    rows.push(row);
  }
  return rows;
}

function rowsToObjects(rows) {
  const filtered = rows.filter((row) => row.some((cell) => cell));
  if (!filtered.length) return { header: [], rows: [] };
  const [header, ...body] = filtered;
  const normalizedHeader = header.map((item, index) => item || `column_${index + 1}`);
  const objectRows = body
    .map((row) => {
      const entry = {};
      normalizedHeader.forEach((key, index) => {
        entry[key] = row[index] || "";
      });
      return entry;
    })
    .filter((row) => Object.values(row).some(Boolean));
  return { header: normalizedHeader, rows: objectRows };
}

async function main() {
  const sharedStrings = await parseSharedStrings();
  const sheets = await parseWorkbookSheetTargets();
  const parsedSheets = {};

  for (const sheet of sheets) {
    const rows = await parseSheetRows(sheet.target, sharedStrings);
    parsedSheets[sheet.name] = {
      target: sheet.target,
      ...rowsToObjects(rows),
    };
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        source: path.basename(WORKBOOK_PATH),
        generated_at: new Date().toISOString(),
        sheets: parsedSheets,
      },
      null,
      2
    )
  );

  console.log(OUTPUT_PATH);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
