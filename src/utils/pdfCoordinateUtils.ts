import { BoundingBox } from '../types/pdfTypes';

/**
 * Normalizes bounding box coordinates from PDF units (0-1000) to canvas pixel coordinates.
 * @param box The bounding box with coordinates in PDF units.
 * @param pageWidth The width of the rendered PDF page in pixels.
 * @param pageHeight The height of the rendered PDF page in pixels.
 * @param scale The current zoom scale of the PDF page.
 * @returns The bounding box coordinates in canvas pixels.
 */
export const normalizeCoordinates = (box: BoundingBox, pageWidth: number, pageHeight: number, scale: number) => {
  return {
    x: (box.x / 1000) * pageWidth * scale,
    y: (box.y / 1000) * pageHeight * scale,
    width: (box.width / 1000) * pageWidth * scale,
    height: (box.height / 1000) * pageHeight * scale
  };
};

/**
 * Denormalizes coordinates from canvas pixel coordinates back to PDF units (0-1000).
 * @param x The x-coordinate in canvas pixels.
 * @param y The y-coordinate in canvas pixels.
 * @param width The width in canvas pixels.
 * @param height The height in canvas pixels.
 * @param pageWidth The width of the rendered PDF page in pixels.
 * @param pageHeight The height of the rendered PDF page in pixels.
 * @param scale The current zoom scale of the PDF page.
 * @returns The coordinates in PDF units.
 */
export const denormalizeCoordinates = (
  x: number, y: number, width: number, height: number,
  pageWidth: number, pageHeight: number, scale: number
) => {
  return {
    x: Math.round((x / scale) / pageWidth * 1000),
    y: Math.round((y / scale) / pageHeight * 1000),
    width: Math.round((width / scale) / pageWidth * 1000),
    height: Math.round((height / scale) / pageHeight * 1000)
  };
};
