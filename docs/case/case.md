# Applied case

!!! abstract "70% of the grade"
    In teams of **3 or 4**, you apply what the module covers to a business dataset and present your recommendations to a management audience. You do not program from scratch: the [case toolkit](Case_Toolkit.ipynb) is a notebook that runs the whole analysis once you tell it which data to use and what to predict. Your work is the business thinking: choosing, checking, interpreting, and recommending.

## Choose a case

=== "A · TalentCo (regression)"

    **What drives an employee's salary?**

    TalentCo suspects its pay structure is inconsistent: people with similar experience earn different amounts depending on their department, region, or education. The people team wants to know which variables explain salary and whether there are gaps to fix.

    - **Data:** [`employee_compensation.csv`](../datasets/datasets.md), about 10,000 employees.
    - **What to predict:** `Salary` (annual salary in USD).
    - **Questions for your presentation:** which factors explain salary, how large each effect is, and where the pay structure looks inconsistent.

=== "B · FinTrust Bank (classification)"

    **Which applicants will not repay their loan?**

    FinTrust's default rate keeps rising. The risk team wants to flag applicants likely to default before approving them.

    - **Data:** [`loan_default.csv`](../datasets/datasets.md), about 10,000 loans.
    - **What to predict:** `default` (1 = defaulted).
    - **Questions for your presentation:** which applicants are riskier and why, what threshold to use given the cost of approving a defaulter versus rejecting a good customer, and what the bank gains with the model.

=== "C · Your own data"

    A dataset from your own organization or a public source, if it has at least **1,000 rows**, a clear number or yes/no outcome to predict, and a business question a model can answer. Send a one-paragraph proposal to the instructor by the end of week 2. **Do not use confidential data** unless it is anonymized and you are allowed to share it.

The data is dirty on purpose, as real data is. Finding and fixing its problems is part of the work.

## How it moves forward

The case advances with the sessions. The last part of each live session is a **case clinic** where teams take the same step with their own data.

| Week | Step | What you should have |
|:--:|---|---|
| 1 | The question | Team formed, case chosen, the business question in two lines, and who would use the answer. |
| 2 | Clean data and patterns | The data cleaned with the toolkit, a table of the problems you fixed, and three patterns with a chart each. |
| 3 | A first model | A linear model (regression or logistic) evaluated on test data. |
| 4 | The right metric | The metric that matters for your decision, and, for classification, a threshold justified with costs. |
| 5 | A nonlinear model | A decision tree, its depth chosen with cross-validation. |
| 6 | Comparison and recommendation | Random forest and gradient boosting compared with your earlier models; the drivers of the best model; three recommendations. |

## What you hand in

**One week after session 6**, each team submits:

1. **The notebook**: the case toolkit run on your data, with your settings, and your written interpretation under each section. It must run from top to bottom without errors.
2. **An executive presentation**: at most **10 slides**, built with the pyramid principle (the recommendation first, then the arguments, then the evidence). Write it for a manager who will not read the notebook.

## Rubric

| Criterion | Weight | Full marks |
|---|:--:|---|
| **Business framing** | 15% | The question is clear, it matters to someone, and the outcome to predict fits it. |
| **Data and patterns** | 20% | Problems in the data are found and fixed with reasons. Charts are relevant and each one says something. |
| **Models and evaluation** | 25% | At least one linear and two nonlinear models, compared on the same test data with a metric that fits the decision. No information from the test set leaks into training. |
| **Interpretation and recommendations** | 25% | You explain what drives the predictions and how. Three recommendations follow from the results and are concrete enough to act on. Limitations are acknowledged. |
| **Communication** | 15% | The presentation leads with the answer, uses few and clear charts, and could be understood by someone who did not take the course. |
