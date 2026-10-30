/*
 * dict-lookup: a Python dict as key cards and value cards (Session 1).
 * The student types customer["plan"], customer.get(...), an assignment...
 * The key is hashed, a pointer jumps straight to its card (no scanning),
 * the link to the value lights up and the value pops. A missing key shows
 * KeyError, while .get() hands back a dashed default card instead.
 */
(function () {
  const { el } = HZ;

  const S = (v) => ({ t: "str", v });
  const ORIGINAL = [
    ["customer_id", S("CM-10482")],
    ["plan", S("Plus")],
    ["contract", S("Month-to-month")],
    ["monthly_bill", { t: "float", v: 31.9 }],
    ["tenure_months", { t: "int", v: 14 }],
    ["support_tickets", { t: "int", v: 2 }],
    ["autopay", { t: "bool", v: true }],
  ];
  const PRESETS = [
    'customer["plan"]',
    'customer["monthly_bill"]',
    'customer["region"]',
    'customer.get("region", "Unknown")',
    'customer.get("plan", "Unknown")',
    'customer["support_tickets"] = 3',
    'customer["region"] = "Norte"',
    "customer.keys()",
    "len(customer)",
  ];

  // ---------- Python-ish values
  function repr(x) {
    if (!x) return "None";
    if (x.t === "str") {
      const s = x.v.replace(/\\/g, "\\\\");
      return s.includes("'") && !s.includes('"') ? '"' + s + '"' : "'" + s.replace(/'/g, "\\'") + "'";
    }
    if (x.t === "float") return Number.isInteger(x.v) ? x.v.toFixed(1) : String(x.v);
    if (x.t === "bool") return x.v ? "True" : "False";
    if (x.t === "none") return "None";
    return String(x.v);
  }
  const same = (a, b) => {
    const num = (x) => x.t === "int" || x.t === "float" || x.t === "bool";
    if (num(a) && num(b)) return Number(a.v) === Number(b.v);
    return a.t === b.t && a.v === b.v;
  };

  function literal(src) {
    const s = src.trim();
    let m = s.match(/^'([^'\\]*)'$/) || s.match(/^"([^"\\]*)"$/);
    if (m) return S(m[1]);
    if (/^[+-]?\d+$/.test(s)) return { t: "int", v: parseInt(s, 10) };
    if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(s)) return { t: "float", v: parseFloat(s) };
    if (s === "True" || s === "False") return { t: "bool", v: s === "True" };
    if (s === "None") return { t: "none", v: null };
    if (/^[A-Za-z_]\w*$/.test(s)) return { name: s };
    return null;
  }

  // Split "a, b" at top-level commas (commas inside quotes don't count).
  function splitArgs(src) {
    const out = [];
    let cur = "", q = null;
    for (const ch of src) {
      if (q) { cur += ch; if (ch === q) q = null; }
      else if (ch === "'" || ch === '"') { cur += ch; q = ch; }
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((a) => a.trim());
  }

  const SYNTAX = { error: "SyntaxError: invalid syntax", hint: 'Try customer["plan"] or customer.get("region", "Unknown").' };

  // Turn the inside of [...] or a .get() argument into a key, or an error.
  function keyOf(src) {
    if (!src.trim()) return { err: { error: "SyntaxError: invalid syntax", hint: "Put a key inside the brackets, in quotes: customer[\"plan\"]." } };
    const k = literal(src);
    if (!k) return { err: SYNTAX };
    if (k.name)
      return { err: { error: "NameError: name '" + k.name + "' is not defined", hint: "Keys are text, so they need quotes: customer[\"" + k.name + "\"]. Without quotes Python looks for a variable called " + k.name + "." } };
    return { key: k };
  }

  function parse(raw) {
    const src = raw.trim();
    let m;
    if (src === "customer") return { kind: "all" };
    if (/^len\s*\(\s*customer\s*\)$/.test(src)) return { kind: "len" };
    if ((m = src.match(/^customer\s*\.\s*(keys|values|items)\s*\(\s*\)$/))) return { kind: m[1] };
    if ((m = src.match(/^customer\s*\.\s*get\s*\(([\s\S]*)\)$/))) {
      const args = splitArgs(m[1]);
      if (args.length > 2 || !args[0]) return { error: "TypeError: get expected 1 or 2 arguments", hint: "customer.get(key) or customer.get(key, default)." };
      const k = keyOf(args[0]);
      if (k.err) return k.err;
      let dflt = null;
      if (args.length === 2) {
        dflt = literal(args[1]);
        if (!dflt || dflt.name) return dflt && dflt.name ? { error: "NameError: name '" + dflt.name + "' is not defined", hint: "Put the default in quotes if it is text: \"Unknown\"." } : SYNTAX;
      }
      return { kind: "get", key: k.key, dflt };
    }
    if ((m = src.match(/^customer\s*\[([\s\S]*)\]\s*=(?!=)\s*([\s\S]+)$/))) {
      const k = keyOf(m[1]);
      if (k.err) return k.err;
      const v = literal(m[2]);
      if (!v) return { error: "SyntaxError: invalid syntax", hint: "The new value can be text in quotes, a number, True or False." };
      if (v.name) return { error: "NameError: name '" + v.name + "' is not defined", hint: "Text values need quotes: \"" + v.name + "\"." };
      return { kind: "set", key: k.key, val: v };
    }
    if ((m = src.match(/^customer\s*\[([\s\S]*)\]$/))) {
      const k = keyOf(m[1]);
      return k.err ? k.err : { kind: "item", key: k.key };
    }
    if ((m = src.match(/^([\s\S]+?)\s+(not\s+in|in)\s+customer$/))) {
      const k = keyOf(m[1]);
      return k.err ? k.err : { kind: "in", key: k.key, neg: /^not/.test(m[2]) };
    }
    if ((m = src.match(/^customer\s*\.\s*([A-Za-z_]\w*)$/)))
      return { error: "AttributeError: 'dict' object has no attribute '" + m[1] + "'", hint: "Dict values are reached with brackets and a quoted key: customer[\"" + m[1] + "\"]." };
    if ((m = src.match(/^([A-Za-z_]\w*)\s*[\[.(]/)) && m[1] !== "customer" && m[1] !== "len")
      return { error: "NameError: name '" + m[1] + "' is not defined", hint: "The dict is called customer." };
    return SYNTAX;
  }

  // ---------- Widget
  function mount(body) {
    body.classList.add("hz-dict-lookup");
    let dict = ORIGINAL.map(([k, v]) => [S(k), { ...v }]);
    let rows = []; // {row, key, link, val, valText, badge}
    let ghost = null;
    let runId = 0;

    body.append(
      el("p", { class: "hz-x__lede" }, [
        "A dictionary stores each value under a ",
        el("strong", { text: "key" }),
        ". You don't ask for position 3, you ask for ",
        el("code", { text: '"plan"' }),
        ". Type an expression or pick one below.",
      ])
    );

    const probe = el("div", { class: "hz-dict-lookup-probe", "aria-hidden": "true" });
    const ptr = el("div", { class: "hz-dict-lookup-ptr", "aria-hidden": "true" });
    const list = el("div", { class: "hz-dict-lookup-rows" });
    const table = el("div", { class: "hz-dict-lookup-table" }, [ptr, list]);
    const countBadge = el("span", { class: "hz-dict-lookup-badge is-dict" });
    const fig = el("div", { class: "hz-dict-lookup-fig", role: "img", "aria-label": "The customer dictionary as key cards linked to value cards" }, [
      el("div", { class: "hz-dict-lookup-title" }, [el("code", { text: "customer" }), countBadge, probe]),
      el("div", { class: "hz-dict-lookup-head" }, [el("span", { text: "keys" }), el("span"), el("span", { text: "values" })]),
      table,
    ]);
    body.append(fig);

    const badge = (t) => el("span", { class: "hz-dict-lookup-badge is-" + t, text: t });

    function makeRow(k, v, extra) {
      const valText = el("span", { class: "hz-dict-lookup-vtext", text: repr(v) });
      const bdg = badge(v.t);
      const r = {
        key: el("span", { class: "hz-dict-lookup-key", text: repr(k) }),
        link: el("span", { class: "hz-dict-lookup-link" }, [el("i")]),
        val: el("span", { class: "hz-dict-lookup-val" }, [valText, bdg]),
        valText,
        badge: bdg,
      };
      r.row = el("div", { class: "hz-dict-lookup-row" + (extra ? " " + extra : "") }, [r.key, r.link, r.val]);
      return r;
    }

    function renderAll() {
      rows = dict.map(([k, v]) => makeRow(k, v));
      list.replaceChildren(...rows.map((r) => r.row));
      countBadge.textContent = "dict · " + dict.length + " keys";
    }

    const findIdx = (key) => dict.findIndex(([k]) => same(k, key));

    // --- Console (shares the list-index console styles)
    const input = el("input", {
      type: "text", value: PRESETS[0], spellcheck: "false", autocomplete: "off", autocapitalize: "off",
      id: "hz-dl-" + Math.random().toString(36).slice(2, 8), class: "hz-list-index-input", "aria-label": "Python expression",
    });
    const form = el("form", { class: "hz-list-index-form", onsubmit: (e) => { e.preventDefault(); run(input.value, true); } }, [
      el("label", { for: input.id, class: "hz-list-index-prompt", text: ">>>" }),
      input,
      HZ.button("Run", () => run(input.value, true), "primary"),
      HZ.button("Reset dict", reset),
    ]);
    const chips = el("div", { class: "hz-list-index-chips", role: "group", "aria-label": "Example expressions" },
      PRESETS.map((p) => el("button", { type: "button", class: "hz-list-index-chip", text: p, onclick: () => { input.value = p; run(p, true); } }))
    );
    const out = el("pre", { class: "hz-list-index-out hz-dict-lookup-out", "aria-live": "polite" });
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
    body.append(form, chips, out, note);

    function writeOut(expr, text, cls) {
      out.replaceChildren(
        el("span", { class: "hz-list-index-echo", text: ">>> " + expr.trim() + "\n" }),
        el("span", { class: cls || "hz-list-index-res", text })
      );
    }

    function clearMarks() {
      rows.forEach((r) => r.row.classList.remove("is-on", "is-dim", "is-hit", "is-flash"));
      if (ghost) ghost.row.remove();
      ghost = null;
      ptr.classList.remove("is-on", "is-miss");
      probe.replaceChildren();
      probe.classList.remove("is-on");
    }

    function reset() {
      runId++;
      dict = ORIGINAL.map(([k, v]) => [S(k), { ...v }]);
      renderAll();
      clearMarks();
      out.replaceChildren(el("span", { class: "hz-list-index-echo", text: "# customer is back to its original 7 keys" }));
      note.textContent = "The dictionary is back to how the notebook defines it.";
    }

    // Pointer sits in the gutter, vertically centred on a row.
    const yOf = (row) => row.offsetTop + row.offsetHeight / 2 - ptr.offsetHeight / 2;
    let ptrY = 0;
    function placePtr(y) { ptrY = y; ptr.style.transform = "translateY(" + y + "px)"; }
    async function jumpTo(row, alive, instant) {
      const target = yOf(row);
      if (instant) { ptr.classList.add("is-on"); return placePtr(target); }
      if (!ptr.classList.contains("is-on")) {
        placePtr(-ptr.offsetHeight - 4);
        ptr.classList.add("is-on");
      }
      const from = ptrY;
      await HZ.tween(body, 420, (t) => alive() && placePtr(HZ.lerp(from, target, t)));
    }

    function showProbe(key, text) {
      probe.replaceChildren(el("code", { text: repr(key) }), el("span", { text: " → hash → " + text }));
      probe.classList.add("is-on");
    }

    function shake() {
      fig.classList.remove("is-shake");
      void fig.offsetWidth;
      if (!HZ.reducedMotion()) fig.classList.add("is-shake");
    }

    function similar(key) {
      if (key.t !== "str") return null;
      const lo = key.v.toLowerCase();
      const hit = dict.find(([k]) => k.t === "str" && k.v.toLowerCase() === lo);
      if (hit) return { k: hit[0], why: "case" };
      const part = lo.length >= 3 && dict.find(([k]) => k.t === "str" && (k.v.toLowerCase().includes(lo) || lo.includes(k.v.toLowerCase())));
      return part ? { k: part[0], why: "near" } : null;
    }

    function missHint(key) {
      const s = similar(key);
      if (s && s.why === "case") return "Keys are case-sensitive: " + repr(key) + " is not " + repr(s.k) + ". ";
      if (s) return "Did you mean " + repr(s.k) + "? Keys must match exactly. ";
      if (key.t !== "str") return "Dicts are looked up by key, not by position: there is no key " + repr(key) + ". ";
      return "";
    }

    async function lightRow(r, alive, instant) {
      r.key.parentNode.classList.add("is-on");
      if (!instant) await HZ.wait(380);
      return alive();
    }

    async function run(expr, animate) {
      const id = ++runId;
      const alive = () => id === runId && body.isConnected;
      const instant = !animate || HZ.reducedMotion();
      clearMarks();
      const r = parse(expr);
      const ex = expr.trim();

      if (r.error) {
        writeOut(ex, r.error, "hz-list-index-err");
        note.textContent = r.hint || "";
        return;
      }

      if (r.kind === "all") {
        rows.forEach((x) => x.row.classList.add("is-on"));
        writeOut(ex, "{" + dict.map(([k, v]) => repr(k) + ": " + repr(v)).join(", ") + "}");
        note.textContent = "The whole dictionary: every key with its value, in the order they were added.";
        return;
      }

      if (r.kind === "len") {
        rows.forEach((x) => x.row.classList.add("is-on"));
        writeOut(ex, String(dict.length));
        note.textContent = "len() counts the key–value pairs. One customer record, " + dict.length + " fields.";
        return;
      }

      if (r.kind === "keys" || r.kind === "values" || r.kind === "items") {
        const part = (k, v) => (r.kind === "keys" ? repr(k) : r.kind === "values" ? repr(v) : "(" + repr(k) + ", " + repr(v) + ")");
        const wrap = (s) => "dict_" + r.kind + "([" + s + "])";
        const shown = [];
        for (let i = 0; i < dict.length; i++) {
          const x = rows[i];
          x.row.classList.add(r.kind === "keys" ? "is-hit" : "is-on");
          shown.push(part(dict[i][0], dict[i][1]));
          writeOut(ex, wrap(shown.join(", ") + (i < dict.length - 1 && !instant ? ", …" : "")));
          if (!instant) { await HZ.wait(110); if (!alive()) return; }
        }
        writeOut(ex, wrap(shown.join(", ")));
        note.textContent = r.kind === "keys"
          ? "keys() lists every key, in the order they were added. Handy to check what a record contains before you look something up."
          : r.kind === "values" ? "values() lists the values, without their keys." : "items() gives (key, value) pairs; you will loop over them later.";
        return;
      }

      const idx = findIdx(r.key);
      const found = idx >= 0;

      if (r.kind === "in") {
        showProbe(r.key, found ? "found" : "no card");
        if (found) { await jumpTo(rows[idx].row, alive, instant); if (!alive()) return; rows[idx].row.classList.add("is-hit"); }
        const res = r.neg ? !found : found;
        writeOut(ex, res ? "True" : "False");
        note.textContent = "in asks the question without risking a KeyError: " + (found ? "the key exists." : "the key does not exist.") + " " + (found ? "" : missHint(r.key));
        return;
      }

      if (r.kind === "set") {
        if (found) {
          const x = rows[idx];
          showProbe(r.key, "jump to its card");
          await jumpTo(x.row, alive, instant);
          if (!alive()) return;
          x.row.classList.add("is-on");
          if (!instant) await HZ.wait(280);
          if (!alive()) return;
          const old = dict[idx][1];
          dict[idx][1] = r.val;
          x.valText.textContent = repr(r.val);
          x.badge.className = "hz-dict-lookup-badge is-" + r.val.t;
          x.badge.textContent = r.val.t;
          x.row.classList.remove("is-flash"); void x.row.offsetWidth; x.row.classList.add("is-flash");
          writeOut(ex, "# nothing printed: the dict changed in place", "hz-list-index-echo");
          note.textContent = "The key " + repr(r.key) + " already existed, so its value was replaced: " + repr(old) + " → " + repr(r.val) + ". A key can only appear once.";
        } else {
          dict.push([r.key, r.val]);
          const x = makeRow(r.key, r.val, "is-new");
          rows.push(x);
          list.append(x.row);
          countBadge.textContent = "dict · " + dict.length + " keys";
          showProbe(r.key, "no card yet, make one");
          await jumpTo(x.row, alive, instant);
          if (!alive()) return;
          x.row.classList.add("is-on");
          writeOut(ex, "# nothing printed: a new key was added", "hz-list-index-echo");
          note.textContent = "There was no key " + repr(r.key) + ", so assignment created a new key–value pair. Now customer has " + dict.length + " keys. Use Reset dict to go back.";
        }
        return;
      }

      // item or get
      if (found) {
        const x = rows[idx];
        showProbe(r.key, "jump straight to its card");
        await jumpTo(x.row, alive, instant);
        if (!alive()) return;
        if (!(await lightRow(x, alive, instant))) return;
        x.row.classList.add("is-hit");
        writeOut(ex, repr(dict[idx][1]));
        note.textContent = (r.kind === "get"
          ? ".get() found the key, so it behaves exactly like brackets and the default is ignored. "
          : "Python hashes the key and jumps straight to its card. It does not read the cards one by one, which is why lookups stay fast even with millions of keys. ") +
          "The value is a " + dict[idx][1].t + ".";
        return;
      }

      // missing key
      const isGet = r.kind === "get";
      const val = isGet ? (r.dflt || { t: "none", v: null }) : null;
      ghost = makeRow(r.key, val || S(""), "is-ghost" + (isGet ? " is-default" : " is-missing"));
      if (!isGet) ghost.val.replaceChildren(el("span", { class: "hz-dict-lookup-vtext", text: "no such key" }));
      else ghost.val.append(el("span", { class: "hz-dict-lookup-dflt", text: "default" }));
      list.append(ghost.row);
      showProbe(r.key, "no card there");
      await jumpTo(ghost.row, alive, instant);
      if (!alive()) return;
      if (!isGet) {
        ptr.classList.add("is-miss");
        shake();
        writeOut(ex, "KeyError: " + repr(r.key), "hz-list-index-err");
        note.textContent = "A dict only knows the keys it was given, and " + repr(r.key) + " is not one of them. " + missHint(r.key) +
          (similar(r.key) ? "" : "If a field may be missing, ask with customer.get(" + repr(r.key).replace(/'/g, '"') + ', "Unknown") instead.');
        return;
      }
      if (!instant) await HZ.wait(260);
      if (!alive()) return;
      ghost.row.classList.add("is-on");
      writeOut(ex, val.t === "none" ? "None" : repr(val));
      note.textContent = val.t === "none"
        ? "No key and no default, so .get() returns None (the notebook shows nothing; print() would show None). No crash, and the dict is not changed."
        : "No crash: the key is missing, so .get() hands back the default " + repr(val) + ". The dashed card is not added to the dict. " + missHint(r.key);
    }

    renderAll();
    run(input.value, false);
  }

  HZ.register("dict-lookup", {
    kicker: "Session 1",
    title: "Looking up a value by its key",
    mount,
    css: `
.md-typeset .hz-dict-lookup-fig { max-width: 34rem; width: 100%; margin: 0 auto; }
.md-typeset .hz-dict-lookup-fig.is-shake { animation: hz-dict-lookup-shake 320ms ease-in-out; }
@keyframes hz-dict-lookup-shake { 20%, 60% { transform: translateX(-4px); } 40%, 80% { transform: translateX(4px); } }
.md-typeset .hz-dict-lookup-title { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.6rem; margin-bottom: 0.5rem; min-height: 1.7rem; }
.md-typeset .hz-dict-lookup-title > code { font-size: 0.78rem; font-weight: 600; }
.md-typeset .hz-dict-lookup-probe {
  margin-left: auto; font-family: var(--md-code-font); font-size: 0.66rem; color: var(--md-default-fg-color--light);
  opacity: 0; transform: translateY(-3px); transition: opacity 220ms ease, transform 220ms ease;
}
.md-typeset .hz-dict-lookup-probe.is-on { opacity: 1; transform: none; }
.md-typeset .hz-dict-lookup-probe code { color: var(--hz-a); font-weight: 600; animation: hz-dict-lookup-hash 520ms ease-in-out; }
@keyframes hz-dict-lookup-hash { 0% { background: transparent; } 40% { background: var(--hz-a-soft); } 100% { background: transparent; } }
.md-typeset .hz-dict-lookup-head, .md-typeset .hz-dict-lookup-row {
  display: grid; grid-template-columns: minmax(0, 1fr) 1.6rem minmax(0, 1.15fr); align-items: center;
}
.md-typeset .hz-dict-lookup-head { padding-left: 1.5rem; margin-bottom: 0.25rem; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--hz-muted); }
.md-typeset .hz-dict-lookup-table { position: relative; padding-left: 1.5rem; }
.md-typeset .hz-dict-lookup-rows { display: flex; flex-direction: column; gap: 0.3rem; }
.md-typeset .hz-dict-lookup-ptr {
  position: absolute; left: 0.1rem; top: 0; width: 0; height: 0; border-top: 0.45rem solid transparent; border-bottom: 0.45rem solid transparent;
  border-left: 0.75rem solid var(--hz-a); opacity: 0; transition: opacity 180ms ease, border-color 180ms ease;
}
.md-typeset .hz-dict-lookup-ptr.is-on { opacity: 1; }
.md-typeset .hz-dict-lookup-ptr.is-miss { border-left-color: var(--hz-bad); }
.md-typeset .hz-dict-lookup-key, .md-typeset .hz-dict-lookup-val {
  font-family: var(--md-code-font); font-size: 0.68rem; padding: 0.32rem 0.55rem; border-radius: 8px; min-width: 0;
  border: 1px solid var(--hz-line); background: var(--md-default-bg-color); color: var(--md-default-fg-color);
  transition: border-color 220ms ease, background-color 220ms ease, opacity 220ms ease;
}
.md-typeset .hz-dict-lookup-key { overflow-wrap: anywhere; }
.md-typeset .hz-dict-lookup-val { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.2rem 0.4rem; }
.md-typeset .hz-dict-lookup-vtext { overflow-wrap: anywhere; }
.md-typeset .hz-dict-lookup-link { position: relative; height: 2px; background: var(--hz-line); }
.md-typeset .hz-dict-lookup-link i { position: absolute; inset: 0; background: var(--hz-a); transform: scaleX(0); transform-origin: left; transition: transform 320ms ease-in-out; }
.md-typeset .hz-dict-lookup-row.is-hit .hz-dict-lookup-key, .md-typeset .hz-dict-lookup-row.is-on .hz-dict-lookup-key { border-color: var(--hz-a); background: var(--hz-a-soft); }
.md-typeset .hz-dict-lookup-row.is-on .hz-dict-lookup-link i { transform: scaleX(1); }
.md-typeset .hz-dict-lookup-row.is-on .hz-dict-lookup-val { border-color: var(--hz-a); background: var(--hz-a-soft); animation: hz-dict-lookup-pop 300ms ease-out 200ms both; }
@keyframes hz-dict-lookup-pop { 0% { transform: scale(1); } 45% { transform: scale(1.05); } 100% { transform: scale(1); } }
.md-typeset .hz-dict-lookup-row.is-flash .hz-dict-lookup-val { animation: hz-dict-lookup-flash 650ms ease-out; }
@keyframes hz-dict-lookup-flash { 0% { background: var(--hz-a-soft); box-shadow: 0 0 0 3px var(--hz-a-soft); } 100% { box-shadow: 0 0 0 0 transparent; } }
.md-typeset .hz-dict-lookup-row.is-new { animation: hz-dict-lookup-in 420ms ease-out; }
@keyframes hz-dict-lookup-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.md-typeset .hz-dict-lookup-row.is-ghost { animation: hz-dict-lookup-in 300ms ease-out; }
.md-typeset .hz-dict-lookup-row.is-ghost .hz-dict-lookup-key { border-style: dashed; background: transparent; color: var(--md-default-fg-color--light); }
.md-typeset .hz-dict-lookup-row.is-missing .hz-dict-lookup-key { border-color: var(--hz-bad); color: var(--hz-bad); }
.md-typeset .hz-dict-lookup-row.is-missing .hz-dict-lookup-val { border-style: dashed; background: transparent; color: var(--hz-bad); justify-content: flex-start; }
.md-typeset .hz-dict-lookup-row.is-missing .hz-dict-lookup-link { background: transparent; border-top: 2px dotted var(--hz-line); height: 0; }
.md-typeset .hz-dict-lookup-row.is-default .hz-dict-lookup-val { border-style: dashed; background: transparent; opacity: 0.35; }
.md-typeset .hz-dict-lookup-row.is-default .hz-dict-lookup-link { background: transparent; border-top: 2px dotted var(--hz-line); height: 0; }
.md-typeset .hz-dict-lookup-row.is-default .hz-dict-lookup-link i { display: none; }
.md-typeset .hz-dict-lookup-row.is-default.is-on .hz-dict-lookup-val { opacity: 1; border-color: var(--hz-a); background: transparent; }
.md-typeset .hz-dict-lookup-dflt { font-size: 0.56rem; color: var(--hz-muted); font-style: italic; flex-basis: 100%; }
.md-typeset .hz-dict-lookup-badge {
  font-family: var(--md-code-font); font-size: 0.6rem; line-height: 1.3; padding: 0.05em 0.5em; border-radius: 999px; white-space: nowrap;
  --hz-dl-c: var(--hz-muted); color: var(--hz-dl-c); border: 1px solid var(--hz-dl-c); background: color-mix(in srgb, var(--hz-dl-c) 12%, transparent);
}
.md-typeset .hz-dict-lookup-badge.is-int { --hz-dl-c: var(--hz-b); }
.md-typeset .hz-dict-lookup-badge.is-float { --hz-dl-c: var(--hz-a); }
.md-typeset .hz-dict-lookup-badge.is-str { --hz-dl-c: var(--hz-good); }
.md-typeset .hz-dict-lookup-badge.is-bool { --hz-dl-c: var(--hz-ink); }
.md-typeset .hz-dict-lookup-badge.is-none { --hz-dl-c: var(--hz-muted); }
.md-typeset .hz-dict-lookup-out { white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 30em) {
  .md-typeset .hz-dict-lookup-head, .md-typeset .hz-dict-lookup-row { grid-template-columns: minmax(0, 1.2fr) 0.7rem minmax(0, 1fr); }
  .md-typeset .hz-dict-lookup-table, .md-typeset .hz-dict-lookup-head { padding-left: 1.15rem; }
  .md-typeset .hz-dict-lookup-key, .md-typeset .hz-dict-lookup-val { font-size: 0.62rem; padding: 0.3rem 0.4rem; }
  .md-typeset .hz-dict-lookup-ptr { left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .md-typeset .hz-dict-lookup-fig *, .md-typeset .hz-dict-lookup-fig { animation: none !important; transition: none !important; }
}
`,
  });
})();
