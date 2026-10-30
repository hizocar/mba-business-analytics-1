/* least-squares: Week 3. Viña del Mar, one point per month: bookings that
   arrive in the month (x) and their average nightly rate (y), from the clean
   Altamar file. Every residual becomes a square; the SSE is their total area,
   and least squares is the line that makes that area smallest. */
(function () {
  const { el, svg, slider, button, segmented, stats, scale, tween, rng, fmt, clamp, lerp } = HZ;

  const W = 520, H = 330, M = { l: 60, r: 16, t: 14, b: 44 };
  const X0 = 0, X1 = 250, Y0 = 0, Y1 = 220;
  // The two line handles sit at fixed x positions and move vertically.
  const HX = [0, 250];
  let uid = 0;

  // Viña del Mar by arrival month: bookings per month (average of 2024 and 2025)
  // and average rate in USD per night, as the notebook computes them.
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const VINA = [[229.5, 192.8], [184.5, 180.8], [90, 128.5], [46, 95.2], [44, 87.0], [41.5, 84.6],
                [42, 88.6], [41, 85.1], [53, 91.3], [61.5, 96.9], [71.5, 106.7], [106.5, 138.6]];
  const LABELLED = new Set([0, 1, 2, 10, 11]); // the quiet months sit in a tight cluster
  function makeData() {
    return VINA.map(([x, y], i) => ({ x, y, m: MONTHS[i] }));
  }

  // Closed form: b1 = Sxy / Sxx, b0 = ȳ - b1·x̄
  function ols(pts) {
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p.x, 0) / n;
    const my = pts.reduce((s, p) => s + p.y, 0) / n;
    let sxy = 0, sxx = 0;
    for (const p of pts) {
      sxy += (p.x - mx) * (p.y - my);
      sxx += (p.x - mx) ** 2;
    }
    const b1 = sxx ? sxy / sxx : 0;
    return { b0: my - b1 * mx, b1, my };
  }

  function errors(pts, b0, b1) {
    const n = pts.length;
    const my = pts.reduce((s, p) => s + p.y, 0) / n;
    let sse = 0, sst = 0;
    for (const p of pts) {
      sse += (p.y - (b0 + b1 * p.x)) ** 2;
      sst += (p.y - my) ** 2;
    }
    return { sse, sst, mse: sse / n, rmse: Math.sqrt(sse / n), r2: 1 - sse / sst };
  }

  function mount(body) {
    const id = "hz-ls-" + ++uid;
    let pts = makeData();
    let fit = ols(pts);
    // Start from the flat line at the mean: R² is exactly 0 there.
    let b0 = fit.my, b1 = 0;
    let mode = "squares";
    let anim = 0;

    const xs = scale([X0, X1], [M.l, W - M.r]);
    const ys = scale([Y0, Y1], [H - M.b, M.t]);

    const plot = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-ls-plot", role: "img", "aria-label": "Scatter plot with a movable regression line and squared residuals" });
    plot.append(
      svg("defs", {}, svg("clipPath", { id: id + "-clip" }, svg("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b })))
    );
    for (let v = 0; v <= Y1; v += 40) {
      plot.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
      plot.append(svg("text", { x: M.l - 8, y: ys(v) + 4, "text-anchor": "end", text: v }));
    }
    for (let v = 0; v <= X1; v += 50) plot.append(svg("text", { x: xs(v), y: H - M.b + 16, "text-anchor": "middle", text: v }));
    plot.append(
      svg("line", { class: "hz-axis", x1: M.l, x2: W - M.r, y1: ys(0), y2: ys(0) }),
      svg("line", { class: "hz-axis", x1: M.l, x2: M.l, y1: M.t, y2: ys(0) }),
      svg("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", text: "bookings arriving in the month" }),
      svg("text", { x: 12, y: (M.t + H - M.b) / 2, transform: `rotate(-90 12 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "average rate (USD per night)" })
    );

    const clipped = svg("g", { "clip-path": `url(#${id}-clip)` });
    const squareLayer = svg("g", { class: "hz-ls-squares" });
    const residLayer = svg("g");
    const line = svg("line", { class: "hz-ls-line" });
    clipped.append(squareLayer, residLayer, line);
    plot.append(clipped);

    const squares = pts.map(() => squareLayer.appendChild(svg("rect", { class: "hz-ls-square" })));
    const resids = pts.map(() => residLayer.appendChild(svg("line", { class: "hz-ls-resid" })));
    const dots = pts.map((p, i) => {
      const g = svg("g", { class: "hz-ls-point", "data-i": i }, [
        svg("circle", { class: "hz-ls-hit", r: 13 }),
        svg("circle", { class: "hz-ls-dot", r: 5 }),
        LABELLED.has(i) ? svg("text", { class: "hz-ls-mlab", x: i === 1 ? -10 : 9, y: i === 1 ? -9 : 4, "text-anchor": i === 1 ? "end" : "start", text: p.m }) : null,
      ]);
      plot.append(g);
      return g;
    });
    const handles = HX.map((hx, k) => {
      const g = svg("g", { class: "hz-ls-handle", "data-h": k }, [
        svg("circle", { class: "hz-ls-hit", r: 14 }),
        svg("circle", { class: "hz-ls-knob", r: 7.5 }),
      ]);
      plot.append(g);
      return g;
    });

    // SSE meter: your total area vs the smallest possible (OLS) and the flat mean line (SST).
    const MW = 300, MH = 46;
    const meter = svg("svg", { viewBox: `0 0 ${MW} ${MH}`, class: "hz-ls-meter", role: "img", "aria-label": "Total square area compared with the least-squares minimum" });
    const track = svg("rect", { x: 0, y: 14, width: MW, height: 12, rx: 6, class: "hz-ls-track" });
    const bar = svg("rect", { x: 0, y: 14, height: 12, rx: 6, class: "hz-ls-bar" });
    const minTick = svg("line", { y1: 8, y2: 32, class: "hz-ls-tick" });
    const minLabel = svg("text", { y: 44, "text-anchor": "middle", text: "smallest" });
    const sstTick = svg("line", { y1: 8, y2: 32, class: "hz-ls-tick hz-ls-tick--sst" });
    const sstLabel = svg("text", { y: 44, "text-anchor": "middle", text: "flat line" });
    meter.append(track, bar, minTick, sstTick, minLabel, sstLabel);

    const readout = stats();
    const note = el("p", { class: "hz-x__note" });

    const sSlope = slider({ label: "Slope: USD per extra booking", min: -0.5, max: 1.5, step: 0.01, value: b1, format: (v) => v.toFixed(2), oninput: (v) => setLine(b0, v) });
    const sInt = slider({ label: "Intercept: rate at 0 bookings", min: 0, max: 220, step: 0.5, value: b0, format: (v) => v.toFixed(0), oninput: (v) => setLine(v, b1) });

    function setLine(nb0, nb1, keepAnim) {
      if (!keepAnim) anim++;
      b0 = nb0;
      b1 = nb1;
      draw();
    }

    function draw() {
      const f = (x) => b0 + b1 * x;
      line.setAttribute("x1", xs(X0));
      line.setAttribute("x2", xs(X1));
      line.setAttribute("y1", ys(f(X0)));
      line.setAttribute("y2", ys(f(X1)));
      handles.forEach((g, k) => g.setAttribute("transform", `translate(${xs(HX[k])},${ys(f(HX[k]))})`));
      handles.forEach((g, k) => g.classList.toggle("is-off", f(HX[k]) < Y0 || f(HX[k]) > Y1));

      pts.forEach((p, i) => {
        const px = xs(p.x), py = ys(p.y), pf = ys(f(p.x));
        dots[i].setAttribute("transform", `translate(${px},${py})`);
        resids[i].setAttribute("x1", px);
        resids[i].setAttribute("x2", px);
        resids[i].setAttribute("y1", py);
        resids[i].setAttribute("y2", pf);
        // Side of the square in pixels is |residual| on the y scale, so area ∝ residual².
        const side = Math.abs(py - pf);
        const left = px + side > W - M.r ? px - side : px;
        const sq = squares[i];
        sq.setAttribute("x", left);
        sq.setAttribute("y", Math.min(py, pf));
        sq.setAttribute("width", side);
        sq.setAttribute("height", side);
      });
      squareLayer.style.display = mode === "squares" ? "" : "none";

      const e = errors(pts, b0, b1);
      const best = errors(pts, fit.b0, fit.b1);
      const atBest = e.sse - best.sse < 1e-3 * Math.max(1, best.sse);
      readout.set([
        ["Slope (USD per booking)", fmt(b1), "is-b"],
        ["Intercept (USD)", fmt(b0, 1), "is-b"],
        ["Total square area (SSE)", Math.round(e.sse).toLocaleString("en-US"), "is-a"],
        ["Typical miss (RMSE)", "USD " + fmt(e.rmse, 1)],
        ["R² = 1 − SSE / SST", fmt(e.r2, 3), atBest ? "is-good" : e.r2 < 0 ? "is-bad" : null],
      ]);

      const top = Math.max(e.sst * 1.5, e.sse * 1.05);
      const mx = (v) => (v / top) * MW;
      bar.setAttribute("width", Math.max(12, mx(e.sse)));
      bar.classList.toggle("is-best", atBest);
      minTick.setAttribute("x1", mx(best.sse));
      minTick.setAttribute("x2", mx(best.sse));
      minLabel.setAttribute("x", clamp(mx(best.sse), 34, MW - 34));
      sstTick.setAttribute("x1", mx(e.sst));
      sstTick.setAttribute("x2", mx(e.sst));
      sstLabel.setAttribute("x", clamp(mx(e.sst), 24, MW - 24));
      const close = Math.abs(mx(e.sst) - mx(best.sse)) < 70;
      sstLabel.style.display = close ? "none" : "";

      sSlope.set(clamp(b1, -0.5, 1.5));
      sInt.set(clamp(b0, 0, 220));

      const extra = e.sse / best.sse - 1;
      const flat = Math.abs(b1) < 0.005;
      note.innerHTML = atBest
        ? `This is the <strong>least-squares line</strong>: every extra 10 bookings in a month goes with about <strong>USD ${(10 * fit.b1).toFixed(0)} more</strong> per night. Any other line makes the total square area bigger. Now drag January down to USD 120 and fit again: one big square is enough to tilt the whole line.`
        : flat
        ? `A flat line at the average rate (USD ${fit.my.toFixed(0)}) ignores demand: it misses January and February by a lot, and those misses become the biggest squares. R² is 0 here by definition. Drag the right-hand handle up, or press <strong>Fit least squares</strong>.`
        : `Total square area is <strong>${Math.round(extra * 100)}% above</strong> the smallest possible. Least squares picks the line with the smallest total area, which is why big misses (big squares) count so much more than small ones.`;
    }

    function fitOls() {
      const id = ++anim;
      const from = { b0, b1 };
      tween(body, 650, (k) => {
        if (id !== anim) return;
        setLine(lerp(from.b0, fit.b0, k), lerp(from.b1, fit.b1, k), true);
      });
    }

    function reset() {
      pts = makeData();
      fit = ols(pts);
      setLine(fit.my, 0);
    }

    // Dragging: handles move the line, points move the data.
    let drag = null;
    const toData = (e) => {
      const r = plot.getBoundingClientRect();
      return { x: xs.invert(((e.clientX - r.left) / r.width) * W), y: ys.invert(((e.clientY - r.top) / r.height) * H) };
    };
    plot.addEventListener("pointerdown", (e) => {
      const h = e.target.closest(".hz-ls-handle");
      const p = e.target.closest(".hz-ls-point");
      if (!h && !p) return;
      e.preventDefault();
      anim++;
      drag = h ? { h: +h.dataset.h } : { p: +p.dataset.i, node: p };
      if (drag.node) drag.node.classList.add("is-dragging");
      plot.setPointerCapture(e.pointerId);
    });
    plot.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const d = toData(e);
      if (drag.h !== undefined) {
        // Keep the other handle fixed; solve the line through both.
        const other = 1 - drag.h;
        const yo = b0 + b1 * HX[other];
        const yh = clamp(d.y, Y0, Y1);
        const nb1 = (yh - yo) / (HX[drag.h] - HX[other]);
        setLine(yo - nb1 * HX[other], nb1);
      } else {
        const p = pts[drag.p];
        p.x = clamp(d.x, X0 + 0.1, X1 - 0.1);
        p.y = clamp(d.y, Y0 + 0.1, Y1 - 0.1);
        fit = ols(pts);
        draw();
      }
    });
    const end = () => {
      if (drag && drag.node) drag.node.classList.remove("is-dragging");
      drag = null;
    };
    plot.addEventListener("pointerup", end);
    plot.addEventListener("pointercancel", end);

    const view = segmented(
      [{ value: "squares", label: "Squares" }, { value: "residuals", label: "Residuals only" }],
      mode,
      (v) => { mode = v; draw(); }
    );

    body.append(
      el("p", { class: "hz-x__lede", html: "Viña del Mar, one dot per month: how many bookings arrive, and the average rate they paid. A <strong>residual</strong> is the vertical miss between a dot and the line. Square each one and you get an actual square: the <strong>SSE</strong> is their total area. Drag the two round handles to move the line, or drag any dot." }),
      el("div", { class: "hz-ls-stack" }, [
        el("div", {}, [
          plot,
          el("div", { class: "hz-legend" }, [
            el("span", {}, [el("i", { style: "background: var(--hz-ink)" }), "one month at Viña del Mar"]),
            el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "your line"]),
            el("span", {}, [el("i", { style: "background: var(--hz-a-soft); border: 1px solid var(--hz-a); border-radius: 2px" }), "residual²"]),
          ]),
        ]),
        el("div", { class: "hz-ls-side hz-ls-below" }, [
          readout.node,
          el("div", {}, [el("div", { class: "hz-ls-meter-label", text: "Total square area" }), meter]),
        ]),
      ]),
      el("div", { class: "hz-x__controls" }, [sSlope.node, sInt.node]),
      el("div", { class: "hz-x__controls" }, [
        view.node,
        button("Fit least squares", fitOls, "primary"),
        button("Reset", reset),
      ]),
      note
    );
    draw();
  }

  const css = `
.md-typeset .hz-ls-stack { display: flex; flex-direction: column; gap: 1rem; }
.md-typeset .hz-ls-stack .hz-ls-plot { width: 100%; max-width: 40rem; display: block; margin: 0 auto; }
.md-typeset .hz-ls-below { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.6rem 1.5rem; align-items: start; }
.md-typeset .hz-x svg.hz-ls-plot text { font-size: 13px; }
.md-typeset .hz-x svg.hz-ls-plot text.hz-ls-mlab { font-size: 12.5px; fill: var(--hz-muted); pointer-events: none; }
@media (max-width: 40em) { .md-typeset .hz-ls-below { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 30em) {
  .md-typeset .hz-x svg.hz-ls-plot text, .md-typeset .hz-x svg.hz-ls-plot text.hz-ls-mlab { font-size: 15px; }
}
`;
  HZ.register("least-squares", { kicker: "Week 3", title: "The best line through Viña's months", css, mount });
})();
