import { readFileSync } from "node:fs";
import { MeiFriend } from "@mei-friend/core";

function main() {
  const args = process.argv.slice(2);
  const filePath = args[0];

  if (!filePath) {
    console.error("Usage: node dist/index.js <path-to-mei-file>");
    process.exit(1);
  }

  let meiFriend: MeiFriend | undefined;
  try {
    const meiContent = readFileSync(filePath, "utf-8");
    meiFriend = MeiFriend.fromXmlString(meiContent);
    console.log(`Successfully parsed MEI file: ${filePath}`);
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    process.exit(1);
  }

  console.log(`MEI Element Name: ${meiFriend.getRootElement()?.tagName}`);
  console.log(`Title: ${meiFriend.api.getTitle()}`);

  // Set or update the title:
  // meiFriend.updateElement(meiFriend.api.withTitle("My Work"));

  // Immutable element mutation via produceElement:
  // const elem = meiFriend.getElementById("n1")!;
  // const modified = meiFriend.produceElement(elem, (draft) => {
  //   draft.setAttribute("pname", "d");
  // });
  // meiFriend.updateElement(modified);

  // Raw XML string update:
  // meiFriend.updateXmlString("n1", '<note xml:id="n1" pname="d" oct="4"/>');

  meiFriend.destroy();
}

main();
