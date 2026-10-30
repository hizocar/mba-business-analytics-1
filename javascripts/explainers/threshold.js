/* Class 11: logistic regression turns a score into a probability; the
   threshold turns the probability into a decision, and moves the errors
   between the two off-diagonal cells of the confusion matrix. */
(function () {
  const { el, svg, slider, button, stats, scale, tween, rng, fmt, clamp } = HZ;

  const W = 460, H = 290, M = { l: 58, r: 14, t: 18, b: 40 };

  function makeData() {
    const r = rng(11);
    const pts = [];
    for (let i = 0; i < 34; i++) pts.push({ x: 0.9 + 1.1 * r.normal(), y: 1 });
    for (let i = 0; i < 46; i++) pts.push({ x: -0.7 + 1.1 * r.normal(), y: 0 });
    pts.forEach((p) => (p.j = (r() - 0.5) * 0.09));
    return pts;
  }

  // Plain gradient descent is plenty for one feature and 80 points.
  function fitLogistic(pts) {
    let w = 0, b = 0;
    for (let it = 0; it < 3000; it++) {
      let gw = 0, gb = 0;
      for (const p of pts) {
        const e = sigmoid(w * p.x + b) - p.y;
        gw += e * p.x;
        gb += e;
      }
      w -= (0.5 * gw) / pts.length;
      b -= (0.5 * gb) / pts.length;
    }
    return { w, b };
  }

  const sigmoid = (z) => 1 / (1 + Math.exp(-z));

  function confusion(pts, t) {
    const c = { tp: 0, fp: 0, fn: 0, tn: 0 };
    for (const p of pts) {
      const pred = p.p >= t ? 1 : 0;
      if (pred && p.y) c.tp++;
      else if (pred) c.fp++;
      else if (p.y) c.fn++;
      else c.tn++;
    }
    const n = pts.length;
    c.acc = (c.tp + c.tn) / n;
    c.prec = c.tp + c.fp ? c.tp / (c.tp + c.fp) : NaN;
    c.rec = c.tp / (c.tp + c.fn);
    c.f1 = c.prec + c.rec ? (2 * c.prec * c.rec) / (c.prec + c.rec) : NaN;
    return c;
  }

  function mount(body) {
    const pts = makeData();
    const { w, b } = fitLogistic(pts);
    pts.forEach((p) => (p.p = sigmoid(w * p.x + b)));

    const xs = scale([-3.6, 3.8], [M.l, W - M.r]);
    const ys = scale([0, 1], [H - M.b, M.t]);
    // x where the model's probability equals t
    const cutX = (t) => (Math.log(t / (1 - t)) - b) / w;

    const plot = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Logistic curve with a movable threshold" });
    const region = svg("rect", { y: M.t, height: H - M.t - M.b, style: "fill: var(--hz-a-soft)" });
    plot.append(region);
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
      plot.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
      plot.append(svg("text", { x: M.l - 8, y: ys(v) + 4, "text-anchor": "end", text: v.toFixed(2) }));
    });
    plot.append(svg("line", { class: "hz-axis", x1: M.l, x2: W - M.r, y1: ys(0), y2: ys(0) }));
    plot.append(svg("text", { x: (M.l + W - M.r) / 2, y: H - 8, "text-anchor": "middle", text: "customer score  →  more engaged" }));
    plot.append(svg("text", { x: 12, y: (M.t + H - M.b) / 2, transform: `rotate(-90 12 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "P(buys)" }));

    let d = "";
    for (let i = 0; i <= 120; i++) {
      const x = -3.6 + (7.4 * i) / 120;
      d += (i ? "L" : "M") + xs(x).toFixed(1) + "," + ys(sigmoid(w * x + b)).toFixed(1);
    }
    plot.append(svg("path", { d, class: "hz-stroke-a", "stroke-width": 2.5 }));

    const dots = pts.map((p) => {
      const c = svg("circle", {
        cx: xs(p.x), cy: ys(p.y ? 0.97 + p.j * 0.3 : 0.03 + p.j * 0.3), r: 5,
        class: "hz-thr-dot " + (p.y ? "is-pos" : "is-neg"),
      });
      plot.append(c);
      return c;
    });

    const tLine = svg("line", { x1: M.l, x2: W - M.r, class: "hz-thr-line" });
    const vLine = svg("line", { y1: M.t, y2: H - M.b, class: "hz-thr-line" });
    const handle = svg("circle", { r: 9, class: "hz-thr-handle", tabindex: 0, role: "slider", "aria-label": "Decision threshold" });
    const tLabel = svg("text", { class: "hz-thr-label" });
    plot.append(tLine, vLine, handle, tLabel);

    // Confusion matrix
    const cell = (cls, name) => {
      const n = el("strong", { text: "0" });
      return { n, node: el("div", { class: "hz-thr-cell " + cls }, [n, el("span", { text: name })]) };
    };
    const cm = { tp: cell("is-tp", "true positive"), fn: cell("is-fn", "false negative"), fp: cell("is-fp", "false positive"), tn: cell("is-tn", "true negative") };
    const matrix = el("div", { class: "hz-thr-matrix" }, [
      el("span"), el("span", { class: "hz-thr-h", text: "predicted: buys" }), el("span", { class: "hz-thr-h", text: "predicted: doesn't" }),
      el("span", { class: "hz-thr-h hz-thr-h--row", text: "actually buys" }), cm.tp.node, cm.fn.node,
      el("span", { class: "hz-thr-h hz-thr-h--row", text: "actually doesn't" }), cm.fp.node, cm.tn.node,
    ]);
    const readout = stats();
    const note = el("p", { class: "hz-x__note" });

    let t = 0.5;
    let shown = { tp: 0, fp: 0, fn: 0, tn: 0 };
    let anim = 0;

    function draw() {
      const cx = clamp(xs(cutX(t)), M.l, W - M.r);
      region.setAttribute("x", cx);
      region.setAttribute("width", W - M.r - cx);
      tLine.setAttribute("y1", ys(t));
      tLine.setAttribute("y2", ys(t));
      vLine.setAttribute("x1", cx);
      vLine.setAttribute("x2", cx);
      handle.setAttribute("cx", cx);
      handle.setAttribute("cy", ys(t));
      handle.setAttribute("aria-valuenow", t.toFixed(2));
      tLabel.setAttribute("x", cx > W - 120 ? cx - 12 : cx + 12);
      tLabel.setAttribute("text-anchor", cx > W - 120 ? "end" : "start");
      tLabel.setAttribute("y", ys(t) - 10);
      tLabel.textContent = "threshold " + t.toFixed(2);
      pts.forEach((p, i) => dots[i].classList.toggle("is-wrong", (p.p >= t ? 1 : 0) !== p.y));

      const c = confusion(pts, t);
      countTo(c);
      readout.set([
        ["Accuracy", fmt(c.acc)],
        ["Precision", fmt(c.prec), "is-a"],
        ["Recall", fmt(c.rec), "is-a"],
        ["F1", fmt(c.f1)],
      ]);
      note.innerHTML =
        t < 0.35
          ? "Low threshold: we pitch to almost everyone. Few buyers are missed (high recall), but many pitches are wasted (<strong>false positives</strong>)."
          : t > 0.65
            ? "High threshold: we only pitch when we are very sure. Pitches are rarely wasted (high precision), but we miss buyers (<strong>false negatives</strong>)."
            : "Near 0.5, the default of <code>model.predict()</code>. Moving the threshold never changes the model, only the decision.";
    }

    // Counts roll to their new values so the trade-off between cells is visible.
    function countTo(c) {
      const from = { ...shown };
      const id = ++anim;
      tween(body, 260, (k) => {
        if (id !== anim) return;
        for (const key of ["tp", "fp", "fn", "tn"]) {
          shown[key] = Math.round(from[key] + (c[key] - from[key]) * k);
          cm[key].n.textContent = shown[key];
        }
      });
    }

    const s = slider({ label: "Threshold", min: 0.05, max: 0.95, step: 0.01, value: t, format: (v) => v.toFixed(2), oninput: (v) => { t = v; draw(); } });

    function animateTo(target) {
      const from = t;
      tween(body, 500, (k) => {
        t = from + (target - from) * k;
        s.set(t);
        draw();
      });
    }
    function best(metric) {
      let bt = 0.5, bv = -1;
      for (let v = 0.05; v <= 0.951; v += 0.01) {
        const c = confusion(pts, v);
        // ties go to the least extreme threshold
        const score = metric === "rec" ? c.rec + v * 1e-3 : metric === "prec" ? (c.tp >= 5 ? c.prec - v * 1e-3 : -1) : c.f1;
        if (score > bv) (bv = score), (bt = v);
      }
      return bt;
    }

    // Drag the handle (or anywhere on the plot) to move the threshold.
    let dragging = false;
    const toT = (e) => {
      const r = plot.getBoundingClientRect();
      const y = ((e.clientY - r.top) / r.height) * H;
      return clamp(ys.invert(y), 0.05, 0.95);
    };
    // On touch screens only the handle grabs the pointer, so the page can still scroll.
    plot.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" && e.target !== handle) return;
      dragging = true;
      plot.setPointerCapture(e.pointerId);
      t = toT(e);
      s.set(t);
      draw();
    });
    plot.addEventListener("pointermove", (e) => { if (dragging) { t = toT(e); s.set(t); draw(); } });
    plot.addEventListener("pointerup", () => (dragging = false));
    handle.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowUp" ? 0.01 : e.key === "ArrowDown" ? -0.01 : 0;
      if (!step) return;
      e.preventDefault();
      t = clamp(t + step, 0.05, 0.95);
      s.set(t);
      draw();
    });

    body.append(
      el("p", { class: "hz-x__lede", html: "Logistic regression gives each customer a probability of buying the travel package. The <strong>threshold</strong> decides who gets the pitch. Drag the line up and down and watch errors move between the two red cells." }),
      el("div", { class: "hz-x__split" }, [
        el("div", {}, [
          plot,
          el("div", { class: "hz-legend" }, [
            el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "bought"]),
            el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "did not buy"]),
            el("span", {}, [el("i", { style: "border: 2px solid var(--hz-muted)" }), "hollow = misclassified"]),
          ]),
        ]),
        el("div", { class: "hz-thr-side" }, [matrix, readout.node]),
      ]),
      el("div", { class: "hz-x__controls" }, [
        s.node,
        el("div", { class: "hz-thr-presets", role: "group", "aria-label": "Jump to a threshold" }, [
          button("Max recall", () => animateTo(best("rec"))),
          button("Best F1", () => animateTo(best("f1")), "primary"),
          button("Max precision", () => animateTo(best("prec"))),
        ]),
      ]),
      note
    );
    plot.classList.add("hz-thr-plot");
    draw();
  }

  HZ.register("threshold", { kicker: "Session 4", title: "Moving the decision threshold", mount });
})();
