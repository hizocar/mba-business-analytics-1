/*
 * if-flow: the retention team's first rule as a flowchart (Session 1).
 * Pick a contract and a number of support tickets; a token walks the
 * if / elif / else path, each test shows how it evaluated, the matching
 * code line lights up, and the branches Python never looks at dim out.
 */
(function () {
  const { el, svg } = HZ;

  const MTM = "Month-to-month";
  const CONTRACTS = [MTM, "12 months", "24 months"];
  const CUSTOMERS = [
    { id: "CM-10482", contract: MTM, tickets: 2 },
    { id: "CM-10517", contract: "24 months", tickets: 0 },
    { id: "CM-10533", contract: MTM, tickets: 4 },
    { id: "CM-10561", contract: MTM, tickets: 3 },
    { id: "CM-10598", contract: "12 months", tickets: 1 },
  ];
  const CODE = [
    'if contract == "Month-to-month" and support_tickets >= 3:',
    '    risk = "at risk"',
    'elif contract == "Month-to-month" or support_tickets >= 3:',
    '    risk = "watch"',
    "else:",
    '    risk = "ok"',
  ];

  // Geometry (vertical flowchart so it stays legible on phones)
  const W = 400, H = 440;
  const CX = 130, OX = 330;
  const D1 = 128, D2 = 278, OKY = 396, A = 102, B = 50;
  const BOXW = 118, BOXH = 54;
  const P = {
    start: [CX, 46],
    d1top: [CX, D1 - B], d1right: [CX + A, D1], d1bot: [CX, D1 + B],
    risk: [OX - BOXW / 2, D1],
    d2top: [CX, D2 - B], d2right: [CX + A, D2], d2bot: [CX, D2 + B],
    watch: [OX - BOXW / 2, D2],
    ok: [CX, OKY - BOXH / 2],
  };

  function mount(body) {
    body.classList.add("hz-if-flow");
    let contract = MTM, tickets = 2;
    let runId = 0;

    // ---------- Figure
    const fig = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-if-flow-fig", role: "img", "aria-label": "Flowchart of the retention rule: if, elif, else" });

    const edge = (from, to, label, lx, ly, anchor) => {
      const [x1, y1] = from, [x2, y2] = to;
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const hx = x2 - 2 * Math.cos(ang), hy = y2 - 2 * Math.sin(ang);
      const head = [
        [hx, hy],
        [hx - 9 * Math.cos(ang) + 5 * Math.sin(ang), hy - 9 * Math.sin(ang) - 5 * Math.cos(ang)],
        [hx - 9 * Math.cos(ang) - 5 * Math.sin(ang), hy - 9 * Math.sin(ang) + 5 * Math.cos(ang)],
      ];
      const g = svg("g", { class: "hz-if-flow-edge" }, [
        svg("line", { x1, y1, x2: hx - 6 * Math.cos(ang), y2: hy - 6 * Math.sin(ang) }),
        svg("polygon", { points: head.map((p) => p.join(",")).join(" ") }),
        label ? svg("text", { x: lx, y: ly, "text-anchor": anchor || "middle", class: "hz-if-flow-elabel", text: label }) : null,
      ]);
      fig.append(g);
      return g;
    };
    const diamond = (cy, l1, l2) => {
      const g = svg("g", { class: "hz-if-flow-diamond" }, [
        svg("polygon", { points: `${CX},${cy - B} ${CX + A},${cy} ${CX},${cy + B} ${CX - A},${cy}` }),
        svg("text", { x: CX, y: cy - 4, "text-anchor": "middle", class: "hz-if-flow-dtext", text: l1 }),
        svg("text", { x: CX, y: cy + 14, "text-anchor": "middle", class: "hz-if-flow-dtext", text: l2 }),
      ]);
      fig.append(g);
      return g;
    };
    const box = (cx, cy, value, cls) => {
      const g = svg("g", { class: "hz-if-flow-box " + cls }, [
        svg("rect", { x: cx - BOXW / 2, y: cy - BOXH / 2, width: BOXW, height: BOXH, rx: 10 }),
        svg("text", { x: cx, y: cy - 6, "text-anchor": "middle", class: "hz-if-flow-bsub", text: "risk =" }),
        svg("text", { x: cx, y: cy + 15, "text-anchor": "middle", class: "hz-if-flow-bval", text: "'" + value + "'" }),
      ]);
      fig.append(g);
      return g;
    };
    const keyword = (x, y, text) => {
      const t = svg("text", { x, y, class: "hz-if-flow-kw", text });
      fig.append(t);
      return t;
    };

    const start = svg("g", { class: "hz-if-flow-start" }, [
      svg("rect", { x: CX - 70, y: 12, width: 140, height: 34, rx: 17 }),
      svg("text", { x: CX, y: 34, "text-anchor": "middle", text: "one customer" }),
    ]);
    fig.append(start);

    const E = {
      start: edge(P.start, P.d1top),
      d1yes: edge(P.d1right, P.risk, "True", (P.d1right[0] + P.risk[0]) / 2, D1 - 9),
      d1no: edge(P.d1bot, P.d2top, "False", CX + 8, (P.d1bot[1] + P.d2top[1]) / 2 + 5, "start"),
      d2yes: edge(P.d2right, P.watch, "True", (P.d2right[0] + P.watch[0]) / 2, D2 - 9),
      d2no: edge(P.d2bot, P.ok, "False", CX + 8, (P.d2bot[1] + P.ok[1]) / 2 + 5, "start"),
    };
    const N = {
      d1: diamond(D1, "Month-to-month", "AND tickets ≥ 3?"),
      d2: diamond(D2, "Month-to-month", "OR tickets ≥ 3?"),
      risk: box(OX, D1, "at risk", "is-risk"),
      watch: box(OX, D2, "watch", "is-watch"),
      ok: box(CX, OKY, "ok", "is-ok"),
    };
    const K = { if: keyword(14, D1 - B + 6, "if"), elif: keyword(14, D2 - B + 6, "elif"), else: keyword(14, OKY + 5, "else") };
    const token = svg("circle", { r: 7, class: "hz-if-flow-token", cx: P.start[0], cy: P.start[1], opacity: 0 });
    fig.append(token);

    // ---------- Side panel
    const seg = HZ.segmented(CONTRACTS.map((c) => ({ value: c, label: c })), contract, (v) => { contract = v; syncPresets(); go(); });
    const sld = HZ.slider({ label: "support_tickets", min: 0, max: 6, value: tickets, oninput: (v) => { tickets = v; syncPresets(); go(); } });
    const presetBtns = CUSTOMERS.map((c) =>
      el("button", {
        type: "button", class: "hz-list-index-chip", text: c.id, title: c.contract + ", " + c.tickets + " tickets",
        "aria-label": "Customer " + c.id + ": " + c.contract + ", " + c.tickets + " tickets",
        onclick: () => { contract = c.contract; tickets = c.tickets; seg.set(contract); sld.set(tickets); syncPresets(); go(); },
      })
    );
    function syncPresets() {
      presetBtns.forEach((b, i) => b.setAttribute("aria-pressed", String(CUSTOMERS[i].contract === contract && CUSTOMERS[i].tickets === tickets)));
    }

    const evalBox = el("div", { class: "hz-if-flow-eval", "aria-live": "polite" });
    const outcome = el("div", { class: "hz-if-flow-outcome" });

    const side = el("div", { class: "hz-if-flow-side" }, [
      el("div", { class: "hz-if-flow-field" }, [el("span", { class: "hz-if-flow-flabel", text: "contract" }), seg.node]),
      sld.node,
      el("div", { class: "hz-if-flow-field" }, [
        el("span", { class: "hz-if-flow-flabel", text: "or pick a customer" }),
        el("div", { class: "hz-list-index-chips", role: "group", "aria-label": "Customers" }, presetBtns),
      ]),
      evalBox,
      outcome,
    ]);

    const codeLines = CODE.map((line) => el("span", { class: "hz-if-flow-line", text: line }));
    const code = el("pre", { class: "hz-if-flow-code", "aria-label": "The rule in Python" }, codeLines);
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });

    body.append(
      el("p", { class: "hz-x__lede" }, [
        "The retention team's first rule, as Python reads it: test the ",
        el("code", { text: "if" }), "; only if it fails, test the ", el("code", { text: "elif" }),
        "; only if that fails too, run the ", el("code", { text: "else" }), ". Change the customer and follow the dot.",
      ]),
      el("div", { class: "hz-x__split" }, [el("div", { class: "hz-if-flow-figwrap" }, [fig]), side]),
      code,
      note
    );

    // ---------- Evaluation rows
    const tv = (b) => el("b", { class: b ? "is-true" : "is-false", text: b ? "True" : "False" });
    function evalRows(which, m, t3) {
      const rows = [el("p", { class: "hz-if-flow-ehead" }, [el("code", { text: which })])];
      if (which === "if") {
        rows.push(
          el("p", {}, [el("code", { text: 'contract == "Month-to-month"' }), " → ", tv(m)]),
          el("p", {}, [el("code", { text: "support_tickets >= 3" }), " → ", tv(t3)]),
          el("p", { class: "is-total" }, [el("code", { text: (m ? "True" : "False") + " and " + (t3 ? "True" : "False") }), " → ", tv(m && t3)])
        );
      } else {
        rows.push(el("p", { class: "is-total" }, [el("code", { text: (m ? "True" : "False") + " or " + (t3 ? "True" : "False") }), " → ", tv(m || t3)]));
      }
      return el("div", { class: "hz-if-flow-eblock" }, rows);
    }

    // ---------- Run
    function clear() {
      [...Object.values(E), ...Object.values(N), start].forEach((n) => n.classList.remove("is-on", "is-dim", "is-true", "is-false"));
      Object.values(K).forEach((k) => k.classList.remove("is-on", "is-dim"));
      codeLines.forEach((l) => l.classList.remove("is-active", "is-done", "is-skip"));
      evalBox.replaceChildren();
      outcome.replaceChildren();
      token.setAttribute("opacity", 0);
    }
    const setLine = (i) => codeLines.forEach((l, j) => {
      if (l.classList.contains("is-active")) { l.classList.remove("is-active"); l.classList.add("is-done"); }
      if (j === i) l.classList.add("is-active");
    });
    const place = ([x, y]) => { token.setAttribute("cx", x); token.setAttribute("cy", y); };

    async function go() {
      const id = ++runId;
      const alive = () => id === runId && body.isConnected;
      const instant = HZ.reducedMotion();
      clear();
      note.textContent = "Python tests the if first…";

      const m = contract === MTM, t3 = tickets >= 3;
      const pass1 = m && t3, pass2 = !pass1 && (m || t3);
      const result = pass1 ? "at risk" : pass2 ? "watch" : "ok";

      const move = async (a, b, ms) => {
        if (instant) return place(b);
        await HZ.tween(body, ms, (t) => alive() && place([HZ.lerp(a[0], b[0], t), HZ.lerp(a[1], b[1], t)]));
      };
      const pause = (ms) => (instant ? Promise.resolve() : HZ.wait(ms));
      const fadeToken = (to) => (instant ? token.setAttribute("opacity", to) : HZ.tween(body, 160, (t) => alive() && token.setAttribute("opacity", to ? t : 1 - t)));

      // 1. Into the if
      start.classList.add("is-on");
      place(P.start);
      await fadeToken(1);
      if (!alive()) return;
      E.start.classList.add("is-on");
      await move(P.start, P.d1top, 320);
      if (!alive()) return;
      await fadeToken(0);
      N.d1.classList.add("is-on");
      K.if.classList.add("is-on");
      setLine(0);
      const b1 = evalRows("if", m, t3);
      evalBox.append(b1);
      for (const r of b1.children) { r.classList.add("is-in"); await pause(150); if (!alive()) return; }
      N.d1.classList.add(pass1 ? "is-true" : "is-false");
      await pause(200);
      if (!alive()) return;

      if (pass1) {
        E.d1yes.classList.add("is-on");
        place(P.d1right);
        await fadeToken(1);
        await move(P.d1right, P.risk, 340);
        if (!alive()) return;
        await finish(N.risk, 1, [E.d1no, E.d2yes, E.d2no, N.d2, N.watch, N.ok, K.elif, K.else], [2, 3, 4, 5]);
        evalBox.append(el("div", { class: "hz-if-flow-eblock is-skipped" }, [el("p", { class: "hz-if-flow-ehead" }, [el("code", { text: "elif" }), " not checked: the if already matched"])]));
        return;
      }

      E.d1no.classList.add("is-on");
      place(P.d1bot);
      await fadeToken(1);
      await move(P.d1bot, P.d2top, 340);
      if (!alive()) return;
      await fadeToken(0);
      N.d2.classList.add("is-on");
      K.elif.classList.add("is-on");
      codeLines[1].classList.add("is-skip");
      N.risk.classList.add("is-dim");
      setLine(2);
      const b2 = evalRows("elif", m, t3);
      evalBox.append(b2);
      for (const r of b2.children) { r.classList.add("is-in"); await pause(150); if (!alive()) return; }
      N.d2.classList.add(pass2 ? "is-true" : "is-false");
      await pause(200);
      if (!alive()) return;

      if (pass2) {
        E.d2yes.classList.add("is-on");
        place(P.d2right);
        await fadeToken(1);
        await move(P.d2right, P.watch, 340);
        if (!alive()) return;
        await finish(N.watch, 3, [E.d1yes, E.d2no, N.risk, N.ok, K.else], [1, 4, 5]);
        return;
      }
      E.d2no.classList.add("is-on");
      K.else.classList.add("is-on");
      place(P.d2bot);
      await fadeToken(1);
      setLine(4);
      await move(P.d2bot, P.ok, 340);
      if (!alive()) return;
      codeLines[3].classList.add("is-skip");
      await finish(N.ok, 5, [E.d1yes, E.d2yes, N.risk, N.watch], [1, 3]);

      async function finish(node, line, dim, skip) {
        setLine(line);
        node.classList.add("is-on");
        token.setAttribute("opacity", 0);
        dim.forEach((n) => n.classList.add("is-dim"));
        skip.forEach((i) => codeLines[i].classList.add("is-skip"));
        outcome.replaceChildren(el("span", { class: "hz-if-flow-badge is-" + result.replace(" ", "-") }, [el("code", { text: "risk = '" + result + "'" })]));
        note.textContent = caption();
      }
      function caption() {
        const kind = contract === MTM ? MTM : contract.replace(" months", "-month");
        const tk = tickets + (tickets === 1 ? " ticket" : " tickets");
        if (pass1) return "Month-to-month and " + tk + ": both parts of the if are True, so risk = 'at risk'. Python stops at the first branch that matches, so the elif and the else are never even checked.";
        if (pass2 && m) return "Month-to-month, but only " + tk + ": the if needs both, so it fails. The elif needs either one, so it passes → 'watch'.";
        if (pass2) return tk + ", but on a " + kind + " contract: the if needs both, so it fails. The elif needs either one, so it passes → 'watch'.";
        return "A " + kind + " contract and " + tk + ": neither condition holds, so the if and the elif both fail and Python falls through to else → 'ok'.";
      }
    }

    syncPresets();
    note.textContent = "";
    go();
  }

  HZ.register("if-flow", {
    kicker: "Session 1",
    title: "Following the retention rule",
    mount,
    css: `
.md-typeset .hz-if-flow-figwrap { max-width: 26rem; width: 100%; margin: 0 auto; }
.md-typeset .hz-x svg.hz-if-flow-fig text { font-size: 13px; }
.md-typeset .hz-if-flow-edge line { stroke: var(--hz-line); stroke-width: 2; transition: stroke 250ms ease, opacity 250ms ease; }
.md-typeset .hz-if-flow-edge polygon { fill: var(--hz-line); transition: fill 250ms ease; }
.md-typeset .hz-if-flow-edge.is-on line { stroke: var(--hz-a); stroke-width: 2.5; }
.md-typeset .hz-if-flow-edge.is-on polygon { fill: var(--hz-a); }
.md-typeset .hz-x svg.hz-if-flow-fig text.hz-if-flow-elabel { font-size: 12.5px; font-weight: 600; fill: var(--hz-muted); }
.md-typeset .hz-x svg.hz-if-flow-fig .is-on text.hz-if-flow-elabel { fill: var(--hz-a); }
.md-typeset .hz-if-flow-edge.is-dim, .md-typeset .hz-if-flow-diamond.is-dim, .md-typeset .hz-if-flow-box.is-dim { opacity: 0.28; }
.md-typeset .hz-if-flow-edge, .md-typeset .hz-if-flow-diamond, .md-typeset .hz-if-flow-box { transition: opacity 300ms ease; }
.md-typeset .hz-if-flow-start rect { fill: var(--md-default-bg-color); stroke: var(--hz-line); stroke-width: 1.5; }
.md-typeset .hz-if-flow-start.is-on rect { stroke: var(--hz-a); }
.md-typeset .hz-x svg.hz-if-flow-fig .hz-if-flow-start text { fill: var(--md-default-fg-color); }
.md-typeset .hz-if-flow-diamond polygon { fill: var(--md-default-bg-color); stroke: var(--hz-line); stroke-width: 1.5; transition: fill 250ms ease, stroke 250ms ease; }
.md-typeset .hz-if-flow-diamond.is-on polygon { stroke: var(--hz-a); stroke-width: 2.2; fill: var(--hz-a-soft); }
.md-typeset .hz-if-flow-diamond.is-on { animation: hz-if-flow-pulse 520ms ease-in-out; transform-box: fill-box; transform-origin: center; }
.md-typeset .hz-if-flow-diamond.is-true polygon { stroke: var(--hz-good); fill: color-mix(in srgb, var(--hz-good) 14%, transparent); }
.md-typeset .hz-if-flow-diamond.is-false polygon { stroke: var(--hz-muted); fill: color-mix(in srgb, var(--hz-muted) 10%, transparent); }
@keyframes hz-if-flow-pulse { 50% { transform: scale(1.04); } }
.md-typeset .hz-x svg.hz-if-flow-fig text.hz-if-flow-dtext { font-size: 13.5px; fill: var(--md-default-fg-color); }
.md-typeset .hz-x svg.hz-if-flow-fig text.hz-if-flow-kw { font-size: 14px; font-weight: 700; fill: var(--hz-muted); transition: fill 250ms ease, opacity 250ms ease; }
.md-typeset .hz-x svg.hz-if-flow-fig text.hz-if-flow-kw.is-on { fill: var(--hz-a); }
.md-typeset .hz-x svg.hz-if-flow-fig text.hz-if-flow-kw.is-dim { opacity: 0.35; }
.md-typeset .hz-if-flow-box { --hz-if-c: var(--hz-muted); }
.md-typeset .hz-if-flow-box.is-risk { --hz-if-c: var(--hz-bad); }
.md-typeset .hz-if-flow-box.is-watch { --hz-if-c: var(--hz-a); }
.md-typeset .hz-if-flow-box.is-ok { --hz-if-c: var(--hz-good); }
.md-typeset .hz-if-flow-box rect { fill: var(--md-default-bg-color); stroke: var(--hz-if-c); stroke-width: 1.5; stroke-dasharray: 4 3; transition: fill 250ms ease; }
.md-typeset .hz-if-flow-box.is-on rect { stroke-dasharray: none; stroke-width: 2.5; fill: color-mix(in srgb, var(--hz-if-c) 16%, transparent); }
.md-typeset .hz-if-flow-box.is-on { animation: hz-if-flow-pop 380ms ease-out; transform-box: fill-box; transform-origin: center; }
@keyframes hz-if-flow-pop { 0% { transform: scale(0.92); } 55% { transform: scale(1.06); } 100% { transform: scale(1); } }
.md-typeset .hz-x svg.hz-if-flow-fig text.hz-if-flow-bsub { font-size: 12px; }
.md-typeset .hz-x svg.hz-if-flow-fig text.hz-if-flow-bval { font-size: 15px; font-weight: 700; fill: var(--hz-if-c); }
.md-typeset .hz-if-flow-token { fill: var(--hz-a); stroke: var(--hz-card); stroke-width: 2; }
.md-typeset .hz-if-flow-side { display: flex; flex-direction: column; gap: 0.7rem; min-width: 0; }
.md-typeset .hz-if-flow-field { display: flex; flex-direction: column; gap: 0.3rem; align-items: flex-start; }
.md-typeset .hz-if-flow-flabel { font-family: var(--md-code-font); font-size: 0.64rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-if-flow-side .hz-x__seg { flex-wrap: wrap; max-width: 100%; border-radius: 12px; }
.md-typeset .hz-if-flow-side .hz-x__seg button { border-radius: 9px; }
.md-typeset .hz-if-flow-side .hz-x__slider { grid-template-columns: minmax(0, 1fr) 2em; gap: 0.2rem 0.6rem; font-family: var(--md-code-font); font-size: 0.64rem; width: 100%; }
.md-typeset .hz-if-flow-side .hz-x__slider > span { grid-column: 1 / -1; color: var(--md-default-fg-color--light); }
.md-typeset .hz-if-flow-side .hz-list-index-chip[aria-pressed="true"] { border-color: var(--hz-a); background: var(--hz-a-soft); }
.md-typeset .hz-if-flow-eval { display: flex; flex-direction: column; gap: 0.45rem; min-height: 6.5rem; }
.md-typeset .hz-if-flow-eblock { border-left: 2px solid var(--hz-line); padding-left: 0.6rem; display: flex; flex-direction: column; gap: 0.12rem; }
.md-typeset .hz-if-flow-eblock p { margin: 0; font-size: 0.66rem; opacity: 0; transform: translateX(-4px); transition: opacity 220ms ease, transform 220ms ease; overflow-wrap: anywhere; }
.md-typeset .hz-if-flow-eblock p.is-in, .md-typeset .hz-if-flow-eblock.is-skipped p { opacity: 1; transform: none; }
.md-typeset .hz-if-flow-eblock.is-skipped { color: var(--hz-muted); font-size: 0.64rem; border-left-style: dashed; }
.md-typeset .hz-if-flow-eblock p.is-total { font-weight: 600; }
.md-typeset .hz-if-flow-eblock b { font-family: var(--md-code-font); font-weight: 600; }
.md-typeset .hz-if-flow-eblock b.is-true { color: var(--hz-good); }
.md-typeset .hz-if-flow-eblock b.is-false { color: var(--hz-bad); }
.md-typeset .hz-if-flow-ehead code { font-weight: 700; color: var(--hz-a); }
.md-typeset .hz-if-flow-outcome { min-height: 2rem; }
.md-typeset .hz-if-flow-badge { --hz-if-c: var(--hz-muted); display: inline-block; padding: 0.3em 0.9em; border-radius: 999px; border: 1.5px solid var(--hz-if-c); background: color-mix(in srgb, var(--hz-if-c) 14%, transparent); animation: hz-if-flow-pop 380ms ease-out; }
.md-typeset .hz-if-flow-badge code { background: none; padding: 0; color: var(--hz-if-c); font-weight: 700; font-size: 0.8rem; }
.md-typeset .hz-if-flow-badge.is-at-risk { --hz-if-c: var(--hz-bad); }
.md-typeset .hz-if-flow-badge.is-watch { --hz-if-c: var(--hz-a); }
.md-typeset .hz-if-flow-badge.is-ok { --hz-if-c: var(--hz-good); }
.md-typeset .hz-if-flow-code {
  margin: 0; padding: 0.5em 0; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.7rem; line-height: 1.6;
  background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color); overflow-x: auto;
}
.md-typeset .hz-if-flow-line { display: block; padding: 0 0.9em; white-space: pre; transition: background-color 200ms ease, box-shadow 200ms ease, opacity 200ms ease; }
.md-typeset .hz-if-flow-line.is-active { background: var(--hz-a-soft); box-shadow: inset 3px 0 0 var(--hz-a); }
.md-typeset .hz-if-flow-line.is-skip { opacity: 0.38; }
@media (max-width: 30em) {
  .md-typeset .hz-x svg.hz-if-flow-fig text, .md-typeset .hz-x svg.hz-if-flow-fig text.hz-if-flow-dtext { font-size: 15px; }
  .md-typeset .hz-x svg.hz-if-flow-fig text.hz-if-flow-elabel, .md-typeset .hz-x svg.hz-if-flow-fig text.hz-if-flow-bsub { font-size: 14px; }
  .md-typeset .hz-x svg.hz-if-flow-fig text.hz-if-flow-kw { font-size: 16px; }
  .md-typeset .hz-x svg.hz-if-flow-fig text.hz-if-flow-bval { font-size: 17px; }
  .md-typeset .hz-if-flow-code { font-size: 0.62rem; }
}
@media (prefers-reduced-motion: reduce) {
  .md-typeset .hz-if-flow-diamond.is-on, .md-typeset .hz-if-flow-box.is-on, .md-typeset .hz-if-flow-badge { animation: none; }
}
`,
  });
})();
