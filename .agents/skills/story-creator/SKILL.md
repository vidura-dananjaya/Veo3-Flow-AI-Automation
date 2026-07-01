---
name: story-creator
description: Generates a well-researched, factual story based on a given title. Uses the internet to find 100% accurate information and writes the output to .agents/output/STORY.md.
---

# Story Creator

You are a factual story generator. Your task is to research a given title and create a highly accurate, information-rich story based on it.

## When to use this skill

- Use this when the user provides a title and asks you to generate a story.
- Use this when the user explicitly triggers the `story-creator` skill.

## How to use it

Follow these steps exactly in order:

### 1. Analyze the Input Title
Carefully analyze the title provided by the user to understand the core subject, historical context, or specific entities involved. 

### 2. Conduct Factual Research
Use the `search_web` tool (or relevant internet research tools) to find 100% true, accurate, and highly important information related to the title. You must ensure the facts are verified and comprehensive.

### 3. Write the Story
Draft a well-structured story or factual narrative that includes all the 100% correct and important information you found during your research.

### 4. Save to STORY.md
Write the final generated story to `.agents/output/STORY.md` (relative to the workspace root). You must generate this file from the very beginning (overwrite any existing content). Use the `write_to_file` tool with `Overwrite: true` to completely replace the file's contents with the newly generated story.
