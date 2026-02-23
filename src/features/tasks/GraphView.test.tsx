import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TaskWithProgress } from "./use-tasks";
import type { DependencyEdge } from "./types";

// Mock ReactFlow since it requires a real DOM with dimensions
let capturedNodes: Array<{ id: string; data: Record<string, unknown> }> = [];
let capturedEdges: Array<{ id: string; source: string; target: string }> = [];
let capturedOnNodeClick: ((event: React.MouseEvent, node: { id: string }) => void) | undefined;

vi.mock("@xyflow/react", () => {
  const Position = { Top: "top", Bottom: "bottom", Left: "left", Right: "right" };
  const MarkerType = { ArrowClosed: "arrowclosed" };
  return {
    default: function MockReactFlow(props: {
      nodes: Array<{ id: string; data: Record<string, unknown> }>;
      edges: Array<{ id: string; source: string; target: string }>;
      nodeTypes: Record<string, React.ComponentType<{ data: Record<string, unknown> }>>;
      onNodeClick?: (event: React.MouseEvent, node: { id: string }) => void;
    }) {
      capturedNodes = props.nodes;
      capturedEdges = props.edges;
      capturedOnNodeClick = props.onNodeClick;
      const NodeComponent = props.nodeTypes?.taskNode;
      return (
        <div data-testid="mock-react-flow">
          {props.nodes.map((node) => (
            <div
              key={node.id}
              data-testid={`flow-node-${node.id}`}
              onClick={(e) => props.onNodeClick?.(e, node)}
            >
              {NodeComponent && <NodeComponent data={node.data} />}
            </div>
          ))}
          {props.edges.map((edge: { id: string; source: string; target: string; className?: string; data?: { isCyclic?: boolean } }) => (
            <div
              key={edge.id}
              data-testid={`flow-edge-${edge.id}`}
              data-source={edge.source}
              data-target={edge.target}
              className={edge.className ?? ""}
              data-cyclic={edge.data?.isCyclic ? "true" : "false"}
            />
          ))}
        </div>
      );
    },
    Handle: function MockHandle({ type, position }: { type: string; position: string }) {
      return <div data-testid={`handle-${type}-${position}`} />;
    },
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    MarkerType: { ArrowClosed: "arrowclosed" },
  };
});

vi.mock("dagre", () => {
  const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  return {
    default: {
      graphlib: {
        Graph: class MockGraph {
          _graph = {};
          setGraph(opts: Record<string, unknown>) { this._graph = opts; }
          setDefaultEdgeLabel(fn: () => Record<string, unknown>) {}
          setNode(id: string, data: { width: number; height: number }) {
            nodePositions.set(id, { x: 0, y: 0, ...data });
          }
          setEdge(source: string, target: string) {}
          node(id: string) {
            return nodePositions.get(id) ?? { x: 0, y: 0 };
          }
        },
      },
      layout(graph: unknown) {
        // no-op for tests
      },
    },
  };
});

vi.mock("@xyflow/react/dist/style.css", () => ({}));

import { GraphView } from "./GraphView";

