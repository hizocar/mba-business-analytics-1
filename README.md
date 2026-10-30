# Business Analytics I · From Python to Nonlinear Models

MBA diploma module (24 hours live + 12 hours self-paced). Python, data analysis and machine learning for managers, following one case, Altamar Hotels, from linear models to random forests and gradient boosting. Module 1 of 2; Module 2 covers text analytics, NLP and LLMs.

Site: https://hizocar.github.io/mba-business-analytics-1/

## How the site works

- **Runnable notebooks.** `docs/javascripts/pyrunner.js` adds a ▶ button to every code cell; Python runs in the browser with [Pyodide](https://pyodide.org) inside a Web Worker (`docs/javascripts/pyworker.js`).
- **Simulators.** A notebook Markdown cell with `<div class="hz-widget" data-widget="NAME">` is replaced on the site by `docs/javascripts/explainers/NAME.js`, loaded on demand by `docs/javascripts/hz-core.js`.
- **Graded quizzes.** The quiz at the end of each lab posts to a Google Apps Script web app (`tools/quizzes/Code.gs`) that scores it against a private sheet of answers and records it. The answers are not in this repository.
- **Data.** `tools/data/make_altamar.py` rebuilds the Altamar Hotels dataset.

## Build locally

```bash
poetry install
poetry run mkdocs serve
```
