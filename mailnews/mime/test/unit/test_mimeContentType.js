/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test()
{
  const headers =
  [
    { header:
      "Content-Type: text/plain\r\n" +
      "Content-Disposition: inline\r\n" +
      "\r\n",
      result:
      "text/plain"
    },
    { header:
      "Content-Type:\r\n" +
      "\tapplication/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n" +
      "Content-Transfer-Encoding: base64\r\n" +
      "Content-Disposition: attachment; filename=\"List.xlsx\"\r\n" +
      "\r\n",
      result:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    },
    { header:
      "Content-Type: \r\n" +
      " application/vnd.openxmlformats-officedocument.presentationml.presentation;\r\n" +
      " name=\"Presentation.pptx\"\r\n" +
      "\r\n",
      result:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation;" +
      " name=\"Presentation.pptx\""
    },
    { header:
      "Content-Type:\r\n" +
      "text/plain; charset=utf-8\r\n" +
      "Content-Transfer-Encoding: quoted-printable\r\n" +
      "Content-Disposition: inline\r\n" +
      "\r\n",
      result:
      ""
    },
    { header:
      "Content-Type:\r\n" +
      "\r\n",
      result:
      ""
    },
    /* possible crash case for Bug 574961 */
    { header:
      "Content-Type: \r\n" +
      "                                " +
      "                                " +
      "                                " +
      "                                " +
      "                                " +
      "                                " +
      "                                " +
      "                                " +
      "              \r\n",
      result:
      "",
    }
  ];

  let mimeHdr = Components.classes["@mozilla.org/messenger/mimeheaders;1"]
                  .createInstance(Components.interfaces.nsIMimeHeaders);

  for (let i = 0; i < headers.length; i++) {
    mimeHdr.initialize(headers[i].header);
    let receivedHeader = mimeHdr.extractHeader("Content-Type", false);

    dump("\nTesting Content-Type: " + receivedHeader + " == " + headers[i].result + "\n");

    do_check_eq(receivedHeader, headers[i].result);
  }
}
