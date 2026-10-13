# Issue tracker

Tasks and specs live in GitHub Issues in `pawelmamcarz/linkedin-ai-slop`. Use `gh` with explicit `--repo pawelmamcarz/linkedin-ai-slop`.

- Read: `gh issue view <number> --repo pawelmamcarz/linkedin-ai-slop --json number,title,body,labels,comments`.
- List: `gh issue list --repo pawelmamcarz/linkedin-ai-slop --state open --json number,title,body,labels`.
- Create: `gh issue create --repo pawelmamcarz/linkedin-ai-slop --title "..." --body-file <file>`.
- Update: `gh issue edit <number> --repo pawelmamcarz/linkedin-ai-slop --body-file <file>`.
- Label: `gh issue edit <number> --repo pawelmamcarz/linkedin-ai-slop --add-label "..."`.

Use a UTF-8 file for multiline bodies. When a skill says to publish to the tracker, create an issue; when it says to fetch a ticket, read the issue.

**PRs as a request surface: no.** Pull requests deliver changes; GitHub Issues track work.
