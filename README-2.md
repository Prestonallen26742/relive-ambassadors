# Relive Health Ada: Ambassador Tracker

A staff-only website for tracking ambassadors (trainers, instructors, influencers, clients) and every lead they send. The site runs free on GitHub Pages, and the data lives in a Google Sheet you own.

**What it does**
- Add ambassadors and leads, and move leads through stages: New → Booked labs → Labs done → Recurring member → Cancelled / Lost
- Leaderboard with leads, labs, recurring members, conversion rate and tier for each ambassador
- Service credits, calculated automatically:
  - **Referral bonus:** $100 each for an ambassador's first 2 recurring referrals, $150 each after that
  - **Monthly credit:** $10 for every full month each referral stays recurring (it stops when the lead is marked Cancelled)
  - **Credits owed:** total earned minus credits used (log these with "Log credits used")
- Tiers: Insider (1–2 recurring referrals), Ambassador (3–9), Elite (10+)
- Headline numbers against the 500 recurring-member goal, a weekly leads chart and a funnel
- Protected by one staff passcode

---

## Setup (about 15 minutes)

### 1. Create the Google Sheet
1. Go to [sheets.new](https://sheets.new) and name it **Ambassador Tracker**.
2. You don't need to add any tabs or headers. The script creates the **Ambassadors** and **Leads** tabs the first time it runs.

### 2. Add the script
1. In the sheet, open **Extensions → Apps Script**.
2. Delete what's in `Code.gs`, and paste in the whole contents of [`apps-script/Code.gs`](apps-script/Code.gs) from this repo.
3. Click the gear (**Project Settings**). Under **Script properties**, click **Add script property**:
   - Property: `PASSCODE`
   - Value: the passcode your staff will use to sign in (make it long, for example `ReliveAda-2026-Ambassadors`)
4. Click **Save**.

### 3. Deploy the script as a web app
1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**, and approve the permissions Google asks for. It may warn that the app isn't verified: click **Advanced → Go to (project name)**. It's your own script.
5. Copy the **Web app URL** (it ends in `/exec`).

> "Anyone" only means the website can reach the script. Nothing comes back without the passcode.

### 4. Connect the website
Open `config.js` and paste the URL:

```js
window.AMB_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/XXXXXXXX/exec',
  clinicName: 'Relive Health Ada',
};
```

### 5. Put it on GitHub Pages
1. Create a new repository on GitHub (for example `relive-ambassadors`) and upload these files, or push them with git.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**. Click **Save**.
4. After a minute your site will be at `https://YOUR-USERNAME.github.io/relive-ambassadors/`.

Sign in with the passcode. You're done.

---

## Good to know

- **The repo should be private if you can.** The code holds no data or passcode, but the `config.js` URL is how the site reaches your sheet. GitHub Pages on a private repo needs a paid GitHub plan. On a free plan the repo is public, which is okay because the passcode still protects the data.
- **Changing the passcode:** update `PASSCODE` in Script properties. Everyone gets signed out and has to use the new one. No redeploy needed.
- **Changing `Code.gs` later:** go to **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The URL stays the same.
- **Privacy:** store leads as first name and last initial, and nothing clinical. Google Sheets isn't a medical record system. Keep treatment details in your EMR.
- **Editing the sheet directly:** you can, but keep the header row and the `id` column as they are. Dates are stored as `YYYY-MM-DD` text.
- **"Recurring member":** only set this after the client's second paid month, because that's when the referral bonus is earned. The tracker records the date you set it as **Recurring since**. You can change that date in the leads table.
- **Moving data from the Claude tracker:** download each list as CSV from Claude (Sources panel), then paste the rows into the matching tab. Give each row a unique `id`, and make sure each lead's `ambassadorId` matches its ambassador's `id`.

## Files

| File | What it is |
|---|---|
| `index.html` | The page |
| `styles.css` | Look and feel (follows light and dark mode) |
| `app.js` | Sign in, forms, tables and charts |
| `logic.js` | Credit, tier and stats math |
| `config.js` | Your Apps Script URL |
| `apps-script/Code.gs` | The Google Sheets backend (paste into Apps Script) |
| `tests/logic.test.js` | Checks the credit math: `node tests/logic.test.js` |
