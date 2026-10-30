/* Week 6: partial dependence. "How does the prediction change with lead time
   (or arrival month), all else equal?" One curve per hotel, computed in the
   Week 6 notebook from the fitted gradient boosting models: for each value of
   the input, every test booking of that hotel gets that value and the
   predictions are averaged (rates rounded to USD, risks to %). A draggable
   probe reads the curve; a toggle overlays what a straight line would say. */
(function () {
  const { el, svg, segmented, button, stats, scale, tween, clamp, lerp } = HZ;

  const PD = {"lead": [0, 1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 270, 300], "month": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "rate": {"lead": {"Santiago": [113, 113, 112, 99, 98, 98, 98, 97, 97, 96, 97, 94, 94, 91, 87, 87, 87, 87, 87, 87, 87, 87], "Viña del Mar": [154, 154, 154, 147, 146, 146, 146, 146, 147, 146, 146, 140, 140, 137, 131, 131, 130, 131, 130, 130, 130, 130], "Puerto Varas": [165, 165, 165, 160, 159, 160, 161, 158, 158, 157, 156, 151, 150, 147, 141, 140, 139, 139, 139, 139, 139, 139]}, "month": {"Santiago": [79, 77, 98, 96, 96, 93, 96, 97, 105, 106, 106, 97], "Viña del Mar": [192, 182, 125, 97, 89, 87, 91, 89, 92, 98, 109, 136], "Puerto Varas": [197, 190, 137, 114, 108, 106, 168, 124, 118, 124, 131, 153]}}, "cancel": {"lead": {"Santiago": [12, 13, 13, 13, 13, 15, 15, 15, 14, 21, 27, 48, 63, 61, 65, 52, 34, 32, 33, 33, 33, 33], "Viña del Mar": [20, 22, 23, 22, 22, 21, 19, 21, 20, 27, 36, 56, 73, 70, 72, 59, 44, 43, 43, 43, 43, 43], "Puerto Varas": [16, 18, 19, 18, 17, 17, 16, 18, 16, 24, 35, 57, 74, 71, 72, 60, 45, 44, 44, 44, 44, 44]}, "month": {"Santiago": [21, 23, 23, 22, 23, 23, 23, 23, 23, 23, 23, 22], "Viña del Mar": [40, 42, 41, 39, 40, 40, 39, 39, 39, 38, 38, 39], "Puerto Varas": [38, 40, 38, 38, 39, 39, 38, 38, 37, 37, 37, 37]}}};
  const HOTELS = ["Santiago", "Viña del Mar", "Puerto Varas"];
  const SHORT = { "Santiago": "Santiago", "Viña del Mar": "Viña", "Puerto Varas": "P. Varas" };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const SAMPLES = 151;

  const W = 540, H = 330, M = { l: 50, r: 76, t: 30, b: 46 };

  // value of a curve at x (linear between the computed points)
  function at(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) return lerp(ys[i - 1], ys[i], (x - xs[i - 1]) / (xs[i] - xs[i - 1]));
    }
    return ys[ys.length - 1];
  }
  // least-squares straight line through the curve, sampled evenly along x
  function lineFit(xs, ys) {
    const lo = xs[0], hi = xs[xs.length - 1];
    const px = Array.from({ length: SAMPLES }, (_, i) => lo + ((hi - lo) * i) / (SAMPLES - 1));
    const py = px.map((x) => at(xs, ys, x));
    const mx = px.reduce((s, v) => s + v, 0) / SAMPLES, my = py.reduce((s, v) => s + v, 0) / SAMPLES;
    let sxy = 0, sxx = 0;
    px.forEach((x, i) => { sxy += (x - mx) * (py[i] - my); sxx += (x - mx) ** 2; });
    const b = sxy / sxx;
    return (x) => my + b * (x - mx);
  }

  function mount(body) {
    let q = "rate", inp = "lead", hotel = "Puerto Varas", showLine = false;
    let probeX = 90;
    let screen = null; // current on-screen samples per hotel: [[px, py] x SAMPLES]
    let anim = 0;

    const fig = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-pd-plot", role: "img" });
    const grid = svg("g"), axes = svg("g"), lineG = svg("g"), curvesG = svg("g"), labelsG = svg("g"), probeG = svg("g", { class: "hz-pd-probeg" });
    const hit = svg("rect", { class: "hz-pd-hit", x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b });
    fig.append(grid, axes, lineG, curvesG, labelsG, hit, probeG);

    const paths = {}, labels = {}, dots = {};
    HOTELS.forEach((h) => {
      paths[h] = svg("path", { class: "hz-pd-curve" });
      labels[h] = svg("text", { class: "hz-pd-label", x: W - M.r + 8 });
      dots[h] = svg("circle", { class: "hz-pd-dot", r: 4 });
      curvesG.append(paths[h]);
      labelsG.append(labels[h]);
    });
    const straight = svg("path", { class: "hz-pd-line" });
    lineG.append(straight);
    const probeLine = svg("line", { class: "hz-pd-probe", y1: M.t, y2: H - M.b });
    const probeVal = svg("text", { class: "hz-pd-probeval", "text-anchor": "middle" });
    const probeValBg = svg("rect", { class: "hz-pd-probebg", rx: 6, height: 22 });
    const lineDot = svg("circle", { class: "hz-pd-linedot", r: 4 });
    const knob = svg("g", { class: "hz-pd-knob", tabindex: 0, role: "slider", "aria-label": "Probe position" }, [
      svg("circle", { r: 9 }),
      svg("path", { d: "M-3,-4 L-6,0 L-3,4 M3,-4 L6,0 L3,4" }),
    ]);
    probeG.append(probeLine, lineDot, ...HOTELS.map((h) => dots[h]), probeValBg, probeVal, knob);

    const readout = stats();
    const note = el("p", { class: "hz-x__note" });

    const xs = () => PD[inp];
    const ys = (h) => PD[q][inp][h];
    const unit = (v) => (q === "rate" ? `USD ${Math.round(v)}` : `${Math.round(v)}%`);
    const xDomain = () => (inp === "lead" ? [0, 300] : [1, 12]);
    function yDomain() {
      const all = HOTELS.flatMap((h) => ys(h));
      let lo = Math.min(...all), hi = Math.max(...all);
      if (showLine) {
        const f = lineFit(xs(), ys(hotel));
        const [a, b] = xDomain();
        lo = Math.min(lo, f(a), f(b));
        hi = Math.max(hi, f(a), f(b));
      }
      if (q === "cancel") return [0, Math.max(80, Math.ceil(hi / 10) * 10)];
      return [Math.floor((lo - 5) / 10) * 10, Math.ceil((hi + 5) / 10) * 10];
    }
    let sx = scale(xDomain(), [M.l, W - M.r]);
    let sy = scale(yDomain(), [H - M.b, M.t]);
    const xLabel = (x) => (inp === "lead" ? (Math.round(x) === 1 ? "1 day ahead" : `${Math.round(x)} days ahead`) : FULL_MONTHS[Math.round(x) - 1]);

    function drawAxes() {
      const yd = yDomain();
      const step = q === "cancel" ? 20 : (yd[1] - yd[0] > 100 ? 40 : 20);
      const g = [], a = [];
      for (let v = Math.ceil(yd[0] / step) * step; v <= yd[1]; v += step) {
        g.push(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: sy(v), y2: sy(v) }));
        a.push(svg("text", { x: M.l - 8, y: sy(v) + 4, "text-anchor": "end", text: q === "cancel" ? v + "%" : v }));
      }
      const ticks = inp === "lead" ? [0, 30, 60, 90, 120, 180, 240, 300] : [1, 3, 5, 7, 9, 11];
      ticks.forEach((t) => a.push(svg("text", { x: sx(t), y: H - M.b + 18, "text-anchor": "middle", text: inp === "lead" ? t : MONTHS[t - 1] })));
      a.push(svg("line", { class: "hz-axis", x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
      a.push(svg("text", { class: "hz-pd-axtitle", x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", text: inp === "lead" ? "Days booked ahead" : "Arrival month" }));
      a.push(svg("text", { class: "hz-pd-axtitle", x: M.l - 40, y: 13, text: q === "rate" ? "Predicted rate (USD a night)" : "Predicted chance of cancelling" }));
      grid.replaceChildren(...g);
      axes.replaceChildren(...a);
    }

    function target() {
      const [a, b] = xDomain();
      const out = {};
      HOTELS.forEach((h) => {
        out[h] = Array.from({ length: SAMPLES }, (_, i) => {
          const x = a + ((b - a) * i) / (SAMPLES - 1);
          return [sx(x), sy(at(xs(), ys(h), x))];
        });
      });
      return out;
    }
    const toPath = (pts) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");

    function drawCurves(pts) {
      HOTELS.forEach((h) => {
        paths[h].setAttribute("d", toPath(pts[h]));
        paths[h].classList.toggle("is-on", h === hotel);
      });
      // labels at the right end, nudged apart so they never overlap
      const ends = HOTELS.map((h) => ({ h, y: pts[h][SAMPLES - 1][1] })).sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
      ends.forEach(({ h, y }) => {
        labels[h].setAttribute("y", y + 4);
        labels[h].textContent = SHORT[h];
        labels[h].classList.toggle("is-on", h === hotel);
      });
    }

    function drawLine() {
      straight.style.opacity = showLine ? 1 : 0;
      lineDot.style.opacity = showLine ? 1 : 0;
      const f = lineFit(xs(), ys(hotel));
      const [a, b] = xDomain();
      straight.setAttribute("d", `M${sx(a)},${sy(f(a))}L${sx(b)},${sy(f(b))}`);
      return f;
    }

    function drawProbe() {
      const [a, b] = xDomain();
      probeX = clamp(inp === "month" ? Math.round(probeX) : Math.round(probeX), a, b);
      const px = sx(probeX);
      probeLine.setAttribute("x1", px);
      probeLine.setAttribute("x2", px);
      HOTELS.forEach((h) => {
        dots[h].setAttribute("cx", px);
        dots[h].setAttribute("cy", sy(at(xs(), ys(h), probeX)));
        dots[h].classList.toggle("is-on", h === hotel);
      });
      const v = at(xs(), ys(hotel), probeX);
      const f = drawLine();
      lineDot.setAttribute("cx", px);
      lineDot.setAttribute("cy", sy(f(probeX)));
      probeVal.textContent = unit(v);
      const tw = probeVal.textContent.length * 7.6 + 14;
      const vy = sy(v);
      const ty = vy - 16 < M.t + 10 ? vy + 26 : vy - 12;
      const tx = clamp(px, M.l + tw / 2, W - M.r - tw / 2);
      probeVal.setAttribute("x", tx);
      probeVal.setAttribute("y", ty);
      probeValBg.setAttribute("x", tx - tw / 2);
      probeValBg.setAttribute("y", ty - 15);
      probeValBg.setAttribute("width", tw);
      knob.setAttribute("transform", `translate(${px},${H - M.b})`);
      knob.setAttribute("aria-valuenow", Math.round(probeX));
      knob.setAttribute("aria-valuetext", `${xLabel(probeX)}: ${unit(v)}`);
      knob.setAttribute("aria-valuemin", a);
      knob.setAttribute("aria-valuemax", b);

      const rows = [[`${hotel}, ${xLabel(probeX)}`, unit(v), "is-a"]];
      HOTELS.filter((h) => h !== hotel).forEach((h) => rows.push([h, unit(at(xs(), ys(h), probeX))]));
      if (showLine) {
        const miss = v - f(probeX);
        rows.push(["A straight line says", unit(f(probeX)), "is-b"]);
        rows.push(["The line misses by", (miss >= 0 ? "+" : "−") + unit(Math.abs(miss)), Math.abs(miss) > (q === "rate" ? 8 : 6) ? "is-bad" : null]);
      }
      readout.set(rows);
      note.innerHTML = caption() + (showLine ? ` <strong>The dashed line</strong> is the best straight line through this curve: it can only tilt, so it ${Math.abs(v - f(probeX)) > (q === "rate" ? 8 : 6) ? "misses badly here" : "happens to be close here, and misses elsewhere"}.` : "");
    }

    function caption() {
      const y = ys(hotel), x = xs();
      if (q === "rate" && inp === "lead") {
        return `<strong>${hotel}:</strong> bookings made 0–2 days ahead are quoted ${unit(y[0])} (a last-minute premium), a week to 45 days ahead about ${unit(at(x, y, 21))}, and from 105 days ahead ${unit(y[y.length - 1])}: early-bird discounts. A premium, a flat middle and two steps down.`;
      }
      if (q === "rate" && inp === "month") {
        const hi = y.indexOf(Math.max(...y)), lo = y.indexOf(Math.min(...y));
        const extra = hotel === "Puerto Varas"
          ? ` A second peak in the July winter holidays (${unit(y[6])}): one line cannot draw two peaks.`
          : hotel === "Santiago"
          ? ` A business hotel: quiet in the summer holidays, busy with conferences in September–November.`
          : ` A beach hotel with one summer season, very different from Santiago's year.`;
        return `<strong>${hotel}:</strong> highest in ${FULL_MONTHS[hi]} (${unit(y[hi])}), lowest in ${FULL_MONTHS[lo]} (${unit(y[lo])}).` + extra;
      }
      if (q === "cancel" && inp === "lead") {
        const hi = y.indexOf(Math.max(...y));
        return `<strong>${hotel}:</strong> a booking made a week ahead cancels ${unit(at(x, y, 7))} of the time; one made ${x[hi]} days ahead, ${unit(y[hi])}; very early ones settle near ${unit(y[y.length - 1])}. A hump: the riskiest bookings are made two to four months out.`;
      }
      return `<strong>${hotel}:</strong> flat, between ${unit(Math.min(...y))} and ${unit(Math.max(...y))} all year. Once lead time, deposit and channel are known, the month adds almost nothing. Partial dependence also shows what does <em>not</em> matter.`;
    }

    async function render(animate) {
      const before = screen;
      sx = scale(xDomain(), [M.l, W - M.r]);
      sy = scale(yDomain(), [H - M.b, M.t]);
      drawAxes();
      const after = target();
      const id = ++anim;
      if (animate && before) {
        probeG.style.opacity = 0;
        await tween(body, 550, (t) => {
          if (id !== anim) return;
          const mid = {};
          HOTELS.forEach((h) => (mid[h] = after[h].map((p, i) => [lerp(before[h][i][0], p[0], t), lerp(before[h][i][1], p[1], t)])));
          drawCurves(mid);
        });
        if (id !== anim) return;
        probeG.style.opacity = 1;
      }
      screen = after;
      drawCurves(after);
      drawProbe();
    }

    // dragging the probe anywhere on the plot
    function toX(evt) {
      const r = fig.getBoundingClientRect();
      const vx = ((evt.clientX - r.left) / r.width) * W;
      return sx.invert(clamp(vx, M.l, W - M.r));
    }
    let dragging = false;
    const start = (e) => { dragging = true; fig.setPointerCapture && fig.setPointerCapture(e.pointerId); probeX = toX(e); drawProbe(); };
    hit.addEventListener("pointerdown", start);
    knob.addEventListener("pointerdown", start);
    fig.addEventListener("pointermove", (e) => { if (dragging) { probeX = toX(e); drawProbe(); } });
    fig.addEventListener("pointerup", () => (dragging = false));
    fig.addEventListener("pointercancel", () => (dragging = false));
    knob.addEventListener("keydown", (e) => {
      const stepK = inp === "lead" ? (e.shiftKey ? 30 : 5) : 1;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") probeX += stepK;
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") probeX -= stepK;
      else if (e.key === "Home") probeX = xDomain()[0];
      else if (e.key === "End") probeX = xDomain()[1];
      else return;
      e.preventDefault();
      drawProbe();
    });

    const qSeg = segmented([{ value: "rate", label: "Nightly rate" }, { value: "cancel", label: "Cancellation risk" }], q, (v) => { q = v; render(true); });
    const iSeg = segmented([{ value: "lead", label: "Lead time" }, { value: "month", label: "Arrival month" }], inp, (v) => {
      inp = v;
      probeX = v === "lead" ? 90 : 7;
      render(true);
    });
    const hSeg = segmented(HOTELS.map((h) => ({ value: h, label: h === "Viña del Mar" ? "Viña" : h })), hotel, (v) => { hotel = v; render(false); });
    const lineBtn = button("Show what a straight line would say", () => {
      showLine = !showLine;
      lineBtn.setAttribute("aria-pressed", String(showLine));
      lineBtn.textContent = showLine ? "Hide the straight line" : "Show what a straight line would say";
      render(false);
    });
    lineBtn.setAttribute("aria-pressed", "false");

    body.append(
      el("p", { class: "hz-x__lede", html: "How does the prediction change with one input, <strong>all else equal</strong>? For each hotel, the boosting model prices (or scores) that hotel's test bookings again with only this input changed, and averages. Drag the probe along the curve." }),
      el("div", { class: "hz-x__controls" }, [
        el("span", { class: "hz-pd-ctl" }, [el("span", { class: "hz-pd-ctl__label", text: "Question" }), qSeg.node]),
        el("span", { class: "hz-pd-ctl" }, [el("span", { class: "hz-pd-ctl__label", text: "Input" }), iSeg.node]),
      ]),
      el("div", { class: "hz-x__controls" }, [
        el("span", { class: "hz-pd-ctl" }, [el("span", { class: "hz-pd-ctl__label", text: "Hotel" }), hSeg.node]),
        lineBtn,
      ]),
      el("div", { class: "hz-pd-figwrap" }, [fig]),
      el("div", { class: "hz-pd-side" }, [readout.node, note]),
      el("p", { class: "hz-pd-foot", text: "A pattern the model learned from past bookings, not a cause: it tells you where to look, not what a new policy would do." })
    );
    render(false);
  }

  HZ.register("partial-dependence", {
    kicker: "Week 6",
    title: "Partial dependence: the shape a line can't draw",
    mount,
    css: `
.md-typeset .hz-x svg.hz-pd-plot text { font-size: 12px; }
.md-typeset .hz-x svg.hz-pd-plot text.hz-pd-axtitle { fill: var(--hz-ink); font-size: 12px; }
.md-typeset .hz-pd-curve { fill: none; stroke: var(--hz-muted); stroke-width: 1.8; stroke-opacity: 0.55; stroke-linejoin: round; transition: stroke 250ms ease, stroke-width 250ms ease, stroke-opacity 250ms ease; }
.md-typeset .hz-pd-curve.is-on { stroke: var(--hz-a); stroke-width: 3.4; stroke-opacity: 1; }
.md-typeset .hz-x svg text.hz-pd-label { font-size: 12px; transition: fill 250ms ease; }
.md-typeset .hz-x svg text.hz-pd-label.is-on { fill: var(--hz-a); font-weight: 700; }
.md-typeset .hz-pd-line { fill: none; stroke: var(--hz-b); stroke-width: 2.4; stroke-dasharray: 7 5; transition: opacity 300ms ease; }
.md-typeset .hz-pd-linedot { fill: var(--hz-card); stroke: var(--hz-b); stroke-width: 2; transition: opacity 300ms ease; }
.md-typeset .hz-pd-hit { fill: transparent; cursor: ew-resize; touch-action: none; }
.md-typeset .hz-pd-probe { stroke: var(--hz-ink); stroke-width: 1.2; stroke-dasharray: 3 3; pointer-events: none; }
.md-typeset .hz-pd-dot { fill: var(--hz-muted); stroke: var(--hz-card); stroke-width: 1.5; pointer-events: none; }
.md-typeset .hz-pd-dot.is-on { fill: var(--hz-a); r: 6; }
.md-typeset .hz-pd-probeg { transition: opacity 200ms ease; }
.md-typeset .hz-pd-probebg { fill: var(--hz-card); stroke: var(--hz-a); stroke-width: 1.2; pointer-events: none; }
.md-typeset .hz-x svg text.hz-pd-probeval { fill: var(--hz-a); font-weight: 700; font-size: 12.5px; pointer-events: none; }
.md-typeset .hz-pd-knob { cursor: grab; touch-action: none; }
.md-typeset .hz-pd-knob circle { fill: var(--hz-card); stroke: var(--hz-ink); stroke-width: 2; }
.md-typeset .hz-pd-knob path { fill: none; stroke: var(--hz-ink); stroke-width: 1.5; }
.md-typeset .hz-pd-knob:focus { outline: none; }
.md-typeset .hz-pd-knob:focus-visible circle { stroke: var(--md-primary-fg-color); stroke-width: 3; }
.md-typeset .hz-pd-ctl { display: inline-flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.md-typeset .hz-pd-ctl__label { font-size: 0.66rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-pd-figwrap { max-width: 44rem; width: 100%; margin: 0 auto; }
.md-typeset .hz-pd-side { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 1rem; align-items: start; }
@media (max-width: 44em) { .md-typeset .hz-pd-side { grid-template-columns: minmax(0, 1fr); } }
.md-typeset .hz-pd-side .hz-x__note { min-height: 7em; }
.md-typeset .hz-x__body p.hz-pd-foot { font-size: 0.66rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-x__btn[aria-pressed="true"] { border-color: var(--hz-b); color: var(--hz-b); }
@media (max-width: 30em) { .md-typeset .hz-x svg.hz-pd-plot text, .md-typeset .hz-x svg.hz-pd-plot text.hz-pd-axtitle, .md-typeset .hz-x svg text.hz-pd-label { font-size: 15px; } }
`,
  });
})();
