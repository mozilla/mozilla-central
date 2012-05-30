/* -*- Mode: Java -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// the rdf service
var RDF = '@mozilla.org/rdf/rdf-service;1'
RDF = Components.classes[RDF].getService();
RDF = RDF.QueryInterface(Components.interfaces.nsIRDFService);

var NC = "http://home.netscape.com/NC-rdf#";

var sidebarObj = new Object;
var customizeObj = new Object;

function Init()
{
  customizeObj.id = window.arguments[0];
  customizeObj.url = window.arguments[1];
  sidebarObj.datasource_uri = window.arguments[2];
  sidebarObj.resource = window.arguments[3];

  sidebarObj.datasource = RDF.GetDataSource(sidebarObj.datasource_uri);

  var customize_frame = document.getElementById('customize_frame');
  customize_frame.setAttribute('src', customizeObj.url);
}

// Use an assertion to pass a "refresh" event to all the sidebars.
// They use observers to watch for this assertion (in sidebarOverlay.js).
function RefreshPanel() {
  var sb_resource = RDF.GetResource(sidebarObj.resource);
  var refresh_resource = RDF.GetResource(NC + "refresh_panel");
  var panel_resource = RDF.GetLiteral(customizeObj.id);

  sidebarObj.datasource.Assert(sb_resource,
                               refresh_resource,
                               panel_resource,
                               true);
  sidebarObj.datasource.Unassert(sb_resource,
                                 refresh_resource,
                                 panel_resource);
}

