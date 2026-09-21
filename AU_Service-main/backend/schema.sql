-- AU Service Request System — PostgreSQL schema
-- Mirrors the data model in Section 8 of the proposal, plus escalation tracking (FR-13).

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- guarantees gen_random_uuid() on any PG13+

CREATE TYPE user_role AS ENUM ('Staff', 'Focal Point', 'Handler', 'Super Admin');

CREATE TYPE request_status AS ENUM (
  'Draft', 'Submitted', 'Under Review', 'Assigned', 'Completed', 'Closed', 'Rejected'
);

CREATE TYPE priority_level AS ENUM ('Low', 'Normal', 'High', 'Urgent');

CREATE TABLE departments (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE,
  type          TEXT NOT NULL DEFAULT 'Administrative',
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  department_id  TEXT NOT NULL REFERENCES departments(id),
  role           user_role NOT NULL DEFAULT 'Staff',
  active         BOOLEAN NOT NULL DEFAULT true,
  reset_token_hash        TEXT,
  reset_token_expires_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE SEQUENCE request_seq START WITH 1041;


CREATE TABLE requests (
  id                  TEXT PRIMARY KEY,                  -- e.g. REQ-1042
  requesting_dept_id  TEXT NOT NULL REFERENCES departments(id),
  target_dept_id      TEXT NOT NULL REFERENCES departments(id),
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  category            TEXT NOT NULL,
  priority            priority_level NOT NULL DEFAULT 'Normal',
  due_date            DATE,
  attachment_url       TEXT,
  attachment_name      TEXT,
  created_by          UUID NOT NULL REFERENCES users(id),
  assigned_handler_id UUID REFERENCES users(id),
  status              request_status NOT NULL DEFAULT 'Draft',
  rejection_reason    TEXT,
  resolution_notes    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at        TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  escalated_at        TIMESTAMPTZ
);
CREATE INDEX idx_requests_target_dept ON requests(target_dept_id);
CREATE INDEX idx_requests_requesting_dept ON requests(requesting_dept_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_handler ON requests(assigned_handler_id);

CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_request ON comments(request_id);

-- Audit trail (FR-16): every status transition, immutable once written.
CREATE TABLE status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  old_status  request_status,
  new_status  request_status NOT NULL,
  changed_by  UUID REFERENCES users(id),  -- NULL = system-generated (e.g. escalation)
  note        TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_history_request ON status_history(request_id);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id  TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);

-- Seed reference data: departments (Section 4.2) and categories (Section 13)
INSERT INTO departments (id, name, code, type) VALUES
  ('paps', 'Political Affairs, Peace and Security', 'PAPS', 'Policy'),
  ('ardbe', 'Agriculture, Rural Development, Blue Economy and Sustainable Environment', 'ARBE', 'Policy'),
  ('edtti', 'Economic Development, Trade, Tourism, Industry and Minerals', 'EDTTI', 'Policy'),
  ('esti', 'Education, Science, Technology and Innovation', 'ESTI', 'Policy'),
  ('ie', 'Infrastructure and Energy', 'IE', 'Policy'),
  ('hhsd', 'Health, Humanitarian Affairs and Social Development', 'HHSD', 'Policy'),
  ('ahrm', 'Administration and Human Resource Management', 'AHRM', 'Administrative'),
  ('pbfa', 'Programme, Budget, Finance and Accounting', 'PBFA', 'Administrative'),
  ('ict', 'Information and Communication Technology', 'ICT', 'Administrative'),
  ('phcr', 'Protocol and Host Country Relations', 'PHCR', 'Administrative'),
  ('olc', 'Office of Legal Counsel', 'OLC', 'Administrative'),
  ('sppmerm', 'Strategic Planning, Policy, Monitoring, Evaluation and Resource Mobilization', 'SPPMERM', 'Administrative');

INSERT INTO categories (name) VALUES
  ('IT Support'), ('Logistics & Transport'), ('Facilities/Admin'),
  ('Finance & Procurement'), ('HR'), ('Document/Translation Services'), ('General Request');
