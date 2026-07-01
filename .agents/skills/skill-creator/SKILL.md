---
name: skill-creator
description: Use this skill when the user asks you to create a new skill or custom capability. This provides instructions on how to properly scaffold and document new skills.
---

# Skill Creator

You are tasked with creating a new skill for the agent. Follow these instructions precisely to ensure the skill is recognized and functional.

## When to use this skill

- Use this when the user explicitly asks you to "create a skill", "add a new capability", or "learn a new workflow".
- Use this when the user wants to teach you a repeatable workflow, style guideline, or custom behavior.

## How to use it

### 1. Determine Scope
If the scope isn't specified, ask the user whether the skill should be project-scoped or global:
- **Project-Scoped**: `.agents/skills/<skill-name>/` (relative to the workspace root)
- **Global**: `C:\Users\Vidura\.gemini\config\skills\<skill-name>/`

### 2. Scaffold the Directory Structure
Create a new folder named after the skill (lowercase, hyphens for spaces).
Inside the folder, you MUST create a `SKILL.md` file. 

Optionally, if the skill is complex, you can create additional directories:
- `scripts/`: Helper scripts that extend capabilities
- `examples/`: Reference implementations and usage patterns
- `resources/`: Templates, assets, and other resources
- `references/`: Additional documentation (if SKILL.md body > 500 lines)

### 3. Write SKILL.md
The `SKILL.md` file MUST start with YAML frontmatter containing `name` and `description`. 
- **name**: A unique identifier (lowercase, hyphens).
- **description**: Crucial for the agent to know when to trigger the skill. Write it in the third person with relevant keywords. (e.g., "Generates unit tests for Python code using pytest conventions.")

**Template:**
```markdown
---
name: <skill-name>
description: <Clear, 3rd-person description of what it does and when to trigger it.>
---

# <Skill Name (Title Case)>

<Detailed instructions for the agent go here.>

## When to use this skill
- Use this when...
- This is helpful for...

## How to use it
- Step-by-step guidance, conventions, and patterns the agent should follow.
```

### 4. Create the files
Use the `write_to_file` tool to create `SKILL.md` and any necessary supplementary files. The system will automatically discover skills placed in the standard customization roots; you do not need to register them manually.

### Important Notes
- Ensure `SKILL.md` body is under 500 lines. If more is needed, put it in `references/`.
- Never edit existing shared or non-personal skills without explicit user confirmation to avoid code churn.
