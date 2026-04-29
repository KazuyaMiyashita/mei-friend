import { describe, expect, it } from "vitest";
import { MeiFriend } from "../../../src/MeiFriend.js";
import { MeiNote } from "../../../src/mei/elements/events/MeiNote.js";
import { IPN } from "../../../src/models/index.js";

function getPitchStr(mf: MeiFriend, id: string): string {
  const el = mf.getElementById(id)!;
  const p = IPN.fromPitch(MeiNote.create(el)!.pitch!);
  return p.step.name + (p.alter.value > 0 ? "#" : p.alter.value < 0 ? "b" : "");
}

function makeMei(keySig: string, mode: string, notes: string): string {
  return `
    <mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="mei1">
      <music xml:id="mus1">
        <body xml:id="bod1">
          <mdiv xml:id="mdiv1">
            <score xml:id="scr1">
              <scoreDef xml:id="scd1">
                <staffGrp xml:id="sg1">
                  <staffDef n="1" lines="5" xml:id="sdf1">
                    <keySig xml:id="ks1" sig="${keySig}" mode="${mode}"/>
                  </staffDef>
                </staffGrp>
              </scoreDef>
              <section xml:id="sec1">
                <measure xml:id="meas1">
                  <staff n="1" xml:id="stf1">
                    <layer n="1" xml:id="lay1">
                      ${notes}
                    </layer>
                  </staff>
                </measure>
              </section>
            </score>
          </mdiv>
        </body>
      </music>
    </mei>`;
}

function runChromaticTest(
  keySig: string,
  mode: string,
  direction: "up" | "down",
  inputPitches: string[],
  expectedPitches: string[],
) {
  for (let i = 0; i < inputPitches.length; i++) {
    const input = inputPitches[i];
    const expected = expectedPitches[i];
    const step = input[0];
    const accid =
      input.length > 1
        ? input[1] === "#"
          ? "s"
          : input[1] === "b"
            ? "f"
            : "n"
        : "n";
    const gesAttr = input.length > 1 ? `accid.ges="${accid}"` : ``;

    const xml = `<note xml:id="n1" pname="${step.toLowerCase()}" oct="4" dur="4" ${gesAttr}><accid accid="${accid}"/></note>`;
    const mf = MeiFriend.fromXmlString(makeMei(keySig, mode, xml));

    if (direction === "up") {
      mf.updateBatch(mf.api.editor.pitchChromaticUp("n1"));
    } else {
      mf.updateBatch(mf.api.editor.pitchChromaticDown("n1"));
    }

    const result = getPitchStr(mf, "n1");
    expect(
      result,
      `Transposing ${input} ${direction} in ${keySig} ${mode}`,
    ).toBe(expected);
  }
}

describe("MeiEditor chromatic transposition", () => {
  it("C Maj / a min (Up)", () => {
    runChromaticTest(
      "0",
      "major",
      "up",
      ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
      ["C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B", "C"],
    );
  });
  it("C Maj / a min (Down)", () => {
    runChromaticTest(
      "0",
      "major",
      "down",
      ["C", "B", "Bb", "A", "Ab", "G", "Gb", "F", "E", "Eb", "D", "Db"],
      ["B", "Bb", "A", "Ab", "G", "Gb", "F", "E", "Eb", "D", "Db", "C"],
    );
  });

  it("A Maj / f# min (Up)", () => {
    runChromaticTest(
      "3s",
      "major",
      "up",
      ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"],
      ["A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A"],
    );
  });
  it("A Maj / f# min (Down)", () => {
    runChromaticTest(
      "3s",
      "major",
      "down",
      ["A", "G#", "G", "F#", "F", "E", "Eb", "D", "C#", "C", "B", "Bb"],
      ["G#", "G", "F#", "F", "E", "Eb", "D", "C#", "C", "B", "Bb", "A"],
    );
  });

  it("Eb Maj / c min (Up)", () => {
    runChromaticTest(
      "3f",
      "major",
      "up",
      ["Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B", "C", "C#", "D"],
      ["E", "F", "F#", "G", "Ab", "A", "Bb", "B", "C", "C#", "D", "Eb"],
    );
  });
  it("Eb Maj / c min (Down)", () => {
    runChromaticTest(
      "3f",
      "major",
      "down",
      ["Eb", "D", "Db", "C", "B", "Bb", "A", "Ab", "G", "Gb", "F", "E"],
      ["D", "Db", "C", "B", "Bb", "A", "Ab", "G", "Gb", "F", "E", "Eb"],
    );
  });

  it("C# Maj / a# min (Up)", () => {
    runChromaticTest(
      "7s",
      "major",
      "up",
      ["C#", "D", "D#", "E", "E#", "F#", "G", "G#", "A", "A#", "B", "B#"],
      ["D", "D#", "E", "E#", "F#", "G", "G#", "A", "A#", "B", "B#", "C#"],
    );
  });
  it("C# Maj / a# min (Down)", () => {
    runChromaticTest(
      "7s",
      "major",
      "down",
      ["C#", "B#", "B", "A#", "A", "G#", "G", "F#", "E#", "E", "D#", "D"],
      ["B#", "B", "A#", "A", "G#", "G", "F#", "E#", "E", "D#", "D", "C#"],
    );
  });

  it("Cb Maj / ab min (Up)", () => {
    runChromaticTest(
      "7f",
      "major",
      "up",
      ["Cb", "C", "Db", "D", "Eb", "Fb", "F", "Gb", "G", "Ab", "A", "Bb"],
      ["C", "Db", "D", "Eb", "Fb", "F", "Gb", "G", "Ab", "A", "Bb", "Cb"],
    );
  });
  it("Cb Maj / ab min (Down)", () => {
    runChromaticTest(
      "7f",
      "major",
      "down",
      ["Cb", "Bb", "A", "Ab", "G", "Gb", "F", "Fb", "Eb", "D", "Db", "C"],
      ["Bb", "A", "Ab", "G", "Gb", "F", "Fb", "Eb", "D", "Db", "C", "Cb"],
    );
  });
});
