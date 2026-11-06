const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const practiceUrl = 'https://jc-bytes.github.io/technology-modules/practice/g9-risk-practice/';

export const referenceHtml = `
  <section class="safety-start">
    <h2>Your task</h2>
    <ol>
      <li>Read each of the three situations.</li>
      <li>Write one clue, name the danger, and choose one safe step for each.</li>
      <li>Write two complete sentences for Case 1 and one complete sentence for Case 2.</li>
      <li>Review your answers, download your PDF, and attach it to Daily Grade 2 in Google Classroom.</li>
    </ol>
    <p>You have 25 minutes of independent work. You may use the reference below and keep <a href="${practiceUrl}" target="_blank" rel="noopener">Compare online risks practice</a> open to review your earlier work. Your answers save in this browser as you type.</p>
  </section>
  <section class="safety-reference">
    <h2>Reference you may use</h2>
    <dl>
      <div><dt>Phishing</dt><dd>A fake message or page tries to collect private information.</dd></div>
      <div><dt>Ransomware</dt><dd>Harmful software locks files and demands payment.</dd></div>
      <div><dt>Brute-force attack</dt><dd>Repeated password guesses try to open an account.</dd></div>
    </dl>
    <p>A <strong>protection</strong> reduces the chance of harm or helps you recover. Think about a trusted way to check a message, a separate backup, a long unique password, or an extra sign-in check. If school files or accounts may be affected, tell the teacher or school IT.</p>
  </section>`;

export const compactReferenceHtml = `<details class="case-reference"><summary>Open the allowed reference</summary>
  <p><strong>Phishing:</strong> a fake message or page seeks private information. <strong>Ransomware:</strong> harmful software locks files and demands payment. <strong>Brute-force attack:</strong> repeated password guesses try to open an account.</p>
  <p>Choose a step that addresses the danger: check through a trusted route, report a problem, use a separate backup, strengthen a password, or add another sign-in check.</p>
  <p>You may also review <a href="${practiceUrl}" target="_blank" rel="noopener">Compare online risks practice</a>.</p>
</details>`;

export const caseHtml = ({number, facts}) => `<section class="assessment-case" aria-label="Case ${number} story">
  <h2>What happened</h2><p>${escape(facts)}</p>
</section>`;

// Kept for the shared activity checker; this assessment does not use tables.
export const tableHtml = () => '';
