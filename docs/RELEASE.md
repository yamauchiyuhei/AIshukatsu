# デスクトップアプリ リリース手順

AI就活 デスクトップアプリを macOS / Windows 向けにビルド・署名・配布するための手順書です。

---

## 1. 一度だけ行うセットアップ

### 1.1 Tauri Updater 署名鍵の生成

自動更新で改ざん検知するための Ed25519 鍵ペアを生成します。

```bash
# 公開鍵・秘密鍵をホームディレクトリ外の安全な場所に出力
npx tauri signer generate -w ~/.tauri/aisyuukatsu.key
```

- パスワードの入力を求められたら、長めのものを設定し**絶対に紛失しないこと**。
- 出力された公開鍵 (`*.pub` の中身) をコピーし、`src-tauri/tauri.conf.json` の `plugins.updater.pubkey` に貼り付け、commit する。
- 秘密鍵 (`~/.tauri/aisyuukatsu.key`) は GitHub Secrets に登録します (後述)。**リポジトリには絶対にコミットしない**。

### 1.2 Apple Developer 証明書 (macOS 署名・公証)

Apple Developer Program ($99/年) が必要です。

1. [developer.apple.com](https://developer.apple.com/account/resources/certificates/list) → Certificates → `+` で **Developer ID Application** 証明書を作成
2. Keychain Access で該当証明書を右クリック → 書き出し → `.p12` 形式で保存 (パスワードを設定)
3. [appleid.apple.com](https://appleid.apple.com/) → サインインとセキュリティ → App 用パスワード → 新規発行 (`notarytool` 用)
4. Team ID を控える ([Membership](https://developer.apple.com/account#MembershipDetailsCard) ページ)

### 1.3 Windows コード署名証明書 (任意だが推奨)

SmartScreen 警告の緩和に必要。DigiCert / Sectigo / GlobalSign 等から EV または OV 証明書を購入して `.pfx` 形式で保存。

---

## 2. GitHub Secrets の登録

リポジトリの **Settings → Secrets and variables → Actions → New repository secret** から以下を登録します。

### Tauri Updater
| Secret 名 | 値 |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | `cat ~/.tauri/aisyuukatsu.key` の**全文** (BEGIN/END 行含む) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 1.1 で設定したパスワード |

### Firebase (Vite ビルド時に注入)
| Secret 名 | 値 |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console → プロジェクト設定 → 全般 → ウェブ API キー |
| `VITE_FIREBASE_AUTH_DOMAIN` | `aisyuukatsu-30fdd.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `aisyuukatsu-30fdd` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `aisyuukatsu-30fdd.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase プロジェクト設定から |
| `VITE_FIREBASE_APP_ID` | Firebase プロジェクト設定から |

### macOS 署名・公証
| Secret 名 | 値 |
|---|---|
| `APPLE_CERTIFICATE` | `base64 -i DeveloperID.p12 \| pbcopy` でクリップボードに出したものを貼る |
| `APPLE_CERTIFICATE_PASSWORD` | p12 のパスワード |
| `APPLE_SIGNING_IDENTITY` | 例: `Developer ID Application: Yuhei Yamauchi (XXXXXXXXXX)` |
| `APPLE_ID` | Apple ID メールアドレス |
| `APPLE_PASSWORD` | App 用パスワード |
| `APPLE_TEAM_ID` | 10文字の Team ID |

### Windows 署名 (任意)
| Secret 名 | 値 |
|---|---|
| `WINDOWS_CERTIFICATE` | `base64 -i cert.pfx \| pbcopy` の結果 |
| `WINDOWS_CERTIFICATE_PASSWORD` | pfx のパスワード |

---

## 3. リリースする

### 3.1 タグを打って自動ビルド

```bash
# package.json と src-tauri/tauri.conf.json と src-tauri/Cargo.toml の version を揃える
# 例: 0.1.0 → 0.1.1

git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to 0.1.1"
git tag v0.1.1
git push origin main --tags
```

タグがプッシュされると `.github/workflows/release.yml` が起動し、macOS (Universal) + Windows (x64) のビルド・署名・公証・アップロードを行い、**draft release** を作成します。

### 3.2 リリースを確認して公開

1. GitHub の Releases タブで draft を開き、成果物を確認:
   - `AI就活_0.1.1_universal.dmg` (macOS)
   - `AI就活_0.1.1_x64-setup.exe` (Windows NSIS)
   - `AI就活_0.1.1_x64_en-US.msi` (Windows MSI)
   - `latest.json` (Tauri Updater マニフェスト)
   - 各プラットフォーム用の `*.sig` (Updater 署名)
2. リリースノートを編集して **Publish release** をクリック

公開後、既存インストール済みユーザーは次回起動時に Tauri Updater 経由で自動更新されます。

### 3.3 手動トリガー

タグを打たずに Actions タブから `Release Desktop App` → `Run workflow` で任意のタグ名を指定してビルドすることもできます。

---

## 4. Firebase Auth の追加設定

Tauri デスクトップアプリのサインインは外部ブラウザ + deep link 方式です。以下を確認:

1. **Firebase Console → Authentication → Settings → Authorized domains** に `aisyuukatsu-30fdd.web.app` が含まれていること
2. **Firebase Hosting** に `dist/desktop-auth.html` が配信されていること (`npm run build` + `firebase deploy --only hosting` で OK)
3. macOS / Windows で `aisyuukatsu://` スキームは Tauri が `tauri.conf.json` の `plugins.deep-link.desktop.schemes` 設定からビルド時に自動登録する

デスクトップアプリでログインボタンを押すと:
1. 既定ブラウザで `https://aisyuukatsu-30fdd.web.app/desktop-auth.html` が開く
2. ユーザーが Google アカウントでサインイン
3. 同ページが `aisyuukatsu://auth-callback?idToken=...&accessToken=...` へナビゲート
4. OS が URL を Tauri アプリに引き渡し、`plugin-deep-link` の `onOpenUrl` イベントで受信
5. `signInWithCredential` でローカル Auth を完成

---

## 5. ローカルで試すには

- Web 版: `npm run dev`
- デスクトップ版: `npm run tauri:dev` (初回は Rust のビルドに 5〜10 分かかる)
- 配布用バイナリをローカルで作るには: `npm run tauri:build` (署名なし)

---

## トラブルシューティング

| 症状 | 原因 / 対処 |
|---|---|
| macOS ビルドが `errSecInternalComponent` で失敗 | Keychain のロックが原因。GitHub Actions では通常起こらないが、自前の macOS ランナーを使っている場合 `security unlock-keychain` を挟む |
| 公証が通らない | `APPLE_TEAM_ID` が正しいか、App 用パスワードが有効か確認 |
| Tauri Updater が反応しない | `tauri.conf.json` の `plugins.updater.pubkey` と Secrets の秘密鍵が対応しているか確認。古い pubkey で署名された既存インストールは新しい鍵を受け付けない |
| Windows で SmartScreen 警告 | コード署名証明書なしだと出る。EV 証明書で評判を積めば消える |
| デスクトップのサインインがループする | Firebase Console の Authorized domains と、`desktop-auth.html` の Firebase 設定を確認 |
