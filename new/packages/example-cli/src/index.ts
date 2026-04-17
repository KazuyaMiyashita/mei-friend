import { readFileSync } from "node:fs";
import { MeiFriend } from "@mei-friend/core";

function main() {
  const args = process.argv.slice(2);
  const filePath = args[0];

  if (!filePath) {
    console.error("Usage: node dist/index.js <path-to-mei-file>");
    process.exit(1);
  }

  try {
    const meiContent = readFileSync(filePath, "utf-8");
    const meiFriend = MeiFriend.fromXmlString(meiContent);
    const root = meiFriend.getRootElement();
    const title = meiFriend.mei?.head.getTitle() || "Unknown Title";

    console.log(`Successfully parsed MEI file: ${filePath}`);
    console.log(`MEI Element Name: ${root?.tagName}`);
    console.log(`Title: ${title}`);

    meiFriend.destroy();
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    process.exit(1);
  }
}

main();
