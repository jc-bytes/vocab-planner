# Club signup app: fixed scenario and template

The app lets a student choose one school club and submit the choice. It stores the selected club and then shows confirmation.

## Required screens

1. Home: explains the purpose and starts the process.
2. Choose Club: shows the choices and accepts the selection.
3. Confirmation: shows the stored club and a return action.

## Required interface elements

Start button, club dropdown, Submit button, confirmation message, Home button.

## Required value

`selected_club`: stores the club chosen in the dropdown.

## Map template

| Screen and purpose | Interface element | User event | App action | Value used or changed | Arrow destination |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

## Fixed tests

| Test | Starting screen and action | Expected result | Actual result | Pass/fail |
|---:|---|---|---|---|
| 1 | Home, tap Start | Choose Club opens | | |
| 2 | Choose Club, select Science and tap Submit | `selected_club` becomes Science; Confirmation shows Science | | |
| 3 | Confirmation, tap Home | Home opens; no unexplained dead end | | |

## Controlled make-up scenario: library request app

Use this section only when the teacher assigns the make-up.

- Screens: Home, Choose Book, Confirmation.
- Elements: Start button, book dropdown, Submit button, confirmation message, Home button.
- Stored value: `selected_book`.
- Events: tap Start → open Choose Book; select a book → update the dropdown; tap Submit → store `selected_book` and open Confirmation; tap Home → open Home.
- Tests: Home + Start → Choose Book; choose *The Wild Robot* + Submit → stored value and confirmation both show *The Wild Robot*; Confirmation + Home → Home opens.

Use the same map template and the same required counts as the main task.
