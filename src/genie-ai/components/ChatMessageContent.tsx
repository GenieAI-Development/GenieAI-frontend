import type { ReactNode } from "react";
import { stripModelThinking } from "@/lib/aiPayload";

function InlineText({ value }: { value: string }) {
  return value
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        <span key={index}>{part}</span>
      ),
    );
}

export function ChatMessageContent({ content }: { content: string }) {
  const lines = stripModelThinking(content)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const cellsFromRow = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  const elements: ReactNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1];
    const isTableStart =
      line.includes("|") && Boolean(nextLine?.match(/^\|?[\s:-]+\|[\s|:-]+$/));

    if (isTableStart) {
      const headers = cellsFromRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|")) {
        rows.push(cellsFromRow(lines[index]));
        index += 1;
      }
      index -= 1;
      elements.push(
        <div
          key={`table-${index}`}
          className="max-w-full overflow-x-auto rounded-xl border border-[#D7E2EF] bg-white"
        >
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-[#E7EEF7] text-[#0B2748]">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="border-b border-[#D7E2EF] px-3 py-2 font-bold break-words [overflow-wrap:anywhere]"
                  >
                    <InlineText value={header} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${rowIndex}-${cellIndex}`}
                      className="border-b border-[#E4E1D8] px-3 py-2 align-top break-words [overflow-wrap:anywhere]"
                    >
                      <InlineText value={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    const numberedMatch = line.match(/^\d+[.)]\s+(.+)/);
    elements.push(
      bulletMatch || numberedMatch ? (
        <div
          key={`${line}-${index}`}
          className="flex min-w-0 gap-2 break-words [overflow-wrap:anywhere]"
        >
          <span className="mt-[0.55rem] h-1.5 w-1.5 flex-none rounded-full bg-current opacity-60" />
          <span>
            <InlineText
              value={bulletMatch?.[1] ?? numberedMatch?.[1] ?? line}
            />
          </span>
        </div>
      ) : (
        <p
          key={`${line}-${index}`}
          className="break-words [overflow-wrap:anywhere]"
        >
          <InlineText value={line} />
        </p>
      ),
    );
  }

  return (
    <div className="grid min-w-0 gap-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {elements}
    </div>
  );
}
