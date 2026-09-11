import type { PermissionPolicyOverride } from '../permissions/types.js';

export interface AgentDefinition {
  role: string;
  displayName: string;
  responsibilities: string[];
  constraints: string[];
  /** Paths to knowledge files, relative to this definition's own directory. */
  knowledge: string[];
  permissions?: PermissionPolicyOverride;
  /** Markdown body (system instructions) beyond the frontmatter. */
  instructions: string;
  /** Absolute path this definition was loaded from. */
  sourcePath: string;
}
