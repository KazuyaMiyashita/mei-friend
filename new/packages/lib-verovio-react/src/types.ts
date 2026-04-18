export interface DebugFilters {
  measure?: boolean;
  staff?: boolean;
  note?: boolean;
  caret?: boolean;
}

export interface VerovioCanvasColors {
  background?: string;
  score?: string;
  caret?: string;
  overlay?: string;
  measureOverlay?: string;
  staffOverlay?: string;
  noteOverlay?: string;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
