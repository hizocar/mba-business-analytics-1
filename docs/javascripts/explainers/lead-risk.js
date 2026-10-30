/* Week 4: where the line fails. Bars: the real cancellation rate of Altamar's
   5,964 bookings by lead time; it climbs to a peak around 90 days and falls
   again for bookings made far ahead. Our logistic model (all features,
   averaged per bucket over the test bookings) and any S-curve of lead time can
   only climb, or only fall: try to make the S fit. A curve that can bend, like
   the decision trees of week 5, draws the steps. */
(function () {
  const { el, svg, slider, segmented, stats, scale, tween, clamp } = HZ;

  // [from day, to day, bookings, real cancellation rate, model's average p on test bookings]
  const B = [[0,14,1842,0.162,0.202],[15,29,1121,0.208,0.3],[30,44,742,0.278,0.339],[45,59,537,0.488,0.38],[60,74,393,0.69,0.412],[75,89,307,0.694,0.432],[90,104,233,0.725,0.471],[105,119,186,0.624,0.489],[120,149,252,0.429,0.522],[150,179,134,0.396,0.591],[180,239,143,0.371,0.678],[240,424,74,0.405,0.76]];
  const XMAX = 300; // the last bucket (240+ days) is drawn up to 300
  const BEST_S = { mid: 123, steep: 0.94 }; // logistic fit on lead time alone, all bookings
  const W = 520, H = 300, M = { l: 50, r: 14, t: 18, b: 46 };
  const sig = (z) => 1 / (1 + Math.exp(-z));
  const pct = (v) => Math.round(v * 100) + "%";
  const mid = (b) => (b[0] + Math.min(b[1] + 1, XMAX)) / 2;
  const label = (b) => (b[0] === 240 ? "240+ days" : `${b[0]}–${b[1]} days`);

  function mount(body) {
    body.classList.add("hz-lr");
    let step = "real", sMid = BEST_S.mid, sSteep = BEST_S.steep, probe = 165;
    const xs = scale([0, XMAX], [M.l, W - M.r]);
    const ys = scale([0, 1], [H - M.b, M.t]);
    const fig = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-lr-plot", role: "img", "aria-label": "Cancellation rate by lead time, real and predicted" });
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
      fig.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
      fig.append(svg("text", { x: M.l - 8, y: ys(v) + 4, "text-anchor": "end", text: pct(v) }));
    });
    [0, 60, 120, 180, 240].forEach((d) => fig.append(svg("text", { x: xs(d), y: H - M.b + 18, "text-anchor": "middle", text: d === 240 ? "240+" : String(d) })));
    fig.append(svg("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", text: "lead time: days booked ahead" }));
    fig.append(svg("text", { x: 12, y: (M.t + H - M.b) / 2, transform: `rotate(-90 12 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "cancelled" }));

    const bars = B.map((b, i) => {
      const x0 = xs(b[0]) + 1, x1 = xs(Math.min(b[1] + 1, XMAX)) - 1;
      const r = svg("rect", { class: "hz-lr-bar", x: x0, width: x1 - x0, y: ys(b[3]), height: ys(0) - ys(b[3]) });
      fig.append(r);
      return r;
    });
    const steps = svg("path", { class: "hz-lr-steps" });
    const sCurve = svg("path", { class: "hz-lr-s" });
    const model = svg("path", { class: "hz-lr-model" });
    const modelDots = B.map(() => svg("circle", { class: "hz-lr-mdot", r: 4 }));
    const probeLine = svg("line", { class: "hz-lr-probe", y1: M.t, y2: H - M.b });
    fig.append(steps, sCurve, model, ...modelDots, probeLine);
    fig.append(svg("text", { class: "hz-lr-peak", x: xs(97), y: ys(0.725) - 10, "text-anchor": "middle", text: "peak ≈ 90 days" }));

    // Model line: drawn once, revealed with a stroke-dash tween
    model.setAttribute("d", B.map((b, i) => (i ? "L" : "M") + xs(mid(b)).toFixed(1) + "," + ys(b[4]).toFixed(1)).join(""));
    B.forEach((b, i) => { modelDots[i].setAttribute("cx", xs(mid(b))); modelDots[i].setAttribute("cy", ys(b[4])); });
    steps.setAttribute("d", B.map((b, i) => `${i ? "L" : "M"}${xs(b[0]).toFixed(1)},${ys(b[3]).toFixed(1)}H${xs(Math.min(b[1] + 1, XMAX)).toFixed(1)}`).join(""));

    const readout = stats();
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
    const sCurveAt = (x) => sig((sSteep * (x - sMid)) / 100);
    const totalN = B.reduce((a, b) => a + b[2], 0);
    const gap = (f) => B.reduce((a, b) => a + b[2] * Math.abs(f(b) - b[3]), 0) / totalN;

    const seg = segmented(
      [{ value: "real", label: "1 · Real rate" }, { value: "model", label: "2 · + our model" }, { value: "s", label: "3 · Try an S" }, { value: "bend", label: "4 · A curve that bends" }],
      step,
      (v) => { const prev = step; step = v; draw(prev); }
    );
    seg.node.setAttribute("aria-label", "What to show");
    const sm = slider({ label: "S midpoint (days)", min: 0, max: 300, step: 5, value: sMid, format: (v) => v + " d", oninput: (v) => { sMid = v; draw(step); } });
    const ss = slider({ label: "S steepness", min: -4, max: 4, step: 0.1, value: sSteep, format: (v) => v.toFixed(1), oninput: (v) => { sSteep = v; draw(step); } });
    const sp = slider({ label: "Lead time", min: 0, max: 295, step: 5, value: probe, format: (v) => v + " d", oninput: (v) => { probe = v; draw(step); } });
    const sControls = el("div", { class: "hz-x__controls hz-lr-scontrols" }, [sm.node, ss.node]);

    function revealModel() {
      const len = model.getTotalLength ? model.getTotalLength() : 600;
      model.style.strokeDasharray = len;
      tween(body, 700, (q) => (model.style.strokeDashoffset = len * (1 - q)));
    }

    function draw(prev) {
      const showModel = step !== "real", showS = step === "s", bend = step === "bend";
      model.style.opacity = showModel && !bend ? 1 : bend ? 0.35 : 0;
      modelDots.forEach((d) => (d.style.opacity = showModel && !bend ? 1 : 0));
      if (showModel && prev === "real") revealModel();
      sCurve.style.opacity = showS ? 1 : 0;
      steps.style.opacity = bend ? 1 : 0;
      sControls.hidden = !showS;
      let d = "";
      for (let i = 0; i <= 100; i++) { const x = (XMAX * i) / 100; d += (i ? "L" : "M") + xs(x).toFixed(1) + "," + ys(sCurveAt(x)).toFixed(1); }
      sCurve.setAttribute("d", d);

      const bi = B.findIndex((b) => probe >= b[0] && probe <= b[1]);
      const b = B[bi < 0 ? B.length - 1 : bi];
      bars.forEach((r) => r.classList.remove("is-probe"));
      bars[bi < 0 ? B.length - 1 : bi].classList.add("is-probe");
      probeLine.setAttribute("x1", xs(probe + 2.5)); probeLine.setAttribute("x2", xs(probe + 2.5));

      const modelGap = gap((x) => x[4]), sGap = gap((x) => sCurveAt(mid(x)));
      const rows = [["Booked ahead", label(b)], ["Bookings", b[2].toLocaleString("en-US")], ["Really cancelled", pct(b[3]), "is-a"]];
      if (step === "model") rows.push(["Our model says", pct(b[4]), Math.abs(b[4] - b[3]) > 0.1 ? "is-bad" : null], ["Average gap, all bookings", Math.round(modelGap * 100) + " points"]);
      if (showS) rows.push(["Your S says", pct(sCurveAt(mid(b))), Math.abs(sCurveAt(mid(b)) - b[3]) > 0.1 ? "is-bad" : null], ["Average gap of your S", Math.round(sGap * 100) + " points", sGap < modelGap ? "is-good" : null]);
      if (bend) rows.push(["Curve that bends", pct(b[3]), "is-good"], ["Average gap", "0 points", "is-good"]);
      readout.set(rows);

      const diff = b[4] - b[3];
      if (step === "real") note.innerHTML = `Risk climbs from ${pct(B[0][3])} for last-minute bookings to <strong>${pct(0.725)} around 90 days</strong>, then falls back to about 40% for bookings made far ahead. Now add the model.`;
      else if (step === "model") note.innerHTML = Math.abs(diff) < 0.06
        ? `For bookings made ${label(b)} ahead the model is close: ${pct(b[4])} predicted, ${pct(b[3])} real. Move the lead-time slider to the peak (60–119 days) or past 150 days.`
        : `For bookings made ${label(b)} ahead, the model says ${pct(b[4])} but ${pct(b[3])} really cancel. It <strong>${diff > 0 ? "overestimates" : "underestimates"}</strong> by ${Math.round(Math.abs(diff) * 100)} points: ${diff > 0 ? "we would oversell rooms that will be needed and walk guests" : "we would leave rooms empty that we could have resold"}. The line inside the model can only keep climbing.`;
      else if (step === "s") note.innerHTML = `An S-curve of lead time can rise or fall, but <strong>only once</strong>. Slide the midpoint and the steepness: you can fit the climb or the fall, never both. Right now your S misses the bars by about ${Math.round(sGap * 100)} points on average.`;
      else note.innerHTML = `A curve that bends can follow the bars: up to 90 days, then down. Decision trees (week 5) draw exactly this kind of step: <em>if lead time is between 60 and 119 days, risk is high</em>. That is where we go next week.`;
    }

    body.append(
      el("p", { class: "hz-x__lede", html: "Each bar is the share of Altamar bookings that were cancelled, grouped by how many days ahead they were made. Step through the buttons: what the data says, what our logistic model says, and what a curve would need to do." }),
      el("div", { class: "hz-x__controls" }, [seg.node]),
      fig,
      el("div", { class: "hz-legend" }, [
        el("span", {}, [el("i", { style: "background: var(--hz-b-soft); border: 1px solid var(--hz-b)" }), "real cancellation rate"]),
        el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "our logistic model"]),
        el("span", {}, [el("i", { style: "background: var(--hz-ink)" }), "an S of lead time / a curve that bends"]),
      ]),
      el("div", { class: "hz-x__split" }, [el("div", {}, [sp.node, sControls]), readout.node]),
      note
    );
    draw("init");
    // grow the bars in, left to right, on first view
    tween(body, 700, (q) => bars.forEach((r, i) => {
      const k = clamp(q * 1.6 - i * 0.05, 0, 1), v = B[i][3] * k;
      r.setAttribute("y", ys(v)); r.setAttribute("height", ys(0) - ys(v));
    }));
  }

  HZ.register("lead-risk", {
    kicker: "Week 4",
    title: "Where the line fails: risk peaks at 90 days",
    mount,
    css: `
.md-typeset .hz-x svg.hz-lr-plot text { font-size: 13px; }
.md-typeset .hz-lr-plot { max-width: 46rem; }
.md-typeset .hz-lr-bar { fill: var(--hz-b-soft); stroke: var(--hz-b); stroke-width: 1; transition: fill 200ms ease; }
.md-typeset .hz-lr-bar.is-probe { fill: color-mix(in srgb, var(--hz-b) 45%, transparent); }
.md-typeset .hz-lr-model { fill: none; stroke: var(--hz-a); stroke-width: 3; stroke-linejoin: round; transition: opacity 300ms ease; }
.md-typeset .hz-lr-mdot { fill: var(--hz-a); stroke: var(--hz-card); stroke-width: 1.5; transition: opacity 300ms ease; }
.md-typeset .hz-lr-s { fill: none; stroke: var(--hz-ink); stroke-width: 2.5; stroke-dasharray: 7 5; transition: opacity 300ms ease; }
.md-typeset .hz-lr-steps { fill: none; stroke: var(--hz-ink); stroke-width: 3; transition: opacity 400ms ease; }
.md-typeset .hz-lr-probe { stroke: var(--hz-ink); stroke-opacity: 0.45; stroke-width: 1; stroke-dasharray: 3 3; }
.md-typeset .hz-x svg text.hz-lr-peak { fill: var(--hz-b); font-size: 12px; font-weight: 600; }
.md-typeset .hz-lr .hz-x__note { min-height: 4.2em; }
.md-typeset .hz-lr .hz-x__seg { flex-wrap: wrap; }
@media (prefers-reduced-motion: reduce) { .md-typeset .hz-lr-bar, .md-typeset .hz-lr-model, .md-typeset .hz-lr-s, .md-typeset .hz-lr-steps { transition: none; } }
@media (max-width: 44em) { .md-typeset .hz-x svg.hz-lr-plot text { font-size: 18px; } .md-typeset .hz-x svg text.hz-lr-peak { font-size: 16px; } }
`,
  });
})();
