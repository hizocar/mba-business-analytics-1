/*
 * kfold: k-fold cross-validation on the training data only.
 * Each iteration moves the validation fold one step to the right, scores it,
 * and drops the score into a dot plot; the end shows mean ± std.
 */
(function () {
  const { el, svg } = HZ;

  const N_ROWS = 545; // Housing dataset used in the notebook
  const N_TEST = Math.ceil(N_ROWS * 0.3), N_TRAIN = N_ROWS - N_TEST;
  const DOMAIN = [0.55, 0.85];

  function scoresFor(k) {
    const r = HZ.rng(700 + k * 13);
    return Array.from({ length: k }, () => Math.round(HZ.clamp(0.7 + 0.035 * r.normal(), 0.57, 0.83) * 1000) / 1000);
  }
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const std = (xs) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
  // KFold: the first n % k folds get one extra row
  const foldSize = (n, k, j) => Math.floor(n / k) + (j < n % k ? 1 : 0);
  const listWords = (xs) => (xs.length <= 1 ? String(xs[0]) : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);

  HZ.register("kfold", {
    title: "k-fold cross-validation",
    kicker: "Session 3",
    mount(body) {
      body.classList.add("hz-kfold");
      const uid = Math.random().toString(36).slice(2, 8);
      let k = 5, withTest = true, done = 0, summary = false, busy = false, runId = 0;
      let scores = scoresFor(k);

      body.append(el("p", { class: "hz-x__lede" }, [
        "One train/validation split can be lucky or unlucky. Cross-validation rotates the validation fold so every training row is used for validation exactly once, then averages the ",
        el("code", { text: "k" }),
        " scores.",
      ]));

      const kSlider = HZ.slider({ label: "Folds k", min: 3, max: 10, step: 1, value: k, oninput: (v) => { k = v; scores = scoresFor(k); hardReset(); } });
      const testBox = el("input", { type: "checkbox", checked: true, id: "hz-kf-test-" + uid });
      testBox.addEventListener("change", () => { withTest = testBox.checked; rebuild(); });
      const testLabel = el("label", { class: "hz-kfold-toggle", for: testBox.id }, [testBox, "Hold out a test set (30%)"]);
      const playBtn = HZ.button("Play", () => play(), "primary");
      const stepBtn = HZ.button("Step", () => step());
      const resetBtn = HZ.button("Reset", () => hardReset());
      body.append(
        el("div", { class: "hz-x__controls" }, [kSlider.node, testLabel]),
        el("div", { class: "hz-x__controls hz-kfold-btns" }, [playBtn, stepBtn, resetBtn])
      );

      const fig = svg("svg", { class: "hz-kfold-fig", role: "img", "aria-label": "Folds used for training and validation in each iteration" });
      const legend = el("div", { class: "hz-legend" }, [
        el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "training folds"]),
        el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "validation fold"]),
        el("span", { class: "hz-kfold-testlegend" }, [el("i", { class: "hz-kfold-hatchdot" }), "test set (never touched)"]),
      ]);
      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      body.append(fig, legend, note);

      // --- Layout
      let L = null, lastW = 0;
      function layout(w) {
        w = Math.max(280, w);
        const labelW = w < 420 ? 40 : 54, scoreW = w < 420 ? 50 : 72;
        const barX = labelW, barW = w - labelW - scoreW;
        const testW = withTest ? Math.round(barW * 0.3) : 0;
        const tGap = withTest ? 8 : 0;
        const trainW = barW - testW - tGap;
        const bGap = k > 7 ? 2 : 3;
        const blockW = (trainW - (k - 1) * bGap) / k;
        const dataY = 20, dataH = 24;
        const foldY = dataY + dataH + 24;
        const rowY0 = foldY + 8, rowH = 20, pitch = 26;
        const plotY = rowY0 + k * pitch + 22;
        const axisY = plotY + 38;
        return {
          w, h: axisY + 22, labelW, scoreW, barX, barW, trainW, testW, testX: barX + trainW + tGap,
          bGap, blockW, dataY, dataH, foldY, rowY0, rowH, pitch, plotY, axisY,
          sx: HZ.scale(DOMAIN, [barX, barX + barW]),
        };
      }
      const blockX = (j) => L.barX + j * (L.blockW + L.bGap);
      const rowY = (i) => L.rowY0 + i * L.pitch;
      const dotY = (i) => L.plotY + 16 + ((i % 3) - 1) * 6;

      // --- Scene (rebuilt on k / test / width change)
      let rows = [], dots = [], scoreTexts = [], cursor, meanLine, band, meanText, rowBg;
      function build() {
        fig.replaceChildren();
        fig.setAttribute("viewBox", `0 0 ${L.w} ${L.h}`);
        const pid = "hz-kf-hatch-" + uid;
        fig.append(svg("defs", {}, [
          svg("pattern", { id: pid, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, [
            svg("line", { x1: 0, y1: 0, x2: 0, y2: 6, style: "stroke: var(--hz-muted); stroke-width: 1.4; opacity: 0.55" }),
          ]),
        ]));
        const hatch = `fill: url(#${pid})`;

        // Dataset bar
        fig.append(svg("text", { x: 0, y: L.dataY + L.dataH / 2 + 4, class: "hz-kfold-lab", text: "data" }));
        fig.append(svg("rect", { x: L.barX, y: L.dataY, width: L.trainW, height: L.dataH, rx: 5, class: "hz-kfold-train-all" }));
        fig.append(svg("text", {
          x: L.barX + 8, y: L.dataY + L.dataH / 2 + 4, class: "hz-kfold-in",
          text: (withTest ? "training" : "all rows") + " · " + (withTest ? N_TRAIN : N_ROWS) + (L.trainW > 170 ? " rows" : ""),
        }));
        if (withTest) {
          fig.append(svg("rect", { x: L.testX, y: L.dataY, width: L.testW, height: L.dataH, rx: 5, class: "hz-kfold-test", style: hatch }));
          fig.append(svg("text", { x: L.testX + L.testW / 2, y: L.dataY + L.dataH / 2 + 4, "text-anchor": "middle", class: "hz-kfold-in", text: "test · " + N_TEST }));
        }
        // Bracket: the training part is cut into k folds
        const by = L.dataY + L.dataH + 6;
        fig.append(svg("path", {
          d: `M ${L.barX + 1} ${by} v 5 H ${L.barX + L.trainW - 1} v -5`,
          class: "hz-kfold-bracket",
        }));
        if (L.blockW >= 16)
          for (let j = 0; j < k; j++)
            fig.append(svg("text", { x: blockX(j) + L.blockW / 2, y: L.foldY, "text-anchor": "middle", class: "hz-kfold-fold", text: (L.blockW >= 30 ? "fold " : "") + (j + 1) }));

        rowBg = svg("rect", { x: -4, width: L.w + 8, height: L.pitch, rx: 6, class: "hz-kfold-rowbg", opacity: 0 });
        fig.append(rowBg);
        rows = [];
        scoreTexts = [];
        for (let i = 0; i < k; i++) {
          const y = rowY(i);
          const g = svg("g", { class: "hz-kfold-row" });
          g.append(svg("text", { x: 0, y: y + L.rowH / 2 + 4, class: "hz-kfold-lab", text: (L.labelW > 45 ? "iter " : "#") + (i + 1) }));
          const blocks = [];
          for (let j = 0; j < k; j++) {
            const b = svg("rect", { x: blockX(j), y, width: L.blockW, height: L.rowH, rx: 3, class: "hz-kfold-block" });
            blocks.push(b);
            g.append(b);
          }
          if (withTest) g.append(svg("rect", { x: L.testX, y, width: L.testW, height: L.rowH, rx: 3, class: "hz-kfold-test is-row", style: hatch }));
          const st = svg("text", { x: L.w, y: y + L.rowH / 2 + 4, "text-anchor": "end", class: "hz-kfold-score", opacity: 0, text: (L.scoreW > 60 ? "R² " : "") + scores[i].toFixed(3) });
          g.append(st);
          scoreTexts.push(st);
          rows.push({ g, blocks });
          fig.append(g);
        }

        // Dot plot
        const ticks = [0.6, 0.65, 0.7, 0.75, 0.8];
        fig.append(svg("text", { x: 0, y: L.axisY + 4, class: "hz-kfold-lab", text: L.labelW > 45 ? "val R²" : "R²" }));
        fig.append(svg("line", { x1: L.barX, x2: L.barX + L.barW, y1: L.axisY, y2: L.axisY, class: "hz-axis" }));
        ticks.forEach((t) => {
          const x = L.sx(t);
          fig.append(svg("line", { x1: x, x2: x, y1: L.plotY, y2: L.axisY, class: "hz-gridline" }));
          fig.append(svg("text", { x, y: L.axisY + 14, "text-anchor": "middle", class: "hz-kfold-tick", text: t.toFixed(2) }));
        });
        band = svg("rect", { y: L.plotY + 2, height: L.axisY - L.plotY - 4, rx: 3, class: "hz-kfold-band", opacity: 0 });
        meanLine = svg("line", { y1: L.plotY, y2: L.axisY, class: "hz-kfold-mean", opacity: 0 });
        meanText = svg("text", { y: L.plotY - 4, "text-anchor": "middle", class: "hz-kfold-meantext", opacity: 0 });
        fig.append(band, meanLine, meanText);
        dots = scores.map(() => svg("circle", { r: 5, class: "hz-kfold-dot", opacity: 0 }));
        fig.append(...dots);
        cursor = svg("rect", { width: L.blockW, height: L.rowH, rx: 3, class: "hz-kfold-cursor", opacity: 0 });
        fig.append(cursor);
      }

      // --- State painting
      function paintRow(i, state) {
        rows[i].blocks.forEach((b, j) => {
          b.classList.toggle("is-train", state === "done" && j !== i);
          b.classList.toggle("is-val", state === "done" && j === i);
        });
        scoreTexts[i].setAttribute("opacity", state === "done" ? 1 : 0);
      }
      function placeDot(i, show) {
        dots[i].setAttribute("cx", L.sx(scores[i]));
        dots[i].setAttribute("cy", dotY(i));
        dots[i].setAttribute("opacity", show ? 1 : 0);
      }
      function paintSummary(p) {
        const m = mean(scores), s = std(scores);
        const x = L.sx(m);
        meanLine.setAttribute("x1", x);
        meanLine.setAttribute("x2", x);
        const half = (L.sx(m + s) - x) * HZ.clamp((p - 0.3) / 0.7, 0, 1);
        band.setAttribute("x", x - half);
        band.setAttribute("width", Math.max(0, 2 * half));
        band.setAttribute("opacity", p > 0.3 ? 1 : 0);
        meanLine.setAttribute("opacity", HZ.clamp(p / 0.3, 0, 1));
        meanLine.setAttribute("y1", HZ.lerp(L.axisY, L.plotY, HZ.clamp(p / 0.3, 0, 1)));
        meanText.setAttribute("x", HZ.clamp(x, L.barX + 60, L.barX + L.barW - 60));
        meanText.textContent = "mean " + m.toFixed(3) + " ± " + s.toFixed(3);
        meanText.setAttribute("opacity", HZ.clamp((p - 0.6) / 0.4, 0, 1));
      }
      function paintStatic() {
        rows.forEach((_, i) => paintRow(i, i < done ? "done" : "pending"));
        dots.forEach((_, i) => placeDot(i, i < done));
        cursor.setAttribute("opacity", 0);
        rowBg.setAttribute("opacity", 0);
        paintSummary(summary ? 1 : 0);
      }

      // --- Text
      function caption() {
        const c = (s) => el("code", { text: s });
        const n = withTest ? N_TRAIN : N_ROWS;
        const approx = Math.round(n / k);
        if (summary) {
          const m = mean(scores), s = std(scores);
          return [
            "Every fold was the validation set exactly once. Cross-validated R² = ",
            el("b", { text: m.toFixed(3) + " ± " + s.toFixed(3) }),
            " (mean ± std of the ", k, " scores): a steadier estimate than any single split, and the spread shows how much it depends on luck. ",
            withTest ? "Use it to compare models; score the final model on the test set only once, at the very end." : "But with no test set held out, there is no untouched data left for an honest final check.",
          ];
        }
        if (done === 0)
          return withTest
            ? ["The ", N_TEST, " test rows are locked away first. The ", N_TRAIN, " training rows are shuffled and cut into k = ", k, " folds of about ", approx, " rows. Press Play or Step."]
            : ["All ", N_ROWS, " rows are cut into k = ", k, " folds of about ", approx, " rows. Nothing is held out for a final test. Press Play or Step."];
        const i = done - 1;
        const others = [];
        for (let j = 0; j < k; j++) if (j !== i) others.push(j + 1);
        const valN = foldSize(n, k, i);
        return [
          el("b", { text: "Iteration " + done + " of " + k + ": " }),
          "fit on folds ", listWords(others), " (", n - valN, " rows), then score on fold ", i + 1, " (", valN, " rows the model has not seen). Validation R² = ",
          c(scores[i].toFixed(3)), ".",
          withTest ? " The test set is not used." : "",
        ];
      }

      function syncUi() {
        playBtn.disabled = busy;
        stepBtn.disabled = busy || summary;
        playBtn.textContent = summary && !busy ? "Replay" : "Play";
        body.classList.toggle("has-test", withTest);
        note.replaceChildren(...caption());
      }

      // --- Animation
      async function animateIteration(id) {
        const i = done;
        const alive = () => id === runId && body.isConnected;
        const y = rowY(i);
        rowBg.setAttribute("y", y - (L.pitch - L.rowH) / 2);
        // Validation window slides from the previous row's fold to this row's fold
        const from = i === 0 ? { x: blockX(0), y: L.dataY + L.dataH - L.rowH } : { x: blockX(i - 1), y: rowY(i - 1) };
        const to = { x: blockX(i), y };
        cursor.setAttribute("width", L.blockW);
        await HZ.tween(body, 360, (t) => {
          if (!alive()) return;
          cursor.setAttribute("x", HZ.lerp(from.x, to.x, t));
          cursor.setAttribute("y", HZ.lerp(from.y, to.y, t));
          cursor.setAttribute("opacity", i === 0 ? t : 1);
          rowBg.setAttribute("opacity", t);
        });
        if (!alive()) return false;
        // Training folds fill in left to right, then the validation fold
        const order = rows[i].blocks.map((_, j) => j).filter((j) => j !== i);
        for (const j of order) {
          rows[i].blocks[j].classList.add("is-train");
          await HZ.wait(Math.max(18, 160 / k));
          if (!alive()) return false;
        }
        rows[i].blocks[i].classList.add("is-val");
        done = i + 1;
        syncUi();
        await HZ.wait(140);
        if (!alive()) return false;
        // The score travels from the validation fold down to the dot plot
        scoreTexts[i].setAttribute("opacity", 1);
        const d = dots[i];
        const sx = blockX(i) + L.blockW / 2, sy = y + L.rowH / 2;
        const ex = L.sx(scores[i]), ey = dotY(i);
        await HZ.tween(body, 520, (t) => {
          if (!alive()) return;
          d.setAttribute("cx", HZ.lerp(sx, ex, t));
          d.setAttribute("cy", HZ.lerp(sy, ey, t) - Math.sin(Math.PI * t) * 10);
          d.setAttribute("opacity", Math.min(1, t * 3));
        });
        if (!alive()) return false;
        rowBg.setAttribute("opacity", 0);
        return true;
      }

      async function animateSummary(id) {
        const alive = () => id === runId && body.isConnected;
        cursor.setAttribute("opacity", 0);
        summary = true;
        syncUi();
        await HZ.tween(body, 900, (t) => alive() && paintSummary(t), (t) => t);
        return alive();
      }

      async function advance(id) {
        if (done < k) return animateIteration(id);
        if (!summary) return animateSummary(id);
        return false;
      }

      async function step() {
        if (busy || summary) return;
        busy = true;
        const id = ++runId;
        syncUi();
        await advance(id);
        if (id === runId) {
          busy = false;
          cursor.setAttribute("opacity", 0);
          syncUi();
        }
      }

      async function play() {
        if (busy) return;
        const id = ++runId;
        if (summary) {
          done = 0;
          summary = false;
          paintStatic();
          await HZ.wait(200);
          if (id !== runId) return;
        }
        busy = true;
        syncUi();
        while (!summary) {
          if (!(await advance(id))) return;
          await HZ.wait(done === 1 ? 450 : 200);
          if (id !== runId || !body.isConnected) return;
        }
        busy = false;
        syncUi();
      }

      function hardReset() {
        runId++;
        busy = false;
        done = 0;
        summary = false;
        rebuild();
      }

      // Rebuild keeps progress (used for the test toggle and resizes)
      function rebuild() {
        if (busy) { runId++; busy = false; }
        L = layout(lastW || 600);
        build();
        paintStatic();
        syncUi();
      }

      function measure() {
        const w = Math.round(body.clientWidth || 600);
        if (Math.abs(w - lastW) < 2) return;
        lastW = w;
        rebuild();
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
