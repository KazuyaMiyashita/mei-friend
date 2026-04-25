import type { Cursor, MeiFriend, ScoreModel } from "@mei-friend/core";
import type { Remote } from "comlink";
import * as Comlink from "comlink";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { VerovioOptions } from "verovio";
import type { VerovioToolkit } from "verovio/esm";
import { applySvgFitStyles, renderOverlays } from "./overlay.js";
import type { BBox, DebugFilters, VerovioCanvasColors } from "./types.js";
import type { VerovioWorkerAPI } from "./verovio-worker.js";

export type { DebugFilters, VerovioCanvasColors };

export interface VerovioCanvasProps {
  meiFriend: MeiFriend;
  options?: VerovioOptions;
  currentPage?: number;
  fitMode?: "off" | "width" | "height";
  selectedId?: string | null;
  highlightId?: string | null;
  cursor?: Cursor | null;
  debugFilters?: DebugFilters;
  colors?: VerovioCanvasColors;
  onSelectionChange?: (id: string | null) => void;
  onTotalPagesChange?: (total: number) => void;
  onRenderCompleted?: () => void;
}

export interface VerovioCanvasHandle {
  getToolkit: () => Promise<Remote<VerovioToolkit> | null>;
  /**
   * Scrolls the score container so the element with the given xml:id is
   * centered in the viewport. Does nothing if the element is already fully
   * visible. Returns true if the element was found, false otherwise.
   */
  scrollToElement: (xmlId: string) => boolean;
}

const DEFAULT_OPTIONS: VerovioOptions = { scale: 50, breaks: "auto" };

export const VerovioCanvas = forwardRef<
  VerovioCanvasHandle,
  VerovioCanvasProps
