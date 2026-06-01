export function PrivacyExplainer(): JSX.Element {
  return (
    <section className="card privacy">
      <h2>Your photos never leave your device.</h2>
      <p className="muted">
        Most AI photo editors upload your images to cloud servers. This app works
        differently. It downloads AI models to your device and runs them locally.
        The first download may take some time, but it only happens once. You can
        delete downloaded models at any time.
      </p>
      <ul>
        <li>Download AI models once.</li>
        <li>Use them repeatedly.</li>
        <li>Delete them whenever you want.</li>
        <li>Process photos locally.</li>
        <li>Keep photos private — no image upload in this MVP.</li>
      </ul>
    </section>
  );
}
