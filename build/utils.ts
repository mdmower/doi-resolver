import path from 'node:path';

export const browsers = ['chrome', 'edge', 'firefox'] as const;
export type Browser = (typeof browsers)[number];

export const dirRef = {
  root: path.join(import.meta.dirname, '..'),
  dist: path.join(import.meta.dirname, '../dist'),
  pkg: path.join(import.meta.dirname, '../pkg'),
  src: path.join(import.meta.dirname, '../src'),
  static: path.join(import.meta.dirname, '../static'),
  csl: path.join(import.meta.dirname, '../src/csl'),
};
