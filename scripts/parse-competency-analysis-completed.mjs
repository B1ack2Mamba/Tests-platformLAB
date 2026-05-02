import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const WORKBOOK_PATH = path.join(process.cwd(), "competency-analysis-completed.xlsx");
const OUTPUT_PATH = path.join(process.cwd(), "data", "competency-calibration", "completed-workbook.json");

const PYTHON_SCRIPT = String.raw`
import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

workbook_path = Path(r"""${WORKBOOK_PATH}""")
output_path = Path(r"""${OUTPUT_PATH}""")
ns = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

def col_to_index(ref: str) -> int:
    col = "".join(ch for ch in ref if ch.isalpha())
    index = 0
    for ch in col:
        index = index * 26 + ord(ch.upper()) - 64
    return index

with zipfile.ZipFile(workbook_path) as z:
    shared_strings = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("a:si", ns):
            shared_strings.append("".join(t.text or "" for t in si.iterfind(".//a:t", ns)).strip())

    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rel_map = {
        rel.attrib["Id"]: rel.attrib["Target"].lstrip("/")
        for rel in rels
        if rel.tag.endswith("Relationship") and rel.attrib.get("Id") and rel.attrib.get("Target")
    }

    workbook = ET.fromstring(z.read("xl/workbook.xml"))
    sheets = workbook.find("a:sheets", ns)
    parsed_sheets = {}

    for sheet in sheets:
        name = sheet.attrib.get("name", "")
        rid = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        target = rel_map.get(rid)
        if not target:
            continue

        root = ET.fromstring(z.read(target))
        rows = []
        for row in root.findall(".//a:sheetData/a:row", ns):
            values = []
            last_index = 0
            for cell in row.findall("a:c", ns):
                ref = cell.attrib.get("r", "A1")
                current_index = col_to_index(ref)
                while last_index + 1 < current_index:
                    values.append("")
                    last_index += 1

                value = ""
                cell_type = cell.attrib.get("t", "")
                if cell_type == "inlineStr":
                    value = "".join(t.text or "" for t in cell.iterfind(".//a:t", ns)).strip()
                else:
                    v = cell.find("a:v", ns)
                    if v is not None and v.text is not None:
                        if cell_type == "s":
                            value = shared_strings[int(v.text)] if v.text.isdigit() else ""
                        else:
                            value = v.text.strip()

                values.append(value)
                last_index = current_index

            rows.append(values)

        non_empty_rows = [row for row in rows if any(str(cell).strip() for cell in row)]
        if non_empty_rows:
            header = [cell if str(cell).strip() else f"column_{i+1}" for i, cell in enumerate(non_empty_rows[0])]
            body = []
            for row in non_empty_rows[1:]:
                entry = {}
                for i, key in enumerate(header):
                    entry[key] = row[i] if i < len(row) else ""
                if any(str(v).strip() for v in entry.values()):
                    body.append(entry)
        else:
            header = []
            body = []

        parsed_sheets[name] = {
            "target": target,
            "header": header,
            "rows": body,
        }

payload = {
    "source": workbook_path.name,
    "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    "sheets": parsed_sheets,
}

output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(str(output_path))
`;

function main() {
  if (!fs.existsSync(WORKBOOK_PATH)) {
    throw new Error(`Workbook not found: ${WORKBOOK_PATH}`);
  }
  execFileSync("python3", ["-c", PYTHON_SCRIPT], { stdio: "inherit" });
}

main();
