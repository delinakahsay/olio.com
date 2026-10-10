const paths = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  send: "m4 4 17 8-17 8 3-8-3-8Zm3 8h14",
  bookmark: "M6 4h12v17l-6-4-6 4V4Z",
  chevron: "m6 9 6 6 6-6",
  close: "m6 6 12 12M6 18 18 6",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  reset: "M3 10a9 9 0 1 1 2 8M3 4v6h6",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14M5 12h14",
};
export default function Icon({ name, ...props }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.arrow} />
    </svg>
  );
}
