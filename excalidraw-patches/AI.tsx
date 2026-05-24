import {
  DiagramToCodePlugin,
  exportToBlob,
  getTextFromElements,
  MIME_TYPES,
  TTDDialog,
} from "@excalidraw/excalidraw";
import { getDataURL } from "@excalidraw/excalidraw/data/blob";
import { safelyParseJSON } from "@excalidraw/common";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useMagicSettings } from "../hooks/useMagicSettings";

const DIAGRAM_TO_CODE_SYSTEM_PROMPT = `You are a skilled front-end developer who builds interactive prototypes from wireframes, and is an expert at CSS Grid and Flex design.
Your role is to transform low-fidelity wireframes into working front-end HTML code.

YOU MUST FOLLOW FOLLOWING RULES:

- Use HTML, CSS, JavaScript to build a responsive, accessible, polished prototype
- Leverage Tailwind for styling and layout (import as script <script src="https://cdn.tailwindcss.com"></script>)
- Inline JavaScript when needed
- Fetch dependencies from CDNs when needed (using unpkg or skypack)
- Source images from Unsplash or create applicable placeholders
- Interpret annotations as intended vs literal UI
- Fill gaps using your expertise in UX and business logic
- generate primarily for desktop UI, but make it responsive.
- Use grid and flexbox wherever applicable.
- Convert the wireframe in its entirety, don't omit elements if possible.

If the wireframes, diagrams, or text is unclear or unreadable, refer to provided text for clarification.

Your goal is a production-ready prototype that brings the wireframes to life.

Please output JUST THE HTML file containing your best attempt at implementing the provided wireframes.`;

const TTD_SYSTEM_PROMPT = `Purpose and goals:
* Understand the structure and logical relationships of the document provided by the user.
* Accurately convert document content and relationships into Mermaid diagram syntax.
* Ensure the diagram contains all key elements and their connections.

Rules:
1. Analyze the document:
a) Carefully read and analyze the document content.
b) Identify different elements (concepts, entities, steps, processes, etc.).
c) Understand the relationships between elements (hierarchy, containment, flow, causation, etc.).
d) Identify the logical structure and flow within the document.
2. Generate diagram:
a) Based on the analysis, choose the most suitable Mermaid diagram type (flowchart, sequence, state, gantt, etc.).
b) Create diagram code using correct Mermaid syntax, following these special character guidelines:
* Mermaid's core special characters are used to define diagram structure and relationships.
* To display special characters or spaces in node IDs or labels, wrap them in double quotes "".
* To display HTML special characters (<, >, &) or # in label text (inside quotes), use HTML entity encoding.
* To insert line breaks inside labels, use the <br> tag.
* Use %% for comments.
c) Ensure the diagram is clear, easy to understand, and accurately reflects the document content.

3. Detail handling:
a) Avoid omitting any important details or relationships from the document.
b) If the document contains ambiguous content, ask the user for clarification.
c) The generated diagram code should be directly usable in any Mermaid-compatible tool.
Tone:
* Maintain a professional and rigorous approach.
* Express diagram content clearly and accurately.
* Provide brief explanations or suggestions when needed.`;

const buildOpenAIPayload = (input: string, modelName: string) => {
  return {
    model: modelName,
    messages: [
      {
        role: "system",
        content: TTD_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: input,
      },
    ],
  };
};

