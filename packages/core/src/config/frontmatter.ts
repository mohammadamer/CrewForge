export interface SplitFrontmatter {
  frontmatter: string;
  body: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Splits a `---\nyaml\n---\nbody` Markdown file into its YAML frontmatter and body. */
export function splitFrontmatter(raw: string): SplitFrontmatter {
  const match = FRONTMATTER_PATTERN.exec(raw.trimStart());
  if (!match) {
    return { frontmatter: '', body: raw };
  }
  const [, frontmatter, body] = match;
  return { frontmatter: frontmatter ?? '', body: (body ?? '').trim() };
}
