// Placeholder lettermark until milestone 9 supplies Dialext artwork; same
// geometry as dialext/design/icon/make-placeholder-icons.swift.
export function DialextMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 82 100"
      fill="currentColor"
      fillRule="evenodd"
      className={className}
      aria-hidden="true"
    >
      <path d="M0 0H32A50 50 0 0 1 32 100H0Z M24 24H32A26 26 0 0 1 32 76H24Z" />
    </svg>
  );
}
