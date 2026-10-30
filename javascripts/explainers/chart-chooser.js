/*
 * chart-chooser: the question decides the chart. The same 90 bookings (a
 * made-up sample built like Altamar's file, one dot each) rearrange into a
 * histogram of rates, a box plot of rate by room type, a bar chart of
 * cancellation rates by channel, or a line chart of the average rate by
 * month for each hotel, with a caption saying why that chart fits. Bars and
 * lines show the numbers of the full clean file.
 */
(function () {
  const { el, svg } = HZ;

  const HOTELS = ["Santiago", "Viña del Mar", "Puerto Varas"];
  const BASE = [95, 85, 110];
  const SEASON = [
    [0.8, 0.75, 1.0, 1.0, 1.0, 0.95, 0.95, 1.0, 1.1, 1.12, 1.1, 0.95],
    [1.8, 1.7, 1.2, 0.9, 0.8, 0.75, 0.8, 0.75, 0.85, 0.9, 1.0, 1.3],
    [1.5, 1.45, 1.05, 0.85, 0.75, 0.75, 1.35, 0.95, 0.85, 0.9, 1.0, 1.2],
  ];
  const ROOMS = ["Standard", "Superior", "Suite"];
  const ROOM_MULT = [1.0, 1.3, 1.9];
  // channels sorted by cancellation rate; rates from altamar_bookings_clean.csv
  const CHANNELS = ["Corporate", "Direct", "Travel agent", "Online travel agency"];
  const CH_LABEL = [["Corporate"], ["Direct"], ["Travel", "agent"], ["Online", "travel agency"]];
  const CH_LABEL_NARROW = [["Corporate"], ["Direct"], ["Travel", "agent"], ["OTA"]];
  const CH_MULT = [0.88, 1.0, 0.85, 1.05];
  const CH_SHARE = [0.16, 0.28, 0.14, 0.42];
  const CANCEL = [0.156, 0.294, 0.355, 0.422];
  // average adr by arrival month, full clean file (pivot_table of the notebook)
  const MONTHLY = [
    [81.1, 76.3, 96.8, 100.5, 100.6, 93.0, 96.2, 99.9, 105.9, 113.9, 106.4, 95.8],
    [192.8, 180.8, 128.5, 95.2, 87.0, 84.6, 88.6, 85.1, 91.3, 96.9, 106.7, 138.6],
    [198.3, 195.9, 142.7, 113.4, 99.2, 103.3, 175.5, 122.8, 116.6, 116.3, 139.3, 153.7],
  ];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const N = 90;
  const YMAX = 400;

  function makeData() {
    const r = HZ.rng(26);
    const pick = (ps) => {
      const tot = ps.reduce((a, b) => a + b, 0);
      let u = r() * tot, k = 0;
      while (k < ps.length - 1 && u > ps[k]) u -= ps[k++];
      return k;
    };
    const pts = [];
    for (let i = 0; i < N; i++) {
      const h = pick([0.4, 0.35, 0.25]);
      const m = pick(SEASON[h].map((s) => s * s));
      const room = pick([0.6, 0.3, 0.1]);
      const c = pick(CH_SHARE);
      const adr = BASE[h] * SEASON[h][m] * ROOM_MULT[room] * CH_MULT[c] * Math.exp(0.1 * r.normal());
      pts.push({ h, m, room, c, adr, key: r(), jit: r() - 0.5 });
    }
    // cancellations: the file's share per channel, so the sample tells the same story
    CANCEL.forEach((rate, c) => {
      const g = pts.filter((d) => d.c === c).sort((a, b) => a.key - b.key);
      g.forEach((d, k) => (d.canceled = k < Math.round(rate * g.length) ? 1 : 0));
    });
    return pts;
  }

  const QUESTIONS = [
    { q: "How are our nightly rates spread out?", chart: "Histogram", mode: "hist", code: 'sns.histplot(df, x="adr")' },
    { q: "Do rates differ by room type?", chart: "Box plot", mode: "box", code: 'sns.boxplot(df, x="room_type", y="adr")' },
    { q: "Which channel cancels most?", chart: "Bar chart", mode: "bar", code: 'sns.barplot(df, x="channel", y="canceled", errorbar=None)' },
    { q: "Does each hotel have its own seasons?", chart: "Line chart", mode: "line", code: 'sns.lineplot(df, x="arrival_month", y="adr", hue="hotel", errorbar=None)' },
  ];

  const quantile = (s, q) => {
    const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  };

  HZ.register("chart-chooser", {
    kicker: "Week 2",
    title: "The question picks the chart",
    mount(body) {
      body.classList.add("hz-chart-chooser");
      const pts = makeData();
      let mode = "hist";
      let runId = 0;
      const code = (s) => el("code", { text: s });

      body.append(el("p", { class: "hz-x__lede" }, [
        "Ninety bookings, one dot each (a made-up sample that behaves like Altamar's file). Pick a manager's question: the same dots rearrange into the chart that answers it.",
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
      const gLine = svg("g", { class: "hz-chart-chooser-layer" });
      const gAxes = svg("g");
      const title = svg("text", { class: "hz-chart-chooser-title", x: 0, y: 14 });
      fig.append(gGrid, gHist, gBox, gBar, gDots, gLine, gAxes, title);
      const dots = pts.map(() => svg("circle", { class: "hz-chart-chooser-dot", r: 4 }));
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
        const H = narrow ? 300 : 330;
        const M = { l: narrow ? 40 : 50, r: 10, t: 28, b: 58 };
        return { W, H, M, narrow, x0: M.l, x1: W - M.r, y0: H - M.b, y1: M.t };
      }
      const sx = (d) => HZ.scale(d, [L.x0, L.x1]);
      const sy = (d) => HZ.scale(d, [L.y0, L.y1]);

      // Target position, radius, opacity and colour class of every dot, per mode
      function targets(m) {
        const out = [];
        if (m === "hist") {
          const bw = 20, lo = 40, nb = 16;
          const xs = sx([lo, lo + nb * bw]);
          const counts = new Array(nb).fill(0);
          const stack = pts.map((d) => {
            const b = HZ.clamp(Math.floor((d.adr - lo) / bw), 0, nb - 1);
            return { b, k: counts[b]++ };
          });
          const maxC = Math.max(...counts);
          const maxY = Math.ceil((maxC + 1) / 5) * 5;
          const ys = sy([0, maxY]);
          const step = Math.abs(ys(1) - ys(0));
          const r = Math.max(2.2, Math.min((xs(lo + bw) - xs(lo)) / 2 - 1.2, step / 2 - 0.4));
          pts.forEach((d, i) => out.push({ x: xs(lo + stack[i].b * bw + bw / 2), y: ys(stack[i].k + 0.5), r, o: 1, cls: "is-one" }));
          return { dots: out, xs, ys, counts, bw, lo, maxY };
        }
        const ys = sy([0, YMAX]);
        const yv = (v) => ys(Math.min(YMAX - 4, v));
        if (m === "box") {
          const band = (L.x1 - L.x0) / 3;
          pts.forEach((d) => out.push({ x: L.x0 + band * (d.room + 0.5) + d.jit * band * 0.36, y: yv(d.adr), r: 3.2, o: 0.55, cls: "is-r" + d.room }));
          return { dots: out, ys, band };
        }
        if (m === "line") {
          const xs = sx([0.5, 12.5]);
          const bw = xs(2) - xs(1);
          pts.forEach((d) => out.push({ x: xs(d.m + 1) + d.jit * bw * 0.6, y: yv(d.adr), r: 3, o: 0.35, cls: "is-h" + d.h }));
          return { dots: out, xs, ys };
        }
        // bar: dots sink into the base of their channel's bar and vanish
        const band = (L.x1 - L.x0) / 4;
        const ysb = sy([0, 0.5]);
        pts.forEach((d, i) => out.push({ x: L.x0 + band * (d.c + 0.5) + ((i % 9) - 4) * 3, y: ysb(0) - 3, r: 0.1, o: 0, cls: d.canceled ? "is-cancel" : "is-stay" }));
        return { dots: out, ys: ysb, band };
      }

      // ---- Static decorations per mode
      function tickText(x, y, t, anchor, cls) {
        return svg("text", { x, y, "text-anchor": anchor || "middle", class: cls || null, text: t });
      }
      function multiLine(x, y, lines) {
        const t = svg("text", { x, y, "text-anchor": "middle" });
        lines.forEach((s, k) => t.append(svg("tspan", { x, dy: k ? 14 : 0, text: s })));
        return t;
      }
      function drawDecor(m, T) {
        [gGrid, gAxes, gHist, gBox, gBar, gLine].forEach((g) => g.replaceChildren());
        const yTicks = (ys, vals, fmt) => vals.forEach((v) => {
          gGrid.append(svg("line", { class: "hz-gridline", x1: L.x0, x2: L.x1, y1: ys(v), y2: ys(v) }));
          gAxes.append(tickText(L.x0 - 6, ys(v) + 4, fmt(v), "end"));
        });
        gAxes.append(svg("line", { class: "hz-axis", x1: L.x0, x2: L.x1, y1: L.y0, y2: L.y0 }));
        const yLabel = (t) => (title.textContent = t);
        const xLabel = (t) => gAxes.append(tickText((L.x0 + L.x1) / 2, L.H - 6, t, "middle", "hz-chart-chooser-axlabel"));
        const rateTicks = [0, 100, 200, 300, 400];
        if (m === "hist") {
          const vals = [];
          for (let v = 0; v <= T.maxY; v += 5) vals.push(v);
          yTicks(T.ys, vals, (v) => String(v));
          const xt = L.narrow ? [50, 150, 250, 350] : [50, 100, 150, 200, 250, 300, 350];
          xt.forEach((v) => gAxes.append(tickText(T.xs(v), L.y0 + 16, String(v))));
          T.counts.forEach((cnt, b) => {
            if (!cnt) return;
            const x = T.xs(T.lo + b * T.bw);
            gHist.append(svg("rect", { class: "hz-chart-chooser-hbar", x: x + 0.5, width: T.xs(T.lo + T.bw) - T.xs(T.lo) - 1, y: T.ys(cnt), height: T.ys(0) - T.ys(cnt) }));
          });
          yLabel("bookings (count)");
          xLabel("nightly rate, adr (USD)");
        } else if (m === "box") {
          yTicks(T.ys, rateTicks, String);
          yLabel("nightly rate, adr (USD)");
          ROOMS.forEach((p, k) => {
            const cx = L.x0 + T.band * (k + 0.5);
            gAxes.append(tickText(cx, L.y0 + 16, p));
            const s = pts.filter((d) => d.room === k).map((d) => d.adr).sort((a, b) => a - b);
            const q1 = quantile(s, 0.25), q2 = quantile(s, 0.5), q3 = quantile(s, 0.75), iqr = q3 - q1;
            const lo = s.find((v) => v >= q1 - 1.5 * iqr), hi = [...s].reverse().find((v) => v <= q3 + 1.5 * iqr);
            const w = Math.min(56, T.band * 0.5);
            const yv = (v) => T.ys(Math.min(YMAX - 4, v));
            gBox.append(
              svg("line", { class: "hz-chart-chooser-whisk is-r" + k, x1: cx, x2: cx, y1: yv(lo), y2: yv(q1) }),
              svg("line", { class: "hz-chart-chooser-whisk is-r" + k, x1: cx, x2: cx, y1: yv(q3), y2: yv(hi) }),
              svg("rect", { class: "hz-chart-chooser-box is-r" + k, x: cx - w / 2, width: w, y: yv(q3), height: yv(q1) - yv(q3), rx: 3 }),
              svg("line", { class: "hz-chart-chooser-med", x1: cx - w / 2, x2: cx + w / 2, y1: yv(q2), y2: yv(q2) })
            );
          });
          xLabel("room_type");
        } else if (m === "line") {
          yTicks(T.ys, rateTicks, String);
          yLabel("average nightly rate (USD)");
          MONTHS.forEach((mo, k) => gAxes.append(tickText(T.xs(k + 1), L.y0 + 16, L.narrow ? mo[0] : mo)));
          MONTHLY.forEach((vals, h) => {
            const d = vals.map((v, k) => (k ? "L" : "M") + T.xs(k + 1).toFixed(1) + " " + T.ys(v).toFixed(1)).join(" ");
            gLine.append(svg("path", { class: "hz-chart-chooser-line is-h" + h, d }));
          });
          MONTHLY.forEach((vals, h) =>
            vals.forEach((v, k) => gLine.append(svg("circle", { class: "hz-chart-chooser-ldot is-h" + h, cx: T.xs(k + 1), cy: T.ys(v), r: 3 })))
          );
          xLabel("arrival month");
        } else {
          yTicks(T.ys, [0, 0.1, 0.2, 0.3, 0.4, 0.5], (v) => Math.round(v * 100) + "%");
          const labels = L.narrow ? CH_LABEL_NARROW : CH_LABEL;
          CHANNELS.forEach((c, k) => {
            const cx = L.x0 + T.band * (k + 0.5);
            gAxes.append(multiLine(cx, L.y0 + 16, labels[k]));
            const w = Math.min(80, T.band * 0.56);
            const bar = svg("rect", { class: "hz-chart-chooser-bar" + (k === 3 ? " is-hi" : ""), x: cx - w / 2, width: w, y: T.ys(0), height: 0, "data-h": T.ys(0) - T.ys(CANCEL[k]) });
            const lab = svg("text", { class: "hz-chart-chooser-barlab", x: cx, y: T.ys(CANCEL[k]) - 7, "text-anchor": "middle", text: (CANCEL[k] * 100).toFixed(1) + "%" });
            gBar.append(bar, lab);
          });
          yLabel("cancellation rate (mean of canceled)");
        }
      }

      function setBars(t) {
        gBar.querySelectorAll("rect").forEach((b) => {
          const h = +b.dataset.h * t;
          b.setAttribute("height", h);
          b.setAttribute("y", L.y0 - h);
        });
      }
      // lines draw themselves from January to December, one hotel after another
      const lineK = (t, h) => HZ.clamp(t * 1.3 - h * 0.15, 0, 1);
      function setLines(t) {
        gLine.querySelectorAll("path").forEach((p, h) => {
          const len = p.getTotalLength ? p.getTotalLength() : 1000;
          p.style.strokeDasharray = len;
          p.style.strokeDashoffset = len * (1 - lineK(t, h));
        });
        gLine.querySelectorAll("circle").forEach((c, i) => {
          const h = Math.floor(i / 12), mo = i % 12;
          c.style.opacity = lineK(t, h) * 11 >= mo - 0.01 && lineK(t, h) > 0 ? 1 : 0;
        });
      }

      function setLayers(m) {
        gHist.style.opacity = m === "hist" ? 1 : 0;
        gBox.style.opacity = m === "box" ? 1 : 0;
        gBar.style.opacity = m === "bar" ? 1 : 0;
        gLine.style.opacity = m === "line" ? 1 : 0;
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

      const key = (cls, label) => el("span", {}, [el("i", { class: "hz-chart-chooser-key " + cls }), label]);
      function caption(m) {
        const Q = QUESTIONS.find((q) => q.mode === m);
        chartName.replaceChildren(el("span", { text: Q.q + " → " }), el("b", { text: Q.chart }));
        codeLine.textContent = Q.code;
        let text;
        if (m === "hist") text = [el("b", { text: "One number, how it spreads: " }), "the histogram cuts rates into 20-USD ranges and counts the bookings in each. Most nights sell between 80 and 160 USD, with a long tail to the right: suites and peak-season beach nights. That tail pulls the average above the typical booking."];
        else if (m === "box") text = [el("b", { text: "A number compared across categories: " }), "one box per room type. The line is the median, the box holds the middle half of the bookings, the whiskers the rest. In the full file the medians are about 98, 126 and 179 USD. The boxes overlap: the room matters, but hotel and season move the rate too."];
        else if (m === "bar") text = [el("b", { text: "A rate per category: " }), code("canceled"), " is 0/1, so its mean in a group is the share that cancelled. In the full file, ", el("b", { text: "42.2%" }), " of online travel agency bookings cancel, against 15.6% of corporate ones. Bars start at zero, so their heights compare honestly."];
        else text = [el("b", { text: "A number across time, per group: " }), "month on x, one line per hotel. Three hotels, three seasons. Viña del Mar and Puerto Varas peak in January and February (about 190 USD), Puerto Varas again in the July winter holidays. Santiago does the opposite: it dips in summer (76 USD in February) and peaks with October's conferences. No single straight line can draw all three."];
        note.replaceChildren(...text);
        legend.replaceChildren(
          ...(m === "hist"
            ? [key("is-one", "one dot = one booking")]
            : m === "bar"
              ? [key("is-one", "bar height = share of the channel's bookings that cancelled")]
              : m === "box"
                ? ROOMS.map((p, k) => key("is-r" + k, p))
                : [...HOTELS.map((p, k) => key("is-h" + k, p)), el("span", { text: "dots: bookings · lines: full-file averages" })])
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
        setLines(1);
        T.dots.forEach((s, i) => dots[i].setAttribute("class", "hz-chart-chooser-dot " + s.cls));
        paintDots(T.dots);
        cur = T.dots;
        caption(mode);
      }

      async function go(m) {
        if (!L) return;
        const id = ++runId;
        const from = cur.map((s) => ({ ...s }));
        mode = m;
        caption(m);
        const T = targets(m);
        // fade the old decorations, then rebuild for the new chart
        gAxes.style.opacity = 0;
        gGrid.style.opacity = 0;
        setLayers(null);
        T.dots.forEach((s, i) => dots[i].setAttribute("class", "hz-chart-chooser-dot " + s.cls));
        const total = 700 + N * 5 + (m === "line" ? 600 : 0);
        let rebuilt = false;
        await HZ.tween(body, total, (t) => {
          if (id !== runId) return;
          const ms = t * total;
          if (!rebuilt && ms > 260) {
            rebuilt = true;
            drawDecor(m, T);
            setBars(0);
            setLines(0);
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
          if (rebuilt && m === "bar") setBars(HZ.easeInOut(HZ.clamp((ms - 350) / 600, 0, 1)));
          if (rebuilt && m === "line") setLines(HZ.easeInOut(HZ.clamp((ms - 650) / 1000, 0, 1)));
        }, (t) => t);
        if (id !== runId || !body.isConnected) return;
        if (!rebuilt) drawDecor(m, T);
        gAxes.style.opacity = 1;
        gGrid.style.opacity = 1;
        setLayers(m);
        setBars(1);
        setLines(1);
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
.md-typeset .hz-chart-chooser-key { display: inline-block; width: 0.75em; height: 0.75em; border-radius: 50%; margin-right: 0.35em; background: var(--hz-a); }
.md-typeset .hz-chart-chooser-dot.is-r0, .md-typeset .hz-chart-chooser-key.is-r0 { fill: var(--hz-muted); background: var(--hz-muted); }
.md-typeset .hz-chart-chooser-dot.is-r1, .md-typeset .hz-chart-chooser-key.is-r1 { fill: var(--hz-b); background: var(--hz-b); }
.md-typeset .hz-chart-chooser-dot.is-r2, .md-typeset .hz-chart-chooser-key.is-r2 { fill: var(--hz-a); background: var(--hz-a); }
.md-typeset .hz-chart-chooser-dot.is-h0, .md-typeset .hz-chart-chooser-key.is-h0 { fill: var(--hz-b); background: var(--hz-b); }
.md-typeset .hz-chart-chooser-dot.is-h1, .md-typeset .hz-chart-chooser-key.is-h1 { fill: var(--hz-a); background: var(--hz-a); }
.md-typeset .hz-chart-chooser-dot.is-h2, .md-typeset .hz-chart-chooser-key.is-h2 { fill: var(--hz-good); background: var(--hz-good); }
.md-typeset .hz-chart-chooser-dot.is-cancel { fill: var(--hz-a); }
.md-typeset .hz-chart-chooser-dot.is-stay { fill: var(--hz-muted); }
.md-typeset .hz-chart-chooser-hbar { fill: var(--hz-a-soft); stroke: var(--hz-a); stroke-opacity: 0.35; }
.md-typeset .hz-chart-chooser-box { fill-opacity: 0.16; stroke-width: 1.6; }
.md-typeset .hz-chart-chooser-box.is-r0 { fill: var(--hz-muted); stroke: var(--hz-muted); }
.md-typeset .hz-chart-chooser-box.is-r1 { fill: var(--hz-b); stroke: var(--hz-b); }
.md-typeset .hz-chart-chooser-box.is-r2 { fill: var(--hz-a); stroke: var(--hz-a); }
.md-typeset .hz-chart-chooser-whisk { stroke-width: 1.5; }
.md-typeset .hz-chart-chooser-whisk.is-r0 { stroke: var(--hz-muted); }
.md-typeset .hz-chart-chooser-whisk.is-r1 { stroke: var(--hz-b); }
.md-typeset .hz-chart-chooser-whisk.is-r2 { stroke: var(--hz-a); }
.md-typeset .hz-chart-chooser-med { stroke: var(--hz-ink); stroke-width: 2.5; }
.md-typeset .hz-chart-chooser-bar { fill: var(--hz-muted); fill-opacity: 0.55; }
.md-typeset .hz-chart-chooser-bar.is-hi { fill: var(--hz-a); fill-opacity: 0.85; }
.md-typeset .hz-x svg .hz-chart-chooser-barlab { font-size: 13px; font-weight: 700; fill: var(--hz-ink); }
.md-typeset .hz-chart-chooser-line { fill: none; stroke-width: 2.6; stroke-linejoin: round; stroke-linecap: round; }
.md-typeset .hz-chart-chooser-line.is-h0 { stroke: var(--hz-b); }
.md-typeset .hz-chart-chooser-line.is-h1 { stroke: var(--hz-a); }
.md-typeset .hz-chart-chooser-line.is-h2 { stroke: var(--hz-good); }
.md-typeset .hz-chart-chooser-ldot { stroke: var(--hz-card); stroke-width: 1.2; transition: opacity 150ms ease; }
.md-typeset .hz-chart-chooser-ldot.is-h0 { fill: var(--hz-b); }
.md-typeset .hz-chart-chooser-ldot.is-h1 { fill: var(--hz-a); }
.md-typeset .hz-chart-chooser-ldot.is-h2 { fill: var(--hz-good); }
.md-typeset .hz-chart-chooser-code {
  margin: 0; padding: 0.5em 0.8em; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.66rem; line-height: 1.5;
  background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color); white-space: pre-wrap; overflow-wrap: anywhere;
}
.md-typeset .hz-chart-chooser .hz-x__note { min-height: 6em; }
`,
  });
})();
