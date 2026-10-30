/* Class 12b: the ROC curve is what you get by sliding the threshold across
   two score distributions; AUC measures how far apart those distributions are. */
(function () {
  const { el, svg, slider, button, stats, scale, tween, fmt, clamp, lerp } = HZ;

  const W = 520, H = 300, M = { l: 20, r: 16, t: 34, b: 40 };
  const RW = 300, RH = 300, RM = { l: 52, r: 12, t: 12, b: 40 };
  const NPOS = 300, NNEG = 700;
  const GRID = 241;
  let uid = 0;

  // Standard normal CDF (Abramowitz & Stegun 7.1.26, error < 1.5e-7).
  function Phi(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
    return x >= 0 ? 0.5 + y / 2 : 0.5 - y / 2;
  }
  const phi = (x) => Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);
  const logit = (p) => Math.log(p / (1 - p));

  // Model scores: sigmoid of a normal on the logit scale, means ±sep/2.
  // Density on the 0–1 score axis: φ(logit p − μ) / (p(1 − p)).
  const density = (p, mu) => phi(logit(p) - mu) / (p * (1 - p));
  const above = (t, mu) => 1 - Phi(logit(t) - mu); // share of a class scored ≥ t

  function rocPoints(sep) {
    const pts = [[0, 0]];
    for (let i = 0; i < GRID; i++) {
      const z = 9 - (18 * i) / (GRID - 1); // threshold on the logit scale, high → low
      pts.push([1 - Phi(z + sep / 2), 1 - Phi(z - sep / 2)]);
    }
    pts.push([1, 1]);
    return pts;
  }
  function trapezoid(pts) {
    let a = 0;
    for (let i = 1; i < pts.length; i++) a += ((pts[i][0] - pts[i - 1][0]) * (pts[i][1] + pts[i - 1][1])) / 2;
    return a;
  }

  function mount(body) {
    const id = "hz-roc-" + ++uid;
    let t = 0.5, sep = 1.6;
    let sweeping = false, anim = 0;

    const xs = scale([0, 1], [M.l, W - M.r]);
    let ys = scale([0, 1], [H - M.b, M.t]);
    const rx = scale([0, 1], [RM.l, RW - RM.r]);
    const ry = scale([0, 1], [RH - RM.b, RM.t]);

    const hatch = (cls, name) =>
      svg("pattern", { id: `${id}-${name}`, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, [
        svg("rect", { width: 6, height: 6, class: `hz-roc-hbg ${cls}` }),
        svg("line", { x1: 0, y1: 0, x2: 0, y2: 6, class: `hz-roc-hline ${cls}` }),
      ]);

    // Score distributions
    const plot = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-roc-plot", role: "img", "aria-label": "Score distributions of buyers and non-buyers with a movable threshold" });
    plot.append(svg("defs", {}, [hatch("is-neg", "fp"), hatch("is-pos", "fn")]));
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
      plot.append(svg("line", { class: "hz-gridline", x1: xs(v), x2: xs(v), y1: M.t, y2: H - M.b }));
      plot.append(svg("text", { x: xs(v), y: H - M.b + 16, "text-anchor": "middle", text: v }));
    });
    plot.append(
      svg("line", { class: "hz-axis", x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }),
      svg("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", text: "model score: P(buys)" })
    );
    const area = {};
    ["tn", "fp", "fn", "tp"].forEach((k) => (area[k] = svg("path", { class: "hz-roc-area is-" + k })));
    area.fp.setAttribute("fill", `url(#${id}-fp)`);
    area.fn.setAttribute("fill", `url(#${id}-fn)`);
    const negLine = svg("path", { class: "hz-stroke-b", "stroke-width": 2 });
    const posLine = svg("path", { class: "hz-stroke-a", "stroke-width": 2 });
    const negLabel = svg("text", { class: "hz-roc-clabel is-neg", "text-anchor": "middle", text: "did not buy (700)" });
    const posLabel = svg("text", { class: "hz-roc-clabel is-pos", "text-anchor": "middle", text: "bought (300)" });
    const tLine = svg("line", { y1: M.t - 4, y2: H - M.b, class: "hz-roc-tline" });
    const hit = svg("rect", { y: M.t - 22, width: 28, height: H - M.b - M.t + 22, class: "hz-roc-hit" });
    const knob = svg("circle", { cy: M.t - 10, r: 8, class: "hz-roc-knob", tabindex: 0, role: "slider", "aria-label": "Threshold", "aria-valuemin": 0.01, "aria-valuemax": 0.99 });
    const tLabel = svg("text", { y: M.t - 6, class: "hz-roc-tlabel" });
    const leftLab = svg("text", { y: M.t + 12, "text-anchor": "end", class: "hz-roc-side", text: "← predict: no" });
    const rightLab = svg("text", { y: M.t + 12, class: "hz-roc-side", text: "predict: buys →" });
    plot.append(area.tn, area.fp, area.fn, area.tp, negLine, posLine, negLabel, posLabel, leftLab, rightLab, tLine, hit, knob, tLabel);

    // ROC curve
    const roc = svg("svg", { viewBox: `0 0 ${RW} ${RH}`, role: "img", "aria-label": "ROC curve with the current threshold marked" });
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
      roc.append(
        svg("line", { class: "hz-gridline", x1: rx(v), x2: rx(v), y1: ry(0), y2: ry(1) }),
        svg("line", { class: "hz-gridline", x1: rx(0), x2: rx(1), y1: ry(v), y2: ry(v) }),
        svg("text", { x: rx(v), y: RH - RM.b + 15, "text-anchor": "middle", text: v }),
        svg("text", { x: RM.l - 6, y: ry(v) + 4, "text-anchor": "end", text: v })
      );
    });
    const aucFill = svg("path", { class: "hz-roc-aucfill" });
    const rocLine = svg("path", { class: "hz-roc-curve" });
    const traced = svg("path", { class: "hz-roc-traced" });
    const guideX = svg("line", { class: "hz-roc-guide" });
    const guideY = svg("line", { class: "hz-roc-guide" });
    const dot = svg("circle", { r: 6, class: "hz-roc-dot" });
    const aucText = svg("text", { x: rx(0.96), y: ry(0.06), "text-anchor": "end", class: "hz-roc-auc" });
    roc.append(
      aucFill,
      svg("line", { x1: rx(0), y1: ry(0), x2: rx(1), y2: ry(1), class: "hz-roc-diag" }),
      svg("text", { x: rx(0.62), y: ry(0.55), class: "hz-roc-diaglabel", transform: `rotate(-45 ${rx(0.62)} ${ry(0.55)})`, "text-anchor": "middle", text: "random (AUC 0.5)" }),
      rocLine, traced, guideX, guideY, dot, aucText,
      svg("line", { class: "hz-axis", x1: rx(0), x2: rx(1), y1: ry(0), y2: ry(0) }),
      svg("line", { class: "hz-axis", x1: rx(0), x2: rx(0), y1: ry(0), y2: ry(1) }),
      svg("text", { x: (RM.l + RW - RM.r) / 2, y: RH - 6, "text-anchor": "middle", text: "false positive rate (FPR)" }),
      svg("text", { x: 11, y: (RM.t + RH - RM.b) / 2, transform: `rotate(-90 11 ${(RM.t + RH - RM.b) / 2})`, "text-anchor": "middle", text: "true positive rate (TPR)" })
    );

    const readout = stats();
    const counts = el("div", { class: "hz-roc-counts" });
    const note = el("p", { class: "hz-x__note" });

    const path = (pts, X, Y) => pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join("");

    function draw(traceTo) {
      const mn = -sep / 2, mp = sep / 2;
      // Expected counts per score unit for each class.
      const ps = [];
      for (let i = 1; i < 200; i++) ps.push(i / 200);
      const neg = ps.map((p) => [p, NNEG * density(p, mn)]);
      const pos = ps.map((p) => [p, NPOS * density(p, mp)]);
      const ymax = Math.max(...neg.map((q) => q[1]), ...pos.map((q) => q[1])) * 1.08;
      ys = scale([0, ymax], [H - M.b, M.t + 18]);
      const curve = (arr) => [[0, 0], ...arr, [1, 0]];
      const fillPath = (arr, lo, hi) => {
        const seg = [[lo, 0], ...arr.filter((q) => q[0] > lo && q[0] < hi), [hi, 0]];
        // close the edge at the threshold with the exact curve height
        const at = (x) => (x <= 0 || x >= 1 ? 0 : (arr === neg ? NNEG * density(x, mn) : NPOS * density(x, mp)));
        seg.splice(1, 0, [lo, at(lo)]);
        seg.splice(seg.length - 1, 0, [hi, at(hi)]);
        return path(seg, xs, ys) + "Z";
      };
      negLine.setAttribute("d", path(curve(neg), xs, ys));
      posLine.setAttribute("d", path(curve(pos), xs, ys));
      area.tn.setAttribute("d", fillPath(neg, 0, t));
      area.fp.setAttribute("d", fillPath(neg, t, 1));
      area.fn.setAttribute("d", fillPath(pos, 0, t));
      area.tp.setAttribute("d", fillPath(pos, t, 1));
      const peak = (arr) => arr.reduce((a, b) => (b[1] > a[1] ? b : a));
      const pn = peak(neg), pp = peak(pos);
      negLabel.setAttribute("x", clamp(xs(pn[0]), 70, W - 70));
      negLabel.setAttribute("y", ys(pn[1]) - 6);
      posLabel.setAttribute("x", clamp(xs(pp[0]), 70, W - 70));
      posLabel.setAttribute("y", ys(pp[1]) - 6 - (Math.abs(xs(pp[0]) - xs(pn[0])) < 120 && Math.abs(ys(pp[1]) - ys(pn[1])) < 16 ? 14 : 0));

      const tx = xs(t);
      tLine.setAttribute("x1", tx);
      tLine.setAttribute("x2", tx);
      hit.setAttribute("x", tx - 14);
      knob.setAttribute("cx", tx);
      knob.setAttribute("aria-valuenow", t.toFixed(2));
      tLabel.setAttribute("x", tx > W - 90 ? tx - 14 : tx + 14);
      tLabel.setAttribute("text-anchor", tx > W - 90 ? "end" : "start");
      tLabel.textContent = "threshold " + t.toFixed(2);
      leftLab.setAttribute("x", tx - 8);
      rightLab.setAttribute("x", tx + 8);
      leftLab.style.display = tx < M.l + 90 ? "none" : "";
      rightLab.style.display = tx > W - M.r - 100 ? "none" : "";

      // Rates at t (expected counts, so the curve is smooth)
      const tpr = above(t, mp), fpr = above(t, mn);
      const tp = NPOS * tpr, fp = NNEG * fpr, fn = NPOS - tp, tn = NNEG - fp;
      const prec = tp + fp > 0.5 ? tp / (tp + fp) : NaN;

      const pts = rocPoints(sep);
      const auc = trapezoid(pts);
      rocLine.setAttribute("d", path(pts, rx, ry));
      const upTo = traceTo === undefined ? pts : pts.filter((p) => p[0] <= fpr + 1e-9).concat([[fpr, tpr]]);
      aucFill.setAttribute("d", path(upTo, rx, ry) + `L${rx(upTo[upTo.length - 1][0])},${ry(0)}L${rx(0)},${ry(0)}Z`);
      traced.setAttribute("d", traceTo === undefined ? "" : path(upTo, rx, ry));
      dot.setAttribute("cx", rx(fpr));
      dot.setAttribute("cy", ry(tpr));
      guideX.setAttribute("x1", rx(fpr)); guideX.setAttribute("x2", rx(fpr));
      guideX.setAttribute("y1", ry(tpr)); guideX.setAttribute("y2", ry(0));
      guideY.setAttribute("x1", rx(0)); guideY.setAttribute("x2", rx(fpr));
      guideY.setAttribute("y1", ry(tpr)); guideY.setAttribute("y2", ry(tpr));
      const partial = traceTo !== undefined ? trapezoid(upTo) : auc;
      aucText.textContent = (traceTo !== undefined ? "area so far " : "AUC ") + partial.toFixed(3);

      readout.set([
        ["Threshold", fmt(t)],
        ["TPR = recall = TP / P", fmt(tpr, 3), "is-a"],
        ["FPR = FP / N", fmt(fpr, 3), "is-b"],
        ["Precision = TP / (TP + FP)", fmt(prec, 3)],
        ["AUC (trapezoid)", fmt(auc, 3), auc > 0.85 ? "is-good" : auc < 0.65 ? "is-bad" : null],
      ]);
      const cell = (k, label, v) => el("span", { class: "hz-roc-cell is-" + k }, [el("i"), `${label} `, el("b", { text: Math.round(v) })]);
      counts.replaceChildren(cell("tp", "TP", tp), cell("fn", "FN", fn), cell("fp", "FP", fp), cell("tn", "TN", tn));

      note.innerHTML =
        sep < 0.35
          ? "The two groups get the same scores, so every threshold catches buyers and non-buyers at the same rate: the ROC curve is the diagonal and <strong>AUC ≈ 0.5</strong>, a coin flip."
          : auc > 0.95
            ? "Scores barely overlap, so some threshold catches almost every buyer while flagging almost no one else: the curve hugs the top-left corner and <strong>AUC → 1</strong>."
            : "Each threshold is one point on the ROC curve. Moving it left catches more buyers (TPR ↑) but also flags more non-buyers (FPR ↑). The <strong>AUC</strong> depends only on how much the two curves overlap, not on the threshold.";
    }

    function setT(v) {
      t = clamp(v, 0.01, 0.99);
      sT.set(t);
      draw();
    }
    function cancel() {
      anim++;
      sweeping = false;
      sweepBtn.disabled = false;
    }

    const sT = slider({ label: "Threshold", min: 0.01, max: 0.99, step: 0.01, value: t, format: (v) => v.toFixed(2), oninput: (v) => { cancel(); setT(v); } });
    const sSep = slider({ label: "Separation", min: 0, max: 3, step: 0.05, value: sep, format: (v) => v.toFixed(2), oninput: (v) => { cancel(); sep = v; draw(); } });

    async function sweep() {
      if (sweeping) return;
      const me = ++anim;
      sweeping = true;
      sweepBtn.disabled = true;
      t = 0.99;
      // linear in the logit so the point travels the curve at a readable pace
      await tween(body, 2600, (k) => {
        if (me !== anim) return;
        t = 1 / (1 + Math.exp(-lerp(4.6, -4.6, k)));
        sT.set(t);
        draw(k < 1 ? k : undefined);
      }, (k) => k);
      if (me === anim) cancel(), draw();
    }
    const sweepBtn = button("Sweep threshold 1 → 0", sweep, "primary");

    // Dragging the threshold: the knob or the band around the line (and, with
    // a mouse, anywhere on the plot).
    let dragging = false;
    const toT = (e) => {
      const r = plot.getBoundingClientRect();
      return xs.invert(((e.clientX - r.left) / r.width) * W);
    };
    plot.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" && e.target !== knob && e.target !== hit) return;
      e.preventDefault();
      cancel();
      dragging = true;
      plot.setPointerCapture(e.pointerId);
      setT(toT(e));
    });
    plot.addEventListener("pointermove", (e) => dragging && setT(toT(e)));
    plot.addEventListener("pointerup", () => (dragging = false));
    plot.addEventListener("pointercancel", () => (dragging = false));
    knob.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 0.01, ArrowUp: 0.01, ArrowLeft: -0.01, ArrowDown: -0.01 }[e.key];
      if (!step) return;
      e.preventDefault();
      cancel();
      setT(t + step);
    });

    body.append(
      el("p", { class: "hz-x__lede", html: "A model gives every customer a score. Buyers (orange) should score high, non-buyers (teal) low, but the two groups overlap. The <strong>threshold</strong> splits each group in two; the <strong>ROC curve</strong> records the result for every possible threshold." }),
      el("div", { class: "hz-x__split" }, [
        el("div", {}, [plot, counts]),
        el("div", {}, [roc]),
      ]),
      el("div", { class: "hz-roc-bottom" }, [
        el("div", { class: "hz-roc-controls" }, [sT.node, sSep.node, el("div", { class: "hz-x__controls" }, [sweepBtn])]),
        readout.node,
      ]),
      note
    );
    plot.classList.add("hz-roc-plot");
    draw();
  }

  HZ.register("roc", { kicker: "Session 5", title: "ROC curve and AUC, built by a threshold", mount });
})();
