import path from 'node:path';
import {styleText} from 'node:util';

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

export const red = (s: string): string => styleText(['bold', 'red'], s);
export const green = (s: string): string => styleText(['bold', 'green'], s);
export const cyan = (s: string): string => styleText(['bold', 'cyan'], s);
export const yellow = (s: string): string => styleText(['bold', 'yellow'], s);
