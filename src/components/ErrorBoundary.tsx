import { Component, ReactNode } from "react";
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert">
        <h2>This page could not be loaded</h2>
        <p>
          Reload to fetch the latest application. Unsaved changes on this page
          may be lost.
        </p>
        <button className="nu-btn" onClick={() => window.location.reload()}>
          Reload application
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
