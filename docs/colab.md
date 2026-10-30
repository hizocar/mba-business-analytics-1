# Google Colab guide

[Google Colab](https://colab.research.google.com/) is a Python notebook environment that runs in your browser. You don't need to install anything, just a Google account. The sessions also run directly on this site, but the **applied case** is done in Colab, where your work is saved and shared with your team.

## 1. Open a course notebook

1. Open any session or the [case toolkit](case/Case_Toolkit.ipynb) and click **Open in Colab** at the top.
2. The notebook opens in **read-only mode**. To edit it, go to **File › Save a copy in Drive**.
3. Your copy is saved in the *Colab Notebooks* folder of your Google Drive.

## 2. Run code

| Action | How |
|---|---|
| Run the current cell and move to the next one | ++shift+enter++ |
| Run the whole notebook | **Runtime › Run all** |
| Start from scratch | **Runtime › Restart session and run all** |
| Add a code or text cell | **+ Code** and **+ Text** buttons |

!!! warning "Order matters"
    Colab remembers the variables from cells you already ran, even if you delete those cells. If something works "sometimes", restart the session and run everything from top to bottom.

## 3. Load data

The recommended way in this course is to **read the file directly from its URL**. It works the same for everyone and doesn't depend on your Drive:

```python
import pandas as pd

url = "https://raw.githubusercontent.com/hizocar/mba-business-analytics-1/main/docs/datasets/altamar_bookings_clean.csv"
df = pd.read_csv(url)
df.head()
```

The URL of each file is on the [datasets](datasets/datasets.md) page. Two other options:

=== "Upload a file"

    ```python
    from google.colab import files
    uploaded = files.upload()   # opens a file picker
    df = pd.read_csv("your_file.csv")
    ```

    The file is deleted when the Colab session ends.

=== "Read from your Google Drive"

    ```python
    from google.colab import drive
    drive.mount("/content/drive")
    df = pd.read_csv("/content/drive/MyDrive/folder/file.csv")
    ```

    Every team member would need the file at the same path, so for the case the URL is a better choice.

## 4. Libraries

Colab already includes pandas, NumPy, matplotlib, seaborn, scikit-learn, and statsmodels. If you need something else, install it in a cell:

```python
!pip install xgboost
```

## 5. Teamwork and sharing the case notebook

1. One team member opens the case toolkit in Colab, saves a copy (File › Save a copy in Drive), and shares it with the rest of the team as **Editor** (the **Share** button, top right).
2. Also share it with **hizocar@gmail.com** as **Commenter**, so the instructor can follow your progress and leave comments during the case clinics.
3. Several people can open the same notebook in Colab, but if two people edit at the same time they can overwrite each other's changes. Split the work by section and let the team know before you run everything.

## 6. Before you submit the case

- [ ] **Runtime › Restart session and run all** finishes without errors.
- [ ] The data is read from a URL, not from a path on your computer or your Drive.
- [ ] Each section has a heading and text explaining what was done and what you conclude.
- [ ] You downloaded the file with **File › Download › Download .ipynb**.
