/* Week 5: a regression tree fitting Viña del Mar's nightly rate along one
   input, the arrival month. Its answer is a staircase: every step is a group
   of months and its height is the average rate of the bookings in it. Each
   level of depth splits every group once more, one split at a time; the
   straight line that session 3 fitted on month-as-a-number stays for contrast. */
(function () {
  const { el, svg, slider, button, stats, scale, tween, wait, rng, clamp, lerp } = HZ;

  // [arrival month, nightly rate USD]: 360 Standard-room bookings at Viña del
  // Mar, sampled from altamar_bookings_clean.csv.
  const DATA = [[11,110],[11,100],[10,115],[2,136],[12,90],[11,107],[1,168],[12,89],[4,79],[1,225],[8,65],[2,133],[1,166],[6,98],[12,81],[7,74],[2,99],[3,149],[2,154],[5,78],[9,69],[5,52],[12,128],[2,144],[1,152],[4,95],[7,67],[1,186],[11,97],[1,175],[9,82],[7,75],[11,79],[5,83],[1,126],[2,112],[9,83],[11,110],[1,142],[12,115],[4,63],[2,164],[2,150],[1,121],[2,138],[11,92],[9,73],[4,86],[1,137],[1,178],[2,144],[1,210],[7,87],[11,89],[6,68],[1,206],[12,91],[1,179],[7,86],[2,127],[1,151],[1,142],[5,99],[2,170],[12,110],[6,62],[9,93],[12,96],[10,94],[1,175],[8,64],[1,170],[11,83],[3,112],[6,59],[10,72],[2,134],[4,83],[2,124],[2,156],[1,182],[10,98],[2,138],[4,94],[6,90],[10,85],[2,132],[10,86],[1,174],[10,76],[8,58],[7,67],[3,100],[1,165],[3,87],[2,158],[5,55],[8,71],[2,159],[1,116],[1,193],[9,96],[1,157],[9,66],[3,73],[11,106],[3,108],[1,160],[4,102],[10,79],[12,113],[1,139],[12,122],[2,148],[4,77],[2,166],[9,68],[11,88],[1,122],[2,153],[6,72],[3,69],[12,114],[3,110],[7,87],[7,65],[1,195],[5,87],[9,58],[5,71],[2,134],[1,138],[3,87],[12,106],[1,158],[11,106],[8,84],[2,125],[3,106],[10,103],[12,131],[2,136],[9,89],[1,161],[12,107],[2,169],[8,64],[3,95],[2,159],[2,151],[6,71],[9,61],[2,152],[11,83],[1,201],[2,150],[2,168],[4,68],[5,63],[7,95],[1,127],[9,79],[2,149],[1,176],[2,157],[7,88],[2,174],[1,147],[11,86],[12,131],[3,79],[1,209],[10,68],[11,85],[4,89],[7,70],[10,90],[11,98],[1,126],[12,104],[4,93],[7,67],[9,80],[12,125],[3,91],[3,114],[10,82],[12,117],[1,122],[1,132],[9,70],[8,63],[4,85],[2,124],[9,79],[1,152],[12,127],[1,158],[5,54],[4,97],[6,74],[2,180],[12,93],[6,72],[10,80],[8,87],[3,96],[3,143],[1,118],[12,111],[3,117],[7,77],[1,198],[5,69],[8,69],[2,126],[1,172],[2,150],[2,164],[11,101],[11,97],[6,92],[4,132],[2,180],[3,110],[12,125],[8,62],[4,80],[2,143],[1,131],[11,79],[1,125],[10,78],[11,93],[5,59],[12,113],[2,149],[2,132],[7,86],[12,134],[2,181],[1,160],[2,178],[2,142],[2,149],[5,65],[9,101],[4,97],[8,89],[1,136],[2,151],[3,102],[7,81],[1,184],[7,73],[2,165],[2,159],[11,95],[4,94],[8,75],[6,59],[12,115],[1,128],[6,83],[1,183],[9,89],[1,138],[3,148],[11,113],[1,138],[11,103],[12,138],[6,113],[1,170],[2,121],[9,69],[2,165],[2,135],[2,170],[9,100],[1,152],[8,59],[6,64],[6,85],[10,88],[10,95],[3,105],[11,75],[2,212],[2,170],[3,111],[9,69],[1,130],[10,86],[9,78],[9,84],[7,70],[9,65],[1,170],[11,100],[12,126],[12,85],[2,113],[1,111],[2,115],[9,77],[2,147],[1,123],[1,155],[12,125],[2,183],[1,133],[6,54],[1,129],[1,127],[8,76],[2,199],[8,58],[1,190],[1,146],[5,87],[12,122],[4,69],[5,112],[6,85],[3,92],[8,82],[2,146],[3,107],[6,61],[1,168],[3,101],[1,148],[3,129],[2,122],[9,80],[2,118],[8,74],[4,80],[4,80],[3,88],[6,86],[12,116],[8,90],[11,100],[12,119],[4,59],[7,68],[10,89],[5,63],[1,193],[6,88],[12,129],[1,167],[11,85],[3,114],[3,107],[4,100],[2,129],[2,166]];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MAX_DEPTH = 5;
  const W = 540, H = 330, M = { l: 50, r: 14, t: 18, b: 42 };
  const SPLIT_MS = 460;

  const pts = DATA.map(([m, y]) => ({ m, y }));
  const N = pts.length;

  // Least-squares line on month as a number (what a linear model does with it).
  const mx = pts.reduce((s, p) => s + p.m, 0) / N, my = pts.reduce((s, p) => s + p.y, 0) / N;
  const slope = pts.reduce((s, p) => s + (p.m - mx) * (p.y - my), 0) / pts.reduce((s, p) => s + (p.m - mx) ** 2, 0);
  const icpt = my - slope * mx;
  const line = (m) => icpt + slope * m;
  const lineMAE = pts.reduce((s, p) => s + Math.abs(p.y - line(p.m)), 0) / N;

  // CART on one integer input: try every cut between two months, keep the one
  // with the lowest squared error. A node covers a block of months [lo, hi].
  let nid = 0;
  function grow(list, depth, lo, hi) {
    const n = list.length;
    const mean = list.reduce((s, p) => s + p.y, 0) / n;
    const node = { id: nid++, depth, lo, hi, n, mean, abs: list.reduce((s, p) => s + Math.abs(p.y - mean), 0) };
    if (depth >= MAX_DEPTH || lo === hi) return node;
    let best = null;
    for (let t = lo; t < hi; t++) {
      const L = list.filter((p) => p.m <= t), R = list.filter((p) => p.m > t);
      if (!L.length || !R.length) continue;
      const sse = (S) => {
        const mu = S.reduce((s, p) => s + p.y, 0) / S.length;
        return S.reduce((s, p) => s + (p.y - mu) ** 2, 0);
      };
      const e = sse(L) + sse(R);
      if (!best || e < best.e - 1e-9) best = { e, t };
    }
    if (!best) return node;
    node.t = best.t;
    node.left = grow(list.filter((p) => p.m <= best.t), depth + 1, lo, best.t);
    node.right = grow(list.filter((p) => p.m > best.t), depth + 1, best.t + 1, hi);
    return node;
  }

  const span = (n) => (n.lo === n.hi ? MONTHS[n.lo - 1] : `${MONTHS[n.lo - 1]}–${MONTHS[n.hi - 1]}`);
  const usd = (v) => "USD " + Math.round(v);

  function mount(body) {
    nid = 0;
    const root = grow(pts, 0, 1, 12);
    const byDepth = [];
    (function walk(n) {
      (byDepth[n.depth] = byDepth[n.depth] || []).push(n);
      if (n.left) walk(n.left), walk(n.right);
    })(root);
    // Depths at which something still splits.
    let reach = 0;
    while (reach < MAX_DEPTH && (byDepth[reach] || []).some((n) => n.left)) reach++;

    const ylo = Math.floor(Math.min(...pts.map((p) => p.y)) / 20) * 20;
    const yhi = Math.ceil(Math.max(...pts.map((p) => p.y)) / 20) * 20;
    const xs = scale([0.5, 12.5], [M.l, W - M.r]);
    const ys = scale([ylo, yhi], [H - M.b, M.t]);

    const plot = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-st-plot", role: "img", "aria-label": "Nightly rate of Viña del Mar bookings by arrival month, with a straight line and a tree's staircase" });
    for (let v = ylo; v <= yhi; v += 20) {
      plot.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: ys(v), y2: ys(v) }));
      if ((v - ylo) % 40 === 0) plot.append(svg("text", { x: M.l - 8, y: ys(v) + 4, "text-anchor": "end", text: v }));
    }
    MONTHS.forEach((m, i) => plot.append(
      svg("text", { class: "hz-st-month is-long", x: xs(i + 1), y: H - M.b + 17, "text-anchor": "middle", text: m }),
      svg("text", { class: "hz-st-month is-short", x: xs(i + 1), y: H - M.b + 19, "text-anchor": "middle", text: m[0] })
    ));
    plot.append(
      svg("line", { class: "hz-axis", x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }),
      svg("text", { x: (M.l + W - M.r) / 2, y: H - 4, "text-anchor": "middle", text: "arrival month" }),
      svg("text", { class: "hz-ytitle", x: 12, y: (M.t + H - M.b) / 2, transform: `rotate(-90 12 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "nightly rate (USD)" })
    );
    const r = rng(5);
    const dots = svg("g", { class: "hz-st-dots" });
    pts.forEach((p) => dots.append(svg("circle", { cx: (xs(p.m) + (r() - 0.5) * 26).toFixed(1), cy: ys(p.y).toFixed(1), r: 2.6 })));
    const cuts = svg("g");
    const linePath = svg("line", { class: "hz-st-line", x1: xs(0.5), y1: ys(line(0.5)), x2: xs(12.5), y2: ys(line(12.5)) });
    const stair = svg("path", { class: "hz-st-stair" });
    const labels = svg("g");
    plot.append(dots, cuts, linePath, stair, labels);

    // segs: the leaves currently drawn, left to right, each with the value it shows now.
    let segs = [{ node: root, v: root.mean }];
    let fresh = null; // node ids just created, highlighted

    function render() {
      let d = "";
      segs.forEach((s, i) => {
        const x0 = xs(s.node.lo - 0.5), x1 = xs(s.node.hi + 0.5), y = ys(s.v).toFixed(1);
        d += (i ? `L${x0.toFixed(1)},${y}` : `M${x0.toFixed(1)},${y}`) + `H${x1.toFixed(1)}`;
      });
      stair.setAttribute("d", d);
      cuts.replaceChildren(
        ...segs.slice(1).map((s) => svg("line", { class: "hz-st-cut", x1: xs(s.node.lo - 0.5), x2: xs(s.node.lo - 0.5), y1: M.t, y2: H - M.b }))
      );
      labels.replaceChildren(
        ...segs.map((s) => {
          const wide = s.node.hi - s.node.lo >= 1;
          const cx = (xs(s.node.lo - 0.5) + xs(s.node.hi + 0.5)) / 2;
          const above = s.v < (ylo + yhi) / 2 + 30;
          return svg("text", {
            class: "hz-st-val" + (fresh && fresh.has(s.node.id) ? " is-fresh" : ""),
            x: cx, y: ys(s.v) + (above ? -9 : 19), "text-anchor": "middle",
            text: wide ? usd(s.v) : Math.round(s.v),
          });
        })
      );
    }

    const readout = stats();
    const rules = el("ol", { class: "hz-st-rules" });
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
    let depth = 0, target = 0, running = false;

    function treeMAE() {
      return segs.reduce((s, g) => s + g.node.abs, 0) / N;
    }

    function showStats() {
      const mae = treeMAE();
      readout.set([
        ["Tree depth", String(depth)],
        ["Groups (steps)", String(segs.length)],
        ["Typical error: tree", usd(mae), "is-a"],
        ["Typical error: straight line", usd(lineMAE), "is-b"],
      ]);
      rules.replaceChildren(
        ...segs.map((s) =>
          el("li", { class: fresh && fresh.has(s.node.id) ? "is-fresh" : null }, [
            el("span", { text: span(s.node) }),
            el("b", { text: usd(s.node.mean) }),
            el("small", { text: `${s.node.n} bookings` }),
          ])
        )
      );
      const L = root.left, R = root.right;
      if (depth === 0) {
        note.innerHTML = `No questions yet: the tree gives every booking the same answer, the average rate of all ${N} bookings, <strong>${usd(root.mean)}</strong>. Its typical error is ${usd(mae)} a night. The straight line does better (${usd(lineMAE)}) but it can only slope one way: down through the year.`;
      } else if (depth === 1) {
        note.innerHTML = `One question: <strong>does the guest arrive in ${span(L)}?</strong> Yes → ${usd(L.mean)} (the average of ${L.n} bookings); no → ${usd(R.mean)}. One question already beats the line: typical error ${usd(mae)} against ${usd(lineMAE)}. A tree answers with <strong>averages of groups</strong>.`;
      } else if (depth >= reach) {
        note.innerHTML = `Every month is now its own group, or close to it: the steps cannot get finer, because the input has only 12 values. The staircase follows the summer peak at both ends of the year, which no straight line can. Typical error ${usd(mae)} against ${usd(lineMAE)}.`;
      } else {
        note.innerHTML = `Each new level asks one more question inside every group, so groups get smaller and steps more detailed. Notice that December only joins the summer by its own question: a cut can only separate months that sit next to each other in the calendar. Typical error now ${usd(mae)}.`;
      }
      if (!running) sDepth.set(depth);
      addBtn.disabled = target >= reach && depth >= reach;
    }

    async function up(alive) {
      const nodes = byDepth[depth].filter((n) => n.left);
      fresh = new Set();
      for (const n of nodes) {
        if (!alive()) return false;
        const i = segs.findIndex((s) => s.node === n);
        const a = { node: n.left, v: n.mean }, b = { node: n.right, v: n.mean };
        segs.splice(i, 1, a, b);
        fresh.add(n.left.id).add(n.right.id);
        await tween(body, SPLIT_MS, (k) => {
          if (!alive()) return;
          a.v = lerp(n.mean, n.left.mean, k);
          b.v = lerp(n.mean, n.right.mean, k);
          render();
        });
        if (!alive()) return false;
        showStats();
        await wait(110);
      }
      depth++;
      return true;
    }

    async function down(alive) {
      const parents = byDepth[depth - 1].filter((n) => n.left);
      const pairs = parents.map((n) => ({ n, a: segs.find((s) => s.node === n.left), b: segs.find((s) => s.node === n.right) }));
      fresh = null;
      await tween(body, 360, (k) => {
        if (!alive()) return;
        pairs.forEach(({ n, a, b }) => {
          a.v = lerp(n.left.mean, n.mean, k);
          b.v = lerp(n.right.mean, n.mean, k);
        });
        render();
      });
      pairs.forEach(({ n, a }) => {
        const i = segs.indexOf(a);
        segs.splice(i, 2, { node: n, v: n.mean });
      });
      depth--;
      render();
      return true;
    }

    let runId = 0;
    async function goTo(d) {
      target = clamp(d, 0, reach);
      sDepth.set(target);
      if (running) return;
      running = true;
      const id = ++runId;
      const alive = () => id === runId && body.isConnected;
      while (depth !== target && alive()) {
        const ok = target > depth ? await up(alive) : await down(alive);
        if (!ok) break;
        showStats();
      }
      running = false;
      render();
      showStats();
    }

    const sDepth = slider({ label: "Tree depth", min: 0, max: reach, step: 1, value: 0, oninput: (v) => goTo(v) });
    const addBtn = button("Ask one more level", () => goTo(Math.min(reach, target + 1)), "primary");

    body.append(
      el("p", { class: "hz-x__lede", html: `${N} Standard-room bookings at <strong>Viña del Mar</strong>, by arrival month. A regression tree predicts the rate by asking questions about the month; its answer is a <strong>staircase</strong>, not a line. Add depth and watch each group split in two.` }),
      plot,
      el("div", { class: "hz-legend" }, [
        el("span", {}, [el("i", { style: "background: var(--hz-a); border-radius: 2px; height: 3px; vertical-align: 0.2em" }), "tree: average rate of each group"]),
        el("span", {}, [el("i", { style: "border-top: 2px dashed var(--hz-b); border-radius: 0; height: 0; vertical-align: 0.2em" }), "straight line"]),
        el("span", {}, [el("i", { style: "background: var(--hz-muted); opacity: 0.6" }), "one booking"]),
      ]),
      el("div", { class: "hz-x__controls" }, [sDepth.node, addBtn, button("Reset", () => goTo(0))]),
      el("div", { class: "hz-st-below" }, [
        el("div", {}, [readout.node]),
        el("div", {}, [el("p", { class: "hz-st-rules-h", text: "The tree's answer, as rules" }), rules]),
      ]),
      note
    );
    render();
    showStats();
  }

  HZ.register("step-tree", {
    kicker: "Week 5",
    title: "A tree answers with averages of groups",
    mount,
    css: `
.md-typeset .hz-st-dots circle { fill: var(--hz-muted); fill-opacity: 0.4; }
.md-typeset .hz-st-line { stroke: var(--hz-b); stroke-width: 2; stroke-dasharray: 6 4; }
.md-typeset .hz-st-stair { fill: none; stroke: var(--hz-a); stroke-width: 3.2; stroke-linejoin: round; stroke-linecap: round; }
.md-typeset .hz-st-cut { stroke: var(--hz-ink); stroke-opacity: 0.22; stroke-width: 1; stroke-dasharray: 2 3; }
.md-typeset .hz-x svg text.hz-st-month { font-size: 12px; }
.md-typeset .hz-x svg text.hz-st-month.is-short { display: none; }
@media (max-width: 30em) { .md-typeset .hz-x svg text.hz-st-month.is-short { display: inline; } .md-typeset .hz-x svg text.hz-st-month.is-long { display: none; } }
.md-typeset .hz-x svg text.hz-st-val { font-size: 12px; font-weight: 600; fill: var(--hz-ink); paint-order: stroke; stroke: var(--hz-card); stroke-width: 4px; transition: fill 300ms ease; }
.md-typeset .hz-x svg text.hz-st-val.is-fresh { fill: var(--hz-a); }
.md-typeset .hz-st-below { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 0.8rem 1.4rem; align-items: start; }
@media (max-width: 40em) { .md-typeset .hz-st-below { grid-template-columns: minmax(0, 1fr); } }
.md-typeset .hz-x__body p.hz-st-rules-h { font-size: 0.66rem; color: var(--md-default-fg-color--light); margin-bottom: 0.3rem; }
.md-typeset ol.hz-st-rules { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.md-typeset ol.hz-st-rules li { margin: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 0.6rem; align-items: baseline; font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 8px; border: 1px solid var(--hz-line); background: var(--md-default-bg-color); transition: border-color 300ms ease, background-color 300ms ease; }
.md-typeset ol.hz-st-rules li.is-fresh { border-color: var(--hz-a); background: var(--hz-a-soft); }
.md-typeset ol.hz-st-rules li b { font-family: var(--md-code-font); font-weight: 600; }
.md-typeset ol.hz-st-rules li small { color: var(--md-default-fg-color--light); font-size: 0.62rem; }
@media (max-width: 30em) { .md-typeset .hz-x svg.hz-st-plot text { font-size: 21px; } .md-typeset .hz-x svg text.hz-ytitle { display: none; } .md-typeset .hz-x svg.hz-st-plot text.hz-st-month { font-size: 19px; } .md-typeset .hz-x svg.hz-st-plot text.hz-st-val { font-size: 19px; } }
`,
  });
})();
