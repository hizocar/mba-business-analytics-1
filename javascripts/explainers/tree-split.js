/* Class 12b: a decision tree grown greedily with Gini impurity. Each level
   adds one axis-aligned question per box; deep trees carve boxes around
   single customers and stop generalising. */
(function () {
  const { el, svg, slider, button, segmented, stats, scale, tween, rng, fmt, clamp, lerp } = HZ;

  const W = 520, H = 340, M = { l: 48, r: 16, t: 14, b: 40 };
  const MAX_DEPTH = 6;
  const FEAT = ["Age", "Income"];
  const AX = [18, 62], AY = [12, 42];
  const STEP_MS = 420;

  // 240 customers, alternately train / test. Young customers, and
  // middle-aged ones with a high income, tend to buy the package.
  function makeData() {
    const r = rng(12);
    const pts = [];
    for (let i = 0; i < 240; i++) {
      const age = Math.round(18 + 42 * r());
      const inc = Math.round(10 * clamp(25 + 5.5 * r.normal() + 0.12 * (age - 38), 12.5, 41.5)) / 10;
      const p = age < 31 ? 0.78 : inc > 30.5 && age < 47 ? 0.72 : 0.1;
      pts.push({ v: [age, inc], y: r() < p ? 1 : 0, train: i % 2 === 0 });
    }
    return pts;
  }

  const gini = (c) => {
    const n = c[0] + c[1];
    return n ? 1 - (c[0] / n) ** 2 - (c[1] / n) ** 2 : 0;
  };

  // CART: try every midpoint between consecutive distinct values of each
  // feature; keep the split with the lowest weighted child Gini.
  // Greedy, so the tree with max_depth = d is this tree cut at depth d.
  let nid = 0;
  function grow(pts, depth, box) {
    const c = [0, 0];
    pts.forEach((p) => c[p.y]++);
    const node = { id: nid++, depth, n: pts.length, c, gini: gini(c), cls: c[1] > c[0] ? 1 : 0, box };
    if (depth >= MAX_DEPTH || node.gini === 0 || pts.length < 2) return node;
    let best = null;
    for (let f = 0; f < 2; f++) {
      const s = pts.slice().sort((a, b) => a.v[f] - b.v[f]);
      const L = [0, 0], R = c.slice();
      for (let i = 0; i < s.length - 1; i++) {
        L[s[i].y]++;
        R[s[i].y]--;
        if (s[i].v[f] === s[i + 1].v[f]) continue;
        const nl = i + 1, nr = s.length - nl;
        const g = (nl * gini(L) + nr * gini(R)) / s.length;
        if (!best || g < best.g - 1e-12) best = { g, f, thr: (s[i].v[f] + s[i + 1].v[f]) / 2 };
      }
    }
    if (!best) return node;
    node.f = best.f;
    node.thr = best.thr;
    const lb = box.map((b) => b.slice()), rb = box.map((b) => b.slice());
    lb[best.f][1] = best.thr;
    rb[best.f][0] = best.thr;
    node.left = grow(pts.filter((p) => p.v[best.f] <= best.thr), depth + 1, lb);
    node.right = grow(pts.filter((p) => p.v[best.f] > best.thr), depth + 1, rb);
    return node;
  }

  const walk = (n, fn) => {
    fn(n);
    if (n.left) walk(n.left, fn), walk(n.right, fn);
  };
  // A node acts as a leaf at depth d if it is a real leaf or the cut happens there.
  const isLeafAt = (n, d) => !n.left || n.depth >= d;
  const visibleAt = (n, d) => n.depth <= d;

  function leafFor(root, p, d) {
    let n = root;
    while (!isLeafAt(n, d)) n = p.v[n.f] <= n.thr ? n.left : n.right;
    return n;
  }

  const ruleText = (n) => `${FEAT[n.f]} ≤ ${n.f === 0 ? n.thr.toFixed(1) : n.thr.toFixed(2)}`;
  const shortRule = (n) => `${n.f === 0 ? "Age" : "Inc"} ≤ ${n.thr.toFixed(1)}`;
  const classText = (c) => (c ? "buys" : "doesn't");

  // Tree diagram layout: each subtree gets width from its visible leaves;
  // upper levels get full boxes, deeper levels shrink to dots.
  const DW = 720, DH = 300;
  const LEVEL_Y = [26, 98, 170, 228, 254, 274, 292];
  const slotW = (depth) => (depth <= 2 ? 136 : depth === 3 ? 84 : 16);
  function layout(root, d) {
    const pos = {};
    const width = (n) => (isLeafAt(n, d) ? slotW(n.depth) : Math.max(slotW(n.depth), width(n.left) + width(n.right)));
    const total = width(root);
    const k = Math.min(1, (DW - 8) / total);
    (function place(n, x0) {
      const w = width(n) * k;
      pos[n.id] = { x: x0 + w / 2, y: LEVEL_Y[n.depth] };
      if (!isLeafAt(n, d)) {
        place(n.left, x0);
        place(n.right, x0 + width(n.left) * k);
      }
    })(root, (DW - total * k) / 2);
    return pos;
  }

  function mount(body) {
    const pts = makeData();
    const train = pts.filter((p) => p.train), test = pts.filter((p) => !p.train);
    nid = 0;
    const root = grow(train, 0, [AX.slice(), AY.slice()]);
    const nodes = [];
    walk(root, (n) => nodes.push(n));
    const accAt = (set, d) => set.filter((p) => leafFor(root, p, d).cls === p.y).length / set.length;
    const acc = [];
    for (let d = 0; d <= MAX_DEPTH; d++) acc.push({ train: accAt(train, d), test: accAt(test, d) });

    const xs = scale(AX, [M.l, W - M.r]);
    const ys = scale(AY, [H - M.b, M.t]);

    // Scatter with partition
    const plot = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-ts-plot", role: "img", "aria-label": "Customers by age and monthly income, partitioned by the tree" });
    const regionLayer = svg("g");
    const splitLayer = svg("g");
    const dotLayer = svg("g");
    plot.append(regionLayer);
    for (let v = 15; v <= 40; v += 5) {
      plot.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
      plot.append(svg("text", { x: M.l - 8, y: ys(v) + 4, "text-anchor": "end", text: v }));
    }
    for (let v = 20; v <= 60; v += 10) plot.append(svg("text", { x: xs(v), y: H - M.b + 16, "text-anchor": "middle", text: v }));
    plot.append(
      svg("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, class: "hz-ts-frame" }),
      svg("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", text: "age (years)" }),
      svg("text", { x: 12, y: (M.t + H - M.b) / 2, transform: `rotate(-90 12 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "monthly income ($k)" }),
      splitLayer,
      dotLayer
    );

    const regions = {}, splits = {};
    nodes.forEach((n) => {
      const [[x0, x1], [y0, y1]] = n.box;
      const purity = Math.max(n.c[0], n.c[1]) / n.n;
      regions[n.id] = svg("rect", {
        x: xs(x0), y: ys(y1), width: xs(x1) - xs(x0), height: ys(y0) - ys(y1),
        class: "hz-ts-region " + (n.cls ? "is-pos" : "is-neg"),
        "fill-opacity": (0.08 + 0.22 * (purity - 0.5) * 2).toFixed(3),
        opacity: 0,
      });
      regionLayer.append(regions[n.id]);
      if (n.left) {
        const line = n.f === 0
          ? { x1: xs(n.thr), x2: xs(n.thr), y1: ys(y0), y2: ys(y1) }
          : { x1: xs(x0), x2: xs(x1), y1: ys(n.thr), y2: ys(n.thr) };
        line.len = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
        const node = svg("line", {
          x1: line.x1, x2: line.x2, y1: line.y1, y2: line.y2,
          class: "hz-ts-split" + (n.depth === 0 ? " is-root" : ""),
          "stroke-dasharray": line.len, "stroke-dashoffset": line.len,
        });
        splits[n.id] = { node, len: line.len };
        splitLayer.append(node);
      }
    });

    let showSet = "train";
    function drawDots() {
      const set = showSet === "train" ? train : test;
      dotLayer.replaceChildren(
        ...set.map((p) => svg("circle", {
          cx: xs(p.v[0]), cy: ys(p.v[1]), r: 3.8,
          class: "hz-ts-dot " + (p.y ? "is-pos" : "is-neg") + (showSet === "test" ? " is-test" : ""),
        }))
      );
    }

    // Tree diagram
    const diagram = svg("svg", { viewBox: `0 0 ${DW} ${DH}`, class: "hz-ts-tree", role: "img", "aria-label": "The fitted decision tree" });
    const edgeLayer = svg("g"), nodeLayer = svg("g");
    diagram.append(edgeLayer, nodeLayer);
    const dNodes = {}, dEdges = {};
    nodes.forEach((n) => {
      const big = n.depth <= 2, mid = n.depth === 3;
      const g = svg("g", { class: "hz-ts-node " + (n.cls ? "is-pos" : "is-neg"), opacity: 0 });
      if (big) {
        g.append(
          svg("rect", { x: -62, y: -24, width: 124, height: 48, rx: 8 }),
          svg("text", { class: "hz-ts-rule", y: -8, "text-anchor": "middle" }),
          svg("text", { y: 6, "text-anchor": "middle", text: `gini ${n.gini.toFixed(2)} · n ${n.n}` }),
          svg("text", { class: "hz-ts-cls", y: 19, "text-anchor": "middle", text: `${n.c[1]} buy / ${n.c[0]} not` })
        );
      } else if (mid) {
        g.append(svg("rect", { x: -39, y: -10, width: 78, height: 20, rx: 6 }), svg("text", { class: "hz-ts-rule", y: 4, "text-anchor": "middle" }));
      } else {
        g.append(svg("circle", { r: 5 }));
      }
      g.append(svg("title", { text: `${n.left ? ruleText(n) + ", " : ""}gini ${n.gini.toFixed(3)}, ${n.n} customers (${n.c[1]} buy), predicts: ${classText(n.cls)}` }));
      dNodes[n.id] = g;
      nodeLayer.append(g);
      if (n.depth > 0) {
        dEdges[n.id] = svg("path", { class: "hz-ts-edge", opacity: 0 });
        edgeLayer.append(dEdges[n.id]);
      }
    });
    const parentOf = {};
    nodes.forEach((n) => n.left && ((parentOf[n.left.id] = n), (parentOf[n.right.id] = n)));

    // Accuracy vs depth
    const AW = 300, AH = 150, AM = { l: 36, r: 10, t: 10, b: 28 };
    const axs = scale([0, MAX_DEPTH], [AM.l, AW - AM.r]);
    const ays = scale([0.6, 1], [AH - AM.b, AM.t]);
    const accChart = svg("svg", { viewBox: `0 0 ${AW} ${AH}`, role: "img", "aria-label": "Train and test accuracy for each depth" });
    [0.6, 0.7, 0.8, 0.9, 1].forEach((v) => {
      accChart.append(svg("line", { class: "hz-gridline", x1: AM.l, x2: AW - AM.r, y1: ays(v), y2: ays(v) }));
      accChart.append(svg("text", { x: AM.l - 6, y: ays(v) + 4, "text-anchor": "end", text: v.toFixed(1) }));
    });
    for (let d = 0; d <= MAX_DEPTH; d++) accChart.append(svg("text", { x: axs(d), y: AH - AM.b + 14, "text-anchor": "middle", text: d }));
    accChart.append(svg("text", { x: (AM.l + AW - AM.r) / 2, y: AH - 1, "text-anchor": "middle", text: "max depth" }));
    const accMarker = svg("line", { y1: AM.t, y2: AH - AM.b, class: "hz-ts-marker" });
    accChart.append(accMarker);
    ["train", "test"].forEach((k) => {
      const cls = k === "train" ? "b" : "a";
      accChart.append(svg("path", { class: "hz-stroke-" + cls, "stroke-width": 2, d: acc.map((a, d) => (d ? "L" : "M") + axs(d) + "," + ays(a[k])).join("") }));
      acc.forEach((a, d) => accChart.append(svg("circle", { cx: axs(d), cy: ays(a[k]), r: 2.5, class: "hz-fill-" + cls })));
    });

    const readout = stats();
    const note = el("p", { class: "hz-x__note" });

    let shown = 0; // depth currently drawn
    let target = 0;
    let running = false;

    // Draw the state between depth d (k = 0) and d + 1 (k = 1).
    function frame(d, k) {
      const posA = layout(root, d), posB = layout(root, Math.min(d + 1, MAX_DEPTH));
      nodes.forEach((n) => {
        // regions: leaves at d fade out as their children fade in
        const leafA = visibleAt(n, d) && isLeafAt(n, d);
        const leafB = visibleAt(n, d + 1) && isLeafAt(n, d + 1);
        regions[n.id].setAttribute("opacity", leafA && leafB ? 1 : leafA ? 1 - k : leafB ? k : 0);
        const sp = splits[n.id];
        if (sp) {
          const t = n.depth < d ? 1 : n.depth === d ? k : 0;
          sp.node.setAttribute("stroke-dashoffset", (sp.len * (1 - t)).toFixed(1));
        }
        // diagram: new nodes grow out of their parent
        const g = dNodes[n.id];
        const inA = visibleAt(n, d), inB = visibleAt(n, d + 1);
        const par = parentOf[n.id];
        const a = inA ? posA[n.id] : par && posA[par.id];
        const b = inB ? posB[n.id] : a;
        if (!a || !b) return g.setAttribute("opacity", 0);
        const x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k);
        g.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)})`);
        g.setAttribute("opacity", inA ? 1 : inB ? k : 0);
        const rule = g.querySelector(".hz-ts-rule");
        if (rule) {
          const splitNow = n.left && (n.depth < d || (n.depth === d && k > 0.5));
          rule.textContent = splitNow ? (n.depth === 3 ? shortRule(n) : ruleText(n)) : "→ " + classText(n.cls);
          g.classList.toggle("is-leaf", !splitNow);
        }
        const e = dEdges[n.id];
        if (e) {
          const pa = posA[par.id] && lerp(posA[par.id].x, posB[par.id].x, k);
          const py = LEVEL_Y[par.depth];
          e.setAttribute("d", `M${pa.toFixed(1)},${py}C${pa.toFixed(1)},${(py + y) / 2} ${x.toFixed(1)},${(py + y) / 2} ${x.toFixed(1)},${y.toFixed(1)}`);
          e.setAttribute("opacity", inA ? 1 : inB ? k : 0);
        }
      });
      const md = d + k;
      accMarker.setAttribute("x1", axs(md));
      accMarker.setAttribute("x2", axs(md));
    }

    function showStats(d) {
      const leaves = nodes.filter((n) => visibleAt(n, d) && isLeafAt(n, d)).length;
      const a = acc[d];
      readout.set([
        ["Max depth", String(d)],
        ["Leaves (boxes)", String(leaves)],
        ["Train accuracy", fmt(a.train, 3), "is-b"],
        ["Test accuracy", fmt(a.test, 3), "is-a"],
      ]);
      const bestD = acc.reduce((bi, x, i) => (x.test > acc[bi].test ? i : bi), 0);
      note.innerHTML =
        d === 0
          ? `No questions yet: everyone gets the majority class. Root Gini = 1 − p²<sub>buy</sub> − p²<sub>not</sub> = <strong>${root.gini.toFixed(3)}</strong> (0 means a pure box, 0.5 a 50/50 mix).`
          : d === 1
            ? `The first question is the single split, over every feature and threshold, that lowers the weighted Gini of the two boxes the most: <strong>${ruleText(root)}</strong>.`
            : a.test > acc[bestD].test - 0.04
              ? "Each level asks one more question inside every box that is still mixed. Boxes get purer and train accuracy rises. Watch whether test accuracy follows."
              : `Deep trees carve tiny boxes around a handful of customers, often around noise. Train accuracy keeps climbing, but test accuracy fell from its peak at depth ${bestD}: <strong>overfitting</strong>. Limit <code>max_depth</code>.`;
    }

    async function goTo(d) {
      target = d;
      sDepth.set(d);
      if (running) return;
      running = true;
      while (shown !== target && body.isConnected) {
        const up = target > shown;
        const from = up ? shown : shown - 1;
        showStats(up ? shown + 1 : shown - 1);
        const ms = Math.max(160, STEP_MS / Math.max(1, Math.abs(target - shown) * 0.6));
        await tween(body, ms, (k) => frame(from, up ? k : 1 - k));
        shown += up ? 1 : -1;
      }
      frame(shown, 0);
      showStats(shown);
      growBtn.disabled = shown >= MAX_DEPTH;
      running = false;
    }

    const sDepth = slider({ label: "Max depth", min: 0, max: MAX_DEPTH, step: 1, value: 0, oninput: (v) => goTo(v) });
    const growBtn = button("Grow one level", () => goTo(Math.min(MAX_DEPTH, target + 1)), "primary");
    const view = segmented(
      [{ value: "train", label: "Train points" }, { value: "test", label: "Test points" }],
      showSet,
      (v) => { showSet = v; drawDots(); }
    );

    const treeWrap = el("div", { class: "hz-ts-treewrap" }, diagram);
    body.append(
      el("p", { class: "hz-x__lede", html: "Will a customer buy the travel package? A decision tree asks yes/no questions about one feature at a time, so it cuts the plane into boxes and predicts the majority class in each. Grow it one level at a time." }),
      el("div", { class: "hz-x__split" }, [
        el("div", {}, [
          plot,
          el("div", { class: "hz-legend" }, [
            el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "bought"]),
            el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "did not buy"]),
            el("span", {}, [el("i", { style: "background: var(--hz-a-soft); border-radius: 2px" }), "box predicts \"buys\""]),
          ]),
        ]),
        el("div", { class: "hz-ts-side" }, [readout.node, accChart, el("div", { class: "hz-legend" }, [
          el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "train"]),
          el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "test"]),
        ])]),
      ]),
      el("div", { class: "hz-x__controls" }, [
        sDepth.node,
        growBtn,
        button("Reset", () => goTo(0)),
        view.node,
      ]),
      note,
      treeWrap
    );
    drawDots();
    frame(0, 0);
    showStats(0);
    // On narrow screens the diagram scrolls sideways; start centred on the root.
    requestAnimationFrame(() => (treeWrap.scrollLeft = (treeWrap.scrollWidth - treeWrap.clientWidth) / 2));
  }

  HZ.register("tree-split", { kicker: "Session 5", title: "How a decision tree splits the data", mount });
})();
