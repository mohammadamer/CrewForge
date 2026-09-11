import { z } from 'zod';

/** YAML represents an empty mapping key (e.g. `verification:` with nothing under it) as `null`,
 *  not "missing" — without this, `.default(...)` would never kick in for that common case. */
const nullToUndefined = (value: unknown) => (value === null ? undefined : value);

export const permissionPolicySchema = z.object({
  shell: z.enum(['none', 'restricted', 'full']).default('restricted'),
  network: z.enum(['none', 'restricted', 'full']).default('restricted'),
  filesystem: z.enum(['repository', 'readonly']).default('repository'),
  deployment: z.enum(['blocked', 'approval-required', 'allowed']).default('approval-required'),
});

export const workflowTogglesSchema = z.object({
  planning: z.boolean().default(true),
  parallel_execution: z.boolean().default(true),
  verification: z.boolean().default(true),
  human_approval: z.boolean().default(true),
  /** Opt-in: run each parallel task in its own isolated git worktree. See docs/architecture.md. */
  worktrees: z.boolean().default(false),
});

export const verificationConfigSchema = z.object({
  test: z.string().optional(),
  lint: z.string().optional(),
  build: z.string().optional(),
});

/** Shorthand names build.md's examples use (`mcp: servers: [github, postgres, playwright]`),
 *  resolved to a real launch command for the corresponding official reference server. */
const KNOWN_MCP_SERVER_PRESETS: Record<string, { command: string; args: string[] }> = {
  github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
  postgres: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres'] },
  playwright: { command: 'npx', args: ['-y', '@playwright/mcp'] },
  filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
};

const mcpServerObjectSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
});
type McpServerObject = z.infer<typeof mcpServerObjectSchema>;

export const mcpServerConfigSchema = z.union([
  z.string().min(1).transform(resolveMcpServerPreset),
  mcpServerObjectSchema,
]);

function resolveMcpServerPreset(name: string, ctx: z.RefinementCtx): McpServerObject {
  const preset = KNOWN_MCP_SERVER_PRESETS[name];
  if (!preset) {
    ctx.addIssue({
      code: 'custom',
      message: `Unknown MCP server preset "${name}"; provide { name, command, args } explicitly, or use one of: ${Object.keys(KNOWN_MCP_SERVER_PRESETS).join(', ')}.`,
    });
    return z.NEVER;
  }
  return { name, ...preset };
}

export const mcpConfigSchema = z.object({
  servers: z.array(mcpServerConfigSchema).default([]),
});

export const teamConfigSchema = z.object({
  name: z.string().min(1),
  lead: z.string().min(1).default('lead'),
  agents: z.array(z.string()).min(1),
  workflow: z.preprocess(
    nullToUndefined,
    workflowTogglesSchema.default({
      planning: true,
      parallel_execution: true,
      verification: true,
      human_approval: true,
      worktrees: false,
    }),
  ),
  verification: z.preprocess(nullToUndefined, verificationConfigSchema.default({})),
  permissions: z.preprocess(
    nullToUndefined,
    permissionPolicySchema.default({
      shell: 'restricted',
      network: 'restricted',
      filesystem: 'repository',
      deployment: 'approval-required',
    }),
  ),
  mcp: z.preprocess(nullToUndefined, mcpConfigSchema.optional()),
});

export type TeamConfig = z.infer<typeof teamConfigSchema>;
export type WorkflowToggles = z.infer<typeof workflowTogglesSchema>;
export type VerificationConfigInput = z.infer<typeof verificationConfigSchema>;
export type MCPServerConfigInput = z.infer<typeof mcpServerConfigSchema>;
