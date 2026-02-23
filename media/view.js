(function () {
  const vscode = acquireVsCodeApi();
  const app = document.getElementById("app");

  let state = {
    current: null,
    recent: [],
    pinned: [],
    others: [],
    groups: []
  };

  let errorMessage = "";
  let searchQuery = "";
  let globalEventsBound = false;
  const collapsedOverrides = new Map();

  window.addEventListener("message", (event) => {
    const message = event.data;

    if (message && message.type === "state") {
      state = applyIncomingState(message.payload);
      errorMessage = "";
      render();
      return;
    }

    if (message && message.type === "error") {
      errorMessage = String(message.message || "Unexpected error");
      render();
    }
  });

  function render(options) {
    const focusSearch = options && options.focusSearch;
    const selectionStart = options && typeof options.selectionStart === "number" ? options.selectionStart : 0;
    const selectionEnd = options && typeof options.selectionEnd === "number" ? options.selectionEnd : selectionStart;

    const filteredCurrent = state.current && matchesSearch(state.current) ? state.current : null;
    const filteredRecent = filterProjects(state.recent);
    const filteredPinned = filterProjects(state.pinned);
    const filteredOthers = filterProjects(state.others);
    const filteredGroups = filterGroupSections(state.groups);

    const rootContextValue = escapeHtml(
      JSON.stringify({
        webviewSection: "sidebarRoot",
        preventDefaultContextMenuItems: true
      })
    );

    const rawTotal =
      (state.current ? 1 : 0) +
      state.recent.length +
      state.pinned.length +
      state.others.length +
      state.groups.reduce((sum, section) => sum + section.projects.length, 0);
    const total =
      (filteredCurrent ? 1 : 0) +
      filteredRecent.length +
      filteredPinned.length +
      filteredOthers.length +
      filteredGroups.reduce((sum, section) => sum + section.projects.length, 0);

    const hasGroups = state.groups.length > 0;
    const emptyMessage =
      total === 0 && rawTotal === 0
        ? hasGroups
          ? "No folders found in your project groups yet."
          : "No projects saved yet. Use the save or add buttons in the toolbar above."
        : "No projects match your search.";

    const hasSectionsAfterCurrent =
      filteredRecent.length > 0 ||
      filteredPinned.length > 0 ||
      filteredOthers.length > 0 ||
      filteredGroups.some((section) => section.projects.length > 0 || !searchQuery.trim());

    app.innerHTML = `
      <div class="container" data-vscode-context="${rootContextValue}">
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
        ${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ""}
        ${total === 0 ? `<div class="empty">${emptyMessage}</div>` : ""}
        ${sectionTemplate("Current project", filteredCurrent ? [filteredCurrent] : [])}
        ${filteredCurrent && hasSectionsAfterCurrent ? `<div class="divider"></div>` : ""}
        ${sectionTemplate("Recent", filteredRecent)}
        ${sectionTemplate("Pinned", filteredPinned)}
        ${sectionTemplate("Projects", filteredOthers)}
        ${filteredGroups.map(groupSectionTemplate).join("")}
      </div>
    `;

    bindEvents();
    updatePathTooltips();

    if (focusSearch) {
      const searchInput = app.querySelector("[data-project-search]");
      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus();
        searchInput.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }

  function applyIncomingState(payload) {
    const nextState =
      payload && typeof payload === "object"
        ? payload
        : { current: null, recent: [], pinned: [], others: [], groups: [] };
    const recent = Array.isArray(nextState.recent) ? nextState.recent : [];
    const groups = Array.isArray(nextState.groups) ? nextState.groups : [];

    const mergedGroups = groups.map((group) => {
      const localCollapsed = collapsedOverrides.get(group.id);
      if (typeof localCollapsed !== "boolean") {
        return group;
      }

      const serverCollapsed = Boolean(group.collapsed);
      if (localCollapsed === serverCollapsed) {
        collapsedOverrides.delete(group.id);
        return group;
      }

      return {
        ...group,
        collapsed: localCollapsed
      };
    });

    return {
      ...nextState,
      recent,
      groups: mergedGroups
    };
  }

  function filterProjects(projects) {
    if (!searchQuery.trim()) {
      return projects;
    }

    return projects.filter((project) => matchesSearch(project));
  }

  function filterGroupSections(groups) {
    const query = searchQuery.trim();
    const forceExpanded = query.length > 0;

    return groups
      .map((section) => {
        return {
          ...section,
          collapsed: forceExpanded ? false : Boolean(section.collapsed),
          projects: filterProjects(section.projects)
        };
      })
      .filter((section) => section.projects.length > 0 || query.length === 0);
  }

  function matchesSearch(project) {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const haystack = `${project.name} ${project.fullPath} ${project.kind}`.toLowerCase();
    return haystack.includes(query);
  }

  function sectionTemplate(title, projects) {
    if (!projects || projects.length === 0) {
      return "";
    }

    return `
      <section class="section">
        <h2 class="section-title">${escapeHtml(title)}</h2>
        <div class="project-list">
          ${projects.map(projectCardTemplate).join("")}
        </div>
      </section>
    `;
  }

  function groupSectionTemplate(section) {
    const collapsed = Boolean(section.collapsed);

    return `
      <section class="section">
        <button
          class="section-toggle"
          type="button"
          data-group-toggle="${escapeHtml(section.id)}"
          aria-expanded="${collapsed ? "false" : "true"}"
        >
          <span class="section-title">${escapeHtml(section.title)}</span>
          <span class="section-caret ${collapsed ? "is-collapsed" : ""}" aria-hidden="true"></span>
        </button>
        ${collapsed
          ? ""
          : section.projects.length > 0
            ? `<div class="project-list">${section.projects.map(projectCardTemplate).join("")}</div>`
            : `<div class="group-empty">No folders found</div>`}
      </section>
    `;
  }

  function projectCardTemplate(project) {
    const badgeTone = Number.isInteger(project.badgeTone) ? project.badgeTone : 0;
    const badgeColorOverride = typeof project.badgeColorOverride === "string" ? project.badgeColorOverride : "";
    const badge = badgeColorOverride
      ? customBadgeTemplate(project.initials, badgeColorOverride)
      : `<span class="badge badge-tone-${badgeTone}">${escapeHtml(project.initials)}</span>`;

    const contextValue = JSON.stringify({
      webviewSection: "projectCard",
      preventDefaultContextMenuItems: true,
      projectId: project.id,
      projectPinned: project.pinned,
      projectIsCurrent: project.isCurrent,
      projectVirtual: project.isVirtual
    });

    const openInNewWindowBtn = project.isCurrent
      ? ""
      : `<div class="card-actions">${iconBtn("openProject", project.id, "new-window", "Open in new window", true)}</div>`;

    return `
      <article
        class="project-card ${project.isCurrent ? "is-current" : ""}"
        data-vscode-context="${escapeHtml(contextValue)}"
      >
        <button
          class="project-open"
          type="button"
          data-project-open="${escapeHtml(project.id)}"
          title="Open ${escapeHtml(project.name)}"
          aria-label="Open ${escapeHtml(project.name)}"
        >
          ${badge}
          <span class="meta">
            <span class="name">${escapeHtml(project.name)}</span>
            <span class="path" data-full-path="${escapeHtml(project.fullPath)}">${escapeHtml(project.displayPath)}</span>
          </span>
        </button>
        ${openInNewWindowBtn}
      </article>
    `;
  }

  function customBadgeTemplate(initials, color) {
    return `
      <svg class="badge-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="${escapeHtml(color)}"></rect>
        <text x="12" y="12.2" text-anchor="middle" dominant-baseline="middle">${escapeHtml(initials)}</text>
      </svg>
    `;
  }

  function iconBtn(action, projectId, iconName, tooltip, newWindow) {
    return `
      <button
        class="icon-btn"
        type="button"
        data-project-action="${escapeHtml(action)}"
        data-project-id="${escapeHtml(projectId)}"
        ${newWindow ? 'data-new-window="true"' : ""}
        title="${escapeHtml(tooltip)}"
        aria-label="${escapeHtml(tooltip)}"
      >
        ${cardIcon(iconName)}
      </button>
    `;
  }

  function bindEvents() {
    if (globalEventsBound) {
      return;
    }

    globalEventsBound = true;

    app.addEventListener("click", handleAppClick);
    app.addEventListener("input", handleAppInput);
    window.addEventListener("resize", updatePathTooltips);
  }

  function handleAppClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const groupToggle = target.closest("[data-group-toggle]");
    if (groupToggle) {
      const groupId = groupToggle.getAttribute("data-group-toggle");
      if (groupId && toggleGroupCollapsedLocally(groupId)) {
        vscode.postMessage({ type: "toggleGroupCollapsed", groupId });
      }
      return;
    }

    const actionButton = target.closest("[data-project-action]");
    if (actionButton) {
      postProjectAction(actionButton);
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

    vscode.postMessage({ type: "openProject", projectId });
  }

  function postProjectAction(element) {
    const type = element.getAttribute("data-project-action");
    const projectId = element.getAttribute("data-project-id");
    const newWindow = element.getAttribute("data-new-window") === "true";

    if (!type || !projectId) {
      return;
    }

    vscode.postMessage({ type, projectId, ...(newWindow ? { newWindow: true } : {}) });
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

  function toggleGroupCollapsedLocally(groupId) {
    const currentGroup = state.groups.find((group) => group.id === groupId);
    if (!currentGroup) {
      return false;
    }

    const nextCollapsed = !Boolean(currentGroup.collapsed);
    collapsedOverrides.set(groupId, nextCollapsed);

    state = {
      ...state,
      groups: state.groups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }

        return {
          ...group,
          collapsed: nextCollapsed
        };
      })
    };

    render();
    return true;
  }

  function updatePathTooltips() {
    app.querySelectorAll(".path[data-full-path]").forEach((element) => {
      const fullPath = element.getAttribute("data-full-path") || "";
      if (element.scrollWidth > element.clientWidth + 1) {
        element.setAttribute("title", fullPath);
      } else {
        element.removeAttribute("title");
      }
    });
  }

  function cardIcon(name) {
    switch (name) {
      case "new-window":
        return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4"/><path d="M13.5 2.5 8 8"/><path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9"/></svg>`;
      default:
        return "";
    }
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
  vscode.postMessage({ type: "refresh" });
})();
