/* Week 5: how a decision tree picks its question. Twenty Altamar bookings
   along one feature; the split line cuts them in two groups, each group gets
   a Gini impurity, and the tree keeps the split with the lowest weighted
   Gini. A second feature shows why the real tree asks about lead time first. */
(function () {
  const { el, svg, slider, button, segmented, scale, tween, wait, fmt, clamp } = HZ;

  const W = 520, H = 340, M = { l: 58, r: 18 };
  const STRIP = { top: 34, base: 128 }; // dots stack upwards from base
  const CURVE = { top: 212, bottom: 300 };
  const R = 7, GAP = 16;

  // [lead time in days, special requests, cancelled]
  const CUSTOMERS = [
    [48, 0, 1], [56, 1, 1], [64, 0, 1], [72, 2, 1], [84, 1, 1], [96, 0, 1], [112, 1, 1], [176, 0, 1], [224, 3, 1],
    [0, 1, 0], [8, 0, 0], [16, 2, 0], [24, 0, 0], [32, 1, 0], [40, 0, 0], [104, 2, 0], [128, 3, 0], [144, 1, 0],
    [160, 2, 0], [200, 1, 0],
  ].map(([lead, requests, y]) => ({ v: [lead, requests], y }));

  // A question is "feature ≤ t", with t halfway between two neighbouring values
  // (as scikit-learn does), shown rounded down.
  const FEATURES = [
    { key: 0, name: "lead time", label: "Lead time (days)", axis: "lead time: days between booking and arrival", domain: [-6, 236], ticks: [0, 30, 60, 90, 120, 150, 180, 210] },
    { key: 1, name: "requests", label: "Special requests", axis: "special requests made with the booking", domain: [-0.5, 3.5], ticks: [0, 1, 2, 3] },
  ];

  const gini = (churn, n) => (n ? 1 - (churn / n) ** 2 - ((n - churn) / n) ** 2 : 0);

  function splitAt(f, t) {
    const L = { n: 0, churn: 0 }, Rt = { n: 0, churn: 0 };
    CUSTOMERS.forEach((c) => {
      const side = c.v[f] <= t ? L : Rt;
      side.n++;
      side.churn += c.y;
    });
    L.g = gini(L.churn, L.n);
    Rt.g = gini(Rt.churn, Rt.n);
    const n = CUSTOMERS.length;
    return { L, R: Rt, w: (L.n * L.g + Rt.n * Rt.g) / n };
  }

  // Candidate thresholds: midpoints between neighbouring distinct values.
  function candidates(f) {
    const vals = [...new Set(CUSTOMERS.map((c) => c.v[f]))].sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < vals.length - 1; i++) {
      const mid = (vals[i] + vals[i + 1]) / 2;
      out.push({ i, mid, t: Math.floor(mid), ...splitAt(f, mid) });
    }
    return out;
  }

  function mount(body) {
    const n = CUSTOMERS.length;
    const nChurn = CUSTOMERS.filter((c) => c.y).length;
    const parentG = gini(nChurn, n);
    const cands = FEATURES.map((F) => candidates(F.key));
    const best = cands.map((list) => list.reduce((b, c) => (c.w < b.w - 1e-12 ? c : b), list[0]));
    const winner = best[0].w <= best[1].w ? 0 : 1;

    let f = 0;
    let ci = 0; // index of the current candidate split
    let t = 0;
    const seen = [new Set(), new Set()];
    let busy = 0;

    const plot = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-gini-plot", role: "img", "aria-label": "Bookings along one feature, split by a movable line, with the weighted Gini of every split below" });
    const shadeL = svg("rect", { class: "hz-gini-shade is-left", y: STRIP.top - 22, height: STRIP.base - STRIP.top + 34 });
    const shadeR = svg("rect", { class: "hz-gini-shade is-right", y: STRIP.top - 22, height: STRIP.base - STRIP.top + 34 });
    const axisLayer = svg("g");
    const dotLayer = svg("g");
    const curveLayer = svg("g");
    const labelL = svg("text", { class: "hz-gini-side", y: STRIP.top - 2, "text-anchor": "start" });
    const labelR = svg("text", { class: "hz-gini-side", y: STRIP.top - 2, "text-anchor": "end" });
    const cut = svg("line", { class: "hz-gini-cut", y1: STRIP.top - 22, y2: CURVE.bottom });
    const handle = svg("g", { class: "hz-gini-handle", tabindex: 0, role: "slider", "aria-label": "Split point" }, [
      svg("rect", { x: -26, y: -11, width: 52, height: 22, rx: 11 }),
      svg("text", { y: 4.5, "text-anchor": "middle" }),
    ]);
    plot.append(shadeL, shadeR, axisLayer, curveLayer, dotLayer, cut, labelL, labelR, handle);

    const ys = scale([0, 0.5], [CURVE.bottom, CURVE.top]);
    let xs = scale(FEATURES[0].domain, [M.l, W - M.r]);
    const dots = [];
    const curveDots = [];
    let bestMark = null, parentLine = null;

    function buildFeature() {
      const F = FEATURES[f];
      xs = scale(F.domain, [M.l, W - M.r]);
      axisLayer.replaceChildren();
      dotLayer.replaceChildren();
      curveLayer.replaceChildren();
      dots.length = 0;
      curveDots.length = 0;
      // strip axis
      axisLayer.append(svg("line", { class: "hz-axis", x1: M.l, x2: W - M.r, y1: STRIP.base + 12, y2: STRIP.base + 12 }));
      F.ticks.forEach((v) => axisLayer.append(svg("text", { x: xs(v), y: STRIP.base + 28, "text-anchor": "middle", text: v })));
      axisLayer.append(svg("text", { class: "hz-gini-axis", x: (M.l + W - M.r) / 2, y: STRIP.base + 46, "text-anchor": "middle", text: F.axis }));
      // curve axis
      [0, 0.25, 0.5].forEach((v) => {
        axisLayer.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
        axisLayer.append(svg("text", { x: M.l - 8, y: ys(v) + 4, "text-anchor": "end", text: v.toFixed(2) }));
      });
      axisLayer.append(svg("text", { x: 12, y: (CURVE.top + CURVE.bottom) / 2, transform: `rotate(-90 12 ${(CURVE.top + CURVE.bottom) / 2})`, "text-anchor": "middle", text: "weighted Gini" }));
      parentLine = svg("g", { class: "hz-gini-parent" }, [
        svg("line", { x1: M.l, x2: W - M.r, y1: ys(parentG), y2: ys(parentG) }),
        svg("text", { x: W - M.r, y: ys(parentG) - 6, "text-anchor": "end", text: `before any split: ${parentG.toFixed(2)}` }),
      ]);
      axisLayer.append(parentLine);

      // dots: stack bookings with the same value, kept ones at the bottom
      const groups = {};
      CUSTOMERS.slice().sort((a, b) => a.y - b.y).forEach((c) => (groups[c.v[f]] = groups[c.v[f]] || []).push(c));
      Object.entries(groups).forEach(([v, list]) =>
        list.forEach((c, i) => {
          const d = svg("circle", { cx: xs(+v), cy: STRIP.base - i * GAP, r: R, class: "hz-gini-dot " + (c.y ? "is-churn" : "is-stay") });
          d.append(svg("title", { text: `${c.y ? "cancelled" : "kept"}: booked ${c.v[0]} days ahead, ${c.v[1]} special request${c.v[1] === 1 ? "" : "s"}` }));
          dots.push({ c, d });
          dotLayer.append(d);
        })
      );

      cands[f].forEach((c) => {
        const dot = svg("circle", { cx: xs(c.mid), cy: ys(c.w), r: 3.2, class: "hz-gini-cdot" + (seen[f].has(c.i) ? " is-seen" : "") });
        curveDots.push({ c, dot });
        curveLayer.append(dot);
      });
      const b = best[f];
      bestMark = svg("g", { class: "hz-gini-best", transform: `translate(${xs(b.mid)},${ys(b.w)})` }, [
        svg("circle", { r: 8 }),
        svg("text", { y: 22, "text-anchor": "middle", text: `best: ≤ ${b.t} · ${b.w.toFixed(2)}` }),
      ]);
      curveLayer.append(bestMark);
      sT.input.min = 0;
      sT.input.max = cands[f].length - 1;
    }

    // Group cards
    const card = (side) => {
      const title = el("p", { class: "hz-gini-card__title" });
      const mixC = el("span", { class: "hz-gini-mix__churn" }), mixS = el("span", { class: "hz-gini-mix__stay" });
      const counts = el("p", { class: "hz-gini-card__counts" });
      const gFill = el("span", { class: "hz-gini-gbar__fill" });
      const gVal = el("strong");
      const node = el("div", { class: "hz-gini-card is-" + side }, [
        title,
        el("div", { class: "hz-gini-mix", "aria-hidden": "true" }, [mixC, mixS]),
        counts,
        el("div", { class: "hz-gini-grow" }, [el("span", { text: "Gini" }), el("span", { class: "hz-gini-gbar" }, gFill), gVal]),
      ]);
      return { node, title, mixC, mixS, counts, gFill, gVal };
    };
    const cardL = card("left"), cardR = card("right");
    const formula = el("p", { class: "hz-gini-formula" });
    const note = el("p", { class: "hz-x__note" });

    function setCard(cd, g, rule) {
      cd.title.textContent = rule;
      cd.mixC.style.width = (g.n ? (100 * g.churn) / g.n : 0) + "%";
      cd.mixS.style.width = (g.n ? (100 * (g.n - g.churn)) / g.n : 0) + "%";
      cd.counts.textContent = `${g.n} bookings: ${g.churn} cancelled, ${g.n - g.churn} kept`;
      cd.gFill.style.width = (100 * g.g) / 0.5 + "%";
      cd.gVal.textContent = g.g.toFixed(2);
    }

    function draw() {
      const F = FEATURES[f];
      const cur = cands[f][ci];
      t = cur.t;
      const s = splitAt(f, cur.mid);
      const x = xs(cur.mid);
      seen[f].add(ci);
      shadeL.setAttribute("x", M.l - 10);
      shadeL.setAttribute("width", Math.max(0, x - M.l + 10));
      shadeR.setAttribute("x", x);
      shadeR.setAttribute("width", Math.max(0, W - M.r + 10 - x));
      cut.setAttribute("x1", x);
      cut.setAttribute("x2", x);
      handle.setAttribute("transform", `translate(${x},${STRIP.top - 22})`);
      handle.setAttribute("aria-valuenow", ci);
      handle.setAttribute("aria-valuetext", `${F.name} ≤ ${t}`);
      handle.querySelector("text").textContent = `≤ ${t}`;
      labelL.setAttribute("x", M.l - 6);
      labelL.textContent = x - M.l > 205 ? `≤ ${t}: ${s.L.churn} cancel · ${s.L.n - s.L.churn} keep` : x - M.l > 140 ? `${s.L.churn} cancel · ${s.L.n - s.L.churn} keep` : "";
      labelR.setAttribute("x", W - M.r + 6);
      labelR.textContent = W - M.r - x > 205 ? `> ${t}: ${s.R.churn} cancel · ${s.R.n - s.R.churn} keep` : W - M.r - x > 140 ? `${s.R.churn} cancel · ${s.R.n - s.R.churn} keep` : "";
      dots.forEach(({ c, d }) => d.classList.toggle("is-right", c.v[f] > cur.mid));
      curveDots.forEach(({ c, dot }) => {
        dot.classList.toggle("is-seen", seen[f].has(c.i));
        dot.classList.toggle("is-now", c.i === ci);
      });
      const allSeen = seen[f].size >= cands[f].length;
      bestMark.classList.toggle("is-on", allSeen);

      setCard(cardL, s.L, `${F.name} ≤ ${t}`);
      setCard(cardR, s.R, `${F.name} > ${t}`);
      formula.innerHTML =
        `Weighted Gini = <span class="is-l">${s.L.n}/${n} × ${s.L.g.toFixed(2)}</span> + <span class="is-r">${s.R.n}/${n} × ${s.R.g.toFixed(2)}</span> = <strong>${s.w.toFixed(3)}</strong>` +
        ` <span class="hz-gini-drop">(down ${(parentG - s.w).toFixed(3)} from ${parentG.toFixed(2)})</span>`;

      const isBest = Math.abs(s.w - best[f].w) < 1e-9;
      const other = best[1 - f];
      const nm = (k) => FEATURES[k].name;
      if (isBest && allSeen) {
        note.innerHTML = f === winner
          ? `The best question on ${nm(f)}: <strong>${nm(f)} ≤ ${t}</strong>, weighted Gini ${s.w.toFixed(3)}. It beats the best question on special requests (${other.w.toFixed(3)}), so the tree asks about <strong>lead time first</strong>, like the real tree on Altamar's 4,473 training bookings (lead time ≤ 45.5 days). The right side is still mixed: risk peaks around three months out, so the tree will need another question there.`
          : `The best question on ${nm(f)} gives ${s.w.toFixed(3)}, barely below the ${parentG.toFixed(3)} we started with, but ${nm(1 - f)} ≤ ${other.t} gives ${other.w.toFixed(3)}. The tree compares the best split of <strong>every</strong> feature and keeps the lowest: ${nm(winner)}.`;
      } else if (s.L.g === 0 || s.R.g === 0) {
        note.innerHTML = `One side is <strong>pure</strong> (Gini 0: every booking in it ended the same way). But a pure side is not enough: the weighted Gini also counts how mixed the other, ${s.L.g === 0 ? "right" : "left"} side is.`;
      } else if (!allSeen) {
        note.innerHTML = `Gini = 1 − p<sub>cancel</sub>² − p<sub>keep</sub>²: 0 for a pure group, 0.5 for a 50/50 mix. Each dot below is one split you have tried. You have tried <strong>${seen[f].size} of ${cands[f].length}</strong>; press "Try every split" to let the tree try them all.`;
      } else {
        note.innerHTML = `Every split has been tried. The tree keeps the lowest dot: <strong>${nm(f)} ≤ ${best[f].t}</strong> (ringed). Big groups weigh more: a split that isolates one booking barely lowers the weighted Gini.`;
      }
    }

    function setT(v) {
      ci = clamp(Math.round(v), 0, cands[f].length - 1);
      sT.set(ci);
      draw();
    }

    const sT = slider({ label: "Split at ≤", min: 0, max: 18, step: 1, value: 0, format: (v) => (cands[f][v] ? "≤ " + cands[f][v].t : ""), oninput: (v) => { busy++; setT(v); } });

    async function sweep() {
      const id = ++busy;
      sweepBtn.disabled = true;
      const list = cands[f];
      const ms = f === 0 ? 1800 : 700;
      let last = -1;
      await tween(body, ms, (k) => {
        if (id !== busy) return;
        const i = Math.min(list.length - 1, Math.floor(k * list.length));
        if (i !== last) {
          for (let j = last + 1; j <= i; j++) seen[f].add(j);
          last = i;
          setT(i);
        }
      }, (k) => k);
      if (id !== busy || !body.isConnected) return (sweepBtn.disabled = false);
      list.forEach((c) => seen[f].add(c.i));
      await wait(250);
      if (id !== busy) return (sweepBtn.disabled = false);
      const from = ci, to = best[f].i;
      await tween(body, 500, (k) => id === busy && setT(from + (to - from) * k));
      sweepBtn.disabled = false;
    }

    const sweepBtn = button("Try every split", sweep, "primary");
    const featSeg = segmented(FEATURES.map((F) => ({ value: String(F.key), label: F.label })), "0", (v) => {
      busy++;
      sweepBtn.disabled = false;
      f = +v;
      buildFeature();
      setT(f === 0 ? 1 : 0);
    });

    // Drag the line (pointer anywhere on the strip with a mouse; the handle on touch).
    let dragging = false;
    const toT = (e) => {
      const r = plot.getBoundingClientRect();
      const v = xs.invert(((e.clientX - r.left) / r.width) * W);
      let k = 0;
      cands[f].forEach((c, i) => Math.abs(c.mid - v) < Math.abs(cands[f][k].mid - v) && (k = i));
      return k;
    };
    plot.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" && !handle.contains(e.target)) return;
      dragging = true;
      busy++;
      plot.setPointerCapture(e.pointerId);
      setT(toT(e));
    });
    plot.addEventListener("pointermove", (e) => dragging && setT(toT(e)));
    plot.addEventListener("pointerup", () => (dragging = false));
    handle.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      busy++;
      setT(ci + step);
    });

    body.append(
      el("p", { class: "hz-x__lede", html: "Twenty Altamar bookings, placed by one feature. A tree's question is a line: every booking on the left goes one way, every booking on the right the other. Drag the line and watch how <strong>mixed</strong> each side stays." }),
      el("div", { class: "hz-x__controls" }, [featSeg.node]),
      plot,
      el("div", { class: "hz-legend" }, [
        el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "cancelled"]),
        el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "kept"]),
        el("span", {}, [el("i", { style: "background: var(--hz-ink); opacity: 0.55; transform: scale(0.6)" }), "weighted Gini of a split you tried (lower is better)"]),
      ]),
      el("div", { class: "hz-gini-cards" }, [cardL.node, cardR.node]),
      formula,
      el("div", { class: "hz-x__controls" }, [sT.node, sweepBtn]),
      note
    );
    buildFeature();
    setT(1);
  }

  HZ.register("gini", {
    kicker: "Week 5",
    title: "Choosing a question with Gini impurity",
    mount,
    css: `
.md-typeset .hz-gini-plot { touch-action: pan-y; cursor: ew-resize; }
.md-typeset .hz-x svg text.hz-gini-axis { font-size: 12px; }
.md-typeset .hz-x svg text.hz-gini-side { font-size: 12px; fill: var(--hz-ink); }
.md-typeset .hz-gini-shade.is-left { fill: var(--hz-ink); fill-opacity: 0.035; }
.md-typeset .hz-gini-shade.is-right { fill: var(--hz-ink); fill-opacity: 0.08; }
.md-typeset .hz-gini-dot { stroke: var(--hz-card); stroke-width: 1.5; transition: transform 300ms ease-in-out; }
.md-typeset .hz-gini-dot.is-churn { fill: var(--hz-a); }
.md-typeset .hz-gini-dot.is-stay { fill: var(--hz-b); }
.md-typeset .hz-gini-cut { stroke: var(--hz-ink); stroke-width: 1.5; stroke-dasharray: 5 4; }
.md-typeset .hz-gini-handle { cursor: grab; touch-action: none; }
.md-typeset .hz-gini-handle rect { fill: var(--hz-card); stroke: var(--hz-ink); stroke-width: 1.5; }
.md-typeset .hz-x svg .hz-gini-handle text { font-size: 12px; fill: var(--hz-ink); font-weight: 600; }
.md-typeset .hz-gini-handle:focus-visible { outline: none; }
.md-typeset .hz-gini-handle:focus-visible rect { stroke: var(--md-primary-fg-color); stroke-width: 2.5; }
.md-typeset .hz-gini-parent line { stroke: var(--hz-muted); stroke-dasharray: 2 3; }
.md-typeset .hz-x svg .hz-gini-parent text { font-size: 11.5px; paint-order: stroke; stroke: var(--hz-card); stroke-width: 4px; }
.md-typeset .hz-gini-cdot { fill: var(--hz-ink); opacity: 0; transition: opacity 200ms ease, r 200ms ease; }
.md-typeset .hz-gini-cdot.is-seen { opacity: 0.55; }
.md-typeset .hz-gini-cdot.is-now { opacity: 1; r: 5.5; fill: var(--md-primary-fg-color); }
.md-typeset .hz-gini-best { opacity: 0; transition: opacity 300ms ease; pointer-events: none; }
.md-typeset .hz-gini-best.is-on { opacity: 1; }
.md-typeset .hz-gini-best circle { fill: none; stroke: var(--hz-good); stroke-width: 2; }
.md-typeset .hz-x svg .hz-gini-best text { font-size: 12px; fill: var(--hz-good); font-weight: 600; paint-order: stroke; stroke: var(--hz-card); stroke-width: 4px; }
.md-typeset .hz-gini-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.6rem; }
.md-typeset .hz-gini-card { border: 1px solid var(--hz-line); border-radius: 12px; padding: 0.6rem 0.75rem; background: var(--md-default-bg-color); display: flex; flex-direction: column; gap: 0.35rem; }
.md-typeset .hz-gini-card.is-right { background: color-mix(in srgb, var(--hz-ink) 4%, var(--md-default-bg-color)); }
.md-typeset .hz-x__body p.hz-gini-card__title { font-family: var(--md-code-font); font-weight: 600; color: var(--hz-ink); }
.md-typeset .hz-x__body p.hz-gini-card__counts { color: var(--md-default-fg-color--light); font-size: 0.68rem; }
.md-typeset .hz-gini-mix { display: flex; height: 0.7rem; border-radius: 999px; overflow: hidden; background: var(--hz-grid); }
.md-typeset .hz-gini-mix span { display: block; height: 100%; transition: width 300ms ease-in-out; }
.md-typeset .hz-gini-mix__churn { background: var(--hz-a); }
.md-typeset .hz-gini-mix__stay { background: var(--hz-b); }
.md-typeset .hz-gini-grow { display: grid; grid-template-columns: auto 1fr 2.6em; align-items: center; gap: 0.5rem; font-size: 0.68rem; }
.md-typeset .hz-gini-grow strong { font-family: var(--md-code-font); text-align: right; }
.md-typeset .hz-gini-gbar { position: relative; height: 0.45rem; border-radius: 999px; background: var(--hz-grid); overflow: hidden; }
.md-typeset .hz-gini-gbar__fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--hz-ink); opacity: 0.7; border-radius: 999px; transition: width 300ms ease-in-out; }
.md-typeset .hz-x__body p.hz-gini-formula { font-family: var(--md-code-font); font-size: 0.7rem; line-height: 1.6; }
.md-typeset .hz-gini-formula strong { color: var(--md-primary-fg-color); }
.md-typeset .hz-gini-drop { color: var(--md-default-fg-color--light); }
`,
  });
})();
