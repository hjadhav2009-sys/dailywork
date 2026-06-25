"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { saveCatalogMaster } from "@/lib/catalog/master";
import { getRequestMeta } from "@/lib/request-context";

const maxCatalogUploadBytes = 25 * 1024 * 1024;

export async function importCatalogMasterAction(formData: FormData) {
  const user = await requireUser(["OWNER"]);
  const request = await getRequestMeta();
  const file = formData.get("catalogFile");
  let invalidRowCount = 0;

  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    redirect("/owner/catalog?error=file");
  }

  if (file.size > maxCatalogUploadBytes) {
    redirect("/owner/catalog?error=too-large");
  }

  try {
    const index = await saveCatalogMaster(Buffer.from(await file.arrayBuffer()), file.name);
    invalidRowCount = index.summary.invalidRowCount;

    await recordAuditLog({
      userId: user.id,
      action: "CATALOG_MASTER_IMPORT",
      entityType: "CatalogMaster",
      entityId: file.name,
      metadata: {
        fileName: file.name,
        productCount: index.summary.productCount,
        imageUrlCount: index.summary.imageUrlCount,
        attributeCount: index.summary.attributeCount,
        invalidRowCount: index.summary.invalidRowCount
      },
      request
    });
  } catch {
    redirect("/owner/catalog?error=parse");
  }

  revalidatePath("/owner/catalog");
  revalidatePath("/owner/catalog/sync");
  revalidatePath("/picker/search-sku");
  redirect(`/owner/catalog?imported=1&errors=${invalidRowCount}`);
}
