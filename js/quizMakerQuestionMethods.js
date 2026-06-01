class QuizMakerQuestionMethods {
    addQuestions(type, count, basePoints = 1, options = {}) {
        const newQuestions = this.generateQuestions(type, count, basePoints, options);
        this.questions = [...this.questions, ...newQuestions];
    }

    generateQuestions(type, count, basePoints = 1, options = {}) {
        const words = this.vocabSet.words.filter(w => w.word && w.definition);
        if (words.length === 0) {
            alert('No valid words in this vocabulary set.');
            return [];
        }

        const generated = [];
        for (let i = 0; i < count; i++) {
            const w = words[Math.floor(Math.random() * words.length)];
            const id = Date.now() + Math.random().toString(36).substr(2, 9);

            let q = { id, type, points: basePoints };

            if (type === 'mc') {
                const distractors = this.getDistractors(w, words, 3);
                const options = this.shuffle([w.word, ...distractors]);
                q.prompt = w.definition;
                q.options = options;
                q.answer = w.word;
                q.points = basePoints;
            } else if (type === 'sata') {
                const choiceCount = Math.max(3, parseInt(options.choices) || 5);
                const correctCount = Math.min(choiceCount - 1, Math.max(2, parseInt(options.correct) || 2));
                const correctWords = this.shuffle(words).slice(0, correctCount);
                const wrongWords = this.shuffle(words.filter(item => !correctWords.includes(item))).slice(0, choiceCount - correctCount);
                const correctOptions = correctWords.map(item => ({
                    text: `${item.word} means "${item.definition}".`,
                    correct: true
                }));
                const wrongOptions = wrongWords.map(item => {
                    const wrongDefinition = this.shuffle(words.filter(other => other.word !== item.word))[0]?.definition || item.definition;
                    return {
                        text: `${item.word} means "${wrongDefinition}".`,
                        correct: false
                    };
                });
                q.prompt = 'Select all correct term-definition matches.';
                q.options = this.shuffle([...correctOptions, ...wrongOptions]);
                q.answer = q.options.filter(option => option.correct).map(option => option.text);
                q.points = basePoints;
            } else if (type === 'tf') {
                const isTrue = Math.random() > 0.5;
                let text = `${w.word} means "${w.definition}".`;
                if (!isTrue) {
                    const wrong = this.getDistractors(w, words, 1)[0];
                    text = `${w.word} means "${wrong}".`; // wrong is just the word string from getDistractors? No, need definition.
                    // Fix getDistractors to return objects or handle this better.
                    // Let's redo getDistractors to return word objects.
                    const wrongWord = words.find(o => o.word !== w.word) || w;
                    text = `${w.word} means "${wrongWord.definition}".`;
                }
                q.prompt = text;
                q.answer = isTrue ? 'True' : 'False';
                q.points = basePoints;
            } else if (type === 'matching') {
                // Matching Section logic
                // We create ONE question object that contains multiple pairs
                // But the loop above creates 'count' questions. 
                // We should break the loop if type is matching and just create one section with 'count' pairs.

                const pairs = [];
                // Get 'count' random words
                const selectedWords = this.shuffle(words).slice(0, count);
                selectedWords.forEach(w => {
                    pairs.push({ term: w.word, def: w.definition });
                });

                q = {
                    id,
                    type: 'matching_section',
                    points: (basePoints || 1) * pairs.length,
                    pairs: pairs,
                    prompt: 'Match the terms with their definitions.'
                };

                generated.push(q);
                break; // Exit loop since we created the section
            } else if (type === 'short') {
                q.prompt = `Describe the meaning of "${w.word}" in your own words.`;
                q.answer = w.definition;
                q.points = basePoints;
            } else if (type === 'synonym') {
                // Synonym/Antonym MC question
                const isSynonym = Math.random() > 0.5;
                const distractors = this.getDistractors(w, words, 3);
                const options = this.shuffle([w.word, ...distractors]);
                q.prompt = isSynonym ?
                    `Which word is a SYNONYM (similar meaning) of "${w.definition}"?` :
                    `Which word is an ANTONYM (opposite meaning) of "${w.definition}"?`;
                q.options = options;
                q.answer = w.word;
                q.type = 'synonym'; // Render like MC but keep its own section
                q.points = basePoints;
            } else if (type === 'wordsearch') {
                // Word Search - create one puzzle with multiple words
                const selectedWords = this.shuffle(words).slice(0, Math.min(count || 15, 15, words.length));
                const wordList = selectedWords.map(w => w.word);
                const puzzleData = this.generateWordSearchGrid(wordList, 15);

                q = {
                    id,
                    type: 'wordsearch',
                    points: basePoints,
                    grid: puzzleData.grid,
                    words: puzzleData.words,
                    prompt: 'Find all the vocabulary words in the word search below.'
                };
                generated.push(q);
                break; // Only create one word search
            } else if (type === 'crossword') {
                // Crossword - create one puzzle with multiple words
                const selectedWords = this.shuffle(words).slice(0, Math.min(count || 10, 10, words.length));
                const wordData = selectedWords.map(w => ({ word: w.word, clue: w.definition }));
                const puzzleData = this.generateCrosswordLayout(wordData, 15);

                q = {
                    id,
                    type: 'crossword',
                    points: basePoints,
                    grid: puzzleData.grid,
                    clues: puzzleData.clues,
                    prompt: 'Complete the crossword puzzle using the clues provided.'
                };
                generated.push(q);
                break; // Only create one crossword
            }

            generated.push(q);
        }
        return generated;
    }

    generateWordSearchGrid(words, size = 15) {
        // Create empty grid
        const grid = Array(size).fill(null).map(() => Array(size).fill(''));
        const placedWords = [];

        // Directions: right, down, diagonal-down-right
        const directions = [
            { dx: 1, dy: 0 },   // horizontal
            { dx: 0, dy: 1 },   // vertical
            { dx: 1, dy: 1 },   // diagonal
        ];

        // Try to place each word
        words.forEach(word => {
            const upperWord = word.toUpperCase();
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < 50) {
                attempts++;
                const dir = directions[Math.floor(Math.random() * directions.length)];
                const startX = Math.floor(Math.random() * size);
                const startY = Math.floor(Math.random() * size);

                // Check if word fits
                let fits = true;
                for (let i = 0; i < upperWord.length; i++) {
                    const x = startX + dir.dx * i;
                    const y = startY + dir.dy * i;

                    if (x >= size || y >= size || (grid[y][x] !== '' && grid[y][x] !== upperWord[i])) {
                        fits = false;
                        break;
                    }
                }

                // Place word if it fits
                if (fits) {
                    for (let i = 0; i < upperWord.length; i++) {
                        const x = startX + dir.dx * i;
                        const y = startY + dir.dy * i;
                        grid[y][x] = upperWord[i];
                    }
                    placedWords.push(word);
                    placed = true;
                }
            }
        });

        // Fill empty cells with random letters
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (grid[y][x] === '') {
                    grid[y][x] = letters[Math.floor(Math.random() * letters.length)];
                }
            }
        }

        return { grid, words: placedWords };
    }

    generateCrosswordLayout(wordData, size = 15) {
        // Simple crossword layout - place words in a grid pattern
        const grid = Array(size).fill(null).map(() => Array(size).fill(null));
        const clues = { across: [], down: [] };
        let clueNumber = 1;

        // Sort words by length (longest first)
        const sorted = wordData.sort((a, b) => b.word.length - a.word.length);

        // Place first word horizontally in the middle
        if (sorted.length > 0) {
            const firstWord = sorted[0].word.toUpperCase();
            const startY = Math.floor(size / 2);
            const startX = Math.floor((size - firstWord.length) / 2);

            for (let i = 0; i < firstWord.length; i++) {
                grid[startY][startX + i] = { letter: firstWord[i], number: i === 0 ? clueNumber : null };
            }
            clues.across.push({ number: clueNumber, clue: sorted[0].clue, answer: sorted[0].word });
            clueNumber++;
        }

        // Try to place remaining words
        for (let i = 1; i < Math.min(sorted.length, 8); i++) {
            const word = sorted[i].word.toUpperCase();
            const isHorizontal = i % 2 === 0;
            let placed = false;

            // Try to find intersection point
            for (let y = 1; y < size - 1 && !placed; y++) {
                for (let x = 1; x < size - 1 && !placed; x++) {
                    if (grid[y][x] && grid[y][x].letter) {
                        const letter = grid[y][x].letter;
                        const letterIndex = word.indexOf(letter);

                        if (letterIndex >= 0) {
                            // Try to place word through this intersection
                            let fits = true;
                            const positions = [];

                            if (isHorizontal) {
                                const startX = x - letterIndex;
                                if (startX >= 0 && startX + word.length <= size) {
                                    for (let j = 0; j < word.length; j++) {
                                        const cell = grid[y][startX + j];
                                        if (cell && cell.letter && cell.letter !== word[j]) {
                                            fits = false;
                                            break;
                                        }
                                        positions.push({ x: startX + j, y });
                                    }

                                    if (fits) {
                                        positions.forEach((pos, idx) => {
                                            grid[pos.y][pos.x] = {
                                                letter: word[idx],
                                                number: idx === 0 ? clueNumber : (grid[pos.y][pos.x]?.number || null)
                                            };
                                        });
                                        clues.across.push({ number: clueNumber, clue: sorted[i].clue, answer: sorted[i].word });
                                        clueNumber++;
                                        placed = true;
                                    }
                                }
                            } else {
                                const startY = y - letterIndex;
                                if (startY >= 0 && startY + word.length <= size) {
                                    for (let j = 0; j < word.length; j++) {
                                        const cell = grid[startY + j][x];
                                        if (cell && cell.letter && cell.letter !== word[j]) {
                                            fits = false;
                                            break;
                                        }
                                        positions.push({ x, y: startY + j });
                                    }

                                    if (fits) {
                                        positions.forEach((pos, idx) => {
                                            grid[pos.y][pos.x] = {
                                                letter: word[idx],
                                                number: idx === 0 ? clueNumber : (grid[pos.y][pos.x]?.number || null)
                                            };
                                        });
                                        clues.down.push({ number: clueNumber, clue: sorted[i].clue, answer: sorted[i].word });
                                        clueNumber++;
                                        placed = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return { grid, clues };
    }

    getDistractors(targetWord, allWords, count) {
        const others = allWords.filter(w => w.word !== targetWord.word);
        const shuffled = this.shuffle(others);
        return shuffled.slice(0, count).map(w => w.word);
    }

    shuffle(array) {
        return array.sort(() => Math.random() - 0.5);
    }
}

export function installQuizMakerQuestionMethods(QuizMaker) {
    for (const name of Object.getOwnPropertyNames(QuizMakerQuestionMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            QuizMaker.prototype,
            name,
            Object.getOwnPropertyDescriptor(QuizMakerQuestionMethods.prototype, name)
        );
    }
}
