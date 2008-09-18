CREATE TABLE cal_calendar_schema_version (
    version INTEGER
);

CREATE TABLE cal_calendars (
    id INTEGER PRIMARY KEY,
    type STRING,
    uri STRING
);

CREATE TABLE cal_calendars_prefs (
    id INTEGER PRIMARY KEY,
    calendar INTEGER,
    name STRING,
    value STRING
);

CREATE TABLE cal_events (
    cal_id INTEGER,
    id STRING,
    time_created INTEGER,
    last_modified INTEGER,
    title STRING,
    priority INTEGER,
    privacy STRING,
    ical_status STRING,
    recurrence_id INTEGER,
    recurrence_id_tz VARCHAR,
    flags INTEGER,
    event_start INTEGER,
    event_start_tz VARCHAR,
    event_end INTEGER,
    event_end_tz VARCHAR,
    event_stamp INTEGER,
    alarm_time INTEGER,
    alarm_time_tz VARCHAR,
    alarm_offset INTEGER,
    alarm_related INTEGER,
    alarm_last_ack INTEGER
);

CREATE TABLE cal_todos (
    cal_id INTEGER,
    id STRING,
    time_created INTEGER,
    last_modified INTEGER,
    title STRING,
    priority INTEGER,
    privacy STRING,
    ical_status STRING,
    recurrence_id INTEGER,
    recurrence_id_tz VARCHAR,
    flags INTEGER,
    todo_entry INTEGER,
    todo_entry_tz VARCHAR,
    todo_due INTEGER,
    todo_due_tz VARCHAR,
    todo_completed INTEGER,
    todo_completed_tz VARCHAR,
    todo_complete INTEGER,
    alarm_time INTEGER,
    alarm_time_tz VARCHAR,
    alarm_offset INTEGER,
    alarm_related INTEGER,
    alarm_last_ack INTEGER
);

CREATE TABLE cal_attendees (
    item_id STRING,
    recurrence_id INTEGER,
    recurrence_id_tz VARCHAR,
    attendee_id STRING,
    common_name STRING,
    rsvp INTEGER,
    role STRING,
    status STRING,
    type STRING
);

CREATE TABLE cal_recurrence (
    item_id STRING,
    recur_index INTEGER,
    recur_type STRING,
    is_negative BOOLEAN,
    dates STRING,
    count INTEGER,
    end_date INTEGER,
    interval INTEGER,
    second STRING,
    minute STRING,
    hour STRING,
    day STRING,
    monthday STRING,
    yearday STRING,
    weekno STRING,
    month STRING,
    setpos STRING
);

CREATE TABLE cal_properties (
    item_id STRING,
    recurrence_id INTEGER,
    recurrence_id_tz VARCHAR,
    key STRING,
    value BLOB
);
