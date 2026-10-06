"use client";

import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { cx } from "./cx";
import { Icon } from "./Icon";

export type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  /** Always show a visible label. A placeholder is an example, not the label. */
  label?: ReactNode;
  type?: string;
  state?: "error" | "success";
  /** Helper, error or success text. Errors say what to do. */
  message?: ReactNode;
};

export function TextField({
  label,
  type = "text",
  state,
  message,
  className,
  disabled,
  id: idProp,
  ...rest
}: TextFieldProps) {
  const t = useTranslations("UI");
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const messageId = `${id}-msg`;
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div
      className={cx(
        "ld-field",
        state && `is-${state}`,
        disabled && "is-disabled",
        className,
      )}
    >
      {label && (
        <label className="ld-field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="ld-field-box">
        <input
          {...rest}
          id={id}
          disabled={disabled}
          className="ld-field-input"
          type={isPassword && visible ? "text" : type}
          aria-invalid={state === "error" || undefined}
          aria-describedby={message ? messageId : undefined}
        />
        {isPassword && (
          <button
            type="button"
            className="ld-field-eye"
            disabled={disabled}
            aria-label={visible ? t("hidePassword") : t("showPassword")}
            onClick={() => setVisible(!visible)}
          >
            <Icon name={visible ? "eye" : "eye-off"} size={18} />
          </button>
        )}
      </div>
      {message && (
        <p id={messageId} className="ld-field-msg">
          {state === "error" && <Icon name="alert" size={16} />}
          {state === "success" && <Icon name="check-circle" size={16} />}
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}
