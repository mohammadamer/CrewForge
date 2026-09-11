import { z } from 'zod';

export const permissionPolicyOverrideSchema = z.object({
  shell: z.enum(['none', 'restricted', 'full']).optional(),
  network: z.enum(['none', 'restricted', 'full']).optional(),
  filesystem: z.enum(['repository', 'readonly']).optional(),
  deployment: z.enum(['blocked', 'approval-required', 'allowed']).optional(),
});

export const agentFrontmatterSchema = z.object({
  role: z.string().min(1),
  displayName: z.string().optional(),
  responsibilities: z.array(z.string()).min(1),
  constraints: z.array(z.string()).min(1),
  knowledge: z.array(z.string()).default([]),
  permissions: permissionPolicyOverrideSchema.optional(),
});

export type AgentFrontmatter = z.infer<typeof agentFrontmatterSchema>;
