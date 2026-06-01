// Minimal, crisp stroke icons (inherit currentColor). Kept dependency-free.
interface IconProps {
  size?: number;
  className?: string;
}

function base(size = 20): { width: number; height: number; viewBox: string } {
  return { width: size, height: size, viewBox: "0 0 24 24" };
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function LogoMark({ size = 22, className }: IconProps): JSX.Element {
  // A "spark + lens" mark drawn on a gradient (gradient applied via CSS bg).
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path
        d="M12 3.5l1.7 4.4 4.4 1.7-4.4 1.7L12 15.7l-1.7-4.4L5.9 9.6l4.4-1.7z"
        fill="currentColor"
      />
      <circle cx="17.5" cy="17.5" r="2.2" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function UploadCloud({ size = 28, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path {...stroke} d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.2 3.8 3.8 0 0 1 17 18" />
      <path {...stroke} d="M12 12.5V20" />
      <path {...stroke} d="M9 15l3-3 3 3" />
    </svg>
  );
}

export function SunIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <circle {...stroke} cx="12" cy="12" r="4" />
      <path
        {...stroke}
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      />
    </svg>
  );
}

export function MoonIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path {...stroke} d="M20 13.5A8 8 0 1 1 10.5 4a6.2 6.2 0 0 0 9.5 9.5z" />
    </svg>
  );
}

export function SparkleIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path
        d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"
        fill="currentColor"
      />
      <path d="M18.5 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

export function DownloadIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path {...stroke} d="M12 3v12" />
      <path {...stroke} d="M8 11l4 4 4-4" />
      <path {...stroke} d="M4 21h16" />
    </svg>
  );
}

export function CloseIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path {...stroke} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ShieldIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path {...stroke} d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path {...stroke} d="M9.5 12l1.8 1.8 3.2-3.6" />
    </svg>
  );
}
