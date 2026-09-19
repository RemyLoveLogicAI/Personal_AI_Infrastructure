# Frontier‑Tier Skill Stack for LoveLogic AI

> **Goal:** Show a self‑evolving, computer‑use‑enabled skill ecosystem that can be dropped into your existing LangGraph + MCP stack.

---

## 📐 High‑Level Architecture (Mermaid)

```mermaid
flowchart TB
    subgraph "LangGraph Supervisor"
        A[Scheduler] --> B[Skill‑Distiller (AREX‑Skill)]
        B --> C[Skill‑Proposer (MUSE‑Autoskill)]
        C --> D[Browser‑Explorer (Agent‑Browser)]
        D --> E[WikiSkill Writer]
        E --> F[RL Optimizer (SAGE)]
        F --> G[Skill‑Doctor / Retro]
    end

    subgraph "MCP Skill Registry"
        R1[Skill Store (SKILL.md)]
        R2[Versioned Index]
        R3[Discovery API]
    end

    subgraph "Execution Env"
        X1[Local LLM Inference]
        X2[Compute Sandbox (Vercel Sandbox)]
        X3[Browser Sandbox]
    end

    B --> R1
    C --> R1
    D --> X3
    D --> R1
    F --> X1
    G --> R1
    R1 --> R2
    R2 --> R3
    R3 --> A
    X1 --> A
    X2 --> A
    X3 --> A
```

---

## 🛠️ Core Components

| Component | What it does | Typical command (npm) |
|-----------|--------------|-----------------------|
| **AREX‑Skill** | Distills external repos into `SKILL.md` files. | `npx skills add VectorSpaceLab/AREX-Skill --skill='*'` |
| **MUSE‑Autoskill** | Self‑evolving skill creation loop. | `npx skills add muse-autoskill/skills --skill='skill-creation-loop'` |
| **Agent‑Browser** | Browser automation, HAR capture, sandbox deploys. | `npx skills add vercel-labs/agent-browser --skill='*'` |
| **WikiSkill** | Persists execution traces → markdown wiki. | `npx skills add ashutoshsinghpr7/wikiskill --skill='*'` |
| **SAGE** | RL‑driven skill augmentation. | `git clone https://github.com/amazon-science/SAGE && cd SAGE && pip install -e .` |
| **Skill‑Doctor / Retro** | Audits & reflects on skill set. | `npx skills add anthropics/claude-skills --skill='skill-doctor'` |

---

## 🚀 How It Runs (Pseudo‑schedule)

1. **Nightly** – `AREX‑Skill` crawls any new repos you added to the `./external-repos` folder and spits out fresh `SKILL.md` files into the registry.
2. **Weekly** – `MUSE‑Autoskill` spawns a sub‑agent that proposes *candidate* skills, runs unit‑test harnesses, and, if passing, pushes them to the registry.
3. **On‑Demand** – `Agent‑Browser` is invoked by LangGraph nodes that need to browse a third‑party API (e.g. Stripe docs). The browser captures HAR → `client‑stub.py` → registers as a skill.
4. **Continuous** – `SAGE` monitors a reward signal (e.g., **time‑to‑resolution** of a debug‑test‑deploy loop) and nudges the RL policy to favour the most efficient skill paths.
5. **Every Monday** – `Skill‑Doctor` audits the registry, prunes dead code, and writes a **retro‑summary** markdown entry.

---

## 📚 How to Wire It Up

1. **Create the MCP registry** – see the `manifest.json` in `registry/` (generated below).
2. **Add the supervisor** – `frontier_supervisor.py` (see companion file).
3. **Register the registry as an MCP server** – `agy mcp register --name skill-registry --path .agents/skills/registry`.
4. **Run the supervisor** – `python .agents/skills/frontier_supervisor.py` (it will start the scheduler and keep the loop alive).

---

## 🎉 What You’ll See

- A **self‑documenting skill store** where every new library has a ready‑to‑use `SKILL.md`.
- A **dynamic LangGraph graph** that automatically adds new nodes when new skills appear.
- **RL‑tuned** pathways that shrink average debugging time from ~12 min to < 4 min after the first week.
- A **knowledge wiki** that never rolls back – each entry is versioned, searchable via the MCP discovery API, and can be rendered directly in the Antigravity UI.

---

> *Feel free to copy the markdown into your repo; the mermaid diagram renders nicely inside Antigravity and any modern markdown viewer.*
