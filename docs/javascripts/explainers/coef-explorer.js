/*
 * coef-explorer: Session 3. A new customer's predicted bill is built as a
 * waterfall: intercept + one bar per term (coefficient × value). Changing a
 * control resizes its bar and shifts every bar after it, so you can see each
 * coefficient doing its part. Coefficients come from the class's fitted model.
 */
(function () {
  const { el } = HZ;

  // From Session_3_Monthly_Bill (LinearRegression on the training set), rounded as the notebook prints them.
  const C = {
    intercept: 10.019,
    plan: { Prepaid: 0, Basic: 10.16, Plus: 23.089, Unlimited: 26.701 },
    contract: { "Month-to-month": 0, "12 months": -1.861, "24 months": -4.004 },
    gb: 0.275,
    minutes: 0.012,
    roaming: 7.951,
    other: -0.122, // age 30, Metropolitana, autopay, credit card, 0 tickets, 0 months: fixed for this customer
  };
  const START = { plan: "Plus", contract: "12 months", gb: 18, minutes: 250, roaming: 0 };
  const MAX = 80;
  const money = (v, sign) => (sign ? (v < 0 ? "−" : "+") : v < 0 ? "−" : "") + "$" + Math.abs(v).toFixed(2);

  const css = `
.md-typeset .hz-ce-controls { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.55rem 0.9rem; align-items: center; font-size: 0.72rem; }
.md-typeset .hz-ce-controls > span { color: var(--md-default-fg-color--light); }
.md-typeset .hz-ce-controls .hz-x__seg { flex-wrap: wrap; justify-self: start; }
.md-typeset .hz-ce-controls .hz-x__slider { grid-template-columns: minmax(8rem, 16rem) 4.6em; }
.md-typeset .hz-ce-controls .hz-x__slider > span { display: none; }
.md-typeset .hz-ce-check { display: inline-flex; align-items: center; gap: 0.45em; cursor: pointer; }
.md-typeset .hz-ce-check input { accent-color: var(--md-primary-fg-color); width: 1.05em; height: 1.05em; margin: 0; }
@media (max-width: 30em) {
  .md-typeset .hz-ce-controls { grid-template-columns: minmax(0, 1fr); gap: 0.25rem; }
  .md-typeset .hz-ce-controls > span { margin-top: 0.35rem; }
  .md-typeset .hz-ce-controls .hz-x__slider { grid-template-columns: minmax(0, 1fr) 4.6em; }
}
.md-typeset .hz-ce-fall { display: flex; flex-direction: column; gap: 0.3rem; }
.md-typeset .hz-ce-row { display: grid; grid-template-columns: minmax(9rem, 13rem) minmax(0, 1fr) 4.6em; gap: 0.7rem; align-items: center; border-radius: 8px; padding: 0.12rem 0.3rem; transition: background-color 400ms ease; }
.md-typeset .hz-ce-row.is-changed { background: var(--hz-a-soft); }
.md-typeset .hz-ce-lab { font-size: 0.7rem; line-height: 1.25; color: var(--md-default-fg-color); }
.md-typeset .hz-ce-lab small { display: block; font-family: var(--md-code-font); font-size: 0.6rem; color: var(--hz-muted); }
.md-typeset .hz-ce-track { position: relative; height: 1.25rem; background: linear-gradient(90deg, var(--hz-grid) 1px, transparent 1px) 0 0 / 12.5% 100%; border-left: 1px solid var(--hz-line); }
.md-typeset .hz-ce-bar, .md-typeset .hz-ce-guide { position: absolute; top: 0; bottom: 0; transition: left 480ms cubic-bezier(.65,0,.35,1), width 480ms cubic-bezier(.65,0,.35,1); }
.md-typeset .hz-ce-bar { border-radius: 3px; min-width: 2px; }
.md-typeset .hz-ce-guide { width: 0; border-left: 1px dashed var(--hz-muted); top: -0.45rem; bottom: -0.45rem; opacity: 0.6; }
.md-typeset .hz-ce-row.is-base .hz-ce-bar { background: var(--hz-muted); }
.md-typeset .hz-ce-row.is-pos .hz-ce-bar { background: var(--hz-a); }
.md-typeset .hz-ce-row.is-neg .hz-ce-bar { background: var(--hz-b); }
.md-typeset .hz-ce-row.is-zero .hz-ce-bar { background: var(--hz-line); }
.md-typeset .hz-ce-row.is-other .hz-ce-bar { background: var(--hz-line); }
.md-typeset .hz-ce-row.is-total { border-top: 1px solid var(--hz-line); border-radius: 0; padding-top: 0.4rem; margin-top: 0.15rem; }
.md-typeset .hz-ce-row.is-total .hz-ce-bar { background: var(--hz-ink); }
.md-typeset .hz-ce-row.is-total .hz-ce-lab { font-weight: 700; }
.md-typeset .hz-ce-val { font-family: var(--md-code-font); font-size: 0.7rem; text-align: right; font-variant-numeric: tabular-nums; }
.md-typeset .hz-ce-row.is-pos .hz-ce-val { color: var(--hz-a); }
.md-typeset .hz-ce-row.is-neg .hz-ce-val { color: var(--hz-b); }
.md-typeset .hz-ce-row.is-total .hz-ce-val { font-weight: 700; font-size: 0.8rem; }
.md-typeset .hz-ce-axis { position: relative; height: 1rem; font-family: var(--md-code-font); font-size: 0.6rem; color: var(--hz-muted); }
.md-typeset .hz-ce-axis span { position: absolute; transform: translateX(-50%); }
@media (max-width: 30em) {
  .md-typeset .hz-ce-row { grid-template-columns: minmax(0, 1fr) 4.6em; grid-template-areas: "lab val" "track track"; gap: 0.15rem 0.5rem; }
  .md-typeset .hz-ce-lab { grid-area: lab; }
  .md-typeset .hz-ce-val { grid-area: val; }
  .md-typeset .hz-ce-track { grid-area: track; }
  .md-typeset .hz-ce-axisrow { grid-template-columns: minmax(0, 1fr); grid-template-areas: none; }
  .md-typeset .hz-ce-axisrow > span { display: none; }
  .md-typeset .hz-ce-axisrow > .hz-ce-axis { grid-area: auto; }
  .md-typeset .hz-ce-controls .hz-x__seg { flex-wrap: nowrap; }
  .md-typeset .hz-ce-controls .hz-x__seg button { padding: 0.4em 0.55em; font-size: 0.6rem; white-space: nowrap; }
}
.md-typeset .hz-ce .hz-x__note { min-height: 3.6em; }
.md-typeset .hz-ce-src { font-size: 0.64rem; color: var(--hz-muted); }
`;

  HZ.register("coef-explorer", {
    kicker: "Session 3",
    title: "Building a bill from the coefficients",
    css,
    mount(body) {
      body.classList.add("hz-ce", "tex2jax_ignore"); // keep MathJax away from the dollar amounts
      const s = { ...START };
      let changed = null, shownTotal = 0, totalRun = 0;

      body.append(el("p", { class: "hz-x__lede", html:
        "A linear regression predicts by <strong>adding</strong>: start from the intercept, then add each coefficient times the customer's value. Change the new customer's profile and watch which bar moves, and how every bar after it shifts." }));

      // --- Controls
      const planSeg = HZ.segmented(Object.keys(C.plan).map((v) => ({ value: v, label: v })), s.plan, (v) => update("plan", v));
      const contractSeg = HZ.segmented(Object.keys(C.contract).map((v) => ({ value: v, label: v })), s.contract, (v) => update("contract", v));
      const gbSl = HZ.slider({ label: "Data used (GB)", min: 0, max: 60, step: 1, value: s.gb, format: (v) => v + " GB", oninput: (v) => update("gb", v) });
      const minSl = HZ.slider({ label: "Call minutes", min: 0, max: 800, step: 10, value: s.minutes, format: (v) => v + " min", oninput: (v) => update("minutes", v) });
      const roam = el("input", { type: "checkbox" });
      roam.addEventListener("change", () => update("roaming", roam.checked ? 1 : 0));
      planSeg.node.setAttribute("aria-label", "Plan");
      contractSeg.node.setAttribute("aria-label", "Contract");
      body.append(el("div", { class: "hz-ce-controls" }, [
        el("span", { text: "Plan" }), planSeg.node,
        el("span", { text: "Contract" }), contractSeg.node,
        el("span", { text: "Data used" }), gbSl.node,
        el("span", { text: "Call minutes" }), minSl.node,
        el("span", { text: "Roaming" }), el("label", { class: "hz-ce-check" }, [roam, "used international roaming last month"]),
      ]));

      // --- Waterfall
      const TERMS = [
        { key: "intercept", label: () => "Intercept", sub: () => "every customer starts here", value: () => C.intercept, base: true },
        { key: "plan", label: () => "Plan: " + s.plan, sub: () => (s.plan === "Prepaid" ? "reference plan: +0" : "vs Prepaid"), value: () => C.plan[s.plan] },
        { key: "contract", label: () => "Contract: " + s.contract, sub: () => (s.contract === "Month-to-month" ? "reference: +0" : "vs month-to-month"), value: () => C.contract[s.contract] },
        { key: "gb", label: () => "Data: " + s.gb + " GB", sub: () => s.gb + " × $" + C.gb.toFixed(3), value: () => s.gb * C.gb },
        { key: "minutes", label: () => "Calls: " + s.minutes + " min", sub: () => s.minutes + " × $" + C.minutes.toFixed(3), value: () => s.minutes * C.minutes },
        { key: "roaming", label: () => "Roaming: " + (s.roaming ? "yes" : "no"), sub: () => s.roaming + " × $" + C.roaming.toFixed(3), value: () => s.roaming * C.roaming },
        { key: "other", label: () => "Everything else", sub: () => "age, region, payment… (fixed)", value: () => C.other, other: true },
      ];
      const fall = el("div", { class: "hz-ce-fall", role: "group", "aria-label": "Predicted bill built term by term" });
      const rows = TERMS.map((t) => {
        const lab = el("span", { class: "hz-ce-lab" });
        const bar = el("div", { class: "hz-ce-bar" });
        const guide = el("div", { class: "hz-ce-guide" });
        const val = el("span", { class: "hz-ce-val" });
        const row = el("div", { class: "hz-ce-row" }, [lab, el("div", { class: "hz-ce-track" }, [guide, bar]), val]);
        fall.append(row);
        return { t, row, lab, bar, guide, val };
      });
      const totLab = el("span", { class: "hz-ce-lab", text: "Predicted monthly bill" });
      const totBar = el("div", { class: "hz-ce-bar" });
      const totVal = el("span", { class: "hz-ce-val" });
      fall.append(el("div", { class: "hz-ce-row is-total" }, [totLab, el("div", { class: "hz-ce-track" }, [totBar]), totVal]));
      const axis = el("div", { class: "hz-ce-axis" }, [0, 20, 40, 60, 80].map((v) => el("span", { style: `left:${(v / MAX) * 100}%`, text: "$" + v })));
      fall.append(el("div", { class: "hz-ce-row hz-ce-axisrow" }, [el("span"), axis, el("span")]));
      axis.classList.add("hz-ce-track");
      axis.style.background = "none";
      axis.style.borderLeft = "0";

      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      const src = el("p", { class: "hz-ce-src", html:
        "Coefficients come from this class's model (step 06), as the notebook prints them. The other features are held at this customer's values (age 30, Metropolitana, autopay with a credit card, brand new, no tickets) and add −$0.12. Because of rounding, the total can differ from <code>model.predict</code> by a cent or two." });
      body.append(fall, note, src);

      const pct = (v) => (HZ.clamp(v, 0, MAX) / MAX) * 100 + "%";

      function draw() {
        let cum = 0;
        rows.forEach((r) => {
          const v = r.t.value();
          const a = cum, b = cum + v;
          r.bar.style.left = pct(Math.min(a, b));
          r.bar.style.width = `calc(${pct(Math.max(a, b))} - ${pct(Math.min(a, b))})`;
          r.guide.style.left = pct(a);
          r.guide.style.display = r.t.base ? "none" : "";
          r.lab.replaceChildren(r.t.label(), el("small", { text: r.t.sub() }));
          r.val.textContent = r.t.base ? money(v) : money(v, true);
          r.row.className = "hz-ce-row " + (r.t.base ? "is-base" : r.t.other ? "is-other" : Math.abs(v) < 0.005 ? "is-zero" : v > 0 ? "is-pos" : "is-neg");
          r.row.classList.toggle("is-changed", r.t.key === changed);
          cum = b;
        });
        totBar.style.left = "0%";
        totBar.style.width = pct(cum);
        countTo(cum);
        note.innerHTML = caption(cum);
      }

      // The total rolls to its new value, in step with the bars.
      function countTo(v) {
        const from = shownTotal, id = ++totalRun;
        HZ.tween(body, 480, (k) => {
          if (id !== totalRun) return;
          shownTotal = HZ.lerp(from, v, k);
          totVal.textContent = money(shownTotal);
        });
      }

      function caption(total) {
        const t = "Predicted bill: <strong>" + money(total) + "</strong>. ";
        if (changed === "plan") {
          if (s.plan === "Prepaid") return t + "Prepaid is the <strong>reference</strong> plan: its bar is zero, and every other plan is priced against it.";
          return t + `On ${s.plan}, the model adds ${money(C.plan[s.plan], true)} compared with an otherwise identical Prepaid customer.` + (s.plan === "Unlimited" ? " Unlimited is only " + money(C.plan.Unlimited - C.plan.Plus) + " above Plus here, because the model also charges every GB the same price." : "");
        }
        if (changed === "contract")
          return t + (s.contract === "Month-to-month" ? "Month-to-month is the reference contract, so its bar is zero." : `A ${s.contract.replace(" months", "-month")} contract is ${money(-C.contract[s.contract])} cheaper than month-to-month, whatever the plan.`);
        if (changed === "gb") return t + `Each GB adds ${money(C.gb)}, so 10 GB more is about ${money(10 * C.gb)}. The bar grows in a straight line: that is what "linear" means.`;
        if (changed === "minutes") return t + `Each minute adds ${money(C.minutes)} (rounded), so 100 minutes more is about ${money(100 * C.minutes)}. A small coefficient can still matter when the values are large.`;
        if (changed === "roaming") return t + (s.roaming ? `Roaming adds ${money(C.roaming)} on top of everything else, the same for every plan: a linear model adds each effect on its own.` : "No roaming: that term is 1 × 0 = 0.");
        return t + "This is the new customer from step 06: a Plus plan on a 12-month contract, 18 GB and 250 minutes, no roaming.";
      }

      function update(key, v) {
        s[key] = v;
        changed = key;
        draw();
      }

      draw();
    },
  });
})();
