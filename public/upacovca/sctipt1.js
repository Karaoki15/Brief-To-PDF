/* scripts.js - Unified Version v1.1 */

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // NOTE: Consider renaming sctipt.js to script.js (correct spelling)
  // If you rename, update the <script> tag in all HTML files too.
  console.log("DOM Loaded. Initializing brief scripts...");
  initTextTools();
  restoreLastSavedBrief();
  renderSavedBriefsList();
  updateActiveLanguageLink();
  initTooltips();

  // Attach event listener to the download button explicitly
  const downloadButton = document.getElementById('downloadButton');
  if (downloadButton) {
    downloadButton.addEventListener('click', downloadBrief);
    console.log("Download button listener attached.");
  } else {
    console.error("Download button not found!");
  }

   // Attach listener for manual copy button
   const resultBlock = document.getElementById('result');
   const copyButton = resultBlock?.querySelector('.copybtn');
   if (copyButton) {
       copyButton.onclick = () => copyLinkManually(); // Use arrow function to ensure correct context
   }

    // Initialize language dropdown listener
    initializeLangSwitcher();

    console.log("Initialization complete.");
});

// --- Core Functions ---

/**
 * Detects Brief Type and Language from the current URL path.
 * Handles paths WITH and WITHOUT .html extension.
 * Example Paths: /static/ru.html, /logo/en, /print/ua
 * @returns {object} like { lang: 'ru', type: 'static' } or { lang: null, type: null } if parsing fails.
 */
function detectBriefInfoFromPath() {
  const path = window.location.pathname; // e.g., "/static/ru.html" or "/video/en" or "/logo/ua/"

  // --- ИЗМЕНЕНИЕ: Регулярное выражение для поддержки URL без .html ---
  // Оно ищет:
  // 1. / (начало)
  // 2. ([a-z0-9_-]+) - имя папки типа брифа (type)
  // 3. /
  // 4. ([a-z]{2}) - двухбуквенный код языка (lang)
  // 5. (?:\.html)? - опциональное расширение .html (?: ... )? означает необязательную не-захватывающую группу
  // 6. \/?$ - опциональный слеш в конце и конец строки
  const match = path.match(/^\/([a-z0-9_-]+)\/([a-z]{2})(?:\.html)?\/?$/i);
  // --- КОНЕЦ ИЗМЕНЕНИЯ ---

  if (match && match.length === 3) { // match[0] is full string, match[1] is type, match[2] is lang
    const type = match[1].toLowerCase();
    const lang = match[2].toLowerCase();
    console.log(`Path detected: type='${type}', lang='${lang}' from path='${path}'`);
    return { lang, type };
  }

  console.warn("Could not determine brief type/language from main path logic:", path);

  // Fallback для корневых языковых путей, если предыдущее не сработало
  // (например, если у вас есть /ru, /en, /ua без указания типа брифа, хотя это маловероятно для вашей структуры)
  const rootLangMatch = path.match(/^\/([a-z]{2})\/?$/i);
  if (rootLangMatch && rootLangMatch[1]) {
      const lang = rootLangMatch[1].toLowerCase();
      console.warn(`Path detected from root: lang='${lang}', type='null' (unknown) from path='${path}'`);
      return { lang: lang, type: null }; // Type unknown
  }

  // Глобальный fallback, если вообще ничего не определилось
  console.error("CRITICAL: Failed to detect language and type from path. Defaulting to ru/static.", path);
  return { lang: 'ru', type: 'static' }; // Default fallback
}

function getCurrentLang() {
  return detectBriefInfoFromPath().lang || 'ru';
}

/**
 * Initializes B/I/U buttons using event delegation.
 */
