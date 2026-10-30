/* Week 6: gradient boosting, one tree at a time. Sixty real Standard-room
   bookings at Altamar Puerto Varas (five per arrival month, sampled in the
   Week 6 notebook) and one input, the arrival month. The prediction starts
   at the average rate; each step grows a small tree (depth 2, at least five
   bookings per leaf) on the current errors and adds a damped copy of it
   (the learning rate) to the prediction. The notebook reproduces the same
   numbers with scikit-learn's GradientBoostingRegressor. */
(function () {
  const { el, svg, slider, button, stats, scale, tween, wait, reducedMotion } = HZ;

  // [arrival month, nightly rate in USD]
  const DATA = [[1,174],[1,181],[1,182],[1,187],[1,213],[2,127],[2,158],[2,167],[2,175],[2,185],[3,92],[3,101],[3,115],[3,123],[3,129],[4,56],[4,75],[4,85],[4,98],[4,130],[5,68],[5,75],[5,88],[5,102],[5,103],[6,69],[6,74],[6,86],[6,88],[6,99],[7,120],[7,130],[7,136],[7,160],[7,163],[8,86],[8,96],[8,104],[8,115],[8,130],[9,86],[9,87],[9,104],[9,109],[9,117],[10,87],[10,91],[10,91],[10,119],[10,122],[11,105],[11,109],[11,124],[11,127],[11,138],[12,134],[12,139],[12,148],[12,188],[12,188]];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MAX_STEPS = 40, DEPTH = 2, MIN_LEAF = 5;

  const W = 540, H = 404, L = 50, R = 12;
  const TOP = { t: 14, b: 214 }, BOT = { t: 266, b: 384 };
  const x = scale([0.5, 12.5], [L, W - R]);
  const y = scale([40, 230], [TOP.b, TOP.t]);
  const ry = scale([-100, 100], [BOT.b, BOT.t]);
  const JIT = [-0.26, -0.13, 0, 0.13, 0.26];

  const n = DATA.length;
  const month = DATA.map((d) => d[0]);
  const rate = DATA.map((d) => d[1]);
  const mean = rate.reduce((s, v) => s + v, 0) / n;
  const usd = (v) => "USD " + Math.round(v);
  const usd1 = (v) => "USD " + v.toFixed(1);
  const signed = (v) => (Math.round(v) === 0 ? "±" : v > 0 ? "+" : "−") + "USD " + Math.abs(Math.round(v));
  const maeOf = (F) => rate.reduce((s, v, i) => s + Math.abs(v - F[month[i] - 1]), 0) / n;

  // A regression tree on one input (month), grown greedily on the errors.
  function grow(idx, res, depth) {
    const val = idx.reduce((s, i) => s + res[i], 0) / idx.length;
    const lo = Math.min(...idx.map((i) => month[i])), hi = Math.max(...idx.map((i) => month[i]));
    if (depth === 0 || idx.length < 2 * MIN_LEAF) return { val, lo, hi };
    let best = null;
    const total = idx.reduce((s, i) => s + res[i], 0);
    for (let t = lo; t < hi; t++) {
      const left = idx.filter((i) => month[i] <= t);
      const nl = left.length, nr = idx.length - nl;
      if (nl < MIN_LEAF || nr < MIN_LEAF) continue;
      const sl = left.reduce((s, i) => s + res[i], 0), sr = total - sl;
      const gain = (sl * sl) / nl + (sr * sr) / nr - (total * total) / idx.length;
      if (!best || gain > best.gain + 1e-9) best = { gain, t };
    }
    if (!best || best.gain < 1e-9) return { val, lo, hi };
    return {
      t: best.t, lo, hi,
      left: grow(idx.filter((i) => month[i] <= best.t), res, depth - 1),
      right: grow(idx.filter((i) => month[i] > best.t), res, depth - 1),
    };
  }
  const leaves = (node) => (node.left ? [...leaves(node.left), ...leaves(node.right)] : [node]);
  const splits = (node) => (node.left ? [node.t, ...splits(node.left), ...splits(node.right)] : []);
  const range = (lf) => (lf.lo === lf.hi ? MONTHS[lf.lo - 1] : `${MONTHS[lf.lo - 1]}–${MONTHS[lf.hi - 1]}`);

  // Step path over the twelve months for a per-month value array.
  function stepPath(vals, sy) {
    let d = "";
    vals.forEach((v, m) => {
      const x0 = x(m + 0.5), x1 = x(m + 1.5), yy = sy(v);
      d += (m === 0 ? `M${x0},${yy}` : `L${x0},${yy}`) + `H${x1}`;
    });
    return d;
  }

  function mount(body) {
    let lr = 0.3;
    let F = new Array(12).fill(mean);
    let history = [maeOf(F)];
    let tree = null;
    let run = 0, busy = false, playing = false;

    // ---- main figure ----
    const fig = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-bst-plot", role: "img", "aria-label": "Nightly rates by arrival month with the boosted prediction, and the errors below" });
    const gTop = svg("g"), gBot = svg("g");
    fig.append(gTop, gBot);
    [50, 100, 150, 200].forEach((v) => {
      gTop.append(svg("line", { class: "hz-gridline", x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      gTop.append(svg("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end", text: v }));
    });
    gTop.append(svg("text", { x: L, y: TOP.t - 2, class: "hz-bst-ptitle", text: "Nightly rate (USD) · Puerto Varas, Standard rooms" }));
    MONTHS.forEach((m, i) => gTop.append(svg("text", { x: x(i + 1), y: TOP.b + 16, "text-anchor": "middle", text: m })));
    gTop.append(svg("line", { class: "hz-axis", x1: L, x2: W - R, y1: TOP.b, y2: TOP.b }));
    const dots = DATA.map((d, i) => svg("circle", { class: "hz-bst-dot", cx: x(d[0] + JIT[i % 5]), cy: y(d[1]), r: 3.6 }));
    gTop.append(...dots);
    const ghost = svg("path", { class: "hz-bst-ghost" });
    const predPath = svg("path", { class: "hz-bst-pred" });
    gTop.append(ghost, predPath);

    gBot.append(svg("text", { x: L, y: BOT.t - 12, class: "hz-bst-ptitle", text: "Errors: actual − predicted (USD)" }));
    [-80, 0, 80].forEach((v) => gBot.append(svg("text", { x: L - 6, y: ry(v) + 4, "text-anchor": "end", text: v > 0 ? "+" + v : v === 0 ? "0" : "−" + -v })));
    gBot.append(svg("line", { class: "hz-axis", x1: L, x2: W - R, y1: ry(0), y2: ry(0) }));
    const splitG = svg("g");
    const bars = DATA.map((d, i) => svg("line", { class: "hz-bst-res", x1: x(d[0] + JIT[i % 5]), x2: x(d[0] + JIT[i % 5]), y1: ry(0), y2: ry(0) }));
    const treePath = svg("path", { class: "hz-bst-tree" });
    gBot.append(splitG, ...bars, treePath);

    // ---- side panel ----
    const readout = stats();
    const hist = svg("svg", { viewBox: "0 0 220 96", class: "hz-bst-hist", role: "img", "aria-label": "Typical error after each tree" });
    const note = el("p", { class: "hz-x__note" });

    function drawResiduals(Fnow) {
      DATA.forEach((d, i) => {
        const r = d[1] - Fnow[d[0] - 1];
        bars[i].setAttribute("y2", ry(Math.max(-100, Math.min(100, r))));
        bars[i].classList.toggle("is-pos", r >= 0);
        bars[i].classList.toggle("is-neg", r < 0);
      });
    }
    function drawPred(Fnow) {
      predPath.setAttribute("d", stepPath(Fnow, y));
      drawResiduals(Fnow);
    }
    function drawHist() {
      const k = history.length;
      const bw = Math.min(14, 190 / Math.max(k, 12));
      const hy = scale([0, 32], [80, 8]);
      const parts = [
        svg("line", { class: "hz-axis", x1: 24, x2: 216, y1: 80, y2: 80 }),
        svg("text", { x: 20, y: hy(30) + 4, "text-anchor": "end", text: "30" }),
        svg("text", { x: 20, y: 84, "text-anchor": "end", text: "0" }),
        svg("text", { x: 26, y: 94, text: "start" }),
        svg("text", { x: 216, y: 94, "text-anchor": "end", text: `${k - 1} tree${k === 2 ? "" : "s"}` }),
      ];
      history.forEach((v, i) => {
        parts.push(svg("rect", { class: "hz-bst-hbar" + (i === k - 1 ? " is-now" : ""), x: 26 + i * bw, y: hy(v), width: Math.max(1, bw - 1.5), height: 80 - hy(v) }));
      });
      hist.replaceChildren(...parts);
    }
    function showStats() {
      const k = history.length - 1;
      readout.set([
        ["Trees added", String(k)],
        ["Typical error now", usd1(history[k]), k ? "is-good" : null],
        ["With the average only", usd1(history[0])],
        ["Learning rate", lr.toFixed(1)],
      ]);
      drawHist();
    }

    function startNote() {
      note.innerHTML = `Start with the simplest guess: every booking gets the <strong>average rate, ${usd(mean)}</strong>. The bars below are the errors: <span class="hz-bst-k is-pos">orange</span> bookings paid more than predicted (summer and the July holidays), <span class="hz-bst-k is-neg">teal</span> ones paid less. Typical error: <strong>${usd1(history[0])}</strong>. Press <em>Step</em> to grow the first tree.`;
    }

    function reset(keepNote) {
      run++;
      busy = false;
      setPlaying(false);
      F = new Array(12).fill(mean);
      history = [maeOf(F)];
      tree = null;
      ghost.setAttribute("d", "");
      treePath.setAttribute("d", "");
      treePath.style.opacity = 0;
      splitG.replaceChildren();
      drawPred(F);
      showStats();
      if (!keepNote) startNote();
      stepBtn.disabled = false;
    }

    async function step() {
      if (busy || history.length > MAX_STEPS) return false;
      busy = true;
      stepBtn.disabled = true;
      const id = run;
      const k = history.length; // the tree we are growing
      const res = rate.map((v, i) => v - F[month[i] - 1]);
      tree = grow(DATA.map((_, i) => i), res, DEPTH);
      const lf = leaves(tree);
      const corr = new Array(12).fill(0);
      lf.forEach((l) => { for (let m = l.lo; m <= l.hi; m++) corr[m - 1] = l.val; });
      const before = F.slice();
      const after = F.map((v, m) => v + lr * corr[m]);
      const maeBefore = maeOf(before), maeAfter = maeOf(after);

      // 1. the small tree appears on the errors
      splitG.replaceChildren(...splits(tree).map((t) => svg("line", { class: "hz-bst-split", x1: x(t + 0.5), x2: x(t + 0.5), y1: BOT.t - 4, y2: BOT.b })));
      treePath.setAttribute("d", stepPath(corr, (v) => ry(Math.max(-100, Math.min(100, v)))));
      ghost.setAttribute("d", stepPath(before, y));
      const big = lf.slice().sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
      note.innerHTML = `<strong>Tree ${k}</strong> looks only at the errors and splits the year into ` +
        lf.map((l) => `${range(l)} <span class="hz-bst-k ${l.val >= 0 ? "is-pos" : "is-neg"}">${signed(l.val)}</span>`).join(", ") +
        `. It adds ${Math.round(lr * 100)}% of that correction (the learning rate) to the prediction…`;
      await tween(body, 450, (t) => { treePath.style.opacity = t; });
      if (id !== run) return false;
      await wait(150);
      if (id !== run) return false;

      // 2. a damped copy of the tree is added: the line moves, the errors shrink
      await tween(body, 650, (t) => {
        const Ft = before.map((v, m) => v + t * (after[m] - v));
        drawPred(Ft);
      });
      if (id !== run) return false;
      F = after;
      history.push(maeAfter);
      showStats();
      const gain = maeBefore - maeAfter;
      let msg = `<strong>Tree ${k}</strong> moved ${range(big[0])} by ${signed(lr * big[0].val)}. Typical error: ${usd1(maeBefore)} → <strong>${usd1(maeAfter)}</strong>. Each tree fixes what the previous ones got wrong.`;
      const stalled = k > 1 && gain < 0.05;
      if (stalled) {
        msg = `After ${k} trees the error has stopped falling (<strong>${usd1(maeAfter)}</strong>). What is left does not depend on the month: it comes from channel, weekends, lead time… With only the month as input, there is nothing more for a new tree to fix. The real model uses every input.`;
      }
      if (history.length > MAX_STEPS) msg += " Press Reset to start again.";
      note.innerHTML = msg;
      busy = false;
      stepBtn.disabled = history.length > MAX_STEPS || playing;
      return stalled ? "stalled" : true;
    }

    function setPlaying(on) {
      playing = on;
      playBtn.textContent = on ? "Pause" : "Play";
      playBtn.setAttribute("aria-pressed", String(on));
      stepBtn.disabled = on || busy || history.length > MAX_STEPS;
    }
    async function play() {
      if (playing) return setPlaying(false);
      if (history.length > MAX_STEPS) reset();
      setPlaying(true);
      const id = run;
      while (playing && id === run && body.isConnected && history.length <= MAX_STEPS) {
        if (busy) { await wait(100); continue; }
        const ok = await step();
        if (!ok || ok === "stalled" || id !== run) break;
        await wait(reducedMotion() ? 500 : 250);
      }
      if (id === run) setPlaying(false);
    }

    const stepBtn = button("Step", () => step(), "primary");
    const playBtn = button("Play", play);
    const resetBtn = button("Reset", () => reset());
    const lrSlider = slider({
      label: "Learning rate", min: 0.1, max: 1, step: 0.1, value: lr, format: (v) => v.toFixed(1),
      oninput: (v) => {
        lr = v;
        reset(true);
        note.innerHTML = `Learning rate <strong>${v.toFixed(1)}</strong>: each tree's correction is multiplied by ${v.toFixed(1)} before it is added. ${v >= 0.8 ? "Big steps: the error falls fast, but on real data big steps also copy the noise." : v <= 0.2 ? "Small steps: you need many more trees, but on real data small steps are less fooled by noise." : "A middle setting."} Press <em>Step</em> or <em>Play</em>.`;
      },
    });

    body.append(
      el("p", { class: "hz-x__lede", html: "Sixty real bookings at Puerto Varas, five per month, and one input: the arrival month. Boosting starts from the average and adds small trees, each one fitted to the errors that are still left." }),
      el("div", { class: "hz-x__controls" }, [stepBtn, playBtn, resetBtn, lrSlider.node]),
      el("div", { class: "hz-bst-figwrap" }, [
          fig,
          el("div", { class: "hz-legend" }, [
            el("span", {}, [el("i", { style: "background: var(--hz-ink); opacity: 0.6" }), "a booking"]),
            el("span", {}, [el("i", { style: "background: var(--hz-a); border-radius: 2px; height: 3px; vertical-align: 0.2em" }), "prediction"]),
            el("span", {}, [el("i", { style: "border: 1.5px dashed var(--hz-ink); border-radius: 2px; height: 0; width: 1em; vertical-align: 0.25em" }), "the new tree (fitted to the errors)"]),
          ]),
      ]),
      el("div", { class: "hz-bst-side" }, [
        el("div", { class: "hz-bst-nums" }, [
          readout.node,
          el("div", {}, [el("p", { class: "hz-bst-htitle", text: "Typical error (USD) after each tree" }), hist]),
        ]),
        note,
      ])
    );
    reset();
  }

  HZ.register("boosting-steps", {
    kicker: "Week 6",
    title: "Boosting: trees that fix each other's mistakes",
    mount,
    css: `
.md-typeset .hz-x svg.hz-bst-plot text { font-size: 12px; }
.md-typeset .hz-x svg.hz-bst-plot text.hz-bst-ptitle { font-size: 12px; fill: var(--hz-ink); font-weight: 600; }
.md-typeset .hz-bst-dot { fill: var(--hz-ink); fill-opacity: 0.55; }
.md-typeset .hz-bst-pred { fill: none; stroke: var(--hz-a); stroke-width: 3; stroke-linejoin: round; }
.md-typeset .hz-bst-ghost { fill: none; stroke: var(--hz-muted); stroke-width: 1.5; stroke-dasharray: 4 4; opacity: 0.8; }
.md-typeset .hz-bst-res { stroke-width: 2.4; stroke-linecap: round; }
.md-typeset .hz-bst-res.is-pos { stroke: var(--hz-a); }
.md-typeset .hz-bst-res.is-neg { stroke: var(--hz-b); }
.md-typeset .hz-bst-tree { fill: none; stroke: var(--hz-ink); stroke-width: 2.2; stroke-dasharray: 6 3; }
.md-typeset .hz-bst-split { stroke: var(--hz-ink); stroke-opacity: 0.35; stroke-width: 1; stroke-dasharray: 2 3; }
.md-typeset .hz-bst-figwrap { max-width: 44rem; width: 100%; margin: 0 auto; }
.md-typeset .hz-bst-side { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 1rem; align-items: start; }
.md-typeset .hz-bst-nums { display: flex; flex-direction: column; gap: 0.7rem; }
@media (max-width: 44em) { .md-typeset .hz-bst-side { grid-template-columns: minmax(0, 1fr); } }
.md-typeset .hz-x__body p.hz-bst-htitle { font-size: 0.66rem; color: var(--md-default-fg-color--light); margin-bottom: 0.2rem; }
.md-typeset .hz-x svg.hz-bst-hist { max-width: 20rem; }
.md-typeset .hz-x svg.hz-bst-hist text { font-size: 11px; }
.md-typeset .hz-bst-hbar { fill: var(--hz-a); fill-opacity: 0.35; transition: fill-opacity 200ms ease; }
.md-typeset .hz-bst-hbar.is-now { fill-opacity: 1; }
.md-typeset .hz-bst-k { font-weight: 600; white-space: nowrap; }
.md-typeset .hz-bst-k.is-pos { color: var(--hz-a); }
.md-typeset .hz-bst-k.is-neg { color: var(--hz-b); }
.md-typeset .hz-bst-side .hz-x__note { min-height: 7.5em; }
@media (max-width: 30em) { .md-typeset .hz-x svg.hz-bst-plot text, .md-typeset .hz-x svg.hz-bst-plot text.hz-bst-ptitle { font-size: 15px; } }
`,
  });
})();
