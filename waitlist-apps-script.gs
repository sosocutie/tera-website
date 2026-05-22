const SHEET_NAME = 'Waitlist';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({
        ok: false,
        error: 'Sheet not found'
      });
    }

    const firstName = String(payload.firstName || '').trim();
    const lastName = String(payload.lastName || '').trim();
    const email = String(payload.email || '').trim();
    const source = String(payload.source || '').trim();
    const submittedAt = String(payload.submittedAt || '').trim();

    if (!firstName || !lastName || !email) {
      return jsonResponse({
        ok: false,
        error: 'Missing required fields'
      });
    }

    sheet.appendRow([
      new Date(),
      firstName,
      lastName,
      email,
      source,
      submittedAt
    ]);

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error)
    });
  }
}

function doGet() {
  return jsonResponse({
    ok: true,
    message: 'Tera waitlist endpoint is live.'
  });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
