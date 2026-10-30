/*
 * vectorize (Session 1): the same operation on 12 bills, two ways. The Python
 * loop lane touches one bill per step; the NumPy lane applies the operation to
 * the whole array in one call. "Race" runs both side by side.
 */
(function () {
  const { el } = HZ;
  const P = "hz-vectorize-";
  const cls = (s) => P + s.split(" ").join(" " + P);

  const BILLS = [29.4, 30.8, 30.1, 35.6, 32.3, 31.9, 44.1, 22.75, 11.2, 36.4, 18.9, 52.3];
  const N = BILLS.length;
  const cents = (x) => x.toFixed(2);

  const OPS = {
    mul: {
      label: "* 1.05",
      loop: ["new = []", "for b in bills:", "    new.append(b * 1.05)"],
      np: ["new = bills * 1.05"],
      cell: (b) => ({ text: cents(b * 1.05), cls: "is-new" }),
      done: "Every bill went up 5%. Same 12 numbers in both lanes.",
    },
    gt: {
      label: "> 40",
      loop: ["flags = []", "for b in bills:", "    flags.append(b > 40)"],
      np: ["flags = bills > 40"],
      cell: (b) => (b > 40 ? { text: "True", cls: "is-true" } : { text: "False", cls: "is-false" }),
      done: "A comparison gives one True/False per customer: a mask. 2 bills are above 40 USD.",
    },
    sum: {
      label: "sum",
      loop: ["total = 0", "for b in bills:", "    total = total + b"],
      np: ["total = bills.sum()"],
      cell: () => ({ text: null, cls: "is-used" }),
      done: "Both lanes add up to 375.75 USD of revenue.",
    },
  };

  function mount(body) {
    let op = "mul";
    let runId = 0;

    const seg = HZ.segmented(Object.entries(OPS).map(([value, o]) => ({ value, label: o.label })), op, (v) => { op = v; reset(); });
    const race = HZ.button("Race", () => run(), "primary");
    const resetBtn = HZ.button("Reset", () => reset());
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });

    function lane(title, sub) {
      const code = el("pre", { class: cls("code") });
      const steps = el("span", { class: cls("steps"), text: "0 steps" });
      const flag = el("span", { class: cls("flag") });
      const cells = BILLS.map((b) => el("span", { class: cls("cell") }, [el("span", { class: cls("v"), text: String(b) })]));
      const acc = el("span", { class: cls("acc") });
      const node = el("div", { class: cls("lane") }, [
        el("div", { class: cls("head") }, [
          el("span", { class: cls("title"), text: title }),
          el("span", { class: cls("sub"), text: sub }),
          el("span", { class: cls("meta") }, [steps, flag]),
        ]),
        code,
        el("div", { class: cls("cells") }, cells),
        acc,
      ]);
      return { node, code, steps, flag, cells, acc };
    }
    const L = lane("Python loop", "one bill per step");
    const A = lane("NumPy array", "the whole column in one call");

    body.append(
      el("p", { class: "hz-x__lede", html: "Twelve customers' bills, the same job done two ways. Press <strong>Race</strong>: the loop visits one bill at a time, the array does them all at once. (New prices are shown rounded to cents.)" }),
      el("div", { class: "hz-x__controls" }, [seg.node, race, resetBtn]),
      el("pre", { class: cls("def"), text: "bills = np.array([" + BILLS.join(", ") + "])" }),
      L.node,
      A.node,
      note
    );

    function setSteps(ln, k) {
      ln.steps.textContent = k + (k === 1 ? " step" : " steps");
    }

    function reset() {
      ++runId;
      const o = OPS[op];
      for (const [ln, src] of [[L, o.loop], [A, o.np]]) {
        ln.code.replaceChildren(...src.map((t) => el("span", { class: cls("line"), text: t })));
        ln.cells.forEach((c, i) => {
          c.className = cls("cell");
          c.firstChild.textContent = String(BILLS[i]);
        });
        ln.node.classList.remove("is-done", "is-busy");
        ln.flag.textContent = "";
        setSteps(ln, 0);
        ln.acc.textContent = op === "sum" ? "total = 0" : "";
        ln.acc.classList.toggle("is-on", op === "sum");
      }
      note.textContent = "Press Race to run both lanes at the same time.";
      race.disabled = false;
    }

    function apply(cell, i) {
      const r = OPS[op].cell(BILLS[i]);
      cell.className = cls("cell") + " " + r.cls;
      if (r.text !== null) cell.firstChild.textContent = r.text;
    }

    async function runLoop(id) {
      const alive = () => id === runId && body.isConnected;
      const lines = L.code.children;
      L.node.classList.add("is-busy");
      let total = 0;
      for (let i = 0; i < N; i++) {
        lines[1] && lines[1].classList.add("is-on");
        L.cells.forEach((c) => c.classList.remove("is-cur"));
        L.cells[i].classList.add("is-cur");
        await HZ.wait(90);
        if (!alive()) return;
        lines[1].classList.remove("is-on");
        lines[2].classList.add("is-on");
        apply(L.cells[i], i);
        L.cells[i].classList.add("is-cur");
        total += BILLS[i];
        if (op === "sum") L.acc.textContent = "total = " + cents(total);
        setSteps(L, i + 1);
        await HZ.wait(130);
        if (!alive()) return;
        lines[2].classList.remove("is-on");
      }
      L.cells.forEach((c) => c.classList.remove("is-cur"));
      L.node.classList.remove("is-busy");
      L.node.classList.add("is-done");
      L.flag.textContent = "done";
    }

    async function runArray(id) {
      const alive = () => id === runId && body.isConnected;
      const line = A.code.children[0];
      A.node.classList.add("is-busy");
      line.classList.add("is-on");
      A.cells.forEach((c) => c.classList.add("is-cur"));
      await HZ.wait(260);
      if (!alive()) return;
      A.cells.forEach((c, i) => apply(c, i));
      if (op === "sum") A.acc.textContent = "total = " + cents(BILLS.reduce((a, b) => a + b, 0));
      setSteps(A, 1);
      await HZ.wait(200);
      if (!alive()) return;
      line.classList.remove("is-on");
      A.cells.forEach((c) => c.classList.remove("is-cur"));
      A.node.classList.remove("is-busy");
      A.node.classList.add("is-done");
      A.flag.textContent = "done";
      note.textContent = "The array lane is already done after one step. The loop is still walking the list, one Python step per customer…";
    }

    async function run() {
      reset();
      const id = runId;
      race.disabled = true;
      note.textContent = "Both lanes start now.";
      await Promise.all([runLoop(id), runArray(id)]);
      if (id !== runId || !body.isConnected) return;
      race.disabled = false;
      note.textContent = OPS[op].done + " The loop made " + N + " trips through Python; NumPy made one call and ran its loop in fast compiled code. With 5,000 customers that is 5,000 trips against still one call.";
    }

    reset();
  }

  HZ.register("vectorize", {
    kicker: "Session 1",
    title: "One at a time vs all at once",
    mount,
    css: `
.md-typeset .hz-vectorize-def, .md-typeset .hz-vectorize-code {
  margin: 0; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.66rem; line-height: 1.6;
  background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color);
  padding: 0.4em 0; white-space: pre-wrap; overflow-wrap: anywhere;
}
.md-typeset .hz-vectorize-def { padding: 0.4em 0.9em; color: var(--md-default-fg-color--light); }
.md-typeset .hz-vectorize-line { display: block; padding: 0 0.9em; white-space: pre-wrap; transition: background-color 150ms ease, box-shadow 150ms ease; }
.md-typeset .hz-vectorize-line.is-on { background: var(--hz-a-soft); box-shadow: inset 3px 0 0 var(--hz-a); }
.md-typeset .hz-vectorize-lane { display: flex; flex-direction: column; gap: 0.5rem; border: 1px solid var(--hz-line); border-radius: 12px; padding: 0.6rem 0.7rem; background: var(--md-default-bg-color); transition: border-color 250ms ease; }
.md-typeset .hz-vectorize-lane.is-done { border-color: var(--hz-good); }
.md-typeset .hz-vectorize-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.6rem; }
.md-typeset .hz-vectorize-title { font-weight: 700; font-size: 0.74rem; }
.md-typeset .hz-vectorize-sub { font-size: 0.64rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-vectorize-meta { margin-left: auto; display: inline-flex; gap: 0.5rem; align-items: baseline; font-family: var(--md-code-font); font-size: 0.66rem; }
.md-typeset .hz-vectorize-steps { font-variant-numeric: tabular-nums; color: var(--hz-a); font-weight: 600; }
.md-typeset .hz-vectorize-flag { color: var(--hz-good); font-weight: 700; }
.md-typeset .hz-vectorize-cells { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 0.25rem; }
@media (max-width: 44em) { .md-typeset .hz-vectorize-cells { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
.md-typeset .hz-vectorize-cell {
  display: flex; align-items: center; justify-content: center; min-height: 2rem; border-radius: 6px; border: 1px solid var(--hz-line);
  background: var(--hz-card); font-family: var(--md-code-font); font-size: 0.62rem; font-variant-numeric: tabular-nums;
  transition: background-color 200ms ease, border-color 200ms ease, transform 200ms ease, color 200ms ease;
}
.md-typeset .hz-vectorize-cell.is-cur { border-color: var(--hz-a); transform: translateY(-2px); box-shadow: 0 2px 0 var(--hz-a-soft); }
.md-typeset .hz-vectorize-cell.is-new { background: var(--hz-a-soft); border-color: var(--hz-a); }
.md-typeset .hz-vectorize-cell.is-true { background: color-mix(in srgb, var(--hz-good) 16%, transparent); border-color: var(--hz-good); color: var(--hz-good); font-weight: 700; }
.md-typeset .hz-vectorize-cell.is-false { color: var(--hz-muted); }
.md-typeset .hz-vectorize-cell.is-used { background: var(--hz-b-soft); border-color: var(--hz-b); }
.md-typeset .hz-vectorize-acc { display: none; align-self: flex-start; font-family: var(--md-code-font); font-size: 0.74rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 8px; border: 1px solid var(--hz-b); color: var(--md-default-fg-color); }
.md-typeset .hz-vectorize-acc.is-on { display: inline-block; }
`,
  });
})();
