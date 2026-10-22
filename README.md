# 作品原価帳

ハンドメイド作品の原価・販売価格・仕入れを計算し、作品を公開して「いいね」「スーパーいいね」「コメント」をもらえるページです。

- ページ：https://monogame203.github.io/genka-book/
- データは Firebase（Firestore）に保存します。設定手順は [SETUP.md](SETUP.md) を見てください。
- `firestore.rules` は Firebase コンソールの Firestore → ルール に貼り付けて使います。
- セキュリティ設定は [SETUP.md](SETUP.md) の「セキュリティ設定（強化版）」にあります。
- `index.html` のスクリプトを書きかえたら `python3 tools/build.py` を実行してください（CSPの作り直し）。
