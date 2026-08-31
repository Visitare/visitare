# Fontes de marca do PWA

`icon-app.svg` e `icon-maskable.svg` são as **fontes** dos ícones do PWA. Os PNGs
em `public/` são derivados — não edite os PNGs à mão.

O símbolo é o mesmo de `site/public/favicon.svg` (a porta), para que o app e o
site sejam reconhecíveis como a mesma marca. Cores vêm de `shared/tokens.ts`:
teal `#006D77` de fundo, moldura mint `#83C5BE`, porta ivory `#FFFEF1`.

Por que dois arquivos: `icon-maskable.svg` é full-bleed com o símbolo dentro da
zona segura (círculo de 80% do lado), porque o Android recorta a moldura do
ícone adaptativo como bem entender. O `icon-app.svg` tem canto arredondado
próprio, para quando o sistema exibe o ícone sem máscara.

## Regenerar os PNGs

```bash
npx --yes sharp-cli@5 -i brand/icon-app.svg      -o public/pwa-192x192.png resize 192 192
npx --yes sharp-cli@5 -i brand/icon-app.svg      -o public/pwa-512x512.png resize 512 512
npx --yes sharp-cli@5 -i brand/icon-app.svg      -o public/apple-touch-icon.png resize 180 180
npx --yes sharp-cli@5 -i brand/icon-maskable.svg -o public/pwa-maskable-512x512.png resize 512 512
```

`sharp` fica fora do `package.json` de propósito: é dependência nativa pesada e
os ícones mudam uma vez por ano, não a cada build.
