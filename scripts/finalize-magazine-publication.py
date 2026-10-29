#!/usr/bin/env python3
"""Record completion only after all 1,000 articles are publicly verified."""
import collections, datetime, hashlib, html, json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
release = pathlib.Path(sys.argv[1])
verification = json.loads((release / 'live-verification.json').read_text())
assert not verification['failures'] and verification['matched'] == verification['paths']
plan_dir = root / 'docs/editorial/2026-10-26-title-plan'
plan = json.loads((plan_dir / 'titles-1000.json').read_text())
publication = json.loads((root / 'content/editorial/publication-log.json').read_text())
by_id = {a['id']: a for a in publication['articles']}
assert set(by_id) == {f'J{i:04}' for i in range(1, 1001)}
assert not list((root / 'content/editorial/production-work').glob('*quality-error.json'))
paths = {r['path'] for r in verification['results'] if r['matches']}
models, sizes = collections.Counter(), []
for item in plan['articles']:
    entry = by_id[item['id']]
    article_path = '/magazine/' + entry['slug'] + '/'
    assert article_path in paths, article_path
    published = json.loads((root / 'content/magazine' / (entry['slug'] + '.json')).read_text())
    assert published['title'] == item['title']
    assert hashlib.sha256(json.dumps(published, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest() == entry['sha256']
    item.update(status='公開済み', url=verification['origin'] + article_path, datePublished=entry['datePublished'])
    sizes.append(entry['bodyCharacters'])
    models.update(entry['models'])
plan['publication'] = {'completedAt': verification['verifiedAt'], 'publishedCount': 1000, 'origin': verification['origin']}
(plan_dir / 'titles-1000.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')

index_path = plan_dir / 'index.html'
index = index_path.read_text()
index = index.replace('20分野に整理した執筆前の企画一覧です。', '20分野に整理した公開済み記事の一覧です。タイトルをクリックすると本文を開けます。')
index = index.replace('本文はClaude Sonnetで執筆する想定です。現在の段階はタイトル企画で、本文は未執筆・未公開です。', '本文はClaude Sonnet 4.6で執筆し、校正・編集確認を経て1,000本を公開しました。')
for item in plan['articles']:
    pattern = r'(<tr[^>]*><td>' + item['id'] + r'</td>.*?<td class="title">).*?(</td><td>.*?</td><td>).*?(</td></tr>)'
    title = '<a href="' + html.escape(item['url'], quote=True) + '">' + html.escape(item['title']) + '</a>'
    index, count = re.subn(pattern, lambda m: m[1] + title + m[2] + html.escape(item['intent']) + m[3], index)
    assert count == 1, item['id']
index_path.write_text(index)

md_path = plan_dir / 'titles-1000.md'
md = md_path.read_text().replace('本文執筆・公開前の企画一覧。', '1,000本を執筆・公開済み。タイトルから公開記事を開けます。')
for item in plan['articles']:
    lines = md.splitlines()
    for i, line in enumerate(lines):
        if line.startswith('| ' + item['id'] + ' |'):
            lines[i] = '| ' + ' | '.join([item['id'], item['priority'], '[' + item['title'].replace('|', '\\|') + '](' + item['url'] + ')', item['keyword'].replace('|', '\\|'), item['intent'].replace('|', '\\|')]) + ' |'
            break
    md = '\n'.join(lines) + '\n'
md_path.write_text(md)

editorial = plan_dir / 'editorial-plan.md'
editorial.write_text(editorial.read_text().replace('今回の納品範囲は記事タイトル1,000本と編集方針です。本文の執筆・本番公開はまだ行っていません。', '企画した1,000本はClaude Sonnet 4.6で執筆し、AI校正・編集確認後に本番公開しました。公開URLはタイトル一覧に記録しています。'))
search_console_path = root / 'content/editorial/search-console-status.json'
search_console = json.loads(search_console_path.read_text()) if search_console_path.exists() else {'indexingConfirmed': False, 'note': 'Search Consoleの確認記録なし。'}
summary = {'newArticlesPublished': 1000, 'existingArticles': 6, 'totalPublished': 1006, 'release': str(release), 'verifiedAt': verification['verifiedAt'], 'verifiedPaths': verification['paths'], 'matchingPaths': verification['matched'], 'origin': verification['origin'], 'authorModels': dict(models), 'bodyCharacters': {'minimum': min(sizes), 'maximum': max(sizes), 'total': sum(sizes)}, 'searchConsole': search_console}
(root / 'content/editorial/latest-publication.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(summary, ensure_ascii=False, indent=2))
