/*
 * list-index: positive/negative indices and slices on a Python list.
 * The student types cars[...]; the matching boxes light up in the order
 * Python visits them and the result prints exactly as Python would.
 *
 * Optional placeholder attributes swap the example list (defaults: the cars):
 *   data-name="bills"                           variable name
 *   data-items='[29.4, 30.8, 30.1]'             JSON array of strings or numbers
 *   data-noun="bill"                            singular noun (default: name without a final "s")
 *   data-presets='["bills[-1]", "bills[-3:]"]'  example chips
 *   data-start="bills[-3:]"                     expression shown first
 */
(function () {
  const { el, svg } = HZ;

  const DEFAULT = {
    name: "cars",
    items: ["Mercedes", "BMW", "Audi", "Ferrari", "Tesla"],
    noun: "car",
    presets: ["cars[1]", "cars[-1]", "cars[1:4]", "cars[:3]", "cars[::2]", "cars[::-1]", "cars[7]"],
    start: "cars[1:4]",
  };

  function readConfig(ds) {
    if (!ds || !ds.items) return DEFAULT;
    const items = JSON.parse(ds.items);
    if (!Array.isArray(items) || !items.length) throw new Error("data-items must be a non-empty JSON array");
    const name = /^[A-Za-z_]\w*$/.test(ds.name || "") ? ds.name : "items";
    const n = items.length;
    const presets = ds.presets
      ? JSON.parse(ds.presets)
      : [name + "[1]", name + "[-1]", name + "[1:4]", name + "[:3]", name + "[::2]", name + "[::-1]", name + "[" + (n + 2) + "]"];
    return { name, items, noun: ds.noun || name.replace(/s$/, ""), presets, start: ds.start || presets[2] || name + "[0]" };
  }

  // Everything that depends on the list (geometry, parser, captions) is built per widget.
  function build(cfg) {
    const CARS = cfg.items;
    const N = CARS.length;
    const NAME = cfg.name, NOUN = cfg.noun;
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const LEN_RE = new RegExp("len\\s*\\(\\s*" + esc(NAME) + "\\s*\\)", "g");
    const ITEM_RE = new RegExp("^" + esc(NAME) + "\\s*\\[([\\s\\S]*)\\]$");
    // Numbers print like Python: if any item is a non-integer, integral ones are floats too (30 -> 30.0)
    const floats = CARS.some((v) => typeof v === "number" && !Number.isInteger(v));

    // Geometry (SVG user units)
    const BW = 70, GAP = 8, X0 = 14, PITCH = BW + GAP;
    const W = X0 * 2 + N * BW + (N - 1) * GAP;
    const POS_Y = 44, BOX_Y = 52, BH = 40, NEG_Y = BOX_Y + BH + 17, TRACK_Y = NEG_Y + 14, H = TRACK_Y + 30;
    const cx = (i) => X0 + i * PITCH + BW / 2;
    // x of the cut *before* item g (g = 0..N); cuts sit in the gaps between boxes
    const gapX = (g) => (g <= 0 ? X0 - GAP / 2 : g >= N ? X0 + N * PITCH - GAP / 2 : X0 + g * PITCH - GAP / 2);

    const pyRepr = (s) =>
      typeof s === "number" ? (floats && Number.isInteger(s) ? s.toFixed(1) : String(s)) : typeof s === "boolean" ? (s ? "True" : "False") : "'" + s + "'";
    const pyList = (items) => "[" + items.map(pyRepr).join(", ") + "]";

    // Tiny integer evaluator: digits, + and -, and len(<list>). Returns int or throws.
    function evalInt(src) {
      const s = src.replace(LEN_RE, String(N)).replace(/\s+/g, "");
      if (!/^[+-]*\d+([+-]+\d+)*$/.test(s)) {
        if (/^[+-]?\d*\.\d*$/.test(s) && /\d/.test(s)) throw { kind: "float" };
        if (/^(['"]).*\1$/.test(src.trim())) throw { kind: "str" };
        if (/^[A-Za-z_]\w*$/.test(s)) throw { kind: "name", name: s };
        throw { kind: "syntax" };
      }
      let total = 0;
      s.replace(/([+-]*)(\d+)/g, (_, signs, num) => {
        const neg = (signs.match(/-/g) || []).length % 2 === 1;
        total += (neg ? -1 : 1) * parseInt(num, 10);
      });
      return total;
    }

    // Python's slice.indices(n) followed by range(start, stop, step)
    function sliceIndices(start, stop, step, n) {
      const lower = step < 0 ? -1 : 0;
      const upper = step < 0 ? n - 1 : n;
      const norm = (v, dflt) => {
        if (v === null) return dflt;
        if (v < 0) return Math.max(v + n, lower);
        return Math.min(v, upper);
      };
      const a = norm(start, step < 0 ? upper : lower);
      const b = norm(stop, step < 0 ? lower : upper);
      const out = [];
      for (let i = a; step > 0 ? i < b : i > b; i += step) out.push(i);
      return { start: a, stop: b, out };
    }

    function parse(raw) {
      const src = raw.trim();
      if (src === NAME) return { kind: "all", out: CARS.map((_, i) => i), start: 0, stop: N, step: 1 };
      const m = src.match(ITEM_RE);
      if (!m) {
        if (/^[A-Za-z_]\w*\s*\[/.test(src) && !src.startsWith(NAME))
          return { error: "NameError: name '" + src.match(/^\w+/)[0] + "' is not defined", hint: "The list is called " + NAME + "." };
        return { error: "SyntaxError: invalid syntax", hint: "Write it like " + NAME + "[2] or " + NAME + "[1:4]." };
      }
      const inner = m[1];
      if (!inner.trim()) return { error: "SyntaxError: invalid syntax", hint: "Put an index or a slice inside the brackets." };
      try {
        if (inner.includes(":")) {
          const parts = inner.split(":");
          if (parts.length > 3) return { error: "SyntaxError: invalid syntax", hint: "A slice has at most two colons: start:stop:step." };
          const [a, b, c] = parts.map((p) => (p.trim() === "" ? null : evalInt(p)));
          const step = c === undefined || c === null ? 1 : c;
          if (step === 0) return { error: "ValueError: slice step cannot be zero", hint: "The step says how far to jump each time; 0 would never move." };
          const r = sliceIndices(a, b, step, N);
          return { kind: "slice", raw: { a, b, c: c === undefined ? null : c }, step, start: r.start, stop: r.stop, out: r.out };
        }
        const i = evalInt(inner);
        if (i >= N || i < -N)
          return {
            error: "IndexError: list index out of range",
            hint: NAME + " has " + N + " items, so valid indices are 0 to " + (N - 1) + " (or −" + N + " to −1). There is no box " + i + ".",
            bad: i,
          };
        return { kind: "index", index: i, pos: i < 0 ? i + N : i };
      } catch (e) {
        if (e.kind === "float") return { error: "TypeError: list indices must be integers or slices, not float", hint: "Positions are whole numbers: " + NAME + "[2], not " + NAME + "[2.0]." };
        if (e.kind === "str") return { error: "TypeError: list indices must be integers or slices, not str", hint: "Lists are looked up by position, not by name." };
        if (e.kind === "name") return { error: "NameError: name '" + e.name + "' is not defined", hint: "Use a number, e.g. " + NAME + "[2]." };
        return { error: "SyntaxError: invalid syntax", hint: "Try " + NAME + "[2], " + NAME + "[-1] or " + NAME + "[1:4]." };
      }
    }

    function explain(r, expr) {
      const code = (s) => el("code", { text: s });
      if (r.kind === "all") return ["The whole list: all ", N, " " + NAME + ", in order."];
      if (r.kind === "index") {
        if (r.index >= 0)
          return ["Python counts from 0, so ", code(expr), " is " + NOUN + " number ", r.index + 1, ". The last valid positive index is ", code("len(" + NAME + ") - 1"), " = ", N - 1, "."];
        return ["Negative indices count from the end: ", code("-1"), " is the last " + NOUN + ", ", code("-2"), " the one before. ", code(expr), " is the same box as ", code(NAME + "[" + r.pos + "]"), " (", N, " + (", r.index, ") = ", r.pos, ")."];
      }
      const parts = [];
      const { a, b, c } = r.raw;
      if (r.step > 0) {
        parts.push("Think of the indices as cuts between the boxes. The slice keeps what lies between cut ", r.start, " (start) and cut ", r.stop, " (stop), " + (r.stop < N ? "so box " + r.stop + " is never included. " : "which is the end of the list. "));
        if (r.step === 1) parts.push("Bonus: stop − start = ", Math.max(0, r.stop - r.start), " items, and ", code(NAME + "[:" + r.stop + "] + " + NAME + "[" + r.stop + ":]"), " rebuilds the full list.");
        else parts.push("Step ", r.step, " jumps ", r.step, " boxes at a time, starting at ", r.start, ".");
      } else {
        parts.push("A negative step walks right to left: start at ", r.start, ", jump ", r.step, " each time, and stop before reaching ", r.stop < 0 ? "the front" : "box " + r.stop, ". ");
        if (a === null && b === null && r.step === -1) parts.push(code("[::-1]"), " is the classic way to reverse a list.");
      }
      if (a === null || b === null) parts.push(" A missing start or stop means “from the edge”.");
      if ((b !== null && (b > N || b < -N)) || (a !== null && (a > N || a < -N))) parts.push(" Slices never raise IndexError: out-of-range cuts are clipped to the ends.");
      if (!r.out.length) parts.push(" Nothing lies between the cuts, so the result is an empty list.");
      return parts;
    }
    return { CARS, N, NAME, PRESETS: cfg.presets, W, H, BW, BOX_Y, BH, POS_Y, NEG_Y, TRACK_Y, X0, PITCH, cx, gapX, pyRepr, pyList, parse, explain };
  }

  HZ.register("list-index", {
    title: "Indexing and slicing a list",
    kicker: "Session 1",
    css: `
@media (max-width: 30em) {
  .md-typeset .hz-x svg.hz-list-index-fig.is-compact .hz-list-index-name { font-size: 19px; }
  .md-typeset .hz-x svg.hz-list-index-fig.is-compact .hz-list-index-idx { font-size: 16px; }
}
`,
    mount(body, dataset) {
      const cfg = readConfig(dataset);
      const { CARS, N, NAME, PRESETS, W, H, BW, BOX_Y, BH, POS_Y, NEG_Y, TRACK_Y, X0, PITCH, cx, gapX, pyRepr, pyList, parse, explain } = build(cfg);
      body.classList.add("hz-list-index");

      body.append(
        el("p", { class: "hz-x__lede" }, [
          "Every item has two addresses: a positive index counting from the left (starting at ",
          el("code", { text: "0" }),
          ") and a negative one counting from the right. Type an expression or pick one below.",
        ])
      );
      body.append(el("pre", { class: "hz-list-index-def" }, NAME + " = [" + CARS.map((v) => (typeof v === "string" ? '"' + v + '"' : pyRepr(v))).join(", ") + "]"));

      // --- Figure
      // Short items (numbers like 29.4) can use bigger type on phones; the default cars keep the shared style.
      const compact = CARS.every((v) => (typeof v === "string" ? v : pyRepr(v)).length <= 5);
      const fig = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-list-index-fig" + (compact ? " is-compact" : ""), role: "img", "aria-label": "The " + NAME + " list as " + (N === 5 ? "five" : N) + " boxes with their indices" });
      const boxes = CARS.map((name, i) => {
        const g = svg("g", { class: "hz-list-index-box" }, [
          svg("rect", { x: X0 + i * PITCH, y: BOX_Y, width: BW, height: BH, rx: 7 }),
          svg("text", { x: cx(i), y: BOX_Y + BH / 2 + 4.5, "text-anchor": "middle", class: "hz-list-index-name", text: typeof name === "string" ? name : pyRepr(name) }),
        ]);
        fig.append(g);
        return g;
      });
      const posLabels = CARS.map((_, i) => svg("text", { x: cx(i), y: POS_Y, "text-anchor": "middle", class: "hz-list-index-idx", text: String(i) }));
      const negLabels = CARS.map((_, i) => svg("text", { x: cx(i), y: NEG_Y, "text-anchor": "middle", class: "hz-list-index-idx", text: String(i - N) }));
      fig.append(...posLabels, ...negLabels);

      const cutLayer = svg("g", { class: "hz-list-index-cuts" });
      const trail = svg("g", { class: "hz-list-index-trail" });
      const dot = svg("circle", { r: 4.5, cx: cx(0), cy: TRACK_Y, class: "hz-list-index-dot", opacity: 0 });
      fig.append(cutLayer, trail, dot);

      body.append(el("div", { class: "hz-list-index-figwrap" }, [fig]));

      // --- Expression input
      const input = el("input", {
        type: "text",
        value: cfg.start,
        spellcheck: "false",
        autocomplete: "off",
        autocapitalize: "off",
        id: "hz-li-" + Math.random().toString(36).slice(2, 8),
        class: "hz-list-index-input",
        "aria-label": "Python expression",
      });
      const runBtn = HZ.button("Run", () => run(input.value, true), "primary");
      const form = el("form", { class: "hz-list-index-form", onsubmit: (e) => { e.preventDefault(); run(input.value, true); } }, [
        el("label", { for: input.id, class: "hz-list-index-prompt", text: ">>>" }),
        input,
        runBtn,
      ]);
      const chips = el("div", { class: "hz-list-index-chips", role: "group", "aria-label": "Example expressions" },
        PRESETS.map((p) =>
          el("button", { type: "button", class: "hz-list-index-chip", text: p, onclick: () => { input.value = p; run(p, true); } })
        )
      );
      body.append(form, chips);

      const out = el("pre", { class: "hz-list-index-out", "aria-live": "polite" });
      const note = el("p", { class: "hz-x__note" });
      body.append(out, note);

      // --- Rendering
      let runId = 0;
      let typingTimer = null;
      input.addEventListener("input", () => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          if (!parse(input.value).error) run(input.value, true);
        }, 550);
      });

      function clearMarks() {
        boxes.forEach((b) => b.classList.remove("is-on", "is-bad"));
        posLabels.concat(negLabels).forEach((t) => t.classList.remove("is-on"));
        cutLayer.replaceChildren();
        trail.replaceChildren();
        dot.setAttribute("opacity", 0);
      }

      function writeOut(expr, lines, bad) {
        out.replaceChildren(
          el("span", { class: "hz-list-index-echo", text: ">>> " + expr.trim() + "\n" }),
          el("span", { class: bad ? "hz-list-index-err" : "hz-list-index-res", text: lines })
        );
      }

      function drawCuts(r) {
        const fwd = r.step > 0;
        // Cut at the left edge of the start box when walking right, at its right edge when walking left
        const startCut = fwd ? r.start : r.start + 1;
        const stopCut = fwd ? r.stop : r.stop + 1;
        const mk = (g, label, cls, anchorEnd) => {
          const x = gapX(g);
          return svg("g", { class: "hz-list-index-cut " + cls }, [
            svg("line", { x1: x, x2: x, y1: BOX_Y - 40, y2: BOX_Y + BH + 6 }),
            svg("text", { x: x + (anchorEnd ? -4 : 4), y: BOX_Y - 32, "text-anchor": anchorEnd ? "end" : "start", text: label }),
          ]);
        };
        // Labels point inward, toward the items between the cuts
        const s = mk(startCut, "start", "is-start", !fwd);
        const t = mk(stopCut, "stop", "is-stop", fwd);
        cutLayer.replaceChildren(s, t);
        return t;
      }

      function hopPath(i, j) {
        const x1 = cx(i), x2 = cx(j);
        const lift = Math.min(16, 6 + Math.abs(j - i) * 3);
        return `M ${x1} ${TRACK_Y} Q ${(x1 + x2) / 2} ${TRACK_Y + lift} ${x2} ${TRACK_Y}`;
      }

      function quadAt(i, j, t) {
        const x1 = cx(i), x2 = cx(j);
        const lift = Math.min(16, 6 + Math.abs(j - i) * 3);
        const mx = (x1 + x2) / 2, my = TRACK_Y + lift;
        const u = 1 - t;
        return [u * u * x1 + 2 * u * t * mx + t * t * x2, u * u * TRACK_Y + 2 * u * t * my + t * t * TRACK_Y];
      }

      async function run(expr, animate) {
        const id = ++runId;
        const alive = () => id === runId && body.isConnected;
        clearTimeout(typingTimer);
        clearMarks();
        const r = parse(expr);
        const instant = !animate || HZ.reducedMotion();

        if (r.error) {
          writeOut(expr, r.error, true);
          note.replaceChildren(r.hint || "");
          if (r.bad !== undefined) {
            fig.classList.remove("is-shake");
            void fig.getBoundingClientRect();
            if (!instant) fig.classList.add("is-shake");
          }
          return;
        }
        note.replaceChildren(...explain(r, expr.trim()));

        if (r.kind === "index") {
          const lab = r.index < 0 ? negLabels[r.pos] : posLabels[r.pos];
          lab.classList.add("is-on");
          if (!instant) await HZ.wait(160);
          if (!alive()) return;
          boxes[r.pos].classList.add("is-on");
          writeOut(expr, pyRepr(CARS[r.pos]));
          return;
        }

        // Slice (or whole list): walk the visited indices in order
        const stopMark = r.kind === "slice" ? drawCuts(r) : null;
        const items = r.out;
        if (instant) {
          items.forEach((i, k) => {
            boxes[i].classList.add("is-on");
            trail.append(svg("circle", { cx: cx(i), cy: TRACK_Y, r: 2.5 }));
            if (k > 0) trail.append(svg("path", { d: hopPath(items[k - 1], i) }));
          });
          writeOut(expr, pyList(items.map((i) => CARS[i])));
          return;
        }

        writeOut(expr, items.length ? "[" : "[]");
        if (!items.length) {
          stopMark && stopMark.classList.add("is-hit");
          return;
        }
        await HZ.wait(220);
        if (!alive()) return;
        const shown = [];
        for (let k = 0; k < items.length; k++) {
          const i = items[k];
          if (k === 0) {
            dot.setAttribute("cx", cx(i));
            dot.setAttribute("cy", TRACK_Y);
            await HZ.tween(body, 180, (t) => alive() && dot.setAttribute("opacity", t));
          } else {
            const prev = items[k - 1];
            const path = svg("path", { d: hopPath(prev, i) });
            trail.append(path);
            const len = path.getTotalLength ? path.getTotalLength() : 100;
            path.style.strokeDasharray = len;
            path.style.strokeDashoffset = len;
            await HZ.tween(body, Math.max(220, 300 - k * 15), (t) => {
              if (!alive()) return;
              const [x, y] = quadAt(prev, i, t);
              dot.setAttribute("cx", x);
              dot.setAttribute("cy", y);
              path.style.strokeDashoffset = len * (1 - t);
            });
            path.style.strokeDasharray = "";
            path.style.strokeDashoffset = "";
          }
          if (!alive()) return;
          boxes[i].classList.add("is-on");
          trail.append(svg("circle", { cx: cx(i), cy: TRACK_Y, r: 2.5 }));
          shown.push(CARS[i]);
          writeOut(expr, "[" + shown.map(pyRepr).join(", ") + (k === items.length - 1 ? "]" : ", …"));
          await HZ.wait(70);
          if (!alive()) return;
        }

        // Nudge toward the next position and bounce off the stop cut
        if (stopMark) {
          const last = items[items.length - 1];
          const fwd = r.step > 0;
          const wallX = gapX(fwd ? r.stop : r.stop + 1);
          const x0 = cx(last);
          const reach = x0 + (wallX - x0) * 0.85;
          await HZ.tween(body, 200, (t) => alive() && dot.setAttribute("cx", HZ.lerp(x0, reach, t)), HZ.easeOut);
          if (!alive()) return;
          stopMark.classList.add("is-hit");
          await HZ.tween(body, 240, (t) => {
            if (!alive()) return;
            dot.setAttribute("cx", HZ.lerp(reach, x0, t));
            dot.setAttribute("opacity", 1 - t);
          });
        } else {
          await HZ.tween(body, 200, (t) => alive() && dot.setAttribute("opacity", 1 - t));
        }
      }

      run(input.value, false);
    },
  });
})();