function makeTasks(count: number): TaskWithProgress[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i + 1}`,
    title: `Task ${i + 1}`,
    description: null,
    priorityRank: String.fromCharCode(97 + i),
    status: "active" as const,
    tags: [],
    dueDate: null,
    subtasks: [],
    blockers: [],
    dependents: [],
    isCyclic: false,
    isBlocked: false,
    unsatisfiedBlockerNames: [],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    progress: null,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedNodes = [];
  capturedEdges = [];
  capturedOnNodeClick = undefined;
});

describe("GraphView", () => {
  it("renders overlay with a node for each task", () => {
    const tasks = makeTasks(3);
    const deps: DependencyEdge[] = [];
    render(
      <GraphView tasks={tasks} dependencies={deps} onSelectTask={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByTestId("graph-view-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("flow-node-t1")).toBeInTheDocument();
    expect(screen.getByTestId("flow-node-t2")).toBeInTheDocument();
    expect(screen.getByTestId("flow-node-t3")).toBeInTheDocument();
  });

  it("renders dependency edges between tasks", () => {
    const tasks = makeTasks(3);
    const deps: DependencyEdge[] = [
      { id: "dep1", blockerTaskId: "t1", dependentTaskId: "t2" },
    ];
    render(
      <GraphView tasks={tasks} dependencies={deps} onSelectTask={vi.fn()} onClose={vi.fn()} />,
    );

    const edge = screen.getByTestId("flow-edge-dep1");
    expect(edge).toBeInTheDocument();
    expect(edge).toHaveAttribute("data-source", "t1");
    expect(edge).toHaveAttribute("data-target", "t2");
  });

  it("renders task titles in nodes", () => {
    const tasks = makeTasks(2);
    render(
      <GraphView tasks={tasks} dependencies={[]} onSelectTask={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByText("Task 1")).toBeInTheDocument();
    expect(screen.getByText("Task 2")).toBeInTheDocument();
  });

  it("close button dismisses the overlay", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <GraphView tasks={makeTasks(1)} dependencies={[]} onSelectTask={vi.fn()} onClose={onClose} />,
    );

    await user.click(screen.getByTestId("graph-close-button"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape key dismisses the overlay", () => {
    const onClose = vi.fn();
    render(
      <GraphView tasks={makeTasks(1)} dependencies={[]} onSelectTask={vi.fn()} onClose={onClose} />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking a node triggers onSelectTask with the task id", async () => {
    const user = userEvent.setup();
    const onSelectTask = vi.fn();
    render(
      <GraphView tasks={makeTasks(3)} dependencies={[]} onSelectTask={onSelectTask} onClose={vi.fn()} />,
    );

    await user.click(screen.getByTestId("flow-node-t2"));

    expect(onSelectTask).toHaveBeenCalledWith("t2");
  });

  it("shows cyclic indicator on cyclic tasks", () => {
    const tasks = makeTasks(2);
    tasks[0].isCyclic = true;
    render(
      <GraphView tasks={tasks} dependencies={[]} onSelectTask={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByTestId("graph-cyclic-t1")).toBeInTheDocument();
    expect(screen.getByText("Cycle detected")).toBeInTheDocument();
    expect(screen.queryByTestId("graph-cyclic-t2")).not.toBeInTheDocument();
  });

  it("renders header with title", () => {
    render(
      <GraphView tasks={makeTasks(1)} dependencies={[]} onSelectTask={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByText("Graph View")).toBeInTheDocument();
  });

  it("renders edge toggle with default 'Dependencies only'", () => {
    render(
      <GraphView tasks={makeTasks(2)} dependencies={[]} onSelectTask={vi.fn()} onClose={vi.fn()} />,
    );

    const toggle = screen.getByTestId("graph-edge-toggle") as HTMLSelectElement;
    expect(toggle).toBeInTheDocument();
    expect(toggle.value).toBe("dependencies");
  });

  it("dependency edges appear in both modes", async () => {
    const user = userEvent.setup();
    const tasks = makeTasks(2);
    const deps: DependencyEdge[] = [
      { id: "dep1", blockerTaskId: "t1", dependentTaskId: "t2" },
    ];
    render(
      <GraphView tasks={tasks} dependencies={deps} onSelectTask={vi.fn()} onClose={vi.fn()} />,
    );

    // Dependencies mode (default)
    expect(screen.getByTestId("flow-edge-dep1")).toBeInTheDocument();

    // Switch to "all" mode
    await user.selectOptions(screen.getByTestId("graph-edge-toggle"), "all");

    expect(screen.getByTestId("flow-edge-dep1")).toBeInTheDocument();
  });

  it("taskref edges appear only in combined mode", async () => {
    const user = userEvent.setup();
    const tasks = makeTasks(2);
    tasks[0].subtasks = [
      {
        id: "s1",
        taskId: "t1",
        type: "taskref",
        label: null,
        isDone: false,
        refTaskId: "t2",
        refTaskTitle: "Task 2",
        refTaskStatus: "active",
        sortOrder: 0,
      },
    ];
    render(
      <GraphView tasks={tasks} dependencies={[]} onSelectTask={vi.fn()} onClose={vi.fn()} />,
    );

    // Default mode: no taskref edges
    expect(screen.queryByTestId("flow-edge-taskref-t1-t2")).not.toBeInTheDocument();

    // Switch to "all" mode
    await user.selectOptions(screen.getByTestId("graph-edge-toggle"), "all");

    expect(screen.getByTestId("flow-edge-taskref-t1-t2")).toBeInTheDocument();
  });

  it("toggle switches edge modes correctly", async () => {
    const user = userEvent.setup();
    const tasks = makeTasks(2);
    tasks[0].subtasks = [
      {
        id: "s1",
        taskId: "t1",
        type: "taskref",
        label: null,
        isDone: false,
        refTaskId: "t2",
        refTaskTitle: "Task 2",
        refTaskStatus: "active",
        sortOrder: 0,
      },
    ];
    const deps: DependencyEdge[] = [
      { id: "dep1", blockerTaskId: "t1", dependentTaskId: "t2" },
    ];
    render(
      <GraphView tasks={tasks} dependencies={deps} onSelectTask={vi.fn()} onClose={vi.fn()} />,
    );

    // Default: only dependency edges
    expect(screen.getByTestId("flow-edge-dep1")).toBeInTheDocument();
    expect(screen.queryByTestId("flow-edge-taskref-t1-t2")).not.toBeInTheDocument();

    // Switch to "all"
    await user.selectOptions(screen.getByTestId("graph-edge-toggle"), "all");
    expect(screen.getByTestId("flow-edge-dep1")).toBeInTheDocument();
    expect(screen.getByTestId("flow-edge-taskref-t1-t2")).toBeInTheDocument();

    // Switch back to "dependencies"
    await user.selectOptions(screen.getByTestId("graph-edge-toggle"), "dependencies");
    expect(screen.getByTestId("flow-edge-dep1")).toBeInTheDocument();
    expect(screen.queryByTestId("flow-edge-taskref-t1-t2")).not.toBeInTheDocument();
  });

  it("cyclic edges get the cyclic-edge class", () => {
    const tasks = makeTasks(3);
    tasks[0].isCyclic = true;
    tasks[1].isCyclic = true;
    // t1 and t2 are cyclic, t3 is not
    const deps: DependencyEdge[] = [
      { id: "dep1", blockerTaskId: "t1", dependentTaskId: "t2" },
      { id: "dep2", blockerTaskId: "t2", dependentTaskId: "t3" },
    ];
    render(
      <GraphView tasks={tasks} dependencies={deps} onSelectTask={vi.fn()} onClose={vi.fn()} />,
    );

    // dep1: both t1 and t2 are cyclic → cyclic edge
    const edge1 = screen.getByTestId("flow-edge-dep1");
    expect(edge1.className).toContain("cyclic-edge");
    expect(edge1).toHaveAttribute("data-cyclic", "true");

    // dep2: t2 is cyclic but t3 is not → non-cyclic edge
    const edge2 = screen.getByTestId("flow-edge-dep2");
    expect(edge2.className).not.toContain("cyclic-edge");
    expect(edge2).toHaveAttribute("data-cyclic", "false");
  });

  it("non-cyclic edges do not get the cyclic style", () => {
    const tasks = makeTasks(2);
    // Neither task is cyclic
    const deps: DependencyEdge[] = [
      { id: "dep1", blockerTaskId: "t1", dependentTaskId: "t2" },
    ];
    render(
      <GraphView tasks={tasks} dependencies={deps} onSelectTask={vi.fn()} onClose={vi.fn()} />,
    );

    const edge = screen.getByTestId("flow-edge-dep1");
    expect(edge.className).not.toContain("cyclic-edge");
    expect(edge).toHaveAttribute("data-cyclic", "false");
  });
});
