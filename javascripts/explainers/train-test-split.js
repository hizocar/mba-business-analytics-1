/*
 * train-test-split: Session 3. Customers are shuffled, the first 70% go into
 * a training bin and the last 30% into a test bin that gets sealed. A toggle
 * shows the mistake of grading the model on the rows it learned from.
 */
(function () {
  const { el, svg } = HZ;

  const N = 20, N_TRAIN = 14; // 70 / 30
  const CW = 38, CH = 26;

  // Two layouts: wide (desktop) and narrow (phones), so the text stays legible.
  function layout(narrow) {
    if (!narrow) {
      const gx0 = (520 - (10 * CW + 9 * 8)) / 2;
      return {
        W: 520, H: 266, narrow,
        top: { y: 18 },
        grid: (s) => ({ x: gx0 + (s % 10) * (CW + 8), y: 30 + Math.floor(s / 10) * (CH + 9) }),
        train: { x: 8, y: 122, w: 334, h: 120 },
        test: { x: 356, y: 122, w: 156, h: 120 },
        tPos: (k) => ({ x: 8 + 16 + (k % 7) * (CW + 6), y: 122 + 46 + Math.floor(k / 7) * (CH + 8) }),
        sPos: (k) => ({ x: 356 + 15 + (k % 3) * (CW + 6), y: 122 + 46 + Math.floor(k / 3) * (CH + 8) }),
      };
    }
    const gx0 = (340 - (5 * CW + 4 * 10)) / 2;
    return {
      W: 340, H: 424, narrow,
      top: { y: 18 },
      grid: (s) => ({ x: gx0 + (s % 5) * (CW + 10), y: 30 + Math.floor(s / 5) * (CH + 8) }),
      train: { x: 4, y: 176, w: 332, h: 112 },
      test: { x: 4, y: 314, w: 332, h: 84 },
      tPos: (k) => ({ x: 4 + 15 + (k % 7) * (CW + 6), y: 176 + 44 + Math.floor(k / 7) * (CH + 8) }),
      sPos: (k) => ({ x: 4 + 15 + k * (CW + 6), y: 314 + 44 }),
    };
  }

  // Fisher–Yates with the shared seeded RNG: the same "random" order every run.
  function permutation(seed) {
    const r = HZ.rng(seed);
    const p = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    return p; // p[slot] = customer id
  }

  const css = `
.md-typeset .hz-tts-fig { max-width: 40rem; margin: 0 auto; }
.md-typeset .hz-x svg.hz-tts-fig text { font-size: 12.5px; }
.md-typeset .hz-tts-chip rect { fill: var(--md-default-bg-color); stroke: var(--hz-line); stroke-width: 1.3; transition: fill 260ms ease, stroke 260ms ease; }
.md-typeset .hz-x svg .hz-tts-chip text { font-size: 12px; fill: var(--md-default-fg-color); transition: fill 260ms ease; }
.md-typeset .hz-tts-chip.is-train rect { fill: var(--hz-b-soft); stroke: var(--hz-b); }
.md-typeset .hz-tts-chip.is-test rect { fill: var(--hz-a-soft); stroke: var(--hz-a); }
.md-typeset .hz-tts-bin { fill: none; stroke: var(--hz-line); stroke-width: 1.3; stroke-dasharray: 5 4; transition: stroke 250ms ease, stroke-width 250ms ease; }
.md-typeset .hz-tts-bin.is-graded { stroke: var(--hz-good); stroke-width: 2.5; stroke-dasharray: none; }
.md-typeset .hz-tts-bin.is-cheat { stroke: var(--hz-bad); stroke-width: 2.5; stroke-dasharray: none; }
.md-typeset .hz-x svg .hz-tts-binlab { font-weight: 600; fill: var(--md-default-fg-color); }
.md-typeset .hz-x svg .hz-tts-binlab.is-train { fill: var(--hz-b); }
.md-typeset .hz-x svg .hz-tts-binlab.is-test { fill: var(--hz-a); }
.md-typeset .hz-x svg .hz-tts-binsub { font-size: 12px; fill: var(--hz-muted); }
.md-typeset .hz-x svg .hz-tts-grade { font-size: 12px; font-weight: 700; }
.md-typeset .hz-x svg .hz-tts-grade.is-good { fill: var(--hz-good); }
.md-typeset .hz-x svg .hz-tts-grade.is-bad { fill: var(--hz-bad); }
.md-typeset .hz-tts-seal { fill: var(--hz-card); }
.md-typeset .hz-tts-ghosts rect { fill: none; stroke: var(--hz-line); stroke-width: 1; stroke-dasharray: 3 3; }
.md-typeset .hz-tts-ghosts { transition: opacity 300ms ease; }
.md-typeset .hz-tts-lock rect, .md-typeset .hz-tts-lock path { stroke: var(--hz-a); stroke-width: 2.2; fill: none; }
.md-typeset .hz-tts-lock rect { fill: var(--hz-a-soft); }
.md-typeset .hz-x svg .hz-tts-locklab { font-size: 12px; fill: var(--hz-a); font-weight: 600; }
.md-typeset .hz-tts-pills { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.md-typeset .hz-tts-pill { display: inline-flex; align-items: center; gap: 0.4em; font-size: 0.66rem; padding: 0.2em 0.75em 0.2em 0.3em; border-radius: 999px; border: 1px solid var(--hz-line); color: var(--hz-muted); transition: all 200ms ease; }
.md-typeset .hz-tts-pill b { display: inline-grid; place-items: center; width: 1.5em; height: 1.5em; border-radius: 50%; font-family: var(--md-code-font); font-size: 0.9em; background: var(--hz-line); color: var(--md-default-fg-color); }
.md-typeset .hz-tts-pill.is-on { border-color: var(--hz-a); color: var(--md-default-fg-color); background: var(--hz-a-soft); }
.md-typeset .hz-tts-pill.is-on b { background: var(--hz-a); color: var(--hz-card); }
.md-typeset .hz-tts-pill.is-done { color: var(--md-default-fg-color--light); }
.md-typeset .hz-tts-grader { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; font-size: 0.72rem; }
.md-typeset .hz-tts .hz-x__note { min-height: 4.2em; }
`;

  HZ.register("train-test-split", {
    kicker: "Session 3",
    title: "Train and test: a sealed envelope",
    css,
    mount(body) {
      body.classList.add("hz-tts", "tex2jax_ignore"); // keep MathJax away from the dollar amounts
      let stage = 0, busy = false, runId = 0, grade = "test", seed = 42, perm = permutation(seed);
      let L = layout(false);

      body.append(el("p", { class: "hz-x__lede", html:
        "Each chip is one customer. <code>train_test_split</code> shuffles them, deals the first 70% into a <strong>training set</strong> the model learns from, and seals the other 30% in a <strong>test set</strong> that we open only once, at the end." }));

      const names = ["Shuffle", "Split 70 / 30", "Deal into sets", "Seal the test set"];
      const pills = names.map((n, i) => el("span", { class: "hz-tts-pill" }, [el("b", { text: i + 1 }), n]));
      const playBtn = HZ.button("Play", () => play(), "primary");
      const stepBtn = HZ.button("Step", () => step());
      const resetBtn = HZ.button("Reset", () => reset());
      const gradeSeg = HZ.segmented(
        [{ value: "test", label: "Test set" }, { value: "train", label: "Training set (the mistake)" }],
        grade,
        (v) => setGrade(v)
      );
      body.append(
        el("div", { class: "hz-tts-pills", "aria-hidden": "true" }, pills),
        el("div", { class: "hz-x__controls" }, [playBtn, stepBtn, resetBtn])
      );

      const fig = svg("svg", { class: "hz-tts-fig", role: "img", "aria-label": "Twenty customers shuffled and split into a training set and a sealed test set" });
      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      body.append(
        fig,
        el("div", { class: "hz-tts-grader" }, [el("span", { text: "Grade the model on:" }), gradeSeg.node]),
        note
      );

      // --- Scene
      let chips = [], pos = [], ghosts, trainBin, testBin, seal, lock, trainGrade, testGrade, topLab;
      function build() {
        fig.replaceChildren();
        fig.setAttribute("viewBox", `0 0 ${L.W} ${L.H}`);
        topLab = svg("text", { x: L.W / 2, y: L.top.y, "text-anchor": "middle", class: "hz-tts-binsub", text: "all 20 customers, in file order" });
        fig.append(topLab);

        const bin = (b, cls, title, sub) => {
          const g = svg("g");
          const r = svg("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 12, class: "hz-tts-bin" });
          g.append(r,
            svg("text", { x: b.x + 14, y: b.y + 20, class: "hz-tts-binlab " + cls, text: title }),
            svg("text", { x: b.x + 14, y: b.y + 36, class: "hz-tts-binsub", text: sub }));
          fig.append(g);
          return r;
        };
        trainBin = bin(L.train, "is-train", "Training set · 70%", "the model learns from these");
        testBin = bin(L.test, "is-test", "Test set · 30%", L.narrow ? "kept aside to grade the model" : "kept aside to grade");
        const under = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h + 17, "text-anchor": "middle", opacity: 0 });
        trainGrade = svg("text", { ...under(L.train), class: "hz-tts-grade is-bad", text: "graded here: flattering" });
        testGrade = svg("text", { ...under(L.test), class: "hz-tts-grade is-good", text: "graded here: honest" });
        fig.append(trainGrade, testGrade);

        // Empty outlines of the original table, shown once the customers have left it
        ghosts = svg("g", { class: "hz-tts-ghosts", opacity: 0 });
        for (let i = 0; i < N; i++) {
          const p = L.grid(i);
          ghosts.append(svg("rect", { x: p.x, y: p.y, width: CW, height: CH, rx: 7 }));
        }
        fig.append(ghosts);

        chips = [];
        for (let i = 0; i < N; i++) {
          const g = svg("g", { class: "hz-tts-chip" });
          g.append(svg("rect", { width: CW, height: CH, rx: 7 }), svg("text", { x: CW / 2, y: CH / 2 + 4.5, "text-anchor": "middle", text: "#" + String(i + 1).padStart(2, "0") }));
          fig.append(g);
          chips.push(g);
        }

        // The seal sits above the test chips.
        const t = L.test;
        seal = svg("g", { opacity: 0 });
        seal.append(svg("rect", { x: t.x + 2, y: t.y + 40, width: t.w - 4, height: t.h - 44, rx: 10, class: "hz-tts-seal", opacity: 0.9 }));
        const cx = t.x + t.w / 2, cy = t.y + 40 + (t.h - 44) / 2;
        lock = svg("g", { class: "hz-tts-lock", transform: `translate(${cx} ${cy - 4})` });
        lock.append(svg("path", { d: "M -7 -4 V -10 a 7 7 0 0 1 14 0 V -4" }), svg("rect", { x: -11, y: -4, width: 22, height: 16, rx: 3 }));
        seal.append(lock, svg("text", { x: cx, y: cy + 28, "text-anchor": "middle", class: "hz-tts-locklab", text: "sealed until the end" }));
        if (L.narrow) {
          lock.setAttribute("transform", `translate(${cx - 84} ${cy})`);
          seal.lastChild.setAttribute("x", cx - 62);
          seal.lastChild.setAttribute("y", cy + 8);
          seal.lastChild.setAttribute("text-anchor", "start");
        }
        fig.append(seal);
      }

      // Where each customer sits at a given stage
      function target(id, s) {
        const slot = s >= 1 ? perm.indexOf(id) : id;
        if (s < 3) return L.grid(slot);
        return slot < N_TRAIN ? L.tPos(slot) : L.sPos(slot - N_TRAIN);
      }
      function place(id, p) {
        pos[id] = p;
        chips[id].setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      }
      function colour(id, on) {
        const slot = perm.indexOf(id);
        chips[id].classList.toggle("is-train", on && slot < N_TRAIN);
        chips[id].classList.toggle("is-test", on && slot >= N_TRAIN);
      }
      function paintStatic() {
        for (let i = 0; i < N; i++) {
          place(i, target(i, stage));
          colour(i, stage >= 2);
        }
        topLab.textContent = stage === 0 ? "all 20 customers, in file order" : stage < 3 ? "shuffled with random_state=" + seed : (L.narrow ? "the table, now split in two" : "every customer has left the table for one of the two sets");
        ghosts.setAttribute("opacity", stage >= 3 ? 1 : 0);
        seal.setAttribute("opacity", stage >= 4 ? 1 : 0);
        paintGrade();
      }
      function paintGrade() {
        const on = stage >= 4;
        trainBin.classList.toggle("is-cheat", on && grade === "train");
        testBin.classList.toggle("is-graded", on && grade === "test");
        trainGrade.setAttribute("opacity", on && grade === "train" ? 1 : 0);
        testGrade.setAttribute("opacity", on && grade === "test" ? 1 : 0);
      }

      // --- Motion
      function moveChips(toStage, ms, stagger, id) {
        const from = pos.map((p) => ({ ...p }));
        const to = Array.from({ length: N }, (_, i) => target(i, toStage));
        const order = Array.from({ length: N }, (_, i) => (toStage >= 3 ? perm.indexOf(i) : i));
        const total = ms + stagger * (N - 1);
        return HZ.tween(body, total, (k) => {
          if (id !== runId) return;
          const now = k * total;
          for (let i = 0; i < N; i++) {
            const t = HZ.easeInOut(HZ.clamp((now - order[i] * stagger) / ms, 0, 1));
            // a small arc makes each chip's journey easy to follow
            const lift = Math.sin(Math.PI * t) * (toStage >= 3 ? 18 : 10);
            place(i, { x: HZ.lerp(from[i].x, to[i].x, t), y: HZ.lerp(from[i].y, to[i].y, t) - lift });
          }
        }, (t) => t);
      }

      async function advance(id) {
        const to = stage + 1;
        stage = to;
        syncUi();
        const alive = () => id === runId && body.isConnected;
        if (to === 1) {
          topLab.textContent = "shuffled with random_state=" + seed;
          await moveChips(1, 520, 18, id);
        } else if (to === 2) {
          for (let s = 0; s < N; s++) {
            if (!alive()) return false;
            colour(perm[s], true);
            await HZ.wait(35);
          }
        } else if (to === 3) {
          topLab.textContent = "";
          ghosts.setAttribute("opacity", 1);
          await moveChips(3, 560, 45, id);
        } else if (to === 4) {
          await HZ.tween(body, 420, (k) => alive() && seal.setAttribute("opacity", k));
          paintGrade();
        }
        if (alive()) paintStatic();
        return alive();
      }

      async function step() {
        if (busy || stage >= 4) return;
        busy = true;
        const id = ++runId;
        syncUi();
        await advance(id);
        if (id === runId) {
          busy = false;
          syncUi();
        }
      }

      async function play() {
        if (busy) return;
        const id = ++runId;
        if (stage === 4) {
          stage = 0;
          seed += 1; // a replay shows that another seed gives another (equally valid) split
          perm = permutation(seed);
          paintStatic();
          syncUi();
          await HZ.wait(300);
          if (id !== runId) return;
        }
        busy = true;
        syncUi();
        while (stage < 4) {
          if (!(await advance(id))) return;
          if (stage < 4) await HZ.wait(450);
          if (id !== runId || !body.isConnected) return;
        }
        busy = false;
        syncUi();
      }

      function reset() {
        runId++;
        busy = false;
        stage = 0;
        seed = 42;
        perm = permutation(seed);
        paintStatic();
        syncUi();
      }

      function setGrade(v) {
        grade = v;
        if (stage < 4) {
          runId++;
          busy = false;
          stage = 4;
          paintStatic();
        }
        paintGrade();
        syncUi();
      }

      function caption() {
        const c = (s) => "<code>" + s + "</code>";
        if (stage >= 4 && grade === "train")
          return "<strong>The mistake:</strong> grading on the training customers is an exam where the student already saw the answers. The model has seen these exact bills, so the score flatters it. A model that simply memorized them would look perfect here and still fail on the next customer who walks in.";
        if (stage >= 4)
          return "<strong>Sealed.</strong> We fit and compare models using only the training set. The test set is opened once, at the end, to answer the only question the commercial team cares about: how far off are we on customers the model has never seen?";
        if (stage === 3) return "Every customer lands in exactly one set: 14 for training, 6 for testing. On the real table that is 3,489 and 1,496 customers.";
        if (stage === 2) return "The first 70% of the shuffled order go to training (teal), the last 30% to testing (orange). " + c("test_size=0.3") + " sets that share.";
        if (stage === 1) return "Shuffled first, because files are often sorted (by signup date, by region). Without shuffling, the test set could be only the newest customers. " + c("random_state=" + seed) + " makes the shuffle repeatable" + (seed !== 42 ? ": a different seed gives a different, equally valid split." : ".");
        return "The customer table in the order it came from the file. Press <strong>Play</strong> to split it the way " + c("train_test_split(X, y, test_size=0.3, random_state=42)") + " does.";
      }

      function syncUi() {
        pills.forEach((p, k) => {
          p.classList.toggle("is-on", stage === k + 1);
          p.classList.toggle("is-done", stage > k + 1);
        });
        playBtn.disabled = busy;
        stepBtn.disabled = busy || stage >= 4;
        playBtn.textContent = stage === 4 && !busy ? "Replay with another seed" : "Play";
        gradeSeg.set(grade);
        note.innerHTML = caption();
      }

      // --- Size tracking: switch layouts below ~460px
      function measure() {
        const w = body.clientWidth || 600;
        const narrow = w < 460;
        if (chips.length && narrow === L.narrow) return;
        runId++;
        busy = false;
        L = layout(narrow);
        build();
        paintStatic();
        syncUi();
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
