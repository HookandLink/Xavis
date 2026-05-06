// types/index.ts
// Xavis 앱 전체 TypeScript 타입 정의

export type ProjectStatus = 'active' | 'done' | 'archived'
export type ProjectMode = 'normal' | 'exam'

export type MilestoneStatus = 'todo' | 'active' | 'done'

export type TaskStatus = 'todo' | 'done' | 'skip'
export type TaskCategory = 'must' | 'nice' | 'optional'
export type EnergyCost = 'low' | 'mid' | 'high'
export type ContextType =
  | 'book'
  | 'KAL'
  | 'habit'
  | 'exercise'
  | 'major_study'
  | 'sub_study'
  | 'meeting'
  | 'assignment'

export type InboxStatus = 'pending' | 'done'

// ─────────────────────────────────────────────
// DB 엔티티 타입
// ─────────────────────────────────────────────

export interface Project {
  id: string
  title: string
  description?: string | null
  status: ProjectStatus
  mode: ProjectMode
  importance: number // 1–5
  deadline?: string | null // DATE → ISO string
  created_at: string
  updated_at: string
}

export interface Milestone {
  id: string
  project_id: string
  title: string
  status: MilestoneStatus
  due_date?: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  milestone_id: string
  title: string
  status: TaskStatus
  category: TaskCategory
  importance: number // 1–5
  estimated_min?: number | null
  energy_cost: EnergyCost
  context_type: ContextType
  scheduled_date?: string | null
  due_date?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

export interface DailyLog {
  id: string
  date: string // DATE → ISO string
  energy_level: number // 1–5
  focus_level: number // 1–5
  mode: ProjectMode
  tasks_done: number
  note?: string | null
  created_at: string
}

export interface InboxItem {
  id: string
  raw_text: string
  status: InboxStatus
  ai_category?: string | null
  linked_task_id?: string | null
  linked_project_id?: string | null
  ai_processed_at?: string | null
  created_at: string
}

// ─────────────────────────────────────────────
// 폼 입력용 타입 (id, created_at 제외)
// ─────────────────────────────────────────────

export type NewProject = Pick<
  Project,
  'title' | 'description' | 'mode' | 'importance' | 'deadline'
>

export type NewMilestone = Pick<
  Milestone,
  'project_id' | 'title' | 'due_date' | 'order_index'
>

export type NewTask = Pick<
  Task,
  | 'milestone_id'
  | 'title'
  | 'category'
  | 'importance'
  | 'estimated_min'
  | 'energy_cost'
  | 'context_type'
  | 'scheduled_date'
  | 'due_date'
>
