/* Week 5: one dial for model complexity. A regression tree of depth 1–15
   fits Puerto Varas's nightly rate along the day of the year. Training error
   always falls as the tree deepens; error on bookings it never saw falls,
   then rises: the U-shape of overfitting. Cross-validation finds the bottom of
   the U without touching the test set. */
(function () {
  const { el, svg, slider, button, segmented, stats, scale, tween, clamp, lerp } = HZ;

  // [day of year of arrival, nightly rate USD, fold]: 200 Standard-room bookings
  // at Puerto Varas from altamar_bookings_clean.csv. 140 are training rows
  // (fold 0–4 for 5-fold cross-validation); fold -1 marks the 60 test rows.
  const DATA = [[10,192,3],[15,163,3],[292,141,1],[334,129,3],[200,197,1],[303,102,0],[204,126,1],[57,141,4],[349,110,3],[305,130,4],[71,100,2],[356,114,1],[286,108,1],[286,119,4],[39,168,0],[339,188,3],[110,91,1],[360,159,0],[350,123,1],[33,175,0],[117,56,4],[243,99,3],[180,104,4],[208,144,2],[32,109,3],[321,88,4],[182,79,3],[197,155,2],[240,113,2],[335,117,0],[270,74,3],[256,88,0],[187,152,2],[198,154,0],[13,183,2],[185,167,0],[185,178,0],[193,190,4],[189,142,2],[93,82,0],[211,186,1],[258,102,3],[320,111,0],[18,151,3],[86,131,1],[242,110,0],[333,109,2],[325,129,3],[83,130,1],[151,81,3],[37,124,4],[45,151,2],[42,143,3],[54,142,1],[359,126,0],[22,156,1],[212,164,0],[31,189,4],[71,123,0],[229,141,0],[125,79,3],[89,127,4],[203,128,0],[283,107,4],[44,139,3],[64,140,0],[194,121,2],[256,104,2],[244,86,4],[55,174,2],[226,104,3],[349,113,4],[234,127,4],[10,128,0],[79,122,1],[347,148,2],[187,149,3],[100,127,0],[52,158,0],[54,158,4],[31,170,3],[78,131,3],[209,159,3],[333,120,0],[8,172,1],[198,124,2],[299,105,4],[290,71,4],[340,188,3],[207,121,1],[311,104,2],[140,94,2],[212,128,0],[99,101,2],[207,165,4],[159,68,1],[9,129,4],[58,150,1],[191,177,1],[28,154,1],[279,96,3],[118,100,4],[340,137,1],[73,103,0],[190,127,1],[65,113,4],[363,95,0],[318,88,2],[14,168,2],[352,149,0],[358,136,1],[99,94,1],[17,189,3],[284,98,4],[113,99,1],[103,106,1],[42,198,2],[187,147,2],[6,153,1],[130,87,4],[210,170,2],[281,134,2],[209,141,2],[82,116,3],[4,168,2],[29,173,4],[148,80,1],[147,81,4],[36,146,3],[341,134,4],[54,139,0],[343,166,1],[188,122,2],[24,163,4],[333,109,0],[26,182,2],[75,131,3],[216,125,4],[13,180,3],[360,156,2],[48,143,-1],[6,146,-1],[33,210,-1],[164,107,-1],[49,156,-1],[351,155,-1],[228,101,-1],[235,99,-1],[17,181,-1],[29,173,-1],[191,160,-1],[270,80,-1],[325,90,-1],[45,143,-1],[165,82,-1],[352,124,-1],[181,91,-1],[133,91,-1],[244,89,-1],[365,154,-1],[110,89,-1],[25,161,-1],[188,178,-1],[277,101,-1],[360,167,-1],[286,97,-1],[52,196,-1],[11,172,-1],[231,93,-1],[88,128,-1],[196,167,-1],[40,157,-1],[8,139,-1],[343,148,-1],[32,177,-1],[30,188,-1],[23,144,-1],[47,151,-1],[138,72,-1],[342,151,-1],[241,89,-1],[22,129,-1],[318,133,-1],[43,167,-1],[121,97,-1],[215,99,-1],[127,99,-1],[207,175,-1],[261,109,-1],[55,167,-1],[163,59,-1],[311,134,-1],[357,149,-1],[345,148,-1],[138,105,-1],[296,109,-1],[13,163,-1],[310,92,-1],[6,170,-1],[351,136,-1]];
  const MAX_DEPTH = 15, K = 5;
  const W = 540, H = 320, M = { l: 50, r: 14, t: 14, b: 42 };
  const MONTH_START = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  const pts = DATA.map(([x, y, fold]) => ({ x, y, fold }));
  const train = pts.filter((p) => p.fold >= 0), test = pts.filter((p) => p.fold < 0);

  // CART on one input, grown to MAX_DEPTH. Because it is greedy, the tree with
  // max_depth = d is exactly this tree cut at depth d.
  function grow(list, depth) {
    const n = list.length;
    const mean = list.reduce((s, p) => s + p.y, 0) / n;
    const node = { depth, mean };
    if (depth >= MAX_DEPTH || n < 2) return node;
    const s = list.slice().sort((a, b) => a.x - b.x);
    const tot = s.reduce((a, p) => a + p.y, 0), tot2 = s.reduce((a, p) => a + p.y * p.y, 0);
    const parent = tot2 - (tot * tot) / n;
    let best = null, sl = 0, sl2 = 0;
    for (let i = 0; i < n - 1; i++) {
      sl += s[i].y;
      sl2 += s[i].y * s[i].y;
      if (s[i].x === s[i + 1].x) continue;
      const nl = i + 1, nr = n - nl, sr = tot - sl, sr2 = tot2 - sl2;
      const e = sl2 - (sl * sl) / nl + sr2 - (sr * sr) / nr;
      if (!best || e < best.e - 1e-9) best = { e, t: (s[i].x + s[i + 1].x) / 2 };
    }
    if (!best || parent - best.e < 1e-9) return node;
    node.t = best.t;
    node.left = grow(s.filter((p) => p.x <= best.t), depth + 1);
    node.right = grow(s.filter((p) => p.x > best.t), depth + 1);
    return node;
  }
  function predict(node, x, d) {
    while (node.left && node.depth < d) node = x <= node.t ? node.left : node.right;
    return node.mean;
  }
  function leaves(node, d) {
    return !node.left || node.depth >= d ? 1 : leaves(node.left, d) + leaves(node.right, d);
  }
  const mae = (tree, set, d) => set.reduce((s, p) => s + Math.abs(p.y - predict(tree, p.x, d)), 0) / set.length;

  function model() {
    const full = grow(train, 0);
    const cvTrees = [];
    for (let f = 0; f < K; f++) cvTrees.push({ tree: grow(train.filter((p) => p.fold !== f), 0), val: train.filter((p) => p.fold === f) });
    const rows = [];
    for (let d = 1; d <= MAX_DEPTH; d++) {
      const curve = [];
      for (let x = 1; x <= 365; x++) curve.push(predict(full, x, d));
      rows.push({
        d, curve, leaves: leaves(full, d),
        train: mae(full, train, d),
        test: mae(full, test, d),
        cv: cvTrees.reduce((s, c) => s + mae(c.tree, c.val, d), 0) / K,
      });
    }
    return rows;
  }

  function mount(body) {
    const rows = model();
    let depth = 2, mode = "test";
    let shown = rows[depth - 1].curve.slice();
    let anim = 0;
    const bestOf = (k) => rows.reduce((b, r) => (r[k] < b[k] - 1e-9 ? r : b));

    const ylo = 40, yhi = Math.ceil(Math.max(...pts.map((p) => p.y)) / 20) * 20;
    const xs = scale([1, 365], [M.l, W - M.r]);
    const ys = scale([ylo, yhi], [H - M.b, M.t]);

    const plot = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-cd-plot", role: "img", "aria-label": "Puerto Varas bookings by day of the year with the tree's fitted rate" });
    for (let v = ylo; v <= yhi; v += 20) {
      plot.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
      if ((v - ylo) % 40 === 0) plot.append(svg("text", { x: M.l - 8, y: ys(v) + 4, "text-anchor": "end", text: v }));
    }
    MONTH_START.forEach((d, i) => plot.append(svg("text", { x: xs(d + 14), y: H - M.b + 17, "text-anchor": "middle", text: MONTHS[i] })));
    plot.append(
      svg("line", { class: "hz-axis", x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }),
      svg("text", { x: (M.l + W - M.r) / 2, y: H - 4, "text-anchor": "middle", text: "arrival date (month of the year)" }),
      svg("text", { class: "hz-ytitle", x: 12, y: (M.t + H - M.b) / 2, transform: `rotate(-90 12 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "nightly rate (USD)" })
    );
    const testDots = svg("g", { class: "hz-cd-testdots" });
    test.forEach((p) => testDots.append(svg("circle", { cx: xs(p.x), cy: ys(p.y), r: 3.4, class: "hz-cd-test" })));
    const trainDots = svg("g");
    train.forEach((p) => trainDots.append(svg("circle", { cx: xs(p.x), cy: ys(p.y), r: 3.2, class: "hz-cd-train" })));
    const curve = svg("path", { class: "hz-cd-curve" });
    plot.append(testDots, trainDots, curve);

    // Error by depth
    const EW = 360, EH = 220, EM = { l: 36, r: 10, t: 26, b: 34 };
    const allErr = rows.flatMap((r) => [r.train, r.test, r.cv]);
    const ehi = Math.ceil(Math.max(...allErr) / 5) * 5;
    const ex = scale([1, MAX_DEPTH], [EM.l, EW - EM.r]);
    const ey = scale([0, ehi], [EH - EM.b, EM.t]);
    const err = svg("svg", { viewBox: `0 0 ${EW} ${EH}`, class: "hz-cd-err", role: "img", "aria-label": "Training error and test or cross-validation error for every depth" });
    for (let v = 0; v <= ehi; v += 5) {
      err.append(svg("line", { class: "hz-gridline", x1: EM.l, x2: EW - EM.r, y1: ey(v), y2: ey(v) }));
      if (v % 10 === 0) err.append(svg("text", { x: EM.l - 6, y: ey(v) + 4, "text-anchor": "end", text: v }));
    }
    [1, 5, 10, 15].forEach((d) => err.append(svg("text", { x: ex(d), y: EH - EM.b + 15, "text-anchor": "middle", text: d })));
    err.append(
      svg("line", { class: "hz-axis", x1: EM.l, x2: EW - EM.r, y1: EH - EM.b, y2: EH - EM.b }),
      svg("text", { x: (EM.l + EW - EM.r) / 2, y: EH - 2, "text-anchor": "middle", text: "tree depth" })
    );
    const pathOf = (k) => rows.map((r, i) => (i ? "L" : "M") + ex(r.d).toFixed(1) + "," + ey(r[k]).toFixed(1)).join("");
    const marker = svg("line", { class: "hz-cd-marker", y1: EM.t, y2: EH - EM.b });
    const trainLine = svg("path", { class: "hz-stroke-b", "stroke-width": 2, d: pathOf("train") });
    const checkLine = svg("path", { class: "hz-stroke-a hz-cd-check", "stroke-width": 2.5 });
    const checkDots = svg("g");
    const sweet = svg("g", { class: "hz-cd-sweet" }, [svg("circle", { r: 7 })]);
    const sweetLab = svg("text", { class: "hz-cd-sweetlab", y: EM.t - 8, "text-anchor": "middle" });
    const sweetGuide = svg("line", { class: "hz-cd-sweetguide", y1: EM.t - 4 });
    const curTrain = svg("circle", { r: 4.5, class: "hz-fill-b hz-cd-cur" });
    const curCheck = svg("circle", { r: 4.5, class: "hz-fill-a hz-cd-cur" });
    err.append(marker, sweetGuide, trainLine, checkLine, checkDots, sweet, sweetLab, curTrain, curCheck);
    const errLegend = el("div", { class: "hz-legend" });

    let shownCheck = rows.map((r) => r.test);
    function drawCheck(animate) {
      const k = mode;
      const from = shownCheck.slice(), to = rows.map((r) => r[k]);
      const b = bestOf(k);
      const id = ++anim2;
      tween(body, animate ? 500 : 0, (t) => {
        if (id !== anim2) return;
        shownCheck = from.map((v, i) => lerp(v, to[i], t));
        checkLine.setAttribute("d", shownCheck.map((v, i) => (i ? "L" : "M") + ex(i + 1).toFixed(1) + "," + ey(v).toFixed(1)).join(""));
        checkDots.replaceChildren(...shownCheck.map((v, i) => svg("circle", { cx: ex(i + 1), cy: ey(v), r: 2, class: "hz-fill-a" })));
      });
      sweet.setAttribute("transform", `translate(${ex(b.d)},${ey(b[k])})`);
      sweetLab.textContent = `sweet spot: depth ${b.d}`;
      sweetLab.setAttribute("x", clamp(ex(b.d), EM.l + 62, EW - EM.r - 62));
      sweetGuide.setAttribute("x1", ex(b.d));
      sweetGuide.setAttribute("x2", ex(b.d));
      sweetGuide.setAttribute("y2", ey(b[k]) - 7);
      errLegend.replaceChildren(
        el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "training rows"]),
        el("span", {}, [el("i", { style: "background: var(--hz-a)" }), k === "test" ? "test rows (never seen)" : "5-fold cross-validation"])
      );
    }
    let anim2 = 0;

    const verdict = el("span", { class: "hz-cd-verdict" });
    const readout = stats();
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
    const usd = (v) => "USD " + v.toFixed(1);

    function show(animate) {
      const r = rows[depth - 1];
      const from = shown.slice();
      const id = ++anim;
      tween(body, animate ? 420 : 0, (t) => {
        if (id !== anim) return;
        shown = from.map((v, i) => lerp(v, r.curve[i], t));
        let d = "";
        shown.forEach((v, i) => (d += (i ? "L" : "M") + xs(i + 1).toFixed(1) + "," + ys(clamp(v, ylo - 10, yhi + 10)).toFixed(1)));
        curve.setAttribute("d", d);
      });
      marker.setAttribute("x1", ex(depth));
      marker.setAttribute("x2", ex(depth));
      curTrain.setAttribute("cx", ex(depth));
      curTrain.setAttribute("cy", ey(r.train));
      curCheck.setAttribute("cx", ex(depth));
      curCheck.setAttribute("cy", ey(r[mode]));
      const b = bestOf(mode);
      const label = mode === "test" ? "Test error" : "Cross-validation error";
      readout.set([
        ["Tree depth", String(depth)],
        [`Groups for ${train.length} bookings`, String(r.leaves)],
        ["Training error", usd(r.train), "is-b"],
        [label, usd(r[mode]), "is-a"],
      ]);
      const gap = r[mode] - b[mode];
      const v = depth < b.d && gap > 0.6 ? "under" : depth > b.d && gap > 0.6 ? "over" : "good";
      verdict.textContent = { under: "Too simple", good: "Sweet spot", over: "Memorising" }[v];
      verdict.className = "hz-cd-verdict is-" + v;
      const where = mode === "test" ? "on the 60 test bookings" : "averaged over the 5 validation folds";
      note.innerHTML = {
        under: `<strong>Too simple.</strong> With ${r.leaves} groups the tree cannot follow both seasons (summer and the July winter holidays). It misses training and new bookings alike: error ${usd(r.train)} on training, ${usd(r[mode])} ${where}.`,
        good: `<strong>Near the sweet spot.</strong> The steps follow the summer peak and the July bump, and stop there. Error ${where}: ${usd(r[mode])}, the lowest region of the U (best: depth ${b.d}).`,
        over: `<strong>Memorising.</strong> ${r.leaves} groups for ${train.length} bookings: many groups hold one or two bookings, so the curve chases their noise. Training error falls to ${usd(r.train)}, but error ${where} rises to ${usd(r[mode])}.`,
      }[v] + (mode === "cv" ? " Cross-validation never looks at the test rows (faded): it scores each depth on training rows held out in turn." : "");
    }

    const sDepth = slider({ label: "Tree depth (complexity)", min: 1, max: MAX_DEPTH, step: 1, value: depth, oninput: (v) => { sweepId++; depth = v; show(true); } });
    let sweepId = 0;
    async function sweep() {
      const id = ++sweepId;
      sweepBtn.disabled = true;
      for (let d = 1; d <= MAX_DEPTH && id === sweepId && body.isConnected; d++) {
        depth = d;
        sDepth.set(d);
        show(true);
        await new Promise((r) => setTimeout(r, HZ.reducedMotion() ? 0 : 520));
      }
      sweepBtn.disabled = false;
    }
    const sweepBtn = button("Sweep depth 1 → 15", sweep, "primary");
    const modeSeg = segmented(
      [{ value: "test", label: "Check on a test set" }, { value: "cv", label: "5-fold cross-validation" }],
      mode,
      (v) => {
        mode = v;
        body.classList.toggle("is-cv", v === "cv");
        drawCheck(true);
        show(false);
      }
    );

    body.append(
      el("p", { class: "hz-x__lede", html: `${pts.length} Standard-room bookings at <strong>Puerto Varas</strong>: ${train.length} to train on, ${test.length} kept aside. Turn the dial: deeper trees ask more questions about the date. Watch the two errors on the right.` }),
      el("div", { class: "hz-x__controls" }, [modeSeg.node]),
      plot,
      el("div", { class: "hz-legend" }, [
        el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "training booking"]),
        el("span", {}, [el("i", { style: "border: 2px solid var(--hz-a); box-sizing: border-box" }), "test booking"]),
        el("span", {}, [el("i", { style: "background: var(--hz-ink); border-radius: 2px; height: 3px; vertical-align: 0.2em" }), "tree's predicted rate"]),
      ]),
      el("div", { class: "hz-x__controls" }, [sDepth.node, sweepBtn]),
      el("div", { class: "hz-cd-below" }, [
        el("div", { class: "hz-cd-side" }, [verdict, readout.node]),
        el("div", {}, [el("p", { class: "hz-cd-errh", text: "Typical error (USD per night) by depth" }), err, errLegend]),
      ]),
      note
    );
    drawCheck(false);
    show(false);
  }

  HZ.register("complexity-dial", {
    kicker: "Week 5",
    title: "One dial for complexity",
    mount,
    css: `
.md-typeset .hz-cd-train { fill: var(--hz-b); fill-opacity: 0.75; }
.md-typeset .hz-cd-test { fill: var(--hz-card); stroke: var(--hz-a); stroke-width: 1.6; }
.md-typeset .hz-cd-testdots { transition: opacity 300ms ease; }
.md-typeset .is-cv .hz-cd-testdots { opacity: 0.18; }
.md-typeset .hz-cd-curve { fill: none; stroke: var(--hz-ink); stroke-width: 2.4; stroke-linejoin: round; }
.md-typeset .hz-cd-marker { stroke: var(--hz-ink); stroke-width: 1; stroke-dasharray: 3 3; }
.md-typeset .hz-cd-cur { stroke: var(--hz-card); stroke-width: 1.5; }
.md-typeset .is-cv .hz-cd-check { stroke-dasharray: 6 3; }
.md-typeset .hz-cd-sweet circle { fill: none; stroke: var(--hz-good); stroke-width: 2; }
.md-typeset .hz-x svg text.hz-cd-sweetlab { font-size: 12px; font-weight: 600; fill: var(--hz-good); }
.md-typeset .hz-cd-sweetguide { stroke: var(--hz-good); stroke-width: 1; stroke-dasharray: 2 3; }
.md-typeset .hz-cd-below { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 0.8rem 1.4rem; align-items: start; }
@media (max-width: 40em) { .md-typeset .hz-cd-below { grid-template-columns: minmax(0, 1fr); } }
.md-typeset .hz-x__body p.hz-cd-errh { font-size: 0.66rem; color: var(--md-default-fg-color--light); margin-bottom: 0.2rem; }
.md-typeset .hz-x svg.hz-cd-err text { font-size: 12px; }
.md-typeset .hz-cd-side { display: flex; flex-direction: column; gap: 0.7rem; }
.md-typeset .hz-cd-verdict { align-self: flex-start; font-size: 0.7rem; font-weight: 600; padding: 0.25em 0.8em; border-radius: 999px; border: 1px solid currentColor; transition: color 200ms ease, background-color 200ms ease; }
.md-typeset .hz-cd-verdict.is-good { color: var(--hz-good); background: color-mix(in srgb, var(--hz-good) 12%, transparent); }
.md-typeset .hz-cd-verdict.is-under, .md-typeset .hz-cd-verdict.is-over { color: var(--hz-bad); background: color-mix(in srgb, var(--hz-bad) 12%, transparent); }
@media (max-width: 30em) { .md-typeset .hz-x svg.hz-cd-plot text { font-size: 21px; } .md-typeset .hz-x svg text.hz-ytitle { display: none; } .md-typeset .hz-x svg.hz-cd-err text, .md-typeset .hz-x svg text.hz-cd-sweetlab { font-size: 14px; } }
`,
  });
})();
