export const TABLE_DATASETS = [
  { id: "clubs-01", title: "Minutes Spent in School Clubs", headers: ["Student ID", "Club", "Minutes"], rows: [["A01", "Art", "35"], ["A02", "Math", "50"], ["A03", "Science", "45"], ["A04", "Music", "30"]], questions: { title: "Minutes Spent in School Clubs", headers: "Club and Minutes", record: "A03, Science, 45", value: "50" } },
  { id: "books-01", title: "Books Read in April", headers: ["Student ID", "Genre", "Books"], rows: [["B01", "Adventure", "4"], ["B02", "Science", "6"], ["B03", "Mystery", "3"], ["B04", "History", "5"]], questions: { title: "Books Read in April", headers: "Genre and Books", record: "B03, Mystery, 3", value: "6" } },
  { id: "plants-01", title: "Plant Growth After Four Weeks", headers: ["Plant ID", "Location", "Height"], rows: [["P01", "Window", "18"], ["P02", "Shade", "11"], ["P03", "Garden", "24"], ["P04", "Hallway", "9"]], questions: { title: "Plant Growth After Four Weeks", headers: "Location and Height", record: "P03, Garden, 24", value: "11" } },
  { id: "recycling-01", title: "Classroom Recycling Count", headers: ["Bin ID", "Material", "Items"], rows: [["R01", "Paper", "28"], ["R02", "Plastic", "19"], ["R03", "Metal", "12"], ["R04", "Cardboard", "21"]], questions: { title: "Classroom Recycling Count", headers: "Material and Items", record: "R03, Metal, 12", value: "19" } },
  { id: "typing-01", title: "Keyboarding Practice Scores", headers: ["Student ID", "Activity", "Score"], rows: [["K01", "Home Row", "18"], ["K02", "Top Row", "22"], ["K03", "Bottom Row", "16"], ["K04", "Mixed Keys", "25"]], questions: { title: "Keyboarding Practice Scores", headers: "Activity and Score", record: "K03, Bottom Row, 16", value: "22" } },
];

export const CLEAN_DATASETS = [
  { id: "clubs-clean-01", title: "Minutes Spent in School Clubs", headers: ["Student ID", "Club", "Minutes"], sourceNote: "A02 joined Math. A03 spent 45 minutes in Science. A04 spent 30 minutes in Music and should appear only once.", initial: [["A01", "Art", "35"], ["A02", "math", "50"], ["A03", "Science", ""], ["A04", "Music", "thirty"], ["A04", "Music", "thirty"]], expected: [["A01", "Art", "35"], ["A02", "Math", "50"], ["A03", "Science", "45"], ["A04", "Music", "30"]] },
  { id: "books-clean-01", title: "Books Read in April", headers: ["Student ID", "Genre", "Books"], sourceNote: "B02 read 6 Science books. B03 read 3 Mystery books. B04 read 5 History books and should appear only once.", initial: [["B01", "Adventure", "4"], ["B02", "science", "6"], ["B03", "Mystery", ""], ["B04", "History", "five"], ["B04", "History", "five"]], expected: [["B01", "Adventure", "4"], ["B02", "Science", "6"], ["B03", "Mystery", "3"], ["B04", "History", "5"]] },
  { id: "plants-clean-01", title: "Plant Growth After Four Weeks", headers: ["Plant ID", "Location", "Height"], sourceNote: "P02 grew in Shade. P03 reached 24 cm in the Garden. P04 reached 9 cm in the Hallway and should appear only once.", initial: [["P01", "Window", "18"], ["P02", "shade", "11"], ["P03", "Garden", ""], ["P04", "Hallway", "nine"], ["P04", "Hallway", "nine"]], expected: [["P01", "Window", "18"], ["P02", "Shade", "11"], ["P03", "Garden", "24"], ["P04", "Hallway", "9"]] },
  { id: "recycling-clean-01", title: "Classroom Recycling Count", headers: ["Bin ID", "Material", "Items"], sourceNote: "R02 contained 19 Plastic items. R03 contained 12 Metal items. R04 contained 21 Cardboard items and should appear only once.", initial: [["R01", "Paper", "28"], ["R02", "plastic", "19"], ["R03", "Metal", ""], ["R04", "Cardboard", "twenty-one"], ["R04", "Cardboard", "twenty-one"]], expected: [["R01", "Paper", "28"], ["R02", "Plastic", "19"], ["R03", "Metal", "12"], ["R04", "Cardboard", "21"]] },
  { id: "typing-clean-01", title: "Keyboarding Practice Scores", headers: ["Student ID", "Activity", "Score"], sourceNote: "K02 completed Top Row with a score of 22. K03 scored 16 on Bottom Row. K04 scored 25 on Mixed Keys and should appear only once.", initial: [["K01", "Home Row", "18"], ["K02", "top row", "22"], ["K03", "Bottom Row", ""], ["K04", "Mixed Keys", "twenty-five"], ["K04", "Mixed Keys", "twenty-five"]], expected: [["K01", "Home Row", "18"], ["K02", "Top Row", "22"], ["K03", "Bottom Row", "16"], ["K04", "Mixed Keys", "25"]] },
];

export const FORMULA_DATASETS = [
  { id: "clubs-formula-01", title: "Minutes Spent in School Clubs", category: "Club", value: "Minutes", rows: [["Art", 35], ["Math", 50], ["Science", 45], ["Music", 30]] },
  { id: "books-formula-01", title: "Books Read in April", category: "Genre", value: "Books", rows: [["Adventure", 4], ["Science", 6], ["Mystery", 3], ["History", 5]] },
  { id: "plants-formula-01", title: "Plant Growth in Centimeters", category: "Location", value: "Height", rows: [["Window", 18], ["Shade", 11], ["Garden", 24], ["Hallway", 9]] },
  { id: "recycling-formula-01", title: "Classroom Recycling Count", category: "Material", value: "Items", rows: [["Paper", 28], ["Plastic", 19], ["Metal", 12], ["Cardboard", 21]] },
  { id: "typing-formula-01", title: "Keyboarding Practice Scores", category: "Activity", value: "Score", rows: [["Home Row", 18], ["Top Row", 22], ["Bottom Row", 16], ["Mixed Keys", 25]] },
];

export const CHART_TYPE_DATASETS = [
  { id: "type-01", question: "Compare the number of books in four genres.", answer: "column" },
  { id: "type-02", question: "Compare four categories with very long names.", answer: "bar" },
  { id: "type-03", question: "Show the temperature each day for one week.", answer: "line" },
  { id: "type-04", question: "Show how one class budget is divided.", answer: "pie" },
  { id: "type-05", question: "Compare recycling totals for paper, plastic, metal, and cardboard.", answer: "column" },
  { id: "type-06", question: "Show how a plant's height changed across six weeks.", answer: "line" },
];

export const INTERPRET_DATASETS = FORMULA_DATASETS.map((dataset) => {
  const values = dataset.rows.map((row) => row[1]);
  const largestIndex = values.indexOf(Math.max(...values));
  const smallest = Math.min(...values);
  return { ...dataset, largest: dataset.rows[largestIndex][0], difference: values[largestIndex] - smallest, total: values.reduce((sum, value) => sum + value, 0) };
});
