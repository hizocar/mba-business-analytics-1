/* Week 5: a polynomial curve for Viña del Mar's season. 100 Standard-room
   bookings (rate by arrival date), 70 to train on and 30 to test. Raising the
   degree bends the curve more: train error always falls; test error falls,
   then rises, and high degrees shoot off at the edges of the year. */
(function () {
  const { el, svg, slider, button, stats, scale, tween, fmt, clamp, lerp } = HZ;

  const W = 520, H = 320, M = { l: 44, r: 16, t: 14, b: 40 };
  const MAX_DEG = 15, SAMPLES = 161;
  const Y0 = 40, Y1 = 250;
  // [day of year of arrival, nightly rate USD]: 400 Standard-room bookings at
  // Viña del Mar from altamar_bookings_clean.csv.
  const POOL = [[48,163],[339,111],[335,107],[130,73],[48,177],[306,83],[13,169],[26,198],[178,79],[154,61],[279,86],[338,127],[74,141],[49,124],[32,152],[191,62],[228,98],[69,69],[297,99],[181,62],[45,195],[33,196],[64,119],[221,71],[355,144],[64,75],[181,83],[75,118],[130,87],[14,143],[21,174],[337,130],[113,102],[47,150],[204,61],[47,144],[19,182],[57,151],[54,143],[263,74],[52,150],[251,86],[245,82],[293,69],[46,149],[12,152],[111,70],[4,155],[357,115],[151,65],[50,134],[176,59],[259,80],[68,114],[238,75],[35,158],[358,92],[53,151],[45,147],[315,103],[188,81],[228,59],[308,86],[348,114],[160,77],[77,118],[27,135],[358,115],[161,54],[320,110],[71,88],[21,143],[274,51],[339,93],[21,152],[190,64],[1,209],[40,152],[23,179],[31,183],[324,97],[18,191],[105,76],[19,226],[350,109],[183,75],[294,80],[46,121],[306,113],[154,86],[17,181],[350,110],[181,85],[140,70],[364,123],[127,78],[186,97],[193,88],[59,171],[19,189],[199,71],[337,122],[364,101],[24,151],[88,115],[343,88],[14,131],[9,138],[203,69],[20,201],[278,69],[2,225],[42,170],[269,83],[24,132],[41,153],[41,114],[247,102],[147,82],[352,104],[42,136],[200,125],[154,80],[66,125],[243,62],[89,107],[84,90],[20,124],[4,154],[69,104],[105,57],[157,60],[172,85],[46,144],[50,155],[9,168],[340,122],[220,65],[41,151],[5,164],[70,101],[7,165],[323,71],[89,141],[24,191],[362,122],[292,76],[32,141],[359,98],[57,158],[279,103],[171,92],[26,171],[234,99],[353,138],[352,103],[21,138],[9,169],[86,148],[105,90],[20,133],[200,66],[77,91],[59,153],[109,68],[69,104],[10,135],[18,163],[41,107],[344,110],[23,186],[74,141],[8,164],[42,163],[31,160],[57,146],[252,84],[280,81],[38,181],[291,70],[54,200],[99,71],[261,80],[79,100],[5,156],[202,84],[328,97],[292,88],[8,147],[90,121],[128,60],[240,89],[49,131],[214,76],[89,83],[97,80],[31,166],[31,143],[40,133],[108,84],[15,170],[13,215],[41,127],[283,83],[134,86],[334,113],[37,104],[11,133],[357,105],[51,170],[214,66],[97,85],[54,152],[63,92],[85,108],[42,126],[40,138],[59,182],[60,157],[309,75],[291,80],[13,161],[25,144],[192,74],[7,153],[247,92],[105,73],[305,76],[6,215],[36,164],[256,89],[315,97],[264,65],[52,127],[57,117],[30,189],[279,77],[16,152],[11,197],[347,128],[211,75],[81,99],[16,144],[332,98],[288,79],[57,166],[309,70],[81,108],[365,126],[305,111],[30,162],[15,130],[29,152],[235,90],[27,151],[180,115],[352,190],[24,164],[132,78],[21,180],[8,158],[61,83],[307,94],[337,122],[158,82],[236,77],[166,59],[317,75],[46,133],[204,53],[108,99],[4,182],[178,74],[62,106],[7,168],[238,64],[208,82],[38,111],[307,91],[330,57],[41,148],[205,86],[263,91],[45,127],[348,116],[196,73],[60,161],[72,134],[344,85],[245,101],[30,172],[106,80],[243,68],[23,156],[205,74],[315,78],[12,163],[248,68],[276,67],[58,154],[322,101],[291,85],[308,88],[32,163],[77,87],[240,40],[318,98],[225,82],[298,89],[190,66],[335,106],[265,71],[355,98],[25,188],[44,147],[159,64],[45,162],[51,152],[133,80],[57,154],[58,92],[186,61],[251,50],[13,129],[19,160],[7,178],[50,123],[109,78],[308,79],[73,110],[348,114],[38,149],[290,82],[253,77],[289,98],[49,121],[41,155],[57,178],[103,61],[47,180],[81,113],[13,177],[191,82],[69,85],[314,83],[55,110],[41,112],[246,74],[294,69],[267,87],[151,58],[306,91],[287,114],[353,120],[336,103],[330,107],[87,117],[219,74],[286,102],[69,86],[194,80],[69,84],[335,102],[36,124],[311,71],[5,168],[52,121],[243,86],[55,173],[33,167],[211,70],[328,113],[228,75],[300,76],[117,100],[289,81],[95,97],[332,85],[292,88],[1,155],[2,161],[16,162],[33,119],[89,84],[352,109],[49,134],[86,106],[170,70],[186,69],[78,129],[300,101],[55,144],[273,82],[56,122],[355,91],[32,151],[174,68],[285,85],[230,94],[351,106]];
  // Six draws of 100 bookings from the pool (the first 70 of each train the
  // curve). "Draw other bookings" cycles through them.
  const DRAWS = [[192,83,340,226,390,182,157,79,324,361,140,2,246,3,26,303,335,106,312,329,332,123,78,8,251,233,377,141,267,389,177,81,173,230,135,92,67,166,372,98,122,215,91,227,244,203,285,254,72,328,297,225,299,4,172,245,100,392,163,212,73,291,339,154,321,325,228,207,193,209,0,165,12,240,354,131,64,379,74,208,257,59,30,90,171,148,294,58,378,270,202,388,32,49,146,310,115,284,358,99],[178,121,386,69,117,396,158,159,154,61,92,303,37,42,181,177,38,57,127,176,90,362,359,309,298,10,310,344,165,337,236,349,230,68,350,163,171,76,371,191,351,1,52,119,58,82,338,266,369,151,75,203,326,332,70,71,224,217,250,378,9,391,285,167,335,327,27,246,196,210,380,46,215,205,174,187,267,88,297,25,115,59,296,341,87,227,288,97,2,323,186,89,257,40,104,305,340,94,223,184],[124,250,356,9,154,46,194,347,60,395,320,244,267,272,74,16,303,206,103,398,309,87,279,157,71,33,12,239,172,364,90,354,288,383,160,20,202,51,225,13,30,223,175,110,361,34,32,342,358,322,39,207,88,214,125,79,81,84,170,61,285,229,68,366,11,171,324,43,130,308,22,76,240,307,295,243,252,325,141,359,102,98,146,25,344,385,321,27,282,318,135,147,115,296,192,80,122,63,41,99],[186,213,270,28,196,123,260,121,319,268,160,236,44,143,182,144,13,91,12,6,212,127,255,328,4,282,45,349,386,165,90,200,307,35,341,155,33,369,83,139,86,84,253,203,305,101,135,288,114,125,183,385,242,176,16,205,226,306,258,158,151,325,18,220,357,204,283,11,97,382,294,397,389,70,392,264,61,140,51,300,336,41,248,32,348,374,181,103,189,315,152,52,119,381,37,108,166,47,1,133],[18,232,100,234,144,6,369,46,2,342,153,385,258,65,170,213,150,379,265,165,310,48,157,40,293,1,61,174,396,107,318,219,328,77,193,58,31,364,253,63,314,228,370,365,308,255,397,131,294,338,111,230,358,286,276,351,218,74,355,312,208,128,304,30,113,7,200,47,239,353,340,145,236,34,390,173,35,62,39,381,148,248,120,15,331,373,305,368,204,246,52,53,284,347,237,210,285,298,391,185],[39,25,89,199,378,154,92,317,156,215,57,15,386,325,384,108,345,368,218,198,91,150,254,96,167,337,191,236,144,84,32,21,371,55,321,61,332,246,173,230,149,235,229,310,283,14,123,274,328,35,1,245,303,130,118,239,3,291,73,294,262,361,82,308,13,107,148,243,210,20,197,133,30,34,94,351,205,161,202,110,376,26,209,63,65,270,257,381,151,81,395,295,135,160,195,103,128,396,6,223]];
  const MONTH_START = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  let uid = 0;

  // x = day of year scaled to [0, 1]
  function makeData(k) {
    return DRAWS[k].map((i, rank) => ({ x: (POOL[i][0] - 1) / 364, y: POOL[i][1], train: rank < 70 }));
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
      const mse = (set) => set.reduce((s, p) => s + Math.abs(f(p.x) - p.y), 0) / set.length; // typical (mean absolute) error, USD
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
    let pts = makeData(seedIx);
    let model = fitAll(pts);
    let deg = 1;
    let shown = model.fits[0].curve.slice();
    let anim = 0;

    const xs = scale([0, 1], [M.l, W - M.r]);
    const ys = scale([Y0, Y1], [H - M.b, M.t]);

    const plot = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-pf-plot", role: "img", "aria-label": "Viña del Mar bookings by arrival date with a fitted polynomial curve" });
    plot.append(svg("defs", {}, svg("clipPath", { id: id + "-clip" }, svg("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b }))));
    for (let v = 40; v <= 240; v += 20) {
      plot.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
      if (v % 40 === 0) plot.append(svg("text", { x: M.l - 8, y: ys(v) + 4, "text-anchor": "end", text: v }));
    }
    MONTH_START.forEach((d, i) => plot.append(svg("text", { x: xs((d + 14 - 1) / 364), y: H - M.b + 16, "text-anchor": "middle", text: MONTHS[i] })));
    plot.append(
      svg("line", { class: "hz-axis", x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }),
      svg("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", text: "arrival date (month of the year)" }),
      svg("text", { class: "hz-ytitle", x: 10, y: (M.t + H - M.b) / 2, transform: `rotate(-90 10 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "nightly rate (USD)" })
    );
    const dotLayer = svg("g");
    plot.append(dotLayer);
    const curve = svg("path", { class: "hz-pf-curve", "clip-path": `url(#${id}-clip)` });
    plot.append(curve);

    // Typical error vs degree.
    const EW = 300, EH = 190, EM = { l: 40, r: 10, t: 12, b: 30 };
    const ex = scale([1, MAX_DEG], [EM.l, EW - EM.r]);
    let ey;
    const err = svg("svg", { viewBox: `0 0 ${EW} ${EH}`, class: "hz-pf-err", role: "img", "aria-label": "Train and test error for every degree" });
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
      const hi = Math.ceil(Math.max(...all) / 10) * 10;
      ey = scale([0, hi], [EH - EM.b, EM.t]);
      errGrid.replaceChildren();
      for (let v = 0; v <= hi; v += 10) {
        errGrid.append(
          svg("line", { class: "hz-gridline", x1: EM.l, x2: EW - EM.r, y1: ey(v), y2: ey(v) }),
          svg("text", { x: EM.l - 6, y: ey(v) + 4, "text-anchor": "end", text: v })
        );
      }
      const path = (k) => model.fits.map((f, i) => (i ? "L" : "M") + ex(f.d).toFixed(1) + "," + ey(f[k]).toFixed(1)).join("");
      trainLine.setAttribute("d", path("train"));
      testLine.setAttribute("d", path("test"));
      errDots.replaceChildren(
        ...model.fits.flatMap((f) => [
          svg("circle", { cx: ex(f.d), cy: ey(f.train), r: 2, class: "hz-fill-b" }),
          svg("circle", { cx: ex(f.d), cy: ey(f.test), r: 2, class: "hz-fill-a" }),
        ]),
        svg("circle", { cx: ex(model.best.d), cy: ey(model.best.test), r: 6.5, class: "hz-pf-bestring" }),
        svg("text", { x: EW - EM.r, y: EM.t + 2, "text-anchor": "end", class: "hz-pf-best", text: `best degree on test: ${model.best.d}` })
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
      under: "<strong>Too simple.</strong> A straight line cannot rise at both ends of the year, so it misses the summer peak in January and December: both errors are high.",
      good: "<strong>Good fit.</strong> A gentle U follows the summer peak and the quiet winter. Test error is near its lowest: a curve really is better than a line here.",
      over: "<strong>Fragile.</strong> The curve bends to chase individual bookings. Look at the <strong>edges</strong> (early January, late December): with few bookings to hold it, the curve shoots off, and test error rises.",
    };

    function setCurve(c) {
      let d = "";
      for (let i = 0; i < SAMPLES; i++) d += (i ? "L" : "M") + xs(i / (SAMPLES - 1)).toFixed(1) + "," + ys(clamp(c[i], Y0 - 400, Y1 + 400)).toFixed(1);
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
        ["Train error", "USD " + fmt(f.train, 1), "is-b"],
        ["Test error", "USD " + fmt(f.test, 1), "is-a"],
        ["Test − train gap", "USD " + fmt(f.test - f.train, 1)],
      ]);
      verdict.textContent = { under: "Too simple", good: "Good fit", over: "Overfitting" }[f.verdict];
      verdict.className = "hz-pf-verdict is-" + f.verdict;
      note.innerHTML = NOTES[f.verdict];
    }

    const sDeg = slider({ label: "Degree", min: 1, max: MAX_DEG, step: 1, value: deg, oninput: (v) => { deg = v; show(true); } });

    function resample() {
      seedIx = (seedIx + 1) % DRAWS.length;
      pts = makeData(seedIx);
      model = fitAll(pts);
      drawDots();
      drawErrChart();
      show(true);
    }

    body.append(
      el("p", { class: "hz-x__lede", html: "100 Standard-room bookings at <strong>Viña del Mar</strong>, by arrival date: 70 to fit the curve, 30 to test it. Degree 1 is a straight line; each extra degree lets the curve bend once more. Watch two typical errors: on bookings the curve saw, and on bookings it never saw." }),
      plot,
      el("div", { class: "hz-legend" }, [
        el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "train (70 bookings)"]),
        el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "test (30 bookings)"]),
        el("span", {}, [el("i", { style: "background: var(--hz-ink); border-radius: 2px; height: 3px; vertical-align: 0.2em" }), "fitted curve"]),
      ]),
      el("div", { class: "hz-x__controls" }, [sDeg.node, button("Draw other bookings", resample)]),
      el("div", { class: "hz-pf-below" }, [
        el("div", { class: "hz-pf-side" }, [verdict, readout.node]),
        el("div", {}, [el("p", { class: "hz-pf-errh", text: "Typical error (USD per night) by degree" }), err]),
      ]),
      note
    );
    drawDots();
    drawErrChart();
    show(false);
  }

  HZ.register("poly-fit", {
    kicker: "Week 5",
    title: "A curve for the season",
    mount,
    css: `.md-typeset .hz-x svg.hz-pf-err text { font-size: 12px; }
.md-typeset .hz-pf-below { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 0.8rem 1.4rem; align-items: start; }
@media (max-width: 40em) { .md-typeset .hz-pf-below { grid-template-columns: minmax(0, 1fr); } }
.md-typeset .hz-x__body p.hz-pf-errh { font-size: 0.66rem; color: var(--md-default-fg-color--light); margin-bottom: 0.2rem; }
@media (max-width: 30em) { .md-typeset .hz-x svg.hz-pf-plot text { font-size: 21px; } .md-typeset .hz-x svg text.hz-ytitle { display: none; } .md-typeset .hz-x svg.hz-pf-err text { font-size: 14px; } }`,
  });
})();
