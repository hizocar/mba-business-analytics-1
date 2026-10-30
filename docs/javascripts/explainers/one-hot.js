/*
 * one-hot: Week 3. Altamar's text column `room_type` expands into one 0/1
 * column per room type; each booking's 1 slides from its room into the
 * matching column. With drop_first=True the reference column (Standard) fades
 * out: all zeros means Standard. Clicking a booking's room moves its 1.
 */
(function () {
  const { el, svg } = HZ;

  const PLANS = ["Standard", "Suite", "Superior"]; // the alphabetical order get_dummies uses
  const START = [0, 2, 0, 1, 0, 2]; // Standard, Superior, Standard, Suite, Standard, Superior

  function layout(narrow) {
    return narrow
      ? { W: 364, narrow, idxX: 10, planX: 26, planW: 86, colX: 136, colW: 70, colGap: 4, top: 50, pitch: 32, rowH: 26 }
      : { W: 548, narrow, idxX: 14, planX: 34, planW: 112, colX: 214, colW: 104, colGap: 6, top: 50, pitch: 32, rowH: 26 };
  }

  const css = `
.md-typeset .hz-oh-fig { max-width: 40rem; margin: 0 auto; }
.md-typeset .hz-x svg.hz-oh-fig text { font-size: 12.5px; }
.md-typeset .hz-oh-plan rect { fill: var(--md-default-bg-color); stroke: var(--hz-line); stroke-width: 1.3; transition: stroke 200ms ease; }
.md-typeset .hz-oh-plan { cursor: pointer; }
.md-typeset .hz-oh-plan:hover rect { stroke: var(--hz-a); }
.md-typeset .hz-oh-plan:focus { outline: none; }
.md-typeset .hz-oh-plan:focus-visible rect { stroke: var(--md-primary-fg-color); stroke-width: 2.5; }
.md-typeset .hz-x svg .hz-oh-plan text { fill: var(--md-default-fg-color); }
.md-typeset .hz-x svg .hz-oh-head text { fill: var(--md-default-fg-color); font-weight: 600; }
.md-typeset .hz-x svg .hz-oh-head text.hz-oh-pre { fill: var(--hz-muted); font-weight: 400; }
.md-typeset .hz-x svg .hz-oh-colname { font-weight: 600; fill: var(--md-default-fg-color--light); }
.md-typeset .hz-oh-cell rect { fill: var(--md-default-bg-color); stroke: var(--hz-line); stroke-width: 1; transition: fill 220ms ease, stroke 220ms ease; }
.md-typeset .hz-x svg .hz-oh-cell text { fill: var(--hz-muted); font-size: 13px; }
.md-typeset .hz-oh-cell.is-one rect { fill: var(--hz-a-soft); stroke: var(--hz-a); stroke-width: 1.6; }
.md-typeset .hz-x svg .hz-oh-cell.is-one text { fill: var(--hz-a); font-weight: 700; }
.md-typeset .hz-oh-cell.is-allzero rect { fill: var(--hz-b-soft); stroke: var(--hz-b); }
.md-typeset .hz-x svg .hz-oh-cell.is-allzero text { fill: var(--hz-b); font-weight: 600; }
.md-typeset .hz-oh-col { transition: opacity 400ms ease-in-out; }
.md-typeset .hz-oh-col.is-ref .hz-oh-cell rect { stroke-dasharray: 3 3; }
.md-typeset .hz-oh-token circle { fill: var(--hz-a); }
.md-typeset .hz-x svg .hz-oh-token text { fill: var(--hz-card); font-weight: 700; font-size: 13px; }
.md-typeset .hz-oh-arrow { stroke: var(--hz-muted); stroke-width: 1.5; fill: none; }
.md-typeset .hz-x svg .hz-oh-reflab { font-size: 12px; fill: var(--hz-b); font-weight: 600; }
.md-typeset .hz-oh-code { margin: 0; padding: 0.5em 0.8em; border-radius: 8px; font-family: var(--md-code-font); font-size: 0.72rem; background: var(--md-default-bg-color); border: 1px solid var(--hz-line); color: var(--md-default-fg-color); overflow-x: auto; white-space: pre; }
.md-typeset .hz-oh-code b { color: var(--hz-a); font-weight: 700; }
.md-typeset .hz-oh .hz-x__note { min-height: 4.2em; }
`;

  HZ.register("one-hot", {
    kicker: "Week 3",
    title: "Room types become 0/1 columns",
    css,
    mount(body) {
      body.classList.add("hz-oh", "tex2jax_ignore"); // keep MathJax away from the dollar amounts
      let plans = START.slice(), encoded = false, dropFirst = false, busy = false, runId = 0, last = null;
      let L = layout(false);

      body.append(el("p", { class: "hz-x__lede", html:
        "A regression multiplies numbers; it cannot multiply <code>\"Suite\"</code>. <code>pd.get_dummies</code> gives each room type its own column, with a 1 if the booking is for that room and 0 otherwise. <strong>Click any room</strong> on the left to change a booking's room." }));

      const encodeBtn = HZ.button("Encode", () => encode(), "primary");
      const resetBtn = HZ.button("Reset", () => reset());
      const dropSeg = HZ.segmented(
        [{ value: "false", label: "drop_first=False" }, { value: "true", label: "drop_first=True" }],
        "false",
        (v) => setDrop(v === "true")
      );
      const code = el("pre", { class: "hz-oh-code" });
      const fig = svg("svg", { class: "hz-oh-fig", role: "group", "aria-label": "The room_type column and its 0/1 columns" });
      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      body.append(el("div", { class: "hz-x__controls" }, [encodeBtn, dropSeg.node, resetBtn]), code, fig, note);

      // --- Scene
      let planCells = [], planTexts = [], cols = [], cells = [], token, refLab, arrow;
      const rowY = (i) => L.top + i * L.pitch;
      const colX = (j) => L.colX + j * (L.colW + L.colGap);
      const cellC = (i, j) => ({ x: colX(j) + L.colW / 2, y: rowY(i) + L.rowH / 2 });

      function build() {
        const H = L.top + START.length * L.pitch + 26;
        fig.replaceChildren();
        fig.setAttribute("viewBox", `0 0 ${L.W} ${H}`);
        fig.append(svg("text", { x: L.planX + L.planW / 2, y: 34, "text-anchor": "middle", class: "hz-oh-colname", text: "room_type" }));
        planCells = [];
        planTexts = [];
        START.forEach((_, i) => {
          fig.append(svg("text", { x: L.idxX, y: rowY(i) + L.rowH / 2 + 4.5, "text-anchor": "middle", text: i }));
          const t = svg("text", { x: L.planW / 2, y: L.rowH / 2 + 4.5, "text-anchor": "middle" });
          const g = svg("g", { class: "hz-oh-plan", transform: `translate(${L.planX} ${rowY(i)})`, tabindex: 0, role: "button" }, [
            svg("rect", { width: L.planW, height: L.rowH, rx: 6 }), t,
          ]);
          g.addEventListener("click", () => cycle(i));
          g.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              cycle(i);
            }
          });
          fig.append(g);
          planCells.push(g);
          planTexts.push(t);
        });

        const ax = L.planX + L.planW + 6, bx = L.colX - 6, ay = L.top + 2.5 * L.pitch + L.rowH / 2;
        arrow = svg("path", { d: `M ${ax} ${ay} H ${bx} m -6 -5 l 6 5 l -6 5`, class: "hz-oh-arrow" });
        fig.append(arrow);

        cols = [];
        cells = START.map(() => []);
        PLANS.forEach((p, j) => {
          const g = svg("g", { class: "hz-oh-col", opacity: 0 });
          const head = svg("g", { class: "hz-oh-head" }, [
            svg("text", { x: colX(j) + L.colW / 2, y: 18, "text-anchor": "middle", class: "hz-oh-pre", text: L.narrow ? "" : "room_type_" }),
            svg("text", { x: colX(j) + L.colW / 2, y: 34, "text-anchor": "middle", text: p }),
          ]);
          g.append(head);
          START.forEach((_, i) => {
            const t = svg("text", { x: L.colW / 2, y: L.rowH / 2 + 4.5, "text-anchor": "middle", text: "0", opacity: 0 });
            const c = svg("g", { class: "hz-oh-cell", transform: `translate(${colX(j)} ${rowY(i)})` }, [svg("rect", { width: L.colW, height: L.rowH, rx: 5 }), t]);
            g.append(c);
            cells[i][j] = { g: c, t };
          });
          fig.append(g);
          cols.push(g);
        });
        if (L.narrow) // one shared prefix: three copies would collide on a phone
          fig.append(svg("g", { class: "hz-oh-head" }, [svg("text", { x: colX(0) + (PLANS.length * L.colW + (PLANS.length - 1) * L.colGap) / 2, y: 16, "text-anchor": "middle", class: "hz-oh-pre", text: "room_type_ …" })]));
        refLab = svg("text", { x: colX(0) + L.colW / 2, y: L.top + START.length * L.pitch + 12, "text-anchor": "middle", class: "hz-oh-reflab", opacity: 0, text: L.narrow ? "dropped" : "reference" });
        fig.append(refLab);
        token = svg("g", { class: "hz-oh-token", opacity: 0 }, [svg("circle", { r: 11 }), svg("text", { y: 4.5, "text-anchor": "middle", text: "1" })]);
        fig.append(token);
      }

      // --- Painting
      function paintCells(revealed) {
        START.forEach((_, i) => {
          const allZero = dropFirst && plans[i] === 0;
          PLANS.forEach((_, j) => {
            const shown = revealed ? revealed(i, j) : encoded;
            const one = plans[i] === j;
            cells[i][j].t.setAttribute("opacity", shown ? 1 : 0);
            cells[i][j].t.textContent = one ? "1" : "0";
            cells[i][j].g.classList.toggle("is-one", shown && one && !(dropFirst && j === 0));
            cells[i][j].g.classList.toggle("is-allzero", shown && allZero && j > 0);
          });
        });
      }
      function paintStatic() {
        planTexts.forEach((t, i) => (t.textContent = PLANS[plans[i]]));
        planCells.forEach((g, i) => g.setAttribute("aria-label", `Booking ${i}: ${PLANS[plans[i]]}. Activate to change the room type.`));
        cols.forEach((g, j) => {
          g.setAttribute("opacity", encoded ? (dropFirst && j === 0 ? 0.25 : 1) : 0);
          g.classList.toggle("is-ref", dropFirst && j === 0);
        });
        refLab.setAttribute("opacity", encoded && dropFirst ? 1 : 0);
        token.setAttribute("opacity", 0);
        paintCells();
        syncUi();
      }

      // --- Motion
      async function fly(from, to, id) {
        token.setAttribute("opacity", 1);
        await HZ.tween(body, 430, (k) => {
          if (id !== runId) return;
          const x = HZ.lerp(from.x, to.x, k), y = HZ.lerp(from.y, to.y, k) - Math.sin(Math.PI * k) * 14;
          token.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        });
        token.setAttribute("opacity", 0);
      }

      async function encode() {
        if (busy || encoded) return;
        const id = ++runId;
        busy = true;
        last = null;
        syncUi();
        const alive = () => id === runId && body.isConnected;
        // 1. the new columns appear, one per plan
        for (let j = 0; j < PLANS.length; j++) {
          HZ.tween(body, 320, (k) => alive() && cols[j].setAttribute("opacity", k));
          await HZ.wait(110);
        }
        await HZ.wait(260);
        // 2. each row's 1 slides from its plan into its column, then zeros fill the rest
        const done = START.map(() => false);
        for (let i = 0; i < START.length; i++) {
          if (!alive()) return;
          const p = cellC(i, plans[i]);
          await fly({ x: L.planX + L.planW - 14, y: rowY(i) + L.rowH / 2 }, p, id);
          if (!alive()) return;
          done[i] = true;
          paintCells((r) => done[r]);
        }
        encoded = true;
        busy = false;
        if (dropFirst) await applyDrop(id);
        if (alive()) paintStatic();
      }

      async function applyDrop(id) {
        const from = +cols[0].getAttribute("opacity");
        const to = dropFirst ? 0.25 : 1;
        cols[0].classList.toggle("is-ref", dropFirst);
        paintCells();
        await HZ.tween(body, 480, (k) => id === runId && cols[0].setAttribute("opacity", HZ.lerp(from, to, k)));
        refLab.setAttribute("opacity", dropFirst ? 1 : 0);
      }

      async function setDrop(v) {
        dropFirst = v;
        last = null;
        if (!encoded) {
          syncUi();
          return encode();
        }
        if (busy) return;
        const id = ++runId;
        await applyDrop(id);
        if (id === runId) paintStatic();
      }

      async function cycle(i) {
        if (busy) return;
        const from = plans[i];
        plans[i] = (plans[i] + 1) % PLANS.length;
        last = i;
        if (!encoded) return paintStatic();
        const id = ++runId;
        busy = true;
        // the old cell becomes 0 while the 1 travels to the new column
        cells[i][from].t.textContent = "0";
        cells[i][from].g.classList.remove("is-one");
        planTexts[i].textContent = PLANS[plans[i]];
        syncUi();
        await fly(cellC(i, from), cellC(i, plans[i]), id);
        if (id === runId) {
          busy = false;
          paintStatic();
        }
      }

      function reset() {
        runId++;
        busy = false;
        encoded = false;
        dropFirst = false;
        last = null;
        plans = START.slice();
        dropSeg.set("false");
        paintStatic();
      }

      function caption() {
        const c = (s) => "<code>" + s + "</code>";
        if (last !== null && encoded) {
          const p = PLANS[plans[last]];
          if (dropFirst && plans[last] === 0)
            return `Booking ${last} is now <strong>Standard</strong>: every remaining column is 0. With ${c("drop_first=True")}, "all zeros" is how the table says Standard.`;
          return `Booking ${last} is now <strong>${p}</strong>: its 1 moved to ${c("room_type_" + p)}. Exactly one column is on per booking, so the ${p} coefficient applies only to ${p} bookings.`;
        }
        if (!encoded) return "Each row is a booking. Press <strong>Encode</strong> to turn the text column into numbers.";
        if (dropFirst)
          return `With ${c("drop_first=True")} the first category, <strong>Standard</strong>, loses its column. A row of all zeros now means Standard: it becomes the <strong>reference</strong>, and each room coefficient will read as "USD per night more than a Standard room". Standard happens to come first alphabetically; for other columns we choose the reference ourselves (Direct for channel, Santiago for hotel).`;
        return "Every row has exactly one 1, so the three columns always add up to 1. That makes one of them redundant: if a booking is not a Suite or a Superior, we already know it is a Standard room. Try " + c("drop_first=True") + ".";
      }

      function syncUi() {
        encodeBtn.disabled = busy || encoded;
        dropSeg.set(String(dropFirst));
        const cols = dropFirst ? PLANS.slice(1) : PLANS;
        code.innerHTML = `pd.get_dummies(df["room_type"], drop_first=<b>${dropFirst ? "True" : "False"}</b>, dtype="int64")\n# → ${encoded ? cols.map((p) => "room_type_" + p).join(", ") : "press Encode"}`;
        note.innerHTML = caption();
      }

      function measure() {
        const narrow = (body.clientWidth || 600) < 470;
        if (planCells.length && narrow === L.narrow) return;
        runId++;
        busy = false;
        L = layout(narrow);
        build();
        paintStatic();
      }
      measure();
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          if (!body.isConnected) return ro.disconnect();
          measure();
        });
        ro.observe(body);
      }
    },
  });
})();
