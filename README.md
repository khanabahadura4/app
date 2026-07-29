# Lab Test Result App — Setup

## যা যা বদলেছে (What changed)

1. **Pagination**: "last 5 days" filter সরিয়ে page system করা হয়েছে — page 1 এ সবচেয়ে নতুন 2000টা lot, page 2 তে তার আগের 2000টা, ইত্যাদি। নিচে Prev/Next বাটন দিয়ে ঘুরে দেখা যাবে।
2. **Search fix**: আগে search করার সময় প্রতি 5 সেকেন্ডে auto-refresh চলতে থাকত, তাই বারবার loading/buffering দেখাত। এখন search শুরু হওয়ার সাথে সাথে auto-refresh পুরোপুরি বন্ধ হয়ে যায় — search box খালি করলে আবার চালু হয়।
3. **Simplified detail view**: আগের printed-report style বাদ দিয়ে এখন শুধু দুইটা সহজ অংশ — **Details** (Buyer, Date, Order No, Req. GSM, Found GSM, Batch, Quantity, Req. Dia, Composition, Colour, Fabric Type, Report No) আর **Result** (Length, Width, Twisting, Dry/Wet Rubbing, CF to Wash — Sta/C.C/C.S, pH)।
4. **Backend (Code.gs)**: আপনার আগে থেকে deploy করা script-এর `action=getLots` স্টাইলটাই রাখা হয়েছে (তাই পুরনো URL/style-এর সাথে মিলবে), শুধু দুইটা bug ঠিক করা হয়েছে (Date column আগে return হত না, আর শেষ column "cs" ভুল range-এর কারণে কেটে যেত), আর নতুন `action=getSearch` (সব date জুড়ে) এবং `action=getDetail` (lot click করলে) যোগ করা হয়েছে — আগে এই দুইটা ছিলই না।

## ধাপ ১ — Google Apps Script আপডেট করুন

1. যে Google Sheet-এ ডেটা আছে, সেটা খুলুন → **Extensions → Apps Script**।
2. আগের কোড মুছে `Code.gs`-এর পুরো কনটেন্ট paste করুন (এই ফোল্ডারে আছে)।
3. Save করুন।
4. **Deploy → Manage deployments → পুরনো deployment-এর পাশে ✏️ (edit) আইকনে ক্লিক করুন → Version: "New version" সিলেক্ট করে Deploy করুন.**
   - এটা জরুরি যাতে deployment URL (যেটা `app.js`-এর `API_URL`-এ আছে) **অপরিবর্তিত** থাকে — নতুন deployment বানালে URL বদলে যাবে আর app.js-ও আপডেট করতে হবে।
5. এই version column **নাম** দিয়ে না, column **পজিশন** দিয়ে কাজ করে (A থেকে AA পর্যন্ত, 27টা column)। তাই sheet "111"-এ row 1 (header) বাদ দিয়ে, প্রতিটা row-এর column গুলো এই ক্রমেই থাকতে হবে:

   | Col | Field | Col | Field |
   |---|---|---|---|
   | A | Date | O | Length |
   | B | Shift | P | Width |
   | C | Report No | Q | Twisting |
   | D | Buyer | R | Qty |
   | E | Order No | S | Composition |
   | F | Batch No | T | Others |
   | G | Roll | U | Info |
   | H | Colour | V | pH |
   | I | Fab. Type | W | Dry Rubbing |
   | J | R. GSM | X | Wet Rubbing |
   | K | F. GSM | Y | CF Wash Sta |
   | L | Req. Dia | Z | CF Wash C.C |
   | M | F. Dia | AA | C.S |
   | N | Drying | | |

   **যদি আপনার sheet-এ column A খালি থাকে বা Date না হয়, তাহলে অ্যাপে Date ফাঁকা দেখাবে** — সেক্ষেত্রে জানাবেন, `Code.gs`-এর `mapRow()` ফাংশনে column mapping ঠিক করে দেব।

## ধাপ ২ — GitHub-এ push করুন

আপনি বললেন একদম নতুন repo বানাবেন। GitHub-এ প্রথমে একটা empty repository তৈরি করুন (README/gitignore ছাড়া), তারপর এই কমান্ডগুলো এই ফোল্ডারের ভেতরে চালান:

```bash
git init
git add .
git commit -m "Add pagination, fix search auto-refresh, simplify detail view"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

push হয়ে গেলে GitHub Actions (`.github/workflows/build-apk.yml`) নিজে থেকেই চলা শুরু করবে এবং একটা debug APK build করবে। **Actions** ট্যাবে গিয়ে workflow run শেষ হলে, run-এর নিচে **Artifacts** সেকশন থেকে `app-debug` ডাউনলোড করতে পারবেন — সেটার ভেতরে `app-debug.apk` থাকবে।

## Folder structure

```
lab-test-app/
├── .github/workflows/build-apk.yml   (unchanged)
├── capacitor.config.json             (unchanged)
├── package.json                      (unchanged)
├── Code.gs                           (paste into Apps Script — not part of the Capacitor build)
└── www/                              (webDir — matches capacitor.config.json)
    ├── index.html
    ├── style.css
    ├── app.js
    └── logo.jpg
```

`app-logo.png` (the app/launcher icon) is included at the repo root too — if you haven't wired it into the Android icon set yet, Capacitor/Android Studio's asset tools can generate the icon sizes from it later; it isn't referenced by the web app itself.