function initTextTools() {
  console.log("Initializing text tools...");
  const briefWrapper = document.querySelector('.brief-wrapper'); // Delegate from a closer parent if possible

  if (!briefWrapper) {
      console.error(".brief-wrapper not found, cannot initialize text tools.");
      return;
  }

  briefWrapper.addEventListener('click', function(event) {
    const button = event.target.closest('.text-tools button'); // Find closest button within text tools
    if (!button) return; // Exit if click wasn't on a tool button

    const textAreaWrapper = button.closest('.text-area-wrapper');
    const editable = textAreaWrapper?.querySelector('.editable');

    if (!editable) {
      console.warn("Could not find related '.editable' for the clicked tool button.");
      return;
    }

    event.preventDefault(); // Prevent default button actions
    editable.focus(); // Ensure the target area has focus *before* command

    let command = null;
    if (button.classList.contains('bold-btn')) {
      command = 'bold';
    } else if (button.classList.contains('italic-btn')) {
      command = 'italic';
    } else if (button.classList.contains('underline-btn')) {
      command = 'underline';
    }

    if (command) {
      console.log(`Executing command: ${command}`);
      try {
        const success = document.execCommand(command, false, null);
        if (!success) {
            console.warn(`execCommand ${command} reported failure.`);
        }
         // Trigger input event manually to potentially help frameworks/listeners detect change
        editable.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      } catch (error) {
        console.error(`Error executing command ${command}:`, error);
      }
    }
  });
  console.log("Text tools initialized.");
}


/**
 * Cleans HTML string: Keeps allowed tags (B, I, U, A[href], BR, DIV),
 * removes disallowed tags and attributes (style, class, etc.).
 * FIX: Also replaces   with standard spaces.
 * @param {string | null | undefined} html - Input HTML.
 * @returns {string} Cleaned HTML string.
 */
function cleanHTML(html) {
  if (!html) return '';
  let clean = String(html); // Ensure it's a string

  // --- ИЗМЕНЕНИЕ: Заменяем   ЗДЕСЬ, на клиенте ---
  clean = clean.replace(/ /g, ' ');
  // --- Конец изменения ---

  const temp = document.createElement('div');
  temp.innerHTML = clean; // Work with HTML containing standard spaces

  const allowedTags = ['B', 'I', 'U', 'A', 'BR', 'DIV'];
  const allowedAttrs = ['href']; // Only 'href' is allowed (implicitly only on 'A' tags)

  function traverse(node) {
    if (!node) return;

    const children = Array.from(node.childNodes); // Static copy

    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        traverse(child); // Recurse first

        const tagName = child.tagName.toUpperCase();

        if (!allowedTags.includes(tagName)) {
          // Replace disallowed tag with its content fragment
          if (child.parentNode) {
            child.replaceWith(...child.childNodes); // Unwraps content
          }
        } else {
          // Remove disallowed attributes from allowed tags
          const attrsToRemove = [];
          for (let i = 0; i < child.attributes.length; i++) {
            const attrName = child.attributes[i].name.toLowerCase();
            // Keep 'href' only if it's an 'A' tag
            if (!(tagName === 'A' && attrName === 'href')) {
               if (!allowedAttrs.includes(attrName)) {
                 attrsToRemove.push(child.attributes[i].name);
               }
            }
          }
          attrsToRemove.forEach(attr => child.removeAttribute(attr));
        }
      } else if (child.nodeType === Node.COMMENT_NODE) {
        child.remove(); // Remove comment nodes <!-- ... -->
      }
    }
  }

  traverse(temp);

  // --- ИЗМЕНЕНИЕ: Дополнительная очистка двойных пробелов ---
  // Может помочь убрать лишние пробелы после замены  
  let resultHTML = temp.innerHTML.trim();
  resultHTML = resultHTML.replace(/ {2,}/g, ' '); // Replace multiple spaces with single space
  // --- Конец изменения ---

  // Убедимся, что <br> не обрамлены лишними пробелами, что может влиять на парсинг
  resultHTML = resultHTML.replace(/\s*<br\s*\/?>\s*/gi, '<br>');

  return resultHTML;
}

/**
 * Collects brief data, cleans it, and sends it to the server for PDF generation.
 */
