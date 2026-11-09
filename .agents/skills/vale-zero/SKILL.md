---
name: vale-zero
description: Bring a Vale run to zero alerts (errors, warnings, and suggestions) by fixing the configuration where it misfits the prose and rewriting the prose where it is genuinely flagged, without changing what it claims. Use when `vale <path>` fails, when the user wants a directory Vale-clean, or when choosing or swapping Vale packages for a kind of writing.
---

# Vale to zero

The goal is _zero_: the summary line reads `0 errors, 0 warnings and 0 suggestions`. The exit code only reflects errors, so exit 0 is not zero.

Two kinds of alert get there by different routes. A **misfit** is a rule built for another kind of writing (a docs style guide on a personal site, a profanity heuristic on "failure"). Fix misfits in configuration. A **hit** is a real problem in the prose. Fix hits by rewriting. Every rewrite keeps the facts: who made it, what it does, what state it is in, names, numbers, links.

## 1. Baseline from the config root

Run Vale from the directory that holds `.vale.ini`, always. Vale matches section globs against the path exactly as it was passed, so a run from a subdirectory silently skips path-scoped sections and shows a different rule set.

```sh
vale --output=line <path> | cut -d: -f4 | sort | uniq -c | sort -rn   # by rule
vale --output=line <path> | cut -d: -f1 | sort | uniq -c | sort -rn   # by file
vale <path> | tail -1                                                  # the summary line
```

Done when you have counts by rule and by file, and you know what text Vale is reading. For source code that is comments, unless a View says otherwise. If the user cares about the copy a page renders rather than code comments, read [code-copy.md](references/code-copy.md) before going further.

## 2. Fit check

Read the counts by rule and ask, for each package, whether it was written for this kind of prose. See [packages.md](references/packages.md) for what each common package targets and a strict set for first-person writing.

A misfit shows as a rule firing on nearly every file, or as fixes that would erase the voice the writing is meant to have (removing "I" from a personal page, simplifying a technical summary to grade 8). Recommend package changes to the user with reasons. Swapping packages is their call. Turning off a single misfiring rule is yours, if you can name why it misfits.

Done when every enabled package fits the prose, or the user has decided.

## 3. Configure

Make the config changes, then run `vale sync` and re-baseline. These gotchas cost the most time:

- **Package configs leak.** Some packages ship a `.vale.ini` that `vale sync` copies to `<StylesPath>/.vale-config/`, often enabling the style for `[*]` (every file, including images and fonts) or for all Markdown. `BasedOnStyles` is additive across sources, so you cannot remove a style from it. Read `<StylesPath>/.vale-config/*.ini` after every sync, then turn the style off with `Style = NO` under `[*]` and back on with `Style = YES` in the section that should use it.
- **Glob paths.** Section headers are relative to where Vale runs. A `**/` prefix (`[**/site/src/content/**/*.md]`) also covers absolute-path runs.
- **Section boundaries.** A new `[section]` header captures every key after it until the next header. Insert a section after the last key of the block above it, never between that block's keys.
- **Names that trip rules.** Add proper nouns and fixed terms to the vocabulary's `accept.txt`, which exempts them from existence and substitution rules. `TokenIgnores` and vocabulary do not reach frontmatter values. For a name in a title, turn that rule off for that one file, with a comment saying why.
- **Disable to fit, never to dodge.** Every rule you turn off gets a reason that is about the kind of writing, not the specific sentence.

Done when the re-baseline shows only hits.

## 4. Rewrite

Each fix can trip another rule, so loop: edit, re-run on the file, repeat until it is clean.

- Up to about 15 hits: rewrite inline.
- More than that: fan out to subagents, one file set each, with no file shared between two agents. Brief them with [subagent-brief.md](references/subagent-brief.md). The brief carries the run-from-root command and the fact list, because both are what agents drop.

Rewritten copy breaks tests that assert it, including regexes whose capitalization changes when a sentence is split. Run the tests that cover the rewritten files. On a red run, re-run once, because a first run can fail on environment noise. Check any failure that touches unchanged text against the original code (`git stash push -- <path>`, run, `git stash pop`) before calling it yours.

When the rewrites touched source code, run the project's type-check, linter, and formatter on every changed file (staged and unstaged: `git diff --name-only HEAD`). A rewritten string can break the syntax around it or change line lengths.

Done when `vale <path>`, run from the config root, prints the zero summary, and type-check, lint, and tests show no new failures.

## 5. Fact audit

Read `git diff` for every rewritten file and compare claims, not wording. Rewrites under pressure lose a specific set of things. Check each one:

- authorship ("rules I wrote")
- maintenance state ("maintained", "kept current")
- credit to others
- invented specifics ("fixes bugs", where the original made no such claim)
- swapped terms ("versioned" becoming "tagged", "projects" becoming "games")
- dropped or added qualifiers ("arbitrary thresholds" becoming "thresholds", or "only" added), which turn a true claim false
- terms of art and citations reworded (legal phrases like "similarly significant effects" or "the right to", and source titles like "Publisher: Title"). These are misfits: restore them and exempt them in configuration.
- choppy fragments written to game a readability score

Restore each loss with a fresh sentence that still passes. Re-run from the root.

Done when every claim in the original diff side is present in the new side, and the summary line still reads zero.

## Report

List the config changes with the reason for each, the facts you restored, and anything left for the user to judge, such as a tone change across many pages.
