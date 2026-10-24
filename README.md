# New Year Eve Run Yangon 2026 — Swal-Sone Service

## Project files
- `index.html` — event home page
- `registration.html` — participant registration, payment QR and ticket lookup
- `official-registration.html` — public approved registration list
- `official-results.html` — public results
- `admin.html` — password-protected admin dashboard, payment review, event settings, KBZPay QR upload, CSV import/export
- `app.js`, `styles.css`, `config.js` — shared website scripts/styles/settings
- `Code.gs` — Google Apps Script backend (deploy separately in Apps Script)
- `sample-data/` — CSV examples

## Default event values
- Event: New Year Eve Run Yangon 2026
- Date: 30 December 2026
- 4.5 KM: 35,000 MMK
- 9 KM: 70,000 MMK
- Total capacity: 800 participants

## Google Apps Script setup
1. Create a Google Spreadsheet for the event. Copy its ID from the spreadsheet URL.
2. In the spreadsheet, open **Extensions → Apps Script**. Replace the editor contents with the supplied `Code.gs`. Save.
3. In Apps Script **Project Settings → Script properties**, add:
   - `SPREADSHEET_ID` = the spreadsheet ID
   - `ADMIN_PASSWORD` = a strong admin password
   - `DRIVE_FOLDER_ID` = the Google Drive folder ID where payment screenshots and QR images will be stored
   - `ADMIN_EMAILS` = optional comma-separated administrator Google account emails
4. In Apps Script, choose **Deploy → New deployment → Web app**. Execute as **Me**. Set access to **Anyone** so the public registration pages can call the API. Deploy and authorize access to Sheets and Drive.
5. Copy the deployed Web App URL ending in `/exec` into `apiUrl` in `config.js`. Also enter that URL in the Admin login page if it is not automatically populated.
6. Host the website files together on your website/static host. Do not rename or separate `app.js`, `styles.css`, `config.js`, or the `assets` folder.

## Upload the KBZPay QR
1. Open `admin.html` and sign in using the `ADMIN_PASSWORD` you set in Script Properties.
2. In **Event Settings → KBZPay QR Code**, choose the official KBZPay QR image (JPG, PNG or WebP; maximum 3 MB).
3. Click **Upload KBZPay QR**. The backend stores the image in the configured Drive folder and publishes its image link for the public registration page.
4. Click **Save Settings** after editing event name/date, fees, capacity, registration status or payment instructions. The QR upload is saved separately.

**Privacy note:** The payment QR image is made viewable by anyone with its link so registrants can see it. Upload only the event's payment QR, never private documents. Payment screenshots submitted by participants remain private in Drive.

## Important deployment notes
- Whenever `Code.gs` changes, save and deploy a **new version** of the Web App (Deploy → Manage deployments → Edit → New version → Deploy).
- After changing `config.js`, clear browser cache/reload the website.
- Test one sample registration and payment review before opening registration publicly.
- Never put the admin password or Script Properties in `config.js`.
- Apps Script and Google Drive permissions must be authorized by the account that owns the backend.
