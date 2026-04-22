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

  // const meiFriend = MeiFriend.fromXmlString('<mei><note xml:id="n1" pname="c" oct="4/></mei>');

  // meiFriend.update(
  //   // 元のupdateではここでtargetIdを指定する必要があるが、どの要素を変更するかが確定しないAPIが存在するため、
  //   // 省略可能として指定された要素のIDを更新することにする。
  //   //
  //   // タイトルが付与された最も小さな変更差分の MeiElement を得る
  //   // <meiHead> が存在しない場合は <mei> から変更され、 <title> 要素まで存在する場合は <title> のみ変更される。
  //   //
  //   // MeiApi には titleAppended がすでに存在するがリネームするのと要素取得の書き方・必ずしもルートから書き換えないことように変更
  //   meiFriend.api.withTitle("My Work")
  // )

  // const elem = meiFriend.getElementById("");

  // 現状の update を、 MeiElement を取る updateElement, 文字列を取る updateElementXmlString に分けたい。
  // パース処理は後者しか必要ない

  // const elem2 = meiFriend.updateElement("a", elem.produce((e) => {
  //   return e.setText("a")
  // }))

  // meiFriend.updateElementXmlString("a", "<title>aiueo</title>");

  // updateElement で MeiElement が指定できれば、 MeiElement の toXmlString の利用箇所も少なくなり、
  // MeiElement がわざわざシリアライザを持たなくてすみそう。
  // シリアライズは meiFriend.serializer.toXmlString(elem) のようにする？

  // MeiElement は Y.XmlElement 以外に情報を持ちたくないが、しかし idGenerator を利用しているのはどうしたものか
  //
  // meiFriend.newElement(yNode) のようにするか？
  // 要素を表すデータと、ID付与ロジックは分離しておく。

  meiFriend.destroy();
}

main();
