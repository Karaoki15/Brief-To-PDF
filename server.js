/*****************************************************************************
 * server.js — Dynamic Flow Layout Version v1.2
 *
 * - Handles multiple brief types.
 * - Receives brief data { language, briefType, projectTitle, briefItems:[{question, answer}] }.
 * - Generates PDF dynamically.
 * - FIX: Force replaces   again on server.
 * - FIX: Uses moveDown() for empty lines for potentially better spacing.
 * - FIX: Ensures line breaks within styled text are handled.
 *****************************************************************************/
const express = require('express');
const { google } = require('googleapis');
const PDFDocument = require('pdfkit');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

// --- Configuration ---
const SERVICE_ACCOUNT_PATH = './<SERVICE_ACCOUNT_JSON>'; // Path to service account JSON file
const FOLDER_ID = '<GOOGLE_DRIVE_FOLDER_ID>'; // Google Drive folder ID
const PORT = process.env.PORT || 3000;

// --- Service Account Authentication ---
let SERVICE_ACCOUNT;
try { SERVICE_ACCOUNT = require(SERVICE_ACCOUNT_PATH); }
catch (error) { console.error(`FATAL ERROR loading service account: ${error.message}`); process.exit(1); }

const auth = new google.auth.JWT(
  SERVICE_ACCOUNT.client_email, null, SERVICE_ACCOUNT.private_key,
  ['https://www.googleapis.com/auth/drive.file'], null
);

// --- Express App Setup ---
const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- HTML Parsing Functions ---
function parseHtmlIntoLines(html = '') {
  if (!html) return [];
  const cleanedHtml = String(html)
    .replace(/ /gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/ {2,}/g, ' ');
  const lines = cleanedHtml
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n');
  return lines;
}

function parseLine(line = '') {
  const trimmedLine = line.trim();
  if (!trimmedLine) return [];
  let currentLine = trimmedLine
    .replace(/<b>/gi, '<<B>>').replace(/<\/b>/gi, '<<\\B>>')
    .replace(/<i>/gi, '<<I>>').replace(/<\/i>/gi, '<<\\I>>')
    .replace(/<u>/gi, '<<U>>').replace(/<\/u>/gi, '<<\\U>>');
  const tokens = currentLine.split(/(<<\\?[BIU]>>)/).filter(Boolean);
  let stack = [];
  let segments = [];
  function addSegment(text, currentStack) {
    if (!text) return;
    const style = currentStack.join('-') || 'regular';
    const urlRegex = /(https?:\/\/[^\s"'\)<>]+)/g;
    let lastIndex = 0;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ style, text: text.substring(lastIndex, match.index) });
      }
      segments.push({ style: 'link', text: match[0] });
      lastIndex = urlRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      segments.push({ style, text: text.substring(lastIndex) });
    }
  }
  let currentTextBuffer = '';
  for (const token of tokens) {
    if (token === '<<B>>') { addSegment(currentTextBuffer, stack); currentTextBuffer = ''; if (!stack.includes('bold')) stack.push('bold'); }
    else if (token === '<<\\B>>') { addSegment(currentTextBuffer, stack); currentTextBuffer = ''; stack = stack.filter(s => s !== 'bold'); }
    else if (token === '<<I>>') { addSegment(currentTextBuffer, stack); currentTextBuffer = ''; if (!stack.includes('italic')) stack.push('italic'); }
    else if (token === '<<\\I>>') { addSegment(currentTextBuffer, stack); currentTextBuffer = ''; stack = stack.filter(s => s !== 'italic'); }
    else if (token === '<<U>>') { addSegment(currentTextBuffer, stack); currentTextBuffer = ''; if (!stack.includes('underline')) stack.push('underline'); }
    else if (token === '<<\\U>>') { addSegment(currentTextBuffer, stack); currentTextBuffer = ''; stack = stack.filter(s => s !== 'underline'); }
    else { currentTextBuffer += token; }
  }
  addSegment(currentTextBuffer, stack);
  return segments.filter(seg => seg.text && seg.text.trim().length > 0);
}

