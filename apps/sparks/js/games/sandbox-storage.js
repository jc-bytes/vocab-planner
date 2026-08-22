(function installSandboxedGameStorage() {
    const prefix = 'vocab-game-storage:';
    let config = {};

    try {
        if (window.name.startsWith(prefix)) {
            config = JSON.parse(window.name.slice(prefix.length));
        }
    } catch (_error) {
        config = {};
    }
    window.name = '';

    const createStorage = (initialEntries = [], persist = false) => {
        const values = new Map(Array.isArray(initialEntries) ? initialEntries : []);
        const notify = () => {
            if (!persist || !config.gameId || !config.channel) return;
            window.parent.postMessage({
                type: 'vocab-game-storage',
                gameId: config.gameId,
                channel: config.channel,
                entries: Array.from(values.entries())
            }, '*');
        };

        const storage = {
            get length() {
                return values.size;
            },
            clear() {
                values.clear();
                notify();
            },
            getItem(key) {
                const normalizedKey = String(key);
                return values.has(normalizedKey) ? values.get(normalizedKey) : null;
            },
            getObject(key) {
                const value = this.getItem(key);
                return value === null ? null : JSON.parse(value);
            },
            key(index) {
                return Array.from(values.keys())[Number(index)] ?? null;
            },
            removeItem(key) {
                values.delete(String(key));
                notify();
            },
            removeObject(key) {
                this.removeItem(key);
            },
            setItem(key, value) {
                values.set(String(key), String(value));
                notify();
            },
            setObject(key, value) {
                this.setItem(key, JSON.stringify(value));
            }
        };

        return new Proxy(storage, {
            deleteProperty(target, property) {
                if (Reflect.has(target, property)) return false;
                target.removeItem(property);
                return true;
            },
            get(target, property, receiver) {
                if (typeof property !== 'string' || Reflect.has(target, property)) {
                    return Reflect.get(target, property, receiver);
                }
                return target.getItem(property);
            },
            set(target, property, value, receiver) {
                if (typeof property !== 'string' || Reflect.has(target, property)) {
                    return Reflect.set(target, property, value, receiver);
                }
                target.setItem(property, value);
                return true;
            }
        });
    };

    Object.defineProperty(window, 'localStorage', {
        configurable: false,
        enumerable: true,
        value: createStorage(config.entries, true)
    });
    Object.defineProperty(window, 'sessionStorage', {
        configurable: false,
        enumerable: true,
        value: createStorage([], false)
    });

    const NativeImage = window.Image;
    window.Image = function SandboxedGameImage(width, height) {
        const image = new NativeImage(width, height);
        image.crossOrigin = 'anonymous';
        return image;
    };
    window.Image.prototype = NativeImage.prototype;

    try {
        void navigator.serviceWorker;
    } catch (_error) {
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: false,
            value: {
                register() {
                    return Promise.reject(new Error('Service workers are disabled inside sandboxed games.'));
                }
            }
        });
    }
})();