async function downloadBrief() {
  console.log("downloadBrief function called.");
  const button = document.getElementById('downloadButton');
  if (!button) return;

  if (button.classList.contains('loading')) {
    console.log("Download already in progress.");
    return;
  }
  button.classList.add('loading');
  button.disabled = true;

  try {
    const { lang, type } = detectBriefInfoFromPath();
    if (!lang || !type) {
      alert('Ошибка: Не удалось определить язык или тип брифа. Проверьте URL.');
      button.classList.remove('loading');
      button.disabled = false;
      return;
    }

    const projectTitle = document.getElementById('projectTitle')?.value?.trim() || '';
    // Получаем ВСЕ секции брифа внутри .brief-content
    const briefSections = document.querySelectorAll('.brief-content .brief-section');

    if (briefSections.length === 0) {
      alert('Не найдены поля для брифа! Убедитесь, что секции находятся внутри <div class="brief-content">.');
      button.classList.remove('loading');
      button.disabled = false;
      return;
    }

    console.log(`Found ${briefSections.length} brief sections for type "${type}".`);
    const briefItems = [];

    briefSections.forEach((section, index) => {
      const questionElement = section.querySelector('h2');
      if (!questionElement) {
        console.warn(`Пропуск секции ${index + 1}: отсутствует h2 (заголовок вопроса).`);
        return;
      }
      const questionText = questionElement.innerText.trim();
      let answerHtml = ''; // Будет содержать HTML-представление ответа

      // --- ИЗМЕНЕНИЕ: Проверяем тип секции ---
      const editableElement = section.querySelector('.editable');
      const checkboxGroup = section.querySelector('.checkbox-group'); // Ищем группу чекбоксов

      if (editableElement) {
        // Это стандартная секция с contenteditable
        answerHtml = cleanHTML(editableElement.innerHTML);
        console.log(`Section ${index + 1} (Editable) Q: "${questionText}"`);
      } else if (checkboxGroup) {
        // Это секция с чекбоксами (наш новый блок №12)
        console.log(`Section ${index + 1} (Checkbox) Q: "${questionText}"`);
        const selectedExtras = [];
        // Собираем выбранные чекбоксы
        checkboxGroup.querySelectorAll('input[type="checkbox"][name="extras"]:checked').forEach(checkbox => {
          selectedExtras.push(checkbox.value); // Добавляем value выбранного чекбокса
        });

        // Собираем значение из текстового поля "Інше"
        const otherInput = checkboxGroup.querySelector('input[type="text"][name="extraOther"]');
        const otherText = otherInput ? otherInput.value.trim() : '';

        if (otherText) {
          selectedExtras.push(`Інше: ${otherText}`); // Добавляем "Інше" если оно заполнено
        }

        // Формируем HTML-ответ для PDF
        if (selectedExtras.length > 0) {
          // Создаем список с <br> для переносов строк в PDF
          answerHtml = selectedExtras.map(item => `- ${item}`).join('<br>');
        } else {
          answerHtml = '(Нічого не вибрано)'; // Или оставьте пустым, или добавьте плейсхолдер
        }
         console.log(`  Selected Extras: ${answerHtml.replace(/<br>/g, ', ')}`);
      } else {
        // Секция неизвестного типа или пустая, не содержащая .editable или .checkbox-group
        console.warn(`Секция "${questionText}" не содержит известного поля для ответа (.editable или .checkbox-group). Ответ будет пустым.`);
        answerHtml = '(Відповідь не надана або поле не розпізнано)';
      }
      // --- Конец изменения ---

      briefItems.push({
        question: questionText,
        answer: answerHtml // Отправляем сформированный HTML
      });
    });

    const dataToSend = {
      projectTitle: projectTitle,
      language: lang,
      briefType: type,
      briefItems: briefItems
    };

    console.log('Отправка данных на сервер:', dataToSend);

    const response = await fetch('/generate-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSend)
    });

    const data = await response.json();
    console.log('Ответ от сервера:', data);

    if (response.ok && data.success && data.link) {
      const resultBlock = document.getElementById('result');
      const linkOutput = document.getElementById('linkOutput');

      if (resultBlock && linkOutput) {
        resultBlock.style.display = 'block';
        linkOutput.textContent = data.link;
        const copyButton = resultBlock.querySelector('.copybtn');
        if (copyButton) copyButton.onclick = () => copyLinkManually();
      } else { console.error("Result block or link output element not found."); }

      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(data.link);
          showToast();
        } catch (err) { console.warn('Не удалось скопировать в буфер обмена:', err); }
      } else { console.warn('Буфер обмена недоступен.'); }

      saveBriefToLocalStorage();
    } else {
      const errorMsg = data?.message || `Server responded with status ${response.status}`;
      alert(`Ошибка при генерации ссылки: ${errorMsg}`);
      console.error('Server returned error:', errorMsg, data);
    }

  } catch (err) {
    console.error('Критическая ошибка в downloadBrief:', err);
    alert('Произошла ошибка при обработке запроса: ' + err.message);
  } finally {
    button.classList.remove('loading');
    button.disabled = false;
    console.log("downloadBrief finished.");
  }
}

