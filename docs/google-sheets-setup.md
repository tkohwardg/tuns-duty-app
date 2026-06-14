# Google Sheets Integration Setup

## Overview

This app uses a Google Apps Script Web App to store duty requests in Google Sheets. This is a free solution that does not require any API keys or service accounts.

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "TUNS Duty Requests"
4. Add the following headers in Row 1:
   - A1: `requestId`
   - B1: `userId`
   - C1: `userName`
   - D1: `userEmail`
   - E1: `date`
   - F1: `dutyType`
   - G1: `status`
   - H1: `timestamp`

## Step 2: Create Google Apps Script

1. In your Google Sheet, go to **Extensions > Apps Script**
2. Replace the default code with the following:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  if (data.action === "addRequest") {
    var entry = data.data;
    sheet.appendRow([
      entry.requestId,
      entry.userId,
      entry.userName,
      entry.userEmail,
      entry.date,
      entry.dutyType,
      entry.status,
      entry.timestamp
    ]);
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, message: "Request added" })
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (data.action === "updateStatus") {
    var requestId = data.data.requestId;
    var newStatus = data.data.status;
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    
    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === requestId) {
        sheet.getRange(i + 1, 7).setValue(newStatus); // Column G = status
        break;
      }
    }
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, message: "Status updated" })
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(
    JSON.stringify({ success: false, message: "Unknown action" })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "ok", message: "TUNS Duty API is running" })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

## Step 3: Deploy as Web App

1. Click **Deploy > New deployment**
2. Select type: **Web app**
3. Set:
   - Description: "TUNS Duty API"
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**
5. Copy the Web App URL

## Step 4: Configure the App

Set the environment variable in the app:
```
EXPO_PUBLIC_GOOGLE_SHEET_WEBHOOK_URL=<your-web-app-url>
```

## Notes

- The Google Apps Script Web App is free and has generous quotas
- Daily quota: 20,000 URL fetches per day
- The script runs under your Google account
- Data is stored in your Google Sheet and can be accessed/exported anytime
