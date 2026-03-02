import React from "react";

type Props = {
  content: string;
  className?: string;
};

const INLINE_TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|<u>.*?<\/u>|\[[^\]]+\]\((?:https?:\/\/|\/)[^)]+\))/g;

function renderAutoCodeTokens(text: string) {
  const PATH_TOKEN = /((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9]+)/g;
  const parts = text.split(PATH_TOKEN).filter((p) => p.length > 0);

  return parts.map((part, idx) => {
    if (PATH_TOKEN.test(part)) {
      PATH_TOKEN.lastIndex = 0;
      return (
        <code key={idx} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em]">
          {part}
        </code>
      );
    }
    PATH_TOKEN.lastIndex = 0;
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderInline(text: string) {
  const parts = text.split(INLINE_TOKEN).filter(Boolean);

  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em]">
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("__") && part.endsWith("__")) {
      return <u key={idx}>{part.slice(2, -2)}</u>;
    }

    if (part.startsWith("~~") && part.endsWith("~~")) {
      return <s key={idx}>{part.slice(2, -2)}</s>;
    }

    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }

    if (part.startsWith("<u>") && part.endsWith("</u>")) {
      return <u key={idx}>{part.slice(3, -4)}</u>;
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      return (
        <a
          key={idx}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noreferrer" : undefined}
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {label}
        </a>
      );
    }

    return <React.Fragment key={idx}>{renderAutoCodeTokens(part)}</React.Fragment>;
  });
}

function isLikelyCodeLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^(#{1,6}\s|>\s|[-*•]\s|\d+[.)]\s|```)/.test(t)) return false;
  if (/^[A-Z][A-Za-z ]{2,40}:\s+/.test(t)) return false;

  if (/^(import|export|const|let|var|function|class|interface|type|enum|return|if|for|while|try|catch)\b/.test(t)) return true;
  if (/\bexport\s+(interface|type|class|const|function|enum)\b/.test(t)) return true;
  if (/=>/.test(t)) return true;
  if (/[{};]$/.test(t)) return true;
  if (/^\w+\s*[=:]\s*[{[(]/.test(t)) return true;
  if (/^\s*<\/?[A-Za-z][^>]*>\s*$/.test(t)) return true;
  if (/[{].*[}]/.test(t) && /;/.test(t)) return true;

  return false;
}

const MarkdownBlock = ({ content, className }: Props) => {
  const normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    // Convert "steps: - item" into a heading + list for readability
    .replace(/^(\s*[A-Za-z ]{2,30}:\s*)-\s+/gim, "$1\n- ")
    // Ensure consecutive "Step N:" tokens become separate lines
    .replace(/(Step\s+\d+:)/g, "\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const lines = normalized.split("\n");
  const blocks: React.ReactNode[] = [];

  let inCode = false;
  let codeLang = "";
  let codeBuffer: string[] = [];
  let autoCodeBuffer: string[] = [];
  let ulBuffer: string[] = [];
  let olBuffer: Array<{ n: number; text: string }> = [];

  const flushUl = (key: string) => {
    if (!ulBuffer.length) return;
    blocks.push(
      <ul key={`ul-${key}`} className="mb-3 list-disc pl-5 space-y-1.5">
        {ulBuffer.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    ulBuffer = [];
  };

  const flushOl = (key: string) => {
    if (!olBuffer.length) return;
    const start = olBuffer[0].n > 0 ? olBuffer[0].n : 1;
    blocks.push(
      <ol key={`ol-${key}`} start={start} className="mb-3 list-decimal pl-5 space-y-2">
        {olBuffer.map((item, i) => (
          <li key={i} className="font-semibold">
            <span className="font-semibold">
              {(() => {
                const m = item.text.match(/^(Step\s+\d+:)\s*(.*)$/i);
                if (!m) return renderInline(item.text);
                return (
                  <>
                    <strong>{m[1]}</strong>{m[2] ? <> {renderInline(m[2])}</> : null}
                  </>
                );
              })()}
            </span>
          </li>
        ))}
      </ol>
    );
    olBuffer = [];
  };

  const flushCode = (key: string) => {
    if (!codeBuffer.length) return;
    blocks.push(
      <div key={`code-wrap-${key}`} className="mb-4 overflow-hidden rounded-lg border border-border/60 bg-black/35">
        <div className="border-b border-border/50 px-3 py-1.5 text-[11px] font-mono text-muted-foreground">
          {codeLang || "code"}
        </div>
        <pre className="overflow-x-auto p-3 text-xs leading-6 font-mono">
          <code>{codeBuffer.join("\n")}</code>
        </pre>
      </div>
    );
    codeBuffer = [];
    codeLang = "";
  };

  const flushAutoCode = (key: string) => {
    if (!autoCodeBuffer.length) return;
    blocks.push(
      <div key={`autocode-wrap-${key}`} className="mb-4 overflow-hidden rounded-lg border border-border/60 bg-black/35">
        <div className="border-b border-border/50 px-3 py-1.5 text-[11px] font-mono text-muted-foreground">
          code
        </div>
        <pre className="overflow-x-auto p-3 text-xs leading-6 font-mono">
          <code>{autoCodeBuffer.join("\n")}</code>
        </pre>
      </div>
    );
    autoCodeBuffer = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    const codeStart = trimmed.match(/^```\s*([a-zA-Z0-9_+-]*)\s*$/);
    if (codeStart) {
      flushUl(String(i));
      flushOl(String(i));
      flushAutoCode(String(i));

      if (inCode) {
        flushCode(String(i));
        inCode = false;
      } else {
        inCode = true;
        codeLang = codeStart[1] || "";
      }
      return;
    }

    if (inCode) {
      codeBuffer.push(line);
      return;
    }

    if (!trimmed) {
      const nextNonEmpty = lines.slice(i + 1).find((l) => l.trim().length > 0) || "";
      const continuesOl = /^\s*\d+[.)]\s+/.test(nextNonEmpty);
      const continuesUl = /^\s*[-*•]\s+/.test(nextNonEmpty);
      if (continuesOl || continuesUl) return;
      flushUl(String(i));
      flushOl(String(i));
      flushAutoCode(String(i));
      return;
    }

    const ul = line.match(/^\s*[-*•]\s+(.+)$/);
    if (ul) {
      flushOl(String(i));
      flushAutoCode(String(i));
      ulBuffer.push(ul[1]);
      return;
    }

    const ol = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (ol) {
      flushUl(String(i));
      flushAutoCode(String(i));
      olBuffer.push({ n: Number(ol[1]), text: ol[2] });
      return;
    }

    if (isLikelyCodeLine(line)) {
      flushUl(String(i));
      flushOl(String(i));
      autoCodeBuffer.push(line);
      return;
    }

    flushUl(String(i));
    flushOl(String(i));
    flushAutoCode(String(i));

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${i}`} className="my-4 border-border/60" />);
      return;
    }

    if (line.startsWith("#### ")) {
      blocks.push(<h4 key={`h4-${i}`} className="mt-4 mb-2 text-sm font-semibold">{renderInline(line.slice(5))}</h4>);
      return;
    }
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={`h3-${i}`} className="mt-4 mb-2 text-base font-semibold">{renderInline(line.slice(4))}</h3>);
      return;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={`h2-${i}`} className="mt-5 mb-2 text-lg font-semibold">{renderInline(line.slice(3))}</h2>);
      return;
    }
    if (line.startsWith("# ")) {
      blocks.push(<h1 key={`h1-${i}`} className="mt-5 mb-3 text-xl font-semibold">{renderInline(line.slice(2))}</h1>);
      return;
    }

    const labeledHeading = line.match(/^([A-Z][A-Za-z ]{2,40}):\s*(.+)$/);
    if (labeledHeading) {
      const [, label, rest] = labeledHeading;
      blocks.push(<h3 key={`label-h-${i}`} className="mt-4 mb-2 text-base font-semibold">{renderInline(label)}</h3>);
      if (rest.trim()) {
        blocks.push(
          <p key={`label-p-${i}`} className="mb-3 leading-7 text-[0.98rem]">
            {renderInline(rest)}
          </p>
        );
      }
      return;
    }

    if (/^[A-Z][A-Za-z ]{2,40}$/.test(trimmed)) {
      blocks.push(<h3 key={`plain-h-${i}`} className="mt-4 mb-2 text-base font-semibold">{renderInline(trimmed)}</h3>);
      return;
    }

    if (line.startsWith("> ")) {
      blocks.push(
        <blockquote key={`bq-${i}`} className="mb-3 border-l-2 border-primary/45 pl-3 italic text-muted-foreground">
          {renderInline(line.slice(2))}
        </blockquote>
      );
      return;
    }

    blocks.push(
      <p key={`p-${i}`} className="mb-3 leading-7 text-[0.98rem]">
        {renderInline(line)}
      </p>
    );
  });

  flushUl("end");
  flushOl("end");
  if (inCode) flushCode("end");
  flushAutoCode("end");

  return <div className={className}>{blocks}</div>;
};

export default MarkdownBlock;
