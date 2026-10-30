/* Week 4: an overbooking policy chosen with money. For every threshold, the
   rooms of the bookings whose predicted probability of cancelling is at least
   that high are resold. Two mistakes cost money:
     - a booking we did not resell is cancelled: an empty room (cost E);
     - a booking we resold shows up: we walk a guest to another hotel (cost W).
   Total cost = E × empty rooms + W × walked guests, on the 1,491 test bookings
   of the week 4 notebook model. The cheapest threshold sits near the
   break-even probability W / (W + E). */
(function () {
  const { el, svg, slider, button, stats, scale, tween, lerp, clamp } = HZ;

  // Predicted probabilities of cancelling of the test bookings, in thousandths
  // (floor(p × 1000)), split by what really happened. Same numbers as the notebook.
  const CANCEL = [37,70,73,91,91,101,101,103,108,110,111,120,120,122,122,122,123,124,125,128,132,132,132,133,135,136,140,142,146,147,148,149,151,154,156,157,157,158,159,163,164,165,167,167,168,170,172,175,180,183,188,190,194,194,196,196,197,198,199,199,199,203,203,203,206,208,210,211,211,214,218,220,221,223,226,227,227,228,230,232,232,233,238,239,240,242,245,246,246,246,248,249,252,253,254,258,259,259,263,264,264,266,266,266,268,272,273,274,275,277,280,281,282,284,284,285,285,287,288,288,289,290,292,293,293,294,296,297,298,298,304,305,307,307,307,307,308,308,311,317,317,318,318,319,322,323,323,324,326,326,329,330,330,332,333,334,335,336,339,343,345,346,346,350,350,351,351,352,352,352,352,355,358,359,361,361,361,361,362,363,364,365,367,367,368,369,370,370,374,375,375,376,376,377,378,379,381,384,388,388,388,388,390,390,390,391,393,397,397,399,400,400,403,404,406,407,407,408,411,411,411,412,413,414,414,414,414,415,415,417,417,418,419,421,422,422,422,423,424,426,428,430,430,432,433,434,434,436,437,437,438,441,441,442,443,444,446,446,447,447,449,450,450,450,451,451,452,452,454,455,456,457,458,458,460,461,462,467,467,470,472,474,475,476,477,478,480,481,482,485,487,488,489,489,491,492,494,494,495,497,498,499,502,503,505,505,507,507,507,508,508,509,509,509,510,511,512,514,517,518,518,519,523,524,525,527,528,529,530,530,530,533,535,535,538,538,538,538,539,539,540,540,541,541,541,543,543,544,549,551,551,552,554,555,556,557,559,561,562,564,566,566,566,567,569,569,571,571,572,573,573,573,574,576,576,581,581,583,583,584,586,587,587,589,590,594,596,596,597,598,599,600,601,602,603,605,607,607,610,610,611,613,614,617,618,619,620,620,620,621,622,625,626,627,627,629,632,632,632,637,640,642,642,642,642,643,644,646,651,652,658,658,662,662,667,672,672,677,681,682,684,692,692,692,694,701,701,706,708,709,709,712,713,713,716,724,724,730,732,736,737,739,741,746,747,748,751,752,753,754,755,757,758,759,760,761,761,772,781,782,784,785,792,792,799,800,804,820,827,831,839,840,845,853,862,865,886,888,889,892,902,942,947];
  const SHOW = [18,24,24,30,30,32,34,35,35,37,38,39,39,40,42,42,44,46,47,48,48,49,50,51,51,51,52,52,53,53,53,54,54,56,56,56,57,58,60,60,60,60,61,61,62,62,63,63,63,63,64,64,64,65,66,67,67,67,68,69,69,69,70,70,70,71,71,72,73,73,73,75,75,75,75,77,79,79,79,80,80,81,81,82,82,82,83,83,84,84,84,84,85,87,88,88,89,89,89,90,91,93,93,93,94,94,94,96,96,97,97,97,97,98,98,98,99,99,99,100,101,101,101,101,101,103,103,103,103,103,104,104,104,104,104,106,106,107,107,107,107,107,107,107,108,109,109,109,109,109,111,112,113,113,113,114,114,114,114,114,115,115,116,116,117,117,117,117,117,119,119,119,120,120,121,122,122,123,123,123,123,123,123,124,124,124,124,124,125,125,125,126,126,127,127,127,127,127,127,127,128,128,129,129,129,130,130,130,130,130,131,131,131,131,132,132,132,133,134,134,135,135,135,136,138,138,138,139,139,140,140,140,140,141,141,141,141,141,142,142,142,142,142,143,143,143,144,144,144,145,145,145,145,146,146,147,147,147,148,148,149,149,149,149,149,150,150,151,151,152,152,152,152,153,154,154,154,155,155,157,157,157,157,158,158,159,159,159,159,160,160,161,161,161,161,161,161,162,162,162,162,162,163,163,164,164,164,164,165,165,165,165,165,166,167,167,168,169,169,170,170,170,170,170,171,172,172,172,172,172,172,173,173,174,174,174,174,174,175,175,175,175,175,175,176,176,176,177,178,178,178,179,180,180,181,182,182,183,183,183,183,183,184,184,184,185,186,187,187,188,189,189,189,189,189,190,190,190,190,191,192,192,192,193,193,193,193,194,194,194,195,195,195,195,196,196,196,197,197,197,197,197,198,198,199,199,200,200,200,201,201,201,202,202,203,203,204,204,204,205,206,206,207,207,208,208,209,209,210,210,210,210,211,211,211,211,212,212,213,213,213,213,214,214,214,214,215,215,215,216,217,217,217,217,217,218,219,219,221,221,221,221,224,226,226,227,227,228,228,229,229,229,229,230,230,231,231,231,231,232,232,232,232,233,234,234,236,236,239,239,240,241,241,242,242,244,245,245,245,246,246,247,247,247,248,248,249,249,250,250,250,250,251,251,252,252,252,253,253,253,254,254,256,256,256,257,257,257,257,258,258,259,259,259,260,261,261,261,262,262,263,263,263,264,265,265,265,265,265,265,266,267,267,267,268,269,270,270,271,271,271,272,272,272,272,272,273,273,274,274,275,276,276,276,276,277,278,279,280,280,281,281,282,283,283,283,285,285,285,286,286,287,287,287,288,289,291,291,291,291,292,292,292,292,294,295,298,298,298,299,299,300,300,301,301,303,304,304,305,305,307,307,308,309,309,309,310,311,312,313,315,315,315,315,315,315,316,317,318,318,319,319,319,320,321,321,322,323,324,324,325,328,328,331,331,332,332,333,333,334,334,335,336,336,336,337,337,337,338,339,340,343,343,345,345,345,345,346,346,346,346,347,347,349,350,351,351,351,351,353,354,355,355,357,357,358,358,359,359,359,359,359,359,360,361,361,362,362,362,363,363,364,364,365,365,366,367,368,368,369,369,369,369,370,370,370,371,373,374,377,378,379,379,379,380,382,383,383,384,384,386,386,388,388,389,389,391,391,392,392,393,394,395,396,398,398,399,403,404,407,407,407,409,409,409,409,410,410,410,411,411,411,411,411,413,413,413,414,414,416,416,416,418,418,420,420,420,421,421,421,423,423,424,424,426,426,428,428,429,431,432,435,435,437,440,443,444,446,446,447,449,450,450,451,451,451,452,453,455,455,455,457,457,458,458,462,462,462,462,463,464,464,464,465,465,465,467,467,467,467,468,468,469,470,470,471,474,475,476,477,478,478,485,487,487,487,487,492,492,497,497,498,501,501,502,502,503,503,506,506,509,513,516,517,518,520,521,522,522,523,528,531,531,534,534,535,536,536,538,538,539,540,540,542,544,546,549,551,554,555,558,559,561,561,566,569,569,570,572,573,577,578,578,583,585,585,588,591,596,597,600,601,602,604,604,607,613,613,616,617,625,626,631,634,637,639,647,650,651,655,660,662,664,665,666,667,674,695,699,704,705,708,713,716,720,720,720,722,727,730,734,739,743,745,758,759,761,766,769,775,783,790,791,793,793,814,815,836,859,860,863,870,873,875,880,889,909,931];

  const W = 520, H = 300, M = { l: 66, r: 18, t: 24, b: 46 };
  const TS = Array.from({ length: 101 }, (_, i) => i); // thresholds 0.00..1.00 in hundredths
  const N_CANCEL = CANCEL.length, N_SHOW = SHOW.length, N = N_CANCEL + N_SHOW;
  let uid = 0;

  // Counts per threshold do not depend on the costs: compute them once.
  const COUNTS = TS.map((t) => {
    const tp = CANCEL.filter((v) => v >= t * 10).length; // resold, and it was cancelled
    const fp = SHOW.filter((v) => v >= t * 10).length;   // resold, but the guest came: walked
    return { t: t / 100, tp, fp, fn: N_CANCEL - tp, tn: N_SHOW - fp, flagged: tp + fp };
  });

  const usd = (v) => (v < 0 ? "−" : "") + "USD " + Math.abs(Math.round(v)).toLocaleString("en-US");
  const k = (v) => (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0).replace(/\.0$/, "") + "k" : String(v));
  const niceStep = (max) => [5000, 10000, 20000, 25000, 50000, 100000, 200000].find((s) => max / s <= 5) || 500000;

  function mount(body) {
    body.classList.add("hz-ct");
    const clipId = "hz-ct-clip-" + ++uid;
    let empty = 400, walk = 300, mine = 50; // mine: the reader's threshold, in hundredths

    const xs = scale([0, 1], [M.l, W - M.r]);
    const fig = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "hz-ct-plot", role: "img", "aria-label": "Total cost of the overbooking policy for each threshold" });
    fig.append(svg("defs", {}, [svg("clipPath", { id: clipId }, [svg("rect", { x: M.l - 8, y: M.t - 8, width: W - M.r - M.l + 16, height: H - M.b - M.t + 8 })])]));
    const yAxis = svg("g");
    fig.append(yAxis);
    [0, 0.2, 0.4, 0.6, 0.8, 1].forEach((t) => fig.append(svg("text", { x: xs(t), y: H - M.b + 18, "text-anchor": "middle", text: t ? t.toFixed(1) : "0" })));
    fig.append(svg("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", text: "threshold: resell the room if p(cancel) ≥ threshold" }));
    fig.append(svg("line", { class: "hz-axis", x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));

    const nothingLine = svg("line", { class: "hz-ct-nothing", x1: M.l, x2: W - M.r });
    const nothingTxt = svg("text", { class: "hz-ct-reftxt", x: W - M.r - 4, "text-anchor": "end" });
    const allTxt = svg("text", { class: "hz-ct-reftxt", x: M.l + 6 });
    const beLine = svg("line", { class: "hz-ct-be", y1: M.t, y2: H - M.b });
    const beTxt = svg("text", { class: "hz-ct-betxt", y: H - M.b - 8 });
    const curve = svg("path", { class: "hz-ct-curve", "clip-path": `url(#${clipId})` });
    const mineDrop = svg("line", { class: "hz-ct-minedrop" });
    const mineDot = svg("circle", { class: "hz-ct-mine", r: 6.5 });
    const mineTxt = svg("text", { class: "hz-ct-minetxt", "text-anchor": "middle" });
    const bestDot = svg("circle", { class: "hz-ct-best", r: 7 });
    const bestTxt = svg("text", { class: "hz-ct-besttxt" });
    fig.append(nothingLine, nothingTxt, allTxt, beLine, beTxt, curve, mineDrop, mineDot, mineTxt, bestDot, bestTxt);

    // Confusion counts at the reader's threshold (shared classes from the threshold explainer)
    const cell = (cls, name) => {
      const n = el("strong", { text: "0" });
      return { n, node: el("div", { class: "hz-thr-cell " + cls }, [n, el("span", { text: name })]) };
    };
    const cm = { tp: cell("is-tp", "room resold"), fn: cell("is-fn", "empty room"), fp: cell("is-fp", "guest walked"), tn: cell("is-tn", "normal stay") };
    const matrix = el("div", { class: "hz-thr-matrix" }, [
      el("span"), el("span", { class: "hz-thr-h", text: "resold (flagged)" }), el("span", { class: "hz-thr-h", text: "kept" }),
      el("span", { class: "hz-thr-h hz-thr-h--row", text: "cancelled" }), cm.tp.node, cm.fn.node,
      el("span", { class: "hz-thr-h hz-thr-h--row", text: "showed up" }), cm.fp.node, cm.tn.node,
    ]);
    const matrixTitle = el("p", { class: "hz-ct-mtitle" });
    const readout = stats();
    const note = el("p", { class: "hz-x__note", "aria-live": "polite" });

    function compute() {
      const costs = COUNTS.map((c) => empty * c.fn + walk * c.fp);
      let bi = 0;
      costs.forEach((v, i) => { if (v < costs[bi] - 1e-9) bi = i; });
      const nothing = costs[100], everyone = costs[0];
      // Keep the interesting part readable: the "resell everything" end may run off the top.
      const top = Math.max(nothing, Math.min(everyone, nothing * 1.45), ...costs.slice(15)) * 1.1;
      const step = niceStep(top);
      const ymax = Math.ceil(top / step) * step;
      const ys = scale([0, ymax], [H - M.b, M.t]);
      return {
        costs, bi, nothing, everyone, ymax, step, ys,
        px: { curve: costs.map(ys), nothing: ys(nothing), best: ys(costs[bi]), bestX: xs(COUNTS[bi].t), mine: ys(costs[mine]), be: xs(clamp(walk / (walk + empty), 0, 1)) },
      };
    }

    let shown = null, anim = 0, S = null;

    function update(animate) {
      S = compute();
      drawAxis(S);
      drawText(S);
      const from = shown, to = S.px, id = ++anim;
      if (!from || !animate) { shown = to; drawShapes(S, to); return; }
      tween(body, 420, (q) => {
        if (id !== anim) return;
        shown = {
          curve: to.curve.map((v, i) => lerp(from.curve[i], v, q)),
          nothing: lerp(from.nothing, to.nothing, q), best: lerp(from.best, to.best, q),
          bestX: lerp(from.bestX, to.bestX, q), mine: lerp(from.mine, to.mine, q), be: lerp(from.be, to.be, q),
        };
        drawShapes(S, shown);
      });
    }

    function drawAxis(S) {
      yAxis.replaceChildren();
      for (let v = 0; v <= S.ymax + 1; v += S.step) {
        yAxis.append(svg("line", { class: "hz-gridline", x1: M.l, x2: W - M.r, y1: S.ys(v), y2: S.ys(v) }));
        yAxis.append(svg("text", { x: M.l - 8, y: S.ys(v) + 4, "text-anchor": "end", text: v ? k(v) : "0" }));
      }
      yAxis.append(svg("text", { x: 14, y: (M.t + H - M.b) / 2, transform: `rotate(-90 14 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle", text: "total cost (USD)" }));
    }

    function drawShapes(S, p) {
      curve.setAttribute("d", p.curve.map((y, i) => (i ? "L" : "M") + xs(COUNTS[i].t).toFixed(1) + "," + y.toFixed(1)).join(""));
      nothingLine.setAttribute("y1", p.nothing); nothingLine.setAttribute("y2", p.nothing);
      nothingTxt.setAttribute("y", p.nothing - 8);
      const allY = p.curve[0];
      allTxt.setAttribute("y", allY < M.t + 4 ? M.t + 6 : allY - 10);
      beLine.setAttribute("x1", p.be); beLine.setAttribute("x2", p.be);
      const beRight = p.be > W - M.r - 150;
      beTxt.setAttribute("x", beRight ? p.be - 6 : p.be + 6);
      beTxt.setAttribute("text-anchor", beRight ? "end" : "start");
      const mx = xs(mine / 100);
      mineDot.setAttribute("cx", mx); mineDot.setAttribute("cy", clamp(p.mine, M.t, H - M.b));
      mineDrop.setAttribute("x1", mx); mineDrop.setAttribute("x2", mx);
      mineDrop.setAttribute("y1", clamp(p.mine, M.t, H - M.b)); mineDrop.setAttribute("y2", H - M.b);
      mineTxt.setAttribute("x", clamp(mx, M.l + 30, W - M.r - 30));
      mineTxt.setAttribute("y", clamp(p.mine, M.t, H - M.b) - 13);
      const near = Math.abs(p.bestX - mx) < 4;
      mineTxt.style.opacity = near ? 0 : 1;
      bestDot.setAttribute("cx", p.bestX); bestDot.setAttribute("cy", p.best);
      const leftHalf = p.bestX < (M.l + W - M.r) / 2;
      bestTxt.setAttribute("x", leftHalf ? p.bestX + 12 : p.bestX - 12);
      bestTxt.setAttribute("text-anchor", leftHalf ? "start" : "end");
      bestTxt.setAttribute("y", p.best + 24 > H - M.b - 4 ? p.best - 14 : p.best + 24);
    }

    let rolled = { tp: 0, fp: 0, fn: 0, tn: 0 }, rollId = 0;
    function rollTo(c) {
      const from = { ...rolled }, id = ++rollId;
      tween(body, 300, (q) => {
        if (id !== rollId) return;
        for (const key of ["tp", "fp", "fn", "tn"]) {
          rolled[key] = Math.round(lerp(from[key], c[key], q));
          cm[key].n.textContent = rolled[key];
        }
      });
    }

    function drawText(S) {
      const b = COUNTS[S.bi], best = S.costs[S.bi];
      const c = COUNTS[mine], cost = S.costs[mine];
      const be = walk / (walk + empty);
      nothingTxt.textContent = `do nothing: ${usd(S.nothing)}`;
      allTxt.textContent = S.everyone > S.ymax ? `↑ resell every room: ${usd(S.everyone)}` : "resell every room";
      beTxt.textContent = `break-even ${be.toFixed(2)}`;
      mineTxt.textContent = `yours ${(mine / 100).toFixed(2)}`;
      bestTxt.textContent = `cheapest ${b.t.toFixed(2)} · ${usd(best)}`;
      matrixTitle.textContent = `At your threshold ${c.t.toFixed(2)}, the ${N.toLocaleString("en-US")} test bookings:`;
      rollTo(c);
      readout.set([
        ["Rooms resold (yours)", String(c.flagged)],
        ["Total cost (yours)", usd(cost), "is-a"],
        ["Saved vs doing nothing", usd(S.nothing - cost), S.nothing - cost >= 0 ? "is-good" : "is-bad"],
        ["Cheapest threshold", b.t.toFixed(2)],
        ["Cost at the cheapest", usd(best)],
      ]);
      let msg = `An empty room costs ${usd(empty)} and a walked guest ${usd(walk)}, so reselling a booking pays off when its probability of cancelling is above ${walk} / (${walk} + ${empty}) ≈ <strong>${be.toFixed(2)}</strong>. `;
      if (b.flagged <= 3 || S.nothing - best < 0.01 * S.nothing) msg += `With these costs even the riskiest bookings are not worth the gamble: the cheapest policy is <strong>to oversell (almost) nothing</strong>. The model cannot beat doing nothing when an empty room is cheap.`;
      else if (S.bi === 0) msg += `Empty rooms are so dear that reselling <strong>every</strong> room is cheapest. Check the walking cost: is it really that low?`;
      else if (mine === S.bi) msg += `You are at the cheapest threshold: resell ${b.flagged} rooms, walk ${b.fp} guests, leave ${b.fn} rooms empty, for ${usd(best)}. That is ${usd(S.nothing - best)} less than doing nothing.`;
      else msg += `Your threshold ${c.t.toFixed(2)} costs ${usd(cost)}; the cheapest, <strong>${b.t.toFixed(2)}</strong>, costs ${usd(best)}: ${usd(cost - best)} less on these bookings.${cost > S.nothing ? " Yours is worse than doing nothing!" : ""}`;
      note.innerHTML = msg;
    }

    const se = slider({ label: "Empty room (USD)", min: 50, max: 800, step: 10, value: empty, format: (v) => String(v), oninput: (v) => { empty = v; update(true); } });
    const sw = slider({ label: "Walked guest (USD)", min: 50, max: 800, step: 10, value: walk, format: (v) => String(v), oninput: (v) => { walk = v; update(true); } });
    const sm = slider({ label: "Your threshold", min: 0, max: 100, step: 1, value: mine, format: (v) => (v / 100).toFixed(2), oninput: (v) => { mine = v; update(false); } });
    const preset = (label, e, w, variant) => button(label, () => { empty = e; walk = w; se.set(e); sw.set(w); update(true); }, variant);
    let jumpId = 0;
    const jump = button("Go to the cheapest", () => {
      const from = mine, to = S.bi, id = ++jumpId;
      tween(body, 500, (q) => {
        if (id !== jumpId) return;
        mine = Math.round(lerp(from, to, q));
        sm.set(mine);
        update(false);
      });
    }, "primary");

    body.append(
      el("p", { class: "hz-x__lede", html: "Every point of the curve is one overbooking policy: resell the room of every booking whose predicted probability of cancelling is above the threshold. Its height is what the policy costs Altamar: rooms left empty plus guests walked to another hotel. These are the real probabilities of the week 4 logistic model for Altamar’s 1,491 test bookings." }),
      fig,
      el("div", { class: "hz-legend" }, [
        el("span", {}, [el("i", { style: "background: var(--hz-a)" }), "cheapest threshold"]),
        el("span", {}, [el("i", { style: "border: 2px solid var(--hz-ink)" }), "your threshold"]),
        el("span", {}, [el("i", { style: "background: var(--hz-b)" }), "break-even: walk ÷ (walk + empty)"]),
        el("span", {}, [el("i", { style: "background: var(--hz-muted)" }), "doing nothing"]),
      ]),
      el("div", { class: "hz-ct-bottom" }, [el("div", { class: "hz-ct-side" }, [matrixTitle, matrix]), readout.node]),
      el("div", { class: "hz-x__controls" }, [se.node, sw.node]),
      el("div", { class: "hz-x__controls" }, [sm.node, jump]),
      el("div", { class: "hz-ct-presets", role: "group", "aria-label": "Cost scenarios" }, [
        preset("Finance: 400 / 300", 400, 300),
        preset("Walks hurt more: 400 / 600", 400, 600),
        preset("One night only: 130 / 300", 130, 300),
      ]),
      note
    );
    update(false);
  }

  HZ.register("cost-threshold", {
    kicker: "Week 4",
    title: "An overbooking policy that costs least",
    mount,
    css: `
.md-typeset .hz-x svg.hz-ct-plot text { font-size: 13px; }
.md-typeset .hz-ct-curve { fill: none; stroke: var(--hz-ink); stroke-width: 2.8; stroke-linejoin: round; }
.md-typeset .hz-ct-nothing { stroke: var(--hz-muted); stroke-width: 1.4; stroke-dasharray: 6 4; }
.md-typeset .hz-x svg text.hz-ct-reftxt { fill: var(--hz-muted); font-size: 12px; paint-order: stroke; stroke: var(--hz-card); stroke-width: 4px; }
.md-typeset .hz-ct-be { stroke: var(--hz-b); stroke-width: 1.5; stroke-dasharray: 2 4; }
.md-typeset .hz-x svg text.hz-ct-betxt { fill: var(--hz-b); font-size: 12px; paint-order: stroke; stroke: var(--hz-card); stroke-width: 4px; }
.md-typeset .hz-ct-mine { fill: var(--hz-card); stroke: var(--hz-ink); stroke-width: 2; }
.md-typeset .hz-ct-minedrop { stroke: var(--hz-ink); stroke-opacity: 0.4; stroke-width: 1; stroke-dasharray: 3 3; }
.md-typeset .hz-x svg text.hz-ct-minetxt { fill: var(--hz-ink); transition: opacity 200ms ease; paint-order: stroke; stroke: var(--hz-card); stroke-width: 4px; }
.md-typeset .hz-ct-best { fill: var(--hz-a); stroke: var(--hz-card); stroke-width: 2; }
.md-typeset .hz-x svg text.hz-ct-besttxt { fill: var(--hz-a); font-weight: 600; paint-order: stroke; stroke: var(--hz-card); stroke-width: 4px; }
.md-typeset .hz-ct-plot { max-width: 46rem; touch-action: pan-y; }
.md-typeset .hz-ct-side { display: flex; flex-direction: column; gap: 0.6rem; }
.md-typeset .hz-ct-bottom { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 1.2rem; align-items: end; }
@media (max-width: 44em) { .md-typeset .hz-ct-bottom { grid-template-columns: minmax(0, 1fr); } }
.md-typeset .hz-ct-mtitle { font-size: 0.68rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-ct-presets { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.md-typeset .hz-ct .hz-x__note { min-height: 4.2em; }
@media (max-width: 44em) { .md-typeset .hz-x svg.hz-ct-plot text { font-size: 18px; } .md-typeset .hz-x svg text.hz-ct-reftxt, .md-typeset .hz-x svg text.hz-ct-betxt { font-size: 16px; } }
`,
  });
})();
