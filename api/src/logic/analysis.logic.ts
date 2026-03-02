import path from "node:path";
import ts from "typescript";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "when", "then",
  "into", "your", "have", "does", "not", "are", "was", "were", "can",
  "cannot", "could", "would", "after", "before", "about", "there", "their",
  "they", "them", "what", "where", "which", "while", "fix", "bug", "problem",
  "issue", "error", "failed", "failure", "need", "make", "using"
]);

const FILE_NAME_BOOST = 2.25;
const SYMBOL_MATCH_BOOST = 1.5;
const IMPORT_URL_BOOST = 0.5;

export type IssueSignalsInput = {
  title: string;
  body: string | null;
  labels?: unknown;
};

export type RepoFileInput = {
  path: string;
  content?: string;
  imports?: string[] | null;
  urls?: string[] | null;
  last_fetched_at?: Date;
};

type RankedInternal = RepoFileInput & {
  score: number;
  signals: string[];
  docLength: number;
  tokenFreq: Map<string, number>;
  symbols: Set<string>;
  imports: string[];
  urls: string[];
  astTokens: Set<string>;
};

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9_]{2,}/g) || [])
    .filter((token) => !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function buildQueryTerms(issue: IssueSignalsInput): Map<string, number> {
  const labelsText = Array.isArray(issue.labels)
    ? issue.labels.map((l: any) => String(l?.name ?? l ?? "")).join(" ")
    : "";

  const weightedSource = [
    ...tokenize(issue.title).flatMap((token) => [token, token, token]),
    ...tokenize(labelsText).flatMap((token) => [token, token]),
    ...tokenize(issue.body || "")
  ];

  const qtf = new Map<string, number>();
  for (const token of weightedSource) {
    qtf.set(token, (qtf.get(token) || 0) + 1);
  }

  return qtf;
}

function extractSymbols(content: string): Set<string> {
  const symbols = new Set<string>();
  const symbolRegex = /\b(?:function|class|interface|type|const|let|var|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

  let match: RegExpExecArray | null;
  while ((match = symbolRegex.exec(content)) !== null) {
    symbols.add(match[1].toLowerCase());
  }

  return symbols;
}

function extractAstTokens(content: string, filePath: string): Set<string> {
  const tokens = new Set<string>();
  const ext = path.extname(filePath).toLowerCase();
  const tsLike = [".ts", ".tsx", ".js", ".jsx"].includes(ext);
  if (tsLike) {
    const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node)) {
        tokens.add(node.text.toLowerCase());
      } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        for (const tok of tokenize(node.text)) tokens.add(tok);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return tokens;
  }

  const astLikeRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(|:|=|{|=>)/g;
  let match: RegExpExecArray | null;
  while ((match = astLikeRegex.exec(content)) !== null) {
    tokens.add(match[1].toLowerCase());
  }
  return tokens;
}

function pathTokens(filePath: string): string[] {
  return (filePath.toLowerCase().split(/[/.\\_-]+/g).filter(Boolean));
}

function extractSnippet(content: string, queryTerms: string[]): string {
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (queryTerms.some((term) => lower.includes(term))) {
      const start = Math.max(0, i - 8);
      const end = Math.min(lines.length, i + 9);
      return lines.slice(start, end).join("\n");
    }
  }

  return lines.slice(0, 20).join("\n");
}

