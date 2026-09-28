import { MicOff, WifiOff } from 'lucide-react';
import './ErrorBanner.css';

export function ErrorBanner({ message, onRetry, retryLabel = 'Reconnect', onBack }: { message: string; onRetry: () => void; retryLabel?: string; onBack?: () => void }) {
  const mic = /microphone/i.test(message);
  return (
    <div className="error-banner" role="alert" data-testid="error-banner">
      <span className="error-icon" aria-hidden="true">
        {mic ? <MicOff size={18} /> : <WifiOff size={18} />}
      </span>
      <p className="error-text">{message}</p>
      <div className="error-actions">
        <button type="button" className="btn btn-fire" onClick={onRetry}>
          {retryLabel}
        </button>
        {onBack && (
          <button type="button" className="btn btn-quiet" onClick={onBack}>
            Back
          </button>
        )}
      </div>
    </div>
  );
}