// --- PDF Generation ---
function createPdfBuffer(formData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        bufferPages: true
    });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => { console.error("PDF Generation Error:", err); reject(err); });
    const fontsDir = path.join(__dirname, 'fonts');
    try {
      doc.registerFont('MyFontRegular', path.join(fontsDir, 'Roboto-Regular.ttf'));
      doc.registerFont('MyFontBold', path.join(fontsDir, 'Roboto-Bold.ttf'));
      doc.registerFont('MyFontItalic', path.join(fontsDir, 'Roboto-Italic.ttf'));
      doc.registerFont('MyFontBoldItalic', path.join(fontsDir, 'Roboto-BoldItalic.ttf'));
    } catch (fontError) { return reject(new Error(`Failed to load fonts: ${fontError.message}`)); }
    const { language, briefType, projectTitle, briefItems } = formData;
    const lang = language || 'ru';
    const docTitle = `${projectTitle || 'Untitled Brief'} (${briefType || 'Unknown Type'})`;
    doc.font('MyFontBold').fontSize(16).text(docTitle, { align: 'center' });
    doc.moveDown(1.5);
    const paragraphGap = 0.75;
    const emptyLineSpacing = 0.5;
    function printOneLine(segments) {
      if (!segments || segments.length === 0) {
        return false;
      }
      let contentPrinted = false;
      segments.forEach((seg, i) => {
        if (!seg.text || seg.text.trim().length === 0) return;
        contentPrinted = true;
        const isLastSegmentInLine = (i === segments.length - 1);
        let fontName = 'MyFontRegular';
        let options = {
          continued: !isLastSegmentInLine,
          underline: false,
          link: null,
          features: []
        };
        const styles = seg.style.split('-');
        if (styles.includes('bold') && styles.includes('italic')) {
            fontName = 'MyFontBoldItalic';
        } else if (styles.includes('bold')) {
            fontName = 'MyFontBold';
        } else if (styles.includes('italic')) {
            fontName = 'MyFontItalic';
        }
        if (styles.includes('underline') || seg.style === 'link') options.underline = true;
        if (seg.style === 'link') { options.link = seg.text; options.fillColor = 'blue'; }
        else { options.fillColor = 'black'; }
        doc.font(fontName).fontSize(12).fillColor(options.fillColor).text(seg.text, options);
      });
      return contentPrinted;
    }
    function drawParagraph(question, answerHtml) {
      doc.font('MyFontBold').fontSize(12).fillColor('black').text(question || '(No Question Provided)');
      doc.moveDown(0.4);
      if (answerHtml && answerHtml.trim() !== '') {
        const lines = parseHtmlIntoLines(answerHtml);
        let previousLineWasEmpty = false;
        lines.forEach((line, index) => {
          const segments = parseLine(line);
          if (segments.length > 0) {
            printOneLine(segments);
            previousLineWasEmpty = false;
          } else {
            if (!previousLineWasEmpty) {
                doc.moveDown(emptyLineSpacing);
                previousLineWasEmpty = true;
            }
          }
        });
      } else {
        doc.font('MyFontItalic').fontSize(11).fillColor('grey').text('(No answer provided)');
        doc.moveDown(0.5);
      }
      doc.moveDown(paragraphGap);
    }
    if (briefItems && Array.isArray(briefItems) && briefItems.length > 0) {
        briefItems.forEach(item => {
            if (item && typeof item.question === 'string') {
                drawParagraph(item.question, item.answer || '');
            } else { console.warn("Skipping invalid brief item:", item); }
        });
    } else {
        doc.font('MyFontRegular').fontSize(12).fillColor('red').text('Error: No brief content was provided.');
        console.error("PDF Generation Error: formData.briefItems is missing, empty, or not an array.");
    }
    doc.end();
  });
}

// --- Google Drive Upload ---
async function uploadToDrive(fileName, pdfBuffer) {
  try {
    await auth.authorize(); const drive = google.drive({ version: 'v3', auth });
    const pdfStream = Readable.from(pdfBuffer);
    const fileMetadata = { name: fileName, parents: [FOLDER_ID] };
    const media = { mimeType: 'application/pdf', body: pdfStream };
    const res = await drive.files.create({ requestBody: fileMetadata, media: media, fields: 'id' });
    const fileId = res.data.id; if (!fileId) throw new Error("GDrive creation no ID.");
    await drive.permissions.create({ fileId: fileId, requestBody: { role: 'reader', type: 'anyone' } });
    const fileInfo = await drive.files.get({ fileId: fileId, fields: 'webViewLink, webContentLink' });
    return { fileId: fileId, webViewLink: fileInfo.data.webViewLink, webContentLink: fileInfo.data.webContentLink };
  } catch (error) {
    console.error("GDrive Upload/Permission Error:", error.message);
    if (error.response?.data?.error) { console.error("GDrive API Error Details:", error.response.data.error); throw new Error(`GDrive API Error: ${error.response.data.error.message}`); }
    else { throw error; }
  }
}

// --- API Endpoint ---
app.post('/generate-link', async (req, res) => {
  try {
    const { language, briefType, projectTitle, briefItems } = req.body;
    if (!briefType || !language || !briefItems || !Array.isArray(briefItems)) { return res.status(400).json({ success: false, message: 'Invalid request body.' }); }
    const pdfData = await createPdfBuffer({ language, briefType, projectTitle, briefItems });
    const now = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
    const safeTitle = (projectTitle || 'untitled').replace(/[^a-z0-9_\- \p{L}]/giu, '_').replace(/\s+/g, '_').substring(0, 50);
    const fileName = `brief_${briefType}_${safeTitle}_${now}.pdf`;
    const driveRes = await uploadToDrive(fileName, pdfData);
    res.json({ success: true, message: 'PDF generated and uploaded.', link: driveRes.webViewLink, download: driveRes.webContentLink, fileName: fileName, fileId: driveRes.fileId });
  } catch (err) {
    console.error("Error in /generate-link:", err);
    res.status(500).json({ success: false, message: err.message || 'Server error.' });
  }
});

// --- Basic Root Route ---
app.get('/', (req, res) => { res.redirect('/static/ru.html'); });

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`-----------------------------------------`);
  console.log(` Brief PDF Generator Server Started`);
  console.log(` Listening on: http://localhost:${PORT}`);
  console.log(` Public dir: ${path.join(__dirname, 'public')}`);
  console.log(` GDrive Folder ID: <GOOGLE_DRIVE_FOLDER_ID>`);
  console.log(`-----------------------------------------`);
});
