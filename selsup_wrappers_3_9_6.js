// ==UserScript==
// @name         SelSup HTML Wrappers
// @namespace    selsup-html-wrappers
// @version      3.9.6
// @description  Add SelSup HTML wrapper controls into WordPress Classic Editor and Gutenberg
// @match        https://selsup.ru/wp-admin/*
// @match        https://www.selsup.ru/wp-admin/*
// @include      /^https:\/\/selsup\.ru\/wp-admin\/post\.php.*$/
// @include      /^https:\/\/selsup\.ru\/wp-admin\/post-new\.php.*$/
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // CHANGE 3.9: включите true, чтобы получить подробный лог по Gutenberg/TinyMCE/textarea.
  // CHANGE 3.9: убран постоянный setInterval. Toolbar обновляется через MutationObserver только если он пропал/переехал, а layout пересчитывается через ResizeObserver/resize.
  // CHANGE 3.9: Gutenberg-toolbar сворачивает разделы по одному в More ↓, и только если места совсем мало, сворачивается в SelSup ▾.
  // CHANGE 3.9.1: More ↓ теперь показывает только реально скрытые разделы, layout пересчитывается сразу перед открытием More и реагирует на resize/sidebar/header changes без setInterval.
  // CHANGE 3.9.3: убраны частые layout-пересчёты от body/document ResizeObserver и общего MutationObserver.
  // CHANGE 3.9.3: доступная ширина больше не ограничивается shrink-wrapped parent, чтобы toolbar мог разворачиваться обратно.
  // CHANGE 3.9.4: ширина Gutenberg-toolbar считается в его левом слоте и ограничивается max-width, чтобы он не выталкивал editor-header__center.
  // CHANGE 3.9.4: layout больше не пересчитывается от обычных кликов и внутренних transitionend WordPress, только от реальных изменений ширины/zoom и восстановления toolbar.
  // CHANGE 3.9.4: выровнены select и кнопки в inline-toolbar по центру.
  // CHANGE 3.9.5: тот же адаптивный toolbar добавлен в Classic Editor. Он сворачивает разделы в More ↓, затем в SelSup ▾, чтобы не залезать в правую колонку публикации.
  const SELSUP_DEBUG = false;
  const LOG_PREFIX = "[SelSup HTML Wrappers]";

  function debugLog() {
    if (!SELSUP_DEBUG) return;
    console.log.apply(console, [LOG_PREFIX].concat(Array.from(arguments)));
  }

  function debugWarn() {
    if (!SELSUP_DEBUG) return;
    console.warn.apply(console, [LOG_PREFIX].concat(Array.from(arguments)));
  }

  function debugError() {
    if (!SELSUP_DEBUG) return;
    console.error.apply(console, [LOG_PREFIX].concat(Array.from(arguments)));
  }

  console.log(LOG_PREFIX, "loaded");

  const textColorStyles = {
    info: "color: #00a6e7;",
    warning: "color: #b36b00;",
    success: "color: #188038;",
    danger: "color: #d93025;",
  };

  const titleColorStyles = {
    info: "color: #00a6e7; font-weight: 600;",
    warning: "color: #b36b00; font-weight: 600;",
    success: "color: #188038; font-weight: 600;",
    danger: "color: #d93025; font-weight: 600;",
    step: "color: #00a6e7; font-weight: 700;",
  };

  const weightStyles = {
    normal: "font-weight: 400;",
    medium: "font-weight: 500;",
    semibold: "font-weight: 600;",
    bold: "font-weight: 700;",
  };

  const inlineColorFormatMap = {
    info: "selsup/text-color-info",
    warning: "selsup/text-color-warning",
    success: "selsup/text-color-success",
    danger: "selsup/text-color-danger",
  };

  const inlineWeightFormatMap = {
    normal: "selsup/text-weight-normal",
    medium: "selsup/text-weight-medium",
    semibold: "selsup/text-weight-semibold",
    bold: "selsup/text-weight-bold",
  };

  const inlineColorClassMap = {
    info: "selsup-text-color-info",
    warning: "selsup-text-color-warning",
    success: "selsup-text-color-success",
    danger: "selsup-text-color-danger",
  };

  const inlineWeightClassMap = {
    normal: "selsup-text-weight-normal",
    medium: "selsup-text-weight-medium",
    semibold: "selsup-text-weight-semibold",
    bold: "selsup-text-weight-bold",
  };

  const legacyInlineColorClassMap = {
    info: "ss-text-info",
    warning: "ss-text-warning",
    success: "ss-text-success",
    danger: "ss-text-danger",
  };

  function normalizedCssText(cssText) {
    return String(cssText || "")
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function getMapKeyByClass(element, map) {
    if (!element || !element.classList) return null;

    return (
      Object.keys(map).find(function (key) {
        return element.classList.contains(map[key]);
      }) || null
    );
  }

  function getColorKeyFromElement(element) {
    if (!element || element.nodeType !== 1) return null;

    const dataColor = element.getAttribute("data-selsup-color");

    if (dataColor && textColorStyles[dataColor]) return dataColor;

    const classColor =
      getMapKeyByClass(element, inlineColorClassMap) ||
      getMapKeyByClass(element, legacyInlineColorClassMap);

    if (classColor) return classColor;

    const css = normalizedCssText(element.getAttribute("style"));

    if (css.includes("color:#00a6e7")) return "info";
    if (css.includes("color:#b36b00")) return "warning";
    if (css.includes("color:#188038")) return "success";
    if (css.includes("color:#d93025")) return "danger";

    return null;
  }

  function getWeightKeyFromElement(element) {
    if (!element || element.nodeType !== 1) return null;

    const dataWeight = element.getAttribute("data-selsup-weight");

    if (dataWeight && weightStyles[dataWeight]) return dataWeight;

    const classWeight = getMapKeyByClass(element, inlineWeightClassMap);

    if (classWeight) return classWeight;

    const css = normalizedCssText(element.getAttribute("style"));

    if (css.includes("font-weight:400")) return "normal";
    if (css.includes("font-weight:500")) return "medium";
    if (css.includes("font-weight:600")) return "semibold";
    if (css.includes("font-weight:700")) return "bold";

    return null;
  }

  function isSelSupInlineFormattingElement(element) {
    if (!element || element.nodeType !== 1 || element.tagName !== "SPAN") {
      return false;
    }

    return !!(
      getColorKeyFromElement(element) || getWeightKeyFromElement(element)
    );
  }

  const inlineFormattingTags = [
    "span",
    "font",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "mark",
    "small",
    "sub",
    "sup",
    "code",
  ];

  const inlineFormattingSelector = inlineFormattingTags.join(",");

  const gutenbergFormatsToClear = [
    "core/bold",
    "core/italic",
    "core/strikethrough",
    "core/underline",
    "core/code",
    "core/subscript",
    "core/superscript",
    "core/text-color",
    "core/highlight",
    "core/background-color",
    inlineColorFormatMap.info,
    inlineColorFormatMap.warning,
    inlineColorFormatMap.success,
    inlineColorFormatMap.danger,
    inlineWeightFormatMap.normal,
    inlineWeightFormatMap.medium,
    inlineWeightFormatMap.semibold,
    inlineWeightFormatMap.bold,
  ];

  const editorCss = `
    hr.wp-block-separator.hr-soft-dot,
    .wp-block-separator.hr-soft-dot {
      display: block !important;
      clear: both !important;
      border: 0 !important;
      border-top: 0 !important;
      border-bottom: 0 !important;
      min-height: 0 !important;
      height: 1px !important;
      width: 60% !important;
      max-width: 60% !important;
      margin: 28px auto !important;
      padding: 0 !important;
      background: rgba(0, 166, 231, 0.45) !important;
      background-color: rgba(0, 166, 231, 0.45) !important;
      color: transparent !important;
      opacity: 1 !important;
      position: relative !important;
      overflow: visible !important;
      box-sizing: border-box !important;
    }

    hr.wp-block-separator.hr-soft-dot::before,
    .wp-block-separator.hr-soft-dot::before {
      content: none !important;
      display: none !important;
    }

    hr.wp-block-separator.hr-soft-dot::after,
    .wp-block-separator.hr-soft-dot::after {
      content: "" !important;
      display: block !important;
      width: 6px !important;
      height: 6px !important;
      background: #00a6e7 !important;
      border-radius: 50% !important;
      position: absolute !important;
      left: 50% !important;
      top: 50% !important;
      transform: translate(-50%, -50%) !important;
    }

    hr.wp-block-separator.hr-section,
    .wp-block-separator.hr-section {
      display: block !important;
      clear: both !important;
      border: 0 !important;
      border-top: 0 !important;
      border-bottom: 0 !important;
      min-height: 0 !important;
      height: 1px !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 24px 0 !important;
      padding: 0 !important;
      background: rgba(0, 166, 231, 0.22) !important;
      background-color: rgba(0, 166, 231, 0.22) !important;
      color: transparent !important;
      opacity: 1 !important;
      position: relative !important;
      overflow: visible !important;
      box-sizing: border-box !important;
    }

    hr.wp-block-separator.hr-section::before,
    hr.wp-block-separator.hr-section::after,
    .wp-block-separator.hr-section::before,
    .wp-block-separator.hr-section::after {
      content: none !important;
      display: none !important;
    }

    .temporary-hidden {
      display: block !important;
      padding: 12px 16px;
      margin: 12px 0;
      border-radius: 4px;
      border: 1px dashed #999;
      background: #f5f5f5;
      color: #555;
      position: relative;
      box-sizing: border-box;
    }

    .temporary-hidden::before {
      content: "Скрытый блок, не публикуется";
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #777;
    }

    .ss-note {
      padding: 12px 16px;
      margin: 12px 0;
      border-radius: 4px;
      border-left: 4px solid transparent;
      box-sizing: border-box;
    }

    .ss-note-info {
      background: #eef9ff;
      border-left-color: #00a6e7;
    }

    .ss-note-warning {
      background: #fff8e5;
      border-left-color: #f0ad00;
    }

    .ss-note-success {
      background: #edf9f0;
      border-left-color: #34a853;
    }

    .ss-note-danger {
      background: #fff0f0;
      border-left-color: #e53935;
    }

    .ss-step {
      padding: 14px 16px;
      margin: 14px 0;
      border: 1px solid #d9e2ec;
      border-radius: 6px;
      background: #ffffff;
      box-sizing: border-box;
    }

    .ss-faq {
      padding: 12px 16px;
      margin: 12px 0;
      border: 1px solid #d9e2ec;
      border-radius: 6px;
      background: #f8fafc;
      box-sizing: border-box;
    }

    .ss-faq summary {
      cursor: pointer;
      font-weight: 600;
      margin-bottom: 10px;
    }

    .ss-note > :first-child,
    .ss-step > :first-child,
    .ss-faq > :first-child,
    .temporary-hidden > :first-child,
    .ss-note > .wp-block-group__inner-container > :first-child,
    .ss-step > .wp-block-group__inner-container > :first-child,
    .ss-faq > .wp-block-group__inner-container > :first-child,
    .temporary-hidden > .wp-block-group__inner-container > :first-child {
      margin-top: 0 !important;
    }

    .ss-note > :last-child,
    .ss-step > :last-child,
    .ss-faq > :last-child,
    .temporary-hidden > :last-child,
    .ss-note > .wp-block-group__inner-container > :last-child,
    .ss-step > .wp-block-group__inner-container > :last-child,
    .ss-faq > .wp-block-group__inner-container > :last-child,
    .temporary-hidden > .wp-block-group__inner-container > :last-child {
      margin-bottom: 0 !important;
    }

    .ss-note p,
    .ss-step p,
    .ss-faq p,
    .temporary-hidden p,
    .ss-note .wp-block-group__inner-container p,
    .ss-step .wp-block-group__inner-container p,
    .ss-faq .wp-block-group__inner-container p,
    .temporary-hidden .wp-block-group__inner-container p {
      margin: 0 0 10px;
    }

    .ss-note ul,
    .ss-step ul,
    .ss-faq ul,
    .temporary-hidden ul {
      margin: 0 0 10px 1.25em;
      padding: 0;
    }

    .ss-note ol,
    .ss-step ol,
    .ss-faq ol,
    .temporary-hidden ol {
      margin: 0 0 10px 1.25em;
      padding-left: 1.25em;
    }

    .ss-note li,
    .ss-step li,
    .ss-faq li,
    .temporary-hidden li {
      margin: 4px 0;
    }

    .code-block-wrapper {
      background: #f5f7fa;
      border: 1px solid #d9e2ec;
      border-radius: 6px;
      padding: 12px 14px;
      margin: 8px 0 16px;
      font-family: monospace;
      font-size: 15px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: normal;
      box-sizing: border-box;
    }

    .ss-faq img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 12px 0;
      border-radius: 6px;
      border: 1px solid #d9e2ec;
    }
  `;

  const adminCss = `
    #selsup-wrapper-toolbar {
      max-width: 100%;
    }

    /* CHANGE 3.9.4: выравниваем select и кнопки в одну линию.
       У WordPress и браузера разные дефолтные line-height/margin для select и button. */
    #selsup-wrapper-toolbar .selsup-toolbar-group {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 32px;
      line-height: 1;
      white-space: nowrap;
    }

    #selsup-wrapper-toolbar select,
    #selsup-wrapper-toolbar button {
      align-self: center !important;
      box-sizing: border-box !important;
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      vertical-align: middle !important;
    }

    #selsup-wrapper-toolbar button.components-button,
    #selsup-wrapper-toolbar .components-button {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    #selsup-wrapper-toolbar.selsup-gutenberg-adaptive-toolbar,
    #selsup-wrapper-toolbar.selsup-classic-adaptive-toolbar {
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      flex-wrap: nowrap !important;
    }

    #selsup-wrapper-toolbar .selsup-gutenberg-inline-controls,
    #selsup-wrapper-toolbar .selsup-gutenberg-more-controls,
    #selsup-wrapper-toolbar .selsup-gutenberg-collapsed-controls {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      flex-wrap: nowrap;
      white-space: nowrap;
    }

    #selsup-wrapper-toolbar .selsup-gutenberg-inline-controls[hidden],
    #selsup-wrapper-toolbar .selsup-gutenberg-more-controls[hidden],
    #selsup-wrapper-toolbar .selsup-gutenberg-collapsed-controls[hidden],
    #selsup-wrapper-toolbar [data-selsup-group][hidden] {
      display: none !important;
    }

    #selsup-wrapper-toolbar.selsup-gutenberg-adaptive-toolbar select,
    #selsup-wrapper-toolbar.selsup-classic-adaptive-toolbar select {
      height: 30px;
      max-width: 160px;
      font-size: 13px;
    }

    #selsup-wrapper-panel,
    #selsup-wrapper-more-panel {
      position: fixed;
      top: 74px;
      right: 24px;
      z-index: 2147483647;
      width: min(560px, calc(100vw - 48px));
      max-height: calc(100vh - 110px);
      overflow: auto;
      padding: 12px;
      border: 1px solid #c3c4c7;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.22);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-sizing: border-box;
    }

    #selsup-wrapper-panel[hidden],
    #selsup-wrapper-more-panel[hidden] {
      display: none !important;
    }

    #selsup-wrapper-panel .selsup-panel-header,
    #selsup-wrapper-more-panel .selsup-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #dcdcde;
      font-weight: 600;
    }

    #selsup-wrapper-panel .selsup-panel-close,
    #selsup-wrapper-more-panel .selsup-panel-close {
      border: 0;
      background: transparent;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      padding: 0 4px;
    }

    #selsup-wrapper-panel .selsup-panel-row,
    #selsup-wrapper-more-panel .selsup-panel-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin: 8px 0;
    }

    #selsup-wrapper-panel .selsup-panel-label,
    #selsup-wrapper-more-panel .selsup-panel-label {
      min-width: 76px;
      font-size: 12px;
      font-weight: 600;
      color: #50575e;
    }

    #selsup-wrapper-panel select,
    #selsup-wrapper-more-panel select {
      height: 30px;
      max-width: 180px;
      font-size: 13px;
    }

    #selsup-wrapper-panel button,
    #selsup-wrapper-more-panel button {
      white-space: nowrap;
    }

    @media (max-width: 782px) {
      #selsup-wrapper-panel,
      #selsup-wrapper-more-panel {
        top: 58px;
        right: 12px;
        left: 12px;
        width: auto;
        max-height: calc(100vh - 82px);
      }
    }
  `;

  const wrappers = [
    {
      label: "Blue info block",
      shortLabel: "Info block",
      kind: "note",
      group: "block",
      title: "Важно:",
      titleStyle: titleColorStyles.info,
      className: "ss-note ss-note-info",
    },
    {
      label: "Orange warning block",
      shortLabel: "Warning block",
      kind: "note",
      group: "block",
      title: "Обратите внимание:",
      titleStyle: titleColorStyles.warning,
      className: "ss-note ss-note-warning",
    },
    {
      label: "Green success block",
      shortLabel: "Success block",
      kind: "note",
      group: "block",
      title: "Готово:",
      titleStyle: titleColorStyles.success,
      className: "ss-note ss-note-success",
    },
    {
      label: "Red danger block",
      shortLabel: "Danger block",
      kind: "note",
      group: "block",
      title: "Ошибка:",
      titleStyle: titleColorStyles.danger,
      className: "ss-note ss-note-danger",
    },
    {
      label: "Grey code block",
      shortLabel: "Code block",
      kind: "plain-wrapper",
      group: "block",
      className: "code-block-wrapper",
    },
    {
      label: "Step block",
      shortLabel: "Step block",
      kind: "step",
      group: "block",
      title: "Шаг 1.",
      titleStyle: titleColorStyles.step,
      className: "ss-step",
    },
    {
      label: "FAQ spoiler",
      shortLabel: "FAQ spoiler",
      kind: "faq",
      group: "block",
      className: "ss-faq",
      summary: "Частый вопрос",
      defaultBody:
        "Здесь можно разместить ответ, который будет скрыт до раскрытия блока.",
    },
    {
      label: "Hidden block",
      shortLabel: "Hidden block",
      kind: "plain-wrapper",
      group: "block",
      className: "temporary-hidden",
    },
    {
      label: "Blue-dot separator",
      shortLabel: "Soft line",
      kind: "separator",
      group: "line",
      className: "hr-soft-dot",
      insertOnly: true,
      htmlContent: '<hr class="wp-block-separator hr-soft-dot" />',
    },
    {
      label: "Section separator",
      shortLabel: "Section line",
      kind: "separator",
      group: "line",
      className: "hr-section",
      insertOnly: true,
      htmlContent: '<hr class="wp-block-separator hr-section" />',
    },
    {
      label: "Blue text",
      shortLabel: "Blue",
      kind: "inline-color",
      group: "text-color",
      colorKey: "info",
      style: textColorStyles.info,
    },
    {
      label: "Orange text",
      shortLabel: "Orange",
      kind: "inline-color",
      group: "text-color",
      colorKey: "warning",
      style: textColorStyles.warning,
    },
    {
      label: "Green text",
      shortLabel: "Green",
      kind: "inline-color",
      group: "text-color",
      colorKey: "success",
      style: textColorStyles.success,
    },
    {
      label: "Red text",
      shortLabel: "Red",
      kind: "inline-color",
      group: "text-color",
      colorKey: "danger",
      style: textColorStyles.danger,
    },
    {
      label: "Normal weight",
      shortLabel: "Normal",
      kind: "inline-weight",
      group: "text-weight",
      weightKey: "normal",
      style: weightStyles.normal,
    },
    {
      label: "Medium weight",
      shortLabel: "Medium",
      kind: "inline-weight",
      group: "text-weight",
      weightKey: "medium",
      style: weightStyles.medium,
    },
    {
      label: "Semi-bold weight",
      shortLabel: "Semi-bold",
      kind: "inline-weight",
      group: "text-weight",
      weightKey: "semibold",
      style: weightStyles.semibold,
    },
    {
      label: "Bold weight",
      shortLabel: "Bold",
      kind: "inline-weight",
      group: "text-weight",
      weightKey: "bold",
      style: weightStyles.bold,
    },
    {
      label: "Clear formatting",
      kind: "clear-formatting",
      group: "clear",
    },
  ];

  let lastTextInput = null;
  let tinyMceListenerAttached = false;
  let toolbarObserver = null;
  let gutenbergFormatsRegistered = false;
  const observedDocs = new WeakSet();
  let lastGutenbergSelectionInfo = null;
  let lastGutenbergSelectionInfoTime = 0;
  let toolbarSelectionLockUntil = 0;
  let lastGutenbergSelectedBlockIds = [];
  let selsupToolbarRefreshTimer = null;
  let selsupAdaptiveToolbarTimer = null;
  let selsupDevicePixelRatioMediaQuery = null;
  let selsupLastKnownDevicePixelRatio = window.devicePixelRatio || 1;
  let selsupLastAdaptiveLayoutSignature = "";
  let selsupAdaptiveLayoutInProgress = false;

  const GUTENBERG_STORED_TEXT_SELECTION_MAX_AGE_MS = 15000;
  const GUTENBERG_TOOLBAR_SELECTION_LOCK_MS = 2500;

  // CHANGE 3.9.5: порядок сворачивания разделов общий для Gutenberg и Classic toolbar.
  const GUTENBERG_COLLAPSE_ORDER = [
    "tools",
    "weight",
    "color",
    "lines",
    "quick",
    "blocks",
  ];

  function findWrapper(label) {
    return wrappers.find(function (wrapper) {
      return wrapper.label === label;
    });
  }

  function describeValue(value) {
    if (!SELSUP_DEBUG) return "";

    if (value === null) return "null";
    if (value === undefined) return "undefined";

    const type = typeof value;

    if (type === "string") {
      return {
        type: "string",
        length: value.length,
        preview: value.slice(0, 180),
      };
    }

    if (type !== "object") {
      return {
        type: type,
        value: value,
      };
    }

    let keys = [];

    try {
      keys = Object.keys(value).slice(0, 30);
    } catch (error) {}

    return {
      type: Object.prototype.toString.call(value),
      constructor: value.constructor?.name || "unknown",
      keys: keys,
      hasToHTMLString: typeof value.toHTMLString === "function",
      hasToString: typeof value.toString === "function",
    };
  }

  function isClassicEditorPage() {
    return !!(
      document.querySelector("#wp-content-wrap") ||
      document.querySelector("#content_ifr") ||
      document.querySelector("#postdivrich") ||
      document.querySelector("#wp-content-editor-tools") ||
      document.querySelector("#wp-content-media-buttons") ||
      document.querySelector(".wp-editor-wrap")
    );
  }

  function isGutenbergPage() {
    if (document.body.classList.contains("block-editor-page")) return true;
    if (isClassicEditorPage()) return false;

    return !!(
      document.querySelector(".block-editor") ||
      document.querySelector(".edit-post-layout") ||
      document.querySelector(".interface-interface-skeleton")
    );
  }

  function getEditorDocuments() {
    const docs = [document];

    document.querySelectorAll("iframe").forEach(function (iframe) {
      try {
        if (iframe.contentDocument && iframe.contentDocument.body) {
          docs.push(iframe.contentDocument);
        }
      } catch (error) {}
    });

    return docs;
  }

  function getWindowForElement(element) {
    return element?.ownerDocument?.defaultView || window;
  }

  function isVisible(element) {
    if (!element) return false;

    const view = getWindowForElement(element);
    const style = view.getComputedStyle(element);

    if (style.display === "none" || style.visibility === "hidden") return false;

    const rect = element.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  }

  function isTextInput(element) {
    return !!element && element.tagName === "TEXTAREA";
  }

  function rememberTextInput(element) {
    if (!isTextInput(element)) return;
    if (!isVisible(element)) return;

    lastTextInput = element;
    debugLog(
      "remember textarea",
      element.id || element.name || element.className,
    );
  }

  function observeEditorDocument(doc) {
    if (!doc || observedDocs.has(doc)) return;

    observedDocs.add(doc);

    doc.addEventListener(
      "focusin",
      function (event) {
        rememberTextInput(event.target);
      },
      true,
    );

    doc.addEventListener(
      "mouseup",
      function () {
        rememberTextInput(doc.activeElement);
      },
      true,
    );
  }

  function observeAllEditorDocuments() {
    getEditorDocuments().forEach(function (doc) {
      observeEditorDocument(doc);
      addCssToDocument(doc);
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function addCssToDocument(doc) {
    if (!doc || !doc.head || doc.getElementById("selsup-wrapper-editor-css"))
      return;

    const style = doc.createElement("style");
    style.id = "selsup-wrapper-editor-css";
    style.textContent = editorCss;

    doc.head.appendChild(style);
  }

  function addCssToAdminPage() {
    addCssToDocument(document);
  }

  function addAdminCss() {
    if (!document.head || document.getElementById("selsup-wrapper-admin-css"))
      return;

    const style = document.createElement("style");
    style.id = "selsup-wrapper-admin-css";
    style.textContent = adminCss;

    document.head.appendChild(style);
  }

  function addCssToTinyMce() {
    if (!window.tinymce) return;
    if (isGutenbergPage()) return;

    window.tinymce.editors.forEach(function (editor) {
      if (!editor || !editor.getDoc) return;
      addCssToDocument(editor.getDoc());
    });
  }

  function getActiveTextInput() {
    const docs = getEditorDocuments();

    for (const doc of docs) {
      const active = doc.activeElement;

      if (isTextInput(active) && isVisible(active)) {
        return active;
      }
    }

    if (
      lastTextInput &&
      lastTextInput.ownerDocument?.contains(lastTextInput) &&
      isVisible(lastTextInput)
    ) {
      return lastTextInput;
    }

    return null;
  }

  function getTitleHtml(wrapper) {
    return (
      '<p><strong style="' +
      wrapper.titleStyle +
      '">' +
      escapeHtml(wrapper.title) +
      "</strong></p>"
    );
  }

  function getRawParts(wrapper) {
    if (wrapper.insertOnly) {
      return {
        open: wrapper.htmlContent || "",
        close: "",
      };
    }

    if (wrapper.kind === "note" || wrapper.kind === "step") {
      return {
        open:
          '<div class="' +
          wrapper.className +
          '">\n' +
          getTitleHtml(wrapper) +
          "\n\n",
        close: "\n\n</div>",
      };
    }

    if (wrapper.kind === "faq") {
      return {
        open:
          '<details class="' +
          wrapper.className +
          '"><summary>' +
          escapeHtml(wrapper.summary) +
          "</summary>\n\n",
        close: "\n\n</details>",
      };
    }

    return {
      open: '<div class="' + wrapper.className + '">\n\n',
      close: "\n\n</div>",
    };
  }

  function composeInlineStyle(colorKey, weightKey) {
    const parts = [];

    if (colorKey && textColorStyles[colorKey]) {
      parts.push(textColorStyles[colorKey]);
    }

    if (weightKey && weightStyles[weightKey]) {
      parts.push(weightStyles[weightKey]);
    }

    return parts.join(" ").trim();
  }

  function getInlineStateFromAncestors(node, root) {
    let current = node && node.nodeType === 1 ? node : node?.parentNode;
    let colorKey = null;
    let weightKey = null;

    while (current && current !== root) {
      if (current.nodeType === 1) {
        if (!colorKey) {
          colorKey = getColorKeyFromElement(current);
        }

        if (!weightKey) {
          weightKey = getWeightKeyFromElement(current);
        }
      }

      current = current.parentNode;
    }

    return {
      colorKey: colorKey,
      weightKey: weightKey,
    };
  }

  function applyWrapperToState(state, wrapper) {
    const next = {
      colorKey: state.colorKey,
      weightKey: state.weightKey,
    };

    if (wrapper.kind === "inline-color") {
      next.colorKey = wrapper.colorKey;
    }

    if (wrapper.kind === "inline-weight") {
      next.weightKey = wrapper.weightKey;
    }

    return next;
  }

  function createInlineSpan(doc, text, state) {
    const style = composeInlineStyle(state.colorKey, state.weightKey);

    if (!style) {
      return doc.createTextNode(text);
    }

    const span = doc.createElement("span");

    if (state.colorKey) {
      span.setAttribute("data-selsup-color", state.colorKey);
      span.classList.add(
        inlineColorClassMap[state.colorKey] || "selsup-text-color",
      );
    }

    if (state.weightKey) {
      span.setAttribute("data-selsup-weight", state.weightKey);
      span.classList.add(
        inlineWeightClassMap[state.weightKey] || "selsup-text-weight",
      );
    }

    span.setAttribute("data-selsup-normalized", "1");
    span.setAttribute("style", style);
    span.textContent = text;

    return span;
  }

  function unwrapElementKeepingChildren(element) {
    const parent = element.parentNode;

    if (!parent) return;

    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }

    parent.removeChild(element);
  }

  function applyInlineStyleToTextNodes(root, wrapper) {
    if (!root) return;

    const doc = root.ownerDocument || document;
    const textNodes = [];
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || node.nodeValue.trim() === "") {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node;

    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    textNodes.forEach(function (textNode) {
      if (!textNode.parentNode) return;

      const currentState = getInlineStateFromAncestors(textNode, root);
      const nextState = applyWrapperToState(currentState, wrapper);
      const replacement = createInlineSpan(doc, textNode.nodeValue, nextState);

      textNode.parentNode.replaceChild(replacement, textNode);
    });

    normalizeSelSupInlineDom(root);
  }

  function normalizeSelSupInlineDom(root) {
    if (!root || !root.querySelectorAll) return;

    const textNodes = [];
    const doc = root.ownerDocument || document;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || node.nodeValue.trim() === "") {
          return NodeFilter.FILTER_REJECT;
        }

        const state = getInlineStateFromAncestors(node, root);

        if (!state.colorKey && !state.weightKey) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node;

    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    textNodes.forEach(function (textNode) {
      if (!textNode.parentNode) return;

      const state = getInlineStateFromAncestors(textNode, root);
      const replacement = createInlineSpan(doc, textNode.nodeValue, state);

      textNode.parentNode.replaceChild(replacement, textNode);
    });

    const oldSpans = Array.from(root.querySelectorAll("span"))
      .filter(isSelSupInlineFormattingElement)
      .reverse();

    oldSpans.forEach(function (span) {
      if (span.getAttribute("data-selsup-normalized") === "1") return;
      unwrapElementKeepingChildren(span);
    });

    Array.from(
      root.querySelectorAll('span[data-selsup-normalized="1"]'),
    ).forEach(function (span) {
      span.removeAttribute("data-selsup-normalized");
    });

    mergeAdjacentSelSupSpans(root);
  }

  function sameSelSupSpan(a, b) {
    if (!a || !b) return false;
    if (a.nodeType !== 1 || b.nodeType !== 1) return false;
    if (a.tagName !== "SPAN" || b.tagName !== "SPAN") return false;

    return (
      a.getAttribute("data-selsup-color") ===
        b.getAttribute("data-selsup-color") &&
      a.getAttribute("data-selsup-weight") ===
        b.getAttribute("data-selsup-weight") &&
      a.getAttribute("style") === b.getAttribute("style")
    );
  }

  function mergeAdjacentSelSupSpans(root) {
    if (!root || !root.querySelectorAll) return;

    let changed = true;

    while (changed) {
      changed = false;

      Array.from(
        root.querySelectorAll(
          "span[data-selsup-color], span[data-selsup-weight]",
        ),
      ).forEach(function (span) {
        const next = span.nextSibling;

        if (!sameSelSupSpan(span, next)) return;

        while (next.firstChild) {
          span.appendChild(next.firstChild);
        }

        next.remove();
        changed = true;
      });
    }
  }

  function applyInlineStyleToHtmlFragment(html, wrapper) {
    const doc = document.implementation.createHTMLDocument("");
    const container = doc.createElement("div");

    container.innerHTML = String(html || "");
    applyInlineStyleToTextNodes(container, wrapper);

    return container.innerHTML;
  }

  function normalizeSelSupInlineHtmlString(html) {
    const doc = document.implementation.createHTMLDocument("");
    const container = doc.createElement("div");

    container.innerHTML = String(html || "");
    normalizeSelSupInlineDom(container);

    return container.innerHTML;
  }

  function getInlineClassName(wrapper) {
    if (wrapper.kind === "inline-color")
      return inlineColorClassMap[wrapper.colorKey];
    if (wrapper.kind === "inline-weight")
      return inlineWeightClassMap[wrapper.weightKey];
    return "selsup-text-inline";
  }

  function getInlineStyleOpenTag(wrapper) {
    const className = getInlineClassName(wrapper);

    if (wrapper.kind === "inline-color") {
      return (
        '<span class="' +
        className +
        '" data-selsup-color="' +
        wrapper.colorKey +
        '" style="' +
        wrapper.style +
        '">'
      );
    }

    if (wrapper.kind === "inline-weight") {
      return (
        '<span class="' +
        className +
        '" data-selsup-weight="' +
        wrapper.weightKey +
        '" style="' +
        wrapper.style +
        '">'
      );
    }

    return '<span class="' + className + '" style="' + wrapper.style + '">';
  }

  function isSelSupSpanOpenTag(openTag) {
    const tag = String(openTag || "");

    if (!/^<span\b/i.test(tag)) return false;

    return (
      /data-selsup-(color|weight)=/i.test(tag) ||
      /class=["'][^"']*(selsup-text-color-|selsup-text-weight-|ss-text-info|ss-text-warning|ss-text-success|ss-text-danger)/i.test(
        tag,
      ) ||
      /style=["'][^"']*(color\s*:|font-weight\s*:)/i.test(tag)
    );
  }

  function findSelSupSpanRanges(html) {
    const ranges = [];
    const stack = [];
    const re = /<\/?span\b[^>]*>/gi;
    let match;

    while ((match = re.exec(html))) {
      const tag = match[0];

      if (/^<span\b/i.test(tag) && !/\/\s*>$/.test(tag)) {
        stack.push({
          openStart: match.index,
          openEnd: re.lastIndex,
          openTag: tag,
          isSelSup: isSelSupSpanOpenTag(tag),
        });
        continue;
      }

      if (/^<\/span\s*>/i.test(tag)) {
        const item = stack.pop();

        if (item && item.isSelSup) {
          item.closeStart = match.index;
          item.closeEnd = re.lastIndex;
          ranges.push(item);
        }
      }
    }

    return ranges;
  }

  function getOutermostContainingSelSupSpanRange(html, start, end) {
    const ranges = findSelSupSpanRanges(html).filter(function (range) {
      return range.openEnd <= start && range.closeStart >= end;
    });

    if (!ranges.length) return null;

    ranges.sort(function (a, b) {
      return a.openStart - b.openStart || b.closeEnd - a.closeEnd;
    });

    return ranges[0];
  }

  function applyInlineStyleToMarkedTextNodes(root, wrapper, markerId) {
    if (!root) return;

    const doc = root.ownerDocument || document;
    let insideSelection = false;

    function walk(node) {
      Array.from(node.childNodes).forEach(function (child) {
        if (
          child.nodeType === 1 &&
          child.getAttribute("data-selsup-range-marker") === markerId
        ) {
          if (child.hasAttribute("data-selsup-range-start")) {
            insideSelection = true;
          }

          if (child.hasAttribute("data-selsup-range-end")) {
            insideSelection = false;
          }

          child.remove();
          return;
        }

        if (child.nodeType === 3) {
          if (!child.nodeValue || child.nodeValue.trim() === "") return;

          const currentState = getInlineStateFromAncestors(child, root);
          const nextState = insideSelection
            ? applyWrapperToState(currentState, wrapper)
            : currentState;
          const replacement = createInlineSpan(doc, child.nodeValue, nextState);

          child.parentNode.replaceChild(replacement, child);
          return;
        }

        walk(child);
      });
    }

    walk(root);
    normalizeSelSupInlineDom(root);
  }

  function applyInlineStyleToHtmlRange(html, relStart, relEnd, wrapper) {
    const markerId =
      "selsup-range-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
    const startMarker =
      '<span data-selsup-range-marker="' +
      markerId +
      '" data-selsup-range-start="1"></span>';
    const endMarker =
      '<span data-selsup-range-marker="' +
      markerId +
      '" data-selsup-range-end="1"></span>';
    const doc = document.implementation.createHTMLDocument("");
    const container = doc.createElement("div");

    container.innerHTML =
      String(html || "").slice(0, relStart) +
      startMarker +
      String(html || "").slice(relStart, relEnd) +
      endMarker +
      String(html || "").slice(relEnd);

    applyInlineStyleToMarkedTextNodes(container, wrapper, markerId);

    return container.innerHTML;
  }

  function tryApplyInlineStyleInTextareaContext(
    element,
    wrapper,
    start,
    end,
    selected,
  ) {
    if (!selected) return false;
    if (/<[a-z/!][\s\S]*>/i.test(selected)) return false;

    const value = element.value || "";
    const range = getOutermostContainingSelSupSpanRange(value, start, end);

    if (!range) return false;

    const targetHtml = value.slice(range.openStart, range.closeEnd);
    const replacement = applyInlineStyleToHtmlRange(
      targetHtml,
      start - range.openStart,
      end - range.openStart,
      wrapper,
    );

    element.focus();
    element.setRangeText(
      replacement,
      range.openStart,
      range.closeEnd,
      "select",
    );
    element.selectionStart = range.openStart;
    element.selectionEnd = range.openStart + replacement.length;

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));

    debugLog("textarea inline context normalized", {
      wrapper: wrapper.label,
      original: targetHtml,
      replacement: replacement,
    });

    return true;
  }

  function insertIntoTextareaWithUndo(element, text, selectStart, selectEnd) {
    const doc = element.ownerDocument || document;

    element.focus();

    try {
      if (
        doc.activeElement === element &&
        doc.queryCommandSupported?.("insertText")
      ) {
        const success = doc.execCommand("insertText", false, text);

        if (success) {
          if (
            typeof selectStart === "number" &&
            typeof selectEnd === "number"
          ) {
            element.selectionStart = selectStart;
            element.selectionEnd = selectEnd;
          }

          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));

          return true;
        }
      }
    } catch (error) {}

    return false;
  }

  function wrapInTextarea(element, wrapper) {
    if (!isTextInput(element)) return false;
    if (!isVisible(element)) return false;

    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const value = element.value || "";
    const selected = value.substring(start, end);
    const parts = getRawParts(wrapper);

    const replacement = wrapper.insertOnly
      ? parts.open
      : parts.open + selected + parts.close;
    const innerStart = wrapper.insertOnly
      ? start + replacement.length
      : start + parts.open.length;
    const innerEnd = wrapper.insertOnly
      ? start + replacement.length
      : start + parts.open.length + selected.length;

    debugLog("wrap textarea", {
      wrapper: wrapper.label,
      start: start,
      end: end,
      selectedLength: selected.length,
    });

    element.focus();
    element.selectionStart = start;
    element.selectionEnd = end;

    if (
      insertIntoTextareaWithUndo(element, replacement, innerStart, innerEnd)
    ) {
      return true;
    }

    element.setRangeText(replacement, start, end, "select");
    element.focus();
    element.selectionStart = innerStart;
    element.selectionEnd = innerEnd;

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  function applyInlineStyleInTextarea(element, wrapper) {
    if (!isTextInput(element)) return false;
    if (!isVisible(element)) return false;

    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const value = element.value || "";
    const selected = value.substring(start, end) || "текст";

    if (
      start !== end &&
      tryApplyInlineStyleInTextareaContext(
        element,
        wrapper,
        start,
        end,
        selected,
      )
    ) {
      return true;
    }

    const openTag = getInlineStyleOpenTag(wrapper);
    const closeTag = "</span>";

    let replacement;

    if (/<[a-z][\s\S]*>/i.test(selected)) {
      replacement = applyInlineStyleToHtmlFragment(selected, wrapper);
    } else {
      replacement = openTag + selected + closeTag;
    }

    debugLog("inline textarea", {
      wrapper: wrapper.label,
      start: start,
      end: end,
      selectedLength: selected.length,
    });

    element.focus();
    element.selectionStart = start;
    element.selectionEnd = end;

    if (
      insertIntoTextareaWithUndo(
        element,
        replacement,
        start,
        start + replacement.length,
      )
    ) {
      return true;
    }

    element.setRangeText(replacement, start, end, "select");
    element.focus();
    element.selectionStart = start;
    element.selectionEnd = start + replacement.length;

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  function getTinyMceEditor() {
    if (!window.tinymce) return null;

    const active = window.tinymce.activeEditor;

    if (active && !active.isHidden()) return active;

    const contentEditor = window.tinymce.get("content");

    if (contentEditor && !contentEditor.isHidden()) return contentEditor;

    return null;
  }

  function selectedTextToHtml(text) {
    const normalized = String(text || "")
      .replace(/\r\n/g, "\n")
      .trim();

    if (!normalized) return "";

    return normalized
      .split(/\n{2,}/)
      .map(function (paragraph) {
        return "<p>" + escapeHtml(paragraph).replace(/\n/g, "<br />") + "</p>";
      })
      .join("\n");
  }

  function htmlLooksLikeBlock(html) {
    const trimmed = String(html || "").trim();

    return /^<(address|article|aside|blockquote|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|ul|details)\b/i.test(
      trimmed,
    );
  }

  function normalizeInnerHtml(selectedHtml, selectedText, markerId) {
    const html = String(selectedHtml || "").trim();

    if (html) {
      return htmlLooksLikeBlock(html) ? html : "<p>" + html + "</p>";
    }

    const textHtml = selectedTextToHtml(selectedText);

    if (textHtml) return textHtml;

    if (markerId) {
      return (
        '<p><span id="' + markerId + '" data-selsup-caret="1">\uFEFF</span></p>'
      );
    }

    return "<p></p>";
  }

  function buildTinyMceHtml(wrapper, innerHtml) {
    if (wrapper.insertOnly) return wrapper.htmlContent || "";

    if (wrapper.kind === "note" || wrapper.kind === "step") {
      return (
        '<div class="' +
        wrapper.className +
        '">' +
        getTitleHtml(wrapper) +
        innerHtml +
        "</div>"
      );
    }

    if (wrapper.kind === "faq") {
      const bodyHtml = innerHtml || wrapper.defaultBody;

      return (
        '<details class="' +
        wrapper.className +
        '">' +
        "<summary>" +
        escapeHtml(wrapper.summary) +
        "</summary>" +
        bodyHtml +
        "</details>"
      );
    }

    return '<div class="' + wrapper.className + '">' + innerHtml + "</div>";
  }

  function placeTinyMceCursorAtMarker(editor, markerId) {
    if (!markerId) return;

    const marker = editor.dom.get(markerId);

    if (!marker) return;

    const parent = marker.parentNode;

    if (!parent) return;

    const br = editor.getDoc().createElement("br");
    br.setAttribute("data-mce-bogus", "1");

    parent.replaceChild(br, marker);
    editor.selection.setCursorLocation(parent, 0);
  }

  function wrapInTinyMce(wrapper) {
    if (isGutenbergPage()) return false;

    const editor = getTinyMceEditor();

    if (!editor) return false;

    addCssToTinyMce();
    editor.focus();

    const markerId =
      "selsup-caret-" + Date.now() + "-" + Math.floor(Math.random() * 100000);

    debugLog("wrap tinymce", wrapper.label);

    editor.undoManager.transact(function () {
      if (wrapper.insertOnly) {
        editor.execCommand(
          "mceInsertContent",
          false,
          wrapper.htmlContent || "",
        );
        return;
      }

      const selectedHtml = editor.selection.getContent({ format: "html" });
      const selectedText = editor.selection.getContent({ format: "text" });
      const innerHtml = normalizeInnerHtml(
        selectedHtml,
        selectedText,
        markerId,
      );
      const html = buildTinyMceHtml(wrapper, innerHtml);

      editor.execCommand("mceInsertContent", false, html);
    });

    placeTinyMceCursorAtMarker(editor, markerId);
    editor.nodeChanged();
    editor.save();

    return true;
  }

  function isTinyMceSelectionCollapsed(editor) {
    const range = editor.selection.getRng?.();

    if (range) return range.collapsed;

    return !editor.selection.getContent({ format: "text" });
  }

  function applyInlineStyleInTinyMce(wrapper) {
    if (isGutenbergPage()) return false;

    const editor = getTinyMceEditor();

    if (!editor) return false;

    addCssToTinyMce();
    editor.focus();

    debugLog("inline tinymce", wrapper.label);

    editor.undoManager.transact(function () {
      const range = editor.selection.getRng?.();
      const isCollapsed = isTinyMceSelectionCollapsed(editor);

      if (!range || isCollapsed) {
        editor.insertContent(getInlineStyleOpenTag(wrapper) + "текст</span>");
        normalizeSelSupInlineDom(editor.getBody());
        return;
      }

      const fragment = range.extractContents();

      applyInlineStyleToTextNodes(fragment, wrapper);

      range.insertNode(fragment);
      normalizeSelSupInlineDom(editor.getBody());
    });

    editor.nodeChanged();
    editor.save();

    return true;
  }

  function getSelectionHtml(selection, doc) {
    if (!selection || selection.rangeCount === 0) return "";

    const container = doc.createElement("div");

    for (let i = 0; i < selection.rangeCount; i++) {
      container.appendChild(selection.getRangeAt(i).cloneContents());
    }

    return container.innerHTML;
  }

  function wrapInDocumentSelection(doc, wrapper) {
    if (isGutenbergPage()) return false;
    if (!doc || !doc.defaultView) return false;

    const selection = doc.defaultView.getSelection();

    if (!selection || selection.rangeCount === 0) return false;

    const selectedText = selection.toString();
    const selectedHtml = getSelectionHtml(selection, doc);
    const range = selection.getRangeAt(0);

    if (!wrapper.insertOnly && !selectedText && !selectedHtml) return false;

    const innerHtml = wrapper.insertOnly
      ? ""
      : normalizeInnerHtml(selectedHtml, selectedText, "");
    const html = wrapper.insertOnly
      ? wrapper.htmlContent || ""
      : buildTinyMceHtml(wrapper, innerHtml);

    try {
      const success = doc.execCommand("insertHTML", false, html);

      if (success) return true;
    } catch (error) {}

    const template = doc.createElement("template");
    template.innerHTML = html;

    range.deleteContents();
    range.insertNode(template.content.cloneNode(true));
    selection.removeAllRanges();

    return true;
  }

  function wrapInAnyDocumentSelection(wrapper) {
    if (isGutenbergPage()) return false;

    const docs = getEditorDocuments();

    for (const doc of docs) {
      if (wrapInDocumentSelection(doc, wrapper)) return true;
    }

    return false;
  }

  function isInlineStyleElement(element) {
    if (!element || !element.matches) return false;

    return element.matches(
      "span[data-selsup-color], span[data-selsup-weight], span.ss-text-info, span.ss-text-warning, span.ss-text-success, span.ss-text-danger",
    );
  }

  function isInlineFormattingElement(element) {
    if (!element || !element.matches) return false;

    return element.matches(inlineFormattingSelector);
  }

  function isSelSupBlockElement(element) {
    if (!element || !element.classList) return false;

    return (
      element.classList.contains("ss-note") ||
      element.classList.contains("ss-step") ||
      element.classList.contains("ss-faq") ||
      element.classList.contains("code-block-wrapper") ||
      element.classList.contains("temporary-hidden")
    );
  }

  function findDirectChildByClass(element, className) {
    if (!element || !element.children) return null;

    for (let i = 0; i < element.children.length; i++) {
      if (element.children[i].classList.contains(className)) {
        return element.children[i];
      }
    }

    return null;
  }

  function getContentSourceElement(element) {
    const innerContainer = findDirectChildByClass(
      element,
      "wp-block-group__inner-container",
    );

    return innerContainer || element;
  }

  function moveChildrenBefore(source, beforeElement) {
    const parent = beforeElement.parentNode;

    while (source.firstChild) {
      parent.insertBefore(source.firstChild, beforeElement);
    }
  }

  function unwrapLegacyBodyIfNeeded(element, bodyClassName) {
    const parent = element.parentNode;
    const body = findDirectChildByClass(element, bodyClassName);

    if (!parent || !body) return false;

    Array.from(element.childNodes).forEach(function (child) {
      if (child === body) {
        const source = getContentSourceElement(body);
        moveChildrenBefore(source, element);
        return;
      }

      parent.insertBefore(child.cloneNode(true), element);
    });

    parent.removeChild(element);

    return true;
  }

  function unwrapFaqElement(element) {
    const parent = element.parentNode;

    if (!parent) return;

    const summary = element.querySelector(":scope > summary");
    const legacyBody = findDirectChildByClass(element, "ss-faq-body");

    if (summary) {
      const titleParagraph = element.ownerDocument.createElement("p");
      titleParagraph.textContent = summary.textContent || "";
      parent.insertBefore(titleParagraph, element);
    }

    if (legacyBody) {
      const source = getContentSourceElement(legacyBody);
      moveChildrenBefore(source, element);
      parent.removeChild(element);
      return;
    }

    Array.from(element.childNodes).forEach(function (child) {
      if (child === summary) return;
      parent.insertBefore(child.cloneNode(true), element);
    });

    parent.removeChild(element);
  }

  function unwrapSelSupBlockElement(element) {
    if (!element || !element.parentNode) return;

    if (element.classList.contains("ss-faq")) {
      unwrapFaqElement(element);
      return;
    }

    if (
      element.classList.contains("ss-note") &&
      unwrapLegacyBodyIfNeeded(element, "ss-note-body")
    )
      return;
    if (
      element.classList.contains("ss-step") &&
      unwrapLegacyBodyIfNeeded(element, "ss-step-body")
    )
      return;

    unwrapElementKeepingChildren(element);
  }

  function removeCustomAttributes(root) {
    if (!root || !root.querySelectorAll) return;

    Array.from(root.querySelectorAll("*")).forEach(function (element) {
      element.removeAttribute("style");
      element.removeAttribute("data-selsup-color");
      element.removeAttribute("data-selsup-weight");

      Array.from(element.attributes).forEach(function (attribute) {
        const name = attribute.name;

        if (name.indexOf("data-selsup-") === 0) {
          element.removeAttribute(name);
        }
      });

      if (element.classList) {
        Array.from(element.classList).forEach(function (className) {
          if (
            className.indexOf("ss-") === 0 ||
            className.indexOf("selsup-text-") === 0 ||
            className.indexOf("has-") === 0 ||
            className.indexOf("wp-block-") === 0
          ) {
            element.classList.remove(className);
          }
        });

        if (!element.getAttribute("class")) {
          element.removeAttribute("class");
        }
      }
    });
  }

  function unwrapInlineFormatting(root) {
    if (!root || !root.querySelectorAll) return;

    const elements = Array.from(
      root.querySelectorAll(inlineFormattingSelector),
    ).reverse();

    elements.forEach(function (element) {
      unwrapElementKeepingChildren(element);
    });
  }

  function cleanFormattingDom(root) {
    if (!root || !root.querySelectorAll) return;

    const blockWrappers = Array.from(
      root.querySelectorAll(
        ".ss-note, .ss-step, .ss-faq, .code-block-wrapper, .temporary-hidden",
      ),
    ).reverse();

    blockWrappers.forEach(function (wrapper) {
      unwrapSelSupBlockElement(wrapper);
    });

    unwrapInlineFormatting(root);
    removeCustomAttributes(root);
  }

  function cleanFormattingHtmlString(html) {
    const doc = document.implementation.createHTMLDocument("");
    const container = doc.createElement("div");

    container.innerHTML = String(html || "");
    cleanFormattingDom(container);

    return container.innerHTML;
  }

  function htmlSelectionContainsClearableMarkup(html) {
    return (
      /<(span|font|strong|b|em|i|u|s|strike|mark|small|sub|sup|code)\b/i.test(
        html,
      ) ||
      /class=["'][^"']*(ss-note|ss-step|ss-faq|code-block-wrapper|temporary-hidden|ss-text-|selsup-text-)/i.test(
        html,
      ) ||
      /data-selsup-color=/i.test(html) ||
      /data-selsup-weight=/i.test(html) ||
      /style=/i.test(html)
    );
  }

  function findEnclosingInlineFormattingRange(html, start, end) {
    let best = null;

    inlineFormattingTags.forEach(function (tagName) {
      const openRe = new RegExp("<" + tagName + "\\b[^>]*>", "gi");
      let match;

      while ((match = openRe.exec(html))) {
        const openStart = match.index;
        const openEnd = openRe.lastIndex;

        if (openStart > start) break;

        const closeRe = new RegExp("</" + tagName + "\\s*>", "gi");
        closeRe.lastIndex = openEnd;

        const closeMatch = closeRe.exec(html);

        if (!closeMatch) continue;

        const closeStart = closeMatch.index;
        const closeEnd = closeRe.lastIndex;

        if (openEnd <= start && closeStart >= end) {
          const range = {
            start: openStart,
            end: closeEnd,
            size: closeEnd - openStart,
          };

          if (!best || range.size < best.size) {
            best = range;
          }
        }
      }
    });

    return best;
  }

  function findClosestClearableElement(node, root) {
    let current = node;

    while (current && current !== root) {
      if (
        current.nodeType === 1 &&
        (isInlineStyleElement(current) ||
          isInlineFormattingElement(current) ||
          isSelSupBlockElement(current) ||
          current.hasAttribute?.("style") ||
          current.hasAttribute?.("data-selsup-color") ||
          current.hasAttribute?.("data-selsup-weight"))
      ) {
        return current;
      }

      current = current.parentNode;
    }

    return null;
  }

  function getTinyMceRangeStartNode(editor) {
    const range = editor.selection.getRng?.();

    if (!range) return editor.selection.getNode();

    const node = range.startContainer;

    if (!node) return editor.selection.getNode();

    return node.nodeType === 3 ? node.parentNode : node;
  }

  function clearFormattingInTextarea(element) {
    if (!isTextInput(element)) return false;
    if (!isVisible(element)) return false;

    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const value = element.value || "";
    const hasSelection = end > start;

    let targetStart = hasSelection ? start : 0;
    let targetEnd = hasSelection ? end : value.length;
    let target = value.substring(targetStart, targetEnd);

    if (hasSelection && !htmlSelectionContainsClearableMarkup(target)) {
      const expandedRange = findEnclosingInlineFormattingRange(
        value,
        start,
        end,
      );

      if (expandedRange) {
        targetStart = expandedRange.start;
        targetEnd = expandedRange.end;
        target = value.substring(targetStart, targetEnd);
      }
    }

    const cleaned = cleanFormattingHtmlString(target);

    debugLog("clear textarea", {
      start: targetStart,
      end: targetEnd,
      cleanedLength: cleaned.length,
    });

    element.focus();
    element.setRangeText(cleaned, targetStart, targetEnd, "select");
    element.selectionStart = targetStart;
    element.selectionEnd = targetStart + cleaned.length;

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  function clearFormattingInTinyMce() {
    if (isGutenbergPage()) return false;

    const editor = getTinyMceEditor();

    if (!editor) return false;

    editor.focus();

    const selectedHtml = editor.selection.getContent({ format: "html" });
    const selectedText = editor.selection.getContent({ format: "text" });
    const body = editor.getBody();
    const isCollapsed = isTinyMceSelectionCollapsed(editor);

    debugLog("clear tinymce", {
      isCollapsed: isCollapsed,
      selectedHtmlLength: selectedHtml.length,
      selectedTextLength: selectedText.length,
    });

    editor.undoManager.transact(function () {
      if (!isCollapsed && (selectedHtml || selectedText)) {
        if (htmlSelectionContainsClearableMarkup(selectedHtml)) {
          editor.selection.setContent(cleanFormattingHtmlString(selectedHtml));
          return;
        }

        try {
          editor.execCommand("RemoveFormat");
        } catch (error) {}

        return;
      }

      const startNode = getTinyMceRangeStartNode(editor);
      const target = findClosestClearableElement(startNode, body);

      if (!target) return;

      if (isSelSupBlockElement(target)) {
        unwrapSelSupBlockElement(target);
        return;
      }

      if (isInlineFormattingElement(target) || isInlineStyleElement(target)) {
        unwrapElementKeepingChildren(target);
        return;
      }

      target.removeAttribute("style");
      target.removeAttribute("data-selsup-color");
      target.removeAttribute("data-selsup-weight");
    });

    editor.nodeChanged();
    editor.save();

    return true;
  }

  function isGutenbergAvailable() {
    return !!(
      window.wp &&
      window.wp.blocks &&
      window.wp.data &&
      window.wp.data.select &&
      window.wp.data.dispatch
    );
  }

  function getBlockEditorStoreName() {
    if (!isGutenbergAvailable()) return null;

    try {
      window.wp.data.select("core/block-editor");
      return "core/block-editor";
    } catch (error) {
      return null;
    }
  }

  function registerGutenbergInlineFormats() {
    if (gutenbergFormatsRegistered) return;
    if (!window.wp || !window.wp.richText) return;
    if (!window.wp.richText.registerFormatType) return;

    const richText = window.wp.richText;

    Object.keys(inlineColorFormatMap).forEach(function (colorKey) {
      const formatName = inlineColorFormatMap[colorKey];

      try {
        if (richText.getFormatType && richText.getFormatType(formatName))
          return;

        richText.registerFormatType(formatName, {
          title: formatName,
          tagName: "span",
          className: inlineColorClassMap[colorKey],
          attributes: {
            style: "style",
            "data-selsup-color": "data-selsup-color",
          },
        });

        debugLog(
          "registered Gutenberg format",
          formatName,
          inlineColorClassMap[colorKey],
        );
      } catch (error) {
        debugWarn("failed to register Gutenberg format", formatName, error);
      }
    });

    Object.keys(inlineWeightFormatMap).forEach(function (weightKey) {
      const formatName = inlineWeightFormatMap[weightKey];

      try {
        if (richText.getFormatType && richText.getFormatType(formatName))
          return;

        richText.registerFormatType(formatName, {
          title: formatName,
          tagName: "span",
          className: inlineWeightClassMap[weightKey],
          attributes: {
            style: "style",
            "data-selsup-weight": "data-selsup-weight",
          },
        });

        debugLog(
          "registered Gutenberg format",
          formatName,
          inlineWeightClassMap[weightKey],
        );
      } catch (error) {
        debugWarn("failed to register Gutenberg format", formatName, error);
      }
    });

    gutenbergFormatsRegistered = true;
  }

  function getSelectedBlockIds(select) {
    let ids = [];

    try {
      ids = select.getMultiSelectedBlockClientIds?.() || [];
    } catch (error) {
      ids = [];
    }

    if (ids.length) return ids;

    try {
      ids = select.getSelectedBlockClientIds?.() || [];
    } catch (error) {
      ids = [];
    }

    if (ids.length) return ids;

    const selectedId = select.getSelectedBlockClientId?.();

    if (selectedId) return [selectedId];

    return [];
  }

  function getGutenbergSelectionInfo(select) {
    const start = select.getSelectionStart?.();
    const end = select.getSelectionEnd?.();

    debugLog("Gutenberg selection raw", { start: start, end: end });

    if (!start || !end) return null;
    if (!start.clientId || !end.clientId) return null;
    if (start.clientId !== end.clientId) return null;
    if (!start.attributeKey || !end.attributeKey) return null;
    if (start.attributeKey !== end.attributeKey) return null;

    const startOffset = Number(start.offset);
    const endOffset = Number(end.offset);

    if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset))
      return null;
    if (startOffset === endOffset) return null;

    return {
      clientId: start.clientId,
      attributeKey: start.attributeKey,
      startOffset: Math.min(startOffset, endOffset),
      endOffset: Math.max(startOffset, endOffset),
    };
  }

  function getGutenbergInlineFormatName(wrapper) {
    if (wrapper.kind === "inline-color")
      return inlineColorFormatMap[wrapper.colorKey];
    if (wrapper.kind === "inline-weight")
      return inlineWeightFormatMap[wrapper.weightKey];

    return null;
  }

  function getGutenbergInlineAttributes(wrapper) {
    const attributes = {
      style: wrapper.style,
    };

    if (wrapper.kind === "inline-color") {
      attributes["data-selsup-color"] = wrapper.colorKey;
    }

    if (wrapper.kind === "inline-weight") {
      attributes["data-selsup-weight"] = wrapper.weightKey;
    }

    return attributes;
  }

  function getConflictingGutenbergInlineFormats(wrapper) {
    if (wrapper.kind === "inline-color") {
      return Object.keys(inlineColorFormatMap).map(function (key) {
        return inlineColorFormatMap[key];
      });
    }

    if (wrapper.kind === "inline-weight") {
      return Object.keys(inlineWeightFormatMap).map(function (key) {
        return inlineWeightFormatMap[key];
      });
    }

    return [];
  }

  function removeConflictingGutenbergInlineFormats(
    value,
    wrapper,
    startOffset,
    endOffset,
  ) {
    let nextValue = value;

    getConflictingGutenbergInlineFormats(wrapper).forEach(
      function (formatName) {
        try {
          nextValue = window.wp.richText.removeFormat(
            nextValue,
            formatName,
            startOffset,
            endOffset,
          );
        } catch (error) {
          debugWarn(
            "failed to remove conflicting Gutenberg format",
            formatName,
            error,
          );
        }
      },
    );

    return nextValue;
  }

  function getAttributeHtmlFromValue(value) {
    const richText = window.wp?.richText;

    if (typeof value === "string") return value;
    if (value === null || value === undefined) return null;

    try {
      if (richText?.toHTMLString) {
        const html = richText.toHTMLString({ value: value });
        if (typeof html === "string") return html;
      }
    } catch (error) {
      debugWarn("toHTMLString({ value }) failed", error, describeValue(value));
    }

    try {
      if (typeof value.toHTMLString === "function") {
        const html = value.toHTMLString();
        if (typeof html === "string") return html;
      }
    } catch (error) {
      debugWarn("value.toHTMLString() failed", error, describeValue(value));
    }

    if (typeof value.html === "string") return value.html;
    if (typeof value.originalHTML === "string") return value.originalHTML;
    if (typeof value.text === "string") return escapeHtml(value.text);

    return null;
  }

  function createRichTextValueFromAttribute(value) {
    const richText = window.wp?.richText;

    if (!richText) return null;

    const html = getAttributeHtmlFromValue(value);

    if (html === null) {
      debugWarn(
        "cannot convert Gutenberg attribute to HTML",
        describeValue(value),
      );
      return null;
    }

    try {
      if (richText.create) {
        return richText.create({ html: html });
      }
    } catch (error) {
      debugWarn("richText.create({ html }) failed", error, {
        html: html.slice(0, 180),
      });
    }

    return null;
  }

  function richTextValueToHtml(value) {
    const richText = window.wp?.richText;

    try {
      if (richText?.toHTMLString) {
        const html = richText.toHTMLString({ value: value });
        if (typeof html === "string") return html;
      }
    } catch (error) {
      debugWarn("richText.toHTMLString failed", error, describeValue(value));
    }

    try {
      if (typeof value?.toHTMLString === "function") {
        const html = value.toHTMLString();
        if (typeof html === "string") return html;
      }
    } catch (error) {
      debugWarn("nextValue.toHTMLString failed", error, describeValue(value));
    }

    return null;
  }

  function updateGutenbergRichTextSelection(transformer, options) {
    if (!window.wp || !window.wp.richText) return false;

    registerGutenbergInlineFormats();

    const storeName = getBlockEditorStoreName();

    if (!storeName) return false;

    const select = window.wp.data.select(storeName);
    const dispatch = window.wp.data.dispatch(storeName);
    const allowStoredSelection =
      !options || options.allowStoredSelection !== false;
    const liveInfo = getGutenbergSelectionInfo(select);
    const storedInfo = allowStoredSelection
      ? getStoredGutenbergSelectionInfo(select)
      : null;
    const info = liveInfo || storedInfo;

    debugLog("update Gutenberg rich text selection", {
      info: info,
      liveInfo: liveInfo,
      storedInfo: storedInfo,
      allowStoredSelection: allowStoredSelection,
    });

    if (!info) return false;

    const block = select.getBlock(info.clientId);

    if (!block || !block.attributes) {
      debugWarn("Gutenberg block missing", info.clientId);
      return false;
    }

    const attrValue = block.attributes[info.attributeKey];
    const value = createRichTextValueFromAttribute(attrValue);

    if (!value) {
      debugWarn("Gutenberg attr cannot be used as RichText", {
        clientId: info.clientId,
        blockName: block.name,
        attributeKey: info.attributeKey,
        attrValue: describeValue(attrValue),
      });
      return false;
    }

    let nextValue;

    try {
      nextValue = transformer(value, info.startOffset, info.endOffset);
    } catch (error) {
      debugError("Gutenberg transformer failed", error, {
        info: info,
        attrValue: describeValue(attrValue),
      });
      return false;
    }

    let nextHtml = richTextValueToHtml(nextValue);

    if (typeof nextHtml !== "string") {
      debugWarn("Gutenberg next HTML missing", describeValue(nextValue));
      return false;
    }

    const normalizedNextHtml = normalizeSelSupInlineHtmlString(nextHtml);

    if (normalizedNextHtml !== nextHtml) {
      debugLog("Gutenberg inline HTML normalized", {
        before: nextHtml,
        after: normalizedNextHtml,
      });
      nextHtml = normalizedNextHtml;
    }

    dispatch.updateBlockAttributes(info.clientId, {
      [info.attributeKey]: nextHtml,
    });

    debugLog("Gutenberg rich text updated", {
      blockName: block.name,
      attributeKey: info.attributeKey,
      startOffset: info.startOffset,
      endOffset: info.endOffset,
      nextHtml: nextHtml,
    });

    return true;
  }

  function applyInlineStyleToGutenbergBlock(block, dispatch, wrapper) {
    if (!block || !block.attributes) return false;

    const allowedKeys = ["content", "values", "caption", "citation", "summary"];
    const nextAttributes = {};
    let changed = false;

    allowedKeys.forEach(function (key) {
      const value = block.attributes[key];
      const html = getAttributeHtmlFromValue(value);

      if (typeof html !== "string") return;
      if (!html.trim()) return;

      const nextValue = applyInlineStyleToHtmlFragment(html, wrapper);

      if (nextValue !== html) {
        nextAttributes[key] = nextValue;
        changed = true;
      }
    });

    if (changed) {
      dispatch.updateBlockAttributes(block.clientId, nextAttributes);
    }

    (block.innerBlocks || []).forEach(function (innerBlock) {
      if (applyInlineStyleToGutenbergBlock(innerBlock, dispatch, wrapper)) {
        changed = true;
      }
    });

    return changed;
  }

  function getGutenbergIdsBetweenSelection(select) {
    const start = select.getSelectionStart?.();
    const end = select.getSelectionEnd?.();

    if (!start || !end || !start.clientId || !end.clientId) return [];

    const startRoot = select.getBlockRootClientId?.(start.clientId);
    const endRoot = select.getBlockRootClientId?.(end.clientId);

    if (startRoot !== endRoot) {
      return [start.clientId, end.clientId];
    }

    const blocks = select.getBlocks?.(startRoot) || [];
    const ids = blocks.map(function (block) {
      return block.clientId;
    });

    const startIndex = ids.indexOf(start.clientId);
    const endIndex = ids.indexOf(end.clientId);

    if (startIndex < 0 || endIndex < 0) {
      return [start.clientId, end.clientId];
    }

    return ids.slice(
      Math.min(startIndex, endIndex),
      Math.max(startIndex, endIndex) + 1,
    );
  }

  function getElementFromNode(node) {
    if (!node) return null;
    if (node.nodeType === 1) return node;
    return node.parentElement || null;
  }

  function isNodeInsideToolbar(node) {
    const element = getElementFromNode(node);

    return !!element?.closest?.(
      "#selsup-wrapper-panel, #selsup-wrapper-more-panel, #selsup-wrapper-toolbar",
    );
  }

  function isNodeInsideGutenbergEditor(node) {
    const element = getElementFromNode(node);

    return !!element?.closest?.(
      ".block-editor, .editor-styles-wrapper, .edit-post-visual-editor, .interface-interface-skeleton__content",
    );
  }

  function hasLiveGutenbergDomTextSelection() {
    const selection = document.getSelection?.();

    if (!selection) return false;
    if (selection.rangeCount === 0) return false;
    if (selection.isCollapsed) return false;
    if (!selection.toString().trim()) return false;
    if (
      isNodeInsideToolbar(selection.anchorNode) ||
      isNodeInsideToolbar(selection.focusNode)
    )
      return false;

    return (
      isNodeInsideGutenbergEditor(selection.anchorNode) ||
      isNodeInsideGutenbergEditor(selection.focusNode)
    );
  }

  function getCurrentOrStoredSelectedBlockIdsForClear(select) {
    const ids = getCurrentOrStoredSelectedBlockIds(select);

    if (hasLiveGutenbergDomTextSelection()) {
      return getSelectedBlockIds(select);
    }

    return ids;
  }

  function storeGutenbergTextSelectionInfo(info, source) {
    if (!info) return;

    lastGutenbergSelectionInfo = { ...info };
    lastGutenbergSelectionInfoTime = Date.now();

    debugLog("remember Gutenberg text selection", {
      source: source,
      info: lastGutenbergSelectionInfo,
      savedAt: lastGutenbergSelectionInfoTime,
    });
  }

  function forgetGutenbergTextSelectionInfo(reason) {
    if (!lastGutenbergSelectionInfo) return;

    debugLog("forget Gutenberg text selection", {
      reason: reason,
      info: lastGutenbergSelectionInfo,
    });

    lastGutenbergSelectionInfo = null;
    lastGutenbergSelectionInfoTime = 0;
  }

  function isToolbarSelectionLocked() {
    return Date.now() < toolbarSelectionLockUntil;
  }

  function preserveGutenbergSelectionBeforeToolbar() {
    if (!isGutenbergPage()) return;
    if (!isGutenbergAvailable()) return;

    const storeName = getBlockEditorStoreName();

    if (!storeName) return;

    toolbarSelectionLockUntil =
      Date.now() + GUTENBERG_TOOLBAR_SELECTION_LOCK_MS;

    const select = window.wp.data.select(storeName);
    const info = getGutenbergSelectionInfo(select);
    const ids = getSelectedBlockIds(select);

    if (info) {
      storeGutenbergTextSelectionInfo(info, "toolbar-pointerdown");
    } else if (ids.length) {
      forgetGutenbergTextSelectionInfo("toolbar-pointerdown-block-selection");
    }

    if (ids.length) {
      lastGutenbergSelectedBlockIds = ids.slice();
      debugLog(
        "remember Gutenberg blocks before toolbar",
        lastGutenbergSelectedBlockIds,
      );
    }
  }

  function rememberGutenbergSelection() {
    if (!isGutenbergPage()) return;
    if (!isGutenbergAvailable()) return;

    const storeName = getBlockEditorStoreName();

    if (!storeName) return;

    const select = window.wp.data.select(storeName);
    const info = getGutenbergSelectionInfo(select);
    const hasLiveText = hasLiveGutenbergDomTextSelection();
    const toolbarLocked = isToolbarSelectionLocked();

    if (info && (hasLiveText || toolbarLocked)) {
      storeGutenbergTextSelectionInfo(
        info,
        hasLiveText ? "live-text" : "toolbar-locked-store",
      );
    } else if (!hasLiveText && !toolbarLocked) {
      forgetGutenbergTextSelectionInfo("no-live-text");
    }

    let ids = getSelectedBlockIds(select);

    if (!ids.length && !hasLiveText && !toolbarLocked) {
      ids = getGutenbergIdsBetweenSelection(select);
    }

    if (ids.length) {
      lastGutenbergSelectedBlockIds = ids.slice();
      debugLog("remember Gutenberg blocks", lastGutenbergSelectedBlockIds);
    }
  }

  function scheduleRememberGutenbergSelection() {
    if (!isGutenbergPage()) return;

    window.setTimeout(rememberGutenbergSelection, 0);
    window.setTimeout(rememberGutenbergSelection, 60);
  }

  function getStoredGutenbergSelectionInfo(select) {
    if (!lastGutenbergSelectionInfo) return null;

    const age = Date.now() - lastGutenbergSelectionInfoTime;

    if (age > GUTENBERG_STORED_TEXT_SELECTION_MAX_AGE_MS) {
      forgetGutenbergTextSelectionInfo("stored-text-selection-expired");
      return null;
    }

    const block = select.getBlock(lastGutenbergSelectionInfo.clientId);

    if (!block || !block.attributes) return null;

    const value = block.attributes[lastGutenbergSelectionInfo.attributeKey];

    if (getAttributeHtmlFromValue(value) === null) return null;

    return { ...lastGutenbergSelectionInfo };
  }

  function getCurrentOrStoredSelectedBlockIds(select) {
    let ids = getSelectedBlockIds(select);

    if (!ids.length) {
      ids = getGutenbergIdsBetweenSelection(select);
    }

    if (ids.length) {
      lastGutenbergSelectedBlockIds = ids.slice();
      return ids;
    }

    return lastGutenbergSelectedBlockIds.filter(function (id) {
      return !!select.getBlock(id);
    });
  }

  function protectGutenbergSelection(element) {
    if (!element) return;

    ["pointerdown", "mousedown", "touchstart"].forEach(function (eventName) {
      element.addEventListener(
        eventName,
        preserveGutenbergSelectionBeforeToolbar,
        true,
      );
    });
  }

  function applyInlineStyleInGutenberg(wrapper) {
    if (!isGutenbergPage()) return false;
    if (!window.wp || !window.wp.richText) return false;

    registerGutenbergInlineFormats();

    const storeName = getBlockEditorStoreName();

    if (!storeName) return false;

    const select = window.wp.data.select(storeName);
    const dispatch = window.wp.data.dispatch(storeName);
    const formatName = getGutenbergInlineFormatName(wrapper);

    if (!formatName) return false;

    const info =
      getGutenbergSelectionInfo(select) ||
      getStoredGutenbergSelectionInfo(select);

    debugLog("apply inline Gutenberg", {
      wrapper: wrapper.label,
      formatName: formatName,
      info: info,
    });

    if (info) {
      return updateGutenbergRichTextSelection(
        function (value, startOffset, endOffset) {
          const withoutConflicts = removeConflictingGutenbergInlineFormats(
            value,
            wrapper,
            startOffset,
            endOffset,
          );

          return window.wp.richText.applyFormat(
            withoutConflicts,
            {
              type: formatName,
              attributes: getGutenbergInlineAttributes(wrapper),
            },
            startOffset,
            endOffset,
          );
        },
      );
    }

    const ids = getCurrentOrStoredSelectedBlockIds(select);

    if (!ids.length) {
      debugWarn(
        "Gutenberg inline style failed: no text selection and no block ids",
      );
      return false;
    }

    let changed = false;

    ids.forEach(function (id) {
      const block = select.getBlock(id);

      if (applyInlineStyleToGutenbergBlock(block, dispatch, wrapper)) {
        changed = true;
      }
    });

    debugLog("apply inline Gutenberg fallback block result", {
      ids: ids,
      changed: changed,
    });

    return changed;
  }

  function clearGutenbergRichTextSelectionFormatting(options) {
    if (!isGutenbergPage()) return false;
    if (!window.wp || !window.wp.richText) return false;

    return updateGutenbergRichTextSelection(function (
      value,
      startOffset,
      endOffset,
    ) {
      let nextValue = value;

      gutenbergFormatsToClear.forEach(function (formatName) {
        try {
          nextValue = window.wp.richText.removeFormat(
            nextValue,
            formatName,
            startOffset,
            endOffset,
          );
        } catch (error) {}
      });

      return nextValue;
    }, options);
  }

  function cloneBlock(block) {
    const wpBlocks = window.wp.blocks;
    const blockName = block.name || block.blockName;

    if (wpBlocks.cloneBlock) return wpBlocks.cloneBlock(block);

    return wpBlocks.createBlock(
      blockName,
      { ...(block.attributes || {}) },
      (block.innerBlocks || []).map(cloneBlock),
    );
  }

  function isEmptyParagraph(block) {
    if (!block) return false;

    const blockName = block.name || block.blockName;

    if (blockName !== "core/paragraph") return false;

    const content = getAttributeHtmlFromValue(block.attributes?.content) || "";
    const text = content.replace(/<[^>]*>/g, "").trim();

    return text === "";
  }

  function blockHasClass(block, className) {
    const classes = block?.attributes?.className || "";

    return classes.split(/\s+/).includes(className);
  }

  function blockHasAnyClass(block, classNames) {
    return classNames.some(function (className) {
      return blockHasClass(block, className);
    });
  }

  function isSelSupWrapperBlock(block) {
    return blockHasAnyClass(block, [
      "ss-note",
      "ss-step",
      "ss-faq",
      "code-block-wrapper",
      "temporary-hidden",
    ]);
  }

  function isSelSupBodyBlock(block) {
    return blockHasAnyClass(block, [
      "ss-note-body",
      "ss-step-body",
      "ss-faq-body",
    ]);
  }

  function isLegacyBodyBlock(block) {
    return isSelSupBodyBlock(block);
  }

  function getUnwrappedGutenbergBlocks(block) {
    if (!block) return null;

    if (isSelSupWrapperBlock(block)) {
      const result = [];

      (block.innerBlocks || []).forEach(function (innerBlock) {
        if (isLegacyBodyBlock(innerBlock)) {
          (innerBlock.innerBlocks || []).forEach(function (bodyBlock) {
            result.push(cloneBlock(bodyBlock));
          });

          return;
        }

        result.push(cloneBlock(innerBlock));
      });

      return result;
    }

    if (isSelSupBodyBlock(block)) {
      return (block.innerBlocks || []).map(cloneBlock);
    }

    return null;
  }

  function findNearestSelSupBlockId(clientId, select) {
    let currentId = clientId;

    while (currentId) {
      const block = select.getBlock(currentId);

      if (isSelSupWrapperBlock(block)) return currentId;

      currentId = select.getBlockRootClientId?.(currentId);
    }

    return null;
  }

  function cleanGutenbergBlockAttributes(block, dispatch) {
    if (!block || !block.attributes) return false;

    let changed = false;
    const nextAttributes = {};

    Object.keys(block.attributes).forEach(function (key) {
      const value = block.attributes[key];
      const html = getAttributeHtmlFromValue(value);

      if (typeof html !== "string") return;

      const mayContainFormatting =
        html.includes("style=") ||
        html.includes("data-selsup-color") ||
        html.includes("data-selsup-weight") ||
        html.includes("ss-text-") ||
        html.includes("selsup-text-") ||
        html.includes("ss-note") ||
        html.includes("ss-step") ||
        html.includes("ss-faq") ||
        html.includes("code-block-wrapper") ||
        html.includes("temporary-hidden") ||
        html.includes("<strong") ||
        html.includes("<b") ||
        html.includes("<em") ||
        html.includes("<i") ||
        html.includes("<span") ||
        html.includes("<font") ||
        html.includes("<u") ||
        html.includes("<mark") ||
        html.includes("<small") ||
        html.includes("<sub") ||
        html.includes("<sup") ||
        html.includes("<code");

      if (!mayContainFormatting) return;

      const cleaned = cleanFormattingHtmlString(html);

      if (cleaned !== html) {
        nextAttributes[key] = cleaned;
        changed = true;
      }
    });

    if (changed) {
      dispatch.updateBlockAttributes(block.clientId, nextAttributes);
    }

    return changed;
  }

  function clearFormattingInGutenberg() {
    if (!isGutenbergAvailable()) return false;

    registerGutenbergInlineFormats();

    const storeName = getBlockEditorStoreName();

    if (!storeName) return false;

    const select = window.wp.data.select(storeName);
    const dispatch = window.wp.data.dispatch(storeName);
    const hasLiveText = hasLiveGutenbergDomTextSelection();
    const storedTextSelection = getStoredGutenbergSelectionInfo(select);

    debugLog("clear Gutenberg entry", {
      hasLiveText: hasLiveText,
      currentBlockIds: getSelectedBlockIds(select),
      storedBlockIds: lastGutenbergSelectedBlockIds,
      storedTextSelection: storedTextSelection,
      toolbarSelectionLocked: isToolbarSelectionLocked(),
    });

    if (
      (hasLiveText || storedTextSelection) &&
      clearGutenbergRichTextSelectionFormatting({ allowStoredSelection: true })
    ) {
      debugLog("clear Gutenberg finished through text selection", {
        usedLiveText: hasLiveText,
        usedStoredText: !!storedTextSelection,
      });
      return true;
    }

    const selectedIds = getCurrentOrStoredSelectedBlockIdsForClear(select);

    if (!selectedIds.length) {
      debugWarn(
        "clear Gutenberg failed: no live text selection and no selected blocks",
      );
      return false;
    }

    let changed = false;
    const handledWrapperIds = new Set();

    selectedIds.forEach(function (selectedId) {
      const wrapperId = findNearestSelSupBlockId(selectedId, select);

      debugLog("clear Gutenberg selected block", {
        selectedId: selectedId,
        wrapperId: wrapperId,
      });

      if (wrapperId && !handledWrapperIds.has(wrapperId)) {
        const block = select.getBlock(wrapperId);
        const unwrappedBlocks = getUnwrappedGutenbergBlocks(block);

        if (unwrappedBlocks) {
          dispatch.replaceBlocks(
            [wrapperId],
            unwrappedBlocks.length ? unwrappedBlocks : [makeParagraphBlock()],
          );
          handledWrapperIds.add(wrapperId);
          changed = true;
          debugLog("clear Gutenberg unwrapped SelSup block", {
            wrapperId: wrapperId,
            blockName: block?.name,
            count: unwrappedBlocks.length,
          });
        }

        return;
      }

      const block = select.getBlock(selectedId);

      if (!block) return;

      if (
        block.name === "core/html" &&
        typeof block.attributes?.content === "string"
      ) {
        const cleaned = cleanFormattingHtmlString(block.attributes.content);

        if (cleaned !== block.attributes.content) {
          dispatch.updateBlockAttributes(selectedId, {
            content: cleaned,
          });
          changed = true;
        }

        return;
      }

      if (cleanGutenbergBlockAttributes(block, dispatch)) {
        changed = true;
      }
    });

    debugLog("clear Gutenberg result", {
      selectedIds: selectedIds,
      changed: changed,
    });

    return changed;
  }

  function makeParagraphBlock(content, className) {
    const attributes = {
      content: content || "",
    };

    if (className) {
      attributes.className = className;
    }

    return window.wp.blocks.createBlock("core/paragraph", attributes);
  }

  function makeGroupBlock(className, innerBlocks) {
    return window.wp.blocks.createBlock(
      "core/group",
      {
        className: className || "",
      },
      innerBlocks && innerBlocks.length ? innerBlocks : [makeParagraphBlock()],
    );
  }

  function makeGutenbergBlock(wrapper, innerBlocks) {
    const createBlock = window.wp.blocks.createBlock;

    if (wrapper.kind === "separator") {
      return createBlock("core/separator", {
        className: wrapper.className || "",
      });
    }

    if (wrapper.kind === "html") {
      return createBlock("core/html", {
        content: wrapper.htmlContent || "",
      });
    }

    if (wrapper.kind === "faq") {
      const contentBlocks =
        innerBlocks && innerBlocks.length
          ? innerBlocks
          : [
              makeParagraphBlock(
                "Здесь можно разместить ответ, который будет скрыт до раскрытия блока.",
              ),
            ];

      return createBlock(
        "core/details",
        {
          summary: wrapper.summary || "Частый вопрос",
          className: wrapper.className || "ss-faq",
        },
        contentBlocks,
      );
    }

    if (wrapper.kind === "note" || wrapper.kind === "step") {
      const titleBlock = makeParagraphBlock(
        '<strong style="' +
          wrapper.titleStyle +
          '">' +
          escapeHtml(wrapper.title) +
          "</strong>",
      );

      const contentBlocks =
        innerBlocks && innerBlocks.length
          ? innerBlocks
          : [makeParagraphBlock()];

      return makeGroupBlock(
        wrapper.className,
        [titleBlock].concat(contentBlocks),
      );
    }

    return makeGroupBlock(
      wrapper.className,
      innerBlocks && innerBlocks.length ? innerBlocks : [makeParagraphBlock()],
    );
  }

  function insertGutenbergAfterSelection(block, select, dispatch, selectedIds) {
    const lastSelectedId = selectedIds.length
      ? selectedIds[selectedIds.length - 1]
      : null;
    const rootClientId = lastSelectedId
      ? select.getBlockRootClientId?.(lastSelectedId)
      : undefined;
    const selectedIndex = lastSelectedId
      ? select.getBlockIndex?.(lastSelectedId, rootClientId)
      : undefined;
    const insertIndex = Number.isInteger(selectedIndex)
      ? selectedIndex + 1
      : undefined;

    dispatch.insertBlocks(block, insertIndex, rootClientId, true);

    return true;
  }

  function applyGutenbergWrapper(wrapper) {
    if (!isGutenbergAvailable()) return false;

    const storeName = getBlockEditorStoreName();

    if (!storeName) return false;

    const select = window.wp.data.select(storeName);
    const dispatch = window.wp.data.dispatch(storeName);
    const selectedIds = getCurrentOrStoredSelectedBlockIds(select);

    debugLog("apply Gutenberg wrapper", {
      wrapper: wrapper.label,
      selectedIds: selectedIds,
    });

    if (wrapper.kind === "separator" || wrapper.kind === "html") {
      const block = makeGutenbergBlock(wrapper, []);
      return insertGutenbergAfterSelection(
        block,
        select,
        dispatch,
        selectedIds,
      );
    }

    const selectedBlocks = selectedIds
      .map(function (id) {
        return select.getBlock(id);
      })
      .filter(Boolean);

    if (!selectedBlocks.length) {
      const block = makeGutenbergBlock(wrapper, [makeParagraphBlock()]);
      return insertGutenbergAfterSelection(block, select, dispatch, []);
    }

    const innerBlocks =
      selectedBlocks.length === 1 && isEmptyParagraph(selectedBlocks[0])
        ? [makeParagraphBlock()]
        : selectedBlocks.map(cloneBlock);

    const groupBlock = makeGutenbergBlock(wrapper, innerBlocks);

    dispatch.replaceBlocks(selectedIds, groupBlock);

    return true;
  }

  function rawHtmlToBlocks(html) {
    const wpBlocks = window.wp?.blocks;

    if (!wpBlocks) return [];

    try {
      if (wpBlocks.rawHandler) {
        const blocks = wpBlocks.rawHandler({
          HTML: html,
        });

        if (blocks && blocks.length) return blocks;
      }
    } catch (error) {
      debugWarn("rawHandler failed", error);
    }

    const text = String(html || "")
      .replace(/<[^>]*>/g, "")
      .trim();

    if (!text) return [];

    return [makeParagraphBlock(escapeHtml(text))];
  }

  function getLegacyNoteConfig(element) {
    if (element.classList.contains("ss-note-warning")) {
      return findWrapper("Orange warning block");
    }

    if (element.classList.contains("ss-note-success")) {
      return findWrapper("Green success block");
    }

    if (element.classList.contains("ss-note-danger")) {
      return findWrapper("Red danger block");
    }

    return findWrapper("Blue info block");
  }

  function flattenLegacyWrapperHtml(element, bodyClassName) {
    const doc = document.implementation.createHTMLDocument("");
    const container = doc.createElement("div");
    const body =
      element.querySelector(":scope > ." + bodyClassName) ||
      element.querySelector("." + bodyClassName);

    if (!body) {
      return element.innerHTML;
    }

    Array.from(element.childNodes).forEach(function (child) {
      if (child === body) {
        Array.from(body.childNodes).forEach(function (bodyChild) {
          container.appendChild(bodyChild.cloneNode(true));
        });

        return;
      }

      container.appendChild(child.cloneNode(true));
    });

    return container.innerHTML;
  }

  function htmlElementToRepairedBlocks(element) {
    if (!element || element.nodeType !== 1) return [];

    if (element.classList.contains("ss-note")) {
      const wrapper = getLegacyNoteConfig(element);
      const html = flattenLegacyWrapperHtml(element, "ss-note-body");

      return [makeGroupBlock(wrapper.className, rawHtmlToBlocks(html))];
    }

    if (element.classList.contains("ss-step")) {
      const wrapper = findWrapper("Step block");
      const html = flattenLegacyWrapperHtml(element, "ss-step-body");

      return [makeGroupBlock(wrapper.className, rawHtmlToBlocks(html))];
    }

    if (element.classList.contains("code-block-wrapper")) {
      return [
        makeGroupBlock(
          "code-block-wrapper",
          rawHtmlToBlocks(element.innerHTML),
        ),
      ];
    }

    if (element.classList.contains("temporary-hidden")) {
      return [
        makeGroupBlock("temporary-hidden", rawHtmlToBlocks(element.innerHTML)),
      ];
    }

    if (element.matches("details.ss-faq")) {
      const summary = element.querySelector(":scope > summary");
      const summaryText = summary
        ? summary.textContent.trim() || "Частый вопрос"
        : "Частый вопрос";
      const bodyContainer = document.implementation
        .createHTMLDocument("")
        .createElement("div");

      Array.from(element.childNodes).forEach(function (node) {
        if (node === summary) return;
        if (node.nodeType === 3 && node.nodeValue.trim() === "") return;

        bodyContainer.appendChild(node.cloneNode(true));
      });

      const innerBlocks = rawHtmlToBlocks(bodyContainer.innerHTML);

      try {
        return [
          window.wp.blocks.createBlock(
            "core/details",
            {
              summary: summaryText,
              className: "ss-faq",
            },
            innerBlocks.length ? innerBlocks : [makeParagraphBlock()],
          ),
        ];
      } catch (error) {
        return [
          makeGroupBlock(
            "ss-faq",
            [
              makeParagraphBlock(
                "<strong>" + escapeHtml(summaryText) + "</strong>",
              ),
            ].concat(innerBlocks.length ? innerBlocks : [makeParagraphBlock()]),
          ),
        ];
      }
    }

    return rawHtmlToBlocks(element.outerHTML);
  }

  function repairLegacyHtmlToBlocks(html) {
    const doc = document.implementation.createHTMLDocument("");
    const container = doc.createElement("div");
    const repairedBlocks = [];

    container.innerHTML = String(html || "").trim();

    Array.from(container.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        const text = node.nodeValue.trim();

        if (text) {
          repairedBlocks.push(makeParagraphBlock(escapeHtml(text)));
        }

        return;
      }

      if (node.nodeType !== 1) return;

      htmlElementToRepairedBlocks(node).forEach(function (block) {
        repairedBlocks.push(block);
      });
    });

    return repairedBlocks;
  }

  function repairSelectedGutenbergHtmlBlocks() {
    if (!isGutenbergAvailable()) return false;

    const storeName = getBlockEditorStoreName();

    if (!storeName) return false;

    const select = window.wp.data.select(storeName);
    const dispatch = window.wp.data.dispatch(storeName);
    const selectedIds = getSelectedBlockIds(select);

    if (!selectedIds.length) return false;

    let repaired = false;

    selectedIds.forEach(function (id) {
      const block = select.getBlock(id);

      if (!block) return;
      if (block.name !== "core/html") return;

      const content = block.attributes?.content || "";

      if (
        !/ss-note|ss-step|ss-faq|code-block-wrapper|temporary-hidden/.test(
          content,
        )
      )
        return;

      const blocks = repairLegacyHtmlToBlocks(content);

      if (!blocks.length) return;

      dispatch.replaceBlocks([id], blocks);
      repaired = true;
    });

    debugLog("repair selected Gutenberg HTML blocks", {
      selectedIds: selectedIds,
      repaired: repaired,
    });

    return repaired;
  }

  function repairLegacyHtml() {
    observeAllEditorDocuments();
    addCssToAdminPage();
    addAdminCss();
    addCssToTinyMce();

    if (isGutenbergPage()) {
      repairSelectedGutenbergHtmlBlocks();
    }
  }

  function applyInlineStyle(wrapper) {
    observeAllEditorDocuments();
    addCssToAdminPage();
    addAdminCss();
    addCssToTinyMce();

    if (isGutenbergPage() && applyInlineStyleInGutenberg(wrapper)) {
      return;
    }

    const activeTextInput = getActiveTextInput();

    if (activeTextInput) {
      if (applyInlineStyleInTextarea(activeTextInput, wrapper)) {
        return;
      }
    }

    applyInlineStyleInTinyMce(wrapper);
  }

  function clearFormatting() {
    observeAllEditorDocuments();
    addCssToAdminPage();
    addAdminCss();
    addCssToTinyMce();

    const activeTextInput = getActiveTextInput();

    if (activeTextInput) {
      if (clearFormattingInTextarea(activeTextInput)) {
        return;
      }
    }

    if (isGutenbergPage()) {
      clearFormattingInGutenberg();
      return;
    }

    clearFormattingInTinyMce();
  }

  function wrapSelection(wrapper) {
    observeAllEditorDocuments();
    addCssToAdminPage();
    addAdminCss();
    addCssToTinyMce();

    if (!wrapper) return;

    debugLog("wrapSelection", {
      wrapper: wrapper.label,
      kind: wrapper.kind,
      group: wrapper.group,
      isGutenbergPage: isGutenbergPage(),
      activeTextInput: !!getActiveTextInput(),
    });

    if (wrapper.kind === "inline-color" || wrapper.kind === "inline-weight") {
      applyInlineStyle(wrapper);
      return;
    }

    if (wrapper.kind === "clear-formatting") {
      clearFormatting();
      return;
    }

    const activeTextInput = getActiveTextInput();

    if (activeTextInput) {
      if (wrapInTextarea(activeTextInput, wrapper)) {
        return;
      }
    }

    if (isGutenbergPage()) {
      applyGutenbergWrapper(wrapper);
      return;
    }

    if (wrapInTinyMce(wrapper)) {
      return;
    }

    wrapInAnyDocumentSelection(wrapper);
  }

  function attachTinyMceCss() {
    if (!window.tinymce) return;
    if (isGutenbergPage()) return;

    if (!tinyMceListenerAttached) {
      tinyMceListenerAttached = true;

      window.tinymce.on("AddEditor", function () {
        setTimeout(addCssToTinyMce, 500);
      });
    }

    addCssToTinyMce();
  }

  function getGutenbergHeaderTarget() {
    const leftTools =
      document.querySelector(
        ".editor-header__toolbar .editor-document-tools__left",
      ) ||
      document.querySelector(
        ".edit-post-header-toolbar .editor-document-tools__left",
      ) ||
      document.querySelector(".editor-document-tools__left");

    if (leftTools) {
      return {
        target: leftTools,
        before: null,
      };
    }

    const documentToolbar =
      document.querySelector(
        ".editor-header__toolbar .editor-document-tools",
      ) ||
      document.querySelector(
        ".edit-post-header-toolbar .editor-document-tools",
      );

    if (documentToolbar) {
      return {
        target: documentToolbar,
        before: null,
      };
    }

    const settingsArea =
      document.querySelector(".editor-header__settings") ||
      document.querySelector(".edit-post-header__settings") ||
      document.querySelector(".interface-pinned-items") ||
      document.querySelector(".interface-interface-skeleton__header");

    if (settingsArea) {
      return {
        target: settingsArea,
        before: null,
      };
    }

    return null;
  }

  function getToolbarTarget() {
    const classicTarget =
      document.querySelector("#wp-content-media-buttons") ||
      document.querySelector(".wp-media-buttons") ||
      document.querySelector("#wp-content-editor-tools") ||
      document.querySelector("#postdivrich");

    if (
      classicTarget &&
      !document.body.classList.contains("block-editor-page")
    ) {
      return {
        target: classicTarget,
        before: null,
        mode: "classic",
      };
    }

    if (isGutenbergPage()) {
      const headerTarget = getGutenbergHeaderTarget();

      if (headerTarget) {
        return {
          target: headerTarget.target,
          before: headerTarget.before,
          mode: "gutenberg-header",
        };
      }
    }

    return null;
  }

  function styleControl(element, styles) {
    Object.assign(element.style, styles);
  }

  function createSelect(id, items) {
    const select = document.createElement("select");

    if (id) {
      const safeId = document.getElementById(id)
        ? id + "-" + Date.now() + "-" + Math.floor(Math.random() * 100000)
        : id;

      select.id = safeId;
    }

    styleControl(select, {
      height: "30px",
      maxWidth: "180px",
      fontSize: "13px",
    });

    items.forEach(function (item, index) {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = item.shortLabel || item.label;
      select.appendChild(option);
    });

    return select;
  }

  function makeButton(text, title, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.title = title || text;

    button.addEventListener("mousedown", function (event) {
      event.preventDefault();
    });

    button.addEventListener("click", function (event) {
      event.preventDefault();
      onClick();
    });

    return button;
  }

  function createToolbarGroup() {
    const group = document.createElement("span");

    group.className = "selsup-toolbar-group";

    styleControl(group, {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      paddingLeft: "6px",
      marginLeft: "2px",
      borderLeft: "1px solid #dcdcde",
    });

    return group;
  }

  function buildControls(container, buttonClass, compact) {
    const blockWrappers = wrappers.filter(function (wrapper) {
      return wrapper.group === "block";
    });

    const textColorWrappers = wrappers.filter(function (wrapper) {
      return wrapper.group === "text-color";
    });

    const textWeightWrappers = wrappers.filter(function (wrapper) {
      return wrapper.group === "text-weight";
    });

    function row(label, groupKey) {
      const group = compact
        ? document.createElement("div")
        : createToolbarGroup();

      group.dataset.selsupGroup = groupKey;

      if (compact) {
        group.className = "selsup-panel-row";

        const labelElement = document.createElement("span");
        labelElement.className = "selsup-panel-label";
        labelElement.textContent = label;

        group.appendChild(labelElement);
      }

      return group;
    }

    const blockSelect = createSelect(
      "selsup-wrapper-block-select",
      blockWrappers,
    );
    const textColorSelect = createSelect(
      "selsup-wrapper-color-select",
      textColorWrappers,
    );
    const textWeightSelect = createSelect(
      "selsup-wrapper-weight-select",
      textWeightWrappers,
    );

    const blockGroup = row("Blocks", "blocks");
    const quickGroup = row("Quick", "quick");
    const lineGroup = row("Lines", "lines");
    const colorGroup = row("Color", "color");
    const weightGroup = row("Weight", "weight");
    const toolsGroup = row("Tools", "tools");

    const wrapButton = makeButton(
      "Wrap",
      "Apply selected block wrapper",
      buttonClass,
      function () {
        wrapSelection(blockWrappers[Number(blockSelect.value)]);
      },
    );

    const quickInfoButton = makeButton(
      "Info",
      "Blue info block",
      buttonClass,
      function () {
        wrapSelection(findWrapper("Blue info block"));
      },
    );

    const quickWarnButton = makeButton(
      "Warn",
      "Orange warning block",
      buttonClass,
      function () {
        wrapSelection(findWrapper("Orange warning block"));
      },
    );

    const softLineButton = makeButton(
      "Soft",
      "Soft horizontal line",
      buttonClass,
      function () {
        wrapSelection(findWrapper("Blue-dot separator"));
      },
    );

    const sectionLineButton = makeButton(
      "Section",
      "Section horizontal line",
      buttonClass,
      function () {
        wrapSelection(findWrapper("Section separator"));
      },
    );

    const applyColorButton = makeButton(
      "Apply color",
      "Apply selected text color",
      buttonClass,
      function () {
        wrapSelection(textColorWrappers[Number(textColorSelect.value)]);
      },
    );

    const applyWeightButton = makeButton(
      "Apply weight",
      "Apply selected text weight",
      buttonClass,
      function () {
        wrapSelection(textWeightWrappers[Number(textWeightSelect.value)]);
      },
    );

    const clearButton = makeButton(
      "Clear",
      "Clear formatting from selection/current block",
      buttonClass,
      function () {
        wrapSelection(findWrapper("Clear formatting"));
      },
    );

    const repairButton = makeButton(
      "Repair HTML",
      "Convert old SelSup HTML blocks into Gutenberg blocks",
      buttonClass,
      function () {
        repairLegacyHtml();
      },
    );

    blockGroup.appendChild(blockSelect);
    blockGroup.appendChild(wrapButton);

    quickGroup.appendChild(quickInfoButton);
    quickGroup.appendChild(quickWarnButton);

    lineGroup.appendChild(softLineButton);
    lineGroup.appendChild(sectionLineButton);

    colorGroup.appendChild(textColorSelect);
    colorGroup.appendChild(applyColorButton);

    weightGroup.appendChild(textWeightSelect);
    weightGroup.appendChild(applyWeightButton);

    toolsGroup.appendChild(clearButton);
    toolsGroup.appendChild(repairButton);

    container.appendChild(blockGroup);
    container.appendChild(quickGroup);
    container.appendChild(lineGroup);
    container.appendChild(colorGroup);
    container.appendChild(weightGroup);
    container.appendChild(toolsGroup);
  }

  function createPanelBase(id, titleText) {
    let panel = document.getElementById(id);

    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = id;
    panel.hidden = true;

    const header = document.createElement("div");
    header.className = "selsup-panel-header";

    const title = document.createElement("span");
    title.textContent = titleText;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "selsup-panel-close";
    close.textContent = "×";
    close.title = "Close";

    close.addEventListener("mousedown", function (event) {
      event.preventDefault();
    });

    close.addEventListener("click", function (event) {
      event.preventDefault();
      panel.hidden = true;
    });

    header.appendChild(title);
    header.appendChild(close);
    panel.appendChild(header);

    document.body.appendChild(panel);

    return panel;
  }

  function createGutenbergPanel(buttonClass) {
    const panel = createPanelBase("selsup-wrapper-panel", "SelSup tools");

    if (!panel.dataset.selsupBuilt) {
      panel.dataset.selsupBuilt = "1";
      buildControls(panel, buttonClass, true);
      protectGutenbergSelection(panel);
    }

    return panel;
  }

  function createGutenbergMorePanel(buttonClass) {
    const panel = createPanelBase(
      "selsup-wrapper-more-panel",
      "More SelSup tools",
    );

    if (!panel.dataset.selsupBuilt) {
      panel.dataset.selsupBuilt = "1";
      buildControls(panel, buttonClass, true);
      protectGutenbergSelection(panel);
    }

    return panel;
  }

  function positionGutenbergPanelNearButton(panel, button) {
    if (!panel || !button) return;

    const rect = button.getBoundingClientRect();
    const panelWidth = Math.min(560, window.innerWidth - 24);
    const left = Math.max(
      12,
      Math.min(rect.left, window.innerWidth - panelWidth - 12),
    );
    const top = Math.max(48, rect.bottom + 8);

    panel.style.left = left + "px";
    panel.style.right = "auto";
    panel.style.top = top + "px";
  }

  function hideGutenbergToolPanels(exceptPanel) {
    ["selsup-wrapper-panel", "selsup-wrapper-more-panel"].forEach(
      function (id) {
        const panel = document.getElementById(id);

        if (panel && panel !== exceptPanel) {
          panel.hidden = true;
        }
      },
    );
  }

  function isElementRendered(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  }

  function getClosestGutenbergHeaderElement(element) {
    if (!element || !element.closest) return null;

    return (
      element.closest(".editor-header") ||
      element.closest(".edit-post-header") ||
      element.closest(".editor-header__toolbar") ||
      element.closest(".edit-post-header-toolbar") ||
      element.closest(".interface-interface-skeleton__header")
    );
  }

  function getGutenbergRightBoundary(toolbar, toolbarLeft) {
    const header = getClosestGutenbergHeaderElement(toolbar);
    const headerRect = header
      ? header.getBoundingClientRect()
      : { right: window.innerWidth };
    const leftEdge = Number.isFinite(toolbarLeft)
      ? toolbarLeft
      : toolbar.getBoundingClientRect().left;

    // CHANGE 3.9.4: границу считаем по реальному правому соседу в header,
    // но сам toolbar перед этим временно сжимается до 0px в getAdaptiveToolbarAvailableWidth().
    // Так editor-header__center измеряется в нормальном положении и не выталкивается нашими кнопками.
    let boundary = headerRect.right || window.innerWidth;

    [
      ".editor-header__settings",
      ".edit-post-header__settings",
      ".interface-pinned-items",
      ".editor-header__center",
      ".edit-post-header__center",
      ".editor-header__title",
    ].forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (element) {
        if (!element || toolbar.contains(element) || element.contains(toolbar))
          return;
        if (!isElementRendered(element)) return;

        const rect = element.getBoundingClientRect();

        if (rect.left > leftEdge + 12) {
          boundary = Math.min(boundary, rect.left);
        }
      });
    });

    return boundary;
  }

  function getClassicRightBoundary(toolbar, toolbarLeft) {
    const leftEdge = Number.isFinite(toolbarLeft)
      ? toolbarLeft
      : toolbar.getBoundingClientRect().left;

    // CHANGE 3.9.6: Classic toolbar is inside #wp-content-media-buttons, whose width can collapse
    // to the width of its children. If we use that parent as the boundary, then during measurement
    // the toolbar is temporarily set to 0px and the calculated available width also becomes 0px.
    // Use stable editor containers instead, plus the Visual/Text tabs as the right-side stopper.
    const stableContainers = [
      toolbar.closest("#wp-content-wrap"),
      document.querySelector("#wp-content-wrap"),
      toolbar.closest("#postdivrich"),
      document.querySelector("#postdivrich"),
      toolbar.closest("#post-body-content"),
      document.querySelector("#post-body-content"),
      toolbar.closest(".wp-editor-wrap"),
      document.querySelector(".wp-editor-wrap"),
    ].filter(Boolean);

    let boundary = window.innerWidth;

    stableContainers.forEach(function (element) {
      if (!element || !isElementRendered(element)) return;

      const rect = element.getBoundingClientRect();

      if (rect.right > leftEdge + 60) {
        boundary = Math.min(boundary, rect.right);
      }
    });

    const tabs = document.querySelector(
      "#wp-content-wrap .wp-editor-tabs, .wp-editor-tabs",
    );

    if (tabs && isElementRendered(tabs)) {
      const rect = tabs.getBoundingClientRect();

      if (rect.left > leftEdge + 60) {
        boundary = Math.min(boundary, rect.left);
      }
    }

    [
      "#postbox-container-1",
      "#side-sortables",
      "#submitdiv",
      ".postbox-container",
    ].forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (element) {
        if (!element || !isElementRendered(element)) return;
        if (toolbar.contains(element) || element.contains(toolbar)) return;

        const rect = element.getBoundingClientRect();

        if (rect.left > leftEdge + 60) {
          boundary = Math.min(boundary, rect.left);
        }
      });
    });

    return boundary;
  }

  function getAdaptiveToolbarAvailableWidth(toolbar) {
    const originalRect = toolbar.getBoundingClientRect();
    const toolbarLeft = originalRect.left;
    const previous = {
      width: toolbar.style.width,
      maxWidth: toolbar.style.maxWidth,
      flexBasis: toolbar.style.flexBasis,
      overflow: toolbar.style.overflow,
      visibility: toolbar.style.visibility,
    };

    // CHANGE 3.9.4: измеряем доступное место так, будто SelSup-toolbar не занимает ширину.
    // Иначе полная строка кнопок сама сдвигает центр шапки вправо, а потом считает это как доступное место.
    selsupAdaptiveLayoutInProgress = true;

    toolbar.style.width = "0px";
    toolbar.style.maxWidth = "0px";
    toolbar.style.flexBasis = "0px";
    toolbar.style.overflow = "hidden";
    toolbar.style.visibility = "hidden";

    const rightBoundary =
      toolbar.dataset.selsupToolbarTarget === "classic"
        ? getClassicRightBoundary(toolbar, toolbarLeft)
        : getGutenbergRightBoundary(toolbar, toolbarLeft);

    toolbar.style.width = previous.width;
    toolbar.style.maxWidth = previous.maxWidth;
    toolbar.style.flexBasis = previous.flexBasis;
    toolbar.style.overflow = previous.overflow;
    toolbar.style.visibility = previous.visibility;

    selsupAdaptiveLayoutInProgress = false;

    return Math.max(0, Math.floor(rightBoundary - toolbarLeft - 12));
  }

  function getRenderedOuterWidth(element) {
    if (!element || element.hidden) return 0;

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const width = Math.max(rect.width, element.scrollWidth || 0);

    return (
      width +
      parseFloat(style.marginLeft || "0") +
      parseFloat(style.marginRight || "0")
    );
  }

  function getAdaptiveToolbarNeededWidth(toolbar) {
    let width = 0;

    Array.from(toolbar.children).forEach(function (child) {
      width += getRenderedOuterWidth(child);
    });

    return Math.ceil(width);
  }

  function getPanelRowsByGroup(panel) {
    if (!panel) return [];

    return Array.from(panel.querySelectorAll("[data-selsup-group]")).filter(
      function (row) {
        return (
          row.closest("#selsup-wrapper-panel, #selsup-wrapper-more-panel") ===
          panel
        );
      },
    );
  }

  function setPanelVisibleGroups(panel, groupKeys) {
    if (!panel) return;

    const visible = new Set(groupKeys || []);

    getPanelRowsByGroup(panel).forEach(function (row) {
      const shouldShow = visible.has(row.dataset.selsupGroup);

      // CHANGE 3.9.1: ставим и hidden, и inline display, чтобы строку не перебил CSS WordPress.
      row.hidden = !shouldShow;
      row.style.display = shouldShow ? "" : "none";
      row.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    });

    panel.dataset.selsupVisibleGroups = Array.from(visible).join(",");
  }

  function syncMorePanelFromToolbar(toolbar, morePanel) {
    if (!toolbar || !morePanel) return [];

    const hiddenGroups = String(toolbar.dataset.selsupHiddenGroups || "")
      .split(",")
      .map(function (groupKey) {
        return groupKey.trim();
      })
      .filter(Boolean);

    setPanelVisibleGroups(morePanel, hiddenGroups);

    if (!hiddenGroups.length) {
      morePanel.hidden = true;
    }

    return hiddenGroups;
  }

  function setHiddenState(element, hidden) {
    if (!element) return;

    element.hidden = hidden;
    element.style.display = hidden ? "none" : "";
    element.setAttribute("aria-hidden", hidden ? "true" : "false");
  }

  function scheduleAdaptiveGutenbergToolbarRefresh(reason) {
    const toolbar = document.getElementById("selsup-wrapper-toolbar");

    if (!toolbar || toolbar.dataset.selsupAdaptive !== "1") return;

    debugLog("schedule adaptive toolbar refresh", reason || "unknown");
    refreshAdaptiveGutenbergToolbarLayout(toolbar);
  }

  function applyAdaptiveGutenbergToolbarLayout(toolbar) {
    if (!toolbar || toolbar.dataset.selsupAdaptive !== "1") return;

    const inlineControls = toolbar.querySelector(
      ".selsup-gutenberg-inline-controls",
    );
    const moreControls = toolbar.querySelector(
      ".selsup-gutenberg-more-controls",
    );
    const collapsedControls = toolbar.querySelector(
      ".selsup-gutenberg-collapsed-controls",
    );
    const morePanel = document.getElementById("selsup-wrapper-more-panel");

    if (!inlineControls || !moreControls || !collapsedControls) return;

    const groups = Array.from(
      inlineControls.querySelectorAll("[data-selsup-group]"),
    );
    const availableWidth = getAdaptiveToolbarAvailableWidth(toolbar);
    const hiddenGroups = [];

    // CHANGE 3.9.4: стартуем с ширины доступного слота.
    // CHANGE 3.9.6: итоговая ширина ещё раз задаётся в finish(), чтобы collapsed-кнопка не стала 0px.
    toolbar.style.maxWidth = Math.max(availableWidth, 1) + "px";
    toolbar.style.width = Math.max(availableWidth, 1) + "px";

    // CHANGE 3.9.2: каждый пересчёт начинается с полного раскрытия inline-controls.
    // Это исправляет случай, когда toolbar свернулся при zoom/page scale, а после восстановления масштаба
    // не возвращался в исходный развернутый вид.
    setHiddenState(inlineControls, false);
    setHiddenState(moreControls, true);
    setHiddenState(collapsedControls, true);

    groups.forEach(function (group) {
      setHiddenState(group, false);
    });

    toolbar.dataset.selsupHiddenGroups = "";
    setPanelVisibleGroups(morePanel, []);

    function fits() {
      return getAdaptiveToolbarNeededWidth(toolbar) <= availableWidth;
    }

    function finish(mode) {
      const neededWidth = getAdaptiveToolbarNeededWidth(toolbar);
      const finalWidth =
        mode === "collapsed"
          ? Math.max(neededWidth, 72)
          : Math.min(Math.max(neededWidth, 1), Math.max(availableWidth, 1));
      const signature = [
        mode,
        availableWidth,
        neededWidth,
        hiddenGroups.join("|"),
      ].join("::");

      // CHANGE 3.9.6: collapsed mode must keep enough real width for the SelSup button.
      // Classic can briefly report 0px while WP recalculates editor rows, but the button should remain visible.
      toolbar.style.maxWidth = finalWidth + "px";
      toolbar.style.width = finalWidth + "px";

      toolbar.dataset.selsupMode = mode;
      toolbar.dataset.selsupHiddenGroups = hiddenGroups.join(",");
      syncMorePanelFromToolbar(toolbar, morePanel);

      if (mode !== "partial" && morePanel) {
        morePanel.hidden = true;
      }

      // CHANGE 3.9.3: даже при включённых логах не спамим одинаковыми строками.
      // Если WordPress/Yoast всё же триггерит лишний resize, в консоли это не превращается
      // в поток одинаковых сообщений.
      if (signature !== selsupLastAdaptiveLayoutSignature) {
        selsupLastAdaptiveLayoutSignature = signature;
        debugLog("adaptive toolbar layout", {
          target: toolbar.dataset.selsupToolbarTarget || "gutenberg",
          mode: mode,
          availableWidth: availableWidth,
          neededWidth: neededWidth,
          hiddenGroups: hiddenGroups.slice(),
        });
      }
    }

    if (fits()) {
      finish("inline");
      return;
    }

    setHiddenState(moreControls, false);

    for (const groupKey of GUTENBERG_COLLAPSE_ORDER) {
      const group = inlineControls.querySelector(
        '[data-selsup-group="' + groupKey + '"]',
      );

      if (!group) continue;

      setHiddenState(group, true);
      hiddenGroups.push(groupKey);

      if (hiddenGroups.length < groups.length && fits()) {
        finish("partial");
        return;
      }
    }

    // CHANGE 3.9.2: если скрыты все группы, это уже не partial.
    // В таком состоянии показываем SelSup ↓ вместо More ↓, чтобы подпись была стабильной и понятной.
    if (hiddenGroups.length < groups.length && fits()) {
      finish("partial");
      return;
    }

    setHiddenState(inlineControls, true);
    setHiddenState(moreControls, true);
    setHiddenState(collapsedControls, false);
    toolbar.dataset.selsupHiddenGroups = "";

    if (morePanel) morePanel.hidden = true;

    finish("collapsed");
  }

  function refreshAdaptiveGutenbergToolbarLayout(toolbar) {
    if (!toolbar || toolbar.dataset.selsupAdaptive !== "1") return;

    window.clearTimeout(selsupAdaptiveToolbarTimer);

    selsupAdaptiveToolbarTimer = window.setTimeout(function () {
      if (!toolbar.isConnected || !isElementRendered(toolbar)) {
        debugLog("skip adaptive toolbar layout: toolbar is not rendered yet");
        return;
      }

      applyAdaptiveGutenbergToolbarLayout(toolbar);
    }, 80);
  }

  function installDevicePixelRatioWatcher(toolbar) {
    function refreshForPixelRatioChange(reason) {
      const currentRatio = window.devicePixelRatio || 1;

      if (
        currentRatio === selsupLastKnownDevicePixelRatio &&
        reason !== "forced"
      )
        return;

      selsupLastKnownDevicePixelRatio = currentRatio;
      debugLog("devicePixelRatio changed", currentRatio);
      refreshAdaptiveGutenbergToolbarLayout(toolbar);
      installDevicePixelRatioWatcher(toolbar);
    }

    try {
      if (selsupDevicePixelRatioMediaQuery) {
        if (
          typeof selsupDevicePixelRatioMediaQuery.removeEventListener ===
          "function"
        ) {
          selsupDevicePixelRatioMediaQuery.removeEventListener(
            "change",
            refreshForPixelRatioChange,
          );
        } else if (
          typeof selsupDevicePixelRatioMediaQuery.removeListener === "function"
        ) {
          selsupDevicePixelRatioMediaQuery.removeListener(
            refreshForPixelRatioChange,
          );
        }
      }
    } catch (error) {}

    try {
      selsupDevicePixelRatioMediaQuery = window.matchMedia(
        "(resolution: " + (window.devicePixelRatio || 1) + "dppx)",
      );

      if (
        typeof selsupDevicePixelRatioMediaQuery.addEventListener === "function"
      ) {
        selsupDevicePixelRatioMediaQuery.addEventListener(
          "change",
          refreshForPixelRatioChange,
        );
      } else if (
        typeof selsupDevicePixelRatioMediaQuery.addListener === "function"
      ) {
        selsupDevicePixelRatioMediaQuery.addListener(
          refreshForPixelRatioChange,
        );
      }
    } catch (error) {
      debugWarn("devicePixelRatio watcher failed", error);
    }
  }

  function installAdaptiveGutenbergToolbarResize(toolbar) {
    if (!toolbar || toolbar.dataset.selsupResizeInstalled === "1") return;

    toolbar.dataset.selsupResizeInstalled = "1";

    window.addEventListener("resize", function () {
      refreshAdaptiveGutenbergToolbarLayout(toolbar);
    });

    window.addEventListener("orientationchange", function () {
      refreshAdaptiveGutenbergToolbarLayout(toolbar);
    });

    // CHANGE 3.9.3: не обновляем layout на focus/visibilitychange.
    // На WordPress-странице эти события могут совпадать с внутренними перерисовками и давать лишние вызовы.

    installDevicePixelRatioWatcher(toolbar);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", function () {
        refreshAdaptiveGutenbergToolbarLayout(toolbar);
      });
    }

    // CHANGE 3.9.4: убраны document click/transitionend listeners.
    // Они вызывали layout от обычной работы редактора. Для адаптации оставлены resize/visualViewport/zoom/ResizeObserver.

    if (window.ResizeObserver) {
      try {
        const observer = new ResizeObserver(function () {
          if (selsupAdaptiveLayoutInProgress) return;
          refreshAdaptiveGutenbergToolbarLayout(toolbar);
        });

        const isClassicToolbar =
          toolbar.dataset.selsupToolbarTarget === "classic";
        const header = isClassicToolbar
          ? document.querySelector("#post-body-content") ||
            toolbar.parentElement
          : getClosestGutenbergHeaderElement(toolbar) || toolbar.parentElement;

        if (header) observer.observe(header);
        // CHANGE 3.9.4: parentElement не наблюдаем, потому что его ширина может меняться от самого toolbar.

        // CHANGE 3.9.5: для Classic наблюдаем только колонки редактора/метабоксов.
        // Для Gutenberg оставляем шапку и правые элементы. body/documentElement не наблюдаем.
        const observedSelectors = isClassicToolbar
          ? [
              // CHANGE 3.9.6: do not observe #wp-content-media-buttons or #wp-content-editor-tools.
              // Those can resize because of the toolbar itself and cause repeated layout recalculation.
              "#post-body-content",
              "#postdivrich",
              "#wp-content-wrap",
              "#postbox-container-1",
              "#side-sortables",
              "#submitdiv",
            ]
          : [
              ".editor-header__settings",
              ".edit-post-header__settings",
              ".interface-pinned-items",
              ".editor-header__center",
              ".edit-post-header__center",
              ".editor-header__title",
            ];

        observedSelectors.forEach(function (selector) {
          document.querySelectorAll(selector).forEach(function (element) {
            try {
              observer.observe(element);
            } catch (error) {}
          });
        });

        toolbar._selsupResizeObserver = observer;
      } catch (error) {
        debugWarn("ResizeObserver failed", error);
      }
    }
  }

  function buildAdaptiveGutenbergToolbar(toolbar, buttonClass) {
    const isClassicToolbar = toolbar.dataset.selsupToolbarTarget === "classic";

    toolbar.classList.add(
      isClassicToolbar
        ? "selsup-classic-adaptive-toolbar"
        : "selsup-gutenberg-adaptive-toolbar",
    );
    toolbar.dataset.selsupAdaptive = "1";

    const fullPanel = createGutenbergPanel(buttonClass);
    const morePanel = createGutenbergMorePanel(buttonClass);

    const inlineControls = document.createElement("span");
    inlineControls.className = "selsup-gutenberg-inline-controls";

    buildControls(inlineControls, buttonClass, false);

    const moreControls = document.createElement("span");
    moreControls.className = "selsup-gutenberg-more-controls";
    moreControls.hidden = true;

    const moreButton = makeButton(
      "More ↓",
      "Open hidden SelSup tools",
      buttonClass,
      function () {
        // CHANGE 3.9.1: перед открытием пересчитываем layout синхронно.
        // Так More ↓ показывает именно скрытые сейчас разделы, а не все кнопки из панели.
        applyAdaptiveGutenbergToolbarLayout(toolbar);
        syncMorePanelFromToolbar(toolbar, morePanel);
        positionGutenbergPanelNearButton(morePanel, moreButton);
        hideGutenbergToolPanels(morePanel);
        morePanel.hidden = !morePanel.hidden;
      },
    );

    styleControl(moreButton, {
      height: "32px",
      minHeight: "32px",
      padding: "0 8px",
    });

    moreControls.appendChild(moreButton);

    const collapsedControls = document.createElement("span");
    collapsedControls.className = "selsup-gutenberg-collapsed-controls";
    collapsedControls.hidden = true;

    const toggleButton = makeButton(
      "SelSup ▾",
      "Open SelSup tools",
      buttonClass,
      function () {
        positionGutenbergPanelNearButton(fullPanel, toggleButton);
        hideGutenbergToolPanels(fullPanel);
        fullPanel.hidden = !fullPanel.hidden;
      },
    );

    styleControl(toggleButton, {
      height: "32px",
      minHeight: "32px",
      padding: "0 8px",
    });

    collapsedControls.appendChild(toggleButton);

    toolbar.appendChild(inlineControls);
    toolbar.appendChild(moreControls);
    toolbar.appendChild(collapsedControls);

    installAdaptiveGutenbergToolbarResize(toolbar);

    window.setTimeout(function () {
      refreshAdaptiveGutenbergToolbarLayout(toolbar);
    }, 0);

    window.setTimeout(function () {
      refreshAdaptiveGutenbergToolbarLayout(toolbar);
    }, 250);
  }

  function createInlineToolbar() {
    const toolbarTarget = getToolbarTarget();

    if (!toolbarTarget) return;

    const existing = document.getElementById("selsup-wrapper-toolbar");

    if (existing) {
      if (!toolbarTarget.target.contains(existing)) {
        if (toolbarTarget.before) {
          toolbarTarget.target.insertBefore(existing, toolbarTarget.before);
        } else {
          toolbarTarget.target.appendChild(existing);
        }
      }

      refreshAdaptiveGutenbergToolbarLayout(existing);
      return;
    }

    const toolbar = document.createElement("span");
    toolbar.id = "selsup-wrapper-toolbar";

    protectGutenbergSelection(toolbar);

    styleControl(toolbar, {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      marginLeft: "6px",
      marginRight: "6px",
      verticalAlign: "middle",
      flexShrink: "1",
      flexWrap: "nowrap",
      minWidth: "0",
      maxWidth: "100%",
      overflow: "hidden",
    });

    const buttonClass =
      toolbarTarget.mode === "classic"
        ? "button"
        : "components-button is-secondary is-compact";
    toolbar.dataset.selsupToolbarTarget =
      toolbarTarget.mode === "classic" ? "classic" : "gutenberg";

    if (toolbarTarget.mode === "gutenberg-header") {
      styleControl(toolbar, {
        minHeight: "40px",
        height: "auto",
        padding: "0 4px",
        marginLeft: "4px",
        marginRight: "0",
        borderLeft: "1px solid #dcdcde",
        background: "transparent",
        flexShrink: "1",
        flexWrap: "nowrap",
        minWidth: "0",
        maxWidth: "100%",
        overflow: "hidden",
      });

      buildAdaptiveGutenbergToolbar(toolbar, buttonClass);
    } else {
      // CHANGE 3.9.5: Classic получает тот же адаптивный механизм, что Gutenberg.
      // На широкой строке показываются кнопки, при нехватке места разделы уходят в More ↓,
      // а при совсем узкой строке остаётся SelSup ▾.
      styleControl(toolbar, {
        minHeight: "32px",
        height: "auto",
        padding: "0",
        marginLeft: "6px",
        marginRight: "0",
        borderLeft: "1px solid #dcdcde",
        background: "transparent",
        flexShrink: "1",
        flexWrap: "nowrap",
        minWidth: "0",
        maxWidth: "100%",
        overflow: "hidden",
      });

      buildAdaptiveGutenbergToolbar(toolbar, buttonClass);
    }

    if (toolbarTarget.before) {
      toolbarTarget.target.insertBefore(toolbar, toolbarTarget.before);
    } else {
      toolbarTarget.target.appendChild(toolbar);
    }

    refreshAdaptiveGutenbergToolbarLayout(toolbar);
    debugLog("toolbar created", toolbarTarget.mode);
  }

  function createLoadedBadge() {
    if (document.getElementById("selsup-wrapper-loaded-badge")) return;

    const badge = document.createElement("div");
    badge.id = "selsup-wrapper-loaded-badge";
    badge.textContent = SELSUP_DEBUG
      ? "SelSup wrappers loaded, debug on"
      : "SelSup wrappers loaded";

    Object.assign(badge.style, {
      position: "fixed",
      right: "18px",
      bottom: "18px",
      zIndex: "2147483647",
      padding: "6px 10px",
      background: SELSUP_DEBUG ? "#d93025" : "#34a853",
      color: "#fff",
      borderRadius: "999px",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      boxShadow: "0 4px 12px rgba(0,0,0,.25)",
    });

    document.body.appendChild(badge);

    setTimeout(function () {
      badge.remove();
    }, 2500);
  }

  function scheduleToolbarRefresh() {
    window.clearTimeout(selsupToolbarRefreshTimer);

    selsupToolbarRefreshTimer = window.setTimeout(function () {
      observeAllEditorDocuments();
      addCssToAdminPage();
      addAdminCss();
      addCssToTinyMce();
      createInlineToolbar();

      const toolbar = document.getElementById("selsup-wrapper-toolbar");

      if (toolbar) {
        refreshAdaptiveGutenbergToolbarLayout(toolbar);
      }
    }, 250);
  }

  function initToolbarObserver() {
    if (toolbarObserver || !document.body) return;

    toolbarObserver = new MutationObserver(function () {
      const toolbarTarget = getToolbarTarget();

      if (!toolbarTarget) return;

      const existing = document.getElementById("selsup-wrapper-toolbar");

      // CHANGE 3.9.3: MutationObserver теперь только восстанавливает toolbar, если Gutenberg его
      // удалил или перенёс. Он больше не пересчитывает layout на каждую мутацию editor/body.
      // Layout пересчитывается через resize, visualViewport, devicePixelRatio и ResizeObserver header.
      if (!existing || !toolbarTarget.target.contains(existing)) {
        scheduleToolbarRefresh();
      }
    });

    toolbarObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function init() {
    if (!document.body) {
      setTimeout(init, 300);
      return;
    }

    debugLog("init", {
      url: location.href,
      isClassicEditorPage: isClassicEditorPage(),
      isGutenbergPage: isGutenbergPage(),
      wpAvailable: !!window.wp,
    });

    observeAllEditorDocuments();
    addCssToAdminPage();
    addAdminCss();
    createInlineToolbar();
    createLoadedBadge();
    initToolbarObserver();

    document.addEventListener(
      "selectionchange",
      scheduleRememberGutenbergSelection,
      true,
    );
    document.addEventListener(
      "mouseup",
      scheduleRememberGutenbergSelection,
      true,
    );
    document.addEventListener(
      "keyup",
      scheduleRememberGutenbergSelection,
      true,
    );
    document.addEventListener(
      "focusin",
      scheduleRememberGutenbergSelection,
      true,
    );

    setTimeout(attachTinyMceCss, 1000);
    setTimeout(attachTinyMceCss, 2500);
  }

  init();
})();
