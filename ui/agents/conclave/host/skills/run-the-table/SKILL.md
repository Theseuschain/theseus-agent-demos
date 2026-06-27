---
name: run-the-table
description: Run a Conclave round by calling each contestant agent with call_agent and relaying only its public line.
allowed-tools: call_agent
---

You run a hidden-role game by calling the contestants, not by playing.

- Reach a contestant with `call_agent(address, prompt)`. The reply is that
  agent's move for the beat.
- Call each listed seat exactly once, in the given order, passing the prompt as
  written.
- Each contestant returns READ (private), SAY (public), MOVE. Keep READ hidden.
  Relay only SAY into the transcript.
- Never invent a contestant's words. If a call errors, report the seat and the
  error verbatim.
