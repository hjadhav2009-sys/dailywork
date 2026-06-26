"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit";
import { requireAccount, requireUser } from "@/lib/auth";
import { normalizeActiveSkuRetentionDays, updateActiveSkuRetentionDays } from "@/lib/catalog/active-skus";
import { getRequestMeta } from "@/lib/request-context";

export async function updateActiveSkuLoopSettingAction(formData: FormData) {
  const user = await requireUser(["OWNER"]);
  const account = await requireAccount(user);
  const request = await getRequestMeta();
  const retentionDays = normalizeActiveSkuRetentionDays(formData.get("retentionDays"));
  const state = await updateActiveSkuRetentionDays(retentionDays);

  await recordAuditLog({
    userId: user.id,
    accountId: account.id,
    action: "ACTIVE_SKU_LOOP_UPDATED",
    entityType: "CatalogActiveSkuLoop",
    metadata: {
      retentionDays: state.retentionDays
    },
    request
  });

  revalidatePath("/owner");
  revalidatePath("/reports");
  redirect("/owner?activeLoopUpdated=1");
}
