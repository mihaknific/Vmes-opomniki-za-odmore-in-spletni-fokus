import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = fs.readFileSync(path.join(root, "extension/onboarding/onboarding.js"), "utf8");

function createElement(dataset = {}) {
  const listeners = {};
  const classNames = new Set();
  return {
    dataset,
    listeners,
    attributes: {},
    textContent: "",
    hidden: false,
    classList: {
      toggle(name, force) {
        const enabled = force === undefined ? !classNames.has(name) : force;
        if (enabled) classNames.add(name);
        else classNames.delete(name);
        return enabled;
      }
    },
    addEventListener(type, handler) { listeners[type] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; }
  };
}

function loadOnboarding(sendMessage) {
  const slides = Array.from({ length: 5 }, () => createElement());
  const dots = Array.from({ length: 5 }, () => createElement());
  const startPaths = [createElement({ startPath: "reminders" }), createElement({ startPath: "focus" })];
  const elements = new Map([
    ["step-counter", createElement()],
    ["next", createElement()],
    ["skip", createElement()],
    ["onboarding-error", createElement()]
  ]);
  const document = {
    getElementById: id => elements.get(id),
    querySelectorAll: selector => selector === ".slide" ? slides : selector === ".dots i" ? dots : selector === "[data-start-path]" ? startPaths : [],
    addEventListener() {}
  };
  const navigations = [];
  const browser = {
    runtime: {
      getURL: url => `moz-extension://test/${url}`,
      sendMessage
    },
    storage: { local: { get: async () => ({}) } }
  };
  const context = {
    console: { error() {} },
    document,
    browser,
    window: { location: { replace: url => navigations.push(url), href: "" } }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { elements, startPaths, navigations };
}

const messages = [];
const success = loadOnboarding(async message => {
  messages.push(message);
  return { ok: true };
});
success.startPaths[1].listeners.click();
for (let index = 0; index < 4; index += 1) success.elements.get("next").onclick();
await success.elements.get("next").onclick();
assert.equal(JSON.stringify(messages), JSON.stringify([{ type: "SET_ONBOARDING_COMPLETE" }]));
assert.deepEqual(success.navigations, ["moz-extension://test/options/options.html#focus"]);

const failure = loadOnboarding(async () => { throw new Error("Napaka pri shranjevanju"); });
for (let index = 0; index < 4; index += 1) failure.elements.get("next").onclick();
await failure.elements.get("next").onclick();
assert.equal(failure.elements.get("onboarding-error").hidden, false);
assert.match(failure.elements.get("onboarding-error").textContent, /Napaka pri shranjevanju/);
assert.deepEqual(failure.navigations, []);

console.log("Onboarding tests passed.");
