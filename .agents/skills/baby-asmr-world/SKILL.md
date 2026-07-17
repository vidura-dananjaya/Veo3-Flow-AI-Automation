---
name: baby-asmr-world
description: Orchestrates the creation of viral Baby ASMR Facebook reels targeting European audiences. It integrates the story-creator, story-prompt-creator, and production-prompt-creator skills to automate the full pipeline based on a desired scene count.
---

# Baby ASMR World

You are an automated orchestration skill that coordinates multiple sub-skills to generate a complete pipeline for a viral Baby ASMR Facebook reel targeted at European countries.

## When to use this skill
- Use this when the user invokes the `baby-asmr-world` skill.
- Use this when the user asks to create an ASMR baby video, FB reel, or prompt sequence following the automated pipeline.

## How to use it

Follow these steps exactly in order:

### 1. Gather Input
Ask the user for an integer input named **"Video Scenes Count"**.
- If the user provides 0, or if they don't provide a valid input, you MUST use your own judgment to assign a highly suitable number of scenes for a viral FB reel (e.g., 3, 4, or 5).

### 2. Generate the Story (`story-creator`)
Invoke the `story-creator` skill and provide it with the following instructions:
- Study the concept of "Baby ASMR feeling" targeting European countries to create a viral FB reel video script.
- Ensure the script has exactly the number of scenes determined by the **"Video Scenes Count"**. The scenes must be highly consistent with each other.
- Wait until the `story-creator` skill completes its work and finishes creating the `.agents/output/STORY.md` file.

### 3. Generate Intermediate Prompts (`story-prompt-creator`)
Once the story is ready, invoke the `story-prompt-creator` skill. Pass the following strict answers to its prompts without asking the user:
- **Question 1: Prompt Type** = 1 (Video Prompt)
- **Question 2: Generation Type** = 3 (3D Type)
- **Question 3: Prompts Length** = [The exact "Video Scenes Count" from Step 1]
- **IMPORTANT INSTRUCTION**: Explicitly instruct the `story-prompt-creator` to always append "No background music, ASMR natural sounds only." to the text of every generated prompt.
- Wait until the `story-prompt-creator` skill completes its work and finishes creating the `prompt.json` output file.

### 4. Create Production Prompts (`production-prompt-creator`)
Finally, invoke the `production-prompt-creator` skill to finalize the file. Pass the following strict answer to its prompt without asking the user:
- **Consistency Frame** = Yes
- Wait until the `production-prompt-creator` completes writing the final `prompts/prompt.json` file.
