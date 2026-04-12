interface AlertProps {
  type: 'info' | 'warning' | 'error';
  children: React.ReactNode;
}

const styles = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  error: 'bg-red-50 border-red-200 text-red-800',
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
