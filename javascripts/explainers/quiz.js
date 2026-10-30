/* "Check yourself" question used in the lessons.

   <div class="hz-widget" data-widget="quiz">
   <script type="application/json">
   {"q": "What does cars[-1] return?", "options": ["'Mercedes'", "'Tesla'", "An error"],
    "answer": 1, "why": "Negative indices count from the right, so -1 is the last item.", "code": true}
   </script>
   </div>

   "code": true renders the options in monospace. */
(function () {
  const { el } = HZ;

  function mount(body, dataset, source) {
    const json = source.find((n) => n.nodeName === "SCRIPT");
    let spec;
    try {
      spec = JSON.parse(json.textContent);
    } catch (e) {
      body.append(el("p", { class: "hz-x__error", text: "Quiz data is not valid JSON." }));
      return;
    }

    const feedback = el("p", { class: "hz-quiz__why", "aria-live": "polite" });
    const buttons = spec.options.map((opt, i) =>
      el("button", { type: "button", class: "hz-quiz__opt" + (spec.code ? " is-code" : ""), onclick: () => pick(i) }, [
        el("span", { class: "hz-quiz__mark", "aria-hidden": "true", text: String.fromCharCode(65 + i) }),
        el("span", { html: opt }),
      ])
    );

    function pick(i) {
      const right = i === spec.answer;
      buttons.forEach((b, j) => {
        b.classList.toggle("is-right", j === spec.answer && right);
        b.classList.toggle("is-wrong", j === i && !right);
        b.setAttribute("aria-pressed", String(j === i));
      });
      body.classList.toggle("is-solved", right);
      feedback.innerHTML = (right ? "<strong>Right.</strong> " : "<strong>Not quite.</strong> Try another option. ") + (right ? spec.why : "");
    }

    body.append(
      el("div", { class: "hz-quiz" }, [
        el("p", { class: "hz-quiz__kicker", text: "Check yourself" }),
        el("p", { class: "hz-quiz__q", html: spec.q }),
        el("div", { class: "hz-quiz__opts", role: "group" }, buttons),
        feedback,
      ])
    );
  }

  HZ.register("quiz", {
    bare: true,
    mount,
    css: `
.md-typeset .hz-quiz { border: 1px dashed var(--md-primary-fg-color); border-radius: 14px; padding: 0.9rem 1rem; }
.md-typeset .hz-quiz__kicker { margin: 0 0 0.3rem; font-family: var(--md-code-font); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--md-primary-fg-color); }
.md-typeset .hz-quiz__q { margin: 0 0 0.7rem; font-weight: 600; }
.md-typeset .hz-quiz__opts { display: flex; flex-direction: column; gap: 0.4rem; }
.md-typeset .hz-quiz__opt {
  display: flex; align-items: center; gap: 0.6rem; width: 100%; text-align: left; font: inherit; font-size: 0.74rem;
  padding: 0.5rem 0.7rem; border-radius: 10px; border: 1px solid var(--hz-line); background: var(--md-default-bg-color);
  color: var(--md-default-fg-color); cursor: pointer; transition: border-color 150ms ease, background-color 150ms ease, transform 100ms ease;
}
.md-typeset .hz-quiz__opt:hover { border-color: var(--md-primary-fg-color); }
.md-typeset .hz-quiz__opt:active { transform: scale(0.99); }
.md-typeset .hz-quiz__opt.is-code span:last-child { font-family: var(--md-code-font); }
.md-typeset .hz-quiz__mark { flex: none; display: grid; place-items: center; width: 1.4rem; height: 1.4rem; border-radius: 50%; border: 1px solid var(--hz-line); font-family: var(--md-code-font); font-size: 0.62rem; color: var(--hz-muted); transition: background-color 150ms ease, color 150ms ease; }
.md-typeset .hz-quiz__opt.is-right { border-color: var(--hz-good); background: color-mix(in srgb, var(--hz-good) 12%, transparent); }
.md-typeset .hz-quiz__opt.is-right .hz-quiz__mark { background: var(--hz-good); border-color: var(--hz-good); color: var(--md-default-bg-color); }
.md-typeset .hz-quiz__opt.is-wrong { border-color: var(--hz-bad); animation: hz-quiz-shake 300ms ease; }
.md-typeset .hz-quiz__opt.is-wrong .hz-quiz__mark { background: var(--hz-bad); border-color: var(--hz-bad); color: var(--md-default-bg-color); }
.md-typeset .hz-quiz__why { margin: 0.6rem 0 0; font-size: 0.72rem; min-height: 1.2em; color: var(--md-default-fg-color--light); }
@keyframes hz-quiz-shake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
@media (prefers-reduced-motion: reduce) { .md-typeset .hz-quiz__opt.is-wrong { animation: none; } }
`,
  });
})();
