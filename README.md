# aiPandu

aiPandu is an embeddable, source-grounded help assistant. A host application loads one small script; aiPandu adds a bottom-right launcher and serves the chat panel from its own origin.

## Architecture

1. The host loads `widget.js` with an integration key.
2. The widget requests a short-lived session. The API validates the browser's actual Origin against the integration allow-list.
3. The chat panel runs in an iframe hosted by aiPandu, isolating its CSS and JavaScript from the host.
4. The chat API resolves the integration's approved RAG Document IDs server-side.
5. It retrieves relevant chunks from the shared Peti-Peti RAG service, calls the OpenAI Responses API, and returns a grounded answer with sources.

The browser never receives an OpenAI key or permission to choose arbitrary RAG documents.

## Peti-Peti integration

```html
<script
  src="https://aipandu.web.app/widget.js"
  data-app-key="petipeti"
  defer>
</script>
```

Allowed origins and knowledge bases are configured in `functions/integrations.js`.

## Local development

```bash
npm --prefix functions install
firebase emulators:start --only hosting,functions --project aipandu
```

The backend requires these Firebase Functions secrets:

- `OPENAI_API_KEY`
- `AIPANDU_SESSION_SECRET`

The default answer model is `gpt-5.6-luna`; override it through the `AIPANDU_MODEL` runtime environment variable when needed.

## Security notes

- Add every production host origin explicitly to the integration allow-list.
- Localhost origins are enabled only for the Peti-Peti development integration.
- Session tokens expire after 30 minutes and are bound to the approved origin and integration key.
- The in-memory rate limiter is an initial safeguard. Replace it with a shared store or edge rate limiter before high-volume public use.
- Keep the repository free of provider credentials and Firebase service-account keys.

