import type { IssueSignalsInput } from "../logic/analysis.logic.js";

type RankedFile = {
    path: string;
    score?: number;
    signals?: string[];
    snippet: string | null;
    imports?: string[];
    urls?: string[];
};

export type LlmAnalysisResult = {
    root_analysis: string;
    possible_solution: string;
    summary: string;
};

function normalizeMarkdownText(value: string): string {
    return value
        .replace(/\r\n/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, "\"")
        .replace(/```(?:markdown|md)\s*/gi, "```")
        .trim();
}

function extractJsonObject(raw: string): string | null {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    return raw.slice(start, end + 1);
}

function extractSection(text: string, labels: string[]): string | null {
    const lowered = text.toLowerCase();
    for (const label of labels) {
        const idx = lowered.indexOf(label.toLowerCase());
        if (idx !== -1) {
            return text.slice(idx + label.length).trim();
        }
    }
    return null;
}

function normalizeKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function jsonishToMarkdown(input: string): string {
    return input
        .replace(/^[\s,[\]{}]+|[\s,[\]{}]+$/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && line !== "{" && line !== "}" && line !== "[" && line !== "]")
        .map((line) => {
            const cleaned = line.replace(/,$/, "");
            const keyVal = cleaned.match(/^"?(?<k>[A-Za-z0-9_\- ]+)"?\s*:\s*(?<v>.+)$/);
            if (!keyVal?.groups) {
                return cleaned.replace(/^"|"$/g, "");
            }
            const k = keyVal.groups.k;
            const v = keyVal.groups.v
                .replace(/^"|"$/g, "")
                .replace(/\\"/g, "\"");
            return `- **${k}**: ${v}`;
        })
        .join("\n");
}

function toText(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === "string") {
        const text = normalizeMarkdownText(value);
        if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
            try {
                const parsed = JSON.parse(text);
                return toText(parsed);
            } catch {
                return jsonishToMarkdown(text) || text;
            }
        }
        if (/"[A-Za-z0-9_\- ]+"\s*:\s*/.test(text)) {
            return jsonishToMarkdown(text) || text;
        }
        return text;
    }
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) {
        const parts = value
            .map((item) => toText(item))
            .filter((item): item is string => !!item && item.trim().length > 0);
        if (!parts.length) return null;
        return parts.map((p) => `- ${p}`).join("\n");
    }
    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const rows = Object.entries(obj)
            .map(([k, v]) => {
                const val = toText(v);
                return val ? `- **${k}**: ${val}` : null;
            })
            .filter((row): row is string => !!row);
        return rows.length ? rows.join("\n") : null;
    }
    return null;
}

function pick(obj: Record<string, unknown>, aliases: string[]): string | null {
    const normalizedMap = new Map<string, unknown>();
    for (const [key, value] of Object.entries(obj)) {
        normalizedMap.set(normalizeKey(key), value);
    }
    for (const alias of aliases) {
        const hit = normalizedMap.get(normalizeKey(alias));
        const text = toText(hit);
        if (text && text.trim().length) return text;
    }
    return null;
}

function mapArbitraryJsonToLlmResult(parsed: Record<string, unknown>): LlmAnalysisResult {
    const issueIntent = pick(parsed, ["issueintent", "intent", "problemstatement", "issue_summary", "summary"]);
    const expectedBehavior = pick(parsed, ["expectedbehavior", "expected_behaviour", "expected", "desiredbehavior"]);
    const probableRootCause = pick(parsed, ["probablerootcause", "rootcause", "root_analysis", "analysis", "cause"]);
    const impactedAreas = pick(parsed, ["impactedfiles", "affectedfiles", "narrowedfiles", "relevantfiles"]);
    const solution = pick(parsed, ["possible_solution", "solution", "solutionsteps", "fix", "proposedfix", "recommendation", "implementationsteps", "configandrollout", "rollout"]);
    const verification = pick(parsed, ["verification", "validation", "testing", "testplan", "checklist"]);

    const rootSections = [
        issueIntent ? `### Issue Intent\n${issueIntent}` : null,
        expectedBehavior ? `### Expected Behavior\n${expectedBehavior}` : null,
        probableRootCause ? `### Probable Root Cause\n${probableRootCause}` : null,
        impactedAreas ? `### Impacted Areas\n${impactedAreas}` : null,
    ].filter((s): s is string => !!s);

    const solutionSections = [
        solution ? `### Possible Solution\n${solution}` : null,
        verification ? `### Verification\n${verification}` : null,
    ].filter((s): s is string => !!s);

    const root = rootSections.join("\n\n").trim();
    const sol = solutionSections.join("\n\n").trim();
    const fallback = "LLM returned unstructured analysis. Please retry analysis for a cleaner result.";

    return {
        root_analysis: normalizeMarkdownText(root || fallback),
        possible_solution: normalizeMarkdownText(sol || "No solution provided."),
        summary: normalizeMarkdownText(issueIntent || probableRootCause || "Issue analysis generated.").slice(0, 1200),
    };
}

