/* Graded quiz at the end of each lab. The questions live in the placeholder;
   the answers do not: they stay in a private sheet that the Apps Script in
   tools/quizzes/Code.gs reads to score each submission.

   <div class="hz-widget" data-widget="graded-quiz">
   <script type="application/json">
   {"id": "session-1", "title": "Week 1 quiz",
    "questions": [{"q": "…", "options": ["…", "…", "…"]}, …]}
   </script>
   </div>
*/
(function () {
  const { el } = HZ;

  // The web app deployed from tools/quizzes/Code.gs. After changing Code.gs, publish a
  // new version of the same deployment (Deploy › Manage deployments) so this URL stays.
  const ENDPOINT = "";

  const STORE = "hz-graded-quiz-student"; // remembers name and email on this device only

  function remembered() {
    try {
      return JSON.parse(localStorage.getItem(STORE)) || {};
    } catch (e) {
      return {};
    }
  }

  function remember(who) {
    try {
      localStorage.setItem(STORE, JSON.stringify(who));
    } catch (e) {
      /* private mode: nothing to do */
    }
  }

  function mount(body, dataset, source) {
    const json = source.find((n) => n.nodeName === "SCRIPT");
    let spec;
    try {
      spec = JSON.parse(json.textContent);
    } catch (e) {
      body.append(el("p", { class: "hz-x__error", text: "Quiz data is not valid JSON." }));
      return;
    }

    const who = remembered();
    const name = el("input", { type: "text", name: "name", required: true, autocomplete: "name", value: who.name || "" });
    const email = el("input", { type: "email", name: "email", required: true, autocomplete: "email", value: who.email || "" });

    const blocks = spec.questions.map((item, qi) => {
      const options = item.options.map((opt, oi) =>
        el("label", { class: "hz-gq-opt" }, [
          el("input", { type: "radio", name: `${spec.id}-q${qi}`, value: String(oi) }),
          el("span", { html: opt }),
        ])
      );
      const mark = el("span", { class: "hz-gq-mark", "aria-live": "polite" });
      return {
        node: el("fieldset", { class: "hz-gq-q" }, [
          el("legend", {}, [el("span", { class: "hz-gq-n", text: String(qi + 1) }), el("span", { html: item.q }), mark]),
          el("div", { class: "hz-gq-opts" }, options),
        ]),
        mark,
        value: () => {
          const picked = options.map((o) => o.querySelector("input")).find((i) => i.checked);
          return picked ? Number(picked.value) : null;
        },
      };
    });

    const submit = el("button", { type: "submit", class: "hz-x__btn hz-x__btn--primary" }, "Submit my answers");
    const result = el("p", { class: "hz-gq-result", role: "status" });
    const form = el("form", { class: "hz-gq", novalidate: true }, [
      el("div", { class: "hz-gq-who" }, [
        el("label", {}, ["Full name", name]),
        el("label", {}, ["Email (the one you use in the program)", email]),
      ]),
      ...blocks.map((b) => b.node),
      el("div", { class: "hz-gq-foot" }, [submit, result]),
    ]);

    if (!ENDPOINT) {
      submit.disabled = true;
      result.textContent = "Graded submissions are not open yet. You can read the questions now.";
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const answers = blocks.map((b) => b.value());
      if (!name.value.trim() || !email.checkValidity() || !email.value.trim()) {
        result.dataset.tone = "bad";
        result.textContent = "Write your full name and a valid email first.";
        return;
      }
      const missing = answers.findIndex((a) => a === null);
      if (missing >= 0) {
        result.dataset.tone = "bad";
        result.textContent = `Question ${missing + 1} has no answer yet.`;
        return;
      }
      remember({ name: name.value.trim(), email: email.value.trim() });
      submit.disabled = true;
      result.dataset.tone = "";
      result.textContent = "Sending…";
      try {
        // A text/plain body keeps this a simple request, which Apps Script accepts cross-origin.
        const res = await fetch(ENDPOINT, {
          method: "POST",
          body: JSON.stringify({ quiz: spec.id, name: name.value.trim(), email: email.value.trim(), answers }),
        });
        const out = await res.json();
        if (!out.ok) throw new Error(out.error || "The quiz was not recorded.");
        out.results.forEach((right, i) => {
          blocks[i].mark.textContent = right ? "✓" : "✗";
          blocks[i].mark.dataset.right = String(right);
        });
        result.dataset.tone = "good";
        result.textContent = out.message;
      } catch (err) {
        result.dataset.tone = "bad";
        result.textContent = "Not sent: " + err.message + " Try again in a minute.";
      } finally {
        submit.disabled = !ENDPOINT;
      }
    });

    body.append(el("p", { class: "hz-x__lede", html: spec.intro || "Five questions on this week's ideas. Your <strong>first</strong> submission is the one that counts, and you will see which answers were right right after sending." }), form);
  }

  HZ.register("graded-quiz", {
    kicker: "Graded quiz",
    title: "",
    mount(body, dataset, source) {
      const json = source.find((n) => n.nodeName === "SCRIPT");
      try {
        const t = JSON.parse(json.textContent).title;
        const head = body.parentElement && body.parentElement.querySelector(".hz-x__title");
        if (head && t) head.textContent = t;
      } catch (e) {
        /* mount() reports the error */
      }
      mount(body, dataset, source);
    },
    css: `
.md-typeset .hz-gq { display: flex; flex-direction: column; gap: 1rem; }
.md-typeset .hz-gq-who { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; }
@media (max-width: 36em) { .md-typeset .hz-gq-who { grid-template-columns: minmax(0, 1fr); } }
.md-typeset .hz-gq-who label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.68rem; font-weight: 600; }
.md-typeset .hz-gq input[type=text], .md-typeset .hz-gq input[type=email] {
  font: inherit; font-weight: 400; font-size: 0.74rem; padding: 0.5em 0.7em; border: 1px solid var(--hz-line);
  border-radius: 8px; background: var(--md-default-bg-color); color: var(--md-default-fg-color);
}
.md-typeset .hz-gq input:focus-visible { outline: 2px solid var(--md-primary-fg-color); outline-offset: 1px; }
.md-typeset .hz-gq-q { border: 1px solid var(--hz-line); border-radius: 12px; padding: 0.7rem 0.9rem 0.8rem; margin: 0; }
.md-typeset .hz-gq-q legend { display: flex; gap: 0.5rem; align-items: baseline; font-weight: 600; font-size: 0.74rem; padding: 0 0.3rem; }
.md-typeset .hz-gq-n { font-family: var(--md-code-font); color: var(--md-primary-fg-color); }
.md-typeset .hz-gq-mark { margin-left: auto; font-size: 0.9rem; }
.md-typeset .hz-gq-mark[data-right="true"] { color: var(--hz-good); }
.md-typeset .hz-gq-mark[data-right="false"] { color: var(--hz-bad); }
.md-typeset .hz-gq-opts { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.4rem; }
.md-typeset .hz-gq-opt { display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.72rem; cursor: pointer; padding: 0.3rem 0.4rem; border-radius: 8px; transition: background-color 150ms ease; }
.md-typeset .hz-gq-opt:hover { background: var(--hz-a-soft); }
.md-typeset .hz-gq-opt input { accent-color: var(--md-primary-fg-color); margin-top: 0.2em; }
.md-typeset .hz-gq-foot { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; align-items: center; }
.md-typeset .hz-gq-result { margin: 0; font-size: 0.72rem; color: var(--md-default-fg-color--light); }
.md-typeset .hz-gq-result[data-tone="good"] { color: var(--hz-good); }
.md-typeset .hz-gq-result[data-tone="bad"] { color: var(--hz-bad); }
`,
  });
})();
