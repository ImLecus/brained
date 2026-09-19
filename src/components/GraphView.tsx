import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forceManyBody } from "d3-force";
import type {
    ForceLink,
    SimulationLinkDatum,
    SimulationNodeDatum,
} from "d3-force";
import ForceGraph2D from "react-force-graph-2d";
import type { ForceGraphMethods } from "react-force-graph-2d";
import type { GraphData, GraphNode } from "../../shared/types";

interface GraphViewProps {
    graph: GraphData;
    color: string;
    invertColor: string;
    onNodeClick: (node: GraphNode) => void;
}

const CHARGE = 70;
const MIN_ZOOM = 0.01;
const MAX_ZOOM = 8;
const ZOOM_EASE = 0.32;
const WHEEL_SENSITIVITY = 0.0016;
const MIDDLE_SENSITIVITY = 0.003;
const FRICTION = 0.9;
const PAN_SMOOTHING = 0.55;
const PAN_THRESHOLD = 4;
const NODE_REL_SIZE = 5;
const HALO_PADDING = 3;
const MIN_HALO_ZOOM = 0.25;
const BASE_LINK_DISTANCE = 48;
const DEGREE_SPACING = 3;
const LABEL_FADE_MIN = 0.7;
const LABEL_FADE_MAX = 0.9;
const LABEL_OFFSET = 6;

function labelOpacity(zoom: number): number {
    return Math.min(
        1,
        Math.max(
            0,
            (zoom - LABEL_FADE_MIN) / (LABEL_FADE_MAX - LABEL_FADE_MIN),
        ),
    );
}

function withAlpha(hex: string, alpha: number): string {
    const suffix = Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0");
    return `${hex}${suffix}`;
}

