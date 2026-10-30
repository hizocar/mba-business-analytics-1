/*
 * groupby: split -> apply -> combine for df.groupby("hotel")["adr"].mean(),
 * on nine real Altamar bookings. Rows physically move into their hotel's
 * group, each group collapses to one number, and the numbers stack into the
 * result Series: bookings -> hotels -> average rate.
 */
(function () {
  const { el, svg } = HZ;

  // [hotel, adr] of nine bookings from altamar_bookings_clean.csv
  const ROWS = [
    ["Viña del Mar", 133.13], ["Santiago", 115.22], ["Puerto Varas", 135.23], ["Santiago", 88.8], ["Viña del Mar", 167.26],
    ["Santiago", 91.02], ["Puerto Varas", 173.75], ["Viña del Mar", 128.16], ["Santiago", 119.61],
  ];
  const KEYS = ["Puerto Varas", "Santiago", "Viña del Mar"]; // groupby sorts the keys
  const COLORS = ["var(--hz-gb-c)", "var(--hz-b)", "var(--hz-a)"];
  const SOFTS = ["var(--hz-gb-c-soft)", "var(--hz-b-soft)", "var(--hz-a-soft)"];
  const groupOf = ROWS.map(([k]) => KEYS.indexOf(k));
  const members = KEYS.map((_, g) => ROWS.map((_, i) => i).filter((i) => groupOf[i] === g));
  const slotOf = ROWS.map((_, i) => members[groupOf[i]].indexOf(i));

  const AGGS = {
    mean: (xs) => xs.reduce((a, b) => a + b, 0) / xs.length,
    median: (xs) => {
      const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    },
    count: (xs) => xs.length,
    max: (xs) => Math.max(...xs),
  };

  const p2 = (v) => v.toFixed(2);
  function formula(agg, xs) {
    const list = xs.map(p2);
    if (agg === "mean") return "(" + list.join(" + ") + ") / " + xs.length;
    if (agg === "count") return xs.length + " rows";
    if (agg === "max") return "max(" + list.join(", ") + ")";
    const s = [...xs].sort((a, b) => a - b).map(p2);
    return "middle of " + s.join(", ") + (xs.length % 2 ? "" : " → average of the two middle values");
  }

  // .round(2), then pandas: floats get 6 decimals, trailing zeros trimmed in step across the column
  function pandasFormat(values, agg) {
    if (agg === "count") return values.map(String);
    let s = values.map((v) => (Math.round(v * 100) / 100).toFixed(6));
    while (s.every((x) => x.endsWith("0") && !x.endsWith(".0"))) s = s.map((x) => x.slice(0, -1));
    return s;
  }

  const STAGES = [
    { name: "Data", tag: "" },
    { name: "Split", tag: "1" },
    { name: "Apply", tag: "2" },
    { name: "Combine", tag: "3" },
  ];

  HZ.register("groupby", {
    title: "Split → apply → combine",
    kicker: "Week 2",
    mount(body) {
      body.classList.add("hz-groupby");
      let agg = "mean";
      let stage = 0;
      let busy = false;
      let runId = 0;

      body.append(el("p", { class: "hz-x__lede" }, [
        el("code", { text: "groupby" }),
        " answers questions like “what is the average nightly rate at each hotel?” in three moves. Nine real bookings: press Play, or Step through it.",
      ]));

      const codeAgg = el("span", { class: "hz-groupby-agg", text: "mean" });
      const codeRound = el("span", { text: ".round(2)" });
      const codeLine = el("pre", { class: "hz-groupby-code" }, ['df.groupby("hotel")["adr"].', codeAgg, "()", codeRound]);

      const seg = HZ.segmented(Object.keys(AGGS).map((k) => ({ value: k, label: k })), agg, (v) => setAgg(v));
      seg.node.setAttribute("aria-label", "Aggregation");
      const playBtn = HZ.button("Play", () => play(), "primary");
      const stepBtn = HZ.button("Step", () => step());
      const resetBtn = HZ.button("Reset", () => reset());
      const controls = el("div", { class: "hz-x__controls" }, [seg.node, el("div", { class: "hz-groupby-btns" }, [playBtn, stepBtn, resetBtn])]);

      const pills = STAGES.slice(1).map((s) => el("span", { class: "hz-groupby-pill" }, [el("b", { text: s.tag }), s.name]));
      const pillRow = el("div", { class: "hz-groupby-pills", "aria-hidden": "true" }, pills);

      const fig = svg("svg", { class: "hz-groupby-fig", role: "img", "aria-label": "Table of 9 bookings being grouped by hotel" });
      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      body.append(codeLine, controls, pillRow, fig, note);

      // --- Layout (pixel units, recomputed on resize so text stays readable at any width)
      const RH = 24, LBL = 20;
      let Lyt = null;
      // Wide: three columns side by side. Narrow: data, groups and result stacked.
      function layout(width) {
        const w = Math.max(280, width);
        const wide = w >= 600;
        const gut = 28;
        const colW = wide ? (w - 2 * gut) / 3 : Math.min(w, 360);
        const top = 22;
        const table = { x: 0, y: top, w: colW };
        const tableTop = top + RH * (ROWS.length + 1);
        const groups = { x: wide ? colW + gut : 0, y: wide ? top : tableTop + 42, w: colW };
        const KW = wide ? Math.min(100, colW - 80) : 100;
        // group block tops
        const blocks = [];
        let y = groups.y;
        KEYS.forEach((_, g) => {
          blocks.push({ y, h: LBL + members[g].length * RH + 6 });
          y += LBL + members[g].length * RH + 14;
        });
        const groupsBottom = y - 14;
        const tableBottom = tableTop;
        let result;
        if (wide) result = { x: 2 * (colW + gut), y: top, w: colW };
        else result = { x: 0, y: groupsBottom + 42, w: colW };
        const h = wide ? Math.max(groupsBottom, tableBottom) + 8 : result.y + RH * 5 + 4;
        return { w, h, wide, table, groups, result, blocks, KW };
      }

      // --- Scene
      const titles = ["data", "groups", "result"].map((t) => svg("text", { class: "hz-groupby-coltitle", text: t }));
      const tableHead = svg("g", { class: "hz-groupby-head" }, [
        svg("text", { class: "hz-groupby-hstock", text: "hotel" }),
        svg("text", { class: "hz-groupby-hprice", "text-anchor": "end", text: "adr" }),
      ]);
      const ghosts = ROWS.map(([k, p], i) => makeRow(k, p, i, true));
      const blockEls = KEYS.map((k, g) =>
        svg("g", { class: "hz-groupby-block" }, [
          svg("rect", { rx: 8, style: `fill: ${SOFTS[g]}; stroke: ${COLORS[g]}` }),
          svg("text", { class: "hz-groupby-blabel", style: `fill: ${COLORS[g]}` }),
        ])
      );
      const rowEls = ROWS.map(([k, p], i) => makeRow(k, p, i, false));
      const chips = KEYS.map((k, g) =>
        svg("g", { class: "hz-groupby-chip" }, [
          svg("rect", { rx: 6, height: RH - 4, y: -RH / 2 + 2, style: `fill: ${SOFTS[g]}; stroke: ${COLORS[g]}` }),
          svg("text", { class: "hz-groupby-ckey", x: 8, y: 4, text: k }),
          svg("text", { class: "hz-groupby-cval", "text-anchor": "end", y: 4 }),
        ])
      );
      const resHead = svg("text", { class: "hz-groupby-reshead", text: "hotel" });
      const resFoot = svg("text", { class: "hz-groupby-resfoot" });
      fig.append(...titles, tableHead, ...ghosts, ...blockEls, ...rowEls, ...chips, resHead, resFoot);

      function makeRow(k, p, i, ghost) {
        const g = groupOf[i];
        return svg("g", { class: "hz-groupby-row" + (ghost ? " is-ghost" : "") }, [
          svg("text", { class: "hz-groupby-idx", x: 2, y: 4, text: String(i) }),
          svg("rect", { class: "hz-groupby-key", x: 18, y: -9, height: 18, width: 48, rx: 9, style: `fill: ${SOFTS[g]}; stroke: ${COLORS[g]}` }),
          svg("text", { class: "hz-groupby-keytxt", x: 42, y: 4, "text-anchor": "middle", text: k }),
          svg("text", { class: "hz-groupby-price", "text-anchor": "end", y: 4, text: p2(p) }),
        ]);
      }

      // Per-element states for a given stage
      const tablePos = (i) => ({ x: Lyt.table.x, y: Lyt.table.y + RH * (i + 1) + RH / 2, o: 1 });
      const groupPos = (i) => {
        const b = Lyt.blocks[groupOf[i]];
        return { x: Lyt.groups.x + 6, y: b.y + LBL + RH * slotOf[i] + RH / 2 + 2, o: 1 };
      };
      const chipGroupPos = (g) => ({ x: Lyt.groups.x + 6, y: Lyt.blocks[g].y + LBL + RH / 2 + 2 });
      const chipResultPos = (g) => ({ x: Lyt.result.x, y: Lyt.result.y + RH * (g + 1) + RH / 2 });

      function rowState(i, s) {
        if (s === 0) return tablePos(i);
        if (s === 1) return groupPos(i);
        const p = groupPos(i);
        const c = chipGroupPos(groupOf[i]);
        return { x: c.x, y: c.y, o: 0, _from: p };
      }
      function chipState(g, s) {
        if (s < 2) return { ...chipGroupPos(g), o: 0 };
        if (s === 2) return { ...chipGroupPos(g), o: 1 };
        return { ...chipResultPos(g), o: 1 };
      }
      function blockState(g, s) {
        const full = Lyt.blocks[g].h, small = LBL + RH + 6;
        if (s === 0) return { o: 0, h: full };
        if (s === 1) return { o: 1, h: full };
        if (s === 2) return { o: 1, h: small };
        return { o: 0.35, h: small };
      }

      const lerpS = (a, b, t) => ({ x: HZ.lerp(a.x, b.x, t), y: HZ.lerp(a.y, b.y, t), o: HZ.lerp(a.o, b.o, t) });
      const setG = (node, st) => {
        node.setAttribute("transform", `translate(${st.x.toFixed(1)} ${st.y.toFixed(1)})`);
        node.style.opacity = st.o;
      };

      function drawStatic() {
        const L = Lyt;
        fig.setAttribute("viewBox", `0 0 ${L.w} ${L.h}`);
        fig.setAttribute("height", L.h);
        const cols = [L.table, L.groups, L.result];
        titles.forEach((t, k) => {
          t.setAttribute("x", cols[k].x + 2);
          t.setAttribute("y", cols[k].y - 8);
        });
        tableHead.setAttribute("transform", `translate(${L.table.x} ${L.table.y + RH / 2 + 4})`);
        tableHead.children[0].setAttribute("x", 18);
        tableHead.children[1].setAttribute("x", L.table.w - 12);
        const priceX = (w) => w - 12;
        ghosts.concat(rowEls).forEach((r) => {
          r.children[1].setAttribute("width", L.KW);
          r.children[2].setAttribute("x", 18 + L.KW / 2);
          r.children[3].setAttribute("x", priceX(L.table.w));
        });
        ghosts.forEach((gh, i) => setG(gh, tablePos(i)));
        blockEls.forEach((b, g) => {
          b.children[0].setAttribute("x", L.groups.x);
          b.children[0].setAttribute("width", L.groups.w);
          b.children[1].setAttribute("x", L.groups.x + 8);
          b.children[1].setAttribute("y", L.blocks[g].y + 14);
        });
        chips.forEach((c) => {
          c.children[0].setAttribute("width", Math.min(L.groups.w, L.result.w) - 12);
          c.children[2].setAttribute("x", Math.min(L.groups.w, L.result.w) - 20);
        });
        resHead.setAttribute("x", L.result.x + 8);
        resHead.setAttribute("y", L.result.y + RH / 2 + 4);
        resFoot.setAttribute("x", L.result.x + 8);
        resFoot.setAttribute("y", L.result.y + RH * 4 + RH / 2 + 4);
        // On narrow screens the result sits below; its title moves with it
        titles[2].setAttribute("x", L.result.x + 2);
        titles[2].setAttribute("y", L.result.y - 8);
      }

      function paint(from, to, elapsed, plan) {
        const ease = HZ.easeInOut;
        const local = (delay, dur) => (elapsed === Infinity ? 1 : ease(HZ.clamp((elapsed - delay) / dur, 0, 1)));
        ROWS.forEach((_, i) => {
          const a = rowState(i, from), b = rowState(i, to);
          const t = local(plan.row(i), plan.rowDur);
          let st;
          if (to === 2 && from === 1) {
            // collapse: move to the group's first slot, fade late
            st = { x: HZ.lerp(a.x, b.x, t), y: HZ.lerp(a.y, b.y, t), o: 1 - HZ.clamp((t - 0.55) / 0.45, 0, 1) };
          } else st = lerpS(a, b, t);
          setG(rowEls[i], st);
        });
        KEYS.forEach((_, g) => {
          const a = chipState(g, from), b = chipState(g, to);
          const t = local(plan.chip(g), plan.chipDur);
          const st = lerpS(a, b, t);
          setG(chips[g], st);
          const ba = blockState(g, from), bb = blockState(g, to);
          const tb = local(plan.block(g), plan.blockDur);
          blockEls[g].style.opacity = HZ.lerp(ba.o, bb.o, tb);
          blockEls[g].children[0].setAttribute("y", Lyt.blocks[g].y);
          blockEls[g].children[0].setAttribute("height", HZ.lerp(ba.h, bb.h, tb));
        });
        const showRes = (s) => (s === 3 ? 1 : 0);
        const tr = local(plan.res, 300);
        const ro = HZ.lerp(showRes(from), showRes(to), tr);
        resHead.style.opacity = ro;
        resFoot.style.opacity = ro;
        titles[2].style.opacity = HZ.lerp(from === 3 ? 1 : 0.35, to === 3 ? 1 : 0.35, tr);
        titles[1].style.opacity = HZ.lerp(from >= 1 ? 1 : 0.35, to >= 1 ? 1 : 0.35, local(0, 300));
        ghosts.forEach((gh) => (gh.style.opacity = to === 0 && from === 0 ? 0 : 0.28));
      }

      const PLANS = {
        static: { row: () => 0, rowDur: 1, chip: () => 0, chipDur: 1, block: () => 0, blockDur: 1, res: 0, total: 0 },
        1: { row: (i) => i * 70, rowDur: 480, chip: () => 0, chipDur: 1, block: () => 0, blockDur: 300, res: 0, total: 8 * 70 + 480 },
        2: { row: (i) => groupOf[i] * 260, rowDur: 460, chip: (g) => g * 260 + 300, chipDur: 260, block: (g) => g * 260 + 120, blockDur: 380, res: 0, total: 2 * 260 + 580 },
        3: { row: () => 0, rowDur: 1, chip: (g) => g * 140, chipDur: 520, block: () => 0, blockDur: 400, res: 2 * 140 + 380, total: 2 * 140 + 700 },
      };

      // --- Text
      function values() {
        return KEYS.map((_, g) => AGGS[agg](members[g].map((i) => ROWS[i][1])));
      }
      function updateValues() {
        const vs = pandasFormat(values(), agg);
        chips.forEach((c, g) => (c.children[2].textContent = vs[g]));
        resFoot.textContent = "Name: adr, dtype: " + (agg === "count" ? "int64" : "float64");
        codeAgg.textContent = agg;
        codeRound.style.display = agg === "count" ? "none" : "";
        blockEls.forEach((b, g) => {
          const n = members[g].length;
          b.children[1].textContent = KEYS[g] + " · " + (stage >= 2 ? agg : n + (n === 1 ? " row" : " rows"));
        });
      }

      function caption() {
        const c = (s) => el("code", { text: s });
        if (stage === 0)
          return [ROWS.length, " bookings at three hotels; each colour is one hotel. A manager does not want nine rates, she wants one number per hotel."];
        if (stage === 1)
          return [el("b", { text: "Split: " }), "bookings with the same ", c("hotel"), " go into the same group, keeping their original index. 3 hotels → 3 groups. Nothing is computed yet."];
        if (stage === 2) {
          const vs = pandasFormat(values(), agg);
          const lines = KEYS.map((k, g) => el("span", { class: "hz-groupby-calc" }, [
            el("b", { text: k + ": " }), formula(agg, members[g].map((i) => ROWS[i][1])), " = ", vs[g],
          ]));
          return [el("b", { text: "Apply: " }), c("." + agg + "()"), " runs separately inside each group, on the ", c("adr"), " column only:", ...lines];
        }
        const story = agg === "mean" || agg === "median"
          ? [" Santiago, the business hotel, is the cheapest here; the full file agrees (99 USD against 140 at Viña del Mar and 156 at Puerto Varas)."]
          : agg === "count" ? [" Counting rows tells you how much evidence sits behind each number: never trust an average of two bookings."] : [];
        return [el("b", { text: "Combine: " }), "the three answers are glued into a small table (a Series). The hotel names become its index, sorted A→Z, and the column you picked gives its name, ", c("adr"), ".", ...story];
      }

      function syncUi() {
        pills.forEach((p, k) => {
          p.classList.toggle("is-on", stage === k + 1);
          p.classList.toggle("is-done", stage > k + 1);
        });
        playBtn.disabled = busy;
        stepBtn.disabled = busy || stage === 3;
        playBtn.textContent = stage === 3 && !busy ? "Replay" : "Play";
        note.replaceChildren(...caption());
        updateValues();
      }

      function renderStatic() {
        if (!Lyt) return;
        drawStatic();
        paint(stage, stage, Infinity, PLANS.static);
        syncUi();
      }

      async function advance(id) {
        const from = stage, to = stage + 1;
        const plan = PLANS[to];
        stage = to;
        syncUi();
        const alive = () => id === runId && body.isConnected;
        await HZ.tween(body, plan.total, (t) => alive() && paint(from, to, t * plan.total, plan), (t) => t);
        if (alive()) paint(to, to, Infinity, plan);
        return alive();
      }

      async function step() {
        if (busy || stage >= 3) return;
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
        if (stage === 3) {
          stage = 0;
          renderStatic();
          await HZ.wait(250);
          if (id !== runId) return;
        }
        busy = true;
        syncUi();
        while (stage < 3) {
          if (!(await advance(id))) return;
          if (stage < 3) await HZ.wait(stage === 2 ? 1600 : 900);
          if (id !== runId || !body.isConnected) return;
        }
        busy = false;
        syncUi();
      }

      function reset() {
        runId++;
        busy = false;
        stage = 0;
        renderStatic();
      }

      function setAgg(v) {
        agg = v;
        updateValues();
        if (!busy) note.replaceChildren(...caption());
        else if (stage >= 2) note.replaceChildren(...caption());
        if (stage >= 2) {
          chips.forEach((c) => {
            c.classList.remove("is-flash");
            void c.getBoundingClientRect();
            c.classList.add("is-flash");
          });
        }
      }

      // --- Size tracking
      let lastW = 0;
      function measure() {
        const w = Math.round(fig.getBoundingClientRect().width || body.clientWidth || 600);
        if (Math.abs(w - lastW) < 2) return;
        lastW = w;
        Lyt = layout(w);
        if (busy) drawStatic();
        else renderStatic();
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
    // SVG text at 12 px or more; the rest of the styles live in interactive.css
    css: `
.md-typeset .hz-x svg .hz-groupby-coltitle, .md-typeset .hz-x svg .hz-groupby-head text, .md-typeset .hz-x svg .hz-groupby-idx,
.md-typeset .hz-x svg .hz-groupby-keytxt, .md-typeset .hz-x svg .hz-groupby-blabel, .md-typeset .hz-x svg .hz-groupby-ckey,
.md-typeset .hz-x svg .hz-groupby-reshead, .md-typeset .hz-x svg .hz-groupby-resfoot { font-size: 12px; }
.md-typeset .hz-x svg .hz-groupby-price, .md-typeset .hz-x svg .hz-groupby-cval { font-size: 12.5px; }
.md-typeset .hz-groupby-code { margin: 0; padding: 0.5em 0.8em; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.66rem; background: var(--md-default-bg-color); border: 1px solid var(--hz-line); white-space: pre-wrap; overflow-wrap: anywhere; }
`,
  });
})();
