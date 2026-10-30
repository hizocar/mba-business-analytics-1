/* Session 4: choose the threshold with money. Total cost of a calling list
   = offer cost × customers called + churner cost × churners not called,
   for every threshold, on the 1,247 test customers of the Session 4 model.
   Changing either cost moves the cheapest threshold, which sits near the
   break-even probability offer / churner. */
(function () {
  const { el, svg, slider, button, stats, scale, tween, lerp, clamp } = HZ;

  // Predicted churn probabilities of the test customers, in thousandths
  // (floor(p × 1000)), split by what really happened. Same numbers as the notebook.
  const CHURN = [16,21,22,27,29,34,35,35,37,38,39,42,44,46,47,52,55,57,57,60,61,62,63,66,69,69,73,79,81,82,82,83,86,88,89,95,96,97,99,99,99,100,102,104,109,110,112,113,113,114,118,119,120,126,127,129,131,132,134,134,134,137,137,138,140,142,142,143,149,154,155,156,157,158,167,169,170,172,172,173,178,178,179,179,182,182,183,185,187,191,191,193,201,205,207,207,209,212,216,218,222,223,225,225,225,227,228,229,231,233,237,239,244,250,252,252,254,255,255,257,264,264,272,272,274,277,277,281,286,291,294,295,296,296,299,300,308,310,311,316,322,332,332,333,333,334,334,337,349,350,361,362,363,366,379,387,390,395,401,412,412,426,427,430,439,459,462,463,463,466,475,483,486,488,491,502,502,518,520,530,540,544,547,550,552,555,560,584,587,651,654,655,664,664,668,672,673,679,705,708,709,717,719,745,833];
  const STAY = [7,7,8,11,11,11,12,12,13,13,13,13,14,14,15,15,15,15,16,16,16,17,17,17,18,18,18,18,19,19,19,19,19,19,19,19,20,20,20,20,20,20,20,20,21,21,21,21,22,22,22,22,22,22,22,22,22,23,23,23,23,23,23,24,24,24,24,24,24,24,24,24,25,25,25,25,26,26,26,26,26,26,27,27,27,27,27,28,28,28,28,28,28,28,29,29,29,29,29,29,29,29,29,29,30,30,30,30,30,30,30,30,30,31,31,31,31,31,32,32,32,33,33,33,33,33,33,33,33,33,34,34,34,34,34,35,35,35,35,36,36,36,36,36,36,37,37,37,37,37,37,38,38,38,38,39,39,39,39,40,40,40,40,40,40,40,40,41,41,41,41,42,42,42,42,42,42,42,43,43,43,43,43,43,43,43,44,44,44,44,45,45,45,46,46,46,46,46,47,47,47,47,47,47,47,48,48,48,48,48,48,48,48,49,49,49,49,49,49,49,49,49,49,50,50,51,51,51,52,52,52,52,52,53,53,53,53,53,53,54,54,54,55,55,55,55,55,55,55,55,56,56,56,56,56,56,56,56,56,56,56,56,57,57,57,57,57,57,57,58,58,58,58,58,59,59,59,59,59,59,60,60,60,60,60,60,60,60,60,61,61,61,61,61,62,62,62,62,62,62,62,62,62,63,63,63,63,63,64,64,64,64,64,64,64,64,64,64,65,66,66,66,66,66,66,66,66,66,67,67,67,67,67,67,68,68,68,68,69,69,69,69,70,71,71,71,71,71,71,72,72,72,72,72,73,73,73,73,73,73,74,74,74,74,74,75,75,75,75,75,75,76,76,76,77,78,78,78,78,78,78,79,79,79,79,79,79,79,80,80,80,80,80,81,81,81,81,82,82,83,83,83,83,83,83,83,84,84,84,84,84,84,84,84,84,84,85,85,85,85,85,85,86,86,86,86,86,86,86,87,87,87,87,87,87,87,88,88,88,89,89,89,89,89,90,90,90,91,91,91,92,92,92,93,93,93,93,93,94,94,94,94,94,95,95,95,95,95,95,95,96,96,96,96,96,96,97,97,97,98,98,98,98,98,98,99,99,99,100,100,100,100,100,100,100,100,100,101,101,101,101,102,102,102,102,103,103,103,103,104,104,104,104,105,105,105,105,105,105,105,106,106,106,106,106,107,107,107,107,108,108,108,108,108,109,109,109,109,109,109,110,110,110,111,111,112,112,112,114,114,114,114,115,115,115,115,115,115,115,115,115,116,116,116,117,117,117,118,118,118,118,119,119,119,119,120,120,120,120,120,121,121,122,122,122,122,123,124,124,124,125,125,125,125,125,125,125,125,125,126,126,126,126,126,127,127,127,127,127,127,127,128,128,129,129,129,131,131,132,132,132,133,133,133,134,134,134,134,134,135,135,135,135,137,137,138,138,138,138,139,139,140,140,140,140,141,141,141,142,142,142,143,143,143,143,143,144,144,144,144,144,144,145,145,145,145,146,146,146,146,146,146,147,147,148,148,148,148,149,150,151,151,151,151,151,152,152,152,152,152,152,153,153,153,154,154,154,154,154,155,155,155,156,157,157,158,158,158,158,158,158,158,158,159,159,160,160,161,161,161,162,162,162,162,162,162,163,163,163,163,164,164,165,166,166,166,166,167,167,168,168,169,169,169,170,170,170,171,171,171,171,171,172,172,172,172,173,174,174,174,175,175,175,176,177,178,178,178,179,179,179,179,180,181,181,181,182,183,183,183,183,186,186,186,186,187,187,189,189,189,190,190,190,190,190,192,193,193,194,194,195,195,195,195,196,196,197,197,197,198,199,199,199,199,200,201,201,202,203,203,204,204,205,206,206,206,206,207,207,207,207,208,208,208,208,208,209,209,209,209,211,211,212,212,213,213,214,214,214,215,215,216,216,216,218,220,221,222,223,226,226,226,228,228,229,232,232,232,236,237,237,237,239,240,241,242,242,242,243,243,244,244,244,248,249,250,250,250,252,252,253,253,253,254,254,254,255,255,256,256,260,263,264,267,268,270,271,271,273,273,276,280,280,280,284,284,284,285,285,287,288,289,290,290,292,292,294,296,297,298,299,299,301,302,302,302,303,305,306,306,307,307,307,307,310,311,311,311,311,313,313,318,319,319,320,321,322,325,326,328,331,331,334,334,334,334,335,336,336,336,337,338,339,340,340,342,342,345,348,356,357,359,359,361,361,362,362,362,362,363,364,365,367,367,368,369,370,373,377,377,380,381,382,383,384,384,386,387,388,390,398,407,410,410,412,412,412,423,425,426,431,432,438,438,439,450,458,464,472,487,492,499,510,517,526,536,539,555,557,568,573,658];

  const W = 520, H = 300, M = { l: 66, r: 18, t: 24, b: 46 };
  const TS = Array.from({ length: 101 }, (_, i) => i); // thresholds 0.00..1.00 in hundredths: 0 calls everyone, 1 calls nobody
  const N_CHURN = CHURN.length, N = CHURN.length + STAY.length;

  // Counts per threshold do not depend on the costs: compute them once.
  const COUNTS = TS.map((t) => {
    const tp = CHURN.filter((v) => v >= t * 10).length;
    const fp = STAY.filter((v) => v >= t * 10).length;
    return { t: t / 100, tp, fp, fn: N_CHURN - tp, tn: STAY.length - fp, called: tp + fp };
  });

  const usd = (v) => "USD " + Math.round(v).toLocaleString("en-US");
  const k = (v) => (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0).replace(/\.0$/, "") + "k" : String(v));

  function niceStep(max) {
    for (const s of [2000, 5000, 10000, 20000, 25000, 50000, 100000, 200000]) if (max / s <= 5) return s;
    return 500000;
  }

  function mount(body) {
    body.classList.add("hz-ct");
    let miss = 300, offer = 40;

    const xs = scale([0, 1], [M.l, W - M.r]);
    const fig = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-ct-plot", role: "img", "aria-label": "Total cost of the calling list for each threshold" });
    const yAxis = svg("g");
    fig.append(yAxis);
    [0, 0.2, 0.4, 0.6, 0.8, 1].forEach((t) => fig.append(svg("text", { x: xs(t), y: H - M.b + 18, "text-anchor": "middle", text: t ? t.toFixed(1) : "0" })));
    fig.append(svg("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", text: "threshold: call if p ≥ threshold" }));
    fig.append(svg("line", { class: "hz-axis", x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));

    // The two ends of the curve are the two non-strategies.
    const refNobodyTxt = svg("text", { class: "hz-ct-reftxt", x: W - M.r, "text-anchor": "end", text: "call nobody" });
    const refAllTxt = svg("text", { class: "hz-ct-reftxt", x: M.l + 4 });
    const beLine = svg("line", { class: "hz-ct-be", y1: M.t, y2: H - M.b });
    const beTxt = svg("text", { class: "hz-ct-betxt", y: H - M.b - 8 });
    const curve = svg("path", { class: "hz-ct-curve" });
    const halfDot = svg("circle", { class: "hz-ct-half", r: 6 });
    const halfTxt = svg("text", { class: "hz-ct-halftxt", "text-anchor": "middle", text: "0.50" });
    const bestDrop = svg("line", { class: "hz-ct-drop" });
    const bestDot = svg("circle", { class: "hz-ct-best", r: 7 });
    const bestTxt = svg("text", { class: "hz-ct-besttxt" });
    fig.append(refNobodyTxt, refAllTxt, beLine, beTxt, curve, halfDot, halfTxt, bestDrop, bestDot, bestTxt);

    // Confusion counts at the cheapest threshold (shared classes from the threshold explainer)
    const cell = (cls, name) => {
      const n = el("strong", { text: "0" });
      return { n, node: el("div", { class: "hz-thr-cell " + cls }, [n, el("span", { text: name })]) };
    };
    const cm = { tp: cell("is-tp", "called, kept"), fn: cell("is-fn", "missed"), fp: cell("is-fp", "wasted offer"), tn: cell("is-tn", "left alone") };
    const matrix = el("div", { class: "hz-thr-matrix" }, [
      el("span"), el("span", { class: "hz-thr-h", text: "called" }), el("span", { class: "hz-thr-h", text: "not called" }),
      el("span", { class: "hz-thr-h hz-thr-h--row", text: "was leaving" }), cm.tp.node, cm.fn.node,
      el("span", { class: "hz-thr-h hz-thr-h--row", text: "would stay" }), cm.fp.node, cm.tn.node,
    ]);
    const matrixTitle = el("p", { class: "hz-ct-mtitle" });
    const readout = stats();
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });

    // State in pixels, so changes of costs (and of the y scale) can morph.
    function compute() {
      const costs = COUNTS.map((c) => offer * c.called + miss * c.fn);
      let bi = 0;
      costs.forEach((v, i) => { if (v < costs[bi]) bi = i; });
      const nobody = miss * N_CHURN, everyone = offer * N;
      const top = Math.max(nobody, everyone, ...costs) * 1.12;
      const step = niceStep(top);
      const ymax = Math.ceil(top / step) * step;
      const ys = scale([0, ymax], [H - M.b, M.t]);
      const hi = TS.indexOf(50);
      return {
        costs, bi, nobody, everyone, ymax, step, ys,
        px: { curve: costs.map(ys), nobody: ys(nobody), all: ys(everyone), best: ys(costs[bi]), bestX: xs(COUNTS[bi].t), half: ys(costs[hi]), be: xs(clamp(offer / miss, 0, 1)) },
      };
    }

    let shown = null, anim = 0, rolled = { tp: 0, fp: 0, fn: 0, tn: 0 };

    function update(animate) {
      const S = compute();
      drawAxis(S);
      drawText(S);
      const from = shown, to = S.px, id = ++anim;
      if (!from || !animate) { shown = to; drawShapes(S, to); return; }
      tween(body, 420, (q) => {
        if (id !== anim) return;
        shown = {
          curve: to.curve.map((v, i) => lerp(from.curve[i], v, q)),
          nobody: lerp(from.nobody, to.nobody, q), all: lerp(from.all, to.all, q),
          best: lerp(from.best, to.best, q), bestX: lerp(from.bestX, to.bestX, q),
          half: lerp(from.half, to.half, q), be: lerp(from.be, to.be, q),
        };
        drawShapes(S, shown);
      });
    }

    function drawAxis(S) {
      yAxis.replaceChildren();
      for (let v = 0; v <= S.ymax + 1; v += S.step) {
        yAxis.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: S.ys(v), y2: S.ys(v) }));
        yAxis.append(svg("text", { x: M.l - 8, y: S.ys(v) + 4, "text-anchor": "end", text: v ? k(v) : "0" }));
      }
      yAxis.append(svg("text", { x: 14, y: (M.t + H - M.b) / 2, transform: `rotate(-90 14 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "total cost (USD)" }));
    }

    function drawShapes(S, p) {
      curve.setAttribute("d", p.curve.map((y, i) => (i ? "L" : "M") + xs(COUNTS[i].t).toFixed(1) + "," + y.toFixed(1)).join(""));
      refNobodyTxt.setAttribute("y", p.nobody - 10);
            refAllTxt.setAttribute("y", p.all - 12);
      beLine.setAttribute("x1", p.be); beLine.setAttribute("x2", p.be);
      const beRight = p.be > W - M.r - 190;
      beTxt.setAttribute("x", beRight ? p.be - 6 : p.be + 6);
      beTxt.setAttribute("text-anchor", beRight ? "end" : "start");
      const hx = xs(0.5);
      halfDot.setAttribute("cx", hx); halfDot.setAttribute("cy", p.half);
      halfTxt.setAttribute("x", hx); halfTxt.setAttribute("y", p.half - 13);
      halfTxt.style.opacity = Math.abs(p.bestX - hx) < 60 ? 0 : 1;
      bestDot.setAttribute("cx", p.bestX); bestDot.setAttribute("cy", p.best);
      bestDrop.setAttribute("x1", p.bestX); bestDrop.setAttribute("x2", p.bestX);
      bestDrop.setAttribute("y1", p.best); bestDrop.setAttribute("y2", H - M.b);
      const leftHalf = p.bestX < (M.l + W - M.r) / 2;
      bestTxt.setAttribute("x", leftHalf ? p.bestX + 12 : p.bestX - 12);
      bestTxt.setAttribute("text-anchor", leftHalf ? "start" : "end");
      bestTxt.setAttribute("y", p.best + 24 > H - M.b - 4 ? p.best - 14 : p.best + 24);
    }

    function drawText(S) {
      const c = COUNTS[S.bi], best = S.costs[S.bi], half = S.costs[TS.indexOf(50)];
      const be = offer / miss;
      beTxt.textContent = `break-even ${offer}/${miss} = ${be.toFixed(2)}`;
      beTxt.style.opacity = be <= 1 ? 1 : 0;
      beLine.style.opacity = be <= 1 ? 1 : 0;
      refAllTxt.textContent = "call everyone";
      bestTxt.textContent = `cheapest: ${c.t.toFixed(2)} · ${usd(best)}`;
      matrixTitle.textContent = `At threshold ${c.t.toFixed(2)}, the ${N.toLocaleString("en-US")} test customers:`;
      rollTo(c);
      readout.set([
        ["Customers called", String(c.called)],
        ["Total cost", usd(best), "is-a"],
        ["Saved vs calling nobody", usd(S.nobody - best), "is-good"],
        ["Saved vs threshold 0.50", usd(half - best)],
      ]);
      const ratio = miss / offer;
      const ratioTxt = ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1).replace(/\.0$/, "");
      let msg = `A missed churner costs ${ratioTxt}× an offer, so a call pays off whenever p &gt; ${offer}/${miss} ≈ <strong>${be.toFixed(2)}</strong>. `;
      if (c.called === 0 || best >= S.nobody) msg += `Here offers are too dear: even the riskiest customers are not worth a call, so <strong>calling nobody</strong> is cheapest.`;
      else if (S.bi === 0) msg += `Offers are so cheap that <strong>calling everyone</strong> is cheapest: ${usd(best)}. The model only earns its keep when offers cost something.`;
      else msg += `The cheapest list uses threshold <strong>${c.t.toFixed(2)}</strong>: call ${c.called} customers for ${usd(best)}, against ${usd(half)} with the habit of 0.50.`;
      note.innerHTML = msg;
    }

    function rollTo(c) {
      const from = { ...rolled }, id = ++rollId;
      tween(body, 300, (q) => {
        if (id !== rollId) return;
        for (const key of ["tp", "fp", "fn", "tn"]) {
          rolled[key] = Math.round(lerp(from[key], c[key], q));
          cm[key].n.textContent = rolled[key];
        }
      });
    }
    let rollId = 0;

    const sm = slider({ label: "Missed churner (USD)", min: 50, max: 600, step: 10, value: miss, format: (v) => String(v), oninput: (v) => { miss = v; update(true); } });
    const so = slider({ label: "One offer (USD)", min: 5, max: 200, step: 5, value: offer, format: (v) => String(v), oninput: (v) => { offer = v; update(true); } });
    const preset = (label, m, o, variant) => button(label, () => { miss = m; offer = o; sm.set(m); so.set(o); update(true); }, variant);

    body.append(
      el("p", { class: "hz-x__lede", html: "Every point of the curve is one possible calling list: everyone whose predicted probability of leaving is above the threshold. Its height is what that list costs Cordillera. Threshold 0 calls everyone, threshold 1 calls nobody. These are the real probabilities of our model for the 1,247 test customers." }),
      fig,
      el("div", { class: "hz-legend" }, [
        el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "cheapest threshold"]),
        el("span", {}, [el("i", { style: "border: 2px solid var(--hz-ink)" }), "the habit, 0.50"]),
        el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "break-even: offer ÷ churner"]),
      ]),
      el("div", { class: "hz-ct-bottom" }, [el("div", { class: "hz-ct-side" }, [matrixTitle, matrix]), readout.node]),
      el("div", { class: "hz-x__controls" }, [sm.node, so.node]),
      el("div", { class: "hz-ct-presets", role: "group", "aria-label": "Cost scenarios" }, [
        preset("Finance: 300 / 40", 300, 40, "primary"),
        preset("Pricier offer: 300 / 100", 300, 100),
        preset("Cheap offer: 300 / 10", 300, 10),
      ]),
      note
    );
    update(false);
  }

  HZ.register("cost-threshold", {
    kicker: "Session 4",
    title: "The threshold that costs least",
    mount,
    css: `
.md-typeset .hz-x svg.hz-ct-plot text { font-size: 13px; }
.md-typeset .hz-ct-curve { fill: none; stroke: var(--hz-ink); stroke-width: 2.8; stroke-linejoin: round; }
.md-typeset .hz-x svg text.hz-ct-reftxt { fill: var(--hz-muted); font-size: 12px; }
.md-typeset .hz-ct-be { stroke: var(--hz-b); stroke-width: 1.5; stroke-dasharray: 2 4; transition: opacity 200ms ease; }
.md-typeset .hz-x svg text.hz-ct-betxt { fill: var(--hz-b); font-size: 12px; transition: opacity 200ms ease; }
.md-typeset .hz-ct-half { fill: var(--hz-card); stroke: var(--hz-ink); stroke-width: 2; }
.md-typeset .hz-x svg text.hz-ct-halftxt { fill: var(--hz-ink); transition: opacity 200ms ease; }
.md-typeset .hz-ct-best { fill: var(--hz-a); stroke: var(--hz-card); stroke-width: 2; }
.md-typeset .hz-ct-drop { stroke: var(--hz-a); stroke-width: 1.2; stroke-dasharray: 3 3; }
.md-typeset .hz-x svg text.hz-ct-besttxt { fill: var(--hz-a); font-weight: 600; paint-order: stroke; stroke: var(--hz-card); stroke-width: 4px; }
.md-typeset .hz-ct-plot { max-width: 46rem; }
.md-typeset .hz-ct-side { display: flex; flex-direction: column; gap: 0.6rem; }
.md-typeset .hz-ct-bottom { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 1.2rem; align-items: end; }
@media (max-width: 44em) { .md-typeset .hz-ct-bottom { grid-template-columns: minmax(0, 1fr); } }
.md-typeset .hz-ct-mtitle { font-size: 0.68rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-ct-presets { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.md-typeset .hz-ct .hz-x__note { min-height: 4.2em; }
@media (max-width: 44em) { .md-typeset .hz-x svg.hz-ct-plot text { font-size: 18px; } .md-typeset .hz-x svg text.hz-ct-reftxt, .md-typeset .hz-x svg text.hz-ct-betxt { font-size: 17px; } }
`,
  });
})();
