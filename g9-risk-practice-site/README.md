# Formative website starter

A working example based on the revised Books practice conventions. The shared runtime handles student identity, navigation, saving, feedback, and partial PDF answer downloads. Activity authors edit the small files below.

| File | Change it when | 
| --- | --- |
| `site.js` | The activity name or saved-work scope changes. |
| `activity.css` | The visual design of every student step changes. Its rules apply only to generated sites. |
| `content.js` | The teaching example or dataset changes. The same table values appear on screen, paper, and PDF. |
| `steps/*.js` | A step's explanation, question, choices, hint, or answer field changes. |
| `lesson.js` | Steps are added, removed, or reordered. This order also builds the navigation. |
| `step-patterns.js` | A reusable step type needs a new behavior. |
| `pdf.js` | The shared mapping from a step's question and table to its PDF task changes. |
| `check-activity.mjs` | Run it to find missing setup, ordering, wording, or paper-version problems. |
| `shared/foundation-module.js` and `.css` | Identity, navigation, saving, feedback, or site styling needs a deliberate runtime change. |
| `shared/foundation-evidence.js` and `shared/student-pdf.js` | PDF report assembly or styled rendering needs a deliberate runtime change. |

The generator copies shared runtime files into a standalone site. `site.js` selects the optional `clean-step` layout, which gives each step the reference site's broad reading column, plain example, large heading, and simple Next step button. Keep student-facing task content in the step files; do not copy the runtime to customize one question.

## Create a site

From the learning-hub directory:

```sh
node scripts/create-formative-site.mjs /absolute/path/to/new-site unique-activity-slug
```

The destination must not exist. The slug creates a distinct saved-answer scope. The generated site works independently of the hub and needs no npm dependencies. The generator copies the self-contained jsPDF UMD bundle and font; do not switch it to the ES bundle unless you also bundle or copy every external dependency and verify the generated site can export offline.

In the generated directory:

```sh
npm test
npm run build
npm run check
npm run preview
```

Open the local author-preview URL printed by `npm run preview`. It shows the student activity, paper version, and three fictional student PDFs together. When `pdftoppm` is installed, the preview shows every PDF page as an image; otherwise use the full-PDF link in your browser's PDF viewer. The preview server listens only on `127.0.0.1` and stops with Ctrl+C. It creates no preview files in the site. `npm run build` regenerates `printable-fallback.html`; the student site itself is plain HTML, CSS and JavaScript. Deploy the static files through the project's approved host only when requested. Relative asset links support a GitHub Pages subdirectory. Never upload student downloads or local browser state.

## Write the lesson

1. Name one learning target and the prerequisite students need. Record them in teacher notes, together with the actual starter, submission route and planned class time.
2. Set the title in `site.js`. `main.js` sets the browser title from it.
3. Put the common dataset and any small HTML helpers in `content.js`. Start with a visible example; show unfamiliar notation before asking students to use it.
4. Edit one file in `steps/` per student action. Give each page one concrete purpose. There is no required page count.
5. Set the step order in `lesson.js`. The header's Steps menu and previous/next links use this order automatically.
6. Use a comparable new example for independent practice. For common steps, use `guidedSelect`, `choiceStep`, or `explanationStep` from `step-patterns.js`. Each takes one question and builds the screen and PDF task from it. The printable builder reads the resulting step.
7. Run `npm run build` to regenerate the paper version, then `npm run check`, `npm test`, and `npm run preview`. Inspect the empty, partly filled, and filled PDF views.

`npm run check` prints OK, REVIEW, or FIX for setup, teaching order, repeated questions, PDF content, and the paper version. FIX stops the command so an incomplete activity does not look ready. REVIEW asks you to make a teaching decision, such as whether repeated wording is intentional. The order check uses each step's `stage`: model, guided, practice, independent, or review. Keep that stage accurate when adding a custom step. These checks cannot judge whether the example teaches well or whether a class can finish on time; inspect the activity with students for that.

For example, change the `question` in `steps/guided.js` once. The labelled on-screen check, paper question, and PDF prompt and answer label update together. Keep its `id` and a form's `fieldId` stable after students begin, or plan a saved-work migration.

The example covers a table, a dropdown check, a radio selection, a written explanation, independent practice and review. All are formative and retryable. Written explanations are saved without a correctness claim. Keep required practical work in the named software; a web response does not verify the external file.

## Page patterns

- `html`: short explanation or model in `html`. A labelled `<t3-check>` provides an individual dropdown or short factual input. Include a specific `hint`, an `answer`, and an `aria-label` on its input. A `.t3-lab` paragraph provides its local identity. Keep that paragraph and label stable after students begin, or migrate its old answer key.
- `choice`: each `items` entry has a question, visible example, options, zero-based correct answer and a specific retry hint. The engine displays one question at a time.
- `form`: labelled fields for short answers or explanations. Each field displays separately. Put essential context on its own page or use a separate one-field form with its own `intro`.
- `review`: displays actual saved responses.

## Prepare the student PDF

