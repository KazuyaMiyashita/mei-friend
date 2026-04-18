import { expect, test } from "@playwright/test";

test.describe("VerovioCanvas Overlays (Debug Mode)", () => {
  test("(1) should render measure overlay", async ({ page }) => {
    await page.goto("/?debug=measure");
    await page.waitForSelector("svg .definition-scale");

    // Verify the overlay for the first measure (m-1)
    const measureOverlay = page.locator(
      '.mf-overlay-measure[data-target-id="m-1"]',
    );
    await expect(measureOverlay).toBeVisible();

    // Verify the applied style (Sandbox blue color: rgba(0, 0, 255, 0.1))
    const style = await measureOverlay.getAttribute("style");
    expect(style).toContain("rgba(0, 0, 255, 0.1)");
  });

  test("(2) should render staff overlay", async ({ page }) => {
    await page.goto("/?debug=staff");
    await page.waitForSelector("svg .definition-scale");

    // Verify the overlay for the first staff (s-1-1)
    const staffOverlay = page.locator(
      '.mf-overlay-staff[data-target-id="s-1-1"]',
    );
    await expect(staffOverlay).toBeVisible();

    // Verify the applied style (Sandbox green color: rgba(0, 255, 0, 0.2))
    const style = await staffOverlay.getAttribute("style");
    expect(style).toContain("rgba(0, 255, 0, 0.2)");
  });

  test("(3) should render note overlay", async ({ page }) => {
    await page.goto("/?debug=note");
    await page.waitForSelector("svg .definition-scale");

    // Verify the overlay for the first note (n-1-1-1)
    const noteOverlay = page.locator(
      '.mf-overlay-note[data-target-id="n-1-1-1"]',
    );
    await expect(noteOverlay).toBeVisible();

    // Verify the applied style (Sandbox red color: rgba(255, 0, 0, 0.3))
    const style = await noteOverlay.getAttribute("style");
    expect(style).toContain("rgba(255, 0, 0, 0.3)");
  });

  test("(4) should render caret", async ({ page }) => {
    await page.goto("/?debug=caret");
    await page.waitForSelector("svg .definition-scale");

    // Verify the debug mode caret (opacity: 0.3) is rendered
    const debugCaret = page.locator(".mf-overlay-caret").first();
    await expect(debugCaret).toBeVisible();

    // Verify the caret style (color and opacity)
    const style = await debugCaret.getAttribute("style");
    expect(style).toContain("#ff00ff");
    expect(style).toContain("opacity: 0.3");
  });
});

test.describe("VerovioCanvas Interactions", () => {
  test.beforeEach(async ({ page }) => {
    // Interactions tests use debug=none to ensure hitboxes work without visible debug overlays
    await page.goto("/?debug=none");
    await page.waitForSelector("svg .definition-scale");
  });

  test("(5) should select note on click", async ({ page }) => {
    // Click the second note of m-1, s-1-1 (n-1-1-2)
    const noteOverlay = page.locator(
      '.mf-overlay-note-hitbox[data-target-id="n-1-1-2"]',
    );
    await noteOverlay.click();

    // Verify the selection status is updated
    const status = page.locator("#selection-status");
    await expect(status).toHaveText("Selected: n-1-1-2");

    // Verify the 'selected' class is added to the actual SVG group (<g> tag)
    const selectedGroup = page.locator("g#n-1-1-2");
    await expect(selectedGroup).toHaveClass(/selected/);
  });

  test("(6) should select measure on click", async ({ page }) => {
    // Click the second measure (m-2)
    // Note: Since staff/note hitboxes overlap the measure, we use force: true to ensure
    // the measure itself receives the click event at the center of its bounding box.
    const measureOverlay = page.locator(
      '.mf-overlay-measure-hitbox[data-target-id="m-2"]',
    );
    await measureOverlay.click({ force: true });

    // Verify the selection status is updated
    const status = page.locator("#selection-status");
    await expect(status).toHaveText("Selected: m-2");

    // Verify the 'selected' class is added to the actual SVG group (<g> tag)
    const selectedGroup = page.locator("g#m-2");
    await expect(selectedGroup).toHaveClass(/selected/);
  });

  test("(7) should display active caret on note click", async ({ page }) => {
    // Click the third note of m-1, s-1-1 (n-1-1-3)
    await page
      .locator('.mf-overlay-note-hitbox[data-target-id="n-1-1-3"]')
      .click();

    // Verify the active caret (non-debug mode, opacity: 0.6) is rendered
    // We specifically look for opacity: 0.6 to differentiate from debug carets (opacity: 0.3)
    // if any were present.
    const activeCaret = page.locator(
      '.mf-overlay-caret[style*="opacity: 0.6"]',
    );
    await expect(activeCaret).toBeVisible();

    // Ensure the caret bounding box exists
    const caretBBox = await activeCaret.boundingBox();
    expect(caretBBox).not.toBeNull();
  });
});
