export type { EncryptedBlob } from '../lib/crypto';

export type Rank = 'A' | 'B' | 'C' | 'D' | 'N';

export interface TgWebItem {
  id: number;
  q: string;
  a: string;
  rank: Rank;
  verify: boolean;
}

export type TestType =
  | 'tgweb'
  | 'spi'
  | 'tamatebako'
  | 'gab'
  | 'cgab'
  | 'webtesting'
  | 'testcenter';

export interface CategoryDef {
  key: string;
  label: string;
  file: string;
}

export interface TestDef {
  key: TestType;
  label: string;
  short: string;
  categories: ReadonlyArray<CategoryDef>;
}

const ENC = (key: string) => ({ key, file: `${key}.enc.json` });

export const TESTS: ReadonlyArray<TestDef> = [
  {
    key: 'tgweb',
    label: 'TG-WEB',
    short: 'TG-WEB',
    categories: [
      { ...ENC('gengo'), label: '言語' },
      { ...ENC('higengo'), label: '非言語' },
      { ...ENC('suugaku'), label: '数学' },
      { ...ENC('eigo'), label: '英語' },
      { ...ENC('zukei'), label: '図形' },
    ],
  },
  {
    key: 'spi',
    label: 'SPI',
    short: 'SPI',
    categories: [
      { ...ENC('gengo'), label: '言語' },
      { ...ENC('higengo'), label: '非言語' },
      { ...ENC('eigo'), label: '英語' },
    ],
  },
  {
    key: 'tamatebako',
    label: '玉手箱',
    short: '玉手箱',
    categories: [
      { ...ENC('gengo'), label: '言語' },
      { ...ENC('gengo_fuitchi'), label: '言語(不一致)' },
      { ...ENC('higengo_zuhyou'), label: '非言語(図表)' },
      { ...ENC('higengo_kuuran'), label: '非言語(空欄)' },
      { ...ENC('higengo_kongou'), label: '非言語(混合)' },
      { ...ENC('higengo_fuitchi'), label: '非言語(不一致)' },
      { ...ENC('eigo'), label: '英語' },
      { ...ENC('shingata'), label: '新型' },
    ],
  },
  {
    key: 'gab',
    label: 'GAB',
    short: 'GAB',
    categories: [
      { ...ENC('gengo'), label: '言語' },
      { ...ENC('higengo'), label: '非言語' },
      { ...ENC('eigo'), label: '英語' },
    ],
  },
  {
    key: 'cgab',
    label: 'C-GAB',
    short: 'C-GAB',
    categories: [
      { ...ENC('gengo'), label: '言語' },
      { ...ENC('keisuu'), label: '計数' },
      { ...ENC('eigo'), label: '英語' },
    ],
  },
  {
    key: 'webtesting',
    label: 'WEBテスティング',
    short: 'WEBテスト',
    categories: [
      { ...ENC('gengo'), label: '言語' },
      { ...ENC('higengo'), label: '非言語' },
      { ...ENC('eigo'), label: '英語' },
    ],
  },
  {
    key: 'testcenter',
    label: 'テストセンター',
    short: 'テストセンター',
    categories: [
      { ...ENC('gengo'), label: '言語' },
      { ...ENC('higengo'), label: '非言語' },
      { ...ENC('eigo'), label: '英語' },
    ],
  },
];

export function findTest(key: TestType): TestDef {
  const t = TESTS.find((x) => x.key === key);
  if (!t) throw new Error(`unknown test: ${key}`);
  return t;
}
