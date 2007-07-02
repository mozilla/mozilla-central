CREATE TABLE cal_calendar_schema_version (
    version INTEGER
);

CREATE TABLE cal_calendars (
    id INTEGER PRIMARY KEY,
    type TEXT,
    uri TEXT
);

CREATE TABLE cal_calendars_prefs (
    --
    -- defines arbitrary preferences for a calendar
    -- e.g. name, color, visibility status
    --
    id INTEGER PRIMARY KEY,
    calendar INTEGER, -- REFERENCES cal_calendars.id
    name TEXT,
    value TEXT
);

CREATE TABLE cal_events (
    --
    -- defines an Event calendar component
    --
    cal_id INTEGER, -- REFERENCES cal_calendars.id

    -- ItemBase bits
    id TEXT,
    time_created INTEGER,
    last_modified INTEGER,
    title TEXT,
    priority INTEGER,
    privacy TEXT,

    ical_status TEXT,
    recurrence_id INTEGER,
    recurrence_id_tz TEXT,

    -- CAL_ITEM_FLAG_PRIVATE = 1
    -- CAL_ITEM_FLAG_HAS_ATTENDEES = 2
    -- CAL_ITEM_FLAG_HAS_PROPERTIES = 4
    -- CAL_ITEM_FLAG_EVENT_ALLDAY = 8
    -- CAL_ITEM_FLAG_HAS_RECURRENCE = 16
    -- CAL_ITEM_FLAG_HAS_EXCEPTIONS = 32
    flags INTEGER,

    -- Event bits
    event_start INTEGER,
    event_start_tz TEXT,
    event_end INTEGER,
    event_end_tz TEXT,
    event_stamp INTEGER,

    -- Alarm bits
    alarm_time INTEGER,
    alarm_time_tz TEXT,
    alarm_offset INTEGER,
    alarm_related INTEGER,
    alarm_last_ack INTEGER
);

CREATE TABLE cal_todos (
    --
    -- defines a Todo/Task calendar component
    --
    cal_id INTEGER, -- REFERENCES cal_calendars.id

    -- ItemBase bits
    id TEXT,
    time_created INTEGER,
    last_modified INTEGER,
    title TEXT,
    priority INTEGER,
    privacy TEXT,

    ical_status TEXT,
    recurrence_id INTEGER,
    recurrence_id_tz TEXT,

    -- CAL_ITEM_FLAG_PRIVATE = 1
    -- CAL_ITEM_FLAG_HAS_ATTENDEES = 2
    -- CAL_ITEM_FLAG_HAS_PROPERTIES = 4
    -- CAL_ITEM_FLAG_EVENT_ALLDAY = 8
    -- CAL_ITEM_FLAG_HAS_RECURRENCE = 16
    -- CAL_ITEM_FLAG_HAS_EXCEPTIONS = 32
    flags INTEGER,

    -- Todo bits
    todo_entry INTEGER, -- date the todo is to be displayed
    todo_entry_tz TEXT,
    todo_due INTEGER, -- date the todo is due
    todo_due_tz TEXT,
    todo_completed INTEGER, -- date the todo is completed
    todo_completed_tz TEXT,
    todo_complete INTEGER, -- percent the todo is complete (0-100)

    -- Alarm bits
    alarm_time INTEGER,
    alarm_time_tz TEXT,
    alarm_offset INTEGER,
    alarm_related INTEGER,
    alarm_last_ack INTEGER
);

CREATE TABLE cal_attendees (
    --
    -- defines an "Attendee" within a calendar component
    --
    item_id TEXT, -- REFERENCES cal_events.id respectively cal_todos.id
    recurrence_id INTEGER,
    recurrence_id_tz TEXT,
    attendee_id TEXT, -- ID, e.g. "mailto:jsmith@host.com"
    common_name TEXT, -- CN, e.g. "John Smith" or "jsmith@host.com"
    rsvp INTEGER, -- RSVP expectation
    role TEXT, -- participation role, e.g. "REQ-PARTICIPANT"
    status TEXT, -- participation status
    type TEXT
);

CREATE TABLE cal_recurrence (
    --
    -- defines an "Recurrence Rule" within a calendar component
    --
    item_id TEXT, -- REFERENCES cal_events.id respectively cal_todos.id
    recur_index INTEGER, -- the index in the recurrence array of this thing
    recur_type TEXT, -- values from calIRecurrenceInfo; if null, date-based

    is_negative BOOLEAN,

    --
    -- these are for date-based recurrence
    --

    dates TEXT, -- comma-separated list of dates

    --
    -- these are for rule-based recurrence
    --
    count INTEGER,
    end_date INTEGER,
    interval INTEGER,

    -- components, comma-separated list or null
    second TEXT,
    minute TEXT,
    hour TEXT,
    day TEXT,
    monthday TEXT,
    yearday TEXT,
    weekno TEXT,
    month TEXT,
    setpos TEXT
);

CREATE TABLE cal_properties (
    --
    -- defines arbitrary property within a calendar component
    -- e.g. DESCRIPTION, LOCATION, URL,
    --
    item_id TEXT, -- REFERENCES cal_events.id respectively cal_todos.id
    recurrence_id INTEGER,
    recurrence_id_tz TEXT,
    key TEXT,
    value BLOB
);
