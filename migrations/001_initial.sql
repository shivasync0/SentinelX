-- Reference schema for the local MVP. The running app currently creates this shape
-- through SQLAlchemy metadata so a first demo needs no migration service.
CREATE TABLE brands (id INTEGER PRIMARY KEY, name VARCHAR(160) NOT NULL UNIQUE,
  canonical_name VARCHAR(160) NOT NULL, domains JSON NOT NULL, description TEXT,
  created_at TIMESTAMP NOT NULL);
CREATE TABLE sources (id INTEGER PRIMARY KEY, url VARCHAR(500) NOT NULL UNIQUE,
  title VARCHAR(240) NOT NULL, publisher VARCHAR(160), source_type VARCHAR(40) NOT NULL,
  trust_level VARCHAR(30) NOT NULL, created_at TIMESTAMP NOT NULL);
CREATE TABLE official_assets (id INTEGER PRIMARY KEY, brand_id INTEGER NOT NULL,
  asset_type VARCHAR(40) NOT NULL, name VARCHAR(240) NOT NULL, url VARCHAR(500) NOT NULL,
  fingerprint VARCHAR(128), status VARCHAR(30) NOT NULL,
  FOREIGN KEY (brand_id) REFERENCES brands(id));
CREATE TABLE candidates (id INTEGER PRIMARY KEY, brand_id INTEGER, source_id INTEGER,
  name VARCHAR(240) NOT NULL, normalized_name VARCHAR(240) NOT NULL,
  candidate_type VARCHAR(40) NOT NULL, domain VARCHAR(255), url VARCHAR(500),
  status VARCHAR(30) NOT NULL, metadata JSON NOT NULL, created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (brand_id) REFERENCES brands(id), FOREIGN KEY (source_id) REFERENCES sources(id));
CREATE TABLE scans (id INTEGER PRIMARY KEY, target VARCHAR(240) NOT NULL,
  status VARCHAR(30) NOT NULL, deterministic BOOLEAN NOT NULL, score FLOAT NOT NULL,
  risk_level VARCHAR(20) NOT NULL, summary TEXT NOT NULL, started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP NOT NULL);
CREATE TABLE scan_findings (id INTEGER PRIMARY KEY, scan_id INTEGER NOT NULL,
  candidate_id INTEGER, category VARCHAR(60) NOT NULL, signal VARCHAR(100) NOT NULL,
  evidence TEXT NOT NULL, weight FLOAT NOT NULL, score_contribution FLOAT NOT NULL,
  excluded BOOLEAN NOT NULL, FOREIGN KEY (scan_id) REFERENCES scans(id));
CREATE TABLE investigations (id INTEGER PRIMARY KEY, title VARCHAR(240) NOT NULL,
  status VARCHAR(30) NOT NULL, priority VARCHAR(20) NOT NULL, notes TEXT NOT NULL,
  scan_id INTEGER, candidate_ids JSON NOT NULL, created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL, FOREIGN KEY (scan_id) REFERENCES scans(id));
CREATE TABLE reports (id INTEGER PRIMARY KEY, title VARCHAR(240) NOT NULL,
  report_type VARCHAR(40) NOT NULL, scan_id INTEGER, payload JSON NOT NULL,
  generated_at TIMESTAMP NOT NULL, FOREIGN KEY (scan_id) REFERENCES scans(id));
