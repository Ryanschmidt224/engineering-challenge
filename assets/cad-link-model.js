// Shared browser/server rules. Links never fetch, copy or grant access to CAD.
export function normalizeCadLinks(value = []) {
  if (!Array.isArray(value) || value.length > 20)
    throw Error("Use at most 20 CAD links.");
  const ids = new Set();
  return value.map((link) => {
    if (
      !link ||
      typeof link !== "object" ||
      Array.isArray(link) ||
      Object.keys(link).some(
        (key) => !["id", "name", "kind", "url"].includes(key),
      )
    )
      throw Error("Invalid CAD link.");
    if (
      typeof link.id !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        link.id,
      ) ||
      ids.has(link.id)
    )
      throw Error("Use unique CAD link IDs.");
    ids.add(link.id);
    if (
      typeof link.name !== "string" ||
      !link.name.trim() ||
      link.name.length > 120 ||
      /[\x00-\x1f\x7f]/.test(link.name)
    )
      throw Error("Enter a CAD link name of at most 120 characters.");
    if (!["file", "folder"].includes(link.kind))
      throw Error("Choose File or Folder.");
    let url;
    try {
      if (
        typeof link.url !== "string" ||
        link.url.length > 4096 ||
        /[\x00-\x20\x7f]/.test(link.url.trim())
      )
        throw Error();
      url = new URL(link.url.trim());
    } catch {
      throw Error("Paste a shared HTTPS link copied from Dropbox.");
    }
    if (
      url.protocol !== "https:" ||
      !["dropbox.com", "www.dropbox.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      !/^\/(scl\/(fi|fo)|s|sh)\/[^/]+/.test(url.pathname)
    )
      throw Error("Paste a shared HTTPS link copied from Dropbox.");
    if (
      (url.pathname.startsWith("/scl/fi/") && link.kind !== "file") ||
      (url.pathname.startsWith("/scl/fo/") && link.kind !== "folder")
    )
      throw Error("Choose the type matching this Dropbox file or folder link.");
    return {
      id: link.id,
      name: link.name.trim(),
      kind: link.kind,
      url: link.url.trim(),
    };
  });
}
export const cadLinkSummary = (links) =>
  normalizeCadLinks(links)
    .map((l) => l.name + " (" + l.kind + "): " + l.url)
    .join("\n");
// Known CAD exchange/native formats. Existing stored files remain readable.
export const isCadFileName = (name) =>
  /\.(step|stp|stl|iges|igs|sldprt|sldasm|slddrw|f3d|f3z|ipt|iam|idw|dwg|dxf|3mf|obj|x_t|x_b|prt|asm|catpart|catproduct|fcstd|blend)$/i.test(
    String(name).trim(),
  );
export function requireNonCadUpload(name) {
  if (isCadFileName(name))
    throw Error("Keep CAD files in Dropbox and add a link in CAD files.");
}
