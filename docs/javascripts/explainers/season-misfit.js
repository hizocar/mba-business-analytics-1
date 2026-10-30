/*
 * season-misfit: Week 3. For one hotel at a time, the average rate the test
 * bookings actually paid in each arrival month (dots) against the average
 * rate the linear model predicted for them (line). The gaps are the misses.
 * With month as a number the model can only draw a slope; with month as
 * twelve categories it draws one season shape, shared by all three hotels,
 * so Santiago's quiet summer and Puerto Varas's July peak are still missed.
 * Numbers are the test-set averages printed in Session_3_Live (step 09).
 */
(function () {
  const { el, svg } = HZ;

  const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DATA = {
    Santiago: {
      actual: [82.6, 75.7, 95.6, 98.6, 97.7, 91.1, 89.5, 96.7, 101.7, 114.7, 103.7, 93.4],
      dummies: [156.2, 148.1, 97.1, 83.6, 83.8, 79.8, 99.6, 81.4, 85.3, 98.9, 94.9, 108.5],
      number: [125.5, 121.1, 109.6, 105.6, 105.9, 101.0, 92.5, 90.9, 85.0, 91.1, 81.1, 80.7],
    },
    "Viña del Mar": {
      actual: [189.1, 184.5, 131.0, 88.5, 81.2, 95.5, 89.3, 81.1, 89.9, 102.7, 105.1, 137.0],
      dummies: [172.0, 165.9, 125.4, 99.6, 94.5, 119.0, 130.6, 104.9, 111.9, 123.5, 122.4, 131.3],
      number: [153.3, 151.1, 149.7, 133.4, 128.3, 151.9, 135.9, 126.5, 124.1, 127.1, 120.3, 115.2],
    },
    "Puerto Varas": {
      actual: [201.1, 201.0, 138.0, 106.0, 96.0, 99.1, 176.9, 122.4, 119.5, 117.8, 145.3, 142.3],
      dummies: [195.0, 189.6, 139.9, 123.7, 123.7, 125.0, 147.7, 124.2, 139.8, 136.7, 147.3, 139.3],
      number: [174.4, 172.9, 162.5, 156.6, 155.7, 156.3, 151.0, 144.4, 149.8, 139.1, 143.4, 121.4],
    },
  };
  const R2 = { number: 0.62, dummies: 0.74 };
  const Y0 = 60, Y1 = 220;

  function layout(narrow) {
    return narrow
      ? { W: 340, H: 270, narrow, M: { l: 44, r: 8, t: 14, b: 34 } }
      : { W: 540, H: 290, narrow, M: { l: 56, r: 16, t: 16, b: 40 } };
  }

  const css = `
.md-typeset .hz-sm-fig { width: 100%; max-width: 40rem; display: block; margin: 0 auto; }
.md-typeset .hz-x svg.hz-sm-fig text { font-size: 13px; fill: var(--md-default-fg-color--light); }
.md-typeset .hz-sm-pred { fill: none; stroke: var(--hz-b); stroke-width: 2.6; stroke-linejoin: round; stroke-linecap: round; }
.md-typeset .hz-sm-dot { fill: var(--hz-ink); stroke: var(--hz-card); stroke-width: 1.5; }
.md-typeset .hz-sm-gap { stroke-width: 6; stroke-linecap: butt; opacity: 0.55; }
.md-typeset .hz-sm-gap.is-under { stroke: var(--hz-a); }
.md-typeset .hz-sm-gap.is-over { stroke: var(--hz-b); opacity: 0.35; }
.md-typeset .hz-sm-gap.is-worst { opacity: 0.95; }
.md-typeset .hz-x svg.hz-sm-fig text.hz-sm-worst { font-size: 12px; font-weight: 700; fill: var(--md-default-fg-color); }
.md-typeset .hz-sm .hz-x__stats { max-width: 24rem; }
.md-typeset .hz-sm-row { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; }
.md-typeset .hz-sm-row > span { font-size: 0.7rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-sm .hz-x__note { min-height: 5.2em; }
@media (max-width: 30em) {
  .md-typeset .hz-sm .hz-x__seg button { padding: 0.4em 0.6em; font-size: 0.62rem; white-space: nowrap; }
}
`;

  HZ.register("season-misfit", {
    kicker: "Week 3",
    title: "One season shape for three hotels",
    css,
    mount(body) {
      body.classList.add("hz-sm", "tex2jax_ignore");
      let hotel = "Santiago", model = "dummies", runId = 0;
      let shown = { actual: DATA[hotel].actual.slice(), pred: DATA[hotel][model].slice() };
      let L = layout(false);

      body.append(el("p", { class: "hz-x__lede", html:
        "Dots: the average rate that test bookings <strong>actually paid</strong>, by arrival month. Line: the average rate the <strong>linear model predicted</strong> for those same bookings. Each vertical bar is the miss. Switch hotel and model and watch which months the line gets wrong." }));

      const hotelSeg = HZ.segmented(Object.keys(DATA).map((h) => ({ value: h, label: h })), hotel, (v) => { hotel = v; go(); });
      const modelSeg = HZ.segmented(
        [{ value: "number", label: "Month as a number" }, { value: "dummies", label: "Month as 12 categories" }],
        model, (v) => { model = v; go(); });
      hotelSeg.node.setAttribute("aria-label", "Hotel");
      modelSeg.node.setAttribute("aria-label", "How the model sees the month");
      const readout = HZ.stats();
      const fig = svg("svg", { class: "hz-sm-fig", role: "img" });
      const legend = el("div", { class: "hz-legend" }, [
        el("span", {}, [el("i", { style: "background: var(--hz-ink); border-radius: 50%" }), "actual average rate"]),
        el("span", {}, [el("i", { style: "background: var(--hz-b); height: 3px; vertical-align: 0.2em" }), "model's prediction"]),
        el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "priced too low"]),
        el("span", {}, [el("i", { style: "background: var(--hz-b); opacity: 0.45" }), "priced too high"]),
      ]);
      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      body.append(
        el("div", { class: "hz-sm-row" }, [el("span", { text: "Hotel" }), hotelSeg.node]),
        el("div", { class: "hz-sm-row" }, [el("span", { text: "Model" }), modelSeg.node]),
        el("div", {}, [fig, legend]),
        readout.node,
        note
      );

      let xs, ys, path, dots = [], gaps = [], worstLab;
      function build() {
        const { W, H, M } = L;
        fig.replaceChildren();
        fig.setAttribute("viewBox", `0 0 ${W} ${H}`);
        xs = (i) => M.l + ((i + 0.5) * (W - M.l - M.r)) / 12;
        ys = HZ.scale([Y0, Y1], [H - M.b, M.t]);
        for (let v = Y0; v <= Y1; v += 40) {
          fig.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
          fig.append(svg("text", { x: M.l - 7, y: ys(v) + 4, "text-anchor": "end", text: v }));
        }
        MONTHS.forEach((m, i) => fig.append(svg("text", { x: xs(i), y: H - M.b + 17, "text-anchor": "middle", text: m })));
        fig.append(svg("text", { x: (M.l + W - M.r) / 2, y: H - 3, "text-anchor": "middle", text: "arrival month" }));
        fig.append(svg("text", { x: 11, y: (M.t + H - M.b) / 2, transform: `rotate(-90 11 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "USD per night" }));
        gaps = MONTHS.map(() => fig.appendChild(svg("line", { class: "hz-sm-gap" })));
        path = fig.appendChild(svg("path", { class: "hz-sm-pred" }));
        dots = MONTHS.map(() => fig.appendChild(svg("circle", { class: "hz-sm-dot", r: L.narrow ? 4 : 5 })));
        worstLab = fig.appendChild(svg("text", { class: "hz-sm-worst", "text-anchor": "middle" }));
      }

      function paint() {
        const { actual, pred } = shown;
        path.setAttribute("d", pred.map((v, i) => (i ? "L" : "M") + xs(i).toFixed(1) + " " + ys(v).toFixed(1)).join(" "));
        const miss = actual.map((a, i) => a - pred[i]);
        const worst = miss.reduce((b, v, i) => (Math.abs(v) > Math.abs(miss[b]) ? i : b), 0);
        actual.forEach((a, i) => {
          dots[i].setAttribute("cx", xs(i));
          dots[i].setAttribute("cy", ys(a));
          const g = gaps[i];
          g.setAttribute("x1", xs(i)); g.setAttribute("x2", xs(i));
          g.setAttribute("y1", ys(a)); g.setAttribute("y2", ys(pred[i]));
          g.setAttribute("class", "hz-sm-gap " + (miss[i] >= 0 ? "is-under" : "is-over") + (i === worst ? " is-worst" : ""));
        });
        const top = Math.min(ys(actual[worst]), ys(pred[worst]));
        worstLab.setAttribute("x", HZ.clamp(xs(worst), 40, L.W - 40));
        worstLab.setAttribute("y", Math.max(12, top - 9));
        worstLab.textContent = (miss[worst] >= 0 ? "+" : "−") + Math.abs(miss[worst]).toFixed(0);
        fig.setAttribute("aria-label", `${hotel}: actual and predicted average rate by month, model with ${model === "number" ? "month as a number" : "month as 12 categories"}`);
      }

      function stats() {
        const d = DATA[hotel], p = d[model];
        const miss = d.actual.map((a, i) => a - p[i]);
        const mean = miss.reduce((s, v) => s + Math.abs(v), 0) / 12;
        const worst = miss.reduce((b, v, i) => (Math.abs(v) > Math.abs(miss[b]) ? i : b), 0);
        readout.set([
          ["Hotel", hotel],
          ["Test R² (all hotels)", R2[model].toFixed(2), model === "dummies" ? "is-good" : null],
          ["Average monthly miss", "USD " + mean.toFixed(0), "is-a"],
          ["Worst month", MONTH_NAMES[worst]],
          ["Bookings paid then", "USD " + d.actual[worst].toFixed(0)],
          ["Model predicted", "USD " + p[worst].toFixed(0), "is-b"],
        ]);
        return { worst, miss };
      }

      function caption() {
        if (model === "number") {
          return hotel === "Santiago"
            ? "With month as a single number (1 to 12) the model can only draw a <strong>slope</strong>: rates drift down from January to December, at every hotel. Santiago's real pattern (quiet in January and February, conferences in October) is invisible to it. Test R² is 0.62."
            : `A single slope cannot draw a season that goes <strong>up in summer, down in winter and up again in December</strong>. ${hotel} is priced too high in the quiet months and too low in the peak. Switch to <strong>Month as 12 categories</strong>.`;
        }
        if (hotel === "Santiago")
          return "With twelve month categories the line has a season shape, but it is <strong>one shape for all three hotels</strong>. It learned that January and February are expensive (true at the beach and the lake) and applies it to Santiago, which is quiet then: the model asks about <strong>USD 70 too much</strong> per night. Test R² is 0.74.";
        if (hotel === "Viña del Mar")
          return "The beach peak in January and February is now drawn, but <strong>too low</strong> (part of it was spent on Santiago), and July is priced too high because Puerto Varas's winter-holiday peak is shared out to Viña. Better inputs helped; a single line still has limits.";
        return "Puerto Varas has two peaks: summer and July winter holidays. The shared month effect gets the summer roughly right but <strong>underprices July by about USD 29</strong> per night, and overprices the quiet autumn. In week 5, trees learn \"Puerto Varas in July\" by themselves.";
      }

      function go() {
        const id = ++runId;
        const from = { actual: shown.actual.slice(), pred: shown.pred.slice() };
        const to = { actual: DATA[hotel].actual, pred: DATA[hotel][model] };
        stats();
        note.innerHTML = caption();
        HZ.tween(body, 560, (k) => {
          if (id !== runId) return;
          shown = {
            actual: from.actual.map((v, i) => HZ.lerp(v, to.actual[i], k)),
            pred: from.pred.map((v, i) => HZ.lerp(v, to.pred[i], k)),
          };
          paint();
        });
      }

      function measure() {
        const w = fig.getBoundingClientRect().width || body.clientWidth || 600;
        const narrow = w < 440;
        if (dots.length && narrow === L.narrow) return;
        L = layout(narrow);
        build();
        paint();
      }
      measure();
      stats();
      note.innerHTML = caption();
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
