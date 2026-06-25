import { requireUser } from "@/lib/auth";
import { buildCatalogWorkbookBuffer, catalogExportFilename, loadCatalogIndex } from "@/lib/catalog/master";

export async function GET() {
  await requireUser(["OWNER"]);
  const index = await loadCatalogIndex();
  const buffer = await buildCatalogWorkbookBuffer(index);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${catalogExportFilename()}"`
    }
  });
}
