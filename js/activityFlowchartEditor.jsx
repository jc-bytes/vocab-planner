import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
    Background,
    Controls,
    Handle,
    MarkerType,
    MiniMap,
    Position,
    ReactFlow,
    ReactFlowProvider,
    addEdge,
    applyEdgeChanges,
    applyNodeChanges
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
    FLOWCHART_NODE_TYPE_COLORS,
    FLOWCHART_NODE_TYPE_LABELS,
    FLOWCHART_NODE_TYPES,
    createFlowchartEdge,
    createFlowchartNode,
    normalizeFlowchartResponse,
    normalizeFlowchartTemplate
} from './activityFlowchartAlgorithm.js';

const mountedRoots = new WeakMap();

function toFlowNode(node, readOnly = false) {
    return {
        id: node.id,
        type: 'flowchartNode',
        position: node.position,
        draggable: !readOnly,
        data: {
            nodeKind: node.type,
            label: node.label,
            description: node.description,
            readOnly
        }
    };
}

function toFlowEdge(edge, readOnly = false) {
    return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'smoothstep',
        animated: false,
        selectable: !readOnly,
        markerEnd: { type: MarkerType.ArrowClosed }
    };
}

function fromFlowNode(node) {
    return {
        id: node.id,
        type: FLOWCHART_NODE_TYPES.includes(node.data?.nodeKind) ? node.data.nodeKind : 'process',
        label: String(node.data?.label || '').trim() || FLOWCHART_NODE_TYPE_LABELS[node.data?.nodeKind] || 'Step',
        description: String(node.data?.description || '').trim(),
        position: {
            x: Math.round(Number(node.position?.x) || 0),
            y: Math.round(Number(node.position?.y) || 0)
        }
    };
}

function fromFlowEdge(edge) {
    return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: String(edge.label || '').trim()
    };
}

function FlowchartNode({ data }) {
    const nodeKind = FLOWCHART_NODE_TYPES.includes(data.nodeKind) ? data.nodeKind : 'process';
    const color = FLOWCHART_NODE_TYPE_COLORS[nodeKind] || FLOWCHART_NODE_TYPE_COLORS.process;
    return (
        <div className={`flowchart-node-card flowchart-node-${nodeKind}`} style={{ '--flowchart-node-color': color }}>
            <Handle type="target" position={Position.Top} isConnectable={!data.readOnly} />
            <div className="flowchart-node-type">{FLOWCHART_NODE_TYPE_LABELS[nodeKind] || 'Step'}</div>
            <strong>{data.label || FLOWCHART_NODE_TYPE_LABELS[nodeKind] || 'Step'}</strong>
            {data.description ? <small>{data.description}</small> : null}
            <Handle type="source" position={Position.Bottom} isConnectable={!data.readOnly} />
        </div>
    );
}

const nodeTypes = { flowchartNode: FlowchartNode };

function buildResponse(template, nodes, edges, responseExtras = {}) {
    return normalizeFlowchartResponse(template, {
        ...responseExtras,
        nodes: nodes.map(fromFlowNode),
        edges: edges.map(fromFlowEdge)
    });
}

function nextBranchLabel(sourceNode, edges) {
    if (sourceNode?.data?.nodeKind !== 'condition') return '';
    const existingLabels = edges
        .filter(edge => edge.source === sourceNode.id)
        .map(edge => String(edge.label || '').trim().toLowerCase());
    if (!existingLabels.includes('yes')) return 'Yes';
    if (!existingLabels.includes('no')) return 'No';
    return '';
}

