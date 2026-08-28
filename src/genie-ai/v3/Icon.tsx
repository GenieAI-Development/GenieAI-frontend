const paths: Record<string, React.ReactNode> = {
  box: <><path d="M3.5 8.5 12 4l8.5 4.5L12 13z"/><path d="M3.5 8.5V16L12 20.5 20.5 16V8.5M12 13v7.5"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></>,
  camera: <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="m21 16-5-4-4 3-3-2-6 5"/></>,
  cart: <><path d="M3 5h2l2.4 12.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="9.5" cy="21" r="1.4"/><circle cx="17.5" cy="21" r="1.4"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  compare: <path d="M8 3v14M16 7v14M4 17h8M12 11h8"/>,
  gift: <><path d="M4 10h16v10H4zM3 7h18v4H3zM12 7v13"/><path d="M12 7c-1.7-3-5.7-4-6.8-1.6C4.4 7 6.4 8 12 7Zm0 0c1.7-3 5.7-4 6.8-1.6C19.6 7 17.6 8 12 7Z"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>,
  person: <><circle cx="12" cy="8" r="3.4"/><path d="M5 20c1.2-4 4-5.8 7-5.8s5.8 1.8 7 5.8"/></>,
  send: <path d="M4 12h15M13 6l6 6-6 6"/>,
  settings: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.3"/><circle cx="7" cy="17" r="2.3"/></>,
  shopping: <><path d="M4 4h2l1.5 9.5A2 2 0 0 0 9.5 15h7a2 2 0 0 0 2-1.6L20 7H6"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></>,
  speaker: <><path d="M5 10v4h3l4 3V7l-4 3z"/><path d="M15 9c1 .8 1.5 1.8 1.5 3S16 14.2 15 15M17.5 6.5c1.8 1.5 2.7 3.3 2.7 5.5s-.9 4-2.7 5.5"/></>,
  sparkles: <><path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="m18.5 15 .8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z"/></>,
  trash: <><path d="M4 7h16M9 3h6l1 4H8zM7 7l1 14h8l1-14"/></>,
  x: <path d="m5 5 14 14M19 5 5 19"/>,
};

export function V3Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] ?? paths.sparkles}
    </svg>
  );
}

export function GenieMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-[10px] bg-[linear-gradient(155deg,#1E4D8C,#0A1F3A)] text-[#F6ECD3] shadow-[0_8px_24px_-12px_rgba(10,31,58,.5)] ${className}`}>
      <V3Icon name="sparkles" className="h-[18px] w-[18px]" />
    </span>
  );
}
