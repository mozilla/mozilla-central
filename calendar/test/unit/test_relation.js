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
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 *   Fred Jendrzejewski <fred.jen@web.de>
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Philipp Kewisch <mozilla@kewis.ch>
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

function run_test() {
    // Create Relation
    let r1 = cal.createRelation();

    // Create Items
    let e1 = cal.createEvent();
    let e2 = cal.createEvent();

    // Testing relation set/get.
    let properties = {
        relType: "PARENT",
        relId: e2.id
    }

    for (let [property, value] in Iterator(properties)) {
        r1[property] = value;
        do_check_eq(r1[property], value);
    }

    // Add relation to event
    e1.addRelation(r1);

    // Add 2nd relation to event.
    let r2 = cal.createRelation();
    r2.relId = "myid2";
    e1.addRelation(r2);

    // Check the item functions
    checkRelations(e1, [r1, r2]);

    // modify the Relations
    modifyRelations(e1, [r1, r2]);

    // test icalproperty
    r2.icalProperty;
}

function checkRelations(event, expRel) {
    let countObj = {};
    let allRel = event.getRelations(countObj);
    do_check_eq(countObj.value, allRel.length);
    do_check_eq(allRel.length, expRel.length);

    // check if all expacted relations are found
    for (let i = 0; i < expRel.length; i++) {
        do_check_neq(allRel.indexOf(expRel[i]), -1);
    }

    // Check if all found relations are expected
    for (let i = 0; i < allRel.length; i++) {
        do_check_neq(expRel.indexOf(allRel[i]), -1);
    }
}

function modifyRelations(event, oldRel) {
    let allRel = event.getRelations({});
    let rel = allRel[0];

    // modify the properties
    rel.relType = "SIBLING";
    do_check_eq(rel.relType, "SIBLING");
    do_check_eq(rel.relType, allRel[0].relType);

    // remove one relation
    event.removeRelation(rel);
    do_check_eq(event.getRelations({}).length, oldRel.length - 1);

    // add one relation and remove all relations
    event.addRelation(oldRel[0]);
    event.removeAllRelations();
    do_check_eq(event.getRelations({}), 0);
}
