import assert from 'node:assert/strict';
import test from 'node:test';

const { createFeatureContext } = await import('../js/services/featureContext.js');

test('lazy feature methods collaborate without mutating the manager interface', () => {
    class Manager {
        baseValue() {
            return this.count;
        }
    }
    const manager = new Manager();
    manager.count = 1;
    const methods = Object.getOwnPropertyDescriptors({
        increment() {
            this.count += 1;
            return this.read();
        },
        read() {
            return this.baseValue();
        }
    });
    const context = createFeatureContext(manager, methods);

    assert.equal(context.increment(), 2);
    assert.equal(manager.count, 2);
    assert.equal(manager.increment, undefined);
    assert.equal(manager.read, undefined);
});
