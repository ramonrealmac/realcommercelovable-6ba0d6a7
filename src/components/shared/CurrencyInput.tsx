import React, { useEffect, useState } from "react";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number;
  onChange: (val: number) => void;
  decimals?: number;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, decimals = 2, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState("");

    useEffect(() => {
      const formatted = (value ?? 0).toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      setDisplayValue(formatted);
    }, [value, decimals]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const digits = val.replace(/\D/g, "");
      const factor = Math.pow(10, decimals);
      const num = digits ? parseInt(digits, 10) / factor : 0;
      
      const formatted = num.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      setDisplayValue(formatted);
      onChange(num);

      const input = e.target;
      setTimeout(() => {
        input.setSelectionRange(formatted.length, formatted.length);
      }, 0);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select();
      if (props.onFocus) props.onFocus(e);
    };

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
