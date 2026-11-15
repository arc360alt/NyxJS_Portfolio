/// <reference types="vite/client" />

declare module 'virtual:pfp-colors' {
  const colors: import('../vite/pfp-colors').PfpColor[];
  export default colors;
}

declare module 'virtual:github-pinned' {
  const repos: import('../vite/github-pinned').PinnedRepo[];
  export default repos;
  export const featuredRepos: import('../vite/github-pinned').PinnedRepo[];
}
