import process from "process";

declare global {
  interface Window {
    global: typeof globalThis;
    process: typeof process;
  }
}

Object.assign(globalThis, { process });
window.global = globalThis;
window.process = process;
