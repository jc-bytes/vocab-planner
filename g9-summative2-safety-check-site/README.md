# Grade 9 Online safety check

This standalone site is the student response tool for Daily Grade 2, Summative 2. Students complete three independent cases, review their answers, and download `G9_SafetyCheck_Firstname_Lastname.pdf` for Google Classroom. The rubric and assignment specification live in `plans/9th Grade Technology/Summatives/3rd Trimester/Daily 02 - Online safety check/`.

## Student route

1. Enter first and last name. Grade 9 is fixed.
2. Read the task and allowed reference.
3. Complete one case per page. Case 1 needs two full English sentences; Case 2 needs one full sentence.
4. Review all answers. Blank fields are identified but do not prevent a partial PDF download.
5. Download the PDF and attach it to Daily Grade 2 in Google Classroom.

Answers save in the current browser under `summative:g9-summative2-safety-check:v2`. A different browser or device does not share those answers. The printed response sheet and reference in the assessment package are the school technology failure route.

## Check locally

```sh
npm run build
npm run check
npm test
npm run preview
```

`build` refreshes `printable-fallback.html`. The site is plain static HTML, CSS, and JavaScript and uses only relative assets. The PDF uses the bundled jsPDF file and font, so it can export without a network connection after the page has loaded.

Before posting the Classroom assignment, publish this entire directory at a verified student URL. Then open that URL as a fresh student, complete a sample response, download the PDF, inspect both PDF pages, and attach the verified URL to Daily Grade 2. A local preview does not establish publication or Classroom readiness.

The site is a supervised open-reference summative. It does not score responses automatically. The teacher uses the existing 40-point rubric.

Published student route: https://jc-bytes.github.io/technology-modules/assessments/g9-t3-summative-2-online-safety/
