import type { ReactNode } from "react";
import { cx } from "./cx";

export type TableColumn<T> = {
  key: string;
  header: ReactNode;
  /** "end" for numbers (tabular figures, right-aligned in LTR). */
  align?: "start" | "end";
  /** Cell content. Defaults to row[key]. */
  render?: (row: T) => ReactNode;
};

export type TableProps<T> = {
  columns: TableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Describes the table for screen readers; shown above it. */
  caption?: ReactNode;
  /** Key of the selected row, tinted with primary-soft. */
  selectedKey?: string;
  /** Shown in place of rows when there are none. */
  emptyMessage?: ReactNode;
  className?: string;
};

/**
 * Data table built from design system tokens: label headers on surface-alt,
 * small-text cells, line dividers, primary-soft for the selected row.
 * Scrolls horizontally inside its frame on narrow screens, never the page.
 */
export function Table<T>({
  columns,
  rows,
  getRowKey,
  caption,
  selectedKey,
  emptyMessage,
  className,
}: TableProps<T>) {
  return (
    <div className={cx("ld-table-frame", className)}>
      <table className="ld-table">
        {caption && <caption className="ld-table-caption">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(column.align === "end" && "is-end")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && emptyMessage ? (
            <tr>
              <td colSpan={columns.length} className="ld-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = getRowKey(row);
              const selected = key === selectedKey;
              return (
                <tr
                  key={key}
                  aria-selected={selected || undefined}
                  className={cx(selected && "is-selected")}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cx(column.align === "end" && "is-end")}
                    >
                      {column.render
                        ? column.render(row)
                        : String(
                            (row as Record<string, unknown>)[column.key] ?? "",
                          )}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
