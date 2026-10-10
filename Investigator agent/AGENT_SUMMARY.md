# Investigator Agent — Technical Reference & Architecture

The **Investigator Agent** is the core analytical intelligence in TRACEPOINT. It acts as an autonomous forensic engineer evaluating execution logs from complex multi-step AI agents.

## Core Capabilities

1. **Deterministic Timeline Alignment:**
   - Instead of naive index-based diffing, uses dual-key Needleman-Wunsch / Longest Common Subsequence dynamic programming.
   - Accurately detects inserted, skipped, or reordered steps without shifting downstream events.

2. **First Observed Divergence Isolation:**
   - Scans sequential events to identify the exact step ($t_{\text{divergence}}$) where output, status, or state parted ways.
   - Marks subsequent events strictly as downstream consequences ($t > t_{\text{divergence}}$).

3. **Isolated Replay Machine:**
   - Stepping simulator that computes progressive state memory without making external API or write calls.

4. **Transparent Diagnostic Engine:**
   - Queries Ollama (`Qwen2.5`) if running locally.
   - If Ollama is offline or disabled, engages the deterministic **Rule-Based Forensic Fallback Engine**.
   - Tags output with verified provider metadata to prevent model fabrication.

---

## All Saved Files in this Investigator Agent Folder

- [FILE_PATHS_AND_MANIFEST.md](file:///C:/Users/MUKESH/.gemini/antigravity-ide/scratch/tracepoint/Investigator%20agent/FILE_PATHS_AND_MANIFEST.md): Complete table of 43 project files and their absolute Windows paths.
- [FILE_PATHS.json](file:///C:/Users/MUKESH/.gemini/antigravity-ide/scratch/tracepoint/Investigator%20agent/FILE_PATHS.json): Machine-readable JSON database of all files and locations.
- [ai_assistant.py](file:///C:/Users/MUKESH/.gemini/antigravity-ide/scratch/tracepoint/Investigator%20agent/ai_assistant.py): Python module for the AI Investigation Assistant and Rule-Based Fallback.
- [README.md](file:///C:/Users/MUKESH/.gemini/antigravity-ide/scratch/tracepoint/README.md): Project overview, setup, and demo instructions.
- [architecture.md](file:///C:/Users/MUKESH/.gemini/antigravity-ide/scratch/tracepoint/docs/architecture.md): Sequence alignment and replay isolation design specification.
