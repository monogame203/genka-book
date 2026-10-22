#!/usr/bin/env python3
"""index.html のセキュリティ設定（CSP）を作り直します。

index.html の中の <script> を書きかえたら、必ずこれを実行してください:
    python3 tools/build.py
CSP は「この中身のスクリプトだけ実行してよい」という指紋（ハッシュ）を持っているので、
スクリプトを書きかえたのにこれを実行しないと、ページが動かなくなります。
"""
import base64, hashlib, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
page = ROOT / 'index.html'
extra_connect = ' '.join(sys.argv[1:])  # テスト用（例: http://127.0.0.1:8080）

html = page.read_text(encoding='utf-8')
html = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', html)
scripts = re.findall(r'<script>(.*?)</script>', html, flags=re.S)
hashes = ' '.join("'sha256-%s'" % base64.b64encode(hashlib.sha256(s.encode('utf-8')).digest()).decode() for s in scripts)
csp = '; '.join([
    "default-src 'none'",
    "script-src 'self' %s https://www.gstatic.com https://apis.google.com https://www.google.com https://www.recaptcha.net" % hashes,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://www.gstatic.com https://*.googleusercontent.com",
    "connect-src 'self' https://*.googleapis.com https://apis.google.com https://www.google.com https://www.recaptcha.net https://www.gstatic.com %s" % extra_connect,
    "frame-src https://genka-book.firebaseapp.com https://accounts.google.com https://apis.google.com https://www.google.com https://www.recaptcha.net",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
])
meta = '<meta http-equiv="Content-Security-Policy" content="%s">' % csp.strip()
html = html.replace('<meta charset=utf8>', '<meta charset=utf8>' + meta, 1)
page.write_text(html, encoding='utf-8')
print('CSP updated:', len(scripts), 'script(s)')
