/* أسئلة المفتش: قواعد مشتركة بين اللعبة وصفحة الإدارة (بلا اعتماد على DOM).
   كل سؤال: نص عربي (وإنجليزي اختياري)، صورة اختيارية، وإجابتان إلى ثلاث.
   الإجابة الأولى (a[0]) هي الصحيحة دائماً في التخزين، وتُعرض للاعب بترتيب عشوائي. */
(function (root) {
  "use strict";
  const MAX_ANSWERS = 3;
  const MIN_ANSWERS = 2;
  const MAX_TEXT = 300;
  const MAX_ANSWER = 120;
  const MAX_IMG = 400000; // طول رابط الصورة (data URL) بعد الضغط — أقل من حد مستند Firestore بكثير

  const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

  /* توحيد شكل السؤال من أي مصدر (Firestore أو التخزين المحلي أو الافتراضي) */
  function normalize(raw) {
    const r = raw || {};
    const arr = (list, keys) =>
      Array.isArray(list) ? list : keys.map((k) => r[k]);
    const a = arr(r.a, ["a1", "a2", "a3"]).slice(0, MAX_ANSWERS).map((x) => clip(x, MAX_ANSWER));
    const aEn = arr(r.aEn, ["a1En", "a2En", "a3En"]).slice(0, MAX_ANSWERS).map((x) => clip(x, MAX_ANSWER));
    /* تُحذف الخانات الفارغة من آخر القائمة فقط، فتبقى الإجابة الصحيحة في المقدمة */
    while (a.length && !a[a.length - 1]) a.pop();
    return {
      id: clip(r.id || r._id, 64),
      q: clip(r.q, MAX_TEXT),
      qEn: clip(r.qEn, MAX_TEXT),
      a,
      aEn: aEn.slice(0, a.length),
      img: typeof r.img === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(r.img) && r.img.length <= MAX_IMG ? r.img : "",
      on: r.on === undefined ? true : !!+r.on,
      ord: Number.isFinite(+r.ord) ? +r.ord : 0,
    };
  }

  /* يعيد مفتاح الخطأ أو null إن كان السؤال صالحاً */
  function validate(raw) {
    const q = normalize(raw);
    if (!q.q) return "noQuestion";
    if (!q.a[0]) return "noCorrect";
    if (q.a.filter(Boolean).length < MIN_ANSWERS) return "fewAnswers";
    if (q.a.some((x) => !x)) return "gapAnswer";
    const seen = new Set(q.a.map((x) => x.toLowerCase()));
    if (seen.size !== q.a.length) return "dupAnswer";
    return null;
  }

  /* ترتيب عشوائي للإجابات (Fisher–Yates): order[i] = رقم الإجابة الأصلية في الموضع i،
     و correct = موضع الإجابة الصحيحة (الأصل 0) بعد الخلط */
  function shuffle(question, rng) {
    const r = typeof rng === "function" ? rng : Math.random;
    const n = normalize(question).a.length;
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1)) % (i + 1);
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    return { order, correct: order.indexOf(0) };
  }

  /* اختيار سؤال مفعّل عشوائياً مع تجنّب الأسئلة التي ظهرت مؤخراً قدر الإمكان */
  function pick(list, recent, rng) {
    const r = typeof rng === "function" ? rng : Math.random;
    const ok = (list || []).map(normalize).filter((q) => q.on && !validate(q));
    if (!ok.length) return null;
    const avoid = new Set(recent || []);
    const fresh = ok.filter((q) => !avoid.has(q.id));
    const pool = fresh.length ? fresh : ok;
    return pool[Math.floor(r() * pool.length) % pool.length];
  }

  /* نص السؤال والإجابات بلغة اللاعب (الإنجليزية إن وُجدت، وإلا العربية) */
  function localize(question, lang) {
    const q = normalize(question);
    const en = lang === "en";
    return {
      q: en && q.qEn ? q.qEn : q.q,
      a: q.a.map((x, i) => (en && q.aEn[i] ? q.aEn[i] : x)),
    };
  }

  /* مواعيد أسئلة الوردية: مرتان، متباعدتان عن أسئلة CAO وإنذار الحريق بـ gap ثانية على الأقل */
  function schedule(rng, avoid, opts) {
    const r = typeof rng === "function" ? rng : Math.random;
    const o = Object.assign({ windows: [[22, 52], [68, 104]], gap: 16 }, opts || {});
    const busy = (avoid || []).filter(Number.isFinite);
    const room = (t) => busy.reduce((m, c) => Math.min(m, Math.abs(c - t)), Infinity);
    return o.windows.map(([a, b]) => {
      /* المواعيد الممكنة كل نصف ثانية داخل النافذة: اختيار عشوائي من الخالية، وإلا فالأبعد عن غيرها */
      const slots = [];
      for (let t = a; t <= b; t += 0.5) slots.push(t);
      const free = slots.filter((t) => room(t) >= o.gap);
      const t = free.length
        ? free[Math.floor(r() * free.length) % free.length]
        : slots.reduce((best, x) => (room(x) > room(best) ? x : best), slots[0]);
      busy.push(t);
      return t;
    });
  }

  const newId = () => "q" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

  /* أسئلة افتراضية قابلة للتعديل والحذف من صفحة الإدارة (الإجابة الأولى هي الصحيحة) */
  const DEFAULTS = [
    { id: "d01", q: "ماذا يعني ملصق CAO على الطرد؟", qEn: "What does a CAO label on a parcel mean?",
      a: ["يُشحن على طائرات الشحن فقط", "يُسمح بشحنه على أي طائرة ركاب", "يجب حفظه مبرّداً"],
      aEn: ["Cargo aircraft only", "It may fly on any passenger aircraft", "It must be kept refrigerated"] },
    { id: "d02", q: "إلى أي فئة تنتمي السوائل القابلة للاشتعال؟", qEn: "Which class covers flammable liquids?",
      a: ["الفئة 3", "الفئة 8", "الفئة 6"], aEn: ["Class 3", "Class 8", "Class 6"] },
    { id: "d03", q: "ماذا يعني الرمز RLI في بوليصة الشحن؟", qEn: "What does the code RLI mean on an air waybill?",
      a: ["بطاريات ليثيوم أيون", "سوائل قابلة للاشتعال", "مواد مُعدية"],
      aEn: ["Lithium-ion batteries", "Flammable liquids", "Infectious substances"] },
    { id: "d04", q: "لاحظت تسرّباً من طرد خطر. ما أول ما تفعله؟", qEn: "You spot a leak from a dangerous-goods parcel. What do you do first?",
      a: ["أعزل المنطقة وأبلغ المشرف فوراً", "أمسح التسرّب بيدي وأكمل العمل", "أعيد الطرد إلى الحزام"],
      aEn: ["Isolate the area and alert the supervisor", "Wipe it by hand and carry on", "Put the parcel back on the belt"] },
    { id: "d05", q: "هل يجوز تحميل مواد الفئة 3 بجانب مؤكسدات الفئة 5.1؟", qEn: "May Class 3 goods be loaded next to Class 5.1 oxidizers?",
      a: ["لا، يجب الفصل بينهما", "نعم، لا توجد مشكلة"], aEn: ["No, they must be segregated", "Yes, that is fine"] },
    { id: "d06", q: "ما المقصود بـ FOD في ساحة الطائرات؟", qEn: "What is FOD on the airport apron?",
      a: ["أي جسم غريب قد يُتلف الطائرة", "نوع من وقود الطائرات", "رمز رحلة دولية"],
      aEn: ["Any foreign object that can damage an aircraft", "A type of jet fuel", "An international flight code"] },
    { id: "d07", q: "كيف تضع طرداً مكتوباً عليه «This Way Up»؟", qEn: "How do you place a parcel marked “This Way Up”?",
      a: ["والأسهم متجهة إلى الأعلى", "على جانبه لتوفير المساحة", "مقلوباً ليثبت أكثر"],
      aEn: ["With the arrows pointing up", "On its side to save space", "Upside down so it sits firmer"] },
    { id: "d08", q: "لماذا ترتدي السترة العاكسة في المستودع والساحة؟", qEn: "Why do you wear a high-visibility vest on the floor and apron?",
      a: ["ليراك سائقو المركبات والرافعات بوضوح", "للتدفئة فقط", "لتمييز الرتبة الوظيفية"],
      aEn: ["So vehicle and forklift drivers can see you", "Only to keep warm", "To show your job grade"] },
    { id: "d09", q: "الحمولة على الرافعة الشوكية تحجب رؤيتك للأمام. ماذا تفعل؟", qEn: "The load on your forklift blocks your forward view. What do you do?",
      a: ["أقود للخلف ببطء أو أستعين بمُرشد", "أسرع لأتجاوز الممر بسرعة", "أكمل وأعتمد على البوق فقط"],
      aEn: ["Drive in reverse slowly or use a spotter", "Speed up to clear the aisle quickly", "Carry on and rely on the horn"] },
    { id: "d10", q: "ما الوثيقة التي ترافق شحنة البضائع الخطرة؟", qEn: "Which document travels with a dangerous-goods shipment?",
      a: ["إقرار الشاحن للبضائع الخطرة (DGD)", "بطاقة صعود الطائرة", "فاتورة الشراء فقط"],
      aEn: ["Shipper's Declaration for Dangerous Goods (DGD)", "A boarding pass", "Only the purchase invoice"] },
    { id: "d11", q: "ماذا تعني الفئة 7 من البضائع الخطرة؟", qEn: "What does dangerous-goods Class 7 cover?",
      a: ["المواد المشعّة", "المواد الأكّالة", "الغازات المضغوطة"],
      aEn: ["Radioactive material", "Corrosives", "Compressed gases"] },
    { id: "d12", q: "شحنة مكتوب عليها «Keep Frozen». أين تضعها؟", qEn: "A shipment is marked “Keep Frozen”. Where does it go?",
      a: ["في غرفة التجميد فوراً", "على الحزام مع الطرود العادية", "في منطقة البضائع الخطرة"],
      aEn: ["Straight into the freezer room", "On the belt with regular parcels", "In the dangerous-goods area"] },
  ].map((q, i) => normalize(Object.assign({ on: true, ord: i + 1 }, q)));

  root.InspectorQuiz = {
    MAX_ANSWERS, MIN_ANSWERS, MAX_TEXT, MAX_ANSWER, MAX_IMG,
    reward: 40,
    penalty: 20,
    timeBonus: 3,
    asksPerShift: 2,
    recentKeep: 6,
    normalize, validate, shuffle, pick, localize, schedule, newId,
    defaults: () => DEFAULTS.map((q) => Object.assign({}, q, { a: q.a.slice(), aEn: q.aEn.slice() })),
  };
})(typeof window !== "undefined" ? window : this);