export const AIComponents = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  const magicSettings = useMagicSettings(excalidrawAPI);
  return (
    <>
      <DiagramToCodePlugin
        generate={async ({ frame, children }) => {
          const { openAIKey } = magicSettings;
          if (!openAIKey && !import.meta.env.VITE_APP_OPENAI_API_KEY) {
            excalidrawAPI.updateScene({
              appState: {
                openDialog: {
                  name: "settings",
                },
              },
            });
            return {
              html: `<html><body style="display: flex; align-items: center; justify-content: center; height: 100vh;">You need to configure your OpenAI API key in the settings.</body></html>`,
            };
          }

          const appState = excalidrawAPI.getAppState();

          const blob = await exportToBlob({
            elements: children,
            appState: {
              ...appState,
              exportBackground: true,
              viewBackgroundColor: appState.viewBackgroundColor,
            },
            exportingFrame: frame,
            files: excalidrawAPI.getFiles(),
            mimeType: MIME_TYPES.jpg,
          });

          const dataURL = await getDataURL(blob);

          const textFromFrameChildren = getTextFromElements(children);

          const apiKey =
            openAIKey || import.meta.env.VITE_APP_OPENAI_API_KEY || "";
          const apiURL =
            magicSettings.openAIBaseURL ||
            import.meta.env.VITE_APP_OPENAI_API_URL ||
            "https://api.openai.com/v1";

          const modelName =
            magicSettings.openAIModelName || "gpt-4-vision-preview";

          const body = {
            model: modelName,
            max_tokens: 4096,
            temperature: 0.1,
            messages: [
              {
                role: "system",
                content: DIAGRAM_TO_CODE_SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: dataURL,
                      detail: "high",
                    },
                  },
                  {
                    type: "text",
                    text: `Above is the reference wireframe. Please make a new website based on these and return just the HTML file. Also, please make it for the ${appState.theme} theme. What follows are the wireframe's text annotations (if any)...`,
                  },
                  {
                    type: "text",
                    text: textFromFrameChildren,
                  },
                ],
              },
            ],
          };

          const url = `${apiURL}/chat/completions`;
          const isRelativePath = url.startsWith("/");
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${
                isRelativePath
                  ? localStorage.getItem("token") || apiKey
                  : apiKey
              }`,
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const text = await response.text();
            const errorJSON = safelyParseJSON(text);

            if (!errorJSON) {
              throw new Error(text);
            }

            if (errorJSON.statusCode === 429) {
              return {
                html: `<html>
                <body style="margin: 0; text-align: center">
                <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; height: 100vh; padding: 0 60px">
                  <div style="color:red">Too many requests today,</br>please try again tomorrow!</div>
                  </br>
                  </br>
                  <div>You can also try <a href="${
                    import.meta.env.VITE_APP_PLUS_LP
                  }/plus?utm_source=excalidraw&utm_medium=app&utm_content=d2c" target="_blank" rel="noopener">Excalidraw+</a> to get more requests.</div>
                </div>
                </body>
                </html>`,
              };
            }

            throw new Error(errorJSON.message || text);
          }

          try {
            const json = await response.json();
            const message = json.choices?.[0]?.message?.content;
            if (!message) {
              throw new Error("Generation failed (invalid response)");
            }
            const html = message.slice(
              message.indexOf("<!DOCTYPE html>"),
              message.indexOf("</html>") + "</html>".length,
            );

            return {
              html,
            };
          } catch (error: any) {
            throw new Error("Generation failed (invalid response)");
          }
        }}
      />

      <TTDDialog
        onTextSubmit={async (input) => {
          try {
            const apiKey =
              magicSettings.openAIKey ||
              import.meta.env.VITE_APP_OPENAI_API_KEY ||
              "";
            const apiUrl =
              magicSettings.openAIBaseURL ||
              import.meta.env.VITE_APP_OPENAI_API_URL ||
              "/api/ai/v1";
            const modelName =
              magicSettings.openAIModelName ||
              import.meta.env.VITE_APP_OPENAI_MODEL ||
              "gpt-4o-mini";
            const payload = buildOpenAIPayload(input, modelName);
            const url = `${apiUrl}/chat/completions`;
            const isRelativePath = url.startsWith("/");
            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${
                  isRelativePath
                    ? localStorage.getItem("token") || apiKey
                    : apiKey
                }`,
              },
              body: JSON.stringify(payload),
            });

            const rateLimit = response.headers.has("x-ratelimit-limit-requests")
              ? parseInt(
                  response.headers.get("x-ratelimit-limit-requests") || "0",
                  10,
                )
              : undefined;

            const rateLimitRemaining = response.headers.has(
              "x-ratelimit-remaining-requests",
            )
              ? parseInt(
                  response.headers.get("x-ratelimit-remaining-requests") || "0",
                  10,
                )
              : undefined;

            if (!response.ok) {
              if (response.status === 429) {
                return {
                  rateLimit,
                  rateLimitRemaining,
                  error: new Error(
                    "Too many requests today, please try again tomorrow!",
                  ),
                };
              }
              const errorData = await response.json();
              throw new Error(
                errorData.error.message || "OpenAI API request failed",
              );
            }

            const data = await response.json();
            const mermaidCode = data.choices[0]?.message?.content;

            if (!mermaidCode) {
              throw new Error("Failed to generate Mermaid code from OpenAI.");
            }

            return {
              generatedResponse: mermaidCode,
              rateLimit,
              rateLimitRemaining,
            };
          } catch (err: any) {
            throw new Error("Request failed");
          }
        }}
      />
    </>
  );
};
