export function Header(): JSX.Element {
  return (
    <header className="header">
      <div className="title">
        <strong>Private AI Photo Repair</strong>
        <span className="tagline">Your photos never leave your device.</span>
      </div>
      <span className="badge accent" title="All processing happens locally in your browser">
        🔒 Privacy-first
      </span>
    </header>
  );
}
