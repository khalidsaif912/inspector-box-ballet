# مستودع الشحن الجوي الدولي (Inspector Box Ballet)

لعبة ثلاثية الأبعاد بالعربية لفرز الشحنات الجوية والمواد الخطرة وفق قواعد IATA DGR.
اللعبة نفسها في `public/game.html` (Three.js)، وقواعد الرافعة الشوكية في `public/game-rules.js`،
وتُعرض داخل تطبيق TanStack Start + React.

## المتطلبات

Node.js 22 أو أحدث (أو Bun).

## الأوامر

```sh
npm install        # تثبيت الحزم
npm run dev        # تشغيل محلي على http://localhost:8080
npm run build      # بناء نسخة الإنتاج في .output/
npm run preview    # معاينة نسخة البناء
npm test           # تشغيل الاختبارات (Vitest)
```

## ملاحظات

- البناء الافتراضي يستهدف Cloudflare Workers. للنشر على منصة أخرى غيّر الهدف بمتغير البيئة
  `NITRO_PRESET`، مثل `NITRO_PRESET=netlify npm run build`.
