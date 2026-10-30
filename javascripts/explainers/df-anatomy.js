/*
 * df-anatomy: the parts of a pandas DataFrame on five Cordillera customers.
 * Hover or click a part (index, a column, a row, the values, the dtypes, the
 * shape) and it lights up in the table, with the pandas code that returns it
 * and what pandas prints.
 */
(function () {
  const { el } = HZ;

  const COLS = ["plan", "age", "monthly_bill", "churned"];
  const DTYPES = ["object", "int64", "float64", "int64"];
  const ROWS = [
    ["Basic", "34", "25.46", "0"],
    ["Plus", "31", "37.05", "1"],
    ["Prepaid", "38", "11.43", "0"],
    ["Unlimited", "31", "40.97", "0"],
    ["Basic", "34", "19.18", "1"],
  ];

  // pandas prints a Series as: labels padded to the longest, values right-aligned in (longest + 4)
  function seriesRepr(labels, values, name, dtype) {
    const lw = Math.max(...labels.map((s) => s.length));
    const vw = Math.max(...values.map((s) => s.length)) + 4;
    const lines = labels.map((l, i) => l.padEnd(lw) + values[i].padStart(vw));
    return lines.join("\n") + "\nName: " + name + ", dtype: " + dtype;
  }
  // NumPy prints an object array without padding
  const npValues = () => {
    return "[" + ROWS.map((r, i) => (i ? " " : "") + "[" + r.map((v, c) => (c === 0 ? "'" + v + "'" : v)).join(" ") + "]").join("\n") + "]";
  };

  function part(kind, arg) {
    const c = (s) => el("code", { text: s });
    if (kind === "index")
      return {
        code: "df.index",
        out: "RangeIndex(start=0, stop=5, step=1)",
        cap: [el("b", { text: "Index: " }), "the labels of the rows. ", c("read_csv"), " numbers them 0, 1, 2… unless you choose a column, like ", c("customer_id"), ". It labels rows; it is not data."],
      };
    if (kind === "column") {
      const j = arg;
      return {
        code: 'df["' + COLS[j] + '"]',
        out: seriesRepr(ROWS.map((_, i) => String(i)), ROWS.map((r) => r[j]), COLS[j], DTYPES[j]),
        cap: [el("b", { text: "A column is a Series: " }), "one variable for every customer, with the index still attached. One column has one dtype, here ", c(DTYPES[j]), ". Click another header."],
      };
    }
    if (kind === "row") {
      const i = arg;
      return {
        code: "df.loc[" + i + "]",
        out: seriesRepr(COLS, ROWS[i], String(i), "object"),
        cap: [el("b", { text: "A row is one customer: " }), "pandas hands it back as a Series too, labelled by the column names. It mixes text and numbers, so its dtype is ", c("object"), ". Click another row label."],
      };
    }
    if (kind === "values")
      return {
        code: "df.to_numpy()",
        out: npValues(),
        cap: [el("b", { text: "Values: " }), "the data itself, a grid like the NumPy arrays of session 1. Index and column names are the labels around it."],
      };
    if (kind === "dtypes")
      return {
        code: "df.dtypes",
        out: seriesRepr(COLS, DTYPES, "", "object").replace(/\nName: , dtype: object$/, "\ndtype: object"),
        cap: [el("b", { text: "dtypes: " }), c("object"), " is text, ", c("int64"), " whole numbers, ", c("float64"), " decimals. A bill stored as ", c("object"), " would be a red flag: something non-numeric is hiding in it."],
      };
    return {
      code: "df.shape",
      out: "(5, 4)",
      cap: [el("b", { text: "Shape: " }), "(rows, columns). The index is not counted as a column. The full customer file is ", c("(5075, 15)"), "."],
    };
  }

  const PARTS = [
    { kind: "index", label: "index" },
    { kind: "column", label: "column = Series" },
    { kind: "row", label: "row" },
    { kind: "values", label: "values" },
    { kind: "dtypes", label: "dtypes" },
    { kind: "shape", label: "shape" },
  ];

  HZ.register("df-anatomy", {
    kicker: "Session 2",
    title: "Anatomy of a DataFrame",
    mount(body) {
      body.classList.add("hz-df-anatomy");
      let locked = { kind: "column", arg: 2 };
      let lastCol = 2, lastRow = 2;

      body.append(el("p", { class: "hz-x__lede" }, [
        "Five Cordillera customers in a DataFrame called ", el("code", { text: "df" }),
        ". Hover or tap a part to see where it lives and what pandas gives you back. Column headers and row labels are clickable too.",
      ]));

      const chips = PARTS.map((p) =>
        el("button", { type: "button", class: "hz-df-anatomy-chip", "data-kind": p.kind, onclick: () => lock(p.kind), onmouseenter: () => preview(p.kind), onmouseleave: () => preview(null), onfocus: () => preview(p.kind), onblur: () => preview(null) }, p.label)
      );
      const chipRow = el("div", { class: "hz-df-anatomy-chips", role: "group", "aria-label": "Parts of a DataFrame" }, chips);

      // Table
      const headCells = COLS.map((name, j) =>
        el("th", { scope: "col", "data-c": j }, [el("button", { type: "button", class: "hz-df-anatomy-hbtn", html: name.replace("_", "_<wbr>"), "aria-label": "Select column " + name, onclick: () => lock("column", j) })])
      );
      const corner = el("th", { class: "hz-df-anatomy-corner", "aria-hidden": "true" });
      const idxCells = ROWS.map((_, i) =>
        el("th", { scope: "row", class: "hz-df-anatomy-idx", "data-r": i }, [el("button", { type: "button", class: "hz-df-anatomy-hbtn", text: String(i), "aria-label": "Select row " + i, onclick: () => lock("row", i) })])
      );
      const cells = ROWS.map((r, i) => r.map((v, j) => el("td", { "data-r": i, "data-c": j, class: j === 0 ? "is-text" : null, text: v })));
      const dtypeCells = DTYPES.map((d, j) => el("td", { "data-c": j, text: d }));
      const dtypeLabel = el("th", { scope: "row", class: "hz-df-anatomy-dlabel" }, [el("button", { type: "button", class: "hz-df-anatomy-hbtn", text: "dtype", "aria-label": "Select dtypes", onclick: () => lock("dtypes") })]);
      const table = el("table", { class: "hz-df-anatomy-table" }, [
        el("thead", {}, [el("tr", {}, [corner, ...headCells])]),
        el("tbody", {}, ROWS.map((_, i) => el("tr", {}, [idxCells[i], ...cells[i]]))),
        el("tfoot", {}, [el("tr", {}, [dtypeLabel, ...dtypeCells])]),
      ]);
      const frame = el("div", { class: "hz-df-anatomy-frame" }, [table, el("span", { class: "hz-df-anatomy-shape", "aria-hidden": "true", text: "5 rows × 4 columns" })]);
      const wrap = el("div", { class: "hz-df-anatomy-wrap" }, [frame]);

      const codeLine = el("code", { class: "hz-df-anatomy-code" });
      const out = el("pre", { class: "hz-df-anatomy-out", "aria-live": "polite" });
      const side = el("div", { class: "hz-df-anatomy-side" }, [el("div", { class: "hz-df-anatomy-prompt" }, [el("span", { text: ">>> " }), codeLine]), out]);
      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      body.append(chipRow, el("div", { class: "hz-df-anatomy-main" }, [wrap, side]), note);

      const all = () => [...cells.flat(), ...idxCells, ...headCells, ...dtypeCells, dtypeLabel];

      // Which cells a part lights up, in the order they should appear
      function targets(kind, arg) {
        if (kind === "index") return idxCells;
        if (kind === "column") return [headCells[arg], ...cells.map((r) => r[arg])];
        if (kind === "row") return [idxCells[arg], ...cells[arg]];
        if (kind === "values") return cells.flat();
        if (kind === "dtypes") return [dtypeLabel, ...dtypeCells];
        return [];
      }

      function highlight(kind, arg) {
        all().forEach((n) => {
          n.classList.remove("is-on");
          n.style.transitionDelay = "0ms";
        });
        frame.classList.toggle("is-shape", kind === "shape");
        table.dataset.kind = kind || "";
        const ts = targets(kind, arg);
        const step = kind === "values" ? 18 : 45;
        ts.forEach((n, k) => {
          n.style.transitionDelay = (HZ.reducedMotion() ? 0 : k * step) + "ms";
          n.classList.add("is-on");
        });
        chips.forEach((c) => c.classList.toggle("is-on", c.dataset.kind === kind));
      }

      function preview(kind) {
        if (!kind) return highlight(locked.kind, locked.arg);
        const arg = kind === "column" ? lastCol : kind === "row" ? lastRow : null;
        highlight(kind, arg);
      }

      function lock(kind, arg) {
        if (kind === "column") arg = arg === undefined ? lastCol : (lastCol = arg);
        if (kind === "row") arg = arg === undefined ? lastRow : (lastRow = arg);
        locked = { kind, arg };
        chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.kind === kind)));
        const p = part(kind, arg);
        codeLine.textContent = p.code;
        out.textContent = p.out;
        out.classList.remove("is-flash");
        void out.offsetWidth;
        out.classList.add("is-flash");
        note.replaceChildren(...p.cap);
        highlight(kind, arg);
      }

      lock("column", 2);
    },
    css: `
.md-typeset .hz-df-anatomy-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.md-typeset .hz-df-anatomy-chip {
  font: inherit; font-family: var(--md-code-font); font-size: 0.66rem; padding: 0.3em 0.75em; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--hz-line); background: var(--md-default-bg-color); color: var(--md-default-fg-color);
  transition: border-color 150ms ease, background-color 150ms ease, color 150ms ease;
}
.md-typeset .hz-df-anatomy-chip:hover, .md-typeset .hz-df-anatomy-chip.is-on { border-color: var(--hz-a); background: var(--hz-a-soft); }
.md-typeset .hz-df-anatomy-chip[aria-pressed="true"] { background: var(--hz-a); border-color: var(--hz-a); color: var(--hz-card); }
.md-typeset .hz-df-anatomy-chip:focus-visible, .md-typeset .hz-df-anatomy-hbtn:focus-visible { outline: 2px solid var(--md-primary-fg-color); outline-offset: 2px; }
.md-typeset .hz-df-anatomy-main { display: flex; flex-wrap: wrap; gap: 0.9rem 1.4rem; align-items: flex-start; }
.md-typeset .hz-df-anatomy-wrap { flex: 0 1 auto; max-width: 100%; overflow-x: auto; padding: 0.2rem 0.1rem 1.2rem; }
.md-typeset .hz-df-anatomy-frame { position: relative; display: inline-block; padding: 0.35rem; border-radius: 10px; border: 1.5px dashed transparent; transition: border-color 250ms ease, background-color 250ms ease; }
.md-typeset .hz-df-anatomy-frame.is-shape { border-color: var(--hz-a); background: var(--hz-a-soft); }
.md-typeset .hz-df-anatomy-shape { position: absolute; right: 0.4rem; bottom: -1.15rem; font-family: var(--md-code-font); font-size: 0.6rem; color: var(--hz-a); opacity: 0; transition: opacity 250ms ease; }
.md-typeset .hz-df-anatomy-frame.is-shape .hz-df-anatomy-shape { opacity: 1; }
.md-typeset table.hz-df-anatomy-table { display: table; border-collapse: separate; border-spacing: 0; margin: 0; font-family: var(--md-code-font); font-size: 0.7rem; border: 0; box-shadow: none; background: transparent; }
.md-typeset .hz-df-anatomy-table th, .md-typeset .hz-df-anatomy-table td {
  padding: 0.32em 0.65em; border: 0; text-align: right; font-weight: 400; color: var(--md-default-fg-color); background: transparent;
  transition: background-color 240ms ease, color 240ms ease, box-shadow 240ms ease; font-variant-numeric: tabular-nums; white-space: nowrap;
}
.md-typeset .hz-df-anatomy-table thead th { font-weight: 700; border-bottom: 1px solid var(--hz-line); }
.md-typeset .hz-df-anatomy-table tbody th { color: var(--hz-muted); font-weight: 700; border-right: 1px solid var(--hz-line); }
.md-typeset .hz-df-anatomy-table tfoot td, .md-typeset .hz-df-anatomy-table tfoot th { color: var(--hz-muted); font-style: italic; font-size: 0.92em; border-top: 1px dashed var(--hz-line); }
.md-typeset .hz-df-anatomy-hbtn { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline dotted var(--hz-line); text-underline-offset: 3px; }
.md-typeset .hz-df-anatomy-hbtn:hover { color: var(--hz-a); }
.md-typeset .hz-df-anatomy-table .is-on { background: var(--hz-a-soft); color: var(--md-default-fg-color); box-shadow: inset 0 0 0 1px var(--hz-a); }
.md-typeset .hz-df-anatomy-table[data-kind="index"] .is-on, .md-typeset .hz-df-anatomy-table[data-kind="row"] th.is-on { color: var(--hz-a); }
.md-typeset .hz-df-anatomy-table[data-kind="dtypes"] .is-on { color: var(--hz-a); font-style: normal; }
.md-typeset .hz-df-anatomy-side { flex: 1 1 15rem; display: flex; flex-direction: column; gap: 0.4rem; min-width: 0; }
.md-typeset .hz-df-anatomy-prompt { font-family: var(--md-code-font); font-size: 0.7rem; color: var(--hz-muted); }
.md-typeset .hz-df-anatomy-code { font-size: 1em; background: none; padding: 0; color: var(--hz-a); font-weight: 700; }
.md-typeset .hz-df-anatomy-out {
  margin: 0; padding: 0.55em 0.8em; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.66rem; line-height: 1.5;
  background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color); white-space: pre; overflow-x: auto; min-height: 9.5em;
}
.md-typeset .hz-df-anatomy-out.is-flash { animation: hz-df-anatomy-in 320ms ease-out; }
@keyframes hz-df-anatomy-in { from { opacity: 0.2; transform: translateY(3px); } to { opacity: 1; transform: none; } }
.md-typeset .hz-df-anatomy .hz-x__note { min-height: 3.8em; }
@media (max-width: 30em) {
  .md-typeset .hz-df-anatomy-table th, .md-typeset .hz-df-anatomy-table td { padding: 0.28em 0.36em; }
  .md-typeset table.hz-df-anatomy-table { font-size: 0.58rem; }
  .md-typeset .hz-df-anatomy-frame { padding: 0.2rem; display: block; }
  .md-typeset table.hz-df-anatomy-table { width: 100%; }
  .md-typeset .hz-df-anatomy-wrap { flex-basis: 100%; }
  .md-typeset .hz-df-anatomy-table thead th { white-space: normal; vertical-align: bottom; }
}
`,
  });
})();
