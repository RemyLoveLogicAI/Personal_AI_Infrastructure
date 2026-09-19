---
name: skill-create
description: >
  Create a new reusable skill package from a high-level specification.
  Use this when you need a capability that does not exist in the skill bank.
  This tool generates the SKILL.md interface file, optional scripts, tests,
  and resources, then runs the tests and registers the skill only if they pass.
inputs:
  - name: the kebab-case identifier for the new skill
  - description: one-paragraph description of what the skill does
  - purpose: what problem the skill solves
  - inputs: list of expected input parameters
  - outputs: list of expected output values
  - needs_code: whether executable scripts are required (true/false)
outputs:
  - skill_name: the registered kebab-case skill name
  - skill_path: absolute path to the created skill directory
  - test_result: pass or fail
version: "1.0.0"
tags: [builtin, meta]
---
# skill-create

## When to use
- When the task requires a capability not present in the current skill bank.
- When you identify a reusable sub-procedure worth packaging as a skill.
- When an existing skill is too narrow and a generalised version is needed.

## Core principles
1. The skill name must be unique kebab-case and match its directory name.
2. Every generated skill must include at least one unit test in tests/.
3. The create → evaluate → register loop must complete before the skill is usable.
4. Skill creation must not side-effect the host filesystem outside the sandbox.

## Recommended tools and libraries
- `yaml` for frontmatter serialisation
- `pytest` for test execution inside the sandbox
- The `scaffold_skill_package` helper from `skills.skill_schema`
- The `SkillEvaluator` from `skills.skill_evaluator`

## Workflow
1. Accept the caller's specification (name, description, purpose, inputs, outputs, needs_code).
2. Generate a complete SKILL.md using the standard frontmatter schema.
3. If needs_code is true, generate scripts/main.py implementing the skill logic.
4. Generate tests/test_skill.py with at least one pytest test case.
5. Call SkillEvaluator.evaluate(skill_dir) to run the tests inside the sandbox.
6. If all tests pass, call SkillBank.register(pkg) and return skill_name and skill_path.
7. If tests fail, inspect the error trace, patch the skill, and retry (max 3 attempts).
8. If all retries fail, report the error and do NOT register the skill.