>((props, ref) => {
  const {
    meiFriend,
    options = DEFAULT_OPTIONS,
    currentPage = 1,
    fitMode = "off",
    selectedId = null,
    highlightId = null,
    cursor = null,
    debugFilters = {},
    colors = {},
    onSelectionChange,
    onTotalPagesChange,
    onRenderCompleted,
  } = props;

  // Storing the Remote proxy in useState caused runtime errors in React 19 (e.g. 'tk.setOptions is not a function'), likely due to React misidentifying the proxy as a Thenable; wrapping it in an object avoids this.
  const [tkContainer, setTkContainer] = useState<{
    instance: Remote<VerovioToolkit> | null;
  }>({ instance: null });
  const tk = tkContainer.instance;

  const [currentSvg, setCurrentSvg] = useState<string>("");
  const [scoreModel, setScoreModel] = useState<ScoreModel | null>(null);
  const [renderTrigger, setRenderTrigger] = useState(0);

  const svgContainerRef = useRef<HTMLDivElement>(null);
  const bboxCacheRef = useRef<Map<string, BBox>>(new Map());

  // Track whether the underlying MEI data or layout options have changed
  // requiring a full tk.loadData()
  const isDataDirtyRef = useRef(true);
  const lastOptionsStrRef = useRef("");

  useImperativeHandle(ref, () => ({
    getToolkit: async () => tk,
    scrollToElement: (xmlId: string): boolean => {
      const container = svgContainerRef.current;
      if (!container) return false;

      // TODO: This only scrolls within the currently rendered page. If the
      // target element is on a different page, querySelector returns null and
      // this returns false without any navigation. To support cross-page
      // navigation, use the Verovio toolkit's getPageWithElement() (or
      // equivalent) to resolve the page number, call setCurrentPage(), and
      // then scroll after the new SVG has been rendered.
      const el = container.querySelector(
        `g#${CSS.escape(xmlId)}`,
      ) as SVGGraphicsElement | null;
      if (!el) return false;

      const elRect = el.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();

      const fullyVisible =
        elRect.left >= cRect.left &&
        elRect.right <= cRect.right &&
        elRect.top >= cRect.top &&
        elRect.bottom <= cRect.bottom;

      if (!fullyVisible) {
        const deltaX =
          (elRect.left + elRect.right) / 2 - (cRect.left + cRect.right) / 2;
        const deltaY =
          (elRect.top + elRect.bottom) / 2 - (cRect.top + cRect.bottom) / 2;
        container.scrollBy({ left: deltaX, top: deltaY, behavior: "smooth" });
      }

      return true;
    },
  }));

  // Initialize Verovio Worker
  useEffect(() => {
    // Vite-specific worker import
    const vrvWorker = new Worker(new URL("./verovio-worker", import.meta.url), {
      type: "module",
    });

    const api = Comlink.wrap<VerovioWorkerAPI>(vrvWorker);

    api.init().then((proxiedTk: Remote<VerovioToolkit>) => {
      setTkContainer({ instance: proxiedTk });
    });

    return () => {
      vrvWorker.terminate();
    };
  }, []);

  // Subscribe to updates to mark data as dirty
  useEffect(() => {
    if (!meiFriend) return;

    // Initially data is dirty when a new meiFriend instance is provided
    isDataDirtyRef.current = true;

    const unsubscribe = meiFriend.onUpdate(() => {
      isDataDirtyRef.current = true;
      setRenderTrigger((prev) => prev + 1);
    });

    return () => unsubscribe();
  }, [meiFriend]);

  // Render score when MeiFriend, options, or page changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: renderTrigger is used to force re-render when MeiFriend data updates
  useEffect(() => {
    if (!tk || !meiFriend) return;

    const render = async () => {
      try {
        const currentOptionsStr = JSON.stringify(options);
        const optionsChanged = currentOptionsStr !== lastOptionsStrRef.current;

        if (optionsChanged) {
          isDataDirtyRef.current = true;
          lastOptionsStrRef.current = currentOptionsStr;
        }

        if (isDataDirtyRef.current) {
          const xmlContent = meiFriend.toXmlString();

          await tk.setOptions({
            ...options,
            adjustPageHeight: true,
            adjustPageWidth: true,
          });

          await tk.loadData(xmlContent);

          const pages = await tk.getPageCount();
          onTotalPagesChange?.(pages);

          setScoreModel(meiFriend.getScoreModel());

          isDataDirtyRef.current = false;
        }

        // SVG rendering is fast, do it every time page or layout changes
        const svg = await tk.renderToSVG(currentPage, false);

        setCurrentSvg(svg);
        onRenderCompleted?.();
      } catch (e) {
        console.error("Verovio rendering error:", e);
      }
    };

    render();
  }, [
    tk,
    meiFriend,
    options,
    currentPage,
    renderTrigger,
    onTotalPagesChange,
    onRenderCompleted,
  ]);

  // Apply SVG attributes and fit logic
  useLayoutEffect(() => {
    const container = svgContainerRef.current;
    if (!container || !currentSvg) return;

    applySvgFitStyles(container, fitMode);

    const rootSvg = container.querySelector("svg") as SVGSVGElement | null;
    if (!rootSvg) return;

    // 3. Calculate BBoxes
    const innerSvg = rootSvg.querySelector(
      ".definition-scale",
    ) as SVGSVGElement | null;
    if (!innerSvg) return;

    const newBboxMap = new Map<string, BBox>();
    for (const el of Array.from(innerSvg.querySelectorAll("g[id]"))) {
      const bbox = (el as SVGGraphicsElement).getBBox();
      newBboxMap.set(el.id, {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });
    }
    bboxCacheRef.current = newBboxMap;
  }, [currentSvg, fitMode]);

  // Render Overlays
  useLayoutEffect(() => {
    const container = svgContainerRef.current;
    if (!container || !currentSvg || !scoreModel) return;

    renderOverlays(
      container,
      scoreModel,
      meiFriend,
      bboxCacheRef.current,
      debugFilters,
      selectedId,
      cursor,
      colors,
      highlightId,
    );
  }, [
    currentSvg,
    scoreModel,
    meiFriend,
    debugFilters,
    selectedId,
    cursor,
    colors,
    highlightId,
  ]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const targetId = target.getAttribute("data-target-id");
    if (targetId) {
      onSelectionChange?.(targetId);
    } else {
      onSelectionChange?.(null);
    }
  };

  const svgHtml = useMemo(() => {
    return { __html: currentSvg || "" };
  }, [currentSvg]);

  const containerStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.background || "#fff",
    overflow: "hidden",
  };

  const svgAreaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    cursor: "default",
    overflow: "auto",
    backgroundColor: "#fff",
    textAlign: "center", // Center score horizontally when Fit is Off
  };

  return (
    <div style={containerStyle}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Interactive score canvas */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Interactive score canvas */}
      <div
        style={svgAreaStyle}
        ref={svgContainerRef}
        onClick={handleClick}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Verovio generated SVG
        dangerouslySetInnerHTML={svgHtml}
      />
      {/* While it's possible to display loading and rendering information, it's generally less stressful to display nothing unless the processing speed is extremely slow. Currently, this process is omitted. */}
    </div>
  );
});
