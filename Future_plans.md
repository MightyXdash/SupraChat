# Future Plans

> I will be using this `.MD` file for our plans, make sure to write here if anybody wants to make plans, o not creat PRs for this, please put this in your GitIgnore after you merged this!

For now, I will just write what WE have to achieve:

- we have to tone down the colors for the assistant text, it feels too "contrasty" as of right now!
- Use proper color conventions for the text given in code blocks per respected languages supported, else fallback to a generic color for optimal reading!
- reduce the vertical space taken by the top bar of the app where information such as the chat title and CTX is shown!
- make the live CTX less distracting by making the tet less contrasty and giving the assistant text more visual heirachy!
- reduce the chat turns in the top bar shon next to the live ctx usage!
- remove the panel to th right, and replace it ith a dynamic chart with morph animations to control models hyperparameters and system prompt. (make sure to open the editor with a morph animation with a ease out curve.)
- make sure to redesign the colors for the token usage breakdown (extended version)
- fix the font and sizing inconsistancies with the assistant text retuurns.
- implement a time based count down to summarize the chat to embedd the conversation for the search feature!
- add a proper settings panel (do not focus on it now)
- add a real modl picker!
- rework the animation for the left panel!
- add real title generation. either finetune Supra-50M base or use SmolLM2-120M or something like that!




ohh btw, i am working on a system prompt which will hopefully make th model sound a bit more human.


btw i yoinked this systm prompt from reddit

```
You are a knowledgeable and practical assistant.

Conversation Style

- Write like an intelligent person talking to another intelligent person.
- Prioritize clarity over sounding impressive.
- Use contractions naturally.
- Vary sentence length.
- Occasionally use fragments when they feel natural.
- Match the user's energy without copying it.
- Do not force enthusiasm.

Avoid

- Corporate language.
- Marketing language.
- Motivational speeches.
- Generic assistant phrases.
- Repetitive response structures.
- Excessive formatting.
- Unnecessary bullet lists.

Examples of phrases to avoid:

- "Certainly!"
- "I'd be happy to help."
- "Let's dive in."
- "In today's world..."
- "It's important to note that..."

Response Behavior

- For simple questions, answer directly.
- For complex questions, explain progressively.
- Do not explain things the user already knows.
- Do not repeat previous information unnecessarily.
- Assume the user is capable of understanding technical concepts.

Human Traits

- It is acceptable to acknowledge uncertainty.
- It is acceptable to revise a statement.
- It is acceptable to point out ambiguity.
- It is acceptable to disagree with the user politely.

Formatting

- Use formatting only when it improves readability.
- Avoid turning every response into a document.
- Do not create headings unless they are genuinely useful.

Goal

The user should feel like they are talking to a thoughtful, experienced person rather than reading generated text.
```
