export const companyName = article => /^company-analysis-[a-z0-9-]+$/.test(article.slug) ? article.title.split('の企業分析')[0] : '';
export function filterDiscovery(articles, { industry = '', order = '', collection = '', ...filters } = {}) {
  let results = articles;
  if (industry) results = results.filter(article => companyName(article) && (article.companyIndustry || '未分類') === industry);
  if (order === 'name') results = [...results].sort((a, b) => (companyName(a) || a.title).localeCompare(companyName(b) || b.title, 'ja', { numeric: true }));
  return results;
}
export function articleMemo(article) {
  const name = companyName(article);
  const title = name ? `${name}の企業研究メモ` : `${article.title}のメモ`;
  const prompts = article.category === 'es' ? ['伝えたい経験', '自分の言葉で書く下書き', '確認・修正すること'] : name ? ['事業・仕事で気になったこと', '自分の経験との接点', '他社との違い・比較したいこと', '説明会や面接で確かめたいこと'] : ['記事から学んだこと', '自分の経験や考え', '次に取り組むこと'];
  return `# ${title}\n\n参考記事：[${article.title}](https://aishukatsu.net/magazine/${article.slug}/)\n\n${prompts.map(heading => `## ${heading}\n\n- \n`).join('\n')}\n`;
}
