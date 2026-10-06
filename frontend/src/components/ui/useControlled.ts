"use client";

import { useState } from "react";

/** State that can be controlled (`value`) or uncontrolled (`defaultValue`). */
export function useControlled<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T) => void] {
  const [internal, setInternal] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  function set(next: T) {
    if (!controlled) setInternal(next);
    onChange?.(next);
  }

  return [current, set];
}
