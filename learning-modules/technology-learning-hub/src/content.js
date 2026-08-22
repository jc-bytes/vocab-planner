export const MODULE = {
  id: "MOD-SCI-REPORT-01",
  version: "0.2.0",
  title: "Write a Scientific Report",
  subtitle: "Turn your group's investigation into a report another scientist can follow.",
  storageKey: "MOD-SCI-REPORT-01:v0.2.0:foundation",
  legacyStorageKeys: ["MOD-SCI-REPORT-01:v0.1.0:foundation"],
};

export const GROUPS = [
  { id: "start", label: "Start" },
  { id: "plan", label: "Plan the investigation" },
  { id: "research", label: "Build the investigation" },
  { id: "findings", label: "Explain the findings" },
  { id: "finish", label: "Finish the report" },
];

const banana = {
  question:
    "Can banana peel be accepted by consumers as a viable food in the human diet and contribute to reducing food waste?",
  objective:
    "To evaluate the food potential of banana peel as an ingredient in the human diet and determine its level of consumer acceptance.",
  method:
    "A banana-peel dish was prepared and tasted by 45 participants. A Likert-scale survey measured taste, texture, smell, appearance, and general acceptance.",
  result:
    "Fourteen participants answered yes, 13 answered no, and 18 answered maybe when asked whether they would consume the product if it were sold.",
};

export const REPORT_ORDER = [
  "Title",
  "Table of contents",
  "Abstract",
  "Keywords",
  "Research question",
  "Theoretical framework",
  "Background and problem statement",
  "General and specific objectives",
  "Hypothesis and variables",
  "Methodology and timeline",
  "Results",
  "Analysis and discussion",
  "Conclusions, limitations, and recommendations",
  "References",
  "Appendices",
];

