
import { JTBDNode, JobLevel, GenerationParams } from "../types";

export const generateJTBDGraph = async (params: GenerationParams, apiKey: string): Promise<JTBDNode> => {
  if (!apiKey) throw new Error("API Key is missing");

  // LOG: Начало работы
  console.log("🚀 [JTBD Service] Starting generation...", params);

  const url = "https://openrouter.ai/api/v1/chat/completions";
  
  let userContext = "";
  if (params.mode === 'detailed') {
    userContext = `
    ВВОДНЫЕ ДАННЫЕ ДЛЯ АНАЛИЗА:
    1. Проблема/Стремление пользователя: "${params.problem}"
    2. Портрет Клиента (Persona): "${params.persona || 'Не указано'}"
    3. Отличительная черта/УТП продукта или ситуации: "${params.uniqueTrait || 'Стандартная ситуация'}"
    4. Контекст/Сегмент рынка: "${params.segmentContext || 'Общий рынок'}"

    ЗАДАЧА:
    Построй полное дерево работ (Job Tree), декомпозируя верхнеуровневую задачу до микро-действий.
    `;
  } else {
    userContext = `Проанализируй проблему/стремление: "${params.problem}". Разложи её на детальную иерархию JTBD.`;
  }

  const systemPrompt = `
    Ты — ведущий архитектор продуктовых стратегий и эксперт по методологии Jobs To Be Done (JTBD).
    Твоя задача — сгенерировать глубоко проработанную, вложенную JSON структуру дерева работ.

    СТРУКТУРА ОТВЕТА (JSON):
    Ты должен вернуть ТОЛЬКО валидный JSON объект, соответствующий этой схеме:
    {
      "id": "уникальный_id",
      "name": "Название работы (Глагол + Существительное)",
      "type": "УРОВЕНЬ_РАБОТЫ",
      "description": "Практическое описание того, что делается",
      "annotation": "МЕТОДОЛОГИЧЕСКОЕ ОБОСНОВАНИЕ (Почему этот уровень?)",
      "children": [ ... ]
    }

    УРОВНИ ИЕРАРХИИ (значения для поля "type"):
    1. "${JobLevel.SUPER_BIG}" — Глобальное стремление ("Быть финансово независимым").
    2. "${JobLevel.BIG}" — Стратегия выполнения ("Сформировать инвестиционный портфель").
    3. "${JobLevel.SMALL}" — Тактика / Процесс ("Выбрать брокера и открыть счет").
    4. "${JobLevel.CORE}" — Конкретная функция / Задача ("Купить акции Apple").
    5. "${JobLevel.MICRO}" — Микро-действие / Интерфейс ("Нажать кнопку подтверждения").

    КРИТИЧЕСКИ ВАЖНЫЕ ТРЕБОВАНИЯ:
    1. ПОЛЕ "annotation" ОБЯЗАТЕЛЬНО ЗАПОЛНЯТЬ ДЛЯ КАЖДОГО УЗЛА!
       Ты должен объяснить, почему узел относится именно к этому уровню.
       Пример для BIG: "Это стратегический выбор способа решения проблемы, но еще не конкретные шаги."
       Пример для CORE: "Это конкретное завершенное действие, приносящее результат здесь и сейчас."
    
    2. Глубина дерева должна доходить до уровня MICRO хотя бы в одной ветке.
    3. Используй русский язык.
    4. Не добавляй никакого текста до или после JSON.

    Пример JSON (фрагмент):
    {
      "id": "root",
      "name": "Улучшить физическую форму",
      "type": "${JobLevel.SUPER_BIG}",
      "description": "Стремление чувствовать себя здоровым и энергичным.",
      "annotation": "Это корневая мотивация высокого уровня, определяющая 'Зачем' пользователь вообще что-то делает.",
      "children": []
    }
  `;

  // Используем быструю и умную модель
  const payload = {
    "model": "xiaomi/mimo-v2-flash:free", 
    "messages": [
      {
        "role": "system",
        "content": systemPrompt
      },
      {
        "role": "user",
        "content": userContext
      }
    ],
    "response_format": { "type": "json_object" }
  };

  // Controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout for deeper trees

  try {
    console.log("📡 [JTBD Service] Sending request to OpenRouter...", payload);

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.href,
            "X-Title": "JTBD Architect"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log("fw [JTBD Service] Response status:", response.status);

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("❌ [JTBD Service] API Error Details:", errData);
        throw new Error(errData.error?.message || `OpenRouter Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("📦 [JTBD Service] Raw API Data:", data);

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error("Пустой ответ от AI сервиса (no content in choices)");
    }

    console.log("📝 [JTBD Service] Content string length:", content.length);
    
    // Robust JSON cleaning: find the first '{' and the last '}'
    const jsonStartIndex = content.indexOf('{');
    const jsonEndIndex = content.lastIndexOf('}');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
        console.error("❌ [JTBD Service] Could not find JSON braces in content:", content);
        throw new Error("Ответ модели не содержит валидный JSON объект");
    }

    const cleanContent = content.substring(jsonStartIndex, jsonEndIndex + 1);

    try {
        const result = JSON.parse(cleanContent) as JTBDNode;
        console.log("✅ [JTBD Service] Parsed successfully:", result);
        return result;
    } catch (parseError) {
        console.error("❌ [JTBD Service] JSON Parse Error. Content was:", cleanContent);
        throw new Error("Ошибка обработки ответа (Invalid JSON)");
    }

  } catch (e: any) {
    console.error("❌ [JTBD Service] Global Error:", e);
    if (e.name === 'AbortError') {
        throw new Error("Превышено время ожидания ответа от сервера (90 сек). Попробуйте упростить запрос.");
    }
    throw new Error(e instanceof Error ? e.message : "Не удалось сгенерировать граф.");
  }
};
