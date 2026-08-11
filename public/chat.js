(() => {
  "use strict";

  const app = document.querySelector(".app");
  const productName = document.querySelector("#product-name");
  const messages = document.querySelector("#messages");
  const suggestions = document.querySelector("#suggestions");
  const form = document.querySelector("#chat-form");
  const question = document.querySelector("#question");
  const send = document.querySelector("#send-btn");
  const close = document.querySelector("#close-btn");
  let token = "";
  let config = null;
  let busy = false;
  const history = [];

  function postToParent(message) {
    window.parent.postMessage(message, "*");
  }

  function scrollToLatest() {
    messages.scrollTop = messages.scrollHeight;
  }

  function addMessage(role, content, options = {}) {
    const item = document.createElement("article");
    item.className = `message ${role}${options.error ? " error" : ""}`;
    const text = document.createElement("div");
    text.textContent = content;
    item.appendChild(text);
    if (Array.isArray(options.citations) && options.citations.length) {
      const sourceBox = document.createElement("div");
      sourceBox.className = "sources";
      const label = document.createElement("b");
      label.textContent = "Sources";
      sourceBox.appendChild(label);
      options.citations.slice(0, 5).forEach(citation => {
        const source = citation.sourceUrl ? document.createElement("a") : document.createElement("span");
        source.className = "source";
        source.textContent = `[${citation.number}] ${citation.title}${citation.heading ? ` — ${citation.heading}` : ""}`;
        if (citation.sourceUrl) {
          source.href = citation.sourceUrl;
          source.target = "_blank";
          source.rel = "noopener noreferrer";
        }
        sourceBox.appendChild(source);
      });
      item.appendChild(sourceBox);
    }
    messages.appendChild(item);
    scrollToLatest();
    return item;
  }

  function addThinking() {
    const item = document.createElement("article");
    item.className = "message assistant thinking";
    item.setAttribute("aria-label", "aiPandu is thinking");
    item.innerHTML = "<i></i><i></i><i></i>";
    messages.appendChild(item);
    scrollToLatest();
    return item;
  }

  function renderSuggestions(items) {
    suggestions.replaceChildren();
    (items || []).forEach(value => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion";
      button.textContent = value;
      button.addEventListener("click", () => {
        question.value = value;
        question.dispatchEvent(new Event("input"));
        form.requestSubmit();
      });
      suggestions.appendChild(button);
    });
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        ...(options.headers || {})
      },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) postToParent({ type: "aipandu:session-expired" });
    if (!response.ok) throw new Error(data.error || `aiPandu request failed (${response.status}).`);
    return data;
  }

  async function initialise(nextToken) {
    token = String(nextToken || "");
    if (!token) return;
    try {
      const data = await api("/api/config", { method: "GET" });
      config = data.integration;
      productName.textContent = `${config.productName} guide`;
      question.placeholder = config.placeholder || "Ask a question…";
      messages.replaceChildren();
      addMessage("assistant", config.welcomeMessage || "Hello! How can I help?");
      renderSuggestions(config.suggestions);
      question.disabled = false;
      send.disabled = false;
      app.setAttribute("aria-busy", "false");
      question.focus();
    } catch (error) {
      messages.replaceChildren();
      addMessage("assistant", error?.message || "Unable to start aiPandu.", { error: true });
    }
  }

  async function ask(value) {
    if (busy || !token) return;
    const queryText = String(value || "").trim();
    if (!queryText) return;
    busy = true;
    question.value = "";
    question.style.height = "auto";
    send.disabled = true;
    suggestions.replaceChildren();
    addMessage("user", queryText);
    const thinking = addThinking();
    try {
      const data = await api("/api/chat", {
        method: "POST",
        body: JSON.stringify({ query: queryText, history: history.slice(-6) })
      });
      thinking.remove();
      addMessage("assistant", data.answer, { citations: data.citations });
      history.push({ role: "user", content: queryText }, { role: "assistant", content: data.answer });
      if (history.length > 12) history.splice(0, history.length - 12);
    } catch (error) {
      thinking.remove();
      addMessage("assistant", error?.message || "I could not answer just now. Please try again.", { error: true });
    } finally {
      busy = false;
      send.disabled = false;
      question.focus();
    }
  }

  window.addEventListener("message", event => {
    if (event.source !== window.parent || event.data?.type !== "aipandu:init") return;
    initialise(event.data.token);
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    ask(question.value);
  });
  question.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  question.addEventListener("input", () => {
    question.style.height = "auto";
    question.style.height = `${Math.min(question.scrollHeight, 120)}px`;
  });
  close.addEventListener("click", () => postToParent({ type: "aipandu:close" }));

  postToParent({ type: "aipandu:ready" });
})();

