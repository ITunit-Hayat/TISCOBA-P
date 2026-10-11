<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Stock Manager — Google Sheets + Vercel

نظام إدارة مخزون (Entrées / Sorties) مع حساب تلقائي للأرصدة، Google Sheets،
ومساعد ذكاء اصطناعي (Gemini) لتحليل الفواتير والوصولات.

Gestion complète des stocks (Entrées / Sorties), calcul automatique des balances,
Google Sheets et assistant IA (Gemini).

---

## التشغيل محلياً / Local dev

**Prerequisites:** Node.js 18+

```bash
npm install
cp .env.example .env.local   # ثم املأ GEMINI_API_KEY
npm run dev                  # يشغّل Vercel Dev (الواجهة + دوال /api)
```

## إعداد Google Sheets (مرة واحدة بواسطة مالك التطبيق)

يُعدّ المالك الربط مرة واحدة؛ لا يحتاج زوار التطبيق إلى حساب Google أو إعداد
أي شيء. بعد الإعداد، تعرض الصفحة الرئيسية لوحة المخزون العامة، ويمكن لأي زائر
إضافة الحركات وتعديلها وحذفها. صفحة `/saisie` تبقى نموذجاً مختصراً لإضافة حركة.

> **تنبيه:** اللوحة عامة بالكامل. أي شخص يستطيع مشاهدة كل السجلات، بما فيها
> أسماء الزبائن والمبالغ والملاحظات، وإضافة الحركات وتعديلها وحذفها. لا تستخدمها
> إذا كانت هذه البيانات سرية أو إذا كنت تريد حصر الإدارة بموظفين محددين.

1. أنشئ أو افتح جدول Google Sheets المراد استخدامه.
2. من الجدول افتح **Extensions → Apps Script**، واستبدل محتوى المحرر بمحتوى
   [`google-apps-script.gs`](./google-apps-script.gs)، ثم احفظ المشروع. ينشئ السكربت
   ورقتي `Entrées` و`Sorties` وصفوف العناوين تلقائياً عند أول استخدام.
3. من **Project Settings → Script Properties** أضف:
   - `SPREADSHEET_ID`: معرّف الجدول من رابطه.
   - `WEBHOOK_TOKEN`: قيمة طويلة وعشوائية؛ احتفظ بها سراً.
4. من **Deploy → New deployment → Web app** اختر التشغيل بصلاحية مالك الجدول
   واجعل الوصول **Anyone**، ثم انشر وانسخ رابط Web App المنتهي بـ `/exec`.
5. في **Vercel → Settings → Environment Variables** أضف:
   - `SHARED_SHEET_ID`: معرّف الجدول (النص بين `/d/` و`/edit` في رابطه).
   - `SHARED_SHEET_WEBHOOK`: رابط Web App المنتهي بـ `/exec`.
   - `SHARED_SHEET_WEBHOOK_TOKEN`: القيمة نفسها التي وضعتها في `WEBHOOK_TOKEN`.
6. أعد نشر التطبيق بعد حفظ المتغيرات.

> لا تضع `SHARED_SHEET_WEBHOOK_TOKEN` في الواجهة أو GitHub. يبقى الرمز على الخادم
> في Vercel وApps Script؛ زوار اللوحة لا يحتاجون إليه.

## النشر على Vercel / Deploy to Vercel

### 1) ارفع المشروع إلى GitHub (أو GitLab/Bitbucket)

### 2) في Vercel
- **Add New → Project** واختر المستودع.
- Vercel يكتشف Vite تلقائياً (Framework Preset = Vite).
- **Build Command:** `vite build` — **Output Directory:** `dist` (موجودان في `vercel.json`).

### 3) متغيّرات البيئة / Environment Variables
من **Project Settings → Environment Variables** أضف:

| المتغيّر | مطلوب؟ | الوصف |
|----------|--------|-------|
| `GEMINI_API_KEY` | ✅ (لمساعد AI) | مفتاح Gemini. يبقى مخفياً على الخادم. |
| `GEMINI_MODEL` | اختياري | النموذج (افتراضي `gemini-2.0-flash`). |
| `SHARED_SHEET_ID` | مطلوب | معرّف جدول Google Sheets الذي يستخدمه Apps Script. |
| `SHARED_SHEET_WEBHOOK` | مطلوب | رابط نشر Apps Script Web App المنتهي بـ `/exec`. |
| `SHARED_SHEET_WEBHOOK_TOKEN` | مطلوب | الرمز السري المطابق لقيمة `WEBHOOK_TOKEN` في Apps Script. |

### 4) Deploy 🎉

---

## البنية / Architecture

- **الواجهة (`src/`):** React + Vite + Tailwind. تعرض لوحة المخزون العامة في الصفحة
  الرئيسية، بالإضافة إلى نموذج `/saisie` المختصر، وكلاهما لا يتطلب تسجيل الدخول.
- **لوحة المخزون العامة:** يستطيع أي زائر قراءة السجلات وإضافة وتعديل وحذف عمليات
  الاستلام والبيع؛ احمِ بيانات الجدول وفقاً لذلك.
- **دوال الخادم (`api/`):** Vercel Serverless Functions بنفس مسارات النسخة الأصلية:
  - `POST /api/chat` — دردشة مساعد المخزون (Gemini).
  - `POST /api/analyze-receipt` — تحليل صور الفواتير/الوصولات (Gemini).
  - `GET/POST /api/inventory` — قراءة وتعديل Google Sheets دون تسجيل دخول.
  - `POST /api/public-entry` — إضافة عامة محدودة إلى Google Sheets دون تسجيل دخول.
