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
| `SHARED_SHEET_ID` | اختياري | معرّف جدول Google مشترك للفريق (اتصال تلقائي). |
| `SHARED_SHEET_TITLE` | اختياري | عنوان الجدول. |
| `SHARED_SHEET_URL` | اختياري | رابط الجدول. |
| `SHARED_SHEET_WEBHOOK` | اختياري | رابط Google Apps Script Webhook. |
| `SHARED_SHEET_TOKEN` | اختياري | رمز OAuth للمزامنة من الخادم. |

### 4) Deploy 🎉

---

## البنية / Architecture

- **الواجهة (`src/`):** React + Vite + Tailwind. تخزّن البيانات في `localStorage`
  وتزامن **مباشرة** مع Google Sheets عبر رمز وصول المستخدم (client-side).
- **دوال الخادم (`api/`):** Vercel Serverless Functions بنفس مسارات النسخة الأصلية:
  - `POST /api/chat` — دردشة مساعد المخزون (Gemini).
  - `POST /api/analyze-receipt` — تحليل صور الفواتير/الوصولات (Gemini).
  - `GET/POST /api/shared-sheet` — إعداد الجدول المشترك (من متغيّرات البيئة).
  - `GET/POST /api/inventory` — لا يوجد تخزين دائم على Vercel (يرجع للـ localStorage).
  - `POST /api/sync-now` — مزامنة الجدول عبر `SHARED_SHEET_TOKEN`.

> ⚠️ على Vercel لا يوجد نظام ملفات دائم، لذا مزامنة الفريق الفورية تعتمد على
> المزامنة المباشرة مع Google Sheets من المتصفح، أو على `SHARED_SHEET_*` env vars.

---

## Firebase
إعدادات المصادقة في `firebase-applet-config.json`. تأكّد من إضافة نطاق Vercel
في **Firebase Console → Authentication → Authorized domains**.

