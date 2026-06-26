import { runCatalogSync } from "../../lib/catalog/sync-runner";

runCatalogSync().catch((error) => {
  console.error(error);
  process.exit(1);
});