function clampZoom(value: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function sizeValue(degree: number): number {
    return degree * 0.6 + 4;
}

function degreeMap(graph: GraphData) {
    const degrees = new Map<string, number>();
    for (const link of graph.links) {
        for (const end of [link.source, link.target]) {
            const id = endId(end);
            if (id === null) {
                continue;
            }
            degrees.set(id, (degrees.get(id) ?? 0) + 1);
        }
    }
    return degrees;
}

type EndRef = string | number | { id?: string | number } | null | undefined;

function endId(end: EndRef): string | null {
    if (end === null || end === undefined) {
        return null;
    }
    if (typeof end === "object") {
        return String(end.id ?? "");
    }
    return String(end);
}

interface SimNode extends SimulationNodeDatum {
    id?: string | number;
}

interface View {
    k: number;
    cx: number;
    cy: number;
}

interface Camera {
    view: View;
    targetK: number;
    vx: number;
    vy: number;
    raf: number;
    touched: boolean;
    pan: null | {
        startX: number;
        startY: number;
        lastX: number;
        lastY: number;
        pending: boolean;
    };
    middle: null | {
        lastY: number;
    };
}

export const GraphView = memo(function GraphView({
    graph,
    color,
    invertColor,
    onNodeClick,
}: GraphViewProps) {
    const container = useRef<HTMLDivElement>(null);
    const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
    const [hovered, setHovered] = useState<string | null>(null);
    const camera = useRef<Camera>({
        view: { k: 1, cx: 0, cy: 0 },
        targetK: 1,
        vx: 0,
        vy: 0,
        raf: 0,
        touched: false,
        pan: null,
        middle: null,
    });
    const nodeDragging = useRef(false);
    const fitTimer = useRef<number | undefined>(undefined);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const degrees = useMemo(() => degreeMap(graph), [graph]);
    const nodeVal = useCallback(
        (node: SimNode) => sizeValue(degrees.get(String(node.id)) ?? 0),
        [degrees],
    );

    useEffect(() => {
        setHovered(null);
    }, [graph]);

    const highlighted = (link: { source?: EndRef; target?: EndRef }) =>
        hovered !== null &&
        (endId(link.source) === hovered || endId(link.target) === hovered);

    const drawNode = (
        node: { id?: string | number; x?: number; y?: number },
        ctx: CanvasRenderingContext2D,
        globalScale: number,
    ) => {
        if (
            node.x === undefined ||
            node.y === undefined ||
            node.id === undefined
        ) {
            return;
        }
        const id = String(node.id);
        const isHovered = id === hovered;
        const radius =
            Math.sqrt(sizeValue(degrees.get(id) ?? 0)) * NODE_REL_SIZE;
        if (isHovered) {
            const haloRadius =
                radius + HALO_PADDING / Math.max(globalScale, MIN_HALO_ZOOM);
            ctx.beginPath();
            ctx.arc(node.x, node.y, haloRadius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? invertColor : color;
        ctx.fill();
        const fontSize = 12 / globalScale;
        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.globalAlpha = labelOpacity(globalScale);
        ctx.fillStyle = color;
        ctx.fillText(
            id.toUpperCase(),
            node.x,
            node.y + radius + LABEL_OFFSET / globalScale,
        );
        ctx.globalAlpha = 1;
    };

    const linkDistance = useCallback(
        (link: SimulationLinkDatum<SimNode>) => {
            const source = endId(link.source);
            const target = endId(link.target);
            const degree =
                (source === null ? 0 : (degrees.get(source) ?? 0)) +
                (target === null ? 0 : (degrees.get(target) ?? 0));
            return BASE_LINK_DISTANCE + degree * DEGREE_SPACING;
        },
        [degrees],
    );

    useEffect(() => {
        const graph = graphRef.current;
        if (!graph) {
            return;
        }
        graph.d3Force(
            "charge",
            forceManyBody().strength((node) => {
                const id = (node as SimNode).id;
                return (
                    -CHARGE *
                    ((id === undefined ? 0 : degrees.get(String(id))) ?? 1)
                );
            }),
        );
        const linkForce = graph.d3Force("link") as
            | ForceLink<SimNode, SimulationLinkDatum<SimNode>>
            | undefined;
        if (linkForce) {
            linkForce.distance(linkDistance);
        }
        graph.d3ReheatSimulation();
    }, [degrees, linkDistance]);

    useEffect(() => {
        const element = container.current;
        if (!element) {
            return;
        }
        const measure = () => {
            setSize({
                width: element.clientWidth,
                height: element.clientHeight,
            });
        };
        measure();
        window.addEventListener("resize", measure);
        return () => {
            window.removeEventListener("resize", measure);
        };
    }, []);

    useEffect(() => {
        const element = container.current;
        if (!element) {
            return;
        }
        const cam = camera.current;

        const syncView = () => {
            const graph = graphRef.current;
            if (!graph) {
                return;
            }
            cam.view.k = graph.zoom();
            const center = graph.centerAt();
            cam.view.cx = center.x;
            cam.view.cy = center.y;
        };

        const running = () =>
            cam.pan !== null ||
            cam.middle !== null ||
            cam.vx !== 0 ||
            cam.vy !== 0 ||
            Math.abs(cam.targetK - cam.view.k) > 0.0001;

        const tick = () => {
            const graph = graphRef.current;
            if (graph) {
                const deltaK = cam.targetK - cam.view.k;
                if (Math.abs(deltaK) > 0.00005) {
                    cam.view.k += deltaK * ZOOM_EASE;
                    if (Math.abs(cam.targetK - cam.view.k) < 0.0001) {
                        cam.view.k = cam.targetK;
                    }
                }
                if (cam.vx !== 0 || cam.vy !== 0) {
                    cam.view.cx -= cam.vx / cam.view.k;
                    cam.view.cy -= cam.vy / cam.view.k;
                    cam.vx *= FRICTION;
                    cam.vy *= FRICTION;
                    if (Math.abs(cam.vx) < 0.05 && Math.abs(cam.vy) < 0.05) {
                        cam.vx = 0;
                        cam.vy = 0;
                    }
                }
                graph.zoom(cam.view.k);
                graph.centerAt(cam.view.cx, cam.view.cy);
            }
            if (running()) {
                cam.raf = requestAnimationFrame(tick);
            } else {
                cam.raf = 0;
            }
        };

        const kick = () => {
            if (cam.raf === 0) {
                cam.raf = requestAnimationFrame(tick);
            }
        };

        const zoomBy = (factor: number, clientX: number, clientY: number) => {
            const graph = graphRef.current;
            if (!graph) {
                return;
            }
            const nextK = clampZoom(cam.targetK * factor);
            const ratio = nextK / cam.targetK;
            if (ratio === 1) {
                return;
            }
            const rect = element.getBoundingClientRect();
            const point = graph.screen2GraphCoords(
                clientX - rect.left,
                clientY - rect.top,
            );
            cam.view.cx = point.x + (cam.view.cx - point.x) / ratio;
            cam.view.cy = point.y + (cam.view.cy - point.y) / ratio;
            cam.targetK = nextK;
            kick();
        };

        const down = (event: MouseEvent) => {
            cam.touched = true;
            if (event.button === 1) {
                event.preventDefault();
                if (!cam.middle) {
                    syncView();
                    cam.targetK = cam.view.k;
                }
                cam.middle = { lastY: event.clientY };
                element.classList.add("zooming");
                kick();
                return;
            }
            if (event.button === 0) {
                event.preventDefault();
                if (!cam.pan) {
                    syncView();
                }
                cam.pan = {
                    startX: event.clientX,
                    startY: event.clientY,
                    lastX: event.clientX,
                    lastY: event.clientY,
                    pending: true,
                };
                kick();
            }
        };

        const move = (event: MouseEvent) => {
            if (cam.middle) {
                const dy = cam.middle.lastY - event.clientY;
                cam.middle.lastY = event.clientY;
                if (dy !== 0) {
                    zoomBy(
                        1 + dy * MIDDLE_SENSITIVITY,
                        event.clientX,
                        event.clientY,
                    );
                }
                return;
            }
            if (!cam.pan) {
                return;
            }
            if (nodeDragging.current) {
                cam.pan = null;
                return;
            }
            if (cam.pan.pending) {
                const moved =
                    Math.hypot(
                        event.clientX - cam.pan.startX,
                        event.clientY - cam.pan.startY,
                    ) >= PAN_THRESHOLD;
                if (!moved) {
                    return;
                }
                cam.pan.pending = false;
                syncView();
            }
            const dx = event.clientX - cam.pan.lastX;
            const dy = event.clientY - cam.pan.lastY;
            cam.pan.lastX = event.clientX;
            cam.pan.lastY = event.clientY;
            cam.view.cx -= dx / cam.view.k;
            cam.view.cy -= dy / cam.view.k;
            cam.vx = cam.vx * (1 - PAN_SMOOTHING) + dx * PAN_SMOOTHING;
            cam.vy = cam.vy * (1 - PAN_SMOOTHING) + dy * PAN_SMOOTHING;
            kick();
        };

        const wheel = (event: WheelEvent) => {
            event.preventDefault();
            cam.touched = true;
            if (cam.pan || cam.middle) {
                return;
            }
            const graph = graphRef.current;
            if (!graph) {
                return;
            }
            syncView();
            const factor = Math.exp(-event.deltaY * WHEEL_SENSITIVITY);
            const nextK = clampZoom(cam.view.k * factor);
            const ratio = nextK / cam.view.k;
            if (ratio === 1) {
                return;
            }
            const rect = element.getBoundingClientRect();
            const point = graph.screen2GraphCoords(
                event.clientX - rect.left,
                event.clientY - rect.top,
            );
            cam.view.cx = point.x + (cam.view.cx - point.x) / ratio;
            cam.view.cy = point.y + (cam.view.cy - point.y) / ratio;
            cam.view.k = nextK;
            cam.targetK = nextK;
            graph.zoom(cam.view.k);
            graph.centerAt(cam.view.cx, cam.view.cy);
        };

        const up = () => {
            if (cam.middle) {
                cam.middle = null;
                element.classList.remove("zooming");
            }
            if (cam.pan) {
                cam.pan = null;
            }
            kick();
        };

        element.addEventListener("mousedown", down);
        element.addEventListener("wheel", wheel, { passive: false });
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
        return () => {
            element.removeEventListener("mousedown", down);
            element.removeEventListener("wheel", wheel);
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
            if (cam.raf !== 0) {
                cancelAnimationFrame(cam.raf);
                cam.raf = 0;
            }
        };
    }, []);

    const fitToView = useCallback(() => {
        if (camera.current.touched || graph.nodes.length <= 1) {
            return;
        }
        const handle = graphRef.current;
        if (!handle) {
            return;
        }
        if (fitTimer.current !== undefined) {
            window.clearTimeout(fitTimer.current);
        }
        fitTimer.current = window.setTimeout(() => {
            fitTimer.current = undefined;
            if (camera.current.touched) {
                return;
            }
            if (
                graph.nodes.some((node) => {
                    const position = node as unknown as {
                        x?: unknown;
                        y?: unknown;
                    };
                    return (
                        typeof position.x !== "number" ||
                        typeof position.y !== "number" ||
                        !Number.isFinite(position.x) ||
                        !Number.isFinite(position.y)
                    );
                })
            ) {
                return;
            }
            handle.zoomToFit(0, 70);
            const fittedK = handle.zoom();
            if (!Number.isFinite(fittedK)) {
                return;
            }
            const clampedK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fittedK));
            const center = handle.centerAt();
            if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) {
                return;
            }
            handle.zoom(clampedK);
            handle.centerAt(center.x, center.y);
            camera.current.view = { k: clampedK, cx: center.x, cy: center.y };
            camera.current.targetK = clampedK;
        }, 0);
    }, [graph]);

    useEffect(() => {
        return () => {
            if (fitTimer.current !== undefined) {
                window.clearTimeout(fitTimer.current);
                fitTimer.current = undefined;
            }
        };
    }, []);

    return (
        <div ref={container} className="graph-area">
            {size.width > 0 && size.height > 0 && (
                <ForceGraph2D
                    ref={graphRef}
                    graphData={graph}
                    width={size.width}
                    height={size.height}
                    backgroundColor="transparent"
                    nodeCanvasObjectMode={() => "replace"}
                    nodeCanvasObject={drawNode}
                    linkCurvature={0}
                    linkColor={(link) =>
                        highlighted(link) ? color : withAlpha(color, 0.6)
                    }
                    nodeVal={nodeVal}
                    nodeRelSize={NODE_REL_SIZE}
                    linkWidth={(link) => (highlighted(link) ? 1.8 : 1)}
                    onNodeHover={(node) =>
                        setHovered(node ? String(node.id) : null)
                    }
                    onNodeClick={(node) => onNodeClick(node as GraphNode)}
                    showPointerCursor
                    minZoom={MIN_ZOOM}
                    maxZoom={MAX_ZOOM}
                    enableZoomInteraction={false}
                    enablePanInteraction={false}
                    onEngineStop={fitToView}
                    onNodeDrag={() => {
                        nodeDragging.current = true;
                    }}
                    onNodeDragEnd={() => {
                        nodeDragging.current = false;
                    }}
                />
            )}
        </div>
    );
});
