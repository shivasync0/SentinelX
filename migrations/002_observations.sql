-- Additive schema for persisted Sentinel X live observations.
CREATE TABLE observations (id INTEGER PRIMARY KEY, brand_id INTEGER, candidate_id INTEGER,
  source_url VARCHAR(2048) NOT NULL, canonical_url VARCHAR(2048) NOT NULL,
  final_url VARCHAR(2048), observed_at TIMESTAMP NOT NULL, status VARCHAR(30) NOT NULL,
  http_status INTEGER, content_type VARCHAR(240), title TEXT, description TEXT,
  provider VARCHAR(255), domain VARCHAR(255), asset_type VARCHAR(40) NOT NULL,
  blocked BOOLEAN NOT NULL, error TEXT, links JSON NOT NULL, signals JSON NOT NULL,
  mode VARCHAR(30) NOT NULL, changed BOOLEAN NOT NULL, changed_fields JSON NOT NULL,
  previous_observed_at TIMESTAMP, change_summary JSON NOT NULL,
  FOREIGN KEY (brand_id) REFERENCES brands(id), FOREIGN KEY (candidate_id) REFERENCES candidates(id));
