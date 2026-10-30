/* Session 5: the pyramid principle. Cordillera's 10-minute presentation is
   built top-down (key message, three arguments, evidence), then the same
   boxes are rearranged into report order to show how late the answer
   arrives when you tell the story the way you did the analysis.
   Numbers come from the Session 5 notebook. */
(function () {
  const { el, svg, button, segmented, stats, wait, reducedMotion } = HZ;

  const KEY = {
    id: "key", kind: "key", min: 1,
    text: "Call the 10% of customers the forest flags each month: same number of calls, 3.2× more future churners reached.",
  };
  const ARGS = [
    { id: "a1", kind: "arg", min: 0.5, n: 1, text: "Who will leave is predictable" },
    { id: "a2", kind: "arg", min: 0.5, n: 2, text: "Three groups carry most of the risk" },
    { id: "a3", kind: "arg", min: 0.5, n: 3, text: "A targeted call list pays off" },
  ];
  const EVIDENCE = [
    { id: "e1", arg: 0, kind: "ev", type: "chart", min: 1.2, text: "ROC curves: forest AUC 0.74, logistic 0.72, coin toss 0.50" },
    { id: "e2", arg: 0, kind: "ev", type: "table", min: 1.2, text: "Model table: the forest reaches 32% of churners with 10% of the calls" },
    { id: "e3", arg: 1, kind: "ev", type: "number", min: 0.8, text: "New customers (< 6 months): 44.4% churn vs 14.5%" },
    { id: "e4", arg: 1, kind: "ev", type: "number", min: 0.8, text: "3+ support tickets: 49.8% churn vs 14.5%" },
    { id: "e5", arg: 1, kind: "ev", type: "number", min: 0.8, text: "Norte with 2+ tickets: 51.1% churn vs 14.1%" },
    { id: "e6", arg: 2, kind: "ev", type: "table", min: 1.2, text: "Call list: 66 churners in 124 calls, vs 20 calling at random" },
    { id: "e7", arg: 2, kind: "ev", type: "number", min: 1.2, text: "≈ 79 customers kept a month vs 24 (if 3 in 10 are saved)" },
  ];
  const ITEMS = [KEY, ...ARGS, ...EVIDENCE];

  // Talk order in each mode; durations give the minute each box is heard.
  const PYRAMID_ORDER = ["key", "a1", "e1", "e2", "a2", "e3", "e4", "e5", "a3", "e6", "e7"];
  const REPORT_ORDER = ["e3", "e4", "e5", "e1", "e2", "e6", "e7", "a2", "a1", "a3", "key"];

  const clock = (m) => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, "0")}`;
  function startTimes(order) {
    const at = {};
    let t = 0;
    order.forEach((id) => {
      at[id] = t;
      t += ITEMS.find((it) => it.id === id).min;
    });
    return at;
  }
  const TIMES = { pyramid: startTimes(PYRAMID_ORDER), report: startTimes(REPORT_ORDER) };

  const CAPTIONS = [
    "The retention director has one question: <em>what should we do about churn?</em> Build the answer top-down. Press \"Next step\".",
    "<strong>Key message first:</strong> the answer and the action, in one sentence. If the meeting ended now, the director would still know what to do.",
    "<strong>Three arguments</strong>, each answering \"why should I believe that?\". Three is enough to convince and few enough to remember.",
    "<strong>Evidence under each argument:</strong> one chart or number per box. A chart that supports no argument does not go into the deck.",
  ];
  const REPORT_CAPTION =
    "The same boxes in <strong>report order</strong>, the order in which you did the analysis: findings, models, list, conclusions… and the recommendation at the very end. If the meeting runs late, the answer is what gets cut.";

  function mount(body) {
    let mode = "pyramid";
    let stepN = 0;
    let narrow = false;
    let animating = false;

    const stage = el("div", { class: "hz-pyr-stage" });
    const grid = el("div", { class: "hz-pyr-grid" });
    const lines = svg("svg", { class: "hz-pyr-lines", "aria-hidden": "true" });
    stage.append(lines, grid);

    const nodes = {};
    ITEMS.forEach((it) => {
      const badge = el("span", { class: "hz-pyr-time" });
      const head =
        it.kind === "key" ? el("span", { class: "hz-pyr-tag", text: "Key message" })
        : it.kind === "arg" ? el("span", { class: "hz-pyr-tag", text: `Argument ${it.n}` })
        : el("span", { class: "hz-pyr-tag", text: it.type });
      const node = el("div", { class: `hz-pyr-item is-${it.kind}`, "data-id": it.id }, [
        el("div", { class: "hz-pyr-item__top" }, [head, badge]),
        el("p", { class: "hz-pyr-item__text", text: it.text }),
      ]);
      nodes[it.id] = { node, badge, it };
      grid.append(node);
    });

    const readout = stats();
    const note = el("p", { class: "hz-x__note" });

    // Grid placement for the current mode and width.
    function place() {
      const order = mode === "pyramid" ? PYRAMID_ORDER : REPORT_ORDER;
      grid.classList.toggle("is-columns", mode === "pyramid" && !narrow);
      grid.classList.toggle("is-stack", mode === "pyramid" && narrow);
      if (mode === "pyramid" && !narrow) {
        const pos = (id, col, row) => Object.assign(nodes[id].node.style, { gridColumn: col, gridRow: String(row) });
        pos("key", "1 / -1", 1);
        ARGS.forEach((a, i) => pos(a.id, String(i + 1), 2));
        const used = [0, 0, 0];
        EVIDENCE.forEach((e) => pos(e.id, String(e.arg + 1), 3 + used[e.arg]++));
      } else {
        order.forEach((id, i) => Object.assign(nodes[id].node.style, { gridColumn: "1 / -1", gridRow: String(i + 1) }));
      }
      ITEMS.forEach((it) => {
        nodes[it.id].badge.textContent = "min " + clock(TIMES[mode][it.id]);
        nodes[it.id].node.classList.toggle("is-indent", mode === "pyramid" && narrow && it.kind === "ev");
      });
    }

    function visible(it) {
      if (mode === "report") return true;
      return it.kind === "key" ? stepN >= 1 : it.kind === "arg" ? stepN >= 2 : stepN >= 3;
    }

    function reveal() {
      // stagger within a level so the eye follows the build
      ITEMS.forEach((it) => {
        const shown = visible(it);
        const node = nodes[it.id].node;
        const rank = it.kind === "arg" ? it.n - 1 : it.kind === "ev" ? EVIDENCE.indexOf(it) : 0;
        node.style.transitionDelay = shown && !reducedMotion() ? `${rank * 90}ms` : "0ms";
        node.classList.toggle("is-shown", shown);
      });
      const at = TIMES[mode].key;
      readout.set([
        ["Key message heard at", "min " + clock(at), mode === "pyramid" ? "is-good" : "is-bad"],
        ["Boxes on screen", `${ITEMS.filter(visible).length} of ${ITEMS.length}`],
      ]);
      note.innerHTML = mode === "report" ? REPORT_CAPTION : CAPTIONS[stepN];
      nextBtn.disabled = mode === "report" || stepN >= 3;
      allBtn.disabled = mode === "report" || stepN >= 3;
      drawLines();
    }

    // Connectors: key → each argument, argument → its evidence (pyramid only).
    function drawLines() {
      lines.replaceChildren();
      if (mode !== "pyramid" || animating) return;
      const box = stage.getBoundingClientRect();
      if (!box.width) return;
      lines.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      lines.setAttribute("width", box.width);
      lines.setAttribute("height", box.height);
      const r = (id) => {
        const b = nodes[id].node.getBoundingClientRect();
        return { l: b.left - box.left, r: b.right - box.left, t: b.top - box.top, b: b.bottom - box.top, cx: (b.left + b.right) / 2 - box.left };
      };
      const k = r("key");
      ARGS.forEach((a, i) => {
        const ra = r(a.id);
        const on = stepN >= 2;
        if (!narrow) {
          const my = (k.b + ra.t) / 2;
          lines.append(svg("path", { class: "hz-pyr-line" + (on ? " is-on" : ""), style: `transition-delay: ${i * 90}ms`, d: `M${k.cx},${k.b}C${k.cx},${my} ${ra.cx},${my} ${ra.cx},${ra.t}` }));
        }
        const evs = EVIDENCE.filter((e) => e.arg === i);
        const last = r(evs.at(-1).id);
        const x = narrow ? ra.l + 10 : ra.l + 12;
        lines.append(svg("path", { class: "hz-pyr-line is-rail" + (stepN >= 3 ? " is-on" : ""), d: `M${x},${ra.b}V${(last.t + last.b) / 2}` }));
        evs.forEach((e) => {
          const re = r(e.id);
          const y = (re.t + re.b) / 2;
          lines.append(svg("path", { class: "hz-pyr-line is-rail" + (stepN >= 3 ? " is-on" : ""), d: `M${x},${y}H${re.l}` }));
        });
      });
      if (narrow) {
        // a rail down the left joins the key message to every argument
        const lastArg = r("a3");
        lines.append(svg("path", { class: "hz-pyr-line" + (stepN >= 2 ? " is-on" : ""), d: `M${k.l + 6},${k.b}V${(lastArg.t + lastArg.b) / 2}` }));
        ARGS.forEach((a) => {
          const ra = r(a.id);
          lines.append(svg("path", { class: "hz-pyr-line" + (stepN >= 2 ? " is-on" : ""), d: `M${k.l + 6},${(ra.t + ra.b) / 2}H${ra.l}` }));
        });
      }
    }

    // FLIP: measure, re-place, then slide every box from its old spot.
    async function relayout() {
      const before = {};
      ITEMS.forEach((it) => (before[it.id] = nodes[it.id].node.getBoundingClientRect()));
      place();
      if (reducedMotion()) return reveal();
      animating = true;
      lines.replaceChildren();
      const anims = ITEMS.map((it, i) => {
        const node = nodes[it.id].node;
        const a = before[it.id], b = node.getBoundingClientRect();
        const dx = a.left - b.left, dy = a.top - b.top;
        if (!dx && !dy) return null;
        return node.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
          { duration: 600, delay: i * 30, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "backwards" }
        ).finished.catch(() => {});
      });
      reveal();
      await Promise.all(anims);
      animating = false;
      if (body.isConnected) drawLines();
    }

    const view = segmented(
      [{ value: "pyramid", label: "Pyramid order" }, { value: "report", label: "Report order" }],
      mode,
      (v) => {
        if (v === mode) return;
        mode = v;
        relayout();
      }
    );
    const nextBtn = button("Next step", () => { stepN = Math.min(3, stepN + 1); reveal(); }, "primary");
    const allBtn = button("Show all", async () => {
      while (stepN < 3 && body.isConnected) {
        stepN++;
        reveal();
        await wait(450);
      }
    });
    const resetBtn = button("Reset", () => {
      stepN = 0;
      if (mode !== "pyramid") {
        mode = "pyramid";
        view.set("pyramid");
        relayout();
      } else reveal();
    });

    body.append(
      el("p", { class: "hz-x__lede", html: "Cordillera's 10-minute presentation to the retention director. Same content, two orders: build it as a <strong>pyramid</strong> one level at a time, then flip it to the <strong>report</strong> order most first drafts use." }),
      el("div", { class: "hz-x__controls" }, [view.node, nextBtn, allBtn, resetBtn]),
      stage,
      el("div", { class: "hz-pyr-foot" }, [readout.node]),
      note
    );

    const measure = () => {
      const w = body.getBoundingClientRect().width;
      const n = w > 0 && w < 600;
      if (n !== narrow) {
        narrow = n;
        place();
      }
      drawLines();
    };
    const ro = new ResizeObserver(() => {
      if (!body.isConnected) return ro.disconnect();
      measure();
    });
    ro.observe(body);
    narrow = body.getBoundingClientRect().width < 600;
    place();
    reveal();
  }

  HZ.register("pyramid", {
    kicker: "Session 5",
    title: "Building the pyramid",
    mount,
    css: `
