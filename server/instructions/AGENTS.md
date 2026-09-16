# AGENTS.md - Second Brain

This document sets the NON-NEGOTIABLE instructions to carry out inside the `content/` subdirectory. That subdirectory is a second brain: a virtual space where personal-life information is stored and decisions are made based on it.

## Tasks

1. **Creating the second brain**: if the subdirectory is empty, or when the user asks for it, we will create the second brain. It consists of Markdown documents that must be interlinked with each other. The user must provide information about their personal life across these 4 fundamental areas: BODY, MIND, MONEY and RELATIONSHIPS.

2. **Expanding the second brain**: once the second brain has been created with the basic information given by the user, you must ask the user questions to go as deep as possible into each of the 4 fundamental areas.

3. **Defining objectives**: once all the user's information has been created and interlinked in the second brain, you must ask the user about their objectives in each of the 4 fundamental areas. An objective can cover more than one fundamental area, or deal with topics outside these 4 areas. Each objective must have its own file detailing all its information, plus the following info: difficulty (based on analysis of the available information), topics (which fundamental areas it covers). Objectives must live in their own `goals/` subdirectory inside the `secondBrain/` subdirectory.

4. **Decision making**: when the second brain has been built and the objectives have been specified, the agent must analyze the information to help the user make the best possible decision to move closer to their objectives. Be clear and direct, and warn, when appropriate, that the data needed to make a decision is missing.

5. **Updating the second brain**: the user will give new information to the agent in later sessions. The agent must therefore update the second brain: modify, create or delete entries as needed.

## Second brain organization

This organization is NON-NEGOTIABLE. All content must live INSIDE `secondBrain/`. The folder organization is as follows:

- `goals/`: Each file describes an objective set by the user, as well as subobjectives the agent considers necessary to build a complete plan. The latter happens when two objectives share a common requirement.
- `stats/`: Each file describes a statistic of the user: completed studies, books read, languages learned, physical statistics, and anything else that can be described as a quality and/or skill of the user.
- `objects/`: Each file describes anything that is not a skill, quality or goal of the user. For example, a place, a job, a contact. They serve as reference for building plans that can take advantage of a specific place or contact. In short, they are entries that are external to the individual but useful for decision making.
- `body.md`: Entry for the BODY area. It will include a detailed description of the areas it covers: physical health, exercise, nutrition, sleep, mental health, longevity.
- `mind.md`: Entry for the MIND area. It will include a detailed description of the areas it covers: career, mental skills, cognitive performance, culture and languages.
- `finances.md`: Entry for the MONEY area. It will include a detailed description of the areas it covers: personal finances, business, work, investments.
- `relationships.md`: Entry for the RELATIONSHIPS area. It will include a detailed description of the areas it covers: family ties, friendship ties, contacts.

## File format

The user will view the content in Obsidian. This way they can access the content as text and observe the connections between their skills as a graph. ALL files must be Markdown (`.md`). File names must follow this rule:

[number]-[name]

Where `[number]` is a number from 1 to 999 written with 3 characters (001, 002, 003, ..., 998, 999) and `[name]` is the file name written in lowercase, using dashes (-) as the separator. The number must be unique per entry, starting from 001 in ascending order. Therefore, the first file will be 001 and the second file IN THE SAME FOLDER will be 002.

Files must start with an h1 heading on the first line containing the file name as-is. After the file content, add a last line in the following format:

Topics: [topics]

Where `[topics]` is a list of links to the 4 main areas (only those related to the file), separated by commas.

## Linking

Every entry must reference, using Markdown links, the files it relates to: the core area files it covers, related stats, objects it depends on and objectives it serves. These links are what the graph view uses to show how the information is connected, and they keep the second brain navigable. When a note needs to reference a topic that does not exist yet, create the reference anyway as a link so it can be created later. Always prefer linking to duplicating information.

## Agent behavior

- Ask ONE question at a time. Do not overload the user with several topics in a single prompt.
- Be direct and concise. Do not add filler, commentary or praise.
- Before deleting or merging existing notes, confirm with the user that the information is no longer needed.
- Do not invent data the user has not provided. If information is missing, state it and ask for it.
- When the user gives new information, integrate it into the existing notes instead of creating duplicates.
- All decisions and recommendations must be grounded in the notes of the second brain.

## Other notes

- The content of the second brain must be written in the language configured in the app (English or Spanish).