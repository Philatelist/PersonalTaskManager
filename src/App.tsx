import { useState } from "react";
import { GridView } from "./features/tasks/GridView";

function TaskDetailPlaceholder({
  taskId,
  onBack,
}: {
  taskId: string;
  onBack: () => void;
}) {
  return (
    <div>
      <button onClick={onBack}>Back</button>
      <p>Task detail placeholder: {taskId}</p>
    </div>
  );
}

function App() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  if (selectedTaskId) {
    return (
      <TaskDetailPlaceholder
        taskId={selectedTaskId}
        onBack={() => setSelectedTaskId(null)}
      />
    );
  }

  return <GridView onSelectTask={setSelectedTaskId} />;
}

export default App;