export async function analyzeWithLLM(issue: IssueSignalsInput, rankedFiles: RankedFile[]): Promise<LlmAnalysisResult | null> {
  if (!rankedFiles.length) return null;
    if (!process.env.OPENROUTER_API_KEY) {
        console.warn("OPENROUTER_API_KEY missing; skipping LLM analysis.");
        return null;
    }
    const timeoutMs = Math.max(20_000, Number(process.env.OPENROUTER_TIMEOUT_MS || 60_000));
    const retries = Math.max(0, Number(process.env.OPENROUTER_RETRIES || 2));
    const payload = {
        issue: {
            title: issue.title,
            body: issue.body,
            labels: issue.labels ?? []
        },
        localAnalysis: {
            method: "BM25 lexical ranking + AST symbol extraction + dependency propagation",
            reachedFiles: rankedFiles.slice(0, 8).map((f, index) => ({
                rank: index + 1,
                path: f.path,
                score: f.score ?? null,
                signals: Array.isArray(f.signals) ? f.signals.slice(0, 6) : [],
                imports: Array.isArray(f.imports) ? f.imports.slice(0, 8) : [],
                urls: Array.isArray(f.urls) ? f.urls.slice(0, 8) : [],
            }))
        },
        relevantFiles: rankedFiles.slice(0, 6).map(f => ({
            path: f.path,
            snippet: f.snippet
        }))
    };

    let response: Response | null = null;
    let data: any = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                signal: AbortSignal.timeout(timeoutMs),
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
                },
                body: JSON.stringify({
                    model: "openai/gpt-5-nano",
                    temperature: 0.1,
                    messages: [
                        {
                            role: "system",
                            content:
                                "You are a senior backend engineer. Return ONLY valid JSON with keys root_analysis, possible_solution, summary. root_analysis must clearly explain issue intent, expected behavior, and probable root cause. possible_solution must provide concrete actionable patch steps and verification checklist."
                        },
                        {
                            role: "user",
                            content: [
                                "We already ran local analysis and reached these files.",
                                "Use that evidence, do not ignore it.",
                                JSON.stringify(payload)
                            ].join("\n\n")
                        }
                    ]
                })
            });

            data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error?.message || `LLM request failed (${response.status})`);
            }
            lastError = null;
            break;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error("Unknown LLM error");
            if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
                continue;
            }
        }
    }

    if (lastError) {
        throw lastError;
    }

    console.log(`LLM analysis completed for issue: ${issue.title.slice(0, 80)}`);

    const content = data.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return null;

    const jsonBlock = extractJsonObject(content);
    if (!jsonBlock) {
        const possible = extractSection(content, ["possible_solution:", "possible solution:", "solution:"]) || "No structured solution returned by LLM.";
        const root = extractSection(content, ["root_analysis:", "root analysis:", "root cause:"]) || content;
        return {
            root_analysis: normalizeMarkdownText(root),
            possible_solution: normalizeMarkdownText(possible),
            summary: normalizeMarkdownText(content.slice(0, 500))
        };
    }

    try {
        const parsed = JSON.parse(jsonBlock) as Record<string, unknown>;
        return mapArbitraryJsonToLlmResult(parsed);
    } catch {
        return {
            root_analysis: normalizeMarkdownText(content),
            possible_solution: "No structured solution returned by LLM.",
            summary: normalizeMarkdownText(content.slice(0, 500))
        };
    }
}
