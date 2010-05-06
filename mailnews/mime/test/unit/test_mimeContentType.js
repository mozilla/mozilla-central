/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Jason Oster <parasyte@kodewerx.org>.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    Jason Oster <parasyte@kodewerx.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
      "application/vnd.openxmlformats-officedocument.presentationml.presentation;\r\n" +
      " name=\"Presentation.pptx\""
    },
    { header:
      "Content-Type:\r\n" +
      "text/plain; charset=utf-8\r\n" +
      "Content-Transfer-Encoding: quoted-printable\r\n" +
      "Content-Disposition: inline\r\n" +
      "\r\n",
      result:
      null
    },
    { header:
      "Content-Type:\r\n" +
      "\r\n",
      result:
      null
    }
  ];

  let mimeHdr = Components.classes["@mozilla.org/messenger/mimeheaders;1"]
                  .createInstance(Components.interfaces.nsIMimeHeaders);

  for (let i = 0; i < headers.length; i++) {
    mimeHdr.initialize(headers[i].header, headers[i].header.length);
    let receivedHeader = mimeHdr.extractHeader("Content-Type", false);

    dump("\nTesting Content-Type: " + receivedHeader + " == " + headers[i].result + "\n");

    do_check_eq(receivedHeader, headers[i].result);
  }
}
