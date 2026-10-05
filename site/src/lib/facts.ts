/**
 * Canonical business facts. Every page, FAQ and schema node must agree with
 * these. The migrated WordPress copy contradicted itself (MOQ 50 / 100 / "no
 * minimum"; turnaround 3–5 / 5–7 / 7–10 / 8–10 days); these are the values the
 * majority of the published copy and the homepage headline used.
 */
export const FACTS = {
  unitPriceFrom: 0.3,
  unitPriceFromLabel: '$0.30',
  minOrder: 100,
  minOrderLabel: '100 stickers',
  productionDays: '5–7 business days',
  deliveryDays: '8–10 business days',
  rush: 'Rush production available on request',
  shipping: 'Free shipping within the United States',
  carrier: 'FedEx',
  proof: 'Free digital proof before printing',
  design: 'Free design support and artwork fixes',
  finishes: ['Gloss', 'Matte', 'Spot UV'],
  printing: 'Full-color CMYK and Pantone matching, offset or digital depending on run length',
  adhesives: ['Permanent', 'Removable'],
  returnsDays: 10,
  artworkFormats: 'PDF, AI, EPS, SVG, PNG or JPG (300 dpi or vector)',
  minSize: '0.5"',
  maxSize: '24" x 36"',
} as const;
