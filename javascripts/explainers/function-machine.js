/*
 * function-machine (Week 1): stay_revenue as a machine. Arguments drop in at
 * the top and bind to the parameters (a missing discount takes its default),
 * the body runs line by line with its local variables, and only the return
 * value comes out of the bottom into `revenue`.
 */
(function () {
  const { el } = HZ;
  const P = "hz-function-machine-";
  const cls = (s) => P + s.split(" ").join(" " + P);

  const CODE = [
    "def stay_revenue(adr, nights, discount=0):",
    "    total = adr * nights",
    "    if discount > 0:",
    "        total = total * (1 - discount)",
    "    return round(total, 2)",
  ];
  const DISCOUNTS = [
    { value: "0", label: "not passed" },
    { value: "0.1", label: "0.10" },
    { value: "0.15", label: "0.15" },
    { value: "0.25", label: "0.25" },
  ];

  // Python-like reprs. adr is always shown as a float (180.0), nights as an int.
  const pyFloat = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
  const tidy = (x) => pyFloat(Number(x.toFixed(6))); // hide float noise such as 487.35000000000002 in the locals
  const usd = (x) => "USD " + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Python's round(x, 2): correctly rounded on the exact binary value, ties to even.
  function round2(x) {
    const t = x.toFixed(3);
    if (t.endsWith("5") && x.toFixed(20) === t + "0".repeat(17)) {
      const cut = t.slice(0, -1);
      const last = +cut[cut.length - 1];
      if (last % 2 === 0) return Number(cut);
    }
    return Number(x.toFixed(2));
  }

  function compute(adr, nights, discount) {
    const t1 = adr * nights;
    const t2 = discount > 0 ? t1 * (1 - discount) : t1;
    return { t1, t2, ret: round2(t2) };
  }

  const badge = (type) => el("span", { class: cls("badge") + " is-" + type, text: type });

  function mount(body) {
    body.classList.add(P + "root");
    let adr = 180.5;
    let nights = 3;
    let discount = 0;
    let runId = 0;
    let timer = null;
    const log = [];

    const callExpr = () => "stay_revenue(" + pyFloat(adr) + ", " + nights + (discount > 0 ? ", discount=" + discount.toFixed(2) : "") + ")";

    // ---- Controls
    const sAdr = HZ.slider({ label: "adr (USD a night)", min: 60, max: 400, step: 0.5, value: adr, format: (v) => pyFloat(v), oninput: (v) => { adr = v; schedule(280); } });
    const sNights = HZ.slider({ label: "nights", min: 1, max: 14, step: 1, value: nights, oninput: (v) => { nights = v; schedule(280); } });
    const seg = HZ.segmented(DISCOUNTS, "0", (v) => { discount = +v; schedule(0); });
    const segWrap = el("div", { class: cls("field") }, [el("span", { class: cls("flabel"), text: "discount" }), seg.node]);
    const again = HZ.button("Call it again", () => run(true), "primary");

    // ---- Call line
    const call = el("pre", { class: cls("call"), "aria-live": "polite" });

    // ---- Hopper (arguments → parameters)
    const params = el("div", { class: cls("params") });
    const hopper = el("div", { class: cls("stage") + " " + P + "hopper" }, [el("p", { class: cls("stitle"), text: "1 · Arguments go in" }), params]);

    // ---- Machine body
    const lines = CODE.map((t, i) => el("span", { class: cls("line") + (i === 0 ? " " + P + "def" : "") }, [el("span", { text: t })]));
    const ifChip = el("span", { class: cls("cond") });
    lines[2].append(ifChip);
    const code = el("pre", { class: cls("code") }, lines);
    const locals = el("div", { class: cls("locals") });
    const localTitle = el("p", { class: cls("ltitle"), text: "Inside the function" });
    const machine = el("div", { class: cls("stage") + " " + P + "machine" }, [
      el("p", { class: cls("stitle") }, ["2 · The body runs inside the machine ", el("span", { class: cls("plate"), text: "stay_revenue" })]),
      el("div", { class: cls("mgrid") }, [
        code,
        el("div", { class: cls("localbox") }, [localTitle, locals]),
      ]),
    ]);

    // ---- Chute (return value → revenue)
    const retChip = el("span", { class: cls("ret") });
    const landed = el("span", { class: cls("landed") });
    const chute = el("div", { class: cls("stage") + " " + P + "chute" }, [
      el("p", { class: cls("stitle"), text: "3 · Only the return value comes out" }),
      el("div", { class: cls("chuterow") }, [el("span", { class: cls("slot") }, [retChip]), el("span", { class: cls("arrow"), "aria-hidden": "true", text: "→" }), landed]),
    ]);

    const logList = el("ol", { class: cls("log") });
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });

    body.append(
      el("p", { class: "hz-x__lede", html: "Revenue management writes <code>stay_revenue</code> once and calls it for any booking. Change the inputs: the arguments drop in, the body runs top to bottom, and one number comes out." }),
      el("div", { class: "hz-x__controls " + P + "ctrls" }, [sAdr.node, sNights.node, segWrap]),
      call,
      hopper,
      el("div", { class: cls("down"), "aria-hidden": "true", text: "↓" }),
      machine,
      el("div", { class: cls("down"), "aria-hidden": "true", text: "↓" }),
      chute,
      el("div", { class: cls("foot") }, [
        el("div", { class: cls("logwrap") }, [el("p", { class: cls("ltitle"), text: "Calls so far (same machine, reused)" }), logList]),
        again,
      ]),
      note
    );

    function schedule(ms) {
      clearTimeout(timer);
      call.replaceChildren(el("span", { class: cls("prompt"), text: ">>> " }), "revenue = " + callExpr());
      timer = setTimeout(() => body.isConnected && run(true), ms);
    }

    function flash(node) {
      node.classList.remove(P + "flash");
      void node.offsetWidth;
      node.classList.add(P + "flash");
    }

    function paramCard(name, value, type, tag) {
      return el("div", { class: cls("param") }, [
        el("code", { class: cls("pname"), text: name }),
        el("span", { class: cls("eq"), text: "=" }),
        el("code", { class: cls("pval"), text: value }),
        badge(type),
        tag ? el("span", { class: cls("tag") + (tag.def ? " is-default" : ""), text: tag.text }) : null,
      ]);
    }

    const localRows = {};
    function setLocal(name, value, type, calc) {
      let row = localRows[name];
      if (!row) {
        row = localRows[name] = {
          node: el("div", { class: cls("local") }),
          val: el("code", { class: cls("pval") }),
          type: el("span"),
          calc: el("span", { class: cls("lcalc") }),
        };
        row.node.append(el("code", { class: cls("pname"), text: name }), el("span", { class: cls("eq"), text: "=" }), row.val, row.type, row.calc);
        locals.append(row.node);
        row.node.classList.add(P + "in");
      } else flash(row.node);
      row.val.textContent = value;
      row.type.replaceChildren(badge(type));
      row.calc.textContent = calc || "";
    }

    function captionFinal(r) {
      const parts = [];
      parts.push(nights + (nights === 1 ? " night" : " nights") + " at " + usd(adr) + " bring " + usd(r.ret) + ". ");
      parts.push(discount > 0
        ? "You passed discount=" + discount.toFixed(2) + ", which overrides the default, so the guest pays " + Math.round((1 - discount) * 100) + "% of the full price: " + usd(r.t1 - r.ret) + " less."
        : "You did not pass a discount, so Python used its default, 0, and skipped the discount line.");
      parts.push(" total vanished after return: only " + pyFloat(r.ret) + " came out, into revenue.");
      return parts.join("");
    }

    async function run(animate) {
      const id = ++runId;
      clearTimeout(timer);
      const alive = () => id === runId && body.isConnected;
      const instant = !animate || HZ.reducedMotion();
      const pause = (ms) => (instant ? Promise.resolve() : HZ.wait(ms));
      const r = compute(adr, nights, discount);

      call.replaceChildren(el("span", { class: cls("prompt"), text: ">>> " }), "revenue = " + callExpr());
      params.replaceChildren();
      locals.replaceChildren();
      for (const k of Object.keys(localRows)) delete localRows[k];
      lines.forEach((l) => l.classList.remove("is-on", "is-skip", "is-ran"));
      ifChip.textContent = "";
      ifChip.className = cls("cond");
      retChip.textContent = "";
      retChip.className = cls("ret");
      landed.className = cls("landed");
      landed.textContent = "revenue = …";
      machine.classList.add("is-running");
      localTitle.textContent = "Inside the function (local variables)";
      const on = (i, text) => {
        lines.forEach((l, j) => l.classList.toggle("is-on", j === i));
        if (i > 0) lines.slice(1, i).forEach((l) => !l.classList.contains("is-skip") && l.classList.add("is-ran"));
        if (text) note.textContent = text;
      };

      // 1. bind arguments to parameters
      on(0, "Python matches each argument to a parameter, in order. Anything you don't pass takes its default.");
      const cards = [
        paramCard("adr", pyFloat(adr), "float"),
        paramCard("nights", String(nights), "int"),
        discount > 0 ? paramCard("discount", discount.toFixed(2), "float", { text: "passed" }) : paramCard("discount", "0", "int", { text: "← default", def: true }),
      ];
      for (const c of cards) {
        if (!instant) c.classList.add(P + "drop");
        params.append(c);
        await pause(170);
        if (!alive()) return;
      }
      await pause(260);
      if (!alive()) return;

      // 2. run the body
      on(1, "Full price first: the nightly rate times the number of nights.");
      setLocal("total", tidy(r.t1), "float", pyFloat(adr) + " * " + nights);
      await pause(420);
      if (!alive()) return;
      on(2, discount > 0 ? "discount is " + discount.toFixed(2) + ", more than 0, so the indented line runs." : "discount is 0 (the default), so the indented line is skipped.");
      ifChip.textContent = discount > 0 ? "→ True" : "→ False";
      ifChip.className = cls("cond") + (discount > 0 ? " is-true" : " is-false");
      await pause(420);
      if (!alive()) return;
      if (discount > 0) {
        on(3, "Take the discount off: keep " + Math.round((1 - discount) * 100) + "% of the full price.");
        setLocal("total", tidy(r.t2), "float", tidy(r.t1) + " * (1 - " + discount.toFixed(2) + ")");
        await pause(420);
        if (!alive()) return;
      } else lines[3].classList.add("is-skip");
      on(4, "return sends the total, rounded to cents, out of the machine.");
      await pause(320);
      if (!alive()) return;

      // 3. return: locals vanish, the value drops out
      [...locals.children].forEach((n) => n.classList.add(P + "gone"));
      localTitle.textContent = "Inside the function: gone after return";
      retChip.textContent = pyFloat(r.ret);
      retChip.classList.add("is-on");
      if (!instant) retChip.classList.add(P + "slide");
      await pause(420);
      if (!alive()) return;
      landed.textContent = "revenue = " + pyFloat(r.ret);
      landed.classList.add("is-on");
      if (!instant) flash(landed);
      lines.forEach((l) => l.classList.remove("is-on"));
      machine.classList.remove("is-running");
      note.textContent = captionFinal(r);

      log.unshift(callExpr() + "  →  " + pyFloat(r.ret));
      if (log.length > 3) log.length = 3;
      logList.replaceChildren(...log.map((t, i) => el("li", { class: i === 0 ? P + "latest" : null, text: t })));
    }

    run(false);
  }

  HZ.register("function-machine", {
    kicker: "Week 1",
    title: "A function is a machine",
    mount,
    css: `
.md-typeset .hz-function-machine-ctrls { align-items: flex-end; }
.md-typeset .hz-function-machine-field { display: flex; flex-direction: column; gap: 0.3rem; }
.md-typeset .hz-function-machine-flabel { font-size: 0.68rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-function-machine-call, .md-typeset .hz-function-machine-code {
  margin: 0; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.68rem; line-height: 1.6;
  background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color); overflow-x: auto;
}
.md-typeset .hz-function-machine-call { padding: 0.5em 0.9em; font-size: 0.74rem; white-space: pre-wrap; overflow-wrap: anywhere; }
.md-typeset .hz-function-machine-prompt { color: var(--hz-muted); }
.md-typeset .hz-function-machine-code { padding: 0.5em 0; }
.md-typeset .hz-function-machine-line { display: block; padding: 0 0.9em 0 calc(0.9em + 8ch); text-indent: -8ch; white-space: pre-wrap; overflow-wrap: anywhere; transition: background-color 200ms ease, box-shadow 200ms ease, opacity 200ms ease; }
.md-typeset .hz-function-machine-line.is-on { background: var(--hz-a-soft); box-shadow: inset 3px 0 0 var(--hz-a); }
.md-typeset .hz-function-machine-line.is-skip { opacity: 0.4; text-decoration: line-through; text-decoration-color: var(--hz-muted); }
.md-typeset .hz-function-machine-def { color: var(--md-default-fg-color--light); }
.md-typeset .hz-function-machine-cond { display: inline-block; text-indent: 0; margin-left: 0.6em; font-weight: 700; border-radius: 4px; padding: 0 0.35em; }
.md-typeset .hz-function-machine-cond.is-true { color: var(--hz-good); background: color-mix(in srgb, var(--hz-good) 14%, transparent); }
.md-typeset .hz-function-machine-cond.is-false { color: var(--hz-bad); background: color-mix(in srgb, var(--hz-bad) 12%, transparent); }

.md-typeset .hz-function-machine-toggle { display: inline-flex; align-items: center; gap: 0.45em; font-size: 0.72rem; cursor: pointer; }
.md-typeset .hz-function-machine-toggle input { accent-color: var(--md-primary-fg-color); width: 1.05em; height: 1.05em; margin: 0; }
.md-typeset .hz-function-machine-root .hz-x__seg { flex-wrap: wrap; }

.md-typeset .hz-function-machine-stage { border: 1px solid var(--hz-line); border-radius: 12px; padding: 0.6rem 0.7rem; background: var(--md-default-bg-color); min-width: 0; }
.md-typeset .hz-function-machine-machine { border: 2px solid var(--hz-ink); border-radius: 14px; transition: box-shadow 250ms ease; }
.md-typeset .hz-function-machine-machine.is-running { box-shadow: 0 0 0 4px var(--hz-a-soft); }
.md-typeset .hz-function-machine-stitle { margin: 0 0 0.5rem !important; font-size: 0.66rem; color: var(--md-default-fg-color--light); display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
.md-typeset .hz-function-machine-plate { font-family: var(--md-code-font); font-weight: 700; font-size: 0.66rem; color: var(--md-default-bg-color); background: var(--hz-ink); padding: 0.1em 0.6em; border-radius: 5px; }
.md-typeset .hz-function-machine-down { text-align: center; color: var(--hz-muted); font-size: 0.9rem; line-height: 1; margin: -0.45rem 0; }

.md-typeset .hz-function-machine-params { display: flex; flex-wrap: wrap; gap: 0.45rem; min-height: 1.9rem; }
.md-typeset .hz-function-machine-param, .md-typeset .hz-function-machine-local {
  display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; padding: 0.25rem 0.5rem; border-radius: 8px;
  border: 1px solid var(--hz-line); background: var(--hz-card); font-size: 0.68rem;
}
.md-typeset .hz-function-machine-pname { font-weight: 600; background: none !important; padding: 0 !important; }
.md-typeset .hz-function-machine-pval { background: none !important; padding: 0 !important; font-variant-numeric: tabular-nums; }
.md-typeset .hz-function-machine-eq { color: var(--hz-muted); font-family: var(--md-code-font); }
.md-typeset .hz-function-machine-tag { font-size: 0.6rem; color: var(--hz-a); font-weight: 600; }
.md-typeset .hz-function-machine-tag.is-default { color: var(--hz-b); }
.md-typeset .hz-function-machine-badge {
  display: inline-block; font-family: var(--md-code-font); font-size: 0.6rem; line-height: 1.3; padding: 0.05em 0.5em; border-radius: 999px;
  border: 1px solid currentColor; background: color-mix(in srgb, currentColor 12%, transparent); white-space: nowrap;
}
.md-typeset .hz-function-machine-badge.is-int { color: var(--hz-b); }
.md-typeset .hz-function-machine-badge.is-float { color: var(--hz-a); }
.md-typeset .hz-function-machine-badge.is-str { color: var(--hz-good); }
.md-typeset .hz-function-machine-badge.is-bool { color: var(--hz-ink); }
.md-typeset .hz-function-machine-drop { animation: hz-function-machine-drop 360ms cubic-bezier(.65,0,.35,1); }
@keyframes hz-function-machine-drop { 0% { transform: translateY(-0.8rem); opacity: 0; } 100% { transform: none; opacity: 1; } }

/* Code on top at full width (no awkward wrapping), local variables in a row underneath. */
.md-typeset .hz-function-machine-mgrid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.7rem; align-items: start; }
.md-typeset .hz-function-machine-localbox { border: 1px dashed var(--hz-line); border-radius: 10px; padding: 0.45rem 0.55rem; min-height: 4.2rem; }
.md-typeset .hz-function-machine-ltitle { margin: 0 0 0.4rem !important; font-size: 0.62rem; color: var(--hz-muted); }
.md-typeset .hz-function-machine-locals { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.35rem 0.5rem; }
.md-typeset .hz-function-machine-lcalc { flex-basis: 100%; font-family: var(--md-code-font); font-size: 0.6rem; color: var(--hz-a); }
.md-typeset .hz-function-machine-lcalc:empty { display: none; }
.md-typeset .hz-function-machine-in { animation: hz-function-machine-in 300ms ease-out; }
@keyframes hz-function-machine-in { 0% { opacity: 0; transform: translateX(-0.5rem); } 100% { opacity: 1; transform: none; } }
.md-typeset .hz-function-machine-gone { opacity: 0.25; filter: grayscale(1); transition: opacity 450ms ease, filter 450ms ease; }

.md-typeset .hz-function-machine-chuterow { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.md-typeset .hz-function-machine-slot { display: inline-flex; min-width: 5.5rem; min-height: 2.1rem; align-items: center; justify-content: center; border: 2px dashed var(--hz-line); border-radius: 10px; overflow: hidden; }
.md-typeset .hz-function-machine-ret { font-family: var(--md-code-font); font-size: 0.85rem; font-weight: 700; color: var(--hz-a); padding: 0 0.5rem; }
.md-typeset .hz-function-machine-slide { animation: hz-function-machine-slide 420ms cubic-bezier(.65,0,.35,1); }
@keyframes hz-function-machine-slide { 0% { transform: translateY(-1.6rem); opacity: 0; } 100% { transform: none; opacity: 1; } }
.md-typeset .hz-function-machine-arrow { color: var(--hz-muted); }
.md-typeset .hz-function-machine-landed { font-family: var(--md-code-font); font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 8px; border: 1px solid var(--hz-line); color: var(--hz-muted); }
.md-typeset .hz-function-machine-landed.is-on { color: var(--md-default-fg-color); border-color: var(--hz-a); font-weight: 600; }
.md-typeset .hz-function-machine-flash { animation: hz-function-machine-flash 480ms ease-out; }
@keyframes hz-function-machine-flash { 0% { background-color: var(--hz-a-soft); } 100% { background-color: transparent; } }

.md-typeset .hz-function-machine-foot { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 0.6rem; }
.md-typeset .hz-function-machine-logwrap { min-width: 0; flex: 1 1 16rem; }
.md-typeset .hz-function-machine-log { margin: 0 !important; padding: 0 !important; list-style: none; font-family: var(--md-code-font); font-size: 0.64rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-function-machine-log li { margin: 0 !important; overflow-wrap: anywhere; }
.md-typeset .hz-function-machine-log li::before { content: none; }
.md-typeset .hz-function-machine-latest { color: var(--md-default-fg-color); }
`,
  });
})();
