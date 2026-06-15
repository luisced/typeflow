"use client";

interface Props {
  label: string;
  title?: string;
  size?: "sm" | "md";
  children: React.ReactNode;
}

export default function ChartHelp({
  label,
  title,
  size = "md",
  children,
}: Props) {
  return (
    <button
      type="button"
      className={`chart-help-btn${size === "sm" ? " chart-help-btn-sm" : ""}`}
      aria-label={label}
      title={title}
    >
      <svg
        width={size === "sm" ? 11 : 14}
        height={size === "sm" ? 11 : 14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span className="chart-help-tooltip" role="tooltip">
        {children}
      </span>
    </button>
  );
}
