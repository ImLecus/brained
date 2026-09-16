import { Component, createElement } from "react";
import type { ReactNode } from "react";
import { LinkIcon } from "../LinkIcon";

const INLINE_PATTERN =
  /(\[\[[^\[\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/;

function phrase(
  text: string,
  onNavigate?: (target: string) => void,
): ReactNode[] {
  const match = text.match(INLINE_PATTERN);
  if (!match) {
    return [text];
  }
  const token = match[0];
  const before = text.slice(0, match.index);
  const after = text.slice((match.index ?? 0) + token.length);
  const key = `${match.index}-${token.length}`;
  let node: ReactNode = token;
  if (token.startsWith("[[") && token.endsWith("]]")) {
    const inner = token.slice(2, -2);
    const parts = inner.split("|");
    const reference = parts[0].trim();
    const label = parts.length > 1 ? parts[1].trim() : reference;
    node = (
      <button
        type="button"
        className="wikilink"
        onClick={() => onNavigate?.(reference)}
      >
        <LinkIcon />
        <strong>{label}</strong>
      </button>
    );
  } else if (token.startsWith("**")) {
    node = <strong>{token.slice(2, -2)}</strong>;
  } else if (token.startsWith("*")) {
    node = <em>{token.slice(1, -1)}</em>;
  } else if (token.startsWith("`")) {
    node = <code>{token.slice(1, -1)}</code>;
  } else if (token.startsWith("[")) {
    const link = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
    node = link ? (
      <a href={link[2]} target="_blank" rel="noreferrer">
        {link[1]}
      </a>
    ) : (
      token
    );
  }
  return [before, node, ...phrase(after)];
}

function Heading({
  level,
  text,
  onNavigate,
}: {
  level: number;
  text: string;
  onNavigate?: (target: string) => void;
}) {
  return createElement(`h${level}`, null, phrase(text, onNavigate));
}

export interface MarkdownRendererProps {
  text: string;
  onNavigate?: (target: string) => void;
}

export class MarkdownRenderer extends Component<MarkdownRendererProps> {
  render(): ReactNode {
    const { text, onNavigate } = this.props;
    const source = text.replace(/\r\n?/g, "\n");
    const lines = source.split("\n");
    const blocks: ReactNode[] = [];
    let paragraph: string[] = [];

    const flushParagraph = () => {
      if (paragraph.length === 0) {
        return;
      }
      blocks.push(
        <p key={`p-${blocks.length}`}>{phrase(paragraph.join("\n"), onNavigate)}</p>,
      );
      paragraph = [];
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushParagraph();
        blocks.push(
          <Heading
            key={`h-${blocks.length}`}
            level={heading[1].length}
            text={heading[2]}
            onNavigate={onNavigate}
          />,
        );
        continue;
      }

      if (line.startsWith("```")) {
        flushParagraph();
        const items: string[] = [];
        index += 1;
        while (index < lines.length && !lines[index].startsWith("```")) {
          items.push(lines[index]);
          index += 1;
        }
        blocks.push(
          <pre key={`c-${blocks.length}`}>
            <code>{items.join("\n")}</code>
          </pre>,
        );
        continue;
      }

      const listItem = line.match(/^\s*[-*+]\s+(.*)$/);
      if (listItem) {
        flushParagraph();
        const items = [{ text: listItem[1] }];
        while (index + 1 < lines.length && /^[-*+]\s+/.test(lines[index + 1])) {
          index += 1;
          items.push({ text: lines[index].replace(/^[-*+]\s+/, "") });
        }
        blocks.push(
          <ul key={`u-${blocks.length}`}>
            {items.map((item, itemIndex) => (
              <li key={itemIndex}>{phrase(item.text, onNavigate)}</li>
            ))}
          </ul>,
        );
        continue;
      }

      const quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        blocks.push(
          <blockquote key={`q-${blocks.length}`}>
            {phrase(quote[1], onNavigate)}
          </blockquote>,
        );
        continue;
      }

      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
        flushParagraph();
        blocks.push(<hr key={`r-${blocks.length}`} />);
        continue;
      }

      if (line.trim().length === 0) {
        flushParagraph();
        continue;
      }

      paragraph.push(line);
    }
    flushParagraph();

    return <div>{blocks}</div>;
  }
}