/**
 * Shows a short notification message (toast).
 * @param {string | null} [message=null] - Optional message override.
 */
function showToast(message = null) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const lang = getCurrentLang();
  const defaultMessages = {
    ru: 'Скопировано в буфер обмена',
    ua: 'Скопійовано в буфер обміну',
    en: 'Copied to clipboard'
  };
  toast.textContent = message || defaultMessages[lang] || defaultMessages['ru'];
  toast.style.display = 'block';
  toast.style.animation = 'none';
  void toast.offsetHeight; // Reflow
  toast.style.animation = null;
  setTimeout(() => { toast.style.display = 'none'; }, 2500); // Slightly longer display
}


/**
 * Manually copies the generated link from the output span.
 */
function copyLinkManually() {
  const linkElement = document.getElementById('linkOutput');
  const link = linkElement?.textContent;

  if (link && navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(link)
      .then(() => showToast()) // Show 'Copied' toast on success
      .catch(err => {
        console.error('Ручное копирование не удалось:', err);
        alert('Не удалось скопировать ссылку.');
      });
  } else if (link) {
      // Fallback for non-secure contexts
      try {
        const tempArea = document.createElement('textarea');
        tempArea.value = link;
        document.body.appendChild(tempArea);
        tempArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempArea);
        showToast();
      } catch (ex) {
        alert('Не удалось скопировать ссылку автоматически. Пожалуйста, скопируйте вручную.');
      }
  } else {
    console.warn("Нет ссылки для копирования.");
  }
}


// === Local Storage Persistence ===

const LOCAL_STORAGE_KEY = 'briefSaves_v2';
const MAX_SAVES = 10;

/**
 * Saves the current state of the brief form to Local Storage.
 */
function saveBriefToLocalStorage() {
  const { lang, type } = detectBriefInfoFromPath();
  if (!type) {
    console.warn("Cannot save brief: Brief type unknown.");
    return;
  }

  const projectTitle = document.getElementById('projectTitle')?.value?.trim() || `Без названия (${type})`;
  const briefSections = document.querySelectorAll('.brief-content .brief-section');
  let previewText = '';
  const briefItems = [];

  briefSections.forEach((section) => {
    const questionElement = section.querySelector('h2');
    const answerElement = section.querySelector('.editable');
    if (questionElement && answerElement) {
      const question = questionElement.innerText.trim();
      // **** Store RAW HTML in LocalStorage ****
      // Cleaning happens right before sending to server in downloadBrief
      const rawAnswerHtml = answerElement.innerHTML.trim();
      briefItems.push({ question: question, answer: rawAnswerHtml });

      // Generate preview from raw HTML's text content
      if (!previewText && rawAnswerHtml && rawAnswerHtml !== '<br>') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = rawAnswerHtml;
        const plainText = tempDiv.textContent || tempDiv.innerText || "";
        if (plainText.trim()) {
          previewText = plainText.trim().slice(0, 35) + '...';
        }
      }
    }
  });

  const now = new Date();
  const entry = {
    timestamp: now.toISOString(),
    briefType: type,
    projectTitle: projectTitle,
    preview: `${projectTitle} (${type}) — ${previewText || '(пусто)'}`,
    data: briefItems
  };

  let existing = [];
  try {
    existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    if (!Array.isArray(existing)) existing = [];
  } catch (e) { console.error("Error parsing saved briefs:", e); existing = []; }

  existing.unshift(entry);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_SAVES)));
  renderSavedBriefsList(); // Update UI
}

/**
 * Renders the list of saved briefs in the UI.
 */
