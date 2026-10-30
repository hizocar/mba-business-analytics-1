/*
 * variables: names are labels that point at values.
 * The student runs a short program line by line. Each value is built first
 * (in the "new value" area, right side of the = sign), then the label is
 * attached to it. Reassigning re-points the arrow; a value no label points at
 * is thrown away. A conversion (int("14")) shows the type badge change.
 */
(function () {
  const { el, svg } = HZ;

  const STEPS = [
    { code: 'plan = "Plus"', name: "plan", value: "'Plus'", type: "str",
      note: "Python builds the value <code>'Plus'</code> first, then sticks the label <code>plan</code> on it. Text in quotes is a <code>str</code> (string)." },
    { code: "monthly_bill = 31.9", name: "monthly_bill", value: "31.9", type: "float",
      note: "A number with a decimal point is a <code>float</code>. The label <code>monthly_bill</code> now points at 31.9." },
    { code: "tenure_months = 14", name: "tenure_months", value: "14", type: "int",
      note: "A whole number is an <code>int</code>. Notice you never declare the type: Python reads it from the value." },
    { code: "autopay = True", name: "autopay", value: "True", type: "bool",
      note: "<code>True</code> and <code>False</code> (capital first letter, no quotes) are <code>bool</code> values: yes/no facts about a customer." },
    { code: "tenure_months = tenure_months + 1", name: "tenure_months", reads: "tenure_months", expr: ["tenure_months + 1", "14 + 1"], value: "15", type: "int",
      note: "Python computes the right side first: it reads what <code>tenure_months</code> points at (14), adds 1, builds 15, and only then moves the label. Nothing points at 14 any more, so Python throws it away." },
    { code: "monthly_bill = monthly_bill * 1.05", name: "monthly_bill", reads: "monthly_bill", expr: ["monthly_bill * 1.05", "31.9 * 1.05"], value: "33.495", type: "float",
      note: "Same pattern for the 5% price rise: compute <code>31.9 * 1.05</code>, get a new float, re-point <code>monthly_bill</code>. The old 31.9 is gone; if you need it, keep it under another name first." },
    { code: 'plan = "Unlimited"', name: "plan", value: "'Unlimited'", type: "str",
      note: "The customer upgrades. Reassigning just moves the label to a new value; <code>'Plus'</code> is discarded." },
    { code: 'months = int("14")', name: "months", pre: { value: "'14'", type: "str" }, expr: ["int('14')"], value: "14", type: "int",
      note: "<code>\"14\"</code> is text, the way numbers often arrive from a file. <code>int()</code> converts it to a whole number (also <code>float()</code> and <code>str()</code>). Without it, <code>\"14\" + 1</code> is a TypeError." },
  ];
  const ORDER = ["plan", "monthly_bill", "tenure_months", "autopay", "months"];
  const PYTYPE = { str: "str", float: "float", int: "int", bool: "bool" };

  // Geometry (SVG user units)
  const W = 368, LX = 2, LW = 134, LH = 32, VX = 186, VW = 176, VH = 34;
  const Y0 = 32, PITCH = 46;
  const rowY = (name) => Y0 + ORDER.indexOf(name) * PITCH + VH / 2;
  const SCR_TOP = Y0 + ORDER.length * PITCH + 10, SCR_H = 54;
  const SCR_Y = SCR_TOP + SCR_H / 2;
  const H = SCR_TOP + SCR_H + 4;

  // Bindings after the first k steps: name -> {value, type}
  function stateAt(k) {
    const m = new Map();
    for (let i = 0; i < k; i++) m.set(STEPS[i].name, { value: STEPS[i].value, type: STEPS[i].type });
    return m;
  }

  const badgeW = (t) => 14 + t.length * 7.4;
  const arrowD = (y1, x2, y2) => {
    const x1 = LX + LW;
    const dx = Math.max(18, (x2 - x1) * 0.5);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2 - 2} ${y2}`;
  };

  function mount(body) {
    body.classList.add("hz-variables");
    const uid = Math.random().toString(36).slice(2, 8);

    // ---- figure
    const fig = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-variables-fig", role: "img", "aria-label": "Variable names on the left, values in memory on the right, arrows from each name to its value" });
    const defs = svg("defs", {}, [
      svg("marker", { id: "hz-var-arrow-" + uid, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, [
        svg("path", { d: "M 0 0 L 10 5 L 0 10 z", class: "hz-variables-head" }),
      ]),
    ]);
    fig.append(defs);
    fig.append(
      svg("text", { x: LX, y: 16, class: "hz-variables-colhead", text: "names (labels)" }),
      svg("text", { x: VX, y: 16, class: "hz-variables-colhead", text: "values in memory" }),
      svg("rect", { x: VX - 6, y: SCR_TOP, width: VW + 10, height: SCR_H, rx: 10, class: "hz-variables-scratch" }),
      svg("text", { x: VX - 14, y: SCR_Y - 3, "text-anchor": "end", class: "hz-variables-scrlab", text: "right side of =" }),
      svg("text", { x: VX - 14, y: SCR_Y + 13, "text-anchor": "end", class: "hz-variables-scrlab", text: "is built here first" })
    );
    const arrowLayer = svg("g");
    const boxLayer = svg("g");
    const labelLayer = svg("g");
    fig.append(arrowLayer, boxLayer, labelLayer);

    function makeBox(value, type, opts = {}) {
      const g = svg("g", { class: "hz-variables-box" + (opts.expr ? " is-expr" : "") });
      const rect = svg("rect", { width: VW, height: VH, rx: 7 });
      const text = svg("text", { x: 12, y: VH / 2 + 5, class: "hz-variables-val" });
      const bg = svg("g", { class: "hz-variables-badge" });
      const brect = svg("rect", { height: 18, rx: 9, y: (VH - 18) / 2 });
      const btext = svg("text", { y: VH / 2 + 4, "text-anchor": "middle" });
      bg.append(brect, btext);
      g.append(rect, text, bg);
      const box = {
        g, x: 0, y: 0,
        pos(x, y) { box.x = x; box.y = y; g.setAttribute("transform", `translate(${x} ${y - VH / 2})`); },
        set(v, t, isExpr) {
          text.textContent = v;
          g.classList.toggle("is-expr", !!isExpr);
          if (t) {
            const bw = badgeW(t);
            brect.setAttribute("x", VW - 8 - bw);
            brect.setAttribute("width", bw);
            btext.setAttribute("x", VW - 8 - bw / 2);
            btext.textContent = t;
            bg.setAttribute("class", "hz-variables-badge is-" + t);
            bg.style.display = "";
          } else bg.style.display = "none";
        },
        opacity(o) { g.style.opacity = String(o); },
      };
      box.set(value, type, opts.expr);
      boxLayer.append(g);
      return box;
    }

    function makeLabel(name) {
      const g = svg("g", { class: "hz-variables-label", transform: `translate(${LX} ${rowY(name) - LH / 2})`, tabindex: 0, role: "button", "aria-label": "Show the type of " + name });
      g.append(svg("rect", { width: LW, height: LH, rx: 6 }), svg("circle", { cx: 10, cy: LH / 2, r: 3, class: "hz-variables-hole" }), svg("text", { x: 19, y: LH / 2 + 4.5, class: "hz-variables-name", text: name }));
      const pick = () => showType(name);
      g.addEventListener("click", pick);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
      labelLayer.append(g);
      return g;
    }

    function makeArrow(name, x2, y2) {
      const p = svg("path", { class: "hz-variables-arrow", d: arrowD(rowY(name), x2, y2), "marker-end": `url(#hz-var-arrow-${uid})` });
      arrowLayer.append(p);
      return p;
    }

    // ---- code panel
    const lines = STEPS.map((s, i) => el("span", { class: "hz-variables-line", "data-i": i }, [el("span", { class: "hz-variables-ln", text: String(i + 1) }), s.code]));
    const code = el("pre", { class: "hz-variables-code", "aria-label": "The program" }, lines);
    const typeOut = el("pre", { class: "hz-variables-type", "aria-live": "polite" });

    const backBtn = HZ.button("Back", () => go(cur - 1, false));
    const stepBtn = HZ.button("Run next line", () => go(cur + 1, true), "primary");
    const resetBtn = HZ.button("Reset", () => go(0, false));
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });

    body.append(
      el("p", { class: "hz-x__lede", html: "A variable is a <strong>name tag</strong>, not a box: the value lives in memory and the name points at it. Run the program one line at a time and watch the arrows." }),
      el("div", { class: "hz-variables-grid" }, [
        el("div", { class: "hz-variables-left" }, [code, typeOut]),
        el("div", { class: "hz-variables-figwrap" }, [fig]),
      ]),
      el("div", { class: "hz-x__controls" }, [backBtn, stepBtn, resetBtn]),
      note
    );

    // ---- state + rendering
    let cur = 0;
    let runId = 0;
    let typeName = null;
    let labels = new Map(), arrows = new Map(), boxes = new Map();

    function showType(name) {
      const b = stateAt(cur).get(name);
      if (!b) return;
      typeName = name;
      typeOut.replaceChildren(
        el("span", { class: "hz-variables-echo", text: ">>> type(" + name + ")\n" }),
        el("span", { class: "hz-variables-res is-" + b.type, text: "<class '" + PYTYPE[b.type] + "'>" })
      );
      labels.forEach((g, n) => g.classList.toggle("is-picked", n === name));
    }

    function renderInstant(k) {
      arrowLayer.replaceChildren();
      boxLayer.replaceChildren();
      labelLayer.replaceChildren();
      labels = new Map(); arrows = new Map(); boxes = new Map();
      for (const [name, b] of stateAt(k)) {
        const box = makeBox(b.value, b.type);
        box.pos(VX, rowY(name));
        boxes.set(name, box);
        arrows.set(name, makeArrow(name, VX, rowY(name)));
        labels.set(name, makeLabel(name));
      }
      lines.forEach((ln, i) => {
        ln.classList.toggle("is-done", i < k - 1);
        ln.classList.toggle("is-on", i === k - 1);
        ln.classList.toggle("is-next", i === k);
      });
      backBtn.disabled = k === 0;
      stepBtn.disabled = k === STEPS.length;
      stepBtn.textContent = k === STEPS.length ? "Done" : "Run next line";
      if (k === 0) {
        typeName = null;
        typeOut.replaceChildren(el("span", { class: "hz-variables-echo", text: ">>> type(...)\n" }), el("span", { class: "hz-variables-hint", text: "run a line, or click a name" }));
        note.innerHTML = "Memory is empty. Click <em>Run next line</em>: each line creates a value and puts a name on it.";
      } else {
        showType(STEPS[k - 1].name);
        note.innerHTML = STEPS[k - 1].note;
      }
    }

    function flash(node, cls = "is-flash") {
      node.classList.remove(cls);
      void node.getBoundingClientRect();
      node.classList.add(cls);
    }

    async function animateStep(i, id) {
      const s = STEPS[i];
      const alive = () => id === runId && body.isConnected;
      lines.forEach((ln, j) => {
        ln.classList.toggle("is-done", j < i);
        ln.classList.toggle("is-on", j === i);
        ln.classList.toggle("is-next", false);
      });
      note.innerHTML = s.note;
      labels.forEach((g) => g.classList.remove("is-picked"));
      backBtn.disabled = stepBtn.disabled = resetBtn.disabled = true;

      // 1. Build the right side in the scratch area.
      let nb;
      if (s.pre) {
        nb = makeBox(s.pre.value, s.pre.type);
        nb.pos(VX, SCR_Y);
        nb.opacity(0);
        await HZ.tween(body, 280, (t) => nb.opacity(t));
        await HZ.wait(450);
        if (!alive()) return;
        nb.set(s.expr[0], null, true);
        flash(nb.g);
        await HZ.wait(550);
        if (!alive()) return;
        nb.set(s.value, s.type, false);
        flash(nb.g, "is-pop");
        await HZ.wait(450);
      } else if (s.expr) {
        nb = makeBox(s.expr[0], null, { expr: true });
        nb.pos(VX, SCR_Y);
        nb.opacity(0);
        await HZ.tween(body, 280, (t) => nb.opacity(t));
        if (!alive()) return;
        // Reading a variable: light up the label and the value it points at.
        const lab = labels.get(s.reads), old = boxes.get(s.reads);
        lab && lab.classList.add("is-read");
        old && old.g.classList.add("is-read");
        await HZ.wait(550);
        if (!alive()) return;
        nb.set(s.expr[1], null, true);
        flash(nb.g);
        await HZ.wait(600);
        if (!alive()) return;
        lab && lab.classList.remove("is-read");
        old && old.g.classList.remove("is-read");
        nb.set(s.value, s.type, false);
        flash(nb.g, "is-pop");
        await HZ.wait(450);
      } else {
        nb = makeBox(s.value, s.type);
        nb.pos(VX, SCR_Y);
        nb.opacity(0);
        flash(nb.g, "is-pop");
        await HZ.tween(body, 300, (t) => nb.opacity(t));
        await HZ.wait(250);
      }
      if (!alive()) return;

      // 2. Attach the label: draw a new arrow, or swing the existing one.
      const y = rowY(s.name);
      const oldBox = boxes.get(s.name);
      let arrow = arrows.get(s.name);
      if (!arrow) {
        const lab = makeLabel(s.name);
        labels.set(s.name, lab);
        lab.style.opacity = "0";
        await HZ.tween(body, 260, (t) => { lab.style.opacity = String(t); lab.setAttribute("transform", `translate(${LX - 12 * (1 - t)} ${y - LH / 2})`); });
        if (!alive()) return;
        arrow = makeArrow(s.name, VX, SCR_Y);
        arrows.set(s.name, arrow);
        const len = arrow.getTotalLength ? arrow.getTotalLength() : 200;
        arrow.style.strokeDasharray = len;
        arrow.style.strokeDashoffset = len;
        await HZ.tween(body, 420, (t) => (arrow.style.strokeDashoffset = len * (1 - t)));
        arrow.style.strokeDasharray = "";
        arrow.style.strokeDashoffset = "";
      } else {
        arrow.classList.add("is-moving");
        await HZ.tween(body, 520, (t) => arrow.setAttribute("d", arrowD(y, VX, HZ.lerp(y, SCR_Y, t))));
        arrow.classList.remove("is-moving");
        if (!alive()) return;
        // 3. Nothing points at the old value: it is thrown away.
        if (oldBox) {
          oldBox.g.classList.add("is-orphan");
          await HZ.wait(380);
          if (!alive()) return;
          await HZ.tween(body, 380, (t) => { oldBox.opacity(1 - t); oldBox.g.setAttribute("transform", `translate(${VX + 18 * t} ${y - VH / 2})`); });
        }
      }
      if (!alive()) return;

      // 4. The new value settles into the row; the arrow follows.
      await HZ.tween(body, 460, (t) => {
        const yy = HZ.lerp(SCR_Y, y, t);
        nb.pos(VX, yy);
        arrow.setAttribute("d", arrowD(y, VX, yy));
      });
    }

    async function go(k, animate) {
      k = HZ.clamp(k, 0, STEPS.length);
      const id = ++runId;
      if (animate && k === cur + 1 && !HZ.reducedMotion()) {
        await animateStep(cur, id);
        if (id !== runId || !body.isConnected) return;
      }
      cur = k;
      resetBtn.disabled = false;
      renderInstant(k);
      if (animate && k > 0) {
        const b = boxes.get(STEPS[k - 1].name);
        b && flash(b.g);
      }
    }

    renderInstant(0);
  }

  HZ.register("variables", {
    kicker: "Session 1",
    title: "Variables are labels on values",
    mount,
    css: `
/* Stacked: the code needs its full width to stay readable on a projector; the figure sits under it. */
.md-typeset .hz-variables-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; align-items: start; }
.md-typeset .hz-variables-left { display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; }
.md-typeset .hz-variables-figwrap { min-width: 0; max-width: 24rem; width: 100%; justify-self: center; }
.md-typeset .hz-variables-code, .md-typeset .hz-variables-type {
  margin: 0; padding: 0.5em 0; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.72rem; line-height: 1.6;
  background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color); overflow-x: auto;
}
.md-typeset .hz-variables-type { padding: 0.5em 0.8em; white-space: pre; min-height: 3.6em; }
.md-typeset .hz-variables-line { display: block; white-space: pre; padding: 0 0.8em 0 0.4em; transition: background-color 200ms ease, box-shadow 200ms ease, color 200ms ease; }
.md-typeset .hz-variables-ln { display: inline-block; width: 1.6em; color: var(--hz-muted); user-select: none; }
.md-typeset .hz-variables-line.is-on { background: var(--hz-a-soft); box-shadow: inset 3px 0 0 var(--hz-a); }
.md-typeset .hz-variables-line.is-done { color: var(--md-default-fg-color--light); }
.md-typeset .hz-variables-line.is-done .hz-variables-ln::before { content: "✓"; position: absolute; margin-left: -0.05em; color: var(--hz-good); }
.md-typeset .hz-variables-line.is-done .hz-variables-ln { color: transparent; position: relative; }
.md-typeset .hz-variables-line.is-next .hz-variables-ln { color: var(--hz-a); }
.md-typeset .hz-variables-echo { color: var(--hz-muted); }
.md-typeset .hz-variables-hint { color: var(--hz-muted); font-style: italic; }
.md-typeset .hz-variables-res { font-weight: 600; }
.md-typeset .hz-variables-res.is-int { color: var(--hz-b); }
.md-typeset .hz-variables-res.is-float { color: var(--hz-a); }
.md-typeset .hz-variables-res.is-str { color: var(--hz-good); }
.md-typeset .hz-variables-res.is-bool { color: var(--hz-ink); }

.md-typeset .hz-x svg text.hz-variables-colhead { font-size: 12px; letter-spacing: 0.04em; fill: var(--hz-muted); }
.md-typeset .hz-variables-scratch { fill: none; stroke: var(--hz-line); stroke-width: 1.2; stroke-dasharray: 5 4; }
.md-typeset .hz-x svg text.hz-variables-scrlab { font-size: 12px; fill: var(--hz-muted); font-style: italic; }
.md-typeset .hz-variables-label { cursor: pointer; outline: none; }
.md-typeset .hz-variables-label rect { fill: var(--hz-card); stroke: var(--md-default-fg-color--light); stroke-width: 1.2; transition: fill 200ms ease, stroke 200ms ease; }
.md-typeset .hz-variables-label:hover rect, .md-typeset .hz-variables-label:focus-visible rect { stroke: var(--md-primary-fg-color); stroke-width: 2; }
.md-typeset .hz-variables-label.is-picked rect { stroke: var(--md-primary-fg-color); }
.md-typeset .hz-variables-label.is-read rect { fill: var(--hz-a-soft); stroke: var(--hz-a); stroke-width: 2; }
.md-typeset .hz-variables-hole { fill: none; stroke: var(--hz-muted); stroke-width: 1.2; }
.md-typeset .hz-x svg text.hz-variables-name { font-size: 13px; font-weight: 600; fill: var(--md-default-fg-color); }
.md-typeset .hz-variables-arrow { fill: none; stroke: var(--hz-ink); stroke-width: 1.6; stroke-opacity: 0.7; transition: stroke 200ms ease; }
.md-typeset .hz-variables-arrow.is-moving { stroke: var(--hz-a); stroke-opacity: 1; stroke-width: 2; }
.md-typeset .hz-variables-head { fill: var(--hz-ink); }
.md-typeset .hz-variables-box rect:first-child { fill: var(--md-default-bg-color); stroke: var(--hz-line); stroke-width: 1.4; transition: fill 200ms ease, stroke 200ms ease; }
.md-typeset .hz-variables-box.is-expr rect:first-child { stroke: var(--hz-muted); stroke-dasharray: 4 3; fill: transparent; }
.md-typeset .hz-variables-box.is-read rect:first-child { fill: var(--hz-a-soft); stroke: var(--hz-a); stroke-width: 2; }
.md-typeset .hz-variables-box.is-orphan rect:first-child { stroke: var(--hz-bad); stroke-dasharray: 4 3; }
.md-typeset .hz-variables-box.is-flash rect:first-child { animation: hz-variables-flash 480ms ease-out; }
.md-typeset .hz-variables-box.is-pop { animation: hz-variables-pop 320ms ease-out; transform-box: fill-box; transform-origin: center; }
@keyframes hz-variables-flash { 0% { fill: var(--hz-a-soft); } }
@keyframes hz-variables-pop { 0% { scale: 0.92; } 60% { scale: 1.04; } 100% { scale: 1; } }
.md-typeset .hz-x svg text.hz-variables-val { font-size: 14px; fill: var(--md-default-fg-color); }
.md-typeset .hz-variables-box.is-expr text.hz-variables-val { fill: var(--md-default-fg-color--light); }
.md-typeset .hz-variables-badge rect { stroke-width: 1; }
.md-typeset .hz-x svg .hz-variables-badge text { font-size: 12px; }
.md-typeset .hz-variables-badge.is-int rect { stroke: var(--hz-b); fill: color-mix(in srgb, var(--hz-b) 12%, transparent); }
.md-typeset .hz-x svg .hz-variables-badge.is-int text { fill: var(--hz-b); }
.md-typeset .hz-variables-badge.is-float rect { stroke: var(--hz-a); fill: color-mix(in srgb, var(--hz-a) 12%, transparent); }
.md-typeset .hz-x svg .hz-variables-badge.is-float text { fill: var(--hz-a); }
.md-typeset .hz-variables-badge.is-str rect { stroke: var(--hz-good); fill: color-mix(in srgb, var(--hz-good) 12%, transparent); }
.md-typeset .hz-x svg .hz-variables-badge.is-str text { fill: var(--hz-good); }
.md-typeset .hz-variables-badge.is-bool rect { stroke: var(--hz-ink); fill: color-mix(in srgb, var(--hz-ink) 12%, transparent); }
.md-typeset .hz-x svg .hz-variables-badge.is-bool text { fill: var(--hz-ink); }
@media (prefers-reduced-motion: reduce) { .md-typeset .hz-variables-box.is-pop, .md-typeset .hz-variables-box.is-flash rect:first-child { animation: none; } }
`,
  });
})();
