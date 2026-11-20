import {
  forwardRef,
  type TableHTMLAttributes,
  type HTMLAttributes,
} from 'react';
import { cn } from '@/utils/cn';
import type { ThHTMLAttributes, TdHTMLAttributes } from 'react';

interface TableProps extends Omit<TableHTMLAttributes<HTMLTableElement>, 'size'> {
  caption?: string;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(({ caption, className, ...rest }, ref) => (
  <div className="w-full overflow-auto">
    <table ref={ref} className={cn('w-full text-sm', className)} {...rest}>
      {caption && <caption className="mb-2 text-left text-sm font-medium text-ink-main dark:text-violet-50">{caption}</caption>}
      {rest.children}
    </table>
  </div>
));
Table.displayName = 'Table';

interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}
export const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(({ className, ...rest }, ref) => (
  <thead ref={ref} className={cn('text-xs text-ink-secondary dark:text-violet-200/70 uppercase tracking-wider', className)} {...rest} />
));
TableHeader.displayName = 'TableHeader';

interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}
export const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(({ className, ...rest }, ref) => (
  <tbody ref={ref} className={cn(className)} {...rest} />
));
TableBody.displayName = 'TableBody';

interface TableFooterProps extends HTMLAttributes<HTMLTableSectionElement> {}
export const TableFooter = forwardRef<HTMLTableSectionElement, TableFooterProps>(({ className, ...rest }, ref) => (
  <tfoot ref={ref} className={cn(className)} {...rest} />
));
TableFooter.displayName = 'TableFooter';

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {}
export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(({ className, ...rest }, ref) => (
  <tr ref={ref} className={cn('border-b border-border dark:border-violet-800/30 hover:bg-violet-50 dark:bg-violet-900/20', className)} {...rest} />
));
TableRow.displayName = 'TableRow';

interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {}
export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(({ className, ...rest }, ref) => (
  <th ref={ref} className={cn('px-4 py-3 text-left font-medium text-ink-secondary dark:text-violet-200/70', className)} {...rest} />
));
TableHead.displayName = 'TableHead';

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {}
export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(({ className, ...rest }, ref) => (
  <td ref={ref} className={cn('px-4 py-3 text-ink-main dark:text-violet-50', className)} {...rest} />
));
TableCell.displayName = 'TableCell';
