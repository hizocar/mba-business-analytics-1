/*
 * loop-stepper (Session 1): a step-through debugger for a for loop over five
 * Cordillera customers. The current line lights up, a "c" pointer walks the
 * list, and total / at_risk change one step at a time. A toggle shows the
 * same work as two list comprehensions, building each list item by item.
 */
(function () {
  const { el } = HZ;
  const P = "hz-loop-stepper-";
  const cls = (s) => P + s.split(" ").join(" " + P);

  const CUSTOMERS = [
    { id: "CM-10482", plan: "Plus", contract: "Month-to-month", bill: 31.9, tickets: 2 },
    { id: "CM-10517", plan: "Unlimited", contract: "24 months", bill: 44.1, tickets: 0 },
    { id: "CM-10533", plan: "Basic", contract: "Month-to-month", bill: 22.75, tickets: 4 },
    { id: "CM-10561", plan: "Prepaid", contract: "Month-to-month", bill: 11.2, tickets: 3 },
    { id: "CM-10598", plan: "Plus", contract: "12 months", bill: 36.4, tickets: 1 },
  ];
  const N = CUSTOMERS.length;
  const isHit = (c) => c.contract === "Month-to-month" && c.tickets >= 3;

  // Python's repr for a float (an integral float prints as 76.0)
  const pyFloat = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

  const LOOP_CODE = [
    "total = 0",
    "at_risk = 0",
    "for c in customers:",
    '    total = total + c["monthly_bill"]',
    '    if c["contract"] == "Month-to-month" and c["support_tickets"] >= 3:',
    "        at_risk = at_risk + 1",
    "print(total, at_risk)",
  ];
  const COMP_CODE = [
    'total = sum([c["monthly_bill"] for c in customers])',
    'at_risk = sum([1 for c in customers if c["contract"] == "Month-to-month" and c["support_tickets"] >= 3])',
    "print(total, at_risk)",
  ];

  // ---- Traces: every step is a full snapshot, so Step / Play / Reset only pick an index.
  function loopTrace() {
    const S = [];
    let total = null, risk = null;
    const base = () => ({ total, risk, c: null, visited: 0, out: "", iter: 0 });
    S.push({ ...base(), line: -1, phase: "before", note: "Nothing has run yet. Press Step to run one line at a time, or Play to watch the whole loop." });
    total = 0;
    S.push({ ...base(), line: 0, phase: "before", changed: "total", note: "total starts at 0: the running sum of bills, before we have looked at anyone." });
    risk = 0;
    S.push({ ...base(), line: 1, phase: "before", changed: "at_risk", note: "at_risk starts at 0: nobody flagged yet. Now the loop begins." });
    CUSTOMERS.forEach((c, i) => {
      const it = { c: i, visited: i, iter: i + 1, phase: "loop" };
      S.push({ ...base(), ...it, line: 2, changed: "c",
        note: i === 0
          ? "Python takes the first customer in the list (" + c.id + ") and calls it c. The indented lines now run for this customer."
          : "Back to the top of the loop: Python takes the next customer (" + c.id + ") and calls it c. Same lines, new customer." });
      const before = total;
      total = total + c.bill;
      S.push({ ...base(), ...it, line: 3, changed: "total",
        calc: (before === 0 && i === 0 ? "0" : pyFloat(before)) + " + " + pyFloat(c.bill) + " → " + pyFloat(total),
        note: 'c["monthly_bill"] is ' + pyFloat(c.bill) + ", so the running total grows to " + pyFloat(total) + "." });
      const m2m = c.contract === "Month-to-month";
      const hit = isHit(c);
      S.push({ ...base(), ...it, line: 4, cond: hit,
        note: hit
          ? "c is month-to-month and has " + plural(c.tickets, "ticket") + ": both sides of and are True, so the indented line runs."
          : m2m
            ? "c is month-to-month but has only " + plural(c.tickets, "ticket") + " (fewer than 3). and needs both, so the condition is False and at_risk stays " + risk + "."
            : "c is on a " + c.contract + " contract, so the first check is already False. at_risk stays " + risk + "." });
      if (hit) {
        risk = risk + 1;
        S.push({ ...base(), ...it, line: 5, changed: "at_risk",
          note: "c has " + plural(c.tickets, "ticket") + " and is month-to-month, so at_risk goes up to " + risk + "." });
      }
    });
    S.push({ ...base(), line: 2, visited: N, iter: N, phase: "after",
      note: "There are no customers left, so the loop ends. Python jumps to the first line that is not indented." });
    S.push({ ...base(), line: 6, visited: N, iter: N, phase: "after", out: pyFloat(total) + " " + risk,
      note: "The print runs once, after the loop: " + pyFloat(total) + " USD billed across " + N + " customers, " + risk + " of them at risk." });
    return S;
  }

  function compTrace() {
    const S = [];
    const bills = CUSTOMERS.map((c) => c.bill);
    const total = bills.reduce((a, b) => a + b, 0);
    const ones = CUSTOMERS.filter(isHit).map(() => 1);
    const base = { total: null, risk: null, c: null, list1: [], list2: [], skipped: [], out: "", sum1: false, sum2: false, visited: 0 };
    S.push({ ...base, line: -1, note: "Same job, two lines. Press Step or Play to watch Python build each list." });
    S.push({ ...base, line: 0, note: "Read the brackets as “the bill of every c in customers”. Python walks the list for you and collects one value per customer." });
    CUSTOMERS.forEach((c, i) => {
      S.push({ ...base, line: 0, c: i, visited: i, list1: bills.slice(0, i + 1),
        note: "c is " + c.id + ": its bill, " + pyFloat(c.bill) + ", drops into the new list." });
    });
    const after1 = { ...base, visited: N, list1: bills, sum1: true, total };
    S.push({ ...after1, line: 0, changed: "total",
      note: "The list is complete, and sum() adds it up: total = " + pyFloat(total) + ", exactly what the loop gave." });
    S.push({ ...after1, line: 1, note: "Second line: “1 for every c in customers if c is month-to-month with 3 or more tickets”. The if filters who gets in." });
    const skipped = [];
    let got = 0;
    CUSTOMERS.forEach((c, i) => {
      const hit = isHit(c);
      if (hit) got++;
      else skipped.push(i);
      S.push({ ...after1, line: 1, c: i, visited: i, list2: ones.slice(0, got), skipped: skipped.slice(), justSkipped: hit ? null : i,
        note: hit
          ? c.id + " is month-to-month with " + plural(c.tickets, "ticket") + ": the if lets it in, and it contributes a 1."
          : c.id + " fails the if (" + (c.contract === "Month-to-month" ? "only " + plural(c.tickets, "ticket") : c.contract) + "), so nothing goes into the list." });
    });
    const done = { ...after1, visited: N, list2: ones, skipped, sum2: true, risk: ones.length };
    S.push({ ...done, line: 1, changed: "at_risk",
      note: "Counting is summing ones: sum([1, 1]) = " + ones.length + " customers at risk." });
    S.push({ ...done, line: 2, out: pyFloat(total) + " " + ones.length,
      note: "Same result as the loop, in two lines. Use the loop when you need many steps per customer; use a comprehension to build one list." });
    return S;
  }

  function badge(type) {
    return el("span", { class: cls("badge") + " is-" + type, text: type });
  }

  function mount(body) {
    body.classList.add(P + "root");
    let mode = "loop";
    let trace = loopTrace();
    let idx = 0;
    let prev = null;
    let playing = false;
    let playId = 0;

    // ---- Code panel
    const code = el("pre", { class: cls("code"), "aria-label": "Python code" });
    let lineEls = [];
    let condChip = null;
    function buildCode() {
      const src = mode === "loop" ? LOOP_CODE : COMP_CODE;
      lineEls = src.map((t) => el("span", { class: cls("line") }, [el("span", { class: cls("txt"), text: t })]));
      condChip = el("span", { class: cls("cond") });
      if (mode === "loop") lineEls[4].append(condChip);
      code.replaceChildren(...lineEls);
    }

    // ---- Customers list
    const pointer = el("span", { class: cls("pointer"), "aria-hidden": "true", text: "c →" });
    const rows = CUSTOMERS.map((c) =>
      el("div", { class: cls("row") }, [
        el("div", { class: cls("row-top") }, [
          el("span", { class: cls("id"), text: c.id }),
          el("span", { class: cls("bill"), text: pyFloat(c.bill) + " USD" }),
        ]),
        el("div", { class: cls("row-sub"), text: c.plan + " · " + c.contract + " · " + plural(c.tickets, "ticket") }),
      ])
    );
    const rowsWrap = el("div", { class: cls("rows") }, [pointer, ...rows]);
    const listPanel = el("div", { class: cls("panel") }, [
      el("p", { class: cls("ptitle") }, [el("code", { text: "customers" }), " ", badge("list"), el("span", { class: cls("pnote"), text: N + " dicts, one per customer" })]),
      rowsWrap,
    ]);

    // ---- Variables
    const mkVar = (name) => {
      const val = el("span", { class: cls("val") });
      const type = el("span", { class: cls("tslot") });
      const calc = el("span", { class: cls("calc") });
      const node = el("div", { class: cls("var") }, [el("code", { class: cls("vname"), text: name }), type, val, calc]);
      return { node, val, type, calc };
    };
    const vC = mkVar("c"), vTotal = mkVar("total"), vRisk = mkVar("at_risk");
    const varsPanel = el("div", { class: cls("panel") }, [el("p", { class: cls("ptitle"), text: "Variables in memory" }), vC.node, vTotal.node, vRisk.node]);

    // ---- Comprehension lists
    const mkBuild = (label) => {
      const items = el("span", { class: cls("items") });
      const res = el("span", { class: cls("sum") });
      const node = el("div", { class: cls("build") }, [
        el("span", { class: cls("blabel"), text: label }),
        el("span", { class: cls("brk"), text: "[" }), items, el("span", { class: cls("brk"), text: "]" }), res,
      ]);
      return { node, items, res };
    };
    const b1 = mkBuild("bills:"), b2 = mkBuild("ones:");
    const buildPanel = el("div", { class: cls("panel") + " " + P + "buildpanel" }, [el("p", { class: cls("ptitle"), text: "Lists Python builds" }), b1.node, b2.node]);

    // ---- Controls
    const seg = HZ.segmented([{ value: "loop", label: "for loop" }, { value: "comp", label: "comprehension" }], "loop", setMode);
    const stepBtn = HZ.button("Step", () => { stop(); go(idx + 1); }, "primary");
    const playBtn = HZ.button("Play", togglePlay);
    const resetBtn = HZ.button("Reset", () => { stop(); go(0); });
    const progress = el("span", { class: cls("progress"), "aria-live": "polite" });
    const out = el("pre", { class: cls("out"), "aria-live": "polite" });
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });

    body.append(
      el("p", { class: "hz-x__lede", html: "A loop runs the same lines once for every customer in the list. Step through it and watch the variable <code>c</code> move down the list while <code>total</code> and <code>at_risk</code> pile up." }),
      el("div", { class: "hz-x__controls" }, [seg.node]),
      code,
      el("div", { class: cls("grid") }, [listPanel, el("div", { class: cls("side") }, [varsPanel, buildPanel])]),
      el("div", { class: "hz-x__controls" }, [stepBtn, playBtn, resetBtn, progress]),
      out,
      note
    );

    function flash(node) {
      node.classList.remove(P + "flash");
      void node.offsetWidth;
      node.classList.add(P + "flash");
    }

    function placePointer(i) {
      if (i === null || i === undefined) {
        pointer.style.opacity = "0";
        return;
      }
      const r = rows[i];
      pointer.style.opacity = "1";
      pointer.style.transform = "translateY(" + (r.offsetTop + r.offsetHeight / 2 - pointer.offsetHeight / 2) + "px)";
    }

    function setVar(v, text, type, changed, undefText) {
      const was = v.val.textContent;
      v.val.textContent = text === null ? undefText || "not defined yet" : text;
      v.node.classList.toggle("is-undef", text === null);
      v.type.replaceChildren(text === null ? "" : badge(type));
      if (changed && was !== v.val.textContent) flash(v.node);
    }

    function render() {
      const s = trace[idx];
      lineEls.forEach((l, i) => {
        l.classList.toggle("is-on", i === s.line);
      });
      // if-line verdict
      if (condChip) {
        const show = s.line === 4 || s.line === 5;
        condChip.textContent = show ? (s.line === 5 || s.cond ? "→ True" : "→ False") : "";
        condChip.className = cls("cond") + (show ? (s.line === 5 || s.cond ? " is-true" : " is-false") : "");
      }

      rows.forEach((r, i) => {
        r.classList.toggle("is-cur", i === s.c);
        r.classList.toggle("is-done", i < s.visited && i !== s.c);
        r.classList.toggle("is-skip", mode === "comp" && s.skipped && s.skipped.includes(i) && !s.sum2);
        r.classList.toggle("is-hit", mode === "loop" && i === s.c && s.line === 5);
      });
      placePointer(s.c);

      // c
      const c = s.c === null ? null : CUSTOMERS[s.c];
      if (mode === "loop") {
        setVar(vC, c ? "{'customer_id': '" + c.id + "', …}" : s.phase === "after" ? "{'customer_id': 'CM-10598', …}" : null, "dict", s.changed === "c");
        vC.calc.textContent = c ? "row " + (s.c + 1) + " of " + N : s.phase === "after" ? "keeps the last customer" : "";
      } else {
        setVar(vC, c ? "{'customer_id': '" + c.id + "', …}" : null, "dict", false, "exists only inside the brackets");
        vC.calc.textContent = c ? "only inside the brackets" : "";
      }
      setVar(vTotal, s.total === null ? null : s.total === 0 ? "0" : pyFloat(s.total), s.total === 0 ? "int" : "float", s.changed === "total");
      vTotal.calc.textContent = s.calc && s.line === 3 ? s.calc : "";
      setVar(vRisk, s.risk === null ? null : String(s.risk), "int", s.changed === "at_risk");
      vRisk.calc.textContent = mode === "loop" && s.line === 5 ? s.risk - 1 + " + 1 → " + s.risk : mode === "comp" && s.sum2 ? "sum([1, 1]) → " + s.risk : "";
      if (mode === "comp" && s.sum1 && s.line === 0) vTotal.calc.textContent = "sum(bills) → " + pyFloat(s.total);

      // comprehension lists (only new chips animate in)
      if (mode === "comp") {
        renderBuild(b1, s.list1, prev ? prev.list1 || [] : [], s.sum1, s.total, s.line === 0 && s.sum1);
        renderBuild(b2, s.list2, prev ? prev.list2 || [] : [], s.sum2, s.risk, s.sum2 && s.line === 1);
        b1.node.classList.toggle("is-active", s.line === 0);
        b2.node.classList.toggle("is-active", s.line === 1);
        b2.node.classList.toggle("is-idle", s.line < 1);
      }

      out.replaceChildren(
        el("span", { class: cls("echo"), text: "Output\n" }),
        el("span", { class: s.out ? cls("res") : cls("empty"), text: s.out || "(nothing printed yet)" })
      );
      note.replaceChildren(s.note);

      const last = idx === trace.length - 1;
      stepBtn.disabled = last;
      if (mode === "loop") {
        progress.textContent = s.phase === "before" ? "before the loop" : s.phase === "after" ? "after the loop" : "iteration " + s.iter + " of " + N;
      } else {
        progress.textContent = s.line === -1 ? "ready" : "line " + (s.line + 1) + " of 3";
      }
      progress.textContent += " · step " + idx + " of " + (trace.length - 1);
      prev = s;
    }

    function renderBuild(b, list, before, summed, result, justSummed) {
      const keep = summed;
      const sameStart = before.length <= list.length;
      b.items.replaceChildren(
        ...list.map((v, i) => {
          const chip = el("span", { class: cls("chip") + (summed ? " is-summed" : "") + (sameStart && i >= before.length ? " is-new" : ""), text: pyFloat(v) === "1.0" ? "1" : pyFloat(v) });
          return chip;
        }).flatMap((chip, i) => (i ? [el("span", { class: cls("comma"), text: "," }), chip] : [chip]))
      );
      if (keep) {
        const was = b.res.textContent;
        b.res.textContent = "sum → " + (Number.isInteger(result) && result < 10 ? String(result) : pyFloat(result));
        b.res.classList.add("is-on");
        if (justSummed && was !== b.res.textContent) flash(b.res);
      } else {
        b.res.textContent = "";
        b.res.classList.remove("is-on");
      }
    }

    function go(i) {
      idx = HZ.clamp(i, 0, trace.length - 1);
      render();
    }

    function stop() {
      playing = false;
      playId++;
      playBtn.textContent = "Play";
      playBtn.setAttribute("aria-pressed", "false");
    }

    async function togglePlay() {
      if (playing) return stop();
      if (idx >= trace.length - 1) go(0);
      playing = true;
      const id = ++playId;
      playBtn.textContent = "Pause";
      playBtn.setAttribute("aria-pressed", "true");
      while (id === playId && body.isConnected && idx < trace.length - 1) {
        go(idx + 1);
        await HZ.wait(mode === "loop" ? 650 : 560);
      }
      if (id === playId) stop();
    }

    function setMode(m) {
      stop();
      mode = m;
      trace = m === "loop" ? loopTrace() : compTrace();
      body.classList.toggle("is-comp", m === "comp");
      idx = 0;
      prev = null;
      buildCode();
      render();
    }

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        if (!body.isConnected) return ro.disconnect();
        placePointer(trace[idx].c);
      });
      ro.observe(rowsWrap);
    }

    buildCode();
    render();
  }

  HZ.register("loop-stepper", {
    kicker: "Session 1",
    title: "Stepping through a loop",
    mount,
    css: `
.md-typeset .hz-loop-stepper-code, .md-typeset .hz-loop-stepper-out {
  margin: 0; padding: 0.55em 0; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.68rem; line-height: 1.6;
  background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color); overflow-x: auto;
}
.md-typeset .hz-loop-stepper-line { display: block; padding: 0 0.9em 0 calc(0.9em + 6ch); text-indent: -6ch; white-space: pre-wrap; transition: background-color 200ms ease, box-shadow 200ms ease; }
.md-typeset .hz-loop-stepper-line.is-on { background: var(--hz-a-soft); box-shadow: inset 3px 0 0 var(--hz-a); }
.md-typeset .hz-loop-stepper-cond { display: inline-block; text-indent: 0; margin-left: 0.6em; font-weight: 700; border-radius: 4px; padding: 0 0.35em; }
.md-typeset .hz-loop-stepper-cond.is-true { color: var(--hz-good); background: color-mix(in srgb, var(--hz-good) 14%, transparent); }
.md-typeset .hz-loop-stepper-cond.is-false { color: var(--hz-bad); background: color-mix(in srgb, var(--hz-bad) 12%, transparent); }
.md-typeset .hz-loop-stepper-out { padding: 0.5em 0.9em; white-space: pre; }
.md-typeset .hz-loop-stepper-echo { color: var(--hz-muted); font-size: 0.9em; }
.md-typeset .hz-loop-stepper-empty { color: var(--hz-muted); }
.md-typeset .hz-loop-stepper-res { color: var(--hz-a); font-weight: 600; }

.md-typeset .hz-loop-stepper-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.8rem; align-items: start; }
@media (max-width: 52em) { .md-typeset .hz-loop-stepper-grid { grid-template-columns: minmax(0, 1fr); } }
.md-typeset .hz-loop-stepper-side { display: flex; flex-direction: column; gap: 0.8rem; min-width: 0; }
.md-typeset .hz-loop-stepper-panel { border: 1px solid var(--hz-line); border-radius: 12px; padding: 0.6rem 0.7rem; background: var(--md-default-bg-color); min-width: 0; }
.md-typeset .hz-loop-stepper-ptitle { margin: 0 0 0.45rem !important; font-size: 0.66rem; color: var(--md-default-fg-color--light); display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem; }
.md-typeset .hz-loop-stepper-pnote { color: var(--hz-muted); font-size: 0.95em; }
.md-typeset .hz-loop-stepper-badge {
  display: inline-block; font-family: var(--md-code-font); font-size: 0.6rem; line-height: 1.3; padding: 0.05em 0.5em; border-radius: 999px;
  border: 1px solid currentColor; background: color-mix(in srgb, currentColor 12%, transparent); white-space: nowrap;
}
.md-typeset .hz-loop-stepper-badge.is-int { color: var(--hz-b); }
.md-typeset .hz-loop-stepper-badge.is-float { color: var(--hz-a); }
.md-typeset .hz-loop-stepper-badge.is-str { color: var(--hz-good); }
.md-typeset .hz-loop-stepper-badge.is-bool { color: var(--hz-ink); }
.md-typeset .hz-loop-stepper-badge.is-dict, .md-typeset .hz-loop-stepper-badge.is-list { color: var(--hz-muted); }

.md-typeset .hz-loop-stepper-rows { position: relative; display: flex; flex-direction: column; gap: 0.35rem; padding-left: 2.3rem; }
.md-typeset .hz-loop-stepper-pointer {
  position: absolute; left: 0; top: 0; font-family: var(--md-code-font); font-size: 0.66rem; font-weight: 700; color: var(--hz-a);
  opacity: 0; transition: transform 380ms cubic-bezier(.65,0,.35,1), opacity 200ms ease; white-space: nowrap;
}
.md-typeset .hz-loop-stepper-row {
  border: 1px solid var(--hz-line); border-radius: 8px; padding: 0.3rem 0.55rem; background: var(--hz-card);
  transition: opacity 250ms ease, border-color 200ms ease, background-color 200ms ease;
}
.md-typeset .hz-loop-stepper-row-top { display: flex; justify-content: space-between; gap: 0.5rem; font-family: var(--md-code-font); font-size: 0.68rem; }
.md-typeset .hz-loop-stepper-id { font-weight: 600; }
.md-typeset .hz-loop-stepper-bill { font-variant-numeric: tabular-nums; }
.md-typeset .hz-loop-stepper-row-sub { font-size: 0.62rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-loop-stepper-row.is-cur { border-color: var(--hz-a); background: var(--hz-a-soft); }
.md-typeset .hz-loop-stepper-row.is-hit { border-color: var(--hz-bad); background: color-mix(in srgb, var(--hz-bad) 12%, transparent); }
.md-typeset .hz-loop-stepper-row.is-done { opacity: 0.5; }
.md-typeset .hz-loop-stepper-row.is-skip .hz-loop-stepper-row-top { text-decoration: line-through; text-decoration-color: var(--hz-muted); }

.md-typeset .hz-loop-stepper-var { display: grid; grid-template-columns: 3.6rem auto minmax(0, 1fr); align-items: center; gap: 0.15rem 0.5rem; padding: 0.3rem 0.4rem; border-radius: 8px; }
.md-typeset .hz-loop-stepper-vname { font-weight: 600; background: none !important; padding: 0 !important; }
.md-typeset .hz-loop-stepper-val { font-family: var(--md-code-font); font-size: 0.7rem; font-variant-numeric: tabular-nums; overflow-wrap: break-word; min-width: 0; }
.md-typeset .hz-loop-stepper-var.is-undef .hz-loop-stepper-val { color: var(--hz-muted); font-family: inherit; font-size: 0.64rem; font-style: italic; }
.md-typeset .hz-loop-stepper-calc { grid-column: 2 / -1; font-family: var(--md-code-font); font-size: 0.62rem; color: var(--hz-a); min-height: 0; }
.md-typeset .hz-loop-stepper-calc:empty { display: none; }
.md-typeset .hz-loop-stepper-flash { animation: hz-loop-stepper-flash 480ms ease-out; }
@keyframes hz-loop-stepper-flash { 0% { background-color: var(--hz-a-soft); } 100% { background-color: transparent; } }

.md-typeset .hz-loop-stepper-root:not(.is-comp) .hz-loop-stepper-buildpanel { display: none; }
.md-typeset .hz-loop-stepper-build { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; padding: 0.35rem 0.4rem; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.7rem; transition: opacity 250ms ease, background-color 200ms ease; }
.md-typeset .hz-loop-stepper-build.is-active { background: color-mix(in srgb, var(--hz-a) 7%, transparent); }
.md-typeset .hz-loop-stepper-build.is-idle { opacity: 0.45; }
.md-typeset .hz-loop-stepper-blabel { font-family: inherit; font-size: 0.62rem; color: var(--hz-muted); width: 3.2rem; }
.md-typeset .hz-loop-stepper-brk { color: var(--hz-muted); font-weight: 700; }
.md-typeset .hz-loop-stepper-items { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.15rem; }
.md-typeset .hz-loop-stepper-comma { color: var(--hz-muted); }
.md-typeset .hz-loop-stepper-chip { display: inline-block; padding: 0.05em 0.4em; border-radius: 5px; border: 1px solid var(--hz-a); background: var(--hz-a-soft); font-variant-numeric: tabular-nums; transition: opacity 350ms ease; }
.md-typeset .hz-loop-stepper-chip.is-new { animation: hz-loop-stepper-drop 380ms cubic-bezier(.65,0,.35,1); }
.md-typeset .hz-loop-stepper-chip.is-summed { opacity: 0.45; }
@keyframes hz-loop-stepper-drop { 0% { transform: translateY(-0.9rem); opacity: 0; } 100% { transform: none; opacity: 1; } }
.md-typeset .hz-loop-stepper-sum { margin-left: 0.3rem; font-weight: 700; color: var(--hz-a); padding: 0 0.3em; border-radius: 5px; }
.md-typeset .hz-loop-stepper-progress { font-size: 0.66rem; color: var(--hz-muted); font-family: var(--md-code-font); }
`,
  });
})();
