# بنية المشروع

لعبة متصفح ثلاثية الأبعاد لفرز الشحن الجوي، مع غلاف TanStack Start + React يعرضها.

```
inspector-box-ballet/
├── public/                 ما يُنشر فعلياً (لعبة ثابتة بدون بناء)
│   ├── game.html           صفحة اللعبة: الوسم والواجهة فقط
│   ├── game/
│   │   ├── game.js         منطق اللعب والمشهد ثلاثي الأبعاد والصوت
│   │   ├── game.css        تنسيقات الواجهة العربية RTL
│   │   ├── game-rules.js   قواعد IATA والرافعة والطوارئ (مشتركة مع الاختبارات)
│   │   └── images/         خلفية شاشة البداية
│   ├── vendor/
│   │   └── three.min.js    Three.js r128 محلي — لا CDN
│   ├── favicon.ico
│   └── robots.txt
├── src/                    غلاف TanStack Start
│   ├── routes/             مسارات الملفات (index.tsx يعرض game.html في iframe)
│   ├── lib/                معالجة الأخطاء
│   ├── test/               اختبارات Vitest
│   ├── server.ts           غلاف SSR
│   ├── start.ts
│   └── styles.css
├── docs/
│   ├── roadmap.md          خطة التطوير
│   └── screenshots/        لقطات اللعبة المستخدمة في README
├── .github/workflows/
│   ├── ci.yml              lint + typecheck + test
│   └── pages.yml           نشر public/ إلى GitHub Pages
├── AGENTS.md               قواعد التطوير لهذا المشروع
├── README.md               دليل اللعبة والتشغيل
└── STRUCTURE.md            هذا الملف
```

## تدفق العمل

- **تعديل اللعبة:** حرّر `public/game/` فقط. لا تُضف مكتبات من CDN.
- **تعديل القواعد:** `public/game/game-rules.js`، مع تغطية في `src/test/`.
- **تعديل الغلاف:** `src/routes/` (توجيه بالملفات، `routeTree.gen.ts` مُولّد آلياً).
- **النشر:** الدفع إلى `main` ينشر `public/` تلقائياً، و`game.html` يصبح `index.html`.

## أوامر

```sh
npm run dev        # http://localhost:8080
npm test           # Vitest
npm run lint       # ESLint
npm run typecheck  # tsc
npm run build      # إنتاج (NITRO_PRESET لتغيير الهدف)
```

## اختبارات تقرأ الملفات مباشرة

`src/test/*.test.ts` تقرأ `public/game/game.js` و`public/game/game-rules.js` عبر `node:fs`؛
أي نقل أو إعادة تسمية لهذه الملفات يتطلب تحديث المسارات في الاختبارات.
