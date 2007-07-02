CREATE TABLE cal_calendar_schema_version (
    version INTEGER
);

CREATE TABLE cal_calendars (
    id INTEGER PRIMARY KEY,
    type TEXT,
    uri TEXT
);

CREATE TABLE cal_calendars_prefs (
    id INTEGER PRIMARY KEY,
    calendar INTEGER,
    name TEXT,
    value TEXT
);

CREATE TABLE cal_events (
    cal_id INTEGER,
    id TEXT,
    time_created INTEGER,
    last_modified INTEGER,
    title TEXT,
    priority INTEGER,
    privacy TEXT,
    ical_status TEXT,
    recurrence_id INTEGER,
    recurrence_id_tz TEXT,
    flags INTEGER,
    event_start INTEGER,
    event_start_tz TEXT,
    event_end INTEGER,
    event_end_tz TEXT,
    event_stamp INTEGER,
    alarm_time INTEGER,
    alarm_time_tz TEXT,
    alarm_offset INTEGER,
    alarm_related INTEGER,
    alarm_last_ack INTEGER
);

CREATE TABLE cal_todos (
    cal_id INTEGER,
    id TEXT,
    time_created INTEGER,
    last_modified INTEGER,
    title TEXT,
    priority INTEGER,
    privacy TEXT,
    ical_status TEXT,
    recurrence_id INTEGER,
    recurrence_id_tz TEXT,
    flags INTEGER,
    todo_entry INTEGER,
    todo_entry_tz TEXT,
    todo_due INTEGER,
    todo_due_tz TEXT,
    todo_completed INTEGER,
    todo_completed_tz TEXT,
    todo_complete INTEGER,
    alarm_time INTEGER,
    alarm_time_tz TEXT,
    alarm_offset INTEGER,
    alarm_related INTEGER,
    alarm_last_ack INTEGER
);

CREATE TABLE cal_attendees (
    item_id TEXT,
    recurrence_id INTEGER,
    recurrence_id_tz TEXT,
    attendee_id TEXT,
    common_name TEXT,
    rsvp INTEGER,
    role TEXT,
    status TEXT,
    type TEXT
);

CREATE TABLE cal_recurrence (
    item_id TEXT,
    recur_index INTEGER,
    recur_type TEXT,
    is_negative BOOLEAN,
    dates TEXT,
    count INTEGER,
    end_date INTEGER,
    interval INTEGER,
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
    item_id TEXT,
    recurrence_id INTEGER,
    recurrence_id_tz TEXT,
    key TEXT,
    value BLOB
);
