const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";
const EDITOR_ATTRIBUTE_PREFIX = "data-editor-";
const MAX_SVG_BYTES = 10 * 1024 * 1024;

const BLOCKED_ELEMENTS = new Set([
  "script", "foreignobject", "iframe", "object", "embed", "audio", "video",
  "canvas", "applet", "animate", "animatemotion", "animatetransform", "set",
]);

const EDITABLE_ELEMENTS = new Set([
  "a", "circle", "ellipse", "image", "line", "path", "polygon", "polyline",
  "rect", "text", "tspan", "use", "g", "symbol", "svg",
]);

const RESERVED_DEFINITION_ELEMENTS = new Set([
  "defs", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "filter",
  "marker", "pattern", "style", "title", "desc", "metadata",
]);

const KNOWN_SVG_ELEMENTS = new Set([
  ...EDITABLE_ELEMENTS,
  ...RESERVED_DEFINITION_ELEMENTS,
  "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix",
  "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood",
  "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge",
  "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting",
  "feSpotLight", "feTile", "feTurbulence", "switch", "view", "marker", "textPath",
]);

function getParser() {
  if (typeof DOMParser === "undefined") throw new Error("SVG parsing is only available in a browser.");
  return new DOMParser();
}

function parseXml(source) {
  if (typeof source !== "string" || !source.trim()) throw new Error("The selected file is empty.");
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
    throw new Error("SVG files containing document types or custom entities are not supported for safety.");
  }
  const document = getParser().parseFromString(source, "image/svg+xml");
  if (document.querySelector("parsererror")) throw new Error("This file does not contain valid SVG XML.");
  const root = document.documentElement;
  if (!root || root.localName !== "svg" || root.namespaceURI !== SVG_NAMESPACE) {
    throw new Error("The uploaded file must have an SVG root element.");
  }
  return document;
}

function safeCssValue(value, warnings) {
  let css = String(value || "");
  css = css.replace(/@import\s+[^;]+;?/gi, () => {
    warnings.push("External CSS imports were removed.");
    return "";
  });
  css = css.replace(/url\(([^)]*)\)/gi, (match, rawUrl) => {
    const url = rawUrl.trim().replace(/^['"]|['"]$/g, "");
    if (url.startsWith("#") || /^data:image\/(png|jpeg|gif|webp);base64,/i.test(url)) return match;
    warnings.push("An external or unsafe CSS resource reference was removed.");
    return "none";
  });
  css = css.replace(/expression\s*\([^)]*\)/gi, () => {
    warnings.push("An unsafe CSS expression was removed.");
    return "";
  });
  return css;
}

function isSafeResourceReference(value) {
  const reference = String(value || "").trim();
  return reference.startsWith("#") || /^data:image\/(png|jpeg|gif|webp);base64,/i.test(reference);
}

function collectElements(root) {
  return [root, ...Array.from(root.querySelectorAll("*") )];
}

function isReservedLayerNode(element) {
  const name = String(element?.localName || "");
  return RESERVED_DEFINITION_ELEMENTS.has(name) || name.startsWith("fe")
    || ["title", "desc", "metadata", "textPath", "view"].includes(name);
}

function isInsideDefinitions(element, root) {
  let current = element;
  while (current && current !== root) {
    if (isReservedLayerNode(current) || current.localName === "symbol") return true;
    current = current.parentElement;
  }
  return false;
}

function setEditorMetadata(root) {
  let idCounter = 0;
  let itemCounter = 0;
  let groupCounter = 0;
  collectElements(root).forEach((element) => {
    if (element === root) {
      element.removeAttribute("data-editor-id");
      element.setAttribute("data-editor-root", "true");
      return;
    }
    idCounter += 1;
    element.setAttribute("data-editor-id", `svg-node-${idCounter}`);
    if (!isInsideDefinitions(element, root)) {
      const label = element.localName === "g"
        ? `Group ${++groupCounter}`
        : `Item ${++itemCounter}`;
      element.setAttribute("data-editor-label", label);
      element.setAttribute("data-editor-label-auto", "true");
    } else if (!element.hasAttribute("data-editor-label")) {
      element.setAttribute("data-editor-label", element.localName);
      element.setAttribute("data-editor-label-auto", "true");
    }
    element.removeAttribute("data-editor-selected");
    element.removeAttribute("data-editor-locked");
  });
}

function sanitizeParsedDocument(document, { assignMetadata = false } = {}) {
  const warnings = [];
  let removedUnsafeElements = 0;
  const root = document.documentElement;
  const elements = collectElements(root).reverse();

  elements.forEach((element) => {
    if (BLOCKED_ELEMENTS.has(element.localName.toLowerCase())) {
      element.remove();
      removedUnsafeElements += 1;
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (attribute.name.startsWith(EDITOR_ATTRIBUTE_PREFIX) && assignMetadata) {
        element.removeAttributeNode(attribute);
        warnings.push("Editor-reserved attributes from the uploaded file were removed.");
        return;
      }
      if (name.startsWith("on") || name === "srcdoc" || name === "xml:base" || name === "formaction") {
        element.removeAttributeNode(attribute);
        warnings.push("Unsafe event or embedded-content attributes were removed.");
        return;
      }

      if (name === "href" || name === "xlink:href") {
        if (!isSafeResourceReference(attribute.value)) {
          element.removeAttributeNode(attribute);
          warnings.push("An external resource or link was removed; embedded data and internal SVG references are retained.");
        }
        return;
      }

      if (name === "style") element.setAttribute(attribute.name, safeCssValue(attribute.value, warnings));
    });

    if (element.localName === "style") {
      element.textContent = safeCssValue(element.textContent, warnings);
    }
  });

  if (!root.hasAttribute("xmlns")) root.setAttribute("xmlns", SVG_NAMESPACE);
  if (!root.hasAttribute("viewBox")) {
    const parseLength = (raw) => {
      const match = String(raw || "").trim().match(/^([0-9]*\.?[0-9]+)(px)?$/i);
      return match ? Number(match[1]) : null;
    };
    const width = parseLength(root.getAttribute("width"));
    const height = parseLength(root.getAttribute("height"));
    if (width > 0 && height > 0) root.setAttribute("viewBox", `0 0 ${width} ${height}`);
    else warnings.push("This SVG has no viewBox and uses non-absolute dimensions. Its original intrinsic proportions may depend on the source application.");
  }
  if (collectElements(root).some((element) => element.hasAttributeNS(XLINK_NAMESPACE, "href")) && !root.hasAttribute("xmlns:xlink")) {
    root.setAttribute("xmlns:xlink", XLINK_NAMESPACE);
  }

  const ids = new Set();
  const duplicateIds = new Set();
  collectElements(root).forEach((element) => {
    const id = element.getAttribute("id");
    if (!id) return;
    if (!ids.has(id)) {
      ids.add(id);
      return;
    }
    duplicateIds.add(id);
    let suffix = 2;
    let replacement = `${id}-duplicate-${suffix}`;
    while (ids.has(replacement)) replacement = `${id}-duplicate-${++suffix}`;
    element.setAttribute("id", replacement);
    ids.add(replacement);
  });
  if (duplicateIds.size) {
    warnings.push(`Duplicate SVG IDs were renamed to make IDs unique (${Array.from(duplicateIds).slice(0, 5).join(", ")}). References to malformed duplicate IDs may need review.`);
  }

  const unsupported = new Set();
  collectElements(root).forEach((element) => {
    if (!KNOWN_SVG_ELEMENTS.has(element.localName) && !element.localName.startsWith("fe")) unsupported.add(element.localName);
  });
  if (unsupported.size) warnings.push(`These SVG element types are preserved but may not have editing controls: ${Array.from(unsupported).join(", ")}.`);
  if (removedUnsafeElements) warnings.push(`${removedUnsafeElements} unsafe or embedded element${removedUnsafeElements === 1 ? " was" : "s were"} removed before preview.`);

  if (assignMetadata) setEditorMetadata(root);
  return { document, warnings };
}

