import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "samples");
fs.mkdirSync(outDir, { recursive: true });

const cleanTxt = `CONSTRUCTION CHANGE ORDER

Project Name: Harborview Medical Pavilion Expansion
Project Number: HMP-2024-118
Change Order Number: CO-007
Date Issued: March 14, 2025

Contractor: Apex Structural Contractors LLC
Address: 4800 Industrial Way, Suite 200, Seattle, WA 98108
Contact: Jordan Lee, Project Manager · jlee@apexstructural.example · (206) 555-0142

Client / Owner: Harborview Development Group
Address: 900 Yesler Way, Seattle, WA 98104
Contact: Priya Shah, Owner's Representative

Original Contract Amount: $4,250,000.00

Description of Requested Changes:
1. Furnish and install additional structural steel bracing at Level 3 mechanical penthouse per RFI-44.
2. Upgrade fireproofing thickness from 1-hour to 2-hour at columns C12–C18.
3. Deduct unused allowance for temporary winter enclosure (partial).

Reason for Change: Owner-directed design revision following AHJ review comments dated 2025-02-28.

CHANGE ITEMS
Item 1 | Addition | Structural steel bracing | Qty 1 LS | Unit Cost $48,500.00 | Amount $48,500.00
Item 2 | Addition | Fireproofing upgrade | Qty 2,400 SF | Unit Cost $6.25 | Amount $15,000.00
Item 3 | Deduction | Winter enclosure allowance credit | Qty 1 LS | Unit Cost $12,000.00 | Amount ($12,000.00)

Additional Costs: $63,500.00
Deductions: $12,000.00
Net Change: $51,500.00
Revised Contract Amount: $4,301,500.00

Schedule Impact: +7 calendar days

APPROVALS
Contractor: Jordan Lee · Signed: Yes · Date: 2025-03-14
Architect: Maya Chen, AIA · Signed: Yes · Date: 2025-03-15
Owner: Priya Shah · Signed: Yes · Date: 2025-03-18
`;

const messyTxt = `CHANGE ORDER / COR — DRAFT (internal)

proj: Riverside Elementary Modernization   # RE-19B
CO# ?  (maybe CO-03 or COR-12 — check email)

GC: Northline Builders
Owner: Riverside Unified School District

orig contract amt: 1,875,000
also says Original Contract Sum $1,875,000.00 elsewhere

Requested:
- Add gypsum wall assemblies in Corridor B (see sketch)
- delete millwork package MW-04
handwritten note: "owner wants alternate laminate — pricing TBD"

Adds: $22,400
Deducts: 8,750
Net ?? document shows Net Change $14,650 on page 1 but $13,650 on summary table

Revised: one place 1,889,650  another 1,888,650

days: "approx two weeks" / "10 working days?"

Signatures incomplete — architect blank
`;

const sparseTxt = `CHANGE REQUEST
Project: Westbrook Parking Structure
CR-002
Additional waterproofing at expansion joints.
Cost impact: $9,800
`;

function writePdf(filename, lines) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: "LETTER" });
    const stream = fs.createWriteStream(path.join(outDir, filename));
    doc.pipe(stream);
    doc.font("Helvetica-Bold").fontSize(16).text("CHANGE ORDER", { align: "left" });
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10);
    for (const line of lines) {
      if (line === "") doc.moveDown(0.4);
      else doc.text(line, { lineGap: 2 });
    }
    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

fs.writeFileSync(path.join(outDir, "change-order-clean.txt"), cleanTxt);
fs.writeFileSync(path.join(outDir, "change-order-messy.txt"), messyTxt);
fs.writeFileSync(path.join(outDir, "change-order-sparse.txt"), sparseTxt);

await writePdf("change-order-clean.pdf", [
  "Project Name: Harborview Medical Pavilion Expansion",
  "Project Number: HMP-2024-118",
  "Change Order Number: CO-007",
  "Date Issued: March 14, 2025",
  "",
  "Contractor: Apex Structural Contractors LLC",
  "4800 Industrial Way, Suite 200, Seattle, WA 98108",
  "Contact: Jordan Lee · (206) 555-0142",
  "",
  "Client: Harborview Development Group",
  "900 Yesler Way, Seattle, WA 98104",
  "Contact: Priya Shah",
  "",
  "Original Contract Amount: $4,250,000.00",
  "",
  "Description:",
  "1. Additional structural steel bracing at Level 3 penthouse (RFI-44) — $48,500.00",
  "2. Fireproofing upgrade columns C12–C18 — $15,000.00",
  "3. Deduct winter enclosure allowance — ($12,000.00)",
  "",
  "Additional Costs: $63,500.00",
  "Deductions: $12,000.00",
  "Net Change: $51,500.00",
  "Revised Contract Amount: $4,301,500.00",
  "Schedule Impact: +7 calendar days",
  "",
  "Approvals:",
  "Contractor: Jordan Lee — Signed 2025-03-14",
  "Architect: Maya Chen — Signed 2025-03-15",
  "Owner: Priya Shah — Signed 2025-03-18",
]);

await writePdf("change-order-conflict.pdf", [
  "CHANGE ORDER CO-03",
  "Project: Lakeside Office Tower Fit-Out",
  "Project No. LOT-FIT-09",
  "",
  "General Contractor: Meridian Interiors Inc.",
  "Owner: Lakeside REIT LLC",
  "",
  "Original Contract Amount: $920,000.00",
  "Also listed as Original Contract: $900,000 (cover sheet)",
  "",
  "Change Description:",
  "- Add AV rough-in for conference rooms 4–6: $18,200",
  "- Credit unused flooring allowance: $4,000",
  "",
  "Additional Costs: $18,200.00",
  "Deductions: $4,000.00",
  "Net Change (body): $14,200.00",
  "Net Change (footer stamp): $16,200.00",
  "Revised Contract Amount: $934,200.00",
  "",
  "Schedule Impact: 3 days",
  "Owner signature: pending",
]);

await writePdf("change-order-minimal.pdf", [
  "COR-11",
  "Site: Eastgate Warehouse Phase 2",
  "Add concrete equipment pad near dock 3.",
  "Amount: $3,450",
  "Days: 1",
]);

console.log("Wrote samples to", outDir);
