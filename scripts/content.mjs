// Everything the profile graphics say. Edit this file, then run:
//
//   node scripts/build.mjs static
//
// and commit the regenerated files in assets/. Links live in README.md.

export const profile = {
  user: 'ZAR0X',
  name: 'ZAROX',
  tagline: 'Ram Gour, a full-stack engineer working from PostgreSQL schemas and async Python services up to shader-driven 3D interfaces.',

  // One button each. The first is drawn filled, the rest outlined.
  links: [
    { id: 'portfolio', label: 'Portfolio', icon: 'globe' },
    { id: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
    { id: 'email', label: 'Email', icon: 'mail' },
  ],

  // Two cards that sit side by side. Each item is [label, logo], where logo is a key
  // from scripts/icons.mjs, or omitted for a text-only chip.
  stack: [
    {
      id: 'stack-core',
      groups: [
        { label: 'Languages', items: [['Python', 'python'], ['TypeScript', 'typescript'], ['JavaScript', 'javascript'], ['C++', 'cplusplus'], ['C', 'c'], ['Java', 'openjdk'], ['SQL']] },
        { label: 'Backend and data', items: [['FastAPI', 'fastapi'], ['PostgreSQL', 'postgresql'], ['Supabase', 'supabase'], ['Docker', 'docker'], ['Node.js', 'nodedotjs']] },
      ],
    },
    {
      id: 'stack-web',
      groups: [
        { label: 'Frontend and graphics', items: [['React', 'react'], ['Three.js', 'threedotjs'], ['WebGL', 'webgl'], ['GLSL', 'opengl'], ['GSAP', 'gsap'], ['Tailwind CSS', 'tailwindcss'], ['Vite', 'vite']] },
        { label: 'AI and tooling', items: [['RAG pipelines'], ['ChromaDB'], ['Whisper'], ['Git', 'git'], ['GitHub Actions', 'githubactions'], ['Linux', 'linux']] },
      ],
    },
  ],

  // Project cards. `highlight` is optional and drawn in the accent colour.
  work: [
    {
      id: 'catuserbot',
      name: 'CatUserBot',
      description: 'Open-source Telegram userbot framework. I maintain it and review community pull requests.',
      highlight: '15,000+ deployments',
      tags: ['Python', 'Telethon'],
    },
    {
      id: 'catvcplayer',
      name: 'CatVCPlayer',
      description: 'Voice-chat media streaming plugin, used across the CatUserBot deployment base.',
      tags: ['Python', 'PyTgCalls', 'FFmpeg'],
    },
    {
      id: 'hail-rag-engine',
      name: 'hail-rag-engine',
      description: 'Multimodal RAG over lecture videos, with time-aligned semantic search.',
      tags: ['FastAPI', 'Whisper', 'ChromaDB', 'Groq'],
    },
    {
      id: 'nidarcopilot',
      name: 'NidarCopilot',
      description: 'AI tax assistant that drafts GST returns and loan reports from ledger data.',
      highlight: 'Live',
      tags: ['React', 'Supabase', 'Groq'],
    },
  ],
};
