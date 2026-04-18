# @mei-friend/lib-verovio-react

A React component library providing an interactive, overlay-enabled wrapper for Verovio, designed to work seamlessly with `@mei-friend/core`.

## Getting Started

Integrating `MeiFriend` with Verovio is simple. Initialize a model instance and pass it to the canvas component.

```tsx
import { useState } from "react";
import { MeiFriend } from "@mei-friend/core";
import { VerovioCanvas } from "@mei-friend/lib-verovio-react";

export function ScoreViewer({ initialXml }) {
  const [meiFriend] = useState(() => MeiFriend.fromXmlString(initialXml));

  // The component handles WASM initialization and document updates automatically
  return <VerovioCanvas meiFriend={meiFriend} />;
}
```

### Querying and Updating the Score

By using the `MeiFriend` API to update musical information, the content of a `VerovioCanvas` sharing the same `MeiFriend` instance can be automatically synchronized and updated.

```tsx
// Update the title with API
meiFriend.mei?.head?.setTitle("My New Masterpiece");

// or directly update XML information
meiFriend.update({
  type: "replaceElement",
  targetId: "note-123",
  xml: '<note xml:id="note-123" pname="c" oct="4" dur="4"/>'
});
// The VerovioCanvas will automatically detect this change, 
// re-render the score, and update the display.
```

### Advanced Usage: Accessing Verovio Toolkit

You can directly access the internal `VerovioToolkit` instance through the `ref` of `VerovioCanvas`. Since the toolkit runs in a Web Worker, all methods are asynchronous and return Promises.

```tsx
import { useRef } from "react";
import { VerovioCanvas, type VerovioCanvasHandle } from "@mei-friend/lib-verovio-react";

export function AdvancedScoreViewer({ meiFriend }) {
  const canvasRef = useRef<VerovioCanvasHandle>(null);

  const handleExportMidi = async () => {
    // Get the proxied toolkit instance (async)
    const tk = await canvasRef.current?.getToolkit();
    if (tk) {
      // All toolkit methods return Promises
      const midiBase64 = await tk.renderToMIDI();
      console.log("MIDI generated:", midiBase64);
    }
  };

  return (
    <>
      <button onClick={handleExportMidi}>Export MIDI</button>
      <VerovioCanvas ref={canvasRef} meiFriend={meiFriend} />
    </>
  );
}
```

> **Note**: While reading data (like `renderToMIDI`) is safe, avoid mutating the toolkit state (like `loadData`) directly, as it may cause inconsistencies with the React component's internal state.

---

## Development

This package uses [Vitest](https://vitest.dev/) for unit testing and [Playwright](https://playwright.dev/) for End-to-End (E2E) testing.

### Running Tests

To run the unit tests:

```bash
npm run test
# Or from the workspace root:
# npm run test -w @mei-friend/lib-verovio-react
```

### E2E Testing and Visual Overlays

To run the E2E tests in headless mode:

```bash
npm run test:e2e
```

To run E2E tests with the Playwright UI (useful for visually inspecting the rendered SVG and interactive overlays):

```bash
npm run test:e2e:ui
```

The E2E tests launch a simple sandbox application. You can also start this sandbox application directly in your browser to manually inspect the overlays and interact with the score:

```bash
npm run test:sandbox
# Or from the workspace root:
# npm run test:sandbox -w @mei-friend/lib-verovio-react

# Then open http://localhost:5180 in your browser
```

### Generating Test Fixtures

Unit tests rely on both the MEI file and its corresponding SVG output to verify behaviors like BBox extraction. To ensure consistency, the sample SVG fixture (`test/fixtures/sample.svg`) must be generated via a script from the sample MEI file (`test/fixtures/sample.mei`). Do not manually edit `test/fixtures/sample.svg`.

If you modify `test/fixtures/sample.mei` or the underlying Verovio rendering options, you must regenerate the SVG fixture by running the following script:

```bash
npm run test:generate-test-fixture
# Or from the workspace root:
# npm run test:generate-test-fixture -w @mei-friend/lib-verovio-react
```

This script will initialize Verovio in a Node.js environment, render the first page of `sample.mei`, and output the resulting SVG to `test/fixtures/sample.svg` with a generated header warning.

E2E tests (`test:e2e`) directly use the same sample MEI file (`test/fixtures/sample.mei`) but do not rely on the pre-generated SVG, as they render the score in the browser via Verovio WASM.
