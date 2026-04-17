import * as Comlink from "comlink";
import { VerovioToolkit } from "verovio/esm";
import createModule from "verovio/wasm";

let tk: VerovioToolkit | null = null;

const api = {
  async init() {
    if (!tk) {
      // biome-ignore lint/suspicious/noExplicitAny: Verovio WASM module
      const VerovioModule: any = await createModule();
      tk = new VerovioToolkit(VerovioModule);
    }

    // Return the toolkit instance as a proxy.
    // Comlink.proxy ensures that methods are called on the worker-side instance
    // rather than attempting to clone the complex Emscripten object.
    return Comlink.proxy(tk);
  },
};

export type VerovioWorkerAPI = typeof api;
Comlink.expose(api);
