use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDto {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority_rank: String,
    pub status: String,
    pub due_date: Option<String>,
    pub tags: Vec<String>,
    pub subtasks: Vec<SubtaskDto>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtaskDto {
    pub id: String,
    pub task_id: String,
    #[serde(rename = "type")]
    pub subtask_type: String,
    pub label: Option<String>,
    pub is_done: Option<bool>,
    pub ref_task_id: Option<String>,
    pub ref_task_title: Option<String>,
    pub ref_task_status: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
}
