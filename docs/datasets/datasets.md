# Datasets

To load a file in Colab or in the browser, copy its URL and read it with pandas:

```python
import pandas as pd
df = pd.read_csv("https://raw.githubusercontent.com/hizocar/mba-business-analytics-1/main/docs/datasets/altamar_bookings_clean.csv")
df.head()
```

## The sessions: Altamar Hotels

One row is one booking at one of Altamar's three hotels, with arrivals between January 2024 and December 2025. The raw file is dirty on purpose; session 2 cleans it, and sessions 3 to 6 start from the clean version.

| File | Rows | URL | Download |
|---|--:|---|:--:|
| `altamar_bookings.csv` | 6,060 | `https://raw.githubusercontent.com/hizocar/mba-business-analytics-1/main/docs/datasets/altamar_bookings.csv` | [CSV](altamar_bookings.csv) |
| `altamar_bookings_clean.csv` | 5,964 | `https://raw.githubusercontent.com/hizocar/mba-business-analytics-1/main/docs/datasets/altamar_bookings_clean.csv` | [CSV](altamar_bookings_clean.csv) |

??? info "Data dictionary: `altamar_bookings.csv`"

    | Variable | Type | Description |
    |---|---|---|
    | `booking_id` | ID | Booking identifier. Not a model feature. |
    | `hotel` | Category | `Santiago` (business), `Viña del Mar` (beach), `Puerto Varas` (lake) |
    | `booking_date` | Date | Day the booking was made |
    | `arrival_date` | Date | Day the guest arrives |
    | `lead_time_days` | Number | Days between booking and arrival |
    | `nights` | Number | Length of stay |
    | `weekend_nights` | Number | Friday and Saturday nights in the stay |
    | `adults`, `children` | Number | Guests in the room |
    | `room_type` | Category | `Standard`, `Superior`, `Suite` |
    | `customer_type` | Category | `Business`, `Leisure`, `Group` |
    | `channel` | Category | `Direct`, `Online travel agency`, `Corporate`, `Travel agent` |
    | `deposit` | Category | `No deposit`, `Non-refundable` |
    | `repeat_guest` | Yes/no | Has stayed with Altamar before |
    | `previous_cancellations` | Number | Earlier bookings this guest cancelled |
    | `special_requests` | Number | Requests made with the booking (crib, high floor…) |
    | `parking` | Yes/no | Asked for a parking space |
    | `country` | Category | Guest's country or region |
    | `adr` | Number | Average daily rate: price per night in USD. **What we predict in sessions 3, 5 and 6.** |
    | `canceled` | Yes/no | The booking was cancelled. **What we predict in sessions 4, 5 and 6.** |

## The applied case

| File | Case | Rows | URL | Download |
|---|---|--:|---|:--:|
| `employee_compensation.csv` | A · TalentCo (regression) | ~10,000 | `https://raw.githubusercontent.com/hizocar/mba-business-analytics-1/main/docs/datasets/employee_compensation.csv` | [CSV](employee_compensation.csv) |
| `loan_default.csv` | B · FinTrust Bank (classification) | ~10,000 | `https://raw.githubusercontent.com/hizocar/mba-business-analytics-1/main/docs/datasets/loan_default.csv` | [CSV](loan_default.csv) |

??? info "Data dictionary: `employee_compensation.csv`"

    | Variable | Type | Description |
    |---|---|---|
    | `Salary` | Numeric | Gross annual salary in USD. **Target variable.** |
    | `Years_Experience` | Numeric | Years of professional experience |
    | `Age` | Numeric | Age |
    | `Performance_Score` | Numeric | Most recent performance rating (1.0 to 5.0) |
    | `Education_Level` | Categorical | `Bachelor`, `Master`, `PhD` |
    | `Department` | Categorical | `Engineering`, `Sales`, `Marketing`, `HR`, `Finance` |
    | `Region` | Categorical | `North`, `South`, `East`, `West` |
    | `Job_Level` | Categorical | `Junior`, `Mid`, `Senior` |
    | `Gender` | Categorical | `Male`, `Female` |

??? info "Data dictionary: `loan_default.csv`"

    | Variable | Type | Description |
    |---|---|---|
    | `loan_id` | ID | Loan identifier. Do not use it as a model feature. |
    | `age` | Numeric | Applicant's age |
    | `annual_income` | Numeric | Gross annual income (USD) |
    | `employment_type` | Categorical | `full_time`, `part_time`, `self_employed`, `unemployed` |
    | `years_employed` | Numeric | Years at current employer |
    | `loan_amount` | Numeric | Amount requested (USD) |
    | `loan_term_months` | Numeric | Term in months (12, 24, 36, 48, 60) |
    | `interest_rate` | Numeric | Annual interest rate (%) |
    | `loan_purpose` | Categorical | `personal`, `home`, `car`, `education`, `business` |
    | `credit_score` | Numeric | Credit score (valid range: 300 to 850) |
    | `num_credit_lines` | Numeric | Active credit lines |
    | `debt_to_income_ratio` | Numeric | Debt payments / gross income (0 to 1) |
    | `has_collateral` | Binary | Loan is backed by collateral (1 = yes, 0 = no) |
    | `num_late_payments` | Numeric | Late payments in the borrower's history |
    | `region` | Categorical | `North`, `South`, `East`, `West` |
    | `default` | Binary | **Target variable.** 1 = defaulted, 0 = repaid |

