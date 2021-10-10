import { parse } from 'node-html-parser';
import * as p from 'node-html-parser';
export interface Parameter {
  name: string;
  value: string;
}

export interface EpubChapter {
  title: string;
  htmlBody: string;
  parameter?: Parameter[];
}

export interface EpubJson {
  title: string,
  fileName: string,
  parameter?: Parameter[];
}

export interface EpubJsonSettings {
  title: string;
  language?: string; // Default en
  bookId?: string;
  description?: string;
  source?: string;
  author?: string;
  chapters: EpubJson[];
  parameter?: Parameter[];
}

export interface File {
  path: string;
  content: string;
}



export interface EpubSettings {
  title: string;
  language?: string; // Default en
  bookId?: string;
  description?: string;
  source?: string;
  author?: string;
  chapters: EpubChapter[];
  stylesheet?: any;
  parameter?: Parameter[];
}

const createStyle = (style: any) => {
  if (!style) style = {};
  if (typeof style == "string")
    return style;
  const defaultStyle = {
    body: {
      'font-family': `"Helvetica Neue", "Helvetica", "Arial", sans-serif`,
      'font-size': '1.125em',
      'line-height': '1.6em',
      color: '#000',
    },

    'h1, h2, h3, h4, h5, h6': {
      'line-height': '1em',
    },

    h1: {
      'font-size': '3em',
    },

    h2: {
      'font-size': '2.5em',
    },
  } as any;

  Object.keys(style).forEach((x) => {
    var current = style[x];
    var next = defaultStyle[x];
    if (next === undefined) defaultStyle[x] = current;
    else Object.assign(defaultStyle[x], next);
  });
  var result = '';
  Object.keys(defaultStyle).forEach((x) => {
    var item = x + ' {';
    Object.keys(defaultStyle[x]).forEach((a) => {
      item += `\n ${a}: ${defaultStyle[x][a]};`;
    });
    item += '\n}\n';
    result += item;
  });
  return result;
};

const createFile = (path: string, content: string) => {
  return {
    path,
    content,
  } as File;
};

const isValid = (file: File[], content: string[]) => {
  for (var i = 0; i < content.length; i++) {
    var item = file.find((x) => x.path.indexOf(content[i]) != -1);
    if (!item) return false;
  }
  return true;
};


const sleep = (time: number, args?: any) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(args)
    }, time)
  }) as Promise<any>;
}
const single = (array: any) => {
  if (array && array.length != undefined && array.length > 0)
    return array[0]

  return undefined;
}

const parseJSon = (json: string) => {
  if (json === null || !json || json.length <= 4)
    return undefined;
  try {
    return JSON.parse(json);
  } catch (e) {
    console.log(e);
    return undefined;
  }
}

export const jsonExtractor = (content: string) => {
  const jsonReg = new RegExp(/<JSON>(.|\n)*?<\/JSON>/, "mgi");
  return (single(jsonReg.exec(content)) ?? "").replace(/<JSON>/mgi, "").replace(/<\/JSON>/mgi, "");
}

export const bodyExtrator = (content: string) => {
  const jsonReg = new RegExp(/<body>(.|\n)*?<\/body>/, "mgi");
  return (single(jsonReg.exec(content)) ?? "").replace(/<body>/mgi, "").replace(/<\/body>/mgi, "");
}



