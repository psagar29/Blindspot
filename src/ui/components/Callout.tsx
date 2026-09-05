import type { AppError } from "../../../shared/contracts";

export function ErrorCallout(props: { error: AppError; onRetry?: () => void }) {
  const { error, onRetry } = props;
  return (
    <div className="bs-callout bs-callout--error" role="alert">
      <strong>Something failed ({error.code})</strong>
      <span className="bs-callout-body">{error.message}</span>
      {error.retryable && onRetry ? (
        <span>
          <button type="button" className="bs-btn" onClick={onRetry}>
            Retry
          </button>
        </span>
      ) : null}
    </div>
  );
}

export function InfoCallout(props: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bs-callout bs-callout--info">
      {props.title ? <strong>{props.title}</strong> : null}
      <span className="bs-callout-body">{props.children}</span>
    </div>
  );
}
