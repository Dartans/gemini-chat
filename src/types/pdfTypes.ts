export interface BoundingBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  id?: string; // Unique ID for box identification
}

export interface PdfResults {
  pages: Array<{
    boxes: BoundingBox[];
  }>;
}