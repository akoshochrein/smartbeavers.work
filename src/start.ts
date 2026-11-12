import { createStart } from "@tanstack/react-start";

// Pages render in the browser only: the sign-in session lives in the browser, so the server
// has nothing to render for a signed-in player. The server still sends the document shell
// and answers the server routes (src/routes/api, src/routes/hook).
export const startInstance = createStart(() => ({ defaultSsr: false }));