The starter automatically exports saved identity and responses in a structured PDF. For each response-bearing section, the shared report builder creates a task card with its heading, prompt, optional visual, and answer cards. The three common step patterns generate their PDF task from the same question and table used on screen. For a custom step that needs more context, a different visual, or a deliberate answer order, add `pdf` in that step file:

```js
{
  id: 'count',
  title: 'Count the samples',
  kind: 'form',
  fields: [
    {name: 'work', label: 'Show the multiplication with units', type: 'text'},
    {name: 'total', label: 'Write the total with its unit', type: 'text'}
  ],
  pdf: {
    prompt: 'Count the dots in the four one-second groups. Record your work and total.',
    visual: {
      type: 'dot-groups',
      groups: [
        {label: '1 second', dots: 5},
        {label: '2 seconds', dots: 5},
        {label: '3 seconds', dots: 5},
        {label: '4 seconds', dots: 5}
      ]
    },
    items: [
      {type: 'calculation', label: 'Sample count',
        multiplicationSource: {kind: 'field', name: 'work'},
        totalSource: {kind: 'field', name: 'total'}}
    ]
  }
}
```

Use these supported visual forms:

- `table`: `{type:'table', caption:'...', columns:['...', '...'], rows:[['...', '...']]}`. Every row must have one value per column; use a compact student-facing source table.
- `grid`: `{type:'grid', columns:8, values:[0,1,...], palette:['#087f78','#edbd49']}`. Values are palette indexes, listed left-to-right and top-to-bottom.
- `dot-groups`: `{type:'dot-groups', groups:[{label:'1 second', dots:5}, ...]}`. The PDF draws the labelled groups and dots; include only counts students are meant to see.

PDF items are ordered exactly as authored. A `response` item uses `source:{kind:'field',name:'field-name'}`, `source:{kind:'choice',index:0}`, or `source:{kind:'inline-check',index:0}`. Choice and inline-check indexes are zero-based within that section. A `calculation` item uses `multiplicationSource` and `totalSource` with the same source shapes, so both parts of the student's work appear together. If `pdf.items` is omitted, the runtime includes the section's form fields, selected choice answers, sensor values, and inline checks automatically. An omitted response is printed as `Not entered`, not as a correct answer.

Keep the `pdf.prompt` self-contained: restate what the student was asked to do and include the relevant units or assumptions. The renderer prints saved strings as entered; it does not calculate, correct, or add units to them. Put any required units in the student-facing field directions and verify the resulting answers. Include only visuals that are part of the student-facing task; never add answer keys or teacher-only notes. This starter is retryable formative practice, not a secure summative assessment.

The shared runtime selects the structured layout for starter-generated reports. `pdf.js` maps common step data to a PDF task, while `shared/student-pdf.js` draws the styled report. Do not copy the Grade 9 assessment's custom `layout:'assessment'` renderer or hardcoded visuals into a new formative site. If a task needs a visual type not listed here, extend the shared renderer and its validation/tests first, then document the new shape here. The site generator snapshots the shared files, so previously generated sites need a deliberate runtime update.

Treat authored HTML as trusted source code. Never inject external or student text into lesson HTML. Student responses are escaped by the shared runtime.

## Preserve student work

Give each activity its own `storageKey`. Keep section IDs and field names stable when fixing spelling. If a question's meaning changes, create a new ID. For old combined fields, add `legacyFields: [{name:'old-name',label:'Original question'}]` to the original response section so exports retain earlier answers. Do not reset all student work to make a revised lesson load.

The header asks for first name, last name and typed grade. Students can continue with blanks and download at any time. The pencil returns to their current page. Browser storage is local to that browser; a storage warning means they should download before leaving.

## Verify before use

- Fresh visit: identity first, title and Download visible. Download with no answers.
- Continue with blank details, reload, and edit identity without losing the current task.
- Empty check gives a useful prompt; wrong gives a specific hint; correct says Correct. Changing the answer clears stale feedback.
- Type an unfinished explanation; navigate, reload and verify it remains.
- Download halfway through and open the actual PDF file. Confirm entered responses and unanswered markers, including dropdown answers.
- Use `npm run preview` to compare the live activity, paper version, and fictional sample PDFs. This local preview helps find missing context and layout problems; still download a PDF from the real student flow.
- Inspect the PDF from a fresh attempt, a partial attempt, and a complete attempt. Render every page and confirm task prompts, units, tables/grids/dots, answers, identity, date, page numbers, and page breaks are readable and complete.
- Check keyboard focus, labelled inputs and a narrow screen. Check storage failure with the hub's existing verification fixture when changing the runtime.
- Read the generated printable and verify it asks the same questions without revealing independent answers.
- Have a student try the lesson before claiming it fits the planned class time.

Formal summative assessments need their own review and independent question flow. Do not use this retryable answer-bearing starter as a secure assessment.

## Maintaining the template

The canonical runtime lives in `../../shared`. Sites generated by the script receive a snapshot of its required files. Existing generated sites do not update automatically. Review shared runtime fixes before applying them, and retain each site's content and saved-answer scope.

Use the `formative-website` skill with this starter for teaching and wording checks. The starter is an implementation aid, not evidence that newly written content meets the teaching rules.
