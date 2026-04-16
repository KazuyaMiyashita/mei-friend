import { MeiFriend } from "@mei-friend/core";
import { useCallback, useEffect, useState } from "react";
import styles from "./App.module.css";
import { VerovioCanvas } from "./components/VerovioCanvas";

export default function App() {
  const [meiFriend, setMeiFriend] = useState<MeiFriend | null>(null);
  const [xmlContent, setXmlContent] = useState<string>("");
  const [draftTitle, setDraftTitle] = useState<string>("");

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const text = await file.text();
        const instance = MeiFriend.fromXmlString(text);
        setMeiFriend(instance);
        setXmlContent(instance.toXmlString());
        setDraftTitle(instance.mei?.head.getTitle() || "");
      }
    },
    [],
  );

  useEffect(() => {
    if (!meiFriend) return;

    const unregister = meiFriend.onUpdate(() => {
      setXmlContent(meiFriend.toXmlString());
      setDraftTitle(meiFriend.mei?.head.getTitle() || "");
    });

    return () => unregister();
  }, [meiFriend]);

  const handleTitleSubmit = useCallback(() => {
    if (meiFriend?.mei) {
      meiFriend.mei.head.setTitle(draftTitle);
    }
  }, [meiFriend, draftTitle]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Verovio with MeiFriend</h1>
        <p>
          A proof of concept for embedding Verovio in a React application with
          interactive overlays.
        </p>
      </header>

      <div className={styles.scoreContainer}>
        {meiFriend ? (
          <VerovioCanvas xmlContent={xmlContent} />
        ) : (
          <div className={styles.placeholder}>
            Please select an MEI file to view the score
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.filePickerRow}>
          <p>Load your own MEI file:</p>
          <input type="file" accept=".mei,.xml" onChange={handleFileChange} />
        </div>
      </div>

      <div className={styles.infoPanel}>
        <h2>MEI Information</h2>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Current Title:</span>
          <span>{meiFriend?.mei?.head.getTitle() || "Untitled"}</span>
        </div>
        <div className={styles.infoField}>
          <label htmlFor="title-input">New Title:</label>
          <input
            id="title-input"
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            disabled={!meiFriend}
            placeholder={
              meiFriend ? "Enter score title..." : "No MEI file loaded"
            }
          />
          <button
            type="button"
            className={styles.updateBtn}
            onClick={handleTitleSubmit}
            disabled={!meiFriend}
          >
            Update
          </button>
        </div>
      </div>

      <div className={styles.codeSection}>
        <h2>Getting Started</h2>
        <p style={{ marginBottom: "1rem", opacity: 0.9 }}>
          Integrating MeiFriend with Verovio is simple. Initialize a model
          instance, subscribe to structural updates, and pass the XML to the
          canvas component.
        </p>
        <div className={styles.codeBlock}>
          <pre>
            {`import { useEffect, useState } from "react";
import { MeiFriend } from "@mei-friend/core";
import { VerovioCanvas } from "./components/VerovioCanvas";

export function InteractiveScoreViewer({ initialXml }) {
  const [xmlContent, setXmlContent] = useState("");

  useEffect(() => {
    if (!initialXml) return;

    // 1. Create a MeiFriend instance from your MEI XML string
    const meiFriend = MeiFriend.fromXmlString(initialXml);
    setXmlContent(meiFriend.toXmlString());

    // 2. Subscribe to document updates for two-way synchronization
    const unsubscribe = meiFriend.onUpdate(() => {
      setXmlContent(meiFriend.toXmlString());
    });

    // Cleanup on unmount
    return () => unsubscribe();
  }, [initialXml]);

  // 3. Render the interactive Verovio canvas
  return <VerovioCanvas xmlContent={xmlContent} />;
}`}
          </pre>
        </div>

        <h3>Querying and Updating the Score</h3>
        <p style={{ marginBottom: "1rem", opacity: 0.9 }}>
          MeiFriend provides an intuitive wrapper for inspecting and modifying
          musical structures.
        </p>
        <div className={styles.codeBlock}>
          <pre>
            {`// Get the title
const title = meiFriend.mei.head.getTitle();

// Update the title (changes trigger the onUpdate listener)
meiFriend.mei.head.setTitle("My New Masterpiece");

// You can also directly replace or modify any XML element by its xml:id
meiFriend.update({
  type: "replaceElement",
  targetId: "m-123",
  xml: '<note xml:id="m-123" pname="c" oct="4" dur="4"/>'
});`}
          </pre>
        </div>
      </div>
    </div>
  );
}
