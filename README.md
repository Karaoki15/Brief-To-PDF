<div align="center">
  <h1>Brief-To-PDF — web service for generating PDFs from briefs</h1>
  <p><strong>A user fills out a brief → clicks “Download” → the service collects data from HTML chunks and renders a clean PDF → returns the file and a link.</strong></p>
  <p>
    <a><img alt="Node.js" src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white"></a>
    <a><img alt="PDFKit" src="https://img.shields.io/badge/PDF-PDFKit-0A0A0A"></a>
    <a><img alt="i18n" src="https://img.shields.io/badge/Multilingual-RU%20%7C%20UA%20%7C%20EN-6E44FF"></a>
    <a href="https://bbrif.design/static/en"><img alt="Live Demo" src="https://img.shields.io/badge/Demo-bbrif.design-0b6efd"></a>
  </p>
</div>

---

## 🔎 About

**Brief-To-PDF** is a web app that turns a user’s brief form into a neatly formatted PDF document. It supports **multiple interface languages** (RU/UA/EN) and **multiple brief types** for different tasks (e.g., “Static”, “Video”, “Print”, “Logo”).  
The service carefully extracts content from **HTML islands** (bold/italic/underline, line breaks, links), renders a PDF with clean typography and spacing, and immediately returns **the file and a link** for download/sharing.

> Demo: https://bbrif.design/static/en

---

## ✅ What it does

- **One click from form to PDF.** Fill out a brief → click “Download” → get a document with no extra steps.
- **HTML in answers.** Bold/italic/underline, line breaks, clickable links.
- **Clean typography.** Headings, spacing, proper handling of empty lines, tidy margins.
- **Multilingual UI.** RU/UA/EN — interface texts and headings adapt to the selected language.
- **Multiple brief templates.** Different forms for different scenarios (design brief, video brief, print, logo, etc.).
- **Result link.** Besides the file download, a URL to the generated PDF is provided (handy for sharing).

---

## 🧭 How it works (user flow)

1. The user selects a language and brief type.
2. Fills in the fields (including answers with basic HTML markup).
3. Clicks **“Download”**.
4. The script extracts data from HTML segments, converts it into structured content, and renders a **PDF**.
5. The user receives **the file** and **a link** to the PDF.

---

## 🧱 Under the hood (short)

- **HTML answer parsing** → text normalization and segmentation (B/I/U, line breaks, links).
- **PDF rendering** → typography, spacing, clickable URLs.
- **Multilingual UI** → RU/UA/EN, language switch in the interface.
- **Brief templates** → configurable sets of questions for various task types.

> The implementation isn’t tied to a single storage: the PDF link can point to a locally generated file or to external storage (Google Drive/S3) — depending on project configuration.

---

## 🧩 Brief types (examples)

- **Static (graphic design)** — banners, posts, covers.
- **Video** — ads, social videos, promos.
- **Print** — flyers, business cards, catalogs.
- **Logo/identity** — brand style, guidelines.

_(The list is extendable: it’s easy to add new forms and matching PDF templates.)_

---

## 🧪 Quality & UX

- **Predictable look.** Documents look consistent regardless of who filled out the brief.
- **No “dirty” HTML.** Extra tags/empty nodes don’t break the PDF layout.
- **Clickable links.** Convenient for sharing sources, moodboards, and references.

---

## ⚠️ Limitations

- Only **basic HTML** in answers is supported (B/I/U, line breaks, links). Complex tables/embedded styles are not interpreted.
- For a branded look, **font sets** are needed (or sensible default fonts configured in advance).

---

## 🗺️ Roadmap

- Themes/branding presets per client.
- Table of contents and page headers/footers (page numbers, metadata).
- Export to **DOCX/HTML** in addition to PDF.
- Import brief templates from JSON/Google Sheets.
- More interface languages.

---

## 👤 Author

**Vladyslav Khoroshylov** — Instagram: **@vlad.khoro**

> Portfolio project: showcases UX thinking, HTML→PDF processing, and support for multilingual UI and multiple templates.
