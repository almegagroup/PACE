const BaseButton = ({
  children,
  type = "button",
  disabled = false,
  variant = "primary",
  onClick,
}) => {
  const base =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition duration-normal focus:outline-none";

  const variants = {
    primary:
      "bg-bronze-400 text-black hover:bg-bronze-300 disabled:opacity-50",
    ghost:
      "bg-transparent text-text-primary hover:bg-bg-sunken disabled:opacity-50",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant]}`}
    >
      {children}
    </button>
  );
};

export default BaseButton;
