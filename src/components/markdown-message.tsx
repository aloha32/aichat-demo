"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, href }) => (
          <a
            className="font-medium text-teal-700 underline decoration-teal-300 underline-offset-4 transition hover:text-teal-900"
            href={href}
            rel="noreferrer"
            target="_blank"
          >
            {children}
          </a>
        ),
        code: ({ children, className }) => {
          const text = String(children).replace(/\n$/, "");
          const isBlock = Boolean(className) || text.includes("\n");

          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded-2xl bg-slate-950/95 px-4 py-3 font-mono text-[0.85rem] leading-6 text-slate-100">
                {text}
              </code>
            );
          }

          return (
            <code className="rounded-md bg-slate-900/8 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-900">
              {text}
            </code>
          );
        },
        ol: ({ children }) => <ol className="ml-5 list-decimal space-y-2">{children}</ol>,
        p: ({ children }) => <p className="mb-4 leading-7 last:mb-0">{children}</p>,
        pre: ({ children }) => <pre className="mb-4 last:mb-0">{children}</pre>,
        ul: ({ children }) => <ul className="ml-5 list-disc space-y-2">{children}</ul>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
