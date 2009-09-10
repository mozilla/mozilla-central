/*
 * This file wants to be a data file of some sort.  It might do better as a real
 *  raw JSON file.  It is trying to be one right now, but it obviously is not.
 */

let EXPORTED_SYMBOLS = ['MimeCategoryMapping'];

/**
 * Input data structure to allow us to build a fast mapping from mime type to
 *  category name.  The keys in MimeCategoryMapping are the top-level
 *  categories.  Each value can either be a list of MIME types or a nested
 *  object which recursively defines sub-categories.  We currently do not use
 *  the sub-categories.  They are just there to try and organize the MIME types
 *  a little and open the door to future enhancements.
 *
 * Do _not_ add additional top-level categories unless you have added
 *  corresponding entries to gloda.properties under the
 *  "gloda.mimetype.category" branch and are making sure localizers are aware
 *  of the change and have time to localize it.
 *
 * Entries with wildcards in them are part of a fallback strategy by the
 *  |mimeTypeNoun| and do not actually use regular expressions or anything like
 *  that.  Everything is a straight string lookup.  Given "foo/bar" we look for
 *  "foo/bar", then "foo/*", and finally "*".
 */
let MimeCategoryMapping = {
  archives: [
    "application/java-archive",
    "application/x-java-archive",
    "application/x-jar",
    "application/x-java-jnlp-file",

    "application/mac-binhex40",
    "application/vnd.ms-cab-compressed",

    "application/x-arc",
    "application/x-arj",
    "application/x-compress",
    "application/x-compressed-tar",
    "application/x-cpio",
    "application/x-cpio-compressed",
    "application/x-deb",

    "application/x-bittorrent",

    "application/x-rar",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/zip",
    "application/x-zip-compressed",
    "application/x-zip",

    "application/x-bzip",
    "application/x-bzip-compressed-tar",
    "application/x-bzip2",
    "application/x-gzip",
    "application/x-tar",
    "application/x-tar-gz",
    "application/x-tarz",
  ],
  documents: {
    database: [
      "application/vnd.ms-access",
      "application/x-msaccess",
      "application/msaccess",
      "application/vnd.msaccess",
      "application/x-msaccess",
      "application/mdb",
      "application/x-mdb",

      "application/vnd.oasis.opendocument.database",

    ],
    graphics: [
      "application/postscript",
      "application/x-bzpostscript",
      "application/x-dvi",
      "application/x-gzdvi",

      "application/illustrator",

      "application/vnd.corel-draw",
      "application/cdr",
      "application/coreldraw",
      "application/x-cdr",
      "application/x-coreldraw",
      "image/cdr",
      "image/x-cdr",
      "zz-application/zz-winassoc-cdr",

      "application/vnd.oasis.opendocument.graphics",
      "application/vnd.oasis.opendocument.graphics-template",
      "application/vnd.oasis.opendocument.image",

      "application/x-dia-diagram",
    ],
    presentation: [
      "application/vnd.ms-powerpoint.presentation.macroenabled.12",
      "application/vnd.ms-powerpoint.template.macroenabled.12",
      "application/vnd.ms-powerpoint",
      "application/powerpoint",
      "application/mspowerpoint",
      "application/x-mspowerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.presentationml.template",

      "application/vnd.oasis.opendocument.presentation",
      "application/vnd.oasis.opendocument.presentation-template"
    ],
    spreadsheet: [
      "application/vnd.lotus-1-2-3",
      "application/x-lotus123",
      "application/x-123",
      "application/lotus123",
      "application/wk1",

      "application/x-quattropro",

      "application/vnd.ms-excel.sheet.binary.macroenabled.12",
      "application/vnd.ms-excel.sheet.macroenabled.12",
      "application/vnd.ms-excel.template.macroenabled.12",
      "application/vnd.ms-excel",
      "application/msexcel",
      "application/x-msexcel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.template",

      "application/vnd.oasis.opendocument.formula",
      "application/vnd.oasis.opendocument.formula-template",
      "application/vnd.oasis.opendocument.chart",
      "application/vnd.oasis.opendocument.chart-template",
      "application/vnd.oasis.opendocument.spreadsheet",
      "application/vnd.oasis.opendocument.spreadsheet-template",

      "application/x-gnumeric",
    ],
    wordProcessor: [
      "application/msword",
      "application/vnd.ms-word",
      "application/x-msword",
      "application/msword-template",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
      "application/vnd.ms-word.document.macroenabled.12",
      "application/vnd.ms-word.template.macroenabled.12",
      "application/x-mswrite",
      "application/x-pocket-word",

      "application/rtf",
      "text/rtf",


      "application/vnd.oasis.opendocument.text",
      "application/vnd.oasis.opendocument.text-master",
      "application/vnd.oasis.opendocument.text-template",
      "application/vnd.oasis.opendocument.text-web",

      "application/vnd.wordperfect",

      "application/x-abiword",
      "application/x-amipro",
    ],
    suite: [
      "application/vnd.ms-works"
    ],
  },
  images: [
    "image/*"
  ],
  media: {
    audio: [
      "audio/*",
    ],
    video: [
      "video/*",
    ],
    container: [
      "application/ogg",

      "application/smil",
      "application/vnd.ms-asf",
      "application/vnd.rn-realmedia",
      "application/x-matroska",
      "application/x-quicktime-media-link",
      "application/x-quicktimeplayer",
    ]
  },
  other: [
    "*"
  ],
  pdf: [
    "application/pdf",
    "application/x-pdf",
    "image/pdf",
    "file/pdf",

    "application/x-bzpdf",
    "application/x-gzpdf",
  ],
}
