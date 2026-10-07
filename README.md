<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/068db9a4-469f-4711-ac4c-6918be1a2773

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## GitHub Pages

هذا المشروع يُنشر من مجلد `dist` عبر GitHub Actions. لتجنب ظهور صفحة بيضاء:

1. ادخل إلى **Settings → Pages** في مستودع GitHub.
2. في **Build and deployment** اختر **Source: GitHub Actions**.
3. ادفع الملفات إلى فرع `main` أو `master`.
4. انتظر انتهاء Workflow باسم **Deploy to GitHub Pages**.

لا تختر **Deploy from a branch** مع جذر المستودع، لأن جذر المستودع يحتوي ملفات TypeScript المصدرية (`src/main.tsx`) وليس ملفات JavaScript المبنية للمتصفح.
