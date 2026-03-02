🛡️ Sentinel-OSS
================

**High-Performance AI Repository Analysis via Lexical & Structural IR.** Sentinel-OSS is not a simple LLM wrapper. It is a distributed analysis engine that combines **BM25 Ranking**, **AST Tokenization**, and **Dependency Propagation** to find the needle in the haystack.

🏗️ Technical Architecture
--------------------------

*   **Core API:** Fastify (Node.js/TypeScript)
    
*   **Task Orchestration:** BullMQ with Redis persistence.
    
*   **Inference:** OpenRouter SDK (Multi-model support).
    
*   **Search Engine:** Custom BM25 implementation with k1=1.2 and b=0.75.
    
*   **Code Intelligence:** TypeScript Compiler API for AST-based identifier extraction.
    

🧠 The Analysis Pipeline
------------------------

Sentinel-OSS uses a multi-stage retrieval process:

1.  **Lexical Analysis:** Tokenizes the GitHub issue (Title, Body, Labels) with custom weighting.
    
2.  **Structural Extraction:** Runs a TypeScript AST walker over the repository to extract symbols and identifiers.
    
3.  **BM25 Scoring:** Calculates relevance scores for every file based on term frequency and inverse document frequency.
    
4.  **Graph Propagation:** Propagates 20% of a file's score to its imported dependencies to uncover hidden root causes.
    
5.  **LLM Refinement:** Narrowed results (top 5 files) are sent to OpenRouter (e.g., GPT-4o-mini) for final remediation logic.
    

🛠️ Environment Setup
---------------------

# PostgreSQL  
<ul>• DB_HOST=localhost</ul>
<ul>• DB_PORT=5433</ul>
<ul>• DB_USER=<username></ul>
<ul>• DB_PASSWORD=<password></ul>
<ul>• DB_NAME=<name></ul>

# AI Orchestration  
OPENROUTER_API_KEY=`sk-or-v1-your_key`