function renderSavedBriefsList() {
  const listEl = document.getElementById('savedBriefList');
  if (!listEl) return;
  listEl.innerHTML = '';

  let saves = [];
  try {
    saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    if (!Array.isArray(saves)) saves = [];
  } catch (e) { saves = []; }

  const lang = getCurrentLang();
  const translations = {
    ru: { load: 'Загрузить', remove: 'Удалить', no_saves: 'Нет сохранённых брифов', title: 'Сохраненные брифы', saved_at: 'Сохранено:' },
    ua: { load: 'Завантажити', remove: 'Видалити', no_saves: 'Немає збережених брифів', title: 'Збережені брифи', saved_at: 'Збережено:' },
    en: { load: 'Load', remove: 'Delete', no_saves: 'No saved briefs', title: 'Saved Briefs', saved_at: 'Saved:' }
  };
  const t = translations[lang] || translations['ru'];

  const savedBriefsContainer = listEl.closest('.saved-briefs');
  if (savedBriefsContainer) {
    const heading = savedBriefsContainer.querySelector('h3');
    if (heading) heading.textContent = t.title;
  }

  if (!saves.length) {
    listEl.innerHTML = `<li class="no-saves-message">${t.no_saves}</li>`;
    return;
  }

  saves.forEach((entry, index) => {
    if (!entry?.timestamp || !entry.preview || !entry.data) return; // Skip malformed

    const li = document.createElement('li');
    li.dataset.index = index;

    let displayTimestamp = entry.timestamp;
    try {
      displayTimestamp = new Date(entry.timestamp).toLocaleString(lang + '-' + lang.toUpperCase(), { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) { /* Use raw */ }

    li.innerHTML = `
      <div class="saved-entry-info">
        <strong class="saved-timestamp">${t.saved_at} ${displayTimestamp}</strong>:
        <span class="saved-preview">${entry.preview}</span>
      </div>
      <div class="saved-entry-actions">
        <button class="load-saved-btn" data-index="${index}">${t.load}</button>
        <button class="delete-saved-btn" data-index="${index}">${t.remove}</button>
      </div>
    `;
    listEl.appendChild(li);
  });

   // Remove previous listener before adding a new one to prevent duplicates
    if (listEl._briefListListener) {
        listEl.removeEventListener('click', listEl._briefListListener);
    }

    // Add event listeners using event delegation
   listEl._briefListListener = function(event) { // Store listener reference
       const target = event.target;
       const indexStr = target.dataset.index; // Get index from button's data attribute
       if (indexStr === undefined) return; // Click wasn't on a button with index

       const index = parseInt(indexStr, 10);
       if (isNaN(index)) return;

       if (target.classList.contains('load-saved-btn')) {
            event.stopPropagation(); // Prevent potential outer clicks
           loadSavedBrief(index);
       } else if (target.classList.contains('delete-saved-btn')) {
            event.stopPropagation();
           if (confirm(getConfirmDeleteMessage(lang))) {
                deleteSavedBrief(index);
           }
       }
   };
    listEl.addEventListener('click', listEl._briefListListener);
}


function getConfirmDeleteMessage(lang) {
  const messages = { ru: 'Удалить это сохранение?', ua: 'Видалити це збереження?', en: 'Delete this saved brief?' };
  return messages[lang] || messages['ru'];
}


/**
 * Loads a specific saved brief into the current form.
 * @param {number} index - Index of the brief to load in the saved list.
 */
function loadSavedBrief(index) {
  console.log(`Attempting to load saved brief at index ${index}`);
  let saves = [];
  try {
    saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    if (!Array.isArray(saves)) saves = [];
  } catch (e) { console.error("Error parsing saves for loading:", e); return; }

  const save = saves[index];
  if (!save?.data || !Array.isArray(save.data) || !save.briefType) {
    console.error('Invalid save data structure for index:', index, save);
    alert('Ошибка: Не удалось загрузить сохранение - неверный формат данных.');
    return;
  }

  const currentInfo = detectBriefInfoFromPath();
  if (currentInfo.type && save.briefType !== currentInfo.type) {
    const loadAnyway = confirm(
      `Предупреждение: Загружаемый бриф (${save.briefType}) отличается от текущей страницы (${currentInfo.type}). Поля могут не совпадать.\n\nЗагрузить?`
    );
    if (!loadAnyway) return;
  }

  console.log(`Loading brief: Type="${save.briefType}", Title="${save.projectTitle}"`);

  const titleInput = document.getElementById('projectTitle');
  if (titleInput) titleInput.value = save.projectTitle || '';

  const currentEditableBlocks = document.querySelectorAll('.brief-content .editable');
  if (!currentEditableBlocks || currentEditableBlocks.length === 0) {
    console.error("No '.editable' fields found on the current page to load data into.");
    alert("Ошибка: Не удалось найти поля для загрузки данных.");
    return;
  }

  // Load saved answers into current fields by order
  save.data.forEach((savedItem, i) => {
    if (currentEditableBlocks[i]) {
       // Load the RAW HTML as it was saved
      currentEditableBlocks[i].innerHTML = (typeof savedItem.answer === 'string' ? savedItem.answer : '');
    } else {
      console.warn(`Saved brief has more items (${save.data.length}) than current page (${currentEditableBlocks.length}). Skipping item ${i}.`);
    }
  });

  // Clear extra fields on the current page if loaded data was shorter
  for (let i = save.data.length; i < currentEditableBlocks.length; i++) {
    currentEditableBlocks[i].innerHTML = '';
  }

  window.scrollTo(0, 0); // Scroll to top
  showToast(getLoadSuccessMessage(getCurrentLang()));
  console.log("Brief loaded successfully.");
}

function getLoadSuccessMessage(lang) {
  const messages = { ru: 'Сохранение загружено!', ua: 'Збереження завантажено!', en: 'Saved brief loaded!' };
  return messages[lang] || messages['ru'];
}

/**
 * Deletes a saved brief entry from Local Storage.
 * @param {number} index - Index of the brief to delete.
 */
function deleteSavedBrief(index) {
  let saves = [];
  try {
    saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    if (!Array.isArray(saves)) saves = [];
  } catch (e) { console.error("Error parsing saves for deletion:", e); return; }

  if (index >= 0 && index < saves.length) {
    saves.splice(index, 1);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saves));
    renderSavedBriefsList(); // Update UI
    console.log(`Deleted saved brief at index ${index}`);
  } else {
    console.error("Invalid index for deletion:", index);
  }
}

