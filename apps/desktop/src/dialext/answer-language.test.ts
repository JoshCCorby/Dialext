import { describe, expect, it } from "vitest";

import {
  answerIsInOtherLanguage,
  detectAnswerLanguage,
} from "./answer-language";

describe("detecting an answer's language", () => {
  it.each([
    ["Two", "en"],
    ["Gary wanted three tickets.", "en"],
    ["Dhá thicéad", "ga"],
    ["Dá thicéad", "ga"],
    ["Bhí Gary ag iarraidh trí thicéad.", "ga"],
    ["Gary", null],
    ["3", null],
  ])("reads %j as %s", (text, language) => {
    expect(detectAnswerLanguage(text)).toBe(language);
  });

  it("flags only an answer clearly in another language than the reading", () => {
    expect(answerIsInOtherLanguage("Two", "ga")).toBe(true);
    expect(answerIsInOtherLanguage("Two", "irish")).toBe(true);
    expect(answerIsInOtherLanguage("Dhá thicéad", "ga")).toBe(false);
    expect(answerIsInOtherLanguage("Dhá thicéad", "en")).toBe(true);
    expect(answerIsInOtherLanguage("Gary", "ga")).toBe(false);
    expect(answerIsInOtherLanguage("Two", "fr")).toBe(false);
  });
});
