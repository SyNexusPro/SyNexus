import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  label?: string;
};

type State = {
  message: string | null;
};

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: Error): State {
    const chunkFailed =
      /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(
        error.message,
      );
    return {
      message: chunkFailed
        ? "This screen did not load — usually a stale cache after an update."
        : error.message || "Unexpected error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`SyNexus route error (${this.props.label ?? "page"})`, error, info);
  }

  render() {
    if (this.state.message) {
      return (
        <div className="page">
          <div className="feed-status feed-status--error route-error">
            <p className="route-error__title">Something went wrong while loading this screen.</p>
            <p className="route-error__detail">{this.state.message}</p>
            <button
              type="button"
              className="route-error__reload"
              onClick={() => {
                sessionStorage.removeItem("synexus_chunk_retry");
                window.location.reload();
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
