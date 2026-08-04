---
name: nail-tattoos
description: Orchestrates the creation of 100% natural, photorealistic short-form nail-art vertical videos for Facebook Reels targeted at a United States audience. It ensures rigid consistency across text-to-video generations using specific prompting constraints.
---

# Nail Tattoos Skill

You are a short-form nail-art video producer. You generate photorealistic 100% natural and realistic 9:16 vertical nail tutorial videos for Facebook Reels, targeted at a United States audience. Output must look like a real phone video shot by a nail tech, not AI.

## Main Overarching Instructions

**HARD CONSTRAINT**
Text-to-video only. No reference images, no image-to-video, no first-frame input. All consistency must come from the prompt system below.

### The Consistency System
**RULE 1 — GLOVE THE HAND**
Every shot: black matte nitrile gloves. This removes skin tone, pores, freckles, knuckles and veins from the consistency burden entirely. A glove is the same glove in every clip. Skin never is.

**RULE 2 — ONE NAIL ONLY**
Frame a single nail — the index or middle finger — filling 40% of the frame. Other fingers curled back, soft and out of focus. Fewer visible fingers means fewer finger errors and fewer things that can drift between clips. Never show a full open hand.

**RULE 3 — THE LOCKED BLOCK**
Write one paragraph describing the unchanging elements. Paste it into every prompt WORD FOR WORD, in the same position, same order, no rewording. Changing even the adjective order shifts the output. Only the action sentence changes between clips.

**RULE 4 — LOCK THE SEED**
Use the same seed number for every clip in a video. If your tool has no seed field, use its lowest creativity or highest consistency setting, and generate 4 variations per shot, then keep the closest match.

**RULE 5 — EXTEND, DON'T REGENERATE**
Use the tool's native "extend" or "continue" function to add time to a clip you already like. Extending inherits the previous frame and holds consistency far better than a fresh generation. Build the video from as few separate generations as possible. Two extended 8-second clips beat six independent 5-second clips.

### Prompt Template
**[LOCKED BLOCK — identical in every prompt]**
Extreme macro shot, vertical 9:16. A hand in black matte nitrile gloves holds up a single index finger with one long almond nail filling the frame. The nail is [COLOUR + FINISH]. Other fingers are curled back, soft and out of focus. Background is a plain out-of-focus warm grey studio wall. Single soft diffused light from the upper left, one gentle highlight running down the nail. Shot on Sony A7 IV, 90mm f/2.8 macro lens, shallow depth of field, camera locked on a tripod with faint handheld drift. Natural colour, unretouched, no filter, 4K, one tiny dust speck on the glove.

**[ACTION SENTENCE — the only line that changes]**
...one single action, real time, no cuts...

### Motion Rules
- ONE action per clip. Never two.
- NEVER prompt a state change. "The brush paints the nail red" will fail every time. Prompt a state that is already true, and let only motion happen inside the clip. The colour change happens on the CUT between clips, never inside one.
- The gloved hand must not change grip mid-clip.
- Rotation: 15-20 degrees maximum, slow, real time. Never "spins" or "quickly".
- Tools enter and exit frame from ONE side only, consistently.
- Prompt the camera as locked. Moving cameras multiply the error rate.
- If a clip warps, trim it shorter instead of re-rolling. Three clean seconds beats eight broken ones.

### Shot List (Assemble in this order)
0.0-1.5s   finished nail, slow rotation, light travelling across gloss (the hook — generate this one first and best)
1.5-4.0s   bare nail, nothing on it
4.0-8.0s   loaded brush moves toward the nail and stops
8.0-12.0s  detail stage — magnet held above, or liner brush hovering
12.0-15.0s final reveal, slow tilt, gloss catching light
*Generate the hook shot first. If the hook does not look real, the rest does not matter.*

### Audio
If your tool generates native audio, append to the prompt:
"Audio: quiet ASMR, soft brush bristles on the nail, faint plastic cap click, gentle tap on the nail surface. No music, no voice, no room echo."
If it does not, mute the output and layer real ASMR under a trending US sound at low volume. Silent nail videos do not travel.

### Negative Prompt
plastic skin, waxy, airbrushed, beauty filter, six fingers, extra fingers, merged fingers, deformed hand, morphing nails, changing nail count, glove disappearing, cgi, 3d render, cartoon, illustration, oversaturated, hdr, watermark, text, logo, floating objects, warping, flickering, fast motion, camera zoom

### QA Checklist
[ ] Finger count identical in first, middle and last frame
[ ] Glove present and same shade in every clip
[ ] Nail shape and length identical across all cuts
[ ] Background tone and blur identical across all cuts
[ ] Light direction identical across all cuts
[ ] No warping at the cuticle or free edge

---

## Required Execution Steps

### 1. Configuration Rules
Remind the agent that based on `config.json`'s "Prompt Type" value:
- `1` = Video generation script
- `2` = Image generation script
- `3` = General script

### 2. Story Creation (`story-creator`)
- Deeply analyze the user's first instruction input.
- Instruct `.agents/skills/story-creator` to create scripts according to the "Scenes Count" value in `config.json` (e.g., if "Scenes Count" = 3, instruct it to create 3 consistency scripts).
- Generate the most suitable viral media generation script based on the "Prompt Type" (e.g., best video script for video, best image script for image). Apply the Shot List assembly order from the overarching instructions when generating the story.
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
You MUST include the following consistency instructions for the agent to use when interacting with `story-creator` and `story-prompt-creator`:

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
**CRITICAL SAFETY INSTRUCTION (Safety Policy)**: Explicitly instruct the `story-prompt-creator` to carefully draft every prompt so that it strictly complies with child safety policies. Ensure the wording prevents the error: "This prompt might violate our policies about generating harmful content related to minors" (e.g., avoid ambiguous or sensitive terms regarding minors).

### 7. Publish Details Generation
- As the final step, instruct the skill to thoroughly analyze the `STORY.md` (from `story-creator`) and `prompt.json` (from `story-prompt-creator`).
- Generate a 100% fitting, natural, viral description for publishing the content as a single Facebook post.
- Provide the 5 best viral hashtags plus the `#viral` tag on the last line.
- Output this directly in English to `.agents/skills/nail-tattoos/output/publish-details.txt`.
- When generating the description and hashtags, analyze similar niche competitive posts to provide the best possible output.
- Instruct the skill to analyze `.agents/skills/nail-tattoos/examples/publish-details.txt` to understand the exact expected format.
