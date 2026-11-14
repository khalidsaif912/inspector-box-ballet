/* Shared AR/EN layer for the game wrapper (index.html) and the game (game.html). */
(function (root) {
  'use strict';

  var LS_KEY = 'acg_lang';
  var AR = /[\u0600-\u06FF]/;

  var EN = {
    /* ---- wrapper ---- */
    'مستودع الشحن الجوي 3D': 'Air Cargo Warehouse 3D',
    'مستودع الشحن الجوي 3D — IATA DGR': 'Air Cargo Warehouse 3D — IATA DGR',
    'مستودع الشحن الجوي 3D - نظام المواد الخطرة IATA DGR HD': 'Air Cargo Warehouse 3D — IATA DGR HD',
    'لعبة ثلاثية الأبعاد لفرز شحنات المواد الخطرة وفق IATA DGR: التقط، افحص، افرز، وقُد الرافعة الشوكية.': 'A 3D game about sorting dangerous goods shipments per IATA DGR: pick up, inspect, sort, and drive the forklift.',
    'لعبة مستودع الشحن الجوي': 'Air cargo warehouse game',
    'شعار اللعبة': 'Game logo',
    'فرز المواد الخطرة IATA DGR · تدريب تفاعلي': 'Dangerous goods sorting IATA DGR · interactive training',
    'تثبيت اللعبة': 'Install game',
    'التحكم': 'Controls',
    'ملء الشاشة': 'Fullscreen',
    'اللعبة تعمل داخل إطار — اضغط داخل الإطار لتفعيل لوحة المفاتيح': 'The game runs in a frame — click inside it to activate the keyboard',
    'للتثبيت على iPhone: زر المشاركة ← إضافة إلى الشاشة الرئيسية': 'To install on iPhone: Share button → Add to Home Screen',
    'إغلاق': 'Close',
    'تعليمات التحكم': 'Controls guide',
    'الحركة والتفاعل والفرز — على الكمبيوتر والهاتف.': 'Movement, interaction and sorting — on desktop and phone.',
    '💻 على الكمبيوتر': '💻 On desktop',
    '📱 على الهاتف': '📱 On phone',
    'الحركة': 'Movement',
    'الالتقاط والتفاعل': 'Pick up / interact',
    'إسقاط الطرد فوراً': 'Drop parcel instantly',
    'الجري': 'Sprint',
    'الاندفاع السريع': 'Dash',
    'إيقاف / متابعة': 'Pause / resume',
    'تفاعل سريع بالفأرة': 'Quick mouse interact',
    'اسحب في النصف الأيسر': 'Drag on the left half',
    '✋ زر الالتقاط': '✋ Pick up button',
    'وضع الطرد أو إسقاطه': 'Stow or drop parcel',
    '✋ مرة أخرى': '✋ Tap again',
    '⚡ زر الاندفاع': '⚡ Dash button',
    'الصوت والمؤثرات': 'Audio & effects',
    '🔊 أعلى الملعب': '🔊 Top of the field',

    /* ---- loading / start ---- */
    'مستودع الشحن الجوي': 'Air Cargo Warehouse',
    'جاري تجهيز مستودع الشحن الجوي وتصنيف الشحنات...': 'Preparing the air cargo warehouse and classifying shipments...',
    'تلميح: حافظ على فصل المواد الخطرة لتجنب الغرامات!': 'Tip: keep dangerous goods segregated to avoid fines!',
    'تلميح: المسافة أو E أو F للالتقاط والتفاعل.': 'Tip: Space, E or F to pick up and interact.',
    'تلميح: Shift للجري، و Q أو X لإسقاط الطرد فوراً.': 'Tip: Shift to sprint, Q or X to drop the parcel instantly.',
    'تلميح: الطرود المبرّدة لها مؤقت — أسرع قبل أن تفسد!': 'Tip: chilled parcels are on a timer — hurry before they spoil!',
    'التقط · افحص · افرز — قبل أن يفوت الحزام': 'Pick · Inspect · Sort — before the belt wins',
    'العب الآن': 'Play now',
    '🎮 الحركة [WASD أو الأسهم] • الالتقاط والتفاعل [E أو F أو مسافة] • الجري [Shift] • الإيقاف [Esc]': '🎮 Move [WASD / arrows] • Pick up [E / F / Space] • Sprint [Shift] • Pause [Esc]',
    'كن أول الأبطال': 'Be the first champion',
    'لوحة المتصدرين': 'Leaderboard',
    'العب لتسجّل أول نتيجة': 'Play to post the first score',
    'صوت المستودع': 'Warehouse ambience',
    'المؤثرات الصوتية': 'Sound effects',
    'المؤثرات': 'Effects',
    'الرسائل التعليمة': 'Tips',
    'التعليمات': 'Tips',
    'دليل سريع': 'Quick guide',
    '🎓 المرحلة 1': '🎓 Stage 1',
    'مستودع الشحن': 'Air Cargo',
    'اندفاع': 'Dash',
    'تغيير اللغة / Change language': 'Change language / تغيير اللغة',
    'لون سترتك': 'Vest colour',
    'أصفر فوسفوري': 'Phosphor yellow',
    'برتقالي سلامة': 'Safety orange',
    'أخضر نيون': 'Neon green',
    'دليل الفرز السريع': 'Quick sorting guide',
    '١. اقرأ الملصق': '1. Read the label',
    'كود المناولة': 'Handling code',
    'ورقم الفئة': 'and class code',
    '٢. اختر المنطقة': '2. Pick the zone',
    'لكل شحنة منطقة واحدة فقط حسب نوعها.': 'Each shipment has exactly one zone matching its type.',
    '٣. لا تخلط': '3. Never mix',
    'الفئات المتعارضة تُفصل في حاويتين مختلفتين.': 'Conflicting classes go into two different containers.',
    '٤. الرافعة الشوكية': '4. The forklift',
    'اقترب من الرافعة يسار المستودع واضغط ✋ لقيادتها — مجموع ٦٠ ثانية في الوردية.': 'Approach the forklift on the left and press ✋ to drive it — 60 seconds per shift.',
    'الشحن العادي': 'General cargo',
    'تبريد ❄️ • قابل للتلف 🍓 • عام 📦 → منطقتها الملوّنة فقط': 'Chilled ❄️ • perishable 🍓 • general 📦 → its own coloured zone only',
    'ثلاث حاويات للمواد الخطرة': 'Three dangerous goods containers',
    'كل الحاويات تقبل جميع فئات المواد الخطرة ١–٩؛ أنت من يفرز ويختار الحاوية التي لا تسبب تعارضًا.': 'All containers accept every dangerous goods class 1–9; you choose the container that causes no conflict.',
    'مؤكسد 5.1 لا يلتقي بمشتعل': 'Oxidiser 5.1 never meets flammable',
    'لا تجمع ROX 5.1 مع RFL 3 أو RFS 4.1 أو RSC 4.2 في حاوية واحدة.': 'Never stow ROX 5.1 with RFL 3, RFS 4.1 or RSC 4.2 in the same container.',
    'الأكّالة 8 والفئة 3': 'Corrosive 8 and Class 3',
    'RCM 8 تُفصل عن المشتعلات RFL 3 و RWR 4.3 و ROX 5.1.': 'RCM 8 is segregated from RFL 3, RWR 4.3 and ROX 5.1.',
    'الليثيوم 9 يُفصل': 'Lithium 9 is segregated',
    'RLI 9 لا تُخلط مع 3 • 4.1 • 5.1 • 2.1.': 'RLI 9 is never mixed with 3 • 4.1 • 5.1 • 2.1.',
    '1.4S و 6 و 7': '1.4S, 6 and 7',
    '1.4S لا تُفصل عن غير المتفجرات؛ الفئتان 6 و7 لا تتطلبان فصلًا.': '1.4S is not segregated from non-explosives; classes 6 and 7 need no segregation.',
    'صناديق المفاجآت': 'Surprise boxes',
    'افرزها في أي منطقة آمنة لتُفتح تلقائيًا وتكشف مكافأتها.': 'Sort them into any safe zone to open them and reveal the reward.',
    'عرض جدول IATA الكامل (Table 9.3.A)': 'Show the full IATA table (Table 9.3.A)',
    'الكود / الفئة': 'Code / class',
    'الوصف والمحتوى': 'Description / contents',
    'ممنوع وضعه مع:': 'Must not be stowed with:',
    'سوائل مشتعلة (وقود، دهانات)': 'Flammable liquids (fuel, paints)',
    'ROX 5.1، RCM 8، RLI 9، فئة 1 (عدا 1.4S)': 'ROX 5.1, RCM 8, RLI 9, Class 1 (except 1.4S)',
    'مواد صلبة مشتعلة': 'Flammable solids',
    'ROX 5.1، RLI 9، فئة 1': 'ROX 5.1, RLI 9, Class 1',
    'مواد تلقائية الاشتعال': 'Spontaneously combustible',
    'ROX 5.1، فئة 1': 'ROX 5.1, Class 1',
    'تتفاعل مع الماء وتطلق غازاً': 'Reacts with water, releases gas',
    'RCM 8، فئة 1': 'RCM 8, Class 1',
    'مواد مؤكسدة تزيد الاشتعال': 'Oxidisers that intensify fire',
    'RFL 3، RFS 4.1، RSC 4.2، RCM 8، RLI 9، فئة 1': 'RFL 3, RFS 4.1, RSC 4.2, RCM 8, RLI 9, Class 1',
    'بيروكسيدات عضوية': 'Organic peroxides',
    'RLI 9، فئة 1': 'RLI 9, Class 1',
    'مواد أكّالة وأحماض وبطاريات': 'Corrosives, acids and batteries',
    'RFL 3، RWR 4.3، ROX 5.1، فئة 1': 'RFL 3, RWR 4.3, ROX 5.1, Class 1',
    'غازات مشتعلة': 'Flammable gases',
    'غازات غير مشتعلة أو سامة': 'Non-flammable or toxic gases',
    'فئة 1': 'Class 1',
    'بطاريات ليثيوم أيون': 'Lithium-ion batteries',
    'فئة 1، RFG 2.1، RFL 3، RFS 4.1، ROX 5.1': 'Class 1, RFG 2.1, RFL 3, RFS 4.1, ROX 5.1',
    'ثلج جاف ومواد متنوعة': 'Dry ice and miscellaneous',
    'لا يتطلب فصلًا': 'No segregation required',
    'ذخائر أمان': 'Safety ammunition',
    'لا يُخلط مع متفجرات أخرى؛ ولا يُفصل عن غير المتفجرات': 'Not mixed with other explosives; not segregated from non-explosives',
    'ألعاب نارية ومتفجرات': 'Fireworks and explosives',
    'كل الفئات عدا 6 و7 (وبطاريات الليثيوم 9 تُفصل)': 'All classes except 6 and 7 (lithium 9 is segregated)',
    'مواد سامة ومعدية': 'Toxic and infectious substances',
    'لا تتطلب فصلًا وفق الجدول': 'No segregation per the table',
    'مواد مشعة': 'Radioactive material',
    'مأخوذ من IATA DGR Table 9.3.A (2023). الجدول يستثني 1.4S والفئتين 6 و7 من الفصل، ويطبّق تعارضات الفئة 9 على بطاريات الليثيوم فقط. هذا تبسيط تعليمي لا يغني عن النسخة الرسمية.': 'Based on IATA DGR Table 9.3.A (2023). The table exempts 1.4S and classes 6 and 7 from segregation, and applies Class 9 conflicts to lithium batteries only. This is a teaching simplification, not a substitute for the official document.',
    'إغلاق الدليل': 'Close guide',
    '✖ لا أعرف الرقم — إلغاء': '✖ I don\'t know it — cancel',
    '🔢 رقم الطوارئ': '🔢 Emergency number',
    'أدخل الرقم لتأكيد الإخلاء': 'Enter the number to confirm evacuation',
    '⚠️ معرفة رقم الطوارئ إلزامية لكل موظف': '⚠️ Every employee must know the emergency number',
    'توجّه إلى منطقة التجمع على يمينك ➡': 'Head to the muster point on your right ➡',
    'منطقة التجمع ➡': 'Muster point ➡',
    '🚨 إنذار حريق — FIRE ALARM': '🚨 FIRE ALARM',
    '🦺 المفتش': '🦺 Inspector',

    /* ---- world labels ---- */
    'منطقة التجمع': 'MUSTER POINT',
    'رقم الطوارئ الداخلي • EMERGENCY NUMBER': 'EMERGENCY NUMBER',
    '— فارغة —': '— empty —',
    '🚭 ممنوع التدخين': '🚭 NO SMOKING',
    '⚠️ منطقة مواد خطرة': '⚠️ DGR AREA',
    '✈️ مخرج الطيران': '✈️ AIRSIDE',
    '🚚 رصيف التحميل': '🚚 LOADING DOCK',
    'تبريد': 'CHILLED',
    'قابلة للتلف': 'PERISHABLE',
    'شحن عام': 'GENERAL',
    'حاوية خطرة ١': 'DGR 1',
    'حاوية خطرة ٢': 'DGR 2',
    'حاوية خطرة ٣': 'DGR 3',
    'لقاحات مبردة': 'Chilled vaccines',
    'أسماك طازجة': 'Fresh fish',
    'أنسولين وأدوية': 'Insulin & medicine',
    'فراولة طازجة': 'Fresh strawberries',
    'زهور مقطوفة': 'Cut flowers',
    'مخبوزات طازجة': 'Fresh bakery',
    'ملابس قطنية': 'Cotton clothing',
    'كتب ومطبوعات': 'Books & print',
    'ألعاب أطفال': 'Children toys',
    'ذخائر خفيفة': 'Light ammunition',
    'ألعاب نارية': 'Fireworks',
    'غاز البترول المسال': 'Liquefied petroleum gas',
    'غاز الهيليوم المضغوط': 'Compressed helium',
    'غاز الكلور السام': 'Toxic chlorine gas',
    'وقود طائرات كيروسين': 'Jet kerosene',
    'دهانات ومذيبات نفطية': 'Paints & solvents',
    'أعواد فسفور وكبريت': 'Phosphorus matches',
    'فحم نباتي منشط': 'Activated charcoal',
    'كاربيد الكالسيوم': 'Calcium carbide',
    'نترات الأمونيوم المؤكسدة': 'Ammonium nitrate',
    'بيروكسيد عضوي مثبت': 'Stabilised organic peroxide',
    'مبيدات زرنيخية سامة': 'Arsenic pesticides',
    'عينات فيروسية معدية': 'Infectious virus samples',
    'نظائر يود طبية مشعة': 'Radioactive iodine',
    'حمض الكبريتيك المركز': 'Concentrated sulphuric acid',
    'بطاريات أحماض سائلة': 'Wet acid batteries',
    'بطاريات ليثيوم أيون': 'Lithium-ion batteries',
    'ثلج جاف كربوني': 'Dry ice',
    'صندوق مفاجآت': 'Surprise box',
    'جسم غريب': 'Foreign object',
    'غبار وأجسام غريبة': 'FOD',
    'مادة خطرة': 'Dangerous good',
    'طرد عادي': 'Regular parcel',

    /* ---- gameplay strings ---- */
    'تهيئة محرّك الرسم ثلاثي الأبعاد...': 'Starting the 3D engine...',
    'تسخين الشيدرات والمؤثرات...': 'Warming up shaders and effects...',
    'اكتمل التجهيز — لحظة واحدة...': 'Ready — just a moment...',
    '🔥 وضع الحمى! النقاط مضاعفة ×2': '🔥 Fever mode! Score ×2',
    '🐢 الحزام يبطؤ ٣٠ ثانية': '🐢 Belt slowed for 30s',
    '🎁 مفاجأة: +12 ثانية': '🎁 Surprise: +12 seconds',
    '🎁 مفاجأة: +60 نقطة': '🎁 Surprise: +60 points',
    '🎁 مفاجأة: كومبو ×8 🔥': '🎁 Surprise: combo ×8 🔥',
    '🎁 مفاجأة: الحزام يبطؤ ٨ ثوانٍ 🐢': '🎁 Surprise: belt slowed 8s 🐢',
    '💥 مفاجأة سيئة: -6 ثوانٍ': '💥 Bad surprise: −6 seconds',
    '☠️ انفجر طرد مبرّد قبل فرزه!': '☠️ A chilled parcel spoiled before sorting!',
    '🔩 سقط جسم غريب FOD!': '🔩 A FOD object dropped!',
    '⚠️ رافعة متهورة تعبر المستودع!': '⚠️ A reckless forklift is crossing the warehouse!',
    '😨 اصطدام! حركة أبطأ مؤقتًا': '😨 Hit! Movement slowed for a while',
    '🔩 ضعه في صندوق FOD الأحمر': '🔩 Put it in the red FOD bin',
    'هذا الصندوق للأجسام الغريبة FOD فقط': 'This bin is for FOD objects only',
    '🚜 قُد الرافعة الشوكية — المتبقي': '🚜 Driving the forklift — left:',
    '🚜 نزلت من الرافعة': '🚜 Left the forklift',
    '⏱ انتهت مدة قيادة الرافعة (٦٠ ثانية)': '⏱ Forklift driving time is over (60s)',
    '✔ جمع الجسم الغريب': '✔ FOD collected',
    '✔ فرز متوافق': '✔ Compatible sort',
    '✔ +': '✔ +',
    'هذه الحاوية مخصصة فقط للمواد الخطرة (DGR)!': 'This container is for dangerous goods (DGR) only!',
    'منطقة فرز غير مطابقة لنوع الشحنة!': 'This zone does not match the shipment type!',
    'في مناطق الشحن العادي! ضعها في إحدى حاويات المواد الخطرة.': 'in general cargo zones! Use one of the DGR containers.',
    '🦺 مخالفة -15': '🦺 Fine −15',
    '📋 المفتش: طرد متروك خارج المنطقة المخصصة! (-15 و -4 ث)': '📋 Inspector: parcel left outside its designated area! (−15 and −4s)',
    '🚨 إنذار حريق — توجّه يميناً إلى منطقة التجمع': '🚨 Fire alarm — head right to the muster point',
    '✔ +': '✔ +',
    '🔢 أدخل رقم الطوارئ لتأكيد الإخلاء': '🔢 Enter the emergency number to confirm evacuation',
    '✅ تم تأكيد الإخلاء +': '✅ Evacuation confirmed +',
    '✅ اكتمل الإخلاء — استؤنفت الوردية': '✅ Evacuation complete — shift resumed',
    '✖ رقم غير صحيح — حاول مرة أخرى': '✖ Wrong number — try again',
    '⚠️ معرفة رقم الطوارئ إلزامية لكل موظف — راجع لوحة الطوارئ في المستودع': '⚠️ Every employee must know the emergency number — check the board in the warehouse',
    '⏱ انتهت مهلة الإخلاء — استؤنفت الوردية': '⏱ Evacuation timeout — shift resumed',
    '⏱ أُغلق إدخال الرقم — استؤنفت الوردية': '⏱ Number entry closed — shift resumed',
    'انتهت الوردية': 'Shift over',
    'الرتبة:': 'Rank:',
    'النقاط': 'Score',
    'طرود مصنّفة': 'Parcels sorted',
    'دقة IATA': 'IATA accuracy',
    'أطول سلسلة': 'Best streak',
    'أفضل نتيجة:': 'Best score:',
    'لوحة المتصدرين:': 'Leaderboard:',
    'لم تُصنّف أي طرد هذه الوردية — جرّب مرة أخرى!': 'No parcels sorted this shift — try again!',
    'أداء قوي — حافظ على الدقة مع السرعة في الوردية القادمة.': 'Strong performance — keep accuracy and speed next shift.',
    'راجع دليل الفرز السريع ثم عُد لكسر رقمك.': 'Review the quick sorting guide, then come back to beat your record.',
    'رقم قياسي جديد!': 'New record!',
    'وردية جديدة': 'New shift',
    'الدليل': 'Guide',
    'الغلاف': 'Shell',
    'العودة إلى الغلاف': 'Back to wrapper',
    'خبير DGR معتمد': 'Certified DGR expert',
    'مشرف فرز متمكن': 'Skilled sorting supervisor',
    'فني مستودع واعد': 'Promising warehouse technician',
    'متدرب قيد التأهيل': 'Trainee in qualification',
    'نقطة': 'pts',
    'إعادة اللعب': 'Play again',
    'دليل الفرز': 'Sorting guide',
    '⏸ إيقاف مؤقت': '⏸ Paused',
    '⏸ اللعبة متوقفة — اضغط في أي مكان للمتابعة': '⏸ Game paused — press anywhere to resume',
    'جولة تعريفية — بلا غرامات': 'Intro round — no fines',
    'جولة تعريفية — لن تصطدم بك': 'Intro round — it won\'t hit you',
    'المفتش': 'Inspector',
    'الرافعة الشوكية': 'Forklift',
    'يغرّم كل طرد متروك خارج مناطق الفرز.': 'Fines every parcel left outside the sorting zones.',
    'تُسقط أجساماً غريبة (FOD)؛ اجمعها وضعها في الصندوق الأحمر.': 'Drops foreign objects (FOD); collect them and put them in the red bin.',
    '⚡ تدفق سريع!': '⚡ Rush hour!',
    'ثلاث شحنات متتابعة على الحزام — ركّز وسرّع الفرز.': 'Three shipments in a row on the belt — focus and sort faster.',
    '🎓 المرحلة': '🎓 Stage',
    '🏁 المرحلة ٤ • الأخيرة — مواد خطرة فقط': '🏁 Stage 4 • Final — dangerous goods only',
    '🚀 المرحلة ٢: المواد الخطرة والمفتش! السير أسرع': '🚀 Stage 2: dangerous goods and the inspector! Faster belt',
    '🏁 المرحلة ٣: الرافعة الشوكية تعبر المستودع!': '🏁 Stage 3: the forklift crosses the warehouse!',
    '💥 المرحلة ٤: مواد خطرة فقط — ثلاث حاويات حسب الفئة': '💥 Stage 4: dangerous goods only — three containers by class',
    '💥 المرحلة ٤: مواد خطرة فقط — ثلاث حاويات حسب الفئة!': '💥 Stage 4: dangerous goods only — three containers by class!',
    '🎓 المرحلة ١: التدريب — التقط وافرز': '🎓 Stage 1: training — pick up and sort',
    '⚡ إنقاذ +25': '⚡ Last-second save +25',
    '⚡ التقاط في اللحظة الأخيرة +25': '⚡ Last-second pick up +25',
    '⚠️ فاتتك مادة خطرة!': '⚠️ You missed a dangerous good!',
    'فاتك طرد!': 'You missed a parcel!',
    'بدون خصم': 'no penalty',
    'مادة خطرة فاتت': 'Dangerous good missed',
    'طرد فات': 'Parcel missed',
    '🚜 القيادة:': '🚜 Driving:',
    'ث • اضغط هنا للنزول': 's • tap to get off',
    'المحتوى': 'Contents',
    'من': 'of',
    'ثانية': 's',
    'ث': 's',
    '🎮 الحركة [WASD أو الأسهم] • الالتقاط/التفاعل [E أو F أو مسافة] • الإسقاط السريع [Q/X] • الجري [Shift] • الاندفاع [Enter] • الإيقاف [Esc]': '🎮 Move [WASD / arrows] • Pick up [E/F/Space] • Quick drop [Q/X] • Sprint [Shift] • Dash [Enter] • Pause [Esc]',
    'اضغط': 'Press',
    'أو': 'or',
    'للمتابعة.': 'to resume.'
  };

  var lang = 'ar';
  var store = [];
  var collected = false;

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function lookup(s) { var k = norm(s); return Object.prototype.hasOwnProperty.call(EN, k) ? EN[k] : null; }
  function t(s) { if (lang !== 'en') return s; var v = lookup(s); return v === null ? s : v; }
  function T(ar, en) { return lang === 'en' ? en : ar; }

  function collect() {
    if (collected) return;
    collected = true;
    var titleEl = document.querySelector('title');
    if (titleEl && AR.test(document.title)) store.push({ title: document.title });
    var metas = document.querySelectorAll('meta[content]');
    for (var i = 0; i < metas.length; i++) {
      var c = metas[i].getAttribute('content');
      if (c && AR.test(c)) store.push({ el: metas[i], attr: 'content', orig: c });
    }
    if (document.body) {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      var n;
      while ((n = walker.nextNode())) {
        if (n.nodeValue && AR.test(n.nodeValue)) store.push({ node: n, orig: n.nodeValue });
      }
      var attrs = ['title', 'aria-label', 'placeholder', 'alt'];
      var els = document.body.querySelectorAll('[title],[aria-label],[placeholder],[alt]');
      for (var j = 0; j < els.length; j++) {
        for (var a = 0; a < attrs.length; a++) {
          var v = els[j].getAttribute(attrs[a]);
          if (v && AR.test(v)) store.push({ el: els[j], attr: attrs[a], orig: v });
        }
      }
    }
  }

  function apply() {
    var en = lang === 'en';
    for (var i = 0; i < store.length; i++) {
      var it = store[i];
      if (it.title) { var tt = en ? lookup(it.title) : null; document.title = tt || it.title; continue; }
      if (it.attr) { var av = en ? lookup(it.orig) : null; it.el.setAttribute(it.attr, av || it.orig); continue; }
      var orig = it.orig, key = orig.trim(), val = en && key ? lookup(key) : null;
      if (!val) { it.node.nodeValue = orig; continue; }
      var at = orig.indexOf(key);
      it.node.nodeValue = orig.slice(0, at) + val + orig.slice(at + key.length);
    }
    var html = document.documentElement;
    html.lang = lang;
    html.dir = en ? 'ltr' : 'rtl';
    var metaDir = document.querySelector('.hero, .ov');
    if (metaDir) metaDir.style.direction = en ? 'ltr' : '';
  }

  function boot() { collect(); apply(); }

  function readLang() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'en' || q === 'ar') return q;
    } catch (e) {}
    try {
      var s = localStorage.getItem(LS_KEY);
      if (s === 'en' || s === 'ar') return s;
    } catch (e) {}
    return 'ar';
  }

  function setLang(l) {
    lang = l === 'en' ? 'en' : 'ar';
    try { localStorage.setItem(LS_KEY, lang); } catch (e) {}
    collect();
    apply();
    try { root.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: lang } })); } catch (e) {}
  }

  lang = readLang();
  if (lang === 'en') { document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr'; }

  root.I18N = {
    get lang() { return lang; },
    t: t,
    T: T,
    setLang: setLang,
    handle: function () { collect(); apply(); }
  };

  root.t = t;
  root.T = T;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
