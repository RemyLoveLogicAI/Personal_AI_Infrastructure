---
name: web-search
description: >
  Search the web for current information using a query string.
  Returns a list of search results with titles, URLs, and snippets.
  Use this when you need up-to-date information not available in the
  skill bank or your training knowledge.
inputs:
  - query: the search query string
  - num_results: number of results to return (default 5)
outputs:
  - results: list of {title, url, snippet} dicts
version: "1.0.0"
tags: [builtin, search, web]
---
# web-search

## When to use
- When you need current, factual, or domain-specific information from the internet.
- When the task requires verifying facts or finding documentation.
- When no existing skill in the bank covers the required information retrieval.

## Core principles
1. Always prefer concise, authoritative sources.
2. Return raw results; do not fabricate or hallucinate URLs or content.
3. Respect rate limits — do not issue more than 5 queries per task turn.

## Recommended tools and libraries
- `openai` web search tool (if available via API)
- `requests` + DuckDuckGo HTML search as fallback
- `beautifulsoup4` for HTML parsing if needed

## Workflow
1. Receive query and num_results (default 5).
2. Issue the search request via the configured search backend.
3. Parse and return a list of result dicts: {title, url, snippet}.
4. If search fails, return an empty list and log the error.
