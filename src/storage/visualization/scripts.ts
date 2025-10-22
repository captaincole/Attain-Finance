import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SCRIPT_PATH = path.join(__dirname, "../../public/visualize-spending.sh");

/**
 * Return the default visualization script.
 * Customization is currently disabled, so this always returns the baseline script.
 */
export async function getVisualization(_userId: string): Promise<string> {
  return fs.readFile(DEFAULT_SCRIPT_PATH, "utf-8");
}
