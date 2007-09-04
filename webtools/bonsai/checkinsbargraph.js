/* ***** BEGIN LICENSE BLOCK *****
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 *
 * The Original Code is the Bonsai CVS tool.
 *
 * The Initial Developer of the Original Code is the Mozilla Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * Ben Hsieh <ben.hsieh@gmail.com>
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * configuration
 */
var rootName = 'root';
//var ignoreTopLevel = false; implement later

// expects var dir = "(directory name)"
// expects var files = [path, path, ... , path] from the cvsquery.cgi script
var root;
var curRoot;

function handleLoad(parentName, firstDirectory) {
    if (parentName == undefined)
        parentName = rootName;

    root = curRoot = new Directory(rootName, "");
    curRoot.categorizeArray(files);

    if (window.location.hash.length > 0)
        // if the user got here from a refresh or bookmark, take him back where he was
        handleHistory();
    else if (firstDirectory)
        graphContents(firstDirectory, dirCompareByName);
    else if (dir != "")
        graphContents(rootName + "/" + dir, dirCompareByName);
    else
        graphContents(parentName, dirCompareByName);
}

var factor = .05;
function graphContents(parentName, sortFunction) {
    makeHistory(parentName, sortFunction);
    changeDirectory(parentName.split('/'));

    if (sortFunction == dirCompareByName)
        gNameSort *= -1;
    else if (sortFunction == dirCompareByCount)
        gCountSort *= -1;
    curRoot.sortedSubdirs.sort(sortFunction);

    var outputText = makeBreadCrumbs() + "<br /><br /><table BORDER=0 class='outputtable'><th class='largeheader'><a class='jslink'"
        + "onclick='graphContents(\"" + parentName + "\", dirCompareByName);'>Module</a></th>"
        + "<th>Bonsai &nbsp;</th>"
        + "<th class='largeheaderleft'><a class='jslink' "
        + "onclick='graphContents(\"" + parentName +"\", dirCompareByCount);'>Check-ins</a></th>";

    var averageCount = curRoot.getAverageCount();   // scaling stuff
    var lowerEdge = averageCount * factor;
    var colorScaling = averageCount * (1 - factor);
    var upperEdge = averageCount * (2-factor);

    var x = 500 / (upperEdge * 2);
    var horizScaling = (x > 20) ? 20 : x;
    var barMaxWidth = 600;

    if (parseInt(navigator.appVersion)>3) {
        if (navigator.appName == "Netscape") {
            barMaxWidth = window.innerWidth - 110;
        } else if (navigator.appName.indexOf("Microsoft")!=-1) {
            barMaxWidth = document.body.offsetWidth - 110;
        }

        //TODO: get width for Safari/Opera. for now, remains at 600
    }

    var graphfiles = curRoot.sortedSubdirs;
    for (var i = 0; i < graphfiles.length; i++) {
        outputText += "<tr><td>" + makeModuleLink(graphfiles[i])
            + "</td><td> " + makeBonsaiLink(graphfiles[i]) + "</td>"
            + "<td>" + makeBar(graphfiles[i].count, barMaxWidth, horizScaling, lowerEdge, upperEdge, colorScaling) + "</td>";
    }
    outputText += "</table>";
    document.getElementById('output').innerHTML = outputText;
}

// @param: array, each element a directory: [var, www, html ...]
function changeDirectory(fullPath) {

    // start from the top and drill down
    curRoot = root;
    for (var i = 0; i < fullPath.length; i++) {
        for (var j = 0; j < curRoot.sortedSubdirs.length; j++) {
            if (curRoot.sortedSubdirs[j].name == fullPath[i]) {
                curRoot = curRoot.sortedSubdirs[j];
                break;
            }

            if (j == curRoot.sortedSubdirs.length) {
                // we didn't find it
                return;
            }
        }
    }
}

function makeModuleLink(file) {
    if (file.isFile())
    	return file.name + "(" + file.count + ")";

    var link = "<a class='jslink' onclick='resetGraphContents(\"" + file.fullPath + file.name + "\", dirCompareByName)'>"
        + file.name + " (" + file.count + ")</a>"

    return link;
}

function resetGraphContents(parentName, sortFunction) {
    gNameSort = gCountSort = -1;
    graphContents(parentName, sortFunction);
}

function makeBar(count, maxWidth, horizScaling, lowerEdge, upperEdge, colorScaling) {
    var width = count * horizScaling;
    if (width > maxWidth)
        width = maxWidth;
    width = Math.ceil(width);

    var color = colorSwitch(count, lowerEdge, upperEdge, colorScaling);

    return "<div style='background-color:" + color +"; height:9px; width:"
            + width + "px'> &nbsp; </div>";
}

function makeBreadCrumbs() {
    var levels = (curRoot.fullPath + curRoot.name).split('/');
    var curpath = "";
    var breadcrumbs = "";
    for (var i = 0; i < levels.length; i++) {
        curpath += levels[i] + "/";
        breadcrumbs += "<a class='jslink' onclick='resetGraphContents(\""
        + curpath + "\", dirCompareByName);'>" + levels[i] + "</a><span class='outputtable'> &gt; </span>";
        //TODO: here.
    }
    return breadcrumbs;
}

