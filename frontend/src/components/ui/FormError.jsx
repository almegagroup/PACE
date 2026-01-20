const FormError = ({ message }) => {
  if (!message) return null;

  return (
    <div className="mt-2 text-xs text-text-danger">
      {message}
    </div>
  );
};

export default FormError;
