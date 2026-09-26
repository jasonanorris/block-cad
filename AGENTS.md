# AGENTS.md

## Project

This is a web development project under `/home/mint/projects`.

Before making significant changes, understand the existing structure and ask questions when requirements are unclear.

## Development Preferences

Prefer:

- Simple, maintainable code
- Vanilla HTML, CSS, and JavaScript for small projects
- Minimal dependencies
- Readability over cleverness
- Clear file and function names
- Small, focused changes

Avoid adding large frameworks unless they provide a clear benefit.

## Local Workflow

This is a Vite/React/TypeScript app; use the Vite development server.

Document project-specific commands here:

```bash
# install
npm install

# run locally
npm run dev

# build
npm run build

# regression tests
npm test
```

## Deployment

Deployment target: TBD

Possible targets:

- Namecheap web hosting
- Home server
- Cloudflare
- GitHub Pages

For infrastructure, deployment, DNS, server, hosting, Docker, Cloudflare, Tailscale, or Namecheap questions, read:

```text
/home/mint/projects/personal-dev-env/infrastructure.md
```

## Documentation

When setup, deployment, or architecture changes, update:

- `README.md`
- This `AGENTS.md`
- Relevant docs in `/home/mint/projects/personal-dev-env`