export function parseSvgDocument(source) {
  if (new Blob([source]).size > MAX_SVG_BYTES) throw new Error("SVG files must be 10 MB or smaller.");
  const { document, warnings } = sanitizeParsedDocument(parseXml(source), { assignMetadata: true });
  return { markup: serializeSvgDocument(document.documentElement), warnings };
}

export function parseSvgMarkup(markup) {
  return parseXml(markup);
}

export function serializeSvgDocument(root, { forExport = false } = {}) {
  const copy = root.cloneNode(true);
  if (forExport) {
    collectElements(copy).forEach((element) => {
      Array.from(element.attributes).forEach((attribute) => {
        if (attribute.name.startsWith(EDITOR_ATTRIBUTE_PREFIX)) element.removeAttributeNode(attribute);
      });
    });
  }
  if (!copy.hasAttribute("xmlns")) copy.setAttribute("xmlns", SVG_NAMESPACE);
  const serializer = new XMLSerializer();
  let result = serializer.serializeToString(copy);
  if (forExport && !/^<\?xml/i.test(result)) result = `<?xml version="1.0" encoding="UTF-8"?>\n${result}`;
  // XML declarations are only useful in the downloaded file; they are omitted
  // from the internal markup that the HTML canvas injects as SVG content.
  return result;
}

function makeElementPreview(root, target) {
  const previewRoot = root.cloneNode(false);
  const serializer = new XMLSerializer();
  // Keep all definitions and CSS rules so gradients, masks, and class styling
  // continue to render in the isolated layer preview.
  root.querySelectorAll("defs, style").forEach((node) => {
    previewRoot.appendChild(node.cloneNode(true));
  });

  let branch = target.cloneNode(true);
  const ancestors = [];
  let current = target.parentElement;
  while (current && current !== root) {
    ancestors.push(current);
    current = current.parentElement;
  }
  ancestors.forEach((ancestor) => {
    const wrapper = ancestor.cloneNode(false);
    wrapper.appendChild(branch);
    branch = wrapper;
  });
  previewRoot.appendChild(branch);
  return serializer.serializeToString(previewRoot);
}

function localizedEditorLabel(element, fallback, labels = {}) {
  const label = element.getAttribute("data-editor-label") || fallback;
  const isAutoLabel = element.getAttribute("data-editor-label-auto") === "true";
  const isCopyLabel = element.getAttribute("data-editor-label-copy") === "true";
  const baseLabel = isCopyLabel
    ? (element.getAttribute("data-editor-label-base") || label.replace(/ copy$/i, ""))
    : label;
  const itemMatch = isAutoLabel ? baseLabel.match(/^Item (\d+)$/) : null;
  if (itemMatch && labels.itemLabel) {
    return `${labels.itemLabel} ${itemMatch[1]}${isCopyLabel ? ` ${labels.copySuffix || "copy"}` : ""}`;
  }
  const groupMatch = isAutoLabel ? baseLabel.match(/^Group(?: (\d+))?$/) : null;
  if (groupMatch && labels.groupLabel) {
    const groupNumber = groupMatch[1] ? ` ${groupMatch[1]}` : "";
    return `${labels.groupLabel}${groupNumber}${isCopyLabel ? ` ${labels.copySuffix || "copy"}` : ""}`;
  }
  return isCopyLabel ? `${baseLabel} ${labels.copySuffix || "copy"}` : label;
}

export function getElementTree(markup, labels = {}) {
  const root = parseSvgMarkup(markup).documentElement;
  const counters = { item: 0, group: 0 };
  const makeNode = (element, lockedByAncestor = false, definitionByAncestor = false) => {
    const definition = isReservedLayerNode(element) || element.localName === "symbol";
    if (definition || definitionByAncestor) return null;
    const locked = element.getAttribute("data-editor-locked") === "true";
    const style = element.getAttribute("style") || "";
    const hidden = element.getAttribute("display") === "none"
      || element.getAttribute("visibility") === "hidden"
      || /(?:^|;)\s*display\s*:\s*none\s*(?:;|$)/i.test(style)
      || /(?:^|;)\s*visibility\s*:\s*hidden\s*(?:;|$)/i.test(style);
    const isGroup = element.localName === "g";
    const generatedLabel = isGroup ? `Group ${++counters.group}` : `Item ${++counters.item}`;
    return {
      id: element.getAttribute("data-editor-id") || "svg-root",
      label: localizedEditorLabel(element, generatedLabel, labels),
      tag: element.localName,
      editable: EDITABLE_ELEMENTS.has(element.localName),
      definition: false,
      definitionByAncestor: false,
      locked,
      lockedByAncestor,
      hidden,
      previewMarkup: makeElementPreview(root, element),
      children: Array.from(element.children)
        .map((child) => makeNode(child, lockedByAncestor || locked, false))
        .filter(Boolean),
    };
  };
  return Array.from(root.children).map((child) => makeNode(child)).filter(Boolean);
}