function normalizeImportReference(value: string): string {
  return value
    .replace(/^\.\//, "")
    .replace(/\.(tsx|ts|jsx|js|py|go)$/, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

export function computeSignals(issue: IssueSignalsInput, files: RepoFileInput[]) {
  const queryTermFreq = buildQueryTerms(issue);
  const queryTerms = Array.from(queryTermFreq.keys());

  if (!files.length || !queryTerms.length) {
    return {
      likelyPaths: [],
      keywordsUsed: queryTerms.slice(0, 40),
      explanation: "No relevant matches found."
    };
  }

  const docs: RankedInternal[] = files.map((file) => {
    const imports = Array.isArray(file.imports) ? file.imports : [];
    const urls = Array.isArray(file.urls) ? file.urls : [];
    const content = file.content || "";

    const tokens = [
      ...pathTokens(file.path),
      ...tokenize(imports.join(" ")),
      ...tokenize(urls.join(" ")),
      ...tokenize(content)
    ];

    const tokenFreq = new Map<string, number>();
    for (const token of tokens) {
      tokenFreq.set(token, (tokenFreq.get(token) || 0) + 1);
    }

    return {
      ...file,
      imports,
      urls,
      tokenFreq,
      docLength: tokens.length,
      score: 0,
      symbols: extractSymbols(content),
      astTokens: extractAstTokens(content, file.path),
      signals: []
    };
  });

  const avgDocLength = Math.max(1, docs.reduce((sum, doc) => sum + doc.docLength, 0) / docs.length);

  const docFreq = new Map<string, number>();
  for (const term of queryTerms) {
    let df = 0;
    for (const doc of docs) {
      if ((doc.tokenFreq.get(term) || 0) > 0) df++;
    }
    docFreq.set(term, df);
  }

  const k1 = 1.2;
  const b = 0.75;

  for (const doc of docs) {
    const loweredPath = doc.path.toLowerCase();
    const fileName = loweredPath.split("/").pop() || loweredPath;
    const importsJoined = doc.imports.join(" ").toLowerCase();
    const urlsJoined = doc.urls.join(" ").toLowerCase();

    for (const term of queryTerms) {
      const tf = doc.tokenFreq.get(term) || 0;
      if (!tf) continue;

      const qtf = queryTermFreq.get(term) || 1;
      const df = docFreq.get(term) || 0;
      const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
      const bm25 = idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc.docLength / avgDocLength))));
      doc.score += bm25 * qtf;

      if (fileName.includes(term)) {
        doc.score += FILE_NAME_BOOST;
        doc.signals.push(`Filename match: ${term}`);
      }
      if (doc.symbols.has(term)) {
        doc.score += SYMBOL_MATCH_BOOST;
        doc.signals.push(`Symbol match: ${term}`);
      }
      if (doc.astTokens.has(term)) {
        doc.score += 1.1;
        doc.signals.push(`AST token match: ${term}`);
      }
      if (importsJoined.includes(term) || urlsJoined.includes(term)) {
        doc.score += IMPORT_URL_BOOST;
        doc.signals.push(`Import/URL match: ${term}`);
      }
    }
  }

  const pathScoreMap = new Map<string, number>();
  const pathLookup = new Map<string, string>();
  for (const doc of docs) {
    pathScoreMap.set(doc.path, doc.score);
    const normalized = normalizeImportReference(doc.path);
    pathLookup.set(normalized, doc.path);
  }

  for (const doc of docs) {
    const baseScore = doc.score;
    if (baseScore <= 0) continue;

    for (const rawImport of doc.imports) {
      const importRef = normalizeImportReference(rawImport);
      const matchedPath = pathLookup.get(importRef) || pathLookup.get(`${importRef}/index`);
      if (!matchedPath || matchedPath === doc.path) continue;
      pathScoreMap.set(matchedPath, (pathScoreMap.get(matchedPath) || 0) + baseScore * 0.2);
    }
  }

  const ranked = docs
    .map((doc) => ({
      ...doc,
      score: pathScoreMap.get(doc.path) ?? doc.score
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  const topScore = ranked[0]?.score ?? 0;

  let narrowed = ranked.filter((doc) => doc.score >= Math.max(2.5, topScore * 0.8));
  if (narrowed.length < 2) narrowed = ranked.slice(0, Math.min(2, ranked.length));
  if (narrowed.length > 5) narrowed = narrowed.slice(0, 5);

  const likelyPaths = narrowed.map((doc) => ({
      path: doc.path,
      score: Number(doc.score.toFixed(4)),
      signals: Array.from(new Set(doc.signals)).slice(0, 8),
      snippet: doc.content ? extractSnippet(doc.content, queryTerms) : null,
      imports: doc.imports.slice(0, 20),
      urls: doc.urls.slice(0, 20)
    }));

  return {
    likelyPaths,
    keywordsUsed: queryTerms.slice(0, 40),
    explanation: likelyPaths.length
      ? `Ranked ${likelyPaths.length} likely files using BM25 lexical ranking + symbol extraction + dependency propagation.`
      : "No relevant matches found."
  };
}

export function cleanGitHubBody(body: string): string {
  if (!body) return "";
  return body.replace(/\n\s*\n/g, "\n\n").trim();
}
