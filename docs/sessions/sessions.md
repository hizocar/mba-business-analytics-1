# The six sessions

All six sessions follow **Altamar Hotels**: a business hotel in Santiago, a beach hotel in Viña del Mar, and a lake hotel in Puerto Varas. Its management team asks two questions. *What rate can we charge for a room-night?* and *which bookings will cancel?* Each week takes the analysis one step further, and each step is the one your team then takes with its applied case.

Every week has two parts: the **live session**, which you follow in class, and the **lab**, a self-paced notebook that ends with the week's graded quiz.

<div class="hz-thread" markdown>

<div class="hz-thread-step" markdown>
<span class="hz-step">Week 1</span>
### Reading data like a manager
What a notebook is, the Python you need to read code, and a first look at 6,060 bookings. [Live session](Session_1_Live.ipynb) · [Lab: First look at Altamar](Session_1_Lab.ipynb)

<span class="hz-thread-adv">→ Case: choose your dataset and write the business question</span>
</div>

<div class="hz-thread-step" markdown>
<span class="hz-step">Week 2</span>
### From raw data to insight
Finding and fixing problems in the data, summary tables, and charts that answer a question. Every hotel has its own seasons. [Live session](Session_2_Live.ipynb) · [Lab: Seasons by hotel](Session_2_Lab.ipynb)

<span class="hz-thread-adv">→ Case: clean your data and find three patterns</span>
</div>

<div class="hz-thread-step" markdown>
<span class="hz-step">Week 3</span>
### Pricing with regression
A model for the nightly rate: train and test, coefficients a revenue manager can read, and errors in dollars. [Live session](Session_3_Live.ipynb) · [Lab: A rate simulator](Session_3_Lab.ipynb)

<span class="hz-thread-adv">→ Case: your first model</span>
</div>

<div class="hz-thread-step" markdown>
<span class="hz-step">Week 4</span>
### Predicting cancellations
From a yes/no question to a probability; the confusion matrix; and how many rooms to oversell, decided with money. [Live session](Session_4_Live.ipynb) · [Lab: An overbooking policy](Session_4_Lab.ipynb)

<span class="hz-thread-adv">→ Case: the right metric for your decision</span>
</div>

<div class="hz-thread-step" markdown>
<span class="hz-step">Week 5</span>
### When lines are not enough
Seasons, early-bird discounts, and last-minute premiums bend the line. Curves, decision trees, overfitting, and cross-validation. [Live session](Session_5_Live.ipynb) · [Lab: Tuning a tree](Session_5_Lab.ipynb)

<span class="hz-thread-adv">→ Case: a nonlinear model</span>
</div>

<div class="hz-thread-step" markdown>
<span class="hz-step">Week 6</span>
### Forests, boosting, and decisions
Many trees are better than one. What drives each prediction, which model to trust, and how to present the recommendation. [Live session](Session_6_Live.ipynb) · [Lab: Choosing and explaining a model](Session_6_Lab.ipynb)

<span class="hz-thread-adv">→ Case: final comparison and executive presentation</span>
</div>

</div>

## The story in numbers

Each week's model starts from the last week's result and has to beat it on the same test bookings. This is where Altamar ends up:

| | Week 3–4 · a straight line | Week 5 · a tuned tree | Week 6 · random forest | Week 6 · gradient boosting |
|---|:--:|:--:|:--:|:--:|
| **Nightly rate:** typical error per night | USD 20.5 | USD 13.3 | USD 10.3 | USD 8.4 |
| **Nightly rate:** share of the variation explained (R²) | 0.74 | 0.89 | 0.94 | 0.96 |
| **Cancellations:** how well risky bookings are ranked (AUC) | 0.74 | 0.75 | 0.77 | 0.77 |
| **Overbooking:** cost of cancellations on the test bookings (doing nothing: USD 201,200) | USD 153,100 | — | USD 136,100 | USD 139,200 |

The pattern is the lesson of the module: better inputs and nonlinear models cut the pricing error by more than half, while cancellations are harder to predict and gain less. Knowing where a model helps, and by how much, is what you present to management in week 6.

## How to use a session

Every page runs **in your browser**. Press ▶ next to a cell (or ++shift+enter++) to run it; cells share their results, so run them from top to bottom. Cells marked **✏️** have settings you are invited to change: change them, run again, and see what happens. The interactive simulators respond when you drag, slide, or press play, and the *Check yourself* questions tell you right away whether you got the idea.

!!! tip "Browser or Colab?"
    The browser is the quickest way to follow a session: nothing to install, and the first run takes a few seconds while Python downloads. For the **applied case**, use Google Colab, where your notebook is saved and shared with your team ([Colab guide](../colab.md)). Every session has an **Open in Colab** button at the top.

The data is in [Datasets](../datasets/datasets.md).
