/* Session 5: a random forest is many small trees voting. Each tree is grown
   (for real, with Gini) on its own bootstrap sample of 100 simulated
   Cordillera customers and may only use three of six features. A customer
   walks down every tree; the votes stack into a churn probability. */
(function () {
  const { el, svg, button, wait, rng } = HZ;

  const N_POOL = 100, N_TREES = 9, DEPTH = 2, MIN_LEAF = 4;
  const POOL_SEED = 5, FOREST_SEED = 4;
  // index: 0 tenure, 1 tickets, 2 month-to-month, 3 Norte, 4 autopay, 5 USD above plan
  const FEATS = [
    { chip: "tenure", q: (t) => `tenure ≥ ${Math.floor(t) + 1}?`, int: true },
    { chip: "tickets", q: (t) => `tickets ≥ ${Math.floor(t) + 1}?`, int: true },
    { chip: "no contract", q: () => "no contract?" },
    { chip: "Norte", q: () => "in the Norte?" },
    { chip: "autopay", q: () => "autopay?" },
    { chip: "extra $", q: (t) => `extra ≥ $${Math.floor(t) + 1}?`, int: true },
  ];
  const PROFILES = [
    { name: "Customer A", v: [3, 1, 1, 0, 0, 4], tags: ["3 months with us", "1 ticket", "no contract", "Metropolitana", "no autopay", "bill $4 above plan"] },
    { name: "Customer B", v: [40, 0, 0, 0, 1, 2], tags: ["40 months with us", "0 tickets", "24-month contract", "Sur", "autopay", "bill $2 above plan"] },
    { name: "Customer C", v: [15, 2, 0, 1, 1, 13], tags: ["15 months with us", "2 tickets", "12-month contract", "Norte", "autopay", "bill $13 above plan"] },
    { name: "Customer D", v: [22, 3, 1, 1, 0, 15], tags: ["22 months with us", "3 tickets", "no contract", "Norte", "no autopay", "bill $15 above plan"] },
    { name: "Customer E", v: [30, 4, 1, 0, 0, 5], tags: ["30 months with us", "4 tickets", "no contract", "Centro", "no autopay", "bill $5 above plan"] },
  ];

  function makePool(seed, n) {
    const r = rng(seed);
    const pois = (lam) => { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; };
    const pool = [];
    for (let i = 0; i < n; i++) {
      const tenure = 1 + Math.floor(r() * 60);
      const norte = r() < 0.25 ? 1 : 0;
      const tickets = Math.min(5, pois(norte ? 1.6 : 0.8));
      const mtm = r() < 0.5 ? 1 : 0;
      const autopay = r() < 0.45 ? 1 : 0;
      const extra = Math.round(20 * r() * r());
      // the same kind of thresholds and interactions as the real data
      const z = -1.7 + 0.9 * mtm + 0.15 * tickets - 0.012 * tenure - 0.6 * autopay + 1.8 * (tenure < 6)
        + 1.8 * (norte && tickets >= 2) + 1.4 * (mtm && tickets >= 3) + 1.2 * (extra > 12);
      pool.push({ v: [tenure, tickets, mtm, norte, autopay, extra], y: r() < 1 / (1 + Math.exp(-z)) ? 1 : 0 });
    }
    return pool;
  }

  const gini = (c, n) => (n ? 1 - (c / n) ** 2 - (1 - c / n) ** 2 : 0);
  let nid = 0;
  function fit(sample, feats, depth) {
    const n = sample.reduce((s, p) => s + p.w, 0), c = sample.reduce((s, p) => s + p.w * p.y, 0);
    const node = { id: nid++, n, c, cls: c / n >= 0.5 ? 1 : 0 };
    if (depth === 0 || c === 0 || c === n) return node;
    let best = null;
    for (const f of feats) {
      const vals = [...new Set(sample.map((p) => p.v[f]))].sort((a, b) => a - b);
      for (let i = 0; i < vals.length - 1; i++) {
        const thr = (vals[i] + vals[i + 1]) / 2;
        let nl = 0, cl = 0;
        sample.forEach((p) => { if (p.v[f] <= thr) { nl += p.w; cl += p.w * p.y; } });
        const nr = n - nl, cr = c - cl;
        if (nl < MIN_LEAF || nr < MIN_LEAF) continue;
        const g = (nl * gini(cl, nl) + nr * gini(cr, nr)) / n;
        if (!best || g < best.g - 1e-12) best = { g, f, thr };
      }
    }
    if (!best) return node;
    Object.assign(node, best);
    node.left = fit(sample.filter((p) => p.v[best.f] <= best.thr), feats, depth - 1);
    node.right = fit(sample.filter((p) => p.v[best.f] > best.thr), feats, depth - 1);
    return node;
  }

  function buildForest(pool) {
    const r = rng(FOREST_SEED);
    const trees = [];
    for (let k = 0; k < N_TREES; k++) {
      // bootstrap: draw N customers with replacement
      const counts = new Array(pool.length).fill(0);
      for (let i = 0; i < pool.length; i++) counts[Math.floor(r() * pool.length)]++;
      // random features: three of the six
      const idx = [0, 1, 2, 3, 4, 5];
      for (let i = 5; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      const feats = idx.slice(0, 3).sort();
      const sample = pool.map((p, i) => ({ v: p.v, y: p.y, w: counts[i] })).filter((p) => p.w);
      trees.push({ counts, feats, root: fit(sample, feats, DEPTH) });
    }
    return trees;
  }

  function route(root, v) {
    const path = [root];
    let n = root;
    while (n.left) {
      n = v[n.f] <= n.thr ? n.left : n.right;
      path.push(n);
    }
    return path;
  }

  // Mini tree diagram: root, up to two children, up to four leaves.
  const TW = 220, TH = 134;
  const POS = { 0: [[110, 20]], 1: [[56, 68], [164, 68]], 2: [[29, 114], [83, 114], [137, 114], [191, 114]] };

  function drawTree(tree) {
    const g = svg("svg", { viewBox: `0 0 ${TW} ${TH}`, class: "hz-fv-tree", role: "img", "aria-label": "A small decision tree" });
    const edges = svg("g"), nodes = svg("g");
    g.append(edges, nodes);
    const parts = {};
    (function place(n, depth, slot, parent) {
      const [x, y] = POS[depth][slot];
      if (parent) {
        const [px, py] = parent.xy;
        const side = slot % 2 ? "yes" : "no";
        const e = svg("g", { class: "hz-fv-edge" }, [
          svg("path", { d: `M${px},${py + 12}C${px},${(py + y) / 2} ${x},${(py + y) / 2} ${x},${y - 12}` }),
          svg("text", { x: (px + x) / 2 + (slot % 2 ? 9 : -9), y: (py + y) / 2 + 3, "text-anchor": slot % 2 ? "start" : "end", text: side }),
        ]);
        edges.append(e);
        parts["e" + n.id] = e;
      }
      let node;
      if (n.left) {
        const label = FEATS[n.f].q(n.thr);
        const w = Math.max(84, label.length * 7.4 + 14);
        node = svg("g", { class: "hz-fv-q", transform: `translate(${x},${y})` }, [
          svg("rect", { x: -w / 2, y: -12, width: w, height: 24, rx: 7 }),
          svg("text", { y: 4.5, "text-anchor": "middle", text: label }),
        ]);
      } else {
        node = svg("g", { class: "hz-fv-leaf " + (n.cls ? "is-churn" : "is-stay"), transform: `translate(${x},${y})` }, [
          svg("rect", { x: -24, y: -11, width: 48, height: 22, rx: 11 }),
          svg("text", { y: 4, "text-anchor": "middle", text: n.cls ? "churn" : "stay" }),
        ]);
      }
      node.append(svg("title", { text: `${n.n} customers in this tree's sample, ${n.c} churned` }));
      nodes.append(node);
      parts["n" + n.id] = node;
      n.xy = [x, y];
      if (n.left) {
        place(n.left, depth + 1, slot * 2, n);
        place(n.right, depth + 1, slot * 2 + 1, n);
      }
    })(tree.root, 0, 0, null);
    return { node: g, parts };
  }

  // Bootstrap sample: 100 customers as a 10 × 10 grid.
  function drawSample(tree, pool) {
    const s = svg("svg", { viewBox: "0 0 62 62", class: "hz-fv-sample", role: "img", "aria-label": "Which customers this tree was trained on" });
    pool.forEach((p, i) => {
      const k = tree.counts[i];
      s.append(svg("rect", {
        x: 1 + (i % 10) * 6, y: 1 + Math.floor(i / 10) * 6, width: 5, height: 5, rx: 1,
        class: "hz-fv-cell " + (p.y ? "is-churn" : "is-stay") + (k === 0 ? " is-out" : k > 1 ? " is-multi" : ""),
      }));
    });
    return s;
  }

  function mount(body) {
    const pool = makePool(POOL_SEED, N_POOL);
    nid = 0;
    const trees = buildForest(pool);
    // How good are single trees vs the forest on 2,000 fresh customers?
    const fresh = makePool(999, 2000);
    const voteOf = (v) => trees.reduce((s, t) => s + route(t.root, v).at(-1).cls, 0);
    const accTree = trees.reduce((s, t) => s + fresh.filter((p) => route(t.root, p.v).at(-1).cls === p.y).length, 0) / (fresh.length * N_TREES);
    const accForest = fresh.filter((p) => (voteOf(p.v) * 2 > N_TREES ? 1 : 0) === p.y).length / fresh.length;

    const cards = trees.map((t, k) => {
      const diagram = drawTree(t);
      const drawn = t.counts.filter((c) => c > 0).length;
      const card = el("div", { class: "hz-fv-card" }, [
        el("div", { class: "hz-fv-card__head" }, [
          el("div", {}, [
            el("p", { class: "hz-fv-card__name", text: `Tree ${k + 1}` }),
            el("p", { class: "hz-fv-card__meta", text: `${drawn} different customers` }),
            el("div", { class: "hz-fv-chips" }, FEATS.map((F, f) => el("span", { class: "hz-fv-chip" + (t.feats.includes(f) ? " is-on" : ""), text: F.chip }))),
          ]),
          drawSample(t, pool),
        ]),
        diagram.node,
      ]);
      return { card, parts: diagram.parts, tree: t };
    });

    const gridEl = el("div", { class: "hz-fv-grid" }, cards.map((c) => c.card));
    const profileName = el("strong");
    const profileTags = el("div", { class: "hz-fv-tags" });
    const slots = trees.map((_, k) => el("span", { class: "hz-fv-slot", title: `Tree ${k + 1}` }, String(k + 1)));
    const meterFill = el("span", { class: "hz-fv-meter__fill" });
    const meterText = el("p", { class: "hz-fv-meter__text" });
    const note = el("p", { class: "hz-x__note" });

    let who = 0;
    let run = 0;
    let next = 0; // next tree to run in step mode
    let votes = 0;

    function setProfile() {
      const P = PROFILES[who];
      profileName.textContent = P.name;
      profileTags.replaceChildren(...P.tags.map((t) => el("span", { class: "hz-fv-tag", text: t })));
    }

    function reset() {
      run++;
      next = 0;
      votes = 0;
      cards.forEach((c) => {
        c.card.classList.remove("is-done", "is-active");
        Object.values(c.parts).forEach((p) => p.classList.remove("is-path", "is-hit", "is-dim"));
      });
      slots.forEach((s) => { s.className = "hz-fv-slot"; });
      showVotes(0);
      note.innerHTML = `Each tree was grown on its own <strong>bootstrap sample</strong>: the grid shows the 100 customers, filled = drawn for this tree (darker = drawn twice or more), empty = never drawn. Each tree could also use only <strong>three of the six features</strong> (the highlighted chips). Press "Run the forest".`;
      stepBtn.disabled = false;
    }

    function showVotes(done) {
      const p = done ? votes / done : 0;
      meterFill.style.width = (100 * votes) / N_TREES + "%";
      meterText.innerHTML = done
        ? `<strong>${votes} of ${done}</strong> tree${done === 1 ? "" : "s"} say churn` + (done === N_TREES ? ` → churn risk <strong>${(votes / N_TREES).toFixed(2)}</strong> → ${votes * 2 > N_TREES ? "<span class=\"is-call\">call this customer</span>" : "no call needed"}` : ` so far (${p.toFixed(2)})`)
        : "No votes yet";
    }

    // One tree: light the path node by node, then cast the vote.
    async function runTree(k, id) {
      const c = cards[k];
      const path = route(c.tree.root, PROFILES[who].v);
      c.card.classList.add("is-active");
      // narrow screens: the cards scroll sideways, so follow the active tree
      if (gridEl.scrollWidth > gridEl.clientWidth + 4) {
        const dx = c.card.getBoundingClientRect().left - gridEl.getBoundingClientRect().left;
        gridEl.scrollTo({ left: gridEl.scrollLeft + dx, behavior: HZ.reducedMotion() ? "auto" : "smooth" });
      }
      for (let i = 0; i < path.length; i++) {
        if (id !== run) return;
        const n = path[i];
        if (i) c.parts["e" + n.id].classList.add("is-path");
        c.parts["n" + n.id].classList.add("is-path");
        await wait(200);
      }
      if (id !== run) return;
      const leaf = path.at(-1);
      c.parts["n" + leaf.id].classList.add("is-hit");
      const onPath = new Set(path.map((n) => n.id));
      Object.entries(c.parts).forEach(([key, p]) => { if (!onPath.has(+key.slice(1))) p.classList.add("is-dim"); });
      c.card.classList.remove("is-active");
      c.card.classList.add("is-done");
      votes += leaf.cls;
      slots[k].classList.add("is-on", leaf.cls ? "is-churn" : "is-stay");
      slots[k].textContent = leaf.cls ? "C" : "S";
      showVotes(k + 1);
      const missing = FEATS.filter((_, f) => !c.tree.feats.includes(f)).map((F) => F.chip);
      note.innerHTML = k === N_TREES - 1
        ? `The forest's answer is the share of trees that say churn: <strong>${votes}/${N_TREES} = ${(votes / N_TREES).toFixed(2)}</strong>. Single trees disagree because each saw different customers and features. On 2,000 new simulated customers a single tree here is right ${Math.round(accTree * 100)}% of the time; the vote of all nine, ${Math.round(accForest * 100)}%.`
        : `Tree ${k + 1} never got to use ${missing.join(", ")}. Following its questions, ${PROFILES[who].name} lands in a leaf where most customers of its sample ${leaf.cls ? "<strong>churned</strong>" : "<strong>stayed</strong>"} (${leaf.c} of ${leaf.n}), so it votes <strong>${leaf.cls ? "churn" : "stay"}</strong>.`;
    }

    let busyId = null;
    async function runAll() {
      if (busyId === run) return;
      if (next >= N_TREES) reset();
      const id = run;
      busyId = id;
      stepBtn.disabled = true;
      const jobs = [];
      for (let k = next; k < N_TREES; k++) {
        jobs.push(runTree(k, id));
        next = k + 1;
        await wait(260);
        if (id !== run) return;
      }
      await Promise.all(jobs);
      if (busyId === id) {
        busyId = null;
        stepBtn.disabled = false;
      }
    }

    async function step() {
      if (busyId === run) return;
      if (next >= N_TREES) reset();
      const id = run;
      busyId = id;
      const k = next++;
      stepBtn.disabled = true;
      await runTree(k, id);
      if (id === run) {
        busyId = null;
        stepBtn.disabled = false;
      }
    }

    const runBtn = button("Run the forest", runAll, "primary");
    const stepBtn = button("One tree at a time", step);
    const newBtn = button("New customer", () => {
      who = (who + 1) % PROFILES.length;
      setProfile();
      reset();
      runAll();
    });

    body.append(
      el("p", { class: "hz-x__lede", html: "Nine small trees, each grown on a different random sample of customers. One customer walks down every tree; each tree lights its path and casts a vote, and the votes add up to a churn risk." }),
      el("div", { class: "hz-fv-profile" }, [el("span", { class: "hz-fv-profile__label", text: "Scoring" }), profileName, profileTags]),
      el("div", { class: "hz-x__controls" }, [runBtn, stepBtn, newBtn]),
      gridEl,
      el("div", { class: "hz-fv-tally" }, [
        el("div", { class: "hz-fv-slots", "aria-label": "Votes" }, slots),
        el("div", { class: "hz-fv-meter" }, [el("span", { class: "hz-fv-meter__track" }, [meterFill, el("span", { class: "hz-fv-meter__half" })]), meterText]),
      ]),
      el("div", { class: "hz-legend" }, [
        el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "churned / votes churn"]),
        el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "stayed / votes stay"]),
        el("span", {}, [el("i", { style: "border: 1.5px solid var(--hz-muted); border-radius: 2px" }), "not in this tree's sample"]),
      ]),
      note
    );
    setProfile();
    reset();
  }

  HZ.register("forest-vote", {
    kicker: "Session 5",
    title: "A forest: many trees voting",
    mount,
    css: `
.md-typeset .hz-fv-profile { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.6rem; padding: 0.55rem 0.75rem; border-radius: 12px; background: var(--md-default-bg-color); border: 1px solid var(--hz-line); }
.md-typeset .hz-fv-profile__label { font-family: var(--md-code-font); font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--md-primary-fg-color); }
.md-typeset .hz-fv-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.md-typeset .hz-fv-tag { font-size: 0.66rem; padding: 0.1em 0.55em; border-radius: 999px; background: var(--hz-grid); color: var(--md-default-fg-color); }
.md-typeset .hz-fv-grid { position: relative; display: grid; grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr)); gap: 0.6rem; }
@media (max-width: 34em) {
  .md-typeset .hz-fv-grid { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 82%; overflow-x: auto; scroll-snap-type: x proximity; overscroll-behavior-x: contain; padding-bottom: 0.4rem; }
  .md-typeset .hz-fv-card { scroll-snap-align: start; }
  }
.md-typeset .hz-fv-card { border: 1px solid var(--hz-line); border-radius: 12px; padding: 0.5rem 0.55rem 0.35rem; background: var(--md-default-bg-color); display: flex; flex-direction: column; gap: 0.3rem; transition: border-color 250ms ease, box-shadow 250ms ease; min-width: 0; }
.md-typeset .hz-fv-card.is-active { border-color: var(--md-primary-fg-color); box-shadow: 0 0 0 2px color-mix(in srgb, var(--md-primary-fg-color) 25%, transparent); }
.md-typeset .hz-fv-card__head { display: flex; justify-content: space-between; gap: 0.4rem; align-items: flex-start; }
.md-typeset .hz-x__body p.hz-fv-card__name { font-weight: 600; font-size: 0.74rem; }
.md-typeset .hz-x__body p.hz-fv-card__meta { font-size: 0.6rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-fv-chips { display: flex; flex-wrap: wrap; gap: 0.2rem; margin-top: 0.25rem; }
.md-typeset .hz-fv-chip { font-family: var(--md-code-font); font-size: 0.56rem; padding: 0.05em 0.45em; border-radius: 999px; border: 1px dashed var(--hz-line); color: var(--hz-muted); text-decoration: line-through; }
.md-typeset .hz-fv-chip.is-on { border-style: solid; border-color: var(--hz-ink); color: var(--hz-ink); text-decoration: none; }
.md-typeset .hz-x svg.hz-fv-sample { width: 3.4rem; flex: none; }
.md-typeset .hz-fv-cell.is-churn { fill: var(--hz-a); fill-opacity: 0.55; }
.md-typeset .hz-fv-cell.is-stay { fill: var(--hz-b); fill-opacity: 0.55; }
.md-typeset .hz-fv-cell.is-multi { fill-opacity: 1; }
.md-typeset .hz-fv-cell.is-out { fill: none; stroke: var(--hz-muted); stroke-width: 0.7; stroke-opacity: 0.6; }
.md-typeset .hz-fv-edge path { fill: none; stroke: var(--hz-line); stroke-width: 1.5; transition: stroke 200ms ease, stroke-width 200ms ease, opacity 300ms ease; }
.md-typeset .hz-x svg .hz-fv-edge text { font-size: 11px; transition: opacity 300ms ease; }
.md-typeset .hz-fv-edge.is-path path { stroke: var(--md-primary-fg-color); stroke-width: 3; }
.md-typeset .hz-x svg .hz-fv-edge.is-path text { fill: var(--md-primary-fg-color); font-weight: 600; }
.md-typeset .hz-fv-q rect { fill: var(--hz-card); stroke: var(--hz-ink); stroke-opacity: 0.5; stroke-width: 1.2; transition: stroke 200ms ease, stroke-width 200ms ease; }
.md-typeset .hz-x svg .hz-fv-q text { font-size: 12.5px; fill: var(--hz-ink); font-weight: 500; }
.md-typeset .hz-fv-q.is-path rect { stroke: var(--md-primary-fg-color); stroke-opacity: 1; stroke-width: 2.4; }
.md-typeset .hz-fv-leaf rect { stroke-width: 1.2; transition: transform 250ms ease-in-out, stroke-width 200ms ease; transform-box: fill-box; transform-origin: center; }
.md-typeset .hz-fv-leaf.is-churn rect { fill: var(--hz-a-soft); stroke: var(--hz-a); }
.md-typeset .hz-fv-leaf.is-stay rect { fill: var(--hz-b-soft); stroke: var(--hz-b); }
.md-typeset .hz-x svg .hz-fv-leaf text { font-size: 12px; font-weight: 600; }
.md-typeset .hz-x svg .hz-fv-leaf.is-churn text { fill: var(--hz-a); }
.md-typeset .hz-x svg .hz-fv-leaf.is-stay text { fill: var(--hz-b); }
.md-typeset .hz-fv-leaf.is-hit rect { stroke-width: 2.6; transform: scale(1.12); }
.md-typeset .hz-fv-leaf.is-hit.is-churn rect { fill: var(--hz-a); }
.md-typeset .hz-fv-leaf.is-hit.is-stay rect { fill: var(--hz-b); }
.md-typeset .hz-x svg .hz-fv-leaf.is-hit text { fill: var(--hz-card); }
.md-typeset .hz-fv-tree .is-dim { opacity: 0.32; }
.md-typeset .hz-fv-tree g { transition: opacity 300ms ease; }
.md-typeset .hz-fv-tally { display: flex; flex-wrap: wrap; gap: 0.6rem 1.2rem; align-items: center; }
.md-typeset .hz-fv-slots { display: flex; gap: 0.25rem; flex-wrap: nowrap; flex: none; }
.md-typeset .hz-fv-slot { display: inline-flex; align-items: center; justify-content: center; width: 1.6rem; height: 1.6rem; border-radius: 6px; border: 1px dashed var(--hz-line); font-family: var(--md-code-font); font-size: 0.62rem; color: var(--hz-muted); transition: background 250ms ease, transform 250ms ease; }
.md-typeset .hz-fv-slot.is-on { border-style: solid; color: var(--hz-card); font-weight: 700; transform: translateY(-2px); }
.md-typeset .hz-fv-slot.is-churn { background: var(--hz-a); border-color: var(--hz-a); }
.md-typeset .hz-fv-slot.is-stay { background: var(--hz-b); border-color: var(--hz-b); }
@media (max-width: 34em) { .md-typeset .hz-fv-slots { gap: 0.18rem; } .md-typeset .hz-fv-slot { width: 1.15rem; height: 1.3rem; } }
.md-typeset .hz-fv-meter { flex: 1 1 14rem; display: flex; flex-direction: column; gap: 0.3rem; }
.md-typeset .hz-fv-meter__track { position: relative; display: block; height: 0.7rem; border-radius: 999px; background: var(--hz-b-soft); overflow: hidden; }
.md-typeset .hz-fv-meter__fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--hz-a); transition: width 350ms ease-in-out; }
.md-typeset .hz-fv-meter__half { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 2px; background: var(--hz-ink); opacity: 0.6; }
.md-typeset .hz-x__body p.hz-fv-meter__text { font-size: 0.72rem; }
.md-typeset .hz-fv-meter__text .is-call { color: var(--hz-a); font-weight: 700; }
`,
  });
})();
