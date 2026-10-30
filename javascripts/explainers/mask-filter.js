/*
 * mask-filter: a condition becomes a True/False column (the mask), two masks
 * combine row by row with & or |, and df[mask] keeps only the True rows:
 * the False rows collapse away. Eight real Altamar bookings.
 */
(function () {
  const { el } = HZ;

  // [hotel, lead_time_days] of eight bookings from altamar_bookings_clean.csv
  const ROWS = [
    ["Viña del Mar", 92],
    ["Santiago", 5],
    ["Viña del Mar", 13],
    ["Viña del Mar", 104],
    ["Santiago", 135],
    ["Puerto Varas", 41],
    ["Puerto Varas", 116],
    ["Viña del Mar", 4],
  ];
  const HOTEL = "Viña del Mar";
  const A = ROWS.map(([h]) => h === HOTEL);
  const B = ROWS.map(([, t]) => t >= 90);
  const EXPR_A = 'df.hotel == "Viña del Mar"';
  const EXPR_B = "df.lead_time_days >= 90";

  const MODES = {
    A: { label: "A", cols: ["A"], expr: EXPR_A, mask: A },
    B: { label: "B", cols: ["B"], expr: EXPR_B, mask: B },
    and: { label: "A & B", cols: ["A", "B", "A & B"], expr: "(" + EXPR_A + ") & (" + EXPR_B + ")", mask: A.map((a, i) => a && B[i]) },
    or: { label: "A | B", cols: ["A", "B", "A | B"], expr: "(" + EXPR_A + ") | (" + EXPR_B + ")", mask: A.map((a, i) => a || B[i]) },
  };

  HZ.register("mask-filter", {
    kicker: "Week 2",
    title: "A mask of True and False",
    mount(body) {
      body.classList.add("hz-mask-filter");
      let mode = "and";
      let stage = 0;
      let busy = false;
      let runId = 0;
      const c = (s) => el("code", { text: s });

      body.append(el("p", { class: "hz-x__lede" }, [
        "The revenue manager asks for Viña del Mar bookings made 90 or more days ahead: the early planners at the beach. Each condition turns into a column of True/False, one per booking; ",
        c("df[mask]"), " keeps the True rows.",
      ]));

      const legend = el("div", { class: "hz-mask-filter-legend" }, [
        el("span", {}, [el("b", { class: "hz-mask-filter-letter", text: "A" }), c(EXPR_A)]),
        el("span", {}, [el("b", { class: "hz-mask-filter-letter", text: "B" }), c(EXPR_B)]),
      ]);

      const seg = HZ.segmented(Object.entries(MODES).map(([k, m]) => ({ value: k, label: m.label })), mode, (v) => {
        mode = v;
        play(true);
      });
      seg.node.setAttribute("aria-label", "Condition");
      const playBtn = HZ.button("Play", () => play(false), "primary");
      const resetBtn = HZ.button("Reset", () => reset());
      const controls = el("div", { class: "hz-x__controls" }, [seg.node, el("div", { class: "hz-mask-filter-btns" }, [playBtn, resetBtn])]);

      const codeLine = el("pre", { class: "hz-mask-filter-code" });
      const grid = el("div", { class: "hz-mask-filter-grid", role: "table", "aria-label": "Eight bookings with their masks" });
      const count = el("p", { class: "hz-mask-filter-count", "aria-live": "polite" });
      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      body.append(legend, controls, codeLine, el("div", { class: "hz-mask-filter-wrap" }, [grid]), count, note);

      let rowEls = [], badgeCols = [];

      function build() {
        const m = MODES[mode];
        grid.style.setProperty("--k", m.cols.length);
        grid.dataset.mode = mode;
        const head = el("div", { class: "hz-mask-filter-row is-head", role: "row" }, [
          el("span", { role: "columnheader", "aria-label": "index" }),
          el("span", { role: "columnheader", text: "hotel" }),
          el("span", { role: "columnheader", html: "lead_time_<wbr>days" }),
          ...m.cols.map((name, k) => el("span", { role: "columnheader", class: "hz-mask-filter-mh" + (k === 2 ? " is-result" : ""), text: name })),
        ]);
        badgeCols = m.cols.map(() => []);
        rowEls = ROWS.map(([hotel, t], i) => {
          const masks = m.cols.length === 1 ? [m.mask] : [A, B, m.mask];
          const badges = masks.map((mk, k) => {
            const b = el("span", { class: "hz-mask-filter-badge is-hidden " + (mk[i] ? "is-true" : "is-false") + (k === 2 ? " is-result" : ""), text: mk[i] ? "True" : "False" });
            badgeCols[k].push(b);
            return el("span", { role: "cell", class: "hz-mask-filter-bc" }, [b]);
          });
          return el("div", { class: "hz-mask-filter-row", role: "row" }, [
            el("span", { role: "cell", class: "hz-mask-filter-idx", text: String(i) }),
            el("span", { role: "cell", class: "hz-mask-filter-contract" + (hotel === HOTEL ? " is-m2m" : ""), text: hotel }),
            el("span", { role: "cell", class: "hz-mask-filter-t", text: String(t) }),
            ...badges,
          ]);
        });
        grid.replaceChildren(head, ...rowEls);
        codeLine.replaceChildren(el("span", { class: "hz-mask-filter-dim", text: "df[" }), el("span", { text: m.expr }), el("span", { class: "hz-mask-filter-dim", text: "]" }));
      }

      function caption() {
        const m = MODES[mode];
        const n = m.mask.filter(Boolean).length;
        if (stage === 0) return ["Eight bookings. Press Play: pandas checks the condition on every row at once, no loop needed. Switch between A, B, A & B and A | B to compare."];
        if (stage === 1) {
          if (mode === "A" || mode === "B")
            return [el("b", { text: "The mask: " }), "one True/False per booking, same index as ", c("df"), ". ", c(m.mask.filter(Boolean).length + " True"), " so far; nothing is removed yet."];
          if (mode === "and")
            return [el("b", { text: "& means AND: " }), "a row is True only when A ", el("em", { text: "and" }), " B are both True. Each condition needs its own parentheses."];
          return [el("b", { text: "| means OR: " }), "a row is True when A ", el("em", { text: "or" }), " B (or both) is True. OR always keeps at least as many rows as either condition alone."];
        }
        if (mode === "and") return [el("b", { text: "Filtered: " }), "the False rows are gone. ", n, " of 8 bookings are at Viña del Mar ", el("em", { text: "and" }), " were made 90+ days ahead: exactly what the revenue manager asked for. The index keeps the original labels."];
        if (mode === "or") return [el("b", { text: "Filtered: " }), n, " of 8 bookings meet at least one condition: every Viña booking plus every early booking anywhere. Much broader than the request. OR is the right tool for “either one”."];
        return [el("b", { text: "Filtered: " }), c("df[mask]"), " keeps the ", n, " True rows of 8. The index keeps the original labels, so you can trace every row back."];
      }

      function sync() {
        const m = MODES[mode];
        const n = m.mask.filter(Boolean).length;
        count.replaceChildren(
          stage === 2 ? el("span", {}, [c("len(df[mask])"), " → ", el("b", { text: String(n) }), " of 8 rows"]) : el("span", {}, [c("len(df)"), " → ", el("b", { text: "8" }), " rows"])
        );
        note.replaceChildren(...caption());
        playBtn.disabled = busy;
        playBtn.textContent = stage === 2 && !busy ? "Replay" : "Play";
      }

      const reveal = (nodes, ms) =>
        nodes.forEach((b, k) => {
          b.style.transitionDelay = (HZ.reducedMotion() ? 0 : k * ms) + "ms";
          b.classList.remove("is-hidden");
        });

      async function play(fromSwitch) {
        const id = ++runId;
        const alive = () => id === runId && body.isConnected;
        busy = true;
        stage = 0;
        build();
        sync();
        await HZ.wait(fromSwitch ? 150 : 250);
        if (!alive()) return;
        // 1. masks: column by column, row by row
        stage = 1;
        sync();
        for (let k = 0; k < badgeCols.length; k++) {
          if (k === 2) grid.classList.add("is-combining");
          reveal(badgeCols[k], k === 2 ? 110 : 70);
          await HZ.wait(badgeCols[k].length * (k === 2 ? 110 : 70) + 350);
          if (!alive()) return;
        }
        await HZ.wait(1100);
        if (!alive()) return;
        // 2. filter: False rows collapse
        stage = 2;
        const mk = MODES[mode].mask;
        rowEls.forEach((r, i) => {
          if (!mk[i]) {
            r.style.transitionDelay = (HZ.reducedMotion() ? 0 : i * 40) + "ms";
            r.classList.add("is-out");
          } else r.classList.add("is-kept");
        });
        await HZ.wait(700);
        if (!alive()) return;
        busy = false;
        sync();
      }

      function reset() {
        runId++;
        busy = false;
        stage = 0;
        grid.classList.remove("is-combining");
        build();
        sync();
      }

      reset();
    },
    css: `
.md-typeset .hz-mask-filter-legend { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.68rem; }
.md-typeset .hz-mask-filter-legend span { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; }
.md-typeset .hz-mask-filter-letter { display: inline-grid; place-items: center; width: 1.5em; height: 1.5em; border-radius: 50%; background: var(--hz-b-soft); color: var(--hz-b); font-family: var(--md-code-font); }
.md-typeset .hz-mask-filter-btns { display: flex; gap: 0.4rem; }
.md-typeset .hz-mask-filter-code {
  margin: 0; padding: 0.5em 0.8em; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.66rem; line-height: 1.5;
  background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color); white-space: pre-wrap; overflow-wrap: anywhere;
}
.md-typeset .hz-mask-filter-dim { color: var(--hz-muted); }
.md-typeset .hz-mask-filter-wrap { overflow-x: auto; }
.md-typeset .hz-mask-filter-grid { display: flex; flex-direction: column; font-size: 0.68rem; min-width: min-content; max-width: 34rem; }
.md-typeset .hz-mask-filter-row {
  display: grid; grid-template-columns: 1.4em minmax(6.6em, 1.4fr) minmax(4em, 0.9fr) repeat(var(--k), minmax(3.4em, 0.8fr));
  gap: 0 0.5em; align-items: center; padding: 0.22em 0.3em; max-height: 3em; overflow: hidden; border-radius: 6px;
  transition: max-height 480ms cubic-bezier(.65,0,.35,1), opacity 380ms ease, padding 480ms cubic-bezier(.65,0,.35,1), background-color 250ms ease;
}
.md-typeset .hz-mask-filter-row:not(.is-head) { border-top: 1px solid var(--hz-line); }
.md-typeset .hz-mask-filter-row.is-head { font-family: var(--md-code-font); font-weight: 700; font-size: 0.92em; line-height: 1.2; align-items: end; padding-bottom: 0.35em; }
.md-typeset .hz-mask-filter-row.is-out { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; border-top-color: transparent; }
.md-typeset .hz-mask-filter-row.is-kept { background: color-mix(in srgb, var(--hz-good) 10%, transparent); }
.md-typeset .hz-mask-filter-idx { font-family: var(--md-code-font); color: var(--hz-muted); font-weight: 700; }
.md-typeset .hz-mask-filter-contract { white-space: nowrap; }
.md-typeset .hz-mask-filter-t { font-family: var(--md-code-font); text-align: right; padding-right: 0.8em; }
.md-typeset .hz-mask-filter-mh { text-align: center; color: var(--hz-b); }
.md-typeset .hz-mask-filter-mh.is-result { color: var(--hz-a); }
.md-typeset .hz-mask-filter-bc { display: flex; justify-content: center; }
.md-typeset .hz-mask-filter-badge {
  font-family: var(--md-code-font); font-size: 0.9em; padding: 0.1em 0.5em; border-radius: 999px; border: 1px solid;
  transition: opacity 260ms ease, transform 300ms cubic-bezier(.34,1.4,.64,1);
}
.md-typeset .hz-mask-filter-badge.is-hidden { opacity: 0; transform: scale(0.6); }
.md-typeset .hz-mask-filter-badge.is-true { color: var(--hz-good); border-color: var(--hz-good); background: color-mix(in srgb, var(--hz-good) 12%, transparent); }
.md-typeset .hz-mask-filter-badge.is-false { color: var(--hz-muted); border-color: var(--hz-line); }
.md-typeset .hz-mask-filter-badge.is-result { font-weight: 700; box-shadow: 0 0 0 1px currentColor; }
.md-typeset .hz-mask-filter-count { font-size: 0.7rem; }
.md-typeset .hz-mask-filter .hz-x__note { min-height: 3.8em; }
@media (max-width: 30em) {
  .md-typeset .hz-mask-filter-grid { font-size: 0.6rem; }
  .md-typeset .hz-mask-filter-row { gap: 0 0.3em; grid-template-columns: 1.1em minmax(6.2em, 1.4fr) minmax(3.4em, 0.9fr) repeat(var(--k), minmax(3em, 0.8fr)); }
  .md-typeset .hz-mask-filter-badge { padding: 0.1em 0.35em; }
}
`,
  });
})();
