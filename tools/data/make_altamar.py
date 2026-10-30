"""Build the Altamar Hotels dataset that the six sessions follow.

Altamar Hotels is a fictional Chilean hotel group with three properties:
Santiago (business city hotel), Viña del Mar (beach) and Puerto Varas (lake
and volcano). One row is one booking. Its data answers two management
questions:
  - what nightly rate (ADR) can we charge for a booking  (regression)
  - which bookings will be cancelled                     (classification)

Both answers are deliberately nonlinear: seasons differ by hotel, lead time
has a U-shaped effect on price, long stays get discounts, and cancellations
depend on thresholds and interactions. A straight line explains part of it;
trees, random forests and gradient boosting explain much more, which is the
arc of the course.

The raw file is dirty on purpose (duplicates, inconsistent labels, impossible
values, missing values); the clean file is the raw file after `clean()`.

    python tools/data/make_altamar.py
"""
from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).resolve().parents[2] / "docs" / "datasets"
N = 6000
START, END = pd.Timestamp("2024-01-01"), pd.Timestamp("2025-12-31")

HOTELS = ["Santiago", "Viña del Mar", "Puerto Varas"]
BASE_RATE = {"Santiago": 95.0, "Viña del Mar": 85.0, "Puerto Varas": 110.0}

# Demand (how many arrivals) and price multiplier by month, per hotel.
SEASON = {
    "Santiago":     [0.80, 0.75, 1.00, 1.00, 1.00, 0.95, 0.95, 1.00, 1.10, 1.12, 1.10, 0.95],
    "Viña del Mar": [1.80, 1.70, 1.20, 0.90, 0.80, 0.75, 0.80, 0.75, 0.85, 0.90, 1.00, 1.30],
    "Puerto Varas": [1.50, 1.45, 1.05, 0.85, 0.75, 0.75, 1.35, 0.95, 0.85, 0.90, 1.00, 1.20],
}
CUSTOMER = {  # share of Business / Leisure / Group by hotel
    "Santiago": [0.55, 0.35, 0.10],
    "Viña del Mar": [0.10, 0.75, 0.15],
    "Puerto Varas": [0.05, 0.80, 0.15],
}
ROOM_MULT = {"Standard": 1.0, "Superior": 1.3, "Suite": 1.9}
CHANNEL_MULT = {"Direct": 1.0, "Online travel agency": 1.05, "Corporate": 0.88, "Travel agent": 0.85}


def generate(seed=7):
    rng = np.random.default_rng(seed)
    hotel = rng.choice(HOTELS, N, p=[0.40, 0.35, 0.25])

    # Arrival dates follow each hotel's demand curve.
    days = pd.date_range(START, END, freq="D")
    arrival = []
    for h in hotel:
        w = np.array([SEASON[h][d.month - 1] for d in days]) ** 2
        arrival.append(days[rng.choice(len(days), p=w / w.sum())])
    arrival = pd.DatetimeIndex(arrival)
    month = arrival.month.values

    customer = np.array([rng.choice(["Business", "Leisure", "Group"], p=CUSTOMER[h]) for h in hotel])
    lead = np.select(
        [customer == "Business", customer == "Leisure"],
        [rng.gamma(1.2, 9, N), rng.gamma(1.5, 32, N)],
        rng.gamma(3.0, 45, N),
    ).round().astype(int)
    nights = np.select(
        [customer == "Business", customer == "Leisure"],
        [rng.integers(1, 4, N), rng.integers(2, 9, N)],
        rng.integers(2, 5, N),
    )
    weekend = np.array([
        sum((arr + pd.Timedelta(days=k)).dayofweek >= 4 for k in range(n))  # Fri and Sat nights
        for arr, n in zip(arrival, nights)
    ])
    weekend_share = weekend / nights

    channel = np.array([
        rng.choice(["Corporate", "Direct", "Online travel agency"], p=[0.55, 0.25, 0.20]) if c == "Business"
        else rng.choice(["Travel agent", "Direct", "Online travel agency"], p=[0.70, 0.15, 0.15]) if c == "Group"
        else rng.choice(["Online travel agency", "Direct", "Travel agent"], p=[0.60, 0.32, 0.08])
        for c in customer
    ])
    room = rng.choice(list(ROOM_MULT), N, p=[0.60, 0.30, 0.10])
    adults = np.where(customer == "Business", rng.choice([1, 2], N, p=[0.8, 0.2]), rng.choice([1, 2, 3, 4], N, p=[0.15, 0.6, 0.15, 0.1]))
    children = np.where(customer == "Leisure", rng.choice([0, 1, 2, 3], N, p=[0.6, 0.2, 0.15, 0.05]), 0)
    deposit = np.where(rng.random(N) < np.where(customer == "Group", 0.45, 0.12), "Non-refundable", "No deposit")
    repeat = (rng.random(N) < np.where(customer == "Business", 0.22, 0.05)).astype(int)
    prev_cancel = rng.choice([0, 1, 2, 3], N, p=[0.90, 0.06, 0.03, 0.01])
    requests = rng.poisson(np.where(customer == "Leisure", 0.9, 0.3))
    parking = (rng.random(N) < np.where(hotel == "Santiago", 0.15, 0.45)).astype(int)
    country = rng.choice(["Chile", "Argentina", "Brazil", "United States", "Europe", "Other"], N, p=[0.58, 0.13, 0.11, 0.06, 0.08, 0.04])

    # --- nightly rate (ADR), nonlinear by construction ---
    season = np.array([SEASON[h][m - 1] for h, m in zip(hotel, month)])
    weekend_effect = np.select(
        [hotel == "Santiago", hotel == "Viña del Mar"], [-0.22, 0.18], 0.10
    ) * weekend_share
    lead_effect = np.select(
        [(customer == "Business") & (lead <= 2), lead > 90, lead > 45],
        [0.18, -0.12, -0.05],
        0.0,
    )  # last-minute premium for business travellers, early-bird discounts for everyone else
    stay_effect = np.select([nights >= 7, nights >= 5], [-0.12, -0.07], 0.0)
    peak_suite = 0.12 * ((room == "Suite") & (season > 1.4))
    adr = (
        np.vectorize(BASE_RATE.get)(hotel)
        * season
        * np.vectorize(ROOM_MULT.get)(room)
        * np.vectorize(CHANNEL_MULT.get)(channel)
        * (1 + weekend_effect + lead_effect + stay_effect + peak_suite)
        + 12 * np.maximum(adults - 2, 0)
        + 8 * children
    ) * rng.lognormal(0, 0.07, N)
    adr = adr.round(2)

    # --- cancellations: thresholds and interactions a straight line cannot draw ---
    expensive = adr > 1.5 * np.vectorize(BASE_RATE.get)(hotel)
    getaway = (hotel == "Viña del Mar") & (weekend_share == 1) & (nights <= 2) & (lead < 14)
    logit = (
        -2.0
        + 2.6 * np.exp(-(((lead - 90) / 55) ** 2))             # risk peaks around three months out
        + 1.3 * ((channel == "Online travel agency") & (lead > 45))
        + 1.6 * ((customer == "Group") & (lead > 150))
        - 1.4 * getaway                                         # last-minute weekend getaways are committed
        + 1.0 * expensive
        - 1.4 * (deposit == "Non-refundable")
        + 1.3 * (prev_cancel > 0)
        - 0.25 * requests
        - 0.8 * repeat
        - 0.3 * parking
    )
    canceled = (rng.random(N) < 1 / (1 + np.exp(-logit))).astype(int)

    df = pd.DataFrame({
        "booking_id": [f"AH-{200001 + i}" for i in range(N)],
        "hotel": hotel,
        "booking_date": (arrival - pd.to_timedelta(lead, unit="D")).strftime("%Y-%m-%d"),
        "arrival_date": arrival.strftime("%Y-%m-%d"),
        "lead_time_days": lead,
        "nights": nights,
        "weekend_nights": weekend,
        "adults": adults,
        "children": children,
        "room_type": room,
        "customer_type": customer,
        "channel": channel,
        "deposit": deposit,
        "repeat_guest": repeat,
        "previous_cancellations": prev_cancel,
        "special_requests": requests,
        "parking": parking,
        "country": country,
        "adr": adr,
        "canceled": canceled,
    })
    return dirty(df, rng)


