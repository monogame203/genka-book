# 作品原価帳：誰でも使えるようにする設定（Firebase）

このページを GitHub Pages で公開し、Firebase（Google の無料のデータ保存サービス）につなぐと、
**リンクを開いた人なら誰でも** 作品の登録・公開・いいね・スーパーいいね・コメントができます。

- 開いた人は自動で「ゲスト」としてログインします（登録不要）。データはそのブラウザに結びつきます。
- 「Googleでログイン」すると、ほかのスマホやパソコンでも同じデータが使えます。
- 作成者（あなた）は Google でログインすると「管理」タブが出ます。

所要時間：15〜20分。お金はかかりません（無料枠：1日 読み取り5万回・書き込み2万回まで）。

---

## 1. Firebase プロジェクトを作る

1. https://console.firebase.google.com を開き、Google アカウントでログイン
2. 「プロジェクトを作成」→ 名前（例：`genka-book`）を入れて進む（Google アナリティクスはオフでOK）

## 2. ログイン方法を有効にする

1. 左メニュー「構築」→「Authentication」→「始める」
2. 「Sign-in method」タブで次の2つを有効にする
   - **匿名**（ゲストとして使うため）
   - **Google**（作成者のログインと、端末をまたいだ同期のため）
3. 「Settings」タブ →「承認済みドメイン」→「ドメインを追加」で次を追加
   - `monogame203.github.io`

## 3. データベースを作る

1. 左メニュー「構築」→「Firestore Database」→「データベースを作成」
2. 場所は `asia-northeast1（東京）` を選ぶ →「本番環境モード」で作成
3. 「ルール」タブを開き、このリポジトリの `firestore.rules` の中身を全部貼り付ける
4. `YOUR_EMAIL@gmail.com` を **あなたの Google アカウントのメールアドレス** に書き換えて「公開」

## 3.5 コメントのAIチェック（Gemini）を有効にする

コメントは送信する前に必ず AI（Google の Gemini 無料版）が確認します。これを有効にしないと、コメントが送信できません。

1. 左メニューから「AI Logic」（「Firebase AI Logic」）を開く
   - 見つからないときは `https://console.firebase.google.com/project/genka-book/ailogic` を開く
2. 「始める」（Get started）を押す
3. 「Gemini Developer API」を選んで有効にする（無料。カード登録は不要）
   - 「Vertex AI Gemini API」は有料プランが必要なので選ばない

## 4. 設定をページに入れる

1. プロジェクトの概要（左上の歯車）→「プロジェクトの設定」→ 下の「マイアプリ」で `</>`（ウェブ）を押す
2. アプリ名を入れて登録（Firebase Hosting はチェック不要）
3. 表示される `const firebaseConfig = { ... }` の `{ ... }` の部分をコピー
4. `firebase-config.js` を開き、`firebase: null,` を `firebase: { ...コピーした内容... },` に置き換える
5. 同じファイルの `ownerEmails` の `YOUR_EMAIL@gmail.com` もあなたのメールアドレスに書き換える

（この手順は、設定内容を Claude に貼り付けてもらえれば代わりに書き込みます）

## 5. GitHub Pages で公開する

1. GitHub のリポジトリ →「Settings」→「Pages」
2. 「Build and deployment」→ Source を「Deploy from a branch」、Branch を `main` / `/(root)` にして保存
3. 数分後、次のURLで開けます
   - `https://monogame203.github.io/genka-book/`

## 6. 動作確認

1. 上のURLを開き、「作品」→「サンプルを入れて試す」
2. 作品を開いて公開設定を「公開」にし、表示する名前を入れて保存
3. 別のスマホ（またはシークレットウィンドウ）で同じURLを開き、「みんな」タブで作品が見えて、いいね・コメントできればOK
4. あなたは「アカウント」→「Googleでログイン」すると「管理」タブが出ます

## 注意

- ゲストはブラウザごとに別の人として扱われます。ブラウザのデータを消すと、その人の帳簿にはアクセスできなくなります（Googleでログインしておけば大丈夫です）。
- 誰でも書き込めるため、荒らし対策として NGワード・通報・ブロック（管理タブ）を使ってください。ブロックした人はデータベース側でも書き込めなくなります。
- 1人が別のブラウザを使って何度もいいねすることは防げません。

---

# セキュリティ設定（強化版）

ページとルールでは、次の対策をしています。

