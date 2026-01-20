const BaseInput = ({
  type = "text",
  placeholder,
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className="
        w-full rounded-md
        bg-bg-sunken text-text-primary
        border border-border-subtle
        px-3 py-2 text-sm
        placeholder:text-text-muted
        focus:border-bronze-400 focus:shadow-focus
        disabled:opacity-50
        outline-none
      "
    />
  );
};

export default BaseInput;
