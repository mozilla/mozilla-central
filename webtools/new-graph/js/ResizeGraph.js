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
 * The Original Code is new-graph code.
 *
 * The Initial Developer of the Original Code is
 *    Mozilla Corporation
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jeremiah Orem <oremj@oremj.com> (Original Author)
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
   
function ResizeGraph() {
}

ResizeGraph.prototype = {

    margin_right: 10,
    margin_bottom: 10,
    resizing: false,
    active: false,
    element: null,
    handle: null,
    startX: null,
    startY: null,
    startHeight: null,
    startWidth: null,
    startTop: null,
    startLeft: null,
    currentDirection: '',
    notifyFunc: null,

    init: function(elem, notify) {
        this.handle = elem;
        this.element = getElement(elem);
        connect(this.handle,'onmousedown',this, 'mouseDownFunc');
        connect(document,'onmouseup',this, 'mouseUpFunc');
        connect(this.handle,'onmousemove',this, 'mouseMoveFunc');
        connect(document,'onmousemove',this, 'updateElement');

        this.notifyFunc = notify;
    },
    
    directions: function(e) {
        var pointer = e.mouse();
        var graphPosition = elementPosition(this.handle);
        var dimensions = elementDimensions(this.handle);
        var dir = '';
        // s must come first, since the cursor is called "se"
        if ( pointer.page.y > (graphPosition.y + dimensions.h) - this.margin_bottom )
            dir += "s";
        if ( pointer.page.x > (graphPosition.x + dimensions.w) - this.margin_right )
            dir += "e";
        return dir;
    },
    
    draw: function(e) {
        var pointer = [e.mouse().page.x, e.mouse().page.y];
        var style = this.element.style;
        if (this.currentDirection.indexOf('s') != -1) {
            var newHeight = this.startHeight + pointer[1] - this.startY;
            if (newHeight > this.margin_bottom) {
                style.height = newHeight + "px";
                this.element.height = newHeight;
            }
        }
        if (this.currentDirection.indexOf('e') != -1) {
            var newWidth = this.startWidth + pointer[0] - this.startX;
            if (newWidth > this.margin_right) {
                style.width = newWidth + "px";
                this.element.width = newWidth;
            }
        }
    },
    mouseDownFunc: function(e)
    {
        var dir = this.directions(e);
        pointer = e.mouse();
        if (dir.length > 0 ) {
            this.active = true;
            var dimensions = elementDimensions(this.handle);
            var graphPosition = elementPosition(this.handle);
            this.startTop = graphPosition.y;
            this.startLeft = graphPosition.x;
            this.startHeight =  dimensions.h;
            this.startWidth =  dimensions.w;
            this.startX = pointer.page.x + document.body.scrollLeft + document.documentElement.scrollLeft;
            this.startY = pointer.page.y + document.body.scrollLeft + document.documentElement.scrollLeft;
            this.currentDirection = dir;
            e.stop();
        }
    },
    mouseMoveFunc: function(e)
    {
        pointer = e.mouse();
        graphPosition = elementPosition(this.handle);
        dimensions = elementDimensions(this.handle);
        dir = this.directions(e);
        if(dir.length > 0) {
            getElement(this.handle).style.cursor = dir + "-resize";
        }
        else {
            getElement(this.handle).style.cursor = '';
        }
    },
    updateElement: function(e)
    {
        if( this.active ) {
            if ( ! this.resizing ) {
                var style = getElement(this.handle).style;
                this.resizing = true;
            } 
            this.draw(e);
            e.stop()
            return false;
        }
    }, 
    finishResize: function(e,success) {
        this.active = false;
        this.resizing = false;
    },
    mouseUpFunc: function(e)
    {
        if(this.active && this.resizing) {
            this.finishResize(e,true);
            if (this.notifyFunc)
                this.notifyFunc(this.element.width, this.element.height);
            e.stop();
        }
        this.active = false;
        this.resizing = false;
    },

};     
