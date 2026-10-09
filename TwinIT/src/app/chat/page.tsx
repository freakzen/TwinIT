"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Bot,
  BrainCircuit,
  ChartNoAxesCombined,
  CircleAlert,
  LoaderCircle,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Coverage = {
  historicalMonths: number;
  transactions: number;
  products: number;
  expenses: number;
};

const suggestions = [
  {
    icon: ChartNoAxesCombined,
    title: "Analyze my profitability",
    prompt:
      "Analyze my current revenue, expenses, profit and margin. What are the top 3 actions I should prioritize?",
  },
  {
    icon: Sparkles,
    title: "How can I grow safely?",
    prompt:
      "Suggest three growth scenarios for my business. State assumptions, risks, and the KPIs I should track.",
  },
  {
    icon: BrainCircuit,
    title: "What data is missing?",
    prompt:
      "Assess the business data available to you. What important data is missing to make more reliable forecasts? Prioritize what I should start tracking.",
  },
];

export default function ChatPage() {
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState("your business");
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [pageError, setPageError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadBusiness() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace("/");
        return;
      }

      const { data: business } = await supabase
        .from("businesses")
        .select("name")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!business) {
        router.replace("/onboarding");
        return;
      }

      if (active) {
        setBusinessName(business.name || "your business");
      }
    }

    void loadBusiness();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(
    event?: FormEvent<HTMLFormElement>,
    suggested?: string,
  ) {
    event?.preventDefault();

    const question = (suggested ?? input).trim();

    if (!question || loading) return;

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: question },
    ];

    setMessages(nextMessages);
    setInput("");
    setPageError("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: question,
          history: messages.slice(-10),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not reach the AI analyst.",
        );
      }

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: result.answer,
        },
      ]);

      setCoverage(result.dataCoverage ?? null);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function resetChat() {
    setMessages([]);
    setPageError("");
    setCoverage(null);
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="eyebrow">WORKSPACE / AI ANALYST</span>
            <h1>Business AI analyst</h1>
          </div>

          <div className="topbar-actions">
            <span className="date-pill">
              <span className="status-dot" />
              Groq-powered analysis
            </span>

            <button className="small-outline" onClick={resetChat}>
              <Plus size={14} />
              New chat
            </button>
          </div>
        </header>

        <div className="page-content ai-page">
          <section className="feature-hero">
            <div className="feature-hero-icon">
              <BrainCircuit size={24} />
            </div>

            <div>
              <span className="section-kicker">TWININTELLIGENCE</span>
              <h2>Ask your business twin</h2>
              <p>
                Analyze {businessName}, explore decisions, and understand
                what your data can—and cannot—tell you.
              </p>
            </div>
          </section>

          <div className="ai-layout">
            <section className="panel chat-panel">
              <div className="chat-heading">
                <div className="assistant-avatar">
                  <Bot size={20} />
                </div>

                <div>
                  <b>TwinIT Analyst</b>
                  <small>
                    Uses your private business context · Verify important
                    decisions
                  </small>
                </div>

                <span className="chat-live">
                  <i /> Online
                </span>
              </div>

              <div className="chat-transcript" aria-live="polite">
                {messages.length === 0 ? (
                  <div className="chat-welcome">
                    <div className="welcome-orb">
                      <Sparkles size={27} />
                    </div>

                    <h3>Let&apos;s understand your business.</h3>

                    <p>
                      Ask about profitability, costs, growth opportunities
                      or the data you need for better forecasts.
                    </p>

                    <div className="suggestion-grid">
                      {suggestions.map(
                        ({ icon: Icon, title, prompt }) => (
                          <button
                            key={title}
                            className="suggestion-card"
                            onClick={() => void send(undefined, prompt)}
                            disabled={loading}
                          >
                            <Icon size={17} />
                            <b>{title}</b>
                            <span>{prompt}</span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={`${index}-${message.role}`}
                      className={`chat-message ${message.role}`}
                    >
                      <span className="message-avatar">
                        {message.role === "assistant" ? (
                          <Bot size={16} />
                        ) : (
                          <UserRound size={16} />
                        )}
                      </span>

                      <div className="message-bubble">
                        <div className="message-role">
                          {message.role === "assistant"
                            ? "TWINIT ANALYST"
                            : "YOU"}
                        </div>

                        {message.role === "assistant" ? (
                          <div className="markdown-content">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ children }) => (
                                  <h1 className="md-h1">{children}</h1>
                                ),
                                h2: ({ children }) => (
                                  <h2 className="md-h2">{children}</h2>
                                ),
                                h3: ({ children }) => (
                                  <h3 className="md-h3">{children}</h3>
                                ),
                                p: ({ children }) => (
                                  <p className="md-p">{children}</p>
                                ),
                                strong: ({ children }) => (
                                  <strong className="md-strong">
                                    {children}
                                  </strong>
                                ),
                                ul: ({ children }) => (
                                  <ul className="md-ul">{children}</ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="md-ol">{children}</ol>
                                ),
                                li: ({ children }) => (
                                  <li className="md-li">{children}</li>
                                ),
                                blockquote: ({ children }) => (
                                  <blockquote className="md-quote">
                                    {children}
                                  </blockquote>
                                ),
                                table: ({ children }) => (
                                  <div className="md-table-wrap">
                                    <table className="md-table">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                thead: ({ children }) => (
                                  <thead className="md-thead">
                                    {children}
                                  </thead>
                                ),
                                th: ({ children }) => (
                                  <th className="md-th">{children}</th>
                                ),
                                td: ({ children }) => (
                                  <td className="md-td">{children}</td>
                                ),
                                hr: () => <hr className="md-hr" />,
                                a: ({ children, href }) => (
                                  <a
                                    className="md-link"
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {children}
                                  </a>
                                ),
                                code: ({ children }) => (
                                  <code className="md-code">{children}</code>
                                ),
                                pre: ({ children }) => (
                                  <pre className="md-pre">{children}</pre>
                                ),
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="user-message-text">
                            {message.content}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {loading && (
                  <div className="chat-message assistant">
                    <span className="message-avatar">
                      <Bot size={16} />
                    </span>

                    <div className="message-bubble">
                      <div className="message-role">
                        ANALYZING BUSINESS DATA
                      </div>

                      <p className="thinking">
                        <LoaderCircle size={15} />
                        Reviewing your business context…
                      </p>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {pageError && (
                <div className="chat-error" role="alert">
                  <CircleAlert size={16} />
                  <span>{pageError}</span>
                </div>
              )}

              <form
                className="chat-composer"
                onSubmit={(event) => void send(event)}
              >
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Ask a question about your business…"
                  maxLength={4000}
                  rows={2}
                  aria-label="Ask TwinIT analyst"
                />

                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                >
                  {loading ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <ArrowUp size={19} />
                  )}
                </button>

                <small>Enter to send · Shift + Enter for a new line</small>
              </form>
            </section>

            <aside className="ai-side-column">
              <section className="panel ai-info-card">
                <span className="section-kicker">DATA COVERAGE</span>
                <h3>What the analyst can see</h3>
                <p>
                  It retrieves your business profile plus historical records
                  saved in your private workspace.
                </p>

                <div className="coverage-list">
                  {[
                    {
                      label: "Monthly history",
                      value: coverage?.historicalMonths ?? 0,
                      unit: "months",
                    },
                    {
                      label: "Transactions",
                      value: coverage?.transactions ?? 0,
                      unit: "records",
                    },
                    {
                      label: "Products / stock",
                      value: coverage?.products ?? 0,
                      unit: "items",
                    },
                    {
                      label: "Expense records",
                      value: coverage?.expenses ?? 0,
                      unit: "records",
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <span>{item.label}</span>
                      <b>
                        {item.value} <small>{item.unit}</small>
                      </b>
                    </div>
                  ))}
                </div>

                <p className="coverage-note">
                  Counts update after the first answer. Zero means no records
                  were returned for that data type.
                </p>
              </section>

              <section className="panel ai-info-card">
                <span className="section-kicker">PREDICTION QUALITY</span>
                <h3>More real data. Better evidence.</h3>
                <p>
                  Groq provides the reasoning and explanation. It does not
                  automatically make predictions accurate. Reliable
                  forecasts need dated historical observations.
                </p>

                <ul className="data-checklist">
                  <li>Record monthly revenue and costs</li>
                  <li>Track sales and product quantities</li>
                  <li>Record marketing spend and outcomes</li>
                  <li>Log stock, returns and seasonality</li>
                </ul>
              </section>

              <div className="ai-disclaimer">
                AI-generated analysis can be wrong. Treat projections as
                estimates and validate high-impact decisions against your
                records.
              </div>
            </aside>
          </div>

          <footer className="page-footer">
            TwinIT <span>·</span> Simulate smarter. Decide better.
            <span className="footer-right">
              Private, user-scoped business context
            </span>
          </footer>
        </div>
      </main>

      <style jsx global>{`
        .markdown-content {
          min-width: 0;
          color: inherit;
          font-size: 0.925rem;
          line-height: 1.75;
          overflow-wrap: anywhere;
        }

        .markdown-content .md-p {
          margin: 0.55rem 0;
          white-space: normal;
        }

        .markdown-content .md-p:first-child {
          margin-top: 0;
        }

        .markdown-content .md-p:last-child {
          margin-bottom: 0;
        }

        .markdown-content .md-h1,
        .markdown-content .md-h2,
        .markdown-content .md-h3 {
          color: inherit;
          font-weight: 700;
          line-height: 1.4;
        }

        .markdown-content .md-h1 {
          margin: 1.1rem 0 0.6rem;
          font-size: 1.35rem;
        }

        .markdown-content .md-h2 {
          margin: 1rem 0 0.5rem;
          font-size: 1.15rem;
        }

        .markdown-content .md-h3 {
          margin: 0.85rem 0 0.4rem;
          font-size: 1rem;
        }

        .markdown-content .md-strong {
          color: inherit;
          font-weight: 700;
        }

        .markdown-content .md-ul,
        .markdown-content .md-ol {
          margin: 0.55rem 0;
          padding-left: 1.5rem;
        }

        .markdown-content .md-ul {
          list-style: disc;
        }

        .markdown-content .md-ol {
          list-style: decimal;
        }

        .markdown-content .md-li {
          margin: 0.25rem 0;
          padding-left: 0.15rem;
        }

        .markdown-content .md-quote {
          margin: 0.8rem 0;
          border-left: 3px solid #94a3b8;
          padding-left: 0.85rem;
          color: #64748b;
        }

        .markdown-content .md-table-wrap {
          width: 100%;
          margin: 0.9rem 0;
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 0.6rem;
        }

        .markdown-content .md-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.85rem;
        }

        .markdown-content .md-th {
          padding: 0.65rem 0.8rem;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          font-weight: 700;
          white-space: nowrap;
        }

        .markdown-content .md-td {
          padding: 0.65rem 0.8rem;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
        }

        .markdown-content .md-table tr:last-child .md-td {
          border-bottom: none;
        }

        .markdown-content .md-hr {
          margin: 1rem 0;
          border: 0;
          border-top: 1px solid #e2e8f0;
        }

        .markdown-content .md-link {
          color: #2563eb;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .markdown-content .md-code {
          border-radius: 0.25rem;
          background: #f1f5f9;
          padding: 0.12rem 0.3rem;
          font-size: 0.85em;
          overflow-wrap: anywhere;
        }

        .markdown-content .md-pre {
          margin: 0.75rem 0;
          overflow-x: auto;
          border-radius: 0.5rem;
          background: #f1f5f9;
          padding: 0.85rem;
          font-size: 0.85rem;
        }

        .markdown-content .md-pre .md-code {
          padding: 0;
          background: transparent;
        }

        .user-message-text {
          margin: 0;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
      `}</style>
    </div>
  );
}