| 対策 | 内容 |
|---|---|
| 書き込みの検査 | すべての書き込みで、項目・型・文字数をルールで検査。決められた場所以外は読み書き禁止 |
| 自分のデータだけ | 作品・コメント・いいね・名前は本人だけが書ける。帳簿は本人だけが読める（作成者も見られない） |
| 連続投稿の制限 | 作品の公開とコメントは5秒に1回まで（サーバーの時刻で判定） |
| いいね | Googleログインした人だけ、1作品1回、1回の書き込みで1作品だけ |
| スーパーいいね | 日本時間で1日1回、1回に1つずつ、自分の作品には不可（ルールで判定するので、ページを改造してもごまかせない） |
| ブロック | ブロックした人は、公開・コメント・名前の変更ができない |
| 作成者 | メール確認済みの、指定したGoogleアカウントだけ |
| 写真 | JPEG形式・約180KBまで |
| コメントのAIチェック | 送信前に必ずGeminiが確認。確認できないときは送信しない |
| CSP | ページの中では、決められた場所（Google/Firebase）のプログラムしか動かない。ほかのサイトの中に埋め込まれると動かない |

## あなたがコンソールで行う設定

### 1. ルールを貼り直す（必須）
`firestore.rules` の中身を全部、Firestore Database →「ルール」に貼り付けて「公開」。
データの置き場所が変わったので、古いルールのままだと作品の公開やコメントができません。

#### ルールの入力欄が操作できないとき：GitHubから自動で反映する
ルールを手で貼る代わりに、GitHubにpushしたとき（テストが通ったあと）自動で反映できます。最初に1回だけ、次の設定をします。

1. https://console.cloud.google.com/iam-admin/serviceaccounts?project=genka-book を開く
2. 「サービスアカウントを作成」→ 名前に `rules-deployer` と入れて「作成して続行」
3. 「ロールを選択」で次の2つを追加して「続行」→「完了」
   - `Firebase Rules 管理者`（Firebase Rules Admin）
   - `Service Usage ユーザー`（Service Usage Consumer）
4. 一覧の `rules-deployer` を押す →「キー」タブ →「鍵を追加」→「新しい鍵を作成」→「JSON」→「作成」
   - JSONファイルがダウンロードされます。**この中身は合鍵なので、人に見せたりチャットに貼ったりしないでください。**
5. https://github.com/monogame203/genka-book/settings/secrets/actions を開く →「New repository secret」
   - Name：`FIREBASE_SERVICE_ACCOUNT`
   - Secret：ダウンロードしたJSONファイルの中身を全部貼る →「Add secret」
6. ダウンロードしたJSONファイルは削除する
7. https://github.com/monogame203/genka-book/actions を開き、「テスト」→「Run workflow」を押すと、テストのあとルールが反映されます

この鍵でできるのは、ルールの反映だけです（データを読んだり消したりはできません）。

### 2. APIキーを、このページからしか使えないようにする（おすすめ）
1. https://console.cloud.google.com/apis/credentials?project=genka-book を開く
2. 「APIキー」の中の「Browser key (auto created by Firebase)」を押す
3. 「アプリケーションの制限」で「ウェブサイト」を選び、次の2つを追加して保存
   - `https://monogame203.github.io/*`
   - `https://genka-book.firebaseapp.com/*`

### 3. 承認済みドメインを整理する（おすすめ）
Authentication →「設定」→「承認済みドメイン」に、次の3つ以外があれば削除します。
- `monogame203.github.io`
- `genka-book.firebaseapp.com`
- `genka-book.web.app`

（`localhost` も、ページを手元で試さないなら削除して大丈夫です）

### 4. 無料プラン（Spark）のままにする
Blaze（従量課金）にしなければ、不正に使われてもお金はかかりません。

### 5. 作成者のGoogleアカウントに2段階認証をかける
作成者のアカウントが乗っ取られると管理画面も使われてしまうので、
https://myaccount.google.com/security で「2段階認証プロセス」をオンにしてください。

### 6. App Check（あとでやる）
reCAPTCHA v3 のサイトキーを作って `firebase-config.js` の `appCheckSiteKey` に入れると、
このページ以外からのアクセスを止められます。Claude に「App Checkやりたい」と言えば手順を案内します。
**サイトキーを入れる前に、コンソールで App Check の「適用」を押さないでください。**

## ページを書きかえたとき
`index.html` の `<script>` を書きかえたら、`python3 tools/build.py` を実行してCSPを作り直してください。
しないとページが動かなくなります。
