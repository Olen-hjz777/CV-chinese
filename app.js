(() => {
  "use strict";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  let cv = clone(window.CV_DATA);
  let savedCv = clone(window.CV_DATA);
  let adminSession = null;
  let dirty = false;
  let toastTimer = null;
  const githubApiVersion = "2022-11-28";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const editorSchemas = {
    meta: {
      title: "编辑主页",
      fields: [
        { name: "nameCn", label: "中文姓名", required: true },
        { name: "nameEn", label: "英文姓名", required: true, lang: "en" },
        { name: "eyebrow", label: "英文研究方向", required: true, lang: "en" },
        { name: "intro", label: "个人简介", type: "textarea", required: true },
        { name: "email", label: "邮箱", type: "email", required: true },
        { name: "phone", label: "电话显示", required: true },
        { name: "phoneLink", label: "电话链接（仅数字与 +）", required: true }
      ]
    },
    profile: {
      title: "编辑研究画像",
      fields: [
        { name: "headline", label: "标题", required: true },
        { name: "summary", label: "研究简介", type: "textarea", required: true },
        { name: "focus", label: "研究方向（每行一项）", type: "lines", required: true }
      ]
    },
    contact: {
      title: "编辑联系页",
      fields: [
        { name: "headline", label: "联系页标题", type: "textarea", required: true }
      ]
    },
    education: {
      title: "教育经历",
      collection: true,
      fields: [
        { name: "period", label: "时间", required: true },
        { name: "school", label: "学校", required: true },
        { name: "program", label: "学院与专业", type: "textarea", required: true },
        { name: "details", label: "成绩与补充信息" },
        { name: "location", label: "地点" }
      ]
    },
    exchange: {
      title: "交流或田野经历",
      collection: true,
      primitive: true,
      fields: [{ name: "value", label: "经历", type: "textarea", required: true }]
    },
    research: {
      title: "论文成果",
      collection: true,
      fields: [
        { name: "role", label: "作者身份", required: true },
        { name: "status", label: "发表状态", required: true },
        {
          name: "statusType",
          label: "状态颜色",
          type: "select",
          options: [
            ["published", "已发表"],
            ["review", "Under Review"]
          ]
        },
        { name: "title", label: "论文题目", type: "textarea", required: true },
        { name: "journal", label: "期刊", required: true },
        { name: "summary", label: "摘要概述", type: "textarea", required: true },
        {
          name: "language",
          label: "题目语言",
          type: "select",
          options: [
            ["zh", "中文"],
            ["en", "English"]
          ]
        },
        { name: "featured", label: "设为重点论文", type: "checkbox" }
      ]
    },
    projects: {
      title: "项目",
      collection: true,
      fields: [
        { name: "type", label: "项目类别", required: true },
        { name: "title", label: "项目名称", type: "textarea", required: true },
        { name: "code", label: "批准号" }
      ]
    },
    conferences: {
      title: "学术会议",
      collection: true,
      fields: [
        { name: "date", label: "日期", required: true },
        { name: "name", label: "会议名称", type: "textarea", required: true }
      ]
    },
    honors: {
      title: "荣誉奖励",
      collection: true,
      primitive: true,
      fields: [{ name: "value", label: "荣誉名称", required: true }]
    },
    skills: {
      title: "能力与实践",
      collection: true,
      fields: [
        { name: "title", label: "栏目名称", required: true },
        { name: "body", label: "内容", type: "textarea", required: true }
      ]
    }
  };

  function getPath(object, path) {
    return path.split(".").reduce((value, key) => value?.[key], object);
  }

  function setTextBindings() {
    $$("[data-bind]").forEach((element) => {
      element.textContent = getPath(cv, element.dataset.bind) ?? "";
    });
    $$("[data-bind-href]").forEach((element) => {
      const value = getPath(cv, element.dataset.bindHref) ?? "";
      element.href = `${element.dataset.hrefPrefix ?? ""}${value}`;
    });
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function makeEditButton(kind, index) {
    const button = makeElement("button", "item-edit", "编辑");
    button.type = "button";
    button.dataset.edit = kind;
    button.dataset.index = String(index);
    button.setAttribute("aria-label", "编辑此项");
    return button;
  }

  function renderHome() {
    const summary = $("#home-summary");
    summary.replaceChildren();
    const metrics = [
      [String(cv.research.length), "篇代表性论文"],
      [String(cv.projects.length), "项国家级基金项目参与"],
      ["CSSCI / SSCI", "中英文期刊发表"]
    ];
    metrics.forEach(([value, label]) => {
      const item = makeElement("div", "summary-item");
      const strong = makeElement("strong", "", value);
      if (value.includes("CSSCI")) strong.lang = "en";
      item.append(strong, makeElement("span", "", label));
      summary.append(item);
    });
  }

  function renderProfile() {
    const grid = $("#focus-grid");
    grid.replaceChildren();
    cv.profile.focus.forEach((item) => {
      grid.append(makeElement("div", "focus-item", item));
    });
  }

  function renderEducation() {
    const list = $("#education-list");
    list.replaceChildren();
    cv.education.forEach((item, index) => {
      const article = makeElement("article", "timeline-item");
      const time = makeElement("time", "", item.period);
      const body = makeElement("div", "timeline-body");
      body.append(
        makeElement("h3", "", item.school),
        makeElement("p", "", item.program)
      );
      const metaParts = [item.details, item.location].filter(Boolean);
      if (metaParts.length) body.append(makeElement("span", "item-meta", metaParts.join(" · ")));
      article.append(time, body, makeEditButton("education", index));
      list.append(article);
    });

    const exchangeList = $("#exchange-list");
    exchangeList.replaceChildren();
    cv.exchange.forEach((item, index) => {
      const row = makeElement("div", "exchange-item");
      row.append(makeElement("span", "", item), makeEditButton("exchange", index));
      exchangeList.append(row);
    });
  }

  function renderResearch() {
    const list = $("#research-list");
    list.replaceChildren();
    cv.research.forEach((item, index) => {
      const article = makeElement("article", `research-card${item.featured ? " featured" : ""}`);
      const topline = makeElement("div", "card-topline");
      topline.append(
        makeElement("span", "", item.role),
        makeElement("span", item.statusType === "review" ? "status-review" : "", item.status)
      );
      const title = makeElement("h3", "", item.title);
      const journal = makeElement("p", "journal", item.journal);
      if (item.language === "en") {
        title.lang = "en";
        journal.lang = "en";
      }
      article.append(
        topline,
        title,
        journal,
        makeElement("p", "research-summary", item.summary),
        makeEditButton("research", index)
      );
      list.append(article);
    });
  }

  function renderProjects() {
    const projectList = $("#project-list");
    projectList.replaceChildren();
    cv.projects.forEach((item, index) => {
      const article = makeElement("article", "project-item");
      article.append(
        makeElement("span", "project-type", item.type),
        makeElement("h4", "", item.title)
      );
      if (item.code) article.append(makeElement("p", "item-meta", `批准号：${item.code}`));
      article.append(makeEditButton("projects", index));
      projectList.append(article);
    });

    const conferenceList = $("#conference-list");
    conferenceList.replaceChildren();
    cv.conferences.forEach((item, index) => {
      const li = document.createElement("li");
      li.append(
        makeElement("time", "", item.date),
        makeElement("span", "", item.name),
        makeEditButton("conferences", index)
      );
      conferenceList.append(li);
    });
  }

  function renderHonors() {
    const honorList = $("#honor-list");
    honorList.replaceChildren();
    cv.honors.forEach((item, index) => {
      const tag = makeElement("div", "honor-tag");
      tag.append(makeElement("span", "", item), makeEditButton("honors", index));
      honorList.append(tag);
    });

    const skillList = $("#skill-list");
    skillList.replaceChildren();
    cv.skills.forEach((item, index) => {
      const article = makeElement("article", "skill-item");
      article.append(
        makeElement("h3", "", item.title),
        makeElement("p", "", item.body),
        makeEditButton("skills", index)
      );
      skillList.append(article);
    });
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderPrintResume() {
    const education = cv.education
      .map(
        (item) => `
          <div class="print-entry">
            <div class="print-row"><strong>${escapeHtml(item.school)}</strong><time>${escapeHtml(item.period)}</time></div>
            <p>${escapeHtml(item.program)}</p>
            <small>${escapeHtml([item.details, item.location].filter(Boolean).join(" · "))}</small>
          </div>`
      )
      .join("");

    const research = cv.research
      .map(
        (item) => `
          <div class="print-paper">
            <div><strong lang="${item.language === "en" ? "en" : "zh-CN"}">${escapeHtml(item.title)}</strong></div>
            <p><span>${escapeHtml(item.role)} · ${escapeHtml(item.status)}</span> ${escapeHtml(item.journal)}</p>
          </div>`
      )
      .join("");

    const skills = cv.skills
      .map((item) => `<p><strong>${escapeHtml(item.title)}：</strong>${escapeHtml(item.body)}</p>`)
      .join("");

    const projects = cv.projects
      .map(
        (item) =>
          `<p><strong>${escapeHtml(item.title)}</strong><br><small>${escapeHtml(item.type)}${item.code ? ` · ${escapeHtml(item.code)}` : ""}</small></p>`
      )
      .join("");

    $("#print-resume").innerHTML = `
      <header class="print-header">
        <div>
          <h1>${escapeHtml(cv.meta.nameCn)}</h1>
          <span lang="en">${escapeHtml(cv.meta.nameEn)}</span>
        </div>
        <address>${escapeHtml(cv.meta.email)} · ${escapeHtml(cv.meta.phone)}</address>
      </header>
      <div class="print-profile">
        <strong>${escapeHtml(cv.profile.headline)}</strong>
        <p>${escapeHtml(cv.profile.summary)}</p>
      </div>
      <div class="print-columns">
        <div class="print-column">
          <section>
            <h2>教育背景 <span lang="en">Education</span></h2>
            ${education}
          </section>
          <section>
            <h2>研究方向 <span lang="en">Interests</span></h2>
            <ul>${cv.profile.focus.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>
          <section>
            <h2>项目参与 <span lang="en">Projects</span></h2>
            ${projects}
          </section>
        </div>
        <div class="print-column print-main-column">
          <section>
            <h2>科研成果 <span lang="en">Selected Research</span></h2>
            ${research}
          </section>
          <section>
            <h2>交流与会议 <span lang="en">Exchange & Conferences</span></h2>
            <p>${cv.exchange.map(escapeHtml).join("；")}</p>
            <ul>${cv.conferences.map((item) => `<li>${escapeHtml(item.date)} · ${escapeHtml(item.name)}</li>`).join("")}</ul>
          </section>
          <section>
            <h2>荣誉与能力 <span lang="en">Honors & Skills</span></h2>
            <p>${cv.honors.map(escapeHtml).join("；")}</p>
            ${skills}
          </section>
        </div>
      </div>`;
  }

  function renderAll() {
    setTextBindings();
    renderHome();
    renderProfile();
    renderEducation();
    renderResearch();
    renderProjects();
    renderHonors();
    renderPrintResume();
    updateAdminBar();
  }

  function normalizeView(value) {
    const view = String(value || "").replace(/^#/, "");
    return ["home", "profile", "education", "research", "projects", "honors", "contact"].includes(view)
      ? view
      : "home";
  }

  function showView(view, updateHistory = true) {
    const target = normalizeView(view);
    $$("[data-view]").forEach((panel) => {
      panel.hidden = panel.dataset.view !== target;
    });
    $$('[role="tab"][data-view-target]').forEach((tab) => {
      const active = tab.dataset.viewTarget === target;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    if (updateHistory) history.pushState({ view: target }, "", `#${target}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function markDirty() {
    dirty = true;
    updateAdminBar();
  }

  function updateAdminBar() {
    if (!adminSession) return;
    const message = $("#admin-bar span");
    message.textContent = dirty ? "内容修改尚未保存" : "所有更改已保存";
    $("#save-button").disabled = false;
  }

  function showToast(message, type = "success") {
    const toast = $("#toast");
    toast.textContent = message;
    toast.dataset.type = type;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 5000);
  }

  function closeDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog?.open) dialog.close();
  }

  function enterAdminMode(session) {
    adminSession = session;
    $("#github-token").value = "";
    document.body.classList.add("admin-mode");
    $("#admin-bar").hidden = false;
    updateAdminBar();
    closeDialog("auth-dialog");
    showToast("已进入管理模式。密钥仅保留在当前页面内存中。");
  }

  function exitAdminMode() {
    if (dirty && !window.confirm("仍有未保存的修改，确定退出管理模式吗？")) return;
    adminSession = null;
    document.body.classList.remove("admin-mode");
    $("#admin-bar").hidden = true;
    $("#github-token").value = "";
    renderAll();
  }

  function createField(field, value) {
    const label = document.createElement("label");
    label.textContent = field.label;
    let input;

    if (field.type === "textarea" || field.type === "lines") {
      input = document.createElement("textarea");
      input.rows = field.type === "lines" ? 5 : 4;
      input.value = field.type === "lines" && Array.isArray(value) ? value.join("\n") : value ?? "";
    } else if (field.type === "select") {
      input = document.createElement("select");
      field.options.forEach(([optionValue, optionLabel]) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionLabel;
        option.selected = optionValue === value;
        input.append(option);
      });
    } else if (field.type === "checkbox") {
      label.classList.add("checkbox-label");
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(value);
    } else {
      input = document.createElement("input");
      input.type = field.type ?? "text";
      input.value = value ?? "";
    }

    input.name = field.name;
    input.required = Boolean(field.required);
    if (field.lang) input.lang = field.lang;
    label.append(input);
    return label;
  }

  function openEditor(kind, indexValue = "") {
    if (!adminSession) return;
    const schema = editorSchemas[kind];
    if (!schema) return;
    const hasIndex = indexValue !== "" && indexValue !== undefined;
    const index = hasIndex ? Number(indexValue) : null;
    const source = schema.collection
      ? hasIndex
        ? cv[kind][index]
        : schema.primitive
          ? ""
          : {}
      : cv[kind];
    const value = schema.primitive ? { value: source ?? "" } : source;

    $("#editor-title").textContent = `${hasIndex ? "编辑" : "新增"}${schema.title}`;
    $("#editor-kind").value = kind;
    $("#editor-index").value = hasIndex ? String(index) : "";
    const fields = $("#editor-fields");
    fields.replaceChildren(...schema.fields.map((field) => createField(field, value?.[field.name])));
    $("#delete-item-button").hidden = !hasIndex || !schema.collection;
    $("#editor-dialog").showModal();
  }

  function applyEditor(event) {
    event.preventDefault();
    const kind = $("#editor-kind").value;
    const indexValue = $("#editor-index").value;
    const schema = editorSchemas[kind];
    const form = event.currentTarget;
    const value = {};

    schema.fields.forEach((field) => {
      const input = form.elements[field.name];
      if (field.type === "checkbox") value[field.name] = input.checked;
      else if (field.type === "lines") {
        value[field.name] = input.value
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);
      } else value[field.name] = input.value.trim();
    });

    if (schema.collection) {
      const item = schema.primitive ? value.value : value;
      if (indexValue === "") cv[kind].push(item);
      else cv[kind][Number(indexValue)] = item;
    } else {
      cv[kind] = { ...cv[kind], ...value };
    }

    markDirty();
    renderAll();
    closeDialog("editor-dialog");
    showToast("更改已应用，记得保存。");
  }

  function deleteCurrentItem() {
    const kind = $("#editor-kind").value;
    const index = Number($("#editor-index").value);
    if (!editorSchemas[kind]?.collection || Number.isNaN(index)) return;
    if (!window.confirm("确定删除这一项吗？")) return;
    cv[kind].splice(index, 1);
    markDirty();
    renderAll();
    closeDialog("editor-dialog");
    showToast("已删除，记得保存。");
  }

  function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }

  function githubErrorMessage(error, repository) {
    const target = repository || adminSession?.repository || "目标仓库";
    if (error.status === 401) {
      return "令牌无效或已过期，请重新生成 GitHub 细粒度令牌";
    }
    if (error.status === 403) {
      return `令牌没有 ${target} 的写入权限。请将该仓库加入 Repository access，并把 Contents 设为 Read and write`;
    }
    if (error.status === 404) {
      return `GitHub 未向此令牌开放 ${target}。公开仓库可被只读访问，因此进入管理模式不代表已有写权限；请检查 Resource owner、Repository access 与 Contents: Read and write`;
    }
    if (error.status === 409) {
      return "远端内容刚被其他操作更新，请刷新页面后重新进入管理模式再保存";
    }
    if (error.status === 422) {
      return "GitHub 拒绝了本次提交，请检查分支保护规则或稍后重试";
    }
    return error.message || "GitHub 请求失败";
  }

  async function githubRequest(url, options = {}) {
    const { token = adminSession?.token, ...requestOptions } = options;
    const response = await fetch(url, {
      ...requestOptions,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": githubApiVersion,
        ...(requestOptions.headers ?? {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || `GitHub 请求失败（${response.status}）`);
      error.status = response.status;
      error.requestId = response.headers.get("x-github-request-id");
      throw error;
    }
    return payload;
  }

  async function verifyAdmin(event) {
    event.preventDefault();
    const token = $("#github-token").value.trim();
    const repository = $("#github-repository").value.trim();
    const branch = $("#github-branch").value.trim();
    const message = $("#auth-message");
    message.textContent = "正在验证…";

    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
      message.textContent = "仓库格式应为 owner/repository。";
      return;
    }

    try {
      const viewer = await githubRequest("https://api.github.com/user", { token });
      const repositoryData = await githubRequest(
        `https://api.github.com/repos/${repository}`,
        { token }
      );
      const permissions = repositoryData.permissions;
      if (
        permissions &&
        !permissions.push &&
        !permissions.maintain &&
        !permissions.admin
      ) {
        const error = new Error("令牌只有读取权限");
        error.status = 403;
        throw error;
      }

      const dataPath = cv.admin?.dataPath ?? "cv-data.js";
      const path = encodeURIComponent(dataPath).replaceAll("%2F", "/");
      await githubRequest(
        `https://api.github.com/repos/${repositoryData.full_name}/contents/${path}?ref=${encodeURIComponent(branch)}`,
        { token }
      );
      enterAdminMode({
        token,
        repository: repositoryData.full_name,
        branch,
        dataPath,
        login: viewer.login
      });
    } catch (error) {
      message.textContent = `${githubErrorMessage(error, repository)}。无需开启 Gists 或 Workflows。`;
    }
  }

  async function saveAndPrint() {
    if (!adminSession) return;
    const button = $("#save-button");
    button.disabled = true;
    button.textContent = "正在保存…";

    try {
      if (dirty) {
        const path = encodeURIComponent(adminSession.dataPath).replaceAll("%2F", "/");
        const url = `https://api.github.com/repos/${adminSession.repository}/contents/${path}`;
        const existing = await githubRequest(`${url}?ref=${encodeURIComponent(adminSession.branch)}`);
        const source = `window.CV_DATA = ${JSON.stringify(cv, null, 2)};\n`;
        await githubRequest(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Update CV content from website editor",
            content: utf8ToBase64(source),
            sha: existing.sha,
            branch: adminSession.branch
          })
        });
        savedCv = clone(cv);
        dirty = false;
        updateAdminBar();
        showToast("内容已提交，GitHub Pages 通常会在 1–2 分钟内更新。");
      }
      renderPrintResume();
      setTimeout(() => window.print(), 350);
    } catch (error) {
      showToast(`${githubErrorMessage(error)}。`, "error");
    } finally {
      button.disabled = false;
      button.textContent = "保存并导出 PDF";
    }
  }

  function discardChanges() {
    if (!dirty) {
      showToast("当前没有未保存的修改。");
      return;
    }
    if (!window.confirm("确定撤销所有尚未保存的修改吗？")) return;
    cv = clone(savedCv);
    dirty = false;
    renderAll();
    showToast("未保存的修改已撤销。");
  }

  document.addEventListener("click", (event) => {
    const viewTarget = event.target.closest("[data-view-target]");
    if (viewTarget) {
      showView(viewTarget.dataset.viewTarget);
      return;
    }

    const editTarget = event.target.closest("[data-edit]");
    if (editTarget) {
      openEditor(editTarget.dataset.edit, editTarget.dataset.index);
      return;
    }

    const addTarget = event.target.closest("[data-add]");
    if (addTarget) {
      openEditor(addTarget.dataset.add);
      return;
    }

    const closeTarget = event.target.closest("[data-close-dialog]");
    if (closeTarget) closeDialog(closeTarget.dataset.closeDialog);
  });

  $("#admin-button").addEventListener("click", () => {
    if (adminSession) {
      $("#admin-bar").hidden = false;
      showToast("当前已处于管理模式。");
    } else {
      $("#auth-message").textContent = "";
      $("#github-repository").value = cv.admin?.repository ?? "Olen-hjz777/CV-chinese";
      $("#github-branch").value = cv.admin?.branch ?? "main";
      $("#auth-dialog").showModal();
    }
  });

  $("#auth-form").addEventListener("submit", verifyAdmin);
  $("#editor-form").addEventListener("submit", applyEditor);
  $("#delete-item-button").addEventListener("click", deleteCurrentItem);
  $("#save-button").addEventListener("click", saveAndPrint);
  $("#discard-button").addEventListener("click", discardChanges);
  $("#exit-admin-button").addEventListener("click", exitAdminMode);
  $("#print-button").addEventListener("click", () => {
    renderPrintResume();
    window.print();
  });

  window.addEventListener("popstate", () => showView(location.hash, false));
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  renderAll();
  showView(location.hash, false);
})();
