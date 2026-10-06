// The shape of the database.
// Each string below is one "migration": it runs once, in order, and SQLite remembers how many have run
// (PRAGMA user_version). So changing the layout later means adding a NEW string at the end, never editing an old one.
module.exports = [
  // ---- 1: the first layout ----
  `
  -- everything you catalogue: people, places, fears, objects...
  CREATE TABLE entities (
    id         TEXT PRIMARY KEY,             -- a random id, as text (the page treats ids as opaque strings)
    ref        TEXT NOT NULL UNIQUE,         -- PER-0001, PLA-0003...
    type       TEXT NOT NULL,
    name       TEXT NOT NULL,
    summary    TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    fields     TEXT NOT NULL DEFAULT '{}',   -- the extra fields that depend on the type, as JSON (the page calls this f)
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX entities_type_name ON entities (type, name COLLATE NOCASE);

  -- a list of values per entry gets its own little table: one row per value.
  -- ON DELETE CASCADE means "when the entry goes, delete these rows too", so nothing is ever left pointing at nothing
  CREATE TABLE entity_fears (
    entity_id TEXT NOT NULL REFERENCES entities (id) ON DELETE CASCADE,
    fear      TEXT NOT NULL,
    PRIMARY KEY (entity_id, fear)
  ) WITHOUT ROWID;

  CREATE TABLE entity_tags (
    entity_id TEXT NOT NULL REFERENCES entities (id) ON DELETE CASCADE,
    tag       TEXT NOT NULL,
    PRIMARY KEY (entity_id, tag)
  ) WITHOUT ROWID;

  -- the statements (episodes)
  CREATE TABLE episodes (
    id             TEXT PRIMARY KEY,
    number         INTEGER UNIQUE,           -- MAG 001 is 1. Two statements can't share a number (several can have none)
    season         INTEGER,
    title          TEXT NOT NULL,
    giver          TEXT NOT NULL DEFAULT '',
    subject        TEXT NOT NULL DEFAULT '',
    case_no        TEXT NOT NULL DEFAULT '', -- not unique: the show reuses some, and some have none
    statement_date TEXT NOT NULL DEFAULT '', -- when the statement was given (typed as free text)
    actual_date    TEXT NOT NULL DEFAULT '', -- when the events took place
    text           TEXT NOT NULL DEFAULT ''  -- the transcript
  );

  CREATE TABLE episode_fears (
    episode_id TEXT NOT NULL REFERENCES episodes (id) ON DELETE CASCADE,
    fear       TEXT NOT NULL,
    PRIMARY KEY (episode_id, fear)
  ) WITHOUT ROWID;

  -- "this entry appears in this statement": one row per pair. Deleting either side removes the row.
  CREATE TABLE appearances (
    entity_id  TEXT NOT NULL REFERENCES entities (id) ON DELETE CASCADE,
    episode_id TEXT NOT NULL REFERENCES episodes (id) ON DELETE CASCADE,
    PRIMARY KEY (entity_id, episode_id)
  ) WITHOUT ROWID;
  CREATE INDEX appearances_episode ON appearances (episode_id);

  -- links between two entries. mutual = 1 means it reads the same from both ends ("friend of")
  CREATE TABLE relationships (
    id     TEXT PRIMARY KEY,
    a      TEXT NOT NULL REFERENCES entities (id) ON DELETE CASCADE,
    b      TEXT NOT NULL REFERENCES entities (id) ON DELETE CASCADE,
    kind   TEXT NOT NULL DEFAULT '',
    note   TEXT NOT NULL DEFAULT '',
    mutual INTEGER NOT NULL DEFAULT 0 CHECK (mutual IN (0, 1)),
    CHECK (a <> b)                           -- an entry can't link to itself (the database enforces it too)
  );
  CREATE INDEX relationships_a ON relationships (a);
  CREATE INDEX relationships_b ON relationships (b);

  -- the last number handed out for each reference prefix
  CREATE TABLE counters (
    prefix TEXT PRIMARY KEY,
    n      INTEGER NOT NULL
  );

  -- small notes the app keeps for itself, like "the 200 statements have been added"
  CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  -- Full-text search over statements. "trigram" means it matches any 3 letters in a row,
  -- so "jonath" finds "Jonathan" (the same partial-word matching the old search had).
  -- content='episodes' = the index points at the episodes table instead of keeping its own copy of the text
  CREATE VIRTUAL TABLE episodes_fts USING fts5 (
    title, giver, subject, case_no, statement_date, actual_date, text,
    content = 'episodes', content_rowid = 'rowid', tokenize = 'trigram'
  );

  -- triggers keep that index in step with the table automatically, so no model code has to remember to
  CREATE TRIGGER episodes_ai AFTER INSERT ON episodes BEGIN
    INSERT INTO episodes_fts (rowid, title, giver, subject, case_no, statement_date, actual_date, text)
    VALUES (new.rowid, new.title, new.giver, new.subject, new.case_no, new.statement_date, new.actual_date, new.text);
  END;
  CREATE TRIGGER episodes_ad AFTER DELETE ON episodes BEGIN
    INSERT INTO episodes_fts (episodes_fts, rowid, title, giver, subject, case_no, statement_date, actual_date, text)
    VALUES ('delete', old.rowid, old.title, old.giver, old.subject, old.case_no, old.statement_date, old.actual_date, old.text);
  END;
  CREATE TRIGGER episodes_au AFTER UPDATE ON episodes BEGIN
    INSERT INTO episodes_fts (episodes_fts, rowid, title, giver, subject, case_no, statement_date, actual_date, text)
    VALUES ('delete', old.rowid, old.title, old.giver, old.subject, old.case_no, old.statement_date, old.actual_date, old.text);
    INSERT INTO episodes_fts (rowid, title, giver, subject, case_no, statement_date, actual_date, text)
    VALUES (new.rowid, new.title, new.giver, new.subject, new.case_no, new.statement_date, new.actual_date, new.text);
  END;
  `,
];
