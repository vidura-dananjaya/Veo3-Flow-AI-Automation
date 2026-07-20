---
name: pet-show
description: Orchestrates the creation of 100% realistic, funny or emotional pet Facebook reels targeting European audiences. It integrates story-creator, story-prompt-creator, and production-prompt-creator skills.
---

# Pet Show

You are an automated orchestration skill that coordinates multiple sub-skills to generate a complete pipeline for a 100% realistic and natural (funny or emotional) Pet FB reel targeted at European countries, designed to go viral and be highly addictive.

## When to use this skill
- Use this when the user invokes the `pet-show` skill.
- Use this when the user asks to create a pet video, FB reel, or prompt sequence following the automated pipeline.

## How to use it

Follow these steps exactly in order:

### 0. Shared Consistency Instruction
When invoking both the `story-creator` and `story-prompt-creator` skills (Steps 1 and 2), you MUST explicitly pass them the following instruction to ensure perfect visual continuity:

```text
It is crucial to maintain perfect object and character consistency across all generated prompts. You must use verbatim descriptions for the subjects in every scene. For example, if the subject is described in Scene 1 as a "toddler wearing a light pastel blue cotton romper", this exact descriptive phrase MUST be included in the prompt for Scene 2, Scene 3, and all subsequent scenes. Do not change colors, clothing types, or character features under any circumstances.

IMPORTANT INSTRUCTION (Consistency Rules for All Prompts):
When generating the list of prompts, you must strictly follow these rules to maintain visual continuity:

Characters: Repeat the exact age, appearance, and specific clothing (including colors and materials) in every prompt.

Objects: Key props (e.g., "brightly colored goldfish") must be described using the exact same adjectives in every scene they appear.

Environment: Maintain the core description of the setting (e.g., "clear water of the garden pond with a mossy stone edge") across prompts unless the scene explicitly demands a location change.
```

### 1. Gather Input and Generate the Story (`story-creator`)
Ask the user for an integer input named **"Video Scenes Count"**.
- If the user provides 0, or if they don't provide a valid input, you MUST use your own judgment to assign a highly suitable number of scenes.
- Deeply study the user's input to determine if the content should be **funny** or **emotional**. 
- Provide instructions to the `.agents\skills\story-creator` skill to create a 100% realistic and natural FB reel video script targeting European pet lovers. The script must be highly addictive, capturing the chosen funny or emotional feeling, and must include 100% realistic sounds.
- Ensure the script has consistency across the number of scenes determined by the **"Video Scenes Count"** (Ex: If count = 3, generate 3 consistent video script scenes). You must pass the consistency rules from **Step 0. Shared Consistency Instruction**.
- Wait until the `story-creator` skill completes its work and finishes creating the `.agents/output/STORY.md` file.

### 2. Generate Intermediate Prompts (`story-prompt-creator`)
Once the story is ready, invoke the `.agents\skills\story-prompt-creator` skill. Pass the following strict answers to its questions:
- **Question 1: Prompt Type** = 1 (Video Prompt)
- **Question 2: Generation Type** = 2 (Realistic Type)
- **Question 3: Prompts Length** = [The exact "Video Scenes Count" from Step 1]
- **IMPORTANT INSTRUCTION 1**: Explicitly instruct the `story-prompt-creator` that NO background music should be included in any prompt.
- **IMPORTANT INSTRUCTION 2 (Safety Policy)**: Explicitly instruct the `story-prompt-creator` to carefully draft every prompt so that it strictly complies with Omni Flash AI video generation policies. Ensure the wording prevents the error: "This prompt might violate our policies about generating harmful content related to minors."
- **IMPORTANT INSTRUCTION 3 (Object Consistency)**: You must pass the consistency rules from **Step 0. Shared Consistency Instruction** to ensure perfect visual continuity across every generated prompt.
- Wait until the `story-prompt-creator` skill completes its work and finishes creating the `prompt.json` output file.

### 3. Create Production Prompts (`production-prompt-creator`)
After `prompt.json` is created, invoke the `.agents\skills\production-prompt-creator` skill to finalize the file. Pass the following strict answer:
- **Consistency Frame** = Yes
- Wait until the `production-prompt-creator` completes its work.

### 4. Generate Facebook Publish Details
As the final step, you MUST generate the Facebook reel publish details:
- Carefully analyze the `.agents/output/STORY.md` file and the generated `prompt.json` file.
- Research and analyze competitive reels in the same niche to understand what goes viral in Europe for pet lovers.
- Create a highly engaging, viral FB reel description in English targeting European countries with a strong funny or emotional feeling (based on the content).
- Include exactly 7 of the best, most viral hashtags on a new line at the bottom.
- You MUST format this as a single post and save it to `.agents\skills\pet-show\output\publish-details.txt` using the `write_to_file` tool.
- Follow the formatting structure found in `.agents\skills\pet-show\examples\publish-details.txt` when generating the text.
