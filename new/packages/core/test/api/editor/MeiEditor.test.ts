import { describe, expect, it } from "vitest";
import { MeiFriend } from "../../../src/MeiFriend.js";
import { MeiNote } from "../../../src/mei/events/MeiNote.js";
import { InternationalPitch } from "../../../src/models/elements.js";

// ------------------------------------------------------------------ helpers

/** Returns the InternationalPitch of the note at the given ID after loading XML. */
function getPitch(mf: MeiFriend, id: string): InternationalPitch {
  const el = mf.getElementById(id)!;
  return InternationalPitch.fromPitch(MeiNote.create(el)!.pitch!);
}

/** Returns the accid.ges attribute value of the note element (or undefined). */
function getAccidGes(mf: MeiFriend, id: string): string | undefined {
  return mf.getElementById(id)?.getAttribute("accid.ges");
}

/**
 * Builds a minimal MEI document with one measure and one staff (n=1).
 * `keySig`  — e.g. "0", "1s", "2f"
 * `mode`    — "major" | "minor"
 * `notes`   — inner XML for the <layer>
 */
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

// ------------------------------------------------------------------ pitchUp

describe("MeiEditor.pitchUp", () => {
  describe("C Major (no accidentals)", () => {
    it("moves C4 up to D4", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("0", "major", `<note xml:id="n1" pname="c" oct="4" dur="4"/>`),
      );
      const result = mf.api.editor.pitchUp("n1");
      mf.updateElement(result.note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("D");
      expect(p.octave.value).toBe(4);
      expect(p.alter.value).toBe(0);
      expect(getAccidGes(mf, "n1")).toBeUndefined();
    });

    it("moves E4 up to F4 (F is natural in C Major)", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("0", "major", `<note xml:id="n1" pname="e" oct="4" dur="4"/>`),
      );
      mf.updateElement(mf.api.editor.pitchUp("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("F");
      expect(p.alter.value).toBe(0);
      expect(getAccidGes(mf, "n1")).toBeUndefined();
    });

    it("moves B4 up to C5 (octave wraps up at B→C)", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("0", "major", `<note xml:id="n1" pname="b" oct="4" dur="4"/>`),
      );
      mf.updateElement(mf.api.editor.pitchUp("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("C");
      expect(p.octave.value).toBe(5);
      expect(p.alter.value).toBe(0);
    });
  });

  describe("G Major (1 sharp: F#)", () => {
    it("moves D4 up to E4 (E has no accidental in G Major)", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("1s", "major", `<note xml:id="n1" pname="d" oct="4" dur="4"/>`),
      );
      mf.updateElement(mf.api.editor.pitchUp("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("E");
      expect(p.alter.value).toBe(0);
      expect(getAccidGes(mf, "n1")).toBeUndefined();
    });

    it("moves E4 up to F#4 (F is sharp from key signature)", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("1s", "major", `<note xml:id="n1" pname="e" oct="4" dur="4"/>`),
      );
      mf.updateElement(mf.api.editor.pitchUp("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("F");
      expect(p.alter.value).toBe(1);
      expect(getAccidGes(mf, "n1")).toBe("s");
    });

    it("moves B4 up to C#5 (C is sharp in D Major, but C is not sharp in G Major)", () => {
      // G Major has only F#; C is natural → C5
      const mf = MeiFriend.fromXmlString(
        makeMei("1s", "major", `<note xml:id="n1" pname="b" oct="4" dur="4"/>`),
      );
      mf.updateElement(mf.api.editor.pitchUp("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("C");
      expect(p.octave.value).toBe(5);
      expect(p.alter.value).toBe(0);
    });
  });

  describe("D Major (2 sharps: F#, C#)", () => {
    it("moves B4 up to C#5 (C is sharp from key signature)", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("2s", "major", `<note xml:id="n1" pname="b" oct="4" dur="4"/>`),
      );
      mf.updateElement(mf.api.editor.pitchUp("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("C");
      expect(p.octave.value).toBe(5);
      expect(p.alter.value).toBe(1);
      expect(getAccidGes(mf, "n1")).toBe("s");
    });
  });

  describe("Bb Major (2 flats: Bb, Eb)", () => {
    it("moves D4 up to Eb4 (E is flat from key signature)", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("2f", "major", `<note xml:id="n1" pname="d" oct="4" dur="4"/>`),
      );
      mf.updateElement(mf.api.editor.pitchUp("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("E");
      expect(p.alter.value).toBe(-1);
      expect(getAccidGes(mf, "n1")).toBe("f");
    });

    it("moves C4 up to D4 (D is natural in Bb Major)", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("2f", "major", `<note xml:id="n1" pname="c" oct="4" dur="4"/>`),
      );
      mf.updateElement(mf.api.editor.pitchUp("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("D");
      expect(p.alter.value).toBe(0);
    });
  });

  describe("preceding accidental override", () => {
    it("uses the alter of a preceding <accid>-annotated note at the same staff line", () => {
      // G Major (F#), but F♮4 appears earlier in the measure with printed accidental
      // pitchUp(E4) should produce F♮4, not F#4
      const mf = MeiFriend.fromXmlString(
        makeMei(
          "1s",
          "major",
          `<note xml:id="fn" pname="f" oct="4" dur="4">
             <accid xml:id="a1" accid="n"/>
           </note>
           <note xml:id="n1" pname="e" oct="4" dur="4"/>`,
        ),
      );
      mf.updateElement(mf.api.editor.pitchUp("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("F");
      expect(p.alter.value).toBe(0);
      expect(getAccidGes(mf, "n1")).toBeUndefined();
    });

    it("ignores a preceding note with accid.ges only (no printed <accid> child)", () => {
      // G Major (F#), preceding note at F4 has only accid.ges="n" (no child <accid>)
      // pitchUp(E4) should still use key sig → F#4
      const mf = MeiFriend.fromXmlString(
        makeMei(
          "1s",
          "major",
          `<note xml:id="fn" pname="f" oct="4" dur="4" accid.ges="n"/>
           <note xml:id="n1" pname="e" oct="4" dur="4"/>`,
        ),
      );
      mf.updateElement(mf.api.editor.pitchUp("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("F");
      expect(p.alter.value).toBe(1);
      expect(getAccidGes(mf, "n1")).toBe("s");
    });

    it("picks the LAST preceding accidental when multiple exist at the same staff line", () => {
      // G Major, first F♮4 then F#4 (with printed accidental) before E4
      // pitchUp(E4) should use F# (the later one)
      const mf = MeiFriend.fromXmlString(
        makeMei(
          "1s",
          "major",
          `<note xml:id="fn" pname="f" oct="4" dur="8">
             <accid xml:id="a1" accid="n"/>
           </note>
           <note xml:id="fs" pname="f" oct="4" dur="8">
             <accid xml:id="a2" accid="s"/>
           </note>
           <note xml:id="n1" pname="e" oct="4" dur="4"/>`,
        ),
      );
      mf.updateElement(mf.api.editor.pitchUp("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("F");
      expect(p.alter.value).toBe(1);
    });

    it("does not use a preceding accidental at a different octave", () => {
      // G Major, preceding note is F♮5 (different octave) — target is F4
      // pitchUp(E4) should still use key sig → F#4
      const mf = MeiFriend.fromXmlString(
        makeMei(
          "1s",
          "major",
          `<note xml:id="fn" pname="f" oct="5" dur="4">
             <accid xml:id="a1" accid="n"/>
           </note>
           <note xml:id="n1" pname="e" oct="4" dur="4"/>`,
        ),
      );
      mf.updateElement(mf.api.editor.pitchUp("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("F");
      expect(p.alter.value).toBe(1);
    });
  });

  describe("no <accid> child is added to the result", () => {
    it("does not produce a <accid> child element after pitchUp", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("1s", "major", `<note xml:id="n1" pname="e" oct="4" dur="4"/>`),
      );
      const result = mf.api.editor.pitchUp("n1");
      // F# from key sig — accid.ges is set but no child <accid>
      expect(result.note.getChildElement("accid")).toBeUndefined();
      expect(result.note.getAttribute("accid.ges")).toBe("s");
    });

    it("removes an existing <accid> child from the source note on pitchUp", () => {
      // F♮4 (natural sign printed) in G Major → pitchUp → G4, no accid child
      const mf = MeiFriend.fromXmlString(
        makeMei(
          "1s",
          "major",
          `<note xml:id="n1" pname="f" oct="4" dur="4" accid.ges="n">
             <accid xml:id="a1" accid="n"/>
           </note>`,
        ),
      );
      const result = mf.api.editor.pitchUp("n1");
      expect(result.note.getChildElement("accid")).toBeUndefined();
      expect(result.note.getAttribute("pname")).toBe("g");
    });
  });
});

// ------------------------------------------------------------------ pitchDown

describe("MeiEditor.pitchDown", () => {
  describe("C Major", () => {
    it("moves D4 down to C4", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("0", "major", `<note xml:id="n1" pname="d" oct="4" dur="4"/>`),
      );
      mf.updateElement(mf.api.editor.pitchDown("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("C");
      expect(p.octave.value).toBe(4);
      expect(p.alter.value).toBe(0);
    });

    it("moves C4 down to B3 (octave wraps down at C→B)", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("0", "major", `<note xml:id="n1" pname="c" oct="4" dur="4"/>`),
      );
      mf.updateElement(mf.api.editor.pitchDown("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("B");
      expect(p.octave.value).toBe(3);
      expect(p.alter.value).toBe(0);
    });
  });

  describe("G Major (1 sharp: F#)", () => {
    it("moves G4 down to F#4 (F is sharp from key signature)", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("1s", "major", `<note xml:id="n1" pname="g" oct="4" dur="4"/>`),
      );
      mf.updateElement(mf.api.editor.pitchDown("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("F");
      expect(p.alter.value).toBe(1);
      expect(getAccidGes(mf, "n1")).toBe("s");
    });
  });

  describe("Bb Major (2 flats: Bb, Eb)", () => {
    it("moves C4 down to Bb3 (B is flat from key signature, octave wraps)", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("2f", "major", `<note xml:id="n1" pname="c" oct="4" dur="4"/>`),
      );
      mf.updateElement(mf.api.editor.pitchDown("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("B");
      expect(p.octave.value).toBe(3);
      expect(p.alter.value).toBe(-1);
      expect(getAccidGes(mf, "n1")).toBe("f");
    });
  });

  describe("preceding accidental override", () => {
    it("uses preceding <accid>-annotated note to override key signature", () => {
      // G Major (F#), but F♮4 appears earlier with printed accidental
      // pitchDown(G4) should produce F♮4, not F#4
      const mf = MeiFriend.fromXmlString(
        makeMei(
          "1s",
          "major",
          `<note xml:id="fn" pname="f" oct="4" dur="4">
             <accid xml:id="a1" accid="n"/>
           </note>
           <note xml:id="n1" pname="g" oct="4" dur="4"/>`,
        ),
      );
      mf.updateElement(mf.api.editor.pitchDown("n1").note);
      const p = getPitch(mf, "n1");
      expect(p.step.name).toBe("F");
      expect(p.alter.value).toBe(0);
      expect(getAccidGes(mf, "n1")).toBeUndefined();
    });
  });

  describe("no <accid> child is added to the result", () => {
    it("does not produce a <accid> child element after pitchDown", () => {
      const mf = MeiFriend.fromXmlString(
        makeMei("1s", "major", `<note xml:id="n1" pname="g" oct="4" dur="4"/>`),
      );
      const result = mf.api.editor.pitchDown("n1");
      expect(result.note.getChildElement("accid")).toBeUndefined();
      expect(result.note.getAttribute("accid.ges")).toBe("s");
    });

    it("removes an existing <accid> child from the source note on pitchDown", () => {
      // C#4 (sharp printed) in C Major → pitchDown → B3, no accid child
      const mf = MeiFriend.fromXmlString(
        makeMei(
          "0",
          "major",
          `<note xml:id="n1" pname="c" oct="4" dur="4" accid.ges="s">
             <accid xml:id="a1" accid="s"/>
           </note>`,
        ),
      );
      const result = mf.api.editor.pitchDown("n1");
      expect(result.note.getChildElement("accid")).toBeUndefined();
      expect(result.note.getAttribute("pname")).toBe("b");
      expect(result.note.getAttribute("oct")).toBe("3");
    });
  });
});

// ------------------------------------------------------------------ contextual accidental corrections

describe("MeiEditor contextual accidental corrections", () => {
  it("|(#)C C| in C Major: subsequent note's accid.ges cleared after source moves", () => {
    // C#4 (printed) followed by C4 carrying over the sharp (accid.ges="s", no <accid> child).
    // After pitchUp(n1), n1 moves to D4 and n2 should revert to C♮4.
    const mf = MeiFriend.fromXmlString(
      makeMei(
        "0",
        "major",
        `<note xml:id="n1" pname="c" oct="4" dur="4" accid.ges="s">
           <accid xml:id="a1" accid="s"/>
         </note>
         <note xml:id="n2" pname="c" oct="4" dur="4" accid.ges="s"/>`,
      ),
    );
    const result = mf.api.editor.pitchUp("n1");
    expect(result.note.getAttribute("pname")).toBe("d");
    expect(result.accidentalCorrections).toHaveLength(1);
    expect(result.accidentalCorrections[0].id).toBe("n2");
    expect(
      result.accidentalCorrections[0].element.getAttribute("accid.ges"),
    ).toBeUndefined();
  });

  it("|(#)D (♮)D| in C Major: cancellation accid removed from subsequent note", () => {
    // D#4 (printed) followed by D♮4 (cancellation accid). After pitchUp(n1),
    // n1 moves to E4 and n2's natural sign is redundant — remove it.
    const mf = MeiFriend.fromXmlString(
      makeMei(
        "0",
        "major",
        `<note xml:id="n1" pname="d" oct="4" dur="4" accid.ges="s">
           <accid xml:id="a1" accid="s"/>
         </note>
         <note xml:id="n2" pname="d" oct="4" dur="4">
           <accid xml:id="a2" accid="n"/>
         </note>`,
      ),
    );
    const result = mf.api.editor.pitchUp("n1");
    expect(result.accidentalCorrections).toHaveLength(1);
    expect(result.accidentalCorrections[0].id).toBe("n2");
    expect(
      result.accidentalCorrections[0].element.getChildElement("accid"),
    ).toBeUndefined();
  });

  it("does not correct a note with an independent accidental", () => {
    // G Major (F#). n1 = F#4 (redundant courtesy sharp printed).
    // n2 = F♮4 with printed natural — this is an independent accidental (♮ ≠ key F#),
    // not a cancellation of n1's effect. After moving n1, n2 is left unchanged.
    const mf = MeiFriend.fromXmlString(
      makeMei(
        "1s",
        "major",
        `<note xml:id="n1" pname="f" oct="4" dur="4" accid.ges="s">
           <accid xml:id="a1" accid="s"/>
         </note>
         <note xml:id="n2" pname="f" oct="4" dur="4">
           <accid xml:id="a2" accid="n"/>
         </note>`,
      ),
    );
    const result = mf.api.editor.pitchUp("n1");
    expect(result.accidentalCorrections).toHaveLength(0);
  });

  it("returns no corrections when the source note has no printed <accid> child", () => {
    // n1 has only accid.ges (no printed accid), so subsequent notes were not
    // relying on any carry-over from n1.
    const mf = MeiFriend.fromXmlString(
      makeMei(
        "0",
        "major",
        `<note xml:id="n1" pname="c" oct="4" dur="4"/>
         <note xml:id="n2" pname="c" oct="4" dur="4"/>`,
      ),
    );
    const result = mf.api.editor.pitchUp("n1");
    expect(result.accidentalCorrections).toHaveLength(0);
  });
});

// ------------------------------------------------------------------ error cases

describe("MeiEditor error handling", () => {
  it("throws when element is not found", () => {
    const mf = MeiFriend.fromXmlString(
      makeMei("0", "major", `<note xml:id="n1" pname="c" oct="4" dur="4"/>`),
    );
    expect(() => mf.api.editor.pitchUp("nonexistent")).toThrow();
  });

  it("throws when element is not a <note>", () => {
    const xml = `
      <mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1">
        <music xml:id="mus1"><body xml:id="b1"><mdiv xml:id="md1">
          <score xml:id="sc1">
            <scoreDef xml:id="scd1">
              <staffGrp xml:id="sg1">
                <staffDef n="1" xml:id="sdf1">
                  <keySig xml:id="ks1" sig="0" mode="major"/>
                </staffDef>
              </staffGrp>
            </scoreDef>
            <section xml:id="sec1">
              <measure xml:id="meas1">
                <staff n="1" xml:id="stf1">
                  <layer n="1" xml:id="lay1">
                    <rest xml:id="r1" dur="4"/>
                  </layer>
                </staff>
              </measure>
            </section>
          </score>
        </mdiv></body></music>
      </mei>`;
    const mf = MeiFriend.fromXmlString(xml);
    expect(() => mf.api.editor.pitchUp("r1")).toThrow();
  });
});
