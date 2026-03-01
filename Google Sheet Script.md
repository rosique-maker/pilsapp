// 1. Create a new Google Sheet.
// 2. Go to Extensions > Apps Script.
// 3. Delete everything and paste this code.
// 4. Click 'Deploy' > 'New Deployment'.
// 5. Select type 'Web App'.
// 6. Set 'Who has access' to 'Anyone' (IMPORTANT).
// 7. Copy the 'Web App URL' and give it to me.

function doPost(e) {
    try {
        var data = JSON.parse(e.postData.contents);
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

        // Add headers if sheet is empty
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(["Fecha", "Nombre", "Email", "IP / Origen"]);
        }

        // Append user data
        sheet.appendRow([
            new Date().toLocaleString(),
            data.name,
            data.email,
            "Pilsapp Web App"
        ]);

        return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