// expects fileURLtemplate and dirURLtemplate to be defined by the perl script
function makeBonsaiLink(file) {
    var link = "<a class='jslink' href = \"";
    var realPath = file.fullPath.substring(rootName.length);
        // get rid of the root placeholder

    if (file.isFile()) {
        link += fileURLtemplate.replace("subdir=", "subdir=" + realPath).replace("files=", "files=" + file.name);
    } else {
        link += dirURLtemplate.replace("dir=", "dir=" + realPath + file.name);
    }

    link += '" target="_blank"> -&gt; </a>';

    return link;
}

/**
 * Directory object
 **/

// @params: name of directory, full string path to file (not including self)
function Directory(name, stringFullPath) {
    this.name = name;
    this.fullPath = stringFullPath;
    this.count = 0;   // total number of files
    this.subdirs = new Object();  // will contain assoc. array of other Directories, null'd after initialization.
    this.sortedSubdirs = new Array();    // will contain ordered array of other Directories
}

// @param: an array of full paths.
// generally only called on root Directory.
Directory.prototype.categorizeArray = function(strArray)
{
    for (var i = 0; i < strArray.length; i++) {
        var pathArray = strArray[i].split('/');
        pathArray.unshift(this.name);
        this.categorizePath(pathArray, 1);
    }
    this.recPopulateSortedSubdirs();
}

// @param: an array representing the full path of a file, eg ['var', 'www', 'public', 'checkinsbargraph.js']
// and the current position (the element that needs to be sorted at this level)
Directory.prototype.categorizePath = function(path, position)
{
    this.count++;
    if (position >= path.length)
        return;

    var folder = path[position];
    if (!this.subdirs[folder]) {
        this.subdirs[folder] = new Directory(path[position], flattenArray(path, position));
    }
    this.subdirs[folder].categorizePath(path, position + 1);
}

Directory.prototype.getAverageCount = function()
{
    return this.count / this.sortedSubdirs.length;
}

Directory.prototype.isFile = function()
{
    return this.sortedSubdirs.length == 0;
}

// puts the objects in subdirs into sortedSubdirs in random (but indexed) order.
Directory.prototype.recPopulateSortedSubdirs = function()
{
    for (var i in this.subdirs) {
        this.subdirs[i].recPopulateSortedSubdirs();
        this.sortedSubdirs.push(this.subdirs[i]);
    }
    this.subdirs = null;   // we don't need this any more.
}




/**
 * Sorting functions for Directories
**/

var gNameSort = -1;  // used to invert sort function
function dirCompareByName(obj1, obj2) {
    if (obj1.name == obj2.name)
        return 0;
    return ((obj1.name > obj2.name) ? 1 : -1) * gNameSort;
}

var gCountSort = -1;
function dirCompareByCount(obj1, obj2) {
    if (obj1.count == obj2.count)
        return 0;
    return ((obj1.count > obj2.count) ? 1 : -1) * gCountSort;
}


/**
 * Utility functions
**/

function flattenArray(array, length) {
    var x =[].concat(array);
    if (length != undefined)
        x.length = length;
    return x.join('/') + "/";
}

function colorSwitch(size, lowerEdge, upperEdge, scaling) {
    var distFromLower;
    var distFromUpper;
    var scaleFactor = 255 / scaling;

    distFromLower = (size < lowerEdge) ? 0 : parseInt((size - lowerEdge) * scaleFactor);
    distFromUpper = (size > upperEdge) ? 0 : parseInt((upperEdge - size) * scaleFactor);

    if (distFromUpper > 255)
        distFromUpper = 255;
    if (distFromLower > 255)
        distFromLower = 255;

    return "#"  + makeHex(distFromLower) + makeHex(distFromUpper) + "00";
}

function makeHex(d) {
    return ("0" + d.toString(16)).slice(-2);
}

/** Back-button functionality **/

var expectedHash = "";
var delim = "TOK=";

function makeHistory(parentName, sortFunction) {
    var sortRep = (sortFunction == dirCompareByName) ? 0 : 1;
    window.location.hash = parentName + delim + sortRep + delim + gNameSort + delim + gCountSort;
                // stuff all necessary info into the hash: directory, sort type and direction
    expectedHash = window.location.hash
}

function handleHistory() {
    if (window.location.hash != expectedHash) {
        expectedHash = window.location.hash;
        if (expectedHash.length > 0) {
            var hashParts = expectedHash.substring(1).split(delim);
               // we've used delims to seperate the data in the hash. now break it apart.

            gNameSort = hashParts[2];
            gCountSort = hashParts[3];
            if (hashParts[1] == 0) {
                graphContents(hashParts[0], dirCompareByName);
            } else {
                graphContents(hashParts[0], dirCompareByCount);
            }
        }
    }
}

function pollHash() {
    //handleHistory();
    window.setInterval('handleHistory()', 1000);
    return true;
}

window.addEventListener('load', pollHash, false);
