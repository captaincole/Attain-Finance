# Onboarding Materials

This directory contains onboarding materials for beta testers and users connecting via ChatGPT.

## Files

### chatgpt-initial-prompt.txt
The welcome message shown to users when they first open ChatGPT after connecting the MCP server. This provides context about what the tool does and suggests first actions.

**Usage:** URL-encode this text and append to ChatGPT prompt parameter:
```
https://chatgpt.com/?model=gpt-4&q=<URL_ENCODED_PROMPT>
```

### beta-tester-guide.md
Complete setup instructions for beta testers, including:
- How to add the MCP connector in ChatGPT
- Authentication flow
- First steps with the tool
- Onboarding prompt link

## Updating the Onboarding Prompt

1. Edit `chatgpt-initial-prompt.txt` with your changes
2. URL encode the new text (use online tool or `encodeURIComponent()` in browser console)
3. Update the link in `beta-tester-guide.md`
4. Test the link to ensure it loads correctly in ChatGPT

## Notes

- These materials are separate from the MCP server code
- The server never sees or serves these files
- They're version-controlled for easy rollback and iteration
- Update as tool capabilities evolve
