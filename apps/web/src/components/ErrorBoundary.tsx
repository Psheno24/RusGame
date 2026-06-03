import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card">
          <h2>Что-то пошло не так</h2>
          <p style={{ color: "var(--text-muted)" }}>
            Обновите страницу. Если ошибка повторится — напишите в поддержку.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Обновить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
