import type { WebTemplate } from "./codec";

// These are format instructions, not generated summaries or example recordings.
export const BUNDLED_TEMPLATES: WebTemplate[] = [
  {
    slug: "dialext-meeting",
    title: "Meeting",
    description:
      "Capture the discussion and any supported decisions or follow-ups.",
    category: "Conversation",
    icon: { type: "icon", value: "users", color: "#9ca3af" },
    sections: [
      {
        title: "Overview",
        description: "Summarize the main topics discussed.",
      },
      {
        title: "Decisions",
        description: "Include only decisions supported by the recording.",
      },
      {
        title: "Follow-ups",
        description: "List actions, owners, and dates only when stated.",
      },
    ],
  },
  {
    slug: "dialext-lecture",
    title: "Lecture",
    description: "Organize ideas and examples for later study.",
    category: "Learning",
    icon: { type: "icon", value: "graduation-cap", color: "#9ca3af" },
    sections: [
      {
        title: "Main ideas",
        description: "Explain the central concepts in order.",
      },
      {
        title: "Examples",
        description: "Retain useful examples from the recording.",
      },
      {
        title: "Questions",
        description: "List questions raised or left open.",
      },
    ],
  },
  {
    slug: "dialext-interview",
    title: "Interview",
    description: "Follow the questions and the interviewee's answers.",
    category: "Conversation",
    icon: { type: "icon", value: "microphone", color: "#9ca3af" },
    sections: [
      { title: "Topics", description: "Group the subjects discussed." },
      {
        title: "Responses",
        description: "Preserve the speaker's claims and context.",
      },
      {
        title: "Notable quotes",
        description: "Quote only wording present in the recording.",
      },
    ],
  },
  {
    slug: "dialext-one-to-one",
    title: "One-to-one",
    description: "Keep a clear account of a personal conversation.",
    category: "Conversation",
    icon: { type: "icon", value: "chats", color: "#9ca3af" },
    sections: [
      {
        title: "Discussion",
        description: "Summarize what each person brought up.",
      },
      {
        title: "Agreements",
        description: "Include agreements only when explicit.",
      },
      {
        title: "Next steps",
        description: "Record stated next steps without inventing commitments.",
      },
    ],
  },
];
