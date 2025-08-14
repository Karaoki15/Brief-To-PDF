/* scripts.js */
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM Loaded. Initializing brief scripts...");
  initTextTools();
  restoreLastSavedBrief();
  renderSavedBriefsList();
  updateActiveLanguageLink();
  initTooltips();

  const downloadButton = document.getElementById('downloadButton');
  if (downloadButton) {
    downloadButton.addEventListener('click', downloadBrief);
    console.log("Download button listener attached.");
  } else {
    console.error("Download button not found!");
  }

  const resultBlock = document.getElementById('result');
  const copyButton = resultBlock?.querySelector('.copybtn');
  if (copyButton) {
    copyButton.onclick = () => copyLinkManually();
  }

  initializeLangSwitcher();

  console.log("Initialization complete.");
});

function detectBriefInfoFromPath() {
  const path = window.location.pathname;
  const match = path.match(/^\/([a-z0-9_-]+)\/([a-z]{2})(?:\.html)?\/?$/i);

  if (match && match.length === 3) {
    const type = match[1].toLowerCase();
    const lang = match[2].toLowerCase();
    console.log(`Path detected: type='${type}', lang='${lang}' from path='${path}'`);
    return { lang, type };
  }

  console.warn("Could not determine brief type/language from main path logic:", path);

  const rootLangMatch = path.match(/^\/([a-z]{2})\/?$/i);
  if (rootLangMatch && rootLangMatch[1]) {
    const lang = rootLangMatch[1].toLowerCase();
    console.warn(`Path detected from root: lang='${lang}', type='null' (unknown) from path='${path}'`);
    return { lang: lang, type: null };
  }

  console.error("CRITICAL: Failed to detect language and type from path. Defaulting to ru/static.", path);
  return { lang: 'ru', type: 'static' };
}

function getCurrentLang() {
  return detectBriefInfoFromPath().lang || 'ru';
}

function initTextTools() {
  console.log("Initializing text tools...");
  const briefWrapper = document.querySelector('.brief-wrapper');

  if (!briefWrapper) {
    console.error(".brief-wrapper not found, cannot initialize text tools.");
    return;
  }

  briefWrapper.addEventListener('click', function(event) {
    const button = event.target.closest('.text-tools button');
    if (!button) return;

    const textAreaWrapper = button.closest('.text-area-wrapper');
    const editable = textAreaWrapper?.querySelector('.editable');

    if (!editable) {
      console.warn("Could not find related '.editable' for the clicked tool button.");
      return;
    }

    event.preventDefault();
    editable.focus();

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
        editable.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      } catch (error) {
        console.error(`Error executing command ${command}:`, error);
      }
    }
  });
  console.log("Text tools initialized.");
}

function cleanHTML(html) {
  if (!html) return '';
  let clean = String(html);

  clean = clean.replace(/ /g, ' ');

  const temp = document.createElement('div');
  temp.innerHTML = clean;

  const allowedTags = ['B', 'I', 'U', 'A', 'BR', 'DIV'];
  const allowedAttrs = ['href'];

  function traverse(node) {
    if (!node) return;

    const children = Array.from(node.childNodes);

    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        traverse(child);

        const tagName = child.tagName.toUpperCase();

        if (!allowedTags.includes(tagName)) {
          if (child.parentNode) {
            child.replaceWith(...child.childNodes);
          }
        } else {
          const attrsToRemove = [];
          for (let i = 0; i < child.attributes.length; i++) {
            const attrName = child.attributes[i].name.toLowerCase();
            if (!(tagName === 'A' && attrName === 'href')) {
              if (!allowedAttrs.includes(attrName)) {
                attrsToRemove.push(child.attributes[i].name);
              }
            }
          }
          attrsToRemove.forEach(attr => child.removeAttribute(attr));
        }
      } else if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
      }
    }
  }

  traverse(temp);
}
let resultHTML = temp.innerHTML.trim();
resultHTML = resultHTML.replace(/ {2,}/g, ' ');
resultHTML = resultHTML.replace(/\s*<br\s*\/?>\s*/gi, '<br>');
return resultHTML;