function FlowchartEditor({ template, response, readOnly = false, onChange, onReady }) {
    const normalizedTemplate = useMemo(() => normalizeFlowchartTemplate(template), [template]);
    const normalizedResponse = useMemo(
        () => normalizeFlowchartResponse(normalizedTemplate, response),
        [normalizedTemplate, response]
    );
    const responseExtrasRef = useRef({
        checklist: normalizedResponse.checklist,
        reflections: normalizedResponse.reflections,
        updatedAt: normalizedResponse.updatedAt
    });
    const [nodes, setNodes] = useState(() => normalizedResponse.nodes.map(node => toFlowNode(node, readOnly)));
    const [edges, setEdges] = useState(() => normalizedResponse.edges.map(edge => toFlowEdge(edge, readOnly)));
    const [selectedNodeId, setSelectedNodeId] = useState('');
    const [selectedEdgeId, setSelectedEdgeId] = useState('');
    const [connector, setConnector] = useState({ source: '', target: '', label: '' });
    const latestRef = useRef(normalizedResponse);

    const emitChange = useCallback((nextNodes, nextEdges) => {
        const nextResponse = buildResponse(normalizedTemplate, nextNodes, nextEdges, responseExtrasRef.current);
        latestRef.current = nextResponse;
        onChange?.(nextResponse);
    }, [normalizedTemplate, onChange]);

    useEffect(() => {
        onReady?.({
            getResponse: () => latestRef.current
        });
    }, [onReady]);

    const updateNodes = useCallback((updater) => {
        setNodes(current => {
            const next = typeof updater === 'function' ? updater(current) : updater;
            emitChange(next, edges);
            return next;
        });
    }, [edges, emitChange]);

    const updateEdges = useCallback((updater) => {
        setEdges(current => {
            const next = typeof updater === 'function' ? updater(current) : updater;
            emitChange(nodes, next);
            return next;
        });
    }, [emitChange, nodes]);

    const onNodesChange = useCallback((changes) => {
        if (readOnly) return;
        setNodes(current => {
            const next = applyNodeChanges(changes, current);
            emitChange(next, edges);
            return next;
        });
    }, [edges, emitChange, readOnly]);

    const onEdgesChange = useCallback((changes) => {
        if (readOnly) return;
        setEdges(current => {
            const next = applyEdgeChanges(changes, current);
            emitChange(nodes, next);
            return next;
        });
    }, [emitChange, nodes, readOnly]);

    const onConnect = useCallback((connection) => {
        if (readOnly) return;
        const sourceNode = nodes.find(node => node.id === connection.source);
        const label = nextBranchLabel(sourceNode, edges);
        const edge = {
            ...connection,
            id: `edge_${connection.source}_${connection.target}_${Date.now()}`,
            label,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed }
        };
        setEdges(current => {
            const next = addEdge(edge, current);
            emitChange(nodes, next);
            return next;
        });
    }, [edges, emitChange, nodes, readOnly]);

    const addNode = (nodeKind) => {
        if (readOnly) return;
        const normalized = createFlowchartNode({
            type: nodeKind,
            label: FLOWCHART_NODE_TYPE_LABELS[nodeKind] || 'Step',
            position: {
                x: 120 + (nodes.length % 3) * 220,
                y: 80 + Math.floor(nodes.length / 3) * 140
            }
        }, nodes.length, normalizedTemplate.allowedNodeTypes);
        updateNodes([...nodes, toFlowNode(normalized, readOnly)]);
        setSelectedNodeId(normalized.id);
        setSelectedEdgeId('');
    };

    const deleteSelectedNode = () => {
        if (!selectedNodeId || readOnly) return;
        const nextNodes = nodes.filter(node => node.id !== selectedNodeId);
        const nextEdges = edges.filter(edge => edge.source !== selectedNodeId && edge.target !== selectedNodeId);
        setNodes(nextNodes);
        setEdges(nextEdges);
        emitChange(nextNodes, nextEdges);
        setSelectedNodeId('');
    };

    const deleteSelectedEdge = () => {
        if (!selectedEdgeId || readOnly) return;
        updateEdges(edges.filter(edge => edge.id !== selectedEdgeId));
        setSelectedEdgeId('');
    };

    const updateSelectedNode = (patch) => {
        if (!selectedNodeId || readOnly) return;
        updateNodes(current => current.map(node => {
            if (node.id !== selectedNodeId) return node;
            const nodeKind = patch.nodeKind || node.data.nodeKind;
            return {
                ...node,
                data: {
                    ...node.data,
                    ...patch,
                    nodeKind,
                    label: patch.label ?? node.data.label
                }
            };
        }));
    };

    const updateSelectedEdge = (label) => {
        if (!selectedEdgeId || readOnly) return;
        updateEdges(current => current.map(edge => (
            edge.id === selectedEdgeId ? { ...edge, label } : edge
        )));
    };

    const addConnector = () => {
        if (readOnly || !connector.source || !connector.target || connector.source === connector.target) return;
        const edge = createFlowchartEdge({
            source: connector.source,
            target: connector.target,
            label: connector.label
        }, nodes.map(fromFlowNode), edges.length);
        updateEdges([...edges, toFlowEdge(edge, readOnly)]);
        setConnector({ source: connector.source, target: connector.target, label: '' });
    };

    const selectedNode = nodes.find(node => node.id === selectedNodeId);
    const selectedEdge = edges.find(edge => edge.id === selectedEdgeId);
    const nodeOptions = nodes.map(node => (
        <option key={node.id} value={node.id}>{node.data.label || node.id}</option>
    ));

    return (
        <div className={`flowchart-editor-shell ${readOnly ? 'is-readonly' : ''}`}>
            {!readOnly ? (
                <div className="flowchart-editor-toolbar">
                    <div>
                        <strong>{nodes.length} nodes</strong>
                        <span>{edges.length} connectors</span>
                    </div>
                    <div className="flowchart-node-button-row">
                        {normalizedTemplate.allowedNodeTypes.map(type => (
                            <button type="button" className="btn secondary-btn" key={type} onClick={() => addNode(type)}>
                                {FLOWCHART_NODE_TYPE_LABELS[type] || type}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="flowchart-editor-grid">
                <div className="flowchart-editor-canvas" data-flowchart-editor-canvas>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        fitView
                        nodesDraggable={!readOnly}
                        nodesConnectable={!readOnly}
                        elementsSelectable={!readOnly}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={(_, node) => {
                            if (readOnly) return;
                            setSelectedNodeId(node.id);
                            setSelectedEdgeId('');
                        }}
                        onEdgeClick={(_, edge) => {
                            if (readOnly) return;
                            setSelectedEdgeId(edge.id);
                            setSelectedNodeId('');
                        }}
                    >
                        <Background />
                        <MiniMap pannable zoomable />
                        <Controls showInteractive={!readOnly} />
                    </ReactFlow>
                </div>

                {!readOnly ? (
                    <aside className="flowchart-editor-panel">
                        {selectedNode ? (
                            <section>
                                <h4>Edit Node</h4>
                                <label>
                                    <span>Type</span>
                                    <select value={selectedNode.data.nodeKind} onChange={event => updateSelectedNode({ nodeKind: event.target.value })}>
                                        {normalizedTemplate.allowedNodeTypes.map(type => (
                                            <option key={type} value={type}>{FLOWCHART_NODE_TYPE_LABELS[type] || type}</option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    <span>Label</span>
                                    <input type="text" value={selectedNode.data.label || ''} onChange={event => updateSelectedNode({ label: event.target.value })} />
                                </label>
                                <label>
                                    <span>Note</span>
                                    <textarea rows="3" value={selectedNode.data.description || ''} onChange={event => updateSelectedNode({ description: event.target.value })} />
                                </label>
                                <button type="button" className="btn text-btn danger-icon-btn" onClick={deleteSelectedNode}>Delete node</button>
                            </section>
                        ) : selectedEdge ? (
                            <section>
                                <h4>Edit Connector</h4>
                                <label>
                                    <span>Label</span>
                                    <input type="text" value={selectedEdge.label || ''} placeholder="Yes, No, then..." onChange={event => updateSelectedEdge(event.target.value)} />
                                </label>
                                <button type="button" className="btn text-btn danger-icon-btn" onClick={deleteSelectedEdge}>Delete connector</button>
                            </section>
                        ) : (
                            <section>
                                <h4>Build Flow</h4>
                                <p>Select a node or connector to edit it. Drag from one node handle to another to connect them.</p>
                            </section>
                        )}

                        <section>
                            <h4>Quick Connector</h4>
                            <label>
                                <span>From</span>
                                <select value={connector.source} onChange={event => setConnector({ ...connector, source: event.target.value })}>
                                    <option value="">Choose node</option>
                                    {nodeOptions}
                                </select>
                            </label>
                            <label>
                                <span>To</span>
                                <select value={connector.target} onChange={event => setConnector({ ...connector, target: event.target.value })}>
                                    <option value="">Choose node</option>
                                    {nodeOptions}
                                </select>
                            </label>
                            <label>
                                <span>Label</span>
                                <input type="text" value={connector.label} placeholder="Yes / No / then" onChange={event => setConnector({ ...connector, label: event.target.value })} />
                            </label>
                            <button type="button" className="btn secondary-btn" onClick={addConnector} disabled={!connector.source || !connector.target || connector.source === connector.target}>
                                Add Connector
                            </button>
                        </section>
                    </aside>
                ) : null}
            </div>
        </div>
    );
}

function FlowchartEditorRoot(props) {
    return (
        <ReactFlowProvider>
            <FlowchartEditor {...props} />
        </ReactFlowProvider>
    );
}

export function mountFlowchartAlgorithmEditor(container, options = {}) {
    if (!container) {
        throw new Error('A container is required to mount the flowchart editor.');
    }

    const existingRoot = mountedRoots.get(container);
    if (existingRoot) {
        existingRoot.unmount();
        mountedRoots.delete(container);
    }

    const template = normalizeFlowchartTemplate(options.template);
    let latestResponse = normalizeFlowchartResponse(template, options.response);
    const root = createRoot(container);

    root.render(React.createElement(FlowchartEditorRoot, {
        template,
        response: latestResponse,
        readOnly: Boolean(options.readOnly),
        onChange: response => {
            latestResponse = normalizeFlowchartResponse(template, response);
            options.onChange?.(latestResponse);
        },
        onReady: api => {
            latestResponse = api.getResponse?.() || latestResponse;
            options.onReady?.({
                getResponse: () => latestResponse
            });
        }
    }));

    mountedRoots.set(container, root);

    return {
        getResponse: () => latestResponse,
        unmount: () => {
            root.unmount();
            mountedRoots.delete(container);
        }
    };
}