export function getElementByEditorId(root, id) {
  if (!root || !id) return null;
  return collectElements(root).find((element) => element.getAttribute("data-editor-id") === id) || null;
}

function isElementLocked(element) {
  let current = element;
  while (current) {
    if (current.getAttribute?.("data-editor-locked") === "true") return true;
    if (current.localName === "svg" && !current.ownerSVGElement) break;
    current = current.parentElement;
  }
  return false;
}

export function editSvgMarkup(markup, edit) {
  const document = parseSvgMarkup(markup);
  edit(document.documentElement);
  return serializeSvgDocument(document.documentElement);
}

export function exportSvgMarkup(markup) {
  const document = parseSvgMarkup(markup);
  const { document: safeDocument, warnings } = sanitizeParsedDocument(document, { assignMetadata: false });
  const root = safeDocument.documentElement;
  // Keep the SVG viewport equal to its authored viewBox. This clips anything
  // positioned outside the artboard in exported files while leaving it editable
  // and visible outside the artboard in the editor.
  root.setAttribute("overflow", "hidden");
  if (root.style) root.style.setProperty("overflow", "hidden", "important");
  return { markup: serializeSvgDocument(root, { forExport: true }), warnings };
}

export function getUniqueEditorId(root, prefix = "svg-node") {
  const existing = new Set(collectElements(root).map((element) => element.getAttribute("data-editor-id")).filter(Boolean));
  let index = 1;
  while (existing.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

export function getUniqueSvgId(root, base = "svg-copy") {
  const existing = new Set(collectElements(root).map((element) => element.getAttribute("id")).filter(Boolean));
  let index = 1;
  while (existing.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

export function addTextElement(root, textValue = "Your text") {
  const rawViewBox = (root.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
  const viewBox = rawViewBox.length === 4 && rawViewBox.every(Number.isFinite) && rawViewBox[2] > 0 && rawViewBox[3] > 0
    ? rawViewBox
    : [0, 0, Number.parseFloat(root.getAttribute("width")) || 512, Number.parseFloat(root.getAttribute("height")) || 512];
  const [x, y, width, height] = viewBox;
  const labels = collectElements(root).map((element) => Number((element.getAttribute("data-editor-label") || "").match(/^Item (\d+)$/)?.[1] || 0));
  const itemNumber = Math.max(0, ...labels) + 1;
  const element = root.ownerDocument.createElementNS(SVG_NAMESPACE, "text");
  const editorId = getUniqueEditorId(root, "svg-text");
  element.setAttribute("data-editor-id", editorId);
  element.setAttribute("data-editor-label", `Item ${itemNumber}`);
  element.setAttribute("data-editor-label-auto", "true");
  element.setAttribute("x", String(x + width / 2));
  element.setAttribute("y", String(y + height / 2));
  element.setAttribute("font-size", String(Math.max(12, height * 0.08)));
  element.setAttribute("font-family", "Arial, Helvetica, sans-serif");
  element.setAttribute("font-weight", "400");
  element.setAttribute("text-anchor", "middle");
  element.setAttribute("dominant-baseline", "middle");
  element.setAttribute("fill", "#111827");
  element.textContent = String(textValue || "Your text").slice(0, 1000);
  root.appendChild(element);
  return editorId;
}

export function getElementDetails(markup, id, labels = {}) {
  const root = parseSvgMarkup(markup).documentElement;
  const element = getElementByEditorId(root, id);
  if (!element) return null;
  const attributes = Object.fromEntries(Array.from(element.attributes).map((attribute) => [attribute.name, attribute.value]));
  let current = element.parentElement;
  let definitionByAncestor = false;
  while (current && current.localName !== "svg") {
    if (RESERVED_DEFINITION_ELEMENTS.has(current.localName) || current.localName.startsWith("fe") || current.localName === "symbol") {
      definitionByAncestor = true;
      break;
    }
    current = current.parentElement;
  }
  // Inline CSS overrides presentation attributes in SVG, so expose the authored
  // style value to the property controls when one is present.
  String(attributes.style || "").split(";").forEach((declaration) => {
    const separator = declaration.indexOf(":");
    if (separator < 1) return;
    const name = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (name && value) attributes[name] = value;
  });
  return {
    id,
    tag: element.localName,
    label: localizedEditorLabel(element, element.getAttribute("id") || element.localName, labels),
    attributes,
    textContent: element.textContent || "",
    textEditable: ["text", "tspan"].includes(element.localName) && element.children.length === 0,
    editable: EDITABLE_ELEMENTS.has(element.localName),
    definition: definitionByAncestor || RESERVED_DEFINITION_ELEMENTS.has(element.localName) || element.localName.startsWith("fe"),
  };
}

/**
 * The paints (fill / stroke) of one element, as `{ raw, value }`:
 *  - raw   → what the element itself authors ("" when it inherits / uses the default),
 *            i.e. exactly what must be written back to restore this paint;
 *  - value → the effective paint after inheritance from ancestor groups.
 * Used to offer the element's original color as the first swatch.
 */
export function getElementPaint(markup, id) {
  if (!markup || !id) return null;
  const root = parseSvgMarkup(markup).documentElement;
  const element = getElementByEditorId(root, id);
  if (!element) return null;
  const authored = (node, property) => {
    const style = node.getAttribute("style") || "";
    const match = style.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"));
    if (match) return match[1].trim();
    return (node.getAttribute(property) || "").trim();
  };
  const effective = (property, fallback) => {
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const value = authored(node, property);
      if (value && value.toLowerCase() !== "inherit") return value;
    }
    return fallback;
  };
  return {
    fill: { raw: authored(element, "fill"), value: effective("fill", "#000000") },
    stroke: { raw: authored(element, "stroke"), value: effective("stroke", "none") },
  };
}

export function cloneSelectedElements(root, ids) {
  const elements = ids.map((id) => getElementByEditorId(root, id)).filter(Boolean);
  if (!elements.length) throw new Error("Select at least one element to duplicate.");
  if (elements.some(isElementLocked)) throw new Error("Unlock selected elements before duplicating them.");
  const viewBox = (root.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
  const offsetX = viewBox.length === 4 && Number.isFinite(viewBox[2]) ? Math.max(2, Math.min(12, viewBox[2] * 0.015)) : 8;
  const offsetY = viewBox.length === 4 && Number.isFinite(viewBox[3]) ? Math.max(2, Math.min(12, viewBox[3] * 0.015)) : 8;
  const usedEditorIds = new Set(collectElements(root).map((item) => item.getAttribute("data-editor-id")).filter(Boolean));
  let cloneCounter = 1;
  const allocateEditorId = () => {
    let candidate = `svg-copy-node-${cloneCounter++}`;
    while (usedEditorIds.has(candidate)) candidate = `svg-copy-node-${cloneCounter++}`;
    usedEditorIds.add(candidate);
    return candidate;
  };
  const clones = elements.map((element) => {
    const clone = element.cloneNode(true);
    const originalTransform = clone.getAttribute("transform") || "";
    clone.setAttribute("transform", `translate(${offsetX} ${offsetY}) ${originalTransform}`.trim());
    const idMap = new Map();
    collectElements(clone).forEach((item) => {
      const editorId = allocateEditorId();
      item.setAttribute("data-editor-id", editorId);
      const storedLabel = item.getAttribute("data-editor-label") || item.localName;
      const label = item.getAttribute("data-editor-label-copy") === "true"
        ? (item.getAttribute("data-editor-label-base") || storedLabel.replace(/ copy$/i, ""))
        : storedLabel;
      item.setAttribute("data-editor-label-base", label);
      item.setAttribute("data-editor-label-copy", "true");
      item.setAttribute("data-editor-label", `${label} copy`);
      const oldId = item.getAttribute("id");
      if (oldId) {
        const newId = getUniqueSvgId(root, `${oldId}-copy`);
        idMap.set(oldId, newId);
        item.setAttribute("id", newId);
      }
    });
    collectElements(clone).forEach((item) => {
      Array.from(item.attributes).forEach((attribute) => {
        let value = attribute.value;
        idMap.forEach((newId, oldId) => {
          value = value.replaceAll(`url(#${oldId})`, `url(#${newId})`);
          if ((attribute.name === "href" || attribute.name === "xlink:href") && value === `#${oldId}`) value = `#${newId}`;
        });
        item.setAttribute(attribute.name, value);
      });
    });
    return { source: element, clone };
  });
  clones.forEach(({ source, clone }) => source.parentNode?.insertBefore(clone, source.nextSibling));
  return clones.map(({ clone }) => clone.getAttribute("data-editor-id")).filter(Boolean);
}

export function groupSelectedElements(root, ids) {
  const selected = ids.map((id) => getElementByEditorId(root, id)).filter(Boolean);
  if (selected.length < 2) throw new Error("Select two or more sibling elements to group.");
  if (selected.some(isElementLocked)) throw new Error("Unlock selected elements before grouping them.");
  const parent = selected[0].parentNode;
  if (!selected.every((element) => element.parentNode === parent)) {
    throw new Error("Grouping is available when selected elements share the same parent.");
  }
  if (!parent || !["svg", "g", "a", "symbol"].includes(parent.localName)) {
    throw new Error("These elements cannot be grouped safely at this level.");
  }
  const group = root.ownerDocument.createElementNS(SVG_NAMESPACE, "g");
  const siblingOrder = Array.from(parent.children);
  selected.sort((first, second) => siblingOrder.indexOf(first) - siblingOrder.indexOf(second));
  const selectedIndexes = selected.map((element) => siblingOrder.indexOf(element));
  if (selectedIndexes[selectedIndexes.length - 1] - selectedIndexes[0] + 1 !== selectedIndexes.length) {
    throw new Error("Only contiguous sibling elements can be grouped safely without changing the artwork's draw order.");
  }
  const firstSelected = siblingOrder.find((child) => selected.includes(child));
  group.setAttribute("data-editor-id", getUniqueEditorId(root, "svg-group"));
  group.setAttribute("data-editor-label", "Group");
  group.setAttribute("data-editor-label-auto", "true");
  parent.insertBefore(group, firstSelected);
  selected.forEach((element) => group.appendChild(element));
  return group.getAttribute("data-editor-id");
}

export function ungroupElement(root, id) {
  const group = getElementByEditorId(root, id);
  if (!group || group.localName !== "g") throw new Error("Select a group to ungroup.");
  if (isElementLocked(group)) throw new Error("Unlock this group before ungrouping it.");
  const protectedAttributes = Array.from(group.attributes).filter((attribute) =>
    !attribute.name.startsWith(EDITOR_ATTRIBUTE_PREFIX) && attribute.name !== "id"
  );
  if (protectedAttributes.length) {
    throw new Error("This group has transform or presentation attributes. Ungrouping it could change the artwork, so it was not changed.");
  }
  const parent = group.parentNode;
  if (!parent) throw new Error("This group cannot be ungrouped.");
  while (group.firstChild) parent.insertBefore(group.firstChild, group);
  group.remove();
}

export function toggleElementHidden(root, id) {
  const element = getElementByEditorId(root, id);
  if (!element) return;
  const style = element.getAttribute("style") || "";
  const styleHidden = /(?:^|;)\s*display\s*:\s*none\s*(?:;|$)/i.test(style);
  const hidden = element.getAttribute("display") === "none" || styleHidden || element.getAttribute("visibility") === "hidden";
  if (hidden) {
    const previousDisplay = element.getAttribute("data-editor-display-before-hide");
    if (previousDisplay !== null) {
      element.removeAttribute("display");
      if (previousDisplay !== "__absent__") element.setAttribute("display", previousDisplay);
      element.removeAttribute("data-editor-display-before-hide");
    } else if (element.getAttribute("display") === "none") {
      // An initially hidden item has no editor snapshot; reveal only the hiding
      // value instead of deleting a different authored display attribute.
      element.removeAttribute("display");
    }
    if (styleHidden) {
      const nextStyle = style.replace(/(?:^|;)\s*display\s*:\s*none\s*;?/i, "").replace(/^;|;$/g, "");
      if (nextStyle.trim()) element.setAttribute("style", nextStyle);
      else element.removeAttribute("style");
    }
    if (element.getAttribute("visibility") === "hidden") element.setAttribute("visibility", "visible");
    return;
  }
  element.setAttribute("data-editor-display-before-hide", element.hasAttribute("display") ? element.getAttribute("display") : "__absent__");
  element.setAttribute("display", "none");
}

export function reorderElement(root, id, direction) {
  const element = getElementByEditorId(root, id);
  const parent = element?.parentNode;
  if (!element || !parent || !["svg", "g", "a", "symbol"].includes(parent.localName)) {
    throw new Error("This item cannot be reordered safely.");
  }
  if (isElementLocked(element)) throw new Error("Unlock this element before reordering it.");
  const siblings = Array.from(parent.children);
  const index = siblings.indexOf(element);
  if (direction < 0 && index > 0) parent.insertBefore(element, siblings[index - 1]);
  if (direction > 0 && index < siblings.length - 1) parent.insertBefore(siblings[index + 1], element);
}

export function reorderElementRelative(root, sourceId, targetId, after = false) {
  const source = getElementByEditorId(root, sourceId);
  const target = getElementByEditorId(root, targetId);
  if (!source || !target || source === target) return;
  if (isElementLocked(source) || isElementLocked(target)) {
    throw new Error("Unlock these items before changing their order.");
  }
  if (!source.parentNode || source.parentNode !== target.parentNode) {
    throw new Error("Drag items within the same group to change their order.");
  }
  const parent = source.parentNode;
  if (after) parent.insertBefore(source, target.nextSibling);
  else parent.insertBefore(source, target);
}

function isReferencedOutside(root, target) {
  const targetElements = new Set(collectElements(target));
  const ids = collectElements(target).map((element) => element.getAttribute("id")).filter(Boolean);
  if (!ids.length) return false;
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return collectElements(root).some((candidate) => {
    if (targetElements.has(candidate)) return false;
    const values = Array.from(candidate.attributes).map((attribute) => attribute.value);
    if (candidate.localName === "style") values.push(candidate.textContent || "");
    return values.some((value) => ids.some((id) => {
      const escaped = escapeRegExp(id);
      return new RegExp(`#${escaped}(?![\\w.-])`).test(value)
        || new RegExp(`(?:^|\\s)${escaped}(?=$|\\s)`).test(value);
    }));
  });
}

export function deleteSelectedElements(root, ids) {
  const selected = ids.map((id) => getElementByEditorId(root, id)).filter(Boolean);
  if (selected.some(isElementLocked)) throw new Error("Unlock selected elements before deleting them.");
  if (selected.some((element) => element !== root && isReferencedOutside(root, element))) {
    throw new Error("This element is referenced elsewhere in the SVG. Delete or update its references first to avoid breaking the artwork.");
  }
  selected.forEach((element) => {
    if (element !== root && element.parentNode) element.remove();
  });
}

export function renameElement(root, id, label) {
  const element = getElementByEditorId(root, id);
  if (!element) return;
  const cleanLabel = String(label || "").trim().slice(0, 80);
  if (!cleanLabel && element.getAttribute("data-editor-label-auto") === "true") return;
  element.setAttribute("data-editor-label", cleanLabel || element.getAttribute("id") || element.localName);
  element.setAttribute("data-editor-label-auto", "false");
  element.removeAttribute("data-editor-label-copy");
  element.removeAttribute("data-editor-label-base");
}

export function updateElementText(root, id, value) {
  const element = getElementByEditorId(root, id);
  if (!element) return;
  if (isElementLocked(element)) throw new Error("Unlock this element before editing its text.");
  if (!["text", "tspan"].includes(element.localName) || element.children.length > 0) {
    throw new Error("This text node has nested formatting and cannot be edited as a single text value safely.");
  }
  element.textContent = String(value ?? "").slice(0, 1000);
}

export function toggleElementLock(root, id) {
  const element = getElementByEditorId(root, id);
  if (!element) return;
  if (element.getAttribute("data-editor-locked") === "true") element.removeAttribute("data-editor-locked");
  else element.setAttribute("data-editor-locked", "true");
}

export function updateElementAttribute(root, id, name, value) {
  const element = getElementByEditorId(root, id);
  if (!element) return;
  if (isElementLocked(element)) throw new Error("Unlock this element before editing its properties.");
  const numeric = ["x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "stroke-width", "opacity", "fill-opacity", "stroke-opacity", "font-size", "letter-spacing", "word-spacing"].includes(name);
  if (numeric && value !== "" && !Number.isFinite(Number(value))) throw new Error(`${name} must be a valid number.`);

  const style = element.getAttribute("style") || "";
  const cssName = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const styleRule = new RegExp(`(^|;)\\s*${cssName}\\s*:[^;]*`, "i");
  if (styleRule.test(style)) {
    const nextStyle = value === null || value === undefined || value === ""
      ? style.replace(styleRule, "").replace(/^;|;$/g, "")
      : style.replace(styleRule, (match, prefix) => `${prefix}${cssName}:${String(value)}`);
    if (nextStyle.trim()) element.setAttribute("style", nextStyle);
    else element.removeAttribute("style");
    return;
  }
  if (value === null || value === undefined || value === "") element.removeAttribute(name);
  else element.setAttribute(name, String(value));
}

export function updateElementPosition(root, id, axis, value, measuredBounds = null) {
  const element = getElementByEditorId(root, id);
  if (!element) return;
  if (isElementLocked(element)) throw new Error("Unlock this element before moving it.");
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) throw new Error("Position must be a valid number.");
  const base = measuredBounds?.[axis] ?? 0;
  const delta = nextValue - base;
  if (Math.abs(delta) < 0.0001) return;
  const transform = element.getAttribute("transform") || "";
  element.setAttribute("transform", `translate(${axis === "x" ? delta : 0} ${axis === "y" ? delta : 0}) ${transform}`.trim());
}

export function nudgeElement(root, id, dx, dy) {
  const element = getElementByEditorId(root, id);
  if (!element) return;
  if (isElementLocked(element)) throw new Error("Unlock this element before moving it.");
  const x = Number(dx);
  const y = Number(dy);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Position must be a valid number.");
  if (Math.abs(x) < 0.0001 && Math.abs(y) < 0.0001) return;
  const transform = element.getAttribute("transform") || "";
  element.setAttribute("transform", `translate(${x} ${y}) ${transform}`.trim());
}

export function updateElementSize(root, id, dimension, value, measuredBounds = null, keepProportion = false) {
  const element = getElementByEditorId(root, id);
  if (!element) return;
  if (isElementLocked(element)) throw new Error("Unlock this element before resizing it.");
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue < 0) throw new Error("Dimensions must be a non-negative number.");
  const isUniformScale = dimension === "scale";
  const currentValue = isUniformScale
    ? Math.max(measuredBounds?.width || 0, measuredBounds?.height || 0)
    : (measuredBounds?.[dimension] || 0);
  if (!currentValue) throw new Error("This element has no measurable bounds for resizing.");
  const factor = isUniformScale ? nextValue : nextValue / currentValue;
  if (!Number.isFinite(factor) || factor < 0) throw new Error("Dimensions must be a non-negative number.");
  const centerX = (measuredBounds?.x || 0) + (measuredBounds?.width || 0) / 2;
  const centerY = (measuredBounds?.y || 0) + (measuredBounds?.height || 0) / 2;
  const scaleX = isUniformScale || keepProportion || dimension === "width" ? factor : 1;
  const scaleY = isUniformScale || keepProportion || dimension === "height" ? factor : 1;
  const transform = element.getAttribute("transform") || "";
  element.setAttribute("transform", `translate(${centerX} ${centerY}) scale(${scaleX} ${scaleY}) translate(${-centerX} ${-centerY}) ${transform}`.trim());
}

export function rotateElement(root, id, degrees, measuredBounds = null) {
  const element = getElementByEditorId(root, id);
  if (!element) return;
  if (isElementLocked(element)) throw new Error("Unlock this element before rotating it.");
  const value = Number(degrees);
  if (!Number.isFinite(value)) throw new Error("Rotation must be a valid number.");
  const bounds = measuredBounds || { x: 0, y: 0, width: 0, height: 0 };
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const storedRotation = element.getAttribute("data-editor-rotation");
  const transformRotation = (element.getAttribute("transform") || "").match(/rotate\(\s*(-?[\d.]+)/i);
  const current = storedRotation !== null ? Number(storedRotation) : (transformRotation ? Number(transformRotation[1]) : 0);
  const delta = value - current;
  const transform = element.getAttribute("transform") || "";
  element.setAttribute("transform", `rotate(${delta} ${centerX} ${centerY}) ${transform}`.trim());
  element.setAttribute("data-editor-rotation", String(value));
}

export function flipElement(root, id, axis, measuredBounds = null) {
  const element = getElementByEditorId(root, id);
  if (!element) return;
  if (isElementLocked(element)) throw new Error("Unlock this element before flipping it.");
  const bounds = measuredBounds || { x: 0, y: 0, width: 0, height: 0 };
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const transform = element.getAttribute("transform") || "";
  const flipX = axis === "x" ? -1 : 1;
  const flipY = axis === "y" ? -1 : 1;
  element.setAttribute("transform", `translate(${centerX} ${centerY}) scale(${flipX} ${flipY}) translate(${-centerX} ${-centerY}) ${transform}`.trim());
}

/** Apply a coordinated five-color palette across the SVG. The first color becomes the artboard background. */
export function applySvgPalette(root, palette) {
  const colors = Array.isArray(palette?.colors) ? palette.colors.map((color) => String(color || "").toUpperCase()) : [];
  if (colors.length !== 5 || colors.some((color) => !/^#[0-9A-F]{6}$/.test(color))) {
    throw new Error("A palette must contain five six-digit hexadecimal colors.");
  }
  setSolidBackground(root, colors[0]);
  const nodes = collectElements(root).filter((element) => {
    if (element === root || element.hasAttribute("data-editor-background")) return false;
    if (isInsideDefinitions(element, root)) return false;
    return EDITABLE_ELEMENTS.has(element.localName) && element.localName !== "g" && element.localName !== "symbol";
  });
  let shapeIndex = 0;
  let textIndex = 0;
  const cssSet = (element, name, value) => {
    const style = element.getAttribute("style") || "";
    const property = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const re = new RegExp(`(^|;)\\s*${property}\\s*:[^;]*`, "i");
    const next = re.test(style)
      ? style.replace(re, (_match, prefix) => `${prefix}${property}:${value}`)
      : `${style}${style.trim() ? ";" : ""}${property}:${value}`;
    element.setAttribute("style", next);
  };
  const lineOnly = new Set(["line", "polyline"]);
  for (const element of nodes) {
    const tag = element.localName;
    if (tag === "tspan" && element.parentElement?.localName === "text") continue;
    const color = colors[1 + (shapeIndex % 4)];
    const stroke = colors[1 + ((shapeIndex + 1) % 4)];
    if (tag === "text" || tag === "tspan") {
      cssSet(element, "fill", colors[1 + (textIndex % 4)]);
      textIndex += 1;
    } else if (lineOnly.has(tag)) {
      cssSet(element, "stroke", color);
      if (!element.hasAttribute("fill")) cssSet(element, "fill", "none");
    } else if (tag !== "image") {
      cssSet(element, "fill", color);
      cssSet(element, "stroke", stroke);
    } else {
      cssSet(element, "stroke", stroke);
    }
    shapeIndex += 1;
  }
  return root;
}

/* ─── Logo palettes ───────────────────────────────────────────────────────────
   applyLogoPalette(root, { colors: [background, primary, secondary, accent] })
   Unlike applySvgPalette (which cycles five colors through the shapes), this re-colors a logo
   by DOMINANCE: the logo's own colors are ranked by how often they are used, then the most used one
   becomes the primary color, the next the secondary, the next the accent (any further color cycles
   through the three). Near-white paint becomes the palette's background color, so knock-out shapes
   stay knock-outs on dark palettes too. Gradients / patterns (url(...)) and "none" are left alone. */
const NAMED_PAINTS = { white: "#ffffff", black: "#000000" };

function parsePaintToHex(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw === "none" || raw === "transparent" || raw === "currentcolor" || raw === "inherit" || raw.startsWith("url(")) return null;
  if (NAMED_PAINTS[raw]) return NAMED_PAINTS[raw];
  let match = raw.match(/^#([0-9a-f]{3})$/);
  if (match) return `#${match[1].split("").map((ch) => ch + ch).join("")}`;
  match = raw.match(/^#([0-9a-f]{6})$/);
  if (match) return `#${match[1]}`;
  match = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (match) return `#${[match[1], match[2], match[3]].map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0")).join("")}`;
  return null;
}

function hexLuminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/* The paint an element really renders with: its own style / attribute, else the nearest ancestor's, else the default. */
function effectivePaint(element, root, name) {
  for (let current = element; current; current = current.parentElement) {
    const style = current.getAttribute("style") || "";
    const match = style.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i"));
    const own = match ? match[1] : current.getAttribute(name);
    if (own != null && String(own).trim() !== "") return String(own).trim();
    if (current === root) break;
  }
  return name === "fill" ? "#000000" : "none";
}

export function applyLogoPalette(root, palette) {
  const colors = Array.isArray(palette?.colors) ? palette.colors.map((color) => String(color || "").toUpperCase()) : [];
  if (colors.length !== 4 || colors.some((color) => !/^#[0-9A-F]{6}$/.test(color))) {
    throw new Error("A logo palette must contain four six-digit hexadecimal colors.");
  }
  const [background, primary, secondary, accent] = colors;
  const targets = [primary, secondary, accent];
  setSolidBackground(root, background);

  const nodes = collectElements(root).filter((element) => {
    if (element === root || element.hasAttribute("data-editor-background")) return false;
    if (isInsideDefinitions(element, root)) return false;
    return EDITABLE_ELEMENTS.has(element.localName) && element.localName !== "g" && element.localName !== "symbol" && element.localName !== "image";
  });

  // 1. read every element's paints and rank the non-white colors by use (fills count fully, strokes half)
  const uses = [];
  const weight = new Map();
  const order = [];
  for (const element of nodes) {
    for (const prop of ["fill", "stroke"]) {
      if (element.localName === "line" || element.localName === "polyline") { if (prop === "fill") continue; }
      const hex = parsePaintToHex(effectivePaint(element, root, prop));
      if (!hex) continue;
      uses.push({ element, prop, hex });
      if (hexLuminance(hex) > 0.9) continue; // paper
      if (!weight.has(hex)) { weight.set(hex, 0); order.push(hex); }
      weight.set(hex, weight.get(hex) + (prop === "fill" ? 1 : 0.5));
    }
  }
  const ranked = [...order].sort((a, b) => (weight.get(b) - weight.get(a)) || (order.indexOf(a) - order.indexOf(b)));
  const mapped = new Map(ranked.map((hex, index) => [hex, targets[index % targets.length]]));

  // 2. write the new paints
  const cssSet = (element, name, value) => {
    const style = element.getAttribute("style") || "";
    const re = new RegExp(`(^|;)\\s*${name}\\s*:[^;]*`, "i");
    const next = re.test(style)
      ? style.replace(re, (_match, prefix) => `${prefix}${name}:${value}`)
      : `${style}${style.trim() ? ";" : ""}${name}:${value}`;
    element.setAttribute("style", next);
  };
  for (const { element, prop, hex } of uses) {
    cssSet(element, prop, hexLuminance(hex) > 0.9 ? background : mapped.get(hex));
  }
  return root;
}

export function getBackgroundInfo(root) {
  if (!root) return null;
  const bg = root.querySelector('[data-editor-background="true"]');
  if (!bg) return null;
  const type = bg.getAttribute("data-editor-bg-type") || (bg.localName === "image" ? "image" : "solid");
  const rotation = Number(bg.getAttribute("data-editor-bg-rotation") || 0);
  const color = bg.getAttribute("fill") || "#ffffff";
  const color1 = bg.getAttribute("data-editor-bg-color1") || "#3b82f6";
  const color2 = bg.getAttribute("data-editor-bg-color2") || "#9333ea";
  const angle = Number(bg.getAttribute("data-editor-bg-angle") || 90);
  const imageHref = bg.getAttribute("href") || bg.getAttribute("xlink:href") || "";
  const opacity = Number(bg.getAttribute("opacity") || 1);
  return { type, rotation, color, color1, color2, angle, imageHref, opacity };
}

export function setSolidBackground(root, color) {
  const rawViewBox = (root.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
  const viewBox = rawViewBox.length === 4 && rawViewBox.every(Number.isFinite) && rawViewBox[2] > 0 && rawViewBox[3] > 0
    ? rawViewBox
    : [0, 0, Number.parseFloat(root.getAttribute("width")) || 512, Number.parseFloat(root.getAttribute("height")) || 512];
  const [x, y, width, height] = viewBox;

  let bg = root.querySelector('[data-editor-background="true"]');
  if (bg && bg.localName !== "rect") {
    bg.remove();
    bg = null;
  }
  if (!bg) {
    bg = root.ownerDocument.createElementNS(SVG_NAMESPACE, "rect");
    bg.setAttribute("data-editor-background", "true");
    const defs = root.querySelector("defs");
    if (defs && defs.nextSibling) {
      root.insertBefore(bg, defs.nextSibling);
    } else if (root.firstChild) {
      root.insertBefore(bg, root.firstChild);
    } else {
      root.appendChild(bg);
    }
  }
  bg.setAttribute("data-editor-bg-type", "solid");
  bg.setAttribute("x", String(x));
  bg.setAttribute("y", String(y));
  bg.setAttribute("width", String(width));
  bg.setAttribute("height", String(height));
  bg.setAttribute("fill", color);
  bg.setAttribute("pointer-events", "none");
  return bg;
}

export function setGradientBackground(root, color1, color2, angle = 90) {
  const rawViewBox = (root.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
  const viewBox = rawViewBox.length === 4 && rawViewBox.every(Number.isFinite) && rawViewBox[2] > 0 && rawViewBox[3] > 0
    ? rawViewBox
    : [0, 0, Number.parseFloat(root.getAttribute("width")) || 512, Number.parseFloat(root.getAttribute("height")) || 512];
  const [x, y, width, height] = viewBox;

  let defs = root.querySelector("defs");
  if (!defs) {
    defs = root.ownerDocument.createElementNS(SVG_NAMESPACE, "defs");
    root.insertBefore(defs, root.firstChild);
  }

  let grad = defs.querySelector("#svg-editor-bg-gradient");
  if (!grad) {
    grad = root.ownerDocument.createElementNS(SVG_NAMESPACE, "linearGradient");
    grad.setAttribute("id", "svg-editor-bg-gradient");
    defs.appendChild(grad);
  }
  while (grad.firstChild) {
    grad.removeChild(grad.firstChild);
  }
  const rad = ((angle % 360) * Math.PI) / 180;
  // Standard CSS linear-gradient angle convention:
  // 0 deg: bottom to top, 90 deg: left to right, 180 deg: top to bottom
  const x1 = Math.round(50 - Math.sin(rad) * 50);
  const y1 = Math.round(50 + Math.cos(rad) * 50);
  const x2 = Math.round(50 + Math.sin(rad) * 50);
  const y2 = Math.round(50 - Math.cos(rad) * 50);
  grad.setAttribute("x1", `${x1}%`);
  grad.setAttribute("y1", `${y1}%`);
  grad.setAttribute("x2", `${x2}%`);
  grad.setAttribute("y2", `${y2}%`);

  const stop1 = root.ownerDocument.createElementNS(SVG_NAMESPACE, "stop");
  stop1.setAttribute("offset", "0%");
  stop1.setAttribute("stop-color", color1);
  stop1.setAttribute("stop-opacity", "1");
  stop1.setAttribute("style", `stop-color:${color1};stop-opacity:1;`);
  const stop2 = root.ownerDocument.createElementNS(SVG_NAMESPACE, "stop");
  stop2.setAttribute("offset", "100%");
  stop2.setAttribute("stop-color", color2);
  stop2.setAttribute("stop-opacity", "1");
  stop2.setAttribute("style", `stop-color:${color2};stop-opacity:1;`);
  grad.appendChild(stop1);
  grad.appendChild(stop2);

  let bg = root.querySelector('[data-editor-background="true"]');
  if (bg && bg.localName !== "rect") {
    bg.remove();
    bg = null;
  }
  if (!bg) {
    bg = root.ownerDocument.createElementNS(SVG_NAMESPACE, "rect");
    bg.setAttribute("data-editor-background", "true");
    if (defs.nextSibling) {
      root.insertBefore(bg, defs.nextSibling);
    } else {
      root.appendChild(bg);
    }
  }
  bg.setAttribute("data-editor-bg-type", "gradient");
  bg.setAttribute("data-editor-bg-color1", color1);
  bg.setAttribute("data-editor-bg-color2", color2);
  bg.setAttribute("data-editor-bg-angle", String(angle));
  bg.setAttribute("x", String(x));
  bg.setAttribute("y", String(y));
  bg.setAttribute("width", String(width));
  bg.setAttribute("height", String(height));
  bg.setAttribute("fill", "url(#svg-editor-bg-gradient)");
  bg.setAttribute("pointer-events", "none");
  return bg;
}

export function setImageBackground(root, dataUrl, opacity = 1) {
  const rawViewBox = (root.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
  const viewBox = rawViewBox.length === 4 && rawViewBox.every(Number.isFinite) && rawViewBox[2] > 0 && rawViewBox[3] > 0
    ? rawViewBox
    : [0, 0, Number.parseFloat(root.getAttribute("width")) || 512, Number.parseFloat(root.getAttribute("height")) || 512];
  const [x, y, width, height] = viewBox;

  let bg = root.querySelector('[data-editor-background="true"]');
  if (bg && bg.localName !== "image") {
    bg.remove();
    bg = null;
  }
  if (!bg) {
    bg = root.ownerDocument.createElementNS(SVG_NAMESPACE, "image");
    bg.setAttribute("data-editor-background", "true");
    const defs = root.querySelector("defs");
    if (defs && defs.nextSibling) {
      root.insertBefore(bg, defs.nextSibling);
    } else if (root.firstChild) {
      root.insertBefore(bg, root.firstChild);
    } else {
      root.appendChild(bg);
    }
  }
  bg.setAttribute("data-editor-bg-type", "image");
  bg.setAttribute("href", dataUrl);
  bg.setAttribute("x", String(x));
  bg.setAttribute("y", String(y));
  bg.setAttribute("width", String(width));
  bg.setAttribute("height", String(height));
  bg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  bg.setAttribute("opacity", String(opacity));
  bg.setAttribute("pointer-events", "none");
  return bg;
}

export function rotateBackground(root, angle) {
  const bg = root.querySelector('[data-editor-background="true"]');
  if (!bg) return false;
  const rawViewBox = (root.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
  const viewBox = rawViewBox.length === 4 && rawViewBox.every(Number.isFinite) && rawViewBox[2] > 0 && rawViewBox[3] > 0
    ? rawViewBox
    : [0, 0, Number.parseFloat(root.getAttribute("width")) || 512, Number.parseFloat(root.getAttribute("height")) || 512];
  const [x, y, width, height] = viewBox;
  const cx = x + width / 2;
  const cy = y + height / 2;
  bg.setAttribute("data-editor-bg-rotation", String(angle));
  if (angle === 0) {
    bg.removeAttribute("transform");
  } else {
    bg.setAttribute("transform", `rotate(${angle} ${cx} ${cy})`);
  }
  return true;
}

export function removeBackground(root) {
  const bg = root.querySelector('[data-editor-background="true"]');
  if (bg) bg.remove();
  const grad = root.querySelector("#svg-editor-bg-gradient");
  if (grad) grad.remove();
  return true;
}

