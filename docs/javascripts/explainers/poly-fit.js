/* Class 6a: polynomial regression of increasing degree on the notebook's
   noisy sine wave. Train error always falls; test error falls, then rises. */
(function () {
  const { el, svg, slider, button, stats, scale, tween, rng, fmt, clamp, lerp } = HZ;

  const W = 520, H = 320, M = { l: 44, r: 16, t: 14, b: 40 };
  const N = 100, MAX_DEG = 15, SAMPLES = 161;
  const Y0 = -1.8, Y1 = 1.8;
  // Seeds whose test curve shows a clear U; resampling cycles through them.
  const SEEDS = [42, 27, 17, 58, 11, 1];
  let uid = 0;

  // X = linspace(0, 1, 100); y = sin(2πx) + noise; 70/30 shuffled split
  function makeData(seed) {
    const r = rng(seed);
    const pts = [];
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1);
      pts.push({ x, y: Math.sin(2 * Math.PI * x) + 0.2 * r.normal() });
    }
    const idx = pts.map((_, i) => i);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    idx.forEach((k, rank) => (pts[k].train = rank < 70));
    return pts;
  }

  // Legendre polynomials on t = 2x − 1 ∈ [−1, 1] span the same functions as
  // 1, x, …, x^d but stay well conditioned up to degree 15.
  function basis(x, d) {
    const t = 2 * x - 1;
    const p = [1, t];
    for (let k = 1; k < d; k++) p.push(((2 * k + 1) * t * p[k] - k * p[k - 1]) / (k + 1));
    return p.slice(0, d + 1);
  }

  // Least squares via Householder QR (no normal equations, no ridge needed).
  function lstsq(A, b) {
    const m = A.length, n = A[0].length;
    A = A.map((row) => row.slice());
    b = b.slice();
    for (let j = 0; j < n; j++) {
      let norm = 0;
      for (let i = j; i < m; i++) norm += A[i][j] * A[i][j];
      norm = Math.sqrt(norm);
      if (!norm) continue;
      const alpha = A[j][j] > 0 ? -norm : norm;
      const v = [];
      for (let i = j; i < m; i++) v.push(A[i][j]);
      v[0] -= alpha;
      const vv = v.reduce((s, x) => s + x * x, 0);
      if (!vv) continue;
      for (let k = j; k < n; k++) {
        let dot = 0;
        for (let i = j; i < m; i++) dot += v[i - j] * A[i][k];
        const f = (2 * dot) / vv;
        for (let i = j; i < m; i++) A[i][k] -= f * v[i - j];
      }
      let dot = 0;
      for (let i = j; i < m; i++) dot += v[i - j] * b[i];
      const f = (2 * dot) / vv;
      for (let i = j; i < m; i++) b[i] -= f * v[i - j];
    }
    const c = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let k = i + 1; k < n; k++) s -= A[i][k] * c[k];
      c[i] = A[i][i] ? s / A[i][i] : 0;
    }
    return c;
  }

  function fitAll(pts) {
    const train = pts.filter((p) => p.train), test = pts.filter((p) => !p.train);
    const fits = [];
    for (let d = 1; d <= MAX_DEG; d++) {
      const c = lstsq(train.map((p) => basis(p.x, d)), train.map((p) => p.y));
      const f = (x) => basis(x, d).reduce((s, v, k) => s + v * c[k], 0);
      const mse = (set) => set.reduce((s, p) => s + (f(p.x) - p.y) ** 2, 0) / set.length;
      const curve = [];
      for (let i = 0; i < SAMPLES; i++) curve.push(f(i / (SAMPLES - 1)));
      fits.push({ d, train: mse(train), test: mse(test), curve });
    }
    const best = fits.reduce((a, b) => (b.test < a.test ? b : a));
    // Once test error has clearly risen past the best degree, every higher
    // degree is in the overfitting regime even if noise makes it dip a little.
    let over = false;
    fits.forEach((f) => {
      if (f.d > best.d && f.test > 1.2 * best.test) over = true;
      f.verdict = f.d < best.d && f.test > 1.4 * best.test ? "under" : over ? "over" : "good";
    });
    return { fits, best };
  }

  function mount(body) {
    const id = "hz-pf-" + ++uid;
    let seedIx = 0;
    let pts = makeData(SEEDS[seedIx]);
    let model = fitAll(pts);
    let deg = 1;
    let shown = model.fits[0].curve.slice();
    let anim = 0;

    const xs = scale([0, 1], [M.l, W - M.r]);
    const ys = scale([Y0, Y1], [H - M.b, M.t]);

    const plot = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-pf-plot", role: "img", "aria-label": "Noisy sine data with a fitted polynomial curve" });
    plot.append(svg("defs", {}, svg("clipPath", { id: id + "-clip" }, svg("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b }))));
    [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].forEach((v) => {
      plot.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
      if (Number.isInteger(v)) plot.append(svg("text", { x: M.l - 8, y: ys(v) + 4, "text-anchor": "end", text: v }));
    });
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => plot.append(svg("text", { x: xs(v), y: H - M.b + 16, "text-anchor": "middle", text: v })));
    plot.append(
      svg("line", { class: "hz-axis", x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }),
      svg("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", text: "x" }),
      svg("text", { x: 10, y: (M.t + H - M.b) / 2, transform: `rotate(-90 10 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "y" })
    );
    let truth = "";
    for (let i = 0; i < SAMPLES; i++) {
      const x = i / (SAMPLES - 1);
      truth += (i ? "L" : "M") + xs(x).toFixed(1) + "," + ys(Math.sin(2 * Math.PI * x)).toFixed(1);
    }
    plot.append(svg("path", { d: truth, class: "hz-pf-truth" }));
    const dotLayer = svg("g");
    plot.append(dotLayer);
    const curve = svg("path", { class: "hz-pf-curve", "clip-path": `url(#${id}-clip)` });
    plot.append(curve);

    // Error vs degree (log scale so the U on the test curve is readable).
    const EW = 300, EH = 190, EM = { l: 40, r: 10, t: 12, b: 30 };
    const ex = scale([1, MAX_DEG], [EM.l, EW - EM.r]);
    let ey;
    const err = svg("svg", { viewBox: `0 0 ${EW} ${EH}`, role: "img", "aria-label": "Train and test error for every degree" });
    const errGrid = svg("g");
    const marker = svg("line", { y1: EM.t, y2: EH - EM.b, class: "hz-pf-marker" });
    const trainLine = svg("path", { class: "hz-stroke-b", "stroke-width": 2 });
    const testLine = svg("path", { class: "hz-stroke-a", "stroke-width": 2 });
    const errDots = svg("g");
    const curTrain = svg("circle", { r: 4.5, class: "hz-fill-b hz-pf-cur" });
    const curTest = svg("circle", { r: 4.5, class: "hz-fill-a hz-pf-cur" });
    err.append(errGrid, marker, trainLine, testLine, errDots, curTrain, curTest);
    [1, 5, 10, 15].forEach((d) => err.append(svg("text", { x: ex(d), y: EH - EM.b + 14, "text-anchor": "middle", text: d })));
    err.append(
      svg("line", { class: "hz-axis", x1: EM.l, x2: EW - EM.r, y1: EH - EM.b, y2: EH - EM.b }),
      svg("text", { x: (EM.l + EW - EM.r) / 2, y: EH - 2, "text-anchor": "middle", text: "polynomial degree" })
    );

    function drawErrChart() {
      const all = model.fits.flatMap((f) => [f.train, f.test]);
      const lo = Math.log10(Math.min(...all) / 1.25), hi = Math.log10(Math.max(...all) * 1.25);
      const ly = scale([lo, hi], [EH - EM.b, EM.t]);
      ey = (v) => ly(Math.log10(v));
      errGrid.replaceChildren();
      [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1].forEach((v) => {
        const l = Math.log10(v);
        if (l < lo || l > hi) return;
        errGrid.append(
          svg("line", { class: "hz-gridline", x1: EM.l, x2: EW - EM.r, y1: ey(v), y2: ey(v) }),
          svg("text", { x: EM.l - 6, y: ey(v) + 4, "text-anchor": "end", text: v })
        );
      });
      const path = (k) => model.fits.map((f, i) => (i ? "L" : "M") + ex(f.d).toFixed(1) + "," + ey(f[k]).toFixed(1)).join("");
      trainLine.setAttribute("d", path("train"));
      testLine.setAttribute("d", path("test"));
      errDots.replaceChildren(
        ...model.fits.flatMap((f) => [
          svg("circle", { cx: ex(f.d), cy: ey(f.train), r: 2, class: "hz-fill-b" }),
          svg("circle", { cx: ex(f.d), cy: ey(f.test), r: 2, class: "hz-fill-a" }),
        ]),
        svg("circle", { cx: ex(model.best.d), cy: ey(model.best.test), r: 6.5, class: "hz-pf-bestring" }),
        svg("text", { x: clamp(ex(model.best.d), EM.l + 40, EW - EM.r - 40), y: EM.t + 8, "text-anchor": "middle", class: "hz-pf-best", text: `best degree (test): ${model.best.d}` })
      );
    }

    function drawDots() {
      dotLayer.replaceChildren(
        ...pts.map((p) => svg("circle", { cx: xs(p.x), cy: ys(p.y), r: 3.6, class: p.train ? "hz-pf-train" : "hz-pf-test" }))
      );
    }

    const readout = stats();
    const verdict = el("span", { class: "hz-pf-verdict" });
    const note = el("p", { class: "hz-x__note" });
    const NOTES = {
      under: "<strong>Underfitting.</strong> The curve is too simple to follow the wave, so it misses training and test points alike: both errors are high.",
      good: "<strong>Good fit.</strong> The curve follows the wave and ignores the noise. Test error is near its minimum: this is the complexity to deploy.",
      over: "<strong>Overfitting.</strong> The curve bends to chase the noise in the training points. Train error keeps falling, but test error rises: it memorises instead of learning.",
    };

    function setCurve(c) {
      let d = "";
      for (let i = 0; i < SAMPLES; i++) d += (i ? "L" : "M") + xs(i / (SAMPLES - 1)).toFixed(1) + "," + ys(clamp(c[i], -6, 6)).toFixed(1);
      curve.setAttribute("d", d);
    }

    function show(animate) {
      const f = model.fits[deg - 1];
      const from = shown.slice();
      const fromX = +marker.getAttribute("x1") || ex(deg);
      const id = ++anim;
      tween(body, animate ? 450 : 0, (k) => {
        if (id !== anim) return;
        shown = from.map((v, i) => lerp(v, f.curve[i], k));
        setCurve(shown);
        const mx = lerp(fromX, ex(deg), k);
        marker.setAttribute("x1", mx);
        marker.setAttribute("x2", mx);
      });
      curTrain.setAttribute("cx", ex(deg));
      curTrain.setAttribute("cy", ey(f.train));
      curTest.setAttribute("cx", ex(deg));
      curTest.setAttribute("cy", ey(f.test));
      readout.set([
        ["Degree", String(deg)],
        ["Train MSE", fmt(f.train, 4), "is-b"],
        ["Test MSE", fmt(f.test, 4), "is-a"],
        ["Test − train gap", fmt(f.test - f.train, 4)],
      ]);
      verdict.textContent = { under: "Underfitting", good: "Good fit", over: "Overfitting" }[f.verdict];
      verdict.className = "hz-pf-verdict is-" + f.verdict;
      note.innerHTML = NOTES[f.verdict];
    }

    const sDeg = slider({ label: "Degree", min: 1, max: MAX_DEG, step: 1, value: deg, oninput: (v) => { deg = v; show(true); } });

    function resample() {
      seedIx = (seedIx + 1) % SEEDS.length;
      pts = makeData(SEEDS[seedIx]);
      model = fitAll(pts);
      drawDots();
      drawErrChart();
      show(true);
    }

    body.append(
      el("p", { class: "hz-x__lede", html: "Data like the notebook's: 100 points from a sine wave plus noise, split 70% train / 30% test. Raise the <strong>degree</strong> of the polynomial and watch two errors: on the points the model saw, and on points it never saw." }),
      el("div", { class: "hz-x__split" }, [
        el("div", {}, [
          plot,
          el("div", { class: "hz-legend" }, [
            el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "train (70)"]),
            el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "test (30)"]),
            el("span", {}, [el("i", { style: "background: var(--hz-ink); border-radius: 2px; height: 3px; vertical-align: 0.2em" }), "fitted curve"]),
            el("span", {}, [el("i", { style: "border-top: 2px dashed var(--hz-muted); border-radius: 0; height: 0; vertical-align: 0.2em" }), "true sin(2πx)"]),
          ]),
        ]),
        el("div", { class: "hz-pf-side" }, [verdict, readout.node, err]),
      ]),
      el("div", { class: "hz-x__controls" }, [sDeg.node, button("Resample noise", resample)]),
      note
    );
    drawDots();
    drawErrChart();
    show(false);
  }

  HZ.register("poly-fit", { kicker: "Session 3", title: "Underfitting and overfitting", mount });
})();