export const EpubSettingsLoader = async (file: File[], localOnProgress?: (progress: number) => void) => {
  try {
    var jsonSettingsFile = file.find(x => x.path.endsWith(".json"));
    if (jsonSettingsFile)
      return parseJSon(jsonSettingsFile.content) as EpubSettings;
    var dProgress = 0.01;
    localOnProgress?.(dProgress)
    var epubSettings = { chapters: [] as EpubChapter[] } as EpubSettings;
    if (!isValid(file, ['toc.ncx', 'toc.html', '.opf', 'styles.css']))
      throw 'This is not a valid Epub file created by this library(epub-constructor)';
    var pageContent = file.find((x) => x.path.indexOf('.opf') != -1)?.content ?? '';
    var page = undefined as undefined | p.HTMLElement;
    var style = file.find((x) => x.path.indexOf('styles.css') != -1)?.content ?? '';
    var chapters = [] as string[] | p.HTMLElement[];
    epubSettings.stylesheet = style;

    page = parse(pageContent);
    epubSettings.parameter = page.querySelectorAll("param").map(a => { return { name: a.getAttribute("name"), value: a.getAttribute("value") } as Parameter });
    epubSettings.title = page.querySelector('.title').innerText;
    epubSettings.author = page.querySelector('.rights').innerText;
    epubSettings.description = page.querySelector('.description').innerText;
    epubSettings.language = page.querySelector('.language').innerText;
    epubSettings.bookId = page.querySelector('.identifier').innerHTML;
    epubSettings.source = page.querySelector('.source').innerText;
    chapters = page.querySelectorAll("itemref");

    const len = chapters.length + 1;
    var index = 0;
    for (let x of chapters) {
      try {


        var content = "";
        var chItem = "" as string;
        var chId = x.getAttribute("idref");
        chItem = page?.querySelector("item[id='" + chId + "']")?.getAttribute("href") ?? "";
        content = file.find(x => x.path.indexOf(chItem) != -1)?.content ?? "";
        var chapter = parse(content);
        epubSettings.chapters.push(
          {
            parameter: chapter.querySelectorAll("param").map((a: any) => { return { name: a.getAttribute("name"), value: a.getAttribute("value") } as Parameter }),
            title: chapter.querySelector("title")?.innerText ?? "",
            htmlBody: chapter.querySelector("body").innerHTML
          }
        )
        dProgress = ((index / parseFloat(len.toString())) * 100)
        localOnProgress?.(dProgress)
        index++;
        await sleep(0);

      } catch (error) {
        console.log(error)
      }
    }
    dProgress = ((len / parseFloat(len.toString())) * 100);
    localOnProgress?.(dProgress);
    return epubSettings;
  } catch (error) {
    console.log(error)
    throw error;
  }

}




export default class EpubFile {
  epubSettings: EpubSettings;

  constructor(epubSettings: EpubSettings) {
    this.epubSettings = epubSettings;
  }