/**
 * Attempts to restore the most recently saved brief on page load.
 */
function restoreLastSavedBrief() {
  let saves = [];
  try {
    saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    if (!Array.isArray(saves)) saves = [];
  } catch (e) { console.warn("Could not parse saves for restore:", e); return; }

  if (saves.length > 0) {
    console.log("Attempting to restore last saved brief...");
    // Load index 0 silently - type check happens inside loadSavedBrief
    loadSavedBrief(0);
  } else {
    console.log("No saved briefs found to restore.");
  }
}


// === Language Switcher & UI Helpers ===

/**
 * Initializes the language switcher dropdown behavior.
 */
function initializeLangSwitcher() {
    const langBtn = document.querySelector('.lang-btn');
    const dropdown = document.querySelector('.lang-dropdown');

    if (!langBtn || !dropdown) {
        console.warn("Language switcher elements not found.");
        return;
    }

    langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (dropdown.classList.contains('open') && !dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });

    const langMenu = dropdown.querySelector('.lang-menu');
    if (langMenu) {
        langMenu.addEventListener('click', (e) => {
             // Only close if a link *within* the menu was clicked
             if (e.target.tagName === 'A') {
                dropdown.classList.remove('open');
             }
        });
    }
}

/**
 * Adds 'active-lang' class to the link matching the current page's language/type.
 * Handles paths with and without .html.
 */
