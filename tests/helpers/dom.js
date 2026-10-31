// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
class ClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...values) {
    values.forEach((value) => this.values.add(value));
    this.owner.className = [...this.values].join(" ");
  }

  contains(value) {
    return this.values.has(value);
  }
}

class Style {
  constructor() {
    this.values = new Map();
  }

  setProperty(key, value) {
    this.values.set(key, value);
  }

  getPropertyValue(key) {
    return this.values.get(key) ?? "";
  }
}

export class TextNode {
  constructor(value, ownerDocument) {
    this.nodeType = 3;
    this.nodeValue = value;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.parentElement = null;
  }
}

export class Element {
  constructor(tagName, ownerDocument) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.parentElement = null;
    this.childNodes = [];
    this.dataset = {};
    this.attributes = new Map();
    this._className = "";
    this.classList = new ClassList(this);
    this.style = new Style();
    this.listeners = new Map();
    this.value = "";
  }

  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) ?? [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }

  async dispatchEvent(event) {
    const callbacks = this.listeners.get(event?.type) ?? [];
    for (const callback of callbacks) await callback.call(this, event);
    return true;
  }

  set className(value) {
    this._className = String(value);
    if (this.classList) this.classList.values = new Set(this._className.split(/\s+/).filter(Boolean));
  }

  get className() {
    return this._className;
  }

  append(...nodes) {
    nodes.forEach((node) => this.#attach(node, false));
  }

  prepend(...nodes) {
    [...nodes].reverse().forEach((node) => this.#attach(node, true));
  }

  #attach(node, first) {
    if (typeof node === "string") node = new TextNode(node, this.ownerDocument);
    node.parentNode = this;
    node.parentElement = this;
    if (first) this.childNodes.unshift(node);
    else this.childNodes.push(node);
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.childNodes = this.parentNode.childNodes.filter((child) => child !== this);
  }

  set textContent(value) {
    this.childNodes = [new TextNode(String(value), this.ownerDocument)];
    this.childNodes[0].parentNode = this;
    this.childNodes[0].parentElement = this;
  }

  get textContent() {
    return this.childNodes.map((child) => child.nodeType === 3 ? child.nodeValue : child.textContent).join("");
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "class") {
      this.className = String(value);
      this.classList.values = new Set(this.className.split(/\s+/).filter(Boolean));
    }
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      this.dataset[key] = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (selector.split(",").some((part) => current.#matches(part.trim()))) return current;
      current = current.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const direct = selector.startsWith(":scope > ");
    const effective = direct ? selector.slice(9) : selector;
    const results = [];
    const visit = (element, depth) => {
      for (const child of element.childNodes) {
        if (child.nodeType !== 1) continue;
        if ((!direct || depth === 0) && child.#matches(effective)) results.push(child);
        if (!direct) visit(child, depth + 1);
      }
    };
    visit(this, 0);
    return results;
  }

  #matches(selector) {
    if (!selector) return false;
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    if (selector.startsWith("[data-") && selector.endsWith("]")) {
      const name = selector.slice(1, -1);
      return this.attributes.has(name) || this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] !== undefined;
    }
    if (selector.startsWith("[contenteditable='true']")) return this.getAttribute("contenteditable") === "true";
    if (selector.includes(".")) {
      const [tag, className] = selector.split(".");
      return this.tagName === tag.toUpperCase() && this.classList.contains(className);
    }
    return this.tagName === selector.toUpperCase();
  }
}

export class FakeDocument {
  createElement(tagName) {
    return new Element(tagName, this);
  }

  createTextNode(value) {
    return new TextNode(value, this);
  }

  createTreeWalker(root, _show, filter) {
    const values = [];
    const visit = (node) => {
      for (const child of node.childNodes ?? []) {
        if (child.nodeType === 3) {
          if (filter.acceptNode(child) === 1) values.push(child);
        } else visit(child);
      }
    };
    visit(root);
    let index = 0;
    return { nextNode: () => values[index++] ?? null };
  }
}

export function elementWithText(tagName, text, document = new FakeDocument()) {
  const element = document.createElement(tagName);
  element.append(document.createTextNode(text));
  return element;
}
