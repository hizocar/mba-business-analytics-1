/* Session 4: from a line to a probability. Customers who left (1) or stayed
   (0) plotted against their support tickets. A straight line fitted to 0/1
   leaves the [0, 1] range; the sigmoid bends the same score w·x + b into an S
   that never does. Weight and intercept reshape the S; a probe customer reads
   off p and the predicted class. */
(function () {
  const { el, svg, slider, segmented, stats, button, scale, tween, rng, clamp, lerp } = HZ;

  const W = 520, H = 320, M = { l: 54, r: 16, t: 16, b: 46 };
  const X0 = -0.5, X1 = 10.5, Y0 = -0.42, Y1 = 1.42;
  const sig = (z) => 1 / (1 + Math.exp(-z));
  // never print 0.00 or 1.00 for a sigmoid: it gets close but never touches
  const fp = (v) => (v > 0 && v < 1 && (v < 0.01 || v > 0.99) ? v.toFixed(3) : v.toFixed(2));

  function makeData() {
    const r = rng(47);
    const pts = [];
    for (let i = 0; i < 70; i++) {
      const x = Math.min(10, Math.floor(r() * r() * 11 + r() * 4)); // more customers with few tickets
      const y = r() < sig(1.15 * (x - 4.6)) ? 1 : 0;
      pts.push({ x, y, jx: (r() - 0.5) * 0.5, jy: (r() - 0.5) * 0.07 });
    }
    // make sure the right edge is populated
    for (let x = 7; x <= 10; x++) pts.push({ x, y: x === 7 ? 0 : 1, jx: (r() - 0.5) * 0.5, jy: (r() - 0.5) * 0.07 });
    return pts;
  }

  function fitLine(pts) {
    const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
    let sxy = 0, sxx = 0;
    for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
    const m = sxy / sxx;
    return { m, c: my - m * mx };
  }

  function fitLogistic(pts) {
    let w = 0, b = 0;
    for (let it = 0; it < 6000; it++) {
      let gw = 0, gb = 0;
      for (const p of pts) { const e = sig(w * p.x + b) - p.y; gw += e * p.x; gb += e; }
      w -= (0.08 * gw) / pts.length;
      b -= (0.4 * gb) / pts.length;
    }
    return { w, b };
  }

  const logLoss = (pts, f) => {
    let s = 0;
    for (const p of pts) {
      const q = f(p.x);
      if (q <= 0 || q >= 1) return NaN;
      s -= p.y ? Math.log(q) : Math.log(1 - q);
    }
    return s / pts.length;
  };

  function mount(body) {
    body.classList.add("hz-sg");
    const pts = makeData();
    const line = fitLine(pts);
    const best = fitLogistic(pts);
    let w = +best.w.toFixed(2), b = +best.b.toFixed(1);
    let mode = "linear";
    let probe = 10;
    let last = "mode";

    const xs = scale([X0, X1], [M.l, W - M.r]);
    const ys = scale([Y0, Y1], [H - M.b, M.t]);
    const fig = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-sg-plot", role: "img", "aria-label": "Churned (1) or stayed (0) against support tickets, with a fitted curve" });

    // Out-of-range bands: values a probability can never take
    fig.append(
      svg("rect", { class: "hz-sg-band", x: M.l, width: W - M.r - M.l, y: ys(Y1), height: ys(1) - ys(Y1) }),
      svg("rect", { class: "hz-sg-band", x: M.l, width: W - M.r - M.l, y: ys(0), height: ys(Y0) - ys(0) }),
      svg("text", { class: "hz-sg-bandtxt", x: W - M.r - 6, y: ys(Y1) + 15, "text-anchor": "end", text: "above 1: not a probability" }),
      svg("text", { class: "hz-sg-bandtxt", x: W - M.r - 6, y: ys(Y0) - 6, "text-anchor": "end", text: "below 0: not a probability" })
    );
    [0, 0.5, 1].forEach((v) => {
      fig.append(svg("line", { class: v === 0.5 ? "hz-sg-half" : "hz-axis", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
      fig.append(svg("text", { x: M.l - 8, y: ys(v) + 4, "text-anchor": "end", text: v === 0.5 ? "0.5" : String(v) }));
    });
    for (let t = 0; t <= 10; t += 2) fig.append(svg("text", { x: xs(t), y: H - M.b + 18, "text-anchor": "middle", text: String(t) }));
    fig.append(svg("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", text: "support tickets in the last 6 months" }));
    fig.append(svg("text", { x: 14, y: (M.t + H - M.b) / 2, transform: `rotate(-90 14 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "churned? (1 = left)" }));

    const boundary = svg("line", { class: "hz-sg-boundary", y1: M.t, y2: H - M.b });
    fig.append(boundary);
    pts.forEach((p) => fig.append(svg("circle", { class: "hz-sg-dot " + (p.y ? "is-left" : "is-stay"), cx: xs(clamp(p.x + p.jx, X0 + 0.1, X1 - 0.1)), cy: ys(p.y + p.jy), r: 4.5 })));

    const curve = svg("path", { class: "hz-sg-curve" });
    const probeLine = svg("line", { class: "hz-sg-probeline" });
    const probeDot = svg("circle", { class: "hz-sg-probe", r: 7, tabindex: 0, role: "slider", "aria-label": "Probe customer: support tickets" });
    const probeTxt = svg("text", { class: "hz-sg-probetxt" });
    fig.append(curve, probeLine, probeDot, probeTxt);

    const SAMPLES = 110;
    const gridX = Array.from({ length: SAMPLES + 1 }, (_, i) => X0 + ((X1 - X0) * i) / SAMPLES);
    const target = () => gridX.map((x) => (mode === "linear" ? line.c + line.m * x : sig(w * x + b)));
    let shown = target();
    const f = (x) => (mode === "linear" ? line.c + line.m * x : sig(w * x + b));

    function path(vals) {
      return vals.map((v, i) => (i ? "L" : "M") + xs(gridX[i]).toFixed(1) + "," + ys(clamp(v, Y0 - 0.2, Y1 + 0.2)).toFixed(1)).join("");
    }

    const formula = el("p", { class: "hz-sg-formula" });
    const readout = stats();
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });

    const seg = segmented([{ value: "linear", label: "Linear regression" }, { value: "logistic", label: "Logistic regression" }], mode, (v) => {
      mode = v;
      last = "mode";
      morph();
    });
    seg.node.setAttribute("aria-label", "Model");
    const sw = slider({ label: "Weight w", min: 0, max: 3, step: 0.05, value: w, format: (v) => v.toFixed(2), oninput: (v) => { w = v; last = "w"; morph(true); } });
    const sb = slider({ label: "Intercept b", min: -14, max: 2, step: 0.1, value: b, format: (v) => v.toFixed(1), oninput: (v) => { b = v; last = "b"; morph(true); } });
    const sp = slider({ label: "Probe: tickets", min: 0, max: 10, step: 1, value: probe, format: (v) => String(v), oninput: (v) => { probe = v; last = "probe"; draw(); } });
    const fitBtn = button("Best fit", () => animateParams(+best.w.toFixed(2), +best.b.toFixed(1)), "primary");

    // Morph the curve between shapes so the line visibly bends into an S.
    let anim = 0;
    function morph(instant) {
      const from = shown.slice(), to = target(), id = ++anim;
      if (instant) { shown = to; draw(); return; }
      tween(body, 600, (k) => {
        if (id !== anim) return;
        shown = from.map((v, i) => lerp(v, to[i], k));
        draw();
      });
    }

    function animateParams(tw, tb) {
      const w0 = w, b0 = b, id = ++anim;
      last = "fit";
      if (mode !== "logistic") { mode = "logistic"; seg.set("logistic"); }
      const from = shown.slice();
      tween(body, 600, (k) => {
        if (id !== anim) return;
        w = lerp(w0, tw, k); b = lerp(b0, tb, k);
        sw.set(w); sb.set(b);
        const to = target();
        shown = from.map((v, i) => lerp(v, to[i], k));
        draw();
      });
    }

    function draw() {
      const logistic = mode === "logistic";
      body.classList.toggle("is-linear", !logistic);
      [sw, sb].forEach((s) => (s.input.disabled = !logistic));
      curve.setAttribute("d", path(shown));
      curve.classList.toggle("is-linear", !logistic);

      const cut = logistic && w > 0.01 ? -b / w : NaN;
      const showCut = Number.isFinite(cut) && cut > X0 && cut < X1;
      boundary.style.opacity = showCut ? 1 : 0;
      if (showCut) { boundary.setAttribute("x1", xs(cut)); boundary.setAttribute("x2", xs(cut)); }

      const v = f(probe);
      const px = xs(probe), py = ys(clamp(v, Y0, Y1));
      probeLine.setAttribute("x1", px); probeLine.setAttribute("x2", px);
      probeLine.setAttribute("y1", H - M.b); probeLine.setAttribute("y2", py);
      probeDot.setAttribute("cx", px); probeDot.setAttribute("cy", py);
      probeDot.setAttribute("aria-valuenow", probe);
      const bad = v < 0 || v > 1;
      probeDot.classList.toggle("is-bad", bad);
      const right = px > W - 170;
      probeTxt.setAttribute("x", right ? px - 12 : px + 12);
      probeTxt.setAttribute("text-anchor", right ? "end" : "start");
      probeTxt.setAttribute("y", clamp(py + (v > 0.75 ? 22 : -12), M.t + 12, H - M.b - 6));
      probeTxt.textContent = logistic ? `p = ${fp(v)} → ${v >= 0.5 ? "leaves" : "stays"}` : `prediction ${v.toFixed(2)}${bad ? " ?!" : ""}`;
      probeTxt.classList.toggle("is-bad", bad);

      const loss = logLoss(pts, f);
      if (logistic) {
        formula.innerHTML = `z = <b>${w.toFixed(2)}</b> × tickets ${b < 0 ? "−" : "+"} <b>${Math.abs(b).toFixed(1)}</b> &nbsp;→&nbsp; p = 1 / (1 + e<sup>−z</sup>)`;
        readout.set([
          ["Probe customer", `${probe} tickets`],
          ["Score z", (w * probe + b).toFixed(2)],
          ["Probability p", fp(v), "is-a"],
          ["Predicted", v >= 0.5 ? "leaves" : "stays"],
          ["Log loss (lower = better fit)", Number.isFinite(loss) ? loss.toFixed(3) : "–"],
        ]);
      } else {
        formula.innerHTML = `prediction = <b>${line.m.toFixed(3)}</b> × tickets ${line.c < 0 ? "−" : "+"} <b>${Math.abs(line.c).toFixed(3)}</b>`;
        readout.set([
          ["Probe customer", `${probe} tickets`],
          ["Prediction", v.toFixed(2), bad ? "is-bad" : "is-a"],
          ["Valid probability?", bad ? "no" : "yes", bad ? "is-bad" : "is-good"],
          ["Log loss", "impossible", "is-bad"],
        ]);
      }

      const lo = line.c + line.m * 0, hi = line.c + line.m * 10;
      if (!logistic) {
        note.innerHTML = `The least-squares line is the best straight line through the 0s and 1s, yet it predicts <strong>${lo.toFixed(2)}</strong> for a customer with no tickets and <strong>${hi.toFixed(2)}</strong> for one with ten. Neither is a probability. Switch to logistic regression.`;
      } else if (last === "w") {
        note.innerHTML = w < 0.05
          ? "With weight 0 the tickets stop mattering: every customer gets the same probability, a flat line."
          : `The <strong>weight</strong> sets how steep the S is. A bigger weight means each extra ticket moves the probability faster around the 50% point.`;
      } else if (last === "b") {
        note.innerHTML = showCut
          ? `The <strong>intercept</strong> slides the S sideways. The 50% point sits at −b / w = <strong>${cut.toFixed(1)} tickets</strong>; to its right the model predicts “leaves”.`
          : "The intercept has pushed the 50% point off the chart: the model now says the same class for every customer.";
      } else if (last === "probe") {
        note.innerHTML = `A customer with ${probe} ticket${probe === 1 ? "" : "s"}: score z = ${(w * probe + b).toFixed(2)}, probability <strong>${fp(v)}</strong>. At the usual threshold of 0.5 the model predicts “${v >= 0.5 ? "leaves" : "stays"}”.`;
      } else {
        note.innerHTML = `Same score as a line, z = w·tickets + b, but bent by the sigmoid. Far left it flattens near 0, far right near 1, and it <strong>never leaves the band</strong>. Move the sliders, or press Best fit.`;
      }
    }

    // Drag on the plot (mouse) or the probe dot (touch) to move the probe.
    let dragging = false;
    const toX = (e) => {
      const r = fig.getBoundingClientRect();
      return clamp(Math.round(xs.invert(((e.clientX - r.left) / r.width) * W)), 0, 10);
    };
    fig.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" && e.target !== probeDot) return;
      dragging = true;
      fig.setPointerCapture(e.pointerId);
      probe = toX(e); sp.set(probe); last = "probe"; draw();
    });
    fig.addEventListener("pointermove", (e) => { if (dragging) { probe = toX(e); sp.set(probe); last = "probe"; draw(); } });
    fig.addEventListener("pointerup", () => (dragging = false));
    probeDot.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      probe = clamp(probe + step, 0, 10); sp.set(probe); last = "probe"; draw();
    });

    body.append(
      el("p", { class: "hz-x__lede", html: "Each dot is a customer: on top if they left, at the bottom if they stayed, spread along how many complaints they filed. Try to draw a <em>probability</em> through them." }),
      el("div", { class: "hz-x__controls" }, [seg.node, fitBtn]),
      fig,
      el("div", { class: "hz-legend" }, [
        el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "left (1)"]),
        el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "stayed (0)"]),
        el("span", {}, [el("i", { style: "background: var(--hz-bad-soft)" }), "impossible for a probability"]),
        el("span", {}, [el("i", { style: "background: var(--hz-a); border-radius: 0; width: 2px" }), "50% point: right of it, “leaves”"]),
      ]),
      el("div", { class: "hz-sg-side" }, [formula, readout.node]),
      el("div", { class: "hz-x__controls hz-sg-sliders" }, [sw.node, sb.node, sp.node]),
      note
    );
    fig.style.setProperty("cursor", "ew-resize");
    draw();
  }

  HZ.register("sigmoid", {
    kicker: "Session 4",
    title: "From a line to a probability",
    mount,
    css: `
.md-typeset .hz-sg { --hz-bad-soft: color-mix(in srgb, var(--hz-bad) 12%, transparent); }
.md-typeset .hz-sg-band { fill: var(--hz-bad-soft); }
.md-typeset .hz-x svg text.hz-sg-bandtxt { fill: var(--hz-bad); font-size: 12px; }
.md-typeset .hz-x svg.hz-sg-plot text { font-size: 13px; }
.md-typeset .hz-sg-half { stroke: var(--hz-muted); stroke-width: 1; stroke-dasharray: 4 4; }
.md-typeset .hz-sg-dot { fill-opacity: 0.8; stroke: var(--hz-card); stroke-width: 1; }
.md-typeset .hz-sg-dot.is-left { fill: var(--hz-a); }
.md-typeset .hz-sg-dot.is-stay { fill: var(--hz-b); }
.md-typeset .hz-sg-curve { fill: none; stroke: var(--hz-ink); stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }
.md-typeset .hz-sg-curve.is-linear { stroke-dasharray: 9 5; }
.md-typeset .hz-sg-boundary { stroke: var(--hz-a); stroke-width: 1.5; stroke-dasharray: 2 4; transition: opacity 200ms ease; }
.md-typeset .hz-sg-probeline { stroke: var(--hz-ink); stroke-opacity: 0.45; stroke-width: 1; stroke-dasharray: 3 3; }
.md-typeset .hz-sg-probe { fill: var(--hz-card); stroke: var(--hz-ink); stroke-width: 2.5; cursor: grab; touch-action: none; }
.md-typeset .hz-sg-probe.is-bad { stroke: var(--hz-bad); }
.md-typeset .hz-sg-probe:focus-visible { outline: none; stroke: var(--md-primary-fg-color); stroke-width: 3.5; }
.md-typeset .hz-x svg text.hz-sg-probetxt { fill: var(--hz-ink); font-weight: 600; paint-order: stroke; stroke: var(--hz-card); stroke-width: 4px; }
.md-typeset .hz-x svg text.hz-sg-probetxt.is-bad { fill: var(--hz-bad); }
.md-typeset .hz-sg-plot { max-width: 46rem; }
.md-typeset .hz-sg-side { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1.2rem; align-items: start; }
@media (max-width: 44em) { .md-typeset .hz-sg-side { grid-template-columns: minmax(0, 1fr); } }
.md-typeset .hz-sg-formula { font-family: var(--md-code-font); font-size: 0.72rem; padding: 0.5em 0.7em; border-radius: 8px; background: var(--md-default-bg-color); border: 1px solid var(--hz-line); line-height: 1.6; }
.md-typeset .hz-sg-formula b { color: var(--hz-a); font-weight: 600; }
.md-typeset .hz-sg.is-linear .hz-sg-sliders .hz-x__slider:not(:last-child) { opacity: 0.4; }
.md-typeset .hz-sg .hz-x__note { min-height: 4.2em; }
@media (max-width: 44em) { .md-typeset .hz-x svg.hz-sg-plot text { font-size: 19px; } .md-typeset .hz-x svg text.hz-sg-bandtxt { font-size: 17px; } }
`,
  });
})();
