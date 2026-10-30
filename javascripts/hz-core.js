/*
 * Shared runtime for the course's interactive explainers.
 *
 * A notebook or Markdown page asks for an explainer with a placeholder:
 *
 *   <div class="hz-widget" data-widget="threshold">
 *     <p>Interactive explainer: open this class on the course website.</p>
 *   </div>
 *
 * In Colab the fallback text shows; on the site the widget registered under
 * that name replaces it. Widgets live in explainers/<name>.js, are loaded the
 * first time a page asks for them, and register themselves with HZ.register().
 */
(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const EXPLAINERS = new URL("explainers/", document.currentScript.src).href;
  const registry = {};
  const requested = new Set();

  const reducedMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // el("div", {class: "x", onclick: fn}, [children...])
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    applyAttrs(node, attrs);
    append(node, children);
    return node;
  }

  function svg(tag, attrs, children) {
    const node = document.createElementNS(SVG_NS, tag);
    applyAttrs(node, attrs);
    append(node, children);
    return node;
  }

  function applyAttrs(node, attrs) {
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
  }

  function append(node, children) {
    if (children === undefined || children === null) return;
    for (const c of [].concat(children)) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }

  // Labelled range input. Returns {node, input, set(value)}.
  function slider({ label, min, max, step = 1, value, format = (v) => v, oninput }) {
    const out = el("output", { class: "hz-x__value" });
    const input = el("input", { type: "range", min, max, step, value, "aria-label": label });
    const show = () => (out.textContent = format(+input.value));
    input.addEventListener("input", () => {
      show();
      oninput && oninput(+input.value);
    });
    show();
    const node = el("label", { class: "hz-x__slider" }, [el("span", { text: label }), input, out]);
    return {
      node,
      input,
      set(v) {
        input.value = v;
        show();
      },
    };
  }

  function button(label, onclick, variant) {
    return el("button", { type: "button", class: "hz-x__btn" + (variant ? " hz-x__btn--" + variant : ""), onclick }, label);
  }

  // Segmented control: options = [{value, label}]. Returns {node, set(value)}.
  function segmented(options, value, onchange) {
    const node = el("div", { class: "hz-x__seg", role: "group" });
    const buttons = options.map((o) =>
      el("button", { type: "button", "data-value": o.value, onclick: () => pick(o.value, true) }, o.label)
    );
    function pick(v, fire) {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === String(v))));
      if (fire && onchange) onchange(v);
    }
    append(node, buttons);
    pick(value, false);
    return { node, set: (v) => pick(v, false) };
  }

  // Small key/value readout: stats([["Precision", "0.82"], ...]). Returns {node, set(rows)}.
  function stats(rows) {
    const node = el("dl", { class: "hz-x__stats" });
    function set(next) {
      node.replaceChildren(
        ...next.flatMap(([k, v, cls]) => [el("dt", { text: k }), el("dd", { text: v, class: cls || null })])
      );
    }
    set(rows || []);
    return { node, set };
  }

  // Animate t from 0 to 1 over `ms`, calling step(easedT). Stops if `owner`
  // leaves the DOM (instant navigation swaps the page out). Resolves when done.
  function tween(owner, ms, step, ease = easeInOut) {
    if (reducedMotion() || ms <= 0) {
      step(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const t0 = performance.now();
      function frame(now) {
        if (!owner.isConnected) return resolve();
        const t = Math.min(1, (now - t0) / ms);
        step(ease(t));
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion() ? 0 : ms));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Seeded RNG so every student sees the same "random" data as the notebook.
  function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.normal = () => {
      const u = 1 - next();
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return next;
  }

  // Linear scale helper: scale([d0, d1], [r0, r1])(x)
  function scale(domain, range) {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    const f = (x) => r0 + ((x - d0) / (d1 - d0)) * (r1 - r0);
    f.invert = (y) => d0 + ((y - r0) / (r1 - r0)) * (d1 - d0);
    return f;
  }

  const fmt = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "–");

  // spec.css (optional) is injected once, so a widget is a single file.
  function register(name, spec) {
    registry[name] = spec;
    if (spec.css && !document.querySelector(`style[data-hz="${name}"]`)) {
      document.head.append(el("style", { "data-hz": name, text: spec.css }));
    }
    mountAll();
  }

  function load(name) {
    if (requested.has(name) || !/^[a-z0-9-]+$/.test(name)) return;
    requested.add(name);
    const s = el("script", { src: EXPLAINERS + name + ".js", async: true });
    s.onerror = () =>
      document.querySelectorAll(`.hz-widget[data-widget="${name}"]`).forEach((h) => (h.dataset.missing = "1"));
    document.head.append(s);
  }

  function mount(host) {
    const spec = registry[host.dataset.widget];
    if (!spec) return load(host.dataset.widget);
    if (host.dataset.mounted) return;
    host.dataset.mounted = "1";
    const source = [...host.childNodes]; // placeholder content, e.g. a JSON <script> with options
    const body = el("div", { class: "hz-x__body" });
    if (spec.bare) {
      host.replaceChildren(body);
      body.classList.add("hz-x--bare");
      try {
        spec.mount(body, host.dataset, source);
      } catch (err) {
        console.error(err);
      }
      return;
    }
    const card = el("figure", { class: "hz-x" }, [
      el("figcaption", { class: "hz-x__head" }, [
        el("span", { class: "hz-x__kicker", text: "Interactive · " + (spec.kicker || "explainer") }),
        el("span", { class: "hz-x__title", text: spec.title }),
      ]),
      body,
    ]);
    host.replaceChildren(card);
    try {
      spec.mount(body, host.dataset, source);
    } catch (err) {
      body.replaceChildren(el("p", { class: "hz-x__error", text: "This explainer failed to load: " + err.message }));
      console.error(err);
    }
  }

  function mountAll() {
    document.querySelectorAll(".hz-widget[data-widget]:not([data-mounted])").forEach(mount);
  }

  window.HZ = {
    register, mountAll, el, svg, slider, button, segmented, stats, tween, wait,
    easeInOut, easeOut, lerp, clamp, rng, scale, fmt, reducedMotion,
  };

  // The notebooks' MathJax 2 reads any pair of "$" as math. Widgets talk about
  // dollars, and each code cell keeps a plain-text copy for the copy button, so
  // both are excluded. This runs before MathJax's first typeset: this script is
  // at the end of <body> and MathJax starts after its own files download.
  document
    .querySelectorAll(".hz-widget, .clipboard-copy-txt, .hz-run-mdout")
    .forEach((n) => n.classList.add("tex2jax_ignore"));

  // Material's instant navigation swaps page content without a reload.
  if (typeof document$ !== "undefined") document$.subscribe(mountAll);
  else document.addEventListener("DOMContentLoaded", mountAll);
})();
