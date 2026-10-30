/*
 * notebook-state: a notebook is code plus a memory (the kernel).
 * Three Colab-like cells and a "Kernel memory" panel. The student runs the
 * cells in any order, restarts, or deletes cell 1, and sees that memory keeps
 * results, not cells: running cell 2 twice raises the price twice, running a
 * cell before cell 1 is a NameError, and a deleted cell's variables survive
 * until the next restart.
 */
(function () {
  const { el, svg } = HZ;

  const CELLS = [
    { id: 1, lines: ['plan = "Plus"', "monthly_bill = 31.9"] },
    { id: 2, lines: ["# the 5% price rise", "monthly_bill = monthly_bill * 1.05"] },
    { id: 3, lines: ["print(plan, monthly_bill)"] },
  ];
  const NAMES = ["plan", "monthly_bill"];

  const pyRepr = (v) => (typeof v === "string" ? "'" + v + "'" : String(v));
  const pyType = (v) => (typeof v === "string" ? "str" : Number.isInteger(v) ? "int" : "float");

  // Minimal highlighting: comments, strings, numbers, print.
  function codeLine(src) {
    const line = el("span", { class: "hz-notebook-state-line" });
    const re = /(#.*$)|("[^"]*")|(\b\d+(?:\.\d+)?\b)|(\bprint\b)/g;
    let last = 0, m;
    while ((m = re.exec(src))) {
      if (m.index > last) line.append(src.slice(last, m.index));
      const cls = m[1] ? "is-com" : m[2] ? "is-str" : m[3] ? "is-num" : "is-fn";
      line.append(el("span", { class: "hz-notebook-state-tok " + cls, text: m[0] }));
      last = m.index + m[0].length;
    }
    if (last < src.length) line.append(src.slice(last));
    if (!src.length) line.append(" ");
    return line;
  }

  const playIcon = () =>
    svg("svg", { viewBox: "0 0 12 12", width: 12, height: 12, "aria-hidden": "true" }, [svg("path", { d: "M3 1.6 L10.4 6 L3 10.4 Z" })]);

  function badge(type) {
    return el("span", { class: "hz-notebook-state-badge is-" + type, text: type });
  }

  function mount(body) {
    body.classList.add("hz-notebook-state");
    const stage = el("div", { class: "hz-notebook-state-stage" });

    // ---- state
    let mem = new Map();
    let count = 0;
    let order = [];
    let rises = 0; // times cell 2 applied the rise since cell 1 last set the bill
    let deleted = false;
    let busy = false;
    let runId = 0;

    // ---- notebook column
    const cellViews = CELLS.map((c) => {
      const runBtn = el("button", { type: "button", class: "hz-notebook-state-run", "aria-label": "Run cell " + c.id, onclick: () => runOne(c.id) }, [playIcon()]);
      const counter = el("span", { class: "hz-notebook-state-count", text: "[ ]" });
      const code = el("pre", { class: "hz-notebook-state-code" }, c.lines.map(codeLine));
      const out = el("div", { class: "hz-notebook-state-out", "aria-live": "polite" });
      const node = el("div", { class: "hz-notebook-state-cell" }, [
        el("div", { class: "hz-notebook-state-gutter" }, [runBtn, counter]),
        el("div", { class: "hz-notebook-state-main" }, [el("span", { class: "hz-notebook-state-cellno", text: "cell " + c.id }), code, out]),
      ]);
      return { ...c, node, runBtn, counter, code, out };
    });
    const nb = el("div", { class: "hz-notebook-state-nb" }, cellViews.map((v) => v.node));

    // ---- memory column
    const trail = el("p", { class: "hz-notebook-state-trail" });
    const list = el("div", { class: "hz-notebook-state-list", role: "list" });
    const empty = el("p", { class: "hz-notebook-state-empty", text: "Empty. Nothing has run since the kernel started." });
    const rows = new Map();
    const memPanel = el("div", { class: "hz-notebook-state-mem" }, [
      el("div", { class: "hz-notebook-state-memhead" }, [
        el("span", { class: "hz-notebook-state-memtitle", text: "Kernel memory" }),
        el("span", { class: "hz-notebook-state-memsub", text: "what Python remembers right now" }),
      ]),
      list,
      empty,
      trail,
    ]);

    stage.append(el("div", { class: "hz-x__split hz-notebook-state-split" }, [nb, memPanel]));

    // ---- controls + caption
    const runAllBtn = HZ.button("Run all", () => runAll(), "primary");
    const restartBtn = HZ.button("Restart", () => restart());
    const delBtn = HZ.button("Delete cell 1", () => toggleDelete());
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
    const controls = el("div", { class: "hz-x__controls" }, [runAllBtn, restartBtn, delBtn]);

    body.append(
      el("p", { class: "hz-x__lede", html: "Each <strong>▶\uFE0E</strong> button runs one cell. Python keeps what each cell creates in the <strong>kernel memory</strong>, and later cells read from it. Try the cells in different orders, run cell 2 twice, or delete cell 1 and restart." }),
      stage,
      controls,
      note
    );

    const alive = (id) => id === runId && body.isConnected;
    function setBusy(b) {
      busy = b;
      [runAllBtn, restartBtn, delBtn, ...cellViews.map((v) => v.runBtn)].forEach((x) => (x.disabled = b));
    }

    function renderTrail() {
      const steps = order.length ? order.flatMap((n, i) => [i ? " → " : "", el("b", { text: String(n) })]) : [el("span", { text: "none yet" })];
      trail.replaceChildren(el("span", { class: "hz-notebook-state-traillab", text: "Run order since restart: " }), ...steps);
    }
    function renderEmpty() {
      empty.hidden = mem.size > 0;
    }

    function flash(node) {
      node.classList.remove("is-flash");
      void node.offsetWidth;
      node.classList.add("is-flash");
    }

    function makeRow(name, value) {
      const val = el("span", { class: "hz-notebook-state-val", text: pyRepr(value) });
      const was = el("span", { class: "hz-notebook-state-was" });
      const b = badge(pyType(value));
      const row = el("div", { class: "hz-notebook-state-row", role: "listitem" }, [
        el("code", { class: "hz-notebook-state-name", text: name }),
        el("span", { class: "hz-notebook-state-eq", text: "→" }),
        el("span", { class: "hz-notebook-state-valwrap" }, [val, was]),
        b,
      ]);
      return { row, val, was, badge: b };
    }

    // Fly a ghost chip from the code line that created the variable into its memory row.
    async function flyIn(name, value, fromNode, id) {
      const r = makeRow(name, value);
      r.row.style.opacity = "0";
      list.append(r.row);
      rows.set(name, r);
      renderEmpty();
      if (HZ.reducedMotion() || !fromNode.isConnected) {
        r.row.style.opacity = "";
        return;
      }
      const sb = stage.getBoundingClientRect();
      const a = fromNode.getBoundingClientRect();
      const b = r.row.getBoundingClientRect();
      const ghost = el("span", { class: "hz-notebook-state-ghost" }, [el("code", { text: name }), " ", el("span", { text: pyRepr(value) })]);
      stage.append(ghost);
      const x0 = a.left - sb.left, y0 = a.top - sb.top, x1 = b.left - sb.left, y1 = b.top - sb.top;
      await HZ.tween(body, 520, (t) => {
        ghost.style.transform = `translate(${HZ.lerp(x0, x1, t)}px, ${HZ.lerp(y0, y1, t)}px)`;
        ghost.style.opacity = String(t < 0.85 ? 1 : (1 - t) / 0.15);
        r.row.style.opacity = String(Math.max(0, (t - 0.6) / 0.4));
      });
      ghost.remove();
      r.row.style.opacity = "";
      if (alive(id)) flash(r.row);
    }

    function setValue(name, value) {
      const r = rows.get(name);
      const old = mem.get(name);
      mem.set(name, value);
      r.val.textContent = pyRepr(value);
      r.was.textContent = old === value ? "" : "was " + pyRepr(old);
      flash(r.row);
    }

    function writeOut(view, text, isErr) {
      view.out.replaceChildren(el("pre", { class: "hz-notebook-state-outtext" + (isErr ? " is-err" : ""), text }));
      if (!HZ.reducedMotion()) flash(view.out.firstChild);
    }

    // Execute one cell. Returns {ok, msg} where msg feeds the caption.
    async function exec(cellId, id) {
      const v = cellViews[cellId - 1];
      v.counter.textContent = "[*]";
      v.node.classList.add("is-running");
      v.out.replaceChildren();
      await HZ.wait(320);
      if (!alive(id)) return { ok: false, stale: true };
      v.node.classList.remove("is-running");
      count++;
      order.push(cellId);
      v.counter.textContent = "[" + count + "]";
      flash(v.counter);
      renderTrail();

      if (cellId === 1) {
        const prevRises = rises;
        const lines = v.code.querySelectorAll(".hz-notebook-state-line");
        const hadBoth = NAMES.every((n) => mem.has(n));
        const anims = [];
        [["plan", "Plus", lines[0]], ["monthly_bill", 31.9, lines[1]]].forEach(([n, val, line], k) => {
          if (rows.has(n)) setValue(n, val);
          else {
            mem.set(n, val);
            anims.push(HZ.wait(k * 140).then(() => alive(id) && flyIn(n, val, line, id)));
          }
        });
        await Promise.all(anims);
        rises = 0;
        if (hadBoth && prevRises > 0) return { ok: true, msg: "Running cell 1 again put <code>monthly_bill</code> back to 31.9. Re-running a cell overwrites what memory held." };
        if (hadBoth) return { ok: true, msg: "Cell 1 ran again and wrote the same two values over the old ones." };
        return { ok: true, msg: "Cell 1 created two variables: the labels <code>plan</code> and <code>monthly_bill</code> now live in memory, and any later cell can read them." };
      }

      if (cellId === 2) {
        if (!mem.has("monthly_bill")) return nameError(v, "monthly_bill", 2);
        const old = mem.get("monthly_bill");
        setValue("monthly_bill", old * 1.05);
        rises++;
        if (rises === 1) return { ok: true, msg: "Cell 2 read <code>monthly_bill</code> from memory (" + pyRepr(old) + ") and replaced it with " + pyRepr(mem.get("monthly_bill")) + ". Nothing on screen shows the old value any more." };
        return { ok: true, msg: "Cell 2 has run " + rises + " times since cell 1, so the price rose " + rises + " times: now " + pyRepr(mem.get("monthly_bill")) + ". Memory remembers results, not cells." };
      }

      // cell 3
      if (!mem.has("plan")) return nameError(v, "plan", 3);
      if (!mem.has("monthly_bill")) return nameError(v, "monthly_bill", 3);
      writeOut(v, mem.get("plan") + " " + pyRepr(mem.get("monthly_bill")));
      if (rises === 0) return { ok: true, msg: "Cell 3 printed the bill <em>without</em> the rise: cell 2 has not run since cell 1. The output depends on what ran, not on what is written." };
      if (rises === 1) return { ok: true, msg: "Cell 3 printed what memory holds right now: the Plus bill after one 5% rise." };
      return { ok: true, msg: "Cell 3 prints " + pyRepr(mem.get("monthly_bill")) + ", not 33.495: the rise was applied " + rises + " times. Nothing in the code is wrong; the order was." };
    }

    function nameError(v, name, cellId) {
      writeOut(v, "NameError: name '" + name + "' is not defined", true);
      const msg = deleted
        ? "Cell " + cellId + " needs <code>" + name + "</code>, but the only cell that created it was deleted. This is exactly what a teammate sees when they open your notebook. Click <em>Undo delete</em>."
        : "Cell " + cellId + " asked for <code>" + name + "</code>, but memory has no <code>" + name + "</code>: cell 1 has not run since the last restart. Python only knows what has already run.";
      return { ok: false, msg };
    }

    async function runOne(cellId) {
      if (busy) return;
      const id = ++runId;
      setBusy(true);
      const r = await exec(cellId, id);
      if (!alive(id)) return;
      if (r.msg) note.innerHTML = r.msg;
      setBusy(false);
    }

    async function runAll() {
      if (busy) return;
      const id = ++runId;
      setBusy(true);
      let r = { ok: true };
      for (const v of cellViews) {
        if (v.id === 1 && deleted) continue;
        r = await exec(v.id, id);
        if (!alive(id)) return;
        if (!r.ok) break;
        await HZ.wait(180);
        if (!alive(id)) return;
      }
      note.innerHTML = r.ok
        ? (deleted
          ? "It still ran, because memory still had the variables from the deleted cell. Restart first to see the truth."
          : "Run all ran every cell once, top to bottom: the order a teammate or your grader gets. The bill rose exactly once.")
        : r.msg + (deleted ? "" : "");
      setBusy(false);
    }

    async function restart() {
      if (busy) return;
      const id = ++runId;
      setBusy(true);
      const items = [...rows.values()];
      items.forEach((r, k) => {
        r.row.style.transitionDelay = k * 90 + "ms";
        r.row.classList.add("is-leaving");
      });
      cellViews.forEach((v) => {
        v.counter.textContent = "[ ]";
        v.out.replaceChildren();
      });
      if (items.length) await HZ.wait(320 + items.length * 90);
      if (!alive(id)) return;
      list.replaceChildren();
      rows.clear();
      mem = new Map();
      count = 0;
      order = [];
      rises = 0;
      renderTrail();
      renderEmpty();
      memPanel.classList.remove("is-flash");
      void memPanel.offsetWidth;
      memPanel.classList.add("is-flash");
      note.innerHTML = deleted
        ? "Fresh memory, and cell 1 is gone. This is your notebook as a teammate opens it. Click <em>Run all</em> and watch it break."
        : "Restart wipes memory and the counters. The code stays; the results go. <em>Run all</em> rebuilds everything from the top.";
      setBusy(false);
    }

    function toggleDelete() {
      if (busy) return;
      deleted = !deleted;
      const c1 = cellViews[0].node;
      delBtn.textContent = deleted ? "Undo delete" : "Delete cell 1";
      delBtn.setAttribute("aria-pressed", String(deleted));
      if (deleted) {
        c1.classList.add("is-deleting");
        HZ.wait(260).then(() => {
          if (deleted) c1.hidden = true;
        });
        note.innerHTML = mem.size
          ? "Cell 1 is gone, but <code>plan</code> and <code>monthly_bill</code> still live in memory, so cells 2 and 3 keep working. Click <em>Restart</em>, then <em>Run all</em>, to see what a teammate would see."
          : "Cell 1 is gone. Now no cell creates <code>plan</code> or <code>monthly_bill</code>. Try <em>Run all</em>.";
      } else {
        c1.hidden = false;
        void c1.offsetWidth;
        c1.classList.remove("is-deleting");
        note.innerHTML = "Cell 1 is back. Before you share a notebook, <em>Restart</em> and <em>Run all</em>: top to bottom is the only order anyone else will run it in.";
      }
    }

    renderTrail();
    renderEmpty();
    note.innerHTML = "Nothing has run yet, so memory is empty. Run the cells in any order and watch what Python remembers.";
  }

  HZ.register("notebook-state", {
    kicker: "Session 1",
    title: "Cells run in the order you click them",
    mount,
    css: `
.md-typeset .hz-notebook-state-stage { position: relative; }
.md-typeset .hz-notebook-state-split { grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); }
@media (max-width: 52em) { .md-typeset .hz-notebook-state-split { grid-template-columns: minmax(0, 1fr); } }
.md-typeset .hz-notebook-state-nb { display: flex; flex-direction: column; gap: 0.55rem; min-width: 0; }
.md-typeset .hz-notebook-state-cell {
  display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.55rem; align-items: start;
  transition: opacity 240ms ease, transform 240ms ease;
}
.md-typeset .hz-notebook-state-cell.is-deleting { opacity: 0; transform: translateX(-14px); }
.md-typeset .hz-notebook-state-cell[hidden] { display: none; }
.md-typeset .hz-notebook-state-gutter { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding-top: 0.1rem; }
.md-typeset .hz-notebook-state-run {
  display: grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 50%; padding: 0;
  border: 1px solid var(--hz-line); background: var(--md-default-bg-color); color: var(--md-default-fg-color); cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease, transform 100ms ease;
}
.md-typeset .hz-x .hz-notebook-state-run svg { display: block; width: 0.62rem; height: 0.62rem; fill: currentColor; margin-left: 2px; overflow: visible; }
.md-typeset .hz-notebook-state-run:hover { border-color: var(--md-primary-fg-color); color: var(--md-primary-fg-color); }
.md-typeset .hz-notebook-state-run:active { transform: scale(0.94); }
.md-typeset .hz-notebook-state-run:focus-visible { outline: 2px solid var(--md-primary-fg-color); outline-offset: 2px; }
.md-typeset .hz-notebook-state-run[disabled] { opacity: 0.45; cursor: default; }
.md-typeset .hz-notebook-state-count {
  font-family: var(--md-code-font); font-size: 0.62rem; color: var(--hz-muted); font-variant-numeric: tabular-nums; min-width: 2.2em; text-align: center; border-radius: 4px;
}
.md-typeset .hz-notebook-state-cell.is-running .hz-notebook-state-count { color: var(--hz-a); animation: hz-notebook-state-pulse 600ms ease-in-out infinite; }
.md-typeset .hz-notebook-state-cell.is-running .hz-notebook-state-code { border-color: var(--hz-a); }
@keyframes hz-notebook-state-pulse { 50% { opacity: 0.35; } }
.md-typeset .hz-notebook-state-main { position: relative; min-width: 0; }
.md-typeset .hz-notebook-state-cellno { position: absolute; right: 0.55em; top: 0.35em; font-family: var(--md-code-font); font-size: 0.56rem; color: var(--hz-muted); pointer-events: none; }
.md-typeset .hz-notebook-state-code {
  margin: 0; padding: 0.5em 3.6em 0.5em 0.8em; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.72rem; line-height: 1.6;
  background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color); overflow-x: auto;
  transition: border-color 200ms ease;
}
.md-typeset .hz-notebook-state-line { display: block; white-space: pre; }
.md-typeset .hz-notebook-state-tok.is-com { color: var(--hz-muted); font-style: italic; }
.md-typeset .hz-notebook-state-tok.is-str { color: var(--hz-good); }
.md-typeset .hz-notebook-state-tok.is-num { color: var(--hz-b); }
.md-typeset .hz-notebook-state-tok.is-fn { color: var(--hz-a); }
.md-typeset .hz-notebook-state-out:empty { display: none; }
.md-typeset .hz-notebook-state-outtext {
  margin: 0.25rem 0 0; padding: 0.3em 0.8em; font-family: var(--md-code-font); font-size: 0.7rem; line-height: 1.5;
  white-space: pre-wrap; overflow-wrap: anywhere; border-radius: 6px; color: var(--md-default-fg-color); background: transparent;
}
.md-typeset .hz-notebook-state-outtext.is-err { color: var(--hz-bad); background: color-mix(in srgb, var(--hz-bad) 10%, transparent); font-weight: 600; }

.md-typeset .hz-notebook-state-mem {
  display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; padding: 0.7rem 0.8rem; border-radius: 12px;
  border: 1px dashed var(--hz-line); background: var(--md-default-bg-color);
}
.md-typeset .hz-notebook-state-memhead { display: flex; flex-direction: column; }
.md-typeset .hz-notebook-state-memtitle { font-family: var(--md-code-font); font-size: 0.62rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--md-primary-fg-color); }
.md-typeset .hz-notebook-state-memsub { font-size: 0.64rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-notebook-state-list { display: flex; flex-direction: column; gap: 0.35rem; }
.md-typeset .hz-notebook-state-empty { font-size: 0.66rem; color: var(--hz-muted); font-style: italic; }
.md-typeset .hz-notebook-state-row {
  display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: 0.45rem;
  padding: 0.35em 0.55em; border-radius: 8px; border: 1px solid var(--hz-line); background: var(--hz-card);
  transition: opacity 280ms ease, transform 280ms ease;
}
.md-typeset .hz-notebook-state-row.is-leaving { opacity: 0; transform: translateX(16px) scale(0.96); }
.md-typeset .hz-notebook-state-row.is-flash, .md-typeset .hz-notebook-state-mem.is-flash { animation: hz-notebook-state-flash 480ms ease-out; }
.md-typeset .hz-notebook-state-count.is-flash, .md-typeset .hz-notebook-state-outtext.is-flash { animation: hz-notebook-state-flash 480ms ease-out; }
@keyframes hz-notebook-state-flash { 0% { background-color: var(--hz-a-soft); } 100% { } }
.md-typeset .hz-notebook-state-name { font-size: 0.7rem; font-weight: 600; background: transparent; padding: 0; color: var(--md-default-fg-color); }
.md-typeset .hz-notebook-state-eq { color: var(--hz-muted); font-size: 0.7rem; }
.md-typeset .hz-notebook-state-valwrap { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
@media (max-width: 30em) {
  .md-typeset .hz-notebook-state-row { grid-template-columns: auto auto minmax(0, 1fr); }
  .md-typeset .hz-notebook-state-row > :last-child { grid-column: 3; justify-self: start; }
  .md-typeset .hz-notebook-state-val { overflow-wrap: normal; white-space: nowrap; }
}
.md-typeset .hz-notebook-state-val { font-family: var(--md-code-font); font-size: 0.72rem; font-variant-numeric: tabular-nums; color: var(--md-default-fg-color); overflow-wrap: anywhere; }
.md-typeset .hz-notebook-state-was { font-family: var(--md-code-font); font-size: 0.58rem; color: var(--hz-muted); text-decoration: line-through; }
.md-typeset .hz-notebook-state-was:empty { display: none; }
.md-typeset .hz-notebook-state-badge {
  font-family: var(--md-code-font); font-size: 0.6rem; line-height: 1; padding: 0.25em 0.55em; border-radius: 999px; border: 1px solid currentColor;
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.md-typeset .hz-notebook-state-badge.is-int { color: var(--hz-b); }
.md-typeset .hz-notebook-state-badge.is-float { color: var(--hz-a); }
.md-typeset .hz-notebook-state-badge.is-str { color: var(--hz-good); }
.md-typeset .hz-notebook-state-badge.is-bool { color: var(--hz-ink); }
.md-typeset .hz-notebook-state-trail { font-size: 0.64rem; color: var(--md-default-fg-color--light); border-top: 1px solid var(--hz-line); padding-top: 0.45rem; margin-top: 0.1rem; }
.md-typeset .hz-notebook-state-trail b { font-family: var(--md-code-font); color: var(--hz-a); }
.md-typeset .hz-notebook-state-ghost {
  position: absolute; left: 0; top: 0; z-index: 3; pointer-events: none; white-space: nowrap;
  font-family: var(--md-code-font); font-size: 0.7rem; padding: 0.3em 0.6em; border-radius: 8px;
  background: var(--hz-a-soft); border: 1px solid var(--hz-a); color: var(--md-default-fg-color);
  box-shadow: 0 6px 18px -8px color-mix(in srgb, var(--hz-ink) 40%, transparent);
}
.md-typeset .hz-notebook-state-ghost code { background: transparent; padding: 0; font-weight: 600; }
@media (prefers-reduced-motion: reduce) {
  .md-typeset .hz-notebook-state-cell.is-running .hz-notebook-state-count { animation: none; }
}
`,
  });
})();
