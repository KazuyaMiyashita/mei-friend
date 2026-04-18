export interface DebugFilters {
  staff?: boolean;
  note?: boolean;
  caret?: boolean;
}

export interface VerovioCanvasColors {
  background?: string;
  score?: string;
  caret?: string;
  overlay?: string;
  staffOverlay?: string;
  noteOverlay?: string;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