function updateActiveLanguageLink() {
  const { lang, type } = detectBriefInfoFromPath();
  if (!lang || !type) {
      console.warn("updateActiveLanguageLink: lang or type not detected, cannot update active link.");
      return;
  }

  const currentPathForComparison = `/${type}/${lang}`;
  // --- КОНЕЦ ИЗМЕНЕНИЯ ---

  const langLinks = document.querySelectorAll('.lang-menu a');

  console.log(`updateActiveLanguageLink: Comparing against '${currentPathForComparison}'`);

  langLinks.forEach(link => {
    link.classList.remove('active-lang');
    try {
        const linkUrl = new URL(link.href, window.location.origin);
        // Сравниваем pathname. Убираем возможный .html из linkUrl.pathname и конечный слеш для консистентности.
        let linkPathForComparison = linkUrl.pathname.toLowerCase();
        if (linkPathForComparison.endsWith('.html')) {
            linkPathForComparison = linkPathForComparison.slice(0, -5); // Убираем .html
        }
        if (linkPathForComparison.endsWith('/')) {
            linkPathForComparison = linkPathForComparison.slice(0, -1); // Убираем конечный /
        }


        console.log(`  Checking link: '${link.href}', parsed path: '${linkPathForComparison}'`);
        if (linkPathForComparison === currentPathForComparison) {
            link.classList.add('active-lang');
            console.log(`    Match found! Added active class to: ${link.href}`);
        }
    } catch (e) {
        // Fallback, если URL невалидный, хотя это маловероятно для ссылок
        console.error("Error parsing link href in updateActiveLanguageLink:", link.href, e);
    }
  });
}

function openModal(img) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  modal.style.display = "flex";
  modalImg.src = img.src;
}

function closeModal() {
  const modal = document.getElementById("imageModal");
  modal.style.display = "none";
}




/**
 * Инициализирует все tooltip-триггеры на странице.
 * Адаптивно позиционирует tooltip и управляет видимостью.
 * Упрощенная логика для кликов.
 */
