import { viewMode } from "./view-mode.js";
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
export function initDirectory({
  grid,
  toolbar,
  projects,
  tags,
  search,
  sort,
  status,
  empty,
  coverUrl,
  noun = "projects",
  viewLabel = "Project view",
  storageKey = "bs-project-view",
  onOpen,
}) {
  const mode = viewMode({
    label: viewLabel,
    storageKey,
    onChange: (value) => {
      view = value;
      render();
    },
  });
  let view = mode.value;
  grid.className = "ui-project-list";
  toolbar.insertBefore(mode.root, status);
  const cover = async (project, art) => {
    const url = coverUrl?.(project);
    if (!url) return;
    const image = make("img", "ui-project-cover");
    image.alt = "";
    image.loading = "lazy";
    image.onload = () => {
      if (art.isConnected) art.replaceChildren(image);
    };
    image.onerror = () => image.remove();
    art.append(image);
    image.src = url;
  };
  function render() {
    const all = projects(),
      query = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean),
      active = [...tags()];
    const visible = all.filter(
      (project) =>
        !active.some(
          (tag) =>
            !(project.tags || []).some((value) => value.toLowerCase() === tag),
        ) &&
        !query.some(
          (term) =>
            ![
              project.name,
              project.displayName,
              project.shortSummary,
              project.description,
              project.detail,
              ...(project.keywords || []),
              ...(project.tags || []),
            ]
              .join(" ")
              .toLowerCase()
              .includes(term),
        ),
    );
    const date = (project) => Date.parse(project.createdAt || "") || 0;
    visible.sort((a, b) =>
      sort.value === "newest"
        ? date(b) - date(a) || a.name.localeCompare(b.name)
        : sort.value === "oldest"
          ? date(a) - date(b) || a.name.localeCompare(b.name)
          : (sort.value === "name_desc" ? -1 : 1) *
            a.name.localeCompare(b.name, undefined, {
              numeric: true,
              sensitivity: "base",
            }),
    );
    grid.dataset.view = view;
    grid.replaceChildren();
    for (const project of visible) {
      const card = make("article", "ui-project-card"),
        link = make("button", "ui-project-open"),
        art = make("span", "ui-project-image"),
        copy = make("span", "ui-project-copy");
      card.dataset.catalogId = project.id;
      link.type = "button";
      if (onOpen) link.onclick = () => onOpen(project, link);
      else link.dataset.project = project.id;
      link.setAttribute(
        "aria-label",
        "Open " +
          (project.displayName || project.name) +
          (onOpen ? "" : " project"),
      );
      art.setAttribute("aria-hidden", "true");
      art.textContent = project.name.trim().charAt(0).toUpperCase();
      copy.append(
        make("strong", "ui-project-name", project.displayName || project.name),
      );
      const summary = project.shortSummary || project.description;
      if (summary) copy.append(make("span", "ui-project-caption", summary));
      const descriptors = make("span", "ui-project-tags");
      for (const tag of (project.tags || []).slice(0, 3))
        descriptors.append(make("span", "ui-chip", tag));
      if (project.tags?.length > 3) {
        const more = make("span", "ui-chip", "+" + (project.tags.length - 3));
        more.title = project.tags.slice(3).join(", ");
        descriptors.append(more);
      }
      if (descriptors.children.length) copy.append(descriptors);
      const created = make("span", "ui-project-created");
      if (date(project)) {
        const time = make(
          "time",
          "",
          new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
            new Date(project.createdAt),
          ),
        );
        time.dateTime = project.createdAt;
        created.append(document.createTextNode("Created "), time);
      }
      link.append(art, copy, created);
      card.append(link);
      grid.append(card);
      if (coverUrl) void cover(project, art);
    }
    status.textContent = visible.length + " of " + all.length + " " + noun;
    empty.hidden = visible.length > 0;
    empty.textContent = all.length
      ? "No " + noun + " match your search or filters."
      : "No " + noun + " yet.";
  }
  search.oninput = render;
  sort.onchange = render;
  return { render };
}