export const SECTIONS = [
  {
    id: "start",
    code: "START-01",
    group: "start",
    navTitle: "Start here",
    title: "Start with the investigation, not the first page",
    eyebrow: "Your route through the report",
    minutes: 15,
    objective: "Set up one shared group document and understand how the report sections connect.",
    purpose:
      "A scientific report tells one connected story. The question leads to the method, the method produces results, and the results support the conclusion. Your group will write in Google Docs and use this module to plan, check, and revise each part.",
    includes: [
      "One shared Google Doc that every group member can edit",
      "A clear group name and a document title that identifies the project",
      "All required report headings placed in the document",
      "A plan for who drafts, checks, and revises each section",
    ],
    steps: [
      "Open a blank Google Doc or the template your teacher assigned.",
      "Add the report headings in finished-report order.",
      "Share the document only with your group and teacher.",
      "Paste the document link into the Group workspace panel in this module.",
      "Begin with the research question. Write the title and abstract near the end.",
    ],
    example: {
      label: "The report as a chain",
      text: "Question → method → data → explanation → conclusion",
      notes: [
        { tone: "good", text: "Each arrow must make sense. A conclusion cannot claim something the data never measured." },
        { tone: "note", text: "The banana-peel report measured consumer responses. It did not directly measure how much food waste was reduced." },
      ],
    },
    frames: [
      "Our group document is titled ...",
      "The section I am responsible for drafting is ...",
      "The section I will peer review is ...",
    ],
    mistakes: [
      "Giving every student a separate report file",
      "Starting the abstract before the investigation is complete",
      "Marking a section complete before another group member checks it",
    ],
    practice: {
      question: "Which section should a group usually write first?",
      options: ["Abstract", "Research question", "Table of contents"],
      answer: 1,
      feedback: "The research question sets the direction for the objectives, variables, method, and results.",
    },
    rubric: "Organization supports the work, but the final score comes from the scientific evidence written in the group report.",
  },
  {
    id: "research-question",
    code: "PLAN-01",
    group: "plan",
    navTitle: "Research question",
    title: "Ask one question your evidence can answer",
    eyebrow: "The direction of the project",
    minutes: 20,
    objective: "Write a specific, measurable, achievable, and relevant research question.",
    purpose:
      "The research question tells the reader exactly what the group wants to discover. It names what will change or be compared, what will be measured, what will be studied, and any useful limit such as place, group, or time.",
    includes: [
      "What the group wants to compare, test, describe, or understand",
      "The main variables or measurable factors",
      "The organism, material, people, or situation being studied",
      "A realistic boundary such as location, sample, or period",
    ],
    steps: [
      "Name the factor you will change or compare.",
      "Name the result you will measure.",
      "Name the object or participants being studied.",
      "Add a useful boundary.",
      "Check that data or observations can answer the question.",
    ],
    example: {
      label: "Banana-peel draft",
      text: banana.question,
      notes: [
        { tone: "good", text: "The question names consumer acceptance and the food product." },
        { tone: "revise", text: "It combines two outcomes. The study measured acceptance, but it did not measure actual waste reduction." },
        { tone: "better", text: "Better: How acceptable is a banana-peel dish to 45 volunteer tasters, based on ratings of taste, texture, smell, appearance, and willingness to consume it?" },
      ],
    },
    frames: [
      "How does [independent variable] affect [dependent variable] in [object] during [time]?",
      "Which [option] produces the greatest [measured result] under [conditions]?",
      "What is the perception of [group] about [specific issue] in [place or period]?",
    ],
    mistakes: [
      "Asking a question that can only be answered with an opinion",
      "Including several unrelated questions in one sentence",
      "Naming a result that the method cannot measure",
    ],
    practice: {
      question: "Which question is measurable and focused?",
      options: [
        "Are plants interesting?",
        "How does soil type affect the height of bean plants after 30 days?",
        "What can we learn about plants, water, light, and soil?",
      ],
      answer: 1,
      feedback: "It names the factor being compared, the measurement, the organism, and the time limit.",
    },
    rubric: "The question should be specific, focused, and answerable with collected data, evidence, or observations.",
  },
  {
    id: "problem-statement",
    code: "PLAN-02",
    group: "plan",
    navTitle: "Problem statement",
    title: "Explain the real problem behind the question",
    eyebrow: "Why the investigation matters",
    minutes: 25,
    objective: "Describe a concrete problem, what is already known, and the gap the project will investigate.",
    purpose:
      "The problem statement is not a broad topic. It explains what is happening, who or what it affects, why it deserves study, and what information is still missing.",
    includes: [
      "A specific situation or difficulty",
      "Evidence that the problem exists",
      "Consequences of leaving the problem unexamined",
      "The missing knowledge or practical need addressed by the project",
      "A direct bridge to the research question",
    ],
    steps: [
      "Describe the situation without exaggerating it.",
      "Support important facts with reliable sources.",
      "Explain the consequence or need.",
      "State what is not yet known in your context.",
      "End by narrowing the problem to your research question.",
    ],
    example: {
      label: "Banana-peel draft",
      text: "Banana peels are usually discarded even though they contain usable nutrients. The project asks whether consumers would accept a prepared banana-peel dish.",
      notes: [
        { tone: "good", text: "The draft connects food waste to a testable question about acceptance." },
        { tone: "revise", text: "Large national waste estimates need a traceable calculation and a reliable source. Do not present an estimate as a measured fact." },
      ],
    },
    frames: [
      "[Problem] affects [people, place, or system] because ...",
      "Previous information shows ..., but it does not explain ...",
      "This investigation focuses on ... because ...",
    ],
    mistakes: ["Writing a general encyclopedia entry", "Using dramatic claims without evidence", "Repeating the research question without explaining the problem"],
    practice: {
      question: "Which sentence identifies a research gap?",
      options: [
        "Plastic is everywhere.",
        "Students use many plastic bottles.",
        "The school records bottle purchases, but it has not measured how many bottles enter its waste bins each week.",
      ],
      answer: 2,
      feedback: "The sentence names what is known and the specific information still missing.",
    },
    rubric: "The problem should be clearly delimited and supported by evidence rather than broad claims.",
  },
  {
    id: "objectives",
    code: "PLAN-03",
    group: "plan",
    navTitle: "Objectives",
    title: "Turn the question into a workable plan",
    eyebrow: "One destination and a short route",
    minutes: 20,
    objective: "Write one general objective and two or three specific objectives in logical order.",
    purpose:
      "The general objective states the main result the investigation seeks. Specific objectives name the measurable steps needed to reach it.",
    includes: [
      "One general objective connected to the question",
      "Two or three specific objectives for the Grade 6 Foundation track",
      "An action verb at the beginning of every objective",
      "A logical order that matches the actual investigation",
    ],
    steps: [
      "Turn the research question into a statement beginning with To.",
      "List the major actions the group must complete.",
      "Remove activities that do not produce evidence.",
      "Order the specific objectives from preparation to analysis.",
    ],
    example: {
      label: "Banana-peel draft",
      text: banana.objective,
      notes: [
        { tone: "good", text: "Evaluate and determine name observable actions." },
        { tone: "revise", text: "The broader sustainability purpose belongs in the problem and application discussion unless waste reduction is measured." },
      ],
    },
    frames: ["To compare ...", "To measure ...", "To record ...", "To analyze ...", "To determine ..."],
    mistakes: ["Starting with vague verbs such as learn or understand", "Listing classroom tasks such as make a poster", "Adding an objective that never appears in the method or results"],
    practice: {
      question: "Which objective is observable?",
      options: ["To understand filters", "To learn about water", "To compare the turbidity reduction produced by three filter materials"],
      answer: 2,
      feedback: "Compare names an action and turbidity reduction names the evidence.",
    },
    rubric: "Objectives must connect to the question and match evidence the group can produce.",
  },
  {
    id: "hypothesis-variables",
    code: "PLAN-04",
    group: "plan",
    navTitle: "Hypothesis & variables",
    title: "Predict a measurable relationship",
    eyebrow: "What may happen and what must stay controlled",
    minutes: 25,
    objective: "Write a testable hypothesis and identify independent, dependent, and controlled variables when the project requires them.",
    purpose:
      "A hypothesis is a reasoned prediction, not a guess. Variables describe what changes, what is measured, and what stays constant. Descriptive projects may not need a hypothesis, but they still need clearly defined measures.",
    includes: [
      "A prediction connected to prior knowledge",
      "The independent variable or factor changed",
      "The dependent variable or result measured",
      "Controlled variables kept the same",
      "A fair way to test or refute the prediction",
    ],
    steps: [
      "Name the independent and dependent variables.",
      "Predict the direction of the relationship.",
      "Give a scientific reason for the prediction.",
      "List conditions that must remain constant.",
      "Confirm that the method can test the statement.",
    ],
    example: {
      label: "Banana-peel draft",
      text: "If banana peel is included in a prepared dish, then consumers will accept it and food waste will be reduced.",
      notes: [
        { tone: "revise", text: "The acceptance threshold is undefined, controlled conditions are missing, and waste reduction was not measured." },
        { tone: "better", text: "Better: If banana peel is prepared as a seasoned shredded dish, then more than half of the 45 tasters will rate its overall acceptance positively." },
      ],
    },
    frames: [
      "If [independent variable] changes, then [dependent variable] will ... because ...",
      "The independent variable is ...",
      "The dependent variable will be measured by ...",
      "The group will keep ... constant.",
    ],
    mistakes: ["Predicting an outcome that is not measured", "Calling every material a variable", "Forgetting controlled conditions or a comparison group"],
    practice: {
      question: "In a plant-light experiment, what is the dependent variable?",
      options: ["Hours of light", "Plant height after 21 days", "Type of pot used for every plant"],
      answer: 1,
      feedback: "Plant height is the measured response. Hours of light is changed, and pot type is controlled.",
    },
    rubric: "Variables should be identified and justified. The hypothesis must be coherent with the question and prior knowledge.",
  },
  {
    id: "theoretical-framework",
    code: "RESEARCH-01",
    group: "research",
    navTitle: "Theoretical framework",
    title: "Use sources to build the scientific explanation",
    eyebrow: "What the group needs to know before testing",
    minutes: 35,
    objective: "Combine reliable sources, key definitions, and relevant scientific ideas without copying.",
    purpose:
      "The theoretical framework explains the knowledge needed to understand the question, choose the method, and interpret the results. It is a connected explanation, not a list of internet facts.",
    includes: [
      "Reliable scientific or institutional sources",
      "Definitions of the concepts and variables used in the project",
      "Relevant findings from earlier studies",
      "Connections between sources and the group's decisions",
      "In-text citations for borrowed facts and ideas",
    ],
    steps: [
      "Divide the topic into two to four useful subtopics.",
      "Record the author, date, title, and link for every source.",
      "Take notes without copying full sentences.",
      "Write one idea in the group's own words, then cite it.",
      "Explain how that idea affects the question, hypothesis, or method.",
    ],
    example: {
      label: "Banana-peel source use",
      text: "The sample report discusses nutrients, preparation methods, consumer acceptance, and food waste.",
      notes: [
        { tone: "good", text: "These subtopics can help readers understand the product and the reason for testing acceptance." },
        { tone: "revise", text: "Wikipedia and recipe websites are weak support for nutritional or scientific claims. Prefer research articles and institutional publications." },
      ],
    },
    frames: ["According to [author or organization] ([year]), ...", "This finding matters to the project because ...", "Both sources indicate ..., while ..."],
    mistakes: ["Copying and changing only a few words", "Using a search engine as the source", "Including facts that never help explain the project"],
    practice: {
      question: "Which source is the strongest starting point for a nutritional claim?",
      options: ["An anonymous recipe blog", "A peer-reviewed food science article", "A social media caption"],
      answer: 1,
      feedback: "A peer-reviewed article identifies its authors, methods, evidence, and publication context.",
    },
    rubric: "Sources should be reliable and relevant, and the writing should show that the group understood and connected them.",
  },
  {
    id: "methodology",
    code: "RESEARCH-02",
    group: "research",
    navTitle: "Methodology",
    title: "Write instructions another group could repeat",
    eyebrow: "The test of a fair investigation",
    minutes: 35,
    objective: "Describe participants or samples, materials, procedure, measurements, repetitions, data recording, analysis, safety, and timeline.",
    purpose:
      "The methodology lets another researcher judge the design and repeat it. Specific quantities and conditions matter more than a polished summary.",
    includes: [
      "Study type, participants, sample, or materials",
      "Quantities, tools, and measurement units",
      "Numbered procedure in the order completed",
      "Sample size, repetitions, and controls",
      "How data were recorded and analyzed",
      "Safety, consent, and ethical protections",
      "A realistic activity timeline",
    ],
    steps: [
      "Name exactly what or who was studied.",
      "List materials with quantities and units.",
      "Write the procedure in numbered steps.",
      "Explain how variables were measured and controlled.",
      "Describe the data table, calculation, or graph planned.",
      "Add safety and consent procedures before collecting data.",
    ],
    example: {
      label: "Banana-peel method",
      text: banana.method,
      notes: [
        { tone: "good", text: "The sample size, rating categories, and general analysis method are identified." },
        { tone: "revise", text: "The recipe quantities, participant selection, controlled serving conditions, and repetitions need more detail." },
        { tone: "safety", text: "Do not conceal a food ingredient from tasters. Follow school rules for consent, allergies, hygiene, and ingredient disclosure." },
      ],
    },
    frames: ["The sample consisted of ...", "The group measured ... using ...", "Each trial was repeated ... times.", "To reduce variation, ... was kept constant."],
    mistakes: ["Writing instructions too general to repeat", "Choosing the analysis after seeing the desired result", "Collecting data from people without teacher-approved consent and safety procedures"],
    practice: {
      question: "Which detail makes a method more reproducible?",
      options: ["The water was heated.", "Exactly 100 mL of water was heated to 60 °C.", "The water was prepared carefully."],
      answer: 1,
      feedback: "A quantity, unit, and temperature let another group repeat the condition.",
    },
    rubric: "The procedure must be reproducible, the sample and repetitions appropriate, and sources of bias or variation addressed.",
  },
  {
    id: "results",
    code: "FIND-01",
    group: "findings",
    navTitle: "Results",
    title: "Show what the group observed and measured",
    eyebrow: "Evidence before explanation",
    minutes: 30,
    objective: "Present complete, accurate data in text, tables, figures, or images without explaining why the results occurred.",
    purpose:
      "The results section answers, What did the investigation find? It reports evidence objectively. Explanations belong in the discussion.",
    includes: [
      "The number of observations, trials, or participants",
      "Relevant raw or summarized data",
      "Units, labels, and calculation methods",
      "Numbered tables and figures with descriptive titles",
      "A short text description of the most important patterns",
    ],
    steps: [
      "Check raw data against the logbook.",
      "Calculate totals, averages, or percentages consistently.",
      "Choose a table or graph that matches the data type.",
      "Label axes, units, categories, and sample size.",
      "Describe the pattern without explaining its cause.",
    ],
    example: {
      label: "Banana-peel result",
      text: banana.result,
      notes: [
        { tone: "good", text: "The counts add to 45 and clearly separate yes, no, and maybe." },
        { tone: "revise", text: "The abstract reports 71.11% as willing to consume the product. That combines yes and maybe without saying so and does not match the table's yes value of 31.11%." },
        { tone: "better", text: "Better: 31.11% answered yes, 40.00% answered maybe, and 28.89% answered no." },
      ],
    },
    frames: ["A total of ...", "The highest measured value was ...", "Figure 2 shows ...", "Across ... trials, the mean was ..."],
    mistakes: ["Hiding inconvenient data", "Using a pie chart for values that are not parts of one whole", "Explaining causes before the discussion section"],
    practice: {
      question: "Which sentence belongs in Results?",
      options: ["The filter worked better because charcoal absorbs impurities.", "Filter B reduced measured turbidity by 72% across three trials.", "The experiment was successful."],
      answer: 1,
      feedback: "It reports a measured result with a value and number of trials, without explaining the cause.",
    },
    rubric: "Data should be systematic, sufficient, clearly organized, and presented with appropriate mathematical or statistical treatment.",
  },
  {
    id: "analysis-discussion",
    code: "FIND-02",
    group: "findings",
    navTitle: "Analysis & discussion",
    title: "Explain what the evidence means",
    eyebrow: "Where the scientific reasoning happens",
    minutes: 35,
    objective: "Interpret patterns, compare them with the hypothesis and sources, and explain useful applications without exceeding the evidence.",
    purpose:
      "The discussion answers why the results may have occurred, how they compare with prior knowledge, whether they support the hypothesis, and what they may mean in practice.",
    includes: [
      "An explanation of the main pattern",
      "A comparison with the hypothesis",
      "Connections to scientific ideas and previous studies",
      "Unexpected results or conflicting observations",
      "A practical application supported by the evidence",
    ],
    steps: [
      "Begin with the most important result.",
      "Explain a possible scientific reason.",
      "Connect the explanation to a cited source.",
      "State whether the evidence supports or does not support the hypothesis.",
      "Separate demonstrated findings from future possibilities.",
    ],
    example: {
      label: "Banana-peel interpretation",
      text: "The product showed mixed but generally open consumer responses, with 31.11% yes and 40% maybe.",
      notes: [
        { tone: "good", text: "This wording keeps maybe separate from confirmed willingness." },
        { tone: "revise", text: "The data suggest possible acceptance. They do not prove a market exists or that national food waste would fall." },
      ],
    },
    frames: ["The pattern may be explained by ...", "This result supports the hypothesis because ...", "Unlike [source], the present investigation found ...", "The data suggest ..., but they do not demonstrate ..."],
    mistakes: ["Repeating every number without interpreting it", "Claiming that correlation proves cause", "Using the word proves when the design only suggests a relationship"],
    practice: {
      question: "Which statement stays within the evidence?",
      options: ["This small survey proves everyone will buy the product.", "The survey suggests some consumer interest, but a larger sample is needed.", "The product will solve food waste."],
      answer: 1,
      feedback: "The statement interprets the result while acknowledging what the sample cannot establish.",
    },
    rubric: "Analysis should use an appropriate method, connect evidence to the question, and avoid claims the design cannot support.",
  },
  {
    id: "conclusions",
    code: "FIND-03",
    group: "findings",
    navTitle: "Conclusions",
    title: "Answer the research question directly",
    eyebrow: "The final claim supported by the investigation",
    minutes: 25,
    objective: "Write a concise answer to the research question using the strongest evidence and a fair statement about the hypothesis.",
    purpose:
      "The conclusion states what the group learned. It should answer the question, report the most important supporting evidence, and avoid introducing new facts.",
    includes: ["A direct answer to the research question", "One or two key results", "Whether the objectives were reached", "Whether the hypothesis was supported, not supported, or only partly supported"],
    steps: ["Restate the question as an answer.", "Select only the strongest evidence.", "Compare the outcome with the hypothesis.", "Remove new sources, new data, and recommendations.", "Check every number against the Results section."],
    example: {
      label: "Corrected banana-peel conclusion",
      text: "The tasting suggests limited but possible consumer acceptance of the banana-peel dish. Fourteen of 45 participants answered yes and 18 answered maybe about future consumption. The evidence partly supports the hypothesis, but it does not demonstrate actual waste reduction.",
      notes: [
        { tone: "good", text: "The claim matches the categories and does not turn maybe into yes." },
        { tone: "good", text: "The unmeasured environmental claim is clearly separated from the finding." },
      ],
    },
    frames: ["The investigation found that ...", "This conclusion is supported by ...", "The evidence [supported / partly supported / did not support] the hypothesis because ..."],
    mistakes: ["Beginning with To prove", "Copying the entire results section", "Adding a new claim that no measurement supports"],
    practice: {
      question: "What must appear in a conclusion?",
      options: ["A new source", "A direct answer supported by the results", "The complete step-by-step procedure"],
      answer: 1,
      feedback: "The conclusion answers the question using evidence already presented and discussed.",
    },
    rubric: "Conclusions should respond directly to the question and be consistent with the hypothesis, objectives, and measured results.",
  },
  {
    id: "limitations",
    code: "FIND-04",
    group: "findings",
    navTitle: "Limitations & recommendations",
    title: "Be honest about what the study could not establish",
    eyebrow: "Scientific honesty and the next useful test",
    minutes: 20,
    objective: "Identify factors that affect confidence in the results and propose specific improvements or follow-up investigations.",
    purpose:
      "A limitation is a real boundary in the design, sample, measurement, or conditions. A recommendation should respond to that limitation or a new question raised by the evidence.",
    includes: ["At least one specific limitation", "How each limitation may affect the result", "A practical improvement", "A follow-up question or next test when useful"],
    steps: ["Name the design boundary.", "Explain its possible effect.", "Propose a change that addresses it.", "Keep recommendations possible and connected to the project."],
    example: {
      label: "Banana-peel limitations",
      text: "The sample included only 45 volunteers and did not represent consumers across Panama. The study also tested one recipe and did not measure nutritional content in a laboratory.",
      notes: [
        { tone: "better", text: "A useful next study could compare two recipes with a larger, planned sample and clearly defined acceptance criteria." },
      ],
    },
    frames: ["A limitation was ...", "This may have affected ... because ...", "A future investigation should ... so that ..."],
    mistakes: ["Writing that the project had no limitations", "Blaming group members", "Recommending a larger study without explaining what it would improve"],
    practice: {
      question: "Which is a useful limitation statement?",
      options: ["The project was difficult.", "Only one trial was completed, so the result may reflect random variation.", "More research is needed."],
      answer: 1,
      feedback: "It names the limitation and explains how it affects confidence in the result.",
    },
    rubric: "The report should recognize limitations honestly and propose concrete actions to improve or continue the investigation.",
  },
  {
    id: "title",
    code: "FINISH-01",
    group: "finish",
    navTitle: "Title",
    title: "Name the investigation precisely",
    eyebrow: "Write this after the project is clear",
    minutes: 15,
    objective: "Write a concise, specific title that names the topic, variables, and useful context.",
    purpose: "A title helps a reader understand the investigation quickly. It should be specific without becoming a full abstract.",
    includes: ["The main topic or comparison", "Important variables", "The object of study", "Place or context when it helps", "Approximately 10 to 20 words when practical"],
    steps: ["Underline the most important words in the question.", "Remove filler such as A study about.", "Keep the variables and object.", "Add the context only if it improves precision.", "Read it aloud and shorten repeated ideas."],
    example: {
      label: "Banana-peel title",
      text: "Consumer acceptance of a banana-peel dish as a possible food-waste reduction strategy",
      notes: [
        { tone: "good", text: "The title names the product and measured outcome." },
        { tone: "note", text: "Possible keeps the environmental application from sounding like a measured result." },
      ],
    },
    frames: ["Effect of [variable] on [measurement] in [object]", "Comparison of [options] for [purpose]", "Consumer perception of [specific product or issue]"],
    mistakes: ["Project of Science", "A title longer than the question and objective combined", "Using an exciting claim that the data do not support"],
    practice: {
      question: "Which title is most specific?",
      options: ["Plants", "A project about music", "Effect of three music genres on bean-plant height over 30 days"],
      answer: 2,
      feedback: "It names the comparison, measurement, organism, and time.",
    },
    rubric: "The title should be clear and consistent with the question and actual investigation.",
  },
  {
    id: "abstract-keywords",
    code: "FINISH-02",
    group: "finish",
    navTitle: "Abstract & keywords",
    title: "Compress the whole report into 250 words",
    eyebrow: "Write this after every main section is finished",
    minutes: 30,
    objective: "Write a self-contained abstract covering the problem, objective, method, main results, and conclusion, followed by three to five keywords.",
    purpose: "The abstract lets a reader understand the investigation without reading the full report. Every claim and number must match the body.",
    includes: ["Problem or question", "Objective", "Brief method", "Main numerical result", "Conclusion", "No more than 250 words", "Three to five specific keywords", "No citations, tables, or figures"],
    steps: ["Copy one key idea from each completed section into notes.", "Write the method and results in past tense.", "Keep only the most important number or pattern.", "Check the conclusion against the Results section.", "Count the words and add three to five keywords."],
    example: {
      label: "Banana-peel abstract audit",
      text: "The source abstract reports that 71.11% would consume the product if sold.",
      notes: [
        { tone: "revise", text: "The results table records 31.11% yes and 40% maybe. The abstract must preserve those separate response categories." },
        { tone: "better", text: "Better: Of 45 tasters, 31.11% answered yes, 40.00% maybe, and 28.89% no when asked about future consumption." },
      ],
    },
    frames: ["This investigation examined ...", "The objective was to ...", "The group ...", "Results showed ...", "It was concluded that ...", "Keywords: ..."],
    mistakes: ["Writing the abstract before results exist", "Adding background that takes half the word count", "Changing or rounding numbers inconsistently"],
    practice: {
      question: "What should not appear in an abstract?",
      options: ["The main result", "A reference citation and full data table", "The conclusion"],
      answer: 1,
      feedback: "The abstract contains a concise account of the study, without citations, tables, or figures.",
    },
    rubric: "The abstract should accurately represent the report. The Writing Lab checks the 250-word limit and keyword count.",
  },
  {
    id: "table-of-contents",
    code: "FINISH-03",
    group: "finish",
    navTitle: "Table of contents",
    title: "Build a map of the finished report",
    eyebrow: "Use heading styles and update this last",
    minutes: 15,
    objective: "Create an accurate automatic table of contents using Google Docs heading styles.",
    purpose: "The table of contents lists the report sections and their page numbers. It should update when headings or page breaks change.",
    includes: ["All main sections", "Important subsections", "Accurate page numbers", "Consistent wording between headings and the table"],
    steps: ["Apply Heading 1 to main section titles.", "Apply Heading 2 to important subsections.", "Place the cursor after the title page.", "Insert a table of contents in Google Docs.", "Refresh it after the final edits."],
    example: {
      label: "A common source-report issue",
      text: "If Results data appear inside a section titled Analysis, the table of contents hides an important distinction.",
      notes: [{ tone: "better", text: "Use separate Results and Analysis and discussion headings, even when they appear on consecutive pages." }],
    },
    frames: ["Results", "Analysis and discussion", "Conclusions", "Limitations and recommendations"],
    mistakes: ["Typing page numbers by hand too early", "Using bold text instead of heading styles", "Leaving Results out as a separate section"],
    practice: {
      question: "When should the group update the table of contents?",
      options: ["Before writing", "After final headings and page order are set", "Only after printing"],
      answer: 1,
      feedback: "Final edits change page numbers. Update the automatic table after those changes.",
    },
    rubric: "The table of contents supports organization and helps the evaluator locate evidence efficiently.",
  },
  {
    id: "references",
    code: "FINISH-04",
    group: "finish",
    navTitle: "References",
    title: "Give readers a path back to every source",
    eyebrow: "Citations and references must match",
    minutes: 25,
    objective: "Create a consistent APA-style reference list and match every entry with an in-text citation.",
    purpose: "References credit the people and organizations whose ideas, data, or images the group used. A search engine is not a source. The webpage, article, book, or report is the source.",
    includes: ["Author or responsible organization", "Publication date when available", "Title", "Publication or website name when required", "Working DOI or URL", "Alphabetical order", "A matching in-text citation"],
    steps: ["Open each source and identify its real author or organization.", "Record the publication date and exact title.", "Create the reference using one consistent APA 7 pattern.", "Arrange entries alphabetically.", "Search the report for each citation and each reference author."],
    example: {
      label: "APA 7 webpage example",
      text: "Food and Agriculture Organization of the United Nations. (2020, September 29). Food loss and waste must be reduced for greater food security and environmental sustainability. https://www.fao.org/newsroom/detail/Food-loss-and-waste-must-be-reduced-for-greater-food-security-and-environmental-sustainability/en",
      notes: [
        { tone: "note", text: "Use the organization as author only when it is responsible for the content." },
        { tone: "good", text: "The title, date, organization, and URL can all be checked on the original FAO webpage." },
        { tone: "revise", text: "Google, Chrome, and Safari help locate sources. They are not the sources themselves." },
      ],
    },
    frames: ["Author, A. A. (Year). Title of article. Journal, volume(issue), pages. DOI", "Organization. (Year). Title of webpage. URL"],
    mistakes: ["Listing sources never cited", "Citing a search-results page", "Using different formats for every entry"],
    practice: {
      question: "What should happen if a reference is listed but never cited in the report?",
      options: ["Leave it to make the list look longer", "Cite it where its idea is used or remove it", "Move it to the title page"],
      answer: 1,
      feedback: "The reference list and in-text citations should match each other.",
    },
    rubric: "Sources should be reliable, cited where used, and listed in a consistent, recognizable format.",
  },
  {
    id: "appendices",
    code: "FINISH-05",
    group: "finish",
    navTitle: "Appendices",
    title: "Keep useful supporting evidence available",
    eyebrow: "Extra evidence, not a storage room",
    minutes: 15,
    objective: "Organize supporting materials into numbered, titled appendices and refer to them in the report.",
    purpose: "Appendices contain useful material that would interrupt the main explanation, such as survey forms, raw data, detailed calculations, additional photographs, or design plans.",
    includes: ["A letter or number for each appendix", "A descriptive title", "Readable supporting material", "A mention in the report body", "No essential result hidden only in an appendix"],
    steps: ["Decide whether the material helps verify or repeat the work.", "Remove duplicates and decorative extras.", "Group related items.", "Number and title each appendix.", "Mention each appendix in the relevant report section."],
    example: {
      label: "Useful appendix set",
      text: "Appendix A. Tasting survey; Appendix B. Anonymous response table; Appendix C. Recipe and preparation record",
      notes: [{ tone: "safety", text: "Do not publish names, emails, signatures, medical details, or other identifying participant information." }],
    },
    frames: ["The complete instrument appears in Appendix A.", "Raw measurements are provided in Appendix B."],
    mistakes: ["Moving an important result out of the Results section", "Adding unlabeled screenshots", "Including personal information from participants"],
    practice: {
      question: "Which item belongs in an appendix?",
      options: ["The direct answer to the research question", "The blank survey instrument used to collect responses", "The report title"],
      answer: 1,
      feedback: "The survey supports the method and can be included without interrupting the main report.",
    },
    rubric: "Appendices should be organized, useful, and safe to share.",
  },
  {
    id: "final-review",
    code: "REVIEW-01",
    group: "finish",
    navTitle: "Final review",
    title: "Run the evidence check before submitting",
    eyebrow: "Correct beats impressive",
    minutes: 35,
    objective: "Check alignment, numbers, source use, format, group contribution, and submission readiness.",
    purpose: "A final review is more than proofreading. The group must confirm that every conclusion follows from the results and every requirement appears in the document.",
    includes: [
      "Letter size, Arial 12, 1.5 spacing, required margins, and page numbers",
      "Clear impersonal scientific writing",
      "Matching numbers across Results, Abstract, and Conclusions",
      "Matching citations and references",
      "Complete tables, figures, captions, units, and appendices",
      "Evidence that every group member reviewed the report",
    ],
    steps: [
      "Run the Writing Lab on one section at a time.",
      "Compare every result named in the abstract and conclusion with the original table.",
      "Use Suggesting mode for peer review in Google Docs.",
      "Read the report aloud to catch missing words and awkward sentences.",
      "Refresh the table of contents and confirm sharing permissions.",
      "Export the module progress record and submit the Google Doc as instructed.",
    ],
    example: {
      label: "The banana-peel consistency check",
      text: "Table: 31.11% yes. Abstract: 71.11% would consume. Conclusion: more than 50% would buy.",
      notes: [
        { tone: "revise", text: "These statements do not mean the same thing. The group must correct the abstract and conclusion before submission." },
        { tone: "good", text: "A strong final review catches contradictions, even when the grammar is correct." },
      ],
    },
    frames: ["The claim in section ... is supported by Table ...", "The number ... matches across ...", "Our group revised ... after peer feedback."],
    mistakes: ["Running only a spell-check", "Accepting every automated grammar suggestion", "Treating an AI-detector score as proof of authorship"],
    practice: {
      question: "Which is the strongest evidence that a group wrote and understood its report?",
      options: ["An AI-detector percentage", "Drafts, sources, version history, peer comments, and the group's explanation", "Perfect grammar"],
      answer: 1,
      feedback: "Process evidence and student explanation show how the report developed. Detector percentages can be wrong.",
    },
    rubric: "The report should be internally consistent, complete, readable, and supported by the group's documented scientific process.",
  },
];