async function downloadBrief() {
  const button = document.getElementById('downloadButton');
  if (!button) return;

  if (button.classList.contains('loading')) {
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
    const briefSections = document.querySelectorAll('.brief-content .brief-section');

    if (briefSections.length === 0) {
      alert('Не найдены поля для брифа! Убедитесь, что секции находятся внутри <div class="brief-content">.');
      button.classList.remove('loading');
      button.disabled = false;
      return;
    }

    const briefItems = [];

    briefSections.forEach((section, index) => {
      const questionElement = section.querySelector('h2');
      if (!questionElement) {
        return;
      }
      const questionText = questionElement.innerText.trim();
      let answerHtml = '';

      const editableElement = section.querySelector('.editable');
      const checkboxGroup = section.querySelector('.checkbox-group');

      if (editableElement) {
        answerHtml = cleanHTML(editableElement.innerHTML);
      } else if (checkboxGroup) {
        const selectedExtras = [];
        checkboxGroup.querySelectorAll('input[type="checkbox"][name="extras"]:checked').forEach(checkbox => {
          selectedExtras.push(checkbox.value);
        });

        const otherInput = checkboxGroup.querySelector('input[type="text"][name="extraOther"]');
        const otherText = otherInput ? otherInput.value.trim() : '';

        if (otherText) {
          selectedExtras.push(`Інше: ${otherText}`);
        }

        if (selectedExtras.length > 0) {
          answerHtml = selectedExtras.map(item => `- ${item}`).join('<br>');
        } else {
          answerHtml = '(Нічого не вибрано)';
        }
      } else {
        answerHtml = '(Відповідь не надана або поле не розпізнано)';
      }

      briefItems.push({
        question: questionText,
        answer: answerHtml
      });
    });

    const dataToSend = {
      projectTitle: projectTitle,
      language: lang,
      briefType: type,
      briefItems: briefItems
    };

    const response = await fetch('/generate-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSend)
    });

    const data = await response.json();

    if (response.ok && data.success && data.link) {
      const resultBlock = document.getElementById('result');
      const linkOutput = document.getElementById('linkOutput');

      if (resultBlock && linkOutput) {
        resultBlock.style.display = 'block';
        linkOutput.textContent = data.link;
        const copyButton = resultBlock.querySelector('.copybtn');
        if (copyButton) copyButton.onclick = () => copyLinkManually();
      }

      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(data.link);
          showToast();
        } catch (err) {}
      }

      saveBriefToLocalStorage();
    } else {
      const errorMsg = data?.message || `Server responded with status ${response.status}`;
      alert(`Ошибка при генерации ссылки: ${errorMsg}`);
    }

  } catch (err) {
    alert('Произошла ошибка при обработке запроса: ' + err.message);
  } finally {
    button.classList.remove('loading');
    button.disabled = false;
  }
}

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
  void toast.offsetHeight;
  toast.style.animation = null;
  setTimeout(() => { toast.style.display = 'none'; }, 2500);
}

function copyLinkManually() {
  const linkElement = document.getElementById('linkOutput');
  const link = linkElement?.textContent;

  if (link && navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(link)
      .then(() => showToast())
      .catch(err => {
        alert('Не удалось скопировать ссылку.');
      });
  } else if (link) {
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
  }
}

const LOCAL_STORAGE_KEY = 'briefSaves_v2';
const MAX_SAVES = 10;

