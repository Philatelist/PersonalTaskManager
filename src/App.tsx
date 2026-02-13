import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { GridView } from "./features/tasks/GridView";
import { TaskDetailView } from "./features/tasks/TaskDetailView";

function App() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const scrollPositionRef = useRef(0);
  const currentPageRef = useRef(1);
  const priorityIndexRef = useRef(0);

  const handleSelectTask = useCallback(
    (id: string, priorityIndex: number) => {
      scrollPositionRef.current = window.scrollY;
      priorityIndexRef.current = priorityIndex;
      setSelectedTaskId(id);
    },
    [],
  );

  const handleBack = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  // Restore scroll position after returning from detail view
  useLayoutEffect(() => {
    if (!selectedTaskId && scrollPositionRef.current > 0) {
      window.scrollTo(0, scrollPositionRef.current);
      scrollPositionRef.current = 0;
    }
  }, [selectedTaskId]);

  if (selectedTaskId) {
    return (
      <TaskDetailView
        taskId={selectedTaskId}
        priorityIndex={priorityIndexRef.current}
        onBack={handleBack}
      />
    );
  }

  return (
    <GridView
      onSelectTask={handleSelectTask}
      initialPage={currentPageRef.current}
      onPageChange={(page: number) => {
        currentPageRef.current = page;
      }}
    />
  );
}

export default App;