export const REPORT_OUTLINE = `SCIENTIFIC REPORT
Project title:
Group name:
Group members:

TABLE OF CONTENTS

ABSTRACT
[Write this last. Maximum 250 words: problem, objective, method, main results, conclusion.]

KEYWORDS
[Add 3 to 5 specific terms.]

1. RESEARCH QUESTION

2. THEORETICAL FRAMEWORK

3. BACKGROUND AND PROBLEM STATEMENT

4. GENERAL OBJECTIVE

5. SPECIFIC OBJECTIVES

6. HYPOTHESIS AND VARIABLES

7. METHODOLOGY
7.1 Materials, participants, or sample
7.2 Procedure
7.3 Measurement and data recording
7.4 Data analysis
7.5 Safety and ethics
7.6 Timeline

8. RESULTS

9. ANALYSIS AND DISCUSSION

10. CONCLUSIONS

11. LIMITATIONS AND RECOMMENDATIONS

12. REFERENCES

13. APPENDICES`;

export const RUBRIC_AREAS = [
  { label: "Research question and problem statement", points: 10 },
  { label: "Theoretical framework and reliable sources", points: 15 },
  { label: "Objectives, hypothesis, and variables", points: 15 },
  { label: "Reproducible methodology, data plan, ethics, and safety", points: 20 },
  { label: "Clear, accurate results and visuals", points: 15 },
  { label: "Analysis, conclusions, limitations, and recommendations", points: 20 },
  { label: "Organization, abstract, references, and required format", points: 5 },
];
