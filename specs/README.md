# Specs

One folder per feature: `specs/<feature-name>/` with three files, written in this order.

1. `intent.md` — Simon writes what and why in his own words (2-5 lines, any language).
2. `spec.md` — requirements and testable acceptance criteria. Simon approves before any plan.
3. `plan.md` — small tasks in order. Simon approves before any code.

Start a feature by copying the files from `specs/_templates/`.

A fix on a single line may skip all three. Anything that changes how the game plays may not.

Keep the folder after the feature is merged: it is the record of why the code looks the way it does.
