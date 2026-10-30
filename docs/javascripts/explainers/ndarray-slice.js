/*
 * ndarray-slice: arr[rows, cols] and boolean masks on a 5x5 NumPy array.
 * Selected cells light up in the order they appear in the result; a mask
 * first shows its True/False grid, then keeps the True cells.
 */
(function () {
  const { el, svg } = HZ;

  const R = 5, C = 5;
  const val = (r, c) => r * C + c + 1;
  const PRESETS = ["arr[2, 3]", "arr[1:3, :]", "arr[:, 0]", "arr[-1]", "arr[::2, ::2]", "arr[1:4, 1:4]", "arr[arr > 15]", "arr[arr % 2 == 0]"];

  // Geometry
  const CS = 46, PAD = 4, L = 30, T = 28;
  const W = L + C * CS, H = T + R * CS;
  const cellX = (c) => L + c * CS + PAD / 2;
  const cellY = (r) => T + r * CS + PAD / 2;

  function evalInt(src) {
    const s = src.replace(/len\s*\(\s*arr\s*\)/g, String(R)).replace(/\s+/g, "");
    if (/^[+-]*\d+([+-]+\d+)*$/.test(s)) {
      let total = 0;
      s.replace(/([+-]*)(\d+)/g, (_, signs, num) => {
        total += ((signs.match(/-/g) || []).length % 2 ? -1 : 1) * parseInt(num, 10);
      });
      return total;
    }
    if (/^[+-]?\d*\.\d*$/.test(s) && /\d/.test(s)) throw { kind: "float" };
    if (/^[A-Za-z_]\w*$/.test(s)) throw { kind: "name", name: s };
    throw { kind: "syntax" };
  }

  // Python slice semantics on an axis of length n
  function sliceAxis(a, b, step, n) {
    const lower = step < 0 ? -1 : 0, upper = step < 0 ? n - 1 : n;
    const norm = (v, d) => (v === null ? d : v < 0 ? Math.max(v + n, lower) : Math.min(v, upper));
    const s = norm(a, step < 0 ? upper : lower), e = norm(b, step < 0 ? lower : upper);
    const out = [];
    for (let i = s; step > 0 ? i < e : i > e; i += step) out.push(i);
    return out;
  }

  function parseAxis(src, axis, n) {
    const t = src.trim();
    if (t.includes(":")) {
      const parts = t.split(":");
      if (parts.length > 3) throw { kind: "syntax" };
      const [a, b, c] = parts.map((p) => (p.trim() === "" ? null : evalInt(p)));
      const step = c === undefined || c === null ? 1 : c;
      if (step === 0) throw { kind: "step0" };
      return { kind: "slice", idx: sliceAxis(a, b, step, n), a, b, step, src: t };
    }
    if (!t) throw { kind: "syntax" };
    const i = evalInt(t);
    if (i >= n || i < -n) throw { kind: "bounds", i, axis, n };
    return { kind: "int", idx: [i < 0 ? i + n : i], raw: i, src: t };
  }

  const OPS = {
    ">": (x, k) => x > k, ">=": (x, k) => x >= k, "<": (x, k) => x < k,
    "<=": (x, k) => x <= k, "==": (x, k) => x === k, "!=": (x, k) => x !== k,
  };

  function parse(raw) {
    const src = raw.trim();
    const full = { kind: "slice", idx: [0, 1, 2, 3, 4], a: null, b: null, step: 1, src: ":" };
    if (src === "arr") return basic(full, full, 2);
    const m = src.match(/^arr\s*\[([\s\S]*)\]$/);
    if (!m) return { error: "SyntaxError: invalid syntax", hint: "Write it like arr[2, 3] or arr[1:3, :]." };
    const inner = m[1].trim();
    const mm = inner.match(/^\(?\s*arr\s*(?:%\s*(\d+)\s*)?(==|!=|>=|<=|>|<)\s*([+-]?\d+)\s*\)?$/);
    if (mm) {
      const mod = mm[1] ? parseInt(mm[1], 10) : null;
      if (mod === 0) return { error: "ZeroDivisionError", hint: "Modulo by zero is not defined." };
      const k = parseInt(mm[3], 10);
      const f = (v) => OPS[mm[2]](mod ? v % mod : v, k);
      const maskExpr = "arr" + (mod ? " % " + mod : "") + " " + mm[2] + " " + k;
      const cells = [];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (f(val(r, c))) cells.push([r, c]);
      return { kind: "mask", f, maskExpr, cells, shape: [cells.length], values: cells.map(([r, c]) => val(r, c)) };
    }
    try {
      let parts = inner.split(",");
      if (parts.length > 1 && parts[parts.length - 1].trim() === "") parts = parts.slice(0, -1);
      if (parts.length > 2)
        return { error: "IndexError: too many indices for array: array is 2-dimensional, but " + parts.length + " were indexed", hint: "A 2-D array takes at most two indices: arr[row, col]." };
      const rows = parseAxis(parts[0], 0, R);
      const cols = parts.length > 1 ? parseAxis(parts[1], 1, C) : full;
      return basic(rows, cols, parts.length);
    } catch (e) {
      if (e.kind === "bounds")
        return { error: "IndexError: index " + e.i + " is out of bounds for axis " + e.axis + " with size " + e.n, hint: "Each axis has 5 positions: 0 to 4 (or −5 to −1). Axis 0 is rows, axis 1 is columns." };
      if (e.kind === "step0") return { error: "ValueError: slice step cannot be zero", hint: "The step says how far to jump; 0 would never move." };
      if (e.kind === "float")
        return { error: "IndexError: only integers, slices (`:`), ellipsis (`...`), numpy.newaxis (`None`) and integer or boolean arrays are valid indices", hint: "Positions are whole numbers: arr[2, 3], not arr[2.0, 3]." };
      if (e.kind === "name") return { error: "NameError: name '" + e.name + "' is not defined", hint: "Use numbers, slices like 1:3, or a condition like arr > 15." };
      return { error: "SyntaxError: invalid syntax", hint: "Try arr[2, 3], arr[1:3, :] or arr[arr > 15]." };
    }
  }

  function basic(rows, cols, given) {
    const cells = [];
    rows.idx.forEach((r) => cols.idx.forEach((c) => cells.push([r, c])));
    let shape;
    if (rows.kind === "int" && cols.kind === "int") shape = [];
    else if (rows.kind === "int") shape = [cols.idx.length];
    else if (cols.kind === "int") shape = [rows.idx.length];
    else shape = [rows.idx.length, cols.idx.length];
    return { kind: "basic", rows, cols, given, cells, shape, values: cells.map(([r, c]) => val(r, c)) };
  }

  // NumPy's array repr for int64 data (linewidth 75, as in np.array_repr)
  function npRepr(values, shape) {
    if (!shape.length) return String(values[0]);
    if (!values.length) return shape.length === 1 ? "array([], dtype=int64)" : `array([], shape=(${shape.join(", ")}), dtype=int64)`;
    const w = Math.max(...values.map((v) => String(v).length));
    const words = values.map((v) => String(v).padStart(w));
    const line1D = (ws, hang, width) => {
      let s = "", line = hang;
      ws.forEach((word, i) => {
        if (line.length + word.length > width - 1 && line.length > hang.length) {
          s += line.trimEnd() + "\n";
          line = hang;
        }
        line += word + (i < ws.length - 1 ? ", " : "");
      });
      return "[" + (s + line).slice(hang.length) + "]";
    };
    if (shape.length === 1) return "array(" + line1D(words, " ".repeat(7), 74) + ")";
    const rows = [];
    for (let r = 0; r < shape[0]; r++) rows.push(line1D(words.slice(r * shape[1], (r + 1) * shape[1]), " ".repeat(8), 73));
    return "array([" + rows.join(",\n" + " ".repeat(7)) + "])";
  }

  const shapeStr = (s) => "(" + s.join(", ") + (s.length === 1 ? ",)" : ")");
  const listWords = (xs) => (xs.length <= 1 ? String(xs[0]) : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);

  function axisDesc(p, name) {
    if (p.kind === "int") return name + " " + p.idx[0] + (p.raw < 0 ? " (" + p.raw + " counts from the end)" : "");
    if (!p.idx.length) return "no " + name + "s (the slice is empty)";
    if (p.src === ":" || (p.a === null && p.b === null && p.step === 1)) return "every " + name + " (" + "\u201c:\u201d" + ")";
    let s = name + "s " + listWords(p.idx);
    if (p.b !== null && p.step > 0 && p.b >= 0 && p.b < 5) s += " (stop " + p.b + " is excluded, like lists)";
    else if (p.step !== 1) s += " (every " + (Math.abs(p.step) === 2 ? "2nd" : Math.abs(p.step) + "th") + " " + name + ")";
    return s;
  }

  function explain(q) {
    const code = (s) => el("code", { text: s });
    if (q.kind === "mask")
      return [code(q.maskExpr), " is a True/False grid with the same shape (5, 5). Indexing with it keeps the True cells, read row by row, so the result is always 1-D: ", q.cells.length, " values that no longer form a rectangle."];
    const out = ["Before the comma: ", axisDesc(q.rows, "row"), ". After it: ", q.given > 1 ? axisDesc(q.cols, "column") : "nothing, so every column comes along", ". "];
    if (!q.shape.length) out.push("Two single numbers pick one cell, so you get a plain number, not an array.");
    else if (q.shape.length === 1) out.push("A single number on one axis removes that axis, so the result is 1-D with shape ", code(shapeStr(q.shape)), ".");
    else out.push("Both axes are slices, so the result keeps two dimensions: shape ", code(shapeStr(q.shape)), ".");
    return out;
  }

  HZ.register("ndarray-slice", {
    title: "Picking entries of a 2-D array",
    kicker: "Session 1",
    mount(body) {
      body.classList.add("hz-ndarray-slice");
      body.append(
        el("p", { class: "hz-x__lede" }, [
          "Inside the brackets, rows come first and columns second: ",
          el("code", { text: "arr[row, col]" }),
          ". Each part can be a number, a slice like ",
          el("code", { text: "1:3" }),
          ", or ",
          el("code", { text: ":" }),
          " for everything. A True/False condition works too.",
        ]),
        el("pre", { class: "hz-list-index-def", text: "arr = np.arange(1, 26).reshape(5, 5)" })
      );

      // --- Grid
      const fig = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-ndarray-slice-fig", role: "img", "aria-label": "A 5 by 5 array holding the numbers 1 to 25" });
      const colLabels = [], rowLabels = [];
      for (let c = 0; c < C; c++) {
        const t = svg("text", { x: cellX(c) + (CS - PAD) / 2, y: T - 9, "text-anchor": "middle", class: "hz-ndarray-slice-idx", text: String(c) });
        colLabels.push(t);
        fig.append(t);
      }
      for (let r = 0; r < R; r++) {
        const t = svg("text", { x: L - 10, y: cellY(r) + (CS - PAD) / 2 + 4, "text-anchor": "end", class: "hz-ndarray-slice-idx", text: String(r) });
        rowLabels.push(t);
        fig.append(t);
      }
      const cells = [];
      for (let r = 0; r < R; r++) {
        cells.push([]);
        for (let c = 0; c < C; c++) {
          const x = cellX(c), y = cellY(r), s = CS - PAD;
          const g = svg("g", { class: "hz-ndarray-slice-cell" }, [
            svg("rect", { x, y, width: s, height: s, rx: 6 }),
            svg("text", { x: x + s / 2, y: y + s / 2 + 4.5, "text-anchor": "middle", class: "hz-ndarray-slice-val", text: String(val(r, c)) }),
            svg("text", { x: x + s / 2, y: y + s / 2 + 4, "text-anchor": "middle", class: "hz-ndarray-slice-bool", text: "" }),
          ]);
          cells[r].push(g);
          fig.append(g);
        }
      }
      const figWrap = el("div", { class: "hz-ndarray-slice-figwrap" }, [
        fig,
        el("div", { class: "hz-legend" }, [
          el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "selected"]),
          el("span", { class: "hz-ndarray-slice-masklegend" }, [el("i", { style: "background: var(--hz-good)" }), "mask True"]),
        ]),
      ]);

      // --- Console
      const input = el("input", {
        type: "text", value: "arr[1:3, :]", spellcheck: "false", autocomplete: "off", autocapitalize: "off",
        id: "hz-nd-" + Math.random().toString(36).slice(2, 8), class: "hz-list-index-input", "aria-label": "Python expression",
      });
      const form = el("form", { class: "hz-list-index-form", onsubmit: (e) => { e.preventDefault(); run(input.value, true); } }, [
        el("label", { for: input.id, class: "hz-list-index-prompt", text: ">>>" }),
        input,
        HZ.button("Run", null, "primary"),
      ]);
      form.querySelector("button").type = "submit";
      const chips = el("div", { class: "hz-list-index-chips", role: "group", "aria-label": "Example expressions" },
        PRESETS.map((p) => el("button", { type: "button", class: "hz-list-index-chip", text: p, onclick: () => { input.value = p; run(p, true); } }))
      );

      const out = el("pre", { class: "hz-list-index-out hz-ndarray-slice-out", "aria-live": "polite" });
      const st = HZ.stats([]);
      const note = el("p", { class: "hz-x__note" });
      const side = el("div", { class: "hz-ndarray-slice-side" }, [out, st.node, note]);
      body.append(form, chips, el("div", { class: "hz-x__split" }, [figWrap, side]));

      // --- Behaviour
      let runId = 0, typingTimer = null;
      input.addEventListener("input", () => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => { if (!parse(input.value).error) run(input.value, true); }, 550);
      });

      const allCells = () => cells.flat();
      function reset() {
        figWrap.classList.remove("is-masking");
        allCells().forEach((g) => g.classList.remove("is-sel", "is-dim", "is-true", "is-false", "is-mask"));
        colLabels.concat(rowLabels).forEach((t) => t.classList.remove("is-on"));
      }

      function writeOut(expr, text, bad) {
        out.replaceChildren(
          el("span", { class: "hz-list-index-echo", text: ">>> " + expr.trim() + "\n" }),
          el("span", { class: bad ? "hz-list-index-err" : "hz-list-index-res", text })
        );
      }

      function showStats(q) {
        if (!q.shape.length) st.set([["Shape", "()  single value", "is-a"], ["Dimensions", "0"], ["Values", "1"]]);
        else st.set([["Shape", shapeStr(q.shape), "is-a"], ["Dimensions", String(q.shape.length)], ["Values", String(q.values.length)]]);
      }

      // Staggered class toggles; the stagger shrinks for big selections so the whole reveal stays ~0.5s
      async function stagger(list, fn, alive, perItem) {
        const step = Math.min(perItem, 520 / Math.max(1, list.length));
        for (let k = 0; k < list.length; k++) {
          if (!alive()) return false;
          fn(list[k], k);
          if (step >= 4 && !HZ.reducedMotion()) await HZ.wait(step);
        }
        return alive();
      }

      async function run(expr, animate) {
        const id = ++runId;
        const alive = () => id === runId && body.isConnected;
        clearTimeout(typingTimer);
        reset();
        const q = parse(expr);
        const instant = !animate || HZ.reducedMotion();
        if (q.error) {
          writeOut(expr, q.error, true);
          st.set([]);
          note.replaceChildren(q.hint);
          return;
        }
        const selected = new Set(q.cells.map(([r, c]) => r * C + c));
        const result = npRepr(q.values, q.shape);

        if (q.kind === "mask") {
          if (!instant) {
            writeOut(expr, "");
            st.set([]);
            note.replaceChildren("Step 1 \u00b7 ", el("code", { text: q.maskExpr }), " tests every cell and gives back a True/False grid of the same shape.");
            figWrap.classList.add("is-masking");
            const order = allCells().map((g, k) => [g, k]);
            const ok = await stagger(order, ([g, k]) => {
              const r = Math.floor(k / C), c = k % C;
              const t = q.f(val(r, c));
              g.querySelector(".hz-ndarray-slice-bool").textContent = t ? "True" : "False";
              g.classList.add("is-mask", t ? "is-true" : "is-false");
            }, alive, 22);
            if (!ok) return;
            await HZ.wait(1300);
            if (!alive()) return;
            note.replaceChildren("Step 2 \u00b7 ", el("code", { text: "arr[mask]" }), " keeps only the cells where the mask is True.");
            allCells().forEach((g) => g.classList.remove("is-mask"));
            await HZ.wait(260);
            if (!alive()) return;
            allCells().forEach((g, k) => { if (!selected.has(k)) g.classList.add("is-dim"); g.classList.remove("is-false"); });
            const ok2 = await stagger(q.cells, ([r, c]) => { cells[r][c].classList.remove("is-true"); cells[r][c].classList.add("is-sel"); }, alive, 45);
            if (!ok2) return;
            figWrap.classList.remove("is-masking");
          } else {
            allCells().forEach((g, k) => g.classList.add(selected.has(k) ? "is-sel" : "is-dim"));
          }
          writeOut(expr, result);
          showStats(q);
          note.replaceChildren(...explain(q));
          return;
        }

        // Basic indexing: light the row/column headers, dim the rest, then reveal in result order
        note.replaceChildren(...explain(q));
        q.rows.idx.forEach((r) => rowLabels[r].classList.add("is-on"));
        q.cols.idx.forEach((c) => colLabels[c].classList.add("is-on"));
        allCells().forEach((g, k) => { if (!selected.has(k)) g.classList.add("is-dim"); });
        if (instant) {
          q.cells.forEach(([r, c]) => cells[r][c].classList.add("is-sel"));
        } else {
          writeOut(expr, "");
          await HZ.wait(140);
          if (!alive()) return;
          const ok = await stagger(q.cells, ([r, c]) => cells[r][c].classList.add("is-sel"), alive, 70);
          if (!ok) return;
          await HZ.wait(120);
          if (!alive()) return;
        }
        writeOut(expr, result);
        showStats(q);
      }

      run(input.value, false);
    },
  });
})();
