export interface AgentMemoryEntry {
  timestamp: string;
  taskId?: string;
  summary: string;
}

export interface AgentMemory {
  role: string;
  entries: AgentMemoryEntry[];
}
