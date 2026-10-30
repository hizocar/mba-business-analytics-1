/* Class 6: ordinary least squares. Every residual becomes a square; the SSE
   is their total area, and OLS is the line that makes that area smallest. */
(function () {
  const { el, svg, slider, button, segmented, stats, scale, tween, rng, fmt, clamp, lerp } = HZ;

  const W = 520, H = 340, M = { l: 44, r: 16, t: 14, b: 40 };
  const X0 = 0, X1 = 10, Y0 = 0, Y1 = 12;
  // The two line handles sit at fixed x positions and move vertically.
  const HX = [0, 10];
  let uid = 0;

  function makeData() {
    const r = rng(6);
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const x = 0.7 + (i * 8.6) / 11 + (r() - 0.5) * 0.5;
      pts.push({ x, y: clamp(1.6 + 0.78 * x + 1.15 * r.normal(), 0.4, 11.6) });
    }
    return pts;
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
    for (let v = 0; v <= Y1; v += 2) {
      plot.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
      plot.append(svg("text", { x: M.l - 8, y: ys(v) + 4, "text-anchor": "end", text: v }));
    }
    for (let v = 0; v <= X1; v += 2) plot.append(svg("text", { x: xs(v), y: H - M.b + 16, "text-anchor": "middle", text: v }));
    plot.append(
      svg("line", { class: "hz-axis", x1: M.l, x2: W - M.r, y1: ys(0), y2: ys(0) }),
      svg("line", { class: "hz-axis", x1: M.l, x2: M.l, y1: M.t, y2: ys(0) }),
      svg("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", text: "ad spend ($k)" }),
      svg("text", { x: 12, y: (M.t + H - M.b) / 2, transform: `rotate(-90 12 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "sales ($k)" })
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
    const meter = svg("svg", { viewBox: `0 0 ${MW} ${MH}`, class: "hz-ls-meter", role: "img", "aria-label": "Total square area compared with the OLS minimum" });
    const track = svg("rect", { x: 0, y: 14, width: MW, height: 12, rx: 6, class: "hz-ls-track" });
    const bar = svg("rect", { x: 0, y: 14, height: 12, rx: 6, class: "hz-ls-bar" });
    const minTick = svg("line", { y1: 8, y2: 32, class: "hz-ls-tick" });
    const minLabel = svg("text", { y: 44, "text-anchor": "middle", text: "OLS minimum" });
    const sstTick = svg("line", { y1: 8, y2: 32, class: "hz-ls-tick hz-ls-tick--sst" });
    const sstLabel = svg("text", { y: 44, "text-anchor": "middle", text: "flat line" });
    meter.append(track, bar, minTick, sstTick, minLabel, sstLabel);

    const readout = stats();
    const note = el("p", { class: "hz-x__note" });

    const sSlope = slider({ label: "Slope b₁", min: -1.5, max: 1.5, step: 0.01, value: b1, format: (v) => v.toFixed(2), oninput: (v) => setLine(b0, v) });
    const sInt = slider({ label: "Intercept b₀", min: -2, max: 12, step: 0.01, value: b0, format: (v) => v.toFixed(2), oninput: (v) => setLine(v, b1) });

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
        ["Slope b₁", fmt(b1), "is-b"],
        ["Intercept b₀", fmt(b0), "is-b"],
        ["SSE (total area)", fmt(e.sse, 1), "is-a"],
        ["MSE = SSE / n", fmt(e.mse)],
        ["RMSE", fmt(e.rmse)],
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

      sSlope.set(clamp(b1, -1.5, 1.5));
      sInt.set(clamp(b0, -2, 12));

      const extra = e.sse / best.sse - 1;
      note.innerHTML = atBest
        ? "This is the <strong>OLS line</strong>. Any other slope or intercept makes the total square area bigger. Now drag a point at either end far from the others and fit again: its square is so large that it tilts the whole line."
        : `Total square area is <strong>${Math.round(extra * 100)}% above</strong> the smallest possible. OLS picks the line with the smallest total square area, which is why big misses (big squares) count so much more than small ones.`;
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
      el("p", { class: "hz-x__lede", html: "A <strong>residual</strong> is the vertical miss between a point and the line. Square each one and you get an actual square: the <strong>SSE</strong> is their total area. Drag the two round handles to move the line, or drag any point." }),
      el("div", { class: "hz-x__split" }, [
        el("div", {}, [
          plot,
          el("div", { class: "hz-legend" }, [
            el("span", {}, [el("i", { style: "background: var(--hz-ink)" }), "customer"]),
            el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "your line"]),
            el("span", {}, [el("i", { style: "background: var(--hz-a-soft); border: 1px solid var(--hz-a); border-radius: 2px" }), "residual²"]),
          ]),
        ]),
        el("div", { class: "hz-ls-side" }, [
          readout.node,
          el("div", {}, [el("div", { class: "hz-ls-meter-label", text: "Total square area" }), meter]),
        ]),
      ]),
      el("div", { class: "hz-x__controls" }, [sSlope.node, sInt.node]),
      el("div", { class: "hz-x__controls" }, [
        view.node,
        button("Fit OLS", fitOls, "primary"),
        button("Reset", reset),
      ]),
      note
    );
    draw();
  }

  HZ.register("least-squares", { kicker: "Session 3", title: "Least squares, drawn as squares", mount });
})();
