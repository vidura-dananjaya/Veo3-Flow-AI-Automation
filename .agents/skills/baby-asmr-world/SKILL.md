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
- **CRITICAL SAFETY INSTRUCTION (Safety Policy)**: Explicitly instruct the `story-prompt-creator` to carefully draft every prompt so that it strictly complies with child safety policies. Ensure the wording prevents the error: "This prompt might violate our policies about generating harmful content related to minors" (e.g., avoid ambiguous or sensitive terms regarding minors).
- **IMPORTANT INSTRUCTION 1**: Explicitly instruct the `story-prompt-creator` to always append "No background music, ASMR natural sounds only." to the text of every generated prompt.
- **IMPORTANT INSTRUCTION 2 (Object Consistency)**: Explicitly instruct the `story-prompt-creator` that when creating the `prompt.json`, the design and details of the objects must strictly maintain consistency across every generated prompt.
- Wait until the `story-prompt-creator` skill completes its work and finishes creating the `prompt.json` output file.

### 4. Create Production Prompts (`production-prompt-creator`)
Finally, invoke the `production-prompt-creator` skill to finalize the file. Pass the following strict answer to its prompt without asking the user:
- **Consistency Frame** = Yes
- Wait until the `production-prompt-creator` completes writing the final `prompts/prompt.json` file.

### 5. Generate Facebook Publish Details
As the final step, you MUST generate the Facebook reel publish details.
- Carefully analyze the `.agents/output/STORY.md` file and the `.agents/skills/story-prompt-creator/output/prompt.json` file.
- Research and analyze competitive reels in the same niche to understand what goes viral in Europe for Baby ASMR.
- Create a highly engaging, viral FB reel description in English targeting European countries with a strong Baby ASMR feel.
- Include exactly 7 of the best, most viral hashtags on a new line at the bottom.
- You MUST follow the formatting structure found in `.agents/skills/baby-asmr-world/examples/publish-details.txt`.
- Output this as a single text block and save it to `.agents/skills/baby-asmr-world/output/publish-details.txt` using the `write_to_file` tool.
