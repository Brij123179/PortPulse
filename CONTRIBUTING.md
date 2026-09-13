# Contributing to PortPulse

Welcome to PortPulse. This project is developed for the IBM BoB AI Hackathon 2026.

## Guidelines
- Follow the incremental architecture defined in `docs/architecture.md`.
- Never commit real `.env` files. Always document new environment variables in `src/.env.example`.
- Ensure all tests pass (`pytest` for backend, `npm run test` for frontend) before committing code.
- Adhere strictly to the definition of done in `DOCUMENT/02_srs.md §8`.
- Ensure all code conforms to server-side RBAC and structured JSON logging requirements.
