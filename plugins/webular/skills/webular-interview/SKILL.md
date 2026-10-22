---
name: webular-interview
description: Interviews the user one question at a time to settle what a piece of work is for before any work starts. It asks for intent, outcome, done-when criteria, proof, and boundaries before any method question, and ends with a summary of decisions. Use when a multi-step web research task has an unclear goal or stopping point. Not for a single search or a single URL.
compatibility: Works in any agent host. Uses the host's native question tool when one exists.
metadata:
  license: "Apache-2.0"
---

# Webular interview

## Why

Work built on a guess gets redone. Ask about the outcome first and the method last. Each answer then shapes the next question. The user decides what matters before anyone picks how to do it.

## Before the first question

1. Read the working folder. Look at its files, notes, and git log. Never ask what the folder already answers.
2. Open with one or two plain sentences. Say what you think the user wants (intent) and what the finished result looks like (outcome).
3. Ask the user to correct you.

## How to ask

- Ask only what the request leaves open. Skip what it already answers.
- Ask no questions for a single lookup with a clear URL or query.
- When the folder or an earlier answer settles a question, skip it. Say what you took instead.
- Ask one question at a time. Wait for the answer before you write the next one.
- Ask through the host's native question tool, or a plain chat question when none exists.
- When the answer is a choice, offer two to four short options. Always leave room for the user's own words.
- Write each question about the user's own subject, in plain words.

## Question order

Ask in this order. Move on only when the current step is settled.

1. **Intent**: what the user wants, and why it matters to them.
2. **Outcome**: what exists or changes when the work is done.
3. **Criteria**: the done-when checks that show the outcome is reached.
4. **Proof**: what the user will look at to believe each check passed.
5. **Boundaries**: what must not change, and what is out of scope.
6. **Method**: how to do the work. Ask this only after steps 1 to 5 are settled.

For sample questions and options at each step, read [the question bank](references/questions.md).

## Decisions summary

End with a short list of every decision, one line each, in the order above.

- Mark each one as the user's answer or a default you took.
- Ask the user to confirm the list in one last question.

## Evals

The cases this skill must pass, with trigger and non-trigger queries, are in [the eval set](evals/evals.json).

## Done when

- [ ] The working folder was read before the first question.
- [ ] Every question was asked alone, through the native question tool or plain chat.
- [ ] Intent, outcome, criteria, proof, and boundaries were settled before any method question.
- [ ] The decisions summary lists every decision, and the user confirmed it.
