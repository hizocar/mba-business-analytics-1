/* Session 4: the accuracy trap. 100 Cordillera customers, some of whom will
   cancel. A model that always says "stays" is right about every stayer, so its
   accuracy equals the share of stayers, while it catches no churner at all. */
(function () {
  const { el, svg, slider, segmented, stats, rng, tween } = HZ;

  const N = 100, COLS = 10, CELL = 44, PAD = 6;
  const W = COLS * CELL + 2 * PAD, H = (N / COLS) * CELL + 2 * PAD;

  // Fixed shuffle: the first k positions of this order are the churners, so
  // moving the slider adds or removes churners without reshuffling the grid.
  function order() {
    const r = rng(404);
    const idx = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const rank = new Array(N);
    idx.forEach((cellIdx, r_) => (rank[cellIdx] = r_));
    return rank;
  }

  function mount(body) {
    body.classList.add("hz-at");
    const rank = order();
    let k = 16; // churners out of 100
    let mode = "none";

    const fig = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-at-grid", role: "img", "aria-label": "100 customers; orange ones will cancel" });
    const icons = [];
    for (let i = 0; i < N; i++) {
      const cx = PAD + (i % COLS) * CELL + CELL / 2;
      const cy = PAD + Math.floor(i / COLS) * CELL + CELL / 2;
      const tile = svg("rect", { class: "hz-at-tile", x: -19, y: -19, width: 38, height: 38, rx: 8 });
      const head = svg("circle", { class: "hz-at-person", cx: 0, cy: -7, r: 6 });
      const torso = svg("path", { class: "hz-at-person", d: "M -10 14 Q -10 1 0 1 Q 10 1 10 14 Z" });
      const badge = svg("g", { class: "hz-at-badge", transform: "translate(13 -13)" }, [
        svg("circle", { r: 6.5 }),
        svg("path", { d: "M -3 -3 L 3 3 M 3 -3 L -3 3" }),
      ]);
      const g = svg("g", { class: "hz-at-icon", transform: `translate(${cx} ${cy})` }, [tile, head, torso, badge]);
      // Diagonal sweep when a model is applied
      g.style.setProperty("--d", ((i % COLS) + Math.floor(i / COLS)) * 22 + "ms");
      fig.append(g);
      icons.push(g);
    }

    const meter = (label, cls) => {
      const fill = el("span", { class: "hz-at-fill " + cls });
      const val = el("b", { text: "–" });
      const node = el("div", { class: "hz-at-meter" }, [el("span", { class: "hz-at-mlabel", text: label }), val, el("span", { class: "hz-at-track" }, [fill])]);
      return { node, set(v) { fill.style.width = v === null ? "0%" : v * 100 + "%"; val.textContent = v === null ? "–" : Math.round(v * 100) + "%"; } };
    };
    const acc = meter("Accuracy", "is-acc");
    const rec = meter("Recall: churners caught", "is-rec");
    const readout = stats();
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });

    const seg = segmented(
      [
        { value: "none", label: "No model" },
        { value: "stay", label: "Always “stays”" },
        { value: "leave", label: "Always “leaves”" },
      ],
      mode,
      (v) => { mode = v; draw(true); }
    );
    seg.node.setAttribute("aria-label", "Which model predicts");
    const s = slider({ label: "Churn rate", min: 5, max: 50, step: 1, value: k, format: (v) => v + "%", oninput: (v) => { k = v; draw(false); } });

    let run = 0;
    function draw(sweep) {
      const id = ++run;
      fig.classList.toggle("is-sweep", sweep && !HZ.reducedMotion());
      icons.forEach((g, i) => {
        const churner = rank[i] < k;
        const pred = mode === "none" ? null : mode === "leave";
        g.classList.toggle("is-churn", churner);
        g.classList.toggle("is-pred", pred !== null);
        g.classList.toggle("is-pred-leave", pred === true);
        g.classList.toggle("is-wrong", pred !== null && pred !== churner);
      });
      // Remove the stagger once the sweep is done, so slider moves feel immediate
      if (sweep) tween(body, 700, () => {}).then(() => { if (id === run) fig.classList.remove("is-sweep"); });

      const stay = N - k;
      if (mode === "none") {
        acc.set(null);
        rec.set(null);
        readout.set([["Will leave", `${k} of 100`, "is-a"], ["Will stay", `${stay} of 100`, "is-b"]]);
        note.innerHTML = `Orange customers will cancel, teal ones will stay: <strong>${k} of these 100</strong> are leaving. Pick a model above and see how it scores.`;
      } else if (mode === "stay") {
        acc.set(stay / N);
        rec.set(0);
        readout.set([["Correct", `${stay} of 100`], ["Churners caught", `0 of ${k}`, "is-bad"], ["Calls made", "0"]]);
        note.innerHTML =
          k <= 20
            ? `Right about all ${stay} stayers, so accuracy is <strong>${stay}%</strong>, and not one of the ${k} leavers is caught. Accuracy just repeats the share of customers who stay.`
            : `With ${k}% churn the same lazy model drops to ${stay}% accuracy. It only looked good because churn was rare; it never caught anyone.`;
      } else {
        acc.set(k / N);
        rec.set(1);
        readout.set([["Correct", `${k} of 100`], ["Churners caught", `${k} of ${k}`, "is-good"], ["Wasted calls", String(stay), "is-bad"]]);
        note.innerHTML = `Calling everyone catches all ${k} leavers (recall 100%), but accuracy falls to <strong>${k}%</strong> and ${stay} offers go to people who would have stayed. Neither extreme is a model: we need one that tells them apart.`;
      }
    }

    body.append(
      el("p", { class: "hz-x__lede", html: "Each icon is a Cordillera customer; the colour is what <em>really</em> happens. The tile behind it is what the model <em>predicts</em>, and a red cross marks a mistake." }),
      el("div", { class: "hz-x__controls" }, [seg.node, s.node]),
      el("div", { class: "hz-x__split" }, [
        el("div", {}, [
          fig,
          el("div", { class: "hz-legend" }, [
            el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "will leave"]),
            el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "will stay"]),
            el("span", {}, [el("i", { style: "background: var(--hz-b-soft); border: 1px solid var(--hz-b); border-radius: 3px" }), "tile: predicts “stays”"]),
            el("span", {}, [el("i", { style: "background: var(--hz-a-soft); border: 1px solid var(--hz-a); border-radius: 3px" }), "tile: predicts “leaves”"]),
            el("span", {}, [el("i", { style: "background: var(--hz-bad)" }), "model is wrong"]),
          ]),
        ]),
        el("div", { class: "hz-at-side" }, [acc.node, rec.node, readout.node]),
      ]),
      note
    );
    draw(false);
  }

  HZ.register("accuracy-trap", {
    kicker: "Session 4",
    title: "The accuracy trap",
    mount,
    css: `
.md-typeset .hz-at-grid { max-width: 26rem; margin: 0 auto; }
.md-typeset .hz-at-tile { fill: transparent; stroke: var(--hz-line); stroke-width: 1; transition: fill 260ms ease, stroke 260ms ease; }
.md-typeset .hz-at-person { fill: var(--hz-b); transition: fill 300ms ease; }
.md-typeset .hz-at-icon.is-churn .hz-at-person { fill: var(--hz-a); }
.md-typeset .hz-at-icon.is-pred .hz-at-tile { fill: var(--hz-b-soft); stroke: var(--hz-b); }
.md-typeset .hz-at-icon.is-pred-leave .hz-at-tile { fill: var(--hz-a-soft); stroke: var(--hz-a); }
.md-typeset .hz-at-icon.is-wrong .hz-at-tile { stroke: var(--hz-bad); stroke-width: 2; }
.md-typeset .hz-at-badge { opacity: 0; transform-box: fill-box; transition: opacity 200ms ease; }
.md-typeset .hz-at-badge circle { fill: var(--hz-bad); }
.md-typeset .hz-at-badge path { stroke: var(--hz-card); stroke-width: 1.8; stroke-linecap: round; }
.md-typeset .hz-at-icon.is-wrong .hz-at-badge { opacity: 1; }
.md-typeset .hz-at-grid.is-sweep .hz-at-tile, .md-typeset .hz-at-grid.is-sweep .hz-at-badge { transition-delay: var(--d); }
.md-typeset .hz-at-side { display: flex; flex-direction: column; gap: 0.9rem; }
.md-typeset .hz-at-meter { display: grid; grid-template-columns: 1fr auto; gap: 0.25rem 0.6rem; align-items: baseline; }
.md-typeset .hz-at-mlabel { font-size: 0.7rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-at-meter b { font-family: var(--md-code-font); font-size: 1.35rem; font-weight: 500; font-variant-numeric: tabular-nums; }
.md-typeset .hz-at-track { grid-column: 1 / -1; height: 0.6rem; border-radius: 999px; background: var(--hz-grid); overflow: hidden; }
.md-typeset .hz-at-fill { display: block; height: 100%; width: 0; border-radius: 999px; transition: width 500ms cubic-bezier(0.65, 0, 0.35, 1); }
.md-typeset .hz-at-fill.is-acc { background: var(--hz-ink); }
.md-typeset .hz-at-fill.is-rec { background: var(--hz-a); }
.md-typeset .hz-at .hz-x__note { min-height: 4.2em; }
`,
  });
})();
