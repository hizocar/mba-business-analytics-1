/* Week 4: the model gives each booking a probability of cancelling; the
   threshold turns it into a decision ("likely to cancel": resell the room)
   and moves the errors between the two off-diagonal cells of the confusion
   matrix. The 80 dots are real test bookings of the week 4 notebook model:
   x is the model's score, so the curve is exactly that model's probability. */
(function () {
  const { el, svg, slider, button, stats, scale, tween, fmt, clamp } = HZ;

  const W = 460, H = 290, M = { l: 58, r: 14, t: 18, b: 40 };
  const X0 = -3.2, X1 = 2.3;

  // [score z, cancelled?] for 80 test bookings (27 cancelled, AUC of the sample 0.74)
  const DATA = [[-1.86,0],[-2.72,0],[0.39,1],[-0.12,0],[-0.98,0],[0.63,1],[-0.76,0],[0.49,1],[-0.61,1],[-1.67,0],[0.29,1],[-0.68,0],[0.35,1],[-2.31,0],[-0.78,0],[-2.1,0],[-0.57,1],[0.49,1],[-0.98,0],[-1.68,0],[0.28,0],[-0.95,0],[-2.82,0],[-0.48,0],[-2.44,0],[-0.99,0],[-0.45,1],[-2.07,0],[-1.76,0],[-1.66,0],[1.15,1],[-0.92,0],[-1.96,0],[0.22,1],[-0.58,0],[-0.75,0],[-2.02,0],[-2.0,0],[0.46,0],[-0.03,0],[-1.64,1],[-0.64,0],[-0.04,1],[-1.09,1],[-1.83,0],[-0.56,1],[1.15,1],[-0.06,0],[1.32,0],[-1.72,0],[0.65,1],[-2.15,0],[-1.11,1],[0.72,1],[-0.49,0],[-0.3,0],[-0.31,1],[1.93,0],[-1.39,0],[-1.5,1],[0.24,0],[-0.5,1],[0.81,1],[-0.13,0],[-0.91,0],[-2.19,0],[-2.68,0],[-1.91,0],[0.69,0],[-1.77,1],[-1.39,1],[-0.66,0],[-0.89,1],[0.42,0],[-1.86,0],[-1.36,0],[-1.36,0],[-2.21,0],[-0.81,1],[-0.23,0]];

  function makeData() {
    // small fixed vertical jitter so overlapping bookings stay visible
    return DATA.map(([x, y], i) => ({ x, y, j: (((i * 37) % 17) / 17 - 0.5) * 0.09 }));
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
    const w = 1, b = 0; // the score is already on the logit scale
    pts.forEach((p) => (p.p = sigmoid(w * p.x + b)));

    const xs = scale([X0, X1], [M.l, W - M.r]);
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
    plot.append(svg("text", { x: (M.l + W - M.r) / 2, y: H - 8, "text-anchor": "middle", text: "model\u2019s risk score  →  more likely to cancel" }));
    plot.append(svg("text", { x: 12, y: (M.t + H - M.b) / 2, transform: `rotate(-90 12 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "P(cancels)" }));

    let d = "";
    for (let i = 0; i <= 120; i++) {
      const x = X0 + ((X1 - X0) * i) / 120;
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
    const cm = { tp: cell("is-tp", "room resold"), fn: cell("is-fn", "empty room"), fp: cell("is-fp", "guest walked"), tn: cell("is-tn", "normal stay") };
    const matrix = el("div", { class: "hz-thr-matrix" }, [
      el("span"), el("span", { class: "hz-thr-h", text: "flagged: likely to cancel" }), el("span", { class: "hz-thr-h", text: "not flagged" }),
      el("span", { class: "hz-thr-h hz-thr-h--row", text: "cancelled" }), cm.tp.node, cm.fn.node,
      el("span", { class: "hz-thr-h hz-thr-h--row", text: "showed up" }), cm.fp.node, cm.tn.node,
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
      const flagged = c.tp + c.fp;
      note.innerHTML =
        t < 0.35
          ? `Low threshold: ${flagged} of 80 bookings are flagged and their rooms resold. Few cancellations slip through (recall ${fmt(c.rec)}), but <strong>${c.fp} guests who do show up</strong> find their room sold: false positives.`
          : t > 0.65
            ? `High threshold: only ${flagged} booking${flagged === 1 ? " is" : "s are"} flagged, and we are rarely wrong (precision ${fmt(c.prec)}). But <strong>${c.fn} cancellations</strong> leave rooms empty that we could have resold: false negatives.`
            : `Near 0.5, the default of <code>model.predict()</code>: ${flagged} flagged, ${c.fp} guests walked, ${c.fn} rooms left empty. Moving the threshold never changes the model, only the decision.`;
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
      el("p", { class: "hz-x__lede", html: "Each dot is a real Altamar test booking, placed by the model\u2019s risk score: on top if it was cancelled, at the bottom if the guest showed up. Bookings above the <strong>threshold</strong> are flagged as likely to cancel and their rooms resold. Drag the line and watch errors move between the two red cells." }),
      el("div", { class: "hz-x__split" }, [
        el("div", {}, [
          plot,
          el("div", { class: "hz-legend" }, [
            el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "cancelled"]),
            el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "showed up"]),
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

  HZ.register("threshold", {
    kicker: "Week 4",
    title: "Moving the decision threshold",
    mount,
    css: `
.md-typeset .hz-x svg.hz-thr-plot text { font-size: 15px; }
@media (max-width: 44em) { .md-typeset .hz-x svg.hz-thr-plot text { font-size: 18px; } }
`,
  });
})();
