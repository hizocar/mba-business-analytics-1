/*
 * Makes the Python on the site runnable and editable in the browser.
 *
 * - Notebook pages (mkdocs-jupyter): every code cell gets a run button, its
 *   code becomes editable, and a toolbar offers Run all / Restart / Colab.
 *   All cells of a page share one namespace, like a Jupyter kernel.
 * - Markdown pages: ```python blocks get a Run button.
 *
 * Python itself runs in pyworker.js (Pyodide in a Web Worker).
 */
(function () {
  const WORKER_URL = new URL("pyworker.js", document.currentScript.src).href;
  const REPO = "hizocar/mba-business-analytics-1";

  let worker = null;
  let nextId = 1;
  const cells = new Map(); // id -> {out, cell, resolve}
  let kernelState = "off"; // off | loading | busy | ready
  let kernelText = "";
  const toolbars = new Set();

  function startWorker() {
    worker = new Worker(WORKER_URL);
    worker.onmessage = (e) => onMessage(e.data);
    worker.onerror = (e) => {
      e.preventDefault();
      worker.terminate();
      worker = null; // the next ▶ starts a fresh download
      for (const [id, job] of cells) {
        render(job.out, { kind: "error", traceback: "Python could not be downloaded. Check your connection and press ▶ to try again." });
        cells.delete(id);
        job.resolve(false);
      }
      setStatus("off", "Python could not be downloaded. Check your connection and try again.");
    };
  }

  function restart() {
    if (worker) worker.terminate();
    worker = null;
    for (const job of cells.values()) {
      job.cell && job.cell.classList.remove("is-running", "is-queued");
      job.resolve(false);
    }
    cells.clear();
    execCount.clear();
    document.querySelectorAll(".hz-run-count").forEach((n) => (n.textContent = " "));
    setStatus("off", "Restarted. Variables were cleared.");
  }

  function onMessage(msg) {
    if (msg.type === "status") return setStatus(msg.state, msg.text);
    const job = cells.get(msg.id);
    if (!job) return; // the page that asked for it is gone
    if (msg.type === "output") render(job.out, msg);
    if (msg.type === "done") {
      cells.delete(msg.id);
      job.resolve(msg.ok);
    }
  }

  function setStatus(state, text) {
    if (state === "ready" && cells.size > 0) state = "busy";
    kernelState = state;
    kernelText = state === "ready" ? "Python ready · variables persist between cells" : text;
    toolbars.forEach((t) => (t.isConnected ? paintToolbar(t) : toolbars.delete(t)));
  }

  // ---------- running code ----------

  const execCount = new Map(); // page -> counter

  // Hyperparameter searches fit hundreds of models; WebAssembly runs them on one core.
  const SLOW = /\b(GridSearchCV|RandomizedSearchCV)\s*\(/;

  function run({ code, page, out, cell, inputs }) {
    if (!worker) startWorker();
    const id = nextId++;
    out.replaceChildren();
    out.hidden = false;
    if (SLOW.test(code)) {
      const note = el("p", "hz-run-slow", ["⏳ This cell trains many models. In the browser it can take several minutes (Colab is faster for this one)."]);
      out.append(note);
    }
    cell && cell.classList.add("is-queued");
    return new Promise((resolve) => {
      cells.set(id, {
        out,
        cell,
        resolve: (ok) => {
          cell && cell.classList.remove("is-running", "is-queued");
          resolve(ok);
        },
      });
      if (cell) {
        const n = (execCount.get(page) || 0) + 1;
        execCount.set(page, n);
        const count = cell.querySelector(".hz-run-count");
        if (count) count.textContent = n;
      }
      worker.postMessage({ type: "run", id, page, code, inputs: inputs || [] });
    }).finally(() => cell && cell.classList.remove("is-running"));
  }

  function outputChild(node) {
    return el("div", "jp-OutputArea-child", [el("div", "jp-OutputPrompt jp-OutputArea-prompt"), node]);
  }

  function render(out, msg) {
    const job = [...cells.values()].find((j) => j.out === out);
    if (job && job.cell) job.cell.classList.replace("is-queued", "is-running");
    if (msg.kind === "stream") {
      // Consecutive prints go into the same <pre>, like Jupyter.
      const last = out.lastElementChild;
      const pre = last && last.dataset.stream === msg.name ? last.querySelector("pre") : null;
      if (pre) return pre.append(msg.text);
      const box = el("div", "jp-RenderedText jp-OutputArea-output" + (msg.name === "stderr" ? " hz-run-stderr" : ""));
      box.append(el("pre", null, [msg.text]));
      const child = outputChild(box);
      child.dataset.stream = msg.name;
      return out.append(child);
    }
    if (msg.kind === "error") {
      const box = el("div", "jp-RenderedText jp-OutputArea-output hz-run-error");
      box.append(el("pre", null, [msg.traceback.trim() || msg.ename + ": " + msg.evalue]));
      return out.append(outputChild(box));
    }
    if (msg.mime === "image/png") {
      const img = el("img");
      img.src = "data:image/png;base64," + msg.data;
      img.alt = "Chart produced by this cell";
      const box = el("div", "jp-RenderedImage jp-OutputArea-output");
      box.append(img);
      return out.append(outputChild(box));
    }
    if (msg.mime === "text/html") {
      const box = el("div", "jp-RenderedHTMLCommon jp-RenderedHTML jp-OutputArea-output hz-run-html");
      box.innerHTML = msg.data;
      return out.append(outputChild(box));
    }
    const box = el("div", "jp-RenderedText jp-OutputArea-output");
    box.append(el("pre", null, [msg.data]));
    out.append(outputChild(box));
  }

  // input() can't block a Web Worker, so answers are collected before the run.
  function promptsIn(code) {
    // Blank out comments and string literals (same length, so positions still
    // match) so that "input(" inside a chart title or a comment is not a call.
    const bare = code.replace(/#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, (s) =>
      s.startsWith("#") ? " ".repeat(s.length) : s[0] + " ".repeat(s.length - 2) + s[s.length - 1]
    );
    const found = [];
    const re = /(^|[^\w.])input\s*\(/g;
    let m;
    while ((m = re.exec(bare))) {
      const literal = /^\s*(['"])(.*?)\1/.exec(code.slice(re.lastIndex));
      found.push(literal ? literal[2] : "input()");
    }
    return found;
  }

  function askInputs(out, prompts) {
    return new Promise((resolve) => {
      const form = el("form", "hz-run-inputs");
      form.append(el("p", null, ["This cell asks for input. Type your answers, then run it."]));
      const fields = prompts.map((p) => {
        const input = el("input");
        input.type = "text";
        input.required = true;
        const label = el("label", null, [el("span", null, [p.trim()]), input]);
        form.append(label);
        return input;
      });
      const go = el("button", "hz-run-btn hz-run-btn--primary", ["▶ Run with these answers"]);
      go.type = "submit";
      form.append(go);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        resolve(fields.map((f) => f.value));
      });
      out.replaceChildren(form);
      out.hidden = false;
      fields[0].focus();
    });
  }

  async function runWithInputs(opts) {
    const prompts = promptsIn(opts.code);
    if (prompts.length) opts.inputs = await askInputs(opts.out, prompts);
    return run(opts);
  }

  // ---------- notebook pages ----------

  function pageKey() {
    return location.pathname;
  }

  function colabUrl() {
    // A notebook at docs/<folder>/<Name>.ipynb is served at /<folder>/<Name>/
    const m = /\/(sessions|case)\/([^/]+)\/?$/.exec(location.pathname);
    return m ? `https://colab.research.google.com/github/${REPO}/blob/main/docs/${m[1]}/${m[2]}.ipynb` : null;
  }

  function enhanceNotebook(wrapper) {
    const inputs = [...wrapper.querySelectorAll(".jp-CodeCell > .jp-Cell-inputWrapper")];
    if (!inputs.length) return;
    const page = pageKey();
    const runners = inputs.map((inputWrapper) => enhanceCell(inputWrapper, page));

    async function runAll() {
      for (const r of runners) {
        const ok = await r.run();
        // Cells that fail on purpose (their saved output is an error) don't stop the run.
        if (!ok && !r.expectsError) {
          r.cell.scrollIntoView({ behavior: "smooth", block: "center" });
          break;
        }
      }
    }
    wrapper.prepend(toolbar(runAll));
    // Start downloading Python as soon as someone reaches for a cell.
    const warm = () => {
      if (!worker) {
        startWorker();
        worker.postMessage({ type: "warm" });
      }
    };
    wrapper.addEventListener("pointerover", (e) => e.target.closest(".hz-run-cell") && warm(), { passive: true });
    wrapper.addEventListener("focusin", warm);
  }

  function enhanceCell(inputWrapper, page) {
    const cell = inputWrapper.parentElement;
    const pre = inputWrapper.querySelector(".highlight-ipynb pre");
    const prompt = inputWrapper.querySelector(".jp-InputPrompt");
    const staticOut = cell.querySelector(":scope > .jp-Cell-outputWrapper");
    cell.classList.add("hz-run-cell");

    pre.contentEditable = "plaintext-only";
    if (pre.contentEditable !== "plaintext-only") pre.contentEditable = "true";
    pre.spellcheck = false;
    pre.setAttribute("aria-label", "Python code, editable");

    const btn = el("button", "hz-run-play", [playIcon()]);
    btn.type = "button";
    btn.title = "Run this cell (Shift+Enter)";
    btn.setAttribute("aria-label", "Run this cell");
    const count = el("span", "hz-run-count", [" "]);
    prompt.replaceChildren(btn, count);

    const wrap = el("div", "jp-Cell-outputWrapper hz-run-live");
    const out = el("div", "jp-OutputArea jp-Cell-outputArea");
    wrap.append(el("div", "jp-Collapser jp-OutputCollapser jp-Cell-outputCollapser"), out);
    wrap.hidden = true;
    cell.append(wrap);

    const code = () => pre.innerText.replace(/ /g, " ").replace(/\n$/, "");
    async function go() {
      if (staticOut) staticOut.hidden = true;
      wrap.hidden = false;
      return runWithInputs({ code: code(), page, out, cell });
    }
    btn.addEventListener("click", go);
    pre.addEventListener("keydown", (e) => onEditorKey(e, go, cell));
    const expectsError = !!(staticOut && staticOut.querySelector('[data-mime-type="application/vnd.jupyter.stderr"]'));
    return { run: go, cell, expectsError };
  }

  function onEditorKey(e, go, cell) {
    if (e.key === "Enter" && (e.shiftKey || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      go();
      if (e.shiftKey && cell) {
        let next = cell.closest(".jp-Notebook-cell");
        do next = next && next.nextElementSibling;
        while (next && !next.querySelector(".hz-run-cell pre"));
        if (next) next.querySelector(".hz-run-cell pre").focus();
      }
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      document.execCommand("insertText", false, "    ");
    }
  }

  function toolbar(runAll) {
    const bar = el("div", "hz-run-bar");
    bar.innerHTML = `
      <span class="hz-run-dot" aria-hidden="true"></span>
      <span class="hz-run-status" role="status"></span>
      <span class="hz-run-actions">
        <button type="button" class="hz-run-btn hz-run-btn--primary" data-act="all">▶ Run all</button>
        <button type="button" class="hz-run-btn" data-act="restart">Restart</button>
      </span>`;
    const colab = colabUrl();
    if (colab) {
      const a = el("a", "hz-run-btn", ["Open in Colab ↗"]);
      a.href = colab;
      a.target = "_blank";
      a.rel = "noopener";
      bar.querySelector(".hz-run-actions").append(a);
    }
    bar.querySelector('[data-act="all"]').addEventListener("click", runAll);
    bar.querySelector('[data-act="restart"]').addEventListener("click", restart);
    toolbars.add(bar);
    paintToolbar(bar);
    return bar;
  }

  function paintToolbar(bar) {
    bar.dataset.state = kernelState;
    bar.querySelector(".hz-run-status").textContent =
      kernelState === "off" && !kernelText
        ? "Every cell runs here, in your browser. Edit any code and press ▶ (or Shift+Enter)."
        : kernelText;
  }

  // ---------- Markdown pages ----------

  function enhanceMarkdownBlock(block) {
    const pre = block.querySelector("pre");
    const codeEl = pre && pre.querySelector("code");
    if (!codeEl || block.closest(".jupyter-wrapper")) return;
    block.classList.add("hz-run-md");
    codeEl.contentEditable = "plaintext-only";
    if (codeEl.contentEditable !== "plaintext-only") codeEl.contentEditable = "true";
    codeEl.spellcheck = false;

    const out = el("div", "hz-run-mdout");
    out.hidden = true;
    const btn = el("button", "hz-run-btn hz-run-btn--primary hz-run-mdbtn", ["▶ Run"]);
    btn.type = "button";
    const go = () => runWithInputs({ code: codeEl.innerText.replace(/ /g, " "), page: pageKey(), out });
    btn.addEventListener("click", go);
    codeEl.addEventListener("keydown", (e) => onEditorKey(e, go, null));
    block.after(out);
    block.append(btn);
  }

  // ---------- helpers ----------

  function el(tag, cls, children) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (children) n.append(...children);
    return n;
  }

  function playIcon() {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 16 16");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = '<path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z"/>';
    return s;
  }

  function enhance() {
    document.querySelectorAll(".jupyter-wrapper:not([data-hz-run])").forEach((w) => {
      w.dataset.hzRun = "1";
      enhanceNotebook(w);
    });
    document
      .querySelectorAll(".md-content .language-python.highlight:not([data-hz-run])")
      .forEach((b) => {
        b.dataset.hzRun = "1";
        enhanceMarkdownBlock(b);
      });
  }

  if (typeof document$ !== "undefined") document$.subscribe(enhance);
  else document.addEventListener("DOMContentLoaded", enhance);
})();
