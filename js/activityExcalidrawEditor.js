import React, { useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
    Excalidraw,
    convertToExcalidrawElements
} from '@excalidraw/excalidraw';

const mountedRoots = new WeakMap();

function getTemplateSkeleton(templateId = 'blank-map-diagram') {
    if (templateId === 'labeled-map') {
        return [
            {
                type: 'rectangle',
                x: -300,
                y: -185,
                width: 600,
                height: 370,
                strokeWidth: 2,
                strokeColor: '#1e1e1e',
                backgroundColor: 'transparent',
                label: { text: 'Map Area', fontSize: 28 }
            },
            { type: 'text', x: -290, y: -255, text: 'Title:', fontSize: 28 },
            { type: 'text', x: -290, y: 215, text: 'Legend / Key:', fontSize: 24 },
            { type: 'rectangle', x: -290, y: 260, width: 35, height: 25, backgroundColor: '#a5d8ff' },
            { type: 'text', x: -235, y: 260, text: 'Symbol meaning', fontSize: 18 }
        ];
    }

    if (templateId === 'concept-map') {
        return [
            {
                type: 'ellipse',
                x: -95,
                y: -45,
                width: 190,
                height: 90,
                backgroundColor: '#d0ebff',
                strokeColor: '#1864ab',
                label: { text: 'Main Idea', fontSize: 24 }
            },
            {
                type: 'rectangle',
                x: -360,
                y: 135,
                width: 190,
                height: 90,
                backgroundColor: '#fff3bf',
                strokeColor: '#e67700',
                label: { text: 'Detail 1', fontSize: 22 }
            },
            {
                type: 'rectangle',
                x: -95,
                y: 165,
                width: 190,
                height: 90,
                backgroundColor: '#d3f9d8',
                strokeColor: '#2b8a3e',
                label: { text: 'Detail 2', fontSize: 22 }
            },
            {
                type: 'rectangle',
                x: 170,
                y: 135,
                width: 190,
                height: 90,
                backgroundColor: '#ffe3e3',
                strokeColor: '#c92a2a',
                label: { text: 'Detail 3', fontSize: 22 }
            },
            { type: 'arrow', x: -70, y: 50, points: [[0, 0], [-175, 85]], strokeColor: '#495057' },
            { type: 'arrow', x: 0, y: 55, points: [[0, 0], [0, 105]], strokeColor: '#495057' },
            { type: 'arrow', x: 70, y: 50, points: [[0, 0], [175, 85]], strokeColor: '#495057' }
        ];
    }

    if (templateId === 'process-diagram') {
        return [
            {
                type: 'rectangle',
                x: -365,
                y: -55,
                width: 165,
                height: 110,
                backgroundColor: '#e7f5ff',
                strokeColor: '#1971c2',
                label: { text: 'Step 1', fontSize: 24 }
            },
            {
                type: 'rectangle',
                x: -75,
                y: -55,
                width: 165,
                height: 110,
                backgroundColor: '#ebfbee',
                strokeColor: '#2f9e44',
                label: { text: 'Step 2', fontSize: 24 }
            },
            {
                type: 'rectangle',
                x: 215,
                y: -55,
                width: 165,
                height: 110,
                backgroundColor: '#fff4e6',
                strokeColor: '#f08c00',
                label: { text: 'Step 3', fontSize: 24 }
            },
            { type: 'arrow', x: -185, y: 0, points: [[0, 0], [95, 0]], strokeWidth: 2 },
            { type: 'arrow', x: 105, y: 0, points: [[0, 0], [95, 0]], strokeWidth: 2 },
            { type: 'text', x: -345, y: 105, text: 'Explain each step below the diagram.', fontSize: 20 }
        ];
    }

    return [];
}

function buildTemplateScene(templateId) {
    return {
        type: 'excalidraw',
        version: 2,
        source: 'classroom-activities',
        elements: convertToExcalidrawElements(getTemplateSkeleton(templateId), {
            regenerateIds: true
        }),
        appState: {
            viewBackgroundColor: '#ffffff',
            gridModeEnabled: false
        },
        files: {}
    };
}

function cleanAppState(appState = {}) {
    return {
        viewBackgroundColor: appState.viewBackgroundColor || '#ffffff',
        gridModeEnabled: Boolean(appState.gridModeEnabled),
        theme: appState.theme,
        zoom: appState.zoom,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY
    };
}

function normalizeScene(scene, templateId) {
    if (scene && Array.isArray(scene.elements)) {
        return {
            type: 'excalidraw',
            version: scene.version || 2,
            source: scene.source || 'classroom-activities',
            elements: scene.elements,
            appState: cleanAppState(scene.appState || {}),
            files: scene.files || {}
        };
    }

    return buildTemplateScene(templateId);
}

function ActivityExcalidraw({ initialScene, templateId, onSceneChange, onReady, viewModeEnabled = false }) {
    const latestSceneRef = useRef(normalizeScene(initialScene, templateId));
    const initialData = useMemo(() => latestSceneRef.current, []);

    const handleChange = (elements, appState, files) => {
        latestSceneRef.current = {
            type: 'excalidraw',
            version: 2,
            source: 'classroom-activities',
            elements,
            appState: cleanAppState(appState),
            files: files || {}
        };
        onSceneChange?.(latestSceneRef.current);
    };

    return React.createElement(Excalidraw, {
        initialData,
        onChange: viewModeEnabled ? undefined : handleChange,
        viewModeEnabled,
        excalidrawAPI: () => {
            onReady?.({
                getScene: () => latestSceneRef.current
            });
        },
        UIOptions: {
            canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                export: {
                    saveFileToDisk: true
                }
            }
        }
    });
}

export function mountActivityExcalidraw(container, options = {}) {
    if (!container) {
        throw new Error('A container is required to mount Excalidraw.');
    }

    const existingRoot = mountedRoots.get(container);
    if (existingRoot) {
        existingRoot.unmount();
        mountedRoots.delete(container);
    }

    let latestScene = normalizeScene(options.scene, options.templateId);
    let api = null;
    const root = createRoot(container);

    root.render(React.createElement(ActivityExcalidraw, {
        initialScene: latestScene,
        templateId: options.templateId,
        viewModeEnabled: Boolean(options.viewModeEnabled || options.readOnly),
        onSceneChange: (scene) => {
            latestScene = scene;
            options.onChange?.(scene);
        },
        onReady: (readyApi) => {
            api = readyApi;
            latestScene = api.getScene();
            options.onReady?.(api);
        }
    }));

    mountedRoots.set(container, root);

    return {
        getScene: () => api?.getScene?.() || latestScene,
        unmount: () => {
            root.unmount();
            mountedRoots.delete(container);
        }
    };
}
