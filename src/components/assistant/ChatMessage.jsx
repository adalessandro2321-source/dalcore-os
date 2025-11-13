
import React from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, Loader2, GitMerge, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import CitationChip from "./CitationChip";

export default function ChatMessage({ message, isStreaming = false }) {
  const [copied, setCopied] = React.useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-8 w-8 rounded-lg bg-[#0E351F] flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-semibold">AI</span>
        </div>
      )}

      <div className={cn("max-w-[85%]", isUser && "flex flex-col items-end")}>
        {/* Research Mode Badge */}
        {message.mode && message.mode !== 'Company' && !isUser && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#E8E7DD] border border-[#C9C8AF] rounded-md text-xs text-[#5A7765]">
              {message.mode === 'Blended' ? (
                <>
                  <GitMerge className="w-3 h-3" />
                  Blended Research
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3" />
                  {/* Display "Web Research (Filtered)" if message.mode indicates filtering, otherwise "Web Research" */}
                  {message.mode === 'Web_Filtered' ? 'Web Research (Filtered)' : 'Web Research'}
                </>
              )}
            </span>
          </div>
        )}

        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-[#0E351F] text-white"
              : "bg-[#F5F4F3] border border-[#C9C8AF]"
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="relative group">
              <ReactMarkdown
                className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                components={{
                  code: ({ inline, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="relative group/code my-2">
                        <pre className="bg-[#181E18] text-gray-100 rounded-lg p-3 overflow-x-auto">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover/code:opacity-100 bg-[#3B5B48] hover:bg-[#5A7765]"
                          onClick={() => {
                            navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                          }}
                        >
                          <Copy className="h-3 w-3 text-white" />
                        </Button>
                      </div>
                    ) : (
                      <code className="px-1.5 py-0.5 rounded bg-[#E8E7DD] text-[#181E18] text-xs font-mono">
                        {children}
                      </code>
                    );
                  },
                  a: ({ children, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" className="text-[#0E351F] hover:underline">
                      {children}
                    </a>
                  ),
                  p: ({ children }) => <p className="my-2 leading-relaxed text-[#181E18]">{children}</p>,
                  ul: ({ children }) => <ul className="my-2 ml-4 list-disc text-[#181E18]">{children}</ul>,
                  ol: ({ children }) => <ol className="my-2 ml-4 list-decimal text-[#181E18]">{children}</ol>,
                  li: ({ children }) => <li className="my-1 text-[#181E18]">{children}</li>,
                  h1: ({ children }) => <h1 className="text-xl font-semibold my-3 text-[#181E18]">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-semibold my-2 text-[#181E18]">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-semibold my-2 text-[#181E18]">{children}</h3>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-[#C9C8AF] pl-4 my-2 text-[#5A7765] italic">
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full divide-y divide-[#C9C8AF]">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 bg-[#E8E7DD] text-left text-xs font-semibold text-[#181E18]">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 text-sm text-[#181E18] border-t border-[#C9C8AF]">
                      {children}
                    </td>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>

              {!isUser && !isStreaming && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute -right-10 top-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3 text-[#5A7765]" />
                  )}
                </Button>
              )}
            </div>
          )}

          {isStreaming && (
            <div className="flex items-center gap-2 mt-2 text-[#5A7765]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">Thinking...</span>
            </div>
          )}
        </div>

        {/* Citations - Internal and External */}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 space-y-2">
            {/* Internal Citations */}
            {message.citations.filter(c => c.source_type === 'internal').length > 0 && (
              <div>
                <p className="text-xs text-[#5A7765] mb-1">Company Data:</p>
                <div className="flex flex-wrap gap-2">
                  {message.citations
                    .filter(c => c.source_type === 'internal')
                    .map((citation, idx) => (
                      <CitationChip key={idx} citation={citation} />
                    ))}
                </div>
              </div>
            )}
            
            {/* External Citations */}
            {message.citations.filter(c => c.source_type === 'web').length > 0 && (
              <div>
                <p className="text-xs text-[#5A7765] mb-1">External Sources:</p>
                <div className="flex flex-wrap gap-2">
                  {message.citations
                    .filter(c => c.source_type === 'web')
                    .map((citation, idx) => (
                      <CitationChip key={idx} citation={citation} />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions Run */}
        {message.actions_run && message.actions_run.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.actions_run.map((action, idx) => (
              <div
                key={idx}
                className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md border border-green-200"
              >
                ✓ {action.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="h-8 w-8 rounded-lg bg-[#5A7765] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-semibold">You</span>
        </div>
      )}
    </div>
  );
}