  async constructEpub(localOnProgress?: (progress: number) => Promise<void>) {
    var files = [] as File[];
    files.push(createFile('mimetype', 'application/epub+zip'));
    var metadata = [];
    var manifest = [];
    var spine = [];
    this.epubSettings.bookId = this.epubSettings.bookId ?? new Date().getUTCMilliseconds().toString()
    var fileSettings = Object.assign({} as EpubJsonSettings, this.epubSettings)
    fileSettings.chapters = [];
    const len = this.epubSettings.chapters.length;
    var dProgress = 0;
    files.push(
      createFile(
        'META-INF/container.xml',
        `<?xml version="1.0" encoding="UTF-8"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
      <rootfile full-path="OEBPS/${this.epubSettings.title}.opf" media-type="application/oebps-package+xml"/>
      </rootfiles>
      </container>`
      )
    );
    files.push(
      createFile('OEBPS/styles.css', createStyle(this.epubSettings.stylesheet))
    );

    var epub = `<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">{#metadata}</metadata>
    <manifest>{#manifest}</manifest>
    <spine toc="ncx">{#spine}</spine>
     <parameter>${this.epubSettings.parameter?.map(a => `<param name="${a.name}" value="${a.value}">${a.value}</param>`).join("\n") ?? ""}</parameter>
    </package>`
    var ncxToc = `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="en" dir="ltr">
	<head>
		<meta name="dtb:uid" content="http://digitalpublishingtoolkit.org/ExampleEPUB.html" />
		<meta name="dtb:depth" content="${this.epubSettings.chapters.length}" />
		<meta name="dtb:totalPageCount" content="${this.epubSettings.chapters.length}" />
		<meta name="dtb:maxPageNumber" content="0" />
	</head>
	<docTitle>
		<text>${this.epubSettings.title} EPUB</text>
	</docTitle>

	<docAuthor>
		<text>${this.epubSettings.author}</text>
	</docAuthor>

	<navMap>
  {#navMap}
	</navMap>
</ncx>
`;

    var htmlToc = `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <link rel="stylesheet" type="text/css" href="styles.css" />
    <title>${this.epubSettings.title} - TOC</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Table of Contents</h1>
      <ol>
        {#ol}
      </ol>
    </nav>
  </body>
</html>`;
    metadata.push(`<dc:title class="title">${this.epubSettings.title ?? ''}</dc:title>`);
    metadata.push(`<dc:language class="language">${this.epubSettings.language ?? 'en'}</dc:language>`);
    metadata.push(`<dc:identifier class="identifier" id="BookId">${this.epubSettings.bookId}</dc:identifier>`)
    metadata.push(`<dc:description class="description">${this.epubSettings.description ?? ''}</dc:description>`)
    metadata.push(`<dc:date>${new Date()}</dc:date>`)
    metadata.push(`<dc:rights class="rights">${this.epubSettings.author ?? ''}</dc:rights>`)
    metadata.push(`<dc:source class="source">${this.epubSettings.source ?? ''}</dc:source>`)
    metadata.push(`<item href="styles.css" id="css1" media-type="text/css"/>`)

    const getValidName = (x: EpubChapter) => {
      var fileName = `${x.title}.html`;
      var i = 1;
      while ((fileSettings.chapters).find(a => a.fileName == fileName)) {
        fileName = `${x.title + i}.html`;
        i++
      }

      return fileName;
    }

    var index = 1;
    var navMap = [];
    var ol = [];

    for (var x of this.epubSettings.chapters) {
      dProgress = (((index - 1) / parseFloat(len.toString())) * 100)
      const fileName = getValidName(x);
      var ch = Object.assign({}, x) as any;
      ch.fileName = fileName;
      fileSettings.chapters.push(ch);
      manifest.push(`<item id="${x.title + index}" href="${fileName}" media-type="application/xhtml+xml" />`);
      spine.push(`<itemref idref="${x.title + index}" ></itemref>`);
      var param = "";
      if (x.parameter && x.parameter.length > 0)
        param = x.parameter.map(a => `<param name="${a.name}" value="${a.value}">${a.value}</param>`).join("\n");
      files.push(
        createFile(`OEBPS/${fileName}`,
          `
<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <link rel="stylesheet" type="text/css" href="styles.css"/>
    <title>${x.title}</title>
    <JSON>${JSON.stringify({ title: x.title, parameter: x.parameter })}</JSON>
    <parameter>
        ${param}
    </parameter>
  </head>
  <body>
      ${x.htmlBody}
  </body>
</html>
      `
        )
      );
      ol.push(`<li><a href="${fileName}">${x.title}</a></li>`)
      navMap.push(`<navPoint id="${x.title + index}" playOrder="${index}"> <navLabel> <text>${x.title}</text> </navLabel> <content src="${fileName}" /></navPoint>`);
      index++;

      if (localOnProgress)
        await localOnProgress?.(dProgress);

      if (index % 300 === 0 && localOnProgress)
        await sleep(0)
    };

    manifest.push(`<item properties="nav" id="toc" href="toc.html" media-type="application/xhtml+xml" />`);
    manifest.push(`<item href="toc.ncx" id="ncx" media-type="application/x-dtbncx+xml"/>`);
    epub = epub.replace(/{#manifest}/gi, manifest.join("\n"));
    epub = epub.replace(/{#spine}/gi, spine.join("\n"));
    epub = epub.replace(/{#metadata}/gi, metadata.join("\n"));
    ncxToc = ncxToc.replace(/{#navmap}/gi, navMap.join("\n"));
    htmlToc = htmlToc.replace(/{#ol}/gi, ol.join("\n"));
    files.push(createFile(`OEBPS/${this.epubSettings.title}.json`, JSON.stringify(fileSettings)));
    files.push(createFile(`OEBPS/${this.epubSettings.title}.opf`, `<?xml version="1.0" encoding="utf-8"?>\n` + epub));
    files.push(createFile('OEBPS/toc.html', `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n` + htmlToc));
    files.push(createFile('OEBPS/toc.ncx', ncxToc));
    if (localOnProgress)
      await localOnProgress?.((((len) / parseFloat(len.toString())) * 100));
    return files;
  }

  // extract EpubSettings from epub file.
  static async load(file: File[]) {
    return await EpubSettingsLoader(file);
  }
}
