import path from "node:path";
import { existsSync } from "node:fs";

const envPath = path.resolve(__dirname, "../../.env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
