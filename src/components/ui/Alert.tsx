interface AlertProps {
  type: 'info' | 'warning' | 'error';
  children: React.ReactNode;
}

const styles = {
  info: 'bg-tint-brand border-line text-brand',
  warning: 'bg-tint-caution border-line text-caution',
  error: 'bg-tint-danger border-line text-danger',
};

const icons = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
};

export default function Alert({ type, children }: AlertProps) {
  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${styles[type]}`} role="alert">
      <span className="flex-shrink-0">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}
