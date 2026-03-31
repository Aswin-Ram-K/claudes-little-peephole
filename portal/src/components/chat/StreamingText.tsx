"use client";

import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
  className?: string;
}

export function StreamingText({ text, isStreaming, className }: StreamingTextProps) {
  return (
    <div className={cn("text-sm text-text-primary", className)}>
      <ReactMarkdown
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || "");

            // Skip config-change blocks — handled by ConfigDiffPreview
            if (match && match[1] === "config-change") {
              return null;
            }

            // Block code: has a language class (rendered inside <pre> by markdown)
            if (match) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: "0.5rem 0",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                    background: "#1a1a2e",
                  }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              );
            }

            // Inline code
            return (
              <code
                className="bg-bg-surface px-1.5 py-0.5 rounded text-xs font-mono text-accent-indigo"
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-text-secondary">{children}</li>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-text-primary">{children}</strong>;
          },
          a({ href, children }) {
            return (
              <a href={href} className="text-accent-indigo hover:underline" target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-accent-indigo/50 pl-3 my-2 text-text-secondary italic">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-accent-indigo animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  );
}
