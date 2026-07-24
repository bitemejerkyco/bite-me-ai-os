type DataTableProps = {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  emptyMessage: string;
};

export default function DataTable({ title, columns, rows, emptyMessage }: DataTableProps) {
  return (
    <section className="rounded-xl border border-red-500/25 bg-zinc-900/80 p-4">
      <h3 className="mb-3 text-lg font-semibold text-zinc-100">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-300">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-zinc-200">
            <thead>
              <tr className="border-b border-zinc-700 text-xs uppercase tracking-wide text-zinc-400">
                {columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                  {row.map((cell, cellIndex) => (
                    <td key={`${title}-${rowIndex}-${cellIndex}`} className="px-3 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
