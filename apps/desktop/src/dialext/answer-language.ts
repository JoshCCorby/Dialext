// Words that mark a short answer as English or Irish. Words spelt the same in both
// ("an", "a", "is", "do", "i", "sin") are left out, so they count for neither.
const MARKERS: Record<"en" | "ga", Set<string>> = {
  en: new Set(
    `the and was were are be been he she they it its of to on for with that this
    these those did does not no yes there their them his her him what which who
    when where why how one two three four five six seven eight nine ten twice
    only just also but or from by would could should will has have had asked
    wanted wants want said says`.split(/\s+/),
  ),
  ga: new Set(
    `agus bhí tá níl ní níor raibh ba mhaith sé sí siad mé tú muid sibh ar ag le
    de go sa ina iad aon dó dhá dá trí ceithre cúig seacht ocht naoi deich
    freisin seo sea ea nach cad céard cé conas cathain cén cá ticéad thicéad
    ticéid dúirt deir iarr d'iarr ag iarraidh`.split(/\s+/),
  ),
};

const FADA = /[áéíóú]/;

/// The language a short answer is written in, when its words say so clearly: English
/// or Irish by marker words, with any fada counting towards Irish. Returns null for
/// an answer with no signal either way (a bare name, a number in digits), which is
/// then accepted as written. This is a check the app makes itself, so it holds
/// whichever model wrote the answer.
export function detectAnswerLanguage(text: string): "en" | "ga" | null {
  let en = 0;
  let ga = 0;
  for (const word of text.toLocaleLowerCase().match(/[\p{L}']+/gu) ?? []) {
    if (MARKERS.en.has(word)) en += 1;
    if (MARKERS.ga.has(word)) ga += 1;
    else if (FADA.test(word)) ga += 1;
  }
  if (en === ga) return null;
  return en > ga ? "en" : "ga";
}

/// Whether an answer is clearly in a language other than the reading's. Only the
/// languages the check knows are enforced; any other reading is not second-guessed.
export function answerIsInOtherLanguage(text: string, targetLanguage: string) {
  const target =
    targetLanguage === "english" || targetLanguage === "en"
      ? "en"
      : targetLanguage === "irish" || targetLanguage === "ga"
        ? "ga"
        : null;
  if (!target) return false;
  const detected = detectAnswerLanguage(text);
  return detected !== null && detected !== target;
}
