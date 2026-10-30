/*
 * error-metrics: Week 3. Ten real test bookings, each with a residual bar
 * (actual rate − predicted rate, USD per night) from this week's linear
 * model. MAE, RMSE and R² update live. Turning one booking into a big miss
 * shows RMSE jumping much more than MAE, and two share bars show why:
 * squaring hands the big miss most of the total.
 */
(function () {
  const { el, svg } = HZ;

  // Ten test bookings from Session_3_Live (rounded): predicted rate and actual − predicted.
  const PRED = [63.7, 67.8, 82.2, 91.2, 105.0, 114.4, 123.8, 126.1, 129.6, 213.8];
  const ERR0 = [20.5, 23.5, 15.0, 12.6, -12.6, -34.0, -35.3, -7.7, -3.7, 30.0];
  const WHO = ["Santiago · Jun · Standard", "Santiago · Mar · Standard", "Viña · Apr · Standard", "Santiago · Nov · Standard",
               "Viña · Sep · Standard", "Viña · Sep · Standard", "Viña · Jun · Superior", "Viña · Jan · Standard",
               "Viña · Mar · Superior", "Viña · Feb · Superior"];
  const OUT = 6, OUT_ERR = 104; // booking 7 becomes a peak-season miss
  const Y0 = -60, Y1 = 120;
  const usd = (v) => "USD " + Math.abs(v).toFixed(1);

  function metrics(err) {
    const n = err.length;
    const actual = PRED.map((p, i) => p + err[i]);
    const mean = actual.reduce((a, b) => a + b, 0) / n;
    const sse = err.reduce((a, e) => a + e * e, 0);
    const sst = actual.reduce((a, y) => a + (y - mean) ** 2, 0);
    return { mae: err.reduce((a, e) => a + Math.abs(e), 0) / n, rmse: Math.sqrt(sse / n), r2: 1 - sse / sst };
  }
  const BASE = metrics(ERR0);

  function layout(narrow) {
    return narrow
      ? { W: 340, H: 270, narrow, M: { l: 64, r: 8, t: 16, b: 34 } }
      : { W: 520, H: 290, narrow, M: { l: 66, r: 14, t: 16, b: 36 } };
  }

  const css = `
.md-typeset .hz-x svg.hz-em-plot text { font-size: 13px; }
.md-typeset .hz-em-zero { stroke: var(--hz-ink); stroke-width: 1.5; }
.md-typeset .hz-x svg text.hz-em-zerolab { fill: var(--hz-ink); font-size: 12px; }
.md-typeset .hz-em-bar { transition: fill 200ms ease; }
.md-typeset .hz-em-bar.is-pos { fill: var(--hz-a); fill-opacity: 0.55; }
.md-typeset .hz-em-bar.is-neg { fill: var(--hz-b); fill-opacity: 0.55; }
.md-typeset .hz-em-pt { cursor: grab; touch-action: none; }
.md-typeset .hz-em-pt:focus { outline: none; }
.md-typeset .hz-em-dot { fill: var(--hz-ink); stroke: var(--hz-card); stroke-width: 2; transition: r 150ms ease; }
.md-typeset .hz-em-pt:hover .hz-em-dot, .md-typeset .hz-em-pt.is-drag .hz-em-dot, .md-typeset .hz-em-pt:focus-visible .hz-em-dot { r: 8; }
.md-typeset .hz-em-pt:focus-visible .hz-em-dot { stroke: var(--md-primary-fg-color); stroke-width: 3; }
.md-typeset .hz-em-hit { fill: transparent; }
.md-typeset .hz-x svg text.hz-em-val { font-size: 12px; fill: var(--md-default-fg-color); }
.md-typeset .hz-em-layout { display: flex; flex-direction: column; gap: 1rem; }
.md-typeset .hz-em-layout svg.hz-em-plot { width: 100%; max-width: 40rem; display: block; margin: 0 auto; }
.md-typeset .hz-em-side { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 0.8rem 1.4rem; align-items: start; }
.md-typeset .hz-em-shares { display: flex; flex-direction: column; gap: 0.7rem; }
@media (max-width: 40em) { .md-typeset .hz-em-side { grid-template-columns: minmax(0, 1fr); } }
.md-typeset .hz-em-big { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.4rem; }
.md-typeset .hz-em-m { border: 1px solid var(--hz-line); border-radius: 10px; padding: 0.45rem 0.55rem; background: var(--md-default-bg-color); }
.md-typeset .hz-em-m span { display: block; font-size: 0.62rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-em-m strong { display: block; font-family: var(--md-code-font); font-size: 1.05rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.md-typeset .hz-em-m em { display: block; font-style: normal; font-family: var(--md-code-font); font-size: 0.6rem; color: var(--hz-muted); min-height: 1.3em; }
.md-typeset .hz-em-m.is-up em { color: var(--hz-bad); font-weight: 600; }
.md-typeset .hz-em-share { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.64rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-em-stack { display: flex; height: 0.95rem; border-radius: 4px; overflow: hidden; background: var(--hz-grid); }
.md-typeset .hz-em-seg { height: 100%; background: var(--hz-muted); opacity: 0.45; border-right: 1px solid var(--hz-card); transition: flex-basis 450ms cubic-bezier(.65,0,.35,1), background-color 200ms ease, opacity 200ms ease; flex: 0 0 0; }
.md-typeset .hz-em-seg.is-hot { background: var(--hz-bad); opacity: 0.9; }
.md-typeset .hz-em-share b { font-family: var(--md-code-font); color: var(--md-default-fg-color); font-weight: 600; }
.md-typeset .hz-em .hz-x__note { min-height: 5.6em; }
`;

  HZ.register("error-metrics", {
    kicker: "Week 3",
    title: "How wrong is the rate? MAE, RMSE and R²",
    css,
    mount(body) {
      body.classList.add("hz-em", "tex2jax_ignore"); // keep MathJax away from the dollar amounts
      let err = ERR0.slice(), focus = OUT, runId = 0, dragging = -1;
      let L = layout(false);

      body.append(el("p", { class: "hz-x__lede", html:
        "Ten bookings from the sealed test set. Each bar is a <strong>residual</strong>: the rate the guest actually paid minus the rate the model predicted, in USD per night (above the line, the model priced too low). <strong>Drag any dot</strong> up or down, or add one big miss." }));

      const plot = svg("svg", { class: "hz-em-plot", role: "group", "aria-label": "Residuals of ten test bookings" });
      const mk = (name, sub) => {
        const v = el("strong"), d = el("em");
        return { node: el("div", { class: "hz-em-m" }, [el("span", { text: name }), v, d]), v, d };
      };
      const mMAE = mk("MAE, USD"), mRMSE = mk("RMSE, USD"), mR2 = mk("R²");
      const shareAbs = el("div", { class: "hz-em-stack" }), shareSq = el("div", { class: "hz-em-stack" });
      const segsAbs = PRED.map(() => el("i", { class: "hz-em-seg" }));
      const segsSq = PRED.map(() => el("i", { class: "hz-em-seg" }));
      shareAbs.append(...segsAbs);
      shareSq.append(...segsSq);
      const absTxt = el("span"), sqTxt = el("span");
      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      const outBtn = HZ.button("Make booking 7 a big miss", () => animateTo(OUT, OUT_ERR), "primary");
      const resetBtn = HZ.button("Reset", () => reset());

      const legend = el("div", { class: "hz-legend" }, [
        el("span", {}, [el("i", { style: "background: var(--hz-ink); border-radius: 1px; height: 2px; vertical-align: 0.2em" }), "0 = rate predicted exactly"]),
        el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "paid more than predicted"]),
        el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "paid less than predicted"]),
      ]);
      body.append(
        el("div", { class: "hz-em-layout" }, [
          el("div", {}, [plot, legend]),
          el("div", { class: "hz-em-side" }, [
            el("div", { class: "hz-em-big" }, [mMAE.node, mRMSE.node, mR2.node]),
            el("div", { class: "hz-em-shares" }, [
              el("div", { class: "hz-em-share" }, [absTxt, shareAbs]),
              el("div", { class: "hz-em-share" }, [sqTxt, shareSq]),
            ]),
          ]),
        ]),
        el("div", { class: "hz-x__controls" }, [outBtn, resetBtn]),
        note
      );

      let xs, ys, bars = [], pts = [], vals = [];
      function build() {
        const { W, H, M } = L;
        plot.replaceChildren();
        plot.setAttribute("viewBox", `0 0 ${W} ${H}`);
        xs = (i) => M.l + ((i + 0.5) * (W - M.l - M.r)) / PRED.length;
        ys = HZ.scale([Y0, Y1], [H - M.b, M.t]);
        for (let v = Y0; v <= Y1; v += 30) {
          plot.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
          plot.append(svg("text", { x: M.l - 8, y: ys(v) + 4, "text-anchor": "end", text: (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) }));
        }
        plot.append(svg("text", { x: 12, y: (M.t + H - M.b) / 2, transform: `rotate(-90 12 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "actual − predicted (USD)" }));
        PRED.forEach((_, i) => plot.append(svg("text", { x: xs(i), y: H - M.b + 18, "text-anchor": "middle", text: (L.narrow ? "" : "B") + (i + 1) })));
        plot.append(svg("text", { x: (M.l + W - M.r) / 2, y: H - 2, "text-anchor": "middle", text: "test booking" }));
        plot.append(svg("line", { class: "hz-em-zero", x1: M.l, x2: W - M.r, y1: ys(0), y2: ys(0) }));
        const bw = Math.min(26, ((W - M.l - M.r) / PRED.length) * 0.5);
        bars = PRED.map((_, i) => {
          const b = svg("rect", { x: xs(i) - bw / 2, width: bw, rx: 2, class: "hz-em-bar" });
          plot.append(b);
          return b;
        });
        vals = PRED.map(() => {
          const t = svg("text", { class: "hz-em-val", "text-anchor": "middle" });
          plot.append(t);
          return t;
        });
        pts = PRED.map((p, i) => {
          const g = svg("g", { class: "hz-em-pt", tabindex: 0, role: "slider", "aria-label": `Booking ${i + 1}, ${WHO[i]}: predicted USD ${p.toFixed(1)} per night`, "aria-valuemin": Y0, "aria-valuemax": Y1 }, [
            svg("circle", { r: 16, class: "hz-em-hit" }),
            svg("circle", { r: 6, class: "hz-em-dot" }),
          ]);
          g.addEventListener("pointerdown", (e) => {
            dragging = i;
            focus = i;
            runId++;
            g.classList.add("is-drag");
            plot.setPointerCapture(e.pointerId);
            e.preventDefault();
          });
          g.addEventListener("keydown", (e) => {
            const d = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            focus = i;
            setErr(i, err[i] + d);
          });
          plot.append(g);
          return g;
        });
      }

      plot.addEventListener("pointermove", (e) => {
        if (dragging < 0) return;
        const r = plot.getBoundingClientRect();
        setErr(dragging, ys.invert(((e.clientY - r.top) / r.height) * L.H));
      });
      const stop = () => {
        if (dragging >= 0) pts[dragging].classList.remove("is-drag");
        dragging = -1;
      };
      plot.addEventListener("pointerup", stop);
      plot.addEventListener("pointercancel", stop);

      function setErr(i, v) {
        err[i] = Math.round(HZ.clamp(v, Y0, Y1) * 10) / 10;
        draw();
      }

      function draw() {
        err.forEach((e, i) => {
          const y = ys(e), y0 = ys(0);
          bars[i].setAttribute("y", Math.min(y, y0));
          bars[i].setAttribute("height", Math.max(1, Math.abs(y - y0)));
          bars[i].setAttribute("class", "hz-em-bar " + (e >= 0 ? "is-pos" : "is-neg"));
          pts[i].setAttribute("transform", `translate(${xs(i)} ${y})`);
          pts[i].setAttribute("aria-valuenow", e.toFixed(1));
          pts[i].setAttribute("aria-valuetext", `paid ${usd(e)} ${e >= 0 ? "more" : "less"} than predicted`);
          const show = Math.abs(e) >= 45 || i === focus;
          vals[i].setAttribute("opacity", show ? 1 : 0);
          vals[i].setAttribute("x", xs(i));
          vals[i].setAttribute("y", e >= 0 ? y - 12 : y + 22);
          vals[i].textContent = (e >= 0 ? "+" : "−") + Math.abs(e).toFixed(1);
        });
        const m = metrics(err);
        const ratio = (a, b) => (a / b > 1.05 ? "×" + (a / b).toFixed(1) : a / b < 0.95 ? "×" + (a / b).toFixed(2) : "");
        mMAE.v.textContent = m.mae.toFixed(1);
        mRMSE.v.textContent = m.rmse.toFixed(1);
        mR2.v.textContent = m.r2.toFixed(3);
        mMAE.d.textContent = ratio(m.mae, BASE.mae);
        mRMSE.d.textContent = ratio(m.rmse, BASE.rmse);
        mR2.d.textContent = Math.abs(m.r2 - BASE.r2) > 0.005 ? "was " + BASE.r2.toFixed(3) : "";
        mMAE.node.classList.toggle("is-up", m.mae / BASE.mae > 1.05);
        mRMSE.node.classList.toggle("is-up", m.rmse / BASE.rmse > 1.05);
        mR2.node.classList.toggle("is-up", BASE.r2 - m.r2 > 0.005);

        // Shares of the total: |error| (what MAE averages) vs error² (what RMSE averages)
        const abs = err.map(Math.abs), sq = err.map((e) => e * e);
        const sa = abs.reduce((a, b) => a + b, 0) || 1, ss = sq.reduce((a, b) => a + b, 0) || 1;
        err.forEach((_, i) => {
          segsAbs[i].style.flexBasis = (abs[i] / sa) * 100 + "%";
          segsSq[i].style.flexBasis = (sq[i] / ss) * 100 + "%";
          segsAbs[i].classList.toggle("is-hot", i === focus);
          segsSq[i].classList.toggle("is-hot", i === focus);
        });
        const c = "booking " + (focus + 1);
        absTxt.innerHTML = `Share of total |error| (MAE) from ${c}: <b>${Math.round((abs[focus] / sa) * 100)}%</b>`;
        sqTxt.innerHTML = `Share of total error² (RMSE) from ${c}: <b>${Math.round((sq[focus] / ss) * 100)}%</b>`;

        const big = err.reduce((b, e, i) => (Math.abs(e) > Math.abs(err[b]) ? i : b), 0);
        const avg = PRED.reduce((a, p, i) => a + p + err[i], 0) / PRED.length;
        if (Math.abs(err[big]) >= 60) {
          note.innerHTML = `Booking ${big + 1} is off by <strong>${usd(err[big])}</strong> per night, like the Puerto Varas suite in January that paid USD 383 when the model said 280. MAE went from ${usd(BASE.mae)} to ${usd(m.mae)}, but RMSE from ${usd(BASE.rmse)} to ${usd(m.rmse)}: squaring makes one big miss count like many small ones. Watch <strong>RMSE</strong> when big misses are what hurt (a suite sold far below its value in peak season). Report <strong>MAE</strong> to a manager: "the rate is typically off by ${usd(m.mae)} a night".`;
        } else {
          note.innerHTML = `<strong>MAE</strong> is the average miss: ${usd(m.mae)} per night, about ${Math.round((m.mae / avg) * 100)}% of these bookings' average rate (USD ${avg.toFixed(0)}). <strong>RMSE</strong> (${usd(m.rmse)}) is also in USD but weighs big misses more. <strong>R²</strong> is the share of the differences between rates that the model explains: 1 is perfect, 0 is no better than quoting the average rate to everyone.`;
        }
      }

      function animateTo(i, target) {
        const id = ++runId, from = err[i];
        focus = i;
        HZ.tween(body, 650, (k) => {
          if (id !== runId) return;
          err[i] = Math.round(HZ.lerp(from, target, k) * 10) / 10;
          draw();
        });
      }

      function reset() {
        const id = ++runId, from = err.slice();
        focus = OUT;
        HZ.tween(body, 500, (k) => {
          if (id !== runId) return;
          err = from.map((v, i) => Math.round(HZ.lerp(v, ERR0[i], k) * 10) / 10);
          draw();
        });
      }

      function measure() {
        // the plot shares the row with the side panel on wide screens, so measure the plot itself
        const w = plot.getBoundingClientRect().width || body.clientWidth || 600;
        const narrow = w < 460;
        if (pts.length && narrow === L.narrow) return;
        L = layout(narrow);
        build();
        draw();
      }
      measure();
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          if (!body.isConnected) return ro.disconnect();
          measure();
        });
        ro.observe(body);
      }
    },
  });
})();
