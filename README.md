<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Stock & Google Sheets Manager — نسخة Vercel

نظام إدارة مخزون (Entrées / Sorties) مع حساب تلقائي للأرصدة، مزامنة مباشرة مع
Google Sheets، ومساعد ذكاء اصطناعي (Gemini) لتحليل الفواتير والوصولات.

Gestion complète des stocks (Entrées / Sorties), calcul automatique des balances,
synchronisation directe avec Google Sheets et assistant IA (Gemini).

---

## التشغيل محلياً / Local dev

**Prerequisites:** Node.js 18+

```bash
npm install
cp .env.example .env.local   # ثم املأ GEMINI_API_KEY
npm run dev                  # يشغّل Vercel Dev (الواجهة + دوال /api)
```

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
| `SHARED_SHEET_ID` | مطلوب لمزامنة Apps Script | معرّف الجدول المرتبط بـ Apps Script؛ يجب أن يطابق الجدول المحدد. |
| `SHARED_SHEET_TITLE` | اختياري | عنوان الجدول. |
| `SHARED_SHEET_URL` | اختياري | رابط الجدول. |
| `SHARED_SHEET_WEBHOOK` | مطلوب لمزامنة Apps Script | رابط Web App المنشور من Google Apps Script. |
| `SHARED_SHEET_WEBHOOK_TOKEN` | مطلوب لمزامنة Apps Script | سر مشترك؛ ضعه أيضاً في Script Properties باسم `WEBHOOK_TOKEN`. |
| `SHARED_SHEET_TOKEN` | اختياري | رمز OAuth للمزامنة من الخادم. |

### 4) Deploy 🎉

---

## البنية / Architecture

- **الواجهة (`src/`):** React + Vite + Tailwind. تخزّن نسخة محلية في `localStorage`
  وتقرأ/تكتب Google Sheets عبر Apps Script من خلال `/api/apps-script`. يتحقق الخادم
  من رمز Google قبل تمرير الطلب، وتستهدف الإضافة والتعديل والحذف صفوفاً حسب `ID`.
  لا تُمسح أوراق البيانات أو تُستبدل بالكامل عند حفظ عملية واحدة.
- **نموذج الإدخال العام:** شارك رابط `/saisie` ليضيف المستخدمون عمليات الاستلام أو البيع
  دون تسجيل دخول. هذه الصفحة تحفظ في Google Sheets فقط، ولا تعرض بياناته للزوار.
- **دوال الخادم (`api/`):** Vercel Serverless Functions بنفس مسارات النسخة الأصلية:
  - `POST /api/chat` — دردشة مساعد المخزون (Gemini).
  - `POST /api/analyze-receipt` — تحليل صور الفواتير/الوصولات (Gemini).
  - `GET/POST /api/shared-sheet` — إعداد الجدول المشترك (من متغيّرات البيئة).
  - `GET/POST /api/inventory` — لا يوجد تخزين دائم على Vercel (يرجع للـ localStorage).
  - `POST /api/apps-script` — تحقق من تسجيل Google وتمرير قراءة/كتابة الصفوف إلى Apps Script.
  - `POST /api/public-entry` — إضافة عامة محدودة إلى Google Sheets دون تسجيل دخول.
  - `POST /api/sync-now` — مزامنة الخادم الاختيارية عبر `SHARED_SHEET_TOKEN`.

> مزامنة السجلات وقراءتها تمر عبر `/api/apps-script`: يتحقق الخادم من رمز Google،
> ثم يرسل الطلب إلى Web App. لا يضع الرمز المشترك داخل كود المتصفح. اضبط
> `SHARED_SHEET_WEBHOOK` و`SHARED_SHEET_WEBHOOK_TOKEN` في Vercel، وأضف القيمة
> نفسها للرمز في Apps Script ضمن **Project Settings → Script properties** باسم
> `WEBHOOK_TOKEN`. بعد تحديث السكربت، أعد نشره كـ Web App يعمل باسم مالك الجدول.
> تتطلب مزامنة Apps Script أن يكون Web App مرتبطاً بجدول البيانات المحدد في التطبيق.

### نموذج إدخال مباشر من رابط Apps Script

بعد لصق ملف `مستند نصي جديد.gs` في مشروع Apps Script المرتبط بجدولك ونشره كـ Web App
باختيار **Execute as: Me** و**Who has access: Anyone**، يعرض رابط `/exec` نموذجاً عربياً
عاماً. يرسل النموذج إدخالات جديدة فقط؛ لا يمكن للزوار قراءة الجدول أو تعديل سجلاته أو حذفها.

---

## Firebase
إعدادات المصادقة في `firebase-applet-config.json`. تأكّد من إضافة نطاق Vercel
في **Firebase Console → Authentication → Authorized domains**.
