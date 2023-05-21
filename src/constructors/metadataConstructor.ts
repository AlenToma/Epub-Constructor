export function metaTitle(title: string) {
  return `<dc:title class="title">${title ?? ""}</dc:title>`;
}
export function metaLang(lang: string | undefined) {
  return `<dc:language class="language">${lang ?? "en"}</dc:language>`;
}
export function metaId(id: string | undefined) {
  return `<dc:identifier class="identifier" id="BookId">${id}</dc:identifier>`;
}
export function metaDesc(description: string | undefined) {
  return `<dc:description class="description">${
    description ?? ""
  }</dc:description>`;
}
export function metaAuthor(author: string | undefined) {
  return `<dc:creator class="author">${author ?? ""}</dc:creator>`;
}
export function metaRights(rights: string | undefined) {
  return `<dc:rights class="rights">${rights ?? ""}</dc:rights>`;
}
export function metaSource(source: string | undefined) {
  return `<dc:source class="source">${source ?? ""}</dc:source>`;
}
export function metaDate() {
  return `<dc:date>${new Date()}</dc:date>`;
}