.md-typeset .hz-pyr-stage { position: relative; }
.md-typeset .hz-x svg.hz-pyr-lines { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.md-typeset .hz-pyr-line { fill: none; stroke: var(--hz-muted); stroke-width: 1.5; opacity: 0; transition: opacity 400ms ease-in-out; }
.md-typeset .hz-pyr-line.is-rail { stroke-dasharray: 3 3; }
.md-typeset .hz-pyr-line.is-on { opacity: 0.7; }
.md-typeset .hz-pyr-grid { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.5rem; }
.md-typeset .hz-pyr-grid.is-columns { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.55rem 0.8rem; }
.md-typeset .hz-pyr-grid.is-columns .hz-pyr-item.is-key { justify-self: center; width: min(100%, 27rem); margin-bottom: 1.4rem; }
.md-typeset .hz-pyr-grid.is-columns .hz-pyr-item.is-arg { margin-bottom: 0.2rem; }
.md-typeset .hz-pyr-grid.is-columns .hz-pyr-item.is-ev { margin-left: 1.5rem; align-self: start; }
.md-typeset .hz-pyr-item.is-indent { margin-left: 1.6rem; }
.md-typeset .hz-pyr-grid.is-stack .hz-pyr-item.is-arg { margin-left: 0.9rem; }
.md-typeset .hz-pyr-item { position: relative; border-radius: 12px; padding: 0.5rem 0.7rem 0.55rem; border: 1px dashed var(--hz-line); background: transparent; min-width: 0; }
.md-typeset .hz-pyr-item > * { opacity: 0; transform: translateY(6px); transition: opacity 350ms ease-in-out, transform 350ms ease-in-out; transition-delay: inherit; }
.md-typeset .hz-pyr-item { transition: background 350ms ease-in-out, border-color 350ms ease-in-out; }
.md-typeset .hz-pyr-item.is-shown { border-style: solid; background: var(--md-default-bg-color); }
.md-typeset .hz-pyr-item.is-shown > * { opacity: 1; transform: none; }
.md-typeset .hz-pyr-item.is-key.is-shown { border: 2px solid var(--md-primary-fg-color); background: color-mix(in srgb, var(--md-primary-fg-color) 8%, var(--md-default-bg-color)); }
.md-typeset .hz-pyr-item.is-arg.is-shown { border-color: var(--hz-ink); }
.md-typeset .hz-pyr-item.is-ev.is-shown { background: var(--hz-grid); border-color: transparent; }
.md-typeset .hz-pyr-item__top { display: flex; justify-content: space-between; gap: 0.5rem; align-items: baseline; margin-bottom: 0.15rem; }
.md-typeset .hz-pyr-tag { font-family: var(--md-code-font); font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--hz-muted); }
.md-typeset .hz-pyr-item.is-key .hz-pyr-tag { color: var(--md-primary-fg-color); }
.md-typeset .hz-pyr-time { font-family: var(--md-code-font); font-size: 0.58rem; color: var(--hz-muted); white-space: nowrap; }
.md-typeset .hz-x__body p.hz-pyr-item__text { line-height: 1.4; }
.md-typeset .hz-pyr-item.is-key .hz-pyr-item__text { font-family: var(--hz-serif); font-size: 1.02rem; line-height: 1.3; color: var(--md-default-fg-color); }
.md-typeset .hz-pyr-item.is-arg .hz-pyr-item__text { font-weight: 600; font-size: 0.78rem; }
.md-typeset .hz-pyr-item.is-ev .hz-pyr-item__text { font-size: 0.7rem; }
.md-typeset .hz-pyr-foot { display: flex; flex-wrap: wrap; gap: 1rem; }
`,
  });
})();
