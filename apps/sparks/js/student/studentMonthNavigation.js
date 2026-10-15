import { createElement, refreshIcons } from '../main.js';

export function renderStudentMonthNavigation(container, {
    sortedMonths, selectedMonth, monthLabel, navigate, ariaLabel, showMonthStrip = sortedMonths.length > 1
}) {
    const currentIndex = sortedMonths.indexOf(selectedMonth);
    const previousMonth = currentIndex > 0 ? sortedMonths[currentIndex - 1] : null;
    const nextMonth = currentIndex >= 0 && currentIndex < sortedMonths.length - 1
        ? sortedMonths[currentIndex + 1]
        : null;
    const toolbar = createElement('nav', 'student-vocab-month-navigation month-navigation');
    toolbar.setAttribute('aria-label', ariaLabel);

    const backButton = createElement(
        'button',
        'student-vocab-month-nav-btn student-vocab-month-back month-navigation__action month-navigation__action--back'
    );
    backButton.innerHTML = '<i data-lucide="arrow-left" aria-hidden="true"></i><span>Back to Months</span>';
    backButton.type = 'button';
    backButton.addEventListener('click', () => {
        navigate(null);
    });

    const monthStrip = createElement('div', 'student-vocab-month-nav-strip');
    const previousButton = createElement(
        'button',
        'student-vocab-month-nav-btn month-navigation__action'
    );
    previousButton.innerHTML = '<i data-lucide="chevron-left" aria-hidden="true"></i><span>Previous Month</span>';
    previousButton.type = 'button';
    previousButton.disabled = !previousMonth;
    previousButton.addEventListener('click', () => {
        if (previousMonth) navigate(previousMonth);
    });

    const currentLabel = createElement('div', 'student-vocab-month-nav-current month-navigation__current');
    currentLabel.setAttribute('aria-current', 'date');
    currentLabel.appendChild(createElement(
        'span',
        null,
        monthLabel(selectedMonth)
    ));

    const nextButton = createElement(
        'button',
        'student-vocab-month-nav-btn month-navigation__action'
    );
    nextButton.innerHTML = '<span>Next Month</span><i data-lucide="chevron-right" aria-hidden="true"></i>';
    nextButton.type = 'button';
    nextButton.disabled = !nextMonth;
    nextButton.addEventListener('click', () => {
        if (nextMonth) navigate(nextMonth);
    });

    toolbar.appendChild(backButton);
    if (showMonthStrip) {
        monthStrip.append(previousButton, currentLabel, nextButton);
        toolbar.appendChild(monthStrip);
    }
    container.appendChild(toolbar);
    refreshIcons(toolbar);
}
