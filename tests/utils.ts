export const handbookDoi = '10.1000/182';

export const extensionPages = [
  'bubble',
  'citation',
  'notification',
  'offscreen',
  'options',
  'qr',
] as const;
export type ExtensionPage = (typeof extensionPages)[number];

