/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    test_roundtrip();
    test_async();
    test_fake_parent();
    test_props_comps();
    test_timezone();
}

function test_props_comps() {
    let parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                           .createInstance(Components.interfaces.calIIcsParser);
    let str = [
        "BEGIN:VCALENDAR",
        "X-WR-CALNAME:CALNAME",
        "BEGIN:VJOURNAL",
        "LOCATION:BEFORE TIME",
        "END:VJOURNAL",
        "BEGIN:VEVENT",
        "UID:123",
        "END:VEVENT",
        "END:VCALENDAR"].join("\r\n");
    parser.parseString(str);

    let props = parser.getProperties({});
    do_check_eq(props.length, 1);
    do_check_eq(props[0].propertyName, "X-WR-CALNAME");
    do_check_eq(props[0].value, "CALNAME");

    let comps = parser.getComponents({});
    do_check_eq(comps.length, 1);
    do_check_eq(comps[0].componentType, "VJOURNAL");
    do_check_eq(comps[0].location, "BEFORE TIME");
}

function test_fake_parent() {
    let parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                           .createInstance(Components.interfaces.calIIcsParser);

    let str = [
        "BEGIN:VCALENDAR",
        "BEGIN:VEVENT",
        "UID:123",
        "RECURRENCE-ID:20120101T010101",
        "DTSTART:20120101T010102",
        "LOCATION:HELL",
        "END:VEVENT",
        "END:VCALENDAR"].join("\r\n");

    parser.parseString(str);

    let items = parser.getItems({});
    do_check_eq(items.length, 1);
    let item = items[0];

    do_check_eq(item.id, "123");
    do_check_true(!!item.recurrenceInfo);
    do_check_eq(item.startDate.icalString, "20120101T010101");
    do_check_eq(item.getProperty("X-MOZ-FAKED-MASTER"), "1");

    let rinfo = item.recurrenceInfo;

    do_check_eq(rinfo.countRecurrenceItems(), 1);
    let excs = rinfo.getOccurrences(cal.createDateTime("20120101T010101"), null, 0, {});
    do_check_eq(excs.length, 1);
    let exc = excs[0];
    do_check_eq(exc.startDate.icalString, "20120101T010102");

    do_check_eq(parser.getParentlessItems({})[0], exc);
}

function test_async() {
    let parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                           .createInstance(Components.interfaces.calIIcsParser);
    let str = [
        "BEGIN:VCALENDAR",
        "BEGIN:VTODO",
        "UID:1",
        "DTSTART:20120101T010101",
        "DUE:20120101T010102",
        "END:VTODO",
        "BEGIN:VTODO",
        "UID:2",
        "DTSTART:20120101T010103",
        "DUE:20120101T010104",
        "END:VTODO",
        "END:VCALENDAR"].join("\r\n");

    do_test_pending();
    parser.parseString(str, null, {
        onParsingComplete: function(rc, parser) {
            let items = parser.getItems({});
            do_check_eq(items.length, 2);
            let item = items[0];
            do_check_true(cal.isToDo(item));

            do_check_eq(item.entryDate.icalString, "20120101T010101");
            do_check_eq(item.dueDate.icalString, "20120101T010102");

            item = items[1];
            do_check_true(cal.isToDo(item));

            do_check_eq(item.entryDate.icalString, "20120101T010103");
            do_check_eq(item.dueDate.icalString, "20120101T010104");

            do_test_finished();
        }
    });
}

function test_timezone() {
    // TODO
}

function test_roundtrip() {
    let parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                           .createInstance(Components.interfaces.calIIcsParser);
    let serializer = Components.classes["@mozilla.org/calendar/ics-serializer;1"]
                               .createInstance(Components.interfaces.calIIcsSerializer);
    let str = [
        "BEGIN:VCALENDAR",
        "PRODID:-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN",
        "VERSION:2.0",
        "X-PROP:VAL",
        "BEGIN:VTODO",
        "UID:1",
        "DTSTART:20120101T010101",
        "DUE:20120101T010102",
        "END:VTODO",
        "BEGIN:VJOURNAL",
        "LOCATION:BEFORE TIME",
        "END:VJOURNAL",
        "END:VCALENDAR",
        ""].join("\r\n");

    parser.parseString(str);

    let items = parser.getItems({});
    serializer.addItems(items, items.length);

    parser.getProperties({}).forEach(serializer.addProperty, serializer);
    parser.getComponents({}).forEach(serializer.addComponent, serializer);

    do_check_eq(serializer.serializeToString().split("\r\n").sort().join("\r\n"),
                str.split("\r\n").sort().join("\r\n"));

    // Test parseFromStream
    parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                       .createInstance(Components.interfaces.calIIcsParser);
    let stream = serializer.serializeToInputStream();

    parser.parseFromStream(stream);

    let items = parser.getItems({});
    let comps = parser.getComponents({});
    let props = parser.getProperties({});
    do_check_eq(items.length, 1);
    do_check_eq(comps.length, 1);
    do_check_eq(props.length, 1);

    let everything = items[0].icalString.split("\r\n").concat(comps[0].serializeToICS().split("\r\n"))
    everything.push((props[0].icalString.split("\r\n"))[0]);
    everything.sort();

    do_check_eq(everything.join("\r\n"), str.split("\r\n").concat([""]).sort().join("\r\n"));

    // Test serializeToStream/parseFromStream
    parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                       .createInstance(Components.interfaces.calIIcsParser);
    let pipe = Components.classes["@mozilla.org/pipe;1"]
                         .createInstance(Components.interfaces.nsIPipe);
    pipe.init(true, true, 0, 0, null);

    serializer.serializeToStream(pipe.outputStream);
    parser.parseFromStream(pipe.inputStream);

    items = parser.getItems({});
    comps = parser.getComponents({});
    props = parser.getProperties({});
    do_check_eq(items.length, 1);
    do_check_eq(comps.length, 1);
    do_check_eq(props.length, 1);

    everything = items[0].icalString.split("\r\n").concat(comps[0].serializeToICS().split("\r\n"));
    everything.push((props[0].icalString.split("\r\n"))[0]);
    everything.sort();

    do_check_eq(everything.join("\r\n"), str.split("\r\n").concat([""]).sort().join("\r\n"));
}
