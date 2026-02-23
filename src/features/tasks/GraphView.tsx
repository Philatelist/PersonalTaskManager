import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ReactFlow, {
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import dagre from "dagre";
import type { TaskWithProgress } from "./use-tasks";
import type { DependencyEdge } from "./types";
import "@xyflow/react/dist/style.css";
import styles from "./GraphView.module.css";

interface GraphViewProps {
  tasks: TaskWithProgress[];
  dependencies: DependencyEdge[];
  onSelectTask: (taskId: string) => void;
  onClose: () => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;

function layoutNodes(
  tasks: TaskWithProgress[],
  edges: Edge[],
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 60 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const task of tasks) {
    g.setNode(task.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return tasks.map((task) => {
    const nodeData = g.node(task.id);
    return {
      id: task.id,
      type: "taskNode",
      position: {
        x: nodeData.x - NODE_WIDTH / 2,
        y: nodeData.y - NODE_HEIGHT / 2,
      },
      data: {
        title: task.title,
        status: task.status,
        isCyclic: task.isCyclic,
        taskId: task.id,
      },
    };
  });
}

interface TaskNodeData {
  title: string;
  status: string;
  isCyclic: boolean;
  taskId: string;
  [key: string]: unknown;
}

function TaskNodeComponent({ data }: NodeProps<Node<TaskNodeData>>) {
  const nodeData = data as TaskNodeData;
  return (
    <div
      className={`${styles.taskNode}${nodeData.isCyclic ? ` ${styles.taskNodeCyclic}` : ""}`}
      data-testid={`graph-node-${nodeData.taskId}`}
    >
      <Handle type="target" position={Position.Top} />
      <div className={styles.taskNodeTitle}>{nodeData.title}</div>
      <span
        className={`${styles.statusBadge} ${
          nodeData.status === "done" ? styles.statusDone : styles.statusActive
        }`}
      >
        {nodeData.status}
      </span>
      {nodeData.isCyclic && (
        <div className={styles.cyclicIndicator} data-testid={`graph-cyclic-${nodeData.taskId}`}>
          Cycle detected
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { taskNode: TaskNodeComponent };

type EdgeMode = "dependencies" | "all";

export function GraphView({
  tasks,
  dependencies,
  onSelectTask,
  onClose,
}: GraphViewProps) {
  const [edgeMode, setEdgeMode] = useState<EdgeMode>("dependencies");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const dependencyEdges: Edge[] = useMemo(
    () =>
      dependencies.map((dep) => ({
        id: dep.id,
        source: dep.blockerTaskId,
        target: dep.dependentTaskId,
        type: "default",
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { edgeType: "dependency" },
      })),
    [dependencies],
  );

  const taskrefEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    for (const task of tasks) {
      for (const sub of task.subtasks) {
        if (sub.type === "taskref" && sub.refTaskId) {
          edges.push({
            id: `taskref-${task.id}-${sub.refTaskId}`,
            source: task.id,
            target: sub.refTaskId,
            type: "default",
            style: { strokeDasharray: "5 5", stroke: "#9c27b0" },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#9c27b0" },
            data: { edgeType: "taskref" },
          });
        }
      }
    }
    return edges;
  }, [tasks]);

  const allEdges = useMemo(
    () => edgeMode === "all" ? [...dependencyEdges, ...taskrefEdges] : dependencyEdges,
    [edgeMode, dependencyEdges, taskrefEdges],
  );

  const nodes = useMemo(
    () => layoutNodes(tasks, allEdges),
    [tasks, allEdges],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectTask(node.id);
    },
    [onSelectTask],
  );

  return createPortal(
    <div className={styles.overlay} data-testid="graph-view-overlay">
      <div className={styles.header}>
        <span className={styles.headerTitle}>Graph View</span>
        <div className={styles.headerControls}>
          <select
            className={styles.edgeToggle}
            value={edgeMode}
            onChange={(e) => setEdgeMode(e.target.value as EdgeMode)}
            data-testid="graph-edge-toggle"
          >
            <option value="dependencies">Dependencies only</option>
            <option value="all">Dependencies + Subtask refs</option>
          </select>
          <button
            className={styles.closeButton}
            onClick={onClose}
            data-testid="graph-close-button"
          >
            Close
          </button>
        </div>
      </div>
      <div className={styles.flowContainer} data-testid="graph-flow-container">
        <ReactFlow
          nodes={nodes}
          edges={allEdges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        />
      </div>
    </div>,
    document.body,
  );
}
