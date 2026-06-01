export const DEFAULT_STRUCTURED_BLOCK_PROMPTS = {
    instructions: 'Read the directions before you begin.',
    'short-text': 'Short answer prompt',
    'long-text': 'Long answer prompt',
    'multiple-choice': 'Choose the best answer.',
    'multi-select': 'Choose all that apply.',
    select: 'Choose one option.',
    'true-false': 'Choose true or false.',
    'rating-scale': 'Rate from 1 to 5.',
    number: 'Enter a number.',
    date: 'Choose a date.',
    matching: 'Match each item to the correct answer.',
    ranking: 'Put the items in order.',
    'table-grid': 'Complete the table.',
    checklist: 'Complete the checklist.'
};

export const DEFAULT_STRUCTURED_TEMPLATES = {
    worksheet: {
        templateId: 'worksheet',
        blocks: [
            {
                id: 'worksheet_directions',
                type: 'instructions',
                prompt: 'Complete each section using class notes and today\'s instructions.',
                helperText: 'Answer in complete ideas. Use examples when they help.'
            },
            {
                id: 'worksheet_question_1',
                type: 'short-text',
                prompt: 'What is the main idea or task?',
                helperText: 'Write one clear sentence.',
                required: true
            },
            {
                id: 'worksheet_explain',
                type: 'long-text',
                prompt: 'Explain your answer or process.',
                helperText: 'Include the important steps, vocabulary, or evidence.',
                required: true
            },
            {
                id: 'worksheet_checklist',
                type: 'checklist',
                prompt: 'Before you submit',
                helperText: 'Use this as a self-check before submitting.',
                required: false,
                items: [
                    { id: 'worksheet_check_1', text: 'I answered all required prompts.' },
                    { id: 'worksheet_check_2', text: 'I checked my spelling and clarity.' },
                    { id: 'worksheet_check_3', text: 'I included details from class.' }
                ]
            }
        ]
    },
    reflection: {
        templateId: 'reflection',
        blocks: [
            {
                id: 'reflection_directions',
                type: 'instructions',
                prompt: 'Use this reflection to think about your work and learning.',
                helperText: 'Be honest and specific. Short but thoughtful answers are okay.'
            },
            {
                id: 'reflection_did',
                type: 'long-text',
                prompt: 'What did you work on today?',
                helperText: 'Describe the task or product you created.',
                required: true
            },
            {
                id: 'reflection_learned',
                type: 'long-text',
                prompt: 'What did you learn or understand better?',
                helperText: 'Use vocabulary or examples from class.',
                required: true
            },
            {
                id: 'reflection_challenge',
                type: 'long-text',
                prompt: 'What was difficult, confusing, or surprising?',
                helperText: 'Explain how you handled it or what help you still need.',
                required: false
            },
            {
                id: 'reflection_next',
                type: 'short-text',
                prompt: 'What would you improve next time?',
                helperText: 'Name one specific improvement.',
                required: true
            }
        ]
    },
    checklist: {
        templateId: 'checklist',
        blocks: [
            {
                id: 'checklist_directions',
                type: 'instructions',
                prompt: 'Use this checklist to confirm your work is ready.',
                helperText: 'Mark each item after you verify it.'
            },
            {
                id: 'checklist_main',
                type: 'checklist',
                prompt: 'Completion checklist',
                helperText: 'Use these items to check your work before submitting.',
                required: false,
                items: [
                    { id: 'checklist_item_1', text: 'I followed the activity instructions.' },
                    { id: 'checklist_item_2', text: 'My work is complete and readable.' },
                    { id: 'checklist_item_3', text: 'I checked for mistakes.' },
                    { id: 'checklist_item_4', text: 'I am ready to turn this in.' }
                ]
            },
            {
                id: 'checklist_evidence',
                type: 'short-text',
                prompt: 'Where can the teacher see your best evidence?',
                helperText: 'Point to a section, file, page, or example.',
                required: false
            },
            {
                id: 'checklist_note',
                type: 'long-text',
                prompt: 'Anything your teacher should know?',
                helperText: 'Optional note about your work, questions, or next steps.',
                required: false
            }
        ]
    }
};
