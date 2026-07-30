---
name: pet-show-new
description: Orchestrates the creation of 100% realistic, funny or emotional pet Facebook reels targeting European audiences. It integrates story-creator, story-prompt-creator, and production-prompt-creator skills.
---

# Pet Show New

Carefully study the user's input and generate a 100% realistic video/image script about pets that evokes funny or emotional feelings (decide whether it should be funny or emotional based on the context). The script should be tailored for viral Facebook Reels targeting European countries and should be highly addictive to watch.

## How to use it

### 1. Configuration Rules
- Remind the agent that based on `config.json`'s "Prompt Type" value:
  - `1` = Video generation script
  - `2` = Image generation script
  - `3` = General script

### 2. Story Creation (`story-creator`)
- Instruct the skill to deeply analyze the user's first instruction input.
- Instruct `.agents/skills/story-creator` to create scripts according to the "Scenes Count" value in `config.json` (e.g., if "Scenes Count" = 3, instruct it to create 3 consistency scripts).
- Generate the most suitable viral media generation script based on the "Prompt Type" (e.g., best video script for video, best image script for image).
- Wait until `story-creator` finishes generating `STORY.md`.

### 3. Prompt Creation (`story-prompt-creator`)
- After `STORY.md` is generated, pass it to `.agents/skills/story-prompt-creator`.
- Pass the following parameters to `story-prompt-creator`:
  - **Question 1: Prompt Type** = `config.json`'s "Prompt Type"
  - **Question 2: Generation Type** = `config.json`'s "Generation Type"
  - **Question 3: Prompts Length** = `config.json`'s "Scenes Count"
- Instruct the skill that if `config.json`'s "No Background Music" = true, it must explicitly mention NOT to include background music.
- Wait until `story-prompt-creator` finishes generating `prompt.json`.

### 4. Consistency Instructions
- You MUST include the following consistency instructions for the agent to use when interacting with `story-creator` and `story-prompt-creator`:
  > It is crucial to maintain perfect object and character consistency across all generated prompts. You must use verbatim descriptions for the subjects in every scene. For example, if the subject is described in Scene 1 as a "toddler wearing a light pastel blue cotton romper", this exact descriptive phrase MUST be included in the prompt for Scene 2, Scene 3, and all subsequent scenes. Do not change colors, clothing types, or character features under any circumstances.
  >
  > IMPORTANT INSTRUCTION (Consistency Rules for All Prompts):
  > When generating the list of prompts, you must strictly follow these rules to maintain visual continuity:
  > Characters: Repeat the exact age, appearance, and specific clothing (including colors and materials) in every prompt.
  > Objects: Key props (e.g., "brightly colored goldfish") must be described using the exact same adjectives in every scene they appear.
  > Environment: Maintain the core description of the setting (e.g., "clear water of the garden pond with a mossy stone edge") across prompts unless the scene explicitly demands a location change.

### 5. Production Prompt Creation (`production-prompt-creator`)
- After `story-prompt-creator` creates `prompt.json`, run the `.agents/skills/production-prompt-creator` skill.
- For the "Consistency Frame" question in `production-prompt-creator`, pass the value of "Consistency Frame" from `config.json`.

### 6. Safety Policies
- Ensure the agent is instructed to generate prompts that do not violate policies.
- Ensure prompts are crafted to avoid the error: "This prompt might violate our policies about generating harmful content related to minors."
- You MUST include the exact text below in the new skill's instructions:
  > **CRITICAL SAFETY INSTRUCTION (Safety Policy)**: Explicitly instruct the `story-prompt-creator` to carefully draft every prompt so that it strictly complies with child safety policies. Ensure the wording prevents the error: "This prompt might violate our policies about generating harmful content related to minors" (e.g., avoid ambiguous or sensitive terms regarding minors).

### 7. Publish Details Generation
- As the final step, instruct the skill to thoroughly analyze the `STORY.md` (from `story-creator`) and `prompt.json` (from `story-prompt-creator`).
- Generate a 100% fitting, natural, viral description for publishing the content as a single Facebook post.
- Provide the 5 best viral hashtags plus the `#viral` tag on the last line.
- Output this directly in English to `output/publish-details.txt`.
- When generating the description and hashtags, analyze similar niche competitive posts to provide the best possible output.
- Instruct the skill to analyze `examples/publish-details.txt` to understand the exact expected format.
