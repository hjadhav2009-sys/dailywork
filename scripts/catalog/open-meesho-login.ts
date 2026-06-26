import { openManualMeeshoLogin } from "../../lib/catalog/sync-browser";

const url = process.argv[2] || undefined;

openManualMeeshoLogin(url)
  .then(async (context) => {
    console.log("Meesho login browser opened. Close the browser window when manual login is complete.");
    await new Promise<void>((resolve) => {
      (context as unknown as { on(event: "close", listener: () => void): void }).on("close", resolve);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