function saveBriefToLocalStorage() {
  const { lang, type } = detectBriefInfoFromPath();
  if (!type) {
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
      const rawAnswerHtml = answerElement.innerHTML.trim();
      briefItems.push({ question: question, answer: rawAnswerHtml });

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
  renderSavedBriefsList();
}

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
    if (!entry?.timestamp || !entry.preview || !entry.data) return;

    const li = document.createElement('li');
    li.dataset.index = index;

    let displayTimestamp = entry.timestamp;
    try {
      displayTimestamp = new Date(entry.timestamp).toLocaleString(lang + '-' + lang.toUpperCase(), { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {}

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

  if (listEl._briefListListener) {
    listEl.removeEventListener('click', listEl._briefListListener);
  }

  listEl._briefListListener = function(event) {
    const target = event.target;
    const indexStr = target.dataset.index;
    if (indexStr === undefined) return;

    const index = parseInt(indexStr, 10);
    if (isNaN(index)) return;

    if (target.classList.contains('load-saved-btn')) {
      event.stopPropagation();
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

function loadSavedBrief(index) {
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

  const titleInput = document.getElementById('projectTitle');
  if (titleInput) titleInput.value = save.projectTitle || '';

  const currentEditableBlocks = document.querySelectorAll('.brief-content .editable');
  if (!currentEditableBlocks || currentEditableBlocks.length === 0) {
    console.error("No '.editable' fields found on the current page to load data into.");
    alert("Ошибка: Не удалось найти поля для загрузки данных.");
    return;
  }

  save.data.forEach((savedItem, i) => {
    if (currentEditableBlocks[i]) {
      currentEditableBlocks[i].innerHTML = (typeof savedItem.answer === 'string' ? savedItem.answer : '');
    } else {
      console.warn(`Saved brief has more items (${save.data.length}) than current page (${currentEditableBlocks.length}). Skipping item ${i}.`);
    }
  });

  for (let i = save.data.length; i < currentEditableBlocks.length; i++) {
    currentEditableBlocks[i].innerHTML = '';
  }

  window.scrollTo(0, 0);
  showToast(getLoadSuccessMessage(getCurrentLang()));
}

function getLoadSuccessMessage(lang) {
  const messages = { ru: 'Сохранение загружено!', ua: 'Збереження завантажено!', en: 'Saved brief loaded!' };
  return messages[lang] || messages['ru'];
}

function deleteSavedBrief(index) {
  let saves = [];
  try {
    saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    if (!Array.isArray(saves)) saves = [];
  } catch (e) { console.error("Error parsing saves for deletion:", e); return; }

  if (index >= 0 && index < saves.length) {
    saves.splice(index, 1);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saves));
    renderSavedBriefsList();
  } else {
    console.error("Invalid index for deletion:", index);
  }
}

function restoreLastSavedBrief() {
  let saves = [];
  try {
    saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    if (!Array.isArray(saves)) saves = [];
  } catch (e) { console.warn("Could not parse saves for restore:", e); return; }

  if (saves.length > 0) {
    loadSavedBrief(0);
  }
function restoreLastSavedBrief() {
  let saves = [];
  try {
    saves = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    if (!Array.isArray(saves)) saves = [];
  } catch (e) { return; }

  if (saves.length > 0) {
    loadSavedBrief(0);
  }
}

function initializeLangSwitcher() {
  const langBtn = document.querySelector('.lang-btn');
  const dropdown = document.querySelector('.lang-dropdown');

  if (!langBtn || !dropdown) {
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
      if (e.target.tagName === 'A') {
        dropdown.classList.remove('open');
      }
    });
  }
}

function updateActiveLanguageLink() {
  const { lang, type } = detectBriefInfoFromPath();
  if (!lang || !type) {
    return;
  }

  const currentPathForComparison = `/${type}/${lang}`;
  const langLinks = document.querySelectorAll('.lang-menu a');

  langLinks.forEach(link => {
    link.classList.remove('active-lang');
    try {
      const linkUrl = new URL(link.href, window.location.origin);
      let linkPathForComparison = linkUrl.pathname.toLowerCase();
      if (linkPathForComparison.endsWith('.html')) {
        linkPathForComparison = linkPathForComparison.slice(0, -5);
      }
      if (linkPathForComparison.endsWith('/')) {
        linkPathForComparison = linkPathForComparison.slice(0, -1);
      }

      if (linkPathForComparison === currentPathForComparison) {
        link.classList.add('active-lang');
      }
    } catch (e) {}
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

function initTooltips() {
  const tooltipTriggers = document.querySelectorAll('.tooltip-trigger');

  tooltipTriggers.forEach(trigger => {
    const tooltipContent = trigger.querySelector('.tooltip-content');
    if (!tooltipContent) {
      return;
    }

    trigger._isTooltipOpenByClick = false;

    function applyTooltipPosition() {
      tooltipContent.classList.remove('position-top', 'position-bottom', 'position-left', 'position-right');
      const triggerRect = trigger.getBoundingClientRect();

      const prevVisibility = tooltipContent.style.visibility;
      const prevOpacity = tooltipContent.style.opacity;
      tooltipContent.style.visibility = 'visible';
      tooltipContent.style.opacity = '0';

      const tooltipRect = tooltipContent.getBoundingClientRect();

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
    }

    const showTooltip = () => {
      closeAllOtherTooltips(trigger);
      applyTooltipPosition();
      tooltipContent.classList.add('tooltip-visible');
      trigger._isTooltipOpenByClick = true;
      tooltipContent.style.visibility = 'visible';
      tooltipContent.style.opacity = '1';
    };

    const hideTooltip = () => {
      tooltipContent.classList.remove('tooltip-visible');
      trigger._isTooltipOpenByClick = false;
      tooltipContent.style.visibility = '';
      tooltipContent.style.opacity = '';
    };

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      trigger.addEventListener('mouseenter', () => {
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

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      if (trigger._isTooltipOpenByClick) {
        hideTooltip();
      } else {
        showTooltip();
      }
    });
  });

  document.addEventListener('click', function(event) {
    document.querySelectorAll('.tooltip-trigger').forEach(trigger => {
      const tooltipContent = trigger.querySelector('.tooltip-content');
      if (trigger._isTooltipOpenByClick && tooltipContent && tooltipContent.classList.contains('tooltip-visible')) {
        if (!trigger.contains(event.target) && !tooltipContent.contains(event.target)) {
          tooltipContent.classList.remove('tooltip-visible');
          trigger._isTooltipOpenByClick = false;
          tooltipContent.style.visibility = '';
          tooltipContent.style.opacity = '';
        }
      }
    });
  });
}

function closeAllOtherTooltips(currentTrigger) {
  document.querySelectorAll('.tooltip-trigger').forEach(trigger => {
    if (trigger !== currentTrigger) {
      if (trigger._isTooltipOpenByClick) {
        const tooltipContent = trigger.querySelector('.tooltip-content');
        if (tooltipContent) {
          tooltipContent.classList.remove('tooltip-visible');
          trigger._isTooltipOpenByClick = false;
          tooltipContent.style.visibility = '';
          tooltipContent.style.opacity = '';
        }
      }
    }
  });
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
}

const showTooltip = () => {
  closeAllOtherTooltips(trigger);
  applyTooltipPosition();
  tooltipContent.classList.add('tooltip-visible');
  trigger._isTooltipOpenByClick = true;
  tooltipContent.style.visibility = 'visible';
  tooltipContent.style.opacity = '1';
};

const hideTooltip = () => {
  tooltipContent.classList.remove('tooltip-visible');
  trigger._isTooltipOpenByClick = false;
  tooltipContent.style.visibility = '';
  tooltipContent.style.opacity = '';
};

if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  trigger.addEventListener('mouseenter', () => {
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

trigger.addEventListener('click', (event) => {
  event.stopPropagation();
  if (trigger._isTooltipOpenByClick) {
    hideTooltip();
  } else {
    showTooltip();
  }
});

document.addEventListener('click', function(event) {
  document.querySelectorAll('.tooltip-trigger').forEach(trigger => {
    const tooltipContent = trigger.querySelector('.tooltip-content');
    if (trigger._isTooltipOpenByClick && tooltipContent && tooltipContent.classList.contains('tooltip-visible')) {
      if (!trigger.contains(event.target) && !tooltipContent.contains(event.target)) {
        tooltipContent.classList.remove('tooltip-visible');
        trigger._isTooltipOpenByClick = false;
        tooltipContent.style.visibility = '';
        tooltipContent.style.opacity = '';
      }
    }
  });
});

function closeAllOtherTooltips(currentTrigger) {
  document.querySelectorAll('.tooltip-trigger').forEach(trigger => {
    if (trigger !== currentTrigger) {
      if (trigger._isTooltipOpenByClick) {
        const tooltipContent = trigger.querySelector('.tooltip-content');
        if (tooltipContent) {
          tooltipContent.classList.remove('tooltip-visible');
          trigger._isTooltipOpenByClick = false;
          tooltipContent.style.visibility = '';
          tooltipContent.style.opacity = '';
        }
      }
    }
  });
}
