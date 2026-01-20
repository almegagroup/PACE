const FormActions = ({ children, loading = false }) => {
  return (
    <div className="mt-6 flex items-center gap-3">
      {children}
      {loading && (
        <span className="text-xs text-text-muted">
          Processing…
        </span>
      )}
    </div>
  );
};

export default FormActions;
