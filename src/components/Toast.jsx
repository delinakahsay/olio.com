export default function Toast({ message }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={"toast" + (message ? " show" : "")}
    >
      {message}
    </div>
  );
}
