export const SPARK_TYPE_META = {
    cool_fact: { label: 'Fact', pluralLabel: 'Facts', icon: 'lightbulb' },
    trivia: { label: 'Trivia', icon: 'circle-help' },
    good_news: { label: 'Good News', icon: 'badge-check' },
    reflection: { label: 'Reflection', icon: 'message-circle-question' },
    debate: { label: 'Debate', icon: 'messages-square' }
};

export const SPARK_VIEW_TABS = [
    { id: 'week', label: 'This Week', icon: 'calendar-days' },
    { id: 'month', label: 'This Month', icon: 'calendar-range' },
    { id: 'types', label: 'By Type', icon: 'list-filter' },
    { id: 'planning', label: 'Planning', icon: 'archive' }
];

export const SPARK_TYPE_FILTERS = [
    { id: 'all', label: 'All', icon: 'layout-grid' },
    ...Object.entries(SPARK_TYPE_META).map(([id, meta]) => ({
        id,
        label: meta.pluralLabel || meta.label,
        icon: meta.icon
    }))
];
