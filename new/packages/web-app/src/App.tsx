import { MeiFriend } from "@mei-friend/core";
import { useState } from "react";

function App() {
  const [title, setTitle] = useState<string | undefined>(undefined);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const text = await file.text();
      try {
        const meiFriend = MeiFriend.fromXmlString(text);
        setTitle(meiFriend.mei?.head.getTitle() || "No title found");
      } catch (e) {
        console.error(e);
        setTitle("Error parsing MEI");
      }
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>MEI Friend Web App</h1>
      <div style={{ marginBottom: "20px" }}>
        <input type="file" accept=".mei,.xml" onChange={handleFileChange} />
      </div>
      {title !== undefined && (
        <div>
          <strong>Song Title:</strong> {title}
        </div>
      )}
    </div>
  );
}

export default App;
