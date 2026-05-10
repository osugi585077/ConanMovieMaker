# コナン映画予告メーカー

React + TypeScript + Vite + Tailwind CSS の画像編集ツールです。

## 起動

```bash
npm install
npm run dev
```

開発サーバーは `http://127.0.0.1:5175/` で起動します。

## 機能

- JPG / PNG / WebP 画像を1枚アップロード
- 最大ファイルサイズ 10MB
- `public/original-aoyama.png` を固定ロゴ素材として重ねる
- ロゴのドラッグ移動、スライダー拡大縮小、縦横比固定
- ロゴが画像エリア内に収まるように制限
- 上下黒帯のON/OFFと高さ調整
- リセット
- 元画像解像度を基準にPNG保存
- サーバーに画像を保存しないローカル処理
- 例画像の表示
- Osugiクレジット表示

## 公開

GitHub Pages が `main` ブランチのルートを配信する設定のため、ルートの `index.html` と `assets/` はビルド済み公開ファイルです。
