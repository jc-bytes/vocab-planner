import AxeBuilder from '@axe-core/playwright';

function formatViolation(violation) {
    const nodes = violation.nodes.slice(0, 5).map(node => {
        const targets = node.target.map(target => (
            Array.isArray(target) ? target.join(' ') : String(target)
        )).join(', ');
        return `  - ${targets}: ${node.failureSummary || node.html}`;
    });

    const omittedCount = violation.nodes.length - nodes.length;
    if (omittedCount > 0) {
        nodes.push(`  - ${omittedCount} more affected node${omittedCount === 1 ? '' : 's'}`);
    }

    return [
        `[${violation.impact || 'unknown'}] ${violation.id}: ${violation.help}`,
        `  ${violation.helpUrl}`,
        ...nodes
    ].join('\n');
}

function createAudit(page, options) {
    let audit = new AxeBuilder({ page });

    for (const selector of options.include || []) {
        audit = audit.include(selector);
    }
    for (const selector of options.exclude || []) {
        audit = audit.exclude(selector);
    }

    return audit;
}

async function analyzeStablePage(page, options) {
    try {
        return await createAudit(page, options).analyze();
    } catch (error) {
        if (!String(error?.message).includes('Execution context was destroyed')) throw error;

        await page.waitForLoadState('domcontentloaded');
        return createAudit(page, options).analyze();
    }
}

export async function assertNoAccessibilityViolations(page, label, options = {}) {
    const result = await analyzeStablePage(page, options);
    if (result.violations.length === 0) return;

    const report = result.violations.map(formatViolation).join('\n\n');
    throw new Error(`${label} has ${result.violations.length} accessibility violation${result.violations.length === 1 ? '' : 's'}:\n${report}`);
}
