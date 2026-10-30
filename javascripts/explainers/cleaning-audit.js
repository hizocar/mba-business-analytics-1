/*
 * cleaning-audit: Altamar's cleaning pipeline (clean() in the generator) on
 * the raw bookings file. Eleven real rows show what each step does (cells
 * fixed, rows dropped), while the counters track the whole file
 * (6,060 -> 5,964 bookings, 720 -> 0 problems) and the cleaning log fills
 * in, one line per decision.
 */
(function () {
  const { el } = HZ;

  // Real rows from altamar_bookings.csv. fix: {step: {field: value}}; drop: the step
  // that removes the row; bad: the field that makes it impossible.
  const SAMPLE = [
    { id: "AH-200037", hotel: "Santiago", channel: "Online travel agency", lead: "75", adults: "2", children: "1", country: "Argentina", adr: "96.22" },
    { id: "AH-200037", hotel: "Santiago", channel: "Online travel agency", lead: "75", adults: "2", children: "1", country: "Argentina", adr: "96.22", drop: 1, why: "exact copy of the row above" },
    { id: "AH-204139", hotel: "VIÑA DEL MAR", channel: "Online travel agency", lead: "28", adults: "2", children: "0", country: "Chile", adr: "114.51", fix: { 2: { hotel: "Viña del Mar" } } },
    { id: "AH-205825", hotel: "Viña del Mar", channel: "OTA", lead: "35", adults: "2", children: "0", country: "Chile", adr: "64.72", fix: { 2: { channel: "Online travel agency" } } },
    { id: "AH-205221", hotel: "Santiago", channel: "Online travel agency", lead: "27", adults: "2", children: "1", country: "Chile", adr: "0.00", drop: 3, bad: "adr", why: "complimentary room: not a price" },
    { id: "AH-203052", hotel: "Viña del Mar", channel: "Corporate", lead: "3", adults: "1", children: "0", country: "Chile", adr: "1,335.70", drop: 3, bad: "adr", why: "an extra zero (133.57)" },
    { id: "AH-202870", hotel: "Santiago", channel: "Travel agent", lead: "-75", adults: "2", children: "0", country: "Chile", adr: "147.59", drop: 4, bad: "lead", why: "booked after arrival? dates swapped" },
    { id: "AH-204369", hotel: "Pto. Varas", channel: "Travel agent", lead: "83", adults: "0", children: "0", country: "Chile", adr: "102.17", fix: { 2: { hotel: "Puerto Varas" } }, drop: 4, bad: "adults", why: "a room with no adults" },
    { id: "AH-200104", hotel: "Viña del Mar", channel: "Online travel agency", lead: "11", adults: "2", children: "NaN", country: "Brazil", adr: "92.35", fix: { 5: { children: "0" } } },
    { id: "AH-200450", hotel: "Puerto Varas", channel: "Direct", lead: "41", adults: "2", children: "2", country: "NaN", adr: "113.35", fix: { 5: { country: "Unknown" } } },
    { id: "AH-204908", hotel: "Santiago", channel: "Online travel agency", lead: "5", adults: "1", children: "0", country: "Chile", adr: "115.22" },
  ];
  const FIELDS = ["hotel", "channel", "lead", "adults", "children", "country", "adr"];

  const STEPS = [
    {
      name: "Duplicates", code: "df = raw.drop_duplicates().copy()", rows: 6000, dirty: 660,
      summary: [["Exact duplicate rows", "Drop the copy, keep the first", 60]],
      cap: ["60 bookings were loaded twice. A booking counted twice weighs double in every average rate and every cancellation rate, so the copies go."],
    },
    {
      name: "Labels", code: 'df["hotel"] = df["hotel"].replace(HOTEL_FIX)\ndf["channel"] = (df["channel"].str.lower()\n    .replace({"ota": "online travel agency"}).str.capitalize())', rows: 6000, dirty: 276,
      summary: [["Hotel written 4 other ways", "Map to the 3 official names", 250], ["Channel written 3 other ways", "Lower case, OTA to the full name", 134]],
      cap: ["“SANTIAGO” and “Santiago” are one hotel to a manager but two to pandas: a summary by hotel would list seven hotels. After this step there are 3 hotels and 4 channels. No booking is lost."],
    },
    {
      name: "Impossible rates", code: 'df = df[(df["adr"] > 0) & (df["adr"] < 1000)]', rows: 5982, dirty: 258,
      summary: [["Rate of 0 (complimentary room)", "Drop the row: not a price", 12], ["Rate of 1,000 USD or more (extra zero)", "Drop the row", 6]],
      cap: ["A free room is not a price: twelve zeros would pull every average rate down. Six rates carry an extra zero (1,335.70 for a 133.57 room). We are studying prices, so all 18 go rather than a guess."],
    },
    {
      name: "Lead times, adults", code: 'df = df[df["lead_time_days"] >= 0]\ndf = df[df["adults"] > 0]', rows: 5964, dirty: 240,
      summary: [["Negative lead time (dates swapped)", "Drop the row", 10], ["Booking with 0 adults", "Drop the row", 8]],
      cap: ["Nobody books after arriving, and every room needs at least one adult. 18 impossible bookings, 0.3% of the file: dropping them moves no summary, and the log says we did it."],
    },
    {
      name: "Missing", code: 'df["children"] = df["children"].fillna(0).astype("int64")\ndf["country"] = df["country"].fillna("Unknown")', rows: 5964, dirty: 0,
      summary: [["Missing children", "Fill with 0, the usual value", 60], ["Missing country", "New category “Unknown”", 180]],
      cap: ["Three in four bookings have no children, so a blank most likely means none. A missing country gets an honest label instead of a guess. The clean file: 5,964 bookings, nothing missing."],
    },
  ];
  const START = { rows: 6060, dirty: 720 };

  const nf = (v) => Math.round(v).toLocaleString("en-US");
  const showVal = (f, v) => {
    if (f === "lead") return "lead " + v + " d";
    if (f === "adults") return v + (v === "1" ? " adult" : " adults");
    if (f === "children") return "children " + v;
    if (f === "country") return v === "NaN" ? "country NaN" : v;
    if (f === "adr") return "USD " + v;
    return v;
  };
  // the step at which a field of a row stops being dirty
  function dirtStep(r, f) {
    for (const [s, fx] of Object.entries(r.fix || {})) if (f in fx) return +s;
    if (r.drop && r.bad === f) return r.drop;
    return 0;
  }

  HZ.register("cleaning-audit", {
    kicker: "Week 2",
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
        "Eleven real bookings from the raw file, most with a different problem (dashed). The counters track the ", el("b", { text: "whole file" }),
        ". Each step fixes one kind of problem and writes its lines in the cleaning log.",
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
        el("div", { class: "hz-cleaning-audit-counter" }, [el("span", { text: "bookings in the file" }), rowsNum]),
        el("div", { class: "hz-cleaning-audit-counter is-dirty" }, [el("span", { text: "problems left" }), dirtyNum, el("span", { class: "hz-cleaning-audit-bar" }, [bar])]),
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
        el("thead", {}, [el("tr", {}, [el("th", { text: "problem" }), el("th", { text: "decision" }), el("th", { text: "rows affected" })])]),
        sumBody,
      ]);
      const sumWrap = el("div", { class: "hz-cleaning-audit-sumwrap" }, [el("p", { class: "hz-cleaning-audit-sumtitle", text: "Cleaning log (your case needs one too)" }), sumTable]);

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
        codeLine.textContent = stage ? STEPS[stage - 1].code : "raw = pd.read_csv(DATA + \"altamar_bookings.csv\")   # 6,060 bookings";
        note.replaceChildren(...(stage ? [el("b", { text: "Step " + stage + " · " + STEPS[stage - 1].name + ": " }), ...rich(STEPS[stage - 1].cap)] : ["The raw file: 720 problems hidden among 6,060 bookings. Press Play, or Step through the pipeline in the order the notebook uses."]));
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
          if (SAMPLE[i].bad) chipEls[i].chips[SAMPLE[i].bad].classList.add("is-active");
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
  max-height: 9em; overflow: hidden; border-radius: 6px;
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
