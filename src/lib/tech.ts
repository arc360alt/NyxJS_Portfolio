/** Maps GitHub languages/topics onto the tech labels used by the stack chips. */

const topicMap: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  rust: 'Rust',
  go: 'Go',
  golang: 'Go',
  java: 'Java',
  python: 'Python',
  nodejs: 'Node.js',
  node: 'Node.js',
  html: 'HTML',
  css: 'CSS',
  tailwindcss: 'Tailwind CSS',
  tailwind: 'Tailwind CSS',
  svelte: 'Svelte',
  sveltekit: 'Svelte',
};

/** GitHub language names are used as-is ("TypeScript", "Shell"…); topics add things like Node.js or Tailwind. */
export function techFromGithub(languages: (string | null)[], topics: string[] = []): string[] {
  const tech = new Set<string>();
  for (const l of languages) if (l) tech.add(l);
  for (const t of topics) if (topicMap[t]) tech.add(topicMap[t]);
  return [...tech];
}

export const titleFromRepo = (name: string) =>
  name.replace(/[-_]+/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());

export const sameRepo = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase().replace(/\/+$/, '') === b.toLowerCase().replace(/\/+$/, '');