function initTooltips() {
  console.log("Initializing tooltips...");
  const tooltipTriggers = document.querySelectorAll('.tooltip-trigger');

  tooltipTriggers.forEach(trigger => {
    const tooltipContent = trigger.querySelector('.tooltip-content');
    if (!tooltipContent) {
      console.warn("Tooltip content not found for a trigger:", trigger);
      return;
    }

    // Каждому триггеру добавим свойство для отслеживания состояния клика
    // (вместо глобальной isClickTooltipVisible, чтобы избежать путаницы)
    trigger._isTooltipOpenByClick = false;

    // --- Функция для определения и применения класса позиции ---
    function applyTooltipPosition() {
      tooltipContent.classList.remove('position-top', 'position-bottom', 'position-left', 'position-right');
      const triggerRect = trigger.getBoundingClientRect();

      const prevVisibility = tooltipContent.style.visibility;
      const prevOpacity = tooltipContent.style.opacity;
      tooltipContent.style.visibility = 'visible'; // Для корректного getBoundingClientRect
      tooltipContent.style.opacity = '0';          // Чтобы не было видно во время измерений

      const tooltipRect = tooltipContent.getBoundingClientRect();

      // Возвращаем стили, если tooltip не должен быть видим прямо сейчас
      // (т.е. если он не открыт кликом и на него нет ховера/фокуса)
      if (!trigger._isTooltipOpenByClick && !(trigger === document.activeElement || trigger.matches(':hover'))) {
         tooltipContent.style.visibility = prevVisibility;
         tooltipContent.style.opacity = prevOpacity;
      }


      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gap = 15;
      let bestPosition = 'top';

      const spaceTop = triggerRect.top - tooltipRect.height - gap;
      const spaceBottom = viewportHeight - (triggerRect.bottom + tooltipRect.height + gap);
      const spaceRight = viewportWidth - (triggerRect.right + tooltipRect.width + gap);
      const spaceLeft = triggerRect.left - tooltipRect.width - gap;

      if (spaceTop >= 0) { bestPosition = 'top'; }
      else if (spaceBottom >= 0) { bestPosition = 'bottom'; }
      else if (spaceRight >= 0) { bestPosition = 'right'; }
      else if (spaceLeft >= 0) { bestPosition = 'left'; }
      else {
        const overflows = { top: spaceTop, bottom: spaceBottom, left: spaceLeft, right: spaceRight };
        let minOverflow = -Infinity;
        for (const [pos, val] of Object.entries(overflows)) {
          if (val > minOverflow) { minOverflow = val; bestPosition = pos; }
        }
      }
      tooltipContent.classList.add(`position-${bestPosition}`);
      // console.log(`Tooltip for [${trigger.closest('.brief-section').querySelector('h2').textContent.trim().slice(0,10)}...] positioned: ${bestPosition}`);
    }

    // --- Логика показа/скрытия, управляемая JS (в основном для кликов) ---
    const showTooltip = () => {
      closeAllOtherTooltips(trigger);
      applyTooltipPosition(); // Позиционируем ПЕРЕД тем, как сделать видимым
      tooltipContent.classList.add('tooltip-visible');
      trigger._isTooltipOpenByClick = true; // Устанавливаем флаг
      // Явно устанавливаем стили для видимости, чтобы переопределить возможное visibility:hidden от CSS
      tooltipContent.style.visibility = 'visible';
      tooltipContent.style.opacity = '1';
      console.log("Tooltip shown by JS:", trigger);
    };

    const hideTooltip = () => {
      tooltipContent.classList.remove('tooltip-visible');
      trigger._isTooltipOpenByClick = false; // Сбрасываем флаг
      // Позволяем CSS управлять скрытием (через отсутствие .tooltip-visible)
      tooltipContent.style.visibility = '';
      tooltipContent.style.opacity = '';
      console.log("Tooltip hidden by JS:", trigger);
    };

    // --- Обработчики событий ---

    // Для ПК: CSS :hover/:focus управляет видимостью.
    // JS здесь только для вызова applyTooltipPosition ПЕРЕД тем, как CSS покажет tooltip.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      trigger.addEventListener('mouseenter', () => {
        // Если tooltip еще не виден (например, нет класса .tooltip-visible от клика)
        // и CSS еще не сделал его видимым по ховеру (проверяем computed style)
        if (!trigger._isTooltipOpenByClick && getComputedStyle(tooltipContent).opacity === '0') {
          applyTooltipPosition();
        }
      });
      trigger.addEventListener('focus', () => {
         if (!trigger._isTooltipOpenByClick && getComputedStyle(tooltipContent).opacity === '0') {
          applyTooltipPosition();
        }
      });
    }

    // Обработчик КЛИКА - работает всегда (и для ПК, и для мобильных)
    trigger.addEventListener('click', (event) => {
      event.stopPropagation(); // Предотвращаем немедленное закрытие через document click
      console.log("Tooltip trigger clicked. Current click state:", trigger._isTooltipOpenByClick);

      if (trigger._isTooltipOpenByClick) {
        hideTooltip();
      } else {
        showTooltip();
      }
    });
  }); // конец forEach(trigger => ...

  // Закрытие tooltip при клике в любом месте документа
  document.addEventListener('click', function(event) {
    // console.log("Document clicked");
    document.querySelectorAll('.tooltip-trigger').forEach(trigger => {
      const tooltipContent = trigger.querySelector('.tooltip-content');
      // Если tooltip был открыт кликом И клик был вне триггера и вне контента tooltip
      if (trigger._isTooltipOpenByClick && tooltipContent && tooltipContent.classList.contains('tooltip-visible')) {
        if (!trigger.contains(event.target) && !tooltipContent.contains(event.target)) {
          console.log("Clicked outside an open tooltip, hiding it:", trigger);
          tooltipContent.classList.remove('tooltip-visible');
          trigger._isTooltipOpenByClick = false;
          tooltipContent.style.visibility = '';
          tooltipContent.style.opacity = '';
        }
      }
    });
  });
  console.log("Tooltips initialization complete.");
} // конец initTooltips

/**
 * Вспомогательная функция для закрытия всех других открытых tooltip'ов,
 * которые были открыты КЛИКОМ.
 * @param {HTMLElement} currentTrigger - Триггер, который не нужно закрывать.
 */
function closeAllOtherTooltips(currentTrigger) {
  // console.log("Closing other tooltips, excluding current:", currentTrigger);
  document.querySelectorAll('.tooltip-trigger').forEach(trigger => {
    if (trigger !== currentTrigger) {
      // Если другой tooltip был открыт кликом, закрываем его
      if (trigger._isTooltipOpenByClick) {
        const tooltipContent = trigger.querySelector('.tooltip-content');
        if (tooltipContent) {
          tooltipContent.classList.remove('tooltip-visible');
          trigger._isTooltipOpenByClick = false; // Сбрасываем флаг
          tooltipContent.style.visibility = '';
          tooltipContent.style.opacity = '';
          console.log("Closed other tooltip (opened by click):", trigger);
        }
      }
    }
  });
}