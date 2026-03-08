(function () {
  const vscode = acquireVsCodeApi();
  const app = document.getElementById("app");

  let searchQuery = "";
  let state = { projects: [] };
  let eventsBound = false;
  let didApplyInitialFocus = false;
  let activeProjectId;

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type !== "state") {
      return;
    }

    const focusedProjectId = getFocusedProjectId() || activeProjectId;
    const activeElement = document.activeElement;
    const isSearchFocused = isSearchInputElement(activeElement);
    const selectionStart = isSearchFocused ? activeElement.selectionStart ?? searchQuery.length : searchQuery.length;
    const selectionEnd = isSearchFocused ? activeElement.selectionEnd ?? selectionStart : selectionStart;

    state = normalizeState(message.payload);
    render({
      focusProjectId: focusedProjectId,
      focusSearch: isSearchFocused,
      selectionStart,
      selectionEnd
    });
  });

  function normalizeState(payload) {
    if (!payload || typeof payload !== "object") {
      return { sections: [] };
    }

    const projects = Array.isArray(payload.projects) ? payload.projects : [];
    return {
      projects: projects.map((project) => {
        return {
          id: String(project.id || ""),
          name: String(project.name || ""),
          displayPath: String(project.displayPath || ""),
          fullPath: String(project.fullPath || project.displayPath || ""),
          initials: String(project.initials || "?"),
          branch: typeof project.branch === "string" ? project.branch : "",
          badgeTone: Number.isInteger(project.badgeTone) ? project.badgeTone : 0,
          badgeColorOverride:
            typeof project.badgeColorOverride === "string" ? project.badgeColorOverride : "",
          isCurrent: project.isCurrent === true
        };
      })
    };
  }

  function render(options) {
    const focusSearch = Boolean(options && options.focusSearch);
    const focusProjectId =
      options && typeof options.focusProjectId === "string" ? options.focusProjectId : undefined;
    const selectionStart = options && typeof options.selectionStart === "number" ? options.selectionStart : searchQuery.length;
    const selectionEnd = options && typeof options.selectionEnd === "number" ? options.selectionEnd : selectionStart;

    const query = searchQuery.trim().toLowerCase();
    const filteredProjects = state.projects.filter((project) => matchesSearch(project, query));

    if (filteredProjects.length === 0) {
      activeProjectId = undefined;
    } else if (!filteredProjects.some((project) => project.id === activeProjectId)) {
      activeProjectId = filteredProjects[0].id;
    }

    const hasProjects = filteredProjects.length > 0;

    app.innerHTML = `
      <div class="container">
        <div class="preview-header">
          <div class="preview-title">Quick Launcher Preview</div>
          <div class="preview-hint">Enter opens project, Shift+Enter opens in a new window.</div>
        </div>
        <div class="search-wrap">
          <span class="search-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.25"/><path d="M10.5 10.5 14 14"/></svg>
          </span>
          <input
            class="search-input"
            type="text"
            data-project-search
            placeholder="Search projects"
            value="${escapeHtml(searchQuery)}"
            aria-label="Search projects"
          />
        </div>
        ${hasProjects
          ? `<div class="project-grid">${filteredProjects.map(projectCardTemplate).join("")}</div>`
          : `<div class="empty">No projects match your search.</div>`}
      </div>
    `;

    bindEvents();
    updateFocusedCardStyles();

    if (focusSearch) {
      didApplyInitialFocus = true;
      focusSearchInput(selectionStart, selectionEnd);
      return;
    }

    if (focusProjectId && focusProjectButtonById(focusProjectId, true)) {
      didApplyInitialFocus = true;
      return;
    }

    if (activeProjectId && focusProjectButtonById(activeProjectId, true)) {
      didApplyInitialFocus = true;
      return;
    }

    if (!didApplyInitialFocus && focusFirstProjectButton()) {
      didApplyInitialFocus = true;
    }
  }

  function projectCardTemplate(project) {
    const badgeTone = Number.isInteger(project.badgeTone) ? project.badgeTone : 0;
    const badgeColorOverride =
      typeof project.badgeColorOverride === "string" ? project.badgeColorOverride : "";
    const badge = badgeColorOverride
      ? customBadgeTemplate(project.initials || "?", badgeColorOverride)
      : `<span class="badge badge-tone-${badgeTone}">${escapeHtml(project.initials || "?")}</span>`;
    const branch = typeof project.branch === "string" ? project.branch : "";
    const currentProjectDot = project.isCurrent ? '<span class="current-project-dot" aria-hidden="true"></span>' : "";
    const focusedClass = project.id === activeProjectId ? "is-focused" : "";

    return `
      <article class="project-card ${project.isCurrent ? "is-current" : ""} ${focusedClass}">
        <button
          class="project-open"
          type="button"
          data-project-open="${escapeHtml(project.id)}"
          title="Open ${escapeHtml(project.name)}"
          aria-label="Open ${escapeHtml(project.name)}"
        >
          ${badge}
          <span class="meta">
            <span class="name">${currentProjectDot}<span class="name-label">${escapeHtml(project.name)}</span></span>
            ${branch ? `<span class="branch">${cardIcon("git-branch")}<span class="branch-name">${escapeHtml(branch)}</span></span>` : ""}
            <span class="path" title="${escapeHtml(project.fullPath || project.displayPath)}">${escapeHtml(project.displayPath || "")}</span>
          </span>
        </button>
        ${project.isCurrent
          ? ""
          : `<div class="card-actions">
              <button
                class="icon-btn"
                type="button"
                data-project-action="openProject"
                data-project-id="${escapeHtml(project.id)}"
                data-new-window="true"
                title="Open in new window"
                aria-label="Open in new window"
              >
                ${cardIcon("new-window")}
              </button>
            </div>`}
      </article>
    `;
  }

  function bindEvents() {
    if (eventsBound) {
      return;
    }

    eventsBound = true;
    app.addEventListener("click", handleAppClick);
    app.addEventListener("input", handleAppInput);
    app.addEventListener("focusin", handleAppFocusIn);
    window.addEventListener("keydown", handleGlobalKeyDown, true);
  }

  function handleAppClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionButton = target.closest("[data-project-action]");
    if (actionButton) {
      const projectId = actionButton.getAttribute("data-project-id");
      const newWindow = actionButton.getAttribute("data-new-window") === "true";
      if (projectId) {
        setActiveProjectId(projectId);
        openProject(projectId, newWindow);
      }
      return;
    }

    const openButton = target.closest("[data-project-open]");
    if (!openButton) {
      return;
    }

    const projectId = openButton.getAttribute("data-project-open");
    if (projectId) {
      setActiveProjectId(projectId);
      openProject(projectId, false);
    }
  }

  function handleAppFocusIn(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const openButton = target.closest("[data-project-open]");
    if (!openButton) {
      return;
    }

    const projectId = openButton.getAttribute("data-project-open");
    if (!projectId) {
      return;
    }

    setActiveProjectId(projectId);
  }

  function handleAppInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches("[data-project-search]")) {
      return;
    }

    searchQuery = target.value;
    const selectionStart = target.selectionStart ?? searchQuery.length;
    const selectionEnd = target.selectionEnd ?? selectionStart;
    render({ focusSearch: true, selectionStart, selectionEnd });
  }

  function handleGlobalKeyDown(event) {
    if (redirectTypingToSearch(event)) {
      return;
    }

    if (handleHorizontalArrowNavigation(event)) {
      return;
    }

    if (handleShiftEnterFromProject(event)) {
      return;
    }

    if (handleEnterFromSearch(event)) {
      return;
    }

    if (handleEnterFromActiveProject(event)) {
      return;
    }
  }

  function redirectTypingToSearch(event) {
    if (isSearchInputElement(event.target)) {
      return false;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      searchQuery = searchQuery.slice(0, -1);
      render({
        focusSearch: true,
        selectionStart: searchQuery.length,
        selectionEnd: searchQuery.length
      });
      return true;
    }

    if (event.key.length === 1) {
      event.preventDefault();
      searchQuery += event.key;
      render({
        focusSearch: true,
        selectionStart: searchQuery.length,
        selectionEnd: searchQuery.length
      });
      return true;
    }

    return false;
  }

  function handleHorizontalArrowNavigation(event) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown"
    ) {
      return false;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }

    const projectButtons = getProjectButtons();
    if (projectButtons.length === 0) {
      return false;
    }

    const activeProjectButton = getActiveProjectButton() || getProjectButtonById(activeProjectId);
    let currentIndex = activeProjectButton ? projectButtons.indexOf(activeProjectButton) : -1;
    if (currentIndex < 0) {
      currentIndex = 0;
      projectButtons[0].focus();
      setActiveProjectId(projectButtons[0].getAttribute("data-project-open") || undefined);
    }

    const stepByKey = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -3,
      ArrowDown: 3
    };
    const delta = stepByKey[event.key] || 0;
    const nextIndex = Math.max(0, Math.min(projectButtons.length - 1, currentIndex + delta));

    const nextButton = projectButtons[nextIndex];
    const nextProjectId = nextButton.getAttribute("data-project-open");
    setActiveProjectId(nextProjectId || undefined);
    nextButton.focus();
    event.preventDefault();
    return true;
  }

  function handleShiftEnterFromProject(event) {
    if (event.key !== "Enter" || !event.shiftKey) {
      return false;
    }

    const openButton = event.target.closest("[data-project-open]");
    if (!openButton) {
      return false;
    }

    const projectId = openButton.getAttribute("data-project-open");
    if (!projectId) {
      return false;
    }

    event.preventDefault();
    setActiveProjectId(projectId);
    openProject(projectId, true);
    return true;
  }

  function handleEnterFromSearch(event) {
    if (event.key !== "Enter") {
      return false;
    }

    const searchInput = event.target.closest("[data-project-search]");
    if (!searchInput) {
      return false;
    }

    const targetProjectButton = getProjectButtonById(activeProjectId) || getProjectButtons()[0];
    if (!targetProjectButton) {
      return false;
    }

    const projectId = targetProjectButton.getAttribute("data-project-open");
    if (!projectId) {
      return false;
    }

    event.preventDefault();
    setActiveProjectId(projectId);
    openProject(projectId, event.shiftKey);
    return true;
  }

  function handleEnterFromActiveProject(event) {
    if (event.key !== "Enter") {
      return false;
    }

    const activeProjectButton = getActiveProjectButton() || getProjectButtonById(activeProjectId);
    if (!activeProjectButton) {
      return false;
    }

    const projectId = activeProjectButton.getAttribute("data-project-open");
    if (!projectId) {
      return false;
    }

    event.preventDefault();
    setActiveProjectId(projectId);
    openProject(projectId, event.shiftKey);
    return true;
  }

  function focusSearchInput(selectionStart, selectionEnd) {
    const searchInput = app.querySelector("[data-project-search]");
    if (!(searchInput instanceof HTMLInputElement)) {
      return false;
    }

    searchInput.focus();
    searchInput.setSelectionRange(selectionStart, selectionEnd);
    return true;
  }

  function focusFirstProjectButton() {
    const firstProjectButton = getProjectButtons()[0];
    if (!firstProjectButton) {
      return false;
    }

    const projectId = firstProjectButton.getAttribute("data-project-open");
    setActiveProjectId(projectId || undefined);
    firstProjectButton.focus();
    return true;
  }

  function focusProjectButtonById(projectId, shouldFocusElement) {
    const projectButton = getProjectButtonById(projectId);

    if (!projectButton) {
      return false;
    }

    setActiveProjectId(projectId);
    if (shouldFocusElement) {
      projectButton.focus();
    }
    return true;
  }

  function getFocusedProjectId() {
    const activeProjectButton = getActiveProjectButton();
    return activeProjectButton?.getAttribute("data-project-open") ?? undefined;
  }

  function getActiveProjectButton() {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof Element)) {
      return undefined;
    }

    const projectButton = activeElement.closest("[data-project-open]");
    return projectButton instanceof HTMLButtonElement ? projectButton : undefined;
  }

  function getProjectButtonById(projectId) {
    if (!projectId) {
      return undefined;
    }

    return getProjectButtons().find((button) => {
      return button.getAttribute("data-project-open") === projectId;
    });
  }

  function getProjectButtons() {
    return Array.from(app.querySelectorAll("[data-project-open]")).filter((candidate) => {
      return candidate instanceof HTMLButtonElement;
    });
  }

  function setActiveProjectId(projectId) {
    activeProjectId = projectId;
    updateFocusedCardStyles();
  }

  function updateFocusedCardStyles() {
    const cards = app.querySelectorAll(".project-card");
    cards.forEach((card) => {
      card.classList.remove("is-focused");
    });

    if (!activeProjectId) {
      return;
    }

    const projectButton = getProjectButtonById(activeProjectId);
    if (!projectButton) {
      return;
    }

    const projectCard = projectButton.closest(".project-card");
    if (!(projectCard instanceof HTMLElement)) {
      return;
    }

    projectCard.classList.add("is-focused");
  }

  function isSearchInputElement(candidate) {
    return candidate instanceof HTMLInputElement && candidate.matches("[data-project-search]");
  }

  function openProject(projectId, newWindow) {
    vscode.postMessage({
      type: "openProject",
      projectId,
      ...(newWindow ? { newWindow: true } : {})
    });
  }

  function matchesSearch(project, query) {
    if (!query) {
      return true;
    }

    const values = [project.name, project.displayPath, project.fullPath, project.branch]
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLowerCase();

    return values.includes(query);
  }

  function cardIcon(name) {
    switch (name) {
      case "new-window":
        return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4"/><path d="M13.5 2.5 8 8"/><path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9"/></svg>`;
      case "git-branch":
        return `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M14 5.5C14 4.121 12.879 3 11.5 3C10.121 3 9 4.121 9 5.5C9 6.682 9.826 7.669 10.93 7.928C10.744 8.546 10.177 9 9.5 9H6.5C5.935 9 5.419 9.195 5 9.512V4.949C6.14 4.717 7 3.707 7 2.5C7 1.121 5.879 0 4.5 0C3.121 0 2 1.121 2 2.5C2 3.708 2.86 4.717 4 4.949V11.05C2.86 11.282 2 12.292 2 13.499C2 14.878 3.121 15.999 4.5 15.999C5.879 15.999 7 14.878 7 13.499C7 12.317 6.174 11.33 5.07 11.071C5.256 10.453 5.823 9.999 6.5 9.999H9.5C10.723 9.999 11.74 9.115 11.954 7.953C13.116 7.738 14 6.723 14 5.5ZM3 2.5C3 1.673 3.673 1 4.5 1C5.327 1 6 1.673 6 2.5C6 3.327 5.327 4 4.5 4C3.673 4 3 3.327 3 2.5ZM6 13.5C6 14.327 5.327 15 4.5 15C3.673 15 3 14.327 3 13.5C3 12.673 3.673 12 4.5 12C5.327 12 6 12.673 6 13.5ZM11.5 7C10.673 7 10 6.327 10 5.5C10 4.673 10.673 4 11.5 4C12.327 4 13 4.673 13 5.5C13 6.327 12.327 7 11.5 7Z"/></svg>`;
      default:
        return "";
    }
  }

  function customBadgeTemplate(initials, color) {
    return `
      <svg class="badge-svg" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
        <rect x="0.5" y="0.5" width="27" height="27" rx="7" fill="${escapeHtml(color)}"></rect>
        <text x="14" y="14.5" text-anchor="middle" dominant-baseline="middle">${escapeHtml(initials)}</text>
      </svg>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  render();
  vscode.postMessage({ type: "ready" });
})();
