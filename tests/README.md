# テスト

ページやルールを変えたら、pushする前にここでテストします（GitHubにpushすると自動でも走ります）。

```
cd tests
npm install
npx playwright install chromium
npm test
```

- `rules.test.mjs`：Firestoreのルール。ふつうの操作が通ることと、なりすまし・連投・スーパーいいねの水増しなどが止まることを確認
- `e2e.test.mjs`：ページを実際に動かして、登録・公開・写真・コメント・AIチェック・いいね・スーパーいいね・管理タブ・CSP・ほかのサイトへの埋め込み拒否を確認

Firebaseのエミュレータ（パソコンの中の練習用Firebase）を使うので、本物のデータには触れません。
AIとGoogleログインは、テスト用の偽物に置きかえています。
