/*
 * loc-iloc: the same six customers addressed by label (loc) and by position
 * (iloc). The index is customer IDs, not 0..n, so the two visibly differ:
 * the axis that is read lights up first, then the selected cells, then the
 * stop of a slice is marked as included (loc) or excluded (iloc).
 */
(function () {
  const { el } = HZ;

  const IDS = ["CM-12254", "CM-10004", "CM-10861", "CM-11339", "CM-13440", "CM-10173"];
  const COLS = ["plan", "age", "monthly_bill", "churned"];
  const ROWS = [
    ["Basic", "34", "25.46", "0"],
    ["Basic", "57", "37.26", "0"],
    ["Plus", "51", "41.37", "0"],
    ["Prepaid", "38", "11.43", "0"],
    ["Unlimited", "31", "40.97", "0"],
    ["Plus", "31", "37.05", "1"],
  ];
  const ALL = [0, 1, 2, 3];

  // Outputs exactly as pandas prints them
  const PRESETS = [
    {
      code: 'df.loc["CM-10004", "plan"]', mode: "loc", rows: [1], cols: [0], out: "'Basic'",
      cap: (c) => [el("b", { text: "loc reads labels. " }), "Row label ", c("CM-10004"), ", column label ", c("plan"), ". One label on each axis gives back one value."],
    },
    {
      code: "df.iloc[1, 0]", mode: "iloc", rows: [1], cols: [0], out: "'Basic'",
      cap: (c) => [el("b", { text: "iloc counts positions from 0. " }), "Row position 1, column position 0: the same cell as ", c('df.loc["CM-10004", "plan"]'), ", written with a different address."],
    },
    {
      code: "df.iloc[0:3, 1:3]", mode: "iloc", rows: [0, 1, 2], cols: [1, 2], rowStop: 3, colStop: 3, incl: false,
      out: "             age  monthly_bill\ncustomer_id                   \nCM-12254      34         25.46\nCM-10004      57         37.26\nCM-10861      51         41.37",
      cap: (c) => [el("b", { text: "iloc slices exclude the stop, " }), "like Python lists: ", c("0:3"), " is positions 0, 1, 2. Row 3 (", c("CM-11339"), ") and column 3 (", c("churned"), ") are where it stops, so they are left out."],
    },
    {
      code: 'df.loc["CM-12254":"CM-10861", "plan":"age"]', mode: "loc", rows: [0, 1, 2], cols: [0, 1], rowStop: 2, colStop: 1, incl: true,
      out: "              plan  age\ncustomer_id            \nCM-12254     Basic   34\nCM-10004     Basic   57\nCM-10861      Plus   51",
      cap: (c) => [el("b", { text: "loc slices include the stop. " }), c("CM-10861"), " and ", c("age"), " are in the result. Labels have no “one before”, so pandas keeps both ends."],
    },
    {
      code: 'df.loc[df.plan == "Plus", ["plan", "monthly_bill"]]', mode: "loc", rows: [2, 5], cols: [0, 2], mask: true,
      out: "             plan  monthly_bill\ncustomer_id                    \nCM-10861     Plus         41.37\nCM-10173     Plus         37.05",
      cap: (c) => [el("b", { text: "A condition picks the rows. " }), c('df.plan == "Plus"'), " gives one True/False per customer (left), ", c("loc"), " keeps the True rows, and the list picks two columns by name."],
    },
    {
      code: "df.iloc[2]", mode: "iloc", rows: [2], cols: ALL,
      out: "plan             Plus\nage                51\nmonthly_bill    41.37\nchurned             0\nName: CM-10861, dtype: object",
      cap: (c) => [el("b", { text: "One position, no column: " }), "the whole third row, as a Series named after its label, ", c("CM-10861"), "."],
    },
    {
      code: "df.loc[2]", mode: "loc", rows: [], cols: [], error: true, out: "KeyError: 2",
      cap: (c) => [el("b", { text: "No label is called 2. " }), c("loc"), " searched the customer IDs and found nothing. With the default 0, 1, 2… index, ", c("loc[2]"), " and ", c("iloc[2]"), " happen to agree, which is why this mistake hides until the index changes."],
    },
  ];

  HZ.register("loc-iloc", {
    kicker: "Session 2",
    title: "loc reads labels, iloc counts positions",
    mount(body) {
      body.classList.add("hz-loc-iloc");
      let runId = 0;
      const c = (s) => el("code", { text: s });

      body.append(el("p", { class: "hz-x__lede" }, [
        "Six customers with ", c("customer_id"), " as the index, so the row labels are not 0, 1, 2. The grey numbers are positions. Pick an expression and watch which axis pandas reads.",
      ]));

      const chips = PRESETS.map((p, k) => el("button", { type: "button", class: "hz-loc-iloc-chip", onclick: () => run(k) }, p.code));
      const chipRow = el("div", { class: "hz-loc-iloc-chips", role: "group", "aria-label": "Selection examples" }, chips);

      // Table: positions row, header row, then rows of [pos, label, values]
      const posTop = COLS.map((_, j) => el("th", { class: "hz-loc-iloc-pos", "data-c": j, text: String(j) }));
      const heads = COLS.map((n) => el("th", { class: "hz-loc-iloc-name", scope: "col", html: n.replace("_", "_<wbr>") }));
      const gutterHead = el("th", { class: "hz-loc-iloc-pos hz-loc-iloc-gh", text: "pos" });
      const posLeft = IDS.map((_, i) => el("td", { class: "hz-loc-iloc-pos", text: String(i) }));
      const labels = IDS.map((id) => el("th", { class: "hz-loc-iloc-label", scope: "row", text: id }));
      const cells = ROWS.map((r) => r.map((v, j) => el("td", { class: j === 0 ? "is-text" : null, text: v })));
      const table = el("table", { class: "hz-loc-iloc-table" }, [
        el("thead", {}, [
          el("tr", {}, [el("th"), el("th"), ...posTop]),
          el("tr", {}, [gutterHead, el("th", { class: "hz-loc-iloc-idxname", html: "customer_<wbr>id" }), ...heads]),
        ]),
        el("tbody", {}, IDS.map((_, i) => el("tr", {}, [posLeft[i], labels[i], ...cells[i]]))),
      ]);
      const stopNote = el("p", { class: "hz-loc-iloc-stop", "aria-hidden": "true" }, [el("i"), el("span")]);
      const wrap = el("div", { class: "hz-loc-iloc-wrap" }, [table, stopNote]);

      const codeLine = el("code", { class: "hz-loc-iloc-code" });
      const modeTag = el("span", { class: "hz-loc-iloc-mode" });
      const out = el("pre", { class: "hz-loc-iloc-out", "aria-live": "polite" });
      const side = el("div", { class: "hz-loc-iloc-side" }, [
        el("div", { class: "hz-loc-iloc-prompt" }, [modeTag, el("span", { text: ">>> " }), codeLine]),
        out,
      ]);
      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      body.append(chipRow, el("div", { class: "hz-loc-iloc-main" }, [wrap, side]), note);

      const resetMarks = () => {
        table.querySelectorAll("th, td").forEach((n) => {
          n.classList.remove("is-axis", "is-on", "is-stop-in", "is-stop-out", "is-bad", "is-true", "is-false");
          n.style.transitionDelay = "0ms";
        });
        posLeft.forEach((n, i) => (n.textContent = String(i)));
        stopNote.className = "hz-loc-iloc-stop";
        gutterHead.textContent = "pos";
      };
      const stagger = (nodes, cls, ms) =>
        nodes.forEach((n, k) => {
          n.style.transitionDelay = (HZ.reducedMotion() ? 0 : k * ms) + "ms";
          n.classList.add(cls);
        });

      async function run(k) {
        const p = PRESETS[k];
        const id = ++runId;
        const alive = () => id === runId && body.isConnected;
        chips.forEach((ch, j) => ch.setAttribute("aria-pressed", String(j === k)));
        resetMarks();
        table.dataset.mode = p.mode;
        codeLine.textContent = p.code;
        modeTag.textContent = p.mode === "loc" ? "labels" : "positions";
        modeTag.dataset.mode = p.mode;
        out.textContent = "";
        out.classList.remove("is-err");
        note.replaceChildren(...p.cap(c));

        // 1. the axis that is read
        const rowAxis = p.mode === "loc" ? labels : posLeft;
        const colAxis = p.mode === "loc" ? heads : posTop;
        if (p.error) {
          stagger(labels, "is-bad", 70);
          await HZ.wait(labels.length * 70 + 250);
          if (!alive()) return;
          out.textContent = p.out;
          out.classList.add("is-err");
          return;
        }
        if (p.mask) {
          gutterHead.textContent = "mask";
          const plus = ROWS.map((r) => r[0] === "Plus");
          posLeft.forEach((n, i) => {
            n.textContent = plus[i] ? "True" : "False";
          });
          stagger(cells.map((r) => r[0]), "is-axis", 60);
          stagger(posLeft.filter((_, i) => plus[i]), "is-true", 60);
          stagger(posLeft.filter((_, i) => !plus[i]), "is-false", 60);
          await HZ.wait(650);
          if (!alive()) return;
          cells.forEach((r) => { r[0].classList.remove("is-axis"); r[0].style.transitionDelay = "0ms"; });
        }
        stagger(p.rows.map((i) => rowAxis[i]), "is-axis", 70);
        stagger(p.cols.map((j) => colAxis[j]), "is-axis", 70);
        await HZ.wait(380);
        if (!alive()) return;

        // 2. the selected cells
        const sel = [];
        p.rows.forEach((i) => p.cols.forEach((j) => sel.push(cells[i][j])));
        stagger(sel, "is-on", 45);
        await HZ.wait(sel.length * 45 + 200);
        if (!alive()) return;

        // 3. where a slice stops
        if (p.rowStop !== undefined) {
          const cls = p.incl ? "is-stop-in" : "is-stop-out";
          rowAxis[p.rowStop].classList.add(cls);
          colAxis[p.colStop].classList.add(cls);
          if (!p.incl) {
            cells[p.rowStop].forEach((n) => n.classList.add("is-stop-out"));
            cells.forEach((r) => r[p.colStop].classList.add("is-stop-out"));
          }
          stopNote.classList.add("is-shown", p.incl ? "is-in" : "is-out");
          stopNote.lastChild.textContent = p.incl ? "stop label: included (loc)" : "stop position: excluded (iloc)";
          await HZ.wait(300);
          if (!alive()) return;
        }
        out.textContent = p.out;
        out.classList.remove("is-flash");
        void out.offsetWidth;
        out.classList.add("is-flash");
      }

      run(0);
    },
    css: `
.md-typeset .hz-loc-iloc-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.md-typeset .hz-loc-iloc-chip {
  font: inherit; font-family: var(--md-code-font); font-size: 0.64rem; padding: 0.28em 0.65em; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--hz-line); background: var(--md-default-bg-color); color: var(--md-default-fg-color); text-align: left;
  transition: border-color 150ms ease, background-color 150ms ease; max-width: 100%; overflow-wrap: anywhere;
}
.md-typeset .hz-loc-iloc-chip:hover { border-color: var(--hz-a); }
.md-typeset .hz-loc-iloc-chip[aria-pressed="true"] { border-color: var(--hz-a); background: var(--hz-a-soft); }
.md-typeset .hz-loc-iloc-chip:focus-visible { outline: 2px solid var(--md-primary-fg-color); outline-offset: 2px; }
.md-typeset .hz-loc-iloc-main { display: flex; flex-wrap: wrap; gap: 0.9rem 1.4rem; align-items: flex-start; }
.md-typeset .hz-loc-iloc-wrap { flex: 0 1 auto; max-width: 100%; overflow-x: auto; }
.md-typeset table.hz-loc-iloc-table { display: table; border-collapse: separate; border-spacing: 2px; margin: 0; font-family: var(--md-code-font); font-size: 0.68rem; border: 0; box-shadow: none; background: transparent; }
.md-typeset .hz-loc-iloc-table th, .md-typeset .hz-loc-iloc-table td {
  padding: 0.3em 0.55em; border: 0; border-radius: 5px; text-align: right; font-weight: 400; color: var(--md-default-fg-color); background: transparent; white-space: nowrap;
  font-variant-numeric: tabular-nums; transition: background-color 220ms ease, color 220ms ease, box-shadow 220ms ease, opacity 220ms ease;
}
.md-typeset .hz-loc-iloc-table .hz-loc-iloc-pos { color: var(--hz-muted); font-size: 0.86em; text-align: center; padding: 0.2em 0.4em; }
.md-typeset .hz-loc-iloc-table thead tr:first-child th { padding-bottom: 0; }
.md-typeset .hz-loc-iloc-table .hz-loc-iloc-name { font-weight: 700; }
.md-typeset .hz-loc-iloc-table .hz-loc-iloc-idxname { color: var(--hz-muted); text-align: left; font-size: 0.86em; }
.md-typeset .hz-loc-iloc-table .hz-loc-iloc-label { font-weight: 700; text-align: left; }
.md-typeset .hz-loc-iloc-table td:not(.hz-loc-iloc-pos) { background: color-mix(in srgb, var(--md-default-bg-color) 70%, transparent); }
/* axis being read: labels for loc (a), positions for iloc (b) */
.md-typeset .hz-loc-iloc-table[data-mode="loc"] .is-axis { background: var(--hz-a-soft); color: var(--hz-a); box-shadow: inset 0 0 0 1.5px var(--hz-a); }
.md-typeset .hz-loc-iloc-table[data-mode="iloc"] .is-axis { background: var(--hz-b-soft); color: var(--hz-b); font-weight: 700; box-shadow: inset 0 0 0 1.5px var(--hz-b); }
.md-typeset .hz-loc-iloc-table td.is-on { background: var(--hz-a-soft); box-shadow: inset 0 0 0 1.5px var(--hz-a); font-weight: 700; }
.md-typeset .hz-loc-iloc-table[data-mode="iloc"] td.is-on { background: var(--hz-b-soft); box-shadow: inset 0 0 0 1.5px var(--hz-b); }
.md-typeset .hz-loc-iloc-table .is-stop-in { box-shadow: inset 0 0 0 2px var(--hz-good) !important; color: var(--hz-good) !important; }
.md-typeset .hz-loc-iloc-table .is-stop-out { box-shadow: inset 0 0 0 1.5px var(--hz-bad); outline: 0; color: var(--hz-bad); }
.md-typeset .hz-loc-iloc-table td.is-stop-out:not(.hz-loc-iloc-pos) { opacity: 0.55; text-decoration: line-through; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hz-bad) 45%, transparent); }
.md-typeset .hz-loc-iloc-stop { margin: 0.35rem 0 0; font-size: 0.64rem; display: flex; align-items: center; gap: 0.45em; opacity: 0; transition: opacity 250ms ease; min-height: 1.4em; }
.md-typeset .hz-loc-iloc-stop.is-shown { opacity: 1; }
.md-typeset .hz-loc-iloc-stop i { flex: none; width: 1.1em; height: 1.1em; border-radius: 4px; border: 2px solid var(--hz-good); }
.md-typeset .hz-loc-iloc-stop.is-out i { border-color: var(--hz-bad); border-style: dashed; }
.md-typeset .hz-loc-iloc-stop.is-in { color: var(--hz-good); }
.md-typeset .hz-loc-iloc-stop.is-out { color: var(--hz-bad); }
.md-typeset .hz-loc-iloc-table .is-bad { color: var(--hz-bad); box-shadow: inset 0 0 0 1px var(--hz-bad); }
.md-typeset .hz-loc-iloc-table .is-true { color: var(--hz-good); font-weight: 700; background: color-mix(in srgb, var(--hz-good) 14%, transparent); }
.md-typeset .hz-loc-iloc-table .is-false { color: var(--hz-muted); }
.md-typeset .hz-loc-iloc-side { flex: 1 1 15rem; display: flex; flex-direction: column; gap: 0.4rem; min-width: 0; }
.md-typeset .hz-loc-iloc-prompt { font-family: var(--md-code-font); font-size: 0.68rem; color: var(--hz-muted); overflow-wrap: anywhere; }
.md-typeset .hz-loc-iloc-code { font-size: 1em; background: none; padding: 0; color: var(--md-default-fg-color); font-weight: 700; }
.md-typeset .hz-loc-iloc-mode { display: inline-block; margin-right: 0.5em; padding: 0.05em 0.5em; border-radius: 999px; font-size: 0.9em; }
.md-typeset .hz-loc-iloc-mode[data-mode="loc"] { background: var(--hz-a-soft); color: var(--hz-a); }
.md-typeset .hz-loc-iloc-mode[data-mode="iloc"] { background: var(--hz-b-soft); color: var(--hz-b); }
.md-typeset .hz-loc-iloc-out {
  margin: 0; padding: 0.55em 0.8em; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.64rem; line-height: 1.5;
  background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color); white-space: pre; overflow-x: auto; min-height: 8.6em;
}
.md-typeset .hz-loc-iloc-out.is-err { color: var(--hz-bad); font-weight: 700; }
.md-typeset .hz-loc-iloc-out.is-flash { animation: hz-loc-iloc-in 320ms ease-out; }
@keyframes hz-loc-iloc-in { from { opacity: 0.2; transform: translateY(3px); } to { opacity: 1; transform: none; } }
.md-typeset .hz-loc-iloc .hz-x__note { min-height: 3.8em; }
@media (max-width: 30em) {
  .md-typeset .hz-loc-iloc-table th, .md-typeset .hz-loc-iloc-table td { padding: 0.26em 0.24em; }
  .md-typeset .hz-loc-iloc-table .hz-loc-iloc-pos { padding: 0.2em 0.15em; }
  .md-typeset table.hz-loc-iloc-table { font-size: 0.54rem; border-spacing: 1px; width: 100%; }
  .md-typeset .hz-loc-iloc-table .hz-loc-iloc-name, .md-typeset .hz-loc-iloc-table .hz-loc-iloc-idxname { white-space: normal; vertical-align: bottom; }
  .md-typeset .hz-loc-iloc-wrap { flex-basis: 100%; }
}
`,
  });
})();
