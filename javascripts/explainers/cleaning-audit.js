/*
 * cleaning-audit: the session 2 cleaning pipeline on the raw Cordillera file.
 * Ten real rows show what each step does (cells fixed, rows dropped), while
 * the counters track the whole file (5,075 → 4,985 rows, 925 → 0 dirty
 * values) and the cleaning summary table fills in, one line per decision.
 */
(function () {
  const { el } = HZ;

  // Real rows from cordillera_mobile.csv. fix: {step: {field: value}}, drop: step that removes the row.
  const SAMPLE = [
    { id: "CM-12254", region: "Metropolitana", plan: "Basic", age: "34", gb: "NaN", pay: "NaN", bill: "25.46", fix: { 4: { gb: "7.1", pay: "Unknown" } } },
    { id: "CM-10542", region: "Norte", plan: "unlimited", age: "40", gb: "23.6", pay: "Credit card", bill: "47.77", fix: { 2: { plan: "Unlimited" } } },
    { id: "CM-10542", region: "Norte", plan: "unlimited", age: "40", gb: "23.6", pay: "Credit card", bill: "47.77", drop: 1, why: "exact copy of the row above" },
    { id: "CM-13346", region: "NORTE", plan: "plus", age: "40", gb: "20.5", pay: "Bank transfer", bill: "45.07", fix: { 2: { region: "Norte", plan: "Plus" } } },
    { id: "CM-14900", region: "Sur", plan: "Plus", age: "0", gb: "14.7", pay: "Debit card", bill: "43.81", fix: { 3: { age: "38" } } },
    { id: "CM-10941", region: "Sur ", plan: "Plus", age: "39", gb: "17.7", pay: "NaN", bill: "51.61", fix: { 2: { region: "Sur" }, 4: { pay: "Unknown" } } },
    { id: "CM-10737", region: "Norte", plan: "Basic", age: "39", gb: "7.3", pay: "Bank transfer", bill: "-36.08", drop: 5, why: "negative bill" },
    { id: "CM-12112", region: "Metropolitana", plan: "PLUS", age: "42", gb: "18.9", pay: "Debit card", bill: "4689.00", fix: { 2: { plan: "Plus" } }, drop: 5, why: "decimal point lost (46.89)" },
    { id: "CM-12183", region: "Centro", plan: "Prepaid", age: "-1", gb: "2.4", pay: "Debit card", bill: "9.77", fix: { 3: { age: "38" } } },
    { id: "CM-10173", region: "Centro", plan: "Plus", age: "31", gb: "19.0", pay: "Debit card", bill: "37.05" },
  ];
  const FIELDS = ["region", "plan", "age", "gb", "pay", "bill"];

  const STEPS = [
    {
      name: "Duplicates", code: "df = df.drop_duplicates()", rows: 5000, dirty: 843,
      summary: [["Exact duplicate rows", "Drop, keep the first copy", 75]],
      cap: ["75 rows are exact copies of another row. A customer counted twice weighs double in every average, so the copies go."],
    },
    {
      name: "Text", code: 'for col in ["region", "plan"]:\n    df[col] = df[col].str.strip().str.title()', rows: 5000, dirty: 380,
      summary: [["region written 11 ways", "Strip spaces, Title Case", 236], ["plan written 10 ways", "Strip spaces, Title Case", 227]],
      cap: ["“NORTE”, “norte” and “Norte” are one region to the business but three to pandas. ", ["strip()"], " removes stray spaces, ", ["title()"], " fixes capitals: 11 spellings of region become 4."],
    },
    {
      name: "Ages", code: 'df.loc[~df["age"].between(18, 100), "age"] = np.nan\ndf["age"] = df["age"].fillna(df["age"].median()).astype("int64")', rows: 5000, dirty: 365,
      summary: [["Impossible age (0, -1, 999)", "Set to NaN, fill with the median (38)", 15]],
      cap: ["Nobody is 0, −1 or 999 years old: typing errors. We cannot recover the true age, so it becomes missing and gets the median, which those extremes cannot pull."],
    },
    {
      name: "Missing", code: 'df["data_gb"] = df["data_gb"].fillna(\n    df.groupby("plan")["data_gb"].transform("median"))\ndf["payment_method"] = df["payment_method"].fillna("Unknown")', rows: 5000, dirty: 15,
      summary: [["Missing data_gb", "Median of the customer's plan", 200], ["Missing payment_method", "New category “Unknown”", 150]],
      cap: ["A Prepaid customer uses far less data than an Unlimited one, so a missing ", ["data_gb"], " gets the median of its own plan. A missing payment method gets an honest label instead of a guess."],
    },
    {
      name: "Bills", code: 'df = df[df["monthly_bill"].between(0, 300)]', rows: 4985, dirty: 0,
      summary: [["Impossible bill (< 0 or > 300 USD)", "Drop the row", 15]],
      cap: ["10 negative bills and 5 that lost their decimal point (4,689 instead of 46.89). The bill is the commercial team's target, so we drop these 15 rows rather than guess. Clean file: 4,985 rows."],
    },
  ];
  const START = { rows: 5075, dirty: 925 };

  const nf = (v) => Math.round(v).toLocaleString("en-US");
  const showVal = (f, v) => {
    if (f === "age") return "age " + v;
    if (f === "gb") return v + " GB";
    if (f === "pay") return v === "NaN" ? "NaN payment" : v;
    if (f === "bill") return "$" + v;
    return v.endsWith(" ") ? v.trimEnd() + "␣" : v;
  };
  // the step at which a field of a row stops being dirty
  function dirtStep(r, f) {
    for (const [s, fx] of Object.entries(r.fix || {})) if (f in fx) return +s;
    if (r.drop === 5 && f === "bill") return 5;
    return 0;
  }

  HZ.register("cleaning-audit", {
    kicker: "Session 2",
    title: "The cleaning pipeline",
    mount(body) {
      body.classList.add("hz-cleaning-audit");
      let stage = 0;
      let busy = false;
      let runId = 0;
      const shown = { ...START };
      const code = (s) => el("code", { text: s });
      const rich = (parts) => parts.map((p) => (Array.isArray(p) ? code(p[0]) : p));

      body.append(el("p", { class: "hz-x__lede" }, [
        "Ten real rows from the raw file, each with a different problem (dashed). The counters track the ", el("b", { text: "whole file" }),
        ". Each step fixes one kind of problem and writes one line of the cleaning summary.",
      ]));

      const pills = STEPS.map((s, k) => el("span", { class: "hz-cleaning-audit-pill" }, [el("b", { text: String(k + 1) }), s.name]));
      const playBtn = HZ.button("Play", () => play(), "primary");
      const stepBtn = HZ.button("Step", () => step());
      const resetBtn = HZ.button("Reset", () => reset());
      const controls = el("div", { class: "hz-x__controls" }, [
        el("div", { class: "hz-cleaning-audit-pills", "aria-label": "Pipeline steps" }, pills),
        el("div", { class: "hz-cleaning-audit-btns" }, [playBtn, stepBtn, resetBtn]),
      ]);

      const rowsNum = el("strong", { text: nf(START.rows) });
      const dirtyNum = el("strong", { text: nf(START.dirty) });
      const bar = el("i", { class: "hz-cleaning-audit-barfill" });
      const counters = el("div", { class: "hz-cleaning-audit-counters" }, [
        el("div", { class: "hz-cleaning-audit-counter" }, [el("span", { text: "rows in the file" }), rowsNum]),
        el("div", { class: "hz-cleaning-audit-counter is-dirty" }, [el("span", { text: "dirty values left" }), dirtyNum, el("span", { class: "hz-cleaning-audit-bar" }, [bar])]),
      ]);
      const codeLine = el("pre", { class: "hz-cleaning-audit-code" });

      const rowEls = [];
      const chipEls = [];
      const list = el("div", { class: "hz-cleaning-audit-list", "aria-label": "Sample rows" });
      SAMPLE.forEach((r, i) => {
        const chips = {};
        const tag = el("span", { class: "hz-cleaning-audit-tag" });
        FIELDS.forEach((f) => (chips[f] = el("span", { class: "hz-cleaning-audit-chip", "data-f": f })));
        const row = el("div", { class: "hz-cleaning-audit-row" }, [
          el("span", { class: "hz-cleaning-audit-id", text: r.id }),
          ...FIELDS.map((f) => chips[f]),
          tag,
        ]);
        rowEls.push(row);
        chipEls.push({ chips, tag });
        list.append(row);
      });

      const sumBody = el("tbody");
      const sumTable = el("table", { class: "hz-cleaning-audit-sum" }, [
        el("thead", {}, [el("tr", {}, [el("th", { text: "issue" }), el("th", { text: "decision" }), el("th", { text: "rows affected" })])]),
        sumBody,
      ]);
      const sumWrap = el("div", { class: "hz-cleaning-audit-sumwrap" }, [el("p", { class: "hz-cleaning-audit-sumtitle", text: "Cleaning summary (this table is part of Advance 2)" }), sumTable]);

      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      body.append(controls, el("div", { class: "hz-cleaning-audit-top" }, [codeLine, counters]), list, sumWrap, note);

      function valueAt(r, f, s) {
        let v = r[f];
        for (let k = 1; k <= s; k++) if (r.fix && r.fix[k] && f in r.fix[k]) v = r.fix[k][f];
        return v;
      }

      function paintRows(s) {
        SAMPLE.forEach((r, i) => {
          const { chips, tag } = chipEls[i];
          FIELDS.forEach((f) => {
            const ch = chips[f];
            ch.textContent = showVal(f, valueAt(r, f, s));
            const ds = dirtStep(r, f);
            ch.className = "hz-cleaning-audit-chip" + (ds > s ? " is-dirty" : "") + (ds && ds <= s && r.drop !== ds ? " is-fixed" : "");
          });
          const gone = r.drop && r.drop <= s;
          rowEls[i].className = "hz-cleaning-audit-row" + (gone ? " is-out" : "") + (r.drop === 1 && s < 1 ? " is-dupe" : "");
          tag.textContent = r.drop === 1 && s < 1 ? "duplicate" : "";
        });
      }

      function paintSummary(s) {
        sumBody.replaceChildren();
        STEPS.slice(0, s).forEach((st) => st.summary.forEach((line) => sumBody.append(sumRow(line))));
        if (!s) sumBody.append(el("tr", { class: "is-empty" }, [el("td", { colspan: 3, text: "Empty: run a step." })]));
      }
      const sumRow = ([a, b, n]) => el("tr", {}, [el("td", { text: a }), el("td", { text: b }), el("td", { text: nf(n) })]);

      function setCounters(v) {
        shown.rows = v.rows;
        shown.dirty = v.dirty;
        rowsNum.textContent = nf(v.rows);
        dirtyNum.textContent = nf(v.dirty);
        bar.style.width = (100 * v.dirty) / START.dirty + "%";
      }

      function syncUi() {
        pills.forEach((p, k) => {
          p.classList.toggle("is-on", stage === k + 1);
          p.classList.toggle("is-done", stage > k + 1);
        });
        playBtn.disabled = busy;
        stepBtn.disabled = busy || stage === STEPS.length;
        playBtn.textContent = stage === STEPS.length && !busy ? "Replay" : "Play";
        codeLine.textContent = stage ? STEPS[stage - 1].code : "df = raw.copy()   # 5,075 rows, straight from the CSV";
        note.replaceChildren(...(stage ? [el("b", { text: "Step " + stage + " · " + STEPS[stage - 1].name + ": " }), ...rich(STEPS[stage - 1].cap)] : ["The raw file: 925 dirty values hidden among 5,075 rows. Press Play, or Step through the pipeline in the order the notebook uses."]));
      }

      function renderStatic() {
        paintRows(stage);
        paintSummary(stage);
        setCounters(stage ? STEPS[stage - 1] : START);
        syncUi();
      }

      async function advance(id) {
        const alive = () => id === runId && body.isConnected;
        const s = stage + 1;
        const st = STEPS[s - 1];
        stage = s;
        syncUi();
        // 1. point at what this step touches
        const touched = [];
        const removed = [];
        SAMPLE.forEach((r, i) => {
          if (r.drop === s) removed.push(i);
          if (r.fix && r.fix[s]) Object.keys(r.fix[s]).forEach((f) => touched.push([i, f]));
        });
        touched.forEach(([i, f], k) => {
          const ch = chipEls[i].chips[f];
          ch.style.transitionDelay = (HZ.reducedMotion() ? 0 : k * 60) + "ms";
          ch.classList.add("is-active");
        });
        removed.forEach((i) => {
          rowEls[i].classList.add("is-removing");
          chipEls[i].tag.textContent = SAMPLE[i].why;
          if (s === 5) chipEls[i].chips.bill.classList.add("is-active");
        });
        await HZ.wait(650);
        if (!alive()) return false;
        // 2. fix the values, drop the rows
        touched.forEach(([i, f], k) => {
          const ch = chipEls[i].chips[f];
          ch.style.transitionDelay = "0ms";
          setTimeout(() => {
            if (!alive()) return;
            ch.textContent = showVal(f, SAMPLE[i].fix[s][f]);
            ch.classList.remove("is-dirty", "is-active");
            ch.classList.add("is-fixed", "is-pop");
          }, HZ.reducedMotion() ? 0 : k * 90);
        });
        await HZ.wait(touched.length ? 250 : 0);
        removed.forEach((i) => rowEls[i].classList.add("is-out"));
        // 3. counters roll for the whole file; the summary gets its line(s)
        const from = { ...shown };
        await HZ.tween(body, 650, (t) => alive() && setCounters({ rows: HZ.lerp(from.rows, st.rows, t), dirty: HZ.lerp(from.dirty, st.dirty, t) }));
        if (!alive()) return false;
        setCounters(st);
        if (sumBody.querySelector(".is-empty")) sumBody.replaceChildren();
        st.summary.forEach((line, k) => {
          const tr = sumRow(line);
          tr.classList.add("is-new");
          tr.style.animationDelay = (HZ.reducedMotion() ? 0 : k * 120) + "ms";
          sumBody.append(tr);
        });
        await HZ.wait(350);
        return alive();
      }

      async function step() {
        if (busy || stage >= STEPS.length) return;
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
        if (stage === STEPS.length) {
          stage = 0;
          renderStatic();
          await HZ.wait(400);
          if (id !== runId) return;
        }
        busy = true;
        syncUi();
        while (stage < STEPS.length) {
          if (!(await advance(id))) return;
          if (stage < STEPS.length) await HZ.wait(1500);
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

      reset();
    },
    css: `
.md-typeset .hz-cleaning-audit-pills { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.md-typeset .hz-cleaning-audit-pill {
  display: inline-flex; align-items: center; gap: 0.4em; font-size: 0.66rem; padding: 0.2em 0.75em 0.2em 0.3em;
  border-radius: 999px; border: 1px solid var(--hz-line); color: var(--hz-muted); transition: all 200ms ease;
}
.md-typeset .hz-cleaning-audit-pill b {
  display: inline-grid; place-items: center; width: 1.5em; height: 1.5em; border-radius: 50%;
  font-family: var(--md-code-font); font-size: 0.9em; background: var(--hz-line); color: var(--md-default-fg-color); transition: all 200ms ease;
}
.md-typeset .hz-cleaning-audit-pill.is-on { border-color: var(--hz-a); color: var(--md-default-fg-color); background: var(--hz-a-soft); }
.md-typeset .hz-cleaning-audit-pill.is-on b { background: var(--hz-a); color: var(--hz-card); }
.md-typeset .hz-cleaning-audit-pill.is-done { color: var(--md-default-fg-color--light); }
.md-typeset .hz-cleaning-audit-pill.is-done b { background: var(--hz-good); color: var(--hz-card); }
.md-typeset .hz-cleaning-audit-btns { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.md-typeset .hz-cleaning-audit-top { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: stretch; }
.md-typeset .hz-cleaning-audit-top > pre { flex: 1 1 20rem; min-width: 0; }
.md-typeset .hz-cleaning-audit-top > .hz-cleaning-audit-counters { flex: 1 1 14rem; }
.md-typeset .hz-cleaning-audit-code {
  margin: 0; padding: 0.5em 0.8em; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.62rem; line-height: 1.5; min-height: 4.2em;
  background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color); white-space: pre-wrap; overflow-wrap: anywhere;
}
.md-typeset .hz-cleaning-audit-list { display: flex; flex-direction: column; }
.md-typeset .hz-cleaning-audit-row {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.3rem; padding: 0.3rem 0.35rem; border-top: 1px solid var(--hz-line);
  max-height: 6em; overflow: hidden; border-radius: 6px;
  transition: max-height 520ms cubic-bezier(.65,0,.35,1), opacity 400ms ease, padding 520ms cubic-bezier(.65,0,.35,1), background-color 250ms ease;
}
.md-typeset .hz-cleaning-audit-row.is-dupe, .md-typeset .hz-cleaning-audit-row.is-removing { background: color-mix(in srgb, var(--hz-bad) 10%, transparent); }
.md-typeset .hz-cleaning-audit-row.is-removing .hz-cleaning-audit-chip, .md-typeset .hz-cleaning-audit-row.is-removing .hz-cleaning-audit-id { text-decoration: line-through; text-decoration-color: var(--hz-bad); }
.md-typeset .hz-cleaning-audit-row.is-out { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; border-top-color: transparent; }
.md-typeset .hz-cleaning-audit-id { font-family: var(--md-code-font); font-size: 0.62rem; color: var(--hz-muted); min-width: 5.6em; }
.md-typeset .hz-cleaning-audit-chip {
  font-family: var(--md-code-font); font-size: 0.6rem; padding: 0.12em 0.45em; border-radius: 5px; border: 1px solid var(--hz-line); white-space: nowrap;
  background: var(--md-default-bg-color); color: var(--md-default-fg-color);
  transition: border-color 220ms ease, background-color 220ms ease, color 220ms ease, box-shadow 220ms ease;
}
.md-typeset .hz-cleaning-audit-chip.is-dirty { border: 1.5px dashed var(--hz-bad); color: var(--hz-bad); }
.md-typeset .hz-cleaning-audit-chip.is-active { box-shadow: 0 0 0 3px color-mix(in srgb, var(--hz-bad) 30%, transparent); background: color-mix(in srgb, var(--hz-bad) 12%, transparent); }
.md-typeset .hz-cleaning-audit-chip.is-fixed { border-color: var(--hz-good); color: var(--hz-good); background: color-mix(in srgb, var(--hz-good) 10%, transparent); }
.md-typeset .hz-cleaning-audit-chip.is-pop { animation: hz-cleaning-audit-pop 320ms ease-out; }
@keyframes hz-cleaning-audit-pop { 0% { transform: scale(0.85); opacity: 0.3; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
.md-typeset .hz-cleaning-audit-tag { font-size: 0.6rem; color: var(--hz-bad); font-style: italic; }
.md-typeset .hz-cleaning-audit-counters { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.md-typeset .hz-cleaning-audit-counter { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.5rem 0.7rem; border-radius: 10px; border: 1px solid var(--hz-line); background: var(--md-default-bg-color); }
.md-typeset .hz-cleaning-audit-counter span:first-child { font-size: 0.6rem; color: var(--hz-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.md-typeset .hz-cleaning-audit-counter strong { font-family: var(--md-code-font); font-size: 1.15rem; font-variant-numeric: tabular-nums; color: var(--md-default-fg-color); }
.md-typeset .hz-cleaning-audit-counter.is-dirty strong { color: var(--hz-bad); }
.md-typeset .hz-cleaning-audit-bar { display: block; height: 4px; border-radius: 2px; background: var(--hz-line); overflow: hidden; margin-top: 0.2rem; }
.md-typeset .hz-cleaning-audit-barfill { display: block; height: 100%; width: 100%; background: var(--hz-bad); }
.md-typeset .hz-cleaning-audit-sumtitle { font-size: 0.62rem; color: var(--hz-muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 0.3rem !important; }
.md-typeset table.hz-cleaning-audit-sum { display: table; width: 100%; border-collapse: collapse; margin: 0; font-size: 0.62rem; border: 0; box-shadow: none; background: transparent; }
.md-typeset .hz-cleaning-audit-sum th, .md-typeset .hz-cleaning-audit-sum td { padding: 0.3em 0.4em; border: 0; border-bottom: 1px solid var(--hz-line); text-align: left; vertical-align: top; background: transparent; }
.md-typeset .hz-cleaning-audit-sum th { font-weight: 700; color: var(--md-default-fg-color--light); }
.md-typeset .hz-cleaning-audit-sum td:last-child, .md-typeset .hz-cleaning-audit-sum th:last-child { text-align: right; font-family: var(--md-code-font); white-space: nowrap; }
.md-typeset .hz-cleaning-audit-sum tr.is-empty td { color: var(--hz-muted); font-style: italic; text-align: left; font-family: inherit; }
.md-typeset .hz-cleaning-audit-sum tr.is-new { animation: hz-cleaning-audit-row 420ms ease-out both; }
@keyframes hz-cleaning-audit-row { from { opacity: 0; transform: translateY(-4px); background: var(--hz-a-soft); } to { opacity: 1; transform: none; } }
.md-typeset .hz-cleaning-audit .hz-x__note { min-height: 3.8em; }
`,
  });
})();
