/*
 * coef-explorer: Week 3. A booking's predicted nightly rate is built as a
 * waterfall: the intercept (a Standard room, booked direct, at Santiago in
 * January) plus one bar per term (coefficient × value). Changing a control
 * resizes its bar and shifts every bar after it, so you can see each
 * coefficient doing its part. Coefficients are copied, rounded to one
 * decimal, from the linear model in Session_3_Live (step 06).
 */
(function () {
  const { el } = HZ;

  // LinearRegression on the 4,473 training bookings (arrival_month as 12 categories), rounded.
  const C = {
    intercept: 132.8,
    hotel: { Santiago: 0, "Viña del Mar": 20.8, "Puerto Varas": 41.0 },
    month: [0, -7.5, -50.7, -63.6, -67.1, -69.9, -45.3, -65.8, -59.7, -55.7, -53.0, -42.8],
    room: { Standard: 0, Superior: 31.1, Suite: 95.0 },
    channel: { Direct: 0, "Online travel agency": 5.5, Corporate: -14.4, "Travel agent": -19.5 },
    customer: { Leisure: 0, Business: 3.8, Group: 0.2 },
    nights: -3.3,
    weekend: 0.0,
    lead: -0.12,
    adults: 9.0,
    children: 8.7,
  };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const SHORT = { "Viña del Mar": "Viña", "Puerto Varas": "Pto. Varas", "Online travel agency": "Online agency", "Travel agent": "Agent" };
  const START = { hotel: "Viña del Mar", month: 2, room: "Superior", channel: "Online travel agency", customer: "Leisure", nights: 4, weekend: 2, lead: 30, adults: 2, children: 0 };
  const MAX = 360;
  const usd = (v, sign) => (sign ? (v < -0.005 ? "−" : "+") : v < 0 ? "−" : "") + "USD " + Math.abs(v).toFixed(1);

  const css = `
.md-typeset .hz-ce-controls { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.5rem 0.9rem; align-items: center; font-size: 0.72rem; }
.md-typeset .hz-ce-controls > span { color: var(--md-default-fg-color--light); }
.md-typeset .hz-ce-controls .hz-x__seg { flex-wrap: wrap; justify-self: start; }
.md-typeset .hz-ce-controls .hz-x__slider { grid-template-columns: minmax(8rem, 16rem) 6.2em; }
.md-typeset .hz-ce-controls .hz-x__slider > span { display: none; }
.md-typeset .hz-ce-pair { display: flex; flex-wrap: wrap; gap: 0.3rem 1.2rem; }
.md-typeset .hz-ce-controls .hz-ce-pair .hz-x__slider { grid-template-columns: minmax(5rem, 9rem) 6.2em; }
@media (max-width: 30em) {
  .md-typeset .hz-ce-controls { grid-template-columns: minmax(0, 1fr); gap: 0.25rem; }
  .md-typeset .hz-ce-controls > span { margin-top: 0.35rem; }
  .md-typeset .hz-ce-controls .hz-x__slider, .md-typeset .hz-ce-controls .hz-ce-pair .hz-x__slider { grid-template-columns: minmax(0, 1fr) 6.2em; }
  .md-typeset .hz-ce-pair { flex-direction: column; }
  .md-typeset .hz-ce-controls .hz-x__seg button { padding: 0.4em 0.55em; font-size: 0.62rem; white-space: nowrap; }
}
.md-typeset .hz-ce-fall { display: flex; flex-direction: column; gap: 0.3rem; }
.md-typeset .hz-ce-row { display: grid; grid-template-columns: minmax(9rem, 13rem) minmax(0, 1fr) 5.6em; gap: 0.7rem; align-items: center; border-radius: 8px; padding: 0.12rem 0.3rem; transition: background-color 400ms ease; }
.md-typeset .hz-ce-row.is-changed { background: var(--hz-a-soft); }
.md-typeset .hz-ce-lab { font-size: 0.7rem; line-height: 1.25; color: var(--md-default-fg-color); }
.md-typeset .hz-ce-lab small { display: block; font-family: var(--md-code-font); font-size: 0.6rem; color: var(--hz-muted); }
.md-typeset .hz-ce-track { position: relative; height: 1.25rem; background: linear-gradient(90deg, var(--hz-grid) 1px, transparent 1px) 0 0 / 22.222% 100%; border-left: 1px solid var(--hz-line); }
.md-typeset .hz-ce-bar, .md-typeset .hz-ce-guide { position: absolute; top: 0; bottom: 0; transition: left 480ms cubic-bezier(.65,0,.35,1), width 480ms cubic-bezier(.65,0,.35,1); }
.md-typeset .hz-ce-bar { border-radius: 3px; min-width: 2px; }
.md-typeset .hz-ce-guide { width: 0; border-left: 1px dashed var(--hz-muted); top: -0.45rem; bottom: -0.45rem; opacity: 0.6; }
.md-typeset .hz-ce-row.is-base .hz-ce-bar { background: var(--hz-muted); }
.md-typeset .hz-ce-row.is-pos .hz-ce-bar { background: var(--hz-a); }
.md-typeset .hz-ce-row.is-neg .hz-ce-bar { background: var(--hz-b); }
.md-typeset .hz-ce-row.is-zero .hz-ce-bar { background: var(--hz-line); }
.md-typeset .hz-ce-row.is-total { border-top: 1px solid var(--hz-line); border-radius: 0; padding-top: 0.4rem; margin-top: 0.15rem; }
.md-typeset .hz-ce-row.is-total .hz-ce-bar { background: var(--hz-ink); }
.md-typeset .hz-ce-row.is-total .hz-ce-lab { font-weight: 700; }
.md-typeset .hz-ce-val { font-family: var(--md-code-font); font-size: 0.66rem; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.md-typeset .hz-ce-row.is-pos .hz-ce-val { color: var(--hz-a); }
.md-typeset .hz-ce-row.is-neg .hz-ce-val { color: var(--hz-b); }
.md-typeset .hz-ce-row.is-zero .hz-ce-val { color: var(--hz-muted); }
.md-typeset .hz-ce-row.is-total .hz-ce-val { font-weight: 700; font-size: 0.76rem; }
.md-typeset .hz-ce-axis { position: relative; height: 1rem; font-family: var(--md-code-font); font-size: 0.6rem; color: var(--hz-muted); }
.md-typeset .hz-ce-axis span { position: absolute; transform: translateX(-50%); }
@media (max-width: 30em) {
  .md-typeset .hz-ce-row { grid-template-columns: minmax(0, 1fr) 5.6em; grid-template-areas: "lab val" "track track"; gap: 0.15rem 0.5rem; }
  .md-typeset .hz-ce-lab { grid-area: lab; }
  .md-typeset .hz-ce-val { grid-area: val; }
  .md-typeset .hz-ce-track { grid-area: track; }
  .md-typeset .hz-ce-axisrow { grid-template-columns: minmax(0, 1fr); grid-template-areas: none; }
  .md-typeset .hz-ce-axisrow > span { display: none; }
  .md-typeset .hz-ce-axisrow > .hz-ce-axis { grid-area: auto; }
}
.md-typeset .hz-ce .hz-x__note { min-height: 4.4em; }
.md-typeset .hz-ce-src { font-size: 0.64rem; color: var(--hz-muted); }
`;

  HZ.register("coef-explorer", {
    kicker: "Week 3",
    title: "A booking's rate, built from the coefficients",
    css,
    mount(body) {
      body.classList.add("hz-ce", "tex2jax_ignore");
      const s = { ...START };
      let changed = null, shownTotal = 0, totalRun = 0;

      body.append(el("p", { class: "hz-x__lede", html:
        "A linear regression prices a booking by <strong>adding</strong>: start from the intercept (a Standard room booked direct at Santiago in January), then add each coefficient times the booking's value. Describe a booking and watch which bar moves, and how every bar after it shifts." }));

      // --- Controls
      const seg = (key, values, label) => {
        const c = HZ.segmented(values.map((v) => ({ value: v, label: SHORT[v] || v })), s[key], (v) => update(key, v));
        c.node.setAttribute("aria-label", label);
        return c;
      };
      const sl = (key, label, min, max, fmt) =>
        HZ.slider({ label, min, max, step: 1, value: s[key], format: fmt, oninput: (v) => update(key, v) });
      body.append(el("div", { class: "hz-ce-controls" }, [
        el("span", { text: "Hotel" }), seg("hotel", Object.keys(C.hotel), "Hotel").node,
        el("span", { text: "Arrival month" }), sl("month", "Arrival month", 1, 12, (v) => MONTHS[v - 1]).node,
        el("span", { text: "Room" }), seg("room", Object.keys(C.room), "Room type").node,
        el("span", { text: "Channel" }), seg("channel", Object.keys(C.channel), "Channel").node,
        el("span", { text: "Guest" }), seg("customer", Object.keys(C.customer), "Customer type").node,
        el("span", { text: "Stay" }), el("div", { class: "hz-ce-pair" }, [
          sl("nights", "Nights", 1, 10, (v) => v + (v === 1 ? " night" : " nights")).node,
          sl("weekend", "Weekend nights", 0, 4, (v) => v + " weekend").node,
        ]),
        el("span", { text: "Booked ahead" }), sl("lead", "Lead time in days", 0, 240, (v) => v + " days").node,
        el("span", { text: "Guests" }), el("div", { class: "hz-ce-pair" }, [
          sl("adults", "Adults", 1, 4, (v) => v + (v === 1 ? " adult" : " adults")).node,
          sl("children", "Children", 0, 3, (v) => v + (v === 1 ? " child" : " children")).node,
        ]),
      ]));

      // --- Waterfall
      const ref = "reference: +0";
      const TERMS = [
        { key: "intercept", label: () => "Intercept", sub: () => "Santiago · Jan · Standard · Direct", value: () => C.intercept, base: true },
        { key: "hotel", label: () => "Hotel: " + s.hotel, sub: () => (s.hotel === "Santiago" ? ref : "vs Santiago"), value: () => C.hotel[s.hotel] },
        { key: "month", label: () => "Month: " + MONTHS[s.month - 1], sub: () => (s.month === 1 ? ref : "vs January, any hotel"), value: () => C.month[s.month - 1] },
        { key: "room", label: () => "Room: " + s.room, sub: () => (s.room === "Standard" ? ref : "vs Standard"), value: () => C.room[s.room] },
        { key: "channel", label: () => "Channel: " + s.channel, sub: () => (s.channel === "Direct" ? ref : "vs Direct"), value: () => C.channel[s.channel] },
        { key: "customer", label: () => "Guest: " + s.customer, sub: () => (s.customer === "Leisure" ? ref : "vs Leisure"), value: () => C.customer[s.customer] },
        { key: "nights", label: () => "Nights: " + s.nights, sub: () => s.nights + " × −3.3", value: () => s.nights * C.nights },
        { key: "weekend", label: () => "Weekend nights: " + s.weekend, sub: () => s.weekend + " × 0.0", value: () => s.weekend * C.weekend },
        { key: "lead", label: () => "Booked " + s.lead + " days ahead", sub: () => s.lead + " × −0.12", value: () => s.lead * C.lead },
        { key: "adults", label: () => "Adults: " + s.adults, sub: () => s.adults + " × +9.0", value: () => s.adults * C.adults },
        { key: "children", label: () => "Children: " + s.children, sub: () => s.children + " × +8.7", value: () => s.children * C.children },
      ];
      const fall = el("div", { class: "hz-ce-fall", role: "group", "aria-label": "Predicted nightly rate built term by term" });
      const rows = TERMS.map((t) => {
        const lab = el("span", { class: "hz-ce-lab" });
        const bar = el("div", { class: "hz-ce-bar" });
        const guide = el("div", { class: "hz-ce-guide" });
        const val = el("span", { class: "hz-ce-val" });
        const row = el("div", { class: "hz-ce-row" }, [lab, el("div", { class: "hz-ce-track" }, [guide, bar]), val]);
        fall.append(row);
        return { t, row, lab, bar, guide, val };
      });
      const totLab = el("span", { class: "hz-ce-lab", text: "Predicted rate per night" });
      const totBar = el("div", { class: "hz-ce-bar" });
      const totVal = el("span", { class: "hz-ce-val" });
      fall.append(el("div", { class: "hz-ce-row is-total" }, [totLab, el("div", { class: "hz-ce-track" }, [totBar]), totVal]));
      const axis = el("div", { class: "hz-ce-axis" }, [0, 80, 160, 240, 320].map((v) => el("span", { style: `left:${(v / MAX) * 100}%`, text: String(v) })));
      fall.append(el("div", { class: "hz-ce-row hz-ce-axisrow" }, [el("span", { class: "hz-ce-lab", html: "<small>USD per night</small>" }), axis, el("span")]));
      axis.classList.add("hz-ce-track");
      axis.style.background = "none";
      axis.style.borderLeft = "0";

      const note = el("p", { class: "hz-x__note", "aria-live": "polite" });
      const src = el("p", { class: "hz-ce-src", html:
        "Coefficients are copied from this week's linear model (step 06) and <strong>rounded to one decimal</strong> (two for the small per-day lead-time effect). Everything not shown (country, deposit, repeat guest, special requests, parking) is held at its reference or at zero, so it adds 0. Because of rounding, the total can differ from <code>model.predict</code> by a few cents." });
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
          r.val.textContent = r.t.base ? usd(v) : usd(v, true);
          r.row.className = "hz-ce-row " + (r.t.base ? "is-base" : Math.abs(v) < 0.05 ? "is-zero" : v > 0 ? "is-pos" : "is-neg");
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
          totVal.textContent = usd(shownTotal);
        });
      }

      function caption(total) {
        const t = "Predicted rate: <strong>" + usd(total) + "</strong> per night. ";
        const m = MONTHS[s.month - 1];
        if (changed === "hotel")
          return t + (s.hotel === "Santiago" ? "Santiago is the reference hotel: its bar is zero." : `${s.hotel} adds ${usd(C.hotel[s.hotel], true)} over an otherwise identical Santiago booking, in every month of the year.`);
        if (changed === "month") {
          if (s.month === 1) return t + "January is the reference month, so its bar is zero. Every other month is priced against it.";
          return t + `${m} is ${usd(-C.month[s.month - 1])} below January at <strong>every</strong> hotel.` +
            (s.month === 2 ? " True at the beach, but Santiago is quiet in February: one month effect for all hotels cannot know that (step 09)."
              : s.month === 7 ? " July is a peak only in Puerto Varas (winter holidays); the model shares it out across all three hotels." : "");
        }
        if (changed === "room")
          return t + (s.room === "Standard" ? "Standard is the reference room: its bar is zero." : `A ${s.room} adds ${usd(C.room[s.room], true)} per night over a Standard room, everything else equal.`);
        if (changed === "channel") {
          if (s.channel === "Direct") return t + "Direct is the reference channel: its bar is zero.";
          const how = s.channel === "Corporate" ? "a corporate agreement" : s.channel === "Travel agent" ? "a travel agent" : "an online travel agency";
          return t + `Booked through ${how}, the rate is ${usd(Math.abs(C.channel[s.channel]))} ${C.channel[s.channel] < 0 ? "lower" : "higher"} than the same booking made direct.`;
        }
        if (changed === "customer")
          return t + (s.customer === "Leisure" ? "Leisure is the reference guest type." : `Once hotel, room and channel are known, a ${s.customer.toLowerCase()} guest changes the rate by only ${usd(C.customer[s.customer], true)}: most of the difference between guest types is already explained by where and how they book.`);
        if (changed === "nights")
          return t + "Each extra night lowers the nightly rate by USD 3.3, in a straight line. In reality the discount comes in steps (at 5 and 7 nights), which a line smooths out.";
        if (changed === "weekend")
          return t + "Weekend nights add nothing (0.0 each, rounded). Not because weekends don't matter: Santiago weekends are cheaper and Viña weekends dearer, and one coefficient for all hotels averages them away.";
        if (changed === "lead")
          return t + `Each day booked ahead lowers the rate by USD 0.12, so ${s.lead} days is ${usd(s.lead * C.lead, true)}. In reality there are jumps (at 45 and 90 days) and a last-minute premium for business travellers: a straight line cannot draw them.`;
        if (changed === "adults" || changed === "children")
          return t + "Each adult and each child adds about USD 9 per night: the extra breakfast and bedding, on average.";
        return t + "A Superior room at Viña del Mar in February, booked 30 days ahead through an online travel agency: 4 nights, 2 of them on the weekend, for 2 adults. Change any part of the booking.";
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
