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
});

export const verificationConfigSchema = z.object({
  test: z.string().optional(),
  lint: z.string().optional(),
  build: z.string().optional(),
});

export const mcpConfigSchema = z.object({
  servers: z.array(z.string()).default([]),
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
