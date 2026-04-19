import { Column, Row, STATUS_VALUES } from '../types/sheet';

const INDUSTRY_OPTIONS = [
  'IT・ソフトウェア',
  '通信',
  'メーカー',
  '商社',
  '金融',
  'コンサル',
  '広告・マスコミ',
  '不動産・建設',
  '小売・サービス',
  '物流',
  'インフラ',
  'その他',
];

const KUBUN_OPTIONS = ['本選考', 'インターン'];

export function createPresetColumns(): Column[] {
  return [
    { id: 'company', name: '企業名', type: 'text', width: 160, role: 'company' },
    {
      id: 'industry',
      name: '業界',
      type: 'select',
      options: INDUSTRY_OPTIONS,
      width: 130,
      role: 'category',
    },
    {
      id: 'kubun',
      name: '区分',
      type: 'select',
      options: KUBUN_OPTIONS,
      width: 90,
    },
    { id: 'rating', name: '志望度', type: 'rating', width: 110 },
    {
      id: 'status',
      name: 'ステータス',
      type: 'select',
      options: [...STATUS_VALUES],
      width: 120,
      role: 'status',
    },
    { id: 'es_deadline', name: 'ES締切', type: 'date', width: 120 },
    { id: 'webtest_deadline', name: 'Webテスト締切', type: 'date', width: 130 },
    { id: 'interview_at', name: '面接日程', type: 'datetime', width: 150 },
    { id: 'mypage_url', name: 'マイページURL', type: 'url', width: 200 },
    { id: 'login_id', name: 'ID', type: 'text', width: 110 },
    { id: 'password', name: 'パスワード', type: 'password', width: 110 },
    { id: 'memo', name: 'メモ', type: 'longtext', width: 220 },
  ];
}

export function createEmptyRow(columns: Column[]): Row {
  const cells: Record<string, ReturnType<typeof initialCellValue>> = {};
  for (const c of columns) {
    cells[c.id] = initialCellValue(c);
  }
  return {
    id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    cells,
  };
}

function initialCellValue(c: Column) {
  if (c.type === 'rating') return 0;
  if (c.type === 'checkbox') return false;
  if (c.id === 'status') return '未応募';
  return '';
}