def dirty(df, rng):
    df = df.copy()
    idx = lambda k: rng.choice(df.index, k, replace=False)

    for i in idx(300):  # labels typed differently by different systems
        if df.at[i, "channel"] == "Online travel agency":
            df.at[i, "channel"] = rng.choice(["OTA", "online travel agency", "Online Travel Agency"])
    for i in idx(250):
        h = df.at[i, "hotel"]
        df.at[i, "hotel"] = {"Viña del Mar": rng.choice(["Vina del Mar", "VIÑA DEL MAR"]), "Santiago": "SANTIAGO", "Puerto Varas": "Pto. Varas"}[h]

    df.loc[idx(12), "adr"] = 0.0                                    # complimentary rooms: not a price
    big = idx(6)
    df.loc[big, "adr"] = (df.loc[big, "adr"] * 10).round(2)         # extra zero typed
    neg = idx(10)
    df.loc[neg, "lead_time_days"] = -df.loc[neg, "lead_time_days"].clip(lower=1)  # dates swapped
    df.loc[idx(8), "adults"] = 0
    df["children"] = df["children"].astype(float)
    df.loc[idx(60), "children"] = np.nan
    df.loc[idx(180), "country"] = np.nan

    dupes = df.loc[idx(60)]
    return pd.concat([df, dupes]).sample(frac=1, random_state=11).reset_index(drop=True)


HOTEL_FIX = {"SANTIAGO": "Santiago", "Vina del Mar": "Viña del Mar", "VIÑA DEL MAR": "Viña del Mar", "Pto. Varas": "Puerto Varas"}


def clean(raw):
    """The cleaning decisions made in session 2."""
    df = raw.drop_duplicates().copy()
    df["hotel"] = df["hotel"].replace(HOTEL_FIX)
    df["channel"] = df["channel"].str.lower().replace({"ota": "online travel agency"}).str.capitalize()
    df = df[(df["adr"] > 0) & (df["adr"] < 1000)]                    # free rooms and typos are not prices
    df = df[df["lead_time_days"] >= 0]
    df = df[df["adults"] > 0]
    df["children"] = df["children"].fillna(0).astype("int64")
    df["country"] = df["country"].fillna("Unknown")
    return df.reset_index(drop=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    raw = generate()
    raw.to_csv(OUT / "altamar_bookings.csv", index=False)
    tidy = clean(raw)
    tidy.to_csv(OUT / "altamar_bookings_clean.csv", index=False)
    print(f"raw {raw.shape}, clean {tidy.shape}, cancellation rate {tidy['canceled'].mean():.1%}")
