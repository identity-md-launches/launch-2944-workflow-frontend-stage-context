const hamster = [
  "...oo......oo...",
  "..opfo....ofpo..",
  "..offooooooffo..",
  ".offffffffffffo.",
  ".offeffffffeffo.",
  "offffffffffffffo",
  "offcfffppfffcffo",
  "offfffbbbbfffffo",
  "offffbbbbbbffffo",
  ".offfbbbbbbfffo.",
  ".offbbbbbbbbffo.",
  "..offbbbbbbffo..",
  "...oooooooooo...",
  "...pp......pp...",
];
export function Hamster({ className = "" }: { className?: string }) {
  const colors: Record<string, string> = {
    o: "#2A1E14",
    f: "#E8C08A",
    e: "#0E0E12",
    p: "#E9928F",
    c: "#E9928F",
    b: "#F3DDBB",
  };
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {hamster.flatMap((row, y) =>
        [...row].map((pixel, x) =>
          pixel === "." ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y + 1}
              width="1"
              height="1"
              fill={colors[pixel]}
            />
          ),
        ),
      )}
    </svg>
  );
}
export function StanceIcon({ stance }: { stance: number }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {stance === 0 ? (
        <path d="m5 19 13-13m-7 1 7-3 2 2-3 7M4 15l5 5m-7 2 5-5" />
      ) : stance === 1 ? (
        <path d="M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3Zm0 4v10m-5-5h10" />
      ) : stance === 2 ? (
        <>
          <path d="M5 10h14l-1 10H6L5 10Zm3 0V7a4 4 0 0 1 8 0v3" />
          <path d="M12 13v4m-2-2h4" />
        </>
      ) : (
        <path d="M18 4a8 8 0 1 0 2 12A9 9 0 0 1 18 4ZM5 3v4M3 5h4m13 2v4m-2-2h4" />
      )}
    </svg>
  );
}
