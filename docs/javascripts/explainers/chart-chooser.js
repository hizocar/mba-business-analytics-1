/*
 * chart-chooser: the question decides the chart. The same 80 synthetic
 * Cordillera-like customers (one dot each) rearrange into a histogram, a box
 * plot, a bar chart of churn rates or a scatter plot, depending on the
 * question picked, with a caption saying why that chart fits.
 */
(function () {
  const { el, svg } = HZ;

  const PLANS = ["Prepaid", "Basic", "Plus", "Unlimited"];
  const BASE = [9, 18, 29, 42];
  const DATA = [4, 8, 15, 30];
  const CONTRACTS = ["Month-to-month", "12 months", "24 months"];
  const N = 80;

  function makeData() {
    const r = HZ.rng(26);
    const pick = (ps) => {
      let u = r(), k = 0;
      while (k < ps.length - 1 && u > ps[k]) u -= ps[k++];
      return k;
    };
    const gamma4 = (mean) => (-Math.log(1 - r()) - Math.log(1 - r()) - Math.log(1 - r()) - Math.log(1 - r())) * (mean / 4);
    const pts = [];
    for (let i = 0; i < N; i++) {
      const p = pick([0.25, 0.3, 0.28, 0.17]);
      const gb = Math.min(70, Math.round(gamma4(DATA[p]) * 10) / 10);
      pts.push({ p, gb, noise: r.normal(), key: r(), key2: r() });
    }
    // contracts in fixed shares (Prepaid is always month-to-month), then the bill
    const post = pts.filter((d) => d.p > 0).sort((a, b) => a.key2 - b.key2);
    pts.forEach((d) => (d.c = 0));
    post.forEach((d, k) => (d.c = k < 0.45 * post.length ? 0 : k < 0.78 * post.length ? 1 : 2));
    pts.forEach((d) => (d.bill = Math.max(4, BASE[d.p] + (d.p === 3 ? 0.1 : 0.55) * d.gb + 2.7 - [0, 2, 4][d.c] + 3 * d.noise)));
    // churn: a fixed share per contract, so the sample tells the same story as the real file
    [0.24, 0.1, 0.07].forEach((rate, c) => {
      const g = pts.filter((d) => d.c === c).sort((a, b) => a.key - b.key);
      g.forEach((d, k) => (d.churn = k < Math.round(rate * g.length) ? 1 : 0));
    });
    return pts;
  }

  const QUESTIONS = [
    { q: "How is the monthly bill distributed?", chart: "Histogram", mode: "hist", code: 'sns.histplot(df, x="monthly_bill")' },
    { q: "Does the bill differ by plan?", chart: "Box plot", mode: "box", code: 'sns.boxplot(df, x="plan", y="monthly_bill")' },
    { q: "Is churn higher on month-to-month?", chart: "Bar chart", mode: "bar", code: 'sns.barplot(df, x="contract", y="churned", errorbar=None)' },
    { q: "Does data usage drive the bill?", chart: "Scatter plot", mode: "scatter", code: 'sns.scatterplot(df, x="data_gb", y="monthly_bill", hue="plan")' },
  ];

  const quantile = (s, q) => {
    const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  };

  HZ.register("chart-chooser", {
    kicker: "Session 2",
    title: "The question picks the chart",
    mount(body) {
      body.classList.add("hz-chart-chooser");
      const pts = makeData();
      const rates = CONTRACTS.map((_, c) => {
        const g = pts.filter((d) => d.c === c);
        return { n: g.length, rate: g.filter((d) => d.churn).length / g.length };
      });
      let mode = "hist";
      let runId = 0;
      const code = (s) => el("code", { text: s });

      body.append(el("p", { class: "hz-x__lede" }, [
        "Eighty customers, one dot each (a made-up sample that behaves like Cordillera's). Pick a question: the same dots rearrange into the chart that answers it.",
      ]));

      const qBtns = QUESTIONS.map((Q, k) =>
        el("button", { type: "button", class: "hz-chart-chooser-q", onclick: () => go(Q.mode) }, [el("span", { class: "hz-chart-chooser-qn", text: "Q" + (k + 1) }), Q.q])
      );
      const qRow = el("div", { class: "hz-chart-chooser-qs", role: "group", "aria-label": "Business questions" }, qBtns);

      const fig = svg("svg", { class: "hz-chart-chooser-fig", role: "img" });
      const gGrid = svg("g");
      const gHist = svg("g", { class: "hz-chart-chooser-layer" });
      const gBox = svg("g", { class: "hz-chart-chooser-layer" });
      const gBar = svg("g", { class: "hz-chart-chooser-layer" });
      const gDots = svg("g");
      const gAxes = svg("g");
      const title = svg("text", { class: "hz-chart-chooser-title", x: 0, y: 14 });
      fig.append(gGrid, gHist, gBox, gBar, gDots, gAxes, title);
      const dots = pts.map((d) => svg("circle", { class: "hz-chart-chooser-dot", r: 4 }));
      gDots.append(...dots);

      const legend = el("div", { class: "hz-legend hz-chart-chooser-legend" });
      const chartName = el("p", { class: "hz-chart-chooser-name" });
      const codeLine = el("pre", { class: "hz-chart-chooser-code" });
      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      body.append(qRow, el("div", { class: "hz-chart-chooser-stage" }, [chartName, fig, legend]), codeLine, note);

      // ---- Layout in pixels so text stays 12px at any width
      let L = null;
      function layout(width) {
        const W = Math.max(290, Math.min(620, width));
        const narrow = W < 440;
        const H = narrow ? 290 : 320;
        const M = { l: narrow ? 40 : 50, r: 10, t: 28, b: narrow ? 46 : 42 };
        return { W, H, M, narrow, x0: M.l, x1: W - M.r, y0: H - M.b, y1: M.t };
      }
      const sx = (d) => HZ.scale(d, [L.x0, L.x1]);
      const sy = (d) => HZ.scale(d, [L.y0, L.y1]);

      // Target position, radius, opacity and colour class of every dot, per mode
      function targets(m) {
        const out = [];
        if (m === "hist") {
          const bw = 5, nb = 14;
          const xs = sx([0, nb * bw]);
          const counts = new Array(nb).fill(0);
          const stack = pts.map((d) => {
            const b = Math.min(nb - 1, Math.floor(d.bill / bw));
            return { b, k: counts[b]++ };
          });
          const maxC = Math.max(...counts);
          const ys = sy([0, Math.ceil((maxC + 1) / 4) * 4]);
          const step = Math.abs(ys(1) - ys(0));
          const r = Math.max(2.2, Math.min((xs(bw) - xs(0)) / 2 - 1.2, step / 2 - 0.4));
          pts.forEach((d, i) => out.push({ x: xs(stack[i].b * bw + bw / 2), y: ys(stack[i].k + 0.5), r, o: 1, cls: "is-one" }));
          return { dots: out, xs, ys, counts, bw, maxY: Math.ceil((maxC + 1) / 4) * 4 };
        }
        if (m === "box" || m === "scatter") {
          const ys = sy([0, 70]);
          if (m === "box") {
            const band = (L.x1 - L.x0) / 4;
            const r2 = HZ.rng(7);
            pts.forEach((d) => out.push({ x: L.x0 + band * (d.p + 0.5) + (r2() - 0.5) * band * 0.34, y: ys(d.bill), r: 3.2, o: 0.55, cls: "is-p" + d.p }));
            return { dots: out, ys, band };
          }
          const xs = sx([0, 70]);
          pts.forEach((d) => out.push({ x: xs(Math.min(70, d.gb)), y: ys(d.bill), r: 4, o: 0.85, cls: "is-p" + d.p }));
          return { dots: out, xs, ys };
        }
        // bar: dots sink into the base of their contract's bar and vanish
        const band = (L.x1 - L.x0) / 3;
        const ys = sy([0, 0.4]);
        pts.forEach((d, i) => out.push({ x: L.x0 + band * (d.c + 0.5) + ((i % 9) - 4) * 3, y: ys(0) - 3, r: 0.1, o: 0, cls: d.churn ? "is-churn" : "is-stay" }));
        return { dots: out, ys, band };
      }

      // ---- Static decorations per mode
      function tickText(x, y, t, anchor, cls) {
        return svg("text", { x, y, "text-anchor": anchor || "middle", class: cls || null, text: t });
      }
      function drawDecor(m, T) {
        gGrid.replaceChildren();
        gAxes.replaceChildren();
        gHist.replaceChildren();
        gBox.replaceChildren();
        gBar.replaceChildren();
        const yTicks = (ys, vals, fmt) => vals.forEach((v) => {
          gGrid.append(svg("line", { class: "hz-gridline", x1: L.x0, x2: L.x1, y1: ys(v), y2: ys(v) }));
          gAxes.append(tickText(L.x0 - 6, ys(v) + 4, fmt(v), "end"));
        });
        gAxes.append(svg("line", { class: "hz-axis", x1: L.x0, x2: L.x1, y1: L.y0, y2: L.y0 }));
        const yLabel = (t) => title.textContent = t;
        const xLabel = (t) => gAxes.append(tickText((L.x0 + L.x1) / 2, L.H - 6, t, "middle", "hz-chart-chooser-axlabel"));
        if (m === "hist") {
          const step = T.maxY <= 12 ? 4 : 5;
          const vals = [];
          for (let v = 0; v <= T.maxY; v += step) vals.push(v);
          yTicks(T.ys, vals, (v) => String(v));
          [0, 10, 20, 30, 40, 50, 60, 70].forEach((v) => gAxes.append(tickText(T.xs(v), L.y0 + 16, String(v))));
          T.counts.forEach((cnt, b) => {
            if (!cnt) return;
            gHist.append(svg("rect", { class: "hz-chart-chooser-hbar", x: T.xs(b * T.bw) + 0.5, width: T.xs(T.bw) - T.xs(0) - 1, y: T.ys(cnt), height: T.ys(0) - T.ys(cnt) }));
          });
          yLabel("customers (count)");
          xLabel("monthly_bill (USD)");
        } else if (m === "box" || m === "scatter") {
          yTicks(T.ys, [0, 10, 20, 30, 40, 50, 60, 70], (v) => String(v));
          yLabel("monthly_bill (USD)");
          if (m === "box") {
            PLANS.forEach((p, k) => {
              const cx = L.x0 + T.band * (k + 0.5);
              gAxes.append(tickText(cx, L.y0 + 16, p));
              const s = pts.filter((d) => d.p === k).map((d) => d.bill).sort((a, b) => a - b);
              const q1 = quantile(s, 0.25), q2 = quantile(s, 0.5), q3 = quantile(s, 0.75), iqr = q3 - q1;
              const lo = s.find((v) => v >= q1 - 1.5 * iqr), hi = [...s].reverse().find((v) => v <= q3 + 1.5 * iqr);
              const w = Math.min(46, T.band * 0.5);
              gBox.append(
                svg("line", { class: "hz-chart-chooser-whisk is-p" + k, x1: cx, x2: cx, y1: T.ys(lo), y2: T.ys(q1) }),
                svg("line", { class: "hz-chart-chooser-whisk is-p" + k, x1: cx, x2: cx, y1: T.ys(q3), y2: T.ys(hi) }),
                svg("rect", { class: "hz-chart-chooser-box is-p" + k, x: cx - w / 2, width: w, y: T.ys(q3), height: T.ys(q1) - T.ys(q3), rx: 3 }),
                svg("line", { class: "hz-chart-chooser-med", x1: cx - w / 2, x2: cx + w / 2, y1: T.ys(q2), y2: T.ys(q2) })
              );
            });
            xLabel("plan");
          } else {
            [0, 10, 20, 30, 40, 50, 60, 70].forEach((v) => gAxes.append(tickText(T.xs(v), L.y0 + 16, String(v))));
            xLabel("data_gb (GB last month)");
          }
        } else {
          yTicks(T.ys, [0, 0.1, 0.2, 0.3, 0.4], (v) => Math.round(v * 100) + "%");
          CONTRACTS.forEach((c, k) => {
            const cx = L.x0 + T.band * (k + 0.5);
            gAxes.append(tickText(cx, L.y0 + 16, L.narrow && k === 0 ? "Month-to-m." : c));
            const w = Math.min(90, T.band * 0.56);
            const bar = svg("rect", { class: "hz-chart-chooser-bar" + (k === 0 ? " is-hi" : ""), x: cx - w / 2, width: w, y: T.ys(0), height: 0, "data-h": T.ys(0) - T.ys(rates[k].rate) });
            const lab = svg("text", { class: "hz-chart-chooser-barlab", x: cx, y: T.ys(rates[k].rate) - 7, "text-anchor": "middle", text: Math.round(rates[k].rate * 100) + "%" });
            gBar.append(bar, lab);
          });
          yLabel("churn rate (mean of churned)");
          xLabel("contract");
        }
      }

      function setBars(t) {
        gBar.querySelectorAll("rect").forEach((b) => {
          const h = +b.dataset.h * t;
          b.setAttribute("height", h);
          b.setAttribute("y", L.y0 - h);
        });
      }

      function setLayers(m) {
        gHist.style.opacity = m === "hist" ? 1 : 0;
        gBox.style.opacity = m === "box" ? 1 : 0;
        gBar.style.opacity = m === "bar" ? 1 : 0;
      }

      let cur = null; // current dot states
      function paintDots(states) {
        states.forEach((s, i) => {
          dots[i].setAttribute("cx", s.x.toFixed(1));
          dots[i].setAttribute("cy", s.y.toFixed(1));
          dots[i].setAttribute("r", Math.max(0, s.r).toFixed(2));
          dots[i].style.opacity = s.o;
        });
      }

      function caption(m) {
        const Q = QUESTIONS.find((q) => q.mode === m);
        chartName.replaceChildren(el("span", { text: Q.q + " → " }), el("b", { text: Q.chart }));
        codeLine.textContent = Q.code;
        const pct = (v) => Math.round(v * 100) + "%";
        let text;
        if (m === "hist") text = ["One numeric column, so the question is about its ", el("em", { text: "shape" }), ": the histogram cuts bills into 5-USD ranges and counts customers in each. Several humps hint at groups, here the plans, each with its own price level."];
        else if (m === "box") text = ["A number compared across categories: one box per plan. The line is the median, the box holds the middle half of the customers, the whiskers the rest. The boxes barely overlap: the plan sets most of the bill."];
        else if (m === "bar") text = ["A rate per category. ", code("churned"), " is 0/1, so its mean in a group is the share who left. In this sample: ", el("b", { text: pct(rates[0].rate) }), " on month-to-month vs ", pct(rates[1].rate), " and ", pct(rates[2].rate), " on contracts. Bars start at zero, so their heights compare honestly."];
        else text = ["Two numbers per customer: one dot each, data on x, bill on y. The cloud rises: more data, higher bill. Colour by plan and each plan forms its own band, flatter for Unlimited, whose data costs almost nothing extra."];
        note.replaceChildren(...text);
        legend.replaceChildren(
          ...(m === "hist"
            ? [el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "one dot = one customer"])]
            : m === "bar"
              ? [el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "bar height = share of the group that churned"])]
              : PLANS.map((p, k) => el("span", {}, [el("i", { class: "hz-chart-chooser-key is-p" + k }), p])))
        );
        fig.setAttribute("aria-label", Q.chart + " answering: " + Q.q);
        qBtns.forEach((b, k) => b.setAttribute("aria-pressed", String(QUESTIONS[k].mode === m)));
      }

      function renderStatic() {
        const T = targets(mode);
        fig.setAttribute("viewBox", `0 0 ${L.W} ${L.H}`);
        fig.setAttribute("height", L.H);
        drawDecor(mode, T);
        setLayers(mode);
        setBars(1);
        T.dots.forEach((s, i) => dots[i].setAttribute("class", "hz-chart-chooser-dot " + s.cls));
        paintDots(T.dots);
        cur = T.dots;
        caption(mode);
      }

      async function go(m) {
        if (!L) return;
        const id = ++runId;
        const from = cur.map((s) => ({ ...s }));
        const prev = mode;
        mode = m;
        caption(m);
        const T = targets(m);
        // fade the old decorations, then rebuild for the new chart
        gAxes.style.opacity = 0;
        gGrid.style.opacity = 0;
        setLayers(null);
        T.dots.forEach((s, i) => dots[i].setAttribute("class", "hz-chart-chooser-dot " + s.cls));
        const total = 700 + N * 5;
        let rebuilt = false;
        await HZ.tween(body, total, (t) => {
          if (id !== runId) return;
          const ms = t * total;
          if (!rebuilt && ms > 260) {
            rebuilt = true;
            drawDecor(m, T);
            setBars(0);
            gAxes.style.opacity = 1;
            gGrid.style.opacity = 1;
            setLayers(m);
          }
          const now = from.map((a, i) => {
            const b = T.dots[i];
            const k = HZ.easeInOut(HZ.clamp((ms - i * 5) / 700, 0, 1));
            return { x: HZ.lerp(a.x, b.x, k), y: HZ.lerp(a.y, b.y, k), r: HZ.lerp(a.r, b.r, k), o: HZ.lerp(a.o, b.o, k) };
          });
          paintDots(now);
          if (m === "bar") setBars(HZ.easeInOut(HZ.clamp((ms - 350) / 600, 0, 1)));
        }, (t) => t);
        if (id !== runId || !body.isConnected) return;
        if (!rebuilt) drawDecor(m, T);
        gAxes.style.opacity = 1;
        gGrid.style.opacity = 1;
        setLayers(m);
        setBars(1);
        paintDots(T.dots);
        cur = T.dots;
      }

      let lastW = 0;
      function measure() {
        const w = Math.round(fig.getBoundingClientRect().width || body.clientWidth || 560);
        if (Math.abs(w - lastW) < 2) return;
        lastW = w;
        L = layout(w);
        runId++;
        renderStatic();
      }
      measure();
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          if (!body.isConnected) return ro.disconnect();
          measure();
        });
        ro.observe(fig);
      }
    },
    css: `
.md-typeset .hz-chart-chooser-qs { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.4rem; }
.md-typeset .hz-chart-chooser-q {
  display: flex; align-items: center; gap: 0.55rem; text-align: left; font: inherit; font-size: 0.7rem; padding: 0.5rem 0.7rem; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--hz-line); background: var(--md-default-bg-color); color: var(--md-default-fg-color);
  transition: border-color 150ms ease, background-color 150ms ease, transform 100ms ease;
}
.md-typeset .hz-chart-chooser-q:hover { border-color: var(--hz-a); }
.md-typeset .hz-chart-chooser-q:active { transform: scale(0.99); }
.md-typeset .hz-chart-chooser-q:focus-visible { outline: 2px solid var(--md-primary-fg-color); outline-offset: 2px; }
.md-typeset .hz-chart-chooser-q[aria-pressed="true"] { border-color: var(--hz-a); background: var(--hz-a-soft); }
.md-typeset .hz-chart-chooser-qn { flex: none; font-family: var(--md-code-font); font-size: 0.9em; color: var(--hz-a); font-weight: 700; }
.md-typeset .hz-chart-chooser-stage { display: flex; flex-direction: column; gap: 0.3rem; max-width: 620px; }
.md-typeset .hz-chart-chooser-name { font-size: 0.74rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-chart-chooser-name b { color: var(--hz-a); }
.md-typeset .hz-x svg.hz-chart-chooser-fig { overflow: visible; }
.md-typeset .hz-x svg.hz-chart-chooser-fig text { font-size: 12px; }
.md-typeset .hz-x svg .hz-chart-chooser-title { font-size: 12px; fill: var(--md-default-fg-color--light); }
.md-typeset .hz-x svg .hz-chart-chooser-axlabel { fill: var(--md-default-fg-color--light); }
.md-typeset .hz-chart-chooser-fig > g { transition: opacity 260ms ease; }
.md-typeset .hz-chart-chooser-layer { transition: opacity 300ms ease; }
.md-typeset .hz-chart-chooser-dot { stroke: var(--hz-card); stroke-width: 0.8; transition: fill 400ms ease; fill: var(--hz-a); }
.md-typeset .hz-chart-chooser-dot.is-p0, .md-typeset .hz-chart-chooser-key.is-p0 { fill: var(--hz-muted); background: var(--hz-muted); }
.md-typeset .hz-chart-chooser-dot.is-p1, .md-typeset .hz-chart-chooser-key.is-p1 { fill: var(--hz-b); background: var(--hz-b); }
.md-typeset .hz-chart-chooser-dot.is-p2, .md-typeset .hz-chart-chooser-key.is-p2 { fill: var(--hz-a); background: var(--hz-a); }
.md-typeset .hz-chart-chooser-dot.is-p3, .md-typeset .hz-chart-chooser-key.is-p3 { fill: var(--hz-good); background: var(--hz-good); }
.md-typeset .hz-chart-chooser-dot.is-churn { fill: var(--hz-a); }
.md-typeset .hz-chart-chooser-dot.is-stay { fill: var(--hz-muted); }
.md-typeset .hz-chart-chooser-hbar { fill: var(--hz-a-soft); stroke: var(--hz-a); stroke-opacity: 0.35; }
.md-typeset .hz-chart-chooser-box { fill-opacity: 0.16; stroke-width: 1.6; }
.md-typeset .hz-chart-chooser-box.is-p0 { fill: var(--hz-muted); stroke: var(--hz-muted); }
.md-typeset .hz-chart-chooser-box.is-p1 { fill: var(--hz-b); stroke: var(--hz-b); }
.md-typeset .hz-chart-chooser-box.is-p2 { fill: var(--hz-a); stroke: var(--hz-a); }
.md-typeset .hz-chart-chooser-box.is-p3 { fill: var(--hz-good); stroke: var(--hz-good); }
.md-typeset .hz-chart-chooser-whisk { stroke-width: 1.5; }
.md-typeset .hz-chart-chooser-whisk.is-p0 { stroke: var(--hz-muted); }
.md-typeset .hz-chart-chooser-whisk.is-p1 { stroke: var(--hz-b); }
.md-typeset .hz-chart-chooser-whisk.is-p2 { stroke: var(--hz-a); }
.md-typeset .hz-chart-chooser-whisk.is-p3 { stroke: var(--hz-good); }
.md-typeset .hz-chart-chooser-med { stroke: var(--hz-ink); stroke-width: 2.5; }
.md-typeset .hz-chart-chooser-bar { fill: var(--hz-muted); fill-opacity: 0.55; }
.md-typeset .hz-chart-chooser-bar.is-hi { fill: var(--hz-a); fill-opacity: 0.85; }
.md-typeset .hz-x svg .hz-chart-chooser-barlab { font-size: 13px; font-weight: 700; fill: var(--hz-ink); }
.md-typeset .hz-chart-chooser-key { display: inline-block; width: 0.75em; height: 0.75em; border-radius: 50%; margin-right: 0.35em; }
.md-typeset .hz-chart-chooser-code {
  margin: 0; padding: 0.5em 0.8em; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.66rem; line-height: 1.5;
  background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color); white-space: pre-wrap; overflow-wrap: anywhere;
}
.md-typeset .hz-chart-chooser .hz-x__note { min-height: 4.8em; }
`,
  });
})();
