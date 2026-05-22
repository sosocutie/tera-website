## Google Sheets Waitlist Setup

The website waitlist form is ready to send:

- `firstName`
- `lastName`
- `email`
- `source`
- `submittedAt`

To finish the connection, create a Google Apps Script web app and paste its deployed URL into:

[public/waitlist-config.js](/Users/sole/tera-website/public/waitlist-config.js)

Set it like this:

```js
window.TERA_WAITLIST_ENDPOINT = 'https://script.google.com/macros/s/XXXX/exec';
```

### 1. Create the Google Sheet

Create a new Google Sheet and add this header row:

```text
Timestamp | First Name | Last Name | Email | Source | Submitted At
```

### 2. Open Apps Script

In the Google Sheet:

1. Click `Extensions`
2. Click `Apps Script`

### 3. Paste the script

Replace the default code with the code from:

[waitlist-apps-script.gs](/Users/sole/tera-website/waitlist-apps-script.gs)

### 4. Update the sheet name

In the script, change:

```js
const SHEET_NAME = 'Waitlist';
```

to match your actual tab name if needed.

### 5. Deploy as a web app

According to Google’s Apps Script web app docs, deploy it as a web app from `Deploy > New deployment`, choose `Web app`, and set access so the form can call it from the public site:

- Execute as: `Me`
- Who has access: `Anyone`

Google docs:

- [Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [Apps Script ContentService](https://developers.google.com/apps-script/reference/content/content-service)

### 6. Paste the deployed URL into the site

Copy the `/exec` web app URL and paste it into:

[public/waitlist-config.js](/Users/sole/tera-website/public/waitlist-config.js)

### 7. Test locally

Open the homepage and submit:

- first name
- last name
- email

If everything is working, a new row should appear in the sheet.
