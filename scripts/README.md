# scripts/

Maintenance scripts that run outside the browser with Node.js.

## uploadCompanyContent.ts

Walks a local "就活" folder (default: `~/Desktop/就活`) and pushes each
company's four Markdown files into Firestore at `/companyContent/{companyName}`.

Once uploaded, the app will fetch this populated content when it creates a
new company folder (via onboarding bulk-create or the manual "企業追加"
button), so users get a real analysis instead of an empty template.

### One-time setup: obtain a service account key

1. Firebase Console → Project Settings → **Service accounts** tab
2. Click **Generate new private key** → save the JSON file somewhere safe
   (e.g. `~/.config/firebase/aisyuukatsu-admin.json`)
3. **Do not commit this file.** It grants admin access to the project.

### Run

```sh
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/aisyuukatsu-admin.json

# dry run — prints what would be uploaded without touching Firestore
npm run upload:content -- --dry-run

# real upload
npm run upload:content
```

### Configuration

- `GOOGLE_APPLICATION_CREDENTIALS` (required) — path to the service account JSON.
- `SOURCE_ROOT` (optional) — override the folder to read from. Defaults to
  `~/Desktop/就活`.

### What gets uploaded

For each `<SOURCE_ROOT>/<industry>/<company>/` folder, the script reads these
four files (if present) and uploads them together in a single Firestore doc:

- `企業分析.md`
- `ES・面接対策.md`
- `インターン.md`
- `説明会・イベントメモ.md`

Top-level non-industry folders are ignored: `_テンプレート`, `自己分析`,
`練習`, `.git`, `.claude`, and anything starting with `.`.

Companies that have **none** of the four files are skipped (no doc created).

The document ID is the raw company folder name. The industry name is only
used for logging and is **not** stored in the document — the app keys by
company name only, because industry taxonomy differs between the source
folder and `industryCompanies.json`.

### Firestore doc shape

```ts
/companyContent/{companyName} {
  version: 1,
  files: {
    "企業分析.md": "# 企業分析：DeNA\n...",
    "ES・面接対策.md": "...",
    "インターン.md": "...",
    "説明会・イベントメモ.md": "..."
  },
  sourceName: "DeNA",
  updatedAt: <server timestamp>
}
```

### Security rules

Recommended rules for the `companyContent` collection (set in Firebase Console):

```
match /companyContent/{doc} {
  allow read:  if request.auth != null;
  allow write: if false;           // only the admin SDK writes
}
```

The upload script uses a service account which bypasses security rules, so
`write: if false` is correct and prevents any client from modifying the
global content.